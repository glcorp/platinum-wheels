/**
 * URL half of the results contract — pure and client-safe (no seed import).
 *
 * State is the URL (D44), so this file is the whole state machine: a
 * `ResultsQuery` is what the query string says, `resultsHref()` is its one
 * canonical spelling, and the transforms below are the only ways a control
 * changes it. Nothing here throws — a hand-typed URL degrades to defaults
 * rather than to an error page.
 *
 * **Category is an argument, not a param (D58).** The category IS the route —
 * `/tires` is tires, `/wheels` is wheels, `/accessories` is accessories —
 * so `parseResultsQuery` takes it from the caller (the page, which knows its
 * own route) rather than reading it off the query string, and `resultsHref`
 * serialises against `CATEGORY_CONFIG[query.category].route` instead of a
 * hard-coded `/tires`. Everything category-specific — which size fields
 * exist, their param names and `strip` regexes, the chip group's param and
 * option order — comes from `@/features/catalog/categories`, which (like this
 * file) imports no seed data and stays safe for `filter-panel.tsx`, a
 * `"use client"` island, to import. It also imports `isFinderVehicle` from
 * `@/features/finder/data` (D91b): placeholder vehicle data, no product seed,
 * so the islands that import this file carry the finder list (a few KB).
 *
 * **Tires are unchanged.** The tires row of `CATEGORY_CONFIG` reproduces the
 * measured param names (`width` / `profile` / `rim` / `season`) and the
 * measured serialisation order, so every URL, probe and parity row on the
 * built `/tires` still holds byte-for-byte.
 */

import {
  CATEGORY_CONFIG,
  EXTRA_PARAM,
  THREADED_ACCESSORY_TYPES,
  type SizeFieldConfig,
} from "@/features/catalog/categories";
import {
  canonicalSizeNumber,
  normalizeBoltPattern,
} from "@/features/catalog/size";
import type { ProductCategory } from "@/features/catalog/types";
import { isFinderVehicle } from "@/features/finder/data";
import {
  ALL_BRANDS,
  DEFAULT_SORT,
  RESULTS_PARAM,
  RESULTS_WINDOW,
  SORT_OPTIONS,
  type RawSearchParams,
  type ResultsQuery,
  type SortKey,
} from "./types";
import { PRICES_VISIBLE } from "@/lib/site";

/* --- Reading raw params -------------------------------------------------- */

/** Every value for a key. Next hands repeated params as an array, but a
 *  comma-free single value stays a string, and the sheet and the rail render
 *  the same control twice — so both shapes have to work (D44). */
function values(params: RawSearchParams, key: string): string[] {
  const raw = params[key];
  if (raw === undefined) return [];
  return Array.isArray(raw) ? raw : [raw];
}

/** First value, trimmed; `null` when missing or blank. */
function firstValue(params: RawSearchParams, key: string): string | null {
  for (const value of values(params, key)) {
    const trimmed = value.trim();
    if (trimmed !== "") return trimmed;
  }
  return null;
}

