/**
 * URL half of the results contract — pure and client-safe (no seed import).
 * Signatures fixed by the coordinator; bodies implemented by the data agent.
 * See `types.ts` for the shapes and `llm.md` for the rules.
 *
 * State is the URL (D44), so this file is the whole state machine: a
 * `ResultsQuery` is what the query string says, `resultsHref()` is its one
 * canonical spelling, and the transforms below are the only ways a control
 * changes it. Nothing here throws — a hand-typed URL degrades to defaults
 * rather than to an error page.
 */

import { ROUTES } from "@/lib/routes";
import {
  DEFAULT_SORT,
  RESULTS_PARAM,
  SEASON_OPTIONS,
  SORT_OPTIONS,
  type RawSearchParams,
  type ResultsQuery,
  type SeasonKey,
  type SortKey,
} from "./types";

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

/** The seed writes rims bare (`16`), the rail labels them `R16`
 *  (results-desktop.html:131), so a URL may carry either spelling. */
function parseRim(raw: string | null): string | null {
  if (raw === null) return null;
  const stripped = raw.replace(/^[Rr]/, "").trim();
  return stripped === "" ? null : stripped;
}

/* --- Parse --------------------------------------------------------------- */

/** Parse `PageProps` search params (or a `URLSearchParams`) into a `ResultsQuery`.
 *  Unknown or malformed values fall back to the default; never throws. */
export function parseResultsQuery(params: RawSearchParams): ResultsQuery {
  const year = firstValue(params, RESULTS_PARAM.year);
  const make = firstValue(params, RESULTS_PARAM.make);
  const model = firstValue(params, RESULTS_PARAM.model);

  /* All three or none: a half-filled finder submit names no vehicle, and the
     chip and page title read off this one field (D47(5)). */
  const vehicle =
    year !== null && make !== null && model !== null
      ? { year, make, model }
      : null;

  /* Seasons in `SEASON_OPTIONS` order, not URL order, so two spellings of the
     same filter serialise identically and the chip row never reorders. */
  const selectedSeasons = new Set(uniqueValues(params, RESULTS_PARAM.season));
  const seasons: SeasonKey[] = SEASON_OPTIONS.filter((option) =>
    selectedSeasons.has(option.value),
  ).map((option) => option.value);

  /* Brands keep URL order: they come from the seed (D42), not a fixed list. */
  const brands = uniqueValues(params, RESULTS_PARAM.brand);

  let priceMin = parsePrice(firstValue(params, RESULTS_PARAM.min));
  let priceMax = parsePrice(firstValue(params, RESULTS_PARAM.max));
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
    vehicle,
    width: firstValue(params, RESULTS_PARAM.width),
    profile: firstValue(params, RESULTS_PARAM.profile),
    rim: parseRim(firstValue(params, RESULTS_PARAM.rim)),
    seasons,
    brands,
    priceMin,
    priceMax,
    sort,
    /* `?show=all` is the only `show` value; `Load more` is a link (D44). */
    showAll: firstValue(params, RESULTS_PARAM.show) === "all",
  };
}

/* --- Serialise ----------------------------------------------------------- */

/** Canonical `/results?...` for a query. Params in `RESULTS_PARAM` order,
 *  defaults omitted (`sort=best`, `show`), so equal queries give equal hrefs. */
export function resultsHref(query: ResultsQuery): string {
  const search = new URLSearchParams();

  const append = (key: string, value: string | null) => {
    if (value !== null && value !== "") search.append(key, value);
  };

  /* `RESULTS_PARAM` key order, so a href never depends on how the query was
     built — the rail, the sheet and a no-JS GET submit all land on one URL. */
  append(RESULTS_PARAM.year, query.vehicle?.year ?? null);
  append(RESULTS_PARAM.make, query.vehicle?.make ?? null);
  append(RESULTS_PARAM.model, query.vehicle?.model ?? null);
  append(RESULTS_PARAM.width, query.width);
  append(RESULTS_PARAM.profile, query.profile);
  append(RESULTS_PARAM.rim, query.rim);
  for (const season of query.seasons) search.append(RESULTS_PARAM.season, season);
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
  if (query.showAll) search.append(RESULTS_PARAM.show, "all");

  const serialised = search.toString();
  return serialised === "" ? ROUTES.results : `${ROUTES.results}?${serialised}`;
}

/* --- Transforms ---------------------------------------------------------- */

/** Same query with every filter cleared; keeps `vehicle` and `sort`. `Clear all`. */
export function clearFilters(query: ResultsQuery): ResultsQuery {
  return {
    vehicle: query.vehicle,
    width: null,
    profile: null,
    rim: null,
    seasons: [],
    brands: [],
    priceMin: null,
    priceMax: null,
    sort: query.sort,
    showAll: false,
  };
}

/** Same query with a different sort; drops `showAll`. */
export function withSort(query: ResultsQuery, sort: SortKey): ResultsQuery {
  return { ...query, sort, showAll: false };
}

/** Same query with `showAll: true` — the `Load more` href. */
export function withShowAll(query: ResultsQuery): ResultsQuery {
  return { ...query, showAll: true };
}
