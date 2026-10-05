# Pre-launch audit — the brief

This is the prompt every agent in the pre-launch audit works from. It covers what a company checks before
a site goes live: security, sign-in, payments, the backend, data quality, images, UI, motion,
accessibility, performance, SEO, copy, legal, and readiness to operate. It is written to be run again:
before any later release, update **§2 Environment** and run it.

Owner ruling for the first run, 2026-10-04: *"full audit of everything in terms of auth, security, UI,
backend, data, data quality check, how images are looking, how everything is working in every
environment. Basically what a company would do on a full-fledged website before it's going live"*. The
owner then chose **both environments, split by risk**, **report first, then fix what the owner
approves**, **local writes only, with the owner signing in on production for a look**, and about **50
agents**. Also: *"use all the skills that we made"*. Results go in `launch-audit.md` beside this file.

---

## 1. Rules every agent follows

1. **Report only.** Change nothing in the repo, in production, in Vercel, Neon, Cloudflare, Resend or
   Converge. The coordinator applies fixes after the owner approves them.
2. **Read before judging.** Root `llm.md` §5 is the decision register. Before you report something,
   check whether an owner ruling chose it. If it did, report it as `accepted` with the decision ID, not as
   a defect, unless you can show the ruling's premise is false today. That second kind is a real finding.
   Examples of accepted choices: no failed-login limit (D95), sort is JavaScript-only (D57), prices hidden
   at launch (D122), no pause control on the brand ticker (D139), payment double-charge risk on a closed
   tab (D108).
3. **Evidence or it isn't a finding.** Each finding has a reproduction: a URL plus steps, a command and
   its output, a `file:line`, or a measured number. "Looks off" is not evidence. Markup inspection does
   not prove behaviour: hit-test clicks, run the flow (D86, D91b).
4. **Production is read-only.** GET requests only, from outside: `curl`, headless Playwright, `dig`,
   `openssl`. No form posts, no sign-in, no payment links, no cart sends. **At most 1 request a second and
   300 requests per agent** against production. Never crawl the whole catalogue there: sample.
5. **Never:** load-test or flood anything; send any email; call Converge or guess a Converge PIN (five
   wrong PINs block the IP, D107); read or print a secret value; decrypt a Vercel env var; use the
   production `DATABASE_URL`; brute-force the production admin.
6. **Local writes go to the write server only** (§2, port 3301). The read server (3300) and its
   database must stay identical to production so data counts stay true.
7. **One browser at a time.** The machine has 8 CPUs and 8 GB of memory and up to six agents run at
   once. Launch one headless browser, close it when done, and never run the full Playwright suite in
   parallel mode. Firefox and WebKit only where your scope says so.
8. **Use the skills.** Each scope names its skills. Load them with the Skill tool; if that is not
   available, read `.claude/skills/<name>/SKILL.md` and follow it. Report-only modes only: a skill step
   that edits files is skipped.
9. **Write your evidence** to `<AUDIT>/out/<scope-id>.md` (screenshots and scripts under
   `<AUDIT>/out/<scope-id>/`). Return only the structured findings.

## 2. Environment (first run, 2026-10-04)

`<AUDIT>` = `/private/tmp/claude-501/-Users-raghavvirmani-platinum-wheels/c854a493-db11-445f-8e0d-641bcb6f7127/scratchpad/audit`

| What | Where | Notes |
|---|---|---|
| Code under audit | `<AUDIT>/target` | Frozen worktree at `bbcdc8b` (branch `responsive-pass`, D141). Read code here, **not** in the main checkout, which the coordinator is editing. |
| Read server | `http://localhost:3300` | `next start` of the frozen build, on a local Postgres (PGlite) at `127.0.0.1:55491` loaded from the D125/D135 `catalogue.csv`: 39,961 products, the same totals as production. **No writes.** |
| Write server | `http://localhost:3301` | Same build on its own database at `127.0.0.1:55492`. Admin edits, bulk changes, cart sends, payment links and attack tests go here. |
| Local admin | `http://admin.localhost:3301/login` | Send the request with `Host: admin.localhost:3301` or open that URL (D115). Test credentials: `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `<AUDIT>/env-w.sh`. Source the file; do not copy the password into a report. |
| Env of the local servers | `<AUDIT>/env.sh`, `<AUDIT>/env-w.sh` | Quote email off, `QA_ERROR_ROUTE=1`, no Converge, no R2, prices off, indexing off. |
| Artboard baseline | `http://localhost:4000/home-desktop` etc. | `design/assets/*.html` served as in `design/reports/README.md`. |
| Production storefront | `https://platinum-wheels-one.vercel.app` | The apex `platinumwheels.ca` still serves the goodwill site (D96). |
| Production admin | `https://admin.platinumwheels.ca` | Outside checks only: headers, redirects, 404s, cookies, TLS. |
| Production pay | `https://pay.platinumwheels.ca` | Outside checks only. Converge is on its **demo** account (D121). |
| Catalogue source | `/Users/raghavvirmani/Platinum Wheels Vendor Data/combined/share/output/catalogue.csv` | What production was loaded from (D135). Its review files sit beside it. |
| Browsers | Playwright's Chromium, Firefox and WebKit are installed (`npx playwright`). | No real Safari or iOS Simulator (needs full Xcode). |
| Vercel | Vercel MCP tools, team `platninumwheels`, project `platinum-wheels` | Read only: deployments, runtime errors and logs, domains, env var **names**. |

