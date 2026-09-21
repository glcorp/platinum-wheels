# src/features/results

## Purpose
The results engine and its sections — serving **three** routes since **D58** (2026-09-21): `/results`
(tires), `/wheels` and `/accessories`. One composition, one set of components, one query/search pair;
the only things that differ per category are the filter groups, the finder CTA and the seed, all read from
`src/features/catalog/categories.ts`. The owner's instruction was *"keep them same as tires. only
filters and skus change but everything else remains as it is"*, so there is deliberately **no** per-route
fork anywhere in this folder.

The page's own sections: toolbar, mobile sticky filter/sort bar, the filter rail (desktop) and sheet
(mobile), the best/similar grids with `Load more`, and the mobile call panel; the route file stays thin
(`docs/decisions.md` §3) and everything the artboards draw for `02 Results` lives here. The page is
**URL-driven** (D44): every filter, the sort and the load-more window are query params, the server
filters the seed and renders every state, and the only client code is the leaf islands that update the
URL. **The category is not a param** — it is the route, an argument to `parseResultsQuery()` /
`searchResults()` carried on `ResultsQuery`, never serialised (D58). Delete this folder and all three
category routes fall back to nothing.

## Owns
Built at `page results`, 2026-09-21. Measured sources: `design/inventory/results.md` §2–§4 and
`design/assets/results-{desktop,mobile,mobile-filters}.html`.
- [`types.ts`](types.ts) — the contract every file here codes against: `ResultsQuery`, `Facets`,
  `CategoryFacet`, `SizeFieldFacet`, `ResultsView`, `SORT_OPTIONS`, `RESULTS_WINDOW`, `RESULTS_PARAM`.
  Written by the coordinator before any component (D25), and rewritten by the coordinator again for D58.
  `RESULTS_PARAM` holds only the params **shared** by all three categories; the size-select and chip
  param names live in `catalog/categories.ts`, which is the one place that knows a tire filters on `rim`
  and a wheel on `bolt`. `ResultsQuery.size` is a `Record<param, string | null>` and `.chips` a string
  list, so nothing here is spelled in tire vocabulary.
- [`components/results-page.tsx`](components/results-page.tsx) — `ResultsPage({ category, searchParams })`,
  Server. The **entire** results composition, moved here verbatim from the old `results/page.tsx` so the
  three routes can share it (D58). Each `page.tsx` is now an export, a `metadata` object and one call.
- [`query.ts`](query.ts) — pure, client-safe: `parseResultsQuery()`, `resultsHref()`, `clearFilters()`.
  Param names double as form field names so a no-JS GET submit produces the same URL.
- [`search.ts`](search.ts) — server only: `searchResults()` filters, sorts and facets the catalog seed
  into a `ResultsView`. Imports `src/features/catalog/data.ts`; never imported by a client file. The
  best/similar split runs against an internal `SizeFilter`: an explicit URL size wins, otherwise a vehicle
  borrows one from the placeholder `FITMENT` map in `src/features/finder/data.ts` (D48(4)) — `query` is
  never mutated, the size selects stay `Any` and `facets.activeGroups` is unchanged, because a derived
  fitment is not a user filter. **Fitment is per category (D58, D67):** tires borrow `width`/`profile`/
  `rim`, wheels borrow `bolt` only — a car determines its bolt pattern, not the rim size its owner wants
  — and accessories, which have no size group, narrow on the spec string instead via
  `accessoryFitsVehicle()`: a stated thread pitch or TPMS frequency must equal the vehicle's, and a
  product stating neither (centre caps) stays a best match. Both sides are normalised before comparing —
  the map spells `12x1.5`, the card `12×1.5` (U+00D7) — because a silent non-match would leave every
  accessory "best" and hide the whole feature. It reads `productsIn(category)`, not `PRODUCTS`.
  **Brand matching is case-insensitive since D65** — in `matchesBrands` *and* in `brandFacets`'s
  `selected` flag, which must agree or the grid filters while the row stays unticked. Facet values keep
  the seed's own casing.
- [`components/results-toolbar.tsx`](components/results-toolbar.tsx) — `ResultsToolbar({ view })`, Server.
  Breadcrumb, then a `<details>` whose `<summary>` is the vehicle chip plus the `Change vehicle` /
  `Add vehicle` link (D45, D47(5)) opening a `<VehicleFinder variant="inline">` that submits to **this**
  category's route with its own CTA — on **all three** routes since **D67** vetoed D59(2) — the count
  (`1 match` / `N matches` / `N matches · M similar`, D42) and the desktop `Sort` label + `SortSelect`.
