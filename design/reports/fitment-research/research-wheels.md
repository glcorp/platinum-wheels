# Free sources for remaining per-vehicle wheel fitment (research, 2026-10-06)

Read-only research. Nothing in the repo was touched. Scratch work: `scratchpad/work/` (a copy of
`vehicle-fitment.mjs` re-run on the fresh ANKUSI download; it reproduced the committed 1,224-row
`vehicle-fitment.csv` byte for byte). Hard rules honoured: no wheel-size.com, wheel-sizes.com,
tirewheelguide.com, faultpedia, teoalida, tiresize.com, tirerack; no logins; about 45 page fetches in total.

## 0. Numbers the owner asked for

| Question | Number |
|---|---|
| Offered model-years (vehicles.csv) | 7,528 over 843 models |
| ANKUSI exact-year rows kept (`vehicle-fitment.csv`) | 1,224 (463 models) |
| ... with OE wheel **diameter + width** | 1,046 (13.9% of offered); 178 blank |
| ... with OE **offset (ET)** | 668 (8.9% of offered); 556 blank |
| ... with centre bore | 1,224 (0 blank) |
| Generation rows (`vehicle-fitment-generations.csv`) | 1,048: 972 real + 76 `unknown` |
| ... lacking centre bore | **575** (499 of the 972 real rows, plus all 76 `unknown`) |
| Offered model-years that have *some* centre bore (exact + generation rows with a bore) | 3,327 (44%) |
| Tire sizes in ANKUSI | 430 of 9,701 rows, all `th` (380) or `ru` (50); **0 English / North American rows** |

ANKUSI file facts (downloaded: 9,701 rows, 1.66 MB; JSON twin 3.5 MB, same 13 columns): `en` 7,904, `ru` 746, `th` 473,
`es` 261, `fr` 206, `ar` 111. Version on the dataset page and in the JSON is 2026.10.04; the README on the
download server still says 2026.09.22 / 9,688 rows, so ignore its row counts. English model names carry
market tags: `[UK]` 255, `[US]` 108, `[EU]` 56, `[AU]` 10, `[CN]` 8, `[ZA]` 6.

## 1. ANKUSI columns we do not use yet

Columns: `make, model, year, chassis_code, bolt_pattern, center_bore_mm, center_bore_rear_mm, lug_count,
oe_wheel, flush_wheel, max_wheel, source_url, source_lang`. No tire, thread, seat or load column.

| Column | Filled (all rows / en) | Use |
|---|---|---|
| `oe_wheel` | 9,489 / 7,704 | Already used for diameter/width/offset, but only single-size rows. Shapes in en: `19x8.5J F/R` (no offset) 2,628; staggered `F: 20x9.0J R: 20x11.0J` 2,422; prose like `17x7.0J at ET45 offset, front and rear` 1,302; clean `15x6J ET35` 1,353; blank 199. Only about 34% of en rows state an offset at all. |
| `flush_wheel`, `max_wheel` | 8,327 / 7,992 (en 6,565 / 6,622) | **Not OEM data** (README: "Community reference ... not a manufacturer figure"). Usable as "popular wider fit" and "widest common fit". Messy: 2,469 / 2,535 en values are prose sentences (`an 18x8.5J at ET45, which fills the fender opening...`), 108 / 115 are junk `ET0`. Of our 1,224 exact rows, 851 have a clean flush value and 825 a clean max value (819 both). |
| `chassis_code` | 595 | Generation code (`FC`, `GK`). Could drive generation grouping; only 595 rows. |
| `center_bore_rear_mm` | **0** | Empty in the whole file. |
| `source_url` | all | The fitment-guide page. It carries more than the CSV, see below. |

What the page adds (5 English pages fetched, polite, 3 s apart): a line `Wheel Bolt/Nut M12x1.5 Nut` plus a
`Category` (Camry 2021 `M12x1.5 Nut`, Outback 2025 `M12x1.25 Nut`, Rogue 2021 `M12x1.25 Nut` all correct;
**F-150 2021 says `M14x2 Nut`, wrong: 2015+ F-150 is M14x1.5**), a load rating by segment, and the OE tire
size in brackets on some pages (a Civic 2021 page shows `215/50R17`; Camry, Outback, Rogue show none). Pages also
state the generation span ("this generation covers 2021-2026 ... identical every year"), which is exactly
the evidence a generation-propagation rule needs. robots.txt allows `/fitment-guide/`; there is no data-use
page for the HTML. Crawling 7,904 pages is far beyond "a few dozen polite fetches" and the agreement with
ANKUSI covers the dataset, not the site. **Best route: ask ANKUSI by mail for the thread, nut/bolt, category,
tire size and generation-span fields behind each row.** Not tested whether they would send them.

