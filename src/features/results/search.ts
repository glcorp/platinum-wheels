/**
 * Server half of the results contract: ask the catalogue for one page of
 * matches, the similar sizes beneath them, and the facets beside them. Reads
 * the database, so it is never imported from a `"use client"` file.
 *
 * Serves three routes — `/tires` (tires), `/wheels`, `/accessories` (D58) —
 * off one function, `searchResults(category, params)`. Everything
 * category-specific comes from `CATEGORY_CONFIG`
 * (`@/features/catalog/categories`); filtering, counting and sorting are SQL
 * (`@/features/catalog/queries`). Every number this file returns is computed
 * from the catalogue — facet counts, the match count, `Filters (n)` and the
 * price bounds (D42). No artboard number ships as a count.
 *
 * What changed when the seed went (D108b), because nine products and forty-five
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
import {
  CATEGORY_CONFIG,
  EXTRA_COPY,
  EXTRA_PARAM,
  THREADED_ACCESSORY_TYPES,
} from "@/features/catalog/categories";
import {
  getExtraValues,
  getFacets,
  getPriceBounds,
  getBrands,
  listProducts,
  type StorefrontFacets,
  type TireSizeOptions,
  type WheelSizeOptions,
} from "@/features/catalog/queries";
import type { ProductCategory } from "@/features/catalog/types";
import { findFitment, type VehicleFitment } from "@/features/finder/fitment";
import {
  parseResultsQuery,
  withOffsetBounds,
  withPriceBounds,
} from "./query";
import {
  RESULTS_WINDOW,
  type ExtraFacet,
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
 * A vehicle in the URL with every size select still at `Any` borrows a size
 * from `finder/fitment.ts` (LA-05, D145 audit). An unknown vehicle resolves to
 * no size, so the page behaves exactly as it does with no vehicle at all
 * (D110).
 *
 * Per category, because a car determines different things for different
 * goods (owner, 2026-09-21): **tires** derive `width`/`profile`/`rim` from the
 * D48(4) placeholder (owner, 2026-10-04: "Keep placeholder for tires");
 * **wheels** derive `bolt` only, real for the exact model year where the
 * ANKUSI data has it, else the placeholder; diameter and width are the
 * buyer's choice, not the car's; **accessories** derive no size at all and
 * narrow on the lug thread instead (D67), below.
 */
function fitmentSize(
  category: ProductCategory,
  fit: VehicleFitment | null,
): SizeFilter {
  if (fit === null) return NO_SIZE;
  switch (category) {
    case "tires":
      return fit.tireSize === null
        ? NO_SIZE
        : { width: fit.tireSize.width, profile: fit.tireSize.profile, rim: fit.tireSize.rim };
    case "wheels":
      return fit.boltPattern === null ? NO_SIZE : { bolt: fit.boltPattern };
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

/** The size parts as the catalogue reads them. One object serves both
 *  categories: only the block matching the category is read. */
function sizeFilters(size: SizeFilter): Pick<ProductFilters, "tire" | "wheel"> {
  return {
    tire: {
      width: numeric(size.width),
      aspectRatio: numeric(size.profile),
      rimDiameter: numeric(size.rim),
    },
    wheel: {
      diameter: numeric(size.diameter),
      width: numeric(size.width),
      boltPattern: size.bolt ?? undefined,
    },
  };
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
  fit: VehicleFitment | null,
  price: PriceFacet,
): ProductFilters {
  const { tire, wheel } = sizeFilters(size);
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
      ...tire,
      seasons: query.category === "tires" ? query.chips.map(seasonFromParam) : [],
      loadIndexMin: numeric(query.loadMin),
    },
    wheel: {
      ...wheel,
      offsetMin: query.offsetMin ?? undefined,
      offsetMax: query.offsetMax ?? undefined,
      centerBore: numeric(query.bore),
      finishes: query.finishes,
    },
    accessory: {
      kinds:
        query.category === "accessories"
          ? query.chips.map(accessoryFromParam)
          : [],
      thread: fit?.thread ?? undefined,
      threads: query.threads,
    },
  };
}

/* --- Facets --------------------------------------------------------------- */

/** One option of a size select before its display prefix: the URL value and
 *  the label. A flotation profile is written with two decimals, as the trade
 *  does (`12.50`), while its URL value is the plain number (`12.5`). */
