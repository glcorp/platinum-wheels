# src/features/results

## Purpose
The results engine and its sections — serving **three** routes since **D58**: `/results` (tires),
`/wheels` and `/accessories`. One composition, one set of components, one query/search pair; only the
filter groups, the finder CTA and the seed differ, all read from `src/features/catalog/categories.ts`.
The owner's instruction was *"keep them same as tires. only filters and skus change but everything else
remains as it is"*, so there is deliberately **no** per-route fork anywhere in this folder.

Sections: toolbar, mobile sticky filter/sort bar, filter rail (desktop) and sheet (mobile), the
best/similar grids with `Load more`, the mobile call panel. Routes stay thin (`docs/decisions.md` §3).
**URL-driven** (D44): every filter, the sort and the load-more window are query params, the server
renders every state, and the only client code is the leaf islands that update the URL. **The category is
not a param** — it is the route, an argument on `ResultsQuery`, never serialised (D58).

## Owns
Built at `page results`, 2026-09-21. Measured sources: `design/inventory/results.md` §2–§4 and
`design/assets/results-{desktop,mobile,mobile-filters}.html`.
- [`types.ts`](types.ts) — the contract every file here codes against: `ResultsQuery`, `Facets`,
  `SizeFieldFacet`, `ResultsView`, `SORT_OPTIONS`, `RESULTS_WINDOW`, `RESULTS_PARAM` (coordinator-written,
  D25, rewritten for D58). `RESULTS_PARAM` holds only the params **shared** by all three categories; the
  size-select and chip names live in `catalog/categories.ts`. Nothing here is in tire vocabulary.
- [`components/results-page.tsx`](components/results-page.tsx) — `ResultsPage({ category, searchParams })`,
  Server. The **entire** composition, so the three routes share it (D58); each `page.tsx` is an export, a
  `metadata` object and one call.
- [`query.ts`](query.ts) — pure, client-safe: `parseResultsQuery()`, `resultsHref()`, `clearFilters()`;
  param names double as form field names so a no-JS GET submit produces the same URL.
- [`search.ts`](search.ts) — server only: `searchResults()` filters, sorts and facets the catalog seed
  into a `ResultsView`. Imports `src/features/catalog/data.ts`; never imported by a client file. The
  best/similar split runs against an internal `SizeFilter`: an explicit URL size wins, otherwise a vehicle
  borrows one from the placeholder `FITMENT` map in `src/features/finder/data.ts` (D48(4)) — `query` is
  never mutated and `facets.activeGroups` is unchanged, because a derived fitment is not a user filter.
  **Fitment is per category (D58, D67):** tires borrow `width`/`profile`/`rim`, wheels `bolt` only — a car
  determines its bolt pattern, not the rim size its owner wants — and accessories, which have no size
  group, narrow on the spec string via `accessoryFitsVehicle()`, where a stated thread pitch or TPMS
  frequency must equal the vehicle's and stating neither stays best. Both sides are normalised (`12x1.5`
  in the map, `12×1.5` on the card). Reads `productsIn(category)`, not `PRODUCTS`. **Brand matching is
  case-insensitive since D65** — in `matchesBrands` *and* in `brandFacets`'s `selected` flag, which must
  agree or the grid filters while the row stays unticked; facet values keep the seed's own casing.
