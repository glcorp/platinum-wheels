# Vendor fitment lookups: Direct Auto Import and PRO WHEELS (recon for D155)

Run 2026-10-06. Anonymous, read-only, no login, no credential, no Authorization header, no CAPTCHA seen.
Pacing 1 request per 1.1 s per host (`fetch-helper.mjs`). Requests made this run:
DAI `directautoimport.com` 45; PRO WHEELS 72 in total (`wheelsapi.com` 53, `dealerwheels.ca` 18, `www.prowheels.ca` 1, which 301s to dealerwheels.ca; 17 of the 18 dealerwheels requests were the public static JS chunks of the page).
**PRO is about 12 over the ~60 cap**: the extra went on reading the vehicle-selector JS and on three retries caused by my own shell mistake. Nothing was refused and no sign of throttling appeared. Do not repeat that spend.

No endpoint refused a request. No 401, 403, 429, challenge page or captcha on either vendor.

## Verdict

| | Direct Auto Import (DAI) | PRO WHEELS (dealerwheels.ca, API wheelsapi.com) |
|---|---|---|
| Anonymous | yes, plain GETs, a PHP session cookie only for the final step | yes, plain JSON POSTs, no cookie |
| Years / makes / models / trims | yes, 1992 to 2027, 54 makes, ids | yes, make list is bundled in the site JS (56 makes, 1990 to 2025); models and trims by POST |
| Bolt pattern | yes | yes (`pcd`) |
| Centre (hub) bore | yes | yes (`cb`) |
| Offset | yes (single OE offset) | no |
| Lug thread | yes | yes (`thread`) |
| Lug nut or bolt | yes, explicit "Nut" / "Bolt", plus hex, seat, torque | flags exist but look **inverted**, do not trust (see below) |
| OE wheel size (diameter x width) | yes, front and rear | no (only a list of diameters, which includes plus sizes) |
| OE tire size, load/speed, PSI | yes, front and rear | no |
| TPMS | yes (Yes, No, Direct, Both, None) | boolean only |
| Staggered fitment | yes (front and rear rows) | boolean `staged` only |
| "Does wheel SKU fit car" | yes, per-SKU list of fitting vehicles (`ShowApplication`) and fitting-wheel list per vehicle | yes, boolean (`verify-fittment`) and fitting-wheel list per vehicle |
| Verdict | **Best source.** Fills every gap in the finder (bolt pattern, bore, thread, nut or bolt, OE tire and wheel size, TPMS) | **Useful second source and cross-check** for bolt pattern, bore and thread. Cannot supply tire size, wheel size or offset. Do not use its nut/bolt flags |

Both agree on bolt pattern, hub/centre bore and thread for all five sample vehicles that both answered
(2021 Civic, 2019 F-150, 2024 EV9, 2012 Cube, 2022 BMW M3). DAI is the only one with factory tire and wheel sizes.

Sample coverage (year / make / model):

| Sample | DAI | PRO |
|---|---|---|
| 2021 Honda Civic | yes, 8 trims, OE 16x7.0 5x114.3 ET45 hub 64.1, P215/55R16 | yes, 8 trims, 5x114.3 cb 64.1 M12x1.5 |
| 2019 Ford F-150 | yes, 9 trims | yes, ~20 trims (4WD/RWD/H-Duty), 6x135 cb 87.1 M14x1.5 |
| 2008 Pontiac G6 | yes, 4 trims, 5x110 hub 65.1 | **no**: `get-models` lists it but `get-submodels` returns an HTTP-200 body `{"error":{"status":500}}` for G6 and Grand Prix (reproduced twice). Pontiac is also missing from the site's own make list |
| 2024 Kia EV9 | yes, 5 trims, 5x114.3 hub 67.1, 285/45R21 | yes, 5x114.3 cb 67.1 |
| 2012 Nissan Cube | yes, 4x114.3 hub 66.1 | yes, 4x114.3 cb 66.1 |
| 2022 BMW M3 (stagger test) | yes, F 18x9.5, R 19x10.5, F 275/40R18, R 285/35R19, Bolt 14x1.25 | yes, 5x112 cb 66.6, `staged: true` |

## Anonymity and the one cookie