interface RawSizeOption {
  value: string;
  label: string;
}

const plain = (value: number | string): RawSizeOption => ({
  value: String(value),
  label: String(value),
});

const twoDecimals = (value: number): RawSizeOption => ({
  value: String(value),
  label: value.toFixed(2),
});

/** Each size field's values, keyed by the category's own param names, in the
 *  order `categories.ts` draws them. Tires list the metric values first and
 *  the flotation ones after: Width = metric section width, then flotation
 *  overall diameter; Profile = aspect ratio, then flotation section width. */
function sizeValues(
  tire: TireSizeOptions | null,
  wheel: WheelSizeOptions | null,
): Record<string, readonly RawSizeOption[]> {
  return {
    ...(tire && {
      width: [...tire.widths, ...tire.flotationDiameters].map(plain),
      profile: [
        ...tire.aspectRatios.map(plain),
        ...tire.flotationSectionWidths.map(twoDecimals),
      ],
      rim: tire.rimDiameters.map(plain),
    }),
    ...(wheel && {
      diameter: wheel.diameters.map(plain),
      width: wheel.widths.map(plain),
      bolt: wheel.boltPatterns.map(plain),
    }),
  };
}

/**
 * The size selects. Each lists the values found together with the OTHER size
 * parts the buyer chose (D132, `queries.ts` "Size options"), read off the full
 * list so the order is the category's own. The field's own value is always
 * kept, even when the other parts would filter it out: a URL never silently
 * loses its own choice. Only a value the category does not hold at all is
 * dropped, and that is `withKnownSizes`' job, before this runs on the final
 * read.
 */
