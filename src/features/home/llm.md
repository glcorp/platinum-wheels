# src/features/home

## Purpose
The sections that exist only on `/`: hero, category tiles, winter promo, how-it-works, featured tires,
brand strip, contact. D33 put them here rather than in `src/components/site/` (chrome) or `src/lib/`.
The finder is **not** here — it is its own feature, `src/features/finder/` (`docs/decisions.md` §3).
Delete this folder and `/` renders header and footer around nothing.

## Owns
One file per manifest section (`design/manifest.md` §1); each header comment carries its measured
sources (`design/inventory/home.md` §2.x). All Server Components except the carousel island.
- [`components/hero.tsx`](components/hero.tsx) — `Hero`, no props. Full-bleed `hero-tread.webp`, scrim, eyebrow / h1 / lede. home.md §2.1.
- [`components/category-tiles.tsx`](components/category-tiles.tsx) — `CategoryTiles`. "01 — Shop by category", `md:category-grid` 2fr/1fr, no hover (D35). home.md §2.4.
- [`components/winter-promo.tsx`](components/winter-promo.tsx) — `WinterPromo`. Full-bleed photo + tinted panel, computed `Winter <year>` (D32), spec chips inline (not `Chip`). home.md §2.5.
- [`components/how-it-works.tsx`](components/how-it-works.tsx) — `HowItWorks`, `id="how-it-works"`. Four steps as data; eyebrow only, no h2. home.md §2.6.
- [`components/featured-tires.tsx`](components/featured-tires.tsx) — `FeaturedTires`. Server shell: spacing, hands `FEATURED_PRODUCTS` to the island. home.md §2.7.
- [`components/featured-carousel.tsx`](components/featured-carousel.tsx) — `FeaturedCarousel`, **the one `"use client"` file** (D30): heading row with prev/next, scroll-snap track, dot progress.
- [`components/brand-strip.tsx`](components/brand-strip.tsx) — `BrandStrip`. `<ul aria-label="Brands">` banded row from `BRANDS`. home.md §2.8.
- [`components/contact.tsx`](components/contact.tsx) — `Contact`, `id="contact"`. One DOM, four blocks placed by grid per width (D22). home.md §2.9.

## Rules
- One file per manifest section, named by the section: `hero.tsx`, `category-tiles.tsx`,
  `winter-promo.tsx`, `how-it-works.tsx`, `featured-tires.tsx`, `brand-strip.tsx`, `contact.tsx`.
- Server Components. The only client island is the mobile featured carousel (D30).
- Copy is artboard-verbatim (`.claude/rules/ui.md` "Copy"). Desktop wording at all widths (D22).
- Year is computed at render (D32). Links come from `src/lib/routes.ts` (D39). Contact data from
  `src/lib/site.ts`. Products from `src/features/catalog/` (D37).
- Every measured value cites `design/inventory/home.md:<line>` in a comment. Missing token → report,
  never invent (`.claude/rules/ui.md`).
- Section anchors: `contact.tsx` renders `id="contact"`, `how-it-works.tsx` renders
  `id="how-it-works"` — `ROUTES.contact` / `ROUTES.howItWorks` depend on them.

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
None folder-scoped. Governing: **D22, D29, D30, D32, D33, D35, D37, D39** (root `llm.md` §5b).

## Connects to
- Depends on: `src/components/ui/*`, `src/features/catalog/` (`ProductCard`, seed data),
  `src/lib/site.ts`, `src/lib/routes.ts`, `public/images/`, `src/app/globals.css`.
- Depended on by: `src/app/(storefront)/page.tsx` only.

## Don't
- Don't put the header, footer or drawer here (`src/components/site/`).
- Don't put the finder here (`src/features/finder/`).
- Don't ship the artboard's `Winter 2026` or the mobile-only copy variant (D32, D22).
- Don't add the desktop→mobile breakpoint from the artboards; they have none. `sm:` 720 is D10.

## Open
- Parity table: `design/reports/home.md`.
- Finder `Model` select lists every make's models under `<optgroup>` (no JS); see `src/features/finder/llm.md`.
- Mobile carousel shows the native scrollbar on platforms that draw one; no hide utility exists. Owner's call.