* **DAI** sets a `PHPSESSID` and one md5-named cookie on every anonymous response, exactly as it does for any visitor of the public site. Steps 1 to 4 (years to options) work with no cookie at all. The final step (`part_search.php`) is a post-redirect-get: the POST stores the chosen vehicle in the server session and 302s to `part_search.php`, which renders the result from that session. `fetch-helper.mjs` has an optional jar (`JAR=file`) that holds **only cookies the host set on an anonymous response during the run**; it was deleted afterwards. No login was done and no login cookie exists in this flow. If you would rather not carry even that, skip `part_search.php`: the first four endpoints plus `ShowApplication` need no cookie.
* **PRO**: no cookie, no token. The site's own JS adds an `account` field to `get-wheels-by-vehicle` and `v2/get-wheels-by-vehicle` (from `getAccount()`, the logged-in dealer account). **That field was never sent.** The older `get-wheels-by-vehicle` call in the public bundle sends only `make, year, model, submodel, diameter, filters` and works anonymously. The `v2` variant (adds `selectedFilters, page, pageSize`) was not called.
* Per owner ruling F4 (feasibility `DECISIONS.md`), the PRO wheel records include cost, profit, supplier and other price fields for anonymous callers. `pw-lookup.mjs` drops everything outside an allowlist (`sku, name, brand, diameter, width, offset, cb, finish, color, lifted, season`) in memory and never writes the raw wheel response to disk. The saved `raw/pw-lookup-*.json` files contain no price, cost or supplier field.

## 1. Direct Auto Import

Base: `https://directautoimport.com`. PrestaShop-1.4-style PHP, Apache, no WAF or CDN header. All "ajax" endpoints are GET, return an HTML `<select>` fragment, and take a throwaway `time=<ms>` cache-buster. Source of the parameters: the page's own inline JS (saved in `~/Platinum Wheels Vendor Data/Individual Vendors/Direct Auto Import/_working/phase1/product.body` lines 140 to 230, and `ShowApplication` at line 373). Every response carries `cache-control: no-store`.

Step ids are DAI's own and must be carried through. **Make, model and submodel are ids, not names.** Pass names and you get an empty select (observed: `make=Honda` returns `<option>- Model -</option>` only).

| # | Endpoint | Parameters | Returns |
|---|---|---|---|
| 1 | `GET /ajax/GetYears.php` | `part=model` (wheels), `lang_iso=en` | years 2027 down to 1992 |
| 2 | `GET /ajax/GetMakes.php` | `year`, `part=model`, `lang_iso=en` | `<option value=MAKEID>NAME` |
| 3 | `GET /ajax/GetModels.php` | `year`, `make=<makeId>`, `part=model`, `lang_iso=en` | `<option value=MODELID>Name` |
| 4 | `GET /ajax/GetSubModels.php` | `year`, `make=<id>`, `model=<id>`, `part=model`, `lang_iso=en` | trims; the option's `onchange` carries `GetOptions(<base_vehicle_id>, ...)` |
| 5 | `GET /ajax/GetOptions.php` | `base_vehicle_id`, `year`, `make`, `model`, `sub_model=<trimId>` | factory option rows: body style, drive, **OE tire size, load/speed** (e.g. `EX 17" option - 4 Dr Sedan (FWD) P215/50R17 91/H`) |
| 6 | `POST /part_search.php` (form) then `GET /part_search.php` | form: `search_part_selector=model`, `search_year_selector`, `search_make_selector`, `search_model_selector`, `search_sub_model_selector`, `search_option_selector=<optionId>` | POST answers `302 Location: part_search.php`; the GET renders the **OEM INFORMATION** block and the list of fitting wheels (24 per page, `?p=N`) |
| 7 | `GET /ajax/ShowApplication.php` | `reference=<DAI SKU>`, `type=wheels`, `lang=en` | every make / year / model / trim the SKU is listed for |

`part` also takes `tire`, `part_nut`, `part_light`, `part_wiper` (step 1 and 2 accept them; `part=tire` GetModels returned the same Honda model list). Only `part=model` (wheels) was followed to the end.

Make ids seen (full list, 54 incl. old makes, in `raw/dai-make-ids.json`): Honda 59, Ford 54, Kia 21, Nissan 67, Pontiac 52, BMW 31, Acura 58, Toyota 76, Chevrolet 47, Tesla 1164, Ram 1168.

### Example: 2021 Honda Civic EX

