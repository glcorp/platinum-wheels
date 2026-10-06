/**
 * `productView()` — the only place any PDP value is derived from a product
 * and the page's raw query string. Every section reads the `ProductView` this
 * returns; none of them re-derives a spec row or re-computes a product row
 * (`src/features/product/llm.md` "Owns").
 *
 * Pure, no I/O: the page reads the database (`catalog/queries.ts`) and hands
 * the results in. It takes the database's own shape (`CatalogProductDetail`)
 * because the specifications table shows every fact the catalogue holds, not
 * just the handful the card carries; the card-shaped `Product` every section
 * renders is made here, once, by `toProduct()`.
 */

import {
  ACCESSORY_LABEL,
  accessoryParam,
  expandWith,
  signedOffset,
  timesSign,
  toProduct,
} from "@/features/catalog/adapter";
import type {
  CatalogProduct,
  CatalogProductDetail,
  TireSeason,
} from "@/features/catalog/catalog-types";
import { configFor, type CategoryConfig } from "@/features/catalog/categories";
import { siblingFacts } from "@/features/catalog/siblings";
import type { Product } from "@/features/catalog/types";
/* The one cross-feature import outside `catalog/` (D37), on the precedent of
   `results/search.ts`: the finder's list is the only authority on what counts
   as a vehicle (D91b). */
import { isFinderVehicle } from "@/features/finder/data";
import { productName, stripBrandPrefix } from "@/lib/product-name";

import {
  backspacing,
  loadRating,
  offsetMm,
  tidyExtra,
} from "./spec-format";
import {
  DEFAULT_QUANTITY,
  PRODUCT_PARAM,
  QUANTITY_OPTIONS,
  type PdpBadge,
  type ProductSpecRow,
  type ProductView,
  type QuantityKey,
  type Vehicle,
} from "./types";

/**
 * Next's `searchParams` shape for this route. Deliberately re-declared rather
 * than imported from `src/features/results/types.ts` — cross-feature imports
 * go through `catalog/` only (D37), and `results/` already re-declares its
 * own copies of shapes it does not own for the same reason (`types.ts`
 * `Vehicle`). The page passes `await searchParams` straight through.
 */
export type ProductSearchParams = Record<string, string | string[] | undefined>;

/* --- Size ---------------------------------------------------------------- */

/**
 * `product.md` §3.2: a tire reads `<sizeCode> · <loadSpeed>`, e.g.
 * `215/55R16 · 97T XL`. The two halves come straight off the tire's own
 * columns, so nothing is parsed back out of a joined string.
 *
 * A wheel (`18×8.5 · 5×114.3`) and an accessory (`Set of 4 · 12×1.5`) do not
 * split into that shape, so for those two the whole card line stays intact
 * as `sizeCode` and `loadSpeed` is empty (D58).
 */
function splitSize(
  detail: CatalogProductDetail,
  product: Product,
): { sizeCode: string; loadSpeed: string } {
  if (detail.category !== "tires" || detail.specs === null) {
    return { sizeCode: product.size, loadSpeed: "" };
  }
  const { size, loadIndex, speedRating, isXl } = detail.specs;
  const loadSpeed = [`${loadIndex ?? ""}${speedRating ?? ""}`, isXl ? "XL" : ""]
    .filter(Boolean)
    .join(" ");
  return { sizeCode: size, loadSpeed };
}

/* --- Specifications ------------------------------------------------------
 *
 * One rule for all three tables (D53(1)): a row whose value is empty is
 * dropped, never printed blank. That is what lets the table show every fact
 * the catalogue holds for a product and still survive a vendor who supplied
 * almost none of them.
 */

type SpecRows = Array<[key: string, value: string | null | undefined]>;

function specRows(rows: SpecRows): readonly ProductSpecRow[] {
  return rows.flatMap(([key, value]) =>
    value === null || value === undefined || value === ""
      ? []
      : [{ key, value }],
  );
}

/** `Yes` / `No`, or nothing when the vendor did not say. */
function yesNo(value: boolean | null): string | null {
  return value === null ? null : value ? "Yes" : "No";
}

/** `72.6 mm`, `5.5 in`: a number, a space, its unit. */
function measure(value: number | null, unit: string): string | null {
  return value === null ? null : `${value} ${unit}`;
}

