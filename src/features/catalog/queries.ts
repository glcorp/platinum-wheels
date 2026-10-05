/**
 * Storefront reads: everything a public page asks the catalogue.
 *
 * Plain async functions for Server Components to call; there is no REST layer
 * in between. Server only: never import this from a `"use client"` file, it
 * opens database connections (`src/db/llm.md`).
 *
 * Visibility is decided here and nowhere else:
 *   - listings, facets, "other sizes", "similar" and the sitemap see
 *     `published` products only;
 *   - a product page loads `published` and `discontinued`;
 *   - `hidden` is never returned by anything in this file.
 * Vendor sources are staff-only and are not read here at all: no query in
 * this file may select `product_sources`, and above all never its
 * `vendor_price`, which is what a vendor charges the shop (D125).
 */

import {
  and,
  arrayContains,
  arrayOverlaps,
  asc,
  between,
  count,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  max,
  min,
  ne,
  not,
  or,
  sql,
  type AnyColumn,
  type SQL,
} from "drizzle-orm";
import { unionAll, type PgSelect } from "drizzle-orm/pg-core";

import { getDb } from "@/db/client";
import { stripBrandPrefix } from "@/lib/product-name";
import { PRICES_VISIBLE } from "@/lib/site";
import {
  accessorySpecs,
  productImages,
  products,
  tireSpecs,
  wheelSpecs,
  type ProductRow,
  type WheelSpecsRow,
} from "@/db/schema";

import {
  ACCESSORY_KINDS,
  TIRE_SEASONS,
  type AccessoryKind,
  type CatalogFacets,
  type CatalogProduct,
  type CatalogProductDetail,
  type CatalogSort,
  type FacetCount,
  type ListProductsInput,
  type ProductCategory,
  type ProductFilters,
  type ProductList,
  type TireSeason,
} from "./catalog-types";
import {
  loadImages,
  PRODUCT_SELECTION,
  toCatalogProduct,
  withSpecs,
  type Executor,
  type ProductJoinRow,
} from "./rows";
import { listingFacts } from "./siblings";
import { normalizeBoltPattern, normalizeThreadSize } from "./size";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 150;
const MAX_OFFSET = 1_000_000;
/** The `products_slug_format` CHECK. Anything else cannot be a slug, so it is
 *  a 404 without asking the database (which refuses some of it outright). */
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SLUG_MAX_LENGTH = 200;

/** How far "near" reaches. A tire one step wider or one profile taller; a
 *  wheel up to an inch wider or narrower. */
const NEAR = {
  tireWidth: 10,
  tireAspectRatio: 5,
  wheelWidth: 1,
  /** A flotation tire: overall diameter and section width, in inches. */
  flotation: 1,
} as const;

const NOTHING = sql`false`;

const HAS_PHOTO = sql`exists (select 1 from ${productImages} where ${productImages.productId} = ${products.id})`;

/* Prices switched off (D122; owner 2026-10-02, D124): a stored price never
   leaves this module and never orders a page. Hiding it only in the
   components still shipped it in the page data a browser receives, and
   still ranked cheaper products first. Every reader of this file is a
   storefront page; the admin reads prices through `store.ts`. */
const PRICE_ORDER: SQL[] = PRICES_VISIBLE ? [sql`${products.price} asc nulls last`] : [];

function storefrontPrice<T extends { price: number | null }>(product: T): T {
  return PRICES_VISIBLE ? product : { ...product, price: null };
}

/**
 * Rows → storefront products: the first image of each, the price rule, and
 * the facts that tell a card from its look-alikes (`tellingFacts`, when it
 * has a sibling). The photo read and the sibling read run together, so a page
 * costs one extra round trip, not two (launch audit D145; D153).
 */
async function toStorefrontProducts(
  db: Executor,
  rows: readonly ProductJoinRow[],
): Promise<CatalogProduct[]> {
  const bare = rows.map((row) => toCatalogProduct(row, null));
  const [images, siblings] = await Promise.all([
    loadImages(
      db,
      bare.map((product) => product.id),
    ),
    getListingSiblings(db, bare),
  ]);
  const facts = listingFacts(bare, siblings);
  return bare.map((product) => {
    const mine = facts.get(product.id);
    return storefrontPrice({
      ...product,
      image: images.get(product.id)?.[0] ?? null,
      ...(mine === undefined ? {} : { tellingFacts: mine }),
    });
  });
}

/* --- Filters → SQL ------------------------------------------------------- */

/** A facet's own group is left out when counting its options, so a count says
 *  what choosing that option would yield given every OTHER filter. */
type FilterGroup = "brands" | "chips" | "finishes" | "threads";

/**
 * Filters arrive from a query string, so a value may be anything. One that
 * its column could never hold is treated as "not given" rather than sent to
 * Postgres, which would answer with an error instead of an empty list.
 */
function wholeNumber(value: number | undefined): number | undefined {
  return value !== undefined &&
    Number.isInteger(value) &&
    value > 0 &&
    value < 10_000
    ? value
    : undefined;
}

function measure(value: number | undefined): number | undefined {
  return value !== undefined &&
    Number.isFinite(value) &&
    value > 0 &&
    value < 1_000
    ? value
    : undefined;
}

function amount(value: number | undefined): number | undefined {
  return value !== undefined &&
    Number.isFinite(value) &&
    value >= 0 &&
    value < 100_000_000
    ? value
    : undefined;
}

/** A signed measure: an offset runs from about -265 to +169 mm, so `measure`
 *  (positive only) cannot read it. */
function signedMeasure(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && Math.abs(value) < 10_000
    ? value
    : undefined;
}

/** The three tire size parts and the three wheel size parts, cleaned. A bolt
 *  pattern is stored in one spelling, so the filter is put into it too.
 *
 *  A tire's `width` and `aspectRatio` are decimals here, not whole numbers:
 *  on a flotation size they are the overall diameter (`33`, or `31.5`) and the
 *  section width (`12.5`). `metricWidth` / `metricAspectRatio` are the parts
 *  the INTEGER columns can be compared with, or `undefined` when the value is
 *  not a whole number: Postgres answers `width = '205.5'` with an error, not
 *  an empty list. */
function sizeParts(filters: Pick<ProductFilters, "tire" | "wheel">) {
  const boltPattern = filters.wheel?.boltPattern;
  const width = measure(filters.tire?.width);
  const aspectRatio = measure(filters.tire?.aspectRatio);
  return {
    tire: {
      width,
      aspectRatio,
      metricWidth:
        width !== undefined && Number.isInteger(width) ? width : undefined,
      metricAspectRatio:
        aspectRatio !== undefined && Number.isInteger(aspectRatio)
          ? aspectRatio
          : undefined,
      rimDiameter: measure(filters.tire?.rimDiameter),
    },
    wheel: {
      diameter: measure(filters.wheel?.diameter),
      width: measure(filters.wheel?.width),
      // `null` = a bolt pattern was given and is not one: match nothing.
      boltPattern:
        boltPattern === undefined ? undefined : normalizeBoltPattern(boltPattern),
    },
  };
}

type TireParts = ReturnType<typeof sizeParts>["tire"];

/* Tire width and profile mean two things (the trade's convention): on a metric
   size they are the section width in mm and the aspect ratio; on a flotation
   size (`33x12.50R20`) the "width" is the overall diameter and the "profile"
   the section width, both in inches. A flotation tire has no `width` or
   `aspect_ratio` and a metric one has no `overall_diameter` or
   `section_width`, so one value matches whichever format owns it, and a
   metric part paired with a flotation part matches nothing. `coalesce`
   because the `or` is NULL, not false, on a row where the other format's
   column is empty, and `not(NULL)` would drop it from the "similar" list. */
function tireWidthIs(parts: TireParts): SQL | undefined {
  if (parts.width === undefined) return undefined;
  const either = or(
    parts.metricWidth === undefined
      ? undefined
      : eq(tireSpecs.width, parts.metricWidth),
    eq(tireSpecs.overallDiameter, parts.width),
  );
  return sql`coalesce(${either}, false)`;
}

function tireProfileIs(parts: TireParts): SQL | undefined {
  if (parts.aspectRatio === undefined) return undefined;
  const either = or(
    parts.metricAspectRatio === undefined
      ? undefined
      : eq(tireSpecs.aspectRatio, parts.metricAspectRatio),
    eq(tireSpecs.sectionWidth, parts.aspectRatio),
  );
  return sql`coalesce(${either}, false)`;
}

/** The leading number of a load index: `98`, or `121` of `121/118`. */
const LOAD_INDEX_FIRST = sql`nullif(substring(${tireSpecs.loadIndex} from '^[0-9]{1,3}'), '')::int`;

