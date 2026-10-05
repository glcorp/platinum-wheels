# scripts/data

## Purpose
Reference data that a script writes or reads and that is committed, so a change to it is a diff someone
can review. Delete this folder and the vehicle finder has no Year / Make / Model list to load.

## Owns
- [`vehicles.csv`](vehicles.csv) — every make and model the finder offers, with the model years it was
  built. Written by [`../vehicles-fetch.mjs`](../vehicles-fetch.mjs) from NHTSA vPIC; 47 makes, 843
  models, model years 2005–2027 as fetched 2026-09-30. Columns: `make`, `model`, `years` (ranges
  joined by `;`, e.g. `2005-2011;2019-2027`), `types` (vPIC's `car` / `mpv` / `truck`, joined by `;`).

- [`vehicle-fitment.csv`](vehicle-fitment.csv) — real wheel fitment, one row per make + model + model
  year that the ANKUSI wheel fitment dataset (release 2026.10.04) publishes for **that exact year**,
  keyed on `vehicles.csv`'s spelling. Written by [`../vehicle-fitment.mjs`](../vehicle-fitment.mjs)
  (**D149**, LA-05 of the D145 audit): 1,224 model-years, 463 models, 42 makes. Columns: `make`,
  `model`, `year`, `bolt_pattern`, `centre_bore_mm`, `lug_count`, `oe_wheel_diameter`,
  `oe_wheel_width`, `oe_offset_mm` (blank unless one same-front-and-rear factory size is published),
  `source_model` (the ANKUSI name or names the row came from). No tire size: ANKUSI gives one on 430
  of 9,701 rows, nearly all other markets' cars, and the owner kept the D48(4) placeholder for tires.

- [`vehicle-fitment-generations.csv`](vehicle-fitment-generations.csv) — **hand-kept, never written by a
  script** (**D149**, LA-05; owner, 2026-10-05: *"Do a market search and vendor search to fill
  whatever is poss"*). One row per make + model + generation year range, for the years the exact-year file
  does not cover. Columns: `make`, `model` (vehicles.csv spelling), `year_from`, `year_to`, `bolt_pattern`
  (`5x114.3`, or `unknown`), `centre_bore_mm` (blank unless the two sources agree), `source_1`,
  `source_2` (full page URLs). 1,048 rows: 972 real rows on 595 models and 76 `unknown` rows. Resolution
  of the 7,528 offered model-years (2026-10-05): 1,224 exact, 3,979 generation, 1,656 nearest, 167 none
  (inside an `unknown` range), 502 with no real row and no placeholder either (no vehicle data), 0 placeholder.

## Generation rows: sourcing rule
- A row goes in only when **two independent free sources on two different websites** both name the vehicle
  and year range and agree on the bolt pattern. Disagreement or one source: no row.
- **Never** a Wheel-Size.com source or anything derived from it. The script rejects `wheel-size.com`,
  `wheel-sizes.com`, `faultpedia.com`, `tirerack.com`, `tiresize.com`, `teoalida.com` and
  **`tirewheelguide.com`** (banned 2026-10-05: its make list, with Aiways, Arcfox, Avatr, Ciimo, Dorcen, is
  Wheel-Size's own). `autofiles.com`, `bolt-patterns.com` and `wheeloffset.net` share a template and
  errors and count as one site.
- Not proven independent: `autofiles.com` and `boltpatternhq.com` agree almost everywhere, and the latter's
  About page says its records come partly from "historical wheel-size datasets". Owner, 2026-10-05: *"Yes,
  keep it (Recommended)"*: boltpatternhq counts as one of the two sources. `carsandcollectibles.com`
  (35 group-E rows) is accepted too (derived: agrees on 1,170 model-years, none contradicted).
  Known errors in them: boltpatternhq has Accent 2013+, Rio 2018+, Charger and Challenger on 5x114.3 and
  autofiles has Viper on 6x114.3; both are why a row needs agreement, not one site.
- A `bolt_pattern` of `unknown` marks years nobody should claim: it blocks the nearest-year rule and the
  placeholder there. It needs `source_1` (a page that shows why) and no `source_2`. 76 rows, from three
  rules: a gap between two real years whose patterns differ (Outback 2014, Ram 1500 2019-2024), a
  single-source dissent against what nearest-year would give (BMW 5/7-series 2017-2019, Mach-E 2023-2024),
  and by hand (Bronco 2023-2027: Raptor is 6x135; Charger 2024-2027: new platform).
- **Precedence in the app:** exact-year ANKUSI row, then generation row, then the **nearest real year** of
  the same model (owner, 2026-10-05: *"Use the nearest real year"*; equidistant takes the later year,
  derived), then the D48(4) placeholder only for a model with no real row at all, then nothing
  (`finder/fitment.ts`).
- Where a generation row disagrees with an exact row the script lists it (`import-report/`
  `vehicle-fitment-generation-review.csv`) and the exact row wins. First run: 0.

## Licence

ANKUSI publishes the dataset under CC BY 4.0, which asks for a credit on the site. Owner, 2026-10-04:
*"use but give no credit. we have agreed on mail with them"*. The agreement itself is not on file; the
owner's statement is (the D129 precedent). So: no credit line on the site, and the raw ANKUSI file is
not committed (1.6 MB, and its own LICENSE asks for the credit the agreement waives). Download it from
`https://ankusiwheels.com/wp-content/uploads/dataset/ankusi-wheel-fitment.csv` to rebuild.

## Spot check (2026-10-04)

21 rows checked against free public pages (wheel-sizes.com, wheel-size.com listings,
boltpatternhq.com, retailer and owner-forum pages), on top of the 20 of 20 the LA-05 research had
checked: **17 right, 3 wrong, 1 trim-dependent**, all four now excluded.
- Right: 2007 Corolla 5x100, 2024 Lincoln Nautilus 5x114.3, 2007 Hyundai Entourage 6x139.7, 2020
  Hyundai Venue 5x114.3, 2007 Chrysler Pacifica 5x127, 2022 Rivian R1T 5x139.7, 2016 Chevrolet Equinox
  5x120 / 66.9, 2021 Ford Bronco 6x139.7 / 93.1, 2024 Toyota Tacoma 6x139.7 / 95.1, 2023 Dodge Hornet
  5x110, 2018 Nissan Kicks 4x100, 2025 Subaru Outback 5x114.3 / 56.1, 2013 Cadillac CTS 5x120 / 66.9,
  2008 Nissan Pathfinder 6x114.3 / 66.1, 2023 Toyota Prius 5x114.3 / 60.1, 2013 Chevrolet Traverse
  6x132 / 74.5, 2013 Lincoln MKZ 5x108.
- Wrong: 2019 and 2020 Corolla (ANKUSI 5x114.3, the European car, even a row tagged `[US]`; the North
  American car is 5x100 / 54.1, so 2023 and 2025 go too); 2006 Buick Terraza (6x114.3, really 6x115).
- Trim-dependent: 2005 Chevrolet Cobalt (4x100 base, 5x110 SS).
- Also excluded on review: 2019 Ram 1500 and 2025 Porsche Macan, where one vehicles.csv model is two
  cars with two bolt patterns (1500 Classic; Macan Electric). Every exclusion is in the script's
  `EXCLUDED`, with its reason.

## Rules
- **`vehicles.csv` is generated. Never edit it by hand.** A wrong, missing or misnamed model is fixed
  by a rule in `vehicles-fetch.mjs` (`EXCLUDED`, `RENAMED`, `SPLIT`, `ADDED`) and a re-run, or the next
  run puts the mistake back.
- **It carries no tire size and no bolt pattern.** vPIC has neither. Fitment is keyed on this file's
  exact `make` and `model` spelling: bolt pattern and bore in `vehicle-fitment.csv` (ANKUSI; D110's
  "no open data set" held for government sources only), tire size still nowhere.
- **`vehicle-fitment.csv` is generated too.** A wrong row is fixed by a rule in `vehicle-fitment.mjs`
  (`EXCLUDED`, `ALIASES`, `TRIM_WORDS`) and a re-run, never by hand. **Never fill a year from a
  neighbouring year**: a model's bolt pattern changes between generations (Outback 5x100 → 5x114.3).
- After either CSV changes, re-run `node scripts/vehicle-fitment.mjs` so the app's two generated
  modules (`src/features/finder/vehicle-list.ts`, `vehicle-fitment-data.ts`) match.

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | No folder-scoped rows. | **D110** governs this folder. | root `llm.md` §5b |

## Connects to
- Depends on: `scripts/vehicles-fetch.mjs` (writes `vehicles.csv`), `scripts/vehicle-fitment.mjs`
  (writes `vehicle-fitment.csv` from the ANKUSI download; validates the hand-kept generations CSV).
- Depended on by: `scripts/vehicle-fitment.mjs`, which compiles both into
  `src/features/finder/vehicle-list.ts` and `vehicle-fitment-data.ts` (the finder and the results split).

## Don't
- Don't add a heavy-duty pickup back under its half-ton's name. `Silverado 1500` and
  `Silverado 2500HD` are separate rows because they do not share a bolt pattern
  (`vehicles-fetch.mjs` `SPLIT`).
- Don't treat a model's presence here as "sold in Canada". vPIC is a US register; a few rows are
  US- or Mexico-market cars that `EXCLUDED` has not caught.

## Open
1. **No tire sizes.** `vehicle-fitment.csv` has bolt pattern and bore only; factory tire sizes still
   need D110's hand-kept sheet (or a licensed source). Until then tires use the D48(4) placeholder.
   Co-founder.
2. **Coverage, 2026-10-05 (D149):** of 7,528 offered model-years, 1,224 are ANKUSI exact-year rows, 3,979
   generation rows, 1,656 nearest real year, 167 inside an `unknown` range and 502 have no data (mostly the
   newest EVs and rare models). Most generation rows rest on autofiles plus boltpatternhq, which likely
   share upstream data; about 70 rows have an independent wheel-shop or wheel-maker source. A phone check
   of the best-selling models with a tire shop would firm them up. Co-founder.
3. ~~**Corolla 2015-2024 is contested.**~~ **Closed 2026-10-05 (D149):** the Corolla is 5x100 for every
   year the finder offers (owner, 2026-10-05: *"make it 5x100"*). The 2015-2024 row stays 5x100 / 54.1
   (autofiles, yourautovision's North American chart, boltpatternhq; ANKUSI's own North American rows for
   2007, 2010, 2014 and 2017 agree); 2025-2027 take it by nearest year. The 5x114.3 readings are the
   overseas E210, the Corolla Cross and the GR Corolla, which the finder lists as separate models.
4. **Nearest-year borrows across years with no source.** An end-of-range gap (a model's last real year to
   2027) takes that year's pattern; only a redesign the research happened to flag is guarded by an
   `unknown` row. Revisit when 2025-2027 sources exist. Co-founder.
5. **Research left out:** models with one source or a disagreement (listed in the session scratchpad,
   not committed), Ram 1500 2019-2024 and Bronco 2023-2027 (two cars under one name). Co-founder.
6. **No database table.** The finder reads the generated modules; nothing loads either CSV into Postgres,
   and at ~25 KB + ~30 KB nothing needs to. `scripts/llm.md` Open #4. Owner.