/**
 * The wheel's `Bolt pattern` row. A wheel with no pattern on record is an
 * undrilled blank: the vendors list it that way (PRO WHEELS' own field reads
 * `BLANK`, Auto Country's names say `blank`), and all 386 such wheels in the
 * catalogue are exactly those, so the row says what it is rather than leaving
 * a gap. No vendor shows a filter for it, so this row is all there is (owner,
 * 2026-10-05; launch audit, D145; D153).
 */
const UNDRILLED = "Undrilled, drilled to order";

function boltPatternValue(
  patterns: readonly string[] | undefined,
): string | null {
  if (patterns === undefined) return null;
  return patterns.length === 0 ? UNDRILLED : patterns.map(timesSign).join(" / ");
}

/** The vendors' `W/` read as "with" in any finish text (D145; D153). */
function finishText(value: string | null | undefined): string | null {
  return value ? expandWith(value) : null;
}

/** `Winter (studdable)` is artboard-verbatim (`product.md` §2.5 row 4);
 *  `All-weather` is new copy (D105b), in the chip's own spelling. */
function seasonLabel(season: TireSeason | null, studdable: boolean): string {
  switch (season) {
    case "winter":
      return studdable ? "Winter (studdable)" : "Winter";
    case "all_season":
      return "All-season";
    case "all_weather":
      return "All-weather";
    case "summer":
      return "Summer";
    case null:
      return "";
  }
}

/**
 * The vendor facts that have no column (D125), after every column row, in the
 * order the vendor gave them. Label and value are the vendor's own, tidied for
 * reading by `spec-format.ts` `tidyExtra()` (D135: `yes` is `Yes`, a unit in a
 * label moves to the value). Part number and M+S are columns since D142. A pair with a
 * blank half is dropped, the same rule as every other row (D109(6)). Never a
 * price: the importer keeps prices out of `extraSpecs`, and a vendor's own
 * price lives on its staff-only source row.
 */
function extraRows(detail: CatalogProductDetail): SpecRows {
  return detail.extraSpecs.flatMap((extra): Array<[string, string]> => {
    const tidy = tidyExtra(extra, detail.category);
    return tidy === null ? [] : [[tidy.label, tidy.value]];
  });
}

/**
 * The first six tire rows are the artboard's, in its order (`product.md`
 * §2.5): Brand, Model, Size, Season, Load / speed, 3PMSF. The rest are facts
 * the catalogue carries that the seed never did (D108b), each shown only when
 * the vendor supplied it, and then the vendor's extra facts (D125).
 */
