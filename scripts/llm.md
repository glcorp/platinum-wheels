# scripts/

## Purpose
Standalone Node programs that sit *beside* the app rather than inside it. `prepare-assets.mjs`
turns the frozen PNG export into the shipped webp set; `parity-probe.js` is the measurement half of the
`docs/decisions.md` §9 quality gate. `hash-admin-password.mjs` makes the admin's
`ADMIN_PASSWORD_HASH` (D95). Delete this folder and `public/images/` can never be regenerated
from `design/assets/`, and parity becomes eyeballing — which
`design/reports/README.md:4` forbids outright.

## Owns
- [`prepare-assets.mjs`](prepare-assets.mjs) (137 ln) — `design/assets/*.png` → `public/images/*.webp`,
  plus the product cut-out canvas normalisation. Invoked as `npm run assets` → `node
  scripts/prepare-assets.mjs` (`package.json:13`). Prints a per-file before/after table and a total.
- [`hash-admin-password.mjs`](hash-admin-password.mjs) — `npm run admin:hash-password`. Reads the
  password twice from the keyboard with echo off (never an argument or a pipe, so it stays out of shell
  history), refuses under 12 characters, prints `scrypt:<N>:<r>:<p>:<salt>:<hash>`. The format is
  parsed by `src/features/admin/session.ts` `parsePasswordHash()`; change both or neither (D95).
- [`parity-probe.js`](parity-probe.js) (140 ln) — three browser functions: `probe(pairs)` (30 computed
  properties + bounding box per labelled selector, `:20-51`), `overflowers()` (the 375/768/1280 no-
  horizontal-scroll gate, `:89`), `accentCount(root, accent)` (the one-accent-per-frame audit, `:109`).
- [`vehicles-fetch.mjs`](vehicles-fetch.mjs) — `npm run vehicles:fetch`. Asks NHTSA vPIC for every model
  of the makes in its `MAKES` list, model years 2005 to next year, and rewrites
  [`data/vehicles.csv`](data/llm.md), the vehicle finder's Year / Make / Model list. About 3,200
  requests and four minutes. `--check` fetches and reports without writing. The cleanup rules
  (`EXCLUDED`, `RENAMED`, `SPLIT`, `SCION`, `ADDED`) are in the file, each with its reason; a rule that
  matches nothing is printed at the end of a run.
