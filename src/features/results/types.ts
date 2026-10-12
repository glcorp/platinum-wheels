/**
 * Results contract — written by the coordinator before any component so the
 * build agents code against one shape (D25). `query.ts` implements the URL
 * half (pure, client-safe); `search.ts` the server half (reads the database);
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
 * so every URL, probe and parity row on the built `/tires` still holds.
 */

import type { Product, ProductCategory } from "@/features/catalog/types";
import type { PartialVehicle } from "@/features/finder/data";
import { PRICES_VISIBLE } from "@/lib/site";

/* --- Sort --------------------------------------------------------------- */

export type SortKey = "best" | "price-asc" | "price-desc";

/** Option labels are new copy (D47): short, declarative, `.claude/rules/ui.md`
 *  "Copy". `Best match` is artboard-verbatim (results-desktop.html:117). */
const ALL_SORTS: ReadonlyArray<{ value: SortKey; label: string }> = [
  { value: "best", label: "Best match" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

/** With prices switched off (D122) the two price sorts go: a hidden price
 *  must not order the page either. `Best match` alone is no choice, so the
 *  sort control is not rendered at all (`HAS_SORT_CHOICE`). */
export const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; label: string }> = PRICES_VISIBLE
  ? ALL_SORTS
  : ALL_SORTS.filter((option) => option.value === "best");

export const HAS_SORT_CHOICE = SORT_OPTIONS.length > 1;

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
  /** `?similar=12`: how many `May also fit` cards to render (D175). */
  similar: "similar",
  /** `?brands=all`: the brand fold is open (D132). */
  brands: "brands",
} as const;

/** The one value `RESULTS_PARAM.brands` takes. Anything else is no param. */
export const ALL_BRANDS = "all";

