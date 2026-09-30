/**
 * Server half of the results contract: ask the catalogue for one page of
 * matches, the similar sizes beneath them, and the facets beside them. Reads
 * the database, so it is never imported from a `"use client"` file.
 *
 * Serves three routes — `/results` (tires), `/wheels`, `/accessories` (D58) —
 * off one function, `searchResults(category, params)`. Everything
 * category-specific comes from `CATEGORY_CONFIG`
 * (`@/features/catalog/categories`); filtering, counting and sorting are SQL
 * (`@/features/catalog/queries`). Every number this file returns is computed
 * from the catalogue — facet counts, the match count, `Filters (n)` and the
 * price bounds (D42). No artboard number ships as a count.
 *
 * What changed when the seed went (D108), because nine products and forty-five
 * thousand behave differently:
 *   - **A size filters.** With the seed, a size only split the set into best
 *     and similar and "similar" was everything else. Now `best` is the size
 *     asked for and `similar` is the sizes next to it (`sizeMatch: "near"`).
 *     Facet counts follow `best`, so the number beside a brand is the number
 *     of cards that brand opens.
 *   - **The lists arrive windowed.** `query.show` is a limit handed to the
 *     database, not a slice taken from an in-memory list.
 */

import {
  accessoryFromParam,
  accessoryParam,
  seasonFromParam,
  seasonParam,
  toProduct,
} from "@/features/catalog/adapter";
import type {
  CatalogFacets,
  ProductFilters,
} from "@/features/catalog/catalog-types";
import { CATEGORY_CONFIG } from "@/features/catalog/categories";
import {
  getFacets,
  getPriceBounds,
  listProducts,
} from "@/features/catalog/queries";
import type { ProductCategory } from "@/features/catalog/types";
import { findFitment, type FitmentSize } from "@/features/finder/data";
import { parseResultsQuery } from "./query";
import {
  RESULTS_WINDOW,
  type FacetOption,
  type Facets,
  type PriceFacet,
  type RawSearchParams,
  type ResultsQuery,
  type ResultsView,
  type SizeOption,
} from "./types";

/* --- Size ------------------------------------------------------------------
 *
 * One key per `config.size.fields[].param`; a key absent from the object, or
 * present with `null`, constrains nothing.
 */

type SizeFilter = Readonly<Record<string, string | null>>;

const NO_SIZE: SizeFilter = {};

function hasSize(size: SizeFilter): boolean {
  return Object.values(size).some((value) => value !== null);
}

/**
 * D48(4): a vehicle in the URL with every size select still at `Any` borrows
 * a size from the PLACEHOLDER fitment map beside the finder seed
 * (`src/features/finder/data.ts`, sample data — year is ignored there). An
 * unmapped vehicle resolves to no size, so the page behaves exactly as it
 * does with no vehicle at all.
 *
 * Per category, because a car determines different things for different
 * goods (owner, 2026-09-21): **tires** derive `width`/`profile`/`rim`
 * straight off the fitment entry; **wheels** derive `bolt` only — diameter
 * and width are the buyer's choice, not the car's; **accessories** derive no
 * size at all and narrow on the lug thread instead (D67), below.
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

/** A select's value as the number its column holds, or `undefined` for `Any`
 *  and for anything that is not a number (the query layer drops those too). */
