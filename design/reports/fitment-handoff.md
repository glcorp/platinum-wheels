# Fitment data session: handoff (2026-10-06)

Read this first if you pick the work up. It is the state of the session that started from
[`fitment-questions-prompt.md`](fitment-questions-prompt.md). **Nothing is committed.** The working tree holds
the code and data changes listed in "What is built". Owner rulings are quoted verbatim.

## The aim

Owner, 2026-10-06: *"our aim is to get the fitment data one time which is for our data without paying any money so we need to explore all the open source options or you know data sets that we get from the internet or maybe what we have got from the vendor raw data we can extract something from that so that our website is able to fulfill all the filters and search requirements correctly and efficiently"*. Raw vendor data lives in `~/Platinum Wheels Vendor Data/Individual Vendors` (owner's pointer, 2026-10-06).

## What the research found (reports in `fitment-research/`)

| Fact | Free source | Verdict |
|---|---|---|
| Factory tire size per vehicle | none licensed for North America | `research-tires.md`: only manufacturer spec sheets by hand (85-130 h) |
| Wheel diameter, width, offset | ANKUSI file (already used) | diameter and width on 1,046 exact rows (13.9% of 7,528 offered model-years), 35% with generation propagation; offset 8.9%; one trim's wheel per year (`research-wheels.md`) |
| Lug thread, nut or bolt | ANKUSI pages state it; the CSV has no column | researched by hand, see below |
| TPMS frequency | PREMA chart (2004-2023, reuse terms unread) | not built; owner chose TPMS off |
| Vendor raw data | nothing usable | `research-vendor-local.md`, `research-vendor-raw-deep.md`: Vertex fitment tags on 22 wheels (Acura, Audi, Honda 2024-25, provenance looks Wheel-Size-style, not used); no vehicle fields elsewhere |
| Hub ring and spacer matching | catalogue states inner diameter (hub rings) | built for hub rings; spacers not built (bolt pattern and bore live in names, not columns) |

## Owner rulings this session (verbatim, 2026-10-06)

- Tires: *"contruct like a human would do based on our brands and tires adn other details"*. Confirmed as: derive tire fit from the factory rim, the **"Yes, and allow generation ranges (Recommended)"** option (a factory wheel size may serve its whole hand-kept generation range, for wheel size only; this breaks D149's "never fill from a neighbouring year" for rim size, not for bolt pattern).
- Tire height reference: **"Vehicle class bands (Recommended)"**.
- Lug thread: *"search internet and build youself. no mails"*.
- Accessories: **"Hub rings and spacers on, TPMS off (Recommended)"**.
- Centre bore: **"Fill 153 from same-range rows only (Recommended)"** (not built yet).
- No-data and unknown vehicles: *"fill it yourself based on vendors data and market data"*.
- Auto Country lookup: **"Probe 10 vehicles first (Recommended)"**. The probe is done (below). The follow-up question (how far to go) was **dismissed unanswered**, so nothing beyond the probe is approved.
- *"reduce the number of agents runnning in parallel. keep them max 6"*. Respect it: an agent that spawns its own helpers counts them (stopping a parent did not stop its helpers; 9 were stopped by hand).

## What is built (uncommitted, `tsc` clean, not yet tested against the database)

- `scripts/vehicle-fitment.mjs`: reads two new hand-kept sheets (`vehicle-thread-generations.csv`, `vehicle-wheel-sizes.csv`, both header-only today, validated with the same two-source and banned-source rules) and writes `VEHICLE_THREADS`, `VEHICLE_WHEEL_SIZES`, `VEHICLE_TYPES` and the rim size on each exact row (`<bolt>/<bore>/<dia>/<width>`) into `src/features/finder/vehicle-fitment-data.ts`.
- `src/features/finder/fitment.ts` rewritten: **the D48(4) placeholder map is deleted** (no placeholder tire size, thread or TPMS remain). `VehicleFitment` is now `boltPattern`, `centreBore`, `boltSource`, `rims[]` (sheet sizes plus ANKUSI's, ANKUSI's propagated within a generation range), `classes`, `thread`, `fastener`. `tpms` is gone.
- `src/features/finder/tire-fit.ts` (new): a tire suits a vehicle when its rim diameter is one of the vehicle's wheels (similar: one inch down, two up), its section width is within 0.75" (similar 1.25") of the measuring rim width, and its sidewall height is in the class band (`car` 75-145 mm, `mpv` 100-170, `truck` 125-205; a mixed class takes the union). Metric tires only.
- `src/features/catalog/queries.ts`, `catalog-types.ts`: `TireVehicleFit` filter; `contradictsBore` for hub rings (inner diameter against the vehicle's bore, 0.15 mm tolerance); `accessoryContradiction` replaces the thread-only rule.
- `src/features/results/search.ts`: tires take `vehicleFit` when no explicit size is chosen; accessories narrow on thread and hub bore; inch threads map `1/2x20` to the catalogue's `1/2 UNF`.
- `scripts/data/vehicle-fitment-generations.csv`: 67 resolved ranges merged (replacing `unknown` rows), validated by the generator. 1,060 rows.

**Not updated yet (do this before commit):** `scripts/data/llm.md`, `src/features/finder/llm.md`, `src/features/results/llm.md`, `src/features/catalog/llm.md`, the stale `fitmentSize` comment in `search.ts`, the doc comment of `VEHICLE_FITMENT_DATA` in the generator template, root `llm.md` (one new §5b row, next free ID after D154; check `origin/main` and open PRs, D98).

## Research results waiting to be merged

All under `fitment-research/` (copied from the session scratchpad, which is temporary).

- `unknown-ranges/part1..6-{resolved,split,still}.csv`: the resolved rows are **merged**. The splits (Ram 1500 2019-24, Bronco 2023+, Compass 2017, Kicks 2022-24, Sentra 2012, Vibe 2009-10, BMW 640i 2019) are left `unknown` (filter nothing); they need a ruling on splitting those models in the finder. Ford Focus 2011 was held back (sources conflict).
- `gap-fill-B.csv` (50 rows, 48 of 56 models) and `gap-unresolved-B.csv`: **not merged yet**. 6 rows are `unknown`.
- **Gap fill A (55 models, input `gaps-A.json`) and all four lug-thread groups (about 843 models in total, inputs `thread-1..4.json` in the scratchpad) were stopped on 2026-10-06 before any of them wrote a result file.** None of that research was saved: re-run it. Regenerate the thread inputs from `scripts/data/vehicles.csv` split by make if the scratchpad is gone. The Auto Country lookup (below) would supply thread and nut or bolt for the models it covers, so decide that first and re-run only what it leaves.
- `wheel-sizes-partial/wheels-*.csv`: partial all-trim factory wheel sizes (the agents were stopped to respect the 6-agent limit). Not merged; unvalidated against the sheet's rules.
- **Suspect existing rows to verify before trusting** (flagged independently by several agents): Acura MDX 2014-2016 (5x114.3, MDX is 5x120 from 2007), Nissan Kicks 2021 (ANKUSI 4x100, trim-dependent), Nissan Cube 2010 (ANKUSI 4x100, NA car is 4x114.3), Mazda MX-5 2016 neighbour row (5x114.3, the ND is 4x100), Nissan Sentra 2005-2011 (misses SE-R 5x114.3), MINI Convertible 2013, Integra Type S (5x120), Malibu 2016-2018 (no row; add 5x115). Several rows rest on boltpatternhq plus autofiles, which agents found wrong in many places (Audi e-tron GT, BMW 2/3 Series, ZDX, Civic Type R, Mach-E, Rio, Discovery, MINI Convertible): treat those pairs as one weak source.
- Finder years with no North American car (BMW M2 2022, M5 2017, Jeep Cherokee 2009-2011, Chevrolet Trax 2023, GMC Canyon 2013-2014, Scion xB 2007): consider dropping from `vehicles.csv` via `vehicles-fetch.mjs` rules.

## The Auto Country probe (moved 2026-10-06 to `~/Platinum Wheels Vendor Data/Individual Vendors/Auto Country/_working/nero-probe-2026-10-06/`: raw vendor answers stay outside the repo)

Owner-approved probe, 2026-10-06: 31 anonymous GETs, 1.5 s apart, no authorization header, to `https://autocountry.frb.io/frontend/v2/nero/{years, makes/<year>, models/<year>/<make name>, sub-model/<year>/<make>/<model>, options/<year>/<make>/<model>/<submodel>}`. Each options response carries bolt pattern, centre bore, offset, TPMS on/off, nut or bolt, thread, hex, torque, and every factory option as `option (tire size, wheel size)`. Checked on the 2021 Civic, 2019 F-150 (M14x1.5), 2021 Tacoma, 2020 Ram 1500, 2016 Equinox, 2022 RAV4, 2018 Rogue, 2021 CX-5, 2022 Outback: sizes plausible and the checked ones correct. Tesla Model 3 returned no trims (name mismatch). **Open risks:** the upstream provider is unnamed and the shape resembles Wheel-Size-style data (can't prove it isn't); Auto Country's dealer terms are unknown (recon found none). A top-150-models run is about 4,000 requests (about 1.5 h); the full run about 20,000. **Needs the owner's answer before any further call.**

## What to do next

1. No agent is running. Decide the Auto Country question first, then re-run gap fill A and whatever lug-thread research the lookup leaves, with at most 6 agents counting any helpers they spawn.
2. Ask the owner the dismissed question again, or move on without the lookup: use it for the top ~150 models, the full run, or not at all.
3. Merge: `gap-fill-A/B` rows into the generations sheet (`node scripts/vehicle-fitment.mjs` validates), thread rows into `vehicle-thread-generations.csv`, validated wheel-size rows into `vehicle-wheel-sizes.csv`.
4. Test against a real database: `FIXTURE_DB_PORT=55701 node tests/fixture/db-server.mjs`, `scripts/db-migrate.mjs`, then the importer on a catalogue built with `npm run catalog:build-csv -- --share "…/combined/share" --final "…/combined/final" --out <dir>` (the older `output/catalogue.csv` predates D142 and the importer refuses part of it). Run `npm run build && npx next start` (never dev, D88) and hit `/tires?year=2021&make=Honda&model=Civic`, `/accessories` and `/wheels` with several vehicles; count best and similar results; hit-test. Then `npm run test:e2e:fixture`.
5. Update the llm.md files and the root register, then commit when the owner asks.

## Limits and honesty

- Tire fit is **derived**, not factory-confirmed: the page must not say "checked to fit" for it (hero wording still open, prompt question 10).
- Tire coverage depends on rims: after propagation 35% of model-years have an ANKUSI rim, and the best-sellers are patchy (Civic 1 of 23 years, CR-V 1, CX-5 1, Outback 2). The wheel-size sheet or the lookup is what fixes that.
- Rim width tolerance and class bands were calibrated by hand on about 12 known factory sizes; no wide validation yet.
- Spacer narrowing and TPMS are not built. TPMS frequency has no source we may use.
- Another interactive session, "Fitment data reverse engineering", was started at the end of this one. Check what it is changing in `scripts/data/` and `src/features/finder/` before editing.
- A throwaway Postgres may still be running on port 55701 (started by this session); stop it with `pkill -f db-server.mjs`.