/**
 * True for a lug nut, lug bolt or wheel lock cut to a thread other than the
 * vehicle's (lug bolts are their own type since D125).
 * Only a product that STATES a different thread contradicts: one with no
 * thread on record, and every other kind of accessory, never does. `coalesce`
 * keeps a product with no spec row on the "does not contradict" side, so it
 * lands in the matches rather than in neither list.
 */
function contradictsThread(thread: string): SQL {
  return sql`coalesce(${accessorySpecs.accessoryType} in ('lug_nuts', 'lug_bolts', 'wheel_locks') and ${accessorySpecs.threadSize} is not null and ${accessorySpecs.threadSize} <> ${normalizeThreadSize(thread)}, false)`;
}

function vehicleThread(filters: ProductFilters): string | null {
  const thread =
    filters.category === "accessories" ? filters.accessory?.thread?.trim() : "";
  return thread ? thread : null;
}

/** Millimetres either side of a hub bore that still counts as fitting: a hub
 *  ring's inner diameter, and a wheel's centre bore against the hub. 0.5 mm
 *  (loose fit, owner 2026-10-06; coordinator, derived): vendors list GM's
 *  78.1 hub with 77.8 wheels as fitting. */
const BORE_TOLERANCE = 0.5;
/** Inches beyond the stock wheel width, either side, a wheel is still a best
 *  match (loose fit; derived): most wheels a vendor lists for a car and the
 *  stock range misses are 0.5 to 1 inch over. */
const WHEEL_WIDTH_SLACK = 0.5;

/** True for a hub ring whose inner diameter is another size than the
 *  vehicle's hub bore. A ring states the bore it fits as its inner diameter,
 *  so it is the one fact both sides state. A ring with no inner diameter, and
 *  every other accessory, never contradicts. */
function contradictsBore(bore: number): SQL {
  return sql`coalesce(${accessorySpecs.accessoryType} = 'hub_rings' and ${accessorySpecs.innerDiameterMm} is not null and abs(${accessorySpecs.innerDiameterMm} - ${bore}) > ${BORE_TOLERANCE}, false)`;
}

/** True for the fastener the vehicle cannot take: a lug nut on a hub-bolt
 *  car, a lug bolt on a stud-and-nut one. Decided by the product's type
 *  alone (D155). */
function contradictsFastener(fastener: "nut" | "bolt"): SQL {
  const wrong = fastener === "bolt" ? "lug_nuts" : "lug_bolts";
  return sql`coalesce(${accessorySpecs.accessoryType} = ${wrong}, false)`;
}

/** What a vehicle's own facts rule out among accessories, or `null` when it
 *  has no fact an accessory could contradict. */
function accessoryContradiction(filters: ProductFilters): SQL | null {
  if (filters.category !== "accessories") return null;
  const parts: SQL[] = [];
  const thread = vehicleThread(filters);
  if (thread !== null) parts.push(contradictsThread(thread));
  const fastener = filters.accessory?.fastener;
  if (fastener === "nut" || fastener === "bolt") {
    parts.push(contradictsFastener(fastener));
  }
  const bore = measure(filters.accessory?.hubBore);
  if (bore !== undefined) parts.push(contradictsBore(bore));
  return parts.length === 0 ? null : (or(...parts) ?? null);
}

/* A vehicle's tires (`finder/tire-fit.ts`, D155). Metric tires carry
   `width` and `aspect_ratio`; flotation ones carry `overall_diameter` and
   `section_width`. The measuring rim width a tire is built for is its section
   width times a ratio that grows as the sidewall shortens (about .70 on a
   70-series, .85 on a 35), over 25.4 for inches. */
const MEASURING_RIM_RATIO = sql`(case when ${tireSpecs.aspectRatio} >= 70 then 0.70 when ${tireSpecs.aspectRatio} >= 60 then 0.75 when ${tireSpecs.aspectRatio} >= 50 then 0.78 when ${tireSpecs.aspectRatio} >= 40 then 0.82 else 0.85 end)`;
const MEASURING_RIM_IN = sql`(${tireSpecs.width} * ${MEASURING_RIM_RATIO} / 25.4)`;
const SIDEWALL_MM = sql`(${tireSpecs.width} * ${tireSpecs.aspectRatio} / 100.0)`;
/** Overall diameter in inches: stored on a flotation tire, worked out from the
 *  rim and the two sidewalls on a metric one (NULL without an aspect ratio). */
const OVERALL_DIAMETER_IN = sql`coalesce(${tireSpecs.overallDiameter}, ${tireSpecs.rimDiameter} + 2 * ${tireSpecs.width} * ${tireSpecs.aspectRatio} / 2540.0)`;
/** Section width in mm on either format. */
const SECTION_WIDTH_MM = sql`coalesce(${tireSpecs.width}::numeric, ${tireSpecs.sectionWidth} * 25.4)`;

/** Inches either side of the wheel's width a tire may sit: the approved range
 *  is wider than the measuring width, and the ratio above is an estimate. */
const FIT_WIDTH = { best: 0.75, near: 1.25 } as const;
/** The plus sizes: one inch down, two up, same sidewall band. */
const FIT_RIM = { down: 1, up: 2 } as const;
/** How far outside the stock envelope's overall diameter a similar tire may
 *  be. The vendors round the envelope to whole inches, so half an inch is the
 *  rounding, not a plus size. */
const FIT_DIAMETER_SLACK = 0.5;

type TireFitInput = NonNullable<NonNullable<ProductFilters["tire"]>["vehicleFit"]>;

/** How many factory sizes, flotation sizes and wheels one query carries. The
 *  data is generated, never typed by a visitor, so these only bound the SQL;
 *  the largest Auto Country model-year measured had under 40 sizes (D155). */
const MAX_FACTORY_SIZES = 48;
const MAX_FLOTATION_SIZES = 16;
const MAX_FACTORY_RIMS = 32;

/** The rim rule (no factory sizes; `tire-fit.ts` always sends an envelope
 *  with sizes, so the no-envelope branch is only a defence): a tire that
 *  suits any of the vehicle's wheels, `best` on the wheel's own diameter and
 *  `near` on the plus sizes with a wider width range. */
function rimRule(fit: TireFitInput, kind: "best" | "near"): SQL {
  const min = measure(fit.sidewallMinMm);
  const max = measure(fit.sidewallMaxMm);
  /* A tire suits the vehicle when it suits any of its factory wheels. */
  const perRim: SQL[] = [];
  for (const rim of fit.rims.slice(0, MAX_FACTORY_RIMS)) {
    const rimDiameter = measure(rim.diameter);
    const rimWidth = measure(rim.width);
    if (rimDiameter === undefined || rimWidth === undefined) continue;
    const diameter =
      kind === "best"
        ? eq(tireSpecs.rimDiameter, rimDiameter)
        : between(
            tireSpecs.rimDiameter,
            rimDiameter - FIT_RIM.down,
            rimDiameter + FIT_RIM.up,
          );
    perRim.push(
      sql`(${diameter} and abs(${MEASURING_RIM_IN} - ${rimWidth}) <= ${FIT_WIDTH[kind]})`,
    );
  }
  if (min === undefined || max === undefined || perRim.length === 0) return NOTHING;
  return sql`coalesce(${SIDEWALL_MM} between ${min} and ${max} and (${sql.join(perRim, sql` or `)}), false)`;
}

/** A tire whose size is one of the vehicle's factory sizes. */
function factorySize(fit: TireFitInput): SQL {
  const parts: SQL[] = [];
  for (const size of fit.sizes.slice(0, MAX_FACTORY_SIZES)) {
    const width = wholeNumber(size.width);
    const profile = wholeNumber(size.profile);
    const rim = measure(size.rim);
    if (width === undefined || profile === undefined || rim === undefined) continue;
    const match = and(
      eq(tireSpecs.width, width),
      eq(tireSpecs.aspectRatio, profile),
      eq(tireSpecs.rimDiameter, rim),
    );
    if (match) parts.push(match);
  }
  for (const size of fit.flotation.slice(0, MAX_FLOTATION_SIZES)) {
    const diameter = measure(size.diameter);
    const section = measure(size.section);
    const rim = measure(size.rim);
    if (diameter === undefined || section === undefined || rim === undefined) continue;
    const match = and(
      eq(tireSpecs.overallDiameter, diameter),
      eq(tireSpecs.sectionWidth, section),
      eq(tireSpecs.rimDiameter, rim),
    );
    if (match) parts.push(match);
  }
  if (parts.length === 0) return NOTHING;
  return sql`coalesce(${or(...parts)}, false)`;
}

/** A tire inside the vehicle's stock envelope. A bound that is missing or 0
 *  (`measure` reads both as "not given") is unbounded on that side. */
