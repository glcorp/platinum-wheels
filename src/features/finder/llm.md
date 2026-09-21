# src/features/finder

## Purpose
The vehicle finder: Year / Make / Model as native `<select>`s plus the `Find my tires` CTA (or
`Find my wheels` / `Find my accessories`, D58, D67). It is the
site's front door (`design/DESIGN.md` §5 "Finder … nothing else competes above the fold") and a hard
HLD rule makes the controls native (`docs/decisions.md` §5). Its own feature per `docs/decisions.md` §3,
because `/results` reuses it as "Change vehicle" (`design/manifest.md` §2 row 2) — and since D58/D67
`/wheels` and `/accessories` do too, each with its own submit target.

## Owns
Built at `page home`, 2026-09-20.
- [`components/vehicle-finder.tsx`](components/vehicle-finder.tsx) — `VehicleFinder`, a Server
  Component. A `<form method="get" action={ROUTES.results}>` with three native `Select`s
  (`year` / `make` / `model`, each `required`, each with a disabled placeholder option) and a submit
  `Button`. Ships unselected (D28). Measured: `design/inventory/home.md` §2.3 lines 152-165.
  Three props. `action?` and `cta?` (**D58**) default to `ROUTES.results` and `Find my tires`, the drawn
  target and the artboard-verbatim copy, so the home hero and `/results` are unchanged; `/wheels` passes
  its own route and `Find my wheels` so `Change vehicle` there cannot throw a wheel shopper back into
  tires. `/accessories` passes `/accessories` and `Find my accessories` (**D67**, owner 2026-09-22,
  vetoing D59(2)). All three targets come from `CATEGORY_CONFIG`; this component only takes props.
  `variant?: "hero" | "inline"`: `hero` is the default and is the
  home panel unchanged — the −72px mobile / −120px desktop hero overlap, side margins and container cap
  (`:34-38`); `inline` (D45) drops all three so the finder sits in flow inside the `/results` toolbar's
  `Change vehicle` disclosure (`:39-41`).
- [`data.ts`](data.ts) — `finderYears()` (current year down 11, **computed on call** — **D66** replaced
  the module-scope `CURRENT_YEAR` / `FINDER_YEARS` pair, which froze the list for the life of the server
  process, baked it into every prerender, and would have become a hydration mismatch the moment a
  `"use client"` file imported it; its own comment cited D32 while defeating it) and `FINDER_MAKES`
  (15 makes, 3-5 models each), the seed Year/Make/Model list (D27), flagged sample in its header. Built from public
  manufacturer model pages checked 2026-09-20, not from the wheel CSV (D9).
  Also `FitmentSize`, `FITMENT` (`"<Make>|<Model>"` → one tire size **and one bolt pattern**, all 60 seed
  pairs, year ignored) and `findFitment(make, model)`: the **placeholder** vehicle → fitment map (D48(4)),
  flagged sample in its header. The `bolt` field is **D58** and `thread` / `tpms` are **D67**:
  `/results` reads the tire size off an entry, `/wheels` reads only `bolt`, `/accessories` reads
  `thread` (lug-nut pitch, ASCII `12x1.5`) and `tpms` (`315` / `433`). Volkswagen is mapped to `5x112`,
  deliberately a pattern no seed wheel carries, so a VW submit exercises the no-exact-fit path. 38 of 60 pairs use one of the five sizes the catalog seed stocks so the best/similar
  split is demonstrable; 22 carry sizes the seed does not, so the empty `Best matches` state is reachable.
  `thread` is assigned by make and `14x1.5` is carried by no seed accessory, the same deliberate
  no-exact-fit path; VW is recorded as `14x1.5` **and flagged in the header as a simplification** —
  VW/Audi use bolts into the hub, not nuts on studs, and this map cannot say so.
  Not from the wheel CSV (D9); replace with real, year-specific fitment data.

## Rules
- Native `<select>` via `src/components/ui/select.tsx`. Never a custom combobox (`docs/decisions.md` §5).
- Ships **unselected** with a placeholder option per select (D28). The artboard pre-fill
  `2021 / Honda / Civic` is sample data and does not ship.
- No JavaScript required to submit: plain GET form to `ROUTES.results` with `year`, `make`, `model`
  query params. Progressive enhancement only, if ever.
- `data.ts` is sample data until real fitment data exists; say so in its header comment. That covers
  `thread` and `tpms` too: they are plausible per make, never looked up per trim or model year, and the
  header says so in those words (D67).
- **The year list is computed per render, never a module constant** — `finderYears()` is called in
  `vehicle-finder.tsx`'s JSX, not read from a binding (D32, D66).
- Measured values cite `design/inventory/home.md` §2.3 (lines 152–165).

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
None folder-scoped. Governing: **D27, D28, D33, D39**.

## Connects to
- Depends on: `src/components/ui/{select,field-label,button}.tsx`, `src/lib/routes.ts`.
- Depended on by: `src/app/(storefront)/page.tsx` (home §1 row 3, `variant="hero"`);
  `src/features/results/components/results-toolbar.tsx` — the `Change vehicle` `<details>` disclosure
  renders `<VehicleFinder variant="inline" action={route} cta={…} />` on all three results routes
  (D45, D58, D67);
  `src/features/results/search.ts` — `findFitment()` drives the best/similar split on all three
  (D48(4), D67): size for tires and wheels, `accessoryFitsVehicle()` on `thread`/`tpms` for
  accessories.

## Don't
- Don't derive makes, models, years, bolt patterns, thread pitches or TPMS frequencies from the wheel
  CSV (D9) — the D58 `bolt` and D67 `thread` / `tpms` values are authored placeholders like the rest of
  the map.
- Don't hard-code `ROUTES.results` back into the form. The default prop already spells it, and the
  override is what keeps `/wheels` from bouncing to tires (D58).
- Don't pre-select a vehicle (D28).
- Don't make the finder a client component to "improve" it; the OS picker is the point.

## Open
- Real fitment data source and who supplies it (root `llm.md` §7.3). Owner / client. Since D67 this
  is four facts per vehicle, not two, and thread pitch is the one a wrong value damages a wheel over.
- ~~Whether `/results` reads the three params or ignores them.~~ Answered: it parses `year`/`make`/`model`
  (all three or none) into `ResultsQuery.vehicle` (`src/features/results/query.ts:82-84,113`) and uses it
  only for the toolbar chip and the disclosure copy; it filters nothing, because no fitment data exists —
  `src/features/results/llm.md` Open #1, root `llm.md` §7.13. Owner / client for the real data.
- **Model select has no JS-driven Make dependency.** `vehicle-finder.tsx` is a Server Component
  submitting a plain GET form (this folder's own rule: "Don't make the finder a client component to
  'improve' it"), so the Model `<select>` cannot filter its options by the chosen Make client-side. It
  renders every model of every make in one list, grouped with `<optgroup label={make}>` — honest (the
  user sees which make each model belongs to) rather than silently wrong. A client-island upgrade that
  narrows Model options after Make changes is future work; not built here. Owner/HLD call.
- ~~`@utility finder-grid` is not yet added.~~ Added: `src/app/globals.css:431`. `vehicle-finder.tsx`'s
  `md:finder-grid` compiles.