Licence: CC BY 4.0 (dataset page, README, JSON). The owner states a mail agreement waives the credit
(D149). Verdict: usable, credit waived per the owner's statement, agreement not on file.
Provenance risk: ANKUSI says rows are built from "published OEM ... specifications and cross-checked against
independent fitment references" and names none, so independence from Wheel-Size cannot be proven or ruled out
(it is a wheel factory using the data for marketing).

### Spot check of ANKUSI exact-year OE rows (10 rows against independent sources)

Second sources were retailer OE-wheel listings and owner forums seen through search results (not OEM manuals);
treat them as a sanity check, not truth.

| Row (ANKUSI) | Independent finding | Verdict |
|---|---|---|
| 2011 Toyota Highlander 17x7.5 ET35 | OE wheel listings 17x7.5 ET35 | match |
| 2012 Silverado 1500 18x8.0 ET31 | forums: 18x8 ET31 | match |
| 2023 Subaru Legacy 18x7.5 ET55 | OE listings 18x7.5 ET55 | match |
| 2021 Equinox 19x7.5 ET45 | OE replacement listing ET46 | within 1 mm |
| 2014 Cayenne 18x8.0 ET50 | OE listings ET53 | offset wrong by 3 mm |
| 2016 Lincoln MKS 19x8.0 ET39 | OE listing 19x8.5 ET39 | width wrong |
| 2012 Cruze 17x7.0 ET39 | listings show ET42 and ET30, none 39 | offset not confirmed |
| 2011 Honda Fit 16x6.0 ET45 | OE listing ET53 | offset wrong by 8 mm |
| 2022 Sonata 19x8.0 ET45 | N Line 19x8 reported +55 | trim dependent / disputed |
| 2023 Challenger 20x9.5 ET24 | nothing found at 24 (SRT/Scat sources show +18 to +20) | not confirmed |

Read: **diameter and width are right on 9 of 10; offset matched on 4 of 9 checkable rows.** One ET per year hides trim
variation (wheels of different sizes carry different offsets), so an OE offset should not be shown as a single fact.
Thread on the pages: 3 of 4 correct.

## 2. How far ANKUSI alone can go (counted, not guessed)

| Fact | Exact-year only | If an exact row may serve the rest of its (hand-kept) generation range |
|---|---|---|
| Diameter + width | 1,046 | **2,651** of 7,528 |
| Offset | 668 | **1,542** |
| Flush / max reference | about 850 / 825 of the 1,224 | not computed |

The generation propagation breaks D149's "never fill a year from a neighbouring year" rule, which was written
for bolt pattern. A wheel size changes mid-generation less often than a bolt pattern, but it does (facelifts, trims).
It needs a ruling, and a safer variant is to propagate only where the ANKUSI page itself states the generation span.
Parser gains inside the current data: 164 exact rows have no diameter, 129 of them have OE text a fuller parser
could read (100 are staggered front/rear sizes), and about 24 more offsets sit in prose. Roughly 0.5 day.

## 3. Centre bore blanks and what fills them

- Exact rows: 0 blank. Generation rows: 575 of 1,048 blank (BMW 104, Audi 74, Mercedes-Benz 47, Chevrolet 42, Ford 34,
  Porsche 31, Cadillac 15, GMC 15, Land Rover 13, Buick 11 among the real rows).
- 153 blank real rows have an ANKUSI exact row inside the same generation and bolt pattern with one agreed bore
  (1 conflicts). 252 can take it from any year of the same model and pattern.
- 328 of the 499 blank real rows sit on a make + bolt-pattern pair whose known rows share one bore (126 of 143 pairs
  are single-bore); 26 more have an 80%+ majority; 48 have no donor. BMW (104), Mercedes (47), Porsche (31) fill almost
  completely. Audi is mixed (57.1 or 66.5) and must not be filled by make.
- This is derivation, not a source. A wrong bore is the lower-risk error (a hub ring can bridge a larger bore) but
  the existing rule is two agreeing sources; the owner would have to relax it for a flagged "derived" value.

## 4. Other sources, ranked

Ranking = value for the remaining facts x licence safety x effort.

1. **ANKUSI CSV (fields in section 1).** Covered above. Licence OK per owner. Effort 0.5 to 1 day. Quality: see spot check.
2. **ANKUSI by mail (page-only fields).** Thread, nut/bolt, category, load rating, tire in brackets, generation span.
   Licence: owner already has a dialogue; terms of a new export unknown. Effort: one email plus 0.5 day.