function stockEnvelope(range: NonNullable<TireFitInput["range"]>): SQL {
  const dMin = measure(range.diameterMin);
  const dMax = measure(range.diameterMax);
  const wMin = measure(range.widthMin);
  const wMax = measure(range.widthMax);
  const rMin = measure(range.rimMin ?? undefined);
  const rMax = measure(range.rimMax ?? undefined);
  const parts: SQL[] = [];
  if (dMin !== undefined) parts.push(sql`${OVERALL_DIAMETER_IN} >= ${dMin - FIT_DIAMETER_SLACK}`);
  if (dMax !== undefined) parts.push(sql`${OVERALL_DIAMETER_IN} <= ${dMax + FIT_DIAMETER_SLACK}`);
  if (wMin !== undefined) parts.push(sql`${SECTION_WIDTH_MM} >= ${wMin}`);
  if (wMax !== undefined) parts.push(sql`${SECTION_WIDTH_MM} <= ${wMax}`);
  if (rMin !== undefined) parts.push(gte(tireSpecs.rimDiameter, rMin));
  if (rMax !== undefined) parts.push(lte(tireSpecs.rimDiameter, rMax));
  if (parts.length === 0) return sql`true`;
  return sql`coalesce(${and(...parts)}, false)`;
}

function hasFactorySizes(fit: TireFitInput): boolean {
  return fit.sizes.length > 0 || fit.flotation.length > 0;
}

/** The vehicle's best tires: its factory sizes, else the rim rule's best. */
function tireVehicleBest(fit: TireFitInput): SQL {
  return hasFactorySizes(fit) ? factorySize(fit) : rimRule(fit, "best");
}

/** The vehicle's similar tires, never one of the best: inside the stock
 *  envelope when there are factory sizes and an envelope, else the rim rule's
 *  near list. */
function tireVehicleNear(fit: TireFitInput): SQL {
  const best = tireVehicleBest(fit);
  const near =
    hasFactorySizes(fit) && fit.range !== null
      ? stockEnvelope(fit.range)
      : rimRule(fit, "near");
  return and(near, not(best)) ?? NOTHING;
}

/* A vehicle's wheels (`finder/tire-fit.ts` `wheelFit`, D155). */
type WheelFitInput = NonNullable<NonNullable<ProductFilters["wheel"]>["vehicleFit"]>;

/** A wheel drilled for any of the vehicle's bolt patterns. `null` when none
 *  of them is a bolt pattern, which means the vehicle narrows no wheel. */
function wheelBolt(fit: WheelFitInput): SQL | null {
  const patterns: string[] = [];
  for (const raw of fit.boltPatterns.slice(0, 6)) {
    const pattern = normalizeBoltPattern(raw);
    if (pattern !== null && !patterns.includes(pattern)) patterns.push(pattern);
  }
  return patterns.length === 0 ? null : arrayOverlaps(wheelSpecs.boltPatterns, patterns);
}

/** The vehicle's best wheels: the right bolt pattern, and with an envelope
 *  also inside it (a wheel with no offset on record is not outside it) and
 *  with a centre bore at least the hub's. A bore the wheel does not state
 *  passes only when there is no envelope. */
function wheelVehicleBest(fit: WheelFitInput): SQL {
  const bolt = wheelBolt(fit);
  if (bolt === null) return sql`true`;
  const parts: SQL[] = [bolt];
  const range = fit.range;
  if (range !== null) {
    /* A diameter or width bound that is missing or 0 is unbounded on that
       side; the width gets `WHEEL_WIDTH_SLACK` beyond each stated bound. */
    const dMin = measure(range.diameterMin);
    const dMax = measure(range.diameterMax);
    const wMin = measure(range.widthMin);
    const wMax = measure(range.widthMax);
    if (dMin !== undefined) parts.push(gte(wheelSpecs.diameter, dMin));
    if (dMax !== undefined) parts.push(lte(wheelSpecs.diameter, dMax));
    if (wMin !== undefined) parts.push(gte(wheelSpecs.width, wMin - WHEEL_WIDTH_SLACK));
    if (wMax !== undefined) parts.push(lte(wheelSpecs.width, wMax + WHEEL_WIDTH_SLACK));
    /* A wheel with no offset on record is not outside the range; a missing
       offset bound is unbounded on that side (0 mm is a real offset). */
    const oMin = signedMeasure(range.offsetMin ?? undefined);
    const oMax = signedMeasure(range.offsetMax ?? undefined);
    if (oMin !== undefined) {
      parts.push(sql`(${wheelSpecs.offsetMm} is null or ${wheelSpecs.offsetMm} >= ${oMin})`);
    }
    if (oMax !== undefined) {
      parts.push(sql`(${wheelSpecs.offsetMm} is null or ${wheelSpecs.offsetMm} <= ${oMax})`);
    }
  }
  const bore = measure(fit.hubBore ?? undefined);
  if (bore !== undefined) {
    parts.push(
      sql`coalesce(${wheelSpecs.centerBoreMm} >= ${bore - BORE_TOLERANCE}, ${range === null ? sql`true` : sql`false`})`,
    );
  }
  return sql`coalesce(${and(...parts)}, false)`;
}

/** The vehicle's similar wheels: the right bolt pattern and not a best match
 *  (outside the envelope, a bore too small, or, with an envelope, a bore not
 *  stated). */
function wheelVehicleNear(fit: WheelFitInput): SQL {
  const bolt = wheelBolt(fit);
  if (bolt === null) return NOTHING;
  return and(bolt, not(wheelVehicleBest(fit))) ?? NOTHING;
}

/** Every size part given, matched exactly. `null` = no size part given. */
function exactSize(filters: ProductFilters): SQL | null {
  const parts: SQL[] = [];
  const contradiction = accessoryContradiction(filters);
  if (contradiction !== null) parts.push(not(contradiction));
  if (filters.category === "tires") {
    const tire = sizeParts(filters).tire;
    if (filters.tire?.vehicleFit) {
      parts.push(tireVehicleBest(filters.tire.vehicleFit));
    }
    const width = tireWidthIs(tire);
    const profile = tireProfileIs(tire);
    if (width !== undefined) parts.push(width);
    if (profile !== undefined) parts.push(profile);
    if (tire.rimDiameter !== undefined) {
      parts.push(eq(tireSpecs.rimDiameter, tire.rimDiameter));
    }
  }
  if (filters.category === "wheels") {
    const { diameter, width, boltPattern } = sizeParts(filters).wheel;
    if (filters.wheel?.vehicleFit) {
      parts.push(wheelVehicleBest(filters.wheel.vehicleFit));
    }
    if (diameter !== undefined) parts.push(eq(wheelSpecs.diameter, diameter));
    if (width !== undefined) parts.push(eq(wheelSpecs.width, width));
    if (boltPattern === null) parts.push(NOTHING);
    if (boltPattern) {
      parts.push(arrayContains(wheelSpecs.boltPatterns, [boltPattern]));
    }
  }
  return parts.length === 0 ? null : (and(...parts) ?? null);
}

/**
 * The "similar options" list: close to the size asked for, never the size
 * itself. Needs an anchor (a tire's rim, a wheel's diameter) and something to
 * relax (a width or a profile); without both there is nothing similar to show.
 *
 * A tire is near on its own format's terms, whichever the buyer's size is:
 * metric = width within 10 mm and profile within 5; flotation = overall
 * diameter within 1 inch and section width within 1 inch. Both clauses are
 * offered and the one that cannot match (a metric width has no flotation
 * tire within an inch of it, `205` against `33`) is empty, so a mixed pair
 * (`33` with `45`) matches nothing.
 */
