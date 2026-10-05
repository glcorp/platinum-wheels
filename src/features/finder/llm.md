# src/features/finder

## Purpose
The vehicle finder: Year / Make / Model as native `<select>`s plus the `Find my tires` CTA (or
`Find my wheels` / `Find my accessories`, D58, D67). It is the
site's front door (`design/DESIGN.md` §5 "Finder … nothing else competes above the fold") and a hard
HLD rule makes the controls native (`docs/decisions.md` §5). Its own feature per `docs/decisions.md` §3,
because `/tires` reuses it as "Change vehicle" (`design/manifest.md` §2 row 2) — and since D58/D67
`/wheels` and `/accessories` do too, each with its own submit target.

## Owns
Built at `page home`, 2026-09-20.
- [`components/vehicle-finder.tsx`](components/vehicle-finder.tsx) — `VehicleFinder`, a Server
  Component. A `<form method="get" action={ROUTES.tires}>` with three native `Select`s
  (`year` / `make` / `model`, none `required` — D79, root `llm.md` §5b — each with a disabled
  placeholder option) and a submit `Button`. Ships unselected (D28). Measured: `design/inventory/home.md`
  §2.3 lines 152-165.
  Three props. `action?` and `cta?` (**D58**) default to `ROUTES.tires` and `Find my tires`, the drawn
  target and the artboard-verbatim copy, so the home hero and `/tires` are unchanged; `/wheels` passes
  its own route and `Find my wheels` so `Change vehicle` there cannot throw a wheel shopper back into
  tires. `/accessories` passes `/accessories` and `Find my accessories` (**D67**, owner 2026-09-22,
  vetoing D59(2)). All three targets come from `CATEGORY_CONFIG`; this component only takes props.
  `variant?: "hero" | "inline"`: `hero` is the default and is the
  home panel unchanged — the −72px mobile / −120px desktop hero overlap, side margins and container cap
  (`:34-38`); `inline` (D45) drops all three so the finder sits in flow inside the `/tires` toolbar's
  `Change vehicle` disclosure (`:39-41`).
- [`components/finder-model-sync.tsx`](components/finder-model-sync.tsx) — `FinderModelSync`, the
  folder's leaf `"use client"` island besides `FinderSwitchSubmit` (**D70**, owner 2026-09-22: *"model
  should only show for those whose make is selected"*; **D149**, LA-05 of the D145 audit: by year
  too). Renders `null`. On mount and on every Year or Make change it sets `hidden` **and** `disabled` on
  the Make options no model was built in that year, and on the Model `<optgroup>`s and `<option>`s that
  are another make's or were not built that year (each option carries `data-years`). An `optgroup`'s
  `hidden` does not hide its options, so both attributes go on the options too. Resets a Make or Model
  the change orphans, and focuses `focusId` once on mount (the part-filled vehicle, below).
- [`data.ts`](data.ts) — client-safe. `FINDER_MAKES` (47 makes, 843 models, each with its model years)
  from the generated `vehicle-list.ts`; `finderYears()` (next model year down to 2005, **computed on
  call**, D32/D66); `isFinderVehicle()` (D91b: a listed year, make, and a model of that make **built in
  that year**); `partialVehicle()` (LA-05 P2: what a part-filled submit kept and lacks, only ever list
  strings). Imported by `results/query.ts`, which a client island imports, so it must never import
  fitment.
- [`years.ts`](years.ts) — `yearRanges()` / `builtIn()` over vehicles.csv's `2005-2011;2019-2027`
  notation. Separate so the island reads ranges without bundling the vehicle list.
