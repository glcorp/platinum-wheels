# Final check before the client hand-over: the 10-minute brief

This is the prompt a coordinator session runs as the last check before the site is shown to the client.
It is not the pre-launch audit (`launch-audit-brief.md`, D145, ~50 agents, hours): it is a **timed sweep**
that proves every flow and every page still works, in every environment the site has, on the build that
will be handed over. It is written to be run again before every hand-over: update **§2** and run it.

Owner brief, 2026-10-06: *"a comprehensive testing prompt which would do a final check of things before
providing it to the client. It should be testing the functionalities and UI. In all environments, all edge
cases and everything. And it needs to be done in 15 minutes. You are allowed to use as many agents as
possible."* Then, mid-session: *"change to finish in 10 min"*. Then chose: production plus the fixture stack; production writes limited to one cart send and
an owner-signed admin session; the build under check is the current branch.

**Paste §0 to §7 into a fresh coordinator session as its first message.** The coordinator reads root
`llm.md` first (rule §1.1), then follows this file to the letter.

---

## 0. The clock

**10 minutes of wall clock from the moment the coordinator launches the first agent.** Nothing in §1
starts the clock; everything in §1 is done before it. The schedule:

| Window | Who | What |
|---|---|---|
| T−20 to T0 | owner + coordinator | §1 set-up. Not on the clock. |
| T0 to T+6 | all §5 scopes at once | Each scope has **6 minutes**, hard. At T+6 an agent that has not returned writes what it has to its evidence file and returns a partial, marked `partial`. |
| T+6 to T+8 | 4 verifiers | Every P0 and P1 is re-checked by a different agent with fresh evidence (§6). |
| T+8 to T+10 | coordinator | The report (§7). |

A scope that needs more than 6 minutes is too big: split it, do not extend it. The coordinator never
waits on a late agent past its window.

**Agent count.** One Sonnet agent per scope in §5 (26 scopes), plus 4 verifiers: **30 agents**. Launch
every scope in **one message** so they start together. Scopes marked **[B]** open one headless browser;
scopes marked **[N]** use `curl`, `node` and SQL only and never open a browser. This Mac has 8 CPUs and
8 GB of memory: at most **14 [B] scopes run at once**; if the launcher must choose, the [N] scopes go
first in the same message and the [B] scopes are split into two waves of 3 minutes each, and every [B] scope then does its 1440 pass first and its 390 pass only if time remains. Each [B]
agent launches **one** browser, uses it for everything, and closes it before returning.

## 1. Set-up, before the clock (owner + coordinator)

1. **Freeze the build.** The branch under check is `<BRANCH>` at `<SHA>` (§2). Working tree clean
   (`git status` prints nothing but untracked scratch files). Record the SHA in the report.
2. **Gates that take minutes run now, not on the clock.** The coordinator runs, in the main checkout:
   `npm run check` (types and lint) and `npm run test:e2e:fixture` (the seven-spec gate against a fresh
   fixture, both indexing states). Save the output to `<CHECK>/pre/check.log` and `<CHECK>/pre/fixture.log`.
   A red gate here is the first finding of the report; the sweep still runs.
3. **Bring the fixture stack up and leave it up:** `npm run test:e2e:fixture:up`. It prints the app
   URL, the admin URL and the admin username; the password is in `tests/fixture/.run/state.json`. Scopes
   use the ports in §2. Confirm `curl -s -o /dev/null -w '%{http_code}' http://localhost:3500/tires` is
   `200` and the admin login answers `200` with `Host: admin.localhost:3500`.
4. **Serve the artboard baseline:** `npm run design` (port 4000), for the PARITY scope.
5. **Owner signs in to the production admin** at `https://admin.platinumwheels.ca/login` in the
   desktop app's built-in browser pane, and tells the coordinator *"signed in"*. The ADMIN-PROD scope
   drives that pane and that pane only. The owner does not type the password anywhere an agent can read it.
6. **Owner names the production test product**: one published tire whose description the ADMIN-PROD
   scope may edit and restore (§3 rule 9). Record its slug in §2.
7. **The coordinator creates `<CHECK>`** (§2) with `out/` and `pre/` inside it, and writes `env.md`
   there: this §2 table filled in. Every agent reads `<CHECK>/env.md` first.

## 2. Environment (fill in before each run)

`<CHECK>` = `<the session scratchpad>/final-check`

