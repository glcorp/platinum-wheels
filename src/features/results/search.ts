/**
 * Server half of the results contract: filter, sort and facet the catalog seed.
 * Imports the seed, so it is never imported from a `"use client"` file.
 * Signature fixed by the coordinator; body implemented by the data agent.
 *
 * Every number this file returns is computed from `PRODUCTS` — facet counts,
 * the match count, `Filters (n)` and the price bounds (D42). No artboard
 * number ships as a count.
 */

import { PRODUCTS } from "@/features/catalog/data";
import type { Product, ProductBadge } from "@/features/catalog/types";
import { findFitment } from "@/features/finder/data";
import { parseResultsQuery } from "./query";
import {
  SEASON_OPTIONS,
  type FacetOption,
  type Facets,
  type PriceFacet,
  type RawSearchParams,
  type ResultsQuery,
  type ResultsView,
  type SizeOption,
  type Vehicle,
} from "./types";

/* --- Size ---------------------------------------------------------------- */

export interface SizeParts {
  width: string;
  profile: string;
  rim: string;
}

/** `215/55R16 · 97T XL` → `{ width: "215", profile: "55", rim: "16" }`.
 *  The format is measured, not invented: `<width>/<ratio>R<rim>` with no
 *  spaces, then ` · ` (U+00B7) and the load/speed pair
 *  (`design/inventory/results.md:737`). Exported for the sanity check; it is
 *  not part of the `types.ts` contract. */
export function parseSize(size: string): SizeParts | null {
  const match = /^(\d+)\/(\d+)R(\d+)/.exec(size);
  if (match === null) return null;
  return { width: match[1], profile: match[2], rim: match[3] };
}

/** The size the best/similar split is measured against. Every part may be
 *  `null`, meaning "constrains nothing". Not part of the `types.ts` contract:
 *  it is internal to the split and never reaches the URL or the rail. */
interface SizeFilter {
  width: string | null;
  profile: string | null;
  rim: string | null;
}

const NO_SIZE: SizeFilter = { width: null, profile: null, rim: null };

/** True when every size part the filter names matches this product. A part
 *  left `null` constrains nothing (D47(8)). */
function matchesSize(product: Product, size: SizeFilter): boolean {
  const parts = parseSize(product.size);
  if (parts === null) return false;
  if (size.width !== null && parts.width !== size.width) return false;
  if (size.profile !== null && parts.profile !== size.profile) return false;
  if (size.rim !== null && parts.rim !== size.rim) return false;
  return true;
}

function hasSize(size: SizeFilter): boolean {
  return size.width !== null || size.profile !== null || size.rim !== null;
}

function hasSizeFilter(query: ResultsQuery): boolean {
  return hasSize(query);
}

/** D48(4): a vehicle in the URL with every size select still at `Any` borrows
 *  its size from the PLACEHOLDER fitment map beside the finder seed
 *  (`src/features/finder/data.ts`, sample data — year is ignored there). An
 *  unmapped vehicle resolves to no size, so the page behaves exactly as it did
 *  before: everything filtered is a best match (D47(8)). */
function fitmentSize(vehicle: Vehicle | null): SizeFilter {
  if (vehicle === null) return NO_SIZE;
  const fit = findFitment(vehicle.make, vehicle.model);
  if (fit === null) return NO_SIZE;
  return { width: fit.width, profile: fit.profile, rim: fit.rim };
}

/* --- Non-size filter groups ---------------------------------------------- */

/* ANDed across groups, ORed within one. Size is deliberately absent: it never
   removes a product, it only decides `best` vs `similar` (D47(8)). */

function matchesSeasons(product: Product, query: ResultsQuery): boolean {
  if (query.seasons.length === 0) return true;
  return query.seasons.some((season) =>
    product.badges.includes(season as ProductBadge),
  );
}

function matchesBrands(product: Product, query: ResultsQuery): boolean {
  if (query.brands.length === 0) return true;
  return query.brands.includes(product.brand);
}

function matchesPrice(product: Product, query: ResultsQuery): boolean {
  if (query.priceMin !== null && product.price < query.priceMin) return false;
  if (query.priceMax !== null && product.price > query.priceMax) return false;
  return true;
}

/* --- Facets -------------------------------------------------------------- */

/** Distinct values of one size part across the seed, numerically ascending.
 *  Rims read `R16` in the rail (results-desktop.html:131); widths and
 *  profiles read bare. */
function sizeOptions(
  products: readonly Product[],
  part: keyof SizeParts,
  labelPrefix = "",
): SizeOption[] {
  const seen = new Set<string>();
  for (const product of products) {
    const parts = parseSize(product.size);
    if (parts !== null) seen.add(parts[part]);
  }
  return [...seen]
    .sort((a, b) => Number(a) - Number(b))
    .map((value) => ({ value, label: `${labelPrefix}${value}` }));
}