- [`vehicle-fitment.mjs`](vehicle-fitment.mjs) — `node scripts/vehicle-fitment.mjs --ankusi <file>`
  (**D149**, LA-05 of the D145 audit). Turns the downloaded ANKUSI wheel fitment CSV into
  [`data/vehicle-fitment.csv`](data/llm.md): one row per vehicles.csv make + model + model year ANKUSI
  publishes for that exact year (bolt pattern, bore, lug count, OE size), with the rules `ALIASES`,
  `TRIM_WORDS` and `EXCLUDED` in the file and a review list of everything it did not use written to
  `import-report/` (gitignored). Every run, with or without `--ankusi`, also validates the hand-kept
  [`data/vehicle-fitment-generations.csv`](data/llm.md) (valid model, bolt pattern, years, no overlap, two
  sources on two different sites, none of the banned ones; a bad row throws), lists any year where a
  generation row disagrees with an exact ANKUSI row, accepts `bolt_pattern=unknown` rows (they block the app's nearest-year rule), and compiles the committed CSVs into
  `src/features/finder/vehicle-list.ts` and `vehicle-fitment-data.ts`. No dependencies, no network.
  **Since D155** it also reads [`data/vehicle-fitment-autocountry.csv`](data/llm.md),
  [`data/vehicle-aliases.csv`](data/llm.md) and, if present, `data/vehicle-fitment-vendors.csv` (gap fills,
  `source` d/p/m/s/w) and writes `VEHICLE_SPECS` and `VEHICLE_ALIASES` into `vehicle-fitment-data.ts`, makes
  `vehicle-list.ts` the **union** of Auto Country's list and `vehicles.csv` in canonical names, re-keys every
  older sheet (`VEHICLE_FITMENT_DATA`, `_GENERATIONS`, `_THREADS`, `_WHEEL_SIZES`, `VEHICLE_TYPES`) to those
  canonical names, and writes `design/reports/fitment-overrides.csv` (every year where an Auto Country value
  disagrees with an older sheet; it prints the count). The field layout of a spec record is documented above
  `VEHICLE_SPECS` in the generated file. If the two Auto Country CSVs are absent it falls back to
  `vehicles.csv` alone and empty `VEHICLE_SPECS` / `VEHICLE_ALIASES`.
- [`vehicle-fitment-merge-gaps.mjs`](vehicle-fitment-merge-gaps.mjs) — `node
  scripts/vehicle-fitment-merge-gaps.mjs <folder with gapfill-*.csv>` (**D155**). Merges the gap-fill sheets
  (`gapfill-1..5.csv` and the vendor sheet `gapfill-vendor.csv`; header and `source` letters d/p/m/s/w + `1`
  in the file's header comment) into [`data/vehicle-fitment-vendors.csv`](data/llm.md), the file
  `vehicle-fitment.mjs` reads. Per field the highest-trust row wins (d > p > m > s > w, two sources beat one),
  values are cleaned like Auto Country's, and `source_url` columns are kept for provenance. Writes
  `import-report/vehicle-gapfill-{empty,conflicts,dropped}.csv`. Safe to re-run when a sheet changes.
- [`vehicle-fitment-autocountry.mjs`](vehicle-fitment-autocountry.mjs) — `node
  scripts/vehicle-fitment-autocountry.mjs [--raw <dir>]` (**D155**). Reads the saved Auto Country lookup
  answers (outside the repo: `~/Platinum Wheels Vendor Data/Individual Vendors/Auto Country/_working/nero/raw/`,
  written by `autocountry-crawl.mjs`, the only code that calls Auto Country; this script makes no request) and
  writes [`data/vehicle-fitment-autocountry.csv`](data/llm.md) (one row per Auto Country make + model + year)
  and [`data/vehicle-aliases.csv`](data/llm.md) (what becomes of each name), plus the git-ignored
  `import-report/vehicle-alias-review.csv` (pairs the rules could not decide). Safe to re-run while the crawl
  is still going: it rewrites both CSVs from whatever years are saved. The name rules (`same`, `member`,
  `split`, `ac-only`, `ours-only`), the hand tables `SAME` and `FAMILY` and the reading rules for options and
  ranges (staggered and flotation sizes, UNF threads, a body on another chassis) are in the file's header
  comment. It also routes a trim that is a separate model of ours (Civic Type R, Lancer Evolution, 300C) to
  that model's row, and writes `import-report/vehicle-trim-routing.csv` and
  `import-report/vehicle-fitment-missing-trims.csv` (model years with a slash-named trim that cannot be
  fetched). It blanks Auto Country's junk (ten or more lugs, bore 0, `Peg` thread) into
  `import-report/vehicle-fitment-junk.csv` and restores 19.5 / 17.5 / 16.5 inch wheel diameters from the tire's
  rim. Run it, then `node scripts/vehicle-fitment.mjs`.
- [`fitment-coverage.ts`](fitment-coverage.ts) — `npx tsx scripts/fitment-coverage.ts <catalogue.csv> [--out
  <dir>]` (**D155**, TypeScript). Offline coverage counter: for every model-year `vehicle-list.ts` offers it
  counts the Best and Similar results on `/tires`, `/wheels` and `/accessories` (default page, no other
  filter) and, turned round, which products no narrowing vehicle reaches. Reads the finder's own
  `findFitment` / `tireFit` / `wheelFit` and the importer's `planImport`; the matching is **re-implemented in
  JS from the SQL in `catalog/queries.ts`**, so a disagreement with `searchResults` is a bug on one side (keep
  the two in step by hand). No database, no network. Writes `per-vehicle.csv`, `reverse.csv` and
  `summary.json` to `import-report/fitment-coverage/` (git-ignored); about 3 s. Stubs `server-only`, which
  is not installed.
- [`db-migrate.mjs`](db-migrate.mjs) — applies `drizzle/*.sql` via `DATABASE_URL_UNPOOLED`. Runs first in
  `npm run build`, so every Vercel build migrates its own Neon branch (preview) or main (production)
  before `next build`. Exits 1 on Vercel with no URL; skips locally. Also `npm run db:migrate`.
- [`catalog-import.ts`](catalog-import.ts) — `npm run catalog:import -- <file.csv>` (D113). Reads a
  catalogue CSV, runs every row through the product validator and writes a report folder
  (`summary.txt`, `rejected.csv`, `products.csv`). A dry run unless `--write` is given; then it loads the
  valid rows into an **empty** catalogue, in batches over parallel connections. The database is
  `IMPORT_DATABASE_URL`. The thinking is in `src/features/catalog/import-plan.ts`, the column layout in
  `import-mapping.ts`, and the suggested file layout in `docs/catalogue-csv.md`.
- [`catalog-photos.ts`](catalog-photos.ts) — `npm run catalog:photos -- <folder> --env <file>` (D139b). Takes
  the co-founder's photo hand-off (`product-images.csv` + `images/`), checks the sheet, and with
  `--upload` stores each vendor file once in the R2 photo bucket (`catalog/<category>/<hash>-1000.webp`
  as given, plus the `-480` card size), then with `--link` writes the `product_images` rows after matching
  every row by slug **and** vendor + vendor SKU. Dry run by default; typed `yes` before each write; creates
  only; skips stored files and products that already have photos, so a rerun adds nothing twice. Reports
  go to `photo-report/` (gitignored). Settings (the five R2 ones, `IMPORT_DATABASE_URL`) come only from
  the `--env` file. Rows whose file is a known vendor placeholder graphic are left out, not refused
  (next rule).
- [`catalog-csv-build.ts`](catalog-csv-build.ts) — `npm run catalog:build-csv -- --share <dir> --final
  <dir> --out <dir>` (D125). Turns the co-founder's merged vendor workbooks (`share/`: one row per vendor
  listing; `final/`: one sheet per vendor, read only for `vendor_price`) into the one `catalogue.csv`
  that `catalog-import.ts` loads, plus `issues.csv`, `merge-report.csv`, `needs-review.csv` and
  `summary.txt`. Joins each `-B1`/`-B2` wheel pair back into one listing, merges only across vendors
  (priority Auto Country > Direct Auto Import > Vertex Tires > PRO WHEELS > Wheel Works) and never on
  a blank key field, fills a winner's blank fields from the next vendor in priority, never a vendor's own
  code such as a part number (logged in the merge report), applies the owner's wheel brand table, and runs every output row through `planImport()` before writing. Exits 1
  if any final check fails. Reads `.xlsx` with `exceljs` (dev dependency).
  **Since D135** the merge rules widen (M1 blank-key merges on a unique match, a shared vendor SKU
  settling ties; M2 accessories on one SKU; M3 one vendor's listings identical in everything a shopper
  sees, Part number included), `MODEL_ALIASES` folds model spellings (M4), accessory SKUs move to a
  `Part number` spec (M5), and M6–M9 tidy models, pack sizes, P3 values and descriptions. It also writes
  `changes-review.csv`: one row per data edit or merge decision, for the owner to review before a load.
  **Since D142** Part number and Mud & snow still travel through the merge as extras (so M3 and the
  vendor-own-code rule see them as before) and leave at output for the `part_number` and `mud_snow`
  columns. A tire's Part number is dropped, and M3 no longer counts it as a visible difference.
  **Since D152 (launch audit Batch 3, owner 2026-10-05)** three more rules run, every edit a row of
  `changes-review.csv`: **M10** trims descriptions: a trimmed text may use only the vendor's own words plus a short list of joining
  words (a, the, and, for, is, …), so no new noun, number or claim can appear, and a hollow or broken sentence
  is recast in those words; the run fails if a trimmed text uses another word, still has a dash, or names a
  season other than the label. A size or load index that is not the
  product's own blanks the whole description. Otherwise `DESCRIPTION_TRIMS` (vendor + SKU, hash of the vendor
  text) holds the curated text of each of the 270 listings that was touched: sales words and clauses deleted
  inside their sentence, the facts kept, pasted "Key Features:" headings stripped but their feature sentences
  kept, and each text read by a person; a vendor text that changed no longer matches its hash and takes the automatic path, which does the
  same by rule (and each row's log names its path). **M11** blanks an impossible tire load index and its speed
  letter (above 150, the vendor's own name stating another one, or more than 15 from the median of at least 5
  tires of the same size) unless `LOAD_INDEX_CONFIRMED` holds a value read from a vendor or maker page, which
  then sets it. **M12** retypes a lug whose vendor Model is `BOLT` from Lug Nuts to Lug Bolts (and its name).
  `MODEL_ALIASES` gains 14 tire folds; `MODEL_NOT_FOLDED` lists the look-alikes left apart. Three more final
  checks fail the run: a dash in a description, a load index above 150, a Lug Nuts row whose Model is BOLT.

## Rules
- **`client-assets/` is where client material supplied AFTER the design export goes** (D63).
  `design/assets/**` is the frozen export and is never added to (D55), so later photography lands in
  `client-assets/<kind>/` and `prepare-assets.mjs` → `clientProducts()` normalises it into the same
  `public/images/products/` output. Sources there are committed, like the design export's.
- **Client photos shot on white are keyed by a border flood-fill, never a luminance threshold**
  (D63). Chrome highlights are as bright as the background, so a global threshold punches holes through
  the product; the flood-fill only removes background connected to the image edge. The 215 threshold is
  measured, not guessed — see the block comment above `keyBackground()`.
- **`catalog-photos.ts` reads its secrets from the `--env` file only** (D139b). Never pass a key or a
  connection string as an argument or paste one into a chat; the owner writes the file (mode 600,
  outside the repo).
- **`catalog-photos.ts` never loads a vendor placeholder graphic as a product photo** (LA-06, D145
  audit; D150). `PLACEHOLDER_SHA256` lists them by the SHA-256 of the file's bytes (the hand-off's
  16-hex file name is that hash's prefix, so the name is checked too, and a renamed copy is still
  caught). Today one file: `cd5df080e7e3ade5`, a grey wheel outline over "Image not available", the same
  bytes under `tires/`, `wheels/` and `accessories/` (367 rows in the 2026-10-04 hand-off). Such a row is
  skipped and listed in `placeholder-skipped.csv`, not a problem; the sheet's order checks still run on
  the rows as given, then the product's remaining photos close up to 0..n-1. A product left with none
  gets no `product_images` row, so the storefront draws its no-photo tile. Add a hash only after looking
  at the picture. The loader never deletes, so rows an earlier run already linked are removed by hand.
