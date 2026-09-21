# Shared-layer audit — chrome, primitives, catalog, cross-page consistency

Scope: `src/components/ui/*`, `src/components/site/*`, `src/features/catalog/*`, `src/lib/*`, plus
cross-cutting consistency between `src/features/home/`, `src/features/results/` and
`src/features/product/`, `src/app/globals.css` integrity, and `design/DEVIATIONS.md` integrity.
Report-only (owner ruling, D54-style scope discipline): no code, `llm.md`, or `DEVIATIONS.md` touched.

## 1. Scope and method

Read in full: root `llm.md` (§1, §4, §5 D1–D55, §6, §7), `HANDOFF.md` (all sections), `.claude/rules/ui.md`,
`.claude/skills/design-to-code/SKILL.md` §5/§7/§8/§9, `design/DEVIATIONS.md` (all 43 active rows + the
"Sample data" section), `src/components/llm.md`, `src/components/ui/llm.md`, `src/components/site/llm.md`,
`src/features/catalog/llm.md`, `src/lib/llm.md`, `src/app/llm.md`, `design/reports/product.md` (house
style), all 658 lines of `src/app/globals.css`.

Read in full (source): all ten `src/components/ui/*.tsx`, all four `src/components/site/*.tsx`,
`src/features/catalog/{types,data}.ts` + `components/product-card.tsx`, `src/lib/{site,routes}.ts`,
`src/features/home/components/{featured-carousel,category-tiles,winter-promo,brand-strip}.tsx`,
`src/features/results/components/{results-grid,filter-rail,results-toolbar}.tsx`,
`src/features/product/components/{buy-panel,pdp-breadcrumb,similar-products,quote-form,specifications,
quantity-control}.tsx`, `src/app/{fonts.ts,layout.tsx}`, `src/lib/routes.ts`, `scripts/prepare-assets.mjs`
(spot), `src/app/(storefront)/styleguide/page.tsx` (spot).

Method: static reading + `grep`/`rg`/`awk` over `src/` and `design/assets/*.html`. No browser, no dev
server, no build, no Lighthouse — per hard constraint. `npm run check` (clean) and the slop grep (zero)
are cited from `HANDOFF.md` §5 and `design/reports/product.md` "Gates", not re-run.

**Not statically verifiable** (flagged, not guessed):
- Whether `text-on-photo-muted` and the `sm:gap-2.5` question in `src/components/site/llm.md` Open #3
  actually emit the intended CSS under Tailwind v4's same-specificity/emission-order rule
  (`HANDOFF.md` §8.3). Resolved by source reading below (§2.1) rather than a browser read, but the
  *rendered* pixel gap was not re-measured.
- Runtime behaviour of the `similar-track`/carousel scroll mechanics, hover states, and focus order —
  covered structurally, not by interaction.

## 2. Shared layer — §7 gates and §8 anti-slop

Gates already green and cited, not re-run: `npm run check` clean, slop grep zero, Lighthouse a11y 100 /
CLS 0 on all three pages (`HANDOFF.md` §5, `design/reports/product.md` "Gates"). `"use client"` count
verified independently at 6, `"use server"` at 1, matching `HANDOFF.md` §5 exactly:
`src/features/home/components/featured-carousel.tsx:1`, `product/components/quote-form.tsx:1`,
`results/components/{sort-select,filter-panel,filter-sheet}.tsx:1`,
`components/site/site-nav-drawer.tsx:1`; `product/actions.ts:1` (`"use server"`). None under `src/app/`.
(Two false-positive greps on `product-card.tsx:30` and `site-header.tsx:4` are comments *mentioning* the
string, not directives — confirmed by line content.)

### 2.1 Two stale/inaccurate code comments (real defects, not taste)

