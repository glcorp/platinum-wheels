# Fitment: parked items (D155)

Items the fitment build session (started 2026-10-06 from [`fitment-build-prompt.md`](fitment-build-prompt.md))
could not settle alone. Owner, 2026-10-06: *"Only disagreements where I am needed, those can be parked
separately but should not wait for my input. The work should go on."* Each item says what it is, why it needs
the owner, what was done meanwhile, and a recommendation. Delete an item once ruled.

## 1. Model years before 2005

- **What:** Auto Country's lookup lists years back to 1948; the finder offers 2005 to 2027 (D110(1)).
- **Why you:** widening the finder is a scope change, and older cars bring older bolt patterns the catalogue
  barely stocks.
- **Meanwhile:** crawled 2005 to 2026 only. Nothing older is offered.
- **Recommendation:** keep 2005 as the floor for launch.

## 2. Lift and levelling sizes

- **What:** Auto Country answers a range per lift height (stock, levelled, 2" to 6" lifts, and lowered).
- **Why you:** offering lifted sizes means a lift selector in the finder, which is new UI and a promise the
  shop has to stand behind.
- **Meanwhile:** only lift 0 (stock) was asked for and used.
- **Recommendation:** stock only for launch; revisit if trucks drive enquiries.

## 3. TPMS frequency

- **What:** Auto Country states TPMS on or off per car, not the frequency (315 or 433 MHz).
- **Why you:** the owner chose TPMS off on 2026-10-06; no source we may use states the frequency.
- **Meanwhile:** TPMS sensors are not narrowed by vehicle.
- **Recommendation:** leave off.

## 4. Wheel spacers

- **What:** spacers state bolt pattern and bore in their names, not in columns, so they cannot be matched by
  spec yet.
- **Why you:** matching them needs a catalogue column (a schema change, D125 rule).
- **Meanwhile:** spacers are not narrowed by vehicle; they stay best matches (the D67 rule).
- **Recommendation:** parse bolt pattern and bore into spec columns in the next catalogue rebuild.

## 5. The home page's "checked to fit" wording

- **What:** the home `h1` reads *"The right tires, checked to fit."* (D140). Tire and wheel fit from the
  finder is now Auto Country's data plus derived ranges, which the shop promised the client only loosely.
- **Why you:** it is marketing copy the owner chose.
- **Meanwhile:** unchanged. No new copy says "checked" or "guaranteed".
- **Recommendation:** keep it: a person still checks every quote before anything is sold.

## 6. Logins

- **What:** Wheel Works' vehicle lookup needs a login.
- **Why you:** agents never log in.
- **Meanwhile:** skipped; Auto Country, Direct Auto Import and PRO WHEELS' public lookups are used instead.
- **Recommendation:** not needed unless a gap remains that only Wheel Works covers.

## 7. Direct Auto Import's robots.txt names AI crawlers

- **What:** DAI's `robots.txt` disallows `anthropic-ai`, `GPTBot` and `CCBot` from `/` (it does not name
  `ajax/`). Its public vehicle lookup answers anonymously and states bolt pattern, hub bore, offset, OE tire
  and wheel size, lug type and thread per trim. Neither DAI nor PRO WHEELS states a licence for reusing
  fitment data.
- **Why you:** the owner allowed "whatever is available publicly"; robots.txt is the operator's signal and a
  bulk harvest would go against it. DAI is the shop's own supplier, so asking them for a feed is open to you.
- **Meanwhile:** DAI is used only for small, targeted gap fills (cars Auto Country lacks) at 1 request a
  second, never a bulk crawl. PRO WHEELS is used to cross-check bolt pattern, bore and thread.
- **Recommendation:** ask DAI for a fitment export, or confirm that targeted lookups are fine.

## 8. Model names the finder now shows

- **What:** Auto Country's spelling is now the name in the finder (owner: *"Auto Country's name wins and ours
  becomes an alias so old URLs still resolve"*). That gives bare names and capitals: Mazda `2`, `3`, `5`, `6`
  (were `Mazda3` …), Tesla `3`, `S`, `X`, `Y` (were `Model 3` …), Nissan `TITAN`, Cadillac `ESCALADE IQ`,
  `LYRIQ`, `OPTIQ`, `MX-5 Miata`.
