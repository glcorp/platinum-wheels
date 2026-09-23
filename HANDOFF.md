# Platinum Wheels — session handoff

**Admin section — built 2026-09-21 on branch `admin-ui`, merged to `main` 2026-09-23 (D89–D94).** A
staff tool at `/admin` (destined for `admin.platinumwheels.ca`): a stub sign-in gate and a payment-link
builder, UI only. It was built in a parallel session against the pre-D58 tree, first numbered D58–D63 and
renumbered at integration — **those numbers were never published for admin**; D58–D63 are the storefront
rows. **None of the admin code has been compiled, typechecked or rendered**: the machine it was written on
has no `node_modules`, and the owner verifies on Vercel previews. **It was merged to `main` before any
build, by owner instruction** — *"the project is still in dev with no real user so we can merge our branch
into main without testing"* (2026-09-23). If a `main` build breaks, suspect `src/app/admin/` and
`src/features/admin/` first. See §5, §6 item 0, §7.

**Admin sign-in hardened 2026-09-23 on branch `admin-auth-hardening` (D95).** The session cookie was the
constant `"1"` (anyone could set it by hand) and `createPaymentLink` checked no session at all. The branch
adds a signed `__Host-` cookie, a scrypt password hash, a CSRF token and origin check on every admin Server
Action, `/admin` security headers and audit log lines. **This branch is the first time the admin code was
compiled, built and run:** `npm run check` and `next build` are clean, 43 curl probes against `next start`
pass, and the JS form path was driven in a browser (§5). It has not run on Vercel, because every
deployment of a commit authored by `garvbareja` is **blocked** (§7). Not merged to `main`; a parallel
session is working on admin payments in the `payments` worktree.

**Admin subdomain and host routing 2026-09-23, branch `admin-host-routing` stacked on
`admin-auth-hardening` (D96–D98).** `admin.platinumwheels.ca` is live on Vercel through one DNS-only
Cloudflare CNAME, verified from outside: Vercel IPs, a Let's Encrypt certificate, `/admin` → 307 →
`/admin/login` (D96). `src/proxy.ts` sends every other path on that host to `/admin` and 404s `/admin` on
every other host, production only (D97). Its rules pass 8 unit tests, but it has **never been built or
observed on Vercel** — this branch's deployments are blocked exactly like session 7's (§7). Until a build
runs, the live subdomain serves production `e032b6d`: the storefront at `/`, the pre-D95 admin at `/admin`.

**Last updated 2026-09-23 (session 8: admin subdomain and host routing, D96–D98).**

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
| `/results` · `/wheels` · `/accessories` | **One** composition, `results/components/results-page.tsx`, called by three thin `page.tsx` with a `category` (D58). URL-driven search over that category's seed (D44): `ResultsToolbar`, `FilterSortBar`, `md:results-grid` (rail + grid), `CallCtaPanel`. Parity `design/reports/results.md` covers `/results`; the other two are **not parity rows** and inherit it by rendering the same tree (`DEVIATIONS.md` #49). |
| `/products/[slug]` | `productView(product, searchParams)` → one `ProductView`; breadcrumb, `pdp-split` gallery + sticky buy panel, specs, quote band, similar row. Parity `design/reports/product.md`. |
| `src/features/product/` | `types.ts`, `view.ts` (all derivation), `actions.ts` (`"use server"`), **10** components; one island `quote-form.tsx`. Two authored states in their own modules so `/styleguide` renders the real thing: `quote-success.tsx` (D51) and `quote-error-summary.tsx` (D57). |
| `src/features/results/` | `types.ts`, `query.ts`, `search.ts`, 9 components (D58 added `results-page.tsx`); islands `sort-select`, `filter-panel`, `filter-sheet`. D42–D49, D58, D59. **Nothing here branches on the category** — components read `view.facets`, and what differs is data in `catalog/categories.ts`. |
| Finder | `src/features/finder/` — native selects, GET to `ROUTES.results` by default with `action`/`cta` overrides (D27/D28/D58); `variant="inline"` for `Change vehicle` (D45); **placeholder `FITMENT` map** now carrying a **bolt pattern** as well as a tire size (D48, D58). `/wheels` submits to `/wheels`; `/accessories` renders no finder at all (D59(2)). |
| Catalog | `FEATURED_PRODUCTS` (4), `PRODUCTS` (9 tires), **`WHEELS` (9)** and **`ACCESSORIES` (9)**, one unavailable each, plus `ALL_PRODUCTS` / `productsIn()` (D43, D58). `Product` gained optional `category` (**absent = tires**, which is what keeps every measured tire row byte-identical), `wheel`, `accessoryType`; plus `productCategory()` and `productImageSrc()`. **`categories.ts` is the per-category table** (`CATEGORY_CONFIG`) read by `results/`, `product/` and `ProductCard` — it lives in `catalog/` because D37 routes cross-feature imports through there, and it imports no seed so a client island can use it. `ProductCard` is the most reused component in the build and is unchanged on all three categories. |
| Chrome | `site-header`, `site-nav-drawer`, `site-footer` (no social row, D34), `page-stub`. Skip link in `layout.tsx` (D57). |
| Primitives | **Ten**, hand-built and token-only in `src/components/ui/`. Every variant and state is on `/styleguide`. Neither the PDP, nor D57, nor D58 needed a new primitive — D58 added exactly one optional prop, `Price.unit`, defaulting to the drawn tire string. |
| `globals.css` | **719 ln**: tokens, role utilities, the home/results/product layout utilities, and the three D57 accessibility utilities (`tap-extend-lg`, `hide-scrollbar`, `skip-link`). The dead `--container-rail` token was removed 2026-09-21 (D61, audit S5). **Single writer: the coordinator.** See §9. |
| `/styleguide` | §11 carries the undrawn states, now **complete** (D62): empty results, open `Change vehicle`, quote-form **success** and **error**, the **skip link** (Tab into its demo box to reveal it), the **route error** and the **loading** skeleton. |
| Undrawn states | `loading.tsx` and `error.tsx` at `(storefront)/` (D62). The boundary component is `src/components/site/route-error.tsx`; `error.tsx` is the directive plus a re-export and is the **only** `"use client"` under `src/app/` — a framework requirement, named as an exception in `.claude/rules/ui.md` and `docs/decisions.md` §4. `loading.tsx` renders a `<div>`, not a second `<main id="main">`. |
| `design/reports/` | 11 files: `README.md` (protocol), three `<page>.md` parity baselines, `audit.md` + four `*-audit.md`, **`deviations-sweep.md`** (D64) and `llm.md`. |
| `.claude/rules/ui.md` | Taste dials + JSX non-negotiables. **Auto-loads on every `src/**/*.tsx` edit.** Nothing imports it; it loads by glob, and its length is paid on every UI edit. |
| `/admin` | Payment-link builder behind the stub gate: `AdminTopBar` + `PaymentLinkForm`. Amount + description only, no computation (D92). |
| `/admin/login` | Flush-left 420px sign-in column, username + password (D91). Redirects to `/admin` if already signed in. |
| `/admin/styleguide` | The admin's authored states (D93), gated. Renders the real components inert. |
| `src/features/admin/` | `types.ts` (contract), `session.ts` (one shared sign-in, hardened by D95: scrypt hash, signed `__Host-` cookie, CSRF + origin checks), two `"use server"` actions that call `requireAdminAction()` first, 6 components; islands `login-form`, `payment-link-form`, `copy-link-button`. `scripts/hash-admin-password.mjs` makes `ADMIN_PASSWORD_HASH`. |
| Stubs left | `/about`, `/privacy`, `/terms`, 404. Undesigned (D26/D39). `/wheels` and `/accessories` left this list on 2026-09-21 (D58). |