| What | Where | Notes |
|---|---|---|
| Build under check | `<BRANCH>` at `<SHA>` in the main checkout `/Users/raghavvirmani/platinum-wheels` | First run, 2026-10-06: `fitment-auto-country`. **Production runs `main`**, which does not yet carry this branch's fitment data (D155, D156). A vehicle's Best/Similar counts therefore differ between local and production; a finder *behaviour* that differs is a finding, a *count* that differs is not. |
| Local app (fixture) | `http://localhost:3500` | Production build of `<SHA>` on a throwaway Postgres (`:55600`) holding **126 products** (`tests/fixture/catalogue.csv`): 51 tires, 44 wheels, 31 accessories; stand-in photos on about half the tires and wheels served from `:3590`; three discontinued, one hidden; four payment links. Named slugs in `tests/fixture/slugs.json`. Quote email **off**, `QA_ERROR_ROUTE=1`, prices off, indexing off, no Converge (closed port), no R2. **All writes go here.** |
| Local admin | `http://admin.localhost:3500/login` | Send `Host: admin.localhost:3500` or open the URL (D115). Username from the `:up` output; password in `tests/fixture/.run/state.json`. Never copy it into a report. |
| Artboard baseline | `http://localhost:4000/home-desktop` etc. | `design/assets/*.html`, as `design/reports/README.md` describes. |
| Production storefront | `https://platinum-wheels-one.vercel.app` | The apex `platinumwheels.ca` still serves the goodwill site (D96). Full catalogue (≈39,960 products), photos on `photos.platinumwheels.ca`, prices off, indexing off, quote email **off**. |
| Production admin | `https://admin.platinumwheels.ca` | Outside checks for every scope but ADMIN-PROD; ADMIN-PROD uses the owner's signed-in pane. |
| Production pay | `https://pay.platinumwheels.ca` | Outside checks only. Converge is on its **demo** account (D121). Every demo link is cancelled (D146). |
| Production test product | `<slug named by the owner in §1.6>` | The one product ADMIN-PROD may edit. |
| Catalogue source | `/Users/raghavvirmani/Platinum Wheels Vendor Data/combined/share/output/catalogue.csv` | What production was loaded from (D135), with D142's columns. |
| Fit data | `scripts/data/vehicle-fitment-autocountry.csv`, `vehicle-fitment.csv`, `vehicle-fitment-generations.csv`, `vehicle-fitment-vendors.csv`, `vehicles.csv` | The finder's sources on this branch (D155). `design/reports/fitment-coverage.md` is the measured coverage. |
| Browsers | Playwright's Chromium, Firefox and WebKit (`npx playwright`); Chrome at `/Applications` for Lighthouse | No real Safari or iOS Simulator (needs full Xcode). The desktop app's built-in browser pane is the owner's and belongs to ADMIN-PROD. |
| Vercel | Vercel MCP tools, team `platninumwheels`, project `platinum-wheels` | Read only: deployments, runtime errors and logs, domains, env var **names**. |

## 3. Rules every agent follows

1. **Report, don't fix.** Change nothing in the repo. The coordinator fixes after the owner approves.
2. **Read before judging.** Root `llm.md` §5 is the decision register. A thing an owner ruling chose is
   `accepted`, cited by decision ID, not a defect, unless its premise is false today. Common ones: prices
   hidden (D122, D124), `Add to cart` adds one (D127), no failed-login limit (D95), sort is JS-only (D57),
   no ticker pause control (D139), the demo double-charge risk (D108), `Winter sets, in stock now.` and the
   two starting prices are the owner's word (D153), a loose fit is the commitment (D155), spacers and lift
   sizes are not matched (D156), hidden Apply on the rail is `<noscript>` only (D83), prefetch on every
   card (D92b, D153), vendor names never on the storefront (D125).
3. **Evidence or it isn't a finding.** A URL plus steps, a command and its output, a `file:line`, or a
   measured number. Hit-test clicks and run the flow; markup inspection proved nothing twice (D86, D91b).
4. **Production is read-only except where §3.9 says otherwise.** GET only, from outside: `curl`,
   headless Playwright, `dig`, `openssl`. **1 request a second and 150 requests per agent** on
   production. Sample the catalogue, never crawl it.