- **Why you:** it is how the list reads to a customer; the rule says Auto Country wins.
- **Meanwhile:** shipped as Auto Country spells them; the old names redirect to the new ones, so no link breaks.
- **Recommendation:** keep the maker's own capitals (LYRIQ, TITAN are the makers' styling), but show
  `Mazda3`/`Model 3` style names for the bare numbers. It is one display table in the generator.

## 9. One Auto Country value the market questions

- **What:** Toyota Tacoma 2015 reads 6x139.7 only; two websites put the base 4x2 four-cylinder on 5x114.3
  (bore 60.1), as Auto Country itself has for 2005-2014. Market checks on 2026-10-06
  (`fitment-research/phase7-market-check.md`) **confirmed** the other two doubts in Auto Country's favour:
  Buick Terraza 2006-07 is 6x115, and Acura MDX 2014-16 is 5x114.3. The Porsche `15x130` rows are blanked as
  centre-lock junk.
- **Why you:** the owner ruled Auto Country first where sources disagree.
- **Meanwhile:** Auto Country's 6x139.7 stands for the 2015 Tacoma.
- **Recommendation:** add 5x114.3 for 2015 so the base truck sees its wheels (a two-pattern year, like
  2005-2014). One row in the gap-fill sheet.

## 10. Finder years with no North American car

- **What:** 29 model-years the finder offers were not sold in North America that year (GMC Canyon 2013-14,
  Maserati GranTurismo 2020-22, VinFast VF 6 and VF 7 2023-25, VF9 2022, Ford GT MKII, Honda FCX Clarity
  2005-07, BMW M2 2022, Chrysler Cirrus 2006, Mitsubishi Diamante 2005, Chevrolet Suburban HD 2026-27 …).
  List: `import-report/vehicle-gapfill-empty.csv`.
- **Why you:** removing entries from the finder goes against *"union of both is best. dont lose data."*
- **Meanwhile:** kept; they filter nothing (every product shows as a best match), as a car with no data always has.
- **Recommendation:** drop them from `scripts/data/vehicles.csv` through `vehicles-fetch.mjs` rules.

## 11. Wheels whose bore is smaller than the car's hub

- **What:** such a wheel will not seat without machining. It is shown under Similar, not Best.
- **Why you:** hiding it entirely removes products from view.
- **Meanwhile:** shown as Similar.
- **Recommendation:** keep it as Similar; a fitter can bore a wheel out.

## 12. The two-bolt-pattern line

- **What:** when trims of one model-year differ (Ram 1500 2020: the new truck and the Classic; Cadillac CTS
  2006), `/wheels` shows wheels for both patterns (owner: *"Show wheels for both patterns."*) and one line:
  *"This model year came with two bolt patterns: 5x114.3 and 5x120. Check your trim before you order."*
  (the patterns are the car's own). It is on `/styleguide`.
- **Why you:** new copy, for your veto.
- **Meanwhile:** shipped as written.
- **Recommendation:** keep.

## 13. Lift and plus sizes the catalogue carries but no stock car reaches

- **What:** 158 tires of 33" overall and up, and wheels in UTV/ATV patterns (4x156, 4x137, 4x110: 425
  wheels) are never reached from the finder (`fitment-coverage.md`).
- **Why you:** reaching them needs the lift selector (#2) or a UTV/ATV make list, both scope changes.
- **Meanwhile:** they stay findable through the filters and search; the finder does not show them.
- **Market check (Phase 7):** the other unreached patterns fit no car the finder offers: 5x135 is the F-150
  and Expedition up to 2004, 6x165.1 the 1981-94 Ram Van, 5x101.6 the 1963-76 Dart, 10x285.75 Class 7-8
  trucks, 10x170 no factory vehicle (a vendor label), and 4x110 ATVs. 7x150 is the F-150's 2004-14 Heavy Duty
  Payload package; it is **not** added, because it would put a two-pattern line on every 2005-14 F-150 for two
  wheels. The 11 small tire sizes (12" and 13", 155/65R14) were factory on no 2005-2027 North American car.
- **Recommendation:** add Auto Country's lift ranges when lifted-truck enquiries justify the selector.
