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
import { findFitment, type FitmentSize } from "@/features/finder/data";
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
 * size at all (`config.size` is `null` for them), and since D67 narrow on the
 * spec string instead — `accessoryFitsVehicle()` below.
 */
function fitmentSize(
  category: ProductCategory,
  fit: FitmentSize | null,
): SizeFilter {
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

/* --- Accessory fitment (D67) -----------------------------------------------
 *
 * The owner vetoed D59(2) on 2026-09-22: the seed sells lug nuts in 12×1.5 and
 * 12×1.25 and TPMS sensors at 315 MHz and 433 MHz, so an accessory plainly
 * does derive something from a vehicle. It just does not derive a SIZE —
 * accessories draw no size group (D58, four filter groups not five) — so the
 * vehicle cannot narrow them the way it narrows a tire or a wheel. It drives
 * the best/similar split (D47(8)) off the product's own spec string instead.
 *
 * This lives here, not in `categories.ts`, for the same reason `fitmentSize()`
 * does: the match needs `FitmentSize`, and `categories.ts` is imported by a
 * `"use client"` island and by `catalog/`, which must not take an edge back
 * into `finder/` (D37). `search.ts` already imports both.
 * -------------------------------------------------------------------------- */

/**
 * `12×1.5` / `12x1.50` / ` 12 X 1.5 ` → `12x1.5`; anything with no pitch in it
 * → `null`.
 *
 * Both sides are normalised rather than compared raw, because they are spelled
 * differently on purpose: the fitment map carries ASCII `12x1.5` (a URL- and
 * code-safe value, like `WheelSpec.bolt`), while the card renders the
 * typographic `Set of 20 · 12×1.5` with U+00D7. A raw comparison would never
 * match and the whole feature would be invisible — every accessory would stay
 * a "best match" and nothing on screen would say why. Numbers round-trip
 * through `Number` so `1.50` and `1.5` are the same pitch.
 */
function threadPitch(raw: string): string | null {
  const match = /(\d+(?:\.\d+)?)\s*[x\u00D7]\s*(\d+(?:\.\d+)?)/i.exec(raw);
  if (match === null) return null;
  return `${Number(match[1])}x${Number(match[2])}`;
}

/** `Programmable · 315 MHz` → `315`; a spec string with no frequency → `null`. */
function sensorFrequency(raw: string): string | null {
  const match = /(\d{3})\s*MHz/i.exec(raw);
  return match === null ? null : match[1];
}

/**
 * Is this accessory a best match for the vehicle the URL names?
 *
 * The rule is per `accessoryType`, and it is deliberately asymmetric: a
 * product is demoted to `similar` ONLY when it states a vehicle-specific fact
 * that contradicts the vehicle. Stating nothing keeps it a best match.
 *
 *   `lug-nuts`, `wheel-locks` — thread onto the car's studs, so a stated
 *       pitch must equal the vehicle's. Both types are stocked in two pitches
 *       in the seed, which is the whole reason D59(2) was wrong.
 *   `tpms`          — pairs with the car's receiver, so a stated frequency
 *       must equal the vehicle's. Stocked at 315 and 433.
 *   `centre-caps`   — sized to the WHEEL's bore, not to the car; the seed
 *       spells that as `Fits 5-lug · 74 mm`, which names no vehicle fact at
 *       all. Vehicle-agnostic, stays best.
 *   anything else   — a new type is vehicle-agnostic until someone teaches
 *       this function otherwise. The failure mode of that default is a too-
 *       generous `Best matches` list, which is what the page did before D67;
 *       the failure mode of the opposite default is silently hiding stock.
 *
 * The same "states nothing → stays best" escape applies inside a type: an
 * unbranded lock set whose spec string carries no pitch is not demoted, and
 * neither is anything at all when the placeholder fitment entry itself is
 * unreadable.
 */
function accessoryFitsVehicle(product: Product, fit: FitmentSize): boolean {
  switch (product.accessoryType) {
    case "lug-nuts":
    case "wheel-locks": {
      const wanted = threadPitch(fit.thread);
      const stated = threadPitch(product.size);
      return wanted === null || stated === null || stated === wanted;
    }
    case "tpms": {
      const stated = sensorFrequency(product.size);
      return stated === null || stated === fit.tpms;
    }
    default:
      return true;
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

  /* The vehicle's placeholder fitment entry, read once (D48(4)). `null` for
     no vehicle and for a vehicle the map does not cover — both mean the page
     behaves exactly as it did before a vehicle was named. */
  const fit =
    query.vehicle === null
      ? null
      : findFitment(query.vehicle.make, query.vehicle.model);

  /* The size that decides best vs similar. An explicit size in the URL always
     wins; otherwise a vehicle may lend one, mapped per category (D48(4)).
     `query` is NOT mutated: the URL's size selects stay `Any`, the rail and
     sheet keep reading `Any`, and `facets.activeGroups` is computed from
     `query` alone — a derived fitment is not a user filter. */
  const size: SizeFilter = hasSizeFilter(query)
    ? query.size
    : fitmentSize(category, fit);

  /* What puts a product in `best`, or `null` when nothing narrows — then
     everything filtered is a best match and `Similar matches` does not render
     (D47(8)).

     Two ways to narrow, in precedence order. A size (chosen in the rail, or
     derived from the vehicle) is the tire and wheel path and is unchanged.
     An accessory has no size group at all (D58), so when a vehicle is named
     it narrows on the spec string instead (D67). The branches cannot both
     fire: `fitmentSize()` returns nothing for accessories and `query.size` is
     empty for them, so `sizeGiven` is always false there. */
  const sizeFields = config.size?.fields ?? [];
  const isBest: ((product: Product) => boolean) | null = hasSize(size)
    ? (product) => matchesSize(product, sizeFields, size)
    : category === "accessories" && fit !== null
      ? (product) => accessoryFitsVehicle(product, fit)
      : null;

  const best = isBest === null ? filtered : filtered.filter(isBest);
  const similar =
    isBest === null ? [] : filtered.filter((product) => !isBest(product));

  return {
    query,
    facets: buildFacets(category, products, query, filtered.length),
    best: sortProducts(best, query.sort),
    similar: sortProducts(similar, query.sort),
    total: best.length + similar.length,
  };
}
