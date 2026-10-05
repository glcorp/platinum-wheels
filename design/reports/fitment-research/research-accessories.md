# Vehicle-driven accessory fitment: free sources, catalogue attributes, recommendation

Research only. Nothing in the repo was edited. Date: 2026-10-06. Scratch files (parsed PDFs, join scripts) are in this scratchpad folder.

## 1. Bottom line

| Accessory type (products) | Vehicle fact needed | Free source found | Verdict |
|---|---|---|---|
| Lug nuts (284), lug bolts (125), wheel locks (67) | thread, nut vs bolt | ANKUSI per-vehicle pages carry it; boltpatternhq too; Gorilla guide is old and coarse | Narrow by thread (already built). Add nut/bolt. Do NOT narrow by seat type or hex |
| Hub rings (133) | vehicle hub bore | Already in `scripts/data` (1,224 exact + 473 generation rows with bore) | Narrow: ring inner diameter = vehicle bore. 88% of known bores have a ring in stock |
| Wheel spacers (67; 61 with bolt pattern + bore) | bolt pattern + bore | Already in `scripts/data` | Narrow on bolt pattern + bore |
| TPMS sensors and tools (16) | frequency (315/433) | PREMA public PDF, 1,626 rows, 2004-2023 | Show the frequency as an information line. Narrow only the vehicle-specific items (2 Tesla BLE). Do NOT hide programmable/dual-band sensors |
| Valves and caps (4) | valve stem type | Dill 2013 chart (to MY2013-14) | Do not narrow. Too few products, source too old |
| Centre caps (573), cap logos/hardware (255) | wheel-specific, not vehicle-specific | none | Do not narrow by vehicle |
| Wheel covers (75) | OE rim diameter | ANKUSI has `oe_wheel_diameter` on its exact rows | Optional later; low value |
| Wheel weights (108), tools, bags, antennas, studs | none / universal | none | No vehicle filter |

Of 1,726 accessories, 676 (39%) can be narrowed by a vehicle fact that both sides state. Another 16 (TPMS) get an information line. The other 61% cannot be narrowed honestly by vehicle.

## 2. What the repo does today (read first)

- `src/features/finder/fitment.ts`: bolt pattern and centre bore are real data (ANKUSI exact year, hand-kept generation rows, nearest real year). **Thread and TPMS are the D48/D67 placeholder** keyed by make+model and year-blind, 60 models only. The comment says `centreBore` "Not used to filter".
- `src/features/results/search.ts` and `catalog/queries.ts`: accessories narrow on lug thread only. `contradictsThread()` demotes a lug nut, lug bolt or wheel lock to "similar" only when it states a different thread; products stating nothing stay in "best". Hub rings, spacers and TPMS are not touched. The code comment says TPMS frequency is "not a column in the catalogue" (D109(12)).
- The placeholder is wrong in places I could check:
  - TPMS: compared with PREMA on MY2008-2023, for the 60 placeholder models, on model-years where PREMA gives one frequency: placeholder right on 385, wrong on 234 (38%). Wrong cases are systematic: Ram 1500/2500/3500, Dodge Charger/Durango, Jeep Grand Cherokee and Wrangler 2013+, Nissan Rogue/Pathfinder/Kicks, Subaru 2017+ and GM trucks/crossovers 2018+ are 433 where the placeholder says 315; Hyundai Elantra/Santa Fe/Tucson, Kia Sorento/Sportage (pre-2016) and VW Jetta/Tiguan (pre-2012) are 315 where it says 433.
  - Thread: F-150 is M14x2.0 on 2015+ (ANKUSI 2018 and 2021 pages; Gorilla guide "F-150 2000-Present 14 x 2.00"), the placeholder says 14x1.5. FitMyWheel's make-level chart also says F-150 M14x1.5, so a make-level chart repeats the error. Wrangler JK (2007-2017) is 1/2"-20, the placeholder says 14x1.5 (boltpatternhq 2012 Wrangler: 1/2"; 2020: 14x1.5).
  - Fix by replacing both placeholder columns with real rows (section 6).

## 3. What the accessory catalogue states (vendor data)