---

## §5. Verification state

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
  malformed-hash configs behave as documented; no credential ever reaches the log. The JS action path
  (generate a link, sign out) was driven in the browser pane with a minted session cookie. **Never
  observed:** the D89 layout items in §6 item 0, and any of it on a Vercel deployment.
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

**Scope is UI only (D54).** Three items are **parked, not owed** — see §7. Do not reopen one as a blocker
and do not quietly implement it. A page is done when the `docs/decisions.md` §9 gates are green *except* a
parked row.

**Admin, before anything else on that branch:**

0. **Verify the admin on Vercel, once deployments are unblocked (§7).** The Vercel project exists:
   `platinum-wheels` on team `platninumwheels`, production URL `platinum-wheels-one.vercel.app`, and
   `ADMIN_USERNAME`, `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` are set for Production and Preview.
   `admin-auth-hardening` can merge as is: without `ADMIN_PASSWORD_HASH` the plaintext `ADMIN_PASSWORD`
   keeps working (D95's fallback). Switching to the hash is **deferred by the owner** (§7). **Never observed:** the `$` / `CAD`
   adornments on the amount field at 390 and ~810 (the `pl-*`/`pr-*` longhand must beat `Input`'s
   `px-*` shorthand, reasoned from Tailwind's emission order, not seen); the top bar's logo sharing a left
   edge with the page `<h1>` across 720–1099; no horizontal overflow on the three admin routes. **On the
   first unblocked production build, check the host rules live (D97):** `admin.platinumwheels.ca/` and
   `/results` → 307 `/admin`; `admin.platinumwheels.ca/admin/login` → 200; `platinum-wheels-one.vercel.app
   /admin` → 404; storefront pages on the vercel.app host unchanged.

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
5. **Push.** `origin/main` is at `0a4a3aa`; the handoff commit on top of it is local only.
   Confirm with `git status -sb` — the owner may already have pushed it.
6. Replace the **three** remaining stub routes when the client supplies copy — undesigned, so they need the owner before
   they need a session.

---

## §7. Open

**Admin and hosting (D89–D95):**

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
- **`src/proxy.ts` is written but unobserved** (D97). Host routing only — the D95 gate is still the only
  gate. `noindex` stays in both the layout meta and the `X-Robots-Tag` header.
- **Every Vercel deployment of our commits is BLOCKED.** The `platninumwheels` team is on Hobby with one
  member, `platinumwheelsca-5555` (GitHub `glcorp`); commits are authored by GitHub `garvbareja`, who is a
  collaborator on the GitHub repo but not a member of the Vercel team, and Vercel checks team
  membership. Pushing works; only the build is refused, and production keeps serving its last good
  deployment (`e032b6d`, built at import). Fix: move the team to Pro (Hobby is also non-commercial only)
  and invite `garvbareja`'s Vercel account. Owner.
- **No PSP.** `createPaymentLink` fabricates a URL (D94); the success panel says so on screen, and that
  notice is mandatory.
- **Product CRUD** is deferred until the vendor catalogue settles the schema.
- **No `/admin` error or loading boundary** — `(storefront)/error.tsx` does not reach it, and its component
  speaks to customers. `src/app/admin/llm.md` Open #3.
- Session length (12 h) and the admin's `sm:` padding ramp were coordinator calls; both vetoable. Full list:
  `src/features/admin/llm.md` Open.

**Parked by D54 — recorded, not owed, not blockers:**

1. **The quote form has no destination.** `actions.ts` validates and returns success, then discards the
   inquiry; delivery is a marked `TODO`. The UI half is complete and measured. (root `llm.md` §7.15)
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