```
GET /ajax/GetMakes.php?year=2021&lang_iso=en&part=model&time=1
  <select ... onchange="GetModels(2021,this.value);"><option value="0">- Make -</option><option value="58">ACURA</option> ... <option value="59">HONDA</option> ...
GET /ajax/GetModels.php?year=2021&lang_iso=en&make=59&part=model&time=1
  ... <option value="751">Accord</option><option value="754">CR-V</option><option value="752">Civic</option> ... (10 models)
GET /ajax/GetSubModels.php?year=2021&make=59&model=752&part=model&lang_iso=en&time=1
  onchange="GetOptions(152780, 2021, 59, 752, this.value);" ... <option value="191">EX</option><option value="2117">EX-L</option><option value="113">LX</option> ... <option value="802">Type R</option>
GET /ajax/GetOptions.php?base_vehicle_id=152780&year=2021&make=59&model=752&sub_model=191&time=1
  <option value="65148">4 Dr Sedan (FWD) P215/55R16 93/H</option>
  <option value="134718">EX 17&quot; option - 4 Dr Sedan (FWD) P215/50R17 91/H</option>
  <option value="134719">EX 17&quot; option - 4 Dr Hatchback (FWD) 215/50R17 91/H</option>
POST /part_search.php  (form body as above, option 65148)  -> 302 Location: part_search.php
GET  /part_search.php  (same session cookie) -> 141 KB HTML, 285 results
```

The result page's OEM block (HTML tables with `class="oem_info"`; text rendering of the real response):

```
WHEELS  SIZE          BOLT PATTERN  OFFSET  HUB
Fr.     16'' x 7.0''  5x114.3       45      64.1
TIRES   SIZE          L/S    PSI
Fr.     P215/55R16    93/H   32
LUGS    TYPE  THREAD  HEX  SEAT    TORQUE
Fr.     Nut   12x1.5  19   Radius R12   80
TPMS    Fr.   No
```

Each listed wheel then reads, for example: `DW10015008 Direct Fit APEX Gloss Black 15x6.5 5x114.3 Offset: 42 Hub: 64.1 Load Rating: 690kg Backspacing: 5.404" 15lbs Retail Price $267.40 ** Will fit with OE nuts/bolts ** Fender clearance: -3mm ... Suspension clearance: +9mm`. Fender and suspension clearance are computed against the chosen OE wheel. Page also exposes filter groups (OE hub-centric, brand, finish, width, style).

### Parsing notes

