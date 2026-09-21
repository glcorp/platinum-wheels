# Artboard manifest

Artboard → route → sections (top to bottom) → states shown. This is the build order for
`/design-to-code page <name>` and `/design-to-code section <page> <section>`.

Full per-section measurements live in `design/inventory/{home,results,product}.md`. Those files are the
parity baseline — every number in a `design/reports/*.md` table traces to one of them.

## Routes

| Artboards | Route | File |
|---|---|---|
| `home-desktop.html` · `home-mobile.html` | `/` | `src/app/(storefront)/page.tsx` |
| `results-desktop.html` · `results-mobile.html` · `results-mobile-filters.html` | `/results` | `src/app/(storefront)/results/page.tsx` |
| `product-desktop.html` · `product-mobile.html` | `/products/[slug]` | `src/app/(storefront)/products/[slug]/page.tsx` |
| — (not designed) | `/wheels` | `src/app/(storefront)/wheels/page.tsx` — the `/results` artboards, category `wheels` (D58) |
| — (not designed) | `/accessories` | `src/app/(storefront)/accessories/page.tsx` — the `/results` artboards, category `accessories` (D58) |
| — (not designed) | `/styleguide` | `src/app/(storefront)/styleguide/page.tsx`, `noindex`, excluded from the sitemap |

Breadcrumb on the PDP reads `Home / Results / <product name>`, so `Results` links back to `/results`
carrying the active query. On a wheel or accessory the middle crumb reads `Wheels` / `Accessories` and
links to that route instead (D58).

**`/wheels` and `/accessories` have no artboards of their own** and are not parity rows. The owner put
them in scope on 2026-09-21 with the instruction to keep them "same as tires … only filters and skus
change but everything else remains as it is", so they render the *same* composition
(`src/features/results/components/results-page.tsx`) from the same measured sections: whatever parity the
`/results` artboards certify, these two inherit by construction rather than by measurement. What differs
is data-shaped and listed in `src/features/catalog/categories.ts` — the filter groups, the seed, the unit
copy. The one structural difference, accessories drawing four filter groups instead of five, is
`design/DEVIATIONS.md`.

---

## A note on breakpoints, because it matters

**There is not a single `@media` rule in any of the seven exports.** They are fixed-width snapshots at
1440 and 390. Every crossover width in this build therefore comes from DESIGN.md §8 — 400 / 720 / 1100 /
1320 — which is the only source that speaks to responsive behaviour at all. All three extraction agents
independently flagged the crossovers as underivable rather than inventing them, and that is the right
call: what the artboards *do* give us is the two endpoint layouts, exactly, and those are what parity is
measured against.

Mapped to Tailwind: `xs:` 400, `sm:` 720, `md:` 1100, `lg:` 1320.

---

## 1. Home — `/`

Desktop: 48px side padding, 120px section rhythm, content flush to 1344px.
Mobile: 16px side padding, 56px section rhythm.