Source: `~/Platinum Wheels Vendor Data/combined/share/output/catalogue.csv` (the D135 build, 1,726 accessory rows). It predates D142, so `Part number` still sits in `extra_specs`; that does not change the attribute shares. `tests/fixture/catalogue.csv` is a 126-product sample (31 accessories) with the same shapes.

| Type (n) | Stated attribute and share of that type |
|---|---|
| Lug nuts (284) | thread 100%; seat 39% (113: Conical 109, Flat OE 3, Radius R12 1); hex 40% (113, in `extra_specs`); finish 64%; weight 57% |
| Lug bolts (125) | thread 100%; seat 96% (Conical 73, Radius R13 30, R14 18); hex 95% (119) |
| Wheel locks (67) | thread 98%; seat 94% (Conical 56, Radius R13 7); hex 99% (66, e.g. `17/19`, `19/21`) |
| Hub rings (133) | outer diameter 100%, inner diameter 100% (also parsed from names like `73.1-60.1 mm`); 21 distinct ODs, 34 distinct IDs |
| Wheel spacers (67) | bolt pattern 91% (61), centre bore 91% (61), thread 64% (43; these are the replacement studs and nuts, not spacers) |
| TPMS sensors and tools (16) | **no frequency field.** Only free text: "Dual Freq TPMS Sensor Rubber", "Bosch ... Dual Band", "Schrader EZ-Sensor" (programmable 314.9/315/433, not stated in our data), 2 "TPMS Tesla 3/Y 2021+ Bluetooth BLE" |
| Valves and caps (4) | none; one snap-in valve names "many Chrysler Ford + 2015-16 Hyundai Sonata, 2014-16 Kia Soul" in its title |
| Centre caps (573) | finish 79%; part type 87%; "Fits design" 47%, "Fits wheel" 40% (wheel SKUs or designs, not vehicles); bolt pattern on 16 |
| Cap logos/inserts (255), wheel covers (75) | covers: wheel diameter (in) 97%; logos: "Fits design" 49% |
| Wheel weights (108) | piece weight 99%; no fitment |

Not stated anywhere in accessory data: a "fits vehicle" list, TPMS frequency, valve stem type, a nut-vs-bolt flag for locks. Wheels data has `wheel_seat_type` on only 1,333 of 29,838 (4%), so seat compatibility with the buyer's wheel cannot be checked either.

Thread formats differ between sources and need one normaliser: catalogue `14x2.0`, `1/2 UNF`, `9/16 UNF`; ANKUSI `M14x2`, `1/2"x20`; boltpatternhq `14x1.50`, `1/2"`.

## 4. Free sources, ranked

I fetched about 40 pages in total, politely, never logged in, and did not use any banned site. WebFetch hit 403 on autel.us, premaproducts.com/downloads, cartreatments.com and the schradertpms.com PDFs; I did not work around those blocks.

### 4.1 TPMS frequency (and OE valve/kit part numbers)

**A. PREMA USA TPMS Application Chart, Oct 2023 (best find)**
- URL: https://www.premaproducts.com/downloads/PREMA-USA-TPMS-Application-Chart-10-2023-v2.pdf (323 KB, 57 pages, direct download, no login).
- Fields: make, model, vehicle code, year from, year to, qualifier (Snap-in/Clamp-in, built before/after a date, alloy/steel, made in Japan/USA), frequency (315/433), PREMA sensor, valve and OE service kit/valve numbers.
- Coverage: 1,626 rows, 1,625 with a frequency (896 at 315, 729 at 433, 1 at 434). Ends MY2023-24. 2025-2027 are not covered: 3 of the 23 model years (about 13% of model-years).
- Join to our vehicle list (`scripts/data/vehicles.csv`), naive name match only: 73% of MY2008-2023 model-years got a frequency (3,858 of 5,283), 4% got both 315 and 433 (overlapping or qualified rows). The misses are mostly BMW (333), Audi (253), VW (116): the PREMA names are `3 Series`, `A4 8E`, `CR -V RD` (a stray space and dash, plus chassis codes) where vPIC has `328i`, `A4`, `CR-V`. A hand-made model alias table of roughly 150 rows would raise this; I did not build it, so I cannot give the final share.
- Licence: no copyright notice anywhere in the PDF; the PDF metadata says it was exported from `PREMA USA TPMS Application Chart_Final_October_2023.xlsx`. It is a dealer-facing marketing chart from a sensor maker. I could not read premaproducts.com terms (403 to my fetcher). Verdict: facts per vehicle are low risk, but this is a competitor's compiled table; get a one-line written OK from PREMA (they sell to tire shops) before shipping a column derived from it, or treat it as a cross-check only. Needs the owner's call.
- Extraction: pypdf text extraction plus a regex worked first time (1,626 of 1,631 MHz lines parsed; the 5 misses are wrapped note lines). Effort: 0.5 day parse, 0.5-1 day for the model alias table, 0.5 day review.