* The OEM table uses `rowspan="2"` when front and rear are identical, so a rear value may be absent in text form: a single bolt pattern, offset, hub, lug type means both axles. A staggered car (2022 BMW M3) has two rows only for size (`18'' x 9.5''` front, `19'' x 10.5''` rear) and tire (`275/40R18`, `285/35R19`); its offset cell was a single value (20) in the HTML, so rear offset is **not** reported separately.
* `HUB` is the vehicle hub bore (matches PRO's `cb` on all 5 vehicles). Lug `TYPE` is literally `Nut` or `Bolt`; `THREAD` is `12x1.5` style; `HEX` mm; `SEAT` e.g. `Conical`, `Radius R12`; `TORQUE` is ft-lb as shown (80, 150, 103).
* TPMS values seen: `No`, `Yes`, `Direct`, `Both`. Cells can be empty (PSI empty on the M3).
* A trailing number on some option rows (`... 265/60R18 110/T 78.9`) repeats the same option with different values (78.9 and 67.1 on the F-150) and is not explained on the page; treat it as an unlabelled variant key, not a fitment fact.
* The options differ by factory wheel size: one trim can have several options (Civic EX 16" and 17"), each with its own OEM block. A full harvest needs every option, not just the first.
* The Civic result page lists 285 wheels for the EX 16" option, including 20" wheels (plus sizing). It is a "wheels that fit within clearance rules" list, not an OE-only list.

### "Does SKU X fit car Y" (DAI)

Two ways, both anonymous:

1. `ShowApplication.php?reference=<DAI SKU>&type=wheels&lang=en` returns the full vehicle list for one SKU, grouped by make, as `year Model Trim` lines (about 240 to 360 lines per SKU; 7 to 12 KB). Checked: `DW10015008` (a 15x6.5 5x114.3 Direct Fit wheel) lists `2021 Civic EX`, `EX-L`, `LX`, `Sport`, `Touring` and **not** `Sport Touring` or `Type R`; `R1831808` (the PDP's wheel) lists Acura and Honda models but **no Civic**. Trim-level and model-year-level, so it is stricter than "same bolt pattern".
2. Run the vehicle through steps 1 to 6 and look for the SKU in the result pages (24 per page).

Only DAI's own SKUs are known to it. A Wheel Works or PRO SKU needs the specs matched by bolt pattern, bore and thread instead.

Saved samples: `raw/dai-GetYears-model.html`, `dai-GetMakes-2021.html`, `dai-GetModels-2021-Honda.html`, `dai-GetSubModels-2021-Civic.html`, `dai-GetOptions-2021-Civic-EX.html`, `dai-part_search-REDIRECT-body-2021-Civic-EX.html`, `dai-part_search-RESULT-2021-Civic-EX.html`, `dai-ShowApplication-DW10015008.html`, `dai-ShowApplication-R1831808.html`, and per vehicle `dai-lookup-*.json` plus the intermediate `dai-models/submodels/options/part_search-RESULT-*` files for 2008 G6, 2012 Cube, 2019 F-150, 2022 M3, 2024 EV9.

### DAI rate limit and protection

None observed over 45 requests at 1 per 1.1 s: every response 200 (or the expected 302), no `retry-after`, no `x-ratelimit-*`, `server: Apache`, no challenge cookie. A prior recon (feasibility `recon/dai.md`) found the same. The site's `robots.txt` disallows `anthropic-ai`, `GPTBot` and `CCBot` from `/` (an operator signal about AI crawlers, worth weighing; it does not disallow `ajax/`). Cost to harvest all years x makes x models x trims x options is large (several requests per option); 2005 to 2027 is roughly 25 thousand model-year-trims, so budget hours, not minutes, and do it politely.

## 2. PRO WHEELS (dealerwheels.ca, `wheelsapi.com`)

`prowheels.ca` redirects (301) to `dealerwheels.ca`; both use the Strapi backend `https://wheelsapi.com/api` (nginx/1.18.0 Ubuntu, `x-powered-by: Strapi`, no CDN or WAF, no rate-limit headers, no cookies). Endpoint names and bodies come from the public front-end chunk of `https://dealerwheels.ca/en/wheels-by-vehicle` (the vehicle-selector component). All POST with `Content-Type: application/json`. Years and makes are not an endpoint: the site bundles a static list `[{make, activeYears:[...]}]` (extracted to `raw/pw-makes-years.json`, 56 makes).

| Endpoint | Body | Returns |
|---|---|---|
| `POST /api/get-models` | `{"make":"HONDA","year":2021}` | `[{"model":"ACCORD"},{"model":"CIVIC"}, ...]` (upper case) |
| `POST /api/get-submodels` | `{"make","year","model"}` | `[{"trim":"EX","options":[9525]}, ...]`. The body field is called `submodel`, the response field `trim`. `options` is an opaque id |
| `POST /api/get-diameters` | `{"make","year","model","submodel"}` | `[15,16,17,18,19,20]` (diameters wheels are offered in, plus sizes included) |
| `POST /api/get-wheels-by-vehicle` | `{"make","year","model","submodel","diameter","filters":[]}` | `oe` object, `wheels` (array of pages of up to 16), `total`, `pages`, `filters`, `newFilters` |
| `POST /api/verify-fittment` (sic) | `{"vehcileKey":"<key>","vehicleKey":"<key>","sku":"<sku>"}` | bare JSON boolean |
| `POST /api/v2/get-wheels-by-vehicle` | adds `account`, `selectedFilters`, `page`, `pageSize` | not called (needs the `account` field the site sends when logged in) |

`vehicleKey` is `MAKE|YEAR|MODEL|SUBMODEL|DIAMETER` (the selector joins make, year, model, submodel, diameter with `|`). The misspelt `vehcileKey` is sent together with `vehicleKey` by the site; both were sent here.

### Example: 2021 Honda Civic EX, 16"

```
POST /api/get-models      {"make":"HONDA","year":2021}
  [{"model":"ACCORD"},{"model":"CIVIC"},{"model":"CLARITY"},{"model":"CR-V"}, ... 10 models]
POST /api/get-submodels   {"make":"HONDA","year":2021,"model":"CIVIC"}
  [{"trim":"EX","options":[9525]},{"trim":"EX-L","options":[9525]},{"trim":"LX","options":[9525]},{"trim":"Sport","options":[9525]},{"trim":"Sport Touring","options":[9525]},{"trim":"Touring","options":[9525]},{"trim":"Type R","options":[8479]},{"trim":"Type R Limited Edition","options":[8479]}]
POST /api/get-diameters   {"make":"HONDA","year":2021,"model":"CIVIC","submodel":"EX"}
  [15,16,17,18,19,20]
POST /api/get-wheels-by-vehicle  {"make":"HONDA","year":2021,"model":"CIVIC","submodel":"EX","diameter":16,"filters":[]}
  {"oe":{"cb":64.1,"nut":false,"pcd":"5x114.3","bolt":true,"tpms":false,"staged":false,"thread":"M12x1.5"},
   "total":136,"pages":5,
   "wheels":[[{"sku":"W16001","name":"GHOST","brand":"Ghost Wheels","diameter":16,"width":7,"offset":40,"cb":67.1,"finish":"gloss black", ...}, ...]],
   "filters":[{"name":"width","options":[{"value":6.5,"checked":false}, ...]},{"name":"brand",...},"offset","color","season","cb","diameter"]}
POST /api/verify-fittment {"vehicleKey":"HONDA|2021|CIVIC|EX|16","sku":"W16001"}   -> true
POST /api/verify-fittment {"vehicleKey":"HONDA|2021|CIVIC|EX|16","sku":"R2841908"} -> false   (a BMW M3 replica, wrong bolt pattern)
```

(The `price`, `dealer_price`, cost and supplier fields that come with each wheel are deliberately omitted above and from the saved files.)

### What `oe` contains

`pcd` (bolt pattern string), `cb` (hub / centre bore, mm), `thread` (e.g. `M12x1.5`, `M14x1.5`, `M12X1.5` with inconsistent case), `tpms` (boolean), `staged` (boolean, true for the staggered M3), `nut` and `bolt` (booleans). **Not present:** OE tire size, OE wheel diameter or width, OE offset or an offset range, lug seat, torque.

Observed values:

| Vehicle | `pcd` | `cb` | `thread` | `nut` | `bolt` | `tpms` | `staged` | DAI says |
|---|---|---|---|---|---|---|---|---|
| 2021 Civic | 5x114.3 | 64.1 | M12x1.5 | false | true | false | false | Nut, TPMS No |
| 2019 F-150 | 6x135 | 87.1 | M14x1.5 | false | true | true | false | Nut |
| 2024 EV9 | 5x114.3 | 67.1 | M12X1.5 | false | true | true | false | Nut |
| 2012 Cube | 4x114.3 | 66.1 | M12x1.25 | false | true | true | false | Nut |
| 2022 BMW M3 | 5x112 | 66.6 | M14x1.25 | true | false | true | true | **Bolt** |

So PRO's `nut` / `bolt` are **inverted or mean something else** (probably "wheel needs bolt-type hardware" read the wrong way round): every car that DAI calls a lug-nut car reads `bolt: true`, and the only lug-bolt car (BMW) reads `nut: true`. Four of five samples is enough to say do not ingest these two flags without a manual definition. The civic `tpms: false` also agrees with DAI's "No".

### "Does SKU X fit car Y" (PRO)

`verify-fittment` is the direct answer and returns only `true` or `false`. Key points seen:

* It is diameter-specific: `W16001` against `HONDA|2021|CIVIC|EX|17` returned `false` (the wheel is 16"), against `...|EX|16` `true`.
* An unknown or mistyped vehicle key returns `false` (`HONDA|2021|CIVIC|XX|16`), so `false` does not distinguish "does not fit" from "no such vehicle".
* The vehicle key is trim-level. SKU-side input is PRO's own SKU only.
* Alternative with more detail: `get-wheels-by-vehicle` for the vehicle and check for the SKU across `pages` (136 wheels = 5 pages for the Civic EX 16"; 973 for an F-150 17"). The call returned 93 wheels in one response for the M3 19" (`total: 146`), so the pagination parameter of the v1 endpoint is unclear; `v2` takes `page`/`pageSize`.

### Coverage and gaps

* The bundled make list is 56 makes. Years are 1990 to 2025 for most, **2024 to 2025 only** for Alfa Romeo, Aston Martin, Bentley, Ferrari, Jaguar, Lamborghini, Lotus, Maserati, McLaren; Ford runs to 2026. Fisker, Karma, Lucid, Mullen, Bugatti and Rolls-Royce are 2024 only.
* Pontiac is **not** in that list but `get-models` knows it; `get-submodels` fails with an in-body 500 for 2008 G6 and Grand Prix, so old discontinued brands may be listed and unusable. Chevrolet Malibu 2008 works.
* Every sample vehicle other than the G6 resolved.

### PRO rate limit and protection

None seen over 72 requests at 1 per 1.1 s. `wheelsapi.com`: `nginx/1.18.0 (Ubuntu)`, no rate-limit headers, no `set-cookie`, no challenge. `dealerwheels.ca`: Netlify, no WAF. An earlier feasibility run (recon/prowheels.md) noted the API slowed and then refused connections under a heavy image download load, so keep it light. The 500 error bodies for Pontiac are application errors, not blocks.

## Helper scripts (this folder)

* `fetch-helper.mjs`: `node fetch-helper.mjs GET|POST <url> [outfile] [json-or-form-body]`, or `import { politeFetch }`. 1.1 s minimum gap per host (persisted in `.state.json`), per-host budget (`RECON_BUDGET`, default 60, persisted), sends only `Accept`, `User-Agent` and `Content-Type`, never cookies unless `JAR=<file>` is set (and then only cookies that host set anonymously). **Stops and writes a block marker** on 401, 403, 407, 429, 451, 503, a login redirect, or a challenge page (captcha / Cloudflare / DataDome wording on an error status); later calls to that host refuse until `.state.json` is edited by a human. Delete `.state.json` to reset counters.
* `dai-lookup.mjs <year> <makeId> <modelName> [trimName] [optionIndex]`: five requests, prints the OEM block, options and trims as JSON. Pass the trim as `""` for the first. Note `zsh` does not split an unquoted `$v`, so pass arguments one by one.
* `pw-lookup.mjs <year> <MAKE> <MODEL> [TRIM] [diameter]`: three requests (submodels, diameters, wheels-by-vehicle), prints and saves `oe`, trims, diameters, filter groups and an allowlisted sample of fitting wheels, never prices.

## Raw files (`raw/`)

DAI: `dai-GetYears-model.html`, `dai-GetMakes-{2021,2008}.html`, `dai-make-ids.json`, `dai-GetModels-2021-Honda.html`, `dai-GetModels-2021-Honda-tire.html`, `dai-GetSubModels-2021-Civic.html`, `dai-GetOptions-2021-Civic-EX.html`, `dai-part_search-RESULT-2021-Civic-EX.html` (and `-REDIRECT-body-`), `dai-ShowApplication-{DW10015008,R1831808}.html`, `dai-lookup-{2019-F150,2008-G6,2024-EV9,2012-Cube,2022-BMW-M3}.json` with their `dai-models/submodels/options/part_search-RESULT-*` pages.
PRO: `pw-get-models-*.json`, `pw-get-submodels-*.json` (incl. the Pontiac 500 bodies), `pw-get-diameters-2021-HONDA-CIVIC-EX.json`, `pw-lookup-*.json` (five vehicles, allowlisted), `pw-verify-fittment-*.json`, `pw-makes-years.json`, `pw-page-wheels-by-vehicle.html`, `pw-api-datas-names-p2.json` (no vehicle lists in that Strapi collection).

## Caveats and open items

* Neither source states a licence for reuse of its fitment database. DAI's about page claims "a database of 100,000 applications", and its robots.txt names AI crawlers. Spot checks and a bounded gap fill are the lowest-risk use; a bulk copy is a ruling for the owner (a feed request to the vendors is the cleaner route, noted in the feasibility recon).
* Not tested: DAI `part=tire` end to end, DAI result pagination, PRO `v2` endpoints, PRO page parameter on v1, French (`lang_iso=fr`) variants, trims beyond the first.
* DAI options with no OEM data return an empty OEM block (observed once when the form was posted with a placeholder option); always pass a real option id.
* The two vendors' trim names differ in detail (DAI `EX`, PRO `King Ranch H-Duty 4WD` against DAI `King Ranch`), so joining needs year + make + model and a loose trim match.