| # | Section | Notes | States shown |
|---|---|---|---|
| 1 | `hero` | Full-bleed photo, scrim gradient, h1 at 120 desktop / 56 mobile | — |
| 2 | `nav` | **Absolutely positioned inside the hero, not sticky.** 88px desktop / 68px mobile. Logo is the transparent PNG badge (64/52px), not a wordmark | Active nav item (accent underline), hover |
| 3 | `finder` | Vehicle search panel overlapping the hero by −120px. Year/Make/Model are static `<div>`s in the export → **native `<select>` in code** (HLD §5) | Pre-filled `2021 / Honda / Civic` |
| 4 | `category-tiles` | "01 — Shop by category" | Hover (border + 2px lift) |
| 5 | `winter-promo` | "Winter 2026" | — |
| 6 | `how-it-works` | "02 — How it works" | — |
| 7 | `featured-tires` | "03 — Featured tires", 4-up | Card hover; Winter badge + accent CTA on 3 of 4 |
| 8 | `brand-strip` | Text wordmarks | Hover |
| 9 | `contact` | "04 — Contact". Mobile omits the 280px photo panel → hidden below 720, not removed (DEVIATIONS #8) | — |
| 10 | `footer` | Logo badge at 120px | Link hover |

## 2. Results — `/results`

Desktop 1440 is full-bleed, 48px side padding. Main grid `280px | 48px gap | 1fr` → results column
**1016px**; product grid 3-up with a 16px gutter → card **exactly 328px**.
Mobile 390 → 1-up, 12px gutter → card **358px**. Cards are *wider* on mobile than desktop.

There is no 2-up or 4-up state anywhere in the export, which contradicts DESIGN.md's "4-up at 1320".
The home page's featured row is the 4-up case; results is 3-up because the rail takes 280px.

| # | Section | Notes | States shown |
|---|---|---|---|
| 1 | `site-header` | Same component as home's nav, but solid rather than over a photo | Active, hover |
| 2 | `results-toolbar` | "12 matches · 6 similar", "Change vehicle", Sort select (44px, min-width 200px) | — |
| 3 | `filter-sort-sticky-bar` | **Mobile only** | — |
| 4 | `filter-rail` / `filter-sheet` | 280px rail on desktop; full sheet on mobile (`results-mobile-filters.html`) → **client island** | Sheet open; chip selected |
| 5 | `results-column` | Wrapper | — |
| 6 | `best-matches` | Card #2 is **frozen in its hover state** in both artboards — a state demo, not a second card style | Card hover, Winter badge, **"Currently unavailable"** variant |
| 7 | `similar-matches` | — | Same card states |
| 8 | `load-more` | Ghost button, 14px +0.08em | Hover |
| 9 | `call-cta-panel` | **Mobile only** | — |
| 10 | `site-footer` | Shared with home | Link hover |

**The unavailable card variant is fully specified by the artboard** (and matches the HLD business rule):
image at `opacity: 0.35`, `--surface-2` filled badge, dim price numeral, ghost `Inquire about restock` CTA.

## 3. Product — `/products/[slug]`

Desktop split is `55fr 45fr` with a 64px gap inside a 1344px row → gallery **704px**, buy panel
**576px**. **Not the 60/40 DESIGN.md §5 specifies.** The buy panel is `position: sticky; top: 96px`.
The quote band below uses `5fr 7fr` (≈42/58).

| # | Section | Notes | States shown |
|---|---|---|---|
| 1 | `site-header` | Shared | Active, hover |
| 2 | `breadcrumb` | `Home / Results / <name>` | Hover |
| 3 | `pdp-gallery` | 8% photo inset, `--border` box | — |
| 4 | `buy-panel` | Sticky desktop. Title 88→56, price 64→48 (**not** DESIGN.md's 56), quantity segmented control, `Request a quote` + `Call us`. **No install/fitment trust line exists here** at either size | Quantity selected; CTA hover |
| 5 | `specifications` | 6 rows, zebra-striped, stays two-column on mobile | — |
| 6 | `quote-band` | The only fitment sentence lives here, and mobile deletes it. Form: name, email, phone, quantity, message, CASL consent | Focused email field (the export's only focus state), consent unticked |
| 7 | `similar-products` | 4 cards; mobile is a fixed `repeat(4, 260px)` horizontal track. The third "similar product" is the PDP subject itself in another size | Card hover |
| 8 | `site-footer` | Shared | Link hover |

---

## States no artboard shows — must be authored

The exports contain **no** `:focus`, `:active` or `:disabled` rule; only `:hover`. These come from
DESIGN.md §4 and go on `/styleguide`:

- Focus ring (2px `--accent`, no offset; white on an accent fill, since accent-on-accent is invisible)
- Button active / disabled
- Empty results, loading skeleton, error, form success, 404

**All of them are authored and on `/styleguide` §11 as of 2026-09-21** — focus / active / disabled in §5,
the rest in §11: 404 (`PageStub`), empty results (D47), open `Change vehicle` (D45), quote-form success
(D51) and error summary (D57), the skip link (D57), and the **loading skeleton** and **route error**
(D62). The set is closed; a new undrawn state goes here and on `/styleguide` in the same change.

## Shared components (build once, in `src/components/site/`)

`site-header` (3 pages), `site-footer` (3 pages), `product-card` (home featured, results, PDP similar —
the single most reused component in the build).
