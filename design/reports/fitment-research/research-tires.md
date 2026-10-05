# Free sources for factory (OE) tire sizes by vehicle, 2005-2027, North America

Research date: 2026-10-06. Read-only. No logins. About 45 page or file fetches in total.
Banned sources (wheel-size.com, wheel-sizes.com, tirewheelguide.com, faultpedia.com, teoalida.com, tiresize.com, tirerack.com, anything Wheel-Size-derived) were not used as evidence. Some search summaries quoted them; those quotes are ignored.

## Bottom line

There is no free, licensed, downloadable data set of OE tire sizes by year/make/model for North America. Every open set I found is either wheel-only, scraped without a licence, or not North American. The only free source that is both accurate and defensible is the manufacturers' own annual spec sheets (press kits, "info centers", owner's manuals), read one model-year at a time.

## Ranked sources

### 1. Manufacturer press-kit and spec-sheet PDFs, and OEM info pages (best option)

What they are: one short spec sheet per model-year, written for journalists, with tire size per trim.

Verified examples:
- Honda Info Center, per model-year page, e.g. https://www.hondainfocenter.com/2021/Civic-Sedan/Feature-Guide/Exterior-Features/Wheels-and-Tires/ . Lists size per trim. Covers 2017-2027, about 25 Honda/Acura models, US vehicles only (its footer says so). robots.txt allows all. Terms page not read.
- Mazda USA spec deck PDF, e.g. https://filecache.mediaroom.com/mr5mr_mazdausa2/223245/download/2021%20CX-5%20Spec%20Deck.pdf . Read directly: Sport and Touring P225/65R17, all others P225/55R19.
- Subaru media spec PDF, e.g. https://s3.amazonaws.com/subarumedia.iconicweb.com/mediasite/specs/2022_Outback_Wilderness_specs_-FINAL.pdf . Read directly: Yokohama Geolandar A/T 225/65 R17 102T.
- Nissan USA newsroom press kit, e.g. https://usa.nissannews.com/en-US/releases/release-6de6bfb09d5d44debb76bd89c374f589-us-2018-nissan-rogue-press-kit . It has a per-trim tire and wheel list and a specs PDF link.
- Hyundai Media Center product-specification PDFs, e.g. https://www.hyundainews.com/assets/documents/original/53078-2023TucsonProductSpecifications20221114.pdf . Exists for 2021-2025. I could not read the PDF myself (curl got an HTML block page); I only have a search summary of it (235/65R17, 235/55R19).
- Toyota newsroom (pressroom.toyota.com, media.toyota.ca) carries wheel and tire text per grade. Search summaries only. toyota.com robots.txt blocks AI crawlers.
- Stellantis media (Ram): the 2020 Ram 1500 fact sheet has no tire sizes (checked). The Ram tire chart is a "Body Builder" PDF that returned 403. Stellantis robots.txt blocks ClaudeBot.
- Ford and GM media pages were not checked. Ford's media site has an empty robots.txt.

Fields: model-year, trim or grade, tire size (usually with load and speed index), wheel size.
Coverage: roughly every model-year of every major brand. A rough estimate, not measured: 75-85% of the 720 model-years for 60 models over 2015-2026. Weak spots are Ford, GM and Ram, whose press kits often omit tire sizes.
Format: PDF (2-6 pages) or HTML.
Extraction: per-page lookups, one file per model-year. About 720 files for the target set. PDF text extraction works (I used macOS PDFKit via a small Swift script). Tire sizes are a regex away; mapping them to trims needs a short human or LLM read.
Licence: no explicit data licence found. Media sites are made for editorial use. The facts themselves (tire sizes) are not copyrightable in the US or Canada, but I did not verify each site's terms. Respect robots.txt and fetch slowly. Where a site blocks AI crawlers (Toyota, Stellantis), download by hand.
Quality: best of all options. 4 of 4 OEM documents I read matched the aggregators on every size they listed.
Limitations: US trims and US vehicles. Canadian trims and sizes sometimes differ (Canadian-only trims, different option packages). Hyundai Canada's spec page shows current year only (2026 Tucson lists 235/65R17, 235/60R18, 235/55R19) and has no history.

