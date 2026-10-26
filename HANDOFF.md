# Platinum Wheels — session handoff

**Last updated 2026-10-24 (vendor details in a staff-only sourcing email; part number hidden, D193, branch
`claude/plan-un5o7b`, PR #69).** Each quote request now also sends staff a sourcing email: per product the shop
SKU, then each vendor's name, SKU and link (product page, else the vendor's website). Its Reply-To is the shop,
because the alert's is the customer and a reply would quote vendor data to them. The part number (it is the
vendor's SKU) left the product page, the cards and `/search` (migration `0009` rebuilds the search index).
Follow-ups V1 to V3 in `todo.md`. Detail: root `llm.md` D193.
- **Checked:** `tsc`, `eslint`, `db:check`; the sourcing email rendered from sample data; the fixture gate with
  `vendor-codes.spec.ts`.
- **Not checked:** a real Resend send; `0009` on Neon; production's vendor-URL coverage.

**Last updated 2026-10-22 (shop SKU on every product, D192, branch `claude/plan-un5o7b`).** The client
noticed products had no SKU. Every product now has the shop's own code, `PW-` + `T`/`W`/`A` + six random
digits (`PW-T482913`), written by the database (migration `0008`: backfill, insert trigger, never changed).
It shows on cards, the product page, the cart, the sent-request record and both quote emails, and the admin
search and `/search` find it. Detail: root `llm.md` D192, `DEVIATIONS.md` #146, #147.
- **Checked:** `tsc`, `eslint`, `db:check`; `0008` on a copy of 0007 holding 40,446 products (5.7 s, every
  code unique, `updated_at` untouched); the fixture gate with the new `sku` spec; screenshots at 390 and 1440.
- **Not checked:** `0008` on Neon (runs in the next Vercel build; writes to `products` wait a few seconds).

**Last updated 2026-10-07 (pinned header, results vehicle sheet, iPhone model list, badges, D159, uncommitted on
`final-check-fixes`).** The header stays on screen everywhere; below 1100 the results pages pin the category tabs
and a vehicle button beside `Filters`; from 1100 the vehicle button tops the sticky filter rail; both open one
vehicle sheet. The iPhone Model list shows only the chosen make's models. The brand ticker moves with Reduce
Motion on. Winter badges are aqua with a snowflake, All-Season lime. Phone product page spacing tightened; the
About lede lines up with the prose. Then D160: PDP quantity taps change in the browser (no reload, no
loader); Preferred contact removed from the quote form; the cart's `Request a quote` is pinned on phones.
Detail: root `llm.md` D159, D160, `DEVIATIONS.md` #121 to #128. PR #52.
- **Checked:** `tsc`, `eslint`, `npm run test:e2e:fixture` 131 passed, 0 failed, 2 skipped, then 32 with indexing on, and in the browser on the
  fixture build at 375, 390, 1100 and 1280.
- **Not checked:** a real iPhone (model list, Reduce Motion ticker), Safari and Firefox, Vercel.

**Last updated 2026-10-06 (the three final-check fixes, D157, PR branch `final-check-fixes-pr`).** From
`design/reports/final-check-2026-10-06.md`: (1) an unknown or hidden product URL now gets the full branded 404
with JavaScript off, answered by `src/proxy.ts` after one database read; (2) results pages read the catalogue in
2 rounds of 5 to 8 queries (was 3 to 5 rounds of 9 to 14), with the whole-category lists cached under
`CATALOGUE_TAG`; (3) `/` and `/tires` do less at load on a phone (Model list built on first touch, filter sheet
panel on first open, featured cards server-rendered): `/tires` TBT 441 to 262 ms, `/` 452 to 388 ms (target 300
not met on `/`). Numbers and reasons: root `llm.md` D157.
- **Checked:** `npm run check`; `next build` (no warnings); `npm run test:e2e:fixture` 131 passed, 0 failed,
  2 skipped, then 32 with indexing on; on a local production build against a throwaway Postgres holding the full
  catalogue (39,950 products): the 404 by curl, the finder submit with JS on, off and by keyboard, a box and style
  dump at 390 and 1440 (no rest-state change), the parity probe.
- **Not checked:** anything on Vercel or Neon. **After the merge deploys, do the two timings in
  `design/reports/final-check-fixes-parked.md`** (product page TTFB with the proxy read; filtered results TTFB).
- **Concurrent work:** another session left uncommitted D158 work (category tabs that keep the vehicle) in the
  main checkout on the local `final-check-fixes` branch. This PR does not contain it.
- **Owed:** `glcorp` merges with **Create a merge commit**.

**Last updated 2026-10-06 (the vehicle finder's fit data from Auto Country, D155, branch `fitment-auto-country`).**
The finder now knows bolt pattern, bore, thread, nut or bolt, factory tire and wheel sizes and the stock range for
about 99% of 8,882 model-years, from Auto Country's public lookup first, then vendor lookups, makers and the web.
The finder list is the union of Auto Country's and NHTSA's (1,061 models), under Auto Country's names; old
names redirect. Tires, wheels and accessories split Best and Similar by spec; a two-pattern year shows both.
- **Re-run:** `node scripts/autocountry-crawl.mjs` (resumes from saved answers outside the repo; 8 a second,
  never in parallel), then `node scripts/vehicle-fitment-autocountry.mjs`,
  `node scripts/vehicle-fitment-merge-gaps.mjs <gap-fill folder>` (only with new gap fills) and
  `node scripts/vehicle-fitment.mjs`; check with `npx tsx scripts/fitment-coverage.ts <catalogue.csv>`.
- **Checked:** the offline counter equals the page's SQL (about 920 comparisons; 21 cars on all three pages
  of a production build against a local Postgres holding the built catalogue); 390 and 1440 in the browser
  (no overflow, no console errors, Add to cart hit-tests); `npm run check`; `npm run test:e2e:fixture`
  (128 passed, 2 skipped; 32 with indexing on).
- **Not checked:** Neon or Vercel; Safari and Firefox; each Auto Country value beyond the overrides list and
  the vendor spot check (`design/reports/fitment-coverage.md`).
- **Owner rulings applied (D156):** familiar model names (`Mazda3`, `Model 3`), 2015 Tacoma 5x114.3, 25
  no-North-American-car years dropped (8,857 model-years), TPMS sensors to Similar on a TPMS-off car (blank
  before 2008 reads off), spacers and lift sizes not for launch.
- **Owed:** `glcorp` merges with **Create a merge commit**.

**Last updated 2026-10-04 (the two open PRs combined into one branch for a single `glcorp` merge, D143,
branch `integrate/prs-39-42`).** The branch brings **#39** the catalogue photo loader (D139b) and **#42** part
number and M+S as columns, tire part numbers dropped (D142). The two touch no common code; the only
conflict was this file. Both blocks below stand as written.
- **After the merge:** the deploy runs migration `0005` (D142). The photo loader changes nothing until
  the owner runs it (`todo.md` item 11 first); it matches products by slug and vendor SKU, which `0005`
  leaves alone.
- **Owed next:** `glcorp` merges with **Create a merge commit**; `todo.md` item 13; then item 11 and the
  photo load.

**Last updated 2026-10-04 (part number and M+S get their own columns, D142, branch `part-number-mud-snow`).**
Migration `0005` moves a wheel's or accessory's `Part number` out of extra specs into
`products.part_number`, turns a tire's `Mud & snow: yes` into `tire_specs.mud_snow`, and drops the 958 tire
part numbers (size codes and store codes, owner ruling). The admin form gains a `Part number` field
(wheels, accessories) and an `M+S` box (tires); the builder writes the two columns.
- **After the merge:** the deploy runs `0005`, which rewrites `extra_specs` on about 3,300 products in one
  migration. For the minute between migrate and deploy, the old code finds neither fact; the site is not
  live. The storefront looks the same: the M+S badge and the `Part number` row read the columns.
- **Checked:** `npm run check`, `db:check`, `next build`; on PGlite, today's `catalogue.csv` loaded with the
  old code and then migrated, product by product (root `llm.md` D142); the builder and importer on the
  real vendor workbooks.
- **Not checked:** on Neon or Vercel; the admin form in a browser.
- **Owed next:** `glcorp` merges with **Create a merge commit**; `todo.md` item 13.

**Last updated 2026-10-04 (the catalogue photo loader, D139b, branch `catalog-photos`).** `npm run catalog:photos`
loads the co-founder's photo hand-off (`~/Downloads/photos-for-cloudflare/`: 5,587 files, 40,246 photo rows on
39,961 products) into the R2 bucket, one shared copy per file under `catalog/` plus its 480 card size, then links
the rows after matching each by slug and vendor + vendor SKU.
- **Checked:** `tsc`, `eslint`; dry run on the hand-off (0 problems); the card size on one photo per category
  (480×480 WebP, about a third of the bytes).
- **Not checked:** anything against R2 or production; it needs `todo.md` item 11 (keys, custom domain) first.
- **Owed:** owner finishes item 11 and writes the settings file; then dry run with the bucket and database,
  `--upload`, `--link` on the owner's go; redeploy; delete the Blob store; Neon password (item 9).