5. **Never:** load-test or flood anything; send an email other than the one cart send in §3.9; call
   Converge, open a Converge hosted page or guess a PIN (five wrong PINs block the IP, D107); read or
   print a secret; decrypt a Vercel env var; use the production `DATABASE_URL`; brute-force the admin;
   press Cancel on any production payment link; create a production payment link; bulk-change
   production products; upload a production photo; run `--link` or `--upload` of any loader.
6. **Local writes go to `:3500` only.** Its database is throwaway and is rebuilt by the next `:up`.
7. **One browser per [B] agent**, closed on return. Firefox and WebKit only where the scope names them.
   Never run the full Playwright suite in parallel mode during the window.
8. **Write evidence** to `<CHECK>/out/<scope-id>.md` (screenshots and scripts under
   `<CHECK>/out/<scope-id>/`) as you go, not at the end, so a partial at T+6 still has it. Return only
   the structured findings and the cleared list.
9. **The two production writes, and who may make them.** (a) **CART-PROD** may send **one** quote from
   the production cart, once, with name `QA final check (ignore)`, a phone of `+1 (000) 000-0000`, an email
   of the owner's choosing recorded in `env.md`, and a message naming the date. Quote email is off in
   Vercel, so nothing mails; the server logs `quote.email.disabled` and the success panel shows. No second
   send. (b) **ADMIN-PROD** drives the owner's signed-in pane and may, on the production test product
   only, change the description by appending ` [QA 2026-10-06]`, save, read it back on the storefront,
   then remove the suffix and save again. It presses no other write control. Everything else on production
   admin is looking.
10. **Time.** Check the clock at T+4. If you will not finish, stop widening, write what you have, and
    mark the report `partial` with what was not reached. A partial with evidence beats a complete guess.

## 4. Severity and finding format

| Level | Meaning |
|---|---|
| **P0** | Blocks the hand-over: a core flow broken for most visitors, wrong data on most products, a security hole, a payment or money error, a page that errors or is blank. |
| **P1** | Fix before the client sees it: a flow broken for one browser, width, category or state; wrong data on many products; a WCAG A/AA failure on a core flow; a visible layout break on a common phone or laptop width. |
| **P2** | Fix soon after: edge-case bugs, visible blemishes on a minority of products or states. |
| **P3** | Polish. |

