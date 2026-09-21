# src/features/results

## Purpose
The `/results` page's own sections: toolbar, mobile sticky filter/sort bar, the filter rail (desktop) and
filter sheet (mobile), the best/similar card grids with `Load more`, and the mobile call panel. The route
file stays thin (`docs/decisions.md` §3); everything the artboards draw for `02 Results` lives here.
The page is **URL-driven** (D44): every filter, the sort and the load-more window are query params, the
server filters the catalog seed and renders every state, and the only client code is the leaf islands
that update the URL. Delete this folder and `/results` falls back to nothing.

## Owns
Built at `page results`, 2026-09-21. Measured sources: `design/inventory/results.md` §2–§4 and
`design/assets/results-{desktop,mobile,mobile-filters}.html`.
- [`types.ts`](types.ts) — the contract every file here codes against: `ResultsQuery`, `Facets`,
  `ResultsView`, `SORT_OPTIONS`, `SEASON_OPTIONS`, `RESULTS_WINDOW`, `RESULTS_PARAM`. Written by the
  coordinator before any component (D25).
- [`query.ts`](query.ts) — pure, client-safe: `parseResultsQuery()`, `resultsHref()`, `clearFilters()`.
  Param names double as form field names so a no-JS GET submit produces the same URL.
- [`search.ts`](search.ts) — server only: `searchResults()` filters, sorts and facets the catalog seed
  into a `ResultsView`. Imports `src/features/catalog/data.ts`; never imported by a client file. The
  best/similar split runs against an internal `SizeFilter`: an explicit URL size wins, otherwise a vehicle
  borrows one from the placeholder `FITMENT` map in `src/features/finder/data.ts` (D48(4)) — `query` is
  never mutated, the size selects stay `Any` and `facets.activeGroups` is unchanged, because a derived
  fitment is not a user filter.
- [`components/results-toolbar.tsx`](components/results-toolbar.tsx) — `ResultsToolbar({ view })`, Server.
  Breadcrumb, then a `<details>` whose `<summary>` is the vehicle chip plus the `Change vehicle` /
  `Add vehicle` link (D45, D47(5)) opening `<VehicleFinder variant="inline" />`, the computed count
  (`1 match` / `N matches` / `N matches · M similar`, D42) and the desktop `Sort` label + `SortSelect`.
- [`components/sort-select.tsx`](components/sort-select.tsx) — `"use client"`. `SortSelect({ query, variant:
  "toolbar" | "bar", id })`: native `<select name="sort">`; on change `router.replace(resultsHref(withSort(…)))`.
  The `bar` variant prefixes each option with `Sort: ` (D47(4)).
- [`components/filter-sort-bar.tsx`](components/filter-sort-bar.tsx) — `FilterSortBar({ view })`, Server.
  The mobile sticky bar (`top:68` / `sm:top-22`, `md:hidden`): `FilterSheet` + `SortSelect variant="bar"`.
- [`components/filter-panel.tsx`](components/filter-panel.tsx) — `"use client"`. `FilterPanel({ view, variant:
  "rail" | "sheet", idPrefix, formId?, onNavigate? })`: the one `<form method="get" action="/results">`
  (hidden `year/make/model/sort`), five groups — Category rows/chips (`Wheels`/`Accessories` are links to
  their routes, D39), Tire size native selects defaulting to `Any`, Season `ChipCheckbox`es, Brand
  `Checkbox variant="facet"` rows, Price = two `range-input`s over a track — navigating on native
  `change`, re-focusing the changed control after the URL re-renders. Exports `CLEAR_ALL_CLASS`.
- [`components/filter-rail.tsx`](components/filter-rail.tsx) — `FilterRail({ view })`, Server. `<aside
  aria-label="Filters">`, `hidden md:flex`, sticky `top:96`; the 32px group gap sits on the form.
- [`components/filter-sheet.tsx`](components/filter-sheet.tsx) — `"use client"`. `FilterSheet({ view })`: the
  `Filters (n)` trigger (`Filters` at 0) and its `<dialog>` — `sheet-panel` height, `::backdrop`
  `--scrim-mid` over the header too (D47(3)), Esc / ✕ / backdrop close, body scroll lock, closes itself
  when the viewport crosses to `md:`, footer `Show N matches` submits the panel form via `form=`.
