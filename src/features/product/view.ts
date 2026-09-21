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
 * Imports the seed (`PRODUCTS`) so this file is never imported from a
 * `"use client"` leaf — same rule as `results/search.ts`.
 */

import { PRODUCTS } from "@/features/catalog/data";
import type { Product } from "@/features/catalog/types";
import { ROUTES } from "@/lib/routes";

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

/** `product.md` §3.2: `Product.size` is `<sizeCode> · <loadSpeed>`, e.g.
 *  `215/55R16 · 97T XL`. Defensive: a size with no ` · ` separator puts
 *  everything in `sizeCode` and leaves `loadSpeed` empty, rather than
 *  throwing on data that does not match the shape the seed happens to use. */
function splitSize(size: string): { sizeCode: string; loadSpeed: string } {
  const separator = " · ";
  const index = size.indexOf(separator);
  if (index === -1) return { sizeCode: size, loadSpeed: "" };
  return {
    sizeCode: size.slice(0, index),
    loadSpeed: size.slice(index + separator.length),
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
   Six rows, drawn order, keys artboard-verbatim including the `Load / speed`
   spacing (`product.md` §2.5, §3.7). A row whose value would be empty is
   dropped rather than invented (D53(1)) — that only ever happens to `Season`
   or `Load / speed` on data the artboard itself never exercises. */
function buildSpecs(
  product: Product,
  sizeCode: string,
  loadSpeed: string,
  season: Season | null,
): readonly ProductSpecRow[] {
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

/* --- Badge row ----------------------------------------------------------
   Never more than three (`product.md` §3.1): the season badge, `3PMSF` when
   the product carries the mark, `M+S` when the season is winter. `M+S` is
   derived, not a fact `Product` carries — sample until real sidewall data
   exists (`types.ts` `PdpBadge` doc, D48 precedent, folder `llm.md` Open #3). */
function buildBadges(product: Product, season: Season | null): readonly PdpBadge[] {
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
   `/results` plus every inbound param except `qty` (`types.ts` `backHref`
   doc). Params are re-emitted in the order the page's own `searchParams`
   object enumerates them — the order the incoming URL's query string was in
   — rather than a param list reconstructed here, because that list would
   have to duplicate `results/types.ts` `RESULTS_PARAM`, which this feature
   does not import (D37). `URLSearchParams` handles encoding. */
function buildBackHref(params: ProductSearchParams): string {
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
  return query === "" ? ROUTES.results : `${ROUTES.results}?${query}`;
}

/* --- Similar products ---------------------------------------------------
   D52: exclude the current slug; prefer products sharing a season with the
   subject; fall back to the rest of `PRODUCTS` in seed order; cap at 4.
   Deterministic — `Array.prototype.filter` preserves `PRODUCTS`' own order,
   so no randomness and no re-sort. */
function buildSimilar(product: Product): readonly Product[] {
  const others = PRODUCTS.filter((candidate) => candidate.slug !== product.slug);
  const subjectSeason = productSeason(product);

  const sameSeason =
    subjectSeason === null
      ? []
      : others.filter((candidate) => productSeason(candidate) === subjectSeason);
  const sameSeasonSlugs = new Set(sameSeason.map((candidate) => candidate.slug));
  const rest = others.filter((candidate) => !sameSeasonSlugs.has(candidate.slug));

  return [...sameSeason, ...rest].slice(0, 4);
}

/* --- Entry point ----------------------------------------------------------- */

export function productView(
  product: Product,
  searchParams: ProductSearchParams,
): ProductView {
  const { sizeCode, loadSpeed } = splitSize(product.size);
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
    sizeCode,
    loadSpeed,
    sizeLine,
    fullName,
    specs: buildSpecs(product, sizeCode, loadSpeed, season),
    badges: buildBadges(product, season),
    quantity: parseQuantity(searchParams),
    vehicle,
    backHref: buildBackHref(searchParams),
    inquiryContext,
    similar: buildSimilar(product),
  };
}
