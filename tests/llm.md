# tests/

## Purpose
The committed end-to-end QA suite (D91b). Playwright drives the **production build** across three engines
and six device profiles, and `@axe-core/playwright` runs WCAG checks per route and state. It exists so
every future change re-proves what the D56/D65/D91b passes measured by hand; without it, each regression
has to be rediscovered by the owner in a screenshot (D84, D86 were).

**Partly revived 2026-10-05 (launch-audit batch 2).** Parked since 2026-09-30 (D111) because the specs asserted
on the deleted sample catalogue. A committed **fixture database** now exists (`tests/fixture/`, below), and
the cheap specs run against it: `seo`, `routes`, `smoke`, `error-boundary`, plus three new ones for the
cart send, the `/pay` states and the admin save. **Those seven are a gate** (`npm run test:e2e:fixture`).
Every other spec is still parked, kept as written, and is not a gate: see Open for what each waits on. The
rules in this file apply to all of them.

## Owns
- [`../playwright.config.ts`](../playwright.config.ts) — lives at the repo root (Playwright's convention);
  owned by this folder. 15 projects: `{chromium,firefox,webkit}-{1280,1440,1920}` and six devices
  (`iphone-se`, `iphone-15-pro`, `pixel-7`, `ipad-mini`, `ipad-pro-landscape`, `floor-320`).
- [`helpers.ts`](helpers.ts) — shared route list, the fixture's slugs and payment tokens (`SLUG`, `PAY_TOKEN`,
  read from `fixture/slugs.json`), project-kind predicates, the console/network
  watcher (ignores WebKit's aborted-`_rsc` "access control checks" noise), `settle()`, `scrollSettled()` and
  the overflow assertion. Every spec imports from here, never re-declares a route.
- [`e2e/*.spec.ts`](e2e/) — one spec per concern; the concern is the filename. See `design/reports/qa.md`
  §1 for the matrix each spec covers.
- Senior-pass specs (D93b): `e2e/routes.spec.ts` (current-nav rule, status table for wrong URLs, 404 axe),
  `e2e/hostile-query.spec.ts` (hostile query strings; `HOSTILE_TABLE=<file>` dumps a JSON row per case),
  `e2e/crawl.spec.ts` (every-control crawl: hit-test, name, links, effect, target size) and
  `e2e/environment.spec.ts` (offline, blocked storage, failed images/fonts, CPU races, rotation, zoom, print,
  two tabs). `PW_ROOT_ERROR=1` enables the root-layout-error tests in `error-boundary.spec.ts` and needs a
  scratch server whose root layout throws.
- `e2e/seo.spec.ts` (D112) — the search-facing contract, network only (no browser, one project):
  `robots.txt` and the sitemaps by flag and by host, the robots meta, canonical and preview tags of every
  indexable page, the never-indexed pages, and the structured data, which fails on any address, opening
  hours, price, offer, rating or review. **One run sees one flag state**: run it once as is and once with
  `SEARCH_INDEXING_ENABLED=true` against a build made with the same value. Its product test reads the fixture's tire; a
  404 there fails (it used to skip, D111). `run.mjs` runs it in both flag states.
- **The fixture (`fixture/`)** — everything the revived specs run against, one command (see Rules):
  - `catalogue.csv` — 126 products (51 tires, 44 wheels, 31 accessories) picked from the full built
    catalogue, in the importer's **current** columns (D142's `part_number` / `mud_snow` included), every vendor
    price replaced by `100.00`. `pick-catalogue.mjs` regenerates it from a full `catalogue.csv`.
  - `slugs.json` — the fixture's named slugs (one PDP per category, each category's discontinued SKU, a hidden
    product) and the payment-link tokens. **The one source**: `helpers.ts` and the seeding both read it.
  - `fixture.mjs` + `db-server.mjs` — start a throwaway **real Postgres 17** (`embedded-postgres`, installed on
    first use from `fixture/package.json`, never an app dependency; **not PGlite**, whose shared session breaks on
    the app's parallel queries: "bind message supplies N parameters", measured 2026-10-05), migrate it with `scripts/db-migrate.mjs`, loads the CSV
    with the app's own importer, then adds what no importer makes: three discontinued products, one hidden,
    a stand-in photo on about half the tires and wheels (`photos.mjs` serves them, drawn with `sharp`, as its own
    process: `run.mjs` blocks on `spawnSync` while it builds and tests, and an in-process server answers nothing), and four
    payment links (open, paid, cancelled, expired).
  - `run.mjs` — the entry point: database, photos, `next build`, `next start`, Playwright, cleanup.
- **Since D157:** `admin-save`'s two `request` tests reach the admin at `127.0.0.1` with a
  `host: admin.localhost:<port>` header (Node's resolver on macOS does not resolve `*.localhost`), and
  `routes.spec.ts` has a JS-off block for the product 404 (unknown and hidden slug: 404, one `<h1>`, one
  `<main>`, one robots meta). Parked specs that assume 1,058 Model options at load (`finder`, `nojs`,
  `results`, `crawl`, `environment`, `product`) must focus a finder select first, or read
  `#finder-model-all` with JS off, when they return.
- `e2e/search.spec.ts` (D173, 2026-10-11) — in the fixture gate. Six spellings of 225/60R17 find the
  same tires; the size brings the 17-inch wheels 7.5 and 8 in wide and not 8.5 or 9; a part number with and
  without dashes; the hidden tire never shows; the no-matches state; `noindex` and no price in the HTML; JS
  off (header link, GET form); the header field opens focused, Esc closes it and Enter searches; `Show more`.
  Runs on `chromium-1440` and the iPhone projects.
- `e2e/cart-send.spec.ts`, `e2e/pay-states.spec.ts`, `e2e/admin-save.spec.ts` (new, 2026-10-05) — one
  project each (`chromium-1440`). Cart: add a tire, open `/cart`, the quote dialog, an empty send refused, a valid
  send, the success panel, the cart empties (email flag OFF: the app's own success path; nothing is sent). Pay:
  the four link states with axe, 404s, the capability headers, `/pay/return` never leaving the cookie's own link
  (LA-01/LA-02), `/pay/done`, and Pay with an unreachable gateway. Admin: the gate, `/admin` a 404 (D115), a wrong
  password, sign in, edit a product, save, a fresh session reads it back, the storefront shows it.
- `e2e/listings.spec.ts` (**D164–D167**, 2026-10-11) — `chromium-1440`, serial: `May also fit` closed with best
  matches, open with none, `Load more` inside it landing on `#similar-4` with focus, a grown list arriving open with
  JS off; a discontinued product listed with no unavailable mark and a hidden one absent; the three-photo gallery
  (arrows wrap, thumbnails, Home / End, the 704px box) and its no-JS state; and an admin `Make main` reordering the
  gallery, then put back. `fixture.mjs` gives the named tire three photos for it.
- `e2e/**/__screenshots__/` — `toHaveScreenshot` baselines (macOS, Chromium only). Committed.

## Rules
- **Production build only, never `next dev`** (D88: dev streams a hidden duplicate tree that fakes both
  failures and passes). the plain config's `webServer` runs `next build && next start -p 3100`, and reuses a server already on
  :3100 — **so after any `src/` change, stop that server first** or the suite tests the old build.
- **`npm run test:e2e:fixture`** is the one command: Postgres (`:55600`), the fixture loaded, photos
  (`:3590`), `next build` and `next start` (`:3500`), Playwright on `chromium-1440` over `seo routes smoke
  error-boundary cart-send pay-states search admin-save listings finder-fit`, then a **second build with `SEARCH_INDEXING_ENABLED=true`
  and `seo` again** (the flag is fixed at build time, D112), then everything stopped. Pass Playwright arguments
  after `--` to run something else against the same fixture (`npm run test:e2e:fixture -- smoke --project=webkit-1280`);
  `FIXTURE_ONE_PASS=1` skips the indexing pass, `FIXTURE_SKIP_BUILD=1` reuses `.next`. `...:up` / `...:down` leave
  the stack running for a manual session. It scrubs the shell's own settings first: it can never reach Neon,
  Resend, Converge, R2 or a Vercel project, and quote email is off, the gateway a closed port.
- `npm run test:e2e` (the plain config) still builds against whatever `DATABASE_URL` the shell has and runs
  every project; against an empty database most of the parked specs fail. Use the fixture command.
- Fixture seeds assert on **fixture** slugs from `helpers.ts`, never on a count the vendors own (D48).
- Locate by role and accessible name first, `data-probe` second, CSS never — a test that finds a control
  the way a screen reader does also tests that it is named (D56 C5).
- **Hit-test, don't inspect.** A click assertion uses a real `click()` at the element's box, and
  `elementFromPoint` where stacking could intercept — markup inspection passed a dead link once (D86).
- **Real input.** Keyboard tests use `page.keyboard`, never scripted `.focus()`/`.click()`: scripted focus
  never triggers `:focus-visible` (`HANDOFF.md` §8.18), and a synthetic click forced a full reload that
  masked D84.
- **Let the scroll come to rest before acting on what it moved.** `<html>` is `scroll-behavior: smooth`
  (D92b), so Playwright's own actionability scroll, a `fill()` and a keyboard focus change all *glide*. A
  hover, click or geometry probe issued mid-glide hits where the element was — measured as a no-JS submit
  that never fired, a hover that never lifted and a 2.4.11 "hidden" focus that was still travelling. Use
  `scrollSettled(page)` from `helpers.ts` (or wait for `scrollY` to hold) first. It is a harness rule, not a
  product defect — but check that it is not a product defect before applying it (FIN-4 looked the same).
- **An invisible overlay is not content.** The idle `NavProgress` overlay is a full-viewport `fixed` box at
  opacity 0 (D92b addendum). Probes that enumerate text or fixed boxes skip opacity-0, `aria-hidden` nodes.
- A test that is **artboard-mandated** or **parked (D54)** is `test.fixme` with the row it cites, never
  deleted and never counted as a defect.
- Screenshot baselines change only with a `DEVIATIONS.md` row or a D-row naming the visual change.
  `--update-snapshots` alone is not a fix.

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | 2026-09-29 | Visual regression + axe are in scope; `docs/decisions.md` §10 amended in place. | Owner's QA brief asked for `toHaveScreenshot` baselines and axe per route. | **D91b** |
| — | 2026-09-29 | Port 3100, so `next dev` on :3000 and the artboards on :4000 can run beside it. | Three servers, one machine. | *derived*, D91b |
| — | 2026-09-30 | `PW_PORT=<port>` points the suite at a private production build (`reuseExistingServer`), so a gate run never touches :3100 or another session's servers. | Several sessions share one machine. | *derived*, D93b |
| — | 2026-09-30 | `visual.spec` reveals every `[data-reveal="pending"]` section before capture. | The D91b home baselines were blank below the fold. | **D93b** |
| — | 2026-09-30 | **The suite is parked until it has a fixture database.** One test could no longer compile: `hostile-query.spec.ts` WDG-18 imported `searchSeed`, which D108b deleted. It is `test.fixme` with its reason; nothing else was edited. | The seed the specs assert on is gone; rebuilding the fixture is its own session. Owner: *"Park it, fix later (Recommended)"*. | **D111** |
| — | 2026-10-05 | **The fixture database exists; seven specs are a gate.** a real embedded Postgres, the app's own importer, 126 products, extras seeded by SQL; `npm run test:e2e:fixture` is the one command. `seo`, `routes`, `smoke`, `error-boundary` revived by pointing their slugs at the fixture (no assertion weakened; `seo`'s `legalName` follows the 2026-10-05 "Inc." ruling, and 404 checks read every robots meta and require exactly one); `cart-send`, `pay-states`, `admin-save` are new. | The launch audit's gap: nothing tested the cart send, `/pay`, the admin or the new filters. | `design/reports/launch-fixes.md` (Batch 2 e2e item), *derived* |
| — | 2026-10-05 | The fixture's Postgres binary installs from `tests/fixture/package.json`, not the app's. PGlite was tried and dropped. | The storefront build must not carry a test database; the lockfile there is committed. PGlite multiplexes connections over one session, so the results page's eight parallel queries and `payment_links` reads failed intermittently with a bind-parameter mismatch. | *derived* |
| — | 2026-09-30 | `/styleguide` visual baselines run under `prefers-reduced-motion: reduce` rather than masking §12's sweeping `LoaderMark`; the 1.4.12 text-spacing cell for `/styleguide` at 320 is skipped (fixed-size type specimens, internal `noindex`). | Keep the loader in the diff in its static form; a specimen word cannot fit 320 by construction. | *derived*, D91b |

## Connects to
- Depends on: every route in `src/app/(storefront)/`, `src/app/pay/` and `src/app/admin/`; `src/lib/routes.ts`
  for paths; the importer (`scripts/catalog-import.ts`, `src/features/catalog/import-*.ts`) and
  `scripts/db-migrate.mjs` for the fixture (a change to the importer's columns means regenerating
  `fixture/catalogue.csv`); `src/db/schema.ts` (the seeded payment links); `src/features/admin/host-routing.ts`
  (`admin.localhost`); `design/assets/*.html` via `npm run design` (:4000) for the parity spec.
- Depended on by: `design/reports/qa.md` (evidence), `HANDOFF.md` §5 (verification state).

## Don't
- Don't add `waitForTimeout` to make a test pass. Wait on a condition; a sleep hides the flake it fixes.
- Don't assert on a seed count without citing where it comes from — seeds are placeholder data (D48) and
  will change when real data lands (D89b).
- Don't point the fixture at a real database. `run.mjs` strips `DATABASE_URL*`, `IMPORT_DATABASE_URL`, `RESEND_*`,
  `R2_*`, `CONVERGE_*`, `FIXIE_*` and `VERCEL*` from the shell before it builds, and the importer only ever
  gets the fixture database URL; keep it that way.
- Don't commit anything from `fixture/.run/` or `fixture/node_modules/` (gitignored there): the run log, the
  per-run admin password and the Postgres data directory.
- Don't run the suite against :3000. A dev server passes tests production fails, and vice versa (D88).

## Open
- **The quote band moved to the cart (D122).** Every spec that fills the PDP quote form, clicks a card's
  `Request a quote` or follows `#quote` (the specs that mention it: `a11y-axe.spec.ts`, `a11y-interaction.spec.ts`, `engines.spec.ts`, `environment.spec.ts`, `home.spec.ts`, `finder.spec.ts`, `nojs.spec.ts`, `hostile-query.spec.ts`, `parity.spec.ts`, `responsive.spec.ts`, `product.spec.ts`;
  and the PDP visual baselines) asserts a page that no longer exists. Kept as written while the suite is parked (D111, D123(8)); rewrite them against `/cart` and its
  dialog with the fixture database. Coordinator.
- **Parked specs (D111), and what each waits on.** The fixture exists now, so what remains is rewriting
  assertions the D108b/D109 data-model change made false, not building a database. Parked: `a11y-axe`,
  `a11y-interaction`, `crawl`, `engines`, `environment`, `finder`, `home`, `hostile-query`, `nojs`, `parity`,
  `perf`, `product`, `responsive`, `results`, `visual`. They fail or mislead until: a size filters instead of
  splitting the set (`0 matches · 9 similar` no longer holds), `Load more` is `?show=30` and not `?show=all`
  (D133), brands sort by count, `Best match` reads across brands, the PDP has an `Other sizes` row, wheels and
  tires gained the D137 filters, and every quote-form step moved to the cart (item above). The 126-product
  fixture is deliberately small: specs that assert a count, a `Load more` window (it needs more than 24 best
  matches in one list) or a brand fold of exactly eight need a bigger pick (`pick-catalogue.mjs`). The visual
  baselines are re-shot under D108b's deviation rows (#88–#94) and the later ones. WDG-18 returns as a test
  against an empty fixture category. Coordinator.
- ~~**`routes.spec` records a real defect, as an annotation.**~~ **Closed 2026-10-05.** An unknown product
  slug's 404 carried two robots tags in the DOM (the product route's metadata inherited the layout's); the
  route now returns `robots: null` for a missing product, as `src/app/not-found.tsx` does, and the spec asserts
  exactly one.
- **The admin sign-in's client redirect on a local build (D124, `src/app/admin/llm.md` Open #6).** After `signIn`
  the URL is the admin's `/` but the page rendered is the storefront home until a real navigation;
  `admin-save.spec.ts` navigates for real after signing in and says why. Remove that line when it is fixed.
- **Cart send and the 3 s timer.** A quote request submitted within 3 s of the dialog first opening is answered
  `success` with no email and no validation (D104, D123(7), by design: the spam timer runs before validation),
  so even an empty form "succeeds" and the cart empties. A password manager that autofills and submits can beat
  3 s, and that visitor sees "sent" for a lead the shop never gets. The spec waits 3.5 s on a condition before
  sending, so it proves the send, not the guard. Owner's call whether the clock should start at the first
  keystroke instead. Coordinator.
- **One unreproduced flake.** In one of four full fixture runs `routes.spec`'s "Accessories is the one current
  item" on the accessory PDP read no current link in the header (`[]` for `[Accessories, Accessories]`) 2.9 s
  into a cold server; 70 repeats and the other runs never showed it. The default fixture run passes
  `--retries=1`, which reports a retry as **flaky**, never as a pass. If it recurs, suspect the cold first render
  of that PDP, not the test. Coordinator.
- **Real engines for the new specs.** `admin-save` is Chromium-only (`admin.localhost` does not resolve in
  Firefox or WebKit on this machine); `cart-send` and `pay-states` run on `chromium-1440` only (the cart send is
  rate limited per IP and the pay states are server-rendered). The other 14 projects run `seo`, `routes`,
  `smoke` and `error-boundary` only when named: `npm run test:e2e:fixture -- smoke routes --project=webkit-1280`.
- **Not provable here:** `/pay` on `pay.platinumwheels.ca` and the admin on `admin.platinumwheels.ca` (the host
  rules are production only, D105, D115); a real Converge round trip; a real Resend send; R2 photo upload.
- **Load sensitivity.** At 5–6 workers on this 8-core machine a handful of timing tests (the INP proxy,
  pre-hydration clicks) can fail and pass alone; the gate run uses `--workers=5`. A CI box with more cores
  should use the config's `workers`. Coordinator.
- **Suite size.** With the senior-pass specs the full run is ~10,000 tests (the hostile-query and crawl tables
  multiply by 15 projects); budget hours, not minutes, at `--workers=5`. Coordinator.
- **Real Mobile Safari.** The iOS Simulator needs full Xcode; this machine has only the Command Line
  Tools, so the WebKit device projects are the proxy. Owner installs Xcode to close it.