Three facts about this environment that change how a result reads:

- **Production has product photos; the local databases do not.** The bulk photo load reached production
  (`photos.platinumwheels.ca`), but the local copies were loaded from the CSV, which has no images. A
  local page showing the no-photo tile everywhere is the test bed, not a defect. Judge photos on
  production. (The write server holds a few photo rows that earlier auditors added.)
- **The local database server (PGlite) sometimes drops a connection** (`ECONNRESET` in the server log).
  Before reporting a local 500 or empty page, retry it twice; report it only if it repeats, and say so.
  The local servers were also down between 19:24 and the restart on 2026-10-04; anything observed failing
  in that window is the test bed.
- **The card-to-product photo morph is being fixed separately** (owner request, 2026-10-04) in the main
  checkout, not in `<AUDIT>/target`. Judge the frozen build as it is; the coordinator marks what that fix
  covers.

## 3. Severity

| Level | Meaning |
|---|---|
| **P0 — blocks launch** | Security hole, data leak, payment or money error, sign-in bypass, a core flow broken for most visitors, a legal exposure, or wrong data shown on most products. |
| **P1 — fix before launch** | A flow broken for a visible group (a browser, a width, a category), wrong data on many products, an accessibility failure at WCAG 2.2 A/AA on a core flow, a serious performance or SEO fault. |
| **P2 — fix soon after** | Visible quality problems, edge-case bugs, data blemishes on a minority of products, missing hardening. |
| **P3 — polish** | Minor inconsistency, copy nits, code health. |

## 4. Finding format

Every finding carries: a short `title`; `severity`; `scope` (your scope ID); `kind` (`defect`,
`accepted`, `owner-decision`, `not-built`); `env` (`production`, `local`, `code`, `both`); `where`
(URL, `file:line`, SQL, or host); `evidence` (steps and what you saw, with numbers); `expected` and why
(cite the decision, the artboard, a standard such as WCAG or OWASP, or the vendor's site); `fix` (one or
two lines; how, not code); `confidence` (`high`, `medium`, `low`).

Also return a `cleared` list: things you checked and found correct, one line each. A report that lists
only problems cannot be told apart from one that did not look.

## 5. Scopes

Team, scope ID, what it covers, and the skills it loads. Every scope also covers **every environment it
can reach**: the local build, production, and where it applies phone, tablet and desktop widths.

### Security and sign-in
- **SEC-AUTH** — Admin sign-in and every Server Action. Session token format, signing, expiry and
  logout; cookie flags; CSRF token and origin checks; `requireAdminAction()` as the first call of every
  admin action and `requireAdminSession()` on every gated page; timing-safe compare; what an
  unauthenticated POST to each action does (on 3301); input validation, length caps, mass assignment,
  injection into SQL, HTML, email headers and email bodies; the cart and quote actions' honeypot, timer
  and caps. Skills: `security-review`, `engineering:code-review`.
- **SEC-EDGE** — Host routing and the edge. `src/proxy.ts` and `host-routing.ts` on every host (admin,
  pay, storefront, `www`, the vercel.app alias) on production and locally; security headers on every
  production host (HSTS, frame, nosniff, referrer, CSP — note what is missing); TLS certificates and
  expiry; DNS and email records (`dig`: SPF, DMARC, DKIM, CAA); open redirects; what the 404 and error
  pages reveal; `robots.txt` and sitemaps by host.
