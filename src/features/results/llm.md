# src/features/results

## Purpose
The results engine and its sections — serving **three** routes since **D58**: `/tires` (tires),
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
  Since **D132** `RESULTS_PARAM.brands` / `ALL_BRANDS` (`?brands=all`) and `ResultsQuery.allBrands`: the
  brand fold was open at the visitor's last change. A view state, never a filter, never counted.
- [`components/results-page.tsx`](components/results-page.tsx) — `ResultsPage({ category, searchParams })`,
  Server. The **entire** composition, so the three routes share it (D58); each `page.tsx` is an export, a
  `metadata` object and one call.
- [`query.ts`](query.ts) — pure, client-safe: `parseResultsQuery()`, `resultsHref()`, `clearFilters()`;
  param names double as form field names so a no-JS GET submit produces the same URL. Also sets
  `partialVehicle` (LA-05 P2) when the URL names part of a vehicle; the toolbar then opens its finder
  with the known fields kept and a prompt for the rest.
- [`search.ts`](search.ts) — server only and **async** since D108b: `searchResults()` asks the catalogue
  (`catalog/queries.ts`) for one page of best matches, the similar row and the facets, and maps them into
  a `ResultsView`. Reads the database; never imported by a client file. **Since D194** the whole view is kept between requests
  under `CATALOGUE_TAG`, keyed on the settled query (`readCatalogueCached`), so a repeated filter set reads no
  database until the next catalogue write. **Since D157** one cached
  category base read (`getCategoryBase`), then one round: best, similar and facets together (since **D175** always: the similar row has its own
  window, `query.similarShow`, so it no longer waits on best's total). A URL value the category does not hold (size,
  brand, finish, thread, load, bore, offset) is settled against the base before the read, so a hand-typed
  unknown size no longer costs a second read. An explicit URL size wins;
  with every size select at `Any`, a vehicle narrows the page from `src/features/finder/fitment.ts`
  `findFitment(year, make, model)` through `tire-fit.ts` (D155): `query` is never mutated and
  `facets.activeGroups` is unchanged, because a derived fit is not a user filter. **Fitment is per
  category (D58, D67, D155):** **tires** (`filters.tire.vehicleFit`): `best` is a catalogue tire whose size
  equals one of the model year's factory sizes; `similar` is any other tire inside the stock envelope
  (overall diameter within 0.5 in of it, section width inside it, rim inside the wheel envelope's
  diameters; with no tire range from the source the envelope is derived from the factory sizes: diameter
  over the sizes, section width ±5%, rim inside the wheel range's diameters else the sizes' rims −1/+2,
  *derived*, coordinator), and with no factory sizes at all the rim rule (rim, width fit, class sidewall
  band) decides. **Wheels** (`filters.wheel.vehicleFit`): the bolt pattern must match one
  of the vehicle's (both, when it has two); `best` is also inside the stock wheel envelope (diameter,
  width, offset) with a centre bore not narrower than the hub; `similar` is the right pattern outside it,
  with a bore too small, or with an envelope and no bore stated; with no envelope the pattern alone
  decides and only a narrower bore demotes. **Accessories**: lug nuts, lug bolts and wheel locks by thread,
  lug nuts against a hub-bolt car and lug bolts against a stud-and-nut one by type (`fastener`), hub rings
  by hub bore, and **since D156 TPMS sensors and tools by the car's TPMS on or off**: every product of the
  `tpms_sensors_tools` type goes to similar for a car whose `tpms` is `false`, and nothing changes for a car
  with TPMS or no data (`filters.accessory.tpms`, wired in `search.ts` and counted in `narrows`); a product
  that states nothing stays best (`queries.ts` `accessoryContradiction()`). The sensor's frequency is not
  modelled. Owner, 2026-10-06, verbatim: *"for TM or TP MS frequency if auto country is giving on and off for car we can do the same and not focus on the frequency that is out of our scope"*. `ResultsView.boltChoice` carries the
  patterns of a vehicle that came with two, only while the vehicle is what narrows `/wheels`.
  **Owner, 2026-10-06:** *"priority is vendor then factory. use best and similar both techniques."* and
  *"Two bolt patterns in one model-year: Show wheels for both patterns."* (the rest is *derived*, D155:
  the 0.5 in tire diameter slack, the unstated-offset-is-not-outside rule, the unstated-bore rule, the
  0.5 mm bore tolerance and the 0.5 in slack beyond the stock wheel width (coordinator, 2026-10-06, after a
  vendor spot check: DAI's fit lists run wider than the stock range and list GM 78.1 hubs with 77.8 wheels;
  "we have only commit a loose fit to the client"), a range bound of 0 or missing meaning unbounded on that
  side, the rim-rule fallback). **Since D170** a size the buyer picks no longer drops the vehicle: wheels
  keep its bolt pattern, a bore at least the hub's and a stretched envelope (width stock minimum less 0.5"
  to maximum plus 1", offset ±5 mm), the picked diameter unbounded; tires keep an overall diameter within
  3% of stock; the wheel size selects list only what is drilled for the car (`catalogFilters` sends the
  fit always; the rules are `queries.ts` `wheelVehicleBest` / `tireHeightBand`; **since D188** one wheel rule
  serves `All sizes` and a picked size, so `All sizes` is every diameter chip added together)
  (D67 asymmetry unchanged: a product is demoted only when it STATES a contradiction).
  **What D108b changed, because 9 products and 45,000 behave differently:** a size now *filters*
  (`best` is that size; `similar` is the sizes next to it, `sizeMatch: "near"`, not "everything else");
  facet counts follow `best`; the lists arrive windowed by `query.show`; **the brand filter sent to the
  database is exact**, as the facet spells it (D107b); and a price bound parked at
  the end of the slider is not sent as a filter, because the form posts both range inputs on every change
  and a price bound would silently drop every product with no price. **Unknown values (D93b, carried
  across by D111):** before the read, `withKnownBrands` drops a brand the category does not carry and
  gives a known one the catalogue's spelling whatever its case (`catalog/queries.ts` `getBrands`; D65
  stands again), while a brand it carries that the other filters empty keeps its ticked row at 0; the
  price range goes through `withPriceBounds`; after the read, `withKnownSizes` turns a size value the
  category does not hold at all into `Any` and reads once more. **The size selects narrow one another
  (D132):** each lists the values found with the OTHER size parts the buyer chose (`getFacets`'
  `sizeOptions`), read off the full list so the order holds, and always keeps its own value, so a URL
  never silently loses its choice; `withKnownSizes` checks the full lists, never the narrowed ones. The
  narrowing uses `query.size` only, so a vehicle's fit (D155) leaves every select whole, and
  brand / chips / price never narrow sizes, so the size group stays "what sizes exist" and D109(1)'s
  best/similar split is untouched.