- **Production was cleaned by hand on 2026-10-04 (LA-06, D150), so never re-run `--link` on the raw
  2026-10-04 hand-off.** One transaction on production deleted the 367 placeholder rows and 15 rows where
  a product had been given another brand's generic logo or cap photo, set 6 accessory brands from the
  vendor's own photo and code prefix (`ACCESSORY_BRAND_FIXES` in `catalog-csv-build.ts`, rule `LA06`,
  so a rebuild agrees), and added 6 photo rows from files already in the bucket (Rydanz Revimax R23 ×2,
  Haida HD667, RTX Valhalla 22x9, and GT Invasion Matte Black ×2 showing the Satin Black photo, a
  different finish, by owner choice). `--link` skips products that have a photo, so a re-run would put
  the 15 wrong photos back on the products now without one. Plan and evidence: the fix session's
  `la06-fix-plan.md` (not committed). Still open: Dovroad YS716 and Habilead H206 (the owner approved
  Wheel Works' photos; they need uploading with the R2 settings), and 359 products with no vendor photo
  (337 DAI accessories: ask DAI).
- **`catalog-import.ts` is a TypeScript script** (D114). It must run the app's own validator
  and store, so `tsx` runs it and `npm run check` type-checks it. It is `.ts`, not `.mts`: the repo has
  no `"type": "module"`, and an ES-module script cannot see what `src/db/schema.ts` re-exports.
- **The import never reads `DATABASE_URL`.** It takes `IMPORT_DATABASE_URL` only, so a load reaches a
  database somebody named on purpose, and it should be the direct Neon address, not the pooled one.
- **Import reports go to `import-report/`, which is git-ignored.** They hold vendor data row by row.
- **`catalog-csv-build.ts` decides nothing the owner did not rule** (D125). Since **D126** a tire's season
  follows its maker where the vendors disagree: `SEASON_BY_MAKER` holds each ruled model with the page it
  was read from, and a model joins it only by the owner's ruling. `ACCESSORY_BRANDS` folds an accessory brand
  the owner ruled a respelling into the existing brand (`DAICAPS` → `DAI Wheels`). The rulings of 2026-10-03
  are its spec, under the owner's principle that the data is aligned *as the vendor has it*. A case they
  do not settle is sent to `issues.csv` as `needs owner ruling: …`, never resolved in code. A blank is
  "not known": no `0`, `N/A` or `-` is ever written, except `offset_mm`, where 0 is a real offset.
- **It is the second TypeScript script, for the same reason as the import:** it runs the importer's own
  `planImport()` and `IMPORT_MAPPING`, so the CSV it writes is one the import accepts by construction.
  Its outputs hold vendor prices and go outside the repo (`--out`), never into it.
- **Plain Node, not application source** (all scripts but `catalog-import.ts`, `catalog-csv-build.ts`, `catalog-photos.ts` and `fitment-coverage.ts`). `.mjs` and `.js` are outside tsc's scope — `tsconfig.json:25-32`
  includes `**/*.ts`, `**/*.tsx` and `**/*.mts` only, so `npm run typecheck` never sees these files.
  `eslint .` (`package.json:10`) *does* lint them: `scripts/` is not in the ignore list
  (`eslint.config.mjs:9-19`).
- Run from the repo root. `SRC`/`OUT` are relative paths (`prepare-assets.mjs:25-26`).
- **Sources in `design/` are never modified** — they stay the frozen design export
  (`prepare-assets.mjs:15`).
- **The pipeline refuses to upscale.** `Math.min(scale, 1)` caps it and a warning is pushed to the
  report instead (`prepare-assets.mjs:69-79`). **D19.** Vendor catalogue images are the one exception and are
  not processed here (**D90b**).
- Probe usage pattern, because the two sides differ: the artboard exports carry **no data attributes**,
  so pass real CSS selectors or `nth-of-type` paths for the `:4000` baseline and `[data-probe="…"]`
  hooks for the app (`parity-probe.js:8-17`). Same viewport on both sides, then diff the two JSON blobs
  into `design/reports/<page>.md`.
- *"Never eyeball a match — every row in the report comes from this."* (`parity-probe.js:17`)

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | No folder-scoped rows. | **D19** defines the canvas and the no-upscale refusal. | root `llm.md` §5 |

## Connects to
- Depends on: `https://vpic.nhtsa.dot.gov/api/` (`vehicles-fetch.mjs` only, at run time),
  `design/assets/{products,photos,logo}/*.png` (inputs), `sharp` (`package.json:27`),
  `npm run design` serving `design/assets` on :4000 for the probe baseline (`package.json:12`).
  `catalog-csv-build.ts`: the vendor workbooks named on its command line, `exceljs`, and
  `src/features/catalog/{import-mapping,import-plan,product-input,size}.ts`.
- Depended on by: `scripts/data/vehicles.csv` (output of `vehicles-fetch.mjs`),
  `scripts/data/vehicle-fitment.csv` and `src/features/finder/{vehicle-list,vehicle-fitment-data}.ts`
  (output of `vehicle-fitment.mjs`), `public/images/` (the output), `design/reports/*.md` (every row is probe output),
  `design/reports/README.md` §"Running a measurement", `docs/decisions.md` §9.

- **`vehicles-fetch.mjs` is the only thing that talks to vPIC.** The app reads the committed snapshot,
  never the API, so a page or a build does not depend on NHTSA being up (the file's header).
- **Fetch models by make ID, never by make name.** vPIC's by-name endpoint substring-matches: `ford`
  returns trailer builders (`vehicles-fetch.mjs` header).
- **After `vehicles:fetch` rewrites `vehicles.csv`, run `node scripts/vehicle-fitment.mjs`** so the
  finder's generated list matches, and with `--ankusi` so fitment rows follow renamed models.

## Don't
- Don't move migrations out of the build without a replacement: the Neon URLs are Vercel **Sensitive**,
  so the build is the only place they can be read (`docs/payments.md` §7).
- Don't rewrite the `.mjs` scripts in TypeScript "for consistency". They are executed by `node`
  directly and are deliberately outside the compile graph (`tsconfig.json:25-32`).
- Don't add cleanup, de-duplication or an update path to `catalog-import.ts`. It reports bad rows and
  only ever creates (D113). Don't add an "empty the catalogue" flag to it either: that was ruled a
  separate effort.
- Don't point `catalog-import.ts --write` at any database without the owner's say-so.
- Don't make `catalog-csv-build.ts` guess. Truncating an over-long value, rounding a real decimal,
  filling a blank brand, or merging two SKUs of one vendor would each put a value on the site no vendor
  gave (D125). Report it instead, and let the owner rule.
- Don't hard-code the workbook folders in `catalog-csv-build.ts`: they are personal paths and come in
  as `--share`, `--final` and `--out`.
- Don't remove or relax the upscale guard to make two blurry cut-outs fill the canvas. The warning *is*
  the client blocker (`HANDOFF.md` §7).
- Don't paste `probe()` output verbatim into a report — the report holds the diffed table and its
  tolerances (`design/reports/README.md:27-40`).
- Don't measure against a dev server you have not restarted after a `globals.css` change; a stale
  server fakes a pass (`design/reports/README.md:63-78`, `HANDOFF.md` §8).
- Don't `cd` inside a shell call before running these — it changes the session's working directory for
  every later call (`HANDOFF.md` §8.12).

## Open
1. `prepare-assets.mjs` takes no arguments: every run rewrites every output file, with no dry-run and
   no incremental mode. Nobody has asked for one — **owner** decides if it is worth it.
2. `parity-probe.js` is wired to nothing — no npm script imports or serves it; it is pasted into the
   browser by hand. Whether it should become a script (or a Playwright step) is **owner's call**, and
   `docs/decisions.md:147` currently puts automated visual regression out of scope.
3. **A 1px rounding slip in `products()` and `clientProducts()`.** Both pad the canvas by the *requested* resize
   size, but `fit: "inside"` can return 1px less, so a cut-out can land on a 999×1000 canvas. Found and measured on
   the vendor images (~4% affected) in `~/platinum-wheels-feasibility/tools/web_image.mjs`, which now pads by the
   size the resize actually produced (D90b). Not checked against the current `public/images/products/` output and
   not fixed here — **owner** decides whether to port the fix.
4. **`data/vehicles.csv` is read through a generated module, not a table** (D149, LA-05): the
   finder renders it from `src/features/finder/vehicle-list.ts`. No database table or loader exists, and
   at this size none is needed unless the owner wants one. Owner.
5. **No npm script for `vehicle-fitment.mjs`.** `package.json` was outside the LA-05 change; add
   `"vehicles:fitment": "node scripts/vehicle-fitment.mjs"` beside `vehicles:fetch` if wanted. Owner.