- [`fitment.ts`](fitment.ts) — `server-only`. `findFitment(year, make, model)` → `VehicleFitment`
  (`boltPatterns[]`, `centreBore`, `boltSource`, `offset`, `tireSizes[]`, `flotationSizes[]`,
  `tireRange`, `rims[]`, `wheelRange`, `classes`, `thread`, `fastener`, `yearSource`; all D155). **Per
  field, in order (owner, 2026-10-06: "priority is vendor then factory"):** `VEHICLE_SPECS` for the exact
  year (the generated table, Auto Country first), then the older sheets for the exact year (the ANKUSI
  rows `VEHICLE_FITMENT_DATA`, the hand-kept generation rows `VEHICLE_FITMENT_GENERATIONS` where a range
  marked `?` claims nothing, `VEHICLE_THREADS`, `VEHICLE_WHEEL_SIZES`), then the **nearest real year** of
  the model across both (D149/owner 2026-10-05: *"Use the nearest real year"*; equidistant takes the
  later year, no distance cap), then nothing. The nearest-year step runs per **group** (mount: bolts,
  bore, offset; lug: thread, fastener; wheels; tires), and the lug, wheel and tire groups borrow only
  from a year with the same bolt patterns as the settled mount (*derived*: a new pattern is a new
  platform). A year inside a `?` range borrows nothing. `yearSource` is `nearest` when any group was
  borrowed. `VEHICLE_ALIASES` resolves an old model name to the canonical car first. Two bolt patterns
  are kept as two (owner, 2026-10-06: *"Two bolt patterns in one model-year: Show wheels for both
  patterns."*). A vehicle in none returns `null` and filters nothing (D110).
- [`canonical.ts`](canonical.ts) — `server-only`. `canonicalVehicleHref()` / `redirectToCanonicalVehicle()`
  (D155, *derived*): when `year`/`make`/`model` in a URL fail `isFinderVehicle` but `VEHICLE_ALIASES` maps the
  asked `make|model` to a canonical vehicle that passes it for that year, the three category routes and
  `/products/[slug]` `permanentRedirect` (308) to the same path with every param kept in order and only
  `model` (and `make`, if its spelling differs) replaced from the list's own strings. `null` (no redirect)
  when the URL already names a finder vehicle (no loop), names none, or the canonical car was not built that
  year. Exists because `isFinderVehicle` is client-safe and cannot import the alias map.
- [`tire-fit.ts`](tire-fit.ts) — `tireFit(fit)` and `wheelFit(fit)` build the two small shapes the
  catalogue filters read (`TireVehicleFit`, `WheelVehicleFit`, `catalog/catalog-types.ts`); the catalogue
  never learns what a vehicle is. The rules are in the file header and in `catalog/llm.md`.
- [`vehicle-list.ts`](vehicle-list.ts), [`vehicle-fitment-data.ts`](vehicle-fitment-data.ts) —
  **generated** by `scripts/vehicle-fitment.mjs` from `scripts/data/vehicles.csv` and
  `scripts/data/vehicle-fitment.csv` and `vehicle-fitment-generations.csv`. Never edited by hand.

## Rules
- Native `<select>` via `src/components/ui/select.tsx`. Never a custom combobox (`docs/decisions.md` §5).
- Ships **unselected** with a placeholder option per select (D28). The artboard pre-fill
  `2021 / Honda / Civic` is sample data and does not ship.
- **No field carries `required` (D79).** The browser's native constraint-validation bubble is browser
  chrome, not page content — it cannot be restyled to the design system, so the fix is removing what
  fires it rather than dressing it up. An empty or partial submit is not an error state: it names no
  vehicle (`src/features/results/query.ts` "All three or none") and the destination category page
  renders unfiltered, same as the bare route. A submitted pair that does not belong together resolves
  the same harmless way through `findFitment()`'s exact-string lookup returning `null` on no match
  (`data.ts`). No `FieldError`, no error summary and no new `"use client"` island were added for this —
  there is no invalid state to report.
- No JavaScript required to submit: plain GET form to `ROUTES.tires` with `year`, `make`, `model`
  query params. **Enhancement never gates a field.** `FinderModelSync` (D70) is the one script here and
  it may only narrow what is already rendered; the server must keep rendering every make's models, so
  a scripting-off visitor can still reach every one of them.
- **Narrow by attribute, never by removing options.** Non-matching `<optgroup>`s **and their child
  `<option>`s** get `hidden` (gone in current Chrome/Firefox/Safari) *and* `disabled` (unselectable
  everywhere, including older WebKit that ignores `hidden` on an option). The attributes must be set on
  the options themselves, not only the group — an optgroup's `hidden` does not hide its options, only
  its own label. Deleting or rebuilding the option nodes would be mutating React's server-rendered tree
  behind its back (D70).
- **Nothing is narrowed before a Year or Make is chosen** — the list is then exactly the no-JS list,
  and the `Model` placeholder copy is unchanged (D28).
- **An old model name is redirected, never accepted in place** (D155, *derived*, owner's "Auto Country's name
  wins and ours becomes an alias so old URLs still resolve"). `isFinderVehicle` stays exact; the redirect
  in `canonical.ts` is the only place `VEHICLE_ALIASES` meets a URL, and it never echoes raw URL text (D91b).
- **Fitment never reaches a client bundle.** `fitment.ts` is `server-only`; `data.ts` and `years.ts`
  stay free of it, because `results/query.ts` (imported by the filter rail island) imports `data.ts`.
- **A year with no real row borrows the nearest real year of the same model** (LA-05, owner 2026-10-05;
  per group and same bolt patterns since D155). A redesign the research flagged is fenced with an `unknown`
  generation row (`?`), which blocks borrowing.
- **No placeholder fitment remains** (D48(4)'s map is gone, 2026-10-06). Every field `findFitment` returns
  is stated by a source for that model, from the exact year or the nearest real year, or it is absent.
- **A vehicle's facts reach the catalogue only through `tire-fit.ts`** (D155): the catalogue filters take
  `TireVehicleFit` / `WheelVehicleFit` and the accessory facts (`thread`, `fastener`, `hubBore`), never a
  `VehicleFitment`, so nothing under `catalog/` imports this folder.
- **The year list is computed per render, never a module constant** — `finderYears()` is called in
  `vehicle-finder.tsx`'s JSX, not read from a binding (D32, D66).
- **A part-filled submit is answered, not dropped** (LA-05 P2): `VehicleFinder`'s `partial` prop keeps
  the known fields, shows one line (`Choose your model to see what fits.`) tied to the missing selects
  by `aria-describedby`, and the island focuses the first missing field. Only list strings are passed
  back in, never URL text (D91b).
- Measured values cite `design/inventory/home.md` §2.3 (lines 152–165).
- **The hero finder's category is switched from outside, never chosen inside it (D128).** No category
  control is drawn in the panel; the header's Tires / Wheels / Accessories are the switch on `/`. The
  CTA copy and target come from `CATEGORY_CONFIG` only, never typed here again.
- **The no-JS page is the D58 page.** `switchable` may change the CTA copy and `formAction` after
  hydration and nothing else; the server render says `Find my tires` and submits to `/tires`.
- **The compact phone row is hero-only and `max-sm:`-scoped.** `fold-short` also matches tablets and
  desktops, whose grids set their own tracks; unscoped it would overwrite `md:finder-grid`.
- **The hero's `hero-fit` reserves this panel's height** (269 / 188 / 112px, globals.css D128 block).
  A change to the panel's height, padding or rows means re-measuring those numbers.

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| D93b | 2026-09-30 | `VehicleFinder` accepts hidden `carry` inputs, so `Change vehicle` keeps the active filters while the vehicle fields stay empty. | Changing vehicle silently dropped every filter (WDG-17). | Owner: "Keep filters, stay empty"; D93b |
| D91b | 2026-09-29 | `isFinderVehicle(year, make, model)` in `data.ts` is the one authority on what counts as a vehicle; `results/query.ts` and `product/view.ts` both call it, and anything else is "no vehicle". | The URL vehicle was printed verbatim in the results chip, the best-none note and the PDP quote chip, so any link could write its own text and phone number onto the page (escaped, never executed). Narrows D79. | Owner, 2026-09-29: "Accept finder vehicles only" |
| D149, D151 | 2026-10-04 | The finder lists NHTSA vPIC's 47 makes and 843 models, Model narrowed by Year and Make (D110's approved design); wheel bolt pattern and centre bore come from the ANKUSI dataset for the exact model year; tire size, lug thread and TPMS stay the D48(4) placeholder (**superseded by D155**: the placeholder is gone); a part-filled submit reopens the finder with a prompt. | LA-05 and two P2 rows of the D145 audit: placeholder bolt patterns wrong for 21 of 60 vehicles, 45 impossible year combinations, a part-filled vehicle silently dropped. | Owner, 2026-10-04: fix the fit data *"as per vendors and market data"* with *"free data avaialable no payments"*; ANKUSI *"use but give no credit. we have agreed on mail with them"*; *"Keep placeholder for tires"*; fit labels *"No, keep until replaced"* |
| D155 | 2026-10-06 | `findFitment` resolves each fact from the generated `VEHICLE_SPECS` first, then the older sheets, then the nearest real year (per group, same bolt patterns); old model names resolve through `VEHICLE_ALIASES`; two bolt patterns are kept and both are listed; `tire-fit.ts` turns the fitment into the tire and wheel filters (best = factory size / inside the stock wheel envelope, similar = inside the stock tire envelope / outside the wheel envelope). | The finder's wheel and tire results need more than one bolt pattern and one rim. | Owner, 2026-10-06: *"priority is vendor then factory. use best and similar both techniques."*; *"Two bolt patterns in one model-year: Show wheels for both patterns."*; *"we have only commit a loose fit to the client. So you don't have to be precise to the last spec if major of the filters work correctly then it's good"*. Everything else in the row is *derived* (see `results/llm.md`, `catalog/llm.md`). |
| D128 | 2026-10-03 | On `/` the header switches the hero finder between tires, wheels and accessories (`switchable`, `FinderSwitchSubmit`); the CTA aligns to its row's end from `sm:`; the hero panel compacts on short phones so it sits above the fold. | Owner: the CTA was "off if we change the resolution" (1084×1116), "visible only after scroll in the mobile view", and header Wheels / Accessories "should stay on the home page and refresh that part only". | Owner, 2026-10-03; D128 |
Governing: **D27, D28, D33, D39, D79**.

## Connects to
- Depends on: `src/components/ui/{select,field-label,button}.tsx`, `src/lib/routes.ts`, and `react`
  (`useEffect`) in the leaf islands (D70, D128); `src/features/catalog/categories.ts`
  (`CATEGORY_CONFIG`, D37's sanctioned edge) and `src/lib/finder-category.ts` +
  `finder-category-store.ts` (D128); the `fold-short` variant and `finder-cta-label` in `globals.css`.
- Depended on by: `src/app/(storefront)/page.tsx` (home §1 row 3, `variant="hero"`, `switchable` since
  D128); `src/components/site/site-nav-links.tsx` and `site-nav-drawer.tsx` write the category it reads,
  through `src/lib/`, never by importing this folder (D37);
  `src/features/results/components/results-toolbar.tsx` — the `Change vehicle` `<details>` disclosure
  renders `<VehicleFinder variant="inline" action={route} cta={…} />` on all three results routes
  (D45, D58, D67);
  `src/features/results/search.ts` — `fitment.ts` `findFitment(year, make, model)` and `tire-fit.ts` drive
  the best/similar split on all three: factory tire sizes and stock envelope on tires, bolt patterns,
  wheel envelope and hub bore on wheels, thread, fastener and hub bore on accessories (D67, D109(12),
  LA-05, D155); `results/query.ts` and `product/view.ts` call
  `isFinderVehicle`, and `query.ts` `partialVehicle` for the toolbar's prompt.
- Generated from: `scripts/vehicle-fitment.mjs` (`vehicle-list.ts`, `vehicle-fitment-data.ts`).

## Don't
- Don't derive makes, models, years, bolt patterns, thread pitches or TPMS frequencies from the wheel
  CSV (D9). Makes, models and years come from vPIC (`scripts/data/vehicles.csv`); every other fact comes
  from the generated `VEHICLE_SPECS` or the older sheets named under `fitment.ts` above. TPMS has no source
  and is off (owner, 2026-10-06).
- Don't edit `vehicle-list.ts` or `vehicle-fitment-data.ts`; change the CSV or the script and re-run it.
- Don't import `fitment.ts` from anything a client island imports (it is `server-only` on purpose).
- Don't turn the centre bore into a hard filter: aftermarket wheels are bored large and fitted with hub
  rings, so a wheel narrower than the hub is `similar`, never hidden. Whether to hide it is parked (D155).
- Don't derive a wheel envelope from the known wheel sizes: one trim's wheel would wrongly push the other
  trims' wheels to `similar`. Only the generated table's `wheelRange` is an envelope (D155).
- Don't hard-code `ROUTES.tires` back into the form. The default prop already spells it, and the
  override is what keeps `/wheels` from bouncing to tires (D58).
- Don't pre-select a vehicle (D28).
- Don't make the finder a client component to "improve" it; the OS picker is the point.
  `VehicleFinder` is still a Server Component after D70 — the island it renders is a leaf that draws
  nothing. A client `<select>` rebuilding its own options would break the plain GET (D44, D45).
- Don't give `FinderModelSync` any markup, class or style. It is inside a measured panel; rendering
  nothing is what keeps every parity row untouched.
- Don't add a category picker inside the panel, or make the Year/Make/Model lists differ per category:
  the owner chose the header as the switch and the same three selects for all (D128).
- Don't move the switchable CTA's target into the form's `action`: that is the no-JS path and must stay
  `/tires`; the category lives in the button's `formAction` (D128).
- Don't put `required` back on a finder select to "fix" the bubble a different way, and don't build a
  styled error summary for an empty submit (D79). There is nothing invalid about it — it is D28's
  unselected ship state reaching the destination route, not a rejected form.

## Don't chase this one in dev

`FinderModelSync` resolves both selects with `document.getElementById`. In `next dev` the page can sit
mid-stream with the whole finder still inside `<div hidden>`, so that call returns a node in a tree
nobody can interact with and the narrowing appears dead — measured 2026-09-22: Make set to `GMC`, change
fired, all 15 groups still visible. **In a production build it works** (one copy, `GMC` group only, 4
options). Same streaming mechanism as **D80**, seen from the other side. Verify this behaviour against
`next build && next start`, never against the dev server.

## Open
- **Fit data is real since D149 and D155, and still partial.** Bolt pattern, hub bore, wheel and tire
  envelopes and factory sizes are as complete as the generated `VEHICLE_SPECS` is; a model-year it lacks
  borrows the nearest real year of the same platform, and a `?` range borrows nothing. Not built: TPMS
  frequency (no source, owner 2026-10-06), wheel spacers, and the parked question of hiding a wheel whose
  bore is narrower than the hub. The old placeholder half is gone. Co-founder.
- ~~Whether `/tires` reads the three params or ignores them.~~ Answered: it parses `year`/`make`/`model`
  (all three or none) into `ResultsQuery.vehicle` (`src/features/results/query.ts:82-84,113`) and uses it
  only for the toolbar chip and the disclosure copy; it filters nothing, because no fitment data exists —
  `src/features/results/llm.md` Open #1, root `llm.md` §7.13. Owner / client for the real data.
- ~~**Model select has no JS-driven Make dependency.**~~ **Closed 2026-09-21 → 2026-09-22 by D70:**
  the owner reported that `Model` listed every make's models at once. The server still renders all of
  them under `<optgroup label={make}>` — that is the no-JS path and it is unchanged — and
  `components/finder-model-sync.tsx` narrows the list to the chosen make when JS is available. What is
  still open is the smaller half: a visitor who picks a Model **before** a Make is not offered the
  matching make automatically, because the enhancement deliberately does nothing until a Make is
  chosen. Since D79 removed `required` from every field, nothing stops that submit at the browser
  either way — it was never the mechanism that made a mismatch harmless; `findFitment()` returning
  `null` on no match is (see Rules). Owner, if the auto-offer is ever wanted.
- ~~`@utility finder-grid` is not yet added.~~ Added: `@utility finder-grid` in `src/app/globals.css` (cited by name — line numbers there shift, `HANDOFF.md` §8.21). `vehicle-finder.tsx`'s
  `md:finder-grid` compiles.
