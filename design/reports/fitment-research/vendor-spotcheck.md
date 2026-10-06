# Wheel spot check: DAI "fits" vs our Best/Similar rules (D155)

Run 2026-10-06. 50 wheels from `catalogue/catalogue.csv` whose source is Direct Auto Import (DAI's own SKU used with
`ShowApplication.php?reference=<SKU>&type=wheels`, 50 requests), spread over 5x114.3, 5x120, 5x112, 6x139.7, 6x135, 5x127,
8x165.1, 5x100 (6 each, two or more diameters from 15 to 22) plus two dual-drilled wheels. For each wheel up to 6 cars DAI lists
(different makes first, years 2015 to 2025) were run through the app's own `findFitment` + `wheelFit` and the wheel rules of
`queries.ts` (copied from `scripts/fitment-coverage.ts`, script `spot/rules.ts`). Data: `spotcheck.csv`, raw `spot/`.

## Agreement

| Test | n | Result |
|---|---|---|
| DAI says it fits, we show it as **Best** | 272 cars (50 wheels, one wheel has no DAI applications) | **167 = 61.4%** |
| DAI says it fits, we show **Best or Similar** | 272 | **270 = 99.3%** (the 2 misses are both the 2015 and 2016 Toyota Tacoma Base: trim level, see below) |
| We say Best, DAI lists the car (10 wheels x 3 random Best cars, 2015 to 2025) | 30 | **16 = 53.3%** |

Our fitment had real data (no "narrows nothing" fallback) for all 272 rows. By bolt pattern, Best rate of DAI-fitting cars:
5x114.3 23/36, 5x120 24/36, 5x112 23/36, 6x139.7 20/34, 5x100 23/31, 6x135 22/30, 5x127 17/24, 8x165.1 10/36 (the 22x12 ET-44 trucks
wheels), dual-drilled 5/6 and 0/3.

## Disagreements, DAI says fits but we show Similar or none (105)

| Pattern | Count | Reason guess |
|---|---|---|
| Wheel **width** outside the car's OE width range | 39 (alone) + 28 (with diameter) | DAI applies fender and suspension clearance to the chosen OE wheel (plus sizing, wider fitments) and also lists cars by trim. Our range is the OE envelope. 26 of the 67 width misses are 0.5 in over and 16 are 1 in over: near-misses, which is what Similar is for. Wide off-road wheels (22x12 ET-44, 20x9 on vans) are 3 to 4.5 in outside the OE width. |
| Wheel **diameter** outside the OE diameter range | 18 (alone) + 28 (with width) | Plus or minus sizing. Of the 46 diameter misses, 27 are exactly 1 in outside, 6 are 2 in, 4 are 3 in, 9 are 4 in or more. The common 15-inch wheels listed for cars whose smallest OE rim is 16 in, and 17-inch wheels on cars that start at 18. DAI treats minus sizing as fitting when it clears the brakes. |
| **Offset** outside the OE offset window | 13 | Offsets 5 to 17 mm off the window (one at 1, one at 4). DAI allows an offset band around OE; our window is the exact OE range. Jeep Wrangler/Gladiator ET-6 and Ford Expedition ET20 are the clearest. |
| **Centre bore** below hub | 4 | Wheel bore 77.8 against a 78.1 hub on GM and Infiniti trucks (Yukon XL, Escalade ESV, Silverado 1500, QX80). The gap is 0.3 mm against our 0.15 tolerance. DAI lists them (probably a 0.5 mm tolerance or hub-ring use). |
| Bolt pattern: wheel 5x114.3 vs car 6x139.7 | 2 | 2015 and 2016 Toyota Tacoma "Base": the 4x2 four-cylinder Tacoma is 5x114.3 at trim level, the rest are 6x139.7. We carry one pattern per model, so trim-level exceptions are lost. |
| Range unreadable (no why) | 1 | 2022 Lucid Air: the wheel range has a missing field, so the rule marks the wheel not-Best even though the bolt pattern matches (an artefact of how `queries.ts` treats a broken range; worth a look). |

The Best-or-Similar rate (99.3%) says the bolt-pattern and hub data are right; the Best rate (61.4%) is mostly a statement that the
Best band (exact OE diameter, width and offset ranges) is tighter than DAI's clearance-based list, not that fitment is wrong.
Vans (Express, Savana) split: 2015 Express 3500 and 2020 Express 2500 were Best, the Savana rows with 20 to 22 inch wheels were Similar.

## Reverse, we say Best but DAI does not list the car (14 of 30)

| Car | Wheel | Reason guess |
|---|---|---|
| 2016 Subaru WRX, 2018 Rolls-Royce Dawn, 2025 Ferrari SF90 XX Stradale, 2025 Toyota Grand Highlander, 2025 Chevrolet Suburban HD | one wheel each | DAI does not list that **make** for the wheel at all. A 21x9.5 on a WRX, or a 22-inch wheel on a Rolls Dawn, is not a fitment DAI sells; our Best only checks pattern, diameter, width, offset and bore against the model range. SF90 and Dawn are low-volume cars whose OE ranges are wide. |
| 2023 Genesis GV70, 2023 Buick Envision, 2023 Land Rover Range Rover Sport, 2021 Nissan Armada | R3342101, R1651907, RUF5120004, DW1281802 | Model-year missing from DAI's list for that wheel: newer models appear sparsely in DAI's application lists (only the trims it has data for), or its own model naming differs. |
| 2018 VW Golf, 2017 VW e-Golf, 2016 Jeep Wrangler, 2024 Chrysler Grand Caravan, 2018 Ram 3500 | R3251504, R3251504, RNB18003B, RNB18003B, DW9820013 | Same: DAI lists a neighbouring model or year (Jetta for Golf, Voyager for Grand Caravan, Ram 2500 for 3500) but not this one. |

Note the 16 that DAI does list are not proof either: DAI lists by trim, we list by model. The reverse test measures how much of our Best
list DAI would also sell, not whether the car physically takes the wheel.

## Caveats

* DAI's `ShowApplication` is trim-level and clearance-aware, our rules are model-level and range-based. Different questions, so
  a 61% Best match is expected; the useful numbers are the 99.3% Best-or-Similar and the 8x165.1 / wide-wheel tail.
* Wheel `R3052001` (5x127 20x8 ET56) has no applications listed in DAI, and is excluded from the forward rows.
* Only one wheel size per SKU, one DAI listing per wheel. 6 cars each, sampled one per make first. Not a statistically weighted sample.
* No PRO WHEELS calls were made for Task B. The 50 requests were `ShowApplication` only; nothing about price, cost or stock was read or saved.