function nearSize(filters: ProductFilters): SQL {
  const contradiction = accessoryContradiction(filters);
  if (contradiction !== null) return contradiction;

  /* A vehicle's own fit decides the similar row on its own terms (D155): it
     is never sent beside an explicit size part. */
  if (filters.category === "tires" && filters.tire?.vehicleFit) {
    return tireVehicleNear(filters.tire.vehicleFit);
  }
  if (filters.category === "wheels" && filters.wheel?.vehicleFit) {
    return wheelVehicleNear(filters.wheel.vehicleFit);
  }

  const exact = exactSize(filters);
  if (exact === null) return NOTHING;

  if (filters.category === "tires") {
    const { width, aspectRatio, metricWidth, metricAspectRatio, rimDiameter } =
      sizeParts(filters).tire;
    if (rimDiameter === undefined) return NOTHING;
    if (width === undefined && aspectRatio === undefined) return NOTHING;
    const rim = eq(tireSpecs.rimDiameter, rimDiameter);

    const metric: SQL[] = [];
    if (width !== undefined) {
      /* A fractional width is no metric width (the column is an integer). */
      metric.push(
        metricWidth === undefined
          ? NOTHING
          : between(
              tireSpecs.width,
              metricWidth - NEAR.tireWidth,
              metricWidth + NEAR.tireWidth,
            ),
      );
    }
    if (aspectRatio !== undefined) {
      metric.push(
        metricAspectRatio === undefined
          ? NOTHING
          : between(
              tireSpecs.aspectRatio,
              metricAspectRatio - NEAR.tireAspectRatio,
              metricAspectRatio + NEAR.tireAspectRatio,
            ),
      );
    }
    const flotation: SQL[] = [];
    if (width !== undefined) {
      flotation.push(
        between(
          tireSpecs.overallDiameter,
          width - NEAR.flotation,
          width + NEAR.flotation,
        ),
      );
    }
    if (aspectRatio !== undefined) {
      flotation.push(
        between(
          tireSpecs.sectionWidth,
          aspectRatio - NEAR.flotation,
          aspectRatio + NEAR.flotation,
        ),
      );
    }
    return (
      and(
        rim,
        or(and(...metric), and(...flotation)),
        not(sql`coalesce(${exact}, false)`),
      ) ?? NOTHING
    );
  }

  if (filters.category === "wheels") {
    const { diameter, width, boltPattern } = sizeParts(filters).wheel;
    if (diameter === undefined || width === undefined) return NOTHING;
    const parts: SQL[] = [
      eq(wheelSpecs.diameter, diameter),
      between(
        wheelSpecs.width,
        width - NEAR.wheelWidth,
        width + NEAR.wheelWidth,
      ),
    ];
    if (boltPattern) {
      parts.push(arrayContains(wheelSpecs.boltPatterns, [boltPattern]));
    }
    return and(...parts, not(exact)) ?? NOTHING;
  }

  return NOTHING;
}

/* --- The extra filters (offset, centre bore, finish, load index, thread) --
 *
 * Each of these narrows BOTH lists (best and similar) and is not a size part:
 * it never decides whether a similar row is asked for.  */

function extraConditions(
  filters: ProductFilters,
  omit: FilterGroup | undefined,
): SQL[] {
  const where: SQL[] = [];

  if (filters.category === "tires") {
    const loadMin = wholeNumber(filters.tire?.loadIndexMin);
    // A product with no load index reads NULL here and never matches.
    if (loadMin !== undefined) where.push(sql`${LOAD_INDEX_FIRST} >= ${loadMin}`);
  }

  if (filters.category === "wheels") {
    const offsetMin = signedMeasure(filters.wheel?.offsetMin);
    const offsetMax = signedMeasure(filters.wheel?.offsetMax);
    if (offsetMin !== undefined) where.push(gte(wheelSpecs.offsetMm, offsetMin));
    if (offsetMax !== undefined) where.push(lte(wheelSpecs.offsetMm, offsetMax));
    const bore = measure(filters.wheel?.centerBore);
    if (bore !== undefined) where.push(eq(wheelSpecs.centerBoreMm, bore));
    if (omit !== "finishes" && filters.wheel?.finishes?.length) {
      where.push(inArray(wheelSpecs.finishFamily, [...filters.wheel.finishes]));
    }
  }

  if (
    filters.category === "accessories" &&
    omit !== "threads" &&
    filters.accessory?.threads?.length
  ) {
    // Only a threaded type is held to the thread; a centre cap passes. The
    // `coalesce` keeps a product with no spec row on the "passes" side.
    where.push(
      sql`(not coalesce(${accessorySpecs.accessoryType} in ('lug_nuts', 'lug_bolts', 'wheel_locks'), false) or ${inArray(accessorySpecs.threadSize, [...filters.accessory.threads])})`,
    );
  }

  return where;
}

function conditions(
  filters: ProductFilters,
  options: { omit?: FilterGroup; sizeMatch?: "exact" | "near" } = {},
): SQL[] {
  const where: SQL[] = [
    eq(products.category, filters.category),
    eq(products.status, "published"),
  ];

  // Exact, because the brand facet groups exactly: the count beside a brand
  // and the list it opens must be the same products.
  if (options.omit !== "brands" && filters.brands && filters.brands.length > 0) {
    where.push(inArray(products.brand, [...filters.brands]));
  }
  const priceMin = PRICES_VISIBLE ? amount(filters.priceMin) : undefined;
  const priceMax = PRICES_VISIBLE ? amount(filters.priceMax) : undefined;
  if (priceMin !== undefined) where.push(gte(products.price, priceMin));
  if (priceMax !== undefined) where.push(lte(products.price, priceMax));

  if (options.omit !== "chips") {
    // A value outside the enum is dropped, not sent: Postgres would refuse it.
    if (filters.category === "tires" && filters.tire?.seasons?.length) {
      const seasons = filters.tire.seasons.filter((season) =>
        TIRE_SEASONS.includes(season),
      );
      where.push(
        seasons.length > 0 ? inArray(tireSpecs.season, seasons) : NOTHING,
      );
    }
    if (filters.category === "accessories" && filters.accessory?.kinds?.length) {
      const kinds = filters.accessory.kinds.filter((kind) =>
        ACCESSORY_KINDS.includes(kind),
      );
      where.push(
        kinds.length > 0
          ? inArray(accessorySpecs.accessoryType, kinds)
          : NOTHING,
      );
    }
  }

  where.push(...extraConditions(filters, options.omit));

  if (options.sizeMatch === "near") {
    where.push(nearSize(filters));
  } else {
    const exact = exactSize(filters);
    if (exact !== null) where.push(exact);
  }

  return where;
}

function orderBy(sort: CatalogSort): SQL[] {
  // `id` last, so two pages of one query never disagree about the order.
  // With prices off the price sorts read as `best` (D124).
  switch (PRICES_VISIBLE ? sort : "best") {
    case "price-asc":
      return [sql`${products.price} asc nulls last`, asc(products.id)];
    case "price-desc":
      return [sql`${products.price} desc nulls last`, asc(products.id)];
    case "best":
      /* Every brand's strongest card before any brand's second: rank each
         brand's products (one with a photo first, then the lowest price while
         prices show), and
         read across the ranks. Sorting by brand alone opened every list with
         six cards from whichever brand is first in the alphabet. */
      return [
        sql`row_number() over (partition by ${products.brand} order by ${sql.join([sql`(${HAS_PHOTO}) desc`, ...PRICE_ORDER, sql`${products.id}`], sql`, `)}) asc`,
        ...PRICE_ORDER,
        asc(products.id),
      ];
  }
}

function clampLimit(limit: number | undefined, fallback: number): number {
  if (limit === undefined || !Number.isFinite(limit)) return fallback;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
}

function clampOffset(offset: number | undefined): number {
  if (offset === undefined || !Number.isFinite(offset)) return 0;
  return Math.min(Math.max(Math.trunc(offset), 0), MAX_OFFSET);
}

/* --- Listings ------------------------------------------------------------ */

/**
 * One page of a category's published products, and how many match in all.
 * Backs `/tires`, `/wheels` and `/accessories`. Call it once with
 * `sizeMatch: "exact"` for the matches and once with `"near"` for the
 * "similar options" row beneath them.
 */
export async function listProducts(
  input: ListProductsInput,
): Promise<ProductList> {
  const db = getDb();
  const where = and(...conditions(input, { sizeMatch: input.sizeMatch }));

  const [rows, [totals]] = await Promise.all([
    withSpecs(db.select(PRODUCT_SELECTION).from(products).$dynamic())
      .where(where)
      .orderBy(...orderBy(input.sort ?? "best"))
      .limit(clampLimit(input.limit, DEFAULT_LIMIT))
      .offset(clampOffset(input.offset)),
    withSpecs(db.select({ total: count() }).from(products).$dynamic()).where(
      where,
    ),
  ]);

  return {
    items: await toStorefrontProducts(db, rows),
    total: totals?.total ?? 0,
  };
}

/* --- Facets -------------------------------------------------------------- */

function sortedNumbers(values: ReadonlyArray<number | null>): number[] {
  return values
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
}

/** The lowest and highest price among a category's published products.
 *  `null` when nothing in it is priced. */
export async function getPriceBounds(
  category: ProductCategory,
): Promise<{ min: number | null; max: number | null }> {
  if (!PRICES_VISIBLE) return { min: null, max: null };
  const [row] = await getDb()
    .select({ min: min(products.price), max: max(products.price) })
    .from(products)
    .where(
      and(eq(products.category, category), eq(products.status, "published")),
    );
  return { min: row?.min ?? null, max: row?.max ?? null };
}

/**
 * Every brand with a published product in a category, whatever else is
 * filtered. `getFacets` counts brands under the other filters; this is the
 * list that says whether the category carries a brand at all (D111).
 */
export async function getBrands(category: ProductCategory): Promise<string[]> {
  const rows = await getDb()
    .selectDistinct({ value: products.brand })
    .from(products)
    .where(
      and(
        eq(products.category, category),
        eq(products.status, "published"),
        // An unbranded accessory (D125) is no brand to filter on.
        isNotNull(products.brand),
      ),
    )
    .orderBy(asc(products.brand));
  return rows.flatMap((row) => (row.value === null ? [] : [row.value]));
}

