/**
 * `productView()` — the only place any PDP value is derived from a `Product`
 * and the page's raw query string. Every section reads the `ProductView` this
 * returns; none of them re-parses `Product.size`, re-derives a spec row or
 * re-computes the similar list (`src/features/product/llm.md` "Owns").
 *
 * Pure, no I/O — mirrors the split between `src/features/results/query.ts`
 * (parse) and `src/features/results/search.ts` (derive) but as one function,
 * because the PDP contract (`types.ts`) is one `productView()` call, not a
 * query type plus a search function.
 *
 * Imports the seed (`productsIn()`, `@/features/catalog/data`) so this file
 * is never imported from a `"use client"` leaf — same rule as
 * `results/search.ts`.
 */

import { productsIn } from "@/features/catalog/data";
import { configFor, type CategoryConfig } from "@/features/catalog/categories";
import type { Product } from "@/features/catalog/types";

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

/* --- Size string ----------------------------------------------------------- */

/** `product.md` §3.2: a tire's `Product.size` is `<sizeCode> · <loadSpeed>`,
 *  e.g. `215/55R16 · 97T XL` — unchanged for tires (D58). Defensive: a tire
 *  size with no ` · ` separator puts everything in `sizeCode` and leaves
 *  `loadSpeed` empty, rather than throwing on data that does not match the
 *  shape the seed happens to use.
 *
 *  A wheel's size (`18×8.5 · 5×114.3`) and an accessory's (`Set of 4 ·
 *  12×1.5`) do not split into that shape — their spec rows come from
 *  `product.wheel` / `product.accessoryType` instead (`buildSpecs` below), so
 *  for those two categories the whole string stays intact as `sizeCode` and
 *  `loadSpeed` is empty; `sizeLine` (built by the caller) then renders the
 *  whole string, ` · ` included (D58, `types.ts` `sizeLine` doc). */
function splitSize(
  product: Product,
  config: CategoryConfig,
): { sizeCode: string; loadSpeed: string } {
  if (config.category !== "tires") {
    return { sizeCode: product.size, loadSpeed: "" };
  }

  const separator = " · ";
  const index = product.size.indexOf(separator);
  if (index === -1) return { sizeCode: product.size, loadSpeed: "" };
  return {
    sizeCode: product.size.slice(0, index),
    loadSpeed: product.size.slice(index + separator.length),
  };
}

/* --- Season -----------------------------------------------------------------
   The one season a product carries, read off `Product.badges` (catalog/types
   `ProductBadge`). Shared by the spec table's `Season` row, the badge row and
   the similar-products grouping (D52) so all three agree on one product's
   season. */

type Season = "winter" | "all-season" | "summer";

function productSeason(product: Product): Season | null {
  if (product.badges.includes("winter")) return "winter";
  if (product.badges.includes("all-season")) return "all-season";
  if (product.badges.includes("summer")) return "summer";
  return null;
}

/** `Winter (studdable)` / `Winter` / `All-season` / `Summer` — the spec
 *  table's `Season` value (`product.md` §2.5 row 4, verbatim `Winter
 *  (studdable)`). Empty when the product carries none of the three season
 *  badges, so the row is dropped rather than printing a blank (D53(1)). */
function seasonLabel(product: Product, season: Season | null): string {
  if (season === "winter") {
    return product.studdable ? "Winter (studdable)" : "Winter";
  }
  if (season === "all-season") return "All-season";
  if (season === "summer") return "Summer";
  return "";
}

/* --- Spec table -------------------------------------------------------------
   Tires: six rows, drawn order, keys artboard-verbatim including the
   `Load / speed` spacing (`product.md` §2.5, §3.7). A row whose value would
   be empty is dropped rather than invented (D53(1)) — that only ever happens
   to `Season` or `Load / speed` on data the artboard itself never exercises.
   Unchanged by D58: a tire's five rows and their values are byte-identical to
   the built page. Wheels and accessories get their own shapes below, each
   applying the same empty-value-dropped rule. */
function buildSpecs(
  product: Product,
  config: CategoryConfig,
  sizeCode: string,
  loadSpeed: string,
  season: Season | null,
): readonly ProductSpecRow[] {
  if (config.category === "wheels") {
    return buildWheelSpecs(product, config);
  }
  if (config.category === "accessories") {
    return buildAccessorySpecs(product, config);
  }

  const rows: Array<[string, string]> = [
    ["Brand", product.brand],
    ["Model", product.model],
    ["Size", sizeCode],
    ["Season", seasonLabel(product, season)],
    ["Load / speed", loadSpeed],
    ["3PMSF", product.threePeakMountainSnowflake ? "Yes" : "No"],
  ];

  return rows
    .filter(([, value]) => value !== "")
    .map(([key, value]) => ({ key, value }));
}

/** Wheel's six rows (D58): Brand, Model, Size (`<diameter>×<width>`, U+00D7),
 *  Bolt pattern (`wheel.bolt` with its ASCII `x` swapped for U+00D7 — the
 *  seed and URL keep the ASCII spelling, only the display differs,
 *  `categories.ts` "Bolt pattern"), Offset (`wheel.offset` verbatim — it
 *  already carries its own sign), Finish (looked up in
 *  `CategoryConfig.chips.options` rather than retyped, so the spec row and
 *  the filter chip can never disagree). Same empty-value-dropped rule as
 *  tires (D53(1)); only exercised on data the WHEELS seed never has, since
 *  every row there carries a `wheel`. */