function buildSpecs(
  detail: CatalogProductDetail,
  product: Product,
  sizeCode: string,
  loadSpeed: string,
): readonly ProductSpecRow[] {
  const lead: SpecRows = [
    ["Brand", detail.brand],
    /* The brand has its own row above: a model that starts with it drops that
       copy (D135). */
    ["Model", detail.model && stripBrandPrefix(detail.brand, detail.model)],
  ];

  if (detail.category === "tires") {
    const specs = detail.specs;
    return specRows([
      ...lead,
      ["Size", sizeCode],
      ["Season", specs && seasonLabel(specs.season, specs.studdable)],
      /* `Winter (studdable)` already says it on a winter tire; an all-season
         or summer tire that takes studs gets its own row (D135). */
      [
        "Studdable",
        specs?.studdable && specs.season !== "winter" ? "Yes" : null,
      ],
      ["Load / speed", loadSpeed],
      /* `winter_approved` is false both when the vendor said no and when it
         said nothing, so it only ever reads "Yes" (D135). */
      ["3PMSF", specs?.winterApproved ? "Yes" : null],
      ["Load range", specs?.loadRange],
      ["Ply rating", specs?.plyRating?.toString()],
      ["Run-flat", specs?.runFlat ? "Yes" : null],
      ["UTQG", specs?.utqg],
      ...extraRows(detail),
    ]);
  }

  if (detail.category === "wheels") {
    const specs = detail.specs;
    const wheel = product.wheel;
    return specRows([
      ...lead,
      ["Size", wheel && `${wheel.diameter}×${wheel.width}`],
      /* ASCII `x` in the database and the URL, U+00D7 on screen. */
      ["Bolt pattern", boltPatternValue(specs?.boltPatterns)],
      ["Offset", offsetMm(specs?.offsetMm ?? null, signedOffset)],
      /* The vendor's own wording, as it arrived (D105b): no finish filter, so
         nothing groups or renames it. */
      ["Finish", finishText(specs?.finish)],
      /* D125, the vendor sheets' own grouping and wording, as given. */
      /* The sheets' grouping of the finish; shown only when it adds something
         (D135). */
      [
        "Finish family",
        specs?.finishFamily &&
        specs.finishFamily.trim().toLowerCase() !==
          (specs.finish ?? "").trim().toLowerCase()
          ? finishText(specs.finishFamily)
          : null,
      ],
      ["Colour", finishText(specs?.color)],
      ["Lug count", specs?.lugCount == null ? null : String(specs.lugCount)],
      ["Centre bore", measure(specs?.centerBoreMm ?? null, "mm")],
      ["Backspacing", backspacing(specs?.backspacing ?? null)],
      ["Material", specs?.material],
      ["Seat type", specs?.seatType],
      ["Load rating", loadRating(specs?.loadRatingLbs ?? null)],
      ["TPMS compatible", yesNo(specs?.tpmsCompatible ?? null)],
      ["Winter use", yesNo(specs?.winterCompatible ?? null)],
      /* Its own column since D142, first of the vendor's facts, where it
         read as an extra spec before. */
      ["Part number", detail.partNumber],
      ...extraRows(detail),
    ]);
  }

  const specs = detail.specs;
  return specRows([
    ...lead,
    ["Type", specs && ACCESSORY_LABEL[accessoryParam(specs.accessoryType)]],
    /* D125: the vendor's narrower kind within the type (`Center Cap`, `Logo`). */
    ["Part type", specs?.partType],
    ["Thread size", specs?.threadSize && timesSign(specs.threadSize)],
    ["Seat type", specs?.seatType],
    ["Finish", finishText(specs?.finish)],
    /* A pack of one says nothing (D135). */
    [
      "Pack quantity",
      specs?.packQuantity == null || specs.packQuantity === 1
        ? null
        : String(specs.packQuantity),
    ],
    ["Outer diameter", measure(specs?.outerDiameterMm ?? null, "mm")],
    ["Inner diameter", measure(specs?.innerDiameterMm ?? null, "mm")],
    ["Weight", measure(specs?.weightLb ?? null, "lb")],
    ["Part number", detail.partNumber],
    ...extraRows(detail),
  ]);
}

/* --- Badges -------------------------------------------------------------- */

type Season = "winter" | "all-season" | "all-weather" | "summer";

function productSeason(product: Product): Season | null {
  if (product.badges.includes("winter")) return "winter";
  if (product.badges.includes("all-season")) return "all-season";
  if (product.badges.includes("all-weather")) return "all-weather";
  if (product.badges.includes("summer")) return "summer";
  return null;
}

const SEASON_BADGE: Readonly<Record<Season, string>> = {
  winter: "Winter",
  "all-season": "All-season",
  "all-weather": "All-weather",
  summer: "Summer",
};

/* --- Badge row ----------------------------------------------------------
   Never more than three (`product.md` §3.1): the season badge, `3PMSF` when
   the product carries the mark, `M+S` when the vendor itself says the tire is
   mud and snow rated (the tire's `mud_snow` column, D142; its `Mud & snow`
   fact before that), whatever the season (D135; the winter-implies-M+S rule
   of D53(3) was a sample-era stand-in).

   Wheels and accessories (D58) draw no badges at all: no wheel or accessory
   artboard exists to draw one, so none is invented here — the same D7
   precedent (undrawn element → follow the artboards) used throughout this
   file. `toProduct()` already gives a wheel or an accessory no badges and no
   3PMSF mark, so the code below would return `[]` for them unaided — this
   early return makes that guarantee explicit. */
function buildBadges(
  product: Product,
  config: CategoryConfig,
  season: Season | null,
  mudAndSnow: boolean,
): readonly PdpBadge[] {
  /* A discontinued product: the one dim badge takes the row, as it does on
     the card (`design/inventory/results.md:355`), whatever the category. */
  if (!product.available) {
    return [{ label: "Currently unavailable", variant: "unavailable" }];
  }

  if (config.category !== "tires") {
    return [];
  }

  const badges: PdpBadge[] = [];

  if (season !== null) {
    badges.push({
      label: SEASON_BADGE[season],
      /* Each season has its own badge colour, named as the season
         (owner, 2026-10-07; DEVIATIONS #125, #126). */
      variant: season,
    });
  }

  if (product.threePeakMountainSnowflake) {
    badges.push({ label: "3PMSF", variant: "outline", mark: "three-peak" });
  }

  if (mudAndSnow) {
    badges.push({ label: "M+S", variant: "outline" });
  }

  return badges;
}

