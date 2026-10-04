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
- [`components/add-to-cart-button.tsx`](components/add-to-cart-button.tsx) — `AddToCartButton`
  (**D122**), the card's and the PDP's one CTA, a client island: the drawn CTA's `Button` box, primary or
  (discontinued) ghost, writes the browser cart (`src/lib/cart.ts`) and reads `Added ✓` / `Updated ✓` for
  1.8 s. Takes the quantity and the server-checked vehicle as props.
- [`cart-item.ts`](cart-item.ts) — `cartItem(product)`, the one description of a product a cart line
  shows (no price), shared by the card, the PDP and the cart's refresh (D122).
- [`components/product-card.tsx`](components/product-card.tsx) — `ProductCard`, props
  `{ product: Product }`. A Server Component: hover is pure CSS (`product-card.tsx:29-30`). Since D122 its
  CTA is `AddToCartButton` (adds one, D127; optional `vehicle` prop) and its `Price` renders only
  while `PRICES_VISIBLE` (`DEVIATIONS.md` #96, #97). Composes
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
  `Product` every component renders, plus the hyphen/underscore enum spelling and `ACCESSORY_LABEL`
  (since D125 the vendors' fifteen labels verbatim, `Center Caps` … `Tire Bags & Storage`). The
  one place the two shapes meet (D108b). Pure, client-safe.
- [`cache-tag.ts`](cache-tag.ts) — `CATALOGUE_TAG`, the one tag for a cached catalogue read; the product
  admin's actions expire it on every write.
- [`components/product-photo-placeholder.tsx`](components/product-photo-placeholder.tsx) — the tile a
  product with no photo shows in the card and the gallery: its brand in display type (owner, 2026-09-30,
  D108b), or with no brand the accessory type from `ACCESSORY_LABEL` (D133). Only a brand is
  `translate="no"`. `ProductCard` also takes `anchorId` (results grid only) and marks its model link
  `data-card-link` (D133).
- **The database-backed catalogue (D105b, D106b), read by every storefront page since D108b.** It was
  exercised against a throwaway Postgres loaded with the vendor sheets; **no test file is committed.**
  - [`catalog-types.ts`](catalog-types.ts) — the data contract: `CatalogProduct`, `ProductFilters`,
    `CatalogFacets`, `ProductInput`, `AdminProduct`, plus the four enum value lists. No database code,
    client-safe.
  - [`queries.ts`](queries.ts) — storefront reads: `listProducts`, `getFacets`, `getProductBySlug`,
    `getOtherSizes`, `getSimilarProducts`, `getProductsBySlugs` (`includeDiscontinued` for the cart,
    D122), `getPriceBounds`, `getBrands` (every
    brand a category carries, whatever is filtered; D111), `listProductUrls`.
    The only place visibility is decided. **Since D132 `getFacets(filters, sizeChoice)` returns
    `StorefrontFacets`**: `CatalogFacets` (whose `tire` / `wheel` lists stay every value the category
    holds) plus `sizeOptions`, each size select's values narrowed to those found with the OTHER size parts
    in `sizeChoice`. Only size parts narrow size options; brand, season, type and price do not. All the
    size lists, whole and narrowed, come from one `array_agg(distinct …) filter (where …)` row per
    category, and every facet read is issued in one wave.
  - [`store.ts`](store.ts) — staff reads and every write: `listAllProducts`, `getProductById`,
    `listBrands`, `createProduct`, `updateProduct`, `setProductStatus`, `bulkSetProductStatus`, and
    `createProductsBatch` (D114), the bulk form of `createProduct` for a catalogue load: one INSERT
    per table for a whole batch, inside the caller's transaction, with nothing looked up.
    **Not gated**; `src/features/admin/` is the gate. Since D127b the admin filter (one set of conditions for
    the list and the bulk UPDATE, `products` columns and EXISTS subqueries only, no joins) also takes
    vendor, accessory type, rim size (a tire's rim diameter or a wheel's diameter) and no photo;
    `listBrands(category?)` lists one category's brands for the form; `bulkSetProductStatus` counts with
    `rowCount` rather than returning ids.
  - [`product-input.ts`](product-input.ts) — `PRODUCT_FIELD` and `parseProductInput()`, the one
    validator every writer goes through. Pure. Since D125 it also reads `extra_specs` (`Label: value`
    pairs, ` | ` or one per line, split on the first `: `), each source's `source_price`, the wheel
    `finish_family` / `color` / `lug_count` and the accessory `part_type` / `weight_lb`; brand is
    optional on an accessory only. Since D142 also `part_number` (wheels and accessories; refused on a
    tire) and the tire's `mud_snow` box, and it refuses a `Part number:` or `Mud & snow:` line in
    `extra_specs`, so each fact lives in one place.
  - [`size.ts`](size.ts) — `parseTireSizeSpec()` (metric and flotation) and the bolt-pattern
    normalisers. Pure. [`slug.ts`](slug.ts) — `buildProductSlug()`, and `nextFreeSlug()`, the one
    `-2`, `-3` rule a single create and a bulk load share. Pure.
  - [`rows.ts`](rows.ts) — the product + specs join and the row mapper, shared by `queries.ts` and
    `store.ts`.
  - [`lookups.ts`](lookups.ts) — small staff reads beside `store.ts` (D116): `listVendors`, `brandExists`,
    `vendorExists` (the pick-from-existing dropdowns and their server-side check; `brandExists` takes the
    category since D127b), `countProductsByStatus`, and `listRimSizes` (D127b, the list's Rim size filter).
    Not gated.
  - [`photos.ts`](photos.ts) — `product_images` reads and writes for the admin (D117): list, add (locks the
    product row; at most `MAX_PHOTOS_PER_PRODUCT`, 8), remove, move. Keeps each product's photos numbered
    0..n-1 and bumps `products.updated_at`. Talks to Postgres only; the files are the photo modules' job.
- **Product photo files (D126b).** Shared by the admin upload, the storefront, the link-preview card and the
  bulk photo load.
  - [`photo-files.ts`](photo-files.ts) — the two sizes (`PHOTO_WIDTH`: `card` 480, `full` 1000), the key
    layout (`photoKey`, `photoFolder`; `catalogPhotoKey` for the shared catalogue photos under `catalog/`, D139b), `photoSized()` (one size's name from the other's) and
    `photoSource()`, which every `next/image` of a product photo spreads: a stored photo comes back at the
    asked size and `unoptimized`. Zero imports; client-safe.
  - [`photo-sizes.ts`](photo-sizes.ts) — `makePhotoSizes()` (and `makePhotoSize()` for one size, D139b): upright, fitted inside the square, never
    enlarged, WebP 82, one pass per size; refuses a canvas over 100 megapixels. `sharp`; server and laptop only.
  - [`photo-store.ts`](photo-store.ts) — the R2 bucket over its S3 API (`aws4fetch`): `photoStore()` from
    the five settings (`null` until all are set), `presignPut`, `headObject`, `getObject`, `putObject`
    (with the one-year immutable cache header), `getObject` (pinned with `ifMatch`, capped with
    `maxBytes`), `deleteObject`, `publicPhotoUrl`, `keyFromPublicUrl`,
    `photosBaseUrl`. Reads the secret key; server and laptop only.
- **The catalogue import (D113, D114).** Run by `scripts/catalog-import.ts`.
  - [`import-mapping.ts`](import-mapping.ts) — `IMPORT_MAPPING`: CSV header → product field, the exact
    value renames (the vendors' fifteen accessory labels, D125), the numbered source columns
    (`source_vendor_n` / `_sku_n` / `_url_n` / `_price_n`) and the photo columns. **The one file to
    edit when the catalogue file's layout changes.** Pure. Layout: `docs/catalogue-csv.md`.
  - [`import-plan.ts`](import-plan.ts) — `planImport()`: rows in; what would be created (each with its
    slug) and what is refused, with the reason and the column, out. Drives the dry run and the real
    load alike. Pure.

## Rules
- **One product per real item for the shopper, every vendor listing a source for the admin (D135).**
  The builder merges; nothing here de-duplicates. An accessory slug is brand + name + part number (the
  `part_number` column since D142), the
  brand dropped from the name when it already leads (`slug.ts`, `stripBrandPrefix`); a product may carry
  20 sources. Wheel `getOtherSizes` keeps only wheels sharing a bolt pattern (D137). A wheel's size
  line carries offset and finish (`adapter.ts`, D136).
- **Storefront pages read through `queries.ts` only, never `store.ts`.** `queries.ts` cannot return a
  `hidden` product or a vendor source; `store.ts` returns both (D105b).
- **A vendor's price never reaches the storefront (D125).** `product_sources.vendor_price` is what a
  vendor charges the shop. No query in `queries.ts` selects `product_sources`; only `store.ts`
  (`AdminProduct.sources[].vendorPrice`) reads it, and no storefront type (`Product`,
  `CatalogProduct`) carries it. `extraSpecs` never holds a price either.
- **`brand` is `null` only on an accessory (D125)**, which `products_brand_required` enforces. The
  brand facet, `getBrands` and `listBrands` skip `null`; `getOtherSizes` matches a null brand with
  `is null`; `Product.brand` is `string | null`, so a card renders no stamp rather than an invented one.
- **Accessory types are the vendors' fifteen (D125).** `AccessoryType` is the enum key with **every**
  underscore spelled as a hyphen (`cap-logos-inserts-hardware`), so `accessoryParam()` /
  `accessoryFromParam()` use `replaceAll`.
- **With prices off, `queries.ts` returns no price and orders by none (D124).** While `PRICES_VISIBLE` is
  false every product it returns has `price: null`, `getPriceBounds` is `null`/`null`, `min`/`max` are
  ignored, the price sorts read as `best`, and `best` and the similar row drop their price tie-break.
  Hiding prices only in components still shipped them in the page data. The admin reads prices through
  `store.ts` and is unaffected.
- **Listings show `published` only; a product page loads `published` and `discontinued`; `hidden` is a
  404.** There is no in-stock flag (D105b).
- **A slug is written once, at create, and never rewritten** (D107b).
- **`queries.ts`, `store.ts`, `rows.ts`, `lookups.ts` and `photos.ts` are server only.** They open database connections. A
  `"use client"` file may import `catalog-types.ts`, `product-input.ts`, `size.ts`, `slug.ts` and
  `photo-files.ts`. `photo-sizes.ts` and `photo-store.ts` are server only too (`sharp`, the R2 secret).
- **Every `next/image` of a product photo spreads `photoSource(src, size)`** (D126b): `card` on cards, the
  cart and admin thumbnails, `full` on the product page. It is what keeps stored photos away from Vercel's
  resizer; `next.config.ts` lists no remote host, so a photo drawn without it breaks (an error in dev,
  a broken image in production).
- **The import reports; it does not repair** (D113). A row is valid as the file gives it, after the
  mapping's exact renames, or it is refused and listed. No cleanup, no de-duplication, no guessing in
  `import-plan.ts` or `import-mapping.ts`. Two rows with one vendor + SKU are both refused.
- **`createProductsBatch` must write exactly what `createProduct` writes.** Change one, change the
  other, and compare them on a real Postgres (checked row for row on 2,345 products, D114).
- **Nothing enters `Product` that the cards do not vary on.** The field list traces to
  `design/inventory/results.md:363`; adding a field means measuring it first.
- **Deliberately absent, and must stay absent:** stock counts, shipping, ratings, invented specs
  (`docs/decisions.md:107`), and quantity or availability counts: since D122 the card adds to a cart, but
  the cart (`src/lib/cart.ts`) keeps the quantities and the product carries none.
- **Route shape comes from `src/lib/routes.ts`** (`productRoute()`, D39; `quoteRoute()` went with D122); the card owns no
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
| D126b | 2026-10-03 | Photos live in R2 in two stored sizes; every page draws them `unoptimized` through `photoSource()`; `photo-files.ts`, `photo-sizes.ts`, `photo-store.ts` are the shared modules | Vercel Hobby's Blob and resize limits | Owner; D126b |
| D93b | 2026-09-30 | The `ProductCard` model link carries an `sr-only` size tail, so the same model in two sizes has distinct link names (WCAG 2.4.4); the brand stamp is `translate="no"`. Tests match the model name by regex prefix, never exactly. | Two links read identically to a screen reader. | QA pass; D93b |
| D91b | 2026-09-29 | `ProductCard` takes an optional `sizes` (default unchanged); each grid passes its own. The photo box is a padded wrapping flex row, so the brand stamp wraps below the badges instead of overlapping them; the image link is `absolute inset-0`, the same box as before. | `sizes` said 50vw where the results grid is 1-up (400–719), so phones fetched about half the pixels they paint; the `Currently unavailable` badge overlapped the stamp by up to 34.6px at 1100–1180. | QA pass WDG-06, NJR-6; D91b |
| D132 | 2026-10-03 | The size selects narrow one another: `getFacets` takes the buyer's own size (`sizeChoice`, never a vehicle-lent one) and adds `sizeOptions`; the three per-field `select distinct` reads become one aggregate row (tires: width / profile / rim; wheels: diameter / width / bolt via `left join lateral unnest`), read as `text[]` and `Number`ed, and the chip-count read joins the first wave. Tires 6 facet queries in 2 waves → 4 in 1; wheels 5 in 2 → 3 in 1; accessories 4 in 2 → 4 in 1. `StorefrontFacets`, `TireSizeOptions` and `WheelSizeOptions` live in `queries.ts`, not `catalog-types.ts`. | After `width=205` the profile and rim lists still offered values no 205 tire has, and the buyer landed on `0 matches · N similar` (owner chose the fix, 2026-10-03). | Owner, D132 |
| — | 2026-10-03 | *Derived* under D125, each vetoable: (1) a vendor price of `0` refuses the row, where a display price of `0` is stored blank, because a silent 0 → blank would hide a sheet's error; (2) an `extra_specs` pair with no `: `, an empty half, a label twice (case-insensitive), a label over 60, a value over 2,000 (raised from 500 by owner ruling, 2026-10-03, so the longest vendor `Fits wheel` lists load) or more than 40 pairs refuses the row rather than dropping the pair; (3) `lug_bolts` joins `lug_nuts` and `wheel_locks` in the D67 thread match, since a bolt states a thread too; (4) an unbranded accessory's slug is model + name + size part. | The validator reports, it does not repair (D113); D125 split lug bolts out of lug nuts. | Coordinator brief, D125 |

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
  `public/images/products/<slug>.webp`; `aws4fetch` and `sharp` for the photo modules (D126b).
- **Depends on (D105b):** `src/db/` (`getDb()`, the catalogue tables).
- **Depended on by (D105b):** `src/features/admin/` — `product-queries.ts` and `product-actions.ts` call
  `store.ts` and `product-input.ts`.
- **Depended on by (D113):** `scripts/catalog-import.ts` — `import-plan.ts`, `import-mapping.ts` and
  `store.ts` `createProductsBatch`.
- **Depends on (D122):** `src/lib/cart.ts` (`addToCart`, `CartItem`), `src/lib/site.ts`
  (`PRICES_VISIBLE`).
- **Depended on by (D122):** `src/features/cart/` (`getProductsBySlugs`, `toProduct`, `cartItem`,
  `CATEGORY_CONFIG`) and `src/features/product/` (`AddToCartButton`, `cartItem`).
- **Depended on by:** `src/app/(storefront)/styleguide/page.tsx`; `src/features/home/` (featured row,
  D29); `src/features/results/` — `search.ts` asks `queries.ts` for the lists and facets and is the
  only place results are computed (D44), `query.ts` and `filter-panel.tsx` read `CATEGORY_CONFIG`, and
  the grid renders `ProductCard`; `src/features/product/` — `view.ts` reads `configFor()` for the spec
  table, the back href, the units and the similar list, and `pdp-gallery.tsx` reads `productImageSrc()`.

## Don't
- **Don't map an accessory label the vendors do not use onto one of the fifteen** in
  `import-mapping.ts`. A sixteenth label is refused and reported; guessing its type is a repair (D113).
- **Don't add `vendorPrice` to a storefront select or type** to "show the cost" anywhere public (D125).
- **Don't add a second card variant per context.** All three homes measure identically
  (`product-card.tsx:12-18`); a variant would be three parity baselines instead of one.
- **Don't hardcode `/products/…` at a call site.** Use `productRoute()` from `src/lib/routes.ts` (D18, D39).
- **Don't add `stock`, `rating`, `reviewCount`, `inStock: number` or `quantity` to `Product`**
  (`docs/decisions.md:105-107`).
- **Don't upscale a product cut-out to fix the two low-res SKUs.** `scripts/prepare-assets.mjs` refuses
  by design; it is a client blocker (D19, `HANDOFF.md` §7).
- **Don't change the CTA copy.** `Add to cart` is the owner's and the client's wording (D122,
  `DEVIATIONS.md` #96); the drawn `Request a quote` now belongs to the cart page alone.
- **Don't list `transform` in the hover transition** to match the artboard string — it would be inert
  (DEVIATIONS #15).
- **Don't make the card photo's `share` a plain string** to "fix" a missing morph. Untyped, every slug
  present on both pages pairs and flies at once — Home → `/tires` flew six photos (D92b).

## Open
13. ~~**Production's catalogue is empty**~~ **Closed 2026-10-03: the D125 CSV is loaded.** The D113 stand-in
    was truncated earlier that day (catalogue tables only; payment tables counted unchanged), then
    `catalog:import` loaded the 2026-10-03 `catalogue.csv` into production: **42,165 products** (9,589
    tires, 30,773 wheels, 1,803 accessories), all `published`, 45,426 vendor sources each with its vendor
    price, no display price, no photos, 0 refused, in 34 s. The 15 rows in the builder's `issues.csv` are
    not in it. Checked live: the three listings read those counts, and no vendor name or vendor price is
    in any page source fetched. **Still owed:** photos (the R2 bulk load, D126b). The 787 `needs-review.csv` rows were ruled
    the same day (D126), and 1,281 tire seasons were updated in place to follow the tire maker; `DAICAPS` folded into `DAI Wheels` (61). Owner.
14. **Rechecked after the D125 load (2026-10-03): 7,540 slugs carry a `-2`, `-3` …** (the stand-in had 10,249), mostly PRO WHEELS wheels that share brand, model,
    size, bolt pattern, offset and finish and differ only in something the slug does not read (centre
    bore, SKU). Those suffixes follow file order, so they move if the file's order does. Whether the
    wheel slug should carry more is the owner's call (D107b(1)).
8. **Only the home row is cached** (`home/featured.ts`, D109; by tag with no timer since D111). The results and product pages read Postgres
   on every request: measured at 6 to 97 ms with all ~46k vendor rows, and their filter combinations
   are unbounded, so a cache there would grow without limit for little gain. Revisit if a page is slow
   in production. Owner.
12. **`public/images/products/*.webp` is now used by `/styleguide` only.** The seed cut-outs stay until
    real product photos are uploaded. Owner.
9. **Tire sizes the parser refuses**, all real but none in the vendor sheets: commercial `11R22.5` and
   `7.50R16`, run-flat `225/45RF17`, temporary `T125/70D16`. Add them to `size.ts` only if the shop
   sells them. Owner.
10. **A brand spelled two ways is two brands** (`GOODYEAR` / `Goodyear` in the scraped sheets): two facet
    rows, and "other sizes" split between them. The approved CSV is expected to arrive clean; nothing
    here canonicalises it. Co-founder, via owner.
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
6. ~~**The accessory types follow the photography (D63).**~~ **Superseded by D125:** the types are the
   vendors' fifteen; D105b's nine (and D63's photographed four) are gone.