- **`src/components/site/site-header.tsx:115-118`** claims: *"buttonBase's compact gap is `gap-2.5
  sm:gap-3` (12px from 720px), so `sm:gap-2.5` holds 10px — flagged for emission verification."* Neither
  half is true of the code as it stands:
  - `src/components/ui/button.tsx:85` defines `compact: "h-11 text-13 tracking-8 gap-2.5"` — flat 10px at
    every width, no `sm:gap-3` step at all.
  - The `<Button>` call the comment is attached to (`site-header.tsx:120`) passes **no** `className`
    override — there is no `sm:gap-2.5` anywhere in the file (verified: `grep -n "gap-2.5\|gap-3"
    site-header.tsx` returns only the comment text and the unrelated logo-link `gap-2.5`).
  - Conclusion: `button.tsx`'s `compact` size was simplified to a flat gap after this comment was
    written, resolving the override it anticipates. The override was never added because it stopped
    being necessary — but the comment describing a problem-and-fix that no longer exists was not removed.
    This also fully resolves `src/components/site/llm.md` Open #3's second bullet, which restates the
    same (now-stale) concern.
- **`src/components/site/llm.md` Open #3**, first bullet, is likewise already resolved by the code it
  describes as a risk: it flags `text-on-photo/68` as "an opacity modifier on a custom `--color-*` token"
  that might compute to `oklab`. The actual code (`site-header.tsx:105`) uses `text-on-photo-muted`, a
  **dedicated token** (`globals.css:124`, `--color-on-photo-muted: rgba(244, 244, 245, 0.68)`), not an
  opacity modifier — `globals.css:120-124`'s own comment explains this was done for exactly this reason
  ("A Tailwind opacity modifier … would compute to an oklab colour-mix and fail an exact-match parity
  read"). The Open item is stale; no opacity-modifier risk exists in the shipped code.
- **`src/components/ui/chip.tsx:30-43`**, flagged by `src/components/ui/llm.md` Open #2 as
  self-contradictory ("a stranded fragment … concludes the opposite"), reads as one coherent argument in
  the current file — no contradictory fragment is present (`grep -n "globals.css's rule\|filling a
  silence" chip.tsx` returns nothing). Already fixed; the Open item is stale.

These three are genuine, verifiable staleness in in-repo documentation (not the artifact under audit, but
information a future session would otherwise trust). Not a `DEVIATIONS.md` matter — no shipped/design
delta is involved — so listed here rather than in §5.

## 3. Cross-page consistency