3. **NHTSA vPIC `WheelSizeFront` / `WheelSizeRear` (US government).**
   URL `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/<VIN pattern>?format=json&modelyear=<yr>`;
   standalone Postgres DB `vPICList_lite_2026_09` (67.8 MB zip, not downloaded, needs your yes). Field is **diameter in
   inches only**, per VIN pattern (trim level), from manufacturer submissions. In 23 wildcard decodes **6 returned a
   diameter** (2021 Accord 19, Camry 18, RAV4 17, Wrangler 17, Rogue 18, a 2019 BMW 330i 18); none for any 2016
   decode and none for most 2021/2022 others (F-150, Silverado, Tesla, Telluride, Atlas, CX-5 ...). No licence text on the downloads page (it points to manufacturerinfo@dot.gov); federal
   data, so reuse is normally unrestricted but I could not confirm. Effort 1 day; yields diameter only, sparse.
4. **Gorilla Automotive "Lug Nut and Wheel Lock Application Guide" PDF** (hosted at yourtireshopsupply.com, 2.3 MB).
   My extraction recovered about 456 make / model / year-range / **thread** rows (Toyota All 68-Present M12x1.5,
   Honda All 83-Present M12x1.5, Subaru All 77-Present M12x1.25, Infiniti M12x1.25, Chevrolet Equinox M12x1.5, Express
   M14x1.5; inch threads appear as `1/2`, `9/16`). Dated (a 2007 model is listed as "Nitro 2007"), coarse (make level,
   "Present"), **no seat type**, no 2020s. Manufacturer copyright; facts are not copyrightable but the compilation is.
   Cross-check only. Effort 2 h to parse. Its Honda, Toyota, Subaru, Infiniti, Hyundai/Kia and Lexus lines agree with what I know and with the ANKUSI pages for Camry, Outback and Rogue; I did not check each row against a second source.
5. **Make-level thread and seat rules, hand-written** (Toyota/Honda/Hyundai/Kia/Lexus M12x1.5, Subaru/Nissan/Infiniti
   M12x1.25, GM trucks M14x1.5, 2015+ F-150 M14x1.5; seat: conical/60 degree for most Japanese, Korean and domestic
   cars; ball or flat seat bolts on BMW, Audi, VW, Mercedes, Porsche). Sources for each line should be owner manuals or
   the Gorilla guide so the claim is checkable. Free, no licence issue. Effort 1 to 2 days for 843 models;
   exceptions (Jeep, Mitsubishi, Suzuki, older trucks) need per-model rows.
6. **Wikipedia "Lug nut" (CC BY-SA 4.0).** General only: M12x1.5 most common, M14x1.5 most common in M14, some
   older US inch threads. No make/model table. Background, not data.
7. **OE-wheel resale catalogues** (autorimshop.com, originalwheels.com, detroitwheelandtire.com, factorywheelreplacement.com).
   Per OEM wheel: diameter, width, offset, bore, bolt pattern, part number, years. Best accuracy in my checks (they list
   the real OEM part). Retail catalogue copyright, ToS unread, bulk scraping not allowed by this brief. Use for spot
   checks and for resolving trim disputes by hand.
8. **autofiles.com / autotk.com** (already used for bolt pattern; same template and same numbers on both). Show
   thread (Camry M12x1.5), stock offset as a range (`30-50 mm`), a list of tire sizes, no seat. Footer
   "(c) Autofiles.com. All Rights Reserved"; no source statement, no data licence. **Provenance unknown; ranges plus tire
   list plus thread is the shape Wheel-Size sells, so I cannot rule out a Wheel-Size origin. I recommend the owner
   decide before extending its use beyond bolt pattern.** Not recommended for tire sizes or offset ranges.
9. **car-bolts.com, whatsizebolt.com.** car-bolts is unreliable (the 2021 F-150 page gives M14x1.5, 121 ft-lb, centre
   bore 78.6 and also M12x1.5 and a 5x110 pattern, and says the specs are by Toyota). whatsizebolt is the opposite:
   it states only fields it can source, citing the owner manual page (F-150 2021: 150 ft-lb, p. 576, other fields
   "not verified"). Good as a model of provenance, too sparse to use as data. ToS unread.
10. **Transport Canada Canadian Vehicle Specifications** (Open Government Licence - Canada; CSV 2011-2023). Wheelbase,
    track widths, overall width, curb weight. **No tire or wheel field.** Not useful for the five facts.
11. **Interactive tire and wheel lookups** (toto Tire Canada finder, tiresize411, motortally, tireguide.org, 1010tires,
    discounttire). They show tire size and OEM wheel specs by Y/M/M/trim. No provider named, no reuse terms found
    (TOTO, TireSize411 pages checked), selector driven, so extraction means scripting a form. Several are probably
    licensed from the same vendors. **Do not scrape.** Treat as a way to check a handful of vehicles by hand.