/**
 * Every value the checkbox-style extra filters can take in a category,
 * whatever else is filtered: the wheel finish families and the lug thread
 * sizes. `search.ts` checks the URL's `finish=` / `thread=` against these
 * BEFORE it reads (`getFacets` only counts what the other filters leave, so a
 * ticked value they leave at 0 is missing from it, and must still be kept,
 * like a ticked brand). Empty for a category that has none.
 */
export async function getExtraValues(
  category: ProductCategory,
): Promise<{ finishes: string[]; threads: string[] }> {
  const db = getDb();
  const published = and(
    eq(products.category, category),
    eq(products.status, "published"),
  );
  const [finishRows, threadRows] = await Promise.all([
    category === "wheels"
      ? db
          .selectDistinct({ value: wheelSpecs.finishFamily })
          .from(wheelSpecs)
          .innerJoin(products, eq(products.id, wheelSpecs.productId))
          .where(
            and(
              published,
              isNotNull(wheelSpecs.finishFamily),
              ne(wheelSpecs.finishFamily, ""),
            ),
          )
          .orderBy(asc(wheelSpecs.finishFamily))
      : Promise.resolve([]),
    category === "accessories"
      ? db
          .selectDistinct({ value: accessorySpecs.threadSize })
          .from(accessorySpecs)
          .innerJoin(products, eq(products.id, accessorySpecs.productId))
          .where(
            and(
              published,
              inArray(accessorySpecs.accessoryType, [
                "lug_nuts",
                "lug_bolts",
                "wheel_locks",
              ]),
              isNotNull(accessorySpecs.threadSize),
              ne(accessorySpecs.threadSize, ""),
            ),
          )
          .orderBy(asc(accessorySpecs.threadSize))
      : Promise.resolve([]),
  ]);
  const values = (rows: ReadonlyArray<{ value: string | null }>) =>
    rows.flatMap((row) => (row.value === null ? [] : [row.value]));
  return { finishes: values(finishRows), threads: values(threadRows) };
}

/* --- Size options (D132) -------------------------------------------------
 *
 * The three size selects narrow one another: each lists the values that exist
 * together with the OTHER size parts chosen, so after `width=205` the profile
 * and rim lists hold only what a 205 tire comes in, and a buyer cannot build a
 * size the catalogue has no tire in. Only size parts narrow size options:
 * brand, season, type and price do not. The size group stays the answer to
 * "what sizes exist", so a buyer who knows their size can always pick it and
 * the best/similar split (D109(1)) says whether a ticked brand carries it.
 *
 * Every list is also read whole, unnarrowed: that is what says whether a
 * URL's size value exists in the category at all (D111(1), `search.ts`
 * `withKnownSizes`), and what lets a chosen value stay listed when the others
 * would filter it out.
 *
 * One round trip per category: one row of `array_agg(distinct ...)`, each
 * narrowed list a `filter (where ...)` on the same scan. Cast to `text[]` so
 * every list arrives as strings whatever the column type (drizzle hands a
 * `numeric[]` back raw), then read with `Number`, exactly as the columns'
 * `mode: "number"` reads one value.
 */

export interface TireSizeOptions {
  /** Metric section widths, mm. */
  widths: readonly number[];
  /** Metric aspect ratios. */
  aspectRatios: readonly number[];
  /** Flotation overall diameters, inches: the `33` of `33x12.50R20`. They sit
   *  in the Width select after the metric widths. */
  flotationDiameters: readonly number[];
  /** Flotation section widths, inches: the `12.5`. They sit in the Profile
   *  select after the metric aspect ratios. */
  flotationSectionWidths: readonly number[];
  rimDiameters: readonly number[];
}

export interface WheelSizeOptions {
  diameters: readonly number[];
  widths: readonly number[];
  boltPatterns: readonly string[];
}

/** `CatalogFacets` plus each size select's narrowed options (D132). The
 *  `tire` / `wheel` lists of `CatalogFacets` stay every value the category
 *  holds. */
export type StorefrontFacets = CatalogFacets & {
  sizeOptions: {
    tire: TireSizeOptions | null;
    wheel: WheelSizeOptions | null;
  };
};

const ANY = sql`true`;

function numberList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return sortedNumbers(
    value.map((item) => (item === null ? null : Number(item))),
  ).filter(Number.isFinite);
}

function boltPatternList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

interface TireOptionLists extends TireSizeOptions {
  loadIndexes: readonly number[];
}

async function readTireSizeOptions(
  inCategory: SQL | undefined,
  choice: Pick<ProductFilters, "tire" | "wheel">,
): Promise<{ all: TireOptionLists; narrowed: TireSizeOptions }> {
  const parts = sizeParts(choice).tire;
  /* The width and profile predicates cover both formats (`tireWidthIs`): a
     chosen `33` narrows the profiles to the flotation section widths found
     with a 33, and a chosen `205` to the metric aspect ratios found with a
     205. Each list leaves its own part out, so a choice never narrows itself. */
  const w = tireWidthIs(parts) ?? ANY;
  const a = tireProfileIs(parts) ?? ANY;
  const r =
    parts.rimDiameter === undefined
      ? ANY
      : eq(tireSpecs.rimDiameter, parts.rimDiameter);
  /* A flotation size has no width or profile (`35x12.50R20`): its nulls are
     left out of the metric lists, and it has its own two. Every size counts
     towards the rims. */
  const { rows } = await getDb().execute(sql`
    select
      array_agg(distinct ${tireSpecs.width}::text) filter (where ${tireSpecs.width} is not null) as all_widths,
      array_agg(distinct ${tireSpecs.aspectRatio}::text) filter (where ${tireSpecs.aspectRatio} is not null) as all_aspect_ratios,
      array_agg(distinct ${tireSpecs.overallDiameter}::text) filter (where ${tireSpecs.overallDiameter} is not null) as all_flotation_diameters,
      array_agg(distinct ${tireSpecs.sectionWidth}::text) filter (where ${tireSpecs.sectionWidth} is not null) as all_flotation_section_widths,
      array_agg(distinct ${tireSpecs.rimDiameter}::text) as all_rim_diameters,
      array_agg(distinct (${LOAD_INDEX_FIRST})::text) filter (where ${LOAD_INDEX_FIRST} is not null) as all_load_indexes,
      array_agg(distinct ${tireSpecs.width}::text) filter (where ${tireSpecs.width} is not null and ${a} and ${r}) as widths,
      array_agg(distinct ${tireSpecs.aspectRatio}::text) filter (where ${tireSpecs.aspectRatio} is not null and ${w} and ${r}) as aspect_ratios,
      array_agg(distinct ${tireSpecs.overallDiameter}::text) filter (where ${tireSpecs.overallDiameter} is not null and ${a} and ${r}) as flotation_diameters,
      array_agg(distinct ${tireSpecs.sectionWidth}::text) filter (where ${tireSpecs.sectionWidth} is not null and ${w} and ${r}) as flotation_section_widths,
      array_agg(distinct ${tireSpecs.rimDiameter}::text) filter (where ${w} and ${a}) as rim_diameters
    from ${tireSpecs}
    inner join ${products} on ${products.id} = ${tireSpecs.productId}
    where ${inCategory}
  `);
  const row = rows[0] ?? {};
  return {
    all: {
      widths: numberList(row.all_widths),
      aspectRatios: numberList(row.all_aspect_ratios),
      flotationDiameters: numberList(row.all_flotation_diameters),
      flotationSectionWidths: numberList(row.all_flotation_section_widths),
      rimDiameters: numberList(row.all_rim_diameters),
      loadIndexes: numberList(row.all_load_indexes),
    },
    narrowed: {
      widths: numberList(row.widths),
      aspectRatios: numberList(row.aspect_ratios),
      flotationDiameters: numberList(row.flotation_diameters),
      flotationSectionWidths: numberList(row.flotation_section_widths),
      rimDiameters: numberList(row.rim_diameters),
    },
  };
}

interface WheelOptionLists extends WheelSizeOptions {
  offset: { min: number | null; max: number | null };
  centerBores: readonly number[];
}

