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
- [`components/category-tiles.tsx`](components/category-tiles.tsx) — `CategoryTiles`. "Shop by category" (D93b, DEVIATIONS #87: section numbers dropped), `md:category-grid` 2fr/1fr; the D35 text-colour hover stays suppressed, and since D92b the tiles take the card's border + 2px lift hover (DEVIATIONS #77). home.md §2.4.
- [`components/winter-promo.tsx`](components/winter-promo.tsx) — `WinterPromo`. Full-bleed photo + tinted panel, computed `Winter <year>` (D32), spec chips inline (not `Chip`). home.md §2.5.
- [`components/how-it-works.tsx`](components/how-it-works.tsx) — `HowItWorks`, `id="how-it-works"`. Four steps as data; eyebrow only, no h2. home.md §2.6.
- [`components/featured-tires.tsx`](components/featured-tires.tsx) — `FeaturedTires`. Async server shell: spacing, hands the featured products to the island, and renders nothing when none resolve. home.md §2.7.
- [`featured.ts`](featured.ts) — `FEATURED_SLUGS`, **a fixed list of product slugs in code** (owner, 2026-09-30, D108b: not an automatic rule, not an admin tick), and `getFeaturedProducts()`, which reads them from the catalogue through `unstable_cache` (tag `CATALOGUE_TAG`, **no timer**, D111). A slug that does not resolve is skipped; a failed read logs `home.featured.read_failed` and returns none. `/` stays prerendered and fully static: the row follows the database when the product admin's actions expire the tag and on every deploy (the cache key carries the deployment's id, because an `unstable_cache` entry otherwise outlives the deploy that wrote it), never on a clock (a timed `revalidate` sends the `stale-while-revalidate` header D93b reverted, WDG-09).
- [`components/featured-carousel.tsx`](components/featured-carousel.tsx) — `FeaturedCarousel`, **the one `"use client"` file** (D30): heading row with prev/next, scroll-snap track, dot progress.
  Since **D74** the track is a flex scroll-snap scroller at **every** width, not a grid from `sm:`, so
  the two drawn desktop arrows act. One press moves one card at any width — `stepSize()` measures the
  delta between the first two children rather than assuming the mobile 272px. Card width comes from
  `featured-card-3` / `featured-card-4` (`globals.css`), which reproduce the drawn grid column exactly.
  The track is `tabIndex={0} role="group" aria-label="Featured tires"` (**D66**): Chrome will not focus
  a plain scrolling `<div>`, so below `sm:` a keyboard user could not scroll it and AT announced four
  cards in an unnamed container. The only paint it adds is the global focus ring.
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
  `id="how-it-works"` — `ROUTES.contact` / `ROUTES.howItWorks` depend on them. Both carry
  `scroll-mt-14 sm:scroll-mt-20` (**D66**, measured 80px): `scroll-margin-top` was set nowhere in the
  build, so following either link landed the section flush at y=0.
- **Motion (D92b).** Every section below the hero and finder carries `data-reveal=""` on its root; the
  page renders `ScrollReveal`, which arms only the ones below the fold at mount. Never put `data-reveal`
  on the hero or the finder. Category tiles take the card's drawn hover (DEVIATIONS #77), and tiles plus
  the winter-promo CTA are typed `nav-forward`.

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| D93b | 2026-09-30 | The featured arrows are named "Previous featured tire" / "Next featured tire", carry `aria-controls="featured-track"` and a hover state; the brand-strip `<li>` is `translate="no"`. | Unnamed controls that scroll an unnamed region; browser translation mangled brand marks. | QA pass WDG-13, WDG-15; DEVIATIONS #83; D93b |
| D91b | 2026-09-29 | Hero: `min-h-*` in place of fixed heights, copy in flow; brand strip: 6 columns from `sm:` to `lg:`, the drawn 8 from 1320 (DEVIATIONS #82); contact: phone numbers never wrap, cards stack from `sm:` and pair from `md:`, 24px card padding at 1100–1319; the desktop hero scrim's upper band is `--scrim-mid` (DEVIATIONS #79, in `globals.css`). 390 and 1440 unchanged except the scrim. | WCAG 1.4.12 clipped the hero copy by up to 216px; brand marks and phone pills collided or wrapped at rest in the undrawn bands; the eyebrow and h1 measured 2.03 and 2.29:1 over the photo. | QA pass KBD-1/2/6, NJR-7; owner rulings 2026-09-29; D91b |
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
- ~~Finder `Model` select lists every make's models under `<optgroup>` (no JS).~~ **Closed 2026-09-22
  by D70:** the server still renders every make's models — that is the no-JS path — and a null-rendering
  leaf island narrows the list to the chosen `Make` when JS is available. The hero finder on `/` gets it
  for free; nothing in this folder changed. See `src/features/finder/llm.md`.
- ~~Mobile carousel shows the native scrollbar; no hide utility exists.~~ **Closed 2026-09-21 by D57
  (audit finding S1):** the shared `hide-scrollbar` utility (`globals.css`) is worn by both this track
  and `similar-track`, which no longer hides its own.
- ~~The two square desktop prev/next buttons can never act — OWNER RULING needed.~~ **Closed
  2026-09-22 by D74:** the owner chose option (c), give them something to scroll. The row is now
  six products (`FEATURED_SLUGS` since D108b) — and the track stays a scroller above `sm:` instead of becoming a grid, so
  `maxScroll > 0` at every width and both arrows act. The first four cards are unmoved: appended, not
  reordered, at the same width. `design/DEVIATIONS.md` #65.
- ~~The mobile `Next` button never reached the end of the track.~~ **Fixed 2026-09-22:** it stepped a
  whole card and wrapped to 0 as soon as the next step would overshoot, so at 390 `scrollLeft` ran
  0 → 272 → 544 → 0 and never reached 702; the fourth card was reachable by swipe only and its dot
  never lit from the button. `scrollByStep` now clamps to `maxScroll` and wraps only from the end
  itself. Scroll position appears in no parity table (the #48 precedent), so no DEVIATIONS row.
- **`globals.css` owes two utilities before this ships** (single-writer, D25 — handed to the
  coordinator, `fade-right` precedent). `@utility featured-card-3 { flex-basis: calc((100% - 2 * 16px) / 3); }`
  and `@utility featured-card-4 { flex-basis: calc((100% - 3 * 16px) / 4); }`. Until they land the
  desktop row renders 260px cards. Written out in the JSX comment at the item wrapper.
- **`design/reports/home.md` needs a re-measure** — not rewritten here (coordinator's call). Desktop
  row `featured track | columns / gap / y`: `grid-template-columns` is now `none`, so the `324×4`
  descriptor becomes flex `324×6`, and the track element's own y moves **−2px** (`sm:-mt-0.5`; every
  card stays put). Mobile row `featured track | columns / gap / w`: `260×4` becomes `260×6`; `w` 374
  and the 12px gap are unchanged. Mobile `featured h2 / next` is unaffected. The dot row is six bars.
- **Two appended SKUs are other sizes of tires already in the row**, so `Antarctica Sport` and
  `Snowleopard` each appear twice. The drawn heading `Winter sets, in stock now.` admits only winter,
  in-stock SKUs and the seed holds exactly two more of those. Six distinct models needs real catalogue
  data. Owner / client.
- **`FEATURED_SLUGS` holds placeholder slugs** (D108b): six winter tires from the vendors' own sheets. All
  six resolve in the stand-in load (D113), where they have no price and no photo. They
  resolve after the approved catalogue only if it carries the same products. Replace them once that data is
  loaded, and keep six or more so both desktop arrows have something to scroll (D74). Owner.
