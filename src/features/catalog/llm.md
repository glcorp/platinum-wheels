# src/features/catalog

## Purpose
The product domain: what a product *is* in this build, and the card that renders it. Since **D58**
(2026-09-21) that means three categories, not one — tires, wheels and accessories — and this folder also
owns the table that tells the rest of the build how they differ. `ProductCard` is "the
storefront's most reused component" (`product-card.tsx:10`) — one shell with three homes, the home
`featured-tires` row, the `/results` grid and the PDP `similar-products` row, all three of which measure
byte-identically, so there is one component and no per-context variant (`product-card.tsx:12-18`).
Delete this folder and every route loses its product surface, and `/results`, `/wheels` and
`/accessories` lose the config that distinguishes them.

## Owns
- [`types.ts`](types.ts) — `Product` and `ProductBadge`. The field list is **measured, not designed**:
  `design/inventory/results.md:363` (§3.10 "Variation between card instances") is the exhaustive list of
  what differs across the 14 card instances — image + alt, badge slot, brand, model, size, 3PMSF
  presence, price, CTA variant — and everything else is byte-identical, so nothing else belongs in the
  type (`types.ts:4-8`). `ProductBadge` is `winter | all-season | summer | oem | studdable`;
  `Currently unavailable` is deliberately **not** a member — the artboards use it as a *replacement* for
  the season badge, so it derives from `available` (`types.ts:25-28`). Optional `image?: string`
  (`types.ts:43-54`) is the cut-out basename when it differs from `slug` — measured variation, not
  design: `design/inventory/results.md:363` (§3.10) lists "image src + alt" among what differs between
  card instances, and four cut-outs cover the nine SKUs (D43). A per-SKU photo set removes every `image`
  and leaves `slug` doing the work again. Optional `studdable?: boolean` is the PDP spec table's
  `Winter (studdable)` row (D53(2)); it is deliberately **not** pushed into `badges`, which would give
  that card a second badge and move a measured `/results` parity row. Carried by
  `zeta-antarctica-sport` and its 235/40R18 sibling — the drawn PDP subject.
  **D58 added** `ProductCategory`, `WheelFinish`, `AccessoryType`, `WheelSpec`, the optional
  `category` / `wheel` / `accessoryType` fields, `productCategory()` (absent `category` = tires) and
  `productImageSrc()` (shared by `ProductCard` and `PdpGallery`).
- [`categories.ts`](categories.ts) — `CATEGORY_CONFIG`, the per-category table (**D58**): route, nav
  item, Category-row label, breadcrumb crumb, the three size fields (param, caption, label prefix, strip
  regex, `read`), the chip group (label, param, options, `match`), the finder (`{ cta }` — **non-null on
  all three categories since D67**, which vetoed D59(2)'s omission on `/accessories`; `null` stays legal
  and is taken by nobody), the price label, the unit copy and the two authored copy strings.
  `categoryConfig()`, `configFor(product)`, `sizeParams()` and
  `parseTireSize()`. **It lives here, not in `results/`,** because three features need it —
  `results/` for facets, `product/` for the spec table and units, `ProductCard` for the price suffix —
  and D37 routes every cross-feature import through `catalog/`. It imports **no seed data**, so
  `filter-panel.tsx` (a `"use client"` island) can import it.
- [`components/product-card.tsx`](components/product-card.tsx) — `ProductCard`, props
  `{ product: Product }`. A Server Component: hover is pure CSS (`product-card.tsx:29-30`). Composes
  `Badge`, `Button` and `Price` (`:4-6`). The photo src is `/images/products/` + `product.image ?? slug`
  + `.webp` (`product-card.tsx:160`). Per-value sources are in the inline comments.