- **SEC-PAY** — Payments. Token entropy and guessability of `/pay/<token>`; link states (open, paid,
  cancelled, expired) and races; `/pay/return` verification and that a forged return cannot mark a link
  paid; `/pay/notify` IP and Basic auth gates; amount and invoice checks; double payment; the Pay
  island's hand-off form (D125b); admin link builder and cancel. Code review plus local runs on 3301
  without Converge. **Never call Converge.** Skills: `security-review`.
- **SEC-DATA** — Secrets and exposure. Secrets in the repo and its git history; `NEXT_PUBLIC_*`
  contents; client bundles and RSC payloads (search for vendor names, `vendor_price`, dealer wording,
  internal IDs); product page source, OG images and sitemaps on a production sample; what server logs
  print (PII); dependency advisories (`npm audit`), the canary Next version, and what runs at build.

### Backend and database
- **BE-DB** — Schema, constraints, indexes and migrations against the queries the app actually runs
  (`EXPLAIN` on the local database for every list, facet, PDP and admin query); connection handling on
  serverless (pool per function, Neon pooled vs unpooled); migration safety on a live database.
- **BE-SEARCH** — The results engine. Facet counts against SQL truth for a sample of filter combinations
  on all three categories; best/similar split; sort; `Load more`; size narrowing; the five D137 filters;
  hostile and malformed query strings (on 3300 and a few on production); response times per route.
- **BE-RESILIENCE** — What happens when things fail: database down or slow (start your own extra server
  on a free port pointing at a dead database), Resend failure, a missing env var; error boundaries, 404 vs
  500 status codes, `global-error`; caching and rendering mode of every route (`unstable_cache`, CDN
  headers and `x-vercel-cache` on production), prefetch cost.

### Data quality
- **DATA-TIRES**, **DATA-WHEELS**, **DATA-ACC** — One per category, by SQL on the read database
  (`127.0.0.1:55491`) and against `catalogue.csv`: blanks per column, impossible or outlying values,
  sizes and patterns that do not parse, duplicates the shopper would see as one item, brand and model
  spelling variants, names and titles, descriptions with vendor or price wording (D135 M9), seasons
  (D126), spec rows that print oddly. Check a sample against the vendor's own site where a value looks
  wrong (D125 rule: data follows the vendor). Skills: none required.
- **DATA-PROD** — Production against the source. Category and facet totals on production vs the local
  read server; 150 sampled product pages on production compared field by field with their CSV rows;
  slugs that 404; products whose page is reachable but not listed or the reverse.
- **DATA-FITMENT** — The vehicle finder and fitment data that ships today: what `src/features/finder/`
  actually uses (D27 seed, D48 placeholder map, D110 snapshot), whether a real visitor picking their car
  gets results that are wrong, the year range, and what the site claims about fitment against what it can
  check.

### Images
- **IMG-PRODUCT** — Product photos: how many products have a photo on production (sample), how the
  no-photo tile looks on cards, PDP, cart and admin for every category and for brandless accessories; the
  R2 setup state (`photos.platinumwheels.ca`, D126b, `todo.md` 11); the upload code path (types, size and
  pixel caps, the Content-Type trust left open in D138).
- **IMG-SITE** — Every other image: hero, tiles, winter promo, brand logos, OG cards. Resolution versus
  rendered size at 1x/2x/3x, file weight, format, `sizes`/`srcset`, LCP candidate, crops at every width,
  alt text, licensing against `design/ASSET-CREDITS.md`, how they look in both the light and dark
  context of each section. Skills: `impeccable`.

### UI and UX
- **UI-CRITIQUE** — `impeccable` audit and critique of the storefront (home, three category pages, a
  product of each category, cart, about, privacy, terms, 404). Skills: `impeccable`, `design-taste-frontend`.
- **UI-GUIDELINES** — `web-design-guidelines` over `src/`, plus the `ui-ux-pro-max` checklist. Skills:
  `web-design-guidelines`, `ui-ux-pro-max`.
- **UI-PARITY** — The three drawn routes against their artboards at 390 and 1440 with
  `scripts/parity-probe.js`, as `design/reports/README.md` describes; every delta outside tolerance is
  either a `DEVIATIONS.md` row or a finding. Skills: `design-to-code` (audit mode).
