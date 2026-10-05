# Vehicle fitment in what we already hold from vendors (local, read-only analysis, 2026-10-06)

Scope: `~/platinum-wheels-feasibility/` (recon notes, vendor adapters), `~/Platinum Wheels Vendor Data/` (Individual Vendors CSVs + raw captures, `combined/share/*.xlsx`, `combined/final/*.xlsx`, `docs/`). No network calls, no logins, no repo edits. xlsx read with openpyxl installed in a venv inside the scratchpad. Credentials/tokens were not printed or copied.

Note: `~/platinum-wheels-feasibility/data/*/` is empty (the raw captures were moved into `Individual Vendors/*/_working`, `raw`, `_source`). `combined/share/*.xlsx` totals: Wheels 38,405 rows, Tires 10,147, Accessories 1,803.

## Bottom line

We hold real vehicle-to-wheel fitment for **22 wheel rows from one vendor (Vertex), covering 9 distinct make/model pairs, 11 make/year/model combos, 17 incl. trims, 3 makes (Acura, Audi, Honda), model years 2024 and 2025 only**. Everything else is either nothing, or a few dozen accessory titles that name a make. That is about 0.06% of wheels and covers roughly 9 of the 843 models in `scripts/data/vehicles.csv`. **It cannot replace the finder's fitment sheet.** The vendors that probably do hold real fitment data (Auto Country's `nero/*` vehicle API, DAI's `ShowApplication`/`GetYears` AJAX, PRO WHEELS' `get-wheels-by-vehicle`/`verify-fittment`) were identified in JS but **never called**, so none of it is in our files.

## Per vendor

| Vendor | Vehicle info actually captured | Rows / combos | Fields | Maps onto vehicles.csv? |
|---|---|---|---|---|
| Vertex Tires (public Shopify `products.json`) | Wheel tags `fitment:Make:Year:Model:Trim` (column `fitment` in `Vertex Tires/wheels.csv`, `fitment` in `combined/share/Wheels.xlsx` and `final/Wheels.xlsx`) | 22 of 22 Vertex wheels (all brand OE Stance). Tags per wheel 1 to 9. 17 make/year/model/trim strings, 11 make/year/model, 9 make/model, 3 makes | The wheel's own bolt pattern (5x112, 5x114.3, 5x120), centre bore (wheel's own: 57.1 to 74.1... see below), offset, diameter, width, finish. No tire size, thread or TPMS | Yes, 8 of 9 make/model pairs match by exact name (Acura ADX, Integra, MDX, RDX, TLX; Audi A3, A4; Honda Accord). `A4 Allroad` does not (finder has `A4 allroad`/ no exact match, case/spacing). Trim strings (`45 TFSi Quattro B9 Facelift`) have no place in the finder |
| Auto Country | `fitment_note` key exists in tire API JSON but is `""` in all 13 captured tire rows (12 list + 1 keyword search). Wheel list API has no vehicle field. No YMM list saved. JS bundle shows the vehicle endpoints (below) but nothing was called | 0 | none | no |
| Direct Auto Import | Product-page `Applications` tab (`ajax/ShowApplication.php`) and YMM widget (`ajax/GetYears/GetMakes/GetModels/GetSubModels/GetOptions.php`) exist, were **not called**. What was captured: an `X COMPATIBLE` note on 4 accessory cards in two saved HTML pages (ACURA, RAM, TESLA, Toyota; centre caps, a weight) and none of it reached any CSV | 4 products in raw HTML only; 0 in CSVs | make only | no (make only) |
| PRO WHEELS / dealerwheels.ca | Listing API payloads (21,178 wheels, 6,233 tires) carry no vehicle field at all. `get-wheels-by-vehicle` and `verify-fittment` appear in JS only (both POST, never called) | 0 | none | no |
| Wheel Works | Portal writes `vehicletype`, `vehiclemodel`, `make_year`, `inflation` but all 696 tires are `ANY`/`ANY`/blank; 2 wheels, none | 0 | none | no |

