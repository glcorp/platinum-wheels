# Platinum Wheels — project library (root)

**What this is.** The living, canonical record of this project for any LLM session or human who touches
it. Every folder that matters has its own `llm.md` written to the template in §2. This root file is the
index, the decision register, and the rules for keeping the library true.

**Why it exists.** The project is shared between two founders. It is a git repository as of 2026-09-21
(D55), but git records *what changed*, never *why* — and every decision before that date has no commit to
sit in. Without this library a fresh session re-derives context, guesses, and introduces bugs. The library
records *decisions, purpose, rules, connections* — never conversation logs, and never a changelog git
already keeps.

**Read this before editing anything.** Then read the `llm.md` of every folder you are about to change.

---

## 1. Rules for using and maintaining the library

1. **Read before write.** Before editing a file, read the `llm.md` in its folder and in each parent up
   to root. If the change contradicts a rule there, stop and ask the owner; do not edit the rule to fit.
2. **Same-change maintenance.** Any edit that adds, removes, renames, or re-purposes something in a
   folder updates that folder's `llm.md` in the same change. A new folder gets an `llm.md` before its
   first file. No hook enforces this; the rule is the enforcement.
3. **Sourcing.** Every statement in an `llm.md` traces to one of: a file (`path:line`), a decision ID
   (`D<n>` from §4), or an owner instruction quoted verbatim. Anything that cannot be traced is not
   written; it goes to the folder's **Open** section as a question.
4. **Pointers, not copies.** Folder files hold only folder-scoped rules and decisions, and point to the
   canonical row elsewhere (`D14`, `design/DEVIATIONS.md #5`, `docs/decisions.md §7`). Long-form
   reasoning lives once, in the document that owns it. Two copies drift.
5. **Decision IDs are global.** `D1`–`D22` were assigned in `HANDOFF.md` §11 and are frozen there. New
   decisions continue from `D23` in §4 of this file. Never renumber.
6. **Owner rulings are verbatim.** Quote the owner's words exactly, in quotation marks, with the date.
   Derived rulings (made under the authority chain without asking) are labelled *derived* and the
   owner may veto them.
7. **Not a log.** Do not record what was tried, what a session felt, or how long something took.
   Record what is true now, why, and what depends on it.
8. **Delete, don't strike.** When a decision is superseded, update the row to say so and point at the
   new ID. Keep the old ID; never delete a row.

---

## 2. Template for a folder `llm.md`

```markdown
# <folder path>

## Purpose
One paragraph: why this folder exists and what would break if it were deleted.

## Owns
One line per file or file-group: what it is, one sentence. Link to the file.

## Rules
Bullet list. Non-negotiables for anything written into this folder. Each cites its authority.

## Decisions
| ID | Date | Decision | Why | Authority |
Folder-scoped rows only. Global rows are referenced by ID, not restated.

## Connects to
- Depends on: <folders/files this folder imports or reads>
- Depended on by: <folders/files that import or read this one>

## Don't
Bullet list. Things that look reasonable and are wrong here, each with the reason.

## Open
Questions nobody has answered, or work the folder is waiting on. Each names who can answer.
```

Sections may be empty but must be present. Keep each file under ~120 lines; if it grows past that,
the folder is doing too much or the content belongs in a canonical doc it should point to.

---

## 3. Project in one paragraph

