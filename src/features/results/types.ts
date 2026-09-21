/**
 * Results contract — written by the coordinator before any component so the
 * three build agents code against one shape (D25). `query.ts` implements the
 * URL half (pure, client-safe); `search.ts` the server half (touches the seed).
 *
 * State is the URL (D44): a `ResultsQuery` is a parsed query string and nothing
 * else, and `resultsHref(query)` is its canonical serialisation. Form field
 * names equal the param names in `RESULTS_PARAM` so the no-JS `<form
 * method="get">` submit produces exactly the URL the island would push.
 */

import type { Product } from "@/features/catalog/types";

/* --- Sort --------------------------------------------------------------- */

export type SortKey = "best" | "price-asc" | "price-desc";

/** Option labels are new copy (D47): short, declarative, `.claude/rules/ui.md`
 *  "Copy". `Best match` is artboard-verbatim (results-desktop.html:117). */
export const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; label: string }> = [
  { value: "best", label: "Best match" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

export const DEFAULT_SORT: SortKey = "best";

/* --- Season -------------------------------------------------------------- */

/** Chip copy verbatim and in artboard order — results-desktop.html:135
 *  (`All-season` lowercase s, unlike the card badge `All-Season`). Values are
 *  the `ProductBadge` keys they filter on; `summer` has no seed product yet. */
export type SeasonKey = "all-season" | "winter" | "summer";

export const SEASON_OPTIONS: ReadonlyArray<{ value: SeasonKey; label: string }> = [
  { value: "all-season", label: "All-season" },
  { value: "winter", label: "Winter" },
  { value: "summer", label: "Summer" },
];

/* --- Query --------------------------------------------------------------- */

/** From the finder's GET submit (`src/features/finder/components/vehicle-finder.tsx`). */
export interface Vehicle {
  year: string;
  make: string;
  model: string;
}

/** Query-string param names. Also the `name` of each form control. */
export const RESULTS_PARAM = {
  year: "year",
  make: "make",
  model: "model",
  width: "width",
  profile: "profile",
  rim: "rim",
  season: "season",
  brand: "brand",
  min: "min",
  max: "max",
  sort: "sort",
  show: "show",
} as const;

export interface ResultsQuery {
  /** Present only when all three finder params are present. Filters nothing
   *  today (no fitment data, root llm.md §7.13); feeds the chip and title. */
  vehicle: Vehicle | null;
  /** Tire size parts as the seed writes them: `215`, `55`, `16` (rim without
   *  the `R`). `null` = `Any`. */
  width: string | null;
  profile: string | null;
  rim: string | null;
  /** Empty = no season filter. */
  seasons: readonly SeasonKey[];
  /** Brand names exactly as `Product.brand` spells them. Empty = no filter. */
  brands: readonly string[];
  /** Whole dollars, inclusive. `null` = bound not set. */
  priceMin: number | null;
  priceMax: number | null;
  sort: SortKey;
  /** `?show=all` — the `Load more` link (D44). */
  showAll: boolean;
}

/** `Record<string, string | string[] | undefined>` — what `PageProps` hands a page. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

/* --- Facets -------------------------------------------------------------- */

export interface FacetOption {
  value: string;
  label: string;
  /** Products this option would yield given every OTHER active filter (D42). */
  count: number;
  selected: boolean;
}

export interface SizeOption {
  /** Param value: `215` / `55` / `16`. */
  value: string;
  /** Display: `215` / `55` / `R16` (results-desktop.html:131 shows `R16`). */
  label: string;
}

export interface PriceFacet {
  /** Seed bounds rounded outward to $10 — computed, never typed (D42). */
  min: number;
  max: number;
  /** The active range: query bounds clamped to `min`/`max`, or the bounds. */
  selectedMin: number;
  selectedMax: number;
}

export interface Facets {
  /** Count on the `Tires` category row. Wheels / Accessories carry none. */
  tireCount: number;
  sizes: {
    widths: readonly SizeOption[];
    profiles: readonly SizeOption[];
    rims: readonly SizeOption[];
  };
  /** Always the three `SEASON_OPTIONS`, in order, counts may be 0. */
  seasons: readonly FacetOption[];
  /** Every brand present in the seed, in seed order of first appearance. */
  brands: readonly FacetOption[];
  price: PriceFacet;
  /** Groups with an active filter — size, season, brand, price — for `Filters (n)`. */
  activeGroups: number;
}

/* --- View ---------------------------------------------------------------- */

/** How many cards render before `Load more` (D47): the artboard's own 6 + 3
 *  (results-desktop.html §1.6–1.7). One window at every width. */
export const RESULTS_WINDOW = { best: 6, similar: 3 } as const;

export interface ResultsView {
  query: ResultsQuery;
  facets: Facets;
  /** Full lists after filter + sort; the grid applies `RESULTS_WINDOW` unless
   *  `query.showAll`. `best` = every size part given matches; `similar` = the
   *  rest of the filtered set when any size part is given, else empty. */
  best: readonly Product[];
  similar: readonly Product[];
  /** `best.length + similar.length` — `N matches · M similar` and `Show N matches`. */
  total: number;
}