/* --- Quantity -------------------------------------------------------------- */

function parseQuantity(params: ProductSearchParams): QuantityKey {
  const raw = params[PRODUCT_PARAM.qty];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const match = QUANTITY_OPTIONS.find((option) => option.value === value);
  return match?.value ?? DEFAULT_QUANTITY;
}

/* --- Vehicle ----------------------------------------------------------------
   Present only when all three finder params are in the URL and non-empty
   (`types.ts` `ProductView.vehicle` doc) — never invented (D47(5) precedent). */
function parseVehicle(params: ProductSearchParams): Vehicle | null {
  const read = (key: string): string => {
    const raw = params[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value ?? "";
  };

  const year = read(PRODUCT_PARAM.year);
  const make = read(PRODUCT_PARAM.make);
  const model = read(PRODUCT_PARAM.model);

  if (year === "" || make === "" || model === "") return null;
  /* Only a vehicle the finder offers: it is saved on a cart line, shown on the
     cart page and sent to the shop (D122), so an unchecked URL could write its
     own copy into all three (D91b). */
  if (!isFinderVehicle(year, make, model)) return null;
  return { year, make, model };
}

/* --- Back link ----------------------------------------------------------
   The product's own category route (D58: `config.route` — `/tires`,
   `/wheels` or `/accessories`) plus every inbound param except `qty`
   (`types.ts` `backHref` doc). Params are re-emitted in the order the page's
   own `searchParams` object enumerates them — the order the incoming URL's
   query string was in — rather than a param list reconstructed here, because
   that list would have to duplicate `results/types.ts` `RESULTS_PARAM`,
   which this feature does not import (D37). `URLSearchParams` handles
   encoding. */
function buildBackHref(params: ProductSearchParams, route: string): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (key === PRODUCT_PARAM.qty || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const entry of value) search.append(key, entry);
    } else {
      search.append(key, value);
    }
  }

  const query = search.toString();
  return query === "" ? route : `${route}?${query}`;
}

/**
 * @param detail   the product, as `getProductBySlug()` returned it
 * @param rows     the two product rows under the page, as the catalogue
 *                 returned them: `similar` (`getSimilarProducts`) and
 *                 `otherSizes` (`getOtherSizes`); and `siblings`
 *                 (`getTitleSiblings`), the products that would otherwise
 *                 share this page's title. Omitted, nothing is added.
 */
export function productView(
  detail: CatalogProductDetail,
  searchParams: ProductSearchParams,
  rows: {
    similar: readonly CatalogProduct[];
    otherSizes: readonly CatalogProduct[];
    siblings?: readonly CatalogProduct[];
  },
): ProductView {
  const product = toProduct(detail);
  const config = configFor(product);
  const { sizeCode, loadSpeed } = splitSize(detail, product);
  /* What sets this product apart from the ones that share its name and size
     (`Left side`, `Centre bore 72.6 mm`, `Part number …`, `Load range E`),
     only when such products exist (launch audit D145; D151). Appended
     here, so the buy panel's size line and the page title (`toProductSeo`
     reads `sizeLine`) say the same thing. The card's own size line is
     unchanged: showing it there waits on an owner ruling. */
  const facts = siblingFacts(detail, rows.siblings ?? []);
  const sizeLine = [
    loadSpeed === "" ? sizeCode : `${sizeCode} ${loadSpeed}`,
    ...facts,
  ]
    .filter(Boolean)
    .join(" · ");
  const fullName = productName(product.brand, product.model);
  const season = productSeason(product);
  const vehicle = parseVehicle(searchParams);

  return {
    product,
    config,
    sizeCode,
    loadSpeed,
    sizeLine,
    fullName,
    specs: buildSpecs(detail, product, sizeCode, loadSpeed),
    badges: buildBadges(
      product,
      config,
      season,
      detail.category === "tires" && detail.specs?.mudSnow === true,
    ),
    description: detail.description?.trim() || null,
    quantity: parseQuantity(searchParams),
    vehicle,
    backHref: buildBackHref(searchParams, config.route),
    similar: rows.similar.map(toProduct),
    otherSizes: rows.otherSizes.map(toProduct),
  };
}