**Last updated 2026-10-03 (three open PRs combined into one branch for a single `glcorp` merge, D138,
branch `integrate/prs-27-28-29`).** The branch brings **#28** `Add to cart` adds one and the header cart is
not a link on `/cart` (D127), **#29** the admin's new list filters, Go to page, per-category brands, `Full
name` preview and migration `0004` (D127b), and **#27** product photos on Cloudflare R2 in two stored sizes,
with Vercel Blob removed (D126b).
- **After the merge:** a card's `Add to cart` adds one, a product page opens on `1`; the admin list has
  Vendor, Accessory type, Rim size and No photo filters; the deploy runs migration `0004` (one index on
  `products`). Photo upload answers "not set up" until `todo.md` item 11 is finished and production is
  redeployed; no product has a photo yet.
- **Where the PRs met `main`, the owner ruled** that #27 goes in before its R2 setup is finished and that
  #27's decision is `D126b` (main's tire-season `D126` keeps its number); #29's `D127` is `D127b` by
  publication order (*derived*). Root `llm.md` D138.
- **Checked on the combined tree:** `npm ci`, `npm run check`, `db:check`, `drizzle-kit generate` (no schema
  changes), `next build`; migrations `0000`–`0004` on PGlite twice (second a no-op); on a local production
  build against a PGlite fixture: card adds one per press, a product page opens on `1` and honours `?qty=4`,
  `?qty=7` falls back to `1`, `/cart` header is a non-link, cards draw the 480px photo and the product page
  the 1000px one; the admin list's filters each return the right products (a two-source wheel once, the
  flotation tire under rim 20), a page past the end keeps its filters, a tire's brand list holds tire
  brands only; host rules as D115 states.
- **Not checked:** admin Server Actions in the browser pane (it posts `Origin: null` to a local admin host,
  which Next refuses; checked on PGlite by #29 instead); anything against R2 or on Vercel or Neon; the e2e
  suite (parked since D111).
- **Owed next, in order:** `glcorp` merges with **Create a merge commit**; finish `todo.md` item 11 and
  redeploy; `todo.md` item 12 (the admin check on production); the co-founder's bulk photo load; delete
  the empty Blob store; reset the `neondb_owner` password (`todo.md` item 9).

**Last updated 2026-10-03 (catalogue data QA and its fixes, D135–D137, branch `catalog-data-qa-fixes`).**
A read-only audit of the live site against `catalogue.csv` found every count, filter and spec value correct,
and found duplicates, untrue 3PMSF/M+S claims, indistinguishable wheels and vendor wording. The owner ruled
each finding; this branch carries the fixes.
- **Data (D135):** the builder's new merge model and M1–M9 rules give **39,961 products** (8,397 tires,
  29,838 wheels, 1,726 accessories), 0 refused; every edit is a row in `changes-review.csv`. The build was
  approved by the owner, copied into `combined/share/output/` (previous files kept as `*.pre-d135.*`), and
  **loaded into production 2026-10-03**: 39,961 products, 45,426 sources, payments unchanged (15 / 24 / 80);
  live `/tires` 8,397, `/wheels` 29,838, `/accessories` 1,726 on the old code.
- **Display (D136) and filters (D137):** 3PMSF only when true, M+S from the vendor, offset + finish on the
  wheel line, brand never twice, descriptions, growing spec rows, five new filters (70% fill rule),
  flotation sizes, Other sizes by bolt pattern. `DEVIATIONS.md` #108–#112.
- **Checked:** `npm run check`; `next build`; on a local production build against PGlite loaded with the
  rebuilt CSV, totals, the five filters, flotation, wheel lines, PDP rows, featured slugs (all 200), no
  vendor wording in descriptions. **Not checked in a browser** (the pane could not be pointed at the build).
- **Owed next:** `glcorp` merges PR #33 (deploys the display and filter code and refreshes the cached home
  row); reset the `neondb_owner` password (`todo.md` item 9: the string was used, and printed once in a
  session transcript).

**Last updated 2026-10-03 (the admin caught up with the loaded catalogue, D127b, branch `admin-audit-fixes`).**
An audit of the admin product screens against the D125 schema and the 42,165 loaded products found the form
covers every column and every loaded row saves as it is; it fixed what did not fit. The name field is `Full name`
with a live "On the site this reads" line (the storefront's title is brand + model); the brand dropdown lists the
product's own category's brands; the list gains Vendor, Accessory type, Rim size and No photo filters (honoured
by "Change all matching") and Go to page; migration `0004` indexes the list's order; bulk changes count in SQL.
- **Checked on PGlite:** migrations `0000`–`0004`, each filter and combination, the bulk count, the category brand
  checks, the index serving `ORDER BY updated_at DESC, id`; `tsc`, `eslint`, `next build`.
- **Not checked:** anything on Vercel or Neon, or in a browser. `todo.md` item 12 is the owner's check.
- **Independent of PR #27** (photos to R2, D126b); both touch `product-types.ts` and the library files, so
  whichever merges second takes a small rebase. Deferred by the owner: adding a new brand or vendor after the load.

**Last updated 2026-10-03 (product photos move to Cloudflare R2, D126b, branch `photos-r2`).** Vercel Hobby's
Blob allows 2,000 uploads a month and locks the store for 30 days once over, and its image resizer allows
5,000 a month; the 5,844-photo load would have broken both. Photos now live in an R2 bucket served from
`PHOTOS_BASE_URL`, each stored as a 480px `card` and a 1000px `full` WebP, drawn `unoptimized` everywhere
through `photoSource()`. The admin upload keeps its rules (8 × 10 MB, JPEG/PNG/WebP, contain, remove deletes
the files): the browser `PUT`s to a signed link, the server makes the sizes. `@vercel/blob` is gone.
- **Checked:** `tsc`, `eslint` and `next build` clean.
- **Not checked:** anything against R2 (the bucket does not exist yet) or on Vercel; no local run (owner
  tests on production).
- **Owed before merge:** `todo.md` item 11 (R2 bucket, domain, CORS, lifecycle rule, key, five Vercel
  settings). Merged without them, the admin says "Photo uploads are not set up" and nothing else changes.
- **Owed after:** the bulk load, built by the co-founder's session from the photo prompt against
  `photo-files.ts`, `photo-sizes.ts` and `photo-store.ts`; delete the empty Blob store in Vercel (its
  `BLOB_*` settings go with it).

**Last updated 2026-10-03 (the D125 catalogue loaded into production, branch `catalog-load-2026-10-03`).**
PR #24 merged and deployed (`e970674`, migration `0003` applied). `npm run catalog:import` loaded the 2026-10-03
`catalogue.csv` from `~/Platinum Wheels Vendor Data/combined/share/output/` into production Neon over the direct
host: **42,165 products** (9,589 tires, 30,773 wheels, 1,803 accessories), all `published`, 45,426 vendor sources
each with a vendor price, no display price, no photos, 0 refused, 34 s. The 15 `issues.csv` rows stay out.
- **Checked:** read-only counts before (catalogue 0, payments 15 / 24 / 80) and after (catalogue matches the file,
  payments unchanged); on `platinum-wheels-one.vercel.app`, `/tires`, `/wheels`, `/accessories` read 9,589 /
  30,773 / 1,803 matches and three product pages answer 200; no vendor name, and none of those products'
  vendor prices, in any page source fetched.
- **This branch:** `FEATURED_SLUGS` is six winter tires from six brands in 205/55R16 (owner's pick); the
  library now describes the real load. The home row stays empty until this merges and deploys (D111).
- **Owed next:** reset the `neondb_owner` password (`todo.md` item 9; the string was used again for this
  load); photos (to R2 since D126b).
- **Then the review (D126):** `needs-review.csv` is ruled and now empty. A tire's season follows its maker where
  vendors disagree (`SEASON_BY_MAKER` in the builder); production updated in place, **95 tires all-season →
  all-weather**, then a second round on 85 more mixed-season models: **1,069 more tires**, three rules recorded in
  D126. Live `/tires`: all-season 4,393, winter 3,006, summer 1,242, all-weather 947. Ruffino Hard stays its
  own brand. A third round ruled the last open models (117 more tires) and folded `DAICAPS` into `DAI Wheels`;
  live `/tires`: all-season 4,508, winter 2,981, summer 1,234, all-weather 865. The 15 `issues.csv` rows are dropped.
- **50 accessories were set `discontinued` at 07:39 UTC on 2026-10-03** (all Direct Auto Import, mostly centre caps;
  one admin page of 50, so almost certainly a bulk Discontinue; Vercel's logs had expired). The vendor data and
  site mark none of them discontinued, so the owner had them **published again** the same day (D125: every
  product loads published). All 1,803 accessories are live. If staff discontinue products on purpose, record why.

**Last updated 2026-10-03 (the merged vendor CSV aligned with the database, D125, on branch
`catalog-csv-alignment`).** `npm run catalog:build-csv -- --share <combined/share> --final <combined/final>
--out <dir>` turns the co-founder's merged workbooks into one `catalogue.csv` the importer takes whole:
42,165 products from 50,355 rows, each vendor a source with its own price (admin only), sparse vendor facts
in `extra_specs`, the vendors' 15 accessory types. Outputs are in `~/Platinum Wheels Vendor Data/combined/share/output/`.
- **Production's catalogue was emptied on 2026-10-03** (catalogue tables only; payment tables counted
  unchanged), so migration `0003`'s guard passes. **Next:** `glcorp` merges this PR, the deploy migrates,
  then the owner loads `npm run catalog:import -- catalogue.csv` (dry run, then `--write`) against the
  direct Neon address (D113). Until then every listing reads `0 matches`.
- **Checked on PGlite:** all four migrations, the `0003` guard both ways, builder run twice byte-identical,
  importer dry run (0 refused) and full load, `next build`, storefront pages (no vendor price or vendor name
  in any page source, no sideways scroll at 375 on the longest spec), admin edit page (sources with prices,
  lowest price, new fields). `tsc` and `eslint` clean.
- **Not checked:** anything on Vercel or Neon; photo upload (still a separate job); screenshots (pane hidden).
- **Left for a look:** `needs-review.csv` (787 rows: brand splits checked against the market, 16 Vertex
  tires whose "All Season" may be all-weather); `src/features/catalog/llm.md` is 283 lines, over the ~120
  budget.

**Last updated 2026-10-20 (payments move from Converge to Stripe, D191, branch `stripe-payments`).** The client
dropped Converge (the Elavon demo expired 2026-10-18). The branch replaces the gateway with **Stripe hosted
Checkout**: `src/features/payments/stripe.ts`, `POST /pay/webhook`, an open session reused on a second press,
Check payment on the admin list, a refund/dispute email and flag (notify only), key guards and a
`PAYMENTS_ENABLED` kill switch (`docs/payments.md`). It deletes `converge.ts`, `/pay/return`, `/pay/notify`,
`/pay/done`, Fixie and `undici`. Migration `0007_stripe_checkout`. **D108 is reversed** (no cron, but the page,
the admin list and staff look a pending payment up).
- **Checked:** `npm run check`; the fixture e2e (`pay-states`, `pay-stripe`, `seo`) against a Stripe stand-in
  (`tests/fixture/stripe-fake.mjs`): JS-off Pay, a reused session, a signed webhook, a refund flag, a return with
  no webhook, cancel closing the page.
- **Not checked:** anything against Stripe's real API (`docs/payments.md` §9), Back from Stripe on a phone, the
  `pay.` host rules and the production webhook gate. **No sandbox key has been used.**
- **Owed next, in order:** `todo.md` S1 (start Stripe activation now), S2 (sandbox key into Vercel by the owner and
  the §9 checks), merge by `glcorp`, S3 (event destination and the curl gate), S4 (remove the Converge/Fixie
  vars), then the go-live gates (`todo.md` P7). The pre-cutover production row audit is not yet recorded here.
- **Decision ID:** D191 (`image-clarity` holds D190).

**Last updated 2026-10-03 (the Converge SYSTEM error found and fixed, D125b, branch `payments-handoff-form`).**
Every payment through our site failed on Converge's hosted page with `errorType SYSTEM` while a portal Buy
Button approved. The cause was ours: the Pay island reused the Server Action form's DOM element for the
hand-off, so the hidden `$ACTION_*` inputs Next.js renders for progressive enhancement were POSTed to
Converge beside `ssl_txn_auth_token`. Converge stored them on the session (visible in the hosted page's
`hpp/initialize` data) and failed at `hpp/process`. With them stripped in the browser, link PW-10013
**approved** (invoice `PW10013N3`, approval 122262, Converge's return POSTed `ssl_result=0`). The fix keys
the two forms so the hand-off is a fresh element and strips every non-token input before `submit()`. The
`CONVERGE_SEND_INVOICE` switch (#23) is gone; the invoice is always sent. Elavon was never contacted.
- **Checked:** `npm run check`; the cause and the fix on production by a patched page (§ above); not yet a
  deploy of this branch.
- **Owed next, in order:** `glcorp` merges this PR, then one $1.00 test on a fresh link should land on the
  link page as **paid** (the invoice now matches); then `todo.md` P10 (delete `CONVERGE_SEND_INVOICE`,
  CAPTCHA back on, narrow the API user's rights, void the three test sales), P8 and P9; then go-live P7.
- **Portal facts learnt:** a Buy Button token never expires and is reusable; ours is single-use, 15 min.
  The hosted page stores the session on `window.initialPaymentPageData`; reading it needs no XHR hook.

**Last updated 2026-10-02 (the five open PRs, #13 to #17, combined into one branch for a single `glcorp`
merge, D124).** The branch brings **#13** SEO behind `SEARCH_INDEXING_ENABLED` and tires at `/tires` (D112),
**#16** Converge's export-script webhook `/pay/notify`, the shop's payment email and the PIN guard
(D119 to D121), **#14** the catalogue import (D113, D114), **#15** the admin, prefix-less on
`admin.platinumwheels.ca`, with product screens, Blob photos and a home page (D115 to D118), and **#17** the
browser cart with prices switched off (D122, D123). The paragraphs below are each PR's own record.
- **What production shows after the merge:** the stand-in catalogue (44,143 products, no prices, no photos)
  on `/tires`, `/wheels` and `/accessories`; `Add to cart` on every card and product page and one quote
  request from `/cart`; no price anywhere; every page `noindex` and `robots.txt` `Disallow: /`. The admin
  is at `https://admin.platinumwheels.ca/` with no `/admin` in any URL; old `/admin/...` URLs are 404. No
  migration runs.