/** Non-empty trimmed values, de-duplicated, order preserved. */
function uniqueValues(params: RawSearchParams, key: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values(params, key)) {
    const trimmed = value.trim();
    if (trimmed === "" || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/** Whole dollars, `>= 0`. Anything else (cents, letters, `-5`) is no bound. */
function parsePrice(raw: string | null): number | null {
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/** One size field's value off the URL: `field.strip` (tires' rim: `R16` and
 *  `16` both resolve to `16`) applied to the raw trimmed value, blank → `null`.
 *  Fields without a `strip` regex (everything but tires' rim) pass through. */
function parseSizeField(
  params: RawSearchParams,
  field: SizeFieldConfig,
): string | null {
  const raw = firstValue(params, field.param);
  if (raw === null) return null;
  const stripped = field.strip ? raw.replace(field.strip, "").trim() : raw;
  if (stripped === "") return null;
  /* The options are spelled one way (`17`, `8.5`, `5x114.3`), so a hand-typed
     `17.0`, `8.50`, `5X114.3`, `5×114.3` or `5x114.30` is put into it before it
     is compared with them. Text that is not a size at all passes through
     as typed and is turned into `Any` once the options are known
     (`search.ts` `withKnownSizes`). */
  const canonical =
    field.kind === "bolt"
      ? normalizeBoltPattern(stripped)
      : canonicalSizeNumber(stripped);
  return canonical ?? stripped;
}

/** An offset in mm: signed, at most two decimals. Anything else is no bound. */
function parseOffset(raw: string | null): number | null {
  if (raw === null || !/^-?\d{1,4}(?:\.\d{1,2})?$/.test(raw)) return null;
  const parsed = Number(raw);
  // `-0` would serialise as `0`; normalise it here so equal queries compare equal.
  return Object.is(parsed, -0) ? 0 : parsed;
}

/** A load index off the URL: up to three digits, `098` → `98`. */
function parseLoadIndex(raw: string | null): string | null {
  return raw !== null && /^\d{1,3}$/.test(raw) ? String(Number(raw)) : null;
}

/** No filter lists more values than this; a longer URL is hostile or pasted. */
const MAX_CHECKED = 24;

/* --- Parse ----------------------------------------------------------------
 */

/** Parse `PageProps` search params (or a `URLSearchParams`) into a
 *  `ResultsQuery` for `category`. Unknown or malformed values fall back to
 *  the default; never throws. */
/** `?show=30` → 30, clamped to the window's own bounds. `all` is the old
 *  spelling of "everything" and now means the maximum. */
function parseShow(raw: string | null): number {
  if (raw === "all") return RESULTS_WINDOW.max;
  if (raw === null || !/^\d{1,4}$/.test(raw)) return RESULTS_WINDOW.best;
  const parsed = Number.parseInt(raw, 10);
  return Math.min(Math.max(parsed, RESULTS_WINDOW.best), RESULTS_WINDOW.max);
}

export function parseResultsQuery(
  category: ProductCategory,
  params: RawSearchParams,
): ResultsQuery {
  const config = CATEGORY_CONFIG[category];

  const year = firstValue(params, RESULTS_PARAM.year);
  const make = firstValue(params, RESULTS_PARAM.make);
  const model = firstValue(params, RESULTS_PARAM.model);

  /* All three or none: a half-filled finder submit names no vehicle, and the
     chip and page title read off this one field (D47(5)). And only a vehicle
     the finder offers — anything else would be printed verbatim (D91b). */
  const vehicle =
    year !== null &&
    make !== null &&
    model !== null &&
    isFinderVehicle(year, make, model)
      ? { year, make, model }
      : null;

  /* One key per `config.size.fields[].param`, in field order. Empty for
     accessories, whose `config.size` is `null`. */
  const size: Record<string, string | null> = {};
  for (const field of config.size?.fields ?? []) {
    size[field.param] = parseSizeField(params, field);
  }

  /* Selected chip values, filtered and ordered by `config.chips.options`, not
     URL order — so two spellings of the same filter serialise identically and
     the chip row never reorders (today's season mechanism, generalised). */
  const selected = new Set(
    config.chips === null ? [] : uniqueValues(params, config.chips.param),
  );
  const chips = (config.chips?.options ?? [])
    .filter((option) => selected.has(option.value))
    .map((option) => option.value);

  /* Brands keep URL order: they come from the seed (D42), not a fixed list. */
  const brands = uniqueValues(params, RESULTS_PARAM.brand);

  /* The extra groups, each read only on the category that draws it. */
  const draws = (id: (typeof config.extras)[number]) => config.extras.includes(id);
  const loadMin = draws("loadIndex")
    ? parseLoadIndex(firstValue(params, EXTRA_PARAM.loadIndex))
    : null;
  const boreRaw = draws("centerBore")
    ? firstValue(params, EXTRA_PARAM.centerBore)
    : null;
  const bore = boreRaw === null ? null : canonicalSizeNumber(boreRaw);
  let offsetMin = draws("offset")
    ? parseOffset(firstValue(params, EXTRA_PARAM.offsetMin))
    : null;
  let offsetMax = draws("offset")
    ? parseOffset(firstValue(params, EXTRA_PARAM.offsetMax))
    : null;
  /* A crossed pair is a range, as for the price sliders. */
  if (offsetMin !== null && offsetMax !== null && offsetMin > offsetMax) {
    [offsetMin, offsetMax] = [offsetMax, offsetMin];
  }
  const finishes = draws("finish")
    ? uniqueValues(params, EXTRA_PARAM.finish).slice(0, MAX_CHECKED)
    : [];
  /* A thread size is only a filter while the type filter holds a threaded
     type: otherwise the group is not drawn and the badge would count a
     control nobody can see or clear. */
  const threadsDrawn =
    draws("thread") && chips.some((chip) => THREADED_ACCESSORY_TYPES.includes(chip));
  const threads = threadsDrawn
    ? uniqueValues(params, EXTRA_PARAM.thread).slice(0, MAX_CHECKED)
    : [];

  /* D122: with prices switched off a `min`/`max` in the URL is ignored, so a
     hand-typed range cannot filter by a price nobody can see. */
  let priceMin = PRICES_VISIBLE ? parsePrice(firstValue(params, RESULTS_PARAM.min)) : null;
  let priceMax = PRICES_VISIBLE ? parsePrice(firstValue(params, RESULTS_PARAM.max)) : null;
  /* Two `<input type="range">` sliders can cross (`docs/decisions.md` §5);
     a crossed pair is a range, not an empty set. */
  if (priceMin !== null && priceMax !== null && priceMin > priceMax) {
    [priceMin, priceMax] = [priceMax, priceMin];
  }

  const rawSort = firstValue(params, RESULTS_PARAM.sort);
  const sort: SortKey =
    SORT_OPTIONS.find((option) => option.value === rawSort)?.value ??
    DEFAULT_SORT;

  return {
    category,
    vehicle,
    size,
    chips,
    brands,
    loadMin,
    bore,
    offsetMin,
    offsetMax,
    finishes,
    threads,
    priceMin,
    priceMax,
    sort,
    /* `Load more` is a link that raises `show` (D44, D108b). */
    show: parseShow(firstValue(params, RESULTS_PARAM.show)),
    allBrands: firstValue(params, RESULTS_PARAM.brands) === ALL_BRANDS,
  };
}

/* --- Serialise ------------------------------------------------------------
 */

/** Canonical `<category route>?...` for a query. Param order: year, make,
 *  model, then each size field in `config.size.fields` order, then the chip
 *  param (repeated), then the extra groups (load, bore, offset_min,
 *  offset_max, finish*, thread*; none on tires but `load`), then brand
 *  (repeated), min, max, `sort` (omitted at the
 *  default), `show` (omitted at the default window) and `brands=all` (only
 *  while the brand fold is open, D132) — defaults omitted throughout, so equal
 *  queries give equal hrefs. For tires this is exactly today's order:
 *  year, make, model, width, profile, rim, season, brand, min, max, sort, show,
 *  brands. */
export function resultsHref(query: ResultsQuery): string {
  const config = CATEGORY_CONFIG[query.category];
  const search = new URLSearchParams();

  const append = (key: string, value: string | null) => {
    if (value !== null && value !== "") search.append(key, value);
  };

  append(RESULTS_PARAM.year, query.vehicle?.year ?? null);
  append(RESULTS_PARAM.make, query.vehicle?.make ?? null);
  append(RESULTS_PARAM.model, query.vehicle?.model ?? null);

  for (const field of config.size?.fields ?? []) {
    append(field.param, query.size[field.param] ?? null);
  }

  if (config.chips !== null) {
    for (const chip of query.chips) search.append(config.chips.param, chip);
  }
  /* The extra groups sit between the chip row and Brand, as in the panel.
     Every one is empty / `null` on a category that does not draw it. */
  append(EXTRA_PARAM.loadIndex, query.loadMin);
  append(EXTRA_PARAM.centerBore, query.bore);
  append(
    EXTRA_PARAM.offsetMin,
    query.offsetMin === null ? null : String(query.offsetMin),
  );
  append(
    EXTRA_PARAM.offsetMax,
    query.offsetMax === null ? null : String(query.offsetMax),
  );
  for (const finish of query.finishes) search.append(EXTRA_PARAM.finish, finish);
  for (const thread of query.threads) search.append(EXTRA_PARAM.thread, thread);
  for (const brand of query.brands) search.append(RESULTS_PARAM.brand, brand);

  append(
    RESULTS_PARAM.min,
    query.priceMin === null ? null : String(query.priceMin),
  );
  append(
    RESULTS_PARAM.max,
    query.priceMax === null ? null : String(query.priceMax),
  );

  if (query.sort !== DEFAULT_SORT) search.append(RESULTS_PARAM.sort, query.sort);
  if (query.show !== RESULTS_WINDOW.best) {
    search.append(RESULTS_PARAM.show, String(query.show));
  }
  /* Last, so every href without it is byte-identical to before D132. */
  if (query.allBrands) search.append(RESULTS_PARAM.brands, ALL_BRANDS);

  const serialised = search.toString();
  return serialised === "" ? config.route : `${config.route}?${serialised}`;
}

/* --- Transforms -------------------------------------------------------- */

/** Price bounds as the facet computes them — the seed's, rounded outward. */
export interface PriceBounds {
  min: number;
  max: number;
}

/**
 * Same query with the price range clamped into `bounds`, and a side that
 * lands exactly on its bound dropped (`null`). A slider parked at either end
 * is not a filter (`countActiveGroups`), and `resultsHref` promises defaults
 * omitted so equal queries give equal hrefs — but a range input always
 * submits both values, so every JS commit used to pin `min`/`max` at the
 * bounds (`?brand=Zeta&min=90&max=150`). Clamping (not just dropping) keeps
 * the filter and the handle in agreement for a hand-typed `min=999999`: the
 * handle can only sit at the ceiling, so the filter reads the ceiling too.
 * QA WDG-07.
 */
export function withPriceBounds(
  query: ResultsQuery,
  bounds: PriceBounds,
): ResultsQuery {
  const priceMin = settleBound(query.priceMin, bounds.min, bounds.min, bounds.max);
  const priceMax = settleBound(query.priceMax, bounds.max, bounds.min, bounds.max);
  if (priceMin === query.priceMin && priceMax === query.priceMax) return query;
  return { ...query, priceMin, priceMax };
}

/** A range bound clamped into `[lo, hi]`; one that lands exactly on `bound`
 *  (its own end of the slider) is dropped, because a slider parked there is
 *  not a filter. */
function settleBound(
  value: number | null,
  bound: number,
  lo: number,
  hi: number,
): number | null {
  if (value === null) return null;
  const clamped = Math.min(Math.max(value, lo), hi);
  return clamped === bound ? null : clamped;
}

/**
 * The same settling for the wheel offset slider, whose bounds are the
 * catalogue's lowest and highest offset rounded outward to a whole mm. The
 * rail posts both range inputs on every change, so without this every commit
 * would pin `offset_min` / `offset_max` at the ends, and a pinned end would
 * drop every wheel with no offset on record.
 */
export function withOffsetBounds(
  query: ResultsQuery,
  bounds: PriceBounds,
): ResultsQuery {
  const offsetMin = settleBound(query.offsetMin, bounds.min, bounds.min, bounds.max);
  const offsetMax = settleBound(query.offsetMax, bounds.max, bounds.min, bounds.max);
  if (offsetMin === query.offsetMin && offsetMax === query.offsetMax) return query;
  return { ...query, offsetMin, offsetMax };
}

/** Same query with every filter cleared; keeps `category`, `vehicle` and
 *  `sort`, and closes the brand fold. `Clear all`. Size keys stay present, all set to `null` — the
 *  selects still have something to read `Any` off of. */
export function clearFilters(query: ResultsQuery): ResultsQuery {
  const clearedSize: Record<string, string | null> = {};
  for (const key of Object.keys(query.size)) clearedSize[key] = null;

  return {
    category: query.category,
    vehicle: query.vehicle,
    size: clearedSize,
    chips: [],
    brands: [],
    loadMin: null,
    bore: null,
    offsetMin: null,
    offsetMax: null,
    finishes: [],
    threads: [],
    priceMin: null,
    priceMax: null,
    sort: query.sort,
    show: RESULTS_WINDOW.best,
    /* `Clear all` starts over: the brand fold closes too. */
    allBrands: false,
  };
}

/** Same query with a different sort; closes the window back to its default. */
export function withSort(query: ResultsQuery, sort: SortKey): ResultsQuery {
  return { ...query, sort, show: RESULTS_WINDOW.best };
}

/** Same query with one more step of best matches — the `Load more` href. */
export function withMore(query: ResultsQuery): ResultsQuery {
  return {
    ...query,
    show: Math.min(query.show + RESULTS_WINDOW.step, RESULTS_WINDOW.max),
  };
}
