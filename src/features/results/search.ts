/**
 * Server half of the results contract: filter, sort and facet the catalog
 * seed. Imports the seed, so it is never imported from a `"use client"` file.
 *
 * Serves three routes now — `/results` (tires), `/wheels`, `/accessories`
 * (D58) — off one function, `searchResults(category, params)`. Everything
 * category-specific (which products, which filter groups, how size is read
 * off a product, the fitment map's per-category shape) comes from
 * `CATEGORY_CONFIG` (`@/features/catalog/categories`) or `productsIn()`
 * (`@/features/catalog/data`); nothing here branches on `category` beyond
 * choosing which config/seed to read. Every number this file returns is still
 * computed from the seed — facet counts, the match count, `Filters (n)` and
 * the price bounds (D42). No artboard number ships as a count.
 */

import { productsIn } from "@/features/catalog/data";
import {
  CATEGORY_CONFIG,
  type ChipGroupConfig,
  type SizeFieldConfig,
} from "@/features/catalog/categories";
import type { Product, ProductCategory } from "@/features/catalog/types";
import { findFitment } from "@/features/finder/data";
import { parseResultsQuery } from "./query";
import type {
  CategoryFacet,
  FacetOption,
  Facets,
  PriceFacet,
  RawSearchParams,
  ResultsQuery,
  ResultsView,
  SizeOption,
  Vehicle,
} from "./types";

/* --- Size ------------------------------------------------------------------
 *
 * Size is deliberately NOT a filter group: it never removes a product from
 * the result set, it only decides `best` vs `similar` (D47(8)). One key per
 * `config.size.fields[].param`; a key absent from the object, or present with
 * `null`, constrains nothing.
 */

type SizeFilter = Readonly<Record<string, string | null>>;

const NO_SIZE: SizeFilter = {};

function hasSize(size: SizeFilter): boolean {
  return Object.values(size).some((value) => value !== null);
}

function hasSizeFilter(query: ResultsQuery): boolean {
  return hasSize(query.size);
}

/** True when every size part `size` names matches this product — a part
 *  absent or `null` constrains nothing (D47(8), generalised from tires to any
 *  `SizeFieldConfig` list). */
function matchesSize(
  product: Product,
  fields: readonly SizeFieldConfig[],
  size: SizeFilter,
): boolean {
  for (const field of fields) {
    const wanted = size[field.param];
    if (wanted === undefined || wanted === null) continue;
    if (field.read(product) !== wanted) return false;
  }
  return true;
}

/**
 * D48(4): a vehicle in the URL with every size select still at `Any` borrows
 * a size from the PLACEHOLDER fitment map beside the finder seed
 * (`src/features/finder/data.ts`, sample data — year is ignored there). An
 * unmapped vehicle resolves to no size, so the page behaves exactly as it did
 * before: everything filtered is a best match (D47(8)).
 *
 * Per category, because a car determines different things for different
 * goods (owner, 2026-09-21): **tires** derive `width`/`profile`/`rim`
 * straight off the fitment entry; **wheels** derive `bolt` only — diameter
 * and width are the buyer's choice, not the car's; **accessories** derive no
 * size at all (`config.size` is `null` for them).
 */
function fitmentSize(
  category: ProductCategory,
  vehicle: Vehicle | null,
): SizeFilter {
  if (vehicle === null) return NO_SIZE;
  const fit = findFitment(vehicle.make, vehicle.model);
  if (fit === null) return NO_SIZE;
  switch (category) {
    case "tires":
      return { width: fit.width, profile: fit.profile, rim: fit.rim };
    case "wheels":
      return { bolt: fit.bolt };
    case "accessories":
      return NO_SIZE;
  }
}

/* --- Non-size filter groups -------------------------------------------------
 *
 * ANDed across groups, ORed within one.
 */

function matchesChips(
  product: Product,
  query: ResultsQuery,
  config: ChipGroupConfig,
): boolean {
  if (query.chips.length === 0) return true;
  return query.chips.some((value) => config.match(product, value));
}

function matchesBrands(product: Product, query: ResultsQuery): boolean {
  if (query.brands.length === 0) return true;
  /* Case-insensitive: D44 makes the URL the shareable state, so `?brand=` is
     something a person types, forwards or has normalised to lower case by
     another system. Exact matching meant `?brand=Zeta` returned 2 and
     `?brand=zeta` returned 0 with no hint why — measured live. The facet
     values still ship in the seed's own casing; only the comparison relaxes.
     Craft audit P2. */
  const wanted = query.brands.map((brand) => brand.toLowerCase());
  return wanted.includes(product.brand.toLowerCase());
}

function matchesPrice(product: Product, query: ResultsQuery): boolean {
  if (query.priceMin !== null && product.price < query.priceMin) return false;
  if (query.priceMax !== null && product.price > query.priceMax) return false;
  return true;
}

/* --- Facets ---------------------------------------------------------------
 */

/** Distinct non-null `field.read(product)` values across the seed. Numeric
 *  ascending by default; `field.sort === "text"` sorts lexically (bolt
 *  patterns). `label` = `field.labelPrefix + value` — tires' rim reads `R16`
 *  in the rail while the value stays `16` in the URL. */
function sizeFieldOptions(
  products: readonly Product[],
  field: SizeFieldConfig,
): SizeOption[] {
  const seen = new Set<string>();
  for (const product of products) {
    const value = field.read(product);
    if (value !== null) seen.add(value);
  }
  const sorted = [...seen].sort((a, b) =>
    field.sort === "text" ? a.localeCompare(b) : Number(a) - Number(b),
  );
  return sorted.map((value) => ({
    value,
    label: `${field.labelPrefix ?? ""}${value}`,
  }));
}