function numeric(value: string | null | undefined): number | undefined {
  if (value === null || value === undefined || value.trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * The URL's filters as the catalogue reads them.
 *
 * Accessories and a vehicle (D67): an accessory has no size, but lug nuts and
 * wheel locks thread onto the car's studs, so the vehicle's thread is what
 * narrows them. The rule is asymmetric on purpose and lives in
 * `queries.ts` `contradictsThread()`: a product is demoted to `similar` only
 * when it STATES a different thread. Stating nothing keeps it a best match.
 * TPMS frequency, the other half of D67, is not a column in the catalogue, so
 * a sensor states nothing and stays a best match.
 */
function catalogFilters(
  query: ResultsQuery,
  size: SizeFilter,
  fit: FitmentSize | null,
  price: PriceFacet,
): ProductFilters {
  return {
    category: query.category,
    brands: query.brands,
    /* A bound parked at the end of the slider is not a filter, and must not
       be sent as one. The rail's form posts both range inputs on every
       change, so `?min=60&max=2710` rides along with any other filter; a
       price bound excludes products with no price, and those would silently
       vanish the moment a buyer ticked a brand. */
    priceMin: price.selectedMin > price.min ? price.selectedMin : undefined,
    priceMax: price.selectedMax < price.max ? price.selectedMax : undefined,
    tire: {
      width: numeric(size.width),
      aspectRatio: numeric(size.profile),
      rimDiameter: numeric(size.rim),
      seasons: query.category === "tires" ? query.chips.map(seasonFromParam) : [],
    },
    wheel: {
      diameter: numeric(size.diameter),
      width: numeric(size.width),
      boltPattern: size.bolt ?? undefined,
    },
    accessory: {
      kinds:
        query.category === "accessories"
          ? query.chips.map(accessoryFromParam)
          : [],
      thread: fit?.thread,
    },
  };
}

/* --- Facets --------------------------------------------------------------- */

function sizeOptions(
  values: ReadonlyArray<number | string>,
  labelPrefix: string,
): SizeOption[] {
  return values.map((value) => ({
    value: String(value),
    label: `${labelPrefix}${value}`,
  }));
}

function buildSizeGroup(
  query: ResultsQuery,
  catalog: CatalogFacets,
): Facets["sizeGroup"] {
  const config = CATEGORY_CONFIG[query.category].size;
  if (config === null) return null;
  /* Keyed by the category's own param names, in the order `categories.ts`
     draws them. */
  const values: Record<string, ReadonlyArray<number | string>> = {
    ...(catalog.tire && {
      width: catalog.tire.widths,
      profile: catalog.tire.aspectRatios,
      rim: catalog.tire.rimDiameters,
    }),
    ...(catalog.wheel && {
      diameter: catalog.wheel.diameters,
      width: catalog.wheel.widths,
      bolt: catalog.wheel.boltPatterns,
    }),
  };
  return {
    label: config.label,
    fields: config.fields.map((field) => ({
      param: field.param,
      caption: field.caption,
      options: sizeOptions(values[field.param] ?? [], field.labelPrefix ?? ""),
      value: query.size[field.param] ?? null,
    })),
    dense: config.dense ?? false,
  };
}

/** The category's full chip list, each with the count the catalogue reports
 *  for it (0 when it reports none), so a chip never disappears as filters
 *  change (D42). */
function buildChipGroup(
  query: ResultsQuery,
  catalog: CatalogFacets,
): Facets["chipGroup"] {
  const config = CATEGORY_CONFIG[query.category].chips;
  if (config === null) return null;
  const counts = new Map<string, number>([
    ...(catalog.tire?.seasons ?? []).map(
      (row) => [seasonParam(row.value), row.count] as const,
    ),
    ...(catalog.accessory?.kinds ?? []).map(
      (row) => [accessoryParam(row.value), row.count] as const,
    ),
  ]);
  return {
    label: config.label,
    param: config.param,
    options: config.options.map((option) => ({
      value: option.value,
      label: option.label,
      count: counts.get(option.value) ?? 0,
      selected: query.chips.includes(option.value),
    })),
  };
}

/** Most products first, then A to Z: the rail shows the first few and folds
 *  the rest behind `Show all brands` (D108). A selected brand the current
 *  filters leave with no products still gets its row, reading 0, so a ticked
 *  box never vanishes. */
function buildBrands(query: ResultsQuery, catalog: CatalogFacets): FacetOption[] {
  const rows = new Map(catalog.brands.map((row) => [row.value, row.count]));
  for (const brand of query.brands) {
    if (!rows.has(brand)) rows.set(brand, 0);
  }
  return [...rows]
    .map(([brand, count]) => ({
      value: brand,
      label: brand,
      count,
      selected: query.brands.includes(brand),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Catalogue bounds rounded outward to $10, and the active range clamped into
 *  them — computed, never typed (D42). A category with nothing priced reads
 *  $0 to $0. */
function buildPrice(
  query: ResultsQuery,
  bounds: CatalogFacets["price"],
): PriceFacet {
  const min = Math.floor((bounds.min ?? 0) / 10) * 10;
  const max = Math.ceil((bounds.max ?? 0) / 10) * 10;
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
 *  at either end is not a filter. A size lent by the vehicle is not counted:
 *  it is not something the buyer set in the rail. */
function countActiveGroups(query: ResultsQuery, price: PriceFacet): number {
  const priceActive =
    (query.priceMin !== null && price.selectedMin !== price.min) ||
    (query.priceMax !== null && price.selectedMax !== price.max);
  return [
    hasSize(query.size),
    query.chips.length > 0,
    query.brands.length > 0,
    priceActive,
  ].filter(Boolean).length;
}

function buildFacets(
  query: ResultsQuery,
  catalog: CatalogFacets,
  price: PriceFacet,
): Facets {
  return {
    category: query.category,
    sizeGroup: buildSizeGroup(query, catalog),
    chipGroup: buildChipGroup(query, catalog),
    brands: buildBrands(query, catalog),
    price,
    priceLabel: CATEGORY_CONFIG[query.category].priceLabel,
    activeGroups: countActiveGroups(query, price),
  };
}

/* --- Search -------------------------------------------------------------- */

export async function searchResults(
  category: ProductCategory,
  params: RawSearchParams,
): Promise<ResultsView> {
  const query = parseResultsQuery(category, params);

  /* The vehicle's placeholder fitment entry, read once (D48(4)). `null` for
     no vehicle and for a vehicle the map does not cover. */
  const fit =
    query.vehicle === null
      ? null
      : findFitment(query.vehicle.make, query.vehicle.model);

  /* An explicit size in the URL always wins; otherwise a vehicle may lend
     one, mapped per category (D48(4)). `query` is NOT mutated: the rail's
     size selects stay `Any`, because a derived fitment is not a user filter. */
  const size = hasSize(query.size) ? query.size : fitmentSize(category, fit);

  /* The price bounds come first: whether the URL's `min` / `max` is a filter
     at all depends on where the slider's ends are. One indexed aggregate. */
  const price = buildPrice(query, await getPriceBounds(category));
  const filters = catalogFilters(query, size, fit, price);

  /* Something narrows when a size is in play, or when a vehicle's thread is
     (accessories). With nothing narrowing, every match is a best match and
     the similar row does not render (D47(8)), so it is not even asked for. */
  const narrows = hasSize(size) || (category === "accessories" && fit !== null);
  const expanded = query.show > RESULTS_WINDOW.best;

  const [best, similar, catalog] = await Promise.all([
    listProducts({ ...filters, sort: query.sort, limit: query.show }),
    narrows
      ? listProducts({
          ...filters,
          sizeMatch: "near",
          sort: query.sort,
          limit: expanded
            ? RESULTS_WINDOW.similarExpanded
            : RESULTS_WINDOW.similar,
        })
      : { items: [], total: 0 },
    getFacets(filters),
  ]);

  return {
    query,
    facets: buildFacets(query, catalog, price),
    best: best.items.map(toProduct),
    similar: similar.items.map(toProduct),
    bestTotal: best.total,
    similarTotal: similar.total,
    total: best.total + similar.total,
  };
}