- [`components/sort-select.tsx`](components/sort-select.tsx) — `"use client"`. `SortSelect({ query, variant:
  "toolbar" | "bar", id })`: native `<select name="sort">`; on change `router.replace(resultsHref(withSort(…)))`.
  The `bar` variant prefixes each option with `Sort: ` (D47(4)). Since **D65** a `refocusRef` +
  `useEffect` re-focus the select **by `id`** after the `key={query.sort}` re-mount, which otherwise
  dropped keyboard focus to `<body>` — so `id` is load-bearing, not decorative. **D65** adds
  `aria-busy={isPending}` and `autoComplete="off"`, for the reasons under `filter-panel.tsx`.
- [`components/filter-sort-bar.tsx`](components/filter-sort-bar.tsx) — `FilterSortBar({ view })`, Server.
  The mobile sticky bar (`top:68` / `sm:top-22`, `md:hidden`): `FilterSheet` + `SortSelect variant="bar"`.
- [`components/filter-panel.tsx`](components/filter-panel.tsx) — `"use client"`. `FilterPanel({ view, variant:
  "rail" | "sheet", idPrefix, formId?, onNavigate? })`: the one `<form method="get">` posting to **the
  current category's route** (hidden `year/make/model/sort`); **five groups, or four on accessories** —
  Category rows/chips mapped from `facets.categories` (the current one is a non-link `aria-current`
  span, the other two are links), the size group mapped from `facets.sizeGroup.fields` and omitted
  entirely when that is `null`, the chip row from `facets.chipGroup` (`Season` / `Finish` / `Type`),
  Brand `Checkbox variant="facet"` rows, Price = two `range-input`s over a track — navigating on native
  `change`, re-focusing the changed control after the URL re-renders. Exports `CLEAR_ALL_CLASS`.
  Nothing here is spelled in tire vocabulary; every label, param and option comes off `view.facets`.
  Since **D66** `isPending` surfaces as `aria-busy` on the form; it renders `false` at rest and was not
  observed flipping to `true`, because the form is keyed on `href` and the pending instance is replaced
  on arrival. Size selects take `autoComplete="off"`: bfcache must not seat a value the URL lacks (D44).
- [`components/filter-rail.tsx`](components/filter-rail.tsx) — `FilterRail({ view })`, Server. `<aside
  aria-label="Filters">`, `hidden md:flex`, sticky `top:96`; the 32px group gap sits on the form.
- [`components/filter-sheet.tsx`](components/filter-sheet.tsx) — `"use client"`. `FilterSheet({ view })`: the
  `Filters (n)` trigger (`Filters` at 0) and its `<dialog>` — `sheet-panel` height, `::backdrop`
  `--scrim-mid` over the header too (D47(3)), Esc / ✕ / backdrop close, body scroll lock, closes itself
  when the viewport crosses to `md:`, footer `Show N matches` submits the panel form via `form=`. Its
  body scroller carries `overscroll-contain` (**D65**), as `sheet-panel` and the nav drawer now do — the
  body `overflow:hidden` lock is a different guarantee and does not stop scroll chaining.
- [`components/results-grid.tsx`](components/results-grid.tsx) — `ResultsGrid({ view })` and
  `ResultsEmpty({ clearHref, as?, body? })`, Server. `body` defaults to the tire copy so the
  `/styleguide` call site stays untouched. `Best matches` is the `<h1>` (D47(6)), `Similar matches`
  an `<h2>` (omitted when empty); `RESULTS_WINDOW` 6 + 3 unless `showAll`; `Load more` =
  `Button size="load"` link to `?show=all`, rendered only when cards are hidden (D47(7)); the empty state
  is new copy (D47(4)) and also renders on `/styleguide`.
- [`components/call-cta-panel.tsx`](components/call-cta-panel.tsx) — `CallCtaPanel()`, Server, `md:hidden`.
  `Not sure which one?` panel with the `tel:` CTA from `PRIMARY_CONTACT` (D47(1)).

## Rules
- **State is the URL.** No component holds filter state; islands call `router.replace(resultsHref(q))`
  with `scroll: false`. The server is the only place results are computed (D44, `docs/decisions.md` §4).
- **Counts are computed from the seed, never typed** (D42). No artboard number ships as a count.
- **The `Filters` title is a `<p>` in both the rail and the sheet** (D65). An `<h2>` there opened the
  outline at level 2 and pushed the page `<h1>Best matches</h1>` into second place at ≥1100px; `<aside
  aria-label="Filters">` / `<dialog aria-label="Filters">` already name the region and the artboard's own
  element is a `<span>`. **Not a deviation, no `DEVIATIONS.md` row** — measured 78.9×28 vs 79×28.
