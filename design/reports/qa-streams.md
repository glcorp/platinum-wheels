# QA of streams A–D and PR #59 — 2026-10-11 to 2026-10-13

A rigorous QA pass over everything the four parallel streams built (D161–D171, D173, D174) and the
follow-up PR #59 (D175–D182), front end and back end, on every device class the suite knows. Owner brief,
2026-10-11. **Report only: nothing under `src/` was changed.** Fixes wait for the owner's approval, item by
item (the D56 precedent).

**Result in one line:** no P0 and no data leak; **one P1**, latent (a product with 7 or 8 photos breaks the
product page in Safari and on iPads, and no product has that many yet); **8 P2**, half of them in search;
the client's Model-list glitch did **not** come back in about 4,000 runs.

| Stream | Verdict | Worst open item |
|---|---|---|
| A — one number, no names, sent requests, HTML emails, GTA, tab icon (D161–D163) | **Pass** | P2 owner decision: a quote sent within 3 s shows "sent" but is not emailed (CART-2) |
| B — discontinued listed, `May also fit`, 50 MB photos, gallery (D164–D167, D175) | **Pass with one P1** | P1: gallery with 7–8 photos in WebKit (PDP-1) |
| C — Model list, home size + season, size keeps the car, Other sizes fit (D168–D171, D176) | **Pass** | P2: wheel size selects clip at 320 (HOMEFIND-4); forced-colours switch (GATE-1) |
| D — free-text search (D173, D174, D177, D178, D180) | **Pass with P2s** | P2 ×4: thread `See all`, stale field, no loader, sideways scroll on a long query |
| PR #59 rest (D179, D181, D182) | **Pass** | none |
| PR #60 (D183), production spot check only | **Pass** | P3 owner decision: widest About logos 5–9 px tall (PR60-1) |

---

## 1. What was tested, where