12. **Not verified / not usable.** Kaggle "Car Tyres Dataset" (page needs JavaScript; 4,350 rows, market unknown,
    probably not North America); Enkei and wheel-maker catalogues (aftermarket wheel sizes by wheel, not OE by
    vehicle, from search snippets only); paid databases (ridestyler, AWS Marketplace tire size database, vehicledatabases,
    car2db) are out of scope for "free".

## 5. Answers by fact

1. **Factory diameter and width.** ANKUSI: 1,046 exact (13.9%), 2,651 with generation propagation (35%), plus vPIC
   diameter for some trims. Staggered cars (Porsche, BMW M, Mustang, Challenger) need front and rear fields.
2. **Offset (ET) and safe range.** OE offset: 668 exact rows (8.9%), 1,542 with propagation; accuracy about 4 of 9 in my
   check, trim-dependent. No free source publishes a manufacturer "safe offset range". Options: ANKUSI `flush_wheel` /
   `max_wheel` (about 850 / 825 of the 1,224 clean, labelled community figures), or compute a range from OE
   width and offset with the standard inner-clearance rule (new ET = OE ET - 12.7 mm per extra inch of width) plus a
   +/- few mm tolerance, shown as "approximate".
   I did not verify the 12.7 mm rule against a published source in this run.
3. **Centre bore.** Section 3: 575 generation rows blank, 328 of the 499 real ones derivable by make + pattern, 153 by
   same-range exact rows.
4. **Lug thread and seat.** No free data set. Best free route: Gorilla guide parsed (456 coarse rows, thread only) plus
   hand-kept make rules and per-model exceptions checked against owner manuals; seat from the make rule. ANKUSI page
   threads are free from the owner's partner but 1 of 4 checked was wrong.
5. **Max wheel/tire size, plus-sizing.** No free per-vehicle source. ANKUSI `max_wheel` is the only free figure and is
   community-based. A rule-based answer (overall tire diameter within about 3% of OE, wheel width +/-0.5 to 1 inch) needs the
   OE tire size, which we do not have for North America. I did not verify the 3% rule in this run.
6. **Tire size.** No free licensed North American source found. ANKUSI: 0 en rows. Owner manual tire placard is the primary
   source; hand-keying the 63 priority models is the plan in D110.

## 6. Effort and risk summary

| Work | Effort (my estimate) | Risk |
|---|---|---|
| Parse OE size (front/rear, prose) and flush/max from ANKUSI into the CSV | 0.5 day | Offset not trustworthy per trim; show as typical or hide |
| Generation propagation of OE size | 0.5 day + ruling | Breaks the neighbouring-year rule; wrong on mid-generation changes |
| Derive blank bores (make + pattern) | 0.5 day | Needs a relaxed sourcing rule; Audi, Ford, Chevrolet mixed |
| vPIC diameter | 1 day (+ owner yes to download 68 MB) | Sparse (6 of 23 in my tiny sample), diameter only |
| Gorilla thread table + make rules | 2 to 3 days | Dated, coarse, copyright on the PDF; seat is by rule |
| Ask ANKUSI for page fields | 1 email + 0.5 day | Unknown answer; thread data was wrong for Ford trucks |
| Tire size by hand from owner manuals | about 2 days for 63 models, about 1 week for 190 | Slow; correct and licence-clean |

## 7. What I could not verify

- Fitment Industries, SD Wheel and MrWheelDeal fitment guides returned 403 (bot protection, not evaded); wheelspecs.net
  failed with a certificate error on this network; Kaggle needs JavaScript. None were read.
- No ToS or licence page was read for autofiles, autotk, car-bolts, whatsizebolt, the resale catalogues, TOTO,
  TireSize411 or the Gorilla PDF (only what appeared on the pages fetched). Their reuse status is unknown, not "OK".
- vPIC coverage is extrapolated from 23 wildcard-VIN decodes, not the database; I did not download the 67.8 MB DB.
- The spot-check "second sources" are retailer listings and forum posts read as search summaries (I did not open each
  page), not owner manuals. A "mismatch" may be a different trim.
- ANKUSI thread values were checked on 5 pages only. Their agreement with the owner, and whether Wheel-Size is upstream of
  their data, cannot be checked from here.
- Gorilla guide edition year is not printed; I inferred "about 2007-2010" from model entries.
- The generation-propagation, bore-by-make and inner-clearance numbers are my own derivations from the committed CSVs;
  none was spot-checked against a vehicle source.
