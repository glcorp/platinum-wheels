# src/features/catalog

## Purpose
The product domain: what a product *is* in this build, and the card that renders it. Since **D58**
(2026-09-21) that means three categories, not one — tires, wheels and accessories — and this folder also
owns the table that tells the rest of the build how they differ. `ProductCard` is "the
storefront's most reused component" (`product-card.tsx:10`) — one shell with three homes, the home
`featured-tires` row, the `/tires` grid and the PDP `similar-products` row, all three of which measure
byte-identically, so there is one component and no per-context variant (`product-card.tsx:12-18`).
Delete this folder and every route loses its product surface, and `/tires`, `/wheels` and
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
  that card a second badge and move a measured `/tires` parity row. Carried by
  `zeta-antarctica-sport` and its 235/40R18 sibling — the drawn PDP subject.
  **D58 added** `ProductCategory`, `AccessoryType`, `WheelSpec` (`WheelFinish` went with the finish filter, D105b), the optional
  `category` / `wheel` / `accessoryType` fields, `productCategory()` (absent `category` = tires) and
  `productImageSrc()` (shared by `ProductCard` and `PdpGallery`).
- [`categories.ts`](categories.ts) — `CATEGORY_CONFIG`, the per-category table (**D58**): route, nav
  item, breadcrumb crumb, the three size fields (param, caption, label prefix, strip regex, `read`), the
  chip group (label, param, options, `match`), the finder (`{ cta }` — **non-null on all three
  categories since D67**, which vetoed D59(2)'s omission on `/accessories`; `null` stays legal
  and is taken by nobody), the price label, the unit copy and the two authored copy strings. Plus
  `categoryConfig()`, `configFor(product)`, `sizeParams()` and `parseTireSize()`. **It lives here, not in
  `results/`,** because three features need it — `results/` for facets, `product/` for the spec table and
  units, `ProductCard` for the price suffix —
  and D37 routes every cross-feature import through `catalog/`. It imports **no seed data**, so
  `filter-panel.tsx` (a `"use client"` island) can import it. **No `label` field since D71**: it fed only
  the rail's `Category` group, now unbuilt (#60).