- [`components/results-toolbar.tsx`](components/results-toolbar.tsx) — `ResultsToolbar({ view })`, Server.
  **Since D159 (2026-10-07) only the breadcrumb and the desktop sort**; the vehicle chip and disclosure
  below moved to `vehicle-panel.tsx`. History: breadcrumb, then a `<details>` whose `<summary>` is the vehicle chip plus the `Change vehicle` /
  `Add vehicle` link (D45, D47(5)) opening a `<VehicleFinder variant="inline">` that submits to **this**
  category's route with its own CTA — on **all three** routes since **D67** vetoed D59(2) — and the
  desktop `Sort` label + `SortSelect`. **D72**: the chip is `--accent-subtle` on `1px --accent` with an
  `--accent` glyph (#61); the disclosure link is sentence case with no tracking, opting out of the shared
  `label` utility rather than editing it (#62); the count has left the row for `results-grid.tsx` (#63).
- [`components/sort-select.tsx`](components/sort-select.tsx) — `"use client"`. `SortSelect({ query,
  variant: "toolbar" | "bar", id })`: native `<select name="sort">`, `router.replace` on change; the
  `bar` variant prefixes each option `Sort: ` (D47(4)). **D65** re-focuses it **by `id`** after the
  `key={query.sort}` re-mount, which otherwise dropped focus to `<body>` — so `id` is load-bearing.
- [`components/filter-sort-bar.tsx`](components/filter-sort-bar.tsx) — `FilterSortBar({ view, tabs, active })`,
  Server. The mobile sticky bar (`top:68` / `sm:top-22`, `md:hidden`, `--bg` fill): since **D159** the
  category tabs (D158) over the `VehicleButton` beside a 120px `FilterSheet` trigger; with prices on,
  `Filters` + `SortSelect variant="bar"` share a second row. 122px tall; the `scroll-padding-top` rule in
  `globals.css` (190 / 210px) must change with it. **Under 500px tall (a sideways phone) the whole bar is
  `static`** (`[@media(max-height:499.98px)]:static`, **D185**, owner "Unpin bars on sideways phones");
  the header stays pinned. At 568x320 the pinned stack had been 190px, 59% of the screen. The scroll
  padding there is only the header's (68 / 88px): that rule is in `globals.css`, the coordinator's.
- [`components/vehicle-panel.tsx`](components/vehicle-panel.tsx) — Server. `VehicleButton({ query,
  size?: "bar" | "rail", className? })`: a link to `#vehicle-sheet`; `bar` 44px, `rail` 64px with the label
  in the `Filters` title's type (28px condensed, owner 2026-10-07) and `shrink-0` (the scrolling rail
  squeezed it to 28px); `Add vehicle` outline in `--accent` or
  the D72 chip naming the car (mobile bar; top of the rail with a `Change` cue); the label wraps to two
  lines (`line-clamp-2`, QA LAYOUT-2) inside the same 44 / 64px box. `VehiclePanel({ query, fits })`
  (`fits` = `ResultsView.vehicleNarrows`; `false` reads *"We don't have fit data for your <car> yet, so
  everything is shown."*, owner "No-data car wording", **D185**):
  the sheet with `VehicleFinder variant="sheet"` (submits to this category, carries the page's filters,
  WDG-17, and since **D176** the picked size too, because a size beside a car keeps the car, D170) and
  `Remove vehicle`; rendered once in `results-page.tsx` so the finder's ids stay unique (D88).
- [`components/vehicle-sheet.tsx`](components/vehicle-sheet.tsx) — `"use client"`. `VehicleSheet`: the
  dialog (filter sheet's pattern, `sheet-panel` with `data-fit` = content height, centred at
  `max-w-dialog` from `md:`). Opens on any click of an `a[href="#vehicle-sheet"]` (capture listener), so
  the triggers stay server-rendered; without JS a `<noscript>` `:target` style shows it, and lifts the
  panel's closed-state translate too (a targeted dialog is never `[open]`, QA MODEL-1, **D184**). A part-filled
  submit (`partialVehicle`) opens it on load and focuses the missing field. `VEHICLE_SHEET_ID` lives in
  `types.ts`: a server file cannot read a constant exported from a client module (measured: it rendered
  as a function's source in the `href`).
- [`components/filter-panel.tsx`](components/filter-panel.tsx) — `"use client"`. `FilterPanel({ view, variant:
  "rail" | "sheet", idPrefix, formId?, onNavigate? })`: the one `<form method="get">` posting to **the
  current category's route** (hidden `year/make/model/sort`); **four groups, or three on accessories**
  since **D71** deleted the drawn `Category` group (#60) — the size group from `facets.sizeGroup.fields`,
  omitted when `null`, on stock `grid-cols-3`, `dense` swapping in `grid-cols-4` with `SizeField`'s
  `spanTwo` on the last field and trimmed padding (a 1:1:2 split, wheels only, `5x114.3` no longer clips;
  rail and sheet now share the same classes, #67/#71); the chip row (`Season`/`Type`; none on wheels since D105b); Brand
  `Checkbox variant="facet"` rows; Price = two `range-input`s inside a travel box 8px wider than the drawn
  track each side (**D69**), its dim bounds row showing only once `selectedMin`/`selectedMax` narrow
  (#68). **No `Apply`** (#71, D82) — the rail's button and the sheet's inline one are both gone, so the
  sheet's footer `Apply` is the panel's only visible submit and the rail has none, filtering live
  with JS only. Navigates on native `change`, re-focusing the changed control by `id`. Exports
  `CLEAR_ALL_CLASS`; every label/param/option comes off `view.facets`. `isPending` surfaces as `aria-busy`
  (D66/D67). Size selects take `autoComplete="off"` (D44). **Brand fold (D132):** the first
  `BRAND_WINDOW` rows show, the rest fold A to Z into `<details data-brand-fold>`, whose `open` is
  server-rendered: open on `?brands=all` or when a ticked brand sits in the fold. A ticked brand is no
  longer hoisted above the fold; it stays in place and opens it. Each commit sets `brands=all` from the
  fold's live `open` (`hrefFromForm`), and a hidden `brands=all` input keeps an arrived-open fold open
  across a no-JS submit. `Clear all` closes it (`clearFilters`).
- [`components/filter-rail.tsx`](components/filter-rail.tsx) — `FilterRail({ view })`, Server.
  `<aside aria-label="Filters">`, `hidden md:flex`, sticky `top:96`; the 32px group gap sits on the form.
  Since **D68** it is also its own scroll region, via `md:filter-rail` (globals.css): sticky alone left
  the panel's lower groups below the fold once it outgrew the space under the sticky offset — 735px
  against 604px at 1440×700 — with the page scrolling underneath them. Inert where the panel fits.
  Its scrollbar sits in the grid gap (16px right bleed), so a macOS overlay bar never covers the counts.
- [`components/filter-sheet.tsx`](components/filter-sheet.tsx) — `"use client"`. `FilterSheet({ view })`;
  **since D157 its `FilterPanel` mounts on the sheet's first open** (the sheet cannot open without JS), and
  the panels take `FilterView = Pick<ResultsView, "query" | "facets">`, never the product arrays:
  the `Filters (n)` trigger (`Filters` at 0) and its `<dialog>` — `sheet-panel` height, `::backdrop`
  `--scrim-mid` over the header too (D47(3)), Esc / ✕ / backdrop close, body scroll lock, closes at
  `md:`, body scroller `overscroll-contain` (**D65**). Footer submits via `form=` and reads **`Apply`**,
  with no count (#74, **D85**, superseding #72 and D49's "keeps the total" clause) — size splits the set
  rather than shrinking it (D47(8)), so two counts are true at once and the button carries neither.
- [`components/load-more-landing.tsx`](components/load-more-landing.tsx) — `"use client"` leaf island,
  renders `null` (D133): records the `a[data-load-more]` press and, on the next `show` or `similar` change (D175), scrolls
  instantly to the first new card and focuses its `data-card-link`. Cards carry position ids
  `result-N` / `similar-N`; the `Load more` href ends in the first new card's id; `scroll={false}` stays (D68).
- Only the **first** best-match card is eager with `fetchPriority="high"` (`priorityCount={1}`, D153, launch audit mobile LCP): three marked high at once on a one-column phone made two compete with the one that is the LCP. The home featured row passes no priority (below the fold; the hero owns it).
- [`components/diameter-strip.tsx`](components/diameter-strip.tsx) — `DiameterStrip({ view })`, Server: on
  `/wheels` with a vehicle, a `Wheel diameter` row of chip links under the count (D186, `DEVIATIONS.md`
  #145). Options are the size facet's diameter field; each link sets or clears `diameter` and keeps the car.
- [`components/results-grid.tsx`](components/results-grid.tsx) — two cards a row below 720 since D186
  (`compactMobile` cards, #144). `ResultsGrid({ view })` and
  `ResultsEmpty({ clearHref, as?, body? })`, Server. `body` defaults to the category copy so the
  `/styleguide` call site stays untouched (one sentence for all three today, D73). `Best matches` is the
  `<h1>` (D47(6)), `Similar matches` an `<h2>` (omitted when empty); `RESULTS_WINDOW` 6 + 3 by
  default; `Load more` = `Button size="load"` link that raises `?show=` by 24 up to 150 (D108b; it used to be
  `?show=all`, which is thousands of cards now) and **since D175 grows best only**; the similar list has
  its own `Show more` (`?similar=`: 3 → 12, then +24 to 150, `withMoreSimilar`). Each is rendered only
  while it has something to reveal (D47(7)) and sits under the list it grows (owner, 2026-10-06); at a
  ceiling a line says how many are shown and to narrow the filters; both carry and carrying `scroll={false}` since **D68**, because Next scrolls a navigation to the top by
  default and the reader was thrown back to the header (2146 → 0); the empty state is new copy (D47(4)).
  Since **D72** the count and `countCopy` live here as the second line of the `Best matches` header stack
  (#63), and `ResultsGrid` composes the zero-results state itself from the shared `SECTION` /
  `HEAD_STACK` / `HEADING` / `SUPPORT` / `EMPTY_HEADING` / `EmptyActions` instead of returning
  `<ResultsEmpty/>`, now the `/styleguide` reference only. **D155:** `BoltChoiceNote` (exported, shown on
  `/styleguide` §11) is a third line in the header stack, rendered only when `view.boltChoice` holds two
  or more patterns (`/wheels` with a vehicle that came with two): *"This model year came with two bolt
  patterns: 5x114.3 and 5x120. Check your trim before you order."* (new copy, *derived*; three or more
  read "three", "four"; the count word and the patterns are filled in).
  **D165 (owner, 2026-10-11)** renamed the similar section `May also fit` and made it a closed `<details>`;
  **D175 (owner, same day) reverted the disclosure**: the section is always open as drawn (hairline, `<h2>`,
  one row of 3 cards), then `Show more` while more are hidden. It carries the 120px desktop page foot
  (`md:pb-30`). The count line and its live region are unchanged. `load-more-landing.tsx` lands on
  `#similar-N` after `Show more` as it does on `#result-N` after `Load more` (it watches `show:similar`).
  DEVIATIONS #132.
- [`components/call-cta-panel.tsx`](components/call-cta-panel.tsx) — `CallCtaPanel()`, Server,
  `md:hidden`. `Not sure which one?` panel, `tel:` CTA from `PRIMARY_CONTACT` (D47(1)).

- **D158:** `results-page.tsx` renders `CategoryTabs` (from `components/site/`) above the toolbar below
  `md:`, passes `view.query.vehicle` to `SiteHeader`, and `results-grid.tsx` hands the same vehicle object
  (not a label) to each `ProductCard`, whose links then carry it. `DEVIATIONS.md` #119, #120.

## Rules
- **An old vehicle name in the URL is redirected before the page renders** (D155, *derived*): `/tires`, `/wheels` and
  `/accessories` call `redirectToCanonicalVehicle` (`src/features/finder/canonical.ts`) first, a 308 to the same
  path with the params kept in order and `model` (and `make`) swapped to the finder list's spelling. `parseResultsQuery`
  itself stays exact (D91b) and never sees an alias.
- **Five more filter groups (D137), each filled for at least 70% of what it applies to.** Tires
  `load` (minimum load index); wheels `bore` (exact), `offset_min`/`offset_max` (the price slider's
  `RangeGroup`), `finish` (finish families); accessories `thread`, shown, parsed and counted only while
  `type` holds Lug Nuts, Lug Bolts or Wheel Locks. Flotation tires join Width (overall diameter) and
  Profile (section width). `query.ts` normalises hand-typed sizes before the first read
  (`5X114.3`, `17.0`, `8.50`). A new group must pass the same 70% test (`DEVIATIONS.md` #110).
- **Prices can be switched off (D122, `DEVIATIONS.md` #97).** With `PRICES_VISIBLE` false: `query.ts`
  ignores `min`/`max`, `SORT_OPTIONS` holds `Best match` alone and `HAS_SORT_CHOICE` is false, so neither
  sort control renders and the mobile bar's `Filters` cell takes the whole row, and `filter-panel.tsx`
  drops the price group. Cards pass the checked search vehicle to `Add to cart` (`results-grid.tsx`).
  Beneath that, `src/features/catalog/queries.ts` sends no price and ranks by none (D124), so a hidden
  price is neither in the page data nor in the order of `Best match`.
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
- **Result changes animate through list identity (D92b).** `CardGrid` wraps each card in
  `<ViewTransition key={slug} enter={`card-in-${Math.min(index % 6, 5)}`} exit="card-out"
  update="card-move" default="none">`: leavers fade, survivors travel, arrivals rise 12px 30ms apart
  (≤150ms). The index modulo is why `Load more`'s new cards (positions 6–8) still stagger. The live-region
  structure D72 fixed is untouched — the VTs wrap cards only. `results-page.tsx` wraps `<main>` and the
  footer in `PageTransition`, which stays mounted across same-route changes and so never animates them.

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| D132 | 2026-10-03 | (1) The size selects narrow one another on the buyer's own size parts only (see `search.ts` above); a URL's own value is always kept; tires `width=205` → profile 15 → 10 options, rim 17 → 7. (2) The brand fold stays open: `?brands=all`, set from the fold's state at each commit, plus server-side opening when a ticked brand is folded; closes Open #8. | Owner chose both fixes, 2026-10-03: a buyer picking 205 was offered sizes with no 205 tire and landed on `0 matches`; the fold closed after every filter change. | Owner, D132 |
| D93b | 2026-09-30 | `query.ts`, `search.ts` and `filter-panel.tsx` harden hostile URLs: a JS commit no longer pins min/max at the price bounds (WDG-07); unknown size values and brands do not count as filters, so the badge and the visible controls agree (WDG-08); an empty category renders no `$Infinity` (WDG-18). Proven by `tests/e2e/hostile-query.spec.ts`. | A shareable URL (D44) could put the page in a state its controls could not show. | QA pass WDG-07/08/18; D93b |
| D91b | 2026-09-29 | (1) `query.ts` accepts a vehicle only via `isFinderVehicle` (a new import of `finder/data`, a few KB in the islands' bundle); (2) the toolbar's vehicle row wraps and the chip truncates (`min-w-0`), so a long real vehicle no longer widens the page at 320 (was 333px); (3) the crumb wrapper is `text-11 leading-none md:text-12`, restoring the drawn 11px row (the mobile toolbar had sat 13px low); (4) `filter-sort-bar` carries `data-sticky-filter-bar`, the hook for the `globals.css` scroll padding that keeps keyboard focus out from under it (WCAG 2.4.11); (5) `results-grid` passes a `sizes` matching its 1/2/3-up grid; (6) the price fill carries `data-price-fill` for forced colours. | QA pass WDG-03, NJR-9, VPE-4, AXE-1, WDG-06, KBD-3 (`design/reports/qa.md`). | D91b |
| D91b | 2026-09-30 | `filter-panel` attaches its native `change` listener (and the refocus/close-on-arrival step) in `useLayoutEffect`, not `useEffect`: the form is keyed on `href`, and a click landing between the commit that re-mounts it and a passive effect toggled a control with no listener, so the change never reached the URL. `sort-select` has no such gap (React's delegated `onChange`). | QA pass FIN-2: 22 of 36 rapid chip/brand sequences dropped a click before the fix, 36/36 after (`results.spec.ts` › rapid filter changes). | D91b |
| D149, D151 | 2026-10-04 | The vehicle lookup takes the model year (`finder/fitment.ts`, server only); a part-filled finder submit sets `query.partialVehicle` and opens the toolbar's `Change vehicle` disclosure (`open`, server-rendered, so it works without JS) with Year/Make kept, a one-line prompt and the missing field focused. | LA-05 and the "finder silently discards a partly filled vehicle" P2 of the D145 audit. | Owner, 2026-10-04 (finder llm.md D149) |
| D151 | 2026-10-04 | Range thumbs (price, wheel offset) are 24×24 hit boxes whose drawn 16×16 handle is the content box (`background-clip: content-box`, 4px transparent padding, `range-input` in globals.css); the travel box in `RangeGroup` hangs 12px past each track edge and is 24px tall (`-inset-x-3 -top-0.5 h-6`) so D69's alignment holds for a 24px border-box. The box and the utility change together or the handles drift 4px. Not a transparent border: the arithmetic is redone, not dodged. | WCAG 2.5.8: the inputs measured 20px tall and the real target, the thumb, 16px (launch audit, D145, A11Y-AUTO). | Owner, 2026-10-04: "Apply all code items" |
| D155 | 2026-10-06 | The vehicle narrows tires, wheels and accessories through `tire-fit.ts` (see `search.ts` above); `ResultsView.boltChoice` and `BoltChoiceNote` say to check the trim when a model year came with two bolt patterns. | The finder's fit data grew from one bolt pattern and one rim to factory sizes, stock envelopes, two patterns, thread and fastener. | Owner, 2026-10-06 (quoted under `search.ts`) |
| D184, D185 | 2026-10-13 | QA fixes: the no-JS vehicle sheet shows its panel; the vehicle button label wraps to two lines; `ResultsView.vehicleNarrows` and the no-data wording; the sticky bar is `static` under 500px tall. | QA streams report (MODEL-1, LAYOUT-2, LAYOUT-3, FIT-3). | Owner, 2026-10-13: fix every P2 and P3; *"No-data car wording"*, *"Unpin bars on sideways phones"*; D184, D185 |
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
- Don't import `search.ts` or `catalog/queries.ts` from a client file — they read the database;
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
1. ~~Vehicle params drive the split through the placeholder `FITMENT` map.~~ **Closed by D155** (2026-10-06):
   the map is gone; the split reads the real fit data (`finder/llm.md`). The fit data is as complete as the
   generated `VEHICLE_SPECS`; TPMS is on or off only since D156 (no frequency).
2. ~~Stub links~~ (moot, **D71** removed `Category`, #60) and ~~no-JS mobile sheet~~ (D48(1): `showModal()`
   still needs JS to open it, but its footer `Apply` works without JS once open — the rail's own
   no-JS path went with `Apply`, #71, and isn't owed back).
3. Parity: `design/reports/results.md` (its five rail and three sheet `Category` rows are annotated as
   superseded). Deviations: #25–#35, #49–#53 (#52 superseded by D67), #60, #61–#63 (D72 toolbar), #68, #71.
4. **`/wheels` and `/accessories` have no parity report and are not parity rows** (#49) — they inherit
   `/tires`' parity by rendering the same tree, which stops the moment either diverges visually.
5. Every wheel and accessory SKU, brand, finish and price is **placeholder data** (D58 under D48), and
   five client photos cover the nine accessory SKUs (#51). Client, via owner.
6. ~~`wheel-size-grid`/`wheel-size-grid-sheet`~~ (closed, #67; dead code owed for removal, D25). Owner.
7. ~~**`Load more` drops keyboard focus to `<body>`**~~ **Closed by D133** (2026-10-03): the href names the
   first new card (`#result-N`) and `load-more-landing.tsx` scrolls to it and focuses its model link.
   Still true: nothing announces the new cards (the count is unchanged by `?show=`).
8. ~~**Brand rows fold after eight** and the fold closed again after every filter change.~~ **Closed by
   D132:** `?brands=all` carries an open fold across changes, and a ticked folded brand opens it.
   Left as known: toggling the fold alone does not touch the URL (it would cost a server round trip), so
   a reload right after opening it, with no filter change between, arrives closed; the toolbar's
   `Change vehicle` form does not carry `brands=all`; and with JS off, a fold opened by hand is not
   carried by a submit unless it holds a ticked brand.
9. ~~**The vehicle → size map is still the placeholder `FITMENT` table.**~~ Closed by D155.
10. ~~**A size picked by hand drops the vehicle's bolt pattern on `/wheels`**~~ Closed by D170 (client
    C2, owner 2026-10-11).
11. **Whether to hide a wheel whose bore is narrower than the hub** is parked (owner, 2026-10-06); it is
    `similar` today.