### 2. Owner's manuals (US and Canada), useful as the second source

- Kia: https://ownersmanual.kia.com is free HTML, robots allow all. Its tire page has a table pairing tire size, wheel size and load/speed index (checked one page: 235/65R17 and 235/55R19).
- Ford: the 2019 F-150 manual (644 pages) has no per-trim tire table. I searched its full text: only a note on snow chains (245/70R17, LT245/70R17, 265/70R17, 265/60R18). So Ford manuals do not hold what we need. Ford's PDF host also returned 403 to curl (Akamai). I did not try to get around that.
- Toyota, Honda, Subaru, Hyundai, GM: manuals are known to have specification chapters, but I did not confirm a tire table in each.
Coverage: each manual covers one model-year. Often 400-650 pages, 8 MB. Canadian and US manuals are separate.
Quality: authoritative where the table exists, otherwise empty.

### 3. Retail "tires for my vehicle" pages (good data, not usable in bulk)

Examples: Mavis (mavis.com/vehicle/{make}/{model}/{year}/), Tireland.ca, Goodyear, SimpleTire, Firestone, Big O.
- Mavis lists OE size per trim for every year. All 10 of my spot-check pages worked, so it is handy for manual checking.
- Mavis Terms of Use forbid it: "use any program or automated script to screen-scrape or 'crawl' through the Website". Tireland's robots.txt blocks AI crawlers. Goodyear returned a header error to my fetch tool.
- Provenance of this data is not stated. Retailers usually license a commercial fitment feed, and I cannot rule out that some of these come from Wheel-Size. Under the hard rules, do not ingest any of them.
- Mavis lists one size per trim, so it misses optional wheel packages (see spot checks).
Verdict: spot-check by eye only.

### 4. GitHub: ilyasozkurt/automobile-models-and-specs (free download, do not use)

URL: https://github.com/ilyasozkurt/automobile-models-and-specs . 24 MB CSV zip. 7,207 model generations, 30,066 engine rows, 27,747 with a tire size. Last data update 2024-10-23.
- Scraped from autoevolution.com (stated in its README). No licence file. The GitHub licence field is empty. Reuse would infringe or at least carry real risk.
- Generation-level (e.g. "HONDA Civic Sedan 2021-Present"), not year-level, not trim-level, mixed markets.
- Gaps among my 10 test vehicles: no tire size for 2024 Tacoma, 2022 Outback, 2023 Tucson, 2021 Rogue, 2016 Corolla. 2020 Ram 1500 lists only 265/70R17. Equinox 2009-2017 lists "225/60R17" which looks wrong.
Verdict: not recommended.
- Also seen: vbalagovic/cars-dataset (sample only; the full set is for sale at EUR 7,500; European focus). Not usable.

### 5. ANKUSI wheel-fitment data set (already in use, D149)

URL: https://github.com/david025445/ankusi-wheel-fitment-data , CSV at https://ankusiwheels.com/wp-content/uploads/dataset/ankusi-wheel-fitment.csv . CC BY 4.0. 9,701 rows, 169 makes, 1940-2027. I downloaded it and confirmed:
- Fields: make, model, year, bolt pattern, centre bore, lug count, oe_wheel (diameter x width x offset), flush and max reference sizes.
- Tire size appears in 430 rows only (checked: pattern `NNN/NN`), nearly all non-North-American (AITO, BMW E30 and so on).
- For the 10 test vehicles it has rows for only 4 (2016 Equinox, 2024 Tacoma x2, 2019 F-150 Raptor) and all are wheel-only.
- Useful for rim diameter and width (to constrain tire candidates). Not a tire-size source.
- The licence needs a credit line. The owner ruled "use but give no credit" on the basis of an email agreement; that is not my call to judge.

