# Fitment coverage (D155)

What the vehicle finder knows about each car, where it came from, and what it shows from our catalogue.
Built 2026-10-06 by the fitment build session ([`fitment-build-prompt.md`](fitment-build-prompt.md)). Every
number here is from `npx tsx scripts/fitment-coverage.ts <catalogue.csv>` on the catalogue built that day
(`npm run catalog:build-csv`, 39,950 products: 8,386 tires, 29,838 wheels, 1,726 accessories), unless a
line says otherwise. The counter re-implements the page's SQL in plain JS and was checked against it
(below). Parked questions are in [`fitment-parked.md`](fitment-parked.md).

## Sources, in the order trusted

Owner, 2026-10-06: *"priority is vendor then factory. use best and similar both techniques."* and *"if there
is any disagreement on whatever we have already built from or live fitment data, then you can always put auto
country data first."*

1. **Auto Country's public vehicle lookup** (`scripts/autocountry-crawl.mjs`): years 2005 to 2026, every make,
   model and trim, plus the stock range per body and chassis. About 57,200 anonymous requests at 8 a second,
   no refusals; 169 trims 404 because their names contain a slash ("R/T"), and no model-year lost all its
   trims to that. 9,665 Auto Country model-years over 1,367 models. Raw answers stay in
   `~/Platinum Wheels Vendor Data/Individual Vendors/Auto Country/_working/nero/` (not committed).
2. **Direct Auto Import and PRO WHEELS public lookups**: targeted, for the gaps only (`fitment-parked.md` #7).
3. **Car makers' own pages and manuals.**
4. **Our older committed sheets** (ANKUSI exact years, the hand-kept generation ranges).
5. **Other websites**, the formerly banned ones included, on the owner's statement: *"we have permisiion to
   view and use data from them so go ahead."* No document is on file.

One source is enough (owner: *"A value with one source only: load it directly."*); a single-source value is
marked `1` in `scripts/data/vehicle-fitment-vendors.csv`.

## Before and after

The finder offers **8,882 model-years** (1,061 models over 72 makes), up from 7,528 (843 models): the list
is now the union of Auto Country's and NHTSA's (owner: *"union of both is best. dont lose data."*). Every
model-year offered before still resolves, directly or through an old name.

| Fact | Before (origin/main, D149 and the handoff) | After |
|---|---|---|
| Bolt pattern | ~91% (502 no data, 167 unknown of 7,528) | **99.5%** (8,839) |
| Centre bore | under half | **99.0%** |
| Lug thread | placeholder (D48) | **99.4%** |
| Nut or bolt | none | **97.7%** |
| Factory tire sizes | placeholder (D48) | **99.4%** |
| Factory wheel sizes | about a third (35% after range borrowing) | **99.6%** |
| Stock tire range | none | **97.8%** |
| Stock wheel range (diameter, width, offset) | none | **96.9%** |

Year source: 8,183 exact, 681 the model's nearest real year (the D149 rule; mostly 2027, which Auto Country
does not list yet), 18 none. Bolt pattern source: Auto Country 8,577; ANKUSI 108; generation sheet 54;
vendor lookups 53; other web 44; maker 1; our sheets 2; none 43.

## Overrides of live data