**B. Schrader (Sensata) TPMS Sensor & Service Pack Catalog, April 2016** (copy hosted by CARiD)
- URL: https://images.carid.com/schrader/items/pdf/schrader-product-catalog.pdf (3.9 MB, 183 pages).
- Fields: make, model, year range, OE sensor part numbers (e.g. Honda Civic 2008-2014: 42753SNAA83, 42753TR0A81, 42753TR3A81), Schrader sensor and service pack numbers, torque; a back index groups vehicles under "28720 (315 MHz)" style headings, which gives frequency for 4,278 make/model/year-range entries (3,775 at 315, 503 at 433).
- Coverage: to about MY2016. Official schradertpms.com PDFs (2020 and 2021 application guides, which would reach MY2021) returned 403 to curl and I did not retry or bypass.
- Licence: standard manufacturer copyright; no reuse terms. Use as a cross-check, not as the shipped data.

**C. Dill TPMS Applications Chart, 1 May 2013**: https://www.yourtireshopsupply.com/pdffiles/DILL%20TPMS%20APPLICATION%20GUIDE%205-1-13.pdf (17 pages). Fields: OE model, years, Dill sensor/kit, **OE sensor part number, valve stem code (VS70, 1096, "NO"), relearn type, FCC ID**; frequency only where a make is mixed (e.g. `Audi A4 (433 Mhz) 05-08`). Marked "DILL TPMS APPLICATIONS CHART ©". Too old to ship (MY2013-14 ends), but the only free file with OE valve stem codes.