Every finding: `title`; `severity`; `scope`; `kind` (`defect`, `accepted`, `owner-decision`,
`not-built`); `env` (`production`, `local`, `code`, `both`); `where` (URL, `file:line`, SQL or host);
`evidence` (steps, what you saw, numbers, the evidence file path); `expected` and why (decision ID,
artboard, WCAG, the vendor's site); `fix` (one or two lines, how not code); `confidence`.

Also return a **`cleared` list**: one line per thing checked and found correct. A report with only
problems cannot be told from one that did not look.

## 5. Scopes (26, all launched at T0)

Every scope covers **every environment it can reach**: local `:3500` and production, and where it
applies phone (390×844), tablet (768×1024) and desktop (1440×900) widths. "Both" below means local and
production. Where a count is involved, local counts come from the 126-product fixture and production
counts from the full catalogue; both must be **internally consistent** (the page's number equals what the
page shows), never equal to each other.

### Storefront

- **HOME [B], both, three widths.** Hero and the two starting-price tags (D134, exact wording, link to
  `/tires` and `/wheels`); the finder: Year then Make then Model narrowing (D70), the CTA above the fold at
  390×844, 375×667, 768×1024, 1024×768, 1440×900 (D128), a submit with nothing chosen lands on the
  unfiltered `/tires`; header `Tires` / `Wheels` / `Accessories` on `/` switch the finder in place and
  the CTA reads `Find my wheels`, a cmd-click still navigates (D128); category tiles hit-test and lead to
  the right route; the featured scroller's arrows move it on desktop and the dots light on mobile
  (D74); the brand ticker moves, pauses on hover, shows one static row under reduced motion (D129,
  D139); `How it works` four steps; the winter promo link; the contact cards' two numbers in the same
  format with `+1` (D139) and the computed year in the footer (D32); `#contact` and `#how-it-works`
  from the header **twice in a row** after scrolling up (D131); no console errors; no horizontal overflow.
- **FINDER-FIT [B], local first, then production spot checks.** On local with the branch's data:
  `2021 Jeep Wrangler` → `/wheels` shows a `5x127` Best set and the chip reads the car; `2015 Toyota
  Tacoma` → two bolt patterns, both shown, with the one-line "check your trim" note (D155, D156(9));
  `2021 Honda Civic` → `/tires` Best are factory sizes and Similar are in the stock range; a car with no
  data filters nothing and shows no pattern; TPMS sensors sit in Similar on a pre-2008 car with no TPMS
  trim (D156(3)); `Mazda3` and `Model 3` appear under those names (D156(8)); an old model name in the URL
  308-redirects to the new one (`finder/canonical.ts`); a `year`+`make` with no `model` reopens
  `Change vehicle` with Model focused (D151); `?make=Toyota&model=Civic` shows no chip and no invented
  vehicle (D91b); the chip's text is never taken from the URL. On production (`main`): the same URLs
  answer 200 with a chip or none, no 500, no blank page; counts are not compared.
- **TIRES [B], both, 390 and 1440.** Width → Profile → Rim narrow each other (D132) and a value already
  in the URL stays listed; Season chips including all-weather; Brand: top eight, `Show all brands`,
  `?brands=all` survives a filter change (D132); Load index minimum (D137); `Filters (n)` counts every
  active group; the count line `N matches · M similar` is a live region and reads `0 matches` on an empty
  set with the one-line empty state (D73, D140); `Load more` adds cards, lands on and focuses the first new
  card, URL carries `#result-N` (D133); sort offers only `Best match` with prices off (D122); the
  mobile sheet opens, scrolls inside itself, `Apply` closes it, Esc closes it; `Change vehicle` keeps the
  other filters (D93b); hostile strings (`?width=999999`, `?brand=<script>`, `?min=-1&max=abc`,
  `?show=1e9`, a 5 KB query) answer 200 with sane output and never `$Infinity` or a 500; the price
  slider and price sorts are absent (D122, D124); no vendor name or `vendor_price` in the page source.
- **WHEELS [B], both, 390 and 1440.** Diameter → Width → Bolt pattern narrowing; Offset range with
  the 24 px inputs and 16 px handles (D151), Finish families, Centre bore exact (D137); a hand-typed
  `5X114.3` and `17.0` normalise; an undrilled wheel reads `Bolt pattern: Undrilled, drilled to order`
  (D153) and is in no pattern filter; the card size line reads `20×9.5 · 5×130 · ET+25 · Finish` (D136);
  look-alike siblings carry their telling fact on the card (D153); `Other sizes` on a wheel PDP keeps the
  bolt pattern, nearest size and offset first (D137); a wheel with two bolt patterns lists under both.
- **ACCESSORIES [B], both, 390 and 1440.** Type filter with the 15 types; Thread size shown and applied
  only while Lug Nuts, Lug Bolts or Wheel Locks are ticked (D137); no size group; an unbranded
  accessory's no-photo tile prints its type (D133) and its slug is brand + name + part number (D135);
  `Part number` as a spec row (D142); a vehicle narrows lug nuts and bolts by thread and by nut or bolt
  and hub rings by bore (D155), spacers stay Best (D156); `Pack quantity` hidden at 1 (D136).
- **PDP [B], both, 390 and 1440, one product per category plus the three discontinued fixture slugs.**
  Spec table derived, not typed: 3PMSF only when true (D136), M+S badge from the column (D142),
  description under the table, `W/` reads `with`, brand never printed twice, offset `+25 mm`, load
  `1,808 lb`, long values stack (D136); `How many?` opens on `1` (D127), `2`/`4`/`Custom` are URL links,
  `Custom` shows the field, an invalid custom (`abc`, `1e1`, `+5`, `0`, `100`) is refused; the breadcrumb
  carries every inbound param except `qty`; `Other sizes` then `Similar products` (12, same category);
  the discontinued state (dimmed photo, `Currently unavailable`, `Add to cart` still works, D122); the
  hidden slug and an unknown slug are a real 404 with **one** robots meta (D151); h1 steps down at 40 and
  36 characters; below 720 the gallery is capped so `Add to cart` ends on the first screen at 390×844
  and 375×812 (D153); the gallery underlay disappears once the sharp file loads (D144); a direct PDP
  visit has no console errors.
- **CART-LOCAL [B], local, 390 and 1440.** Add from a card and from the PDP: `Added ✓`, the header count
  pops and is **units**; a second press adds one more (D127); the `View cart` prompt is clickable over the
  cards on all three category pages (D148); `/cart` lines with photo, size line, vehicle, stepper with
  floor 1, `Remove`; a discontinued product stays and is marked; a slug the fixture does not have is
  removed with a note; on `/cart` the header cart is a non-link reading `Cart, N items, current page`;
  tampered `localStorage` (a string, 300 lines, qty 10,000, a negative, an object missing fields) never
  errors and is clamped; the quote dialog: empty send refused with `role="alert"` and focus on the first
  bad field, consent restored on error (D93b), an invisible character and a 2,000-character message are
  capped, a send within 3 s is treated as spam and shows success (D104, D123(7): record it as `accepted`),
  a real send after 3 s shows success and **empties the cart**, `beforeunload` guards a dirty form and not
  a `tel:` link; **the cap**: sends 4 and 5 within ten minutes show the call-us line (D147); server log shows
  `quote.email.disabled` for each. The dialog on a sideways phone (844×390) keeps its title in view and the
  submit row sticky (D141, D151).
- **CART-PROD [B], production, 390 and 1440.** The same add, count, prompt, stepper and remove checks on
  the full catalogue, with real photos, including an accessory with no brand. **Exactly one send** under
  §3.9(a); confirm the success panel and the empty cart; then the owner reads the Vercel runtime log for
  `quote.email.disabled` in OPS. No second send.
- **PROSE [B], both, 390 and 1440.** `/about`, `/privacy`, `/terms`, the 404 (`/no-such-page`, with lede
  and the `Shop tires` + call pair), `/qa-error` (local: a 500 with the branded boundary and `Try again`;
  production: a 404), `global-error` by inspection only; the legal name `Platinum Wheels and Tire
  Solutions Inc.` (D153); no page marks `Tires` current (D93b); heading order one `h1` then `h2`s; the
  privacy page's local-storage sentence matches the cart (D122); no em dash or en dash in any rendered
  text on any route (run a DOM text scan on every route at one width); hours `Every day, 9 am to 8 pm`;
  both phone numbers E.164 in `tel:` and no-break in display.
- **MOTION [B], local Chromium with 4× CPU throttle, 390 and 1440.** Frame-sample: card → PDP photo
  morph with a photo and with a no-photo tile, and back via the crumb (D92b, D144: no fade to empty, no
  double tyre, no brand labels crossing); route slides on `nav-forward`/`nav-back` links; results stagger
  on a filter change, capped at 150 ms; the below-fold reveal once on `/`; image fade-in on lazy photos;
  the filter sheet in 280 ms and out 150 ms; the drawer fade; the `Change vehicle` disclosure fade both
  ways; the loader tyre appears only after 150 ms and clears on arrival (inject a 1.2 s delay with
  throttling) and never on a fast hop; **reduced motion kills all of it including `::backdrop` and the
  view-transition pseudo-elements**; no layout shift at rest (CLS 0 on `/tires`). Name the root cause of
  any jank.
- **ENGINES [B], local, Firefox then WebKit, 390 and 1440.** The core flow: `/` → finder → `/tires` →
  filter → PDP → `Add to cart` → `/cart` → quote dialog → refused empty send → close. Then `/wheels` with
  the offset range, the brand fold, the mobile sheet, the drawer, the ticker, `Load more`, `#contact`. The
  morph and slides must degrade to an instant change, never to a blank or a stuck overlay; WebKit's dialog
  must not overshoot (D151); the `:active` press state fires on WebKit (the D92b bootstrap).
- **NOJS [B], local, Chromium with JavaScript off, 390 and 1440.** Every route renders fully (D91b: no
  skeleton, no hidden tree); the finder submits as a GET and the results page honours it; the rail's
  `<noscript>` `Apply filters` commits brand, chips, size and the price-less rail (D83); `Load more` is a
  link landing on `#result-N` (D133); PDP quantity cells are links and `Custom` works through the URL
  (D50, D75); `Menu` jumps to the footer nav (D93b); the header `Tires`/`Wheels`/`Accessories` on `/`
  navigate (D128); `/cart` says what it can without JS and does not error; `Change vehicle` opens as a
  `<details>` (D45); the sort select is absent or inert without error (D57, `accepted`).
- **RESPONSIVE [B], both, Chromium.** Every storefront route and state (home, three categories with
  the sheet open, a PDP per category, cart empty and full, the quote dialog and its error state, about,
  privacy, terms, 404) at 320×568, 375×667, 390×844, 430×932, 844×390, 768×1024, 1024×768, 1280×800,
  1440×900, 1920×1080, 2560×1440: `document.scrollingElement.scrollWidth <= innerWidth`, no clipped or
  overlapping text (sample 20 text nodes per page with `getClientRects` against their containers), tap
  targets ≥ 24 px, the finder CTA above the fold at every upright size (D128), the 1344 px frame shared by
  header, footer, hero copy and the PDP rows above 1440 (D141), the phone PDP `Add to cart` on the first
  screen (D153). Screenshots at 390 and 1920 of every route into the evidence folder.
- **PARITY [B], local against `:4000`, 390 and 1440.** `scripts/parity-probe.js` on `/`, `/tires` and
  the fixture tire's PDP against `home-*`, `results-*` and `product-*`, as `design/reports/README.md`
  describes. Every delta outside tolerance is either a `design/DEVIATIONS.md` row (cite the number) or a
  finding. The three rewritten home headings are located by their D140 text and their width is not
  compared (D140).
- **A11Y-AUTO [B], local, 390 and 1440.** `@axe-core/playwright` on every storefront route and state
  listed under RESPONSIVE plus the admin sign-in, home, products list, one edit page and the four `/pay`
  states; heading outline per page; landmarks; every control has a name; `aria-current` on the current
  nav link only; the results count live region present on `/tires` in both the filled and empty state
  (D72); the `Load more` landing focuses a card link (D133).
- **A11Y-MANUAL [B], local, Chromium, 1440 and 390.** Keyboard only, with `page.keyboard`, never a
  scripted focus: Tab from load lands on the skip link and Enter lands in `<main>`; the finder; the rail
  and the sheet (focus trapped, Esc, return focus); the brand fold; `Load more`; a card's two tab stops;
  PDP cells; `Add to cart`; the cart stepper and `Remove`; the quote dialog (trap, Esc, error focus,
  success focus); the drawer (trap, Esc); the header cart. Then: 200% and 400% zoom on `/tires` and the PDP
  without horizontal scroll; text spacing (1.5 line height, 0.12 em letter spacing) without clipping on
  `/`; `forced-colors: active` shows the price-less rail, selected chips, the nav indicator and the
  quantity cell with edges (D91b, D151); contrast of the hero eyebrow, h1 and lede over the photo at 1440
  (≥ 4.5:1 for body, D91b #79) and of the two starting-price tags (D134).
- **IMAGES [B], production, 390 and 1440, plus local for the no-photo tile.** On production: 40 sampled
  products across the three categories (10 tires, 20 wheels, 10 accessories) show a photo whole inside the
  square, never cropped, drawn from `photos.platinumwheels.ca` with the 480 file on cards and the 1000 on the
  PDP, `Cache-Control: immutable`; the vendor's "Image not available" graphic appears nowhere (D150); no
  cap or logo photo shows another brand's mark on the sample (launch audit P2, note it if seen); the
  no-photo tile on a brandless accessory prints the type; the site photos (hero, four tiles, winter
  promo, 19 brand logos, OG card) load, are WebP or SVG, carry `sizes`, and are the right crop at both
  widths; the favicon is the badge; the hero is the LCP element and only the first best-match card is
  `fetchpriority="high"` (D153); `<link rel="preconnect">` to the photo origin is in `<head>`.

### Admin, payments, edge

- **ADMIN-PROD [B], production, the owner's signed-in pane only (§3.9(b)).** Home greeting (one plain
  line for the Brampton time of day, D140) and the two tiles with counts; `Products`: default list
  newest-change first, search by name, brand, model, slug and vendor SKU, each filter (category, status,
  brand, vendor, accessory type, rim size, no photo), `Go to page` and a page past the end; open one
  tire, one wheel, one accessory edit page and check every field renders, `Full name` with its live
  preview, `Part number` on wheels and accessories, `M+S` on tires, the photos block with Make main /
  Earlier / Later / Remove **not pressed**, sources up to 10, the `View on site` link opens the right
  storefront page; **the one allowed edit** on the test product and its restore, the storefront reading
  each state back (D111: the home row may lag, the PDP must not); `Payment links`: the list reads every
  link cancelled or paid with *Payment started, not confirmed* on none; the styleguide; a stray path →
  the admin 404; `/admin` and `/admin/login` → 404 on the admin host; sign-out ends the session (a gated
  page 307s to `/login` after). Widths 390 and 1440 in the pane.
- **ADMIN-LOCAL [B], local `:3500`.** Sign-in: wrong password refused with a line, right one lands on
  home; a POST to every admin Server Action without a session, with a session but no CSRF field, and
  from another origin is refused (read `src/features/admin/*actions*.ts` for the list); `/products/new`:
  category first, the product starts hidden whatever the form posts (D107b), brand restricted to the
  category's brands and a foreign spelling refused (D127b), a part number on a tire refused and a
  `Part number:` extra-spec line refused (D142), a vendor price of 0 refused; edit: Publish / Hide /
  Discontinue on the card and the edit page, each read back on the storefront (`hidden` → 404,
  `discontinued` → unavailable); bulk: ticked rows and "all N matching" only once a filter is set, the
  confirm states the count, an unreadable filter value refuses rather than widens; photo upload answers
  *Photo uploads are not set up on this deployment* (no R2); the admin styleguide renders every state
  inert; 404s; widths 390, 768 and 1440 (stacked cards everywhere, D116; two columns on payment links from
  `md:`, D141).
- **PAY [B], local for the four states, production outside only.** Local: `/pay/<open>` renders the Pay
  island with the amount and description, a 2 KB description wraps (D151), `Pay` with the gateway port
  closed shows the error with focus on the alert and the button `aria-disabled` while pending; `paid`,
  `cancelled`, `expired` and `unknown` tokens each show their state or 404; `/pay/return` with no cookie
  and with a made-up cookie writes nothing and lands on `/pay/done` (D146); `/pay/notify` is 404 without
  its env (D119); every `/pay` response carries no-frame, nosniff, noindex, `no-store`, COOP and
  `Referrer-Policy: strict-origin`; axe on each state. Production: `https://pay.platinumwheels.ca/` and a
  stray path → the pay 404 with phone and email (D151) and the same headers; `/pay/<made-up token>` → 404;
  **never a real token, never Converge.**
- **EDGE [N], production and local.** Host routing per host with `curl -H Host:`: apex-alias
  `platinum-wheels-one.vercel.app` serves the storefront and 404s `/admin/**` and `/pay/**`;
  `admin.platinumwheels.ca` serves only the admin folder prefix-less (D115) and `X-Frame-Options: DENY`,
  `Referrer-Policy: same-origin`; `pay.platinumwheels.ca` serves only `/pay/**`; `www.platinumwheels.ca`
  and the apex still serve the goodwill site (D96); every host sends frame-ancestors none, nosniff, a
  referrer policy and a permissions policy, and `X-Robots-Tag: noindex, nofollow` on every host but the
  apex (D151); a path that fails `decodeURIComponent` (`/%E0%A4%A`) → the branded 404, also under
  `/products/`; `/qa-error` → 404 on production; `/styleguide` carries noindex; TLS valid on all three
  Vercel hosts with expiry > 30 days (`openssl s_client`); DNS: `admin` and `pay` CNAMEs DNS-only to
  Vercel, MX, SPF (one record), DMARC present (`dig`); open-redirect probes on every param that takes a
  path; the client bundle and RSC payloads of `/tires`, a PDP and `/cart` contain no `vendor_price`, no
  vendor name, no `dealer`, no `IMPORT_`, no secret-shaped string; `NEXT_PUBLIC_*` holds only the price
  switch; the quote action rejects a header-injection name (`a\r\nBcc: x`) and a 10 MB body.
- **SEO [N], production and local in both flag states (local is the off state; `pre/fixture.log` holds
  the on-state spec result).** `robots.txt` per host: everything disallowed on every host while the flag is
  off, and `admin.`, `pay.`, `www.` and the vercel.app alias always disallowed; the sitemap index and
  four files are 404 while off; every page `noindex, nofollow` and exactly **one** robots meta including the
  404; canonical is the clean path on `/tires?width=205`, `/products/<slug>?qty=4`, `/?finder=wheels`;
  titles unique across 30 sampled PDPs (D151) and carrying size plus load and speed; JSON-LD validates,
  names an `OnlineStore` in Brampton with city, province and country only, no address, no opening hours,
  no price, offer, rating or review (D112); the OG card renders for the site and a product with its photo;
  `<html lang="en">`.
- **DATA-SPOT [N], production against `catalogue.csv`.** Category totals on `/tires`, `/wheels`,
  `/accessories` against the CSV's published rows minus what D152 and D150 changed (state the arithmetic);
  season counts on `/tires` against the CSV; 30 sampled product pages (10 per category, chosen by a seeded
  random from the CSV) compared field by field: name, brand once, size line, season, 3PMSF only when true,
  M+S, part number, finish, offset, bore, description with no vendor or price words (D135 M9, D152 M10), no
  em dash; `W/` nowhere; undrilled wheels read as D153; two products that share a title nowhere in the sample
  (D151); 10 slugs from the CSV answer 200 and 2 made-up slugs 404; the finder's `vehicles.csv` has no
  duplicate model-year and every excluded row (`vehicle-exclusions.csv`) is absent from the branch's list.
- **PERF [B], production, Chrome at `/Applications`.** Lighthouse phone and desktop on `/`, `/tires`,
  one wheel PDP, `/cart` (empty): record performance, a11y, best practices, SEO, LCP, CLS, INP proxy,
  TBT; JS and CSS transfer per route; the number of prefetch requests a `/tires` load triggers (D111
  "unmeasured"); TTFB of `/tires?width=205&profile=55&rim=17` and `/wheels?bolt=5x114.3&diameter=18`
  three times each; `x-vercel-cache` on `/`, a PDP and `/tires`. One Lighthouse run at a time.
- **GATE [N], code, the main checkout.** Read `pre/check.log` and `pre/fixture.log` and report their
  result as the first line; `git status` clean apart from scratch files; `git diff main...HEAD --stat` and
  for every folder touched, its `llm.md` was touched in the same branch (root rule §1.2) or say which was
  not; the branch's new decision rows (D155, D156) are in root `llm.md` §5b and cited where they apply;
  count files whose first line is `"use client"` (`grep -rl '^"use client"' src`, 31 on 2026-10-06) and compare with the last recorded count (root `llm.md` D133: 30; the branch is expected to add one); grep
  `src/` for em and en dashes in string literals and JSX text (D130); grep the diff for anything
  secret-shaped; `npm audit --omit=dev` summary; `next build` warnings in `pre/fixture.log`; TODO and
  FIXME markers added by the branch; `scripts/fitment-coverage.ts` runs and matches
  `design/reports/fitment-coverage.md`'s headline numbers.
- **OPS [N], Vercel and DNS, read only.** The latest production deployment: state, commit, age, and
  that it is `main` at the expected SHA; preview deployments for this branch and their state (a
  `garvbareja`-authored commit is BLOCKED, §7.24, `accepted`); runtime errors in the last 24 h and the
  last 200 log lines (look for `quote.email.disabled` from CART-PROD, any `payments.*` or `admin.*`
  rejection line, any 500); env var **names** per environment against every `process.env.X` the code
  reads (`grep -rho "process.env.[A-Z_]*" src scripts | sort -u`) and which are missing where;
  domains and certificates on the project; `todo.md` items that must be done before the client sees the
  site, each with its current state as far as a read can tell (`ADMIN_PASSWORD_HASH` set or not, the
  quote flag, Converge env, R2 vars, the DKIM record by `dig`, the Neon reset); Resend and Fixie quota
  position if the dashboards are reachable read-only, else say so.

## 6. Verification (T+6 to T+8)

Four verifier agents split the P0 and P1 findings by scope (storefront, admin and pay, edge and SEO,
data and ops). Each verifier tries to **refute** every finding it holds with fresh evidence, in the same
environment, in under ninety seconds per finding: reproduce it or mark it `refuted` with why. A finding
no verifier reaches by T+8 stays in the report marked `unverified`. P2 and P3 are not verified.

## 7. The report (T+8 to T+10)

One file, `<CHECK>/final-check.md`, then copied to `design/reports/final-check-<date>.md` if the owner
wants it kept. In this order:

1. **Verdict in one line:** ready to show the client, or not, and the single biggest reason.
2. **The pre-clock gates:** `npm run check`, the fixture suite in both flag states, with pass counts.
3. **P0 and P1**, ranked, verified status on each, with the evidence path.
4. **P2 and P3**, ranked.
5. **Accepted and owner decisions** surfaced by the sweep, each with its decision ID.
6. **Partial scopes** and what they did not reach; **not testable here** (real Safari, iOS, Converge,
   email delivery, R2 upload).
7. **The cleared list**, merged, one line each, grouped by scope.
8. **The two production writes**: the cart send's time and log line, and the test product's edit and
   restore both confirmed on the storefront.

The coordinator does not fix anything in the window. Fixes come after the owner reads the report,
item by item (the D145, D151 precedent).
