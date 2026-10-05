# Pre-launch fixes — the plan

Every issue the pre-launch audit (D145) found that is worth acting on, de-duplicated, with the recommended
fix, who decides, and where the code lives. The evidence for each item is in
[`launch-audit.md`](launch-audit.md) (search the title). P3 polish stays in that report and is batched last.

**Status at writing (2026-10-04):** nothing below was applied; see each batch's status list. The card-to-product morph is already fixed
(D144, branch `launch-audit`, uncommitted); five audit findings about it are closed by that fix and listed
at the end. The audit ran on `bbcdc8b`; `main` is now `6562b2f` (D139b photo loader, D142 part-number and
M+S columns). Re-check each data item against `main` before fixing it.

Legend: **Code** = a session can do it after the owner approves. **Owner** = a ruling or an action outside
the code (dashboards, accounts, vendors, the client, a lawyer). **Data** = the catalogue CSV or the
production database (the co-founder's pipeline, D125/D135; a production write needs the owner's go-ahead).

---

## Batch 1 — before launch (P1)

| ID | Issue | Recommended fix | Who | Where |
|---|---|---|---|---|
| LA-01 | Anyone can make `/pay/return` call Converge through Fixie (500 requests a month), so a loop exhausts the quota and real payments can't be verified. Matched requests also write a permanent event row each. | Query Converge only for a return that matches an attempt we started and that is still pending; one query per attempt (cache the verdict); never log an event row for an unverified return. Then the Vercel firewall rule (`todo.md` 7). | Code + Owner (firewall) | `src/app/pay/return/`, `src/features/payments/service.ts` |
| LA-02 | A guessed invoice number on `/pay/return` redirects to that link's private pay URL (invoice numbers are sequential). | Never build a redirect to `/pay/<token>` from return-query data; show a neutral "We could not confirm this payment" page with the phone number. | Code | `src/app/pay/return/` |
| LA-03 | The quote form can be scripted: no rate limit, honeypot and timer are client-controlled, the auto-reply goes to any typed address, all inside Resend's 100-a-day quota shared with the goodwill site. | Server-side per-IP cap in the action (small in-memory window is enough on one region) plus the Vercel firewall rule; owner decides whether the auto-reply stays (it can be used to mail strangers). | Code + Owner | `src/features/cart/actions.ts` |
| LA-04 | The "Added to cart / View cart" prompt is painted under the result cards on `/tires`, `/wheels`, `/accessories`; it can't be seen or clicked. | Stacking fix: give the prompt a z-index above the grid's cards (the cards' list-identity view transitions create stacking contexts). Verify by hit-test at 390 and 1440. | Code | `src/features/catalog/components/add-to-cart-button.tsx` |
| LA-05 | Vehicle finder fit data is placeholder and wrong (bolt patterns wrong on 21+ of 60 vehicles, tire sizes match no real trim, 15 of 47 makes), so `Best matches` labels wrong products as fits; the hero says "checked to fit". Also: years offered for models that never existed, wheels matched on bolt pattern only. | Owner picks one: **(a, recommended)** keep Year/Make/Model for search but drop the fit claims (no "Best matches"/"fits" from placeholder data; one line near the chip: "Sizes are a starting point; we confirm fitment before you pay"), or (b) hide the finder until the D110 fitment sheet is filled, or (c) leave it. | Owner, then Code | `src/features/finder/`, `src/features/results/search.ts`, hero copy |
| LA-06 | The vendor's "Image not available" graphic is the product photo on 337 accessories (26% of sampled), 4 tires, 1 wheel. It counts as a photo, so the neutral tile never shows and these sort as photo products. Related: 14 cap/logo photo files show another brand's mark (181 products, e.g. an ART cap on 720 Form, DAI, Ruffino). | Delete the `product_images` rows pointing at the placeholder file(s) so the tile shows; make the photo loader skip that hash. Drop the cross-brand cap and logo photos. | Data (+ Code for the loader guard) | `scripts/catalog-photos.ts` on `main`; production `product_images` |
| LA-07 | Quote requests show "Quote request sent" while nothing is delivered (`AUTO_EMAIL_LEAD_CAPTURE_ENABLED=false`). | Flip to `true` for Production and redeploy in the release that goes live; send one test enquiry. | Owner | `todo.md` 2 |
| LA-08 | The Neon owner password is the one pasted into chats. | Reset it; check both Vercel DB vars changed; redeploy. | Owner | `todo.md` 9 |
| LA-09 | Payments run on the Converge demo (test window ended 2026-10-04); 16 demo links sit in production (11 open); PIN rotation and the 2026-10-03 diagnostic loosening (CAPTCHA off, wide API rights, test sales) are undone only on paper. | Production credentials and certification from Elavon; rotate the PIN; undo the diagnostics; cancel the 11 open test links in the admin; void the test sales. Decide the payment scope for launch. | Owner | `todo.md` P7, P9, P10 |
| LA-10 | Legal pages don't match what ships: privacy says no payment details are handled though a card page exists; no refund, cancellation, delivery, returns, pick-up or merchant-address terms anywhere; privacy omits service providers, US processing, retention and a privacy contact; CASL request lacks sender identification and a mailing address. | Owner settles fulfilment and returns with the client and supplies a mailing address; a session then drafts the clauses (privacy names Resend, Converge/Elavon, Vercel, Neon, Cloudflare and US processing; terms gain refunds/returns/delivery; the quote dialog gains legal name, address and a privacy link). Lawyer review before launch (D63). | Owner, then Code | `src/app/(storefront)/{privacy,terms}/`, `src/features/cart/components/` |
| LA-11 | Vercel Hobby is non-commercial only; the site sells and takes payments. | Move to Pro (also fixes the blocked co-author deploys). | Owner | root `llm.md` §7.24 |

### Batch 1 status (2026-10-04, branch `launch-audit`, uncommitted)

Verified on a production build (`next start`, port 3400) against the local PGlite copy of the catalogue.

- **LA-01** applied: `/pay/return` asks Converge only when the `pw_pay` cookie names a link with an open attempt, claimed under the link lock, at most 3 queries per attempt; no event row for an unmatched return. Measured: no cookie or a made-up cookie makes no query and writes nothing; 4 returns → 3 queries; 6 parallel returns → 1 query. Firewall rule still owner (`todo.md` 7).
- **LA-02** applied: only the cookie's own link page is ever a redirect target; everyone else lands on `/pay/done` ("We couldn't confirm your payment", call or email). Measured: cookie A + link B's invoice → A's page, never B's.
- **LA-03** applied: per-IP cap in the cart quote action (3 per 10 min, 5 per day, in memory per instance); auto-reply kept (owner: "Keep it, rate-limited"). Measured: sends 1–3 succeed, 4 and 5 show the call-us line with the form kept. Firewall rule still owner.
- **LA-04** applied: the prompt is portalled to `<body>` (`cart-link.tsx`); the header's `view-transition-name` had trapped it. Hit-tested at 375 (`/tires`) and 1440 (`/wheels`) over a card: `View cart` and `Close` hit themselves; a real click on `View cart` reaches `/cart`.
- **LA-05** applied (owner rulings, 2026-10-04: *"fix the vehicle finder fit data as per vendors and market data"*, *"free data avaialable no payments"*, *"Keep placeholder for tires"*, *"No, keep until replaced"*, and on ANKUSI *"use but give no credit. we have agreed on mail with them"*). `scripts/data/vehicle-fitment.csv` (1,224 model-years, 463 models, 42 makes, exact years only) from ANKUSI; the finder lists the 47-make vPIC list with Make and Model narrowed by Year; wheel bolt pattern from the real row, else the D48 placeholder, else nothing; tire size, lug thread and TPMS stay placeholder. Measured on the build: 2021 Wrangler 2,992 wheels (5×127), 2021 F-150 3,307 (6×135), 2016 Equinox 2,384 (5×120), each equal to a direct count; 2021 Civic tires unchanged at 59 · 299; Year 2005 hides Tesla and narrows Toyota to its 2005 models. Cost: `/` and `/tires` grow about 18–23 KB gzipped. Open for the owner: the placeholder bolt-pattern fallback still gives known wrong answers on years with no real row (2021 Corolla, 2020–24 Outback, 2025–27 F-150).
- **LA-06** applied. Loader guard in `scripts/catalog-photos.ts` (dry run: 367 skipped, 0 problems). Production, one transaction on 2026-10-04 with the owner's go-ahead, every count checked before COMMIT: 367 placeholder rows and 15 wrong-brand generic photos deleted, 6 accessory brands corrected (also in `catalog-csv-build.ts`, rule `LA06`, verified by a rebuild), 6 photo rows added from files already in R2 (Rydanz R23 ×2, Haida HD667, RTX Valhalla, GT Invasion Matte Black ×2 with the Satin Black photo, owner's choice). Live site checked. Waiting: Dovroad YS716 and Habilead H206 photos (approved; need the R2 settings to upload); 359 products with no vendor photo (ask DAI for the 337 accessories).
- **LA-07 to LA-11** owner actions, unchanged.
- **D144 morph**: Chromium and WebKit frames show the photo solid above both pages mid-flight; Firefox runs the transition with the photo group paired at z-index 50 and lands on the sharp photo, but its screenshots cannot show the transition layer, so no mid-flight image.

