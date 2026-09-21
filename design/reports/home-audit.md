# Audit report — Home (`/`)

Static audit, 2026-09-21, per `.claude/skills/design-to-code/SKILL.md` §9 (`audit [page]` = §5 + §7 + §8,
output `design/reports/<page>-audit.md`, change nothing). Owner ruling: report first, fixes only after
approval. **No code, `llm.md`, `DEVIATIONS.md` or other report was touched.**

## 1. Scope and method

Read: root `llm.md` §1/§4/§5 (D1–D55, especially D23–D41), `HANDOFF.md` §2/§4/§5/§8/§9,
`.claude/rules/ui.md`, `.claude/skills/design-to-code/SKILL.md` §5/§7/§8/§9, `design/reports/home.md`
(the baseline being audited), `design/reports/product.md` and `product-audit.md` (house style / audit
shape to copy), `design/DEVIATIONS.md` (all 43 rows; #1–#24 are shared + home), `design/inventory/home.md`,
`design/manifest.md`, `src/features/home/llm.md`, `src/features/finder/llm.md`, `.claude/rules/llm.md`.

Read in full: `src/app/(storefront)/page.tsx`, all 7 files under `src/features/home/components/`, and
`src/features/finder/components/vehicle-finder.tsx` + `src/features/finder/data.ts` (the finder is its
own feature but is home's only interactive section besides the carousel, D33). Spot-checked shared
dependencies only to confirm a claim in `home.md` or a cross-file contract still holds:
`src/app/globals.css` (`hero-scrim`/`-desktop`, `tile-scrim`/`-tall`, `promo-wash`/`-desktop`,
`fade-right`, `photo-caption-scrim`, `finder-grid`, `category-grid`, `contact-grid`, the
`--container-hero*`/`--container-promo-body`/`--container-measure` tokens that back `max-w-hero*`,
`--text-display-*`, `--tracking-*`, `--leading-*`, the global `prefers-reduced-motion` block),
`src/lib/site.ts`, `src/lib/routes.ts`, `eslint.config.mjs`, `src/app/layout.tsx`. Those files (plus
`src/components/site/*` and `src/components/ui/*`) are a different agent's scope for fixes; cited here
only to verify home-side claims. `git status` confirms every file in scope is one uncommitted `A` (add),
none edited since `home.md` was written — no drift from a later edit (§7 below).

**Not statically checkable — the coordinator verifies these in the browser per the constraints on this
task (no browser/preview tools, no build, no Lighthouse re-run):**
- Actual rendered geometry, colour and computed styles — this audit only checks that the source backing
  each `home.md` row still exists and matches the cited value, not that the browser paints it identically.
- Real focus order, visible focus rings, and the drawer's focus-trap/`Esc` behaviour (`SiteHeader`,
  shared scope, `home.md` "States and interactions verified").
- The finder's native `<select>` behaviour (optgroup rendering, required-field browser validation UI).
- The featured carousel's actual scroll/snap feel, dot-sync timing, and whether `scrollTo({behavior:
  "smooth"})` is honoured cross-browser.
- Lighthouse, CLS, LCP — already recorded in `home.md` "Not run" section (2026-09-21 run) and not re-run
  per task constraints.
- The 375px click-through flow (SKILL.md §7 "agent-browser click-through") — no browser tool available in
  this session; `home.md`'s existing overflow-only row (375 → no overflow) is the closest static evidence.

## 2. §5 parity — integrity of the existing report

Every row checked below traces to current source. No selector, class or component has drifted since
`home.md` was written (consistent with `git status`: every home/finder file is one uncommitted add, none
edited since).

| `home.md` row / section | Traces to |
|---|---|
| Header 88/68, over-hero, active "Tires" | `page.tsx:38` (`<SiteHeader variant="over-hero" active="tires" />`) — component itself is shared scope, cited only to confirm the call site is unchanged |
| Hero height 900/760/720, `object-cover object-center` | `hero.tsx:17` (`h-180 sm:h-190 md:h-225` = 720/760/900), `hero.tsx:41` |
| Hero scrim gradient stops (both viewports) | `hero.tsx:47` (`hero-scrim sm:hero-scrim-desktop`) → `globals.css:359-374`, stops match `home.md` byte-for-byte (`--bg 0%, --scrim-strong 22%, --scrim-soft 55%/100%` desktop; `--bg 0%, --scrim-strong 28%, --scrim-mid 60%, --scrim-soft 100%` mobile) |
| Hero eyebrow 500/11-12, ls 1.54/1.92 | `hero.tsx:63` (`text-11 tracking-14 sm:text-12 sm:tracking-16`) → `globals.css:220-221` (`--tracking-14: .14em` × 11px = 1.54px; `--tracking-16: .16em` × 12px = 1.92px) |
| H1 56/88/120, `display` role | `hero.tsx:70` (`text-display-56 sm:text-display-88 md:text-display-120`) → `globals.css:183-185` |
| Hero lede 16/20, max-w 560 | `hero.tsx:80,83` (`text-16 sm:text-20`, `sm:max-w-hero-lede`) → `globals.css:239` (`--container-hero-lede: 560px`) |
| Finder overlap −72/−120, panel bg/border | `vehicle-finder.tsx:42` (`-mt-18 sm:-mt-30`), `:33` (`bg-surface border-border-strong`) |
| `finder-grid` 1fr/1.2fr/1.2fr/300px | `vehicle-finder.tsx:57` (`md:finder-grid`) → `globals.css:428-433` |
| Finder control border `--border-control` (DEVIATIONS #14) | `Select` primitive, shared scope (`src/components/ui/select.tsx`) — used unmodified at `vehicle-finder.tsx:62,76,93` |
| Tiles header row (eyebrow left / h2 right, desktop) | `category-tiles.tsx:58-64` |
| `category-grid` 2fr/1fr over 320/320 | `category-tiles.tsx:72` (`md:category-grid`) → `globals.css:446-450` |
| Tile scrims 35/75 (all), 30/70 (tall) | `category-tiles.tsx:90` (`tile-scrim md:tile-scrim-tall`) → `globals.css:380-393`, stops match `home.md` exactly |
| Tires tile `object-position: center` (DEVIATIONS #23) | `category-tiles.tsx:86` (`object-contain object-center`) |
| Category tile hover suppressed (D35(2)) | `category-tiles.tsx:42-45` comment + no `hover:` class on any tile `Link` (confirmed by reading `:76-150`) |
| Winter promo 7fr/5fr desktop, `min-h-160`=640 | `winter-promo.tsx:66` (`md:grid-cols-12 md:min-h-160`), `:70,86` (`md:col-span-7`/`md:col-span-5`) |
| Promo wash gradients | `winter-promo.tsx:80` (`promo-wash sm:promo-wash-desktop`) → `globals.css:399-410`, matches `home.md` on both axes |
| Promo h2 48/56/88, `text-balance` | `winter-promo.tsx:92` |
| Promo body copy verbatim incl. plain-ASCII apostrophe | `winter-promo.tsx:100-102` — byte-compared against `design/assets/home-desktop.html:162` and `home-mobile.html:97` (both plain `'`, confirmed by direct grep in this audit) |
| Promo chips 36px, 1px `--text-muted` border, radius 0 | `winter-promo.tsx:107,126` (`h-9 border border-ink-muted`, no rounded-* class) |
| Promo mobile overlay `transparent` not `rgba(13,2,2,0)` (D35(1)) | `winter-promo.tsx:37-38` comment; `promo-wash`'s `transparent 50%` stop, `globals.css:401-403` |
| HIW eyebrow-only, no h2 | `how-it-works.tsx:96-99` — no `<h2>` anywhere in the file (confirmed by reading in full) |
| HIW numeral tabular only `md:` (D35(3)) | `how-it-works.tsx:111` (`tabular-nums` only inside `md:` variant) |
| HIW title no tracking on mobile (D35(3)) | `how-it-works.tsx:115` — no bare `tracking-*` class, only `md:display` |
| HIW desktop cell trailing border-right on all 4 (as drawn) | `how-it-works.tsx:109` (`md:border-r` applied unconditionally in the `.map`, no `index === STEPS.length - 1` exception) |
| Featured section padding, `overflow-hidden` mobile bleed | `featured-tires.tsx:23` |
| Featured mobile scroll-snap track, 260px card + 12px gap | `featured-carousel.tsx:38-40,199,211` |
| Featured dot progress (4 bars, active 28px lime / rest 12px) | `featured-carousel.tsx:231-242` (`w-7`/`bg-accent` vs `w-3`/`bg-border-strong`) |
| Featured mobile right fade 72px | `featured-carousel.tsx:225` (`fade-right … w-18`) → `globals.css:415-417` |
| Featured prev/next real `<button aria-label>` (DEVIATIONS #24) | `featured-carousel.tsx:107-169` |
| Mobile carousel round button whitelisted `rounded-full` | `featured-carousel.tsx:104,111` comment + class, matches the one whitelisted exception (`SKILL.md §7` slop-grep note) |
| Brand strip 8-col grid, no gap, `--surface-2` band | `brand-strip.tsx:29` (`sm:grid sm:grid-cols-8 sm:gap-0`, `bg-surface-2`) |
| Brand order (house-then-majors) | `src/lib/site.ts:40-53` (`BRANDS`), unchanged order matches `design/inventory/home.md:728` |
| Brand-strip desktop hover to `--text` (drawn, `design/inventory/home.md:378`) | `brand-strip.tsx:34` (`md:hover:text-ink`) |
| `contact-grid` 5fr/7fr | `contact.tsx:54` (`md:contact-grid`) → `globals.css:439-444` |
| Contact one-DOM, `order-*` for mobile (D22) | `contact.tsx:56,72,114,137` (`order-1`/`order-2`/`order-3`, photo block un-ordered and `hidden sm:block`) |
| Contact photo hidden <720, not removed (D22) | `contact.tsx:137` (`hidden … sm:block`) |
| Footer social row omitted (DEVIATIONS #20) | `page.tsx` renders `<SiteFooter/>` with no social-row prop; `BrandStrip`/`Contact`/`page.tsx` carry no social markup (shared component, cited only to confirm the home page doesn't add one itself) |
| Tablet band (720–1099), D41 | `category-tiles.tsx:26-28`, `how-it-works.tsx:53-55`, `winter-promo.tsx:20-24`, `contact.tsx:19-22` — each component's own comment states the same `sm:`/`md:` crossover ruling `home.md` records |
| Year computed, not hard-coded (D32) | `winter-promo.tsx:61` (`new Date().getFullYear()`) |
| Finder unselected placeholders (D28) | `vehicle-finder.tsx:62-107` (`defaultValue=""`, disabled placeholder `<option>` per select) |

No row was found pointing at a selector, prop, utility or file that no longer exists. **§5 integrity:
clean** for every home-specific row. Shared-chrome rows (header, footer, `Select`/`Button`/`FieldLabel`
primitives) were spot-checked only at the call sites listed above and are a different agent's scope for a
full re-verification.

## 3. §7 QA gates

| Gate | State | Basis |
|---|---|---|
| `npm run check` (tsc + eslint incl. jsx-a11y via `eslint-config-next/core-web-vitals`) | clean | Already verified by the coordinator (task brief); not re-run. `eslint.config.mjs:2-3` confirms `core-web-vitals`/`typescript` configs, which bundle `jsx-a11y` |
| Slop grep | zero | Already verified by the coordinator for `src/` as a whole (task brief); re-scoped to `src/features/home/` + `src/features/finder/` in this audit with the exact patterns from `SKILL.md` §7 — zero hits on arbitrary values, default palette, banned radii/blur/shadow/gradient utilities, lorem/placeholder-image literals, cart language, and page-level `"use client"` |
| a11y / forms / focus / touch | pass (by source) | `FieldLabel htmlFor` ↔ `Select id` pairs for all three finder fields (`vehicle-finder.tsx:61-62,75-76,89,93`); `aria-label` present on every icon-only button (`featured-carousel.tsx:109,135,153`); `aria-hidden` correctly scopes every decorative icon/scrim/dot (`featured-carousel.tsx:114,140,158,224,235`; `category-tiles.tsx:89,116,141`; `winter-promo.tsx:79,116`; `contact.tsx:95,149`); `<ul aria-label="Brands">` (`brand-strip.tsx:27`); no `tabIndex`/`tabindex` anywhere in scope (grep, zero) |
| Touch floor (44px, `docs/decisions.md` §5) | pass (by source) | Mobile carousel button `h-11 w-11` = 44px (`featured-carousel.tsx:111`); desktop carousel buttons `h-12 w-12` = 48px (`:137,155`); contact phone links `h-13`/`h-14` = 52/56px (`contact.tsx:92`); finder/promo CTAs use `Button size="promo"` (52→56px, shared scope, DEVIATIONS #6); category tiles and the winter-promo photo are full-block links, far over floor |
| Keyboard order | not statically checkable (browser needed for visible-focus verification) | Source/DOM order matches visual order top-to-bottom: header → hero (no focusables) → finder (3 selects + submit) → 3 tiles → 1 promo CTA → HIW (no focusables) → carousel controls + 4 product-card links → brand list (no links) → 2 phone links + 1 email link → footer. No positive `tabIndex` anywhere in scope |
| `prefers-reduced-motion` | pass (by source) | Global CSS rule `globals.css:649-657` (`animation-duration`/`transition-duration` → `0.01ms`, `scroll-behavior: auto`) covers all CSS transitions/hover states; the one component with JS-driven motion, `FeaturedCarousel`, additionally checks `window.matchMedia("(prefers-reduced-motion: reduce)")` before calling `scrollTo({behavior:"smooth"})` (`featured-carousel.tsx:46-51,97`) — belt-and-braces, not just relying on the CSS rule |
| 375px flow | not statically checkable (no browser) | `home.md` "Overflow-only checks" already records `375 → 375, none` from the 2026-09-20 measurement pass; nothing in the diffed source since then (git status: no edits) would change overflow behaviour |
| Lighthouse (mobile, prod build) | recorded, not re-run | `home.md` "Not run" section: Performance **91/91/91** (≥90 ✓), Accessibility **100** ✓, CLS **0** ✓, LCP **3.5s** ×3 (✗ vs 2.5s gate) — **parked** (D54, root `llm.md` §7.12), not a blocker |
| Parity report committed / DEVIATIONS.md updated | pass | Both exist and are current (§2 above) |

## 4. §8 anti-slop checklist

- [x] One accent per frame — not enforced project-wide (D5, `ui.md` "Non-negotiables"); home's accent uses
  (hero eyebrow, finder CTA, promo eyebrow + CTA) are all artboard-measured, not invented (`hero.tsx:63`,
  `vehicle-finder.tsx:109-119`, `winter-promo.tsx:87,131`).
- [x] Asymmetric layouts kept — `category-grid` 2fr/1fr (`category-tiles.tsx:72`), `contact-grid` 5fr/7fr
  (`contact.tsx:54`), winter-promo 7fr/5fr (`winter-promo.tsx:66`) all ship as measured, none "fixed" to
  centred/symmetric.
- [x] No gradients/glass/shadows/pills outside DESIGN.md's allowance — every gradient in scope
  (`hero-scrim`, `tile-scrim`/`-tall`, `promo-wash`/`-desktop`, `fade-right`, `photo-caption-scrim`) traces
  to a measured artboard value (`design/inventory/home.md:397-406`), which is authority level 2 and
  outranks the generic skill checklist's "hero bottom fade only" phrasing (root `llm.md` §4; the exports
  themselves use gradients on five sections, not one — `design/inventory/home.md:659`). No `shadow-*`,
  `backdrop-blur`, or unlisted `rounded-*` anywhere in `src/features/home/` or `src/features/finder/`
  (grep, empty) except the one whitelisted `rounded-full` mobile carousel button.
- [x] One icon set / stroke — phone icon (`contact.tsx:94-106`), carousel chevrons
  (`featured-carousel.tsx:113-125,139-149,157-167`), promo snowflake (`winter-promo.tsx:108-123`), finder
  arrow (`vehicle-finder.tsx:118`, text glyph not an icon) — all `stroke="currentColor"` linear SVGs,
  1.5–1.6 stroke width, no fill icons, no emoji.
- [x] Real photography — `hero-tread.webp` (D4, licensed), `winter-tacoma.webp`, product cut-outs for the
  Tires/Wheels tiles (see §6 Open Question — not a slop issue, an artboard-fidelity question).
- [x] No invented social proof — no reviews, ratings, star glyphs, or count claims anywhere in scope
  (grepped for "customers", "rating", "★", "reviews" — none).
- [x] Placeholder data named / not hardcoded in components — `BRANDS`/`SITE`/`CONTACTS` live in
  `src/lib/site.ts:10-53`, imported everywhere they're used; `FINDER_YEARS`/`FINDER_MAKES` in
  `src/features/finder/data.ts:26-53`, explicitly flagged `SAMPLE DATA (D27)` in the file's own header
  comment; no phone/email/brand literal is written directly into a home or finder component (grep, only
  `${contact.tel}`/`${SITE.email}` template interpolations found).
- [x] Brand logos — text wordmarks only, no logo files referenced (`brand-strip.tsx:31-38`); which brands
  are actually stocked is an already-tracked open item (root `llm.md` §7.2), not a new finding here.
- [ ] N/A — Empty/loading/error states: the home page has no data-fetching or form-submission state of its
  own (the finder is a plain GET, the carousel is client-side scroll only), so this box doesn't apply.
- [x] Type hierarchy matches artboard at both breakpoints — `text-display-56 sm:text-display-88
  md:text-display-120` (h1), `text-display-40 md:text-display-56` (tiles/HIW-absent/promo h2s), all traced
  to `home.md` §1440/§390 rows with 0 Δ; no desktop size leaks to mobile anywhere in scope.
- [x] No "AI tells" — hero is flush-left, not centred (`hero.tsx:49-59`, absolute-positioned lower-left
  block); How It Works is four numbered steps with specific copy ("A person checks your exact trim and
  stock"), not a generic 3-icon feature grid; no filler copy ("Elevate your driving experience" pattern)
  found anywhere in scope.

**Eleven of twelve applicable boxes pass; one is not applicable to this page.**

## 5. Fix list ordered by visual impact

**No genuine defects found in `src/features/home/*`, `src/features/finder/*`, or `page.tsx`.** Every
apparent oddity checked against root `llm.md` §5, `DEVIATIONS.md`, or the file's own header comment
resolved to a sourced, deliberate decision (see §2/§3/§4 above for citations).

| # | Finding | file:line | Impact | Proposed fix | Risk | Label |
|---|---|---|---|---|---|---|
| — | *(none)* | — | — | — | — | — |

**Genuine defects: 0. Taste findings: 0.**

## 6. Open questions for the owner

1. **Category tile images may not be the intended assets.** `design/inventory/home.md:698-700` already
   flags, unresolved, that both artboards render the "Tires" and "Wheels" category tiles
   (`category-tiles.tsx:82,110`) using **product cut-outs** (`zeta-antarctica-sport.png` /
   `spec1-sp51.png`) rather than the dedicated `tires-tile.png` / `wheels-tile.png` files that exist on
   disk and are named for exactly this purpose but are referenced by neither home artboard. The shipped
   code is **not a defect** — it reproduces the artboard exactly, which is correct per the authority chain
   (root `llm.md` §4: artboards win on layout/imagery) — but the visual result is that the home page's
   "Tires" category tile shows the same specific tire (Zeta Antarctica Sport) that also appears as its own
   card three sections later in Featured Tires, rather than a generic category shot. This ambiguity was
   never carried into `design/DEVIATIONS.md` or root `llm.md` §7 as a tracked item. **Not a fix-list item**
   (fixing it would mean deviating from the artboard without authorization) — flagging so the owner can
   confirm whether `tires-tile.png`/`wheels-tile.png` should replace the product cut-outs, or whether the
   product cut-outs are the intended choice and those two unused files should be removed from
   `design/assets/`.

**Referred, out of scope for this agent (a different agent's files, noted only because they surfaced while
auditing `/`):**
- `src/app/layout.tsx:19-29` has no "skip to content" link, so a keyboard user reaches `<main>` on every
  page (including `/`) only after tabbing past the full header nav. This is site-wide chrome, not
  home-specific, and belongs to whichever agent owns `src/app/layout.tsx` / `src/components/site/`.
- Shared primitives (`SiteHeader`, `SiteFooter`, `Button`, `Select`, `FieldLabel`) were spot-checked only
  at their home-page call sites (§2) and were not independently re-audited — that is a different agent's
  scope per the task brief.