async function readWheelSizeOptions(
  inCategory: SQL | undefined,
  choice: Pick<ProductFilters, "tire" | "wheel">,
): Promise<{ all: WheelOptionLists; narrowed: WheelSizeOptions }> {
  const { diameter, width, boltPattern } = sizeParts(choice).wheel;
  const d = diameter === undefined ? ANY : eq(wheelSpecs.diameter, diameter);
  const w = width === undefined ? ANY : eq(wheelSpecs.width, width);
  const b =
    boltPattern === undefined
      ? ANY
      : boltPattern === null
        ? NOTHING
        : arrayContains(wheelSpecs.boltPatterns, [boltPattern]);
  /* A wheel drilled for two patterns is one row per pattern here; `distinct`
     folds the repeats. `left join`, so a wheel with no pattern on record
     still counts towards the diameters and widths. The offset bounds and the
     centre bores ride the same scan, whole-category like the full lists: the
     offset slider and the bore select are not narrowed by anything. */
  const { rows } = await getDb().execute(sql`
    select
      array_agg(distinct ${wheelSpecs.diameter}::text) as all_diameters,
      array_agg(distinct ${wheelSpecs.width}::text) as all_widths,
      array_agg(distinct bolt.pattern) filter (where bolt.pattern is not null) as all_bolt_patterns,
      array_agg(distinct ${wheelSpecs.diameter}::text) filter (where ${w} and ${b}) as diameters,
      array_agg(distinct ${wheelSpecs.width}::text) filter (where ${d} and ${b}) as widths,
      array_agg(distinct bolt.pattern) filter (where bolt.pattern is not null and ${d} and ${w}) as bolt_patterns,
      min(${wheelSpecs.offsetMm})::text as offset_min,
      max(${wheelSpecs.offsetMm})::text as offset_max,
      array_agg(distinct ${wheelSpecs.centerBoreMm}::text) filter (where ${wheelSpecs.centerBoreMm} is not null) as all_center_bores
    from ${wheelSpecs}
    inner join ${products} on ${products.id} = ${wheelSpecs.productId}
    left join lateral unnest(${wheelSpecs.boltPatterns}) as bolt(pattern) on true
    where ${inCategory}
  `);
  const row = rows[0] ?? {};
  const bound = (value: unknown) =>
    value === null || value === undefined ? null : Number(value);
  return {
    all: {
      diameters: numberList(row.all_diameters),
      widths: numberList(row.all_widths),
      boltPatterns: boltPatternList(row.all_bolt_patterns),
      offset: { min: bound(row.offset_min), max: bound(row.offset_max) },
      centerBores: numberList(row.all_center_bores),
    },
    narrowed: {
      diameters: numberList(row.diameters),
      widths: numberList(row.widths),
      boltPatterns: boltPatternList(row.bolt_patterns),
    },
  };
}

/* --- Facets: the rail ---------------------------------------------------- */

/**
 * The filter rail for one category: option lists, and counts that agree with
 * what `listProducts` would return for the same filters.
 *
 * `sizeChoice` is the size the buyer chose, which narrows the size options
 * (D132). It is separate from `filters` because a vehicle can lend `filters`
 * a size the selects do not show (D48(4)): with a vehicle and every select at
 * `Any`, the options stay whole. Defaults to the size in `filters`.
 *
 * Every read is issued at once: one round trip, four queries on tires
 * (total, brands, seasons, sizes), three on wheels and on accessories.
 */
export async function getFacets(
  filters: ProductFilters,
  sizeChoice: Pick<ProductFilters, "tire" | "wheel"> = filters,
): Promise<StorefrontFacets> {
  const db = getDb();
  const { category } = filters;
  const inCategory = and(
    eq(products.category, category),
    eq(products.status, "published"),
  );

  const totalQuery = withSpecs(
    db.select({ total: count() }).from(products).$dynamic(),
  ).where(and(...conditions(filters)));

  const brandsQuery = withSpecs(
    db
      .select({ value: products.brand, count: count() })
      .from(products)
      .$dynamic(),
  )
    .where(and(...conditions(filters, { omit: "brands" })))
    .groupBy(products.brand)
    .orderBy(asc(products.brand));

  /* The chip row's counts: seasons on tires, types on accessories, none on
     wheels (D105b). */
  const chipsQuery =
    category === "tires"
      ? withSpecs(
          db
            .select({ value: tireSpecs.season, count: count() })
            .from(products)
            .$dynamic(),
        )
          .where(
            and(
              ...conditions(filters, { omit: "chips" }),
              isNotNull(tireSpecs.season),
            ),
          )
          .groupBy(tireSpecs.season)
          // Enum order: summer, all-season, all-weather, winter.
          .orderBy(asc(tireSpecs.season))
      : category === "accessories"
        ? withSpecs(
            db
              .select({ value: accessorySpecs.accessoryType, count: count() })
              .from(products)
              .$dynamic(),
          )
            .where(
              and(
                ...conditions(filters, { omit: "chips" }),
                isNotNull(accessorySpecs.accessoryType),
              ),
            )
            .groupBy(accessorySpecs.accessoryType)
            .orderBy(asc(accessorySpecs.accessoryType))
        : Promise.resolve([]);

  /* Wheels: the finish families, counted under every other filter (own group
     left out). Blank families are no option. */
  const finishesQuery =
    category === "wheels"
      ? withSpecs(
          db
            .select({ value: wheelSpecs.finishFamily, count: count() })
            .from(products)
            .$dynamic(),
        )
          .where(
            and(
              ...conditions(filters, { omit: "finishes" }),
              isNotNull(wheelSpecs.finishFamily),
              ne(wheelSpecs.finishFamily, ""),
            ),
          )
          .groupBy(wheelSpecs.finishFamily)
          .orderBy(asc(wheelSpecs.finishFamily))
      : Promise.resolve([]);

  /* Accessories: the thread sizes of the three threaded types, counted under
     every other filter (own group left out). */
  const threadsQuery =
    category === "accessories"
      ? withSpecs(
          db
            .select({ value: accessorySpecs.threadSize, count: count() })
            .from(products)
            .$dynamic(),
        )
          .where(
            and(
              ...conditions(filters, { omit: "threads" }),
              inArray(accessorySpecs.accessoryType, [
                "lug_nuts",
                "lug_bolts",
                "wheel_locks",
              ]),
              isNotNull(accessorySpecs.threadSize),
              ne(accessorySpecs.threadSize, ""),
            ),
          )
          .groupBy(accessorySpecs.threadSize)
          .orderBy(asc(accessorySpecs.threadSize))
      : Promise.resolve([]);

  const [
    [totals],
    brandRows,
    price,
    chipRows,
    tireSizes,
    wheelSizes,
    finishRows,
    threadRows,
  ] = await Promise.all([
    totalQuery,
    brandsQuery,
    getPriceBounds(category),
    chipsQuery,
    category === "tires"
      ? readTireSizeOptions(inCategory, sizeChoice)
      : Promise.resolve(null),
    category === "wheels"
      ? readWheelSizeOptions(inCategory, sizeChoice)
      : Promise.resolve(null),
    finishesQuery,
    threadsQuery,
  ]);
  // Unbranded accessories (D125) are counted in `total` but are no brand row.
  const brands = brandRows.flatMap((row) =>
    row.value === null ? [] : [{ value: row.value, count: row.count }],
  );
  const named = (rows: ReadonlyArray<{ value: string | null; count: number }>) =>
    rows.flatMap((row) =>
      row.value === null ? [] : [{ value: row.value, count: row.count }],
    );

  return {
    category,
    total: totals?.total ?? 0,
    brands,
    price,
    tire:
      tireSizes === null
        ? null
        : {
            ...tireSizes.all,
            seasons: chipRows.filter(
              (row): row is FacetCount<TireSeason> =>
                row.value !== null &&
                TIRE_SEASONS.includes(row.value as TireSeason),
            ),
          },
    wheel:
      wheelSizes === null
        ? null
        : { ...wheelSizes.all, finishes: named(finishRows) },
    accessory:
      category === "accessories"
        ? {
            kinds: chipRows.filter(
              (row): row is FacetCount<AccessoryKind> =>
                row.value !== null &&
                ACCESSORY_KINDS.includes(row.value as AccessoryKind),
            ),
            threads: named(threadRows),
          }
        : null,
    sizeOptions: {
      tire: tireSizes?.narrowed ?? null,
      wheel: wheelSizes?.narrowed ?? null,
    },
  };
}

/* --- Product page -------------------------------------------------------- */

/**
 * The product page. `published` and `discontinued` both load, so an old link
 * still lands on a page that takes an enquiry. `null` = render a 404: either
 * no such slug, or the product is `hidden`.
 */
export async function getProductBySlug(
  slug: string,
): Promise<CatalogProductDetail | null> {
  if (slug.length > SLUG_MAX_LENGTH || !SLUG.test(slug)) return null;
  const db = getDb();
  const [row] = await withSpecs(
    db.select(PRODUCT_SELECTION).from(products).$dynamic(),
  )
    .where(
      and(
        eq(products.slug, slug),
        inArray(products.status, ["published", "discontinued"]),
      ),
    )
    .limit(1);
  if (!row) return null;

  const images = (await loadImages(db, [row.product.id])).get(row.product.id);
  return {
    ...storefrontPrice(toCatalogProduct(row, images?.[0] ?? null)),
    images: images ?? [],
  };
}

