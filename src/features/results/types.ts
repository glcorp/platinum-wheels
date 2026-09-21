/**
 * Results contract — written by the coordinator before any component so the
 * build agents code against one shape (D25). `query.ts` implements the URL
 * half (pure, client-safe); `search.ts` the server half (touches the seed);
 * `@/features/catalog/categories` holds the per-category table that makes one
 * page serve three routes (D58).
 *
 * State is the URL (D44): a `ResultsQuery` is a parsed query string and nothing
 * else, and `resultsHref(query)` is its canonical serialisation. Form field
 * names equal the param names in `RESULTS_PARAM` and in the category's own
 * `SizeFieldConfig.param` / `ChipGroupConfig.param`, so the no-JS
 * `<form method="get">` submit produces exactly the URL the island would push.
 * The category table lives in `@/features/catalog/categories` (D37).
 *
 * **Tires are unchanged.** `category` is carried, not serialised — each
 * category has its own route (D58) — and the tire category's params are the
 * measured `width` / `profile` / `rim` / `season`, emitted in the same order,
 * so every URL, probe and parity row on the built `/results` still holds.
 */

import type { Product, ProductCategory } from "@/features/catalog/types";

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

/* --- Query --------------------------------------------------------------- */

/** From the finder's GET submit (`src/features/finder/components/vehicle-finder.tsx`). */
export interface Vehicle {
  year: string;
  make: string;
  model: string;
}

/**
 * Param names shared by all three categories. The size-select and chip params
 * are NOT here: they differ per category and live in `categories.ts`
 * (`SizeFieldConfig.param`, `ChipGroupConfig.param`), which is the only place
 * that knows a tire filters on `rim` and a wheel on `bolt`.
 */
export const RESULTS_PARAM = {
  year: "year",
  make: "make",
  model: "model",
  brand: "brand",
  min: "min",
  max: "max",
  sort: "sort",
  show: "show",
} as const;

export interface ResultsQuery {
  /** Which route this query belongs to. Carried, never serialised: the
   *  category IS the route (D58). */
  category: ProductCategory;
  /** Present only when all three finder params are present. Feeds the chip,
   *  the title, and — via the placeholder fitment map — the best/similar
   *  split (D48). */
  vehicle: Vehicle | null;
  /**
   * The three size selects, keyed by the category's own param names:
   * tires `width` / `profile` / `rim`, wheels `diameter` / `width` / `bolt`.
   * A key is present with `null` when its select reads `Any`. **Empty for
   * accessories**, which draw no size group.
   *
   * Values are the seed's own spelling, display prefixes stripped — a tire rim
   * is `16`, never `R16`, whichever the URL carried.
   */
  size: Readonly<Record<string, string | null>>;
  /**
   * The chip row's selections, in the category's own option order so two
   * spellings of the same filter serialise identically: season keys on tires,
   * finishes on wheels, types on accessories. Empty = no chip filter.
   */
  chips: readonly string[];
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
  /** Param value: `215` / `55` / `16`, `18` / `8.5` / `5x114.3`. */
  value: string;
  /** Display: `215` / `55` / `R16` (results-desktop.html:131 shows `R16`). */
  label: string;
}

/** One rendered size select: everything `SizeField` needs and nothing it does
 *  not. The panel never reaches into `categories.ts` for a caption. */
export interface SizeFieldFacet {
  param: string;
  caption: string;
  options: readonly SizeOption[];
  /** The current selection, or `null` for `Any`. */
  value: string | null;
}

export interface PriceFacet {
  /** Seed bounds rounded outward to $10 — computed, never typed (D42). */
  min: number;
  max: number;
  /** The active range: query bounds clamped to `min`/`max`, or the bounds. */
  selectedMin: number;
  selectedMax: number;
}

/** One row of the Category group. All three always render, in this order; the
 *  current one is marked and carries no link (D58 — the built page's `Tires`
 *  row behaves exactly as before, the other two now lead somewhere real). */
export interface CategoryFacet {
  category: ProductCategory;
  label: string;
  href: string;
  current: boolean;
  /**
   * Products in that category given this page's non-category filters, or
   * `null` when no count should render. Only the CURRENT category carries
   * one: the artboard draws a count on `Tires` alone
   * (`results-desktop.html:125`), and counting another category through
   * filters it does not share would be a number nobody can check (D42).
   */
  count: number | null;
}

export interface Facets {
  category: ProductCategory;
  /** The three Category rows, in drawn order. */
  categories: readonly CategoryFacet[];
  /** The size group, or `null` when the category draws none (accessories). */
  sizeGroup: {
    /** `Tire size` / `Wheel size` — the group label. */
    label: string;
    fields: readonly SizeFieldFacet[];
  } | null;
  /** The chip row: `Season` / `Finish` / `Type`. Always rendered; counts may
   *  be 0, and options are the category's full list, not just what is in stock. */
  chipGroup: {
    label: string;
    param: string;
    options: readonly FacetOption[];
  };
  /** Every brand present in this category's seed, in order of first appearance. */
  brands: readonly FacetOption[];
  price: PriceFacet;
  /** `Price per tire` / `Price per wheel` / `Price per item`. */
  priceLabel: string;
  /** Groups with an active filter — size, chips, brand, price — for `Filters (n)`. */
  activeGroups: number;
}

/* --- View ---------------------------------------------------------------- */

/** How many cards render before `Load more` (D47): the artboard's own 6 + 3
 *  (results-desktop.html §1.6–1.7). One window at every width, every category. */
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