- [`data.ts`](data.ts) — `FEATURED_PRODUCTS`, the four artboard SKUs of the home row, flagged sample
  (D29, `design/inventory/home.md:278-285`), and `PRODUCTS`, the nine-SKU `/results` seed (D43): the four
  featured objects spread first (`data.ts:84-85`) so seed order is artboard order, then
  `zeta-antarctica-sport-235-40r18`, `zmax-landgema-235-40r18`, `mazzini-snowleopard-225-50r17`,
  `zmax-winterhawk-215-50r17` (`available: false`, the drawn unavailable card — `data.ts:126-139`) and
  `zmax-landgema-225-45r17`. Each of the five carries a size-suffixed slug and an `image` pointing at
  its base SKU's cut-out. **D58 added** `WHEELS` (nine SKUs, brands Touren and Spec-1, one
  unavailable) and `ACCESSORIES`, plus `ALL_PRODUCTS` and `productsIn(category)`. **D63 re-cut
  `ACCESSORIES`** to the four types the client's photography actually covers — TPMS, lug nuts, wheel
  locks, centre caps — with brands Bosch / Gorilla / Sentali. `findProduct(slug)` searches
  `ALL_PRODUCTS`. All of it is placeholder data (D48) — the tire rows are untouched and carry no
  `category` field, which is what keeps every measured card byte-identical.

## Rules
- **Nothing enters `Product` that the cards do not vary on.** The field list traces to
  `design/inventory/results.md:363`; adding a field means measuring it first.
- **Deliberately absent, and must stay absent:** stock counts, shipping, ratings, invented specs
  (`docs/decisions.md:107`), and — because there is no cart — quantity, availability counts and any
  add-to-cart affordance (`docs/decisions.md:105`, `types.ts:10-13`).
- **Route shape comes from `src/lib/routes.ts`** (`productRoute()`, `quoteRoute()`, D39); the card owns no
  path literal — D18.
  Every `href` in all seven exports is `"#"` (`design/inventory/results.md:716`), so the shape is ours.
- **Badges: WINTER first, at most two** (`design/DESIGN.md:201`, implemented `product-card.tsx:121-131`).
  On the unavailable card the dim badge takes the slot instead of a season badge and the 3PMSF mark is
  dropped (`design/inventory/results.md:355`, `:367`).
- **Unavailable = dimmed card, `Currently unavailable` badge, price in `--text-dim`, ghost
  `Inquire about restock` CTA; the page still returns HTTP 200** (`docs/decisions.md:116`).
- **The model link uses `tap-extend`** — DEVIATIONS #16. Display type at 24px/0.92 is 22.1px tall and
  fails both the 44px floor and WCAG 2.5.8; `tap-extend` adds a transparent band, no padding, no height,
  no layout shift, so every parity row is unchanged.
- **Card hover is `border-color` + `translate`, 150ms `cubic-bezier(.2,0,0,1)`** — DEVIATIONS #15.
  Tailwind v4 lifts with the `translate` property, not `transform`, so a computed-style parity table
  reading `translate` where the artboard reads `transform` is **expected, not a failure**. The photo
  does not zoom.
- **The whole card is not an anchor** — wrapping it would nest the CTA link inside it
  (`product-card.tsx:229-230`).
- **Price suffix is per context AND per category**: cards read `/ tire`, `/ wheel`, `/ each` — D21
  extended by D58. The card passes `context="card"` plus `unit={configFor(product).unit.card}`; the
  default keeps the tire string, so an un-passed caller is unchanged.
- **`category` is optional and absent means tires.** Never write `category: "tires"` into the seed —
  every tire row is parity-measured and stays exactly as it was (D58).
- **A wheel or accessory carries no badge and no 3PMSF.** No artboard draws one for them, so none is
  invented (D59(4), the D7 precedent).
- **`categories.ts` never imports seed data.** A `"use client"` island imports it; a seed import there
  would pull the whole catalogue into the browser bundle. It imports nothing from `finder/` either —
  that would be a back-edge across D37's one-way graph, which is why the accessory-to-vehicle match
  (D67) lives in `results/search.ts`, where both the config and the fitment map already meet.
- **A category's `finder` is off only when its data genuinely cannot answer a vehicle.** D59(2) turned
  it off on accessories for a reason the seed disproved — lug nuts carry a thread pitch, TPMS sensors a
  frequency — and the owner vetoed it (D67). Before setting `finder: null` on anything, check the seed's
  own spec strings first.

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | None folder-scoped. | Every ruling that shapes this folder is global. | — |