A quote-first storefront for Platinum Wheels and Tire Solutions, Brampton, Ontario. Next.js 16.4
canary App Router, React 19.3, TypeScript strict, Tailwind v4 configured entirely in
`src/app/globals.css`. Three designed routes (`/`, `/results`, `/products/[slug]`) plus `/styleguide`, and since **D58**
two more undesigned ones — `/wheels` and `/accessories` — which share the `/results` composition.
The design is a Claude Design export: `design/DESIGN.md` (spec) and seven artboard HTML files in
`design/assets/` (theme "Track Night", `#0B0B0D` + acid lime `#C9F23A`). No cart, no checkout, no
stock counts, no invented social proof (`docs/decisions.md` §7–§8). Parity with the artboards is
measured, not eyeballed (`docs/decisions.md` §9). State as of 2026-09-20: tokens, fonts, primitives and
`ProductCard` exist and pass all gates. **`/` is built** (2026-09-20) with measured parity at 390 and 1440 (`design/reports/home.md`); planned routes have stub pages (D39). **`/results` is built** (2026-09-21, D42–D47, `design/reports/results.md`, DEVIATIONS #25–#35). **`/products/[slug]` is built** (2026-09-21, D50–D53, `design/reports/product.md`, DEVIATIONS #36–#43): all three designed routes now exist. **The `audit` pass is done** (2026-09-21, D56, `design/reports/audit.md`) — report-only, 10 genuine defects found; **six were then approved and applied (D57)**, the rest remain open. Lighthouse and the keyboard walk are done on all three pages. **Wheels and accessories joined the scope** (2026-09-21, D58/D59): `/wheels` and `/accessories` stopped
being stubs and became full results pages rendering the **same** component tree as `/results`, differing
only in their filter groups and their nine-SKU placeholder seeds. The PDP serves all three. No new
primitive, no new layout, no parity drift — verified in the browser. **The last two undrawn states, `loading` and route `error`, are authored** (2026-09-21, D62), which
completes `/styleguide` §11. The safe half of the audit fix list is applied (D61). Remaining: **S2**, the
class-merge consolidation the owner reserved to themselves, and the client-owed data.

---

## 4. Authority chain (settles every conflict)

```
1. docs/decisions.md        HOW things are built: stack, rendering, mobile, business rules, gates
2. design/assets/*.html     measured values, layout, copy         ← wins on any number
   design/DESIGN.md         type roles, composition, motion       ← wins where artboards are silent
3. supporting skills        fill gaps, check, polish; never change a defined token
```

Where spec and artboards give different numbers for the same thing, the artboards win. Where the
artboards are silent, the spec governs. Where the spec asks for an element the artboards do not
contain, **ask the owner** (precedent: D7). Full text: `docs/decisions.md` §1.

---

## 5. Decision register

### 5a. Frozen — D1–D22 (canonical text in `HANDOFF.md` §11; one line each here)

| ID | Decision | Where |
|---|---|---|
| D1 | Theme = Track Night (lime); later dissolved, spec agrees | HANDOFF §4a |
| D2 | Source lives in `src/`; `@/*` → `./src/*` | HANDOFF §4a |
| D3 | **No git.** Docs are the history — **superseded 2026-09-21 by D55** | HANDOFF §4a, decisions.md §10 |
| D4 | Hero = licensed Unsplash tread macro, `public/images/photos/hero-tread.webp` | ASSET-CREDITS.md |
| D5 | One-accent rule not enforced; ship artboards as drawn | decisions.md §1.1 |
| D6 | No sticky mobile PDP buy bar | HANDOFF §4a |
| D7 | Header as drawn: 64px badge, no wordmark, four nav items, no `Services` | DEVIATIONS #11 |
| D8 | WCAG control-boundary fix delegated → D14 | HANDOFF §4a |
| D9 | Wheel CSV is reference only; **no decision derives from it** | HANDOFF §9 |
| D10 | Breakpoints 400/720/1100/1320 from DESIGN.md §8 only | decisions.md §5 |
| D11 | Container 1344px, not 1320 | DEVIATIONS #3 |
| D12 | Chips radius 0 | DEVIATIONS #5 |
| D13 | Button tracking .08em / .04em | DEVIATIONS #6 |
| D14 | `--border-control: #69696F` on form controls only | DEVIATIONS #14 |
| D15 | Mobile textarea 16px | DEVIATIONS #12 |
| D16 | Focus ring offset 0 | DEVIATIONS #13 |
| D17 | Hover scoped to `@media (hover: hover)` | DEVIATIONS #10 |
| D18 | Routes `/`, `/results`, `/products/[slug]`, `/styleguide` | HANDOFF §4b |
| D19 | Product cut-outs normalised to one square canvas; never upscaled | HANDOFF §4b |
| D20 | Self-host Barlow + Barlow Condensed only | DEVIATIONS #2 |
| D21 | Price suffix per context: cards `/ tire`, PDP `per tire · before tax` | decisions.md §7 |
| D22 | Desktop copy at all widths; contact photo hidden <720, not removed | DEVIATIONS #8 |

### 5b. Live — D23 onward

All dated 2026-09-20 unless stated. Owner quotes are verbatim.

| ID | Decision | Owner instruction / basis | Consequence |
|---|---|---|---|
| **D23** | **This library exists.** One `llm.md` per folder in the set listed in §6; template in §2; rules in §1. | Owner: *"create … llm.md and place it inside each folder which should contain the decisions taken while creating that folder the rules for that folder why does this folder exist … a canonical list of decisions taken existence of the folder what purpose does it serve where all folders does it connect to … the intention is towards a shared project library with my co-founder."* Then: *"finish first finish making the llm.md then begin with the design and construction of the UI further."* | Library built before `page home`. |
| **D24** *(derived)* | Library shape defaults: pointers not copies; global IDs from D23; verbatim owner quotes; maintenance by rule, no hook; root `CLAUDE.md` imports this file via `@llm.md`; sub-folder files are read on demand under rule §1.1; ~~`HANDOFF.md` keeps a per-session **Part A resume block** at the top and a frozen **Part B**~~ — **superseded by D55b**: one current document, cited by `§`, with D1–D22 canonical in `HANDOFF.md` §8; this file is the living register; `README.md` rewritten to a short pointer. | Owner did not answer the ten shape questions and said to finish. Defaults chosen; **owner may veto any of them.** | Change any default by editing §1/§2 and this row. |
| **D25** | Sessions run as **coordinator + delegated implementation**. The main session plans and grounds; subagents implement with named files, absolute paths, and no `globals.css` writes. Folder `llm.md` authoring delegated to **Opus** agents. | Owner: *"you act as the coordinator and you delegate the task, implementation task to Sonnet 5 sub agents. You create the plan and code grounding."* Later: *"give other folder to opus instead of sonnet."* | Model per task is the owner's call; ask if unstated. |
| **D26** | **Links point at planned routes even before they exist.** Nav, tiles, cards, footer link to `/results`, `/products/<slug>`, etc. Stub routes may be created so nothing 404s. | Owner: *"assume they will exists, you can just link them and backend would be creates. you can create if needed"* | Supersedes the "no dead link" caution in D7 for *planned* routes only. Undesigned pages (About, Privacy, Terms, Wheels, Accessories) get minimal stub routes. |
| **D27** | **Finder Year/Make/Model gets a small seed list** built from public sources, stored in `src/features/finder/data.ts`, flagged as sample data. The wheel CSV stays untouched (D9). | Owner: *"you can make a small list yourself now, use excel if needed or scrape from online"* | Replace with real fitment data when the backend exists. |
| **D28** *(derived)* | **Finder ships unselected** with a placeholder option per select; the artboard pre-fill `2021 / Honda / Civic` is sample data and does not ship. Placeholder copy is new copy, authored under `.claude/rules/ui.md` "Copy". | Owner: *"take the call yourself"* on the pre-fill. Blocker list `design/DEVIATIONS.md` "Sample data" says replace. | Logged in `design/DEVIATIONS.md` when built. |
| **D29** | **Featured tires uses the four artboard SKUs** as seed data in `src/features/catalog/data.ts`, flagged as sample. Heading copy ships verbatim. | Owner: *"use the arboards one"* | Same seed feeds `/results` and `/products/[slug]` until real data exists. |
| **D30** | **Mobile featured carousel is functional:** native horizontal scroll with scroll-snap, arrow and dot progress wired, as a client island. Desktop keeps the two arrows as drawn. | Owner chose option *"a)"* from: (a) native scroll + snap, functional; (b) static as drawn. | Client island lives in `src/features/home/components/`. |
| **D31** *(derived)* | **Mobile nav drawer** = the four nav links + the phone CTA, full-screen, Esc closes, focus trapped, `dvh`. Nothing else is drawn or specified. | Owner: *"your call"* | DESIGN.md §8 "full-screen drawer"; contents undrawn. |
| **D32** | **Year is computed** at render: `Winter <year>` and `© <year>` derive from the current date, never hard-coded. | Owner: *"computed year"* | Replaces hard-coded `2026` in the artboards; logged in DEVIATIONS when built. |
| **D33** | **Home-only sections live in `src/features/home/components/`.** The finder is its own feature at `src/features/finder/`, per `docs/decisions.md` §3. | Owner: *"okay"* | Extends the HLD §3 feature list with `home`. |
| **D34** | **No social links yet.** The footer's three social squares are omitted until URLs exist. | Owner: *"none yet"* | Deviation from the drawn footer; logged when built. Precedent D7: no dead links. |
| **D35** *(derived)* | Three small home rulings: (1) mobile winter overlay literal `rgba(13,2,2,0)` → `transparent` (identical at alpha 0); (2) category-tile hover text shift to `--text-muted` via the export's global `a:hover` is **suppressed** — tile text stays `--on-photo`; (3) mobile how-it-works numeral without `tabular-nums` and title without tracking ship **as drawn**. | Extraction flagged (1) as the only non-token colour and (2) as "likely unintended" (`design/inventory/home.md:187`, `:394`). (3) is exact-match parity. | (1) and (2) go to `design/DEVIATIONS.md` when built. |
| **D36** *(derived)* | **Baseline asset fix.** The artboards reference `assets/logo/…` relative to themselves but live *inside* `design/assets/`, so every image on the `:4000` baseline returned 404 and photo parity was never measurable. Fix: `npm run design` now serves `design/` with `design/serve.json` rewriting each extensionless artboard URL to `assets/<name>.html`, so the artboards' relative `assets/…` paths resolve. URLs are unchanged (`/home-desktop`). No frozen file moved or edited. **A first attempt used a self-symlink `design/assets/assets → .`; Tailwind v4 scans the filesystem and the loop panicked Turbopack ("symlink causes an infinite loop") — never symlink inside a scanned tree.** Verified: all twelve artboard images load on `:4000`. | Found by the `design/` llm.md agent, 2026-09-20; confirmed by grep (`design/assets/home-desktop.html` `src="assets/…"`). | `design/reports/README.md` URL scheme unchanged. Any parity table written before this date measured type and geometry only. |
| **D37** *(derived)* | **`src/features/catalog/` is the shared product domain.** Other features (`home`, `results`, `product`) import `Product`, `ProductCard` and the seed data from it. `src/components/*` and `src/lib/` never import any feature. | No cross-feature import policy existed (`src/features/llm.md` Open #1); D29 requires `home/` to render `ProductCard`. | One-way graph: `app → features → catalog → components/ui → globals.css`. |
| **D38** *(derived)* | **Shared chrome is composed per page**, not hoisted into a group `layout.tsx`. Each route renders `<SiteHeader variant=…/>` and `<SiteFooter/>` itself. | The header is over-hero on `/` and solid elsewhere (`design/manifest.md` §1 row 2, §2 row 1); a layout would need per-route state. Pages stay thin (`docs/decisions.md` §3). | `src/app/(storefront)/llm.md` Open #1 closed. |
| **D39** *(derived)* | **Route map lives in `src/lib/routes.ts`.** Nav/tiles/footer targets: Tires → `/results`, Wheels → `/wheels`, Accessories → `/accessories`, Contact → `/#contact`, How it works → `/#how-it-works`, About → `/about`, Privacy → `/privacy`, Terms → `/terms`, Winter → `/results?season=winter`, products → `/products/<slug>`. Undesigned targets get minimal stub pages. `ProductCard` imports its hrefs from here. | D26 ("assume they will exists … you can create if needed"). No route is drawn (D18). | Stub copy is new copy under `.claude/rules/ui.md` "Copy". |
| **D41** *(derived)* | **Tablet band 720–1099 takes DESIGN.md §8 values where the table names one** (header 88 with links collapsed, hero 760 / h1 88, finder 2×2, page padding 32, section gap 80, 3-up featured, 55/45 splits, promo h2 56); where §8 is silent the 1440 value applies from `sm:`. Not parity rows; no artboard exists there. | The exports have zero `@media` rules (D10); §8 is the only responsive source. Promo h2 at 88px overflowed a 45% column at 768. | `design/reports/home.md` "Tablet band". |
| **D40** *(derived)* | **`Button` gains an `accent` variant** (1px `--accent` outline, `--on-photo` ink, lime fill on hover) for the header phone CTA, which no existing variant reproduced. Active/disabled/focus authored; see `src/components/ui/button.tsx`. | Drawn on all three desktop headers (`home-desktop.html:109`, `results-desktop.html:102`, `product-desktop.html:93`). | Add to `/styleguide` when the header lands. |
| **D42** | **Facet counts, the result count, `Filters (n)` and price bounds are computed from the catalog seed**, never typed. Brand rows = brands present in the seed; the three season chips always render; `Tires` carries the seed count, `Wheels`/`Accessories` none. | Owner chose *"Compute from seed"* over shipping the artboard's non-reconciling 8 brands / 18-42-9 / `12 matches · 6 similar` as sample copy (2026-09-21). | The desktop rail renders fewer brand rows than drawn; logged in `design/DEVIATIONS.md`. |
| **D43** | **The catalog seed grows to the artboard's nine SKUs.** Five sample SKUs (other sizes of the same four tires, one unavailable) join `src/features/catalog/data.ts` with size-suffixed slugs and a new optional `Product.image` (cut-out basename, defaults to `slug`) so four images cover nine SKUs as the artboards do. | Owner chose *"Add the 5 extra SKUs"* (2026-09-21). `image` is measured variation (`design/inventory/results.md` §3.10 "image src + alt"). | Still sample data (D29); the two low-res cut-outs and per-SKU photography remain client blockers. |
| **D44** | **`/results` state is the URL.** Filters (`width`/`profile`/`rim`/`season`/`brand`/`min`/`max`), `sort` and `show=all` are query params; the server filters the seed and renders every state. The rail/sheet form and the sort select are client islands that `router.replace` the new href on change; `Apply` / `Show N matches` submit the same form as a plain GET without JS. `Load more` is a `?show=all` link rendered only when cards are hidden. | Owner chose *"Functional, URL-driven"* over static-as-drawn (2026-09-21). | Contract in `src/features/results/types.ts`; `search.ts` is the only place results are computed. |
| **D45** | **`Change vehicle` is a `<details>` disclosure** whose summary is the underlined link as drawn; open reveals the existing `VehicleFinder` under the toolbar. No JS. The open state is undrawn and goes on `/styleguide`. | Owner chose *"Inline finder, no JS"* over linking to `/#finder` (2026-09-21). | `src/features/finder/` gains a second consumer (its llm.md "Connects to"). |
| **D46** *(derived)* | **Tablet band on `/results`: mobile arrangement to 1099, rail from `md:` 1100.** DESIGN.md §8 puts the sidebar at 720–1099, but 280px rail + 48px gap + 32px padding leaves 328px for a 2-up grid at 720 (156px cards). The sticky bar + sheet stay to 1099; the grid goes 2-up from `sm:` 720 and 3-up beside the rail from `md:`. | §8 is internally inconsistent at 720; D41 governs the band. | Not parity rows; noted in `design/reports/results.md` "Tablet band". |
| **D47** *(derived)* | Results rulings, each vetoable: (1) `call-cta-panel` is a results section in `src/features/results/`, not site chrome — closes §7.9; (2) **no fitment trust line on `/results`** — no results artboard draws one (D7 precedent: undrawn element → artboards), the HLD §7 line lands on the PDP quote band; (3) the filter sheet's `<dialog>` backdrop is `--scrim-mid` over the whole viewport including the header, as drawn; the export's extra `opacity:.35` on the page content is an artefact and is not ported; (4) sort options `Best match` / `Price: low to high` / `Price: high to low`, size selects default to `Any`, empty-results copy authored — all new copy under `.claude/rules/ui.md`; (5) without a vehicle in the URL the chip is omitted and the disclosure summary reads `Add vehicle`; (6) `Best matches` is the page `<h1>` at its drawn size, `Similar matches` an `<h2>`; (7) one load-more window at every width: 6 best + 3 similar (the desktop artboard), DESIGN.md §8's mobile `3 + 2` is read as a snapshot of the same list; (8) `best` = every given size part matches, `similar` = the rest of the filtered set when a size is given, else all results are `best`. | Coordinator, 2026-09-21, under the authority chain. | Each goes to `design/DEVIATIONS.md` where the shipped page differs from a drawn value. |
| **D48** | **The five results-page open items are delegated to the coordinator; data gaps get placeholder data.** (1) The mobile filter sheet stays a `<dialog>` (no `<details>` fallback); (2) Lighthouse is run by whatever headless Chromium the coordinator can obtain; (3) D46 and D47 stand; (4) a **placeholder fitment map** (vehicle → tire size) is generated and stored beside the finder seed so `year/make/model` drive the best/similar split until real data arrives; (5) the five extra SKUs keep reusing the four base cut-outs. | Owner, 2026-09-21: *"all 5 are upto you. for data related issues, they will be added later, use placeholder and temporary data genrated by you"* | Fitment map in `src/features/finder/data.ts`, flagged sample; consumed by `src/features/results/search.ts`. Replace with real data when supplied. |
| **D49** *(derived)* | **Count semantics on `/results`.** `N matches` counts the *best* list (exact size or derived fitment), `· M similar` the similar list; the sheet's `Show N matches` keeps the total because it counts the cards the sheet reveals. When best is empty but similar exists, the `Best matches` heading stays and a one-line note (new copy) points at the similar sizes; `ResultsEmpty` still owns the zero-results state. | With D48's fitment map a vehicle can yield 0 best / 9 similar; `total` as "matches" read `9 matches · 9 similar` above an empty grid. The artboard's `12 matches · 6 similar` does not reconcile with its 6 + 3 cards, so it settles nothing. | Coordinator, 2026-09-21. Vetoable. |
| **D50** | **The PDP quantity control is a URL param.** The four drawn cells (`1`, `2`, `4`, `Custom`) are links that set `?qty=`; the server renders the selected cell and the quote band's `Quantity` select defaults from it. No client state, no stepper, no numeric input, no cart. | Owner chose *"URL param ?qty="* over a client island or static-as-drawn (2026-09-21). | Same state model as `/results` (D44): works with no JS, survives a reload, and the buy panel stays a Server Component. `qty` is stripped from the breadcrumb's back-link. |
| **D51** | **The quote form is a real `<form>` posting to a Server Action** that validates and returns a `QuoteFormState`; `success` swaps the form for a confirmation panel. **Nothing is sent** — the delivery call is a marked TODO until the client supplies a destination. | Owner chose *"Server Action → success state"* over `mailto:` or inert markup (2026-09-21). | Closes the `form success` undrawn state still missing from `/styleguide` (`HANDOFF.md` §6.2). `quote-form.tsx` is the PDP's only client island. Where a submission goes is `src/features/product/llm.md` Open #1. |
| **D52** | **`Similar products` = same season first, current slug excluded, capped at 4**, falling back to the rest of the seed when a season yields fewer than four. | Owner chose *"Same season, exclude self"* (2026-09-21). | Fixes the artboard, whose third card is the PDP subject in another size — flagged at `design/inventory/product.md` §7.6 as something a real feed should not do. Logged in DEVIATIONS. |
| **D53** *(derived)* | Seven PDP rulings, each vetoable: (1) **the spec table is derived from `Product`**, never typed — `size` splits on ` · ` into `Size` and `Load / speed`, `Season` comes from the badges, `3PMSF` from the boolean, the same principle as D42; (2) one optional **`studdable?: boolean`** joins `Product` so the drawn `Winter (studdable)` is reproducible — it is *not* added to `badges`, which would put a second badge on that card and break `/results` parity; (3) **`M+S` is derived from the winter badge** and flagged sample until real sidewall data exists; (4) **the gallery ships as drawn** — one image, no thumbs, dots, arrows or zoom (the inert `gap:12px` is a slot, not an instruction); (5) **the mobile similar-products track ships scrollable** with snap and no arrows, on the D30 precedent, where the export's `overflow:hidden` is a snapshot artefact; (6) **the breadcrumb's `Results` crumb carries every inbound param except `qty`**, and `year`/`make`/`model` drive the quote chip's vehicle half; with no vehicle in the URL both the chip and the fitment sentence genericise rather than invent one (D47(5) precedent); (7) **the `Preferred contact` segmented control is a native radio group**, and its drawn double right edge (every segment carries `border-right`, including the last) is an export artefact and is not ported. | Coordinator, 2026-09-21, under the authority chain. | Each goes to `design/DEVIATIONS.md` where the shipped page differs from a drawn value. |
| **D54** | **This engagement is UI only. Anything needing a backend, real data or a build-wide performance change is parked, not owed.** Parked on 2026-09-21: the quote form's delivery destination (§7.15), the PDP unavailable state (§7.16) and the LCP gate (§7.12). They stay recorded as Open items and are **not** blockers on any page being called done. | Owner, 2026-09-21: *"we are just building ui so park these"* | `docs/decisions.md` §9's "a page is done when the gates are green" now reads: green **except** a parked row. A parked item is revisited only when the owner unparks it — a later session must not reopen one as a blocker, nor quietly implement it. |
| **D55** | **This is a git repository. D3 is superseded.** Initialised 2026-09-21, branch `main`, remote `origin` = **`https://github.com/glcorp/platinum-wheels` (private)** on the owner's GitHub account `glcorp`; commits are authored as `glcorp <admin.glcorp@gmail.com>`, set repo-local only. The whole tree at that date is one initial commit; nothing before it is reconstructible, so every pre-2026-09-21 statement in this library stands as the only record of its own history. Four shape rulings: (1) `design/assets/**` is committed in full (29 MB of frozen source PNGs — it is authority level 2 and must travel); (2) `.claude/skills/` is committed **except** `impeccable/scripts/bin/`, whose 12 MB `darwin-arm64` binary is machine-specific — the committed launcher `scripts/impeccable` resolves a binary from `$IMPECCABLE_BIN`, `~/.impeccable/bin`, the version cache or `PATH` on any other machine; (3) `.claude/settings.local.json` is **renamed to `settings.json` and committed**, so the two impeccable design hooks reach the co-founder — this closes old Open #8; (4) `.impeccable/` (hook consent + cache) is machine-local and ignored. | Owner, 2026-09-21: *"i want to setup git repo for this project. how to proceed"*, then chose **Local repo now, remote later**, **Commit skills, ignore bin/**, **Yes — move to settings.json**, and **I'll configure [the git identity] myself**. | Library rules §1.2 and §8 are unchanged: git does not replace same-change `llm.md` maintenance, and a superseded decision is still marked in place, never deleted. `HANDOFF.md` §4 keeps D3's canonical text frozen and untouched (D24). Docs that justified a practice *because* there was no history — the kept `DESIGN.superseded-cinematic-red.md`, the parity reports as rollback safety — keep the practice; only the stated reason changes. |
| **D55b** | **`HANDOFF.md` is one current document with stable `§` anchors.** *(Disambiguated 2026-09-21, D61: this row and the git-repository row above were both numbered `D55`. Rule §1.5 forbids renumbering, so the ID is not reassigned — the suffix `b` distinguishes the two in place, and D24's citation of "D55" for the HANDOFF half means **this** row. Every existing citation of `D55` for the git ruling still resolves.)* The frozen `Part A` / `Part B` split is dissolved: Part A's per-session resume block, Part B's still-true reference material and the gotchas are merged into §1–§9; **§11 keeps the canonical text of D1–D22 verbatim and is never edited**; §10 keeps the session-1 owner quotes and §12 the wheel-CSV profile. **Cite it by section, never by line.** All 16 line-number citations in `.claude/*/llm.md` were repointed to `§` anchors in the same change. 479 → 300 lines. | Owner, 2026-09-21: *"hand of this session with all the context decision made further steps so that at the next session can start from here … compact the exisitng handoff documents if needed"*. The old scheme pinned Part A to exactly 135 lines so Part B's cited lines would not move — and the citations had broken anyway: six pointed into Part A, which is rewritten every session, and `:141` was ~16 lines off. | Supersedes the `HANDOFF.md` shape half of **D24** (that row now points here). Nothing may reintroduce a line-pinned section. A future session edits §1–§9 freely and leaves §10–§12 alone. |
| **D56** | **The `/design-to-code audit` pass ran on 2026-09-21 and is report-only.** SKILL.md §9 ("change nothing unless the user says to") was followed literally: **no file under `src/` was modified.** Four Sonnet sub-agents audited disjoint scopes (`home`/`results`/`product`/shared) and were forbidden the browser, so the single shared pane stayed with the coordinator, who measured every gate live. Output: `design/reports/audit.md` (the index, the measured gate table, a **checked and cleared** list of non-defects, the merged fix list, and the pass's coverage limits) over four `*-audit.md` files. Result: **10 genuine defects, 1 item needing a ruling, 4 taste items, 0 parity drift.** Five of the ten are site-wide accessibility gaps the coordinator measured in the browser and no static pass or Lighthouse run had caught. **The fix list is not authorised** — the owner approves items individually. | Owner, 2026-09-21, choosing **"Report, then you approve fixes"** over applying them, and **"Audit only"** for the session's scope. | `HANDOFF.md` §6 item 1 is done. Nothing in the fix list may be applied without the owner naming it. Lighthouse a11y scores 100 on all three pages and still misses every one of C1–C5, so **that gate is not evidence of accessibility** — see `audit.md` §4 C1. |
| **D57** | **Six audit findings applied; the rest of the D56 list is not authorised.** Applied 2026-09-21 after the owner approved them individually: **C1** a `skip-link` in `layout.tsx` plus `id="main" tabIndex={-1}` on all five `<main>` elements (WCAG 2.4.1 Level A); **C2** `aria-live="polite" aria-atomic="true"` on the `/results` count and a `role="alert"` summary on the quote form — the build had **no live region anywhere**; **C3** focus moves to the first invalid field on a rejected submit; **C4** breadcrumbs move from `tap-extend` to a new `tap-extend-lg` (±16px), measured **37px → 45px**, and `DEVIATIONS.md` #41 is corrected in place because it specified the wrong utility and miscited #16; **C5** `aria-label="Menu"` on the nav-drawer `<dialog>`; **S1** a shared `hide-scrollbar` utility now used by both carousels, with `similar-track` no longer hiding its own. Three new `globals.css` utilities (`tap-extend-lg`, `hide-scrollbar`, `skip-link`), written by the coordinator as single writer (D25); the six `.tsx` edits were delegated to two Sonnet agents on disjoint files. **Also ruled: `sort` on `/results` stays JavaScript-only** — an addendum to D44, which promised the plain-GET path for the filter form and never for the sort island. **Both new undrawn states are on `/styleguide` §11**, as `.claude/rules/ui.md` "States the design doesn't show" requires: the skip link (in a `relative` demo box, revealed by Tab, matching the page's own convention for focus states) and the form error summary, which was extracted to `quote-error-summary.tsx` so the reference page renders the real component inert rather than a copy that drifts — the `QuoteSuccess` precedent. **Not applied, still open: S2** (the 13 class-merge helpers, reserved to the owner by §7.10), **S3, S4, S5** and every taste item. | Owner, 2026-09-21, choosing **"C1–C5, the accessibility five"** and **"Hide the scrollbar; sort stays JS-only"**. | Verified in the browser, not claimed: Tab lands on the skip link and Enter moves focus into `<main>`; the crumb band hit-tests at 45px; the count carries a live region; an invalid submit focuses `quote-email` and announces "2 fields need a fix"; the success path still takes focus. **No parity drift** — home `h1` at 1440 is still identical to the `:4000` baseline on all seven properties; no overflow at 375/768/1280/1440 on any route; `npm run check` and `npx next build` clean; slop grep zero; still exactly **six** `"use client"` files and **one** `"use server"`. |
| **D58** | **Wheels and accessories are in scope, as two more results categories.** `/wheels` and `/accessories` stop being stubs and become full results pages: the **same** composition, sections, primitives, utilities, grid, card, PDP and layout as `/results`, with **only the filter groups and the seed** differing. Mechanism: one per-category table, `src/features/catalog/categories.ts` (`CATEGORY_CONFIG`), read by `results/`, `product/` and `ProductCard`; one composition, `src/features/results/components/results-page.tsx`, called by three thin `page.tsx` files. `Product` gains optional `category` (**absent means tires**, so every measured tire row is byte-identical), `wheel: WheelSpec` and `accessoryType`. Per category: **tires** filter Width / Profile / Rim + Season, price per tire; **wheels** Diameter / Width / Bolt pattern + Finish, price per wheel, offset is a spec row not a filter; **accessories** have **no size group at all** — four filter groups instead of five — plus Type, price per item. Nine placeholder SKUs each (D48), one unavailable per category. A vehicle in the URL derives a tire size on `/results`, a **bolt pattern** on `/wheels`, and nothing on `/accessories`. | Owner, 2026-09-21: *"also add wheels and accessories to scope. keep them same as tires. only filters and skus change but everything else remains as it is."* Then, choosing from four options: **three category routes** over one `?category=` param; **Diameter / Width / Bolt pattern, then Finish** over swapping in Offset; **drop the size group on accessories** over a `Fits` select; **one `Product` type with an optional category** over a discriminated union. | `ROUTES` is unchanged, so every existing nav item, tile, footer link and card href already pointed at the right place (D26/D39). The catalogue is no longer tire-only, which narrows root `llm.md` §7.3 without closing it. New client blockers in §7. |
| **D59** *(derived)* | Seven rulings under D58, each vetoable: (1) **the Category table row label, the breadcrumb crumb and the route are written out per category**, never derived by capitalising the category key — the key is an identifier, the label is drawn copy; (2) **`/accessories` renders no vehicle finder and no vehicle chip** — an accessory derives nothing from a vehicle, so `Change vehicle` there would be a control that changes no result (D47(5) precedent); `/wheels` keeps it and submits to `/wheels` with the CTA `Find my wheels`; (3) **only the current category's row carries a count** in the Category group — the artboard draws a count on `Tires` alone, and counting another category through filters it does not share is a number nobody can check (D42); (4) **wheel and accessory cards carry no badge**, because no artboard draws one for them and none is invented (D7); (5) **the PDP spec table takes a third and fourth shape** — wheels read Brand / Model / Size / Bolt pattern / Offset / Finish, accessories Brand / Model / Type / Fits, both derived from `Product` and never typed (D53(1) extended); (6) **`Similar products` never crosses a category** — a wheel PDP recommends wheels, ranked by shared finish (D52 extended); (7) **the quote form's message placeholder and consent line ship artboard-verbatim on a tire and as a noun-swapped variant on a wheel or accessory** — artboard copy wins on the page the artboard draws, and no artboard draws a wheel PDP, so asking a wheel buyer about their "current tires" would be wrong copy rather than parity. The variant keeps the drawn sentence's structure and punctuation, em dash included, so it is not held to the new-copy rules. | Coordinator, 2026-09-21, under the authority chain. | Rows #49–#53 in `design/DEVIATIONS.md` carry the ones where the shipped page differs from a drawn value. (2) is the only one that removes a drawn element from a page. |
| **D60** | *Never issued.* The ID was skipped by accident on 2026-09-21 and nothing anywhere cites it — verified by grep across the repo. Rule §1.5 forbids renumbering, so the gap stays and this row exists only so a future reader does not go looking for a decision that was never made. | — | — |
| **D61** | **The remaining safe audit items are applied, and the duplicate `D55` is disambiguated.** Applied 2026-09-21 on the owner's instruction to *"just do whatever you can do and take decisions on your own"*: **S3** — the solid-header background's divergence from `DESIGN.md` §4 is now `design/DEVIATIONS.md` **#54**, closing `src/components/site/llm.md` Open #2; **S4** — the stale `site-header.tsx` comment describing a `sm:gap-2.5` override that no longer exists is corrected, and the two `llm.md` Open items that echoed it are closed (the `chip.tsx` contradiction was re-read and is genuinely gone); **S5** — the dead `--container-rail` token is removed from `globals.css`, with a comment in its place saying why a second spelling of the rail's 280px could only drift from `results-grid`; **T1** — the PDP page comment claiming the breadcrumb "renders ONCE" is corrected to "instantiated once, placed twice", which is true of the DOM. **T2, T3 and T4 are recorded as no-action**, which is what the audit itself recommended. **S2 is deliberately NOT done** — root `llm.md` §7.10 reserves the 13 class-merge helpers to the owner by name and forbids refactoring them in passing, and a general instruction to use judgement is not the same as lifting a written prohibition. Separately, the two rows both numbered `D55` are disambiguated: the `HANDOFF.md`-shape row is now **`D55b`**. Nothing is renumbered and no ID is reused, so rule §1.5 holds; D24's citation of "D55" for the HANDOFF half resolves to `D55b` and every citation of `D55` for the git ruling still resolves. | Owner, 2026-09-21: *"just do whatever you can do and take decisions on your own leave only those which needs my intervention."* | Closes root `llm.md` §7.18 and the S3/S4/S5/T1 half of §7.17. `design/reports/audit.md`'s fix list now has **S2 and the three no-action taste items** left. |
| **D62** | **The two remaining undrawn states are authored: `loading` and route `error`.** `src/app/(storefront)/loading.tsx` (Server Component) renders the real `SiteHeader` and `SiteFooter` plus a motion-free skeleton — a heading bar and a six-card grid on the `results-grid` steps, in the card's own `--surface` / `--border` rest colours — so a navigation changes only the middle. `src/app/(storefront)/error.tsx` is the route boundary; the component is `src/components/site/route-error.tsx`, which renders the display heading, the authored line, the `ResultsEmpty` action pair (`Try again` + the `tel:` CTA), a `Home` escape link and `error.digest` when there is one. Both are on `/styleguide` §11, which completes that set. Three rulings inside it: **(1) the `"use client"` ban inside `src/app/` gets its one named exception.** Next 16 rejects a re-export — verified by building it, which failed with *"src/app/(storefront)/error.tsx must be a Client Component"* — so the directive must sit in that file. The exception is scoped as narrowly as the framework allows: `error.tsx` is the directive plus one re-export line and holds **no component code**. `.claude/rules/ui.md` and `docs/decisions.md` §4 both now name it. **(2) the error boundary renders no site chrome**, unlike `loading.tsx`: chrome is per-page (D38), so importing `SiteHeader`/`SiteFooter` into the client boundary would pull them into every route's client bundle, and a boundary should not re-render the thing that may have just failed. It navigates by the `Home` link and the `tel:` CTA instead. **(3) `loading.tsx` renders a `<div>`, not `<main id="main">`** — measured in the production build, Next emits the fallback into the same document as the page, and the first version produced **two** `<main id="main">` elements on `/styleguide`. A transient fallback does not own the page's landmark. | Owner, 2026-09-21, same instruction as D61. `HANDOFF.md` §6 item 1 had flagged the `use client` conflict as needing the owner; the owner delegated it. | Eight `"use client"` files now (D62 adds the boundary component and the `error.tsx` that re-exports it), **one of them under `src/app/`** — the count in `HANDOFF.md` §5 changes, and the slop grep must treat `error.tsx` as the single allowed occurrence and any other as the failure it was always meant to catch. `global-error.tsx` does not exist and is not owed; it would fall under the same exception. |
| **D63** | **The owner's "do whatever you can" pass: S2 applied, real accessory photography wired in, the category tiles corrected, and `/about` `/privacy` `/terms` written.** Five things, all 2026-09-21. **(1) S2** — the 13 class-merge helpers consolidate into `src/lib/cx.ts`, keeping `cx` and `join` as separate functions because they are not interchangeable. Proven behaviour-preserving, not assumed: every `class="…"` attribute on all six rendered pages was extracted before and after and diffed, **empty on all six**, with the change isolated by `git stash` so concurrent edits could not contaminate the comparison. This lifts the standing prohibition in §7.10. **(2) Accessory photography** — the owner supplied five real product shots. They arrived *after* the design export, so they live in `client-assets/`, never in the frozen `design/assets/` (D55), and `scripts/prepare-assets.mjs` gains `clientProducts()` to normalise them onto the same 1000px square canvas. They were shot on **white**, so the background is removed by a **border flood-fill**, not a luminance threshold — a threshold punches holes through chrome, which is as bright as the background. Threshold 215 is measured: 200 leaks through the chrome and eats the centre cap's face, 236 leaves more shadow. **The accessory TYPES follow the photographs, not the reverse**: `valve-stems` and `hub-rings` had no imagery and are gone, `centre-caps` is in, and brands follow the legible marks (Bosch for TPMS, Sentali for caps, Gorilla kept where the shots are unbranded). **(3) Category tiles** — the Tires and Wheels tiles switch from product cut-outs to the unused `tires-tile` / `wheels-tile` photos, closing §7.19. **(4)** `/about`, `/privacy` and `/terms` carry real content via a `body` prop on `PageStub`; every fact traces to `src/lib/site.ts` or the code, and the two legal pages are **drafts, not lawyer-reviewed**, which their file headers say. **(5)** The remaining audit items S3, S4, S5 and T1 are applied (see D61). | Owner, 2026-09-21, answering fourteen questions one at a time: push stays theirs; **S2 "Do it"**; keep D59(2) and D59(7); **switch the category tiles**; leave the accessory quantity as drawn; **run the DEVIATIONS sweep**; on the low-resolution cut-outs *"use another image - make duplication. it is only for mock"*; **keep text wordmarks** for brands rather than logos; quote delivery stays parked; fitment stays placeholder. | `zmax-landgema` and `touren-tr79` are the two cut-outs `prepare-assets.mjs` refuses to upscale; per the owner's ruling their SKUs now borrow a same-brand sibling's photo rather than being dropped, so no artboard SKU leaves the seed and home parity is untouched. **Brand logos were refused, not deferred:** the 12 brands are trademarks with separate licensing, and pulling marks off an aggregator is not a licence — the owner then chose to keep text wordmarks. |
| **D64** | **The `DEVIATIONS.md` sweep is done; the file is certified.** All 43 legacy rows (#1–#43) traced against the shipping code and the frozen artboards — the D56 audit had covered only 18 and said the rest were untested, not clean. Result: **0 WRONG, 3 STALE, 1 measured**, written up in `design/reports/deviations-sweep.md`. The three stale rows are corrected **in place** per rule §1.8, and every one had drifted in its *evidence* rather than its conclusion — which is the failure worth knowing: a row with a true conclusion and a false reason still reads as authority. **#5** claimed the spec said `1px --border` against the code's `--border-strong`; `DESIGN.md` §4 says `--border-strong` too, so the border was never a deviation and is dropped from the row. **#6** claimed `.06em` occurs "14 times … never once on an element with a height"; it occurs **34** times and **two 44px controls carry it** (`results-mobile.html:99-100`) — the conclusion about the `Button` primitive survives on correct evidence. **#23** was superseded the same day by #57: its reason for `object-center` was that the tile drew a cut-out on a transparent canvas, and the tile now draws a full-bleed photo; the row and the matching comment in `category-tiles.tsx` now point at #57. **#30** was the only row needing the browser, and comparing the wrong things would have failed a correct row: the two boxes are identical (`x=199 w=175`), and only ranging the artboard's **text node** (274.5) against the app's **content-box centre** (272.5) gives the claimed offset — **2.0px, exact**. | Owner, 2026-09-21, choosing **"Run the sweep"**. | Rows #44–#57 are not re-traced: they were written and verified the same week. Two agents did the static half on disjoint ranges and **neither was given the browser** (one shared pane, §3); the coordinator measured. Two new gotchas came out of it, `HANDOFF.md` §8.23 (a hidden pane tab makes **every** `getBoundingClientRect()` return zero, which looks exactly like broken layout) and §8.24 (comparing artboard-to-app geometry requires matching what is being centred). |
---

## 6. Folder map

Every folder below has an `llm.md`. Folders not listed (`node_modules/`, `.next/`, `.impeccable/`,
image leaf folders under `public/images/` and `design/assets/`) are generated, vendored, or pure
assets and are covered by their parent.

| Folder | One line |
|---|---|
| [`.claude/`](.claude/llm.md) | Claude Code project config: rules, hooks, launch, vendored skills |
| [`.claude/rules/`](.claude/rules/llm.md) | Path-scoped authoring rules (`ui.md` for `src/**/*.tsx`) |
| [`.claude/agents/`](.claude/agents/llm.md) | Impeccable's four agent definitions |
| [`.claude/skills/`](.claude/skills/llm.md) | Vendored skills pinned by `skills-lock.json`; do not edit |
| [`design/`](design/llm.md) | The frozen design export and its derived docs |
| [`design/assets/`](design/assets/llm.md) | Seven artboard HTML files + source PNGs; the parity baseline |
| [`design/inventory/`](design/inventory/llm.md) | Measured values per page; every report number traces here |
| [`design/reports/`](design/reports/llm.md) | Parity reports and the measurement protocol |
| [`docs/`](docs/llm.md) | `decisions.md`, the authority-level-1 HLD |
| [`public/`](public/llm.md) | Static assets served at `/` |
| [`public/images/`](public/images/llm.md) | Optimised webp output of `scripts/prepare-assets.mjs` |
| [`scripts/`](scripts/llm.md) | Asset pipeline and parity probe |
| [`src/`](src/llm.md) | All application code; `@/*` alias root |
| [`src/app/`](src/app/llm.md) | App Router root: layout, fonts, `globals.css` (the token system) |
| [`src/app/(storefront)/`](src/app/(storefront)/llm.md) | Storefront route group; thin pages only |
| [`src/components/`](src/components/llm.md) | Shared UI: `ui/` primitives and `site/` chrome |
| [`src/components/ui/`](src/components/ui/llm.md) | Ten token-only primitives; no business logic |
| [`src/components/site/`](src/components/site/llm.md) | Header, footer, drawer (to be built) |
| [`src/features/`](src/features/llm.md) | Feature modules: `catalog`, `finder`, `home`, `results`, `product` |
| [`src/features/catalog/`](src/features/catalog/llm.md) | `Product` type, `ProductCard`, the three seeds, and `categories.ts` — the per-category table (D58) |
| [`src/features/results/`](src/features/results/llm.md) | The results engine for all three categories (D58): sections, URL-driven search, filter rail/sheet islands |
| [`src/features/product/`](src/features/product/llm.md) | PDP sections, the `ProductView` derivation, the quote form island and its Server Action |
| [`src/lib/`](src/lib/llm.md) | Site constants; nothing contact-related is hardcoded elsewhere |

Root-level files without a folder: `HANDOFF.md` (the working session record — start here; cite by `§`, D55), `AGENTS.md`
(written by `next dev`; do not edit), `CLAUDE.md` (imports `AGENTS.md` and this file), `README.md`
(pointer), `package.json` (npm; `check`, `dev`, `design`, `assets` scripts), `next.config.ts`,
`eslint.config.mjs`, `tsconfig.json`, `skills-lock.json`, `.gitignore` (Next.js default plus the four
machine-local paths added by D55).

---

## 7. Open — needs the owner or the client

1. **Co-founder access.** Closed in part by D55: the repo is private at
   `github.com/glcorp/platinum-wheels` and pushed, so an off-machine copy now exists and §3's "sharing
   mechanism" question is answered — the co-founder clones it. What is left is **the invite**: nobody has
   been added as a collaborator, so today `glcorp` is the only account that can read or write it, and a
   lost account means a lost repo. Owner, via GitHub's Settings → Collaborators.
2. **Client blockers** (unchanged from `HANDOFF.md` §7): two low-res product photos; sample personal
   data in the PDP form; facet counts that do not reconcile; four images covering nine SKUs; brand
   logos and stock confirmation.
3. **Wheels vs tires.** The only real data supplied is a wheel feed (D9); the design sells tires.
   Unresolved until real catalogue data is wired.
4. **Nested `CLAUDE.md` shims.** Claude Code auto-loads nested `CLAUDE.md`; `llm.md` is read on
   demand. If on-demand reading proves unreliable, add a one-line `CLAUDE.md` containing `@llm.md` per
   folder. Not done; owner's call.
5. **Any D24 default** the owner wants changed.
6. **Stale spec references in the inventories.** All three `design/inventory/*.md` cite `DESIGN.md` as
   323 lines and describe the superseded red theme; their "Conflicts with DESIGN.md" sections predate
   the spec swap. Measured artboard values are unaffected. Re-extract or annotate? Owner's call.
7. **`skills-lock.json` does not pin `impeccable` or `design-to-code`.** Both are on disk. Whether
   `design-to-code` is project-authored is unrecorded. Owner to confirm.
8. ~~**`.claude/settings.local.json` is local-only.**~~ Closed 2026-09-21 by D55(3): the file is now
   `.claude/settings.json` and committed, so the impeccable hooks travel with the repo. The
   `settings.local.json` name stays gitignored for genuine per-machine overrides.
9. ~~**"Mobile call bar."**~~ Closed 2026-09-21 by D47(1): the `/results` `call-cta-panel` is a results
   section. No sticky site-wide call bar exists or is drawn.
10. **13 hand-rolled class-merge helpers**, none shared — count verified by the D56 audit and corrected
   upward: **10 × `cx()` in two signatures + 3 × `join()`**. Six `cx()` and all three `join()` are in
   `src/components/ui/` (as this row originally said); the audit found **four more `cx()` copies outside
   `ui/`** — `product-card`, `featured-carousel`, `quote-form`, `filter-panel`. Consolidate into
   `src/lib/`? Not done; **no session may refactor it in passing.** Scope if ever approved: 10 files,
   several carrying parity-measured class output, so no emitted class string may change.
   (`design/reports/audit.md` §4 S2.) Owner.
11. **Street address.** `SITE` has city and province only; `docs/decisions.md` §6 wants a static map plus
   "Get directions". Address is not in the canonical contact block. Client, via owner.
12. **PARKED (D54).** Lighthouse runs on all three pages (Chrome at `/Applications`, recipe in
   `design/reports/README.md`); readings in `design/reports/{home,results,product}.md`. Perf 91–95, a11y
   100 and CLS 0 everywhere; the mobile LCP gate (≤2.5 s) is the one red row on all three, at 3.0–3.5 s,
   with one build-wide cause. Closing it means critical-CSS inlining or a smaller document — outside a
   UI-only scope until the owner unparks it.
13. **Real fitment data for the finder** (D27 seed is 15 makes, 3–5 models each, 12 model years; D48 adds a placeholder vehicle → size map). Client, later — owner ruled placeholder data until then (D48).
14. **`PRIMARY_CONTACT`** is `CONTACTS[0]` (Inderpal Singh) because the header CTA is drawn with that
   number (D7). Nobody confirmed he should receive every header and mobile call tap. Owner.
15. **PARKED (D54). Where a submitted quote goes.** `src/features/product/actions.ts` validates an
   inquiry and returns a success state, then **discards it** — no inbox, CRM or form endpoint exists, so
   the delivery call is a marked `TODO` (D51). The UI half is complete and measured; only the wiring is
   missing, and wiring needs a backend. It must be done before the site is public, but this build does
   not owe it. Owner, then client.
16. **PARKED (D54). No unavailable state on the PDP.** `docs/decisions.md:116` specifies the dimmed media,
   `Currently unavailable` badge and `Inquire about restock` CTA for a *card*; neither product artboard
   draws an unavailable PDP, so none was authored and `/products/zmax-winterhawk-215-50r17` shows a normal
   `Request a quote` panel. Undrawn state → owner decides whether to author one (`design/reports/product.md`
   Open #1).
17. **Mostly closed by D57 and D61.** Of the D56 fix list, **C1–C5 and S1 are applied and verified**
   (`design/reports/audit.md` §4; `DEVIATIONS.md` #41 corrected, #44–#48 added). **S3, S4, S5 and T1 were applied 2026-09-21
   (D61)**, and **T2, T3 and T4 are recorded as no-action** — which is what the audit itself
   recommended for all three. **What is left is S2 alone**, separate and reserved to the owner by §7.10
   below. Owner.
18. ~~**Duplicate decision ID: two rows are both numbered `D55`.**~~ Closed 2026-09-21 by **D61**: the
   `HANDOFF.md`-shape row is relabelled **`D55b`** in place. Rule §1.5 is not broken — nothing is
   renumbered and no ID is reused; the suffix only distinguishes two rows that were issued the same
   number. D24's citation of "D55" for the HANDOFF half now resolves to `D55b`, and every citation of
   `D55` for the git-repository ruling still resolves to the row above it.
19. ~~**An unreconciled category-tile image choice, and two dead assets.**~~ **Closed 2026-09-21 by
   D63:** the owner ruled for the tile photos. `tires-tile.webp` and `wheels-tile.webp` are now in use and
   no longer dead, and the Tires tile no longer duplicates a product card. `design/DEVIATIONS.md` #57.
   Original text: Both home artboards render the
   `Tires` and `Wheels` category tiles with *product cut-outs* (`zeta-antarctica-sport.png`,
   `spec1-sp51.png`), not the `tires-tile.png` / `wheels-tile.png` that exist on disk and are referenced
   by neither artboard. The code correctly matches the artboard, so this is **not** a code fix — but the
   `Tires` tile therefore shows the same specific tire that appears as its own card three sections later.
   Flagged unresolved at `design/inventory/home.md:698-700` since 2026-09-20 and never escalated. Owner.
20. ~~**Does sort need to work without JavaScript?**~~ **Closed 2026-09-21 by D57:** it stays
   JavaScript-only, as an addendum to D44. `SortSelect` is a bare `<select>` with no `<form>` ancestor;
   D44 promised the plain-GET path for the filter form and separately called sort "a client island",
   never promising one for it. Every other stateful control on `/results` still degrades to a plain GET.
   Recorded rather than fixed, at the owner's direction.
21. ~~**D58 follow-ups.**~~ **All ruled 2026-09-21 (D63), asked one at a time.** (a) Accessory imagery —
   the owner supplied five real product shots; the types were re-cut to match them. (b) The seven D59
   rulings — **kept**, specifically (2) no vehicle finder on `/accessories` and (7) the non-tire
   quote-form copy variant. (c) `How many? 1 / 2 / 4` on an accessory — **left as drawn**; the quote
   select already says "1 item", and a per-category label would be the buy panel's first such fork.
   (d) Brand stock — the owner confirmed the brands are correct, then chose **text wordmarks over
   logos** once it was clear that 12 separate trademark licences could not be verified. Still open:
   nobody has confirmed the shop stocks **Bosch** or **Sentali**, which arrived with the photography.
22. **Neither `/wheels` nor `/accessories` has a parity report**, because neither has an artboard. They
   inherit `/results`' parity by rendering the same component tree (`DEVIATIONS.md` #49). That holds only
   while they are not allowed to diverge visually; if one ever is, it needs its own measurement.
