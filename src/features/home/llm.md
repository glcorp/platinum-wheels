# src/features/home

## Purpose
The sections that exist only on `/`: hero, category tiles, winter promo, how-it-works, featured tires,
brand strip, contact. D33 put them here rather than in `src/components/site/` (chrome) or `src/lib/`.
The finder is **not** here — it is its own feature, `src/features/finder/` (`docs/decisions.md` §3).
Delete this folder and `/` renders header and footer around nothing.

## Owns
One file per manifest section (`design/manifest.md` §1); each header comment carries its measured
sources (`design/inventory/home.md` §2.x). All Server Components except the carousel island.
- [`components/hero.tsx`](components/hero.tsx) — `Hero`, no props. Full-bleed `hero-tread.webp`, scrim, eyebrow / h1 / lede. home.md §2.1. Since **D134** two starting-price tags sit under the lede (`STARTING_PRICES`, `src/lib/site.ts`), each a link to `/tires` / `/wheels`: undrawn, owner's words verbatim, shown whatever `PRICES_VISIBLE` says.
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
- [`components/brand-strip.tsx`](components/brand-strip.tsx) — `BrandStrip`. The drawn band (fill, hairlines, margins, paddings: home.md §2.8) holding a **CSS-only ticker of real brand logos** since **D129**: the list twice in a track that slides one list's width, the copy `aria-hidden`; a no-JS pause checkbox (WCAG 2.2.2) plus pause on hover and focus; reduced motion shows one static wrapping row. Mechanics are the `brand-marquee` utility (`globals.css`, "Brand marquee (D129)"). No longer reads `BRANDS`.
- [`brand-logos.ts`](brand-logos.ts) — `BRAND_LOGOS`: the nineteen ticker brands in display order, each with its file slug (`public/images/brands/<slug>.svg`), measured `aspect` and optical `scale` (D129). Sources: `design/ASSET-CREDITS.md` "Brand logos".
- [`components/contact.tsx`](components/contact.tsx) — `Contact`, `id="contact"`. One DOM, four blocks placed by grid per width (D22). home.md §2.9.

## Rules
- One file per manifest section, named by the section: `hero.tsx`, `category-tiles.tsx`,
  `winter-promo.tsx`, `how-it-works.tsx`, `featured-tires.tsx`, `brand-strip.tsx`, `contact.tsx`.