Auto Country overrode **350** values the committed sheets held (`fitment-overrides.csv`): 238 factory wheel
sizes, 105 centre bores, 7 bolt patterns. The bolt patterns: BMW 228i 2020-21 (5x112, the Gran Coupe; was
5x120), Nissan Cube 2010 (4x114.3; was 4x100), Smart Fortwo 2015 (3x112; was 4x100), Toyota Corolla iM 2017
(5x114.3; was 5x100), Buick Terraza 2006-07 (6x115; was 5x115, kept per the ruling although it looks wrong,
`fitment-parked.md` #9). Centre-lock and junk values from Auto Country (bolt `15x130`, `12x112`, "Racing
Nut", bore `0`, thread "Peg": 148 values) were blanked, not loaded (`import-report/vehicle-fitment-junk.csv`).

## Gap fill

357 model-years had a blank after the crawl. Six agents filled them: one on the vendor lookups, five on maker
pages and the web, on disjoint car lists. 406 rows on 338 model-years went into
`scripts/data/vehicle-fitment-vendors.csv`; fields won by source: Direct Auto Import 330, PRO WHEELS 239,
maker 15, our sheets 139, other web 705. 65 fields where sources disagreed are listed in
`import-report/vehicle-gapfill-conflicts.csv` (highest trust won). 29 model-years are cars that were not sold
in North America that year (`fitment-parked.md` #10).

**What is still blank:** 18 model-years have no fact at all (GMC Canyon 2013-14, Maserati GranTurismo 2020-22,
VinFast VF 6, Ford GT MKII, BMW M2 2022, Chrysler Cirrus 2006, Mitsubishi Diamante 2005: all model-years with
no North American car). 43 have no bolt pattern: those 18 plus centre-lock exotics (Spyker C8 and C12, Saleen
S7, Porsche Carrera GT, Lamborghini Centenario) and VinFast VF 7. A car with no data filters nothing, as before.

## What the pages show (Best and Similar)

Rules (`src/features/finder/llm.md`, D155): tires Best = a factory size of that model-year, Similar = inside
the stock range; wheels Best = the car's bolt pattern and inside the stock diameter, width, offset and hub
bore, Similar = the bolt pattern only; lug hardware by thread and nut or bolt; hub rings by bore.

- Median Best per narrowed model-year: **119 tires, 432 wheels**. Lug hardware: no model-year has zero Best.
- **26 model-years show zero Best tires**: sizes the catalogue does not carry (Cadillac Escalade IQ/IQL 24",
  Lamborghini Revuelto, G63 4x4 Squared, Scion iQ 175/60R16, 2005-07 Land Cruiser, Isuzu i-350/i-370,
  Freightliner Sprinter 3500, VPG MV-1). Their Similar row still shows tires.
- **21 model-years show zero wheels at all**: bolt patterns no wheel in the catalogue has (Smart Fortwo 3x112,
  Chevrolet LCF 3500 6x222.25, Bentley Arnage, Think City). 260 more show Similar wheels only.

## Products no car reaches

Counted only through model-years whose fit narrows the category (a no-data car would otherwise reach
everything).

| Category | Best | Similar only | Never |
|---|---|---|---|
| Tires (8,386) | 7,347 | 859 | 180 |
| Wheels (29,838) | 25,124 | 3,864 | 850 |
| Accessories (1,726) | 1,726 | 0 | 0 |

- **Tires never reached (180):** 158 flotation or off-road sizes of 33" overall and up (lift sizes, parked
  #2), 13 sizes inside the ranges that fit no stock car, 4 other flotation, 2 very low profile, 2 metric
  off-road over 33", 1 with no aspect ratio. Similar-only (859): sizes that are never a factory size.
- **Wheels never reached (850):** 386 undrilled or blank (drilled to order), 464 bolt patterns no car in the
  list has: 4x156 (197) and 4x137 (183) are UTV/side-by-side patterns, 4x110 (45) ATV, 10x285.75 (11) and
  10x170 (7) heavy truck, 6x165.1 (8), 5x135 (5), 4x137/4x156 (5), 7x150 (2), 5x101.6 (1). Similar-only
  (3,864): right bolt pattern but outside every stock range (3,196 on width, offset or bore; 668 on diameter).
- **Accessories:** all reached. 1,117 state nothing a car could contradict (universal parts) and stay Best.

## Checked

- **Counter against the page's SQL:** exact match on 39 named and about 880 random comparisons (every rule
  path), and again on the final data for 18 cars on all three pages in a production build against a local
  Postgres holding the same catalogue (54 of 54).
- **Vendor spot check:** see the section below.

## Not checked

- Real Safari and Firefox; Neon and Vercel; the parked e2e specs (D111).
- Whether each Auto Country value is right: it is the source of truth by the owner's ruling, and only the
  overrides and the spot check compare it with anything.
- Single-source gap-fill values beyond the agents' own notes.