export interface ResultsQuery {
  /** Which route this query belongs to. Carried, never serialised: the
   *  category IS the route (D58). */
  category: ProductCategory;
  /** Present only when all three finder params are present. Feeds the chip,
   *  the title, and — via the placeholder fitment map — the best/similar
   *  split (D48). */
  vehicle: Vehicle | null;
  /**
   * A part-filled finder submit (Year and Make without a Model, say), when
   * `vehicle` is `null` (LA-05 P2, D145 audit). The toolbar opens its finder
   * with these kept and a prompt for the rest instead of dropping them
   * silently. Never serialised, never a filter, and only ever the finder
   * list's own strings (`finder/data.ts` `partialVehicle`). Optional so a
   * query built by hand (`clearFilters`) need not name it.
   */
  partialVehicle?: PartialVehicle | null;
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
  /**
   * The extra groups (owner, 2026-10-03; `categories.ts` `ExtraGroupId`). Each
   * is read only on the category that draws it and is empty / `null` on the
   * others, so a stray `bore=66.6` on `/tires` is no filter and no badge.
   */
  /** Tires: `load=98`, the lowest load index wanted, as the option spells it. */
  loadMin: string | null;
  /** Wheels: `bore=66.6`, one centre bore in mm, as the option spells it. */
  bore: string | null;
  /** Wheels: `offset_min` / `offset_max`, mm, signed, inclusive. */
  offsetMin: number | null;
  offsetMax: number | null;
  /** Wheels: `finish=...`, finish families as the catalogue spells them. */
  finishes: readonly string[];
  /** Accessories: `thread=...`, lug thread sizes as the catalogue spells them.
   *  Only meaningful while the type filter holds a threaded type. */
  threads: readonly string[];
  /** Whole dollars, inclusive. `null` = bound not set. */
  priceMin: number | null;
  priceMax: number | null;
  sort: SortKey;
  /**
   * `?show=30` — how many best matches to render. `RESULTS_WINDOW.best` by
   * default; each `Load more` adds `RESULTS_WINDOW.step`, up to
   * `RESULTS_WINDOW.max` (D44, D108b). The old `?show=all` reads as the
   * maximum: with a real catalogue "all" can be thousands of cards.
   */
  show: number;
  /**
   * `?similar=12` — how many `May also fit` cards to render (D175).
   * `RESULTS_WINDOW.similar` (one desktop row) by default; the list's own
   * `Show more` opens it to `RESULTS_WINDOW.similarExpanded`, then adds
   * `RESULTS_WINDOW.step` a press, up to `RESULTS_WINDOW.max`. Independent of
   * `show`: best's `Load more` never grows this list, and this never grows best.
   */
  similarShow: number;
  /**
   * `?brands=all` — the visitor had `Show all brands` open when they last
   * changed a filter, so the fold renders open again (D132). The form is
   * keyed on the URL and re-mounts on every change, so the fold would
   * otherwise close each time. A view state, not a filter: never counted in
   * `Filters (n)`, never sent to the catalogue. The fold also opens on its
   * own, without this, when a ticked brand sits outside the first
   * `BRAND_WINDOW` (`filter-panel.tsx`).
   */
  allBrands: boolean;
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

/** One extra group, ready to render. Components branch on `kind`, never on the
 *  category (the rule in `results/llm.md`). `id` is the stable key and the
 *  prefix of the control ids. */
export type ExtraFacet =
  | {
      kind: "select";
      id: string;
      label: string;
      caption: string;
      param: string;
      /** `Any` is implicit. */
      options: readonly SizeOption[];
      value: string | null;
    }
  | {
      kind: "range";
      id: string;
      label: string;
      paramMin: string;
      paramMax: string;
      /** `mm`. */
      unit: string;
      min: number;
      max: number;
      selectedMin: number;
      selectedMax: number;
    }
  | {
      kind: "checks";
      id: string;
      label: string;
      param: string;
      options: readonly FacetOption[];
    };

export interface Facets {
  category: ProductCategory;
  /**
   * The size group, or `null` when the category draws none (accessories).
   *
   * There is no `categories` facet: the drawn `Category` group is not built
   * (`design/DEVIATIONS.md` #60, owner, 2026-09-22). It was cross-category
   * navigation, not a filter — it set no param and never reached
   * `activeGroups` — so its removal moves no count and no result. The three
   * category routes are reached from the site header nav and the footer.
   */
  sizeGroup: {
    /** `Tire size` / `Wheel size` — the group label. */
    label: string;
    fields: readonly SizeFieldFacet[];
    /** Uneven column grid + tighter select padding (`categories.ts`
     *  `CategoryConfig.size.dense`) — wheels only, for the bolt-pattern
     *  clip (`design/DEVIATIONS.md` #67). */
    dense: boolean;
  } | null;
  /** The chip row: `Season` / `Type`, or `null` on wheels, which have none
   *  (D105b). Counts may be 0; options are the category's full list. */
  chipGroup: {
    label: string;
    param: string;
    options: readonly FacetOption[];
  } | null;
  /** The extra groups the category draws, in panel order, between the chip
   *  row and Brand. A group with nothing to offer is left out. */
  extras: readonly ExtraFacet[];
  /** Every brand with a product in this category, most products first. The
   *  rail shows the first `BRAND_WINDOW` and folds the rest away (D108b). */
  brands: readonly FacetOption[];
  price: PriceFacet;
  /** `Price per tire` / `Price per wheel` / `Price per item`. */
  priceLabel: string;
  /** Groups with an active filter — size, chips, extras, brand, price — for `Filters (n)`. */
  activeGroups: number;
}

/* --- View ---------------------------------------------------------------- */

/**
 * How many cards render before `Load more` (D47): the artboard's own 6 + 3
 * (results-desktop.html §1.6–1.7). One window at every width, every category.
 *
 * `step`, `max` and `similarExpanded` are D108b: `Load more` used to reveal
 * everything, which was nine cards in the seed and is thousands now. It adds
 * `step` best matches per press up to `max`; the similar row opens from 3 to
 * `similarExpanded` on the first press.
 */
export const RESULTS_WINDOW = {
  best: 6,
  similar: 3,
  step: 24,
  max: 150,
  similarExpanded: 12,
} as const;

/** Brand rows shown before `Show all brands` (D108b). */
export const BRAND_WINDOW = 8;

export interface ResultsView {
  query: ResultsQuery;
  facets: Facets;
  /**
   * The cards to render, already windowed by `query.show`: the database
   * returns one page, never the whole list. `best` = every size part given
   * matches (or everything, when no size is given); `similar` = sizes close to
   * the one asked for, never the size itself, and empty when none is given.
   */
  best: readonly Product[];
  similar: readonly Product[];
  /**
   * The bolt patterns of a vehicle whose model year came with two or more,
   * when the vehicle is what narrows the wheels (`/wheels`, no explicit size);
   * empty otherwise. Wheels for every one of them are listed, and the page
   * tells the buyer to check their trim (D155).
   */
  boltChoice: readonly string[];
  /** How many products each list holds in all, of which the arrays above are
   *  the first few. `N matches · M similar`. */
  bestTotal: number;
  similarTotal: number;
  /** `bestTotal + similarTotal`. Zero = the empty state. */
  total: number;
}

/** The vehicle sheet's `id` (D159). Every `#vehicle-sheet` link opens it. Here,
 *  not in the client island, so the server-rendered buttons can read it. */
export const VEHICLE_SHEET_ID = "vehicle-sheet";