/**
 * The same brand and model in its other sizes, nearest to this product's own
 * size first. Nearest, not smallest: a wheel model can come in hundreds of
 * variants, and the first page of those has to be the ones beside the size
 * being looked at. Empty for a product with no model.
 *
 * Wheels keep only what bolts onto the same car: a wheel that shares no bolt
 * pattern with this one is not another size of it, it is a different fitment,
 * so it is left out (a wheel with no pattern on record shares none, and has no
 * other sizes). They rank by diameter, then width, then offset. Only the page
 * itself is excluded.
 */
export async function getOtherSizes(
  product: CatalogProduct,
  limit = 24,
): Promise<CatalogProduct[]> {
  if (product.model === null) return [];
  const db = getDb();

  const where: SQL[] = [
    eq(products.category, product.category),
    eq(products.status, "published"),
    product.brand === null
      ? isNull(products.brand)
      : eq(products.brand, product.brand),
    eq(products.model, product.model),
    ne(products.id, product.id),
  ];

  const nearest: SQL[] = [];
  if (product.category === "tires" && product.specs) {
    const { rimDiameter, width, aspectRatio, overallDiameter, sectionWidth } =
      product.specs;
    nearest.push(sql`abs(${tireSpecs.rimDiameter} - ${rimDiameter}) asc nulls last`);
    if (width !== null) {
      nearest.push(sql`abs(${tireSpecs.width} - ${width}) asc nulls last`);
    }
    if (aspectRatio !== null) {
      nearest.push(
        sql`abs(${tireSpecs.aspectRatio} - ${aspectRatio}) asc nulls last`,
      );
    }
    // A flotation size is placed by its own two dimensions.
    if (overallDiameter !== null) {
      nearest.push(
        sql`abs(${tireSpecs.overallDiameter} - ${overallDiameter}) asc nulls last`,
      );
    }
    if (sectionWidth !== null) {
      nearest.push(
        sql`abs(${tireSpecs.sectionWidth} - ${sectionWidth}) asc nulls last`,
      );
    }
  }
  if (product.category === "wheels" && product.specs) {
    const { diameter, width, offsetMm, boltPatterns } = product.specs;
    where.push(
      boltPatterns.length > 0
        ? arrayOverlaps(wheelSpecs.boltPatterns, boltPatterns)
        : NOTHING,
    );
    nearest.push(
      sql`abs(${wheelSpecs.diameter} - ${diameter}) asc nulls last`,
      sql`abs(${wheelSpecs.width} - ${width}) asc nulls last`,
    );
    if (offsetMm !== null) {
      nearest.push(sql`abs(${wheelSpecs.offsetMm} - ${offsetMm}) asc nulls last`);
    }
  }

  const rows = await withSpecs(
    db.select(PRODUCT_SELECTION).from(products).$dynamic(),
  )
    .where(and(...where))
    .orderBy(...nearest, asc(products.name), asc(products.id))
    .limit(clampLimit(limit, 24));
  return toStorefrontProducts(db, rows);
}

/**
 * With no model, a product is read by its name, and the title drops a brand
 * the name starts with (`stripBrandPrefix`): `DAI Wheels Center Cap Black
 * DW125` and `Center Cap Black DW125` are one title. So the name may be this
 * one, without the brand, or with `<brand> ` in front. A superset on exact
 * strings, so it stays a plain equality filter on the brand's own un-modelled
 * rows (a `lower()` / `left()` test measured +35 ms on the accessories page,
 * for the 4 products in the catalogue it would catch beyond this); a brand
 * joined by a dash or a colon, or in other letters, is not matched.
 */
function nameReadsAs(product: CatalogProduct): SQL {
  const brand = product.brand?.trim() ?? "";
  const rest = stripBrandPrefix(product.brand, product.name);
  const names = new Set([product.name, rest]);
  if (brand !== "") names.add(`${brand} ${rest}`);
  return inArray(products.name, [...names]);
}

/**
 * What a product's possible title siblings share with it: category, status
 * (published or discontinued), brand, model (or name) and the size columns
 * its card prints. **A superset on purpose**: `siblings.ts` `titleKey()` is
 * the exact test and runs afterwards, so this need not reproduce the size
 * line's formatting, and it leaves out the bolt pattern, whose array
 * containment can only be answered by the GIN index (measured, 4 ms a key
 * against 0.4 ms without it; the few wheels it lets through that differ only
 * in bolt pattern are dropped by `titleKey()`). Without the product itself
 * excluded; a caller adds that.
 */
function titleSiblingConditions(product: CatalogProduct): SQL[] {
  const where: SQL[] = [
    eq(products.category, product.category),
    inArray(products.status, ["published", "discontinued"]),
    product.brand === null
      ? isNull(products.brand)
      : eq(products.brand, product.brand),
    product.model === null
      ? sql`${products.model} is null and ${nameReadsAs(product)}`
      : eq(products.model, product.model),
  ];

  /* Null-safe: two blanks are the same blank on a size line. */
  const same = (column: SQL | AnyColumn, value: unknown) =>
    sql`${column} is not distinct from ${value}`;
  if (product.category === "tires" && product.specs) {
    const { size, loadIndex, speedRating, isXl } = product.specs;
    where.push(
      eq(tireSpecs.size, size),
      same(tireSpecs.loadIndex, loadIndex),
      same(tireSpecs.speedRating, speedRating),
      eq(tireSpecs.isXl, isXl),
    );
  }
  if (product.category === "wheels" && product.specs) {
    const { diameter, width, offsetMm, finish } = product.specs;
    where.push(
      eq(wheelSpecs.diameter, diameter),
      eq(wheelSpecs.width, width),
      same(wheelSpecs.offsetMm, offsetMm),
      same(wheelSpecs.finish, finish),
    );
  }
  return where;
}

/** What `titleSiblingConditions` asks, as a string: two products with the
 *  same key ask the same question, so a page asks it once. */
function titleSiblingKey(product: CatalogProduct): string {
  const specs =
    product.category === "tires" && product.specs
      ? [
          product.specs.size,
          product.specs.loadIndex,
          product.specs.speedRating,
          product.specs.isXl,
        ]
      : product.category === "wheels" && product.specs
        ? [
            product.specs.diameter,
            product.specs.width,
            product.specs.offsetMm,
            product.specs.finish,
          ]
        : [];
  return JSON.stringify([
    product.category,
    product.brand,
    product.model === null ? [product.name] : product.model,
    specs,
  ]);
}

/**
 * The products a product page could share its title with: same category,
 * brand and model (or, with no model, name), and the same size columns the
 * size line prints. A superset on purpose: `siblings.ts` `siblingFacts()`
 * keeps only those whose name and size line are exactly this product's, so
 * the SQL need not reproduce the size line's formatting. Published and
 * discontinued, the two states a product page shows. Only the page itself is
 * excluded. Served by `products_brand_model_idx` (launch audit D145;
 * D151).
 */
export async function getTitleSiblings(
  product: CatalogProduct,
  limit = 100,
): Promise<CatalogProduct[]> {
  const rows = await selectSiblingRows(getDb(), product.category, [
    and(...titleSiblingConditions(product), ne(products.id, product.id)) as SQL,
  ]);
  /* No images: the facts are read off the specs, and the page never shows
     these products. */
  return rows
    .slice(0, clampLimit(limit, 100))
    .map((row) => storefrontPrice(toCatalogProduct(row, null)));
}

/**
 * The title siblings of a whole page of cards, in ONE statement per
 * category (a page is almost always one): the products that share any of
 * `listed`'s name and size columns, the products themselves included.
 * `listed` is collapsed to its distinct keys first. Wheels ask one
 * conjunctive branch per key in a `UNION ALL`, so each is planned and served
 * by `products_brand_model_idx` on its own (measured on the same 24 wheels:
 * 10 ms as branches, 28 ms as one `OR`, and 61 ms against 266 ms on 150);
 * see `selectSiblingRows` for why tires and accessories take the `OR`. Not a
 * window over the page's own filtered set: a sibling that the page's filters
 * hide (the bore filter, say) still tells a card apart, and a window under
 * `ORDER BY ... LIMIT` would have to rank the whole category before the
 * first page could be cut. The largest title group in the catalogue holds 26
 * products. A product with no spec row has no size to share and is skipped
 * (none exists today).
 */
async function getListingSiblings(
  db: Executor,
  listed: readonly CatalogProduct[],
): Promise<CatalogProduct[]> {
  const byCategory = new Map<ProductCategory, Map<string, SQL>>();
  for (const product of listed) {
    if (product.specs === null) continue;
    const keys = byCategory.get(product.category) ?? new Map<string, SQL>();
    byCategory.set(product.category, keys);
    /* Two products asking the same question are asked once. */
    const key = titleSiblingKey(product);
    if (!keys.has(key)) {
      keys.set(key, and(...titleSiblingConditions(product)) as SQL);
    }
  }
  const found = await Promise.all(
    [...byCategory].map(([category, keys]) =>
      selectSiblingRows(db, category, [...keys.values()]),
    ),
  );
  /* Two keys can reach the same product (a name with and without its brand),
     so a product may come back twice. */
  const seen = new Map<string, ProductJoinRow>();
  for (const row of found.flat()) seen.set(row.product.id, row);
  return [...seen.values()].map((row) => toCatalogProduct(row, null));
}