Referenced: **D18** (routes, and the one-pair-of-constants derivation), **D19** (cut-outs normalised to
one 1000×1000 square canvas, never upscaled), **D21** (price suffix), **D29** (planned seed data),
**D9** (the wheel CSV contributes nothing to `Product` — the D58 wheel seed is authored here, **not**
derived from that feed), **D58** (three categories, `categories.ts`, the two new seeds), **D59**
(the seven derived rulings, **(2) now vetoed**), **D67** (`/accessories` gets a finder; `nearMiss`
there becomes `fitment` because the line now renders). DEVIATIONS #15 and #16 above; #52 records D67
in place.

## Connects to
- **Depends on:** `src/components/ui/badge.tsx`, `button.tsx`, `price.tsx` (`product-card.tsx:4-6`);
  `src/features/catalog/types.ts` (`:7`); `next/image`, `next/link` (`:1-2`); `src/app/globals.css` for
  `photo-inset-card`, `photo-vignette`, `transition-card`, `tap-extend`, `display`, `numeral`;
  `public/images/products/<slug>.webp`.
- **Depended on by:** `src/app/(storefront)/styleguide/page.tsx`; `src/features/home/` (featured row,
  D29); `src/features/results/` — `search.ts` filters, sorts and splits `productsIn(category)` and is the
  only place results are computed (D44), `query.ts` and `filter-panel.tsx` read `CATEGORY_CONFIG`, and
  the grid renders `ProductCard`; `src/features/product/` — `view.ts` reads `configFor()` for the spec
  table, the back href, the units and the similar list, and `pdp-gallery.tsx` reads `productImageSrc()`.

## Don't
- **Don't add a second card variant per context.** All three homes measure identically
  (`product-card.tsx:12-18`); a variant would be three parity baselines instead of one.
- **Don't hardcode `/products/…` at a call site.** Use `productRoute()` from `src/lib/routes.ts` (D18, D39).
- **Don't add `stock`, `rating`, `reviewCount`, `inStock: number` or `quantity` to `Product`**
  (`docs/decisions.md:105-107`).
- **Don't upscale a product cut-out to fix the two low-res SKUs.** `scripts/prepare-assets.mjs` refuses
  by design; it is a client blocker (D19, `HANDOFF.md` §7).
- **Don't change the CTA copy.** `Request a quote` / `Inquire about restock` are artboard-verbatim
  (`product-card.tsx:330`, `docs/decisions.md:105`).
- **Don't list `transform` in the hover transition** to match the artboard string — it would be inert
  (DEVIATIONS #15).

## Open
1. ~~**`data.ts` is not written.**~~ Written: `FEATURED_PRODUCTS` (D29) and the nine-SKU `PRODUCTS`
   (D43). All four featured SKUs still share `215/55R16` — the home row is "a staged result for that
   vehicle, not a real merchandising selection" (`design/DEVIATIONS.md`, Sample data).
2. **Four product images cover nine tire SKUs**, and two cut-outs are too low-resolution to normalise —
   client blockers, `HANDOFF.md` §7. Needs the client, not code.
4. **Wheel and accessory imagery.** Wheels: **two** usable cut-outs cover nine SKUs — the third,
   `touren-tr79`, cannot be normalised, so its SKUs borrow `touren-tr76` (D63); `zmax-landgema` borrows
   `zmax-winterhawk` for the same reason. Accessories: **five real client product shots** arrived
   2026-09-21 (D63) and are wired in, so the absolute-path branch in `productImageSrc()` is no longer
   used by anything and can go once the last placeholder does. What is still owed is **transparent
   cut-outs** — the supplied shots were taken on white, and their drop shadows survive background
   keying (`design/ASSET-CREDITS.md`). Client, via owner.
5. **Nobody has confirmed the shop stocks Touren, Spec-1, Gorilla, Bosch or Sentali.** The last two
   arrived with the accessory photography and are legible in it. Joins the brand-confirmation blocker
   in `HANDOFF.md` §7. Client, via owner.
6. **The accessory types follow the photography (D63).** `valve-stems` and `hub-rings` were invented and
   had no imagery; they are gone, and `centre-caps` is in. Adding a type without a product shot for it
   puts the build back where it started.
3. ~~**Facet counts do not reconcile.**~~ Answered by **D42**: every facet count, the result count,
   `Filters (n)` and the price bounds are computed from this seed, never typed
   (`design/DEVIATIONS.md` #25). The drawn numbers stay unreconciled and unused.