- **The owner ruled one thing at the merge** (D124): with prices off, `src/features/catalog/queries.ts`
  sends no price and orders by none. Fixed as *derived*: #13's SEO spec now checks the admin on its host;
  #16's payment email links the admin's `/payment-links`. No numbering clashed.
- **Checked on the combined tree:** clean `npm ci`, `next typegen`, `npm run check`, `db:check`,
  `drizzle-kit generate` (no schema changes) and `next build`; the three migrations twice on PGlite (the
  second a no-op); host probes with and without production host rules (D105, D115, D119); #13's
  `seo.spec.ts` 32/32 in each flag state; in the browser against a PGlite fixture loaded by #14's importer:
  admin sign-in and sign-out, home tiles, product list, Hide (the product leaves the storefront), a payment
  link (opens on the pay host, 404 elsewhere), cart add and re-add, `/cart`, a quote request; builds with
  prices off (no price in any page source) and on (prices render as before).
- **Not checked:** anything on Vercel (`garvbareja` deploys are blocked); a Blob photo upload (no Blob token
  locally); a real Resend send; a real Converge call or `/pay/notify` with credentials; the rest of the
  parked e2e suite (D111); Safari, Firefox, Lighthouse.
- **Owed next, in order:** after the deploy, sign in on the admin host once (`src/app/admin/llm.md` Open #6)
  and probe the hosts; the export-script credentials (`todo.md` P8); reset the Neon password (item 9); the
  cleaned catalogue load and real `FEATURED_SLUGS`; at launch `todo.md` S1, and C1 only once every price is
  a customer price.

**Last updated 2026-10-01 (the cart, D122 and D123, on branch `quote-cart`, stacked on `seo` / #13).**
A customer now adds products to a **browser-only cart** and sends **one** quote request from `/cart`; the
product page has no quote band. `Add to cart` replaces `Request a quote` on every card and the PDP; the
header carries a cart link with a count after the phone at every width; the D51 form, unchanged but for
its quantity fields, opens in a dialog on `/cart`; one request sends one owner alert and one auto-reply
listing every line (D104). **Every storefront price is off for launch** behind
`NEXT_PUBLIC_STOREFRONT_PRICES_ENABLED` (`todo.md` C1). Rules: `src/features/cart/llm.md`,
`src/lib/llm.md`; deviations #96, #97.
- **Checked:** `npm run check`, `next build`; on a local production build against a PGlite fixture
  (six products, one discontinued): add from a card and the PDP (`Added ✓`, count pop, `View cart`
  prompt), `Custom` quantity with its blank-field error, re-add growing the quantity, the vehicle carried
  from a checked PDP URL, `/cart` at 375, 800 and 1440, stepper and `Remove`, a product hidden in the
  database removed with the note, the dialog's empty submit (three field errors, focus on name), a valid
  send (cart emptied, success panel, `quote.email.disabled` with the line count), and both email bodies
  rendered against a stubbed Resend.
- **Not checked:** a real Resend send; the parked e2e suite (`tests/llm.md` Open, it still asserts the
  quote band); Safari and Firefox; prices switched on (built and typechecked, not looked at).
- **Merge order:** after #13, which this branch is cut from.

**Last updated 2026-09-30 (the catalogue import, and a stand-in catalogue loaded into production, D113 and D114).**
- **Production now lists 44,143 products**: 9,785 tires, 33,901 wheels, 457 accessories, from the
  scraped vendor sheets. All `published`, **no prices** (every card reads `Inquire for price`), **no
  photos** (every card is the placeholder tile), duplicates across vendors not merged. It is a stand-in
  until the co-founder's cleaned CSV arrives.
- **The import is `npm run catalog:import -- <file.csv>`** (`scripts/catalog-import.ts`): a dry run
  unless `--write`, create-only, into an empty catalogue only. The column layout is one file,
  `src/features/catalog/import-mapping.ts`; the suggested file layout is `docs/catalogue-csv.md`.
- **1,583 of the 45,726 scraped rows were refused** and listed for the co-founder: 1,446 with no brand,
  94 sharing a vendor SKU, and the rest a bad size, bolt pattern, backspacing or an over-long name.
- **Checked:** the full load on a throwaway Postgres; the batch writer against `createProduct` row for
  row on 2,345 products; a batch that breaks a unique index leaves nothing behind; a second run is
  refused; the production tables against the rehearsal tables by checksum; and the deployed `/results`,
  `/wheels`, `/accessories` and a product page. **No test file is committed.**
- **Not checked:** the home featured row, which shows a bulk load only after a deploy (D111).
- **Owed next:** reset the Neon password (`todo.md` item 9); a deploy, for the home row; the cleaned
  CSV, then empty the catalogue and load it fresh (emptying is not built); photos (R2, D126b).

**Last updated 2026-09-30 (SEO groundwork, D112, on branch `seo`, off `main` once #12 had merged).**
Search engines stay blocked until launch behind `SEARCH_INDEXING_ENABLED` (on only at exactly `true`; off
in Vercel). Built behind it: `/robots.txt`, a sitemap index with four files, canonical URLs and
Open Graph and Twitter tags on every indexable page, structured data (an online store with no street
address and no opening hours, products with no price) and two link-preview cards. **The tire category
moved from `/results` to `/tires`**: `/results` in any older note below means today's `/tires`. Rules:
`src/features/seo/llm.md`. Owner and client actions: `todo.md` S1 to S6, and **S1's order matters**: turn
the flag on in the deploy that reaches the apex. Verified in both flag states by `tests/e2e/seo.spec.ts`.

**Before that, 2026-09-30 (all four open PRs combined into one branch for a single `glcorp` merge, D111).**
The branch brings **#11** the vehicle list snapshot (D110), **#8** Converge payments (D105–D108), **#9** the
catalogue database with its server code (D105b–D107b, migration `0002`) and **#10** the page wiring
(D108b, D109): every storefront page reads the database and the seed is deleted.
- **The catalogue is empty until the approved CSV is loaded.** After this merge every listing on the
  deployed storefront reads `0 matches`, the price range reads `$0`, the home featured row does not
  render and every product URL is a 404. Owner, 2026-09-30: *"fold everything into one"*, which amends
  D108b's "merged only after the approved catalogue is loaded".
- **Where #10 met D91b–D93b, the owner ruled five times (root `llm.md` D111):** both brand rules on a
  results URL; the e2e suite parked; the no-photo tile morphs too; #10's deviation rows renumbered
  #88–#94; the home row cached by tag with no timer. The catalogue's and the wiring's decision rows
  carry a `b` suffix because `payments` had published D105–D108 first (root `llm.md` §5b, header note).
- **Checked on the combined tree:** `next typegen`, `npm run check`, `npm run db:check`, `drizzle-kit
  generate` (no schema drift) and `npm run build`; `/` is prerendered and sends `s-maxage=31536000` with
  no `stale-while-revalidate`; a home row cached while the catalogue was empty stays empty on a rebuild
  with the same deployment id and appears on one with a new id. Migrations `0000`–`0002` applied through `scripts/db-migrate.mjs` to a
  throwaway Postgres (PGlite), and a second run was a no-op. Against that database, empty: the three
  results routes answer 200 with `0 matches` and no `Infinity`. Against it with a 13-product fixture:
  hostile results URLs (`brand=Nope`, `brand=zeta`, `width=abc`, `width=999`, `min=0&max=999999`), a
  carried brand the size empties keeping its ticked row at 0 with `Filters (2)`, a product page in each
  state (published and discontinued 200, hidden and unknown 404 with `noindex`), and the tile morph
  pairing on `product-open` and `product-back`. Payments, before #10 was folded in: sign in, generate a
  link, `/pay/<token>`, Pay with no gateway configured, cancel, the closed page, and the D97 and D105
  host rules with `VERCEL_ENV=production`.
- **Not checked:** the e2e suite (§5) is parked and cannot run (`tests/llm.md`). How the tile morph
  looks frame by frame. The product admin's Server Actions from a browser: its screens do not exist, so
  the tag expiry that refreshes the home row is unexercised. No real Converge call (`todo.md` P2).
- **Owed next, in order:** load the approved catalogue; replace the placeholder `FEATURED_SLUGS`
  (`src/features/home/featured.ts`) and redeploy, which is also what makes a bulk load show on `/`; the
  suite's fixture database (`tests/llm.md` Open).

**Last updated 2026-09-30 (the D93b senior pass and D94b home photos, then `origin/main` merged: admin, payments database and quote email, D89–D104).** The D91b QA pass (a committed Playwright + axe suite, §5) precedes it. Earlier summaries follow.

**Production runs `main` at `2df8092` (2026-09-24).** PR #5 combined four PRs into one merge:
**#1** hardened the admin sign-in (D95), **#2** wired `admin.platinumwheels.ca` and host routing (D96–D98),
**#3** brought `todo.md` and the unparked quote-delivery rulings (docs only; the Resend code is not
built), and **#4** brought the payments database (D99–D103). It was the first Vercel build since the
project was imported. The build ran both migrations against production Neon and went live on
`admin.platinumwheels.ca` and `platinum-wheels-one.vercel.app`, with no runtime errors. It was verified
from outside:
- The pre-D95 cookie `pw_admin_session=1`, which opened `/admin` until this deploy, now bounces to
  sign-in, and so does a forged signed token.
- The owner signed in with the real credentials.
- The D97 host rules behave as specified (§5).

**The admin section itself (D89–D94) reached `main` on 2026-09-23 before it had ever been built**, on
the owner's instruction: *"the project is still in dev with no real user so we can merge our branch into
main without testing"*. It has since been built, deployed and verified. It was drafted as D58–D63, and
those numbers were never published for the admin (D98).

**Production deploys only when `glcorp` authors the merge commit on `main`** (§7). Commits authored by
`garvbareja` are still blocked, and so are PR previews.

**Last updated 2026-09-24 (session 9: #1–#4 merged via #5 and deployed; docs synced).**

**Session 6 (2026-09-21).** All three designed routes are built and audited; the catalogue
now has **three categories, not one** (`/wheels` and `/accessories` are full results pages sharing the
`/results` composition — **D58**, **D59**); the safe half of the audit fix list is applied (**D61**); and
**the last two undrawn states, `loading` and route `error`, are authored (**D62**)**, which completes
`/styleguide` §11. Scope is still **UI only** (D54).

Then the owner's "do whatever you can" pass (**D63**): **S2 is applied** (13 class-merge helpers →
`src/lib/cx.ts`, every emitted class string proven unchanged), **real accessory photography is wired in**
and the accessory types re-cut to match it, the **category tiles** use their own photos at last, and
`/about`, `/privacy` and `/terms` carry real content. Scope is still **UI only** (D54). Start at §6.

**How to use this file.** It is the single current record of how to work in this repo. **Cite it by
section (`HANDOFF.md §7`), never by line number** — sections are stable, line numbers are not (D55).

**Work a session cannot do from the repo** — DNS, dashboards, accounts, API keys — lives in root
**`todo.md`**, with who does it, why, and how to check it is done. Read it at the start of every session;
delete an item there once it is verified done. It also holds the live DNS/mail snapshot (DNS is on
**Cloudflare**, not GoDaddy).

It is **not a log** (root `llm.md` §1.7). It records what is true now; finished work is deleted from
§6 rather than struck through. The decision register lives in root `llm.md` §5b (**D23 onward**); §11 below
holds the frozen canonical text of **D1–D22** and is **never edited**, and §10 and §12 are likewise
archive — edit §1–§9 freely and leave §10–§12 alone.

**Git (D55, superseding D3).** Branch `main`, tracking `origin/main` at
`github.com/glcorp/platinum-wheels` (private). Three commits: `60fa3e8` initial (251 files, made by the
owner mid-session-5), `0a4a3aa` the audit + D57 fixes, and the session-5 handoff commit on top of it.
`origin/main` is at `0a4a3aa`, so **the handoff commit is the only one unpushed** — a commit cannot cite
its own hash, so it is named here by description. This repo is main-only with no PR workflow; commits go
straight to `main`, and the owner pushes.
Everything before `60fa3e8` has no history, so for the three built pages `design/reports/` and
`design/DEVIATIONS.md` remain the only record of how they got there.

---

## §1. Start

```bash
cd /Users/raghavvirmani/platinum-wheels
npm run check          # tsc + eslint — must exit 0 before touching anything
npm run dev            # app on :3000 (preview_start name=app; "autoPort" frees a colliding port)
npm run design         # artboard baseline on :4000 (design/serve.json rewrites, D36)
```

Pages worth opening: `/`, `/results?year=2021&make=Honda&model=Civic`,
`/products/zeta-antarctica-sport?year=2021&make=Honda&model=Civic&qty=4`, `/styleguide`.

Baseline artboard URLs are **extensionless** (`npx serve` strips `.html`):
`http://localhost:4000/home-desktop`, `/product-mobile`, `/results-mobile-filters`.

Parity is measured with `scripts/parity-probe.js` against that `:4000` baseline — never by eye, never by
reading source. After any `globals.css` edit: `rm -rf .next`, `npx next typegen`, restart `next dev`.
Lighthouse runs on the production build; recipe in `design/reports/README.md` (Chrome is at
`/Applications`, not on `PATH`).

**Open your own browser tab** (`tabs_create`) before driving the pane. A second Claude session can be
sharing it and will navigate your tab out from under you mid-measurement — this happened repeatedly in
session 5 and invalidated several readings before it was spotted (§8.17).

---

## §2. Read in this order

1. **`llm.md` (root)** — §1 library rules, §4 authority chain, §5b register **D23–D57**, §6 folder map,
   §7 open items; §7.17–§7.20 are the live audit questions and §7.21 the D58 follow-ups.
2. The `llm.md` of every folder you will touch. Rule §1.1: read before write. Rule §1.2: update it in the
   same change.
3. **`design/manifest.md`** — artboards → routes → sections. The build queue for `page` and `section`.
4. **`design/reports/audit.md`** — the consolidated audit: the measured gate table, a **checked and
   cleared** list of things that look like defects and are not, the fix list with what is applied vs
   still open, and the pass's coverage limits. Read this before "fixing" anything.
5. **`design/reports/{home,results,product}.md`** — the three parity baselines. `product.md` shows the
   shape to copy, including a *Behaviour verified* section.
6. **`design/DEVIATIONS.md`** — **57 rows**. #1–#24 shared and home, #25–#35 `/results`, #36–#43 the PDP,
   #44–#48 the D57 accessibility fixes, #49–#53 the D58 wheels/accessories scope, #54 the header background (D61), #55–#56 loading and route error (D62), #57 the category tiles (D63). #51 is largely closed by D63. Nearly all of it is deliberate and sourced.
7. `design/inventory/{home,results,product}.md` — the measured baseline, only if re-measuring.

---

## §3. How the owner runs sessions (D23–D25, D48, D54, D56)

- The main session is the **coordinator**: it grounds, plans, writes the contract and the agent briefs,
  **measures everything in the browser**, and merges the docs. Implementation is delegated to sub-agents.
  **The model is the owner's call each session** — Opus for `page results`, Sonnet for `page product` and
  for both session-5 passes. Ask if unstated.
- **Ask, don't assume — but batch.** One `AskUserQuestion` with ≤4 genuine blockers, recommended option
  first. The owner has taken the recommendation nearly every time, and rules data gaps as "use
  placeholder data" (D48). Rulings made without asking are labelled *derived* and are vetoable.
- **Report before you change.** Session 5's ruling: audit first, present the findings, and apply only
  what the owner names item by item. Do not bundle "while I was in there" fixes into an approved one.
- **The pattern that works:** the coordinator writes the register rows, the folder `llm.md` and any
  contract **before** any agent starts; agents then work on **strictly disjoint files**. The coordinator
  is the single writer for `globals.css`, every `page.tsx` and every `llm.md`. When a fix needs a new
  utility, the coordinator writes the utility first and names it in the agent brief.
- **Forbid the browser in agent briefs.** There is one shared pane; concurrent agents driving it collide.
  Agents do static analysis, the coordinator measures.
- **Agent output is a claim, not a fact.** Verify it. Several agent findings across this project were
  wrong, and *coordinator* probes have grabbed the wrong element more than once — in session 5 a probe's
  result keys collided so hidden duplicates masked the visible elements, and a "no commit" finding went
  stale mid-session. Measure the element you named, then re-check before writing it down.
- Sub-agents can die on a session rate limit **after** writing their files. Check the disk before
  relaunching.
- Replies short. This library is the shared memory with the co-founder.

---

## §4. What exists

| Area | State |
|---|---|
| Library | 26 `llm.md` files. Root = register (D1–D57) + template + folder map + 20 open items. |
| `/` | `SiteHeader over-hero`, 8 home sections, `SiteFooter` (D38). Parity `design/reports/home.md`. |
| `/tires` (was `/results` until D112) · `/wheels` · `/accessories` | **One** composition, `results/components/results-page.tsx`, called by three thin `page.tsx` with a `category` (D58). URL-driven search over that category's seed (D44): `ResultsToolbar`, `FilterSortBar`, `md:results-grid` (rail + grid), `CallCtaPanel`. Parity `design/reports/results.md` covers `/results`; the other two are **not parity rows** and inherit it by rendering the same tree (`DEVIATIONS.md` #49). |
| `/products/[slug]` | `productView(product, searchParams)` → one `ProductView`; breadcrumb, `pdp-split` gallery + sticky buy panel with `Add to cart` (D122; the quote band is gone), specs, similar row. Parity `design/reports/product.md`. |
| `src/features/product/` | `types.ts`, `view.ts` (all derivation), `load.ts`, 7 components; one island `add-to-cart-panel.tsx` (D122). The quote form, its action and its two authored states moved to `src/features/cart/` (D122). |
| `/cart` | `src/features/cart/` (D122): browser-only lines (`src/lib/cart.ts`), one quote request through the D51 form in a dialog; islands `cart-view`, `cart-line`, `quote-form`. `noindex`, in no sitemap. |
| `src/features/results/` | `types.ts`, `query.ts`, `search.ts`, 9 components (D58 added `results-page.tsx`); islands `sort-select`, `filter-panel`, `filter-sheet`. D42–D49, D58, D59. **Nothing here branches on the category** — components read `view.facets`, and what differs is data in `catalog/categories.ts`. |
| Finder | `src/features/finder/` — native selects, GET to `ROUTES.tires` by default with `action`/`cta` overrides (D27/D28/D58); `variant="inline"` for `Change vehicle` (D45); **placeholder `FITMENT` map** now carrying a **bolt pattern** as well as a tire size (D48, D58). `/wheels` submits to `/wheels`; `/accessories` renders no finder at all (D59(2)). |
| Catalog | **The seed named in this row was deleted by D108b; every page reads the database (`src/features/catalog/llm.md`). The component notes still hold.** `FEATURED_PRODUCTS` (4), `PRODUCTS` (9 tires), **`WHEELS` (9)** and **`ACCESSORIES` (9)**, one unavailable each, plus `ALL_PRODUCTS` / `productsIn()` (D43, D58). `Product` gained optional `category` (**absent = tires**, which is what keeps every measured tire row byte-identical), `wheel`, `accessoryType`; plus `productCategory()` and `productImageSrc()`. **`categories.ts` is the per-category table** (`CATEGORY_CONFIG`) read by `results/`, `product/` and `ProductCard` — it lives in `catalog/` because D37 routes cross-feature imports through there, and it imports no seed so a client island can use it. `ProductCard` is the most reused component in the build and is unchanged on all three categories. |
| Chrome | `site-header`, `site-nav-drawer`, `site-footer` (no social row, D34), `page-stub`. Skip link in `layout.tsx` (D57). |
| Primitives | **Ten**, hand-built and token-only in `src/components/ui/`. Every variant and state is on `/styleguide`. Neither the PDP, nor D57, nor D58 needed a new primitive — D58 added exactly one optional prop, `Price.unit`, defaulting to the drawn tire string. |
| `globals.css` | **719 ln**: tokens, role utilities, the home/results/product layout utilities, and the three D57 accessibility utilities (`tap-extend-lg`, `hide-scrollbar`, `skip-link`). The dead `--container-rail` token was removed 2026-09-21 (D61, audit S5). **Single writer: the coordinator.** See §9. |
| `/styleguide` | §11 carries the undrawn states, now **complete** (D62): empty results, open `Change vehicle`, quote-form **success** and **error**, the **skip link** (Tab into its demo box to reveal it), the **route error** and the **loading** skeleton. |
| Undrawn states | `error.tsx` at `(storefront)/` (D62) and `src/app/global-error.tsx` (D93b); `loading.tsx` was removed by D91b. Both boundaries render `src/components/site/route-error.tsx` and are the **only two** `"use client"` files under `src/app/` — a framework requirement, named as exceptions in `.claude/rules/ui.md` and `docs/decisions.md` §4. The 404 (`not-found.tsx`) carries the owner's line and a `Shop tires` + call pair (D93b). |
| `design/reports/` | 11 files: `README.md` (protocol), three `<page>.md` parity baselines, `audit.md` + four `*-audit.md`, **`deviations-sweep.md`** (D64) and `llm.md`. |
| `.claude/rules/ui.md` | Taste dials + JSX non-negotiables. **Auto-loads on every `src/**/*.tsx` edit.** Nothing imports it; it loads by glob, and its length is paid on every UI edit. |
| Admin URLs | **Prefix-less on `admin.platinumwheels.ca` since D115**; the pages live in `src/app/admin/` and `/admin/...` is a 404 everywhere. Rows below name the admin-host URL. |
| `/` (admin) | The admin home: rotating Brampton-time greeting, two tiles with live counts (D118). |
| `/payment-links` | Payment-link builder and recent links: `AdminTopBar` + `PaymentLinkForm` + `PaymentLinkList`. Amount + description + expiry, no computation (D92, D103). Moved from the root by D118. |
| `/products`, `/products/new`, `/products/<id>` | Product CRUD (D116) and photo upload to R2 (D117, D126b). |
| `/login` | Flush-left 420px sign-in column, username + password (D91). Redirects home if already signed in. |
| `/styleguide` (admin) | The admin's authored states (D93), gated. Renders the real components inert. |
| `src/features/admin/` | `types.ts` (contract), `session.ts` (one shared sign-in, hardened by D95: scrypt hash, signed `__Host-` cookie, CSRF + origin checks), two `"use server"` actions that call `requireAdminAction()` first, 6 components; islands `login-form`, `payment-link-form`, `copy-link-button`. `scripts/hash-admin-password.mjs` makes `ADMIN_PASSWORD_HASH`. |
| SEO | `src/features/seo/` (D112): indexing flag `SEARCH_INDEXING_ENABLED` (on in Vercel Production since 2026-10-20, set with the apex cutover), `/robots.txt`, `/sitemap.xml` + `/sitemaps/*.xml`, `pageMetadata()` on every indexable page, JSON-LD (`OnlineStore`, `WebSite`, `Product` with no offer, `BreadcrumbList`), `/opengraph-image` and `/products/<slug>/og.jpg`. Verified by `tests/e2e/seo.spec.ts` in both flag states. |
| Stubs left | `/about`, `/privacy`, `/terms`, 404. Undesigned (D26/D39). `/wheels` and `/accessories` left this list on 2026-09-21 (D58). |

---

## §5. Verification state

**The suite is parked since D111 and cannot run until it has a fixture database (`tests/llm.md` Open).**
What follows describes it as it ran on the seed.

**The verification of record is the committed QA suite (D91b), not a hand measurement.** `tests/` is a
Playwright + `@axe-core/playwright` suite against the **production build only** (never `next dev`, D88), on
15 projects: Chromium, Firefox and WebKit at 1280/1440/1920, plus `iphone-se`, `iphone-15-pro`, `pixel-7`,
`ipad-mini`, `ipad-pro-landscape` and `floor-320`. Read `tests/llm.md` before touching it.

```bash
rm -rf .next && npx next build && QA_ERROR_ROUTE=1 npx next start -p 3100   # or let webServer do it
npm run test:e2e -- --workers=5                                             # everything, ~21 min
npx playwright test --project=chromium-1440 tests/e2e/results.spec.ts      # one spec, one project
```

- **What it covers**, one spec per concern: `smoke` (every route, one h1, no overflow, real 404s, every
  loaded image paints), `error-boundary` (`/qa-error` throws only with `QA_ERROR_ROUTE=1`), `finder`,
  `results` (filters, counts, URL state, price range, sort, Load more, rapid changes, history), `home`,
  `product` (quantity, quote form), `nojs`, `responsive` (17-width sweep, long content, landscape),
  `a11y-axe` (WCAG 2.2 AA on every route and state, 2.4.11 focus not obscured), `a11y-interaction`
  (keyboard walk, 1.4.12 text spacing, 1.4.10 reflow, contrast over CSS **and** pixel-sampled over
  photos, forced colours, reduced motion), `visual` (Chromium-1440 baselines at 390 and 1440), `parity`
  (against the `:4000` artboards, with every accepted deviation cited), `perf` (CLS, INP proxy, LCP
  reported only — parked, D54) and `engines`.
- **Last gate run, 2026-09-30:** 2,785 passed, **0 failed, 0 flaky**, 3,290 skipped (project gating and
  nine fixmes, each citing its row). Matrix, every finding and Lighthouse: `design/reports/qa.md`.
- **Lighthouse (production, 2026-09-30):** a11y 100 on `/`, `/results`, a PDP and `/about` at mobile and
  desktop, except `/results` desktop 96 (the known D69 range thumbs); perf 91–100; CLS 0; mobile LCP
  3.2–3.5 s — parked (D54).
- **Rules the suite taught** (each cost a run): hit-test and use real input; wait for the smooth scroll to
  rest before acting on what it moved (`scrollSettled`); an opacity-0 overlay is not content; a baseline
  changes only with a DEVIATIONS or D row. Real Mobile Safari is **not** covered (needs full Xcode).

The blocks below are earlier hand measurements. They are still true where the suite has not superseded them.

**D92b motion pass (2026-09-29), measured in a production build, not claimed** — full samples in
`design/reports/motion.md`:
- Route slides, the card → PDP photo morph (exactly one photo per trip), the travelling nav underline,
  staggered result changes, the scroll reveal, the image fade and the sheet exit were each sampled frame
  by frame. Reduced motion checked in headless Chromium: every view-transition animation reports 0ms,
  nothing is held pending, transitions are 0.01ms.
- **No rest-state drift:** a full-DOM computed-style and box diff against the pre-motion build on nine
  routes at 390 and 1440 found zero geometry change (only the active nav link's border colour, now
  painted by a span, and `position: relative` on the nav links).
- No overflow on 10 routes × 375/768/1280/1440; Lighthouse CLS 0 and a11y 100 on `/`, `/results`, the PDP.
- **`"use client"`: 13 files** (D92b added `scroll-reveal.tsx` and, by addendum, `nav-progress.tsx`; D93b added `src/app/global-error.tsx`), exactly two under `src/app/`.
- **How to measure motion here:** the browser pane skips view transitions and stops frames whenever it is
  hidden (§8.23 again), so live samples ran in headless Playwright Chromium against a production build.
  Build that in a scratch copy (APFS-cloned `node_modules`) when another session is serving `.next`.

Everything below was measured, not asserted. Re-verified after D57 and again after **D58** (2026-09-21).

**D58 verification, measured in the browser, not claimed:**
- **Tires unchanged.** `/results?year=2021&make=Honda&model=Civic` still reads `4 matches · 5 similar`,
  Tires count `9`, `Tire size` W/P/R with `R16/R17/R18`, `Season`, `Price per tire` `$90–$150`, brands
  Zeta 2 / ZMAX 5 / Mazzini 2 — identical to this file's pre-D58 text. The rail's selected `Tires` row
  probes **40×280, `rgb(244,244,245)` on `rgb(11,11,13)`, 15px/500, line-height 15px, padding 12px,
  radius 0** against the `:4000` artboard's identical values, and the `Filters` `<h2>` measures
  **78.9×28** against the baseline's 78.9×28. A tire PDP still renders all six drawn spec rows
  (`Winter (studdable)`, `Load / speed`), `per tire · before tax`, `1 tire`/`4 tires` and both
  artboard-verbatim quote-form strings.
- **Gotcha, cost a reading:** `document.querySelector('[data-probe="filters-title"]')` returns the copy
  inside the **closed `<dialog>`**, which measures 0×0. Scope every results probe (§8.9).
- **New routes.** `/wheels` renders five rail groups (`group-category`, `group-size`, `group-finish`,
  `group-brand`, `group-price`), crumb `Home / Wheels`, `/ wheel`, finder CTA `Find my wheels`, all three
  forms posting to `/wheels`. `/accessories` renders **four** (no size group), crumb
  `Home / Accessories`, `/ each`, **no vehicle chip and no finder**, two forms posting to
  `/accessories`.
- **Search behaves.** `/wheels?finish=bronze` → 2; `?diameter=18` → 3 best + 6 similar;
  `?min=200` → 3 with `Filters (1)`; `finish=bronze&finish=silver&brand=Touren` → `Filters (2)`.
  Subaru Impreza (`5x100`) → `1 match · 8 similar`. Volkswagen Jetta (`5x112`, a pattern no seed wheel
  carries) → `0 matches · 9 similar` with the near-miss line, exactly D49's semantics.
  `/results?rim=R17` still strips to `17` → `3 matches · 6 similar`.
- **The island works on the new routes:** clicking `Bronze` on `/wheels` pushed
  `/wheels?finish=bronze&min=130&max=270`, the count went to `2 matches` and the chip rendered selected.
- **No horizontal overflow** at 375 / 768 / 1280 / 1440 on `/wheels` and `/accessories`.
- `npm run check` clean, `npx next build` clean (`/wheels` and `/accessories` are `ƒ`, like `/results`),
  slop grep zero new hits, still exactly **six** `"use client"` and **one** `"use server"`, none under
  `src/app/`.

- `npm run check` clean; `npx next build` clean; slop grep **zero** — **as of the last storefront build.**
  The admin was first built on branch `admin-auth-hardening` (2026-09-23, D95): `npm run check` and
  `next build` clean there, and a curl harness against `next start` passed 43/43 — forged, expired,
  tampered and legacy cookies rejected; sign-in refused without a same-origin `Origin`; payment link and
  sign-out refused without the session's CSRF token; a password change revokes sessions; plaintext and
  malformed-hash configs behave as documented; no credential ever reaches the log.
- **Admin on production, verified 2026-09-24** (`2df8092`, the first Vercel build since import):
  - **Gate:** no cookie, the legacy `pw_admin_session=1` cookie and a forged `v1` token all 307 to
    `/admin/login`.
  - **Headers:** `/admin/login` carries `X-Frame-Options: DENY`, `frame-ancestors 'none'`,
    `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex, nofollow`. The storefront carries none of
    them.
  - **D97 host rules:**
    - `admin.platinumwheels.ca/` and `/results` → 307 `/admin`.
    - `platinum-wheels-one.vercel.app/admin*` → 404, rendered by the site's not-found page.
    - `/`, `/results`, `/wheels`, `/accessories` and a PDP on the vercel.app host → 200.
    - The apex `platinumwheels.ca` still serves the goodwill site.
  - **Sign-in:** the owner signed in with the real credentials.
  - **Build log:** `db-migrate: migrations up to date.`, and no runtime errors afterwards.
- **Admin layout, measured 2026-09-24** on a local production build of `2df8092`, signed in (the D89
  items that were reasoned from Tailwind's emission order and never seen):
  - **Amount field:** the `$` / `CAD` adornments clear the input text at every width. `$` has
    5.8px of clearance at 390 and 7.3px at 720–1440 (`pl` 28/32px); `CAD` has 18.7px and 24.7px
    (`pr` 56/64px).
  - **Alignment:** the top bar's logo shares its left edge with the page `<h1>` at 390 (16), 720, 810,
    960 and 1099 (32), 1100 (48) and 1440 (96).
  - **Overflow:** there is no horizontal overflow on `/admin`, `/admin/login` and `/admin/styleguide`
    at 375, 390, 768 and 1440.
- **Thirteen** `"use client"` files and **three** `"use server"`, recounted 2026-09-23 with the command
  below. Ten client files are storefront — the "eight" this line used to state predates D80's `hash-scroll`
  and the finder's `finder-model-sync` — and three are admin (`login-form`, `payment-link-form`,
  `copy-link-button`); the two extra server files are admin's `auth-actions` and `payment-link-actions`.
  (D62 added two client files: the boundary component and the `error.tsx` that re-exports it.) **Exactly one is under `src/app/`** —
  `(storefront)/error.tsx`, which Next requires (D62) and which holds no component code. Any *other*
  occurrence under `src/app/` is still the failure the slop grep was written to catch. Count with
  `rg -l '^"use client"' src/ --glob '*.tsx' --glob '*.ts'` — an **unglobbed** `rg -l` also matches the
  `llm.md` files that merely *mention* the directive.
- **Parity: no drift.** Every row on all three pages is exact at 1440 and 390 or linked to a
  `DEVIATIONS.md` row; home `h1` at 1440 re-measured identical to the `:4000` baseline on all seven
  properties after the `globals.css` changes.
- **No horizontal overflow** at 375/768/1280/1440 on `/`, `/results`, `/products/[slug]` *or*
  `/styleguide`.
- **Dialogs:** both the filter sheet and the nav drawer are `:modal`, lock `body` scroll, close on Esc
  and return focus to their trigger; the drawer's `aria-expanded` round-trips. Focus ring is
  `2px solid rgb(201,242,58)` at offset 0 (D16).
- **`/results`:** the filter form renders twice (rail + sheet) with **zero** duplicate ids, zero orphan
  `label[for]`, zero orphan `aria-describedby` — the `idPrefix` namespacing works. Counts read
  `4 matches · 5 similar` with the sheet's `Show 9 matches`, exactly D49.
- **D44's no-JS path is real:** three `<form method="get" action="/results">` with `Apply` submits and
  the vehicle preserved in hidden inputs. **`sort` is the one exception, ruled deliberate by D57.**
- **PDP:** `?qty=` round-trips into the quote form and `aria-current` marks the selected cell; an invalid
  submit keeps typed values, sets `aria-invalid`, announces via `role="alert"` and focuses the **first
  invalid** field; the success panel replaces the form and takes focus; the unavailable SKU returns 200.
- **Skip link:** one Tab from a fresh load lands on it, it reveals, and Enter moves focus into
  `<main id="main">`. Breadcrumb tap targets hit-test **45px** against the 44px floor.
- Lighthouse (mobile, production build): PDP perf 93/95, `/results` 93–97, `/` 91. a11y 100 and CLS 0 on
  all three. The 2.5 s LCP row is red everywhere (3.0–3.5 s) — one build-wide cause, parked (D54).
  **Lighthouse a11y 100 did not catch any of C1–C5.** Its `bypass` audit is satisfied by a `<main>`
  landmark alone, so a site with no skip link scores clean. **Never treat that number as evidence of
  accessibility.**

---

## §6. Next steps, in order

0. ~~**Motion pass.**~~ **Done 2026-09-29 (D92b).** Open follow-ups in root `llm.md` §7.24: browser
   Back/Forward animate nothing, Safari/Firefox unmeasured, the prefetch cost the morph needs. Do not
   re-litigate the thesis; the owner chose "Expressive" over two quieter levels.

**Scope is UI only (D54).** Three items are **parked, not owed** — see §7. Do not reopen one as a blocker
and do not quietly implement it. A page is done when the `docs/decisions.md` §9 gates are green *except* a
parked row.

**Admin:**

0. ~~**Verify the admin on Vercel, once deployments are unblocked (§7).**~~ **Done 2026-09-24**. Every
   item below was observed on production or on a production build (§5), and the text is kept only for
   the record. ~~ The Vercel project exists:
   `platinum-wheels` on team `platninumwheels`, production URL `platinum-wheels-one.vercel.app`, and
   `ADMIN_USERNAME`, `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` are set for Production and Preview.
   `admin-auth-hardening` can merge as is: without `ADMIN_PASSWORD_HASH` the plaintext `ADMIN_PASSWORD`
   keeps working (D95's fallback). Switching to the hash is **deferred by the owner** (§7). **Never observed:** the `$` / `CAD`
   adornments on the amount field at 390 and ~810 (the `pl-*`/`pr-*` longhand must beat `Input`'s
   `px-*` shorthand, reasoned from Tailwind's emission order, not seen); the top bar's logo sharing a left
   edge with the page `<h1>` across 720–1099; no horizontal overflow on the three admin routes. **On the
   first unblocked production build, check the host rules live (D97):** `admin.platinumwheels.ca/` and
   `/results` → 307 `/admin`; `admin.platinumwheels.ca/admin/login` → 200; `platinum-wheels-one.vercel.app
   /admin` → 404; storefront pages on the vercel.app host unchanged.~~

1. ~~**Author the two remaining undrawn states.**~~ **Done 2026-09-21 (D62).** `loading.tsx` and
   `error.tsx` exist at `(storefront)/`, both are on `/styleguide` §11, and the `"use client"` conflict
   that this item flagged for the owner was delegated and ruled: Next rejects every alternative, so
   `error.tsx` carries the directive as the single named exception and holds no component code. Read
   `src/components/site/route-error.tsx`'s header before touching either.
2. ~~**S2**, the 13 class-merge helpers.~~ **Done 2026-09-21 (D63).** `src/lib/cx.ts` now exports both
   `cx` and `join`; all 13 local copies are gone. Verified by extracting every `class="…"` attribute
   from all six rendered pages before and after and diffing — **empty on all six** — with the change
   isolated by `git stash` so concurrent edits could not contaminate it. §7.10's prohibition is lifted
   and spent; do not re-litigate it.
3. ~~**D58 follow-ups.**~~ **All ruled 2026-09-21 (D63)** — see root `llm.md` §7.21. The accessory
   imagery is real now; the seven D59 rulings stand; the accessory quantity control stays as drawn;
   brands keep text wordmarks rather than logos.
4. ~~**Finish the `DEVIATIONS.md` sweep.**~~ **Done 2026-09-21 (D64).** All 43 legacy rows traced:
   **0 wrong, 3 stale (corrected in place), 1 measured.** `design/reports/deviations-sweep.md`.
   Rows #44–#57 were verified as they were written. **The file is certified** — a future session can
   cite a row without re-deriving it, which was not true before today.
5. ~~**Push.**~~ **Done.** `origin/main` is at `2df8092` or later. To land work on `main` so that it
   deploys, open a PR and have `glcorp` merge it with **Create a merge commit** (§7).
6. Replace the **three** remaining stub routes when the client supplies copy — undesigned, so they need the owner before
   they need a session.

---

## §7. Open

**Admin and hosting (D89–D98):**

- **One shared sign-in, hardened (D95).** scrypt hash at rest, signed `__Host-` session cookie, CSRF
  token and origin check on every admin Server Action, `/admin` security headers, audit log lines.
  **Declined by the owner:** a failed-login limit, per-user accounts, 2FA. **Deferred by the owner
  (2026-09-23):** replacing `ADMIN_PASSWORD` with `ADMIN_PASSWORD_HASH` (`npm run admin:hash-password`) —
  *"without npm run admin:hash-password will the ADMIN_PASSWORD keep working if yes lets defer it for later"*. Plaintext keeps working meanwhile; each instance logs `admin.config.plaintext_password`. The block at
  the top of `session.ts` is the canonical list.
- **`admin.platinumwheels.ca` is wired; the apex is not** (D96). One DNS-only Cloudflare CNAME to
  `b3b61a760d17a44c.vercel-dns-017.com`. `platinumwheels.ca` and `www` still serve the goodwill site on
  Cloudflare Pages, and the zone's MX/SPF/DMARC are the shop's Google Workspace email. **Confirmed by the
  owner (2026-09-23):** *"no i meant admin stays and main website stays deferred"*. D95's *"lets not wire up the website"* is the apex.
- **`src/proxy.ts` is live and verified on production** (D97, 2026-09-24, §5). Host routing only — the
  D95 gate is still the only gate. `noindex` stays in both the layout meta and the `X-Robots-Tag` header.
- **Vercel builds only commits authored by `glcorp`.**
  - **Why:** the `platninumwheels` team is on Hobby with one member, `platinumwheelsca-5555` (GitHub
    `glcorp`), and Vercel checks the commit author against team membership. Commits authored by
    GitHub `garvbareja`, a repo collaborator who is not a Vercel team member, create `BLOCKED`
    deployments. That covers every PR preview.
  - **What works:** a PR merged by `glcorp` with GitHub's **Create a merge commit** gives `main` a head
    commit authored by `glcorp`, and that commit builds. This is how `2df8092` deployed on 2026-09-24.
  - **What doesn't:** rebase-merge keeps `garvbareja` as the author, so it stays blocked. Squash-merge
    may too, because GitHub can credit the squash commit to the PR author.
  - **Fix:** move the team to Pro (Hobby is also non-commercial only) and invite `garvbareja`'s Vercel
    account. Owner.
- **Payments are wired, not yet proven against Converge** (D99–D108, branch `payments`). The builder
  creates real links; the success panel shows a **test mode** notice while `CONVERGE_ENV=demo` (D94 retired).
- **Product CRUD** is deferred until the vendor catalogue settles the schema.
- **No `/admin` error or loading boundary** — `(storefront)/error.tsx` does not reach it, and its component
  speaks to customers. `src/app/admin/llm.md` Open #3.
- Session length (12 h) and the admin's `sm:` padding ramp were coordinator calls; both vetoable. Full list:
  `src/features/admin/llm.md` Open.

**Payments (D99–D103, D105–D108):**

- The schema, migrations and DB client are on `main`. The 2026-09-24 production build migrated
  production Neon. Each Vercel build migrates its own Neon branch first (`scripts/db-migrate.mjs`).
- **Built 2026-09-24 on `payments`:** `src/features/payments/` (Converge adapter, service, Pay island),
  `/pay/<token>`, `/pay/return`, `/pay/done`, host routing for `pay.platinumwheels.ca` (D105), and the
  admin's expiry field and links list with Cancel (D106, goodwill, **approved by the owner 2026-09-30**).
  No migration: the schema already had everything.
- **Nothing checks a payment except the return redirect (D108, owner 2026-09-30).** The reconcile cron
  and the Check payment button were built on 2026-09-24 and removed before merging, to save Fixie
  requests: a payment now costs 2. A customer who pays and closes the tab before the redirect shows in
  the list as *Payment started, not confirmed*, and the link stays payable. **Follow-up:** Converge's
  export script would cut it to 1 request and close that gap (`docs/payments.md` §8.9).
- **Verified:** `tsc`, `eslint`, `next build`; 13 service tests against real Postgres (PGlite running the
  repo's own migrations) with a fake gateway. They cover paid, declined then retry, two-tab duplicate,
  amount mismatch, forged return, gateway down, reconcile (paid / expired / live left alone), cancel,
  expiry, append-only events with no PIN, and XML parsing. The harness is not in the repo (no test
  runner is configured). **That run was on 2026-09-24, before D108.** The reconcile code it covered is
  gone; after the removal only `tsc`, `eslint` and `next build` were re-run.
- **2026-10-01, branch `payments-closure` (D119–D121):** `/pay/notify` for Converge's export script
  (off until `CONVERGE_NOTIFY_*` exist; Elavon range + Basic auth; `/pay/return` skips its query when
  notify settled first, so 1 Fixie request per payment); the shop's "Payment received" / "Refund needed"
  email (D120, no flag); the `REPLACE_ME` PIN placeholder counts as unset. Vercel now has
  `pay.platinumwheels.ca`, `CONVERGE_ENV=demo`, `CONVERGE_USER_ID=apiuser116349`, the PIN placeholder.
  Verified: `tsc`, `eslint`, `next build`, and the IP-range boundaries by hand. **No service tests this
  round** (owner: *"no tests needed"*). Elavon's sample export POST has no `ssl_invoice_number`, so
  notify may match nothing until proven otherwise (`src/features/payments/llm.md` Open #2).
- **The Cloudflare `pay` CNAME exists since 2026-10-02** and `pay.platinumwheels.ca` has its certificate
  (`todo.md`, payments; D124 amends D121).
- **Not verified yet: a real Converge call.** Blocked on Elavon allowlisting the Fixie IPs. The
  walkthrough once unblocked: create a `$1.00` link → pay with Visa `4000000000000002` → paid; `$1.88` →
  declined, then retry. The UNCONFIRMED wire details are listed in `docs/payments.md` §10.
- Owner actions: `todo.md` "Payments".
- **Local database work needs a Neon dev branch in `.env.local`.** The Vercel database variables are
  Sensitive and target Production and Preview only, so `vercel env pull` cannot fetch them.

**Quote delivery by email — built 2026-09-24 on branch `quote-email-delivery` (D104), behind a flag:**

- The code is `src/features/cart/quote-email.ts` (moved from `product/` by D122), called from `src/features/cart/actions.ts`. It sends **only when
  `AUTO_EMAIL_LEAD_CAPTURE_ENABLED=true`**; any other value validates, logs `quote.email.disabled` and
  shows success, so the live form can be tested without sending mail. **Vercel has the flag set to
  `false`** and `LEAD_CAPTURE_EMAIL=sales@platinumwheels.ca` (the sender and the alert inbox, one address;
  Production + Preview, 2026-09-24). **`RESEND_API_KEY` is set** (Sensitive, Production + Preview, added
  by the owner 2026-09-24). To go live: get the code onto production, test the form, then set the flag to
  `true` and redeploy (env changes only take effect on a new deployment). `todo.md` item 2.
- **Verified locally against `next start`, with Resend's endpoint mocked** by a fetch preload so no mail
  left the machine: flag off → success, nothing sent; submit under 3 s → `quote.spam.too_fast`;
  honeypot filled → `quote.spam.honeypot`; flag on → exactly two payloads (owner alert with reply-to the
  customer and the consent block; fixed auto-reply); Resend 500 → the `failed` state, form kept, alert
  focused; flag on with no key, or no `LEAD_CAPTURE_EMAIL` → `failed`. **Never observed:** a real Resend send, and any of it on Vercel.
- Log lines carry the slug and outcome only, never a name, email, phone or message, and never Resend's
  error `message` (it can quote the recipient).
- The owner unparked §7.15: *"Deliver enquiries by email (highest value, and it's part of what you
  sold)"*.
- **Owner rulings, 2026-09-23:**
  - reuse the goodwill site's Resend account, with a new sending-only key for the storefront
  - `sales@platinumwheels.ca` as both the From address and the alert recipient
  - honeypot and timer in the action, plus one Vercel Firewall rule at launch
  - a fixed auto-reply that never repeats what the visitor typed
  - the owner alert email is the CASL consent record
  - the footer reads `Brampton, ON` until the street address arrives
- **No DNS change is needed:** Resend is already verified on the domain.
- The owner-side prerequisites (API key, DPA, Google Workspace DKIM, grey cloud, firewall rule) are items
  1–7 in `todo.md`.

**Parked by D54 — recorded, not owed, not blockers:**

1. ~~**The quote form has no destination.**~~ **Built by D104, see the block above.** (root `llm.md` §7.15)
2. **No unavailable state on the PDP.** No artboard draws one, so none was authored. (§7.16)
3. **The LCP gate**, 3.0–3.5 s against 2.5 s on all three routes, one build-wide cause. (§7.12)

**Awaiting an owner decision:**

- **Nothing from the audit.** S2 landed with D63; S3, S4, S5 and T1 with D61; T2–T4 are no-action.
  `design/reports/audit.md`'s fix list is fully discharged.
- **Whether the shop stocks Bosch and Sentali**, the two brands that arrived with the accessory
  photography (D63). Joins the existing brand-confirmation blocker.
- The **street address**, **social links** and **which contact receives call taps** — the owner had none
  of the three to hand on 2026-09-21.
- ~~Two register rows both numbered `D55`~~ — closed 2026-09-21 by D61: the `HANDOFF.md`-shape row is
  now `D55b`. Nothing renumbered, so rule §1.5 holds.

**Settled in session 6 (D58/D59), do not reopen:** three category routes rather than a `?category=`
param · wheels filter on Diameter / Width / Bolt pattern with Finish chips, offset being a spec row not a
filter · accessories drop the size group entirely (four rail groups) · one `Product` type with an
optional `category` rather than a discriminated union. All four were the owner's explicit choice.

**Settled in session 5, do not reopen:** whether `sort` needs a no-JS path (**no** — D57, a D44
addendum) · the home carousel's scrollbar (**hidden**, shared `hide-scrollbar`, D57) · whether live
regions are wanted (**yes** — D57, now on the results count and the quote form).

**Live — full list in root `llm.md` §7:** any D24 default · social links · street address · brand stock
confirmation · which contact receives call taps · **13** class-merge helpers, not six (§7.10, corrected by
the audit) · `skills-lock.json` provenance · stale citations in the inventories.

**Owed by the client (D48):** real year-specific fitment data (now a size **and** a bolt pattern per
vehicle) · per-SKU tire and **wheel** photography · higher-resolution originals for `touren-tr79`
(470×439) and `zmax-landgema` (546×757), whose SKUs currently borrow a same-brand sibling's photo
(D63) · `M+S` sidewall data · confirmation that the seeded brands are stocked, now including **Bosch**
and **Sentali**. **Accessory photography arrived 2026-09-21** and is wired in (D63); what is left there
is transparent cut-outs, since the supplied shots were taken on white and their drop shadows survive
keying. Every wheel and accessory SKU, price and finish is still authored placeholder data, **not**
derived from the wheel CSV — D9 still holds.

---

## §8. Gotchas (each cost real time)

1. Never symlink inside a Tailwind-scanned tree — Turbopack loops forever (D36).
2. A new `@utility` may not reach the browser over HMR: `rm -rf .next`, `npx next typegen`, restart.
3. Same-specificity class overrides resolve by **emission order, not JSX order** — add a size or variant
   rather than trying to override.
4. Opacity modifiers compute to `oklab`; give a literal colour a real token instead.
5. `peer-checked:` only matches a **sibling**. An input that is a *child* of the label needs
   `has-checked:` (`src/components/ui/chip.tsx`).
6. `next/image`: LCP candidates use `loading="eager"` + `fetchPriority="high"`, **not** `priority`.
7. An image's `sizes` must cross at the **layout's** breakpoint, not the type's. The PDP gallery is
   full-bleed below `md:` 1100, so `(min-width: 1100px) 704px, 100vw`.
8. `data-probe` selectors must be scoped — the results filter form renders twice (rail + sheet).
9. `find` here is BSD: `-newermt "-90 seconds"` fails; use `-mmin`.
10. `read_console_messages` returns **buffered history** — a fixed parse error keeps reappearing. Confirm
    in a fresh tab before believing it.
11. Editing by string index can match an earlier identical line (it ate a `useEffect` body once). Anchor
    on something unique, and re-run `npm run check` after every scripted edit.
12. `cd` inside a Bash call persists for later calls — always write
    `cd /Users/raghavvirmani/platinum-wheels && …`, and give sub-agents absolute paths.
13. `npx serve` strips `.html`; baseline URLs are extensionless (§1).
14. This is Next.js **16.4 canary** — breaking changes vs. training data. `AGENTS.md` requires reading
    `node_modules/next/dist/docs/` before using an API. `proxy.ts`, not `middleware.ts`.
15. Package manager is **npm**. The skill's `pnpm check` means `npm run check` here.
16. `launch.json` resolves correctly only when the session starts in this directory.

**Added in session 5 — all four cost a verification round:**

17. **Another Claude session can share the browser pane** and will navigate your tab mid-measurement.
    `tabs_create` your own tab first, and put `navigate → act → measure` in **one** `browser_batch` so no
    other session can interleave. A viewport note reading "another Claude session set this" is the tell.
18. **`:focus` only matches while the document itself has focus.** In a background tab
    `document.activeElement === el` can be true while `el.matches(':focus')` is false, so a focus style
    looks broken when it is fine. Front the tab and use a **real key press**; scripted `.focus()` also
    fails to trigger `:focus-visible` at all, which is why `skip-link` reveals on `:focus`.
19. **Sequential focus navigation has its own starting point.** `blur()` does not reset it, so a Tab
    after a scripted `.focus()` lands on the *next* element, not the first. Reload before a tab-order
    test.
20. **Verify a token exists before using it.** `--font-body` does **not** exist here — the face token is
    `--font-body-face`. An undefined `var()` in a new `@utility` fails silently to a browser default.
    Read the computed value in the browser, per `design/reports/README.md` "Gotcha".
21. **`globals.css` line numbers shift, and `llm.md` files cite them.** Inserting a utility moved every
    citation in `src/app/llm.md` after it; they were repointed in the same change (rule §1.2). Check the
    citing files after any insertion, and prefer citing a utility by **name**.
22. Building a result object keyed by element text **collides** when a responsive pair renders twice —
    the hidden copy silently overwrites the visible one and every reading reads zero. Key by index.

**Added in session 6:**

23. **`getBoundingClientRect()` returns all zeros in a hidden pane tab.** Not just the element you asked
    for — every element on the page, while `document.body` still measures correctly and the page renders
    fine in a screenshot. `document.visibilityState === "hidden"` is the tell. `tabs_select` the tab and
    re-measure. This is the geometry sibling of §8.18: that one is about `:focus` needing document
    focus, this one is about layout boxes needing the tab to be visible. A zeroed probe looks exactly
    like a broken layout, so **check `visibilityState` before believing a zero.**
24. **Compare like with like when a probe crosses an artboard/app boundary.** `DEVIATIONS.md` #30 claims
    the mobile sort text lands ~2px left of the drawn cluster. Measuring the two *boxes* says 0px — they
    are both x=199 w=175 — because the artboard centres text+chevron as one flex cluster while the app
    centres text alone in a `pl-2 pr-9` content box. Ranging the artboard's **text node** (centre 274.5)
    against the app's content-box centre (272.5) gives the real answer: exactly 2.0px, and the row is
    right. The wrong comparison would have marked a correct row wrong.

**Added in session 7:**

25. **In a gate helper, call `cookies()` before any early return.** `hasAdminSession()` once returned
    `false` on a missing env var before touching `cookies()`. `next build` has no env vars, so the call
    never marked the page dynamic, the login redirect was baked in, and every valid session bounced to
    `/admin/login` at runtime, while the build table still showed the route as `ƒ`. `session.ts`
    `readVerifiedSession()` carries the comment.
26. **This clone ships without `node_modules` and without generated route types.** `npm ci`, then
    `npx next typegen`, before `npm run check`, or `tsc` fails on `PageProps` / `LayoutProps`, which
    reads like a real type error and is not one.
27. **Test the admin's no-JS form posts with curl, and send `Origin`.** A `useActionState` form renders
    `$ACTION_REF_1`, `$ACTION_1:0`, `$ACTION_1:1` and `$ACTION_KEY` hidden inputs; scrape them, post them
    back as multipart to the page's own path, and add `Origin: http://localhost:<port>` plus
    `Sec-Fetch-Site: same-origin`. Without `Origin`, D95's check rejects the request by design.
28. **Kill a test server by port, not by name.** `pkill -f "next start"` leaves the `next-server` child
    holding the port, and the next "fresh" server silently fails to bind, so probes hit the old process
    with the old env. `lsof -tiTCP:<port> -sTCP:LISTEN | xargs kill`.
29. **DNS for `platinumwheels.ca` is Cloudflare, not GoDaddy, and the zone carries the shop's email.** Add
    records in Cloudflare. Never switch the nameservers to Vercel, though Vercel's dashboard offers it:
    that drops the Google Workspace MX records and mail stops arriving (D96).
30. **A proxied (orange-cloud) record hides the CNAME and breaks Vercel.** `dig` returns Cloudflare IPs
    (`104.21.x` / `172.67.x`), HTTPS answers **525**, and Vercel's panel can still say the domain is
    fine. Records that point at Vercel are DNS only. Ask the zone directly —
    `dig admin.platinumwheels.ca @connie.ns.cloudflare.com` — because a local resolver can keep a cached
    "no record" answer for minutes.
31. **Use the per-project CNAME from Vercel's Domains panel** (`…vercel-dns-017.com`). The legacy
    `cname.vercel-dns.com` "will continue to work", in Vercel's own wording, but is no longer recommended.

**Added in session 9:**

32. **`next build` can fail with a bare `next/font: error` that is not a code problem.** `src/app/fonts.ts`
    uses `next/font/google`, which downloads Barlow at build time, so a network blip fails the build.
    Re-run it once before debugging.
33. **The Bash tool's shell is zsh, and zsh does not word-split `$var`.** `for x in "host /path"; do set --
    $x; …` leaves `$1` holding the whole string, so a probe loop quietly requests the wrong URL and
    "finds" a regression. Split with `${x%% *}` / `${x##* }`.

---

## §9. Token system — the part to internalise

`src/app/globals.css` resets `--color-*`, `--text-*`, `--font-*`, `--radius-*`, `--shadow-*`, `--blur-*`,
`--tracking-*`, `--leading-*`, `--breakpoint-*` and `--container-*` to `initial`. **`bg-slate-900`,
`shadow-lg`, `rounded-xl` and `text-sm` physically do not compile.** That is deliberate: it makes the slop
grep structural rather than advisory, and it is why `shadcn init` must never be run here.

**Colour** — design name → utility: `--bg`→`bg-bg`, `--surface`→`bg-surface`, `--surface-2`→`bg-surface-2`,
`--border`→`border-border`, `--border-strong`→`border-border-strong`,
`--border-control`→`border-border-control`, `--text`→`text-ink`, `--text-muted`→`text-ink-muted`,
`--text-dim`→`text-ink-dim`, `--accent`→`*-accent`.

**Type** — 22 measured sizes as `text-10` … `text-64`. Display type uses the `display` utility plus a
`text-display-*` token compiling to `calc(<n>px * var(--scale-h2))`; the spec requires headline sizes never
be bare pixels. Ramp membership was *measured* from the exports' own `calc()` bindings: `--scale-hero` →
120; `--scale-h2` → 32/36/40/48/56/88; `--scale-h3` → 20/24/26/28.

**Role utilities** — `display`, `label`, `numeral`, `photo-inset-card` (6%), `photo-inset-gallery` (8%),
`photo-vignette` (50% stop), `photo-vignette-gallery` (55% stop), `transition-card`, `tap-extend`.

**Accessibility utilities (D57)** — `tap-extend-lg` (±16px, for lines too short for `tap-extend`'s ±12px
to clear the 44px floor: a 13px crumb hit-tests 37px with the small band, 45px with the large one),
`hide-scrollbar` (the one mechanism both scroll-snap carousels compose — `similar-track` no longer hides
its own), `skip-link` (off-screen until focused). All three change **no drawn property**, so no parity row
moves. `skip-link` reveals on **`:focus`, not `:focus-visible`** — it is unreachable except by Tab, and
`:focus-visible` does not match programmatically moved focus, which cost a verification round to find.

**Layout utilities** — home: `finder-grid`, `contact-grid`, `category-grid`. Results: `results-grid`,
`range-input`, `sheet-panel`, `size-grid-sheet`, `pb-safe`. Product: `pdp-split` (55fr 45fr),
`quote-grid` (5fr 7fr), `qty-grid` / `qty-grid-wide`, `similar-track` / `similar-grid`.

**Spacing** — no tokens needed. The artboards sit on a 2px grid whose every value is reachable from
Tailwind's default 4px step; `p-px`, `p-0.5`, `p-1.5`, `p-2.5`, `p-3.5` cover the odd ones. **No arbitrary
values anywhere in `src/`.**

---

## §10. Owner instructions, verbatim (archive)

Rule §1.6: owner rulings are quoted exactly. The register in root `llm.md` §5b carries the quote beside
each decision from D23 on; these are the originals from session 1.

The opening brief:

> I have added the design which needs to be made into UI code under this path
> `/Users/raghavvirmani/platinum-wheels` and using this skill start implementing the UI and you are an
> orchestrator so deploy sub agents who will do the task and we coordinate between them ask questions if
> needed
>
> `/design-to-code init`

Two standing instructions came out of that and still hold: **act as orchestrator and delegate to
sub-agents**, and **ask when something is genuinely ambiguous** rather than guessing (§3).

Mid-session the spec was replaced — `@…/Downloads/DESIGN.md updated design.md` — which is why
`design/DESIGN.superseded-cinematic-red.md` is kept.

A data export was supplied with permission to source the hero:

> also adding an export of data to proceed. you can fetch the hero image from net

Followed immediately by a scope correction. **This one is binding — see §12:**

> these are wheels not tires, use as reference. dont make changes pr decisons based on these

---

## §11. Decisions D1–D22 — canonical text, frozen

This section is **never edited**. Root `llm.md` §5a lists these by ID and points here for the full text.
New decisions continue from D23 in root `llm.md` §5b; IDs are global and are never renumbered.

### 11a. Owner rulings (verbatim answers)

| ID | Question | Answer | Consequence |
|---|---|---|---|
| **D1** | DESIGN.md described "Cinematic Dark" (`#000000` + racing red `#e10600`); every artboard exports "Track Night" (`#0B0B0D` + acid lime `#C9F23A`). Which is the source of truth? | **"Artboards — Track Night (lime)"** | Tokens taken from artboard computed styles. *Later dissolved entirely*: the replacement DESIGN.md documents Track Night directly, so spec and artboards now agree on colour. |
| **D2** | The skill mandates `src/app`; the repo was a fresh create-next-app with root `app/`. | **"Migrate to src/ (skill-compliant)"** | `app/` → `src/app/`, plus `src/features/`, `src/components/{ui,site}/`, `src/lib/`. `@/*` → `./src/*`. |
| **D3** | Not a git repo. The skill's workflow commits per section. | **"No git — just write files"** | No commits, no rollback points. This file + `design/reports/` + `design/DEVIATIONS.md` are the audit trail. The superseded spec is kept as a file for the same reason. |
| **D4** | The artboard hero hotlinks a Ferrari F40 photo from `vossenwheels.com`. | **"Licensed stock, sourced by me"**, later **"you can fetch the hero image from net"** | **Done.** `public/images/photos/hero-tread.webp` — Unsplash `CTwQiFlpgrM`, Rob Wingate, tread macro. The first candidate was rejected for carrying `PIRELLI`, `PORSCHE` and a Porsche crest. See `design/ASSET-CREDITS.md`. |
| **D5** | DESIGN.md called one-accent-per-frame inviolable; every artboard breaks it. | **"Artboards — drop the rule"** | *Also dissolved*: the replacement spec softened it to "judge by the frame, not the component… in an otherwise quiet grid the badge and CTA are far enough apart to coexist." The artboards are compliant under that wording. **Do not demote a second accent.** |
| **D6** | DESIGN.md §8 specifies a 64px sticky mobile PDP buy bar; the artboard has none but reserves 120px footer padding. | **"Don't build it — artboard wins"** | *Also dissolved*: the replacement §8 drops the sticky bar. Spec and artboard now agree. |
| **D7** | The spec asks for header elements the artboards don't contain: 40px badge + text wordmark, phone in tabular + ghost `GET A QUOTE`, and a fifth `Services` nav item. | **"Artboards as drawn"** | 64px badge image, no wordmark, one accent-bordered `Call 647-989-6178`, four nav items. No dead `Services` link. → DEVIATIONS #11. |
| **D8** | WCAG 1.4.11 control-boundary contrast failure. | **"do whats best"** | Delegated. Took the targeted fix — see D14. |
| **D9** | The wheel CSV — how should it be used? | **"use as reference. dont make changes pr decisons based on these"** | Parked. No code, type or design decision derives from it. See §9. |

### 11b. Derived rulings (made under the authority chain, not asked)

| ID | Decision | Reasoning |
|---|---|---|
| **D10** | **Breakpoints come from DESIGN.md §8 only: 400 / 720 / 1100 / 1320.** Tailwind `xs: sm: md: lg:`. | The seven exports contain **zero `@media` rules** — they're fixed snapshots at 1440 and 390, so crossovers are not derivable from them. All three extraction agents independently flagged this rather than inventing numbers. |
| **D11** | **Container capped at 1344px**, not the spec's 1320. | The exports declare no `max-width` at all; 1440 − 2×48px padding = exactly 1344. 1320 would make side padding 60px and miss every measured x-offset by 12px — outside the ±4px parity threshold. → DEVIATIONS #3. |
| **D12** | **Chips are radius 0**, not the spec's 2px. | Chips declare no `border-radius` while the Sort select and Apply button *in the same row* do declare `--radius-ctl`. Deliberate, and radius is exact-match for parity. → DEVIATIONS #5. |
| **D13** | **Button tracking `.08em` / `.04em`**, not the spec's `+0.06em`. | `.06em` occurs 14× across the exports and **never once on an element with a height** — every instance is a `500 13px/1` inline label such as the card `from`. The spec was describing a label. → DEVIATIONS #6. |
| **D14** | **New token `--border-control: #69696F` on form controls only.** | WCAG 1.4.11 wants 3:1 against every *adjacent* colour. `--border-strong` gives 1.35:1 against the field fill it encloses, and the fill is only 1.10:1 against the panel — nothing identified the control. `#69696F` is the lowest value clearing 3:1 on all three (3.01/3.31/3.61). Scoped to inputs/selects/textareas; card edges and dividers stay as drawn. → DEVIATIONS #14. |
| **D15** | **Mobile textarea forced to 16px** (artboard draws 15px). | Below 16px iOS zooms the viewport on focus. On a quote-first site the form *is* the funnel. The 1px is invisible; the zoom is not. → DEVIATIONS #12. |
| **D16** | **Focus ring offset 0** (the one focused field in the exports draws `-1px`). | DESIGN.md §4 says "no offset" twice and the global `:focus-visible` implements it. One element in one export is weaker evidence than a twice-stated rule. → DEVIATIONS #13. |
| **D17** | **Hover scoped to `@media (hover: hover)`** (Tailwind `hover:` does this natively in v4). | The mobile exports ship 22 `:hover` rules, but a CSS hover sticks after tap on touch. Device-capability fix, not a design change. → DEVIATIONS #10. |
| **D18** | **Routes: `/`, `/results`, `/products/[slug]`, `/styleguide`.** | Every `href` in all seven exports is `"#"` — no route is drawn anywhere. Breadcrumb reads `Home / Results / <name>`. `/products/` is plural by convention; the card derives both its links from one pair of constants at the top of `product-card.tsx`, so changing the shape is a one-line edit. |
| **D19** | **Product cut-outs normalised to one square canvas** (trim to content → scale to 88% of a 1000px canvas → centre). | DESIGN.md §4 requires it; the sources ranged from 470×439 to 1776×1704. The script **refuses to upscale** — two images can't reach the target and are logged as a client blocker rather than shipped blurry. |
| **D20** | **Self-host Barlow + Barlow Condensed; drop Michroma, Manrope, Barlow Condensed 600.** | All three are requested by the exports' Google Fonts `<link>` and referenced by **zero** `font-family` declarations — export artefacts. Self-hosting is an HLD requirement. → DEVIATIONS #2. |
| **D21** | **Price suffix is per-context**, verbatim: cards read `/ tire`, the PDP reads `per tire · before tax`. | Both artboard-verbatim. The HLD originally over-generalised to `/ tire` everywhere and was corrected to match. |
| **D22** | **Desktop copy used at all widths**; the contact photo panel is hidden below 720px, not removed. | Mobile drops the word "proper" from one sentence and omits the contact panel. Serving different body text per viewport needs duplicated DOM, which splits indexable content. → DEVIATIONS #8. |

---

## §12. Reference — the wheel CSV (D9)

`~/Downloads/PLATINUM WHEELS AND TIRE SOLUTIONS_wheel.csv` was supplied on 2026-09-20 as **reference
only**: *"these are wheels not tires, use as reference. dont make changes pr decisons based on these."*
**No code, type or design decision derives from it**, and none should without a new instruction. An ingest
pipeline was about to be proposed and was dropped.

Recorded so a future session knows what it is and does not re-profile it:

- 11,414 rows, 14 manufacturers, 0 duplicate SKUs, 466 distinct Manufacturer+Model.
- It is a **wheel** feed (diameter × width, bolt pattern, offset, finish) from the AutoCountry distributor
  and contains **no tires**, while the design sells tires. That gap is unresolved and is a question for the
  owner if real catalogue data is ever wired up (root `llm.md` §7.3).
- 2,495 of 11,414 in stock; MAP $147–$1,705 on the in-stock subset; 347 distinct images, all on the
  distributor's S3.
- **Two hazards if it is ever ingested.** `Cost` is confidential wholesale pricing on 10,959 rows and must
  be stripped **at the ingest boundary**, not merely left unrendered — anything reaching a client payload
  leaks. `AC-OAK`/`AC-EDM`/`AC-MTL` are stock counts, which `docs/decisions.md` §7 forbids displaying; they
  may only be reduced to a boolean.
- `Lug Type` is **corrupted** — values are `''`, `'0'`, `'2500'`, `'3200'`, `'Conical'`, i.e. numbers that
  look shifted in from `Max Load lbs`. Do not render it.
