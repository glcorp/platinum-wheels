# tests/

## Purpose
The committed end-to-end QA suite (D91b). Playwright drives the **production build** across three engines
and six device profiles, and `@axe-core/playwright` runs WCAG checks per route and state. It exists so
every future change re-proves what the D56/D65/D91b passes measured by hand; without it, each regression
has to be rediscovered by the owner in a screenshot (D84, D86 were).

**Parked since 2026-09-30 (D111).** The specs assert on the sample catalogue: its slugs, its counts, its
nine cards a category. D108b deleted that seed and every storefront page now reads the database, so
against an empty database almost every spec fails and the suite proves nothing. Owner: *"Park it, fix
later (Recommended)"*. Every spec is kept as written. **The suite is not a gate until it has a fixture
database** (Open, below), and the rules in this file apply again from that day.

## Owns
- [`../playwright.config.ts`](../playwright.config.ts) — lives at the repo root (Playwright's convention);
  owned by this folder. 15 projects: `{chromium,firefox,webkit}-{1280,1440,1920}` and six devices
  (`iphone-se`, `iphone-15-pro`, `pixel-7`, `ipad-mini`, `ipad-pro-landscape`, `floor-320`).
- [`helpers.ts`](helpers.ts) — shared route list, the old seed's slugs (they resolve again once the
  fixture database carries those products), project-kind predicates, the console/network
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
  `SEARCH_INDEXING_ENABLED=true` against a build made with the same value. Its product test skips
  until the fixture database exists (D111); everything else needs no database rows.
- `e2e/**/__screenshots__/` — `toHaveScreenshot` baselines (macOS, Chromium only). Committed.

## Rules
- **Production build only, never `next dev`** (D88: dev streams a hidden duplicate tree that fakes both
  failures and passes). `webServer` runs `next build && next start -p 3100`, and reuses a server already on
  :3100 — **so after any `src/` change, stop that server first** or the suite tests the old build.
- `npm run test:e2e` runs every project. `npx playwright test --project=chromium-1440` for one.
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
| — | 2026-09-30 | `/styleguide` visual baselines run under `prefers-reduced-motion: reduce` rather than masking §12's sweeping `LoaderMark`; the 1.4.12 text-spacing cell for `/styleguide` at 320 is skipped (fixed-size type specimens, internal `noindex`). | Keep the loader in the diff in its static form; a specimen word cannot fit 320 by construction. | *derived*, D91b |

## Connects to
- Depends on: every route in `src/app/(storefront)/`; `src/lib/routes.ts` for paths; the products of the
  old seed (`src/features/catalog/data.ts`, deleted by D108b), which must come from a fixture database
  now; `design/assets/*.html` via `npm run design` (:4000) for the parity spec.
- Depended on by: `design/reports/qa.md` (evidence), `HANDOFF.md` §5 (verification state).

## Don't
- Don't add `waitForTimeout` to make a test pass. Wait on a condition; a sleep hides the flake it fixes.
- Don't assert on a seed count without citing where it comes from — seeds are placeholder data (D48) and
  will change when real data lands (D89b).
- Don't run the suite against :3000. A dev server passes tests production fails, and vice versa (D88).

## Open
- **The fixture database (D111). Blocks every run.** What it takes: a Postgres the suite starts itself
  (the merge check used PGlite behind `@electric-sql/pglite-socket`, which `pg` and
  `scripts/db-migrate.mjs` both accept); the old seed's 27 products loaded through `catalog/store.ts`
  `createProduct`, with their cut-outs as `product_images` rows; `DATABASE_URL` handed to the
  `webServer` build. Then the assertions D108b and D109 changed on purpose need rewriting, not
  restoring: a size filters instead of splitting the set (`0 matches · 9 similar` no longer holds),
  `Load more` is `?show=30` and not `?show=all`, brands sort by count, `Best match` reads across
  brands, the PDP has an `Other sizes` row. The visual baselines are re-shot under D108b's deviation
  rows (#88–#94). WDG-18 comes back as a test against an empty fixture category. Expect Firefox to
  be clean on `/` again: the home row has no timer (D111). Coordinator.
- **Load sensitivity.** At 5–6 workers on this 8-core machine a handful of timing tests (the INP proxy,
  pre-hydration clicks) can fail and pass alone; the gate run uses `--workers=5`. A CI box with more cores
  should use the config's `workers`. Coordinator.
- **Suite size.** With the senior-pass specs the full run is ~10,000 tests (the hostile-query and crawl tables
  multiply by 15 projects); budget hours, not minutes, at `--workers=5`. Coordinator.
- **Real Mobile Safari.** The iOS Simulator needs full Xcode; this machine has only the Command Line
  Tools, so the WebKit device projects are the proxy. Owner installs Xcode to close it.