- [`components/results-grid.tsx`](components/results-grid.tsx) — `ResultsGrid({ view })` and
  `ResultsEmpty({ clearHref, as? })`, Server. `Best matches` is the `<h1>` (D47(6)), `Similar matches`
  an `<h2>` (omitted when empty); `RESULTS_WINDOW` 6 + 3 unless `showAll`; `Load more` =
  `Button size="load"` link to `?show=all`, rendered only when cards are hidden (D47(7)); the empty state
  is new copy (D47(4)) and also renders on `/styleguide`.
- [`components/call-cta-panel.tsx`](components/call-cta-panel.tsx) — `CallCtaPanel()`, Server, `md:hidden`.
  `Not sure which one?` panel with the `tel:` CTA from `PRIMARY_CONTACT` (D47(1)).

## Rules
- **State is the URL.** No component holds filter state; islands call `router.replace(resultsHref(q))`
  with `scroll: false`. The server is the only place results are computed (D44, `docs/decisions.md` §4).
- **Counts are computed from the seed, never typed** (D42). No artboard number ships as a count.
- **`"use client"` only on** `sort-select`, `filter-panel`, `filter-sheet`. Never on the page, the grid,
  the toolbar or the rail wrapper (`docs/decisions.md` §4).
- Native controls only: `<select>` for sort and size, `<input type="checkbox">` for brands,
  `<input type="range">` ×2 for price (`docs/decisions.md` §5). Seasons are `ChipCheckbox` (a native
  checkbox wearing the chip recipe, `src/components/ui/chip.tsx`) so the GET form submits without JS.
- `Product` comes from `src/features/catalog/` (D37); `ProductCard` is reused unchanged.
- Copy is artboard-verbatim; the sort option labels, `Any`, the empty state and the size-select
  placeholders are new copy under `.claude/rules/ui.md` "Copy" (D47).
- Every measured value cites `design/inventory/results.md:<line>` or the artboard `file:line`.
- Breakpoints: mobile layout to 1099, rail + 3-up from `md:` 1100 (D46). `sm:` 720 only steps type,
  padding and the 2-up grid (DESIGN.md §8).

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | None folder-scoped. | Governing rows: **D42–D47** (root `llm.md` §5b), D37, D39, D41. | — |

## Connects to
- Depends on: `src/features/catalog/{types,data}.ts` + `ProductCard`, `src/features/finder/` (`VehicleFinder`,
  `findFitment`),
  `src/components/ui/{button,chip,select,checkbox,field-label}.tsx`, `src/lib/{routes,site}.ts`,
  `src/app/globals.css` (`results-grid`, `range-input`, `sheet-panel`, `size-grid-sheet`, `pb-safe`),
  `next/navigation`.
- Depended on by: `src/app/(storefront)/results/page.tsx` only.

## Don't
- Don't type a facet count, a result count or a price bound into a component (D42).
- Don't hold filter state in React state that the URL does not also hold (D44).
- Don't reproduce the artboard's drawn filter state (`Winter`, `Zeta + ZMAX`, `$140–$275`) as defaults —
  it is sample data (`design/DEVIATIONS.md` "Sample data").
- Don't add a fitment trust line here; no results artboard draws one (D47, D7 precedent).
- Don't move `call-cta-panel` to `src/components/site/` (D47 closes root `llm.md` §7.9).
- Don't import `search.ts` from a client file — it carries the seed.

## Open
1. Vehicle params drive the best/similar split through the **placeholder** `FITMENT` map (D48(4)); real
   year-specific fitment data is still owed by the client (root `llm.md` §7.13).
2. `Wheels` / `Accessories` category rows link to their stub routes with no count; no data exists.
3. ~~No-JS mobile filter sheet~~ — closed by D48(1): the `<dialog>` stays; no `<details>` fallback. The
   desktop rail, `Apply`, `Clear all` and `Show N matches` work without JS; below 1100px the sheet needs
   `showModal()` (`filter-sheet.tsx` header comment).
4. Parity: `design/reports/results.md`. Deviations: `design/DEVIATIONS.md` #25–#35.