Vertex data-quality caveats (already noted in `docs/OPEN_QUESTIONS.md` Q25 as "self-contradicting"): Acura Integra 2024 is tied to 5x114.3 wheels and also to 5x120 wheels (the repo's own `vehicle-fitment.csv` says Integra is 5x114.3 / 64.1), so the tags are loose compatibility lists, not OE specs. The centre bore on a Vertex row is the **wheel's** bore (e.g. 66.6 on an Audi A3 whose hub is 57.1 in `vehicle-fitment.csv`), not the vehicle hub. Do not copy it into a hub-bore column.

## Combined workbook scan (share + final), regex for fitment language

Columns searched: title, vendor_title, description, model, specs, fits_wheel, fits_design, fitment, line. Make list = the 47 makes in `scripts/data/vehicles.csv`, years 19xx/20xx, keywords fits/fitment/compatible/application/vehicle/OEM.

- Descriptions are almost empty of vehicle text: non-empty `description` is 254 tire rows, 21 wheel rows, 17 accessory rows only. Of those, make-name hits: 1 tire (generic marketing, no real vehicle), 2 wheels (Vertex OE Stance copy), 1 accessory. Tire descriptions say `SUV`, `trucks`, `vehicles` generically (111 Vertex tires use "fitment/fits/vehicle" in marketing, no make or model).
- Titles/vendor titles naming a make: 3 Auto Country lug nuts (`FORD 14x1.5`, `JEEP INSTALL KIT` x2), 4 DAI nuts/bolts (OE HONDA, DODGE CARAVAN, FORD 14, OE RAM), 1 DAI TPMS valve (`FOR MANY CHRYSLER FORD PRODUCTS + 16-15 HYU SONATA 16-14 KIA SOUL`, the only title with model years), 3 DAI TPMS sensors (`TESLA 3/Y 2021+`), 1 Vertex wheel (`Vinfast Fitment`, plus 3 "Honda Radius seat" seat-type mentions that are not vehicle fitment). In total about 12 accessory titles and 1 wheel title.
- "Replica" wheels (ART Replica `REPLICA 105` etc.: 1,344 PRO WHEELS + 510 DAI rows) are named by design number only, no vehicle.
- Wheels `tpms_compatible` = Yes on 1,279 DAI rows; `winter_compatible` on 1,061. These are wheel-level flags, not vehicle info.
- Accessories (DAI, 1,438 wheel + accessory DAI rows):
  - `fits_wheel` (232 rows) and `fits_design` (396 rows) list **wheel model codes** (`DW83`, `RUF35`, `R183`), i.e. which wheel a centre cap fits. That links accessory to wheel, not to a vehicle.
  - `bolt_pattern` on 77 accessories (61 wheel spacers + 16 centre caps), `center_bore_mm` 61, `wheel_diameter_in` 73.
  - `thread_size` 523 rows (DAI 397, Auto Country 126) across 11 distinct sizes: `14x1.5` 169, `12x1.5` 115, `12x1.25` 70, `1/2 UNF` 47, `14x2.0` 36, `9/16 UNF` 32, `14x1.25` 26, `12x1.75` 15 ... This is a thread size per product, not per vehicle. It can only be used to filter accessories if a vehicle row already says its thread.
  - Hub rings and centering rings: 204 rows with outer/inner diameter (`73.1-54.1 mm`). Inner/outer = wheel bore to vehicle hub bore. This is a hub-bore value (e.g. 54.1) but no vehicle is named.
- TPMS frequency (315/433 MHz): not stated in any title or description. 14 DAI TPMS & Tools rows and 2 Auto Country sensor rows exist, none carries a MHz value. `Dual Band` appears once on a Bosch sensor.
- Tire sizes tied to vehicles: none anywhere (Wheel Works `vehicletype`/`vehiclemodel` all `ANY`; Auto Country `fitment_note` empty).
- The final `catalogue.csv` (39,961 products) keeps the 22 Vertex `fitment` strings inside `extra_specs` (14 lines contain `Audi:2025`), nothing else.

## What could be added to the finder from this data

1. Vertex's 17 trim-level tags give, for 11 vehicle-year combos, a list of OE Stance wheels that "fit" and the wheels' bolt pattern. It matches the finder's existing bolt-pattern data for 7 of the 9 models (Integra 5x120 rows conflict). Zero new bolt patterns. Not worth importing as fitment data; useful at most as a "fits this vehicle" badge on 22 products, with the Integra contradiction needing a ruling.
2. DAI/Auto Country accessory titles that name a make (about 12) and DAI `X COMPATIBLE` notes (4) could drive an accessory "fits Tesla / Ford / Ram / Honda" label by hand, not the finder's data.
3. Nothing in our files gives tire size, TPMS frequency or lug thread per vehicle. Those stay placeholder (D48) or come from the founders' fitment sheet (D110, D149).

## Lawful capture vs what would need new access

Already captured by lawful means (anonymous, public, read-only, per `DECISIONS.md` F1 to F26 and the recon notes):
- Vertex `products.json` (public Shopify JSON, F7). Source of all 22 fitment rows. Note F3 recorded Vertex's Terms of Service bans automated access (§13(e)) and F6/F7 accepted the risk and then used public data only.
- Auto Country anonymous catalogue API (`autocountry.frb.io/frontend/v2`), accessories list and tire/wheel list JSON. No vehicle data in them.
- DAI public listing/product HTML (`directautoimport.com`, anonymous). Contains the `X COMPATIBLE` notes.
- PRO WHEELS / dealerwheels `wheelsapi.com` public API (F4 field allowlist, F10, F11 faster rate). 21,178 wheels, 6,233 tires, no vehicle field.
- Wheel Works: dealer-login catalogue only (F8, F9): the owner logged in by hand; two read-only search POSTs allowlisted.

Would need NEW access (list only; none done; each needs the owner's approval, and any POST outside `common/http.py` `ALLOWED_POST_URLS` is currently refused by design):
- **Auto Country `nero/*` vehicle API** (same host, same anonymous API): `GET /nero/years`, `/nero/makes/{year}`, `/nero/models/{year}/{make}`, `/nero/sub-model/{year}/{make}/{model}`, `/nero/options/{year}/{make}/{model}/{subModel}`, `POST /nero/vehicle-ranges`; also `GET /accessory/find-by-vehicle` and `/accessory/find-by-wheel-sku`. `recon/autocountry.md` marks `nero/*` as anonymous but `find-by-*` as "not tried". Unknown: what `options` returns (tire size? wheel size?), and POST is outside the allowlist.
- **DAI**: `ajax/GetYears|GetMakes|GetModels|GetSubModels|GetOptions.php` (GETs) and `ajax/ShowApplication.php?reference=<SKU>&type=wheels&lang=en` per product (the "Applications" tab; DAI claims "a database of 100,000 applications"). Public-looking, but 3,760 tires+wheels product pages would be about 3 h (recon estimate). Not called, so unknown whether anonymous responses include real fitment.
- **PRO WHEELS / dealerwheels**: `POST wheelsapi.com/api/get-wheels-by-vehicle` (body make, year, model, submodel, diameter) and `POST /api/verify-fittment` (vehicleKey + sku). Both are POST, which `common.http.Polite` refuses; the vehicle year/make/model list endpoint was not identifiable from the saved JS chunks.
- **Wheel Works**: nothing to gain (vehicle fields are `ANY`).
- A vendor data feed or EDI file from DAI or PRO WHEELS is the cleaner route (feasibility note: "some feed to resellers probably exists"); that is a request to the vendor, not scraping.

## What I could not determine

- Whether Auto Country's `nero/options` or DAI's `ShowApplication` return wheel/tire sizes or only a vehicle list (neither response was ever saved).
- Whether DAI's "ACURA COMPATIBLE"-style notes appear on more than the 4 products in the two saved pages (only 192 listing cards plus a few pages were saved, not the whole catalogue).
- The PRO WHEELS vehicle-list (year/make/model) endpoint; only the POST for fitment lookup is visible in the bundle.
- Whether Vertex's fitment is complete or sampled (only 22 wheels exist in the public catalogue).
- I did not open the five raw ~3 GB DAI `_source` dump beyond the CSV headers and DAI accessories `DESCRIPTION` columns, and did not scan image files or the French columns.

## 5 sample rows

1. Vertex wheel `46327385981117`, OE Stance BR01 19x8.5, 5x112, offset +25: `fitment = Audi:2025:A4 Allroad:45 TFSi Quattro B9 Facelift`.
2. Vertex wheel `46327383130301`, OE Stance AC4, 5x112, offset +28: `fitment = Audi:2025:A4 Allroad:45 TFSi Quattro B9 Facelift|Audi:2025:A4:45 TFSi Quattro B9 Facelift`.
3. Vertex Acura wheel set (9 tags on one row): `Acura:2024:MDX:3.0T YD4 | Acura:2024:MDX:3.0T YD4 Facelift | Acura:2024:MDX:3.5i YD4 ...`, bolt pattern 5x120 (matches the repo's MDX 5x120).
4. DAI accessory (TPMS valve) `1720046`: title `TPMS Snap-In Valve ... for Many Chrysler Ford Products + 16-15 Hyu Sonata 16-14 Kia Soul`; DAI nut `12x1.50 19MM NUT OE HONDA CHROME` (thread 12x1.5, make Honda).
5. DAI centre cap: title `Center Cap Black DW83 8906K60AB1`, `fits_wheel = DW8317003A; DW8317005; ...` (wheel codes, no vehicle); and a DAI listing card with the text `ACURA COMPATIBLE` (raw HTML only, not in any CSV).