function buildSizeGroup(
  category: ProductCategory,
  products: readonly Product[],
  query: ResultsQuery,
): Facets["sizeGroup"] {
  const config = CATEGORY_CONFIG[category].size;
  if (config === null) return null;
  return {
    label: config.label,
    fields: config.fields.map((field) => ({
      param: field.param,
      caption: field.caption,
      options: sizeFieldOptions(products, field),
      value: query.size[field.param] ?? null,
    })),
  };
}

/** Standard faceting: an option's count is what it would yield given every
 *  OTHER group's filter, so a selected option never reads 0 (D42). */
function chipFacets(
  products: readonly Product[],
  query: ResultsQuery,
  config: ChipGroupConfig,
): FacetOption[] {
  return config.options.map((option) => ({
    value: option.value,
    label: option.label,
    count: products.filter(
      (product) =>
        config.match(product, option.value) &&
        matchesBrands(product, query) &&
        matchesPrice(product, query),
    ).length,
    selected: query.chips.includes(option.value),
  }));
}

/** Every brand present in this category's seed, in order of first appearance
 *  — the rail renders fewer rows than an artboard might draw, which is D42's
 *  stated cost. */
function brandFacets(
  products: readonly Product[],
  query: ResultsQuery,
  chipConfig: ChipGroupConfig,
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
        matchesChips(product, query, chipConfig) &&
        matchesPrice(product, query),
    ).length,
    /* Case-insensitive to match `matchesBrands`: otherwise `?brand=zeta` would
       filter the grid correctly but leave the Zeta row unticked. */
    selected: query.brands.some(
      (wanted) => wanted.toLowerCase() === brand.toLowerCase(),
    ),
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
 *  at either end is not a filter. Size cannot contribute for a category with
 *  no size group (accessories): `hasSizeFilter` reads an always-empty
 *  `query.size` there and is always `false`. */
function countActiveGroups(query: ResultsQuery, price: PriceFacet): number {
  const priceActive =
    (query.priceMin !== null && price.selectedMin !== price.min) ||
    (query.priceMax !== null && price.selectedMax !== price.max);
  return [
    hasSizeFilter(query),
    query.chips.length > 0,
    query.brands.length > 0,
    priceActive,
  ].filter(Boolean).length;
}

/** `Tires` / `Wheels` / `Accessories` — every category's id, capitalised, in
 *  drawn order (D58). Only `current` carries a `count`; the artboard draws a
 *  count on the current category alone and counting another category through
 *  filters it does not share would be a number nobody can check (D42). */
function categoryFacets(
  current: ProductCategory,
  currentCount: number,
): CategoryFacet[] {
  const order: readonly ProductCategory[] = ["tires", "wheels", "accessories"];
  return order.map((category) => {
    const config = CATEGORY_CONFIG[category];
    return {
      category,
      label: config.label,
      href: config.route,
      current: category === current,
      count: category === current ? currentCount : null,
    };
  });
}

function buildFacets(
  category: ProductCategory,
  products: readonly Product[],
  query: ResultsQuery,
  currentCount: number,
): Facets {
  const config = CATEGORY_CONFIG[category];
  const price = priceFacet(products, query);
  return {
    category,
    categories: categoryFacets(category, currentCount),
    sizeGroup: buildSizeGroup(category, products, query),
    chipGroup: {
      label: config.chips.label,
      param: config.chips.param,
      options: chipFacets(products, query, config.chips),
    },
    brands: brandFacets(products, query, config.chips),
    price,
    priceLabel: config.priceLabel,
    activeGroups: countActiveGroups(query, price),
  };
}

/* --- Sort -------------------------------------------------------------- */

/** `best` keeps seed order, which is artboard order for tires (D43); the two
 *  price sorts are stable, so equal prices keep it too. */
function sortProducts(
  products: readonly Product[],
  sort: ResultsQuery["sort"],
): Product[] {
  if (sort === "best") return [...products];
  const direction = sort === "price-asc" ? 1 : -1;
  return [...products].sort((a, b) => (a.price - b.price) * direction);
}

/* --- Search -------------------------------------------------------------- */

export function searchResults(
  category: ProductCategory,
  params: RawSearchParams,
): ResultsView {
  const query = parseResultsQuery(category, params);
  const config = CATEGORY_CONFIG[category];
  const products = productsIn(category);

  /* The unavailable SKU is NOT excluded: the artboard draws it and the page
     still returns 200 with the dimmed card (`docs/decisions.md` §7). */
  const filtered = products.filter(
    (product) =>
      matchesChips(product, query, config.chips) &&
      matchesBrands(product, query) &&
      matchesPrice(product, query),
  );

  /* The size that decides best vs similar. An explicit size in the URL always
     wins; otherwise a vehicle may lend one from the placeholder fitment map,
     mapped per category (D48(4)). `query` is NOT mutated: the URL's size
     selects stay `Any`, the rail and sheet keep reading `Any`, and
     `facets.activeGroups` is computed from `query` alone — a derived fitment
     is not a user filter. */
  const size: SizeFilter = hasSizeFilter(query)
    ? query.size
    : fitmentSize(category, query.vehicle);

  /* No size at all → everything filtered is a best match and `Similar
     matches` does not render (D47(8)). */
  const sizeGiven = hasSize(size);
  const sizeFields = config.size?.fields ?? [];
  const best = sizeGiven
    ? filtered.filter((product) => matchesSize(product, sizeFields, size))
    : filtered;
  const similar = sizeGiven
    ? filtered.filter((product) => !matchesSize(product, sizeFields, size))
    : [];

  return {
    query,
    facets: buildFacets(category, products, query, filtered.length),
    best: sortProducts(best, query.sort),
    similar: sortProducts(similar, query.sort),
    total: best.length + similar.length,
  };
}