- [`components/results-toolbar.tsx`](components/results-toolbar.tsx) — `ResultsToolbar({ view })`, Server.
  Breadcrumb, then a `<details>` whose `<summary>` is the vehicle chip plus the `Change vehicle` /
  `Add vehicle` link (D45, D47(5)) opening a `<VehicleFinder variant="inline">` that submits to **this**
  category's route with its own CTA — on **all three** routes since **D67** vetoed D59(2) — and the
  desktop `Sort` label + `SortSelect`. **D72**: the chip is `--accent-subtle` on `1px --accent` with an
  `--accent` glyph (#61); the disclosure link is sentence case with no tracking, opting out of the shared
  `label` utility rather than editing it (#62); the count has left the row for `results-grid.tsx` (#63).
- [`components/sort-select.tsx`](components/sort-select.tsx) — `"use client"`. `SortSelect({ query,
  variant: "toolbar" | "bar", id })`: native `<select name="sort">`, `router.replace` on change; the
  `bar` variant prefixes each option `Sort: ` (D47(4)). **D65** re-focuses it **by `id`** after the
  `key={query.sort}` re-mount, which otherwise dropped focus to `<body>` — so `id` is load-bearing.
- [`components/filter-sort-bar.tsx`](components/filter-sort-bar.tsx) — `FilterSortBar({ view })`, Server.
  The mobile sticky bar (`top:68` / `sm:top-22`, `md:hidden`): `FilterSheet` + `SortSelect variant="bar"`.
- [`components/filter-panel.tsx`](components/filter-panel.tsx) — `"use client"`. `FilterPanel({ view, variant:
  "rail" | "sheet", idPrefix, formId?, onNavigate? })`: the one `<form method="get">` posting to **the
  current category's route** (hidden `year/make/model/sort`); **four groups, or three on accessories**
  since **D71** deleted the drawn `Category` group (#60) — the size group from `facets.sizeGroup.fields`,
  omitted when `null`, on stock `grid-cols-3`, `dense` swapping in `grid-cols-4` with `SizeField`'s
  `spanTwo` on the last field and trimmed padding (a 1:1:2 split, wheels only, `5x114.3` no longer clips;
  rail and sheet now share the same classes, #67/#71); the chip row (`Season`/`Finish`/`Type`); Brand
  `Checkbox variant="facet"` rows; Price = two `range-input`s inside a travel box 8px wider than the drawn
  track each side (**D69**), its dim bounds row showing only once `selectedMin`/`selectedMax` narrow
  (#68). **No `Apply`** (#71, D82) — the rail's button and the sheet's inline one are both gone, so the
  sheet's footer `Apply` is the panel's only visible submit and the rail has none, filtering live
  with JS only. Navigates on native `change`, re-focusing the changed control by `id`. Exports
  `CLEAR_ALL_CLASS`; every label/param/option comes off `view.facets`. `isPending` surfaces as `aria-busy`
  (D66/D67). Size selects take `autoComplete="off"` (D44).
- [`components/filter-rail.tsx`](components/filter-rail.tsx) — `FilterRail({ view })`, Server.
  `<aside aria-label="Filters">`, `hidden md:flex`, sticky `top:96`; the 32px group gap sits on the form.
  Since **D68** it is also its own scroll region, via `md:filter-rail` (globals.css): sticky alone left
  the panel's lower groups below the fold once it outgrew the space under the sticky offset — 735px
  against 604px at 1440×700 — with the page scrolling underneath them. Inert where the panel fits.
- [`components/filter-sheet.tsx`](components/filter-sheet.tsx) — `"use client"`. `FilterSheet({ view })`:
  the `Filters (n)` trigger (`Filters` at 0) and its `<dialog>` — `sheet-panel` height, `::backdrop`
  `--scrim-mid` over the header too (D47(3)), Esc / ✕ / backdrop close, body scroll lock, closes at
  `md:`, body scroller `overscroll-contain` (**D65**). Footer submits via `form=` and reads **`Apply`**,
  with no count (#74, **D85**, superseding #72 and D49's "keeps the total" clause) — size splits the set
  rather than shrinking it (D47(8)), so two counts are true at once and the button carries neither.
- [`components/results-grid.tsx`](components/results-grid.tsx) — `ResultsGrid({ view })` and
  `ResultsEmpty({ clearHref, as?, body? })`, Server. `body` defaults to the category copy so the
  `/styleguide` call site stays untouched (one sentence for all three today, D73). `Best matches` is the
  `<h1>` (D47(6)), `Similar matches` an `<h2>` (omitted when empty); `RESULTS_WINDOW` 6 + 3 unless
  `showAll`; `Load more` = `Button size="load"` link to `?show=all`, rendered only when cards are hidden
  (D47(7)) and carrying `scroll={false}` since **D68**, because Next scrolls a navigation to the top by
  default and the reader was thrown back to the header (2146 → 0); the empty state is new copy (D47(4)).
  Since **D72** the count and `countCopy` live here as the second line of the `Best matches` header stack
  (#63), and `ResultsGrid` composes the zero-results state itself from the shared `SECTION` /
  `HEAD_STACK` / `HEADING` / `SUPPORT` / `EMPTY_HEADING` / `EmptyActions` instead of returning
  `<ResultsEmpty/>`, now the `/styleguide` reference only.
- [`components/call-cta-panel.tsx`](components/call-cta-panel.tsx) — `CallCtaPanel()`, Server,
  `md:hidden`. `Not sure which one?` panel, `tel:` CTA from `PRIMARY_CONTACT` (D47(1)).

## Rules
- **State is the URL.** No component holds filter state; islands call `router.replace(resultsHref(q))`
  with `scroll: false`. The server is the only place results are computed (D44, `docs/decisions.md` §4).
- **Counts are computed from the seed, never typed** (D42); no artboard number ships as a count.
- **The `Filters` title is a `<p>` in both the rail and the sheet** (D65): an `<h2>` pushed the page
  `<h1>` to second place at ≥1100px and the landmark is already named. Not a deviation.
- **The count is the build's only `aria-live` region and must stay one stable node** (D57/C2, #45, #63).
  `ResultsGrid` renders the first `<section>`, its header stack, `<h1>` and count `<p>` unconditionally
  and branches below them: a remounted region is not announced. Never restore an early return.
- **No per-category fork.** A component may branch on the *shape* of `view.facets` (is there a size
  group?), never on `view.query.category`; what differs is data, and data lives in `categories.ts` (D58).
- **The tires path is parity-measured and must stay byte-identical.** The tires row of `CATEGORY_CONFIG`
  reproduces the measured param names, option labels (`R16`), group labels and serialisation order.
- **`"use client"` only on** `sort-select`, `filter-panel`, `filter-sheet`. Never on the page, the grid,
  the toolbar or the rail wrapper (`docs/decisions.md` §4).
- Native controls only: `<select>` for sort and size, `<input type="checkbox">` for brands,
  `<input type="range">` ×2 for price (`docs/decisions.md` §5); seasons are `ChipCheckbox`, a native
  checkbox wearing the chip recipe, so the GET form submits without JS.
- `Product`, `CATEGORY_CONFIG` and the seed come from `src/features/catalog/` (D37).
- Copy is artboard-verbatim; sort labels, `Any`, the empty state and the size-select placeholders are
  new copy under `.claude/rules/ui.md` "Copy" (D47). Measured values cite `inventory/results.md:<line>`.
- Breakpoints: mobile layout to 1099, rail + 3-up from `md:` 1100 (D46). `sm:` 720 only steps type,
  padding and the 2-up grid (DESIGN.md §8).
- **The rail's scroll cap is derived from its sticky offset** — `100dvh - 96px` against `md:top-24`
  (`results-desktop.html:121`), never a guessed height, and in `dvh` (`docs/decisions.md` §5). D68.
- **Result changes animate through list identity (D92).** `CardGrid` wraps each card in
  `<ViewTransition key={slug} enter={`card-in-${Math.min(index % 6, 5)}`} exit="card-out"
  update="card-move" default="none">`: leavers fade, survivors travel, arrivals rise 12px 30ms apart
  (≤150ms). The index modulo is why `Load more`'s new cards (positions 6–8) still stagger. The live-region
  structure D72 fixed is untouched — the VTs wrap cards only. `results-page.tsx` wraps `<main>` and the
  footer in `PageTransition`, which stays mounted across same-route changes and so never animates them.

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | None folder-scoped. | Governing rows: **D42–D49**, **D58**, **D59** (root `llm.md` §5b), D37, D39, D41. | — |

## Connects to
- Depends on: `src/features/catalog/{types,categories,data}.ts` + `ProductCard`, `src/features/finder/`
  (`VehicleFinder`, `findFitment`), `src/components/ui/{button,chip,select,checkbox,field-label}.tsx`,
  `src/lib/{routes,site}.ts`, `src/app/globals.css` (`results-grid`, `range-input`, `sheet-panel`,
  `filter-rail`, `pb-safe`; `size-grid-sheet`/`wheel-size-grid(-sheet)` are dead since #71/#67's
  correction and owed for removal, single-writer D25), `next/navigation`.
- Depended on by: `src/app/(storefront)/{results,wheels,accessories}/page.tsx`, each of which calls
  `ResultsPage` with its own category and nothing else (D58); and
  `src/app/(storefront)/styleguide/page.tsx`, which renders `ResultsEmpty`.

## Don't
- Don't type a facet count, a result count or a price bound into a component (D42), and don't hold
  filter state in React state that the URL does not also hold (D44).
- Don't reproduce the artboard's drawn filter state (`Winter`, `Zeta + ZMAX`, `$140–$275`) as defaults —
  it is sample data (`DEVIATIONS.md` "Sample data").
- Don't add a fitment trust line here, and don't move `call-cta-panel` to `src/components/site/` (D47).
- Don't import `search.ts` or `catalog/data.ts` from a client file — they carry the seed;
  `catalog/categories.ts` is the client-safe half, and is what `filter-panel.tsx` imports.
- Don't branch a component on `view.query.category`; the one `category === "accessories"` test in
  `search.ts` is server logic, not a component fork (D67).
- Don't promote either `Filters` title back to an `<h2>`; it breaks the page's heading order (D65).
- Don't lay the price `range-input`s flush over the track box. A native thumb travels inset by half its
  width, so the handles drift off their drawn percentage and the fill stops marking them (**D69**).
- Don't put a fourth select in the size group. The artboard draws three tracks; wheel offset is a spec
  row for exactly this reason (owner, 2026-09-21).
- Don't restore the `Category` group or a `categories` facet (**D71**, #60): it filtered nothing.
- Don't give the rail a height or a width of its own. 280px is the `results-grid` track; only the
  `max-height` is the rail's, and only so it can scroll (D68).
- Don't set `sizeGroup.dense` or `spanTwo` on tires. `grid-cols-3` and the 10 + 14 + 6 padding are the
  measured tire values; `dense` exists so wheels can diverge from them without moving either (#67).
- Don't reach for a custom `@utility` where stock `grid-cols-N`/`col-span-N` does the job — the
  `wheel-size-grid` one shipped syntactically valid and Tailwind never emitted it (#67's correction).

## Open
1. Vehicle params drive the best/similar split on all three routes through the **placeholder** `FITMENT`
   map (D48(4), D67 adds `thread`/`tpms`); real fitment data is owed by the client (root `llm.md` §7.13).
2. ~~Stub links~~ (moot, **D71** removed `Category`, #60) and ~~no-JS mobile sheet~~ (D48(1): `showModal()`
   still needs JS to open it, but its footer `Apply` works without JS once open — the rail's own
   no-JS path went with `Apply`, #71, and isn't owed back).
3. Parity: `design/reports/results.md` (its five rail and three sheet `Category` rows are annotated as
   superseded). Deviations: #25–#35, #49–#53 (#52 superseded by D67), #60, #61–#63 (D72 toolbar), #68, #71.
4. **`/wheels` and `/accessories` have no parity report and are not parity rows** (#49) — they inherit
   `/results`' parity by rendering the same tree, which stops the moment either diverges visually.
5. Every wheel and accessory SKU, brand, finish and price is **placeholder data** (D58 under D48), and
   five client photos cover the nine accessory SKUs (#51). Client, via owner.
6. ~~`wheel-size-grid`/`wheel-size-grid-sheet`~~ (closed, #67; dead code owed for removal, D25). Owner.
7. **`Load more` drops keyboard focus to `<body>`** — the link unmounts on arrival, D65's defect again,
   and nothing announces the three new cards (the count is unchanged by `?show=all`). `results-grid.tsx`
   is a Server Component by design, so the fix is a leaf island, not a directive on it. Owner.