- [`components/product-card.tsx`](components/product-card.tsx) — `ProductCard`, props
  `{ product: Product }`. A Server Component: hover is pure CSS (`product-card.tsx:29-30`). Composes
  `Badge`, `Button` and `Price` (`:4-6`). The photo src is `/images/products/` + `product.image ?? slug`
  + `.webp` (`product-card.tsx:160`). The photo is wrapped in a second `<Link>` to the same
  `productRoute(slug)` the model link uses, `tabIndex={-1} aria-hidden="true"` so it adds a pointer
  affordance without a second tab stop or a second announced route (DEVIATIONS #69). **That anchor's box
  was correct from the start but sat under three `position:absolute` siblings — the `photo-vignette` div,
  the badge-row wrapper, the brand-stamp span — that CSS paints above it regardless of DOM order; none
  carried `pointer-events:none`, so the full-box vignette silently swallowed every click on the photo.
  Corrected 2026-09-22 by adding `pointer-events-none` to all three overlays** (DEVIATIONS #69, amended).
  Per-value sources are in the inline comments.
- ~~`data.ts`~~ **Deleted by D108b.** The seed (nine tires, nine wheels, nine accessories, the featured
  row) is gone; every page reads the database. `/styleguide` keeps its own hand-built sample cards.
- [`adapter.ts`](adapter.ts) — `toProduct()`: a database product (`CatalogProduct`) into the card-shaped
  `Product` every component renders, plus the hyphen/underscore enum spelling and `ACCESSORY_LABEL`. The
  one place the two shapes meet (D108b). Pure, client-safe.
- [`cache-tag.ts`](cache-tag.ts) — `CATALOGUE_TAG`, the one tag for a cached catalogue read; the product
  admin's actions expire it on every write.
- [`components/product-photo-placeholder.tsx`](components/product-photo-placeholder.tsx) — the tile a
  product with no photo shows in the card and the gallery: its brand in display type, nothing else
  (owner, 2026-09-30, D108b).
- **The database-backed catalogue (D105b, D106b), read by every storefront page since D108b.** It was
  exercised against a throwaway Postgres loaded with the vendor sheets; **no test file is committed.**
  - [`catalog-types.ts`](catalog-types.ts) — the data contract: `CatalogProduct`, `ProductFilters`,
    `CatalogFacets`, `ProductInput`, `AdminProduct`, plus the four enum value lists. No database code,
    client-safe.
  - [`queries.ts`](queries.ts) — storefront reads: `listProducts`, `getFacets`, `getProductBySlug`,
    `getOtherSizes`, `getSimilarProducts`, `getProductsBySlugs`, `getPriceBounds`, `getBrands` (every
    brand a category carries, whatever is filtered; D111), `listProductUrls`.
    The only place visibility is decided.
  - [`store.ts`](store.ts) — staff reads and every write: `listAllProducts`, `getProductById`,
    `listBrands`, `createProduct`, `updateProduct`, `setProductStatus`, `bulkSetProductStatus`, and
    `createProductsBatch` (D114), the bulk form of `createProduct` for a catalogue load: one INSERT
    per table for a whole batch, inside the caller's transaction, with nothing looked up.
    **Not gated**; `src/features/admin/` is the gate.
  - [`product-input.ts`](product-input.ts) — `PRODUCT_FIELD` and `parseProductInput()`, the one
    validator every writer goes through. Pure.
  - [`size.ts`](size.ts) — `parseTireSizeSpec()` (metric and flotation) and the bolt-pattern
    normalisers. Pure. [`slug.ts`](slug.ts) — `buildProductSlug()`, and `nextFreeSlug()`, the one
    `-2`, `-3` rule a single create and a bulk load share. Pure.
  - [`rows.ts`](rows.ts) — the product + specs join and the row mapper, shared by `queries.ts` and
    `store.ts`.
- **The catalogue import (D113, D114).** Run by `scripts/catalog-import.ts`.
  - [`import-mapping.ts`](import-mapping.ts) — `IMPORT_MAPPING`: CSV header → product field, the exact
    value renames, the numbered source columns and the photo columns. **The one file to edit when the
    catalogue file's layout changes.** Pure.
  - [`import-plan.ts`](import-plan.ts) — `planImport()`: rows in; what would be created (each with its
    slug) and what is refused, with the reason and the column, out. Drives the dry run and the real
    load alike. Pure.

## Rules
- **Storefront pages read through `queries.ts` only, never `store.ts`.** `queries.ts` cannot return a
  `hidden` product or a vendor source; `store.ts` returns both (D105b).
- **Listings show `published` only; a product page loads `published` and `discontinued`; `hidden` is a
  404.** There is no in-stock flag (D105b).
- **A slug is written once, at create, and never rewritten** (D107b).
- **`queries.ts`, `store.ts` and `rows.ts` are server only.** They open database connections. A
  `"use client"` file may import `catalog-types.ts`, `product-input.ts`, `size.ts` and `slug.ts`.
- **The import reports; it does not repair** (D113). A row is valid as the file gives it, after the
  mapping's exact renames, or it is refused and listed. No cleanup, no de-duplication, no guessing in
  `import-plan.ts` or `import-mapping.ts`. Two rows with one vendor + SKU are both refused.
- **`createProductsBatch` must write exactly what `createProduct` writes.** Change one, change the
  other, and compare them on a real Postgres (checked row for row on 2,345 products, D114).
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
- **The photo is a link to the PDP, but a hidden one.** It is wrapped in its own `<Link>` to the same
  href as the model link, `tabIndex={-1} aria-hidden="true"` — a pointer-only affordance, not a second
  keyboard/AT stop. The model link stays the card's one announced route (DEVIATIONS #69, the D57/D66
  duplicate-tab-stop precedent).
- **Every purely decorative overlay inside the photo box needs `pointer-events-none`.** `position:static`
  content (the image anchor) paints *below* `position:absolute` siblings regardless of DOM order, so an
  absolutely-positioned decorative layer with default `pointer-events: auto` silently steals clicks from
  whatever is beneath it — this is exactly how the image link above went dead (DEVIATIONS #69, amended).
  Any new absolutely-positioned layer added to this box needs the same treatment unless it is meant to
  intercept clicks itself.
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
- **The card photo is a shared element (D92b).** `ProductCard` wraps its `<Image>` in
  `<ViewTransition name={`product-photo-${slug}`} default="none">` whose `share` is **type-keyed**:
  `{ "product-open": "morph", "product-back": "morph", default: "none" }`. Only a navigation carrying
  one of those types may pair a card with the PDP gallery — the two PDP links carry
  `["nav-forward", "product-open"]` and `prefetch={true}`. Any caller that can render the same slug twice
  on one page, or on both ends of a `product-open` navigation, passes `morph={false}`: `/styleguide` and
  `product/`'s `SimilarProducts` do.

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| D93b | 2026-09-30 | The `ProductCard` model link carries an `sr-only` size tail, so the same model in two sizes has distinct link names (WCAG 2.4.4); the brand stamp is `translate="no"`. Tests match the model name by regex prefix, never exactly. | Two links read identically to a screen reader. | QA pass; D93b |
| D91b | 2026-09-29 | `ProductCard` takes an optional `sizes` (default unchanged); each grid passes its own. The photo box is a padded wrapping flex row, so the brand stamp wraps below the badges instead of overlapping them; the image link is `absolute inset-0`, the same box as before. | `sizes` said 50vw where the results grid is 1-up (400–719), so phones fetched about half the pixels they paint; the `Currently unavailable` badge overlapped the stamp by up to 34.6px at 1100–1180. | QA pass WDG-06, NJR-6; D91b |
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
- **Depends on (D105b):** `src/db/` (`getDb()`, the catalogue tables).
- **Depended on by (D105b):** `src/features/admin/` — `product-queries.ts` and `product-actions.ts` call
  `store.ts` and `product-input.ts`.
- **Depended on by (D113):** `scripts/catalog-import.ts` — `import-plan.ts`, `import-mapping.ts` and
  `store.ts` `createProductsBatch`.
- **Depended on by:** `src/app/(storefront)/styleguide/page.tsx`; `src/features/home/` (featured row,
  D29); `src/features/results/` — `search.ts` asks `queries.ts` for the lists and facets and is the
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
- **Don't make the card photo's `share` a plain string** to "fix" a missing morph. Untyped, every slug
  present on both pages pairs and flies at once — Home → `/tires` flew six photos (D92b).

## Open
13. **The catalogue holds the STAND-IN load, not the approved data** (D113): 44,143 products from the
    scraped vendor sheets, all `published`, no prices, no photos, duplicates across vendors not
    merged. When the co-founder's cleaned CSV arrives the catalogue is emptied and loaded fresh, and
    emptying it is its own effort: nothing in the repo does it. Owner.
14. **10,249 stand-in slugs carry a `-2`, `-3` …**, mostly PRO WHEELS wheels that share brand, model,
    size, bolt pattern, offset and finish and differ only in something the slug does not read (centre
    bore, SKU). Those suffixes follow file order, so they move if the file's order does. Whether the
    wheel slug should carry more is the owner's call (D107b(1)).
7. ~~**Wire the pages to `queries.ts`**~~ **Done by D108b**, with the four UI changes D105b listed.
8. **Only the home row is cached** (`home/featured.ts`, D109; by tag with no timer since D111). The results and product pages read Postgres
   on every request: measured at 6 to 97 ms with all ~46k vendor rows, and their filter combinations
   are unbounded, so a cache there would grow without limit for little gain. Revisit if a page is slow
   in production. Owner.
11. ~~**No sitemap yet.**~~ **Closed 2026-09-30 by D112:** `src/features/seo/sitemap.ts` calls
    `listProductUrls()` once per category, behind the indexing flag.
12. **`public/images/products/*.webp` is now used by `/styleguide` only.** The seed cut-outs stay until
    real product photos are uploaded. Owner.
9. **Tire sizes the parser refuses**, all real but none in the vendor sheets: commercial `11R22.5` and
   `7.50R16`, run-flat `225/45RF17`, temporary `T125/70D16`. Add them to `size.ts` only if the shop
   sells them. Owner.
10. **A brand spelled two ways is two brands** (`GOODYEAR` / `Goodyear` in the scraped sheets): two facet
    rows, and "other sizes" split between them. The approved CSV is expected to arrive clean; nothing
    here canonicalises it. Co-founder, via owner.
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