function buildSizeGroup(
  query: ResultsQuery,
  catalog: StorefrontFacets,
): Facets["sizeGroup"] {
  const config = CATEGORY_CONFIG[query.category].size;
  if (config === null) return null;
  const all = sizeValues(catalog.tire, catalog.wheel);
  const narrowed = sizeValues(catalog.sizeOptions.tire, catalog.sizeOptions.wheel);
  return {
    label: config.label,
    fields: config.fields.map((field) => {
      const value = query.size[field.param] ?? null;
      const offered = new Set((narrowed[field.param] ?? []).map((o) => o.value));
      const seen = new Set<string>();
      const options: SizeOption[] = [];
      for (const option of all[field.param] ?? []) {
        if (seen.has(option.value)) continue;
        if (!offered.has(option.value) && option.value !== value) continue;
        seen.add(option.value);
        options.push({
          value: option.value,
          label: `${field.labelPrefix ?? ""}${option.label}`,
        });
      }
      return {
        param: field.param,
        caption: field.caption,
        options,
        value,
      };
    }),
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
 *  the rest behind `Show all brands` (D108b). A selected brand the current
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

/* --- The extra groups ----------------------------------------------------
 *
 * Offset, centre bore, finish, load index and thread size (owner, 2026-10-03;
 * `categories.ts` `ExtraGroupId`). Each is built from the catalogue's own
 * values and counts, never typed, and is left out when it has nothing to
 * offer, so a thin category shows a shorter panel rather than an empty group.
 */

/** Offset bounds as the slider shows them: the catalogue's lowest and highest
 *  offset rounded outward to a whole mm. `null` = no wheel states an offset,
 *  or they all state the same one, so there is nothing to slide. */
function offsetBounds(catalog: CatalogFacets): { min: number; max: number } | null {
  const offset = catalog.wheel?.offset;
  if (!offset || offset.min === null || offset.max === null) return null;
  const min = Math.floor(offset.min);
  const max = Math.ceil(offset.max);
  return min < max ? { min, max } : null;
}

/** The checkbox rows of a checks group: the catalogue's rows with their
 *  counts, plus any ticked value the other filters leave at 0 (a ticked box
 *  never vanishes, as for brands). Most products first, then A to Z. */
function checkOptions(
  rows: ReadonlyArray<{ value: string; count: number }>,
  selected: readonly string[],
): FacetOption[] {
  const counts = new Map(rows.map((row) => [row.value, row.count]));
  for (const value of selected) {
    if (!counts.has(value)) counts.set(value, 0);
  }
  return [...counts]
    .map(([value, count]) => ({
      value,
      label: value,
      count,
      selected: selected.includes(value),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function buildExtras(query: ResultsQuery, catalog: CatalogFacets): ExtraFacet[] {
  const out: ExtraFacet[] = [];
  for (const id of CATEGORY_CONFIG[query.category].extras) {
    const copy = EXTRA_COPY[id];
    switch (id) {
      case "loadIndex": {
        const options = (catalog.tire?.loadIndexes ?? []).map((value) => ({
          value: String(value),
          label: `${value} or higher`,
        }));
        if (options.length > 0) {
          out.push({
            kind: "select",
            id,
            label: copy.label,
            caption: copy.caption ?? copy.label,
            param: EXTRA_PARAM.loadIndex,
            options,
            value: query.loadMin,
          });
        }
        break;
      }
      case "centerBore": {
        const options = (catalog.wheel?.centerBores ?? []).map((value) => ({
          value: String(value),
          label: `${value} mm`,
        }));
        if (options.length > 0) {
          out.push({
            kind: "select",
            id,
            label: copy.label,
            caption: copy.caption ?? copy.label,
            param: EXTRA_PARAM.centerBore,
            options,
            value: query.bore,
          });
        }
        break;
      }
      case "offset": {
        const bounds = offsetBounds(catalog);
        if (bounds !== null) {
          const clamp = (value: number) =>
            Math.min(Math.max(value, bounds.min), bounds.max);
          out.push({
            kind: "range",
            id,
            label: copy.label,
            paramMin: EXTRA_PARAM.offsetMin,
            paramMax: EXTRA_PARAM.offsetMax,
            unit: "mm",
            min: bounds.min,
            max: bounds.max,
            selectedMin: clamp(query.offsetMin ?? bounds.min),
            selectedMax: clamp(query.offsetMax ?? bounds.max),
          });
        }
        break;
      }
      case "finish": {
        const options = checkOptions(catalog.wheel?.finishes ?? [], query.finishes);
        if (options.length > 0) {
          out.push({
            kind: "checks",
            id,
            label: copy.label,
            param: EXTRA_PARAM.finish,
            options,
          });
        }
        break;
      }
      case "thread": {
        /* Only while the type filter holds a threaded type: a centre cap or a
           TPMS sensor has no thread to pick. */
        if (!query.chips.some((chip) => THREADED_ACCESSORY_TYPES.includes(chip))) {
          break;
        }
        const options = checkOptions(catalog.accessory?.threads ?? [], query.threads);
        if (options.length > 0) {
          out.push({
            kind: "checks",
            id,
            label: copy.label,
            param: EXTRA_PARAM.thread,
            options,
          });
        }
        break;
      }
    }
  }
  return out;
}

/** Is this extra group narrowing the list? Judged on what the visitor can
 *  see: a range counts only when a handle is off its end. */
function extraActive(extra: ExtraFacet): boolean {
  switch (extra.kind) {
    case "select":
      return extra.value !== null;
    case "range":
      return extra.selectedMin !== extra.min || extra.selectedMax !== extra.max;
    case "checks":
      return extra.options.some((option) => option.selected);
  }
}

/** `Filters (n)` on the mobile bar: groups carrying an active filter. Price
 *  counts only when a bound differs from the computed bound — a slider parked
 *  at either end is not a filter. A size lent by the vehicle is not counted:
 *  it is not something the buyer set in the rail. */
function countActiveGroups(
  query: ResultsQuery,
  price: PriceFacet,
  extras: readonly ExtraFacet[],
): number {
  const priceActive =
    (query.priceMin !== null && price.selectedMin !== price.min) ||
    (query.priceMax !== null && price.selectedMax !== price.max);
  return [
    hasSize(query.size),
    query.chips.length > 0,
    query.brands.length > 0,
    priceActive,
    ...extras.map(extraActive),
  ].filter(Boolean).length;
}

function buildFacets(
  query: ResultsQuery,
  catalog: StorefrontFacets,
  price: PriceFacet,
): Facets {
  const extras = buildExtras(query, catalog);
  return {
    category: query.category,
    sizeGroup: buildSizeGroup(query, catalog),
    chipGroup: buildChipGroup(query, catalog),
    extras,
    brands: buildBrands(query, catalog),
    price,
    priceLabel: CATEGORY_CONFIG[query.category].priceLabel,
    activeGroups: countActiveGroups(query, price, extras),
  };
}

/* --- Unknown values ------------------------------------------------------
 *
 * Drop what the page has no control for (D93b, QA WDG-07/08; carried across
 * the move to the database by D111). `parseResultsQuery` is pure and
 * catalogue-free, so it keeps `width=abc` and `brand=Nope`; left in the query
 * they counted as an active group (`Filters (1)`) and had no ticked box or
 * selected option a visitor could clear.
 */

/**
 * The price range clamped into the catalogue's bounds, a side sitting on its
 * bound dropped (`withPriceBounds`), and the brands settled against the
 * category's own list. A brand the category does not carry at all is dropped;
 * a known one takes the catalogue's spelling (so `brand=zeta` and `brand=Zeta`
 * are one filter and one href, D65), repeats collapsed. A brand the category
 * carries but the OTHER filters leave with no products is kept: `buildBrands`
 * gives it a row reading 0, so a ticked box never vanishes (D108b).
 */
function withKnownBrands(
  query: ResultsQuery,
  carried: readonly string[],
): ResultsQuery {
  const exact = new Set(carried);
  /* First spelling wins when the catalogue holds one brand in two cases. */
  const folded = new Map<string, string>();
  for (const brand of carried) {
    const key = brand.toLowerCase();
    if (!folded.has(key)) folded.set(key, brand);
  }
  const brands: string[] = [];
  for (const wanted of query.brands) {
    const canonical = exact.has(wanted)
      ? wanted
      : folded.get(wanted.toLowerCase());
    if (canonical !== undefined && !brands.includes(canonical)) {
      brands.push(canonical);
    }
  }
  const unchanged =
    brands.length === query.brands.length &&
    brands.every((brand, index) => brand === query.brands[index]);
  return unchanged ? query : { ...query, brands };
}

/**
 * A size value the category does not hold at all becomes `Any`. Checked
 * against the category's FULL lists, never the narrowed options (D132): a
 * value that exists, just not with the other parts chosen, stays. The lists
 * arrive with the facets, so this runs after the first read; it returns the
 * same object when every value is known, which is how the caller knows not to
 * read again.
 */
function withKnownSizes(
  query: ResultsQuery,
  catalog: CatalogFacets,
): ResultsQuery {
  const config = CATEGORY_CONFIG[query.category].size;
  if (config === null) return query;
  const all = sizeValues(catalog.tire, catalog.wheel);
  const size: Record<string, string | null> = { ...query.size };
  let changed = false;
  for (const field of config.fields) {
    const value = size[field.param];
    if (value === undefined || value === null) continue;
    if (!(all[field.param] ?? []).some((option) => option.value === value)) {
      size[field.param] = null;
      changed = true;
    }
  }
  return changed ? { ...query, size } : query;
}

/**
 * `finish=` and `thread=` against the category's own values, BEFORE the first
 * read (`getExtraValues`): a value the category does not carry is dropped, and
 * a known one takes the catalogue's spelling whatever its case, as for brands.
 * A value the category carries that the other filters leave with no products
 * is kept (its row reads 0, so a ticked box never vanishes).
 */
function settleChecks(wanted: readonly string[], carried: readonly string[]) {
  const exact = new Set(carried);
  const folded = new Map<string, string>();
  for (const value of carried) {
    const key = value.trim().replace(/\s+/g, " ").toLowerCase();
    if (!folded.has(key)) folded.set(key, value);
  }
  const out: string[] = [];
  for (const value of wanted) {
    const canonical = exact.has(value)
      ? value
      : folded.get(value.trim().replace(/\s+/g, " ").toLowerCase());
    if (canonical !== undefined && !out.includes(canonical)) out.push(canonical);
  }
  return out;
}

function withKnownChecks(
  query: ResultsQuery,
  carried: { finishes: readonly string[]; threads: readonly string[] },
): ResultsQuery {
  const finishes = settleChecks(query.finishes, carried.finishes);
  const threads = settleChecks(query.threads, carried.threads);
  const same = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((value, index) => value === b[index]);
  return same(finishes, query.finishes) && same(threads, query.threads)
    ? query
    : { ...query, finishes, threads };
}

/**
 * `load=`, `bore=` and the offset range against the catalogue's own values,
 * AFTER the first read (they arrive with the facets, like the size lists): a
 * load index or bore the category does not hold becomes `Any`; an offset
 * range is clamped into the catalogue's bounds with a handle parked on its end
 * dropped, as the price range is. Returns the same object when nothing needed
 * settling, which is how the caller knows not to read again.
 */
function withKnownExtras(
  query: ResultsQuery,
  catalog: CatalogFacets,
): ResultsQuery {
  let next = query;
  if (
    next.loadMin !== null &&
    !(catalog.tire?.loadIndexes ?? []).some((value) => String(value) === next.loadMin)
  ) {
    next = { ...next, loadMin: null };
  }
  if (
    next.bore !== null &&
    !(catalog.wheel?.centerBores ?? []).some((value) => String(value) === next.bore)
  ) {
    next = { ...next, bore: null };
  }
  /* No offset bounds (none stated, or all alike) leaves the slider undrawn, so
     a bound in the URL has no control to show it: drop both. */
  const bounds = offsetBounds(catalog) ?? { min: 0, max: 0 };
  return withOffsetBounds(next, bounds);
}

/* --- Search -------------------------------------------------------------- */

/** One read of the catalogue for a settled query: the two lists and the
 *  facets. `catalog` rides along so the caller can check the size values. */
async function readCatalogue(
  query: ResultsQuery,
  bounds: CatalogFacets["price"],
): Promise<{ view: ResultsView; catalog: StorefrontFacets }> {
  const { category } = query;

  /* The vehicle's fitment, read once: real bolt pattern for the model year
     where known, placeholder for the rest (`finder/fitment.ts`, LA-05).
     `null` for no vehicle and for a vehicle neither source covers. */
  const fit =
    query.vehicle === null
      ? null
      : findFitment(query.vehicle.year, query.vehicle.make, query.vehicle.model);

  /* An explicit size in the URL always wins; otherwise a vehicle may lend
     one, mapped per category (D48(4)). `query` is NOT mutated: the rail's
     size selects stay `Any`, because a derived fitment is not a user filter. */
  const size = hasSize(query.size) ? query.size : fitmentSize(category, fit);

  const price = buildPrice(query, bounds);
  const filters = catalogFilters(query, size, fit, price);

  /* Something narrows when a size is in play, or when a vehicle's thread is
     (accessories). With nothing narrowing, every match is a best match and
     the similar row does not render (D47(8)), so it is not even asked for. */
  const narrows = hasSize(size) || (category === "accessories" && (fit?.thread ?? null) !== null);
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
    /* The size options narrow on the buyer's own choice, `query.size`, not
       on `size`: a size lent by the vehicle is not shown in the selects, so
       it does not narrow them either (D132). */
    getFacets(filters, sizeFilters(query.size)),
  ]);

  return {
    catalog,
    view: {
      query,
      facets: buildFacets(query, catalog, price),
      best: best.items.map(toProduct),
      similar: similar.items.map(toProduct),
      bestTotal: best.total,
      similarTotal: similar.total,
      total: best.total + similar.total,
    },
  };
}

export async function searchResults(
  category: ProductCategory,
  params: RawSearchParams,
): Promise<ResultsView> {
  const asked = parseResultsQuery(category, params);

  /* The price bounds and the brand list come first: whether the URL's `min` /
     `max` and `brand` are filters at all depends on them. Two small reads,
     one an indexed aggregate. */
  const [bounds, carried, extraValues] = await Promise.all([
    getPriceBounds(category),
    getBrands(category),
    getExtraValues(category),
  ]);
  const { min, max } = buildPrice(asked, bounds);
  const settled = withKnownChecks(
    withKnownBrands(withPriceBounds(asked, { min, max }), carried),
    extraValues,
  );

  const first = await readCatalogue(settled, bounds);

  /* A size the selects do not offer was sent to the database as a filter.
     Read again without it: a hand-typed URL pays the second read, a link the
     page made never does. */
  const query = withKnownExtras(
    withKnownSizes(settled, first.catalog),
    first.catalog,
  );
  if (query === settled) return first.view;
  return (await readCatalogue(query, bounds)).view;
}