- Server Components. The only client island is the mobile featured carousel (D30).
- Copy is artboard-verbatim (`.claude/rules/ui.md` "Copy") **except where the owner's copy pass of
  2026-10-03 (D130) rewrote it**: the four `how-it-works` steps, the winter promo's em dash and the
  contact hours (`SITE.hours`). No visible line carries an em dash. Desktop wording at all widths (D22).
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
| D151 | 2026-10-04 | `How it works` step titles carry `text-ink`: both artboards leave them on the page colour (`html,body{color:var(--text)}`, `home-desktop.html:43`), while our `body` is `--text-muted`, so they rendered grey. Removes a difference; no DEVIATIONS row. | Launch audit (D145, UI-PARITY). | Owner, 2026-10-04: "Apply all code items" |
| D141 | 2026-10-04 | The hero copy stack sits in a wrapper capped at `max-w-content` and centred from `lg:` (the stack keeps its 1100px `max-w-hero`), so above 1440 it starts on the header logo's and finder panel's edge; photo and scrim stay full-bleed. No height or vertical spacing changes; identical at ≤1440. | At 1920 the copy sat at x=48 while the header and finder sat at x=288. | Owner, 2026-10-04 ("symmetry should be maintained"); DEVIATIONS #114 |
| D134 | 2026-10-03 | Two starting-price tags under the hero lede: `Tires starting from $79.99 ea`, `Wheels starting from $249.99 ea`, the owner's lines verbatim (case, cents, `ea`) from `STARTING_PRICES` in `src/lib/site.ts`. Each is a link to its category (`ROUTES[category]`, typed `nav-forward`), drawn in the header phone CTA's vocabulary: 1px `--accent` outline on a `--scrim-strong` ground, filling lime on hover with every word easing to `--on-accent` (`price-tag-ink`, `globals.css` D134 block); the amount is `numeral` in `--text`, never lime. Screen readers hear `each` for the visible `ea`. Not behind `PRICES_VISIBLE`: marketing lines, not catalogue prices. On `fold-minimal` phones the copy stack gap closes 16 -> 8px and the tag tightens to 44px, so at 320x568 the finder panel ends at the fold exactly as before. | Owner, 2026-10-03: *"since now we are not displaying the prices on the front page, we just want to show this. So add that this on the hero image or you know make it attractive so that people can see."* | D134 (root row owed); DEVIATIONS row owed |
| D153 | 2026-10-05 | The featured heading `Winter sets, in stock now.` and the two hero starting prices stay, and are backed: the owner confirmed both are true (launch audit Batch 4). The source is the owner's word; no stock or price check runs in code. | Owner, 2026-10-05: *"Keep both (record source)"*. | Root row D153 |
| D129 | 2026-10-03 | The brand strip becomes a right-to-left ticker of nineteen famous tire and wheel brands' real logos, one muted ink (`text-ink-dim`) brightening to `text-ink` on hover, painted through CSS masks so no brand colour shows. Supersedes D91b's brand-strip columns and the drawn text-wordmark grid; the band itself is unchanged. | Owner, 2026-10-03: *"get the actual brand logo and add it there … it could be a moving strip … like a ticker"*, then chose "Famous tire + wheel brands", muted, brighter on hover; owner states the shop has permission to show the logos. | D129; `design/ASSET-CREDITS.md` |
| D93b | 2026-09-30 | The featured arrows are named "Previous featured tire" / "Next featured tire", carry `aria-controls="featured-track"` and a hover state; the brand-strip `<li>` is `translate="no"`. | Unnamed controls that scroll an unnamed region; browser translation mangled brand marks. | QA pass WDG-13, WDG-15; DEVIATIONS #83; D93b |
| D91b | 2026-09-29 | Hero: `min-h-*` in place of fixed heights, copy in flow; brand strip: 6 columns from `sm:` to `lg:`, the drawn 8 from 1320 (DEVIATIONS #82; **superseded by D129**, the ticker); contact: phone numbers never wrap, cards stack from `sm:` and pair from `md:`, 24px card padding at 1100–1319; the desktop hero scrim's upper band is `--scrim-mid` (DEVIATIONS #79, in `globals.css`). 390 and 1440 unchanged except the scrim. | WCAG 1.4.12 clipped the hero copy by up to 216px; brand marks and phone pills collided or wrapped at rest in the undrawn bands; the eyebrow and h1 measured 2.03 and 2.29:1 over the photo. | QA pass KBD-1/2/6, NJR-7; owner rulings 2026-09-29; D91b |
None folder-scoped. Governing: **D22, D29, D30, D32, D33, D35, D37, D39** (root `llm.md` §5b).

## Connects to
- Depends on: `src/components/ui/*`, `src/features/catalog/` (`ProductCard`, seed data),
  `src/lib/site.ts`, `src/lib/routes.ts`, `public/images/` (incl. `public/images/brands/`, D129), `src/app/globals.css`.
- Depended on by: `src/app/(storefront)/page.tsx` only.

## Don't
- Don't put the header, footer or drawer here (`src/components/site/`).
- Don't put the finder here (`src/features/finder/`).
- Don't ship the artboard's `Winter 2026` or the mobile-only copy variant (D32, D22).
- Don't add the desktop→mobile breakpoint from the artboards; they have none. `sm:` 720 is D10.
- Don't give a brand logo its own colour, an `<img>`, or a link. The ticker paints every logo `currentColor` through a mask so the
  colour is a token (D129); the owner did not ask for links. A new logo needs a row in `design/ASSET-CREDITS.md`, its measured
  `aspect`, and a `scale` tuned on a rendered strip.
- Don't drop the brand ticker's reduced-motion fallback: the global reduced-motion kill alone would park the track on the
  hidden copy. Its pause button was removed by owner ruling (**D139**, 2026-10-04), which leaves no pause for keyboard or
  touch users, a known WCAG 2.2.2 gap; putting one back is the owner's call.

## Open
- Parity table: `design/reports/home.md`.
- **Brand ticker (D129) is unmeasured against a live build** — checked on a static render of the real component with the
  compiled `globals.css` in headless Chromium at 320/390/768/1440/1920 (no page overflow, seamless loop, pause by toggle,
  focus and hover, reduced-motion rows). Safari/Firefox and the real page are not checked. The e2e specs that read the old
  strip (`home.spec.ts` `[data-probe="brands"] > li`, `parity.spec.ts` "brand strip item" / `grid-template-columns`, the
  `a11y-interaction.spec.ts` brand fixme) describe the drawn grid and need rewriting when the suite is unparked (D111).
  Coordinator: `design/reports/home.md` rows for the brand strip are stale.
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
- ~~**`FEATURED_SLUGS` holds placeholder slugs**~~ **Closed 2026-10-03:** the row is six winter tires from
  six brands in 205/55R16, picked from the D125 load (owner chose *"Six brands, 205/55R16"*). Six distinct
  models, so the old note about two SKUs appearing twice no longer holds. They have no price (D122) and
  no photo until the R2 photo load (D126b). The row shows only after a deploy (D111).