## Batch 2 — code fixes that need no ruling (P2)

| Issue | Recommended fix | Where |
|---|---|---|
| Long unbroken payment-link description scrolls `/pay/<token>` and the admin list sideways at every width. | `break-words` (`overflow-wrap:anywhere`) + `min-w-0` on the description in the pay page, admin list card and success panel. | `src/app/pay/[token]/`, `src/features/admin/components/` |
| Admin form posts return "Internal Server Error" before hydration (the admin's `Referrer-Policy: no-referrer` fails the origin check). | `Referrer-Policy: same-origin` on the admin host. | `next.config.ts` |
| Payment-link idempotency: a reused key shows the new amount for a link holding the old one. | Return the stored link's amount and description; refuse a reused key with different values. | `src/features/admin/payment-link-actions.ts` |
| No statement, lock or function time limits; a hung database holds each request 10–20 s. | `statement_timeout` ~8 s storefront (longer admin), `lock_timeout`, pool `query_timeout`. | `src/db/` client |
| Malformed percent-encoding in a URL gives an unbranded 500 or kills the HTTP/2 stream. | In `proxy.ts`, send paths that fail `decodeURIComponent` to the 404. | `src/proxy.ts` |
| Storefront sends no frame, nosniff, referrer or permissions headers; admin and pay CSP is frame-ancestors only. | Add `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` to the storefront; tighten pay. | `next.config.ts` |
| Favicon is the create-next-app default. | Real favicon set (16/32/48 ICO, 180 apple-touch, SVG) from the logo. | `src/app/` |
| `How it works` step titles are grey; artboards draw white. | `text-ink` on the step `h3`. | `src/features/home/components/how-it-works.tsx` |
| Wheel offset range inputs are 20px tall (WCAG 2.5.8). | Touch height ≥ 24px, thumb position unchanged. | `src/features/results/components/` |
| Fragment nav links don't move keyboard focus. | Focus the target (`tabindex=-1`, `preventScroll`) after the scroll. | `src/components/site/hash-scroll.tsx` |
| Forced colours: filled buttons lose their edge; selected chip and segment disappear. | Transparent border on filled buttons; forced-colours rule for selected states. | `src/components/ui/`, `globals.css` |
| Pay button drops focus to `<body>` after an error. | `aria-disabled` while pending, focus the alert on error. | `src/features/payments/components/pay-button.tsx` |
| Finder silently drops a part-filled vehicle (year + make, no model). | Keep the finder open with Model focused and a one-line prompt. | `src/features/finder/` |
| PDP between 720 and 1099 px buries the title and buy panel under a full-width gallery. | Cap the stacked gallery height (~60dvh). Undrawn band (D41), no parity row moves. | `src/app/(storefront)/products/[slug]/page.tsx` |
| Quote dialog's submit button sits below the visible area on common viewports. | Sticky submit row inside the dialog. | `src/features/cart/components/` |
| Long accessory names push `Add to cart` below the phone fold. | Step down the PDP h1 for long names. | `src/features/product/components/buy-panel.tsx` |
| WebKit: filter sheet and quote dialog overshoot the top while opening, then snap back. | Clip the dialog's overflow during the entry. | `globals.css` sheet utilities |
| Pay-host 404 is a dead end. | Pay host's own not-found with phone and email. | `src/app/pay/` |
| 404 pages emit two conflicting robots metas; the vercel.app alias serves `index` meta while robots.txt blocks it. | One robots meta on 404; `noindex` on any host that is not `platinumwheels.ca`. | `src/features/seo/` |
| ~24% of product pages share a title, H1 and description with another page; 812 accessory pages share a title. | Add the differing fact (centre bore, Left/Right, Part number) to the title and size line when siblings share the rest. | `src/features/seo/`, `src/features/product/view.ts` |
| Vendor `W/` shorthand prints in wheel size lines. | Expand to "with" at display. | `src/features/catalog/adapter.ts` |
| Admin sign-in has no brake in production (the plaintext password path skips scrypt). | Set `ADMIN_PASSWORD_HASH` (Owner) and a firewall rule on the admin POST; no counter code (D95). | Owner + `todo.md` |
| Preview and production share one database, bucket and secrets; previews fail with "Resource provisioning failed". | Scope DB, R2 and admin vars to Production; give Preview its own Neon branch. | Owner (Vercel) |
| No monitoring, uptime check or log drain; no backup or rollback runbook; Workspace DKIM, CAA, DNSSEC missing. | Free uptime check, Vercel alerts, Neon restore point before data migrations, a short runbook, DNS records. | Owner + `todo.md` |
| `todo.md` lacks the apex/www cut-over steps and a pre-cutover check. | Add them (order in `out/GAP-indexing-flag-on-build.md`). | `todo.md` |
| The parked e2e suite can't run; nothing tests the cart send, admin, payments or the new filters. | Revive the cheap specs (seo, routes, smoke, error-boundary) against a fixture DB; add one spec each for cart send, `/pay` states, admin save. | `tests/` |

### Batch 2 status (2026-10-04, uncommitted; owner: "Apply all code items")

Verified on a production build against the local PGlite catalogue unless noted.

- Long payment description: applied (`wrap-anywhere`); a 200-character description leaves `/pay/<token>`, the admin list and the success panel at scrollWidth = viewport at 320/390/1440.
- Admin no-JS sign-in: applied (`Referrer-Policy: same-origin` on the admin host); a JS-off sign-in lands on the admin home.
- Payment-link idempotency: applied; a reused key with different values shows the "This form already made link…" alert (owner approved the copy), focus on it, one row in the database.
- Database time limits: applied client-side (`query_timeout` 8 s, connect 5 s, a released busy client is destroyed); `statement_timeout`/`lock_timeout` are refused by Neon's pooler as startup parameters. Frozen database: a page fails in 5.0 s instead of hanging; requests recover at once.
- Malformed percent-encoding: applied in `proxy.ts`; `/products/%FF`, `/products/abc%`, `/sitemaps/%FF`, `/tires/%E0%A4%A` are branded 404s. Proxy now also runs on `/products/*`.
- Security headers: applied; every host gets frame-ancestors none, nosniff, referrer and permissions headers; pay keeps strict-origin, no-store, noindex and adds COOP.
- Favicon: applied from the logo badge (ICO 16/32/48, 192 icon, 180 apple icon). Owner: "Ship the badge for now"; at 16 px it reads as a disc.
- How it works titles: applied, `rgb(244,244,245)` at 390 and 1440.
- Offset range target: applied, inputs 24px tall, handle still drawn 16px.
- Fragment focus: applied; header `Contact` lands at 3983 with focus on `#contact`; a cold `/#contact` load leaves focus on `<body>`.
- Forced colours: applied; primary buttons keep a 1px border, selected chips paint Highlight; button boxes unchanged (328×44 at 390, 278×48 at 1440).
- Finder part-filled vehicle: applied (LA-05 session); `/tires?year=2021&make=Honda` opens the disclosure with "Choose your model to see what fits."
- PDP 720–1099 gallery: applied; 614px at 768×1024 and 461px at 1024×768 with the title on screen; 390 and 1440 unchanged.
- Quote dialog submit: applied (sticky row); `Send inquiry` is on screen on open at 390×844, 1280×720 and 1366×768.
- Long accessory names: applied, partial. The audit's centre cap drops from four lines to three (36px), but `Add to cart` still ends 14px below the fold at 390×844, and even a short tire name ends at 845 on 375×812: the square phone gallery is the limit. A smaller phone gallery is an owner ruling (drawn value).
- WebKit dialog overshoot: applied (`overflow: clip`); WebKit `scrollTop` stays 0 on every frame for the quote dialog and the filter sheet.
- Pay-host 404: applied with the owner-approved copy; `/pay`, `/pay/a/b` and an unknown token are 404s; pay-host stray paths get the pay headers.
- Robots: applied; one robots meta on the 404; `X-Robots-Tag: noindex, nofollow` on every host but `platinumwheels.ca`.
- Duplicate titles: applied; siblings now differ (e.g. `…Satin Black, Centre bore 57.1 mm` / `63.4 mm`; lug nuts gain `Part number …`); one extra indexed read per product page. Simulated on the CSV: shared titles 24.1% → 0.1%.
- Vendor `W/`: applied, shown as "with" (owner approved) on card, title, cart and emails; the PDP spec table's Finish row still shows the raw text (`catalog/llm.md` Open 7).
- Pay button focus: applied; after an error focus is on the alert, not `<body>`.
- Not done yet, code: the `todo.md` cut-over steps and the e2e suite revival (fixture database, cart/pay/admin specs). Next in this session.
- Owner rows (admin password hash and firewall rule, preview separation, monitoring and DNS records): waiting on owner.

## Batch 3 — data (P2; co-founder pipeline, owner approves production writes)

| Issue | Recommended fix |
|---|---|
| 46 product descriptions print em or en dashes; 47 tire descriptions name the wrong season; 4 describe a different tire; 292 use marketing register. | Strip dashes at build; drop season phrases on re-seasoned tires; drop the 4; owner chooses hide / trim / keep for the 292. |
| 8 tires show model codes as load index and speed (615K, 421Q); ~20 impossible load indexes. | Blank them; add a plausibility check to the CSV build; co-founder confirms against the vendor. |
| ~170 off-road tires labelled Summer that makers call all-season (Terra Grappler G3). | D126 maker lookup on those models, add to `SEASON_BY_MAKER`. |
| Model spelling variants split tires; 14 lug bolts typed as lug nuts. | Add to `MODEL_ALIASES`; retype the 14; add a `Model=BOLT` rule. |
| 29% of wheels and 47% of accessories look identical to a sibling on the card. | Owner ruling: show centre bore / Left-Right / Part number when siblings share the rest (pairs with the title fix in Batch 2). |
| 386 undrilled wheels have no bolt pattern and are invisible to the filter and vehicle search. | A spec row "Undrilled, drilled to order"; owner decides whether they list. |
| 190 of 573 centre caps carry no fit information. | Ask the vendors for diameter or wheel list, or a "call to confirm fit" line. |
| A wheel or accessory carrying "Mud & snow" loses it in migration 0005 (likely zero rows). | Count first; restrict the strip to tires if any. |

### Batch 3 rulings (owner, 2026-10-05; not yet applied)

- Descriptions: **"Fix + trim marketing"**: replace em/en dashes, drop wrong-season phrases on re-seasoned tires, remove the 4 that describe another tire, trim the 292 marketing ones to their facts.
- Impossible load index / speed (8 model codes, ~20 impossible): **"Blank + check vendor"**: blank them, add a plausibility check to the CSV build, fill any the vendor's site confirms.
- ~170 off-road tires labelled Summer: **"Leave as vendor has them"**. No change.
- Model spelling variants and 14 lug bolts typed as lug nuts: **"Fix both"** (fold spellings via `MODEL_ALIASES`, retype the 14; counts shown before production changes).
- Look-alike cards: **"Yes, on the card"**: the telling difference (centre bore, Left/Right, Part number) goes on the card's size line when a sibling shares everything else.
- 386 undrilled wheels: owner, verbatim: *"check if vendor has filter, then keep else just add spec"*. Check the vendors' own sites for an undrilled/blank filter; mirror it if one exists, else only a spec row "Undrilled, drilled to order".
- 190 centre caps with no fit information: **"do nothing"**.
- Mud & snow on wheels/accessories lost in migration 0005: no ruling needed; a read-only count on production.

## Batch 4 — owner rulings with no code until decided

- **Prefetch and caching cost:** every card fully prefetches its product page (≈6 DB queries each) and listings render per request. Recommended: prefetch on hover/focus only (keeps the morph, D92b(4)), cache the unfiltered category roots with the existing catalogue tag.
- **Mobile LCP 3.8–4.6 s** (gate parked, D54): unpark? Preconnect to the photo origin and row-aware `fetchpriority` are cheap.
- **Legal name:** footer says "Inc."; nothing else does. Confirm `SITE.legalName`.
- **How it works step 4 and "no payment on this site"** versus the card page on `pay.`: reword once fulfilment is settled (LA-10).
- **"Winter sets, in stock now." and "starting from $79.99 / $249.99"** are unbacked (D134 kept them): keep a record of the source or drop "in stock".
- **Canary Next.js with no advisory scanning:** add Dependabot or a weekly `npm audit`, or move to stable.
- **Brand and size hub pages for search** (39,950 products reachable only through the sitemap).
- **Vendor reuse permission** for scraped data and photos (accepted risk): get it in writing.

## Closed by D144 (the morph fix)

MOTION ×2, MOTION-ENGINES ×2 (all three engines), UI-GUIDELINES ×2, IMG-PRODUCT, PERF: "the photo vanishes mid-flight" (fixed by `z-index: 50` on the morph group) and "the PDP photo isn't loaded when the morph starts" (fixed by the cached card-size underlay). Re-verify in Firefox and WebKit with the fix (not done yet).

---

## Prompt for the fix session

Copy everything inside the block into a new session in this repo.

```text
We are fixing the pre-launch audit findings for Platinum Wheels before launch.

Read first, in this order:
1. Root llm.md (decision register; D144 is the morph fix, D145 the audit).
2. design/reports/launch-fixes.md: the plan. It lists every issue with the recommended fix, who decides,
   and where the code is. Evidence for each item is in design/reports/launch-audit.md (search the title).
3. The llm.md of every folder you are about to change (library rule §1.1).

Git: the morph fix (D144), the audit brief and report, and their llm.md rows are uncommitted on branch
`launch-audit` (based on origin/main 6562b2f). Check `git status`; if `main` moved, bring the branch up
to date first. Commit only when I ask. Take the next free decision ID at commit time (D98); check
origin/main and open PRs first.

How to work:
- You are the coordinator; delegate implementation to subagents on disjoint files and keep the single
  browser pane yourself. Ask me before anything that needs a ruling; a "Who: Owner" item is never done
  silently.
- Start by asking me, in one AskUserQuestion round, which Batch 1 code items to apply (LA-01, LA-02,
  LA-03, LA-04, LA-06 loader guard) and my choice for the vehicle finder (LA-05: a keep finder, drop fit
  claims [recommended] / b hide finder / c leave). Then Batch 2 as a block, then Batch 3 and 4 item by item.
- Data items (Batch 3, LA-06 rows) touch the catalogue CSV or the production database: show me the exact
  change and counts first; never write to production without my go-ahead.
- Verify every fix on a production build (`next build && next start`, never `next dev`, D88) against a
  local PGlite copy of the catalogue (see design/reports/launch-audit-brief.md §2 for how the audit set
  this up: @electric-sql/pglite-socket on a free port, `npm run catalog:import -- <catalogue.csv> --write
  --yes` with IMPORT_DATABASE_URL). Start servers detached (nohup) so a 2-hour background limit can't kill
  them. Hit-test clicks and run the flow; markup alone is not proof (D86). Re-verify the D144 morph in
  Firefox and WebKit.
- After each batch: same-change llm.md updates (rule §1.2), `npm run check`, a production build, and a
  one-line status per item in launch-fixes.md (applied / declined / waiting on owner).
- No em dashes in visible copy; tokens only; the rules in .claude/rules/ui.md hold.

End state: every Batch 1 code item applied and verified, every owner item listed back to me with what is
still needed, and launch-fixes.md showing the status of each row.
```

### Batch 4 and owner-item rulings (owner, 2026-10-05)

- Prefetch: **"Keep as is"** (every visible card keeps prefetching).
- Mobile LCP: **"Yes, the cheap fixes"**: preconnect to the photo origin, priority on the first visible card's photo only.
- Legal name: **"Platinum Wheels and Tire Solutions Inc."** everywhere (`SITE.legalName`; drop the footer's appended " Inc.").
- "No payment on this site" / privacy wording: **"Leave as is"**.
- "Winter sets, in stock now." and the starting prices: **"Keep both (record source)"**: the owner confirms they are real; record that.
- Dependency scanning: **"Not now"**.
- Brand and size hub pages: **"Not planned"**.
- Vendor reuse permission: **"Already have it"**: record the owner's statement (the D129 / ANKUSI precedent).
- Phone product photo: **"Yes, shorter photo"** so `Add to cart` is on the first screen for long names (a drawn value at 390: DEVIATIONS row).
- Dovroad YS716 and Habilead H206 photos: **"park it and add in todo-last"**.
- LA-08 Neon password: **"Already done"** (production checked 200 afterwards).
- LA-07 quote emails: **"At cut-over (todo 14)"**.
- LA-09: **"Cancel test links now"**, through the database: the owner supplies the new database URL in a FILE (path given in chat, never the URL itself); cancel the 11 open demo links in one checked transaction.
- LA-10 legal pages: **"Launch as is"**.
- LA-11 Vercel Pro: **"not needed now"**.
- `todo.md` 7 firewall rules: **"Not now"**.
- `ADMIN_PASSWORD_HASH`: **"I'll do it before launch"** (stays in `todo.md`).
- Preview separation: **"Not now"**.
- Monitoring, runbook, DKIM/CAA/DNSSEC: **"None now"**.
- LA-05 placeholder bolt-pattern fallback: owner, verbatim: *"Do a market search and vendor search to fill whatever is poss"*: fill uncovered years by generation from free public sources (two sources each); placeholder only where nothing is found.


## Session 2026-10-05: status per item

Working from the prompt above. One line per item: applied / declined / waiting on owner / in progress.

- LA-05 fitment fill: applied. `scripts/data/vehicle-fitment-generations.csv`: 1,048 rows over 606 models (972 real, 76 `unknown`), two free sources each, 0 conflicts with ANKUSI's exact-year rows; tirewheelguide.com and other Wheel-Size-derived sites are rejected by the build. Owner, 2026-10-05: boltpatternhq.com counts as a source (*"Yes, keep it (Recommended)"*); a gap year takes the model's nearest real year (*"Use the nearest real year"*; equidistant takes the later year, derived), except inside an `unknown` range (two trucks under one name such as Ram 1500 2019 to 2024 and Bronco 2023+, a pattern change between real years such as Outback 2014, a single-source dissent). Of 7,528 offered model-years: exact 1,224, generation 3,979, nearest 1,656, unknown 167, no data 502; the D48 placeholder now answers none. Measured on the build (`/wheels`): 2026 Outback 5,066 (5x114.3), 2010 F-150 3,307 (6x135), 2021 Corolla 403 (5x100), 2014 Outback and 2022 Ram 1500 list all 29,837. Corolla: 5x100 for every offered year, owner *"make it 5x100"* (2015 to 2024 by generation row, 2025 to 2027 by nearest year). Still open: nearest-year carries a model's last pattern forward past its last real row unless a redesign was flagged.
- e2e revival: applied. `npm run test:e2e:fixture` (real embedded Postgres 17 from `tests/fixture/`'s own lockfile; PGlite's shared session failed the app's parallel queries; 126-product fixture, seeded payment links; strips real service settings) builds, runs `seo routes smoke error-boundary cart-send pay-states admin-save` on chromium-1440, then `seo` again with indexing on. Agent's runs: 128 passed, 2 skipped (by design), 32 passed with indexing on, three clean runs; smoke/routes/error-boundary also green on Firefox, WebKit, iPhone 15 Pro and 320. Other specs stay parked (old seed). Found and fixed: an unknown product slug's 404 carried two robots tags (product route metadata now `robots: null`; the spec requires exactly one). Waiting on owner: a quote sent within 3 s of opening the dialog is treated as spam and shows success with no email (D104/D123(7)); a password-manager autofill can beat that.
- Leftovers from 2026-10-04: neither finished. No `vehicle-fitment-generations.csv`, empty `tests/fixture/`. Both re-briefed (items LA-05 fill, e2e revival): in progress.
- A1 shorter phone product photo: code applied (`pdp-gallery-band` below 720: `max(240px, 100svh - 482px)`, DEVIATIONS #117); measured on the production build: centre cap at 390×844 gallery 362, `Add to cart` ends 830; tire `yokohama-advan-fleva-v701-215-40r17-87` at 375×812 gallery 330, ends 800; at 360×740 gallery 258, ends 728; each hit-tests to the button, no sideways scroll. Morph snapshots keep their aspect (`block-size: auto`); not frame-sampled with a photo. Known limit: phones under ~722px tall (e.g. 375×667) hit the 240px floor and still end below the fold.
- A2 preconnect + first-card priority: code applied (`layout.tsx` preconnects to the `PHOTOS_BASE_URL` origin, no `crossorigin`; results best grid `priorityCount` 3 → 1; home featured row had no priority, hero keeps its own); measured: one `<link rel="preconnect">` to the photo origin in `<head>`; `/tires` has exactly one `fetchpriority=high` card photo; home hero keeps its own.
- A3 legal name `Platinum Wheels and Tire Solutions Inc.`: code applied (`SITE.legalName`; footer no longer appends ` Inc.`; terms meta description names `SITE.name` to avoid `Inc..`; `todo.md` S5 deleted). Measured: `/`, `/about`, `/privacy`, `/terms`, `/tires` render the full name with no `Inc. Inc.` or `Inc..`.
- A4 look-alike cards: applied (DEVIATIONS #118). The card size line appends the same telling fact as the page title (`siblings.ts`) when a sibling shares the rest: 8,642 wheels, 812 accessories, 87 tires on the local copy. One extra read per page beside the photo read (no window function: it would rank the whole category first and miss siblings the filters hide); +5 to +40 ms a page on PGlite, about +90 ms on the 150-card `Load more` window. The cart line and quote emails carry the fact too. Measured: `/wheels?brand=Braelin&diameter=22` cards read `… · Dark Grey · Centre bore 72.6 mm`; grid rows stay aligned when one card's line is longer.
- A5 undrilled wheels: no vendor site offers an undrilled/blank filter (PRO WHEELS' bolt-pattern options are 50 real patterns; DAI has only Year/Make/Model; Vertex unreadable, has none of the 386), so per the owner's ruling only the spec row: a wheel with no bolt pattern reads `Bolt pattern: Undrilled, drilled to order` (386 wheels: 299 PRO WHEELS vendor value `BLANK`, 87 Auto Country named `blank` or `0x0`). Measured: `sentali-forged-sf-1-26x14-et-76-polished` shows `Bolt pattern: Undrilled, drilled to order`.
- A6 PDP Finish row `W/` → `with`: code applied (`expandWith` reused on wheel Finish, Finish family, Colour and accessory Finish; only wheel finish carries `W/`, 2,769 rows). Measured: the Black Rhino Warlord page reads `Matte Black with Machined Dark Tint` in the title, size line and Finish row; no `W/` left in `<main>`.
- B7–B9 data: applied in the builder and in production. Builder (`scripts/catalog-csv-build.ts`): M10 descriptions are a curated per-listing table (`DESCRIPTION_TRIMS`, 270 entries) that may use only the vendor text's own words plus joining words, checked at build; dashes 46 → 0, wrong-season phrases 47 → 0, 5 descriptions blanked for naming another tire's size, none blanked for marketing; M11 load-index plausibility (8 model codes corrected from Falken and Nitto maker pages, 26 products blanked, the speed letter blanked with them); M12 lug bolts (14 retyped); 21 model spellings folded (10 same-size pairs a fresh load would merge stay two products in production). Production, 2026-10-05, owner: *"go ahead"*: one checked transaction, UPDATE only, keyed by slug and guarded by the old value plus vendor + SKU: description 273, model 53, name 14, load_index 34, speed_rating 33, accessory_type 14 (421 changes on 370 products), 0 skipped; a re-run reads all "already new"; the live Atrezzo 4S page shows the new text. Before/after for every description: session scratchpad `data/descriptions-review.csv`.
- C10 demo links: applied 2026-10-05 in production, one checked transaction (owner chose *"All 12 (Recommended)"*: the 11 open plus one active-but-expired). Same change as the admin's Cancel: status `cancelled`, `cancelled_at`, `cancelled_by = admin`, `updated_at`, one `link.cancelled` event each. Links now: 13 cancelled, 3 paid (demo sales; voiding them in Converge stays the owner's, `todo.md` P10); events 86 → 98. Settings file `~/.pw-prod-db.env` (outside the repo, mode 600).
- C11 Mud & snow: zero lost. The loaded CSV (39,961 rows) carries the label on 610 tires and no wheel or accessory; production has migration 0005 applied and no label left in any `extra_specs`. Closes the Batch 3 row.
- C12 Batch 3 in production: applied (see B7–B9).
- Dovroad YS716 and Habilead H206 photos: applied 2026-10-05 (owner: *"go ahead … do the work needed"*) with `catalog-photos.ts` from Wheel Works' own files: stored once in R2 (`catalog/tires/<hash>-1000/-480.webp`), linked by slug + vendor + SKU (479, 866); both live product pages show them. `todo.md` item 15 deleted; item 11 updated (R2 keys are in Vercel; rotate the token). Item 9 re-added: the Neon password and the R2 secret were read into this chat via the attached settings file.
- D13 `todo.md`: applied. Item 2 at cut-over, Production only; item 9 deleted (owner: *"Already done"*); S1 points at item 14; new last item 15 (Dovroad YS716 / Habilead H206 photos, owner: *"park it and add in todo-last"*).
- D14 owner statements (starting prices and "in stock now" have a real source, owner: *"Keep both (record source)"*; vendor reuse permission, owner: *"Already have it"*): recorded here, in `src/lib/llm.md` (`STARTING_PRICES`) and `src/features/home/llm.md`; decision row D153.
- D15 decision IDs: assigned D146 to D154 in root `llm.md` §5b (D146 pay return and the demo links, D147 quote cap, D148 cart prompt, D149 fitment, D150 photos, D151 Batch 2 code, D152 Batch 3 data, D153 UI and records rulings, D154 e2e fixture).