- **No per-category fork.** A component here may branch on the *shape* of `view.facets` (is there a size
  group?) but must never branch on `view.query.category`. Anything that genuinely differs per category is
  data, and data belongs in `catalog/categories.ts`. The moment a `if (category === "wheels")` appears in
  a component, the three routes have stopped being one page (D58).
- **The tires path is parity-measured and must stay byte-identical.** The tires row of `CATEGORY_CONFIG`
  reproduces the measured param names, option labels (`R16`), group labels and serialisation order.
  Changing one of those is a parity change, not a config edit.
- **`"use client"` only on** `sort-select`, `filter-panel`, `filter-sheet`. Never on the page, the grid,
  the toolbar or the rail wrapper (`docs/decisions.md` §4).
- Native controls only: `<select>` for sort and size, `<input type="checkbox">` for brands,
  `<input type="range">` ×2 for price (`docs/decisions.md` §5). Seasons are `ChipCheckbox` (a native
  checkbox wearing the chip recipe, `src/components/ui/chip.tsx`) so the GET form submits without JS.
- `Product`, `CATEGORY_CONFIG` and the seed all come from `src/features/catalog/` (D37); `ProductCard`
  is reused unchanged on all three categories.
- Copy is artboard-verbatim; the sort option labels, `Any`, the empty state and the size-select
  placeholders are new copy under `.claude/rules/ui.md` "Copy" (D47).
- Every measured value cites `design/inventory/results.md:<line>` or the artboard `file:line`.
- Breakpoints: mobile layout to 1099, rail + 3-up from `md:` 1100 (D46). `sm:` 720 only steps type,
  padding and the 2-up grid (DESIGN.md §8).

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | None folder-scoped. | Governing rows: **D42–D49**, **D58**, **D59** (root `llm.md` §5b), D37, D39, D41. | — |

## Connects to
- Depends on: `src/features/catalog/{types,categories,data}.ts` + `ProductCard`,
  `src/features/finder/` (`VehicleFinder`, `findFitment`),
  `src/components/ui/{button,chip,select,checkbox,field-label}.tsx`, `src/lib/{routes,site}.ts`,
  `src/app/globals.css` (`results-grid`, `range-input`, `sheet-panel`, `size-grid-sheet`, `pb-safe`),
  `next/navigation`.
- Depended on by: `src/app/(storefront)/{results,wheels,accessories}/page.tsx`, each of which calls
  `ResultsPage` with its own category and nothing else (D58); and
  `src/app/(storefront)/styleguide/page.tsx`, which renders `ResultsEmpty`.

## Don't
- Don't type a facet count, a result count or a price bound into a component (D42).
- Don't hold filter state in React state that the URL does not also hold (D44).
- Don't reproduce the artboard's drawn filter state (`Winter`, `Zeta + ZMAX`, `$140–$275`) as defaults —
  it is sample data (`design/DEVIATIONS.md` "Sample data").
- Don't add a fitment trust line here; no results artboard draws one (D47, D7 precedent).
- Don't move `call-cta-panel` to `src/components/site/` (D47 closes root `llm.md` §7.9).
- Don't import `search.ts` from a client file — it carries the seed. The same goes for `catalog/data.ts`;
  `catalog/categories.ts` is the client-safe half and is what `filter-panel.tsx` imports.
- Don't branch a component on `view.query.category`. That is what `catalog/categories.ts` is for — the
  one `category === "accessories"` test in `search.ts` is server logic, not a component fork (D67).
- Don't promote either `Filters` title back to an `<h2>`; it breaks the page's heading order (D65).
- Don't put a fourth select in the size group. The artboard draws three tracks; wheel offset is a spec
  row for exactly this reason (owner, 2026-09-21).

## Open
1. Vehicle params drive the best/similar split on all three routes through the **placeholder** `FITMENT`
   map (D48(4), D67 adds `thread`/`tpms`); real fitment data is owed by the client (root `llm.md` §7.13).
2. ~~`Wheels` / `Accessories` rows link to stubs.~~ Closed by **D58**: both are real routes. Still no
   count on either — only the current category carries one (D59(3)).
3. ~~No-JS mobile filter sheet~~ — closed by D48(1): the `<dialog>` stays, no `<details>` fallback. Rail,
   `Apply`, `Clear all` and `Show N matches` work without JS; below 1100px the sheet needs `showModal()`.
4. Parity: `design/reports/results.md`. Deviations: #25–#35, and #49–#53 for the two new categories
   (#52 superseded in place by D67).
5. **`/wheels` and `/accessories` have no parity report and are not parity rows** (#49) — they inherit
   `/results`' parity by rendering the same tree, which stops holding the moment either diverges visually.
6. Every wheel and accessory SKU, brand, finish and price is **placeholder data** (D58 under D48), and
   all nine accessory cards share one photograph (#51). Client, via owner.