/** Standard faceting: an option's count is what it would yield given every
 *  OTHER group's filter, so a selected option never reads 0 (D42). */
function seasonFacets(
  products: readonly Product[],
  query: ResultsQuery,
): FacetOption[] {
  return SEASON_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    count: products.filter(
      (product) =>
        product.badges.includes(option.value as ProductBadge) &&
        matchesBrands(product, query) &&
        matchesPrice(product, query),
    ).length,
    selected: query.seasons.includes(option.value),
  }));
}

/** Every brand present in the seed, in order of first appearance — the rail
 *  renders fewer rows than the artboard draws, which is D42's stated cost. */
function brandFacets(
  products: readonly Product[],
  query: ResultsQuery,
): FacetOption[] {
  const order: string[] = [];
  for (const product of products) {
    if (!order.includes(product.brand)) order.push(product.brand);
  }
  return order.map((brand) => ({
    value: brand,
    label: brand,
    count: products.filter(
      (product) =>
        product.brand === brand &&
        matchesSeasons(product, query) &&
        matchesPrice(product, query),
    ).length,
    selected: query.brands.includes(brand),
  }));
}

/** Seed bounds rounded outward to $10, and the active range clamped into
 *  them — computed, never typed (D42). */
function priceFacet(
  products: readonly Product[],
  query: ResultsQuery,
): PriceFacet {
  const prices = products.map((product) => product.price);
  const min = Math.floor(Math.min(...prices) / 10) * 10;
  const max = Math.ceil(Math.max(...prices) / 10) * 10;
  const clamp = (value: number) => Math.min(Math.max(value, min), max);
  return {
    min,
    max,
    selectedMin: clamp(query.priceMin ?? min),
    selectedMax: clamp(query.priceMax ?? max),
  };
}

/** `Filters (n)` on the mobile bar: groups carrying an active filter. Price
 *  counts only when a bound differs from the computed bound — a slider parked
 *  at either end is not a filter. */
function countActiveGroups(query: ResultsQuery, price: PriceFacet): number {
  const priceActive =
    (query.priceMin !== null && price.selectedMin !== price.min) ||
    (query.priceMax !== null && price.selectedMax !== price.max);
  return [
    hasSizeFilter(query),
    query.seasons.length > 0,
    query.brands.length > 0,
    priceActive,
  ].filter(Boolean).length;
}

function buildFacets(
  products: readonly Product[],
  query: ResultsQuery,
  tireCount: number,
): Facets {
  const price = priceFacet(products, query);
  return {
    tireCount,
    sizes: {
      widths: sizeOptions(products, "width"),
      profiles: sizeOptions(products, "profile"),
      rims: sizeOptions(products, "rim", "R"),
    },
    seasons: seasonFacets(products, query),
    brands: brandFacets(products, query),
    price,
    activeGroups: countActiveGroups(query, price),
  };
}

/* --- Sort ---------------------------------------------------------------- */

/** `best` keeps seed order, which is artboard order (D43); the two price
 *  sorts are stable, so equal prices keep it too. */
function sortProducts(
  products: readonly Product[],
  sort: ResultsQuery["sort"],
): Product[] {
  if (sort === "best") return [...products];
  const direction = sort === "price-asc" ? 1 : -1;
  return [...products].sort((a, b) => (a.price - b.price) * direction);
}

/* --- Search -------------------------------------------------------------- */

export function searchResults(params: RawSearchParams): ResultsView {
  const query = parseResultsQuery(params);

  /* The unavailable SKU is NOT excluded: the artboard draws it and the page
     still returns 200 with the dimmed card (`docs/decisions.md` §7). */
  const filtered = PRODUCTS.filter(
    (product) =>
      matchesSeasons(product, query) &&
      matchesBrands(product, query) &&
      matchesPrice(product, query),
  );

  /* The size that decides best vs similar. An explicit size in the URL always
     wins; otherwise a vehicle may lend one from the placeholder fitment map
     (D48(4)). `query` is NOT mutated: the URL's size selects stay `Any`, the
     rail and sheet keep reading `Any`, and `facets.activeGroups` is computed
     from `query` alone — a derived fitment is not a user filter. */
  const size: SizeFilter = hasSizeFilter(query)
    ? { width: query.width, profile: query.profile, rim: query.rim }
    : fitmentSize(query.vehicle);

  /* No size at all → everything is a best match and `Similar matches` does not
     render (D47(8)). */
  const sizeGiven = hasSize(size);
  const best = sizeGiven
    ? filtered.filter((product) => matchesSize(product, size))
    : filtered;
  const similar = sizeGiven
    ? filtered.filter((product) => !matchesSize(product, size))
    : [];

  return {
    query,
    facets: buildFacets(PRODUCTS, query, filtered.length),
    best: sortProducts(best, query.sort),
    similar: sortProducts(similar, query.sort),
    total: best.length + similar.length,
  };
}