| | |
|---|---|
| Code | `main` at **`80d7439`** (the four stream merges plus #59), frozen in a worktree. PR #60 (D183, About grid density) merged after the run and was **not** built; see §6. |
| Fixture server | Production build (`next build && next start`), the e2e fixture database: 126 products with every state (discontinued, hidden, photos, payment links). Prices off, indexing off, quote email off. |
| Full-catalogue server | Production build on a throwaway Postgres 17 loaded with the current `catalogue.csv` by the app's own importer: **39,950 products**, migration `0006`. 30 products set `hidden` and 30 `discontinued` by the coordinator, so counts differ from production by those. Used for every count, fitment and speed check. |
| Private stacks | Agents that write (cart sends, admin photo order) ran their own fixture stack on their own ports. |
| Production | `platinum-wheels-one.vercel.app`, **GET only**, ≤ 1 request a second and ≤ 300 per agent (owner: *"Yes, read-only"*). It carried the merges, #59 included. |
| Engines | Playwright Chromium, Firefox, WebKit 26.6 at 1280 / 1440 / 1920; iPhone SE, iPhone 15 Pro, Pixel 7, iPad Mini, iPad Pro landscape, 320×568; plus 360×640, 375×667, 390×844, 430×932, 768×1024, 1024×768, 1100, 1366×768, 1440×900, 1920×1080, phones and tablets sideways. |
| Method | Ten Sonnet scope agents, each finding re-checked by a second Sonnet agent before it counted (the D145 verifier step). Real clicks and keyboard, `elementFromPoint` hit tests, SQL as the oracle for every count (D86, D91b, `tests/llm.md` Rules). |

**Volume.** Layout ~1,900 page loads and 941 screenshots; fitment 944 count checks on 38 cars; search 80
parser strings and 33 queries × 3 groups against SQL; Model list 3,239 runs on six profiles plus 810
targeted race runs; home finder all 56 field subsets on six profiles and 723 list checks against SQL;
product page 0/1/2/3/8 photos on three engines; 97 axe scans.

## 2. Matrix

**P** pass · **F** open finding (ID) · **—** not applicable · blank not run there.

| Check | Chromium desk | Firefox desk | WebKit desk | iPhone SE / 15 Pro | Pixel 7 | iPad | 320 |
|---|---|---|---|---|---|---|---|
| Committed gate (`npm run test:e2e:fixture`) | P 155 + 32 | P | P | P (GATE-3/4 test defects) | | | P |
| No horizontal scroll, no clipping, no overlap | P (LAYOUT-1) | P (LAYOUT-1) | P (LAYOUT-1) | P (LAYOUT-1) | P | P | F HOMEFIND-4, LAYOUT-2 |
| Pinned header and bars (D159, D160) | P | P | P | P | P | P | P |
| Home CTA on the first screen, 3 tabs × 2 modes, 10 sizes | P 108/108 | P 108/108 | P 108/108 | P | P | P | P |
| Model list fills, every arrival and timing (D168) | P 0/~540 | P | P | P | P | | |
| Home finder size + season URLs (D169) | P | P | P | P | P | P | |
| Picked size keeps the car (D170, D176) | P = SQL | | | | | | |
| Other sizes fit the car (D171) | P 40 PDPs | | | | | | |
| Search results = SQL, no leak, noindex (D173) | P 33 × 3 | | | | | | |
| Search front end (D177, D178, D180) | F SEARCH-2/3 | P | F SEARCH-2/3 | F SEARCH-2/3 | | P | P |
| Gallery 2–8 photos (D167) | P | P | **F PDP-1 (≥1100, 7–8 photos)** | P | P | **F PDP-1 (iPad Pro landscape)** | P |
| `May also fit` row + `Show more` (D175) | P | P | P | P | P | | |
| Discontinued listed, hidden never (D164) | P (FIT-1 siblings) | | | | | | |
| Sent requests, nothing personal stored (D162) | P | P | P | P | | | P |
| Quote emails, HTML + text (D162) | P 48 renders | | | | | | |
| No names, one number, no dashes (D161, D130) | P 58 pages + RSC | | | | | | |
| axe A/AA, 0 violations | P 85 | | P 12 | | | | |
| Keyboard, focus visible | P 154 stops | | | | | | |
| JS off | P (MODEL-1, COPY-1) | | P (MODEL-1) | P (MODEL-1) | | | |
| Forced colours | F GATE-1, GATE-2 | | | | | | |
| Reduced motion | P | | | | | | |
| Payments and `/pay` unchanged | P (copy only, D161) | | | | | | |

## 3. Findings, verified, ranked

Every row was reproduced by its scope agent and again, independently, by a verifier. Final severity is the
verifier's unless noted. Evidence (scripts, logs, screenshots) is in the session scratchpad, `qa/out/<SCOPE>/`,
and is not committed.

### P1

| ID | Finding | Where | Fix (one line) |
|---|---|---|---|
| **PDP-1** | **In WebKit at 1100 px and wider, a product with 7 or 8 photos blows the gallery up to 1,800–46,000 px and pushes the buy panel off screen.** The scroll-snap track's min-content width feeds the `55fr` column's automatic minimum in `pdp-split`; the gallery column wrapper has `min-width: auto`, so the buy column collapses to 0. 6 photos or fewer, Chromium, Firefox and WebKit below 1100 are fine. Reproduced at 1100, 1280, 1366, 1440, 1920 and on the iPad Pro landscape profile; the size changes from reload to reload. **Latent:** the bulk load has at most 5 photos a product (39,783 with 1), so only staff adding a 7th photo in the admin (which allows 8) triggers it. Playwright WebKit 26.6 shares Safari 26's layout code, so macOS Safari and iPad (any browser) very likely match; not proven on a device. Coordinator kept P1 (the brief: "a feature does not work for some users or devices"); the verifier argued P2 on exposure. | `pdp-gallery.tsx`, `globals.css:840` (`pdp-split`) | `min-w-0` on the gallery column wrapper and `minmax(0,55fr) minmax(0,45fr)` on `pdp-split`; both tested by injection, 30/30 cases fixed |

### P2

| ID | Finding | Where | Fix |
|---|---|---|---|
| **SEARCH-1** | `See all accessories` after a thread search lands on the whole category: `/search?q=12x1.5` says 114 accessories, the link `/accessories?thread=12x1.5` shows 1,726, because the thread filter applies only while a lug nut, lug bolt or wheel lock type is ticked (D137). | `search/queries.ts:370`, `results/search.ts:467-473` | Add the three threaded types to the link when a thread is set and no type is named |
| **SEARCH-2** | The `/search` field keeps the earlier query after Back/Forward and after a second search from the header box (`fuel` shown above `zeta` results). URL and results are right. Chromium and WebKit. The D84 pattern. | `search-form.tsx:31` (`defaultValue`) | `key={query}` on the field |
| **SEARCH-3** | No loader on a slow search submit, from the header box, the 390 panel or the page field: `next/form` prevents the default and `NavProgress` returns on `defaultPrevented`. The comment at `site-search.tsx:16` claims the opposite. A `See all` click under the same delay shows it. | `nav-progress.tsx:257-259` | Start the loader on `next/form` submits (or mark the form) |
| **LAYOUT-1** | `/search` with no matches scrolls sideways for a long unbroken query: at 390, scrollWidth 573 at 60 characters and 937 at 100+. Every width below about 920, all three engines, and production. WCAG 1.4.10. | `search-results.tsx:180` | `wrap-anywhere` on the "Nothing matches" line |
| **MODEL-1** | With JavaScript off, `Add vehicle` on `/tires`, `/wheels` and `/accessories` opens the sheet invisibly: the `<noscript>` `:target` rule shows the dialog, but `:not([open]) .sheet-panel{translate:0 100%}` keeps the panel off screen, and an invisible dialog covers the page until Back. 12/12 and 48/48; production too. **Pre-existing since D159**, not a stream regression. | `vehicle-sheet.tsx:84-88`, `globals.css` ~791 / ~797 | `#vehicle-sheet:target .sheet-panel{translate:0 0}` (tested) |
| **GATE-1** | Forced colours: the home finder's Vehicle \| Size switch shows no selected state. `data-segment` sits on the screen-reader-only `<input>`, so `[data-segment]:has(input:checked)` never matches its label. WCAG 1.4.11 / 1.4.1. | `vehicle-finder.tsx:224`, `globals.css:1792` | Move `data-segment` to the label |
| **HOMEFIND-4** | At 320 the wheel size selects are 69 px of text: the empty Bolt pattern placeholder reads `Bolt patte` for every Wheels/Size visitor, and `10x285.75` loses a digit. Fine from 360. Raised from P3 by the verifier. | home finder wheels Size row | One column of wheel selects below 360, or shorter placeholders |
| **CART-2** *(owner decision)* | A quote sent within 3 s of opening the dialog (autofill plus Enter) shows "Quote request sent", is recorded in `pw-quotes-sent` and empties the cart, but nothing is emailed: the 3 s timer treats it as a bot. New since D162: the false "sent" now survives a reload. Already "waiting on owner" in D147/D123(7). | `cart/actions.ts` | Shorten the timer, or answer a too-fast send with a soft retry instead of success |

### P3 — defects

| ID | Finding | Where |
|---|---|---|
| FIT-1 = PDP-2 | `Other sizes` and `Similar products` never list a discontinued sibling (they read `status = 'published'`); the discontinued page lists its published sibling but not the reverse. Parked by D164 for stream C and still open. Fix: `listedStatus()` in two places. | `catalog/queries.ts:1837`, `:2142` |
| FIT-2 | D170's "tires R18 458" is a transposition: 548 on the full copy, 549 on production, 548 by independent SQL. | root `llm.md` D170 |
| SEARCH-4 | `245/35R19 winter` searches tires only, but the "read as" line still mentions 19-inch wheels. | `search-results.tsx` `readAs` |
| SEARCH-5 | Two unnamed `role="search"` landmarks on `/search` from 720 (axe `landmark-unique`, best practice, not A/AA). | header + page form |
| SEARCH-6 | The panel and page `Search` submits show the arrow cursor (D177: "every search control shows the pointer"); so does every `Button` (`Add to cart`, `Menu`). | `Button` primitive |
| SEARCH-8 | After a header-box search from another page, focus lands on `<body>` (not a 2.4.3 failure). | `site-search.tsx` |
| LAYOUT-2 | The vehicle label in the vehicle button is cut with an ellipsis: "2020 TOYOTA C…" in the rail from 1100; even "2021 Honda Civic" at 320. The accessible name is whole. | `vehicle-panel.tsx:112` |
| HOMEFIND-2 | Back from a wheels search returns to Tires with the Size radio still on and empty fields (browser form restoration, not bfcache). | home finder |
| HOMEFIND-5 | An empty submit carries empty keys (`/tires?width=&profile=&rim=&season=`); the page is identical to the bare route. Polish. | home finder |
| GATE-2 | Forced colours: the current gallery thumbnail looks like the others. `aria-current` and the counter remain, so 1.4.1 is met. | `pdp-gallery-carousel.tsx:229-236` |
| CART-1 | `/privacy` still says the form asks for "your preferred way to be contacted", gone since D160(2). Local and production. | `privacy/page.tsx:80` |
| CART-3 | A hand-edited `pw-quotes-sent` entry with a 290-character unbroken word makes `/cart` scroll sideways; the longest real token in the catalogue is 27 characters. | `/cart` sent list |
| CART-5 | The plain-text owner alert does not collapse newlines in name, email and phone, so a crafted post can add lines such as `Consented: YES` before the real consent block. The HTML part and subject are safe; not reachable from the form UI. | `cart/quote-email*.ts` |
| COPY-1 | An unknown `/pay/<token>` 404 is an empty shell without JavaScript (0 characters of body text), on the fixture and on `pay.platinumwheels.ca`. Pre-existing (D151); the D157 class of bug, fixed then for `/products/*` only. | `src/app/pay/not-found.tsx` |
| COPY-7 | `src/lib/llm.md` Open #3 is headed "Closed by D161" but still names both people and the old second number; parked `home.spec.ts:24`, `product.spec.ts:65` still allow it. | docs, parked tests |
| PDP-3 | The upload limit is 50 MiB but labelled MB: 1 byte over reads "50.0 MB is over the 50 MB limit"; 52.4 MB files pass. A 0-byte file passes the browser check. | `admin/product-types.ts` |
| PDP-5 | `design/DEVIATIONS.md` #132's "Shipped" cell still describes the removed `<details>` (D175 replaced it). | `DEVIATIONS.md:189` |
| GATE-3, GATE-4 | Two gate specs fail on phone projects only because they target a header control hidden there (`finder-fit.spec.ts:22`, `search.spec.ts` `getByLabel` strict mode). The product works; test fixes. | `tests/e2e/` |

### P3 — not verified (seen, not reproduced)

| ID | Note |
|---|---|
| MODEL-2 | Once in ~2,100 Chromium runs (6x throttle, two browsers sharing an overloaded machine), Model showed every make's models for the year after a pre-hydration pick. 0 in ~810 targeted re-runs; no race found in the code. A mismatched make/model resolves to no car (D79, D91b), so nothing wrong is shown. Suggested hardening: drop the `!primed` guard in `bind-finder.ts:197-199` and re-run `sync()` on mount, `load` and `pageshow`. |
| MODEL-3 | Once, a Firefox type-ahead on Make ended on Honda instead of Chevrolet; 0 in 158 re-runs. |
| GATE-5 | The first database requests after a fresh `next start` returned 500 four times while the laptop's load average was 36–43 (5 s pool connect, D151). Not reproducible at normal load; Neon unmeasured (D157 parked P2). |

### Owner decisions (none blocks launch)

| ID | Question |
|---|---|
| CART-2 | See P2 above. |
| CART-4 | `Sent <time>` is Brampton time with no zone shown; a visitor in Vancouver reads it as local. Add "ET"? |
| COPY-3 | At 32 px the tab icon's name plate does not read (D163 says it does); 16 px is a dark disc, 48 px is clear. Keep, or simplify the small frames? |
| FIT-3 | A car with no fit data in a category still reads "Showing what fits your <car>" over the unfiltered list (22 model-years on wheels, some tires). Different wording? |
| SEARCH-7 | A search started from a results page drops the searched vehicle (D158 keeps it only for category links). Keep it? |
| HOMEFIND-3 | Season is not narrowed by the chosen size, so some pairs give 0 matches (315/70R22 + winter). D132 narrows by size parts only; recommendation: leave it. |
| PDP-4 | Back from a product to the list morphs only when photo 1 is showing; from photo 2 or 3 it crossfades. Fine? |
| LAYOUT-3 | On a sideways phone the pinned header, tabs and vehicle/Filters rows take 49–59% of the screen (focus is never hidden). D159 pins them at every phone size; unpin in landscape? |
| PR60-1 | The About grid's widest logos are 5–9 px tall since D183 (§6.1). Keep, or give wide marks a floor? |

### Accepted (an owner ruling chose it)

CART cap works as ruled (D147: 4th send in 10 minutes refused, form kept) and the 20-request record cap
(D162) · COPY-2 placeholders `(905) 000-0000` / `647-000-0000` are filler, not the shop's number (D161) ·
COPY-5 the old goodwill site's pages still list names (D161: emails only) · COPY-6 invisible no-break
characters in the displayed number (D76, D93b WDG-15) · FIT-4 hand-typed `?similar=7` shows 7, bad values
fall back to 3 · HOMEFIND-1 with JS off a home submit carries both vehicle and size, and the results page
handles it (D169, D170) · HOMEFIND-6 landscape phones exempt from the fold rule (D128) · SEARCH-9 search
behaviours set by D173(2), D174(1)(2), D178 · MODEL-4 after a client navigation Model is empty for
0.1–0.5 s before it binds (always recovers) · the ticker moves under reduced motion (D159(3)).

### Rejected on verification

COPY-4 (the auto-reply phone already uses no-break spaces) · GATE-6 (`aria-controls` resolves; the dialog
is in the DOM).

### The quote-cap question (cleared)

Locally a rotating `x-forwarded-for` header gets past the D147 per-IP cap (`clientIpFrom()` in
`src/lib/rate-limit.ts` takes `x-real-ip`, else the first `x-forwarded-for`). On Vercel the platform
overwrites `X-Forwarded-For` "to prevent IP spoofing" (vercel.com/docs/headers/request-headers), so a
production visitor cannot. **Residual risk:** if the storefront apex is ever proxied (Cloudflare orange
cloud), every visitor behind one edge shares one cap; D96 already forbids proxying Vercel records. Worth a
line in the cut-over checklist (`todo.md` item 14).

## 4. Checked and cleared

- **No personal names or second number** in the HTML or RSC payload of 34 fixture and 24 production pages,
  98 client-rendered states, the JSON-LD (one contact point, no name, GTA `areaServed`), both quote emails
  and the old site's auto-reply. Every `tel:` is `+14378825000`, every address `sales@platinumwheels.ca`.
- **No em or en dash** in any visible string: AST scan of `src`, rendered text, alt/title/aria/placeholder,
  meta, both emails, 58 pages' HTML and RSC, and PR #59's new copy.
- **Tab icon** files on production are byte-identical to the repo (ICO 16/32/48, 192, 180).
- **Sent requests (D162):** survive reload and a new browser context with the same storage; new sends kept,
  newest first; 22 sends keep 20; Clear works; **nothing personal** in localStorage, sessionStorage,
  cookies or IndexedDB; 17 corrupt entries still render `/cart`; stored HTML is inert.
- **Quote emails:** one dark 600 px table, `table-layout:fixed`, inline styles, `bgcolor` cells, no
  `<style>`, gradients or images; hostile input escaped; CASL record and reply-to present; plain-text part
  complete; auto-reply echoes nothing typed; 0 overflow in 48 renders at 600 and 375, light and dark.
- **Quote dialog** fits 390×844, 375×667, 667×375, 320×568, iPhone landscape; Send on screen; errors
  announced with focus on the first field; Preferred contact gone.
- **Fitment:** `N matches · M similar` equals independent SQL in 944 checks over 38 cars (common, two bolt
  patterns, no data, 2005 to 2027); D170 diameter steps keep bolt pattern, bore, width and offset; D170's
  Civic wheel numbers reproduce; D171 Other sizes only fitting sizes on 40 product pages; D158 links keep
  only year/make/model; unknown and mismatched cars are treated as no car.
- **`May also fit` (D175):** 3, 12, 36 … 150 window, same order, best and similar grow separately, landing
  and focus on Chromium, Firefox, WebKit, iPhone, Pixel, and with JS off; resets on filter, Clear all and
  Remove vehicle. **D176:** the sheet keeps the picked size; counts equal SQL and production.
- **Model list (D168):** 3,239 runs on six profiles across home, the three sheets, sheets with a car and
  with a size; full load, client navigation, Back/Forward, reload, pre-hydration picks, 4x and 6x CPU,
  fast changes, Make before Year, keyboard; production 28 client-navigation checks. One unreproduced miss
  (MODEL-2).
- **Home finder (D169):** all 56 field subsets submit the right route and exactly the chosen params on six
  profiles; no cross-mode leak with JS on; size lists equal SQL in 723 checks; JS-off radios work; CTA on
  the first screen at all ten sizes in all five states on three engines; tab switch keeps the page and is
  announced; `?finder=` preselects.
- **Search (D173):** 80 parser strings with no 500 and no reflected HTML; SQL strings harmless; results
  equal SQL for 33 queries; 37 `See all` links answer 200; hidden products returned 0 times in 360
  requests; no price, vendor SKU, vendor name or vendor price in HTML or RSC (fixture, full copy, 30
  production pages); 14 vendor SKUs find nothing; trigram index used; `noindex` and out of the sitemap;
  header box and icon geometry at eight widths; 4 cards from 720, 3 below.
- **Search speed:** full copy, 30 queries × 3: TTFB p50 63–65 ms, p95 322–454 ms (load average ~9).
  Production, 30 single requests: p50 566 ms, p95 876 ms, max 1,879 ms (first, cold).
- **Gallery (D167):** 0 and 1 photo unchanged; 44 px arrows wrap; counter; keys, thumbnails from 1100,
  trackpad and swipe; order equals `sort_order` and follows the admin's `Make main` / `Earlier` / `Later`;
  CLS 0 on hydration; JS-off track scrolls; the morph name is unique and lands on the first slide.
- **50 MB photos (D166), partial stub:** browser checks and messages at 49/50/51 MB and a wrong type; with
  R2 absent the admin says "Photo uploads are not set up on this deployment."; `makePhotoSizes` on a
  48 MiB JPEG ~0.8–1 s at ~190 MB and a 225 MP PNG at ~350 MB; 251 MP and non-images refused.
- **Discontinued (D164):** listed, searched and counted like any product, no unavailable mark; the hidden
  one never listed and its product page a 404 with JS off too.
- **Layout:** header at 720–1099 fits logo, search box, call, cart and menu; D181 caption inside the photo;
  About 24-logo grid in its cells; product pages, cart with 20 long sent requests, privacy, terms, 404 and
  the admin pages with no overflow; production matched the fixture on every page sampled.
- **Gate:** pass 1 155 passed, 2 flaky (both from a browser killed mid-run, green on retry), 0 failed;
  pass 2 (indexing on) 32 passed; cross-browser 340 passed.
- **Accessibility:** axe 0 violations on 97 scans; 43 keyboard steps, 154 focus stops, each with a visible
  indicator; five pages usable with JS off; nothing animates over 20 ms under reduced motion.
- **Payments:** no change in `src/features/payments`, `src/proxy.ts` or `next.config.ts`; `src/app/pay`
  changed only by D161's "Call us at"; `pay-states.spec.ts` 13/13.

## 5. Not verified

- **A real iPhone, iPad or Mac Safari.** The WebKit projects stand in; the iOS select picker (D159(4),
  D160(6)) and true bfcache cannot be driven here. PDP-1 should be confirmed on a real iPad or Mac Safari.
- **Real mail clients** (Gmail, Outlook, Apple Mail, their dark modes) and a real Resend send: email is off.
- **The R2 upload round trip** for 50 MB files (owner: partial stub).
- **Neon and Vercel timings** beyond 30 production GETs; Firefox and WebKit forced colours.
- **Prices on:** no priced rows exist locally, so price nulling with the switch on was read in code only.
- **PR #60 (D183)**, which merged after the run: not built here; see §6.

## 6. After the run

- PR #60 (D183, About brand grid 4 / 6 / 8 across, smaller logos) merged on 2026-10-12 after the build
  under test. It touches only the About grid and its CSS; checked on production read-only in §6.1.
- Free IDs for any fix: **D184** onward, `DEVIATIONS.md` **#144** onward.

### 6.1 PR #60 spot check

Production `/about`, read-only, Chromium, 2026-10-13, at 320, 390, 720, 1100 and 1440: no horizontal
scroll; the grid is 4, 4, 6, 8 and 8 across as D183 says (24 brands, every row full); no visible logo or
wordmark leaves its cell (the brand names' 1 px `sr-only` text sits just outside, by design).

| ID | Finding | Kind |
|---|---|---|
| PR60-1 | The widest logos are now 5–9 px tall: at 1100 Nitto 5.3, Michelin 6.1, Toyo Tires 6.5, Black Rhino 6.6, Braelin 7.5, Bridgestone 7.6, Niche 8.4, Yokohama 8.7 (each capped by its 61 px cell); at 320 the smallest is 5.4 px. Black Rhino reads as a faint line. D182 had dropped 6 across because "wide marks fell to 10px tall"; D183 now goes to 8 across. Evidence `qa/out/PR60/about-1100-prod.jpg`. | P3 owner decision: keep, or raise the floor for wide marks (fewer across, or a min height) |

## 7. Needs you

1. **Approve fixes**, item by item. Recommended now: PDP-1 (P1, two CSS lines), SEARCH-1, SEARCH-2,
   SEARCH-3, LAYOUT-1, MODEL-1, GATE-1, HOMEFIND-4, FIT-1 and the small P3 copy and doc fixes.
2. **Decide CART-2** (a too-fast quote shows "sent" and is not emailed).
3. **The nine owner questions** in §3 (none blocks launch).
4. **Check PDP-1 on a real iPad or Mac Safari** once fixed, and the iOS Model picker on your iPhone.