### 6. BoltPatternHQ CSV (paid, not tire)

https://boltpatternhq.com/data/ . USD 29 one-time. 11,601 rows. Fields: year, make, model, trim, pcd, centre bore, offset, thread size, seat type, hex size. No tire size. Out of scope (and not free).

### Not viable

- NHTSA vPIC: no tire size. I pulled the full variable list (144 variables). The only wheel-related ones are Wheel Size Front (inches) and Wheel Size Rear (inches), IDs 119 and 120, which are empty on passenger-car VIN decodes. Rim inches at best.
- NHTSA TPMS-SS study files (https://www.nhtsa.gov/file-downloads?p=nhtsa%2Fdownloads%2FNASS%2FTPMS-SS%2F ): SAS tire and vehicle tables from a research sample. Not a catalogue. The page returned 403 so I could not look inside. Unverified.
- EPA test-car list (2014-2016 CSV downloaded and read; 4,650 rows, 66 columns): no tire fields. Contains road-load coefficients and test weights only. fueleconomy.gov vehicles.csv: no tire fields in its documented columns.
- NRCan fuel consumption ratings (open.canada.ca): no tire fields in the dataset description.
- Transport Canada: tire size is on the compliance/tire label on each vehicle. No public database found.
- Wikidata / Wikipedia infoboxes: I found no tire-size property for car models. Not verified beyond a search; treat as "probably nothing."
- Kaggle: "Car Specifications Database 1900-2025" and similar exist, but Kaggle pages could not be fetched (JavaScript), so I could not read columns, licence or provenance. "Car Tyres Dataset" is tire products, not vehicle fitment. Unverified.
- Hugging Face: no vehicle tire-fitment data set found. The ANKUSI set is mirrored there (hjhjhihg1/ankusi-wheel-fitment-data).
- Paid APIs (AutoAPI411, CarAPI, vdim tire API, vehicledatabases.com, DriveRight, AWS Marketplace tire size database): not free, out of scope.

## Spot-check of 10 vehicles

Sources: OEM (press kit or manual, read or summarised) vs Mavis (read on 10 pages), plus the autoevolution CSV and search summaries. No source has all trims verified by two OEM documents.

| Vehicle | OEM / best source | Second source | Result |
|---|---|---|---|
| 2021 Honda Civic | Honda Info Center: LX 215/55R16, EX/EX-L 215/50R17, Sport/Touring 235/40R18 | Mavis same, plus Type R 245/30ZR20; autoevolution same | Match |
| 2016 Chevrolet Equinox | No OEM document obtained | Mavis: L/LS/LT P225/65R17, LTZ P235/55R18. A search summary also lists P235/55R19 on LTZ | Partial: base size agrees, 19-inch only in one source |
| 2024 Toyota Tacoma | Toyota newsroom (summary): SR/SR5 245/70R17, Limited 265/65R18, Off-Road 265/70R17 | Mavis same for these; TRD Pro 265/65R18 on Mavis vs 265/70R18 in another search result | Conflict on TRD Pro, unresolved |
| 2019 Ford F-150 | Ford manual has no table | Mavis (245/70R17, 265/70R17, 265/60R18, 275/65R18, 275/55R20, 275/45R22, Raptor LT315/70R17) vs autoevolution (245/70R17, 265/60R18, 265/70R17, 275/65R18, Raptor 315/70R17) | Match, but no OEM source |
| 2022 Subaru Outback | Subaru spec PDF: Wilderness 225/65R17 | Mavis: 225/65R17 base/Premium/Wilderness, 225/60R18 Limited/Touring/Onyx; autoevolution 2023 same two sizes | Match |
| 2023 Hyundai Tucson | Hyundai spec PDF (summary only): 235/65R17, 235/55R19 | Mavis same | Match (US) |
| 2018 Nissan Rogue | Nissan press kit: S/SV 225/65R17, SL 225/60R18, SL Platinum option 225/55R19 | Mavis lists only 17 and 18; Tireland.ca adds 225/55R19 and a P225/65RF17 | Partial: Mavis omits the 19-inch |
| 2020 RAM 1500 | No OEM document readable (fact sheet has none, tire chart 403) | Mavis: 275/65R18, 275/55R20, Rebel LT275/70R18/E. A search result adds Classic 265/70R17 and 275/60R20 and Laramie 285/45R22 | Partial, unresolved |
| 2021 Mazda CX-5 | Mazda spec deck: Sport/Touring P225/65R17, others P225/55R19 | Mavis exact; autoevolution same | Match |
| 2015 Toyota Corolla | Owner's-manual-derived summary: L 195/65R15, LE P205/55R16, LE Eco 195/65R15, S P205/55R16, S option P215/45R17 | Mavis same minus the 17-inch option; autoevolution 195/65R15, 205/55R16 | Partial: option package missing from Mavis |

Tally: 5 match, 5 partial or conflicting, 0 outright wrong that I could prove. The lesson is general: sources that list one size per trim lose optional wheel packages (Equinox 19", Rogue 19", Corolla 17"). Any build should collect the union of sizes per model-year, and the finder does not need trim (the 3 spot-check misses are option packages).

Caveat on all of this: the "search summary" evidence comes from WebSearch result text, which is model-written and not a primary read. Only the Honda, Mazda, Subaru, Nissan and Ford documents and the Mavis, Tireland, Honda Info Center, Kia pages were read directly.

## Owner's-manual / spec-sheet extraction: effort estimate

Target: about 60 best-selling Canadian models x 2015-2026 = about 720 model-years.

| Step | Estimate |
|---|---|
| Find and download one spec sheet per model-year (15 brands, URL patterns differ, some by hand because of bot blocks) | 20-30 h |
| Extract text, pull tire sizes, map to trims (scripted, then LLM or human read of each) | 50-80 h (about 4-6 min per model-year) |
| Normalise (NNN/NNRNN, load/speed index, run-flat, spare) and merge into one row set per model-year | 15-20 h |
| First-pass total, one OEM source per model-year | 85-130 h, 2-3 weeks for one person. Expected fill about 75-85% |
| Second source per row (the project's two-source rule, D149): owner's manuals for brands that have a table, or a second press kit | another 60-120 h |
| Gaps (Ford, GM, Ram) needing other sources such as brochures and spec guides | 20-40 h, still partial |

These are my estimates, not measured. They assume LLM help on the reading. The slowest part is trim mapping, because Canadian trims differ from US ones. A model-year-level answer (union of sizes) would take roughly a third of this effort.

## Risks

1. No data licence. Everything here is facts read from sites whose terms I did not fully read. Respect robots.txt, go slowly, and do not mirror documents.
2. US vs Canada. Almost every OEM archive is US. Canadian trims and option packages differ (Canada-only trims; for example Hyundai Canada lists a 235/60R18 that the US 2023 sheet does not).
3. Option packages are the usual misses. Plan for a union of sizes per model-year.
4. Toyota, Stellantis and Ford sites block automated access. Their files would need manual download. Do not work around the blocks.
5. Aggregator provenance. If any retail page is quietly Wheel-Size data, using it would break the hard rule; it was therefore used for spot-checks only.
6. Older model years (2005-2014) have no press-kit PDFs online for many brands; only manuals or nothing.

## What I could not verify

- Kaggle and Hugging Face dataset contents beyond titles and snippets.
- Terms of use for OEM media centers, Honda Info Center and Hyundai News.
- Whether GM, Toyota, Honda, Subaru and Hyundai manuals carry a per-trim tire table in every year.
- Hyundai Tucson PDF, Toyota Tacoma pages and Ram tire chart (read via summaries or blocked).
- Whether Wikidata has any tire-size property.
- NHTSA TPMS-SS contents (403).
- Canadian OEM spec archives for past years (Honda.ca spec page gave a PDF link but only 2026).
- Any Canadian-market-specific truth for these ten vehicles.