/** `UNION ALL` of one or more selects, awaited. Drizzle's variadic form
 *  wants two or more and types every branch's rows; the caller says what
 *  they are. */
async function unionRows<R>(
  selects: readonly [PgSelect, ...PgSelect[]],
): Promise<R[]> {
  const [first, ...rest] = selects;
  const query =
    rest.length === 0 ? first : unionAll(first, rest[0], ...rest.slice(1));
  return (await query) as unknown as R[];
}

/**
 * Products of ONE category with that category's spec row, one `INNER JOIN`
 * select per condition, unioned. The shared `withSpecs()` left-joins all
 * three spec tables, and a filter that only one of them can satisfy then
 * keeps the planner from treating the joins as inner: on this query it swung
 * between a primary-key probe per row and a scan of the whole 30,000-row spec
 * table (measured, the same query at 8 ms and at 58 ms). A product with no
 * spec row is not returned, which is right here: it has no size to share.
 */
async function selectSiblingRows(
  db: Executor,
  category: ProductCategory,
  wheres: readonly SQL[],
): Promise<ProductJoinRow[]> {
  if (wheres.length === 0) return [];
  const [first, ...rest] = wheres;
  switch (category) {
    case "tires": {
      /* One `OR`, not branches: `tire_specs` is 8,400 rows with no index on
         the size text, so each branch would scan it again (measured 1.2 ms a
         key); one statement scans it once. */
      const rows = await db
        .select({ product: products, tire: tireSpecs })
        .from(products)
        .innerJoin(tireSpecs, eq(tireSpecs.productId, products.id))
        .where(or(...wheres));
      return rows.map((row) => ({ ...row, wheel: null, accessory: null }));
    }
    case "wheels": {
      const select = (where: SQL) =>
        db
          .select({ product: products, wheel: wheelSpecs })
          .from(products)
          .innerJoin(wheelSpecs, eq(wheelSpecs.productId, products.id))
          .where(where)
          .$dynamic();
      const rows = await unionRows<{
        product: ProductRow;
        wheel: WheelSpecsRow;
      }>([select(first), ...rest.map(select)]);
      return rows.map((row) => ({ ...row, tire: null, accessory: null }));
    }
    case "accessories": {
      // 1,700 rows in all: one statement.
      const rows = await db
        .select({ product: products, accessory: accessorySpecs })
        .from(products)
        .innerJoin(accessorySpecs, eq(accessorySpecs.productId, products.id))
        .where(or(...wheres));
      return rows.map((row) => ({ ...row, tire: null, wheel: null }));
    }
  }
}

/**
 * Alternatives to one product, closest first, never another size of the same
 * model (that is `getOtherSizes`).
 *   tires        same rim and season, the same size first, then one step off
 *   wheels       same diameter and a shared bolt pattern, nearest width first
 *   accessories  same type
 */
export async function getSimilarProducts(
  product: CatalogProduct,
  limit = 6,
): Promise<CatalogProduct[]> {
  if (product.specs === null) return [];
  const db = getDb();

  const where: SQL[] = [
    eq(products.category, product.category),
    eq(products.status, "published"),
    ne(products.id, product.id),
  ];
  // Other sizes of this model belong to `getOtherSizes`. A product with no
  // model has no such row, so its brand-mates stay eligible here; otherwise
  // they would appear in neither list.
  if (product.model !== null) {
    where.push(
      // `coalesce` on the brand too: an unbranded accessory (D125) would
      // otherwise compare as unknown and drop every row.
      sql`(coalesce(${products.brand}, ''), coalesce(${products.model}, '')) <> (${product.brand ?? ""}, ${product.model})`,
    );
  }
  const order: SQL[] = [];

  if (product.category === "tires") {
    const { rimDiameter, season, width, aspectRatio, overallDiameter } =
      product.specs;
    where.push(eq(tireSpecs.rimDiameter, rimDiameter));
    if (season !== null) where.push(eq(tireSpecs.season, season));
    if (width !== null) {
      where.push(
        between(
          tireSpecs.width,
          width - NEAR.tireWidth,
          width + NEAR.tireWidth,
        ),
      );
      order.push(sql`abs(${tireSpecs.width} - ${width}) asc`);
      if (aspectRatio !== null) {
        // Without this a 305/40 would call a 315/70 similar: one step wider,
        // but a different tire altogether.
        where.push(
          between(
            tireSpecs.aspectRatio,
            aspectRatio - 2 * NEAR.tireAspectRatio,
            aspectRatio + 2 * NEAR.tireAspectRatio,
          ),
        );
        order.push(sql`abs(${tireSpecs.aspectRatio} - ${aspectRatio}) asc`);
      }
    } else if (overallDiameter !== null) {
      where.push(
        between(
          tireSpecs.overallDiameter,
          overallDiameter - 1,
          overallDiameter + 1,
        ),
      );
      order.push(
        sql`abs(${tireSpecs.overallDiameter} - ${overallDiameter}) asc`,
      );
    }
  }

  if (product.category === "wheels") {
    const { diameter, width, boltPatterns } = product.specs;
    where.push(eq(wheelSpecs.diameter, diameter));
    if (boltPatterns.length > 0) {
      where.push(arrayOverlaps(wheelSpecs.boltPatterns, boltPatterns));
    }
    order.push(sql`abs(${wheelSpecs.width} - ${width}) asc`);
  }

  if (product.category === "accessories") {
    where.push(eq(accessorySpecs.accessoryType, product.specs.accessoryType));
  }

  /* Closest first; then a photo before none, the lower price (while prices
     show), and `id` so
     the order never wavers. */
  const closeness = sql.join(
    [
      ...order,
      sql`(${HAS_PHOTO}) desc`,
      ...PRICE_ORDER,
      sql`${products.id} asc`,
    ],
    sql`, `,
  );

  const rows = await withSpecs(
    db.select(PRODUCT_SELECTION).from(products).$dynamic(),
  )
    .where(and(...where))
    .orderBy(
      /* One card per model before any model's second: the closest product
         of each brand + model, then the next closest of each. Without this
         the row is four finishes of whichever model sorts first. */
      sql`row_number() over (partition by ${products.brand}, ${products.model} order by ${closeness}) asc`,
      closeness,
    )
    .limit(clampLimit(limit, 6));
  return toStorefrontProducts(db, rows);
}

/* --- Hand-picked rows ---------------------------------------------------- */

/**
 * The published products behind a list of slugs, in the list's own order. A
 * slug that does not exist, or whose product is hidden or discontinued, is
 * simply absent from the result: a hand-picked row shrinks, it never breaks.
 *
 * `includeDiscontinued` is the cart's (D122): a discontinued product stays in
 * a visitor's cart, marked, and still reaches the shop in a quote request, so
 * the cart reads both statuses the product page reads. Hidden is still absent.
 */
export async function getProductsBySlugs(
  slugs: readonly string[],
  { includeDiscontinued = false }: { includeDiscontinued?: boolean } = {},
): Promise<CatalogProduct[]> {
  const wanted = [...new Set(slugs)].filter(
    (slug) => slug.length <= SLUG_MAX_LENGTH && SLUG.test(slug),
  );
  if (wanted.length === 0) return [];
  const db = getDb();
  const rows = await withSpecs(
    db.select(PRODUCT_SELECTION).from(products).$dynamic(),
  ).where(
    and(
      inArray(products.slug, wanted),
      includeDiscontinued
        ? inArray(products.status, ["published", "discontinued"])
        : eq(products.status, "published"),
    ),
  );
  const bySlug = new Map(
    (await toStorefrontProducts(db, rows)).map((product) => [product.slug, product]),
  );
  return wanted.flatMap((slug) => bySlug.get(slug) ?? []);
}

/* --- Sitemap ------------------------------------------------------------- */

/**
 * Every published product's slug and last change, for one category. One
 * sitemap file tops out at 50,000 URLs and the catalogue is close to that, so
 * the sitemap is built per category, never as one list.
 */
export async function listProductUrls(
  category: ProductCategory,
): Promise<Array<{ slug: string; updatedAt: Date }>> {
  return getDb()
    .select({ slug: products.slug, updatedAt: products.updatedAt })
    .from(products)
    .where(
      and(eq(products.category, category), eq(products.status, "published")),
    )
    .orderBy(asc(products.slug));
}