**D. Autel MX-Sensor V5.21 US coverage list** (https://www.autelstore.co.uk/upload/service/mx-sensor-v521-coverage-list-us.pdf, 235 KB): only the June 2017 additions (about 25 rows, each with frequency and OE maker), footer "Copyright 2017 Autel ... For reference only". Unusable. Autel's full lookup is an interactive page (maxitpms.com) and autel.us returned 403.

**E. Not usable:** Continental VDO/REDI-Sensor application PDF (host did not connect from here); Bosch and Dill's own lookup pages are interactive; I found no Bosch downloadable list.

**Quality check (PREMA vs Schrader 2016 index).** I compared the two on every make/model/year both name for MY2008-2018: 1,438 agree, 112 disagree, 875 Schrader entries had no PREMA match (naming). That is 93% agreement where both speak. The disagreements cluster: BMW/MINI 2008-2011 (PREMA 433, Schrader 315; US-market cars probably differ from the EU chart, which I could not settle), Hyundai Azera 2012-13, VW CC 2012-14, and Land Rover rows where PREMA lists both frequencies.
Ten vehicles checked row by row: Nissan Rogue (315 to 2013, 433 from 2014-2016; matches an owner-forum report I found separately), Toyota Camry (315 throughout), Honda Civic 2008-2014 (315), Chevrolet Silverado 2007-2015 (315, 433 from 2019), Jeep Wrangler (315 to 2012, 433 from 2013), Hyundai Elantra (315 to 2016, 433 from 2017), Kia Sorento (315 to 2015), Subaru Outback (315 to 2017, 433 from 2018: PREMA only, no second source for 2018+), Dodge Charger (433), Chevrolet Volt (315/433/315 flip, PREMA agrees with Schrader to 2016 and a forum post for 2017-2020). All agree with the second source wherever a second source exists. **I found no second source at all for MY2017-2023**, which is the span where most of the 315-to-433 switches happen; that gap is unverified.

**Make-level rule (does not hold).** From PREMA rows with year-to >= 2008: single-frequency makes are Toyota (74 of 75 at 315), Lexus, Ford (59 of 62), Mazda, Mitsubishi, Mercury, Pontiac, Scion, Suzuki at 315; BMW, Mini, Mercedes, Tesla, Genesis, Alfa, Maserati, Rivian, Fiat at 433 (but see the BMW/MINI conflict). Mixed by year or model: Chevrolet (64/23), Nissan (73/23), Hyundai (35/21), Kia (23/20), Jeep (10/26), Dodge (11/26), Ram (6/28), GMC, Cadillac, Honda (29/7), Acura, Infiniti, Audi, VW, Volvo, Porsche, Jaguar, Land Rover, Subaru (20/7). So frequency needs per-model, per-year rows, not a make rule.

**TPMS-equipped assumption is US-only.** The US rule (FMVSS 138, 100% of new light vehicles from 1 Sept 2007, so MY2008) is real, but Canada has no equivalent mandate (drivesmartbc.ca and other search results; I did not read the CMVSS text). Many Canadian-market cars from 2008 do have TPMS, but a Canadian-market car without it exists, so "every vehicle from 2008 has TPMS" cannot be asserted for this site. The finder should say "sensors if your car has TPMS".

### 4.2 Lug thread, seat, hex

**A. ANKUSI fitment-guide pages (best, and the owner already has an agreement)**
- Per vehicle page, e.g. https://ankusiwheels.com/fitment-guide/ford-f-150-2018/: `Wheel Bolt/Nut M14x2 Nut`, and a text block "Thread & Fastener: M14x2.0, conical-seat lug nut", plus torque. Jeep Wrangler Arctic 2012 page: `1/2"x20 Nut`. VW/Audi-type pages show `Bolt`. The ABT Audi page (checked) states `M14x1.5 Bolt`.
- **The downloadable CSV does not have this column** (columns: make, model, year, chassis_code, bolt_pattern, center_bore_mm, center_bore_rear_mm, lug_count, oe_wheel, flush_wheel, max_wheel, source_url, source_lang). The data exists on 9,701 pages. Ask ANKUSI by email to add `wheel_bolt_nut` to the CSV for the 1,224 rows we use. That is a request to a partner, not scraping. Fetching 1,224 pages myself is outside the "few dozen polite fetches" limit I was given.
- The seat wording on the page ("conical-seat") looks templated and I would not treat it as data.
- Licence: CC BY 4.0, credit waived by the owner's email agreement (per `scripts/data/llm.md`; the agreement itself is not on file).
- TPMS: ANKUSI pages say only that TPMS is mandated since MY2008 and carry no frequency. No help for 4.1.

**B. boltpatternhq.com** (second source in our generation rows): per vehicle-year page, `Lug Nut / Bolt Size 12x1.5`, torque, bolt pattern, bore. robots.txt allows all; footer "(c) 2026 Bolt Pattern HQ. All rights reserved", no further terms. The seat sentence on pages is boilerplate ("conical (60-degree) seat") not per-vehicle data. Checked pages (11 vehicle-years): 2021 Corolla 12x1.5, 2021 Tiguan 14x1.5 (bolt), 2012 Wrangler 1/2", 2020 Wrangler 14x1.5, 2020 Rogue 12x1.25, 2020 Outback 12x1.25, 2018 Civic 12x1.5, 2016 Mustang 14x1.5, 2009 and 2018 Charger 14x1.5, 2015 BMW 3 Series 14x1.5 bolt: all agree with what I know of these vehicles (my own knowledge, not a second website; the Gorilla guide independently matches Charger and Tundra only). Several truck slugs (Ram 1500, F-150, Silverado, Tundra) returned the home page, so truck coverage is uneven. **Caution: `scripts/data/llm.md` records that its About page says its records come partly from "historical wheel-size datasets".** Under your hard rule that makes it a weak base for a shipped column; use it only as a second source to confirm ANKUSI.

**C. Gorilla Automotive "Lug Nut and Wheel Lock Application Guide"** (https://www.yourtireshopsupply.com/pdffiles/GorillaLugnutWheel%20application%20guide.pdf, 2.3 MB). Columns: make+model, year range, thread. Passenger, truck/SUV and lug-bolt sections. Dated: the latest year named is 2011 and most ranges end "Present" (meaning the print date, about 2011). No copyright text found in the extracted text. Coarse: "Subaru All 77-Present 12 x 1.25", "Toyota All 68-Present 12 x 1.50" (but Tundra/Sequoia/Land Cruiser 14x1.50). Seat type is by product, not by vehicle. Usable as a make-level fallback and cross-check, not as the shipped table.

**D. Rejected on terms:** McGard's Vehicle Application Guide (mcgard.com) is an interactive form and states "the information you access is McGard's proprietary information". Do not use or scrape. The 2013 McGard PDF at fpsdistribution.co.uk returned 404.

**E. Not per-vehicle:** Wikipedia "Lug nut" (CC BY-SA 4.0) has no per-vehicle table. FitMyWheel / cartreatments / jordistireshop / Power Tool Insider charts are make-and-model level, undated, copyrighted, and FitMyWheel is wrong on F-150 (14x1.5; real 14x2.0). No Muteki fitment PDF exists publicly (search found only product pages).

**Seat type and hex per vehicle: no free per-vehicle source exists.** Seat is a property of the wheel, not the car: an aftermarket wheel's seat (conical, ball/radius, flat/mag) decides which nut fits, and we hold wheel seat on 4% of wheels. Hex size is a property of the nut. Do not filter on either.

### 4.3 Hub bore (hub rings, spacers)

Already in the repo, nothing new needed: `vehicle-fitment.csv` has `centre_bore_mm` on all 1,224 exact rows; `vehicle-fitment-generations.csv` has it on 473 of 972 real rows (blank unless two sources agree). Against the catalogue's 34 ring inner diameters: 1,083 of the 1,224 exact-row bores (88%) have a ring whose ID matches; unmatched bores are 66.9 (44 rows), 71.6 (35), 66.5 (26), 110.1 (11), 74.5, 84.1 and a few larger ones. Rings are stocked only as 21 outer diameters, so the matching rule should be "ID equals vehicle bore", and the wheel's own bore (from our wheels data, 98% populated) can optionally pick the OD later. Hub rings stated by vendors as "73.1 to 66.1" are already parsed into OD/ID columns.

### 4.4 Valve stem type

Dill 2013 gives a valve code per OE sensor (VS70, 1096, none) and PREMA 2023 gives an OE valve per row, but both key off TPMS sensor generation, and our catalogue has 4 valve products. Do not build. Valve stems follow the wheel's valve hole and the sensor, not the car.

### 4.5 OE sensor part numbers

Dill (to 2013/14), Schrader (to 2016, 1,299 applications) and PREMA (2023, OE service kit and valve numbers) all list OE part numbers per vehicle. Our catalogue has no OE-part-number attribute, so the numbers cannot drive a filter; they could populate an admin cross-reference column later. Not recommended for launch.

## 5. What can be narrowed by vehicle

Narrow (both sides state the fact):
1. Lug nuts, lug bolts, wheel locks by thread. Already built; needs real thread data (placeholder wrong on F-150 and Wrangler at least). Add the vehicle's nut-or-bolt type (from ANKUSI) so a stud car does not show lug bolts and a bolt car does not show lug nuts; today `contradictsThread` treats the three types the same.
2. Hub rings by vehicle bore = ring ID. Data already present.
3. Wheel spacers by bolt pattern and bore (61 of 67 products state both).

Information line only (do not hide products):
4. TPMS: show "Your 2018 Rogue uses 433 MHz sensors" and let programmable/dual-band sensors (Schrader EZ-Sensor, Bosch dual band, "Dual Freq") count as fitting either. Only Tesla BLE items (2) could be narrowed by make. Pre-2008 and some Canadian-market cars may have none.

Do not narrow:
5. Seat type, hex size (no vehicle-side data; wheel and nut properties).
6. Centre caps, cap logos and hardware (fit a wheel design, not a vehicle).
7. Valves, wheel weights, tools, bags, antennas, studs.

## 6. Risks and effort

- **Gap years 2024-2027.** PREMA ends at MY2023-24 and no thread source shows MY2025-27. The existing "nearest real year" rule would carry a model's last frequency forward; that is wrong when a model switches 315 to 433 (the 2017-2023 history shows many switches) or changes thread (Tundra 2022+ moved to 14x1.5, per a search snippet I did not confirm on a page). Recommend marking carried-forward rows "assumed" and showing no frequency for years beyond the last real row if the model switched within the last six years.
- **PREMA's naming** (`CR -V RD`, `A4 8E`) needs an alias table; unmatched is the main loss, not wrong values.
- **BMW/MINI US vs EU frequency** (PREMA 433 vs Schrader 315 for 2008-2011): unresolved; leave blank until a US-market source confirms.
- **Single-source TPMS data for MY2017-2023** (see 4.1). Reasonable to ship with a "check your sensor" line.
- **Canada**: no TPMS mandate, so sensor-equipped status cannot be assumed.
- **Licences**: PREMA, Schrader, Dill, Gorilla are all manufacturer marketing PDFs; I read no terms that allow or forbid reuse. ANKUSI (CC BY 4.0, credit waived by the owner) is the clean route for thread. McGard is a no.
- **Effort (rough):** thread column via ANKUSI email 0.5 day once they reply, then 0.5 day to normalise and wire (nut/bolt flag, new `thread` and `fastener` fields in `VehicleFitment`); TPMS table 1.5-2 days (parse, alias table, review, loader); hub-ring and spacer matching in `queries.ts` 1 day; tests and the admin/UI wording 1 day. If ANKUSI cannot add the column, a make-level thread table from the Gorilla guide with about 25 hand-checked exceptions is about 1.5 days and will be coarser.

## 7. Could not verify

- PREMA, Schrader and Dill terms of use (site pages blocked or none found).
- Any second source for TPMS frequency on MY2017-2023.
- US-market BMW/MINI/VW-Audi TPMS frequencies for 2008-2012.
- That the Subaru 2018+ 433 MHz entries and Ram 1500 2010+ 433 MHz entries are right for Canadian-market cars.
- Whether Canadian-market vehicles ever lack TPMS beyond what search results said; I did not read CMVSS.
- Tundra 2022+ and any thread for MY2024-2027 (no source covers them).
- ANKUSI's thread field across its 1,224 rows: I read 4 pages (F-150 2018 and 2021, Wrangler Arctic 2012, ABT Audi AS5), not all. The F-150 value agrees with the Gorilla guide.
- The model alias table (hence the final PREMA join rate, between the 73% naive figure and a hoped-for 85-90%).
- Autel's full coverage list (blocked) and Continental REDI-Sensor (host unreachable).
- ANKUSI's agreement with the owner is on file only as the owner's statement.

## 8. Sources

- PREMA USA TPMS Application Chart: https://www.premaproducts.com/downloads/PREMA-USA-TPMS-Application-Chart-10-2023-v2.pdf
- Schrader 2016 Sensor & Service Pack Catalog (CARiD copy): https://images.carid.com/schrader/items/pdf/schrader-product-catalog.pdf
- Dill TPMS Applications Chart 2013: https://www.yourtireshopsupply.com/pdffiles/DILL%20TPMS%20APPLICATION%20GUIDE%205-1-13.pdf
- Autel MX-Sensor V5.21 US coverage list: https://www.autelstore.co.uk/upload/service/mx-sensor-v521-coverage-list-us.pdf
- Gorilla Automotive application guide: https://www.yourtireshopsupply.com/pdffiles/GorillaLugnutWheel%20application%20guide.pdf
- ANKUSI dataset and pages: https://ankusiwheels.com/wp-content/uploads/dataset/ankusi-wheel-fitment.csv , https://ankusiwheels.com/fitment-guide/ford-f-150-2018/
- boltpatternhq: https://boltpatternhq.com/toyota/corolla/2021/ and the pages named in 4.2
- McGard vehicle application guide: https://mcgard.com/automotive/vehicle-application-guide/
- Wikipedia Lug nut: https://en.wikipedia.org/wiki/Lug_nut
- FitMyWheel chart: https://fitmywheel.com/lug-nut-size-chart/
- Canada TPMS (search results): https://drivesmartbc.ca/equipment/tire-pressure-monitoring-system