function buildWheelSpecs(
  product: Product,
  config: CategoryConfig,
): readonly ProductSpecRow[] {
  const wheel = product.wheel;
  const finishLabel =
    wheel === undefined
      ? ""
      : (config.chips.options.find((option) => option.value === wheel.finish)?.label ??
        wheel.finish);

  const rows: Array<[string, string]> = [
    ["Brand", product.brand],
    ["Model", product.model],
    ["Size", wheel === undefined ? "" : `${wheel.diameter}×${wheel.width}`],
    ["Bolt pattern", wheel === undefined ? "" : wheel.bolt.replace("x", "×")],
    ["Offset", wheel?.offset ?? ""],
    ["Finish", finishLabel],
  ];

  return rows
    .filter(([, value]) => value !== "")
    .map(([key, value]) => ({ key, value }));
}

/** Accessory's four rows (D58): Brand, Model, Type (looked up in
 *  `CategoryConfig.chips.options`, same reasoning as the wheel Finish row
 *  above), Fits (`Product.size`, the short descriptor, e.g. `Set of 4 ·
 *  12×1.5`). Four rows, not six — there is no season or load/speed fact on an
 *  accessory. */
function buildAccessorySpecs(
  product: Product,
  config: CategoryConfig,
): readonly ProductSpecRow[] {
  const typeLabel =
    product.accessoryType === undefined
      ? ""
      : (config.chips.options.find((option) => option.value === product.accessoryType)?.label ??
        "");

  const rows: Array<[string, string]> = [
    ["Brand", product.brand],
    ["Model", product.model],
    ["Type", typeLabel],
    ["Fits", product.size],
  ];

  return rows
    .filter(([, value]) => value !== "")
    .map(([key, value]) => ({ key, value }));
}

/* --- Badge row ----------------------------------------------------------
   Never more than three (`product.md` §3.1): the season badge, `3PMSF` when
   the product carries the mark, `M+S` when the season is winter. `M+S` is
   derived, not a fact `Product` carries — sample until real sidewall data
   exists (`types.ts` `PdpBadge` doc, D48 precedent, folder `llm.md` Open #3).

   Wheels and accessories (D58) draw no badges at all: no wheel or accessory
   artboard exists to draw one, so none is invented here — the same D7
   precedent (undrawn element → follow the artboards) used throughout this
   file. `Product.badges` is `[]` and `threePeakMountainSnowflake` is `false`
   on every WHEELS and ACCESSORIES seed row already (`catalog/data.ts`), so
   the code below would already return `[]` for them unaided — this early
   return makes that guarantee explicit rather than relying on seed data
   staying that way. */
function buildBadges(
  product: Product,
  config: CategoryConfig,
  season: Season | null,
): readonly PdpBadge[] {
  if (config.category !== "tires") {
    return [];
  }

  const badges: PdpBadge[] = [];

  if (season !== null) {
    badges.push({
      label: season === "winter" ? "Winter" : seasonLabel(product, season),
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
  return { year, make, model };
}

/* --- Back link ----------------------------------------------------------
   The product's own category route (D58: `config.route` — `/results`,
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

/* --- Similar products ---------------------------------------------------
   D52, extended by D58: stay within the subject's own category — a wheel PDP
   must never recommend a tire — exclude the current slug, prefer products
   sharing the subject's own chip value (season for tires, finish for wheels,
   type for accessories, via `config.chips.match` so this file never repeats
   which param each category filters on), fall back to the rest of that
   category in seed order, cap at 4. Deterministic — `Array.prototype.filter`
   preserves `productsIn()`'s own order, so no randomness and no re-sort.

   For tires this reproduces the pre-D58 season-based grouping exactly: every
   tire in the seed carries exactly one season badge, so finding "the option
   whose `match` returns true for the subject" always lands on the same
   season `productSeason()` would have read directly, and `productsIn("tires")`
   is `PRODUCTS` — the same array this used to filter. */
function subjectChipValue(product: Product, config: CategoryConfig): string | null {
  const option = config.chips.options.find((candidate) =>
    config.chips.match(product, candidate.value),
  );
  return option?.value ?? null;
}

function buildSimilar(product: Product, config: CategoryConfig): readonly Product[] {
  const categoryProducts = productsIn(config.category);
  const others = categoryProducts.filter((candidate) => candidate.slug !== product.slug);
  const subjectValue = subjectChipValue(product, config);

  const matching =
    subjectValue === null
      ? []
      : others.filter((candidate) => config.chips.match(candidate, subjectValue));
  const matchingSlugs = new Set(matching.map((candidate) => candidate.slug));
  const rest = others.filter((candidate) => !matchingSlugs.has(candidate.slug));

  return [...matching, ...rest].slice(0, 4);
}

/* --- Entry point ----------------------------------------------------------- */

export function productView(
  product: Product,
  searchParams: ProductSearchParams,
): ProductView {
  const config = configFor(product);
  const { sizeCode, loadSpeed } = splitSize(product, config);
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
    specs: buildSpecs(product, config, sizeCode, loadSpeed, season),
    badges: buildBadges(product, config, season),
    quantity: parseQuantity(searchParams),
    vehicle,
    backHref: buildBackHref(searchParams, config.route),
    inquiryContext,
    similar: buildSimilar(product, config),
  };
}