- **UI-RESPONSIVE** — Every route and state (storefront, cart, dialog, admin, pay pages) at 320×568,
  375×667, 390×844, 430×932, landscape 844×390, 768×1024, 1024×768, 1280×800, 1440×900, 1920×1080 and
  2560×1440: horizontal overflow, clipped or overlapping text, tap targets under 24px, the finder CTA above
  the fold (D128), symmetry of the content frame (D141).
- **UI-CART** — The cart and quote flow end to end on 3301: add from a card and from the PDP, quantities
  and `Custom`, the header count, stepper, remove, unavailable and removed products, a tampered
  `localStorage`, the quote dialog, validation, honeypot and timer, success, the server logs of the
  "sent" request. Skills: `design:ux-copy`.
- **UI-ADMIN** — Every admin screen on 3301: sign-in, home, payment-links builder and list, cancel,
  products list with every filter and paging, bulk change, new, edit, status buttons, sources, the admin
  styleguide and 404; empty, error and loading states; widths 375 to 1920.

### Motion
- **MOTION** — Every animation in the build against `design/reports/motion.md` and D92b: the card to
  product photo morph (results → PDP and back, on home, tires, wheels, accessories, with a photo and with
  the no-photo tile), route slides and crossfades, hover and press, the result stagger, reveals, image
  fade, filter sheet, drawer, disclosure, loader, ticker. Frame-sample them, look for jumps, double
  animations, flashes, layout shift, dropped frames on a throttled CPU, and reduced motion. Name the root
  cause of any jank. Skills: `vercel-react-view-transitions`, `impeccable` (animate).
- **MOTION-ENGINES** — The same transitions in Firefox and WebKit: whether they degrade to an instant
  change cleanly or break.

### Accessibility
- **A11Y-AUTO** — axe on every route and state at phone and desktop width; heading outline; landmarks;
  names of every control. Skills: `design:accessibility-review`.
- **A11Y-MANUAL** — Keyboard-only walks of every flow (finder, filters, sheet, cart, dialog, admin),
  focus order and visibility, focus after navigation and after errors, live regions, contrast over
  photos, 200% and 400% zoom, text spacing, forced colours, reduced motion.

### Performance, SEO, browsers
- **PERF** — Lighthouse (Chrome at `/Applications`) on production for home, a category, a PDP and cart,
  phone and desktop; Core Web Vitals; JS and CSS weight per route; image weight; server timing.
- **SEO** — Launch readiness of D112 on production and local: indexing flag behaviour, `robots.txt`,
  sitemaps, canonical tags, titles and descriptions, JSON-LD validity, OG previews, what turning the flag
  on at launch requires.
- **BROWSERS** — Chromium, Firefox and WebKit headless on the core flows (home → finder → results →
  filter → PDP → add to cart → cart → quote dialog) at phone and desktop width, plus a no-JavaScript run.

### Content and legal
- **COPY** — All visible copy: em dashes, taglines, typos, tone (D130, D140), consistency of names,
  phone numbers, hours and contact details, empty and error messages. Skills: `design:ux-copy`.
- **LEGAL** — Privacy and terms against what the code really does (local storage, Resend, logs,
  Converge, Vercel); CASL consent records; PIPEDA; Ontario accessibility (AODA); PCI SAQ A for the hosted
  payment page; the Vercel Hobby non-commercial term; the brand-logo permission (D129).

### Operations
- **OPS** — Launch readiness: Vercel deployments and their state, runtime errors and logs on production,
  domains and certificates, env var names per environment against what the code reads, `todo.md` items
  that must be done before launch, the DNS cut-over, rollback, monitoring and alerting, backups (Neon
  restore), the Fixie and Resend quotas. Skills: `engineering:deploy-checklist`.
- **CODE-HEALTH** — `npm run check`, `next build` warnings, the parked e2e suite (D111) and what it would
  take to run it against the local database, TODO and FIXME markers, dead code, the llm.md library's
  claims against the code (spot-check twenty).

## 6. After the scopes

1. **Verify.** Every P0, P1 and P2 finding is re-checked by a separate agent who tries to refute it with
   fresh evidence. Refuted findings are dropped and listed.
2. **Completeness.** One agent reads every scope's `cleared` and findings lists and names what nobody
   checked. Gaps become a second, smaller round.
3. **Report.** One ranked list in `launch-audit.md`: P0 to P3, each with its evidence path, then the
   accepted risks, the owner decisions needed, what was not built, what could not be tested here, and
   the cleared list.
