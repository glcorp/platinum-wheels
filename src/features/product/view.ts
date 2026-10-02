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
import type { Product, ProductCategory } from "@/features/catalog/types";
/* The one cross-feature import outside `catalog/` (D37), on the precedent of
   `results/search.ts`: the finder's list is the only authority on what counts
   as a vehicle (D91b). */
import { isFinderVehicle } from "@/features/finder/data";

import {
  DEFAULT_QUANTITY_BY_CATEGORY,
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
 * The first six tire rows are the artboard's, in its order (`product.md`
 * §2.5): Brand, Model, Size, Season, Load / speed, 3PMSF. The rest are facts
 * the catalogue carries that the seed never did (D108b), each shown only when
 * the vendor supplied it.
 */
function buildSpecs(
  detail: CatalogProductDetail,
  product: Product,
  sizeCode: string,
  loadSpeed: string,
): readonly ProductSpecRow[] {
  const lead: SpecRows = [
    ["Brand", detail.brand],
    ["Model", detail.model],
  ];

  if (detail.category === "tires") {
    const specs = detail.specs;
    return specRows([
      ...lead,
      ["Size", sizeCode],
      ["Season", specs && seasonLabel(specs.season, specs.studdable)],
      ["Load / speed", loadSpeed],
      ["3PMSF", specs && (specs.winterApproved ? "Yes" : "No")],
      ["Load range", specs?.loadRange],
      ["Ply rating", specs?.plyRating?.toString()],
      ["Run-flat", specs?.runFlat ? "Yes" : null],
      ["UTQG", specs?.utqg],
    ]);
  }

  if (detail.category === "wheels") {
    const specs = detail.specs;
    const wheel = product.wheel;
    return specRows([
      ...lead,
      ["Size", wheel && `${wheel.diameter}×${wheel.width}`],
      /* ASCII `x` in the database and the URL, U+00D7 on screen. */
      ["Bolt pattern", specs?.boltPatterns.map(timesSign).join(" / ")],
      ["Offset", specs?.offsetMm == null ? null : signedOffset(specs.offsetMm)],
      /* The vendor's own wording, as it arrived (D105b): no finish filter, so
         nothing groups or renames it. */
      ["Finish", specs?.finish],
      ["Centre bore", measure(specs?.centerBoreMm ?? null, "mm")],
      ["Backspacing", measure(specs?.backspacing ?? null, "in")],
      ["Material", specs?.material],
      ["Seat type", specs?.seatType],
      ["Load rating", measure(specs?.loadRatingLbs ?? null, "lb")],
      ["TPMS compatible", yesNo(specs?.tpmsCompatible ?? null)],
      ["Winter use", yesNo(specs?.winterCompatible ?? null)],
    ]);
  }

  const specs = detail.specs;
  return specRows([
    ...lead,
    ["Type", specs && ACCESSORY_LABEL[accessoryParam(specs.accessoryType)]],
    ["Thread size", specs?.threadSize && timesSign(specs.threadSize)],
    ["Seat type", specs?.seatType],
    ["Finish", specs?.finish],
    [
      "Pack quantity",
      specs?.packQuantity == null ? null : String(specs.packQuantity),
    ],
    ["Outer diameter", measure(specs?.outerDiameterMm ?? null, "mm")],
    ["Inner diameter", measure(specs?.innerDiameterMm ?? null, "mm")],
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
   the product carries the mark, `M+S` when the season is winter. `M+S` is
   derived, not a fact `Product` carries — sample until real sidewall data
   exists (`types.ts` `PdpBadge` doc, D48 precedent, folder `llm.md` Open #3).

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
      variant: season === "winter" ? "winter" : "outline",
    });
  }

  if (product.threePeakMountainSnowflake) {
    badges.push({ label: "3PMSF", variant: "outline", mark: "three-peak" });
  }

  if (season === "winter") {
    badges.push({ label: "M+S", variant: "outline" });
  }

  return badges;
}

/* --- Quantity -------------------------------------------------------------- */

function parseQuantity(
  params: ProductSearchParams,
  category: ProductCategory,
): QuantityKey {
  const raw = params[PRODUCT_PARAM.qty];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const match = QUANTITY_OPTIONS.find((option) => option.value === value);
  return match?.value ?? DEFAULT_QUANTITY_BY_CATEGORY[category];
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
  /* Only a vehicle the finder offers: this one is printed in the quote chip
     and the fitment sentence, so an unchecked URL could write its own copy
     onto the page (D91b). */
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
 *                 `otherSizes` (`getOtherSizes`)
 */
export function productView(
  detail: CatalogProductDetail,
  searchParams: ProductSearchParams,
  rows: {
    similar: readonly CatalogProduct[];
    otherSizes: readonly CatalogProduct[];
  },
): ProductView {
  const product = toProduct(detail);
  const config = configFor(product);
  const { sizeCode, loadSpeed } = splitSize(detail, product);
  const sizeLine = loadSpeed === "" ? sizeCode : `${sizeCode} ${loadSpeed}`;
  const fullName = `${product.brand} ${product.model}`;
  const season = productSeason(product);
  const vehicle = parseVehicle(searchParams);
  const inquiryContext =
    vehicle === null
      ? `${fullName} ${sizeCode}`
      : `${fullName} ${sizeCode} · ${vehicle.year} ${vehicle.make} ${vehicle.model}`;

  return {
    product,
    config,
    sizeCode,
    loadSpeed,
    sizeLine,
    fullName,
    specs: buildSpecs(detail, product, sizeCode, loadSpeed),
    badges: buildBadges(product, config, season),
    quantity: parseQuantity(searchParams, config.category),
    vehicle,
    backHref: buildBackHref(searchParams, config.route),
    inquiryContext,
    similar: rows.similar.map(toProduct),
    otherSizes: rows.otherSizes.map(toProduct),
  };
}