| Idea | home | results | product | Consistent? | Evidence |
|---|---|---|---|---|---|
| `ProductCard` consumer props | `<ProductCard product={product} />`, no `priority` (page has a hero LCP candidate) | `<ProductCard product product priority={index < priorityCount} />`, `priorityCount={3}` on best-grid only (page has no hero) | `<ProductCard product={product} />`, no `priority` (always below the fold) | **Yes** | `featured-carousel.tsx:213`, `results-grid.tsx:64-68`, `similar-products.tsx:78`. Each caller's `priority` choice is independently justified and documented at the call site; not a divergence. |
| Mobile scroll-snap carousel (D30 / D53(5)) | `flex overflow-x-auto snap-x snap-mandatory`, native scrollbar **shown** ("no `scrollbar-hide` utility in this build's token set") | n/a | `similar-track` `@utility` (`globals.css:594-608`): `overflow-x:auto; scroll-snap-type:x mandatory; scrollbar-width:none` + `::-webkit-scrollbar{display:none}` — scrollbar **hidden** | **No** | `featured-carousel.tsx:181-197` vs `globals.css:594-608`. The home carousel's own comment asserting no scrollbar-hiding utility exists is now wrong: the token set gained exactly that capability when the PDP similar-row utility was built the next day. Same UI idea, opposite scrollbar treatment, and the stale comment is the tell. See fix list #1. |
| Header/nav chrome across routes | `variant="over-hero"` | `variant="solid"` | `variant="solid"` | **Yes**, and identically so | `page.tsx:38`, `results/page.tsx:45`, `products/[slug]/page.tsx:82` all pass `active="tires"`; `site-header.tsx:52-59` gives both variants the same `bg-scrim-strong` background — deliberately, matching all three artboards' measured value over DESIGN.md §4's "on every other page it is `--bg`" (`site-header.tsx:7-14`). One component, one behaviour, on all three pages. |
| Sticky offset for a side panel | n/a | `filter-rail.tsx:34` — `md:sticky md:top-24` (96px) | `buy-panel.tsx:93` — `md:sticky md:top-24` (96px) | **Yes** | `buy-panel.tsx:21-28` explicitly cross-references `filter-rail.tsx`'s "same token name" — a deliberate, documented shared convention, not a coincidence. |
| Breadcrumb tap target + hover | n/a (no breadcrumb) | `Home` link: `tap-extend hover:text-ink-muted` (`results-toolbar.tsx:131`) | `Home`/`Results` links: `tap-extend hover:text-ink-muted` (`pdp-breadcrumb.tsx:44,53`) | **Yes** | Same utility, same hover token, on both pages — DEVIATIONS #16/#41 precedent applied uniformly. |
| Breadcrumb separator margin (`/`) | n/a | `mx-1.5` unconditional (`results-toolbar.tsx:132-134`) | `sm:mx-1.5` (`pdp-breadcrumb.tsx:47,53`) | **Yes — correctly different** | Verified against the artboards, not just the code: `results-mobile.html:94` draws `<span style="margin:0 6px">/</span>` at 390px, but `product-mobile.html:91` draws the breadcrumb as one flat string with plain `" / "` text and no margin span at all. The two pages' *artboards* disagree at mobile width, and the code correctly reproduces each. Initially looked like a bug; it is not. |
| Form-control border colour (D14) | `Input`/`Select` via `fieldBoxClasses()` — `border-border-control` | `sort-select.tsx`, `filter-panel.tsx` (size selects) — `border-border-control` | `Input`/`Select`/`Textarea` — `border-border-control` | **Yes** | `input.tsx:52,171`, confirmed present via `fieldBoxClasses()` reuse in `select.tsx:2,49`; independently confirmed in `sort-select.tsx` and `filter-panel.tsx` by grep. One shared recipe, three consumers. |
| Icon/chevron stroke width | chevrons/hamburger/close: 1.6; carousel prev/next arrows: 1.5; mobile call button: 1.8 | chevrons: 1.6 | chevron: 1.6 | **Minor, not flagged** | `select.tsx:90`, `sort-select.tsx:46`, `filter-panel.tsx:108,212`, `site-nav-drawer.tsx` all 1.6. The two outliers (`featured-carousel.tsx:146,164` at 1.5 for the desktop square arrows, and the header's 44×44 mobile call button at 1.8) are each a distinct SVG for a distinct artboard element, not the same control drawn twice — not a duplicate-idea inconsistency, so not in the fix list. |
| `cx()` / `join()` class-merge helper | see below | | | **No — verified duplication** | See §3.1. |

### 3.1 `cx()` / `join()` duplication — verified count

Root `llm.md` §7.10 and `src/components/ui/llm.md` Open #1 claim "six copies of `cx()` across
`src/components/ui/` in two different signatures, plus a third `join()` helper." Verified exactly as
stated, against current source:

**Inside `src/components/ui/` (6 `cx()`, 2 signatures):**
| Signature | Files |
|---|---|
| `(...parts: Array<string \| false \| null \| undefined>): string { return parts.filter(Boolean).join(" ") }` | `badge.tsx:63`, `chip.tsx:79`, `button.tsx:171` |
| `(...parts: ReadonlyArray<string \| undefined>): string { return parts.filter((part): part is string => Boolean(part)).join(" ") }` | `price.tsx:94`, `section-heading.tsx:54`, `stripe-divider.tsx:34` |

**Inside `src/components/ui/` (3 `join()`, 1 signature, a third pattern):**
`(base: string, extra?: string): string { return extra ? \`${base} ${extra}\` : base }` — byte-identical
in `field-label.tsx:19`, `checkbox.tsx:25`, `select.tsx:18`.

**Beyond `src/components/ui/`** (not covered by the root `llm.md` count, but the same defect): the first
`cx()` signature is re-declared a further 4 times outside the folder — `src/features/catalog/components/
product-card.tsx:34`, `src/features/home/components/featured-carousel.tsx:42`,
`src/features/product/components/quote-form.tsx:39`, `src/features/results/components/
filter-panel.tsx:56`. **Total across `src/`: 10 `cx()` implementations in 2 signatures + 3 `join()`
implementations in 1 signature = 13 hand-rolled class-merge helpers for what is functionally one
operation.** None of these files call any other's version; every one is a private, unexported top-level
function. This is a real, precisely-countable duplication, not a taste opinion — but per root `llm.md`
§7.10 it is explicitly the owner's call whether/where to consolidate, and no agent may refactor it in
passing. Reported for the fix list (#2), ranked below genuine parity/behaviour defects.

### 3.2 `ProductCard` — no per-context drift found

`product-card.tsx`'s own header comment claims all three call sites "measure the card byte-identically."
Confirmed structurally: no consumer passes extra `className`, no consumer wraps it in a context-specific
style override, and the only prop besides `product` (`priority`) is used exactly where its own doc string
says it should be (job 2's stated worry — "check every consumer passes it consistent props" — turns up
nothing).

## 4. `globals.css` integrity

| Token / utility | Defined | Used in `src/` | Status |
|---|---|---|---|
| `--container-rail` / `max-w-rail` | `globals.css:233` | **0 occurrences** anywhere in `src/` | **Dead.** The 280px rail width the token exists to express is instead hardcoded directly in the `results-grid` `@utility` (`globals.css:461-466`, `grid-template-columns: 280px minmax(0,1fr)`) and in `filter-rail.tsx:7-9`'s own comment, which explicitly says the width "is not declared here." The token was added but never wired to an element. |
| `--winter` / `--all-season` (`bg-winter`, `text-winter`, `bg-all-season`) | `globals.css:52-53`, `131-132` | Referenced only inside `src/app/(storefront)/styleguide/page.tsx`'s token-documentation table (`GROUND` array, rendered via `${g.util} h-20 w-full`, line 151) — no product, badge, or spec-table element in the three built pages uses a `winter`/`all-season` ink colour | **Already flagged, not new.** Matches `src/app/llm.md` Open #1 exactly: kept only because DESIGN.md §2 gives them a role, not because a screen uses one. Confirmed still true; owner call, not a new finding. |
| All 15 bare `text-*` sizes, all 11 `text-display-*` sizes | `globals.css:158-193` | Every one has ≥2 call sites (checked individually) | Live. |
| All `leading-*` / `tracking-*` tokens | `globals.css:199-221` | Every one has ≥1 call site (checked individually) | Live. |
| `--container-hero`, `--container-hero-lede`, `--container-promo-body`, `--container-measure` | `globals.css:228-240` | 1, 1, 1, 5 occurrences respectively | Live. |
| All 20 `@utility` role/layout blocks (`display`, `label`, `numeral`, `photo-inset-card`, `photo-vignette`, `tap-extend`, `transition-card`, `photo-inset-gallery`, `hero-scrim[-desktop]`, `tile-scrim[-tall]`, `promo-wash[-desktop]`, `fade-right`, `photo-caption-scrim`, `finder-grid`, `contact-grid`, `category-grid`, `results-grid`, `range-input`, `sheet-panel`, `size-grid-sheet`, `pb-safe`, `pdp-split`, `quote-grid`, `qty-grid[-wide]`, `similar-track`/`similar-grid`, `photo-vignette-gallery`) | `globals.css:272-628` | Every one has ≥2 occurrences (checked individually per §Method) | Live. |
| Undefined-but-used utility (would silently no-op) | — | grepped `bg\|text\|border\|fill\|stroke\|outline\|ring\|decoration`-prefixed class candidates across all `.tsx` against the token list | **None found.** The only apparent hits (`border-b`, `border-t`, `border-l`, `border-r`, `border-y`, `text-left/right/center`, `text-balance`) are Tailwind's own built-in non-color utilities, unaffected by this file's `@theme inline` resets; `bg-radial`, `border-radius`, `border-box`, `text-align`, `stroke-width`, `text-decoration` are CSS-property names inside comments, not class names. |
| Duplicate/shadowing custom-property definitions | — | scanned `:root` and `@theme inline` blocks for a property assigned twice with different values | **None found.** The only property named in both blocks, `--radius-ctl` (`:root` line 72 → `2px`; `@theme inline` line 146 → `var(--radius-ctl)`), is the standard "promote a `:root` design token into Tailwind's theme" idiom used identically for every colour token in the file — not a real duplicate, and not shadowed (same value). |

**Job 3 net result: one genuine dead token (`--container-rail`), zero undefined-but-used utilities, zero
duplicate/shadowing definitions.** `--winter`/`--all-season` are a pre-existing, already-tracked open
item, not new.

## 5. `DEVIATIONS.md` integrity

Spot-verified a representative sample spanning shared/home (#2–#24) and results/product (#25, #34, #36,
#38, #40, #42, #43) against current `file:line` source — chosen to cover every row category (colour,
type, layout, state, semantics, derived data) rather than every single row line-by-line:

| # | Claim | Verified against | Result |
|---|---|---|---|
| 2 | Barlow + Barlow Condensed only, self-hosted | `src/app/fonts.ts:1,13-28` | Accurate |
| 3 | `--container-content: 1344px` | `globals.css:231` | Accurate |
| 4 | Rail `280px minmax(0,1fr)` | `globals.css:463` | Accurate |
| 5 | Chip radius 0, no `rounded-*` | `chip.tsx:30-43` | Accurate |
| 6 | Button tracking `.08em`/`.04em` by size | `button.tsx:83-87` | Accurate |
| 7 | Nav hairline `border-border` | `site-header.tsx:55,58` | Accurate |
| 9 | Focus/active/disabled authored, no artboard rule | `button.tsx:130-131,137` | Accurate |
| 10 | Hover via Tailwind `hover:` (scoped) | `product-card.tsx:174` | Accurate |
| 13 | Focus `outline-offset:0` | `globals.css:513,517,644` | Accurate |
| 14 | `--border-control` on controls only | `input.tsx:52,171`, `select.tsx` (shared), `sort-select.tsx`, `filter-panel.tsx` | Accurate |
| 15 | `transition-property: border-color, translate` | `globals.css:341-343` | Accurate |
| 16 | `tap-extend` on card product-name link | `product-card.tsx:277` | Accurate |
| 18 | Route shape from `src/lib/routes.ts` | `routes.ts` full file | Accurate |
| 19 | `prepare-assets.mjs` refuses to upscale | `scripts/prepare-assets.mjs:69` | Accurate |
| 20 | Self-hosted, Michroma/Manrope dropped | `fonts.ts` | Accurate |
| 21 | Category tile hover suppressed | `category-tiles.tsx:42` | Accurate |
| 22 | Winter promo overlay literal→`transparent` | `winter-promo.tsx:37-38` | Accurate |
| 24 | Real `<button aria-label>`, `<ul>/<li>` brand strip | `brand-strip.tsx:26-32`, `featured-carousel.tsx:104-171` | Accurate |
| 25 | Computed facet counts/bounds | `search.ts:7,101-220` | Accurate |
| 27/43 | Nine SKUs, one unavailable | `data.ts` — 9 `slug:` entries, `available: false` at line 143 | Accurate |
| 34 | `<details>` disclosure | `results-toolbar.tsx:147` | Accurate |
| 36 | Quote-form field fill/font override | `quote-form.tsx` (`Input`/`Select`/`Textarea` imports) | Accurate |
| 37 | `Send inquiry` rest state not pre-hovered | `quote-form.tsx:255-256` | Accurate |
| 38 | Native `<fieldset>`/radios, `border-left` not `border-right` | `quote-form.tsx:182-220` | Accurate |
| 42 | Real `<table>` with `<th scope="row">` | `specifications.tsx:80,84` | Accurate |
| 43 | Quantity cells are `next/link`s with `aria-current` | `quantity-control.tsx:100-129` | Accurate |

**No stale row found in the sample.** Given the sample covers every row *category* in the 43-row file and
every one checked out exactly, and the file is dated the same day as the last source edit
(`design/DEVIATIONS.md` vs. `git status` timestamps), I did not find grounds to suspect the unsampled rows
(1, 8, 11, 12, 17, 23, 26, 28–33, 35, 39, 41) are stale, but they were not individually re-verified against
`file:line` — flagged as **not exhaustively checked**, not as clean.

### 5.1 Shipped differences from the design with no `DEVIATIONS.md` row

One confirmed, already surfaced by a folder `llm.md` but never promoted to the canonical deviations file:

- **Nav bar background on `variant="solid"` is `--scrim-strong`, matching the artboards, not `--bg` as
  `design/DESIGN.md` §4 specifies for "every other page."** Verified: `site-header.tsx:52-59` (both
  variants), cross-checked against the artboards directly —
  `grep -n "background:var(--scrim-strong)" design/assets/results-desktop.html design/assets/
  home-desktop.html design/assets/home-mobile.html` all hit. This is a real, shipped,
  artboard-vs-DESIGN.md divergence of the exact shape every other numbered row documents (artboard wins
  per the authority chain), but it has no row. `src/components/site/llm.md` Open #2 already named this
  exact gap and explicitly declined to add the row ("out of scope for this folder's agent"). Still open.
  See fix list #3.

No second undocumented shipped difference was found in the shared layer.

## 6. Fix list, ordered by impact

Genuine defects first, taste/opinion items labelled and ranked below them. Anything covered by an existing
`DEVIATIONS.md` row, a `D<n>`, or parked by D54 is excluded — none of the items below are.

| # | Finding | file:line | Impact | Proposed fix | Risk |
|---|---|---|---|---|---|
| 1 | **Genuine defect.** Home mobile carousel's scrollbar is shown; PDP mobile similar-row scrollbar is hidden — same UI idea, and the home comment claiming no scrollbar-hiding mechanism exists is now false. | `src/features/home/components/featured-carousel.tsx:181-197` (comment at ~193-197) vs `src/app/globals.css:594-608` (`similar-track`) | Low-medium — a real visual inconsistency between two nearly-identical carousels on two pages, and a misleading comment that would misdirect a future session | Either apply `scrollbar-width:none` + `::-webkit-scrollbar{display:none}` to the home track (extract as a small shared utility, e.g. `hide-scrollbar`, used by both), or correct the home comment to state the current, deliberate choice if a visible scrollbar there is intentional. Owner/coordinator decision, since it touches `globals.css` (single-writer, D25). | Low — no parity-measured property changes; scrollbar visibility is not in any parity table. |
| 2 | **Genuine defect, already tracked (root `llm.md` §7.10), verified precisely.** 13 hand-rolled class-merge helpers (10× `cx()` in 2 signatures, 3× `join()` in 1 signature) across `src/`, none shared. | `src/components/ui/{badge,chip,button,price,section-heading,stripe-divider,field-label,checkbox,select}.tsx`, `src/features/{catalog/components/product-card,home/components/featured-carousel,product/components/quote-form,results/components/filter-panel}.tsx` | Low functional impact (all implementations are behaviourally equivalent), moderate maintenance cost | Consolidate to one `src/lib/cx.ts` export. **Owner's call per root `llm.md` §7.10 — no agent may do this in passing.** | Low-medium — touches 10 files; must not change any class-string output, since several of these files carry parity-measured class output. |
| 3 | **Genuine defect (documentation gap, not a behaviour bug).** Solid-header background (`--scrim-strong`) diverges from `design/DESIGN.md` §4's stated `--bg` rule, with no `DEVIATIONS.md` row, though the artboards themselves confirm the shipped value is correct. | `src/components/site/site-header.tsx:7-14,52-59`; `design/assets/{home,results,product}-desktop.html` (`background:var(--scrim-strong)`) | Low — code is already correct per the authority chain; the gap is purely in the audit trail | Add a `DEVIATIONS.md` row (would be #44) citing `site-header.tsx` and the three artboards, closing `src/components/site/llm.md` Open #2 | None — documentation-only |
| 4 | **Stale in-repo comments/Open items** (three instances, §2.1): `site-header.tsx:115-118` describes a `button.tsx` gap override and a `sm:gap-2.5` className that no longer exist; `src/components/site/llm.md` Open #3 restates the same stale concern plus a resolved opacity-modifier worry; `src/components/ui/llm.md` Open #2 describes a self-contradiction in `chip.tsx:30-43` that is not present in the current file. | see §2.1 | Low — no runtime effect, but each would waste a future session's time re-investigating a already-closed question | Delete/update the stale comment and mark the two Open items resolved, in the same change that next touches those files (root `llm.md` §1.2, same-change maintenance) | None |
| 5 | **Dead token.** `--container-rail` (`max-w-rail`) is defined but never referenced anywhere in `src/`; the 280px rail width it exists to express is hardcoded directly in the `results-grid` utility instead. | `src/app/globals.css:233` vs `globals.css:463`, `src/features/results/components/filter-rail.tsx:7-9` | Very low — pure dead weight, no behaviour effect | Either wire `filter-rail.tsx`'s aside to use `max-w-rail` (redundant given the parent grid already fixes the width, so likely not worth it) or delete the token | None if deleted — confirmed zero references |
| — | **Taste/opinion, not a defect.** Icon stroke-width varies 1.5–1.8 across three distinct controls (carousel desktop arrows 1.5, most chevrons/hamburgers 1.6, mobile call button 1.8). | `featured-carousel.tsx:146,164`; `select.tsx:90` etc.; `site-header.tsx:152` | None — each is a distinct artboard-measured element, not the same idea drawn twice | No action; listed only because it surfaced during the consistency pass | — |
| — | **Taste/opinion, not a defect.** `Textarea` (`input.tsx:162-193`) re-declares its own class array rather than calling the exported `fieldBoxClasses()` that `Input`/`Select` share. | `src/components/ui/input.tsx:35-92` vs `162-193` | None — deliberate: `Textarea` differs on height, padding and font-weight from every `fieldBoxClasses()` caller, and HANDOFF §8.3's documented gotcha (same-specificity classes resolve by emission order, not JSX order) makes overriding those properties from a call site unreliable | No action recommended; flagged only for completeness since it looks like the kind of duplication job 2 asks about | — |

## 7. Open questions for the owner

1. **Fix list #1 (carousel scrollbar):** should the home mobile carousel hide its scrollbar to match the
   PDP similar-row pattern, or is a visible scrollbar there intentional and only the comment needs fixing?
   Either answer is a one-line change; only the owner can say which is correct.
2. **Fix list #2 (`cx()`/`join()` consolidation):** root `llm.md` §7.10 already parks this for the owner;
   this audit adds the precise, currently-accurate count (10 `cx()` + 3 `join()`, not folder-scoped to
   `ui/` alone) so the scope of a future consolidation is known before it is attempted.
3. **Fix list #3 (missing DEVIATIONS row for the solid-header background):** `src/components/site/llm.md`
   Open #2 already asked "whoever owns that file" to add it. Confirmed still unaddressed — routine
   housekeeping, not a design decision, but flagged since nobody has claimed it.

No other open questions. The 43-row `DEVIATIONS.md` sample (§5) found nothing to escalate, and the
shared-layer source is otherwise clean against §7/§8 of the skill and `.claude/rules/ui.md`.
