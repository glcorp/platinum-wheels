# src/features/product

## Purpose
The `/products/[slug]` page: gallery, buy panel, spec table and the two product rows (`Other sizes`,
`Similar products`). Since **D58** it serves **all three catalogue categories** from one route; everything
that differs (spec rows, price unit, quantity wording, breadcrumb crumb and back link, similar list) is
derived from the product's own `CategoryConfig`, never branched in a component. **Since D122 the page has
no quote band and no form**: its primary CTA is `Add to cart`, which puts what the `How many?` cells say in
the browser cart, and the quote is requested from `/cart` (`src/features/cart/`). The form, its Server
Action, its emails and its two authored states moved there.

## Owns
- [`types.ts`](types.ts) — the contract, written before any component (D25). `ProductView` is what the
  page hands every section; `QuantityKey` / `QUANTITY_OPTIONS` are the buy panel's four cells (D50);
  `PdpBadge` and `ProductSpecRow` are derived from `Product` (D53). `DEFAULT_QUANTITY` (`1` for every
  category, D127) is read by `view.ts`'s `parseQuantity`; it is the one a card's `Add to cart` adds, so a
  card and its PDP agree. `vehicleLabel(view)` is the checked
  vehicle string `Add to cart` saves on a cart line (D122).
- `spec-format.ts` — pure spec-row formatters (D136): `tidyExtra`, `sidewall`, `loadRating`,
  `backspacing`, `offsetMm`. No imports. (`hasMudAndSnow` went with D142: M+S is a column.)
- `view.ts` — `productView(detail, searchParams, rows)`, pure. Since D136: 3PMSF row only when true,
  M+S from the vendor value (the tire's `mud_snow` column since D142), a `Studdable` row off-winter, `description` passed to `Specifications`. The only place any PDP value is computed.
  Since D108b it takes `CatalogProductDetail` plus the two rows and makes the card-shaped `Product` with
  `toProduct()`. Per category (D58): a **tire** builds the six drawn spec rows first, then Load range /
  Ply rating / Run-flat / UTQG when given; a **wheel** Brand / Model / Size / Bolt pattern / Offset /
  Finish, then Finish family / Colour / Lug count (D125), Centre bore, Backspacing, Material, Seat type,
  Load rating, TPMS, Winter use; an **accessory** Brand / Model / Type, then Part type (D125), Thread
  size, Seat type, Finish, Pack quantity, diameters and Weight (`2.5 lb`, D125). **No `Part number` row
  since D193**: the column (D142) holds the vendor's SKU, so it stays staff only (admin, sourcing email). **Every category then
  appends the product's `extraSpecs`** (D125), the vendor facts with no column, in vendor order, label
  and value as stored. **A row with no value is dropped** (D53(1), D109(6)), which is also how an
  unbranded accessory loses its `Brand` row. `fullName` is `productName()` (`src/lib/product-name.ts`),
  so it is the bare name when there is no brand. The vehicle is accepted only via `isFinderVehicle` (D91b).
- `components/product-page.tsx` (**D194**) — the page itself: `productMetadata(slug)` and `ProductPage({
  slug, query })`, moved out of the route so two routes draw it, `/products/[slug]` (a URL with a query
  string, per request) and `/product-cache/[slug]` (the bare URL, kept; `src/proxy.ts` rewrites to it).
- `load.ts` — server only (D108b). **Since D194** every read is kept between requests per slug under
  `CATALOGUE_TAG` (`unstable_cache`, `catalogueCacheKey`), so a repeat visit costs no database read; the
  two rows are keyed on the slug and the car's fit; `updatedAt` is revived to a `Date` after the cache's
  JSON. `loadProduct(slug)` in React `cache()`, and `loadProductRows(detail,
  vehicle)`: since **D171** the page's checked vehicle (`view.ts` `parseVehicle`, now exported) is read
  through the finder's `findFitment` + `tireFit` / `wheelFit`, and `Other sizes` lists only the sizes
  that fit it (the results pages' best list); no car, or no data for it, is the nearest sizes as before.
  Since the launch audit (D145; D151) also `loadTitleSiblings(detail)`, memoised, read by both
  `generateMetadata` and the page: `view.ts` passes them to `catalog/siblings.ts` and ends `sizeLine`
  with what tells this product from others of the same name and size (`· Centre bore 72.6 mm`), so the
  buy panel's size line and the `<title>` say the same thing. Nothing is added when no product shares
  the name and size.
- `components/pdp-breadcrumb.tsx` · `pdp-gallery.tsx` · `buy-panel.tsx` · `quantity-control.tsx` — the
  split column. `product-desktop.html:101-125`, `product-mobile.html:90-100`.
- `components/pdp-gallery-carousel.tsx` (**D167**, `"use client"`) — the gallery when a product has two or
  more photos: a native scroll-snap track (swipe, trackpad, arrow keys on the focused track, all without JS),
  Prev / Next and a `2 / 5` counter on the photo, ArrowLeft / ArrowRight / Home / End, thumbnails under the
  box from 1100. Server-rendered controls, hidden with JS off by `noscript:`. The morph's end (D92b, D144)
  is the **showing** slide (D184, D185: "Back morph from any photo"): the island wraps every slide in a
  `<ViewTransition share="morph" default="none">` and gives the shared name to the current one only, so
  the name stays on one element; a visit starts on photo 1, so a card still lands on the first slide, and
  the crumb's `product-back` flies the photo on screen. The current thumbnail also takes a thicker
  `Highlight` frame in forced colours (D184, QA GATE-2). One photo or none renders as before. Supersedes D53(4)'s
  "one image" for multi-photo products; DEVIATIONS #133.
- `components/add-to-cart-panel.tsx` — the buy panel's primary CTA (D122), a client island. Adds the
  selected cell's count through the catalogue's `AddToCartButton`; while `Custom` is selected it shows
  `How many tires?` (the field that used to sit in the quote form's Optional group, `DEVIATIONS.md` #70)
  and adds what is typed, a whole number, no visible ceiling (owner: "lets not put restrictions of cart").
- `components/specifications.tsx` · `similar-products.tsx` — `:126-131` / `:159-315`.
- **Phone spacing (D159, 2026-10-07, `DEVIATIONS.md` #123).** Below 1100 the gallery photo's inset is 2%
  (desktop keeps the drawn 8%); below 720 the buy panel's top padding is 16px (drawn 32), the gallery cap
  is `100svh - 466px`, and Specifications start 48px under `Call us` (drawn 112). Owner: *"reduce the
  border around image, below tire there is so much black space"*, *"fix the blank space between call us
  and specs"*. Season badges (#125, #126): Winter aqua, the other three faint lime (`view.ts` passes the season as the variant).

- **D158:** the PDP passes `view.vehicle` to `SiteHeader` (category links keep the car) and to both
  `SimilarProducts` rows (their cards' links keep it). A product opened from a results card now
  arrives with the vehicle in its URL.

## Rules
- **An old vehicle name in `?year&make&model` is redirected before the product is read** (D155, *derived*): the page
  calls `redirectToCanonicalVehicle` (`src/features/finder/canonical.ts`), a 308 to the same product path with every
  param kept (including `qty`) and `model` (and `make`) swapped to the finder list's spelling. `parseVehicle` stays exact (D91b).
- **Measured baseline is `design/inventory/product.md`.** Every number in a component carries a
  `file:line` comment pointing at it or at the artboard (`src/components/ui/llm.md`).
- **The split is 55/45, not 60/40.** `55fr 45fr; gap:64px` inside 1344px → gallery 704, panel 576
  (`product.md` §1.3, `DEVIATIONS.md:16`).
- **Nothing here branches on the category.** Components read `view.config` and `view.specs`; the one place
  that knows a wheel from a tire is `view.ts`, reading copy from `catalog/categories.ts` (D58).
- **A tire PDP is parity-measured.** The tire branch of every D58 change is the original code path. **D122
  moved two drawn things off the page**: the quote band (`product-desktop.html:132-157`) and the CTA copy
  `Request a quote` / `Inquire about restock`, now `Add to cart` in the same box and variants
  (`DEVIATIONS.md` #96). With prices switched off the price row is absent (`DEVIATIONS.md` #97).
- **Buy panel is `position:sticky; top:96px` on desktop only** (`product.md` §3). Never on mobile.
- **No sticky mobile buy bar** — D6. **No fitment or install trust line in the buy panel** — D47(2).
- **Quantity is a URL param** (D50), **changed in the browser since D160**: a plain tap sets
  `QuantityProvider` (`quantity-state.tsx`) and rewrites `?qty=` with `history.replaceState`, so no
  server round trip and no loader; `quantity-control.tsx` is now a client island. The cells are links that set `?qty=` and keep every other param;
  the panel stays a Server Component apart from the add island. `qty` never reaches `backHref`. The
  *selected* cell defaults to `1` for every category (D127, `DEVIATIONS.md` #98); the four cells and their labels stay as drawn (D63).
  `role="group" aria-labelledby="qty-label"` (D66). Every cell is `scroll={false}`; `Custom` no longer
  carries `#quote` (D122), its field sits right under the cells.
- **The searched vehicle reaches the cart only after the server checked it** (`view.ts`, D91b), passed as
  a prop to every `Add to cart` on the page, including both product rows. Never read from the URL in the
  browser: an unchecked URL could write its own text into the cart and the owner alert.
- **Spec table is derived, never typed** (D53). **The gallery is one image, no thumbnails** (D53).
  Rows are keyed by position and label, because an extra spec may repeat a column's label (D125).
- **No brand, no brand element (D125).** An unbranded accessory renders no brand label in the buy panel,
  no brand half in the breadcrumb leaf, an empty gallery placeholder tile, and image alt text of its name
  alone. Nothing stands in for the brand.
- **A vendor's own price never reaches this page** (D125). It lives on the staff-only source row;
  `queries.ts` does not select it and nothing here may ask for it.
- **`ProductCard` renders the product rows unchanged** (`src/features/catalog/llm.md`); no PDP variant.
- Server Components by default; one `"use client"` leaf here (`add-to-cart-panel.tsx`). Named exports, no
  barrel. Tokens only (`.claude/rules/ui.md`).
- **Motion (D92b, D144).** `pdp-gallery.tsx` wraps a box in the `product-photo-<slug>` view transition
  with `share="morph"`: the photo (or tile), the card-size underlay that gives the arriving snapshot a
  picture from its first frame, and the vignette, so nothing changes when the morph ends. Keep the
  underlay and keep it inside the named box: without it the morph lands on an empty box (D144). The breadcrumb's `Tires` crumb carries `["nav-back", "product-back"]` and
  `prefetch={true}`; `Home` carries `["nav-back"]`. `SimilarProducts` renders `morph={false}`. Cells press
  (`active:translate-y-px`). The `Custom` field and the `Added` label arrive with `enter-rise`.

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| D91b | 2026-09-29 | (1) `view.ts` accepts a vehicle only via `isFinderVehicle`, the one cross-feature import outside `catalog/`, on `results/search.ts`'s precedent; (5) cells 1/2/4 are `scroll={false}` and every cell carries `data-qty-cell`; (6) the h1 is `text-ink` and `wrap-anywhere`, the size numeral `leading-flat`, the mobile price row loses a stray `pt-2`. Items (2)–(4), about the quote form, moved with it to `src/features/cart/` (D122). | QA pass (`design/reports/qa.md`). | D91b |
| D151 | 2026-10-04 | (1) `buy-panel` steps the h1 by name length: up to 24 characters the drawn 56 / 88, to 40 characters 48 / 56, beyond 36 / 48 (DEVIATIONS #115). (2) `pdp-gallery`'s box carries `pdp-gallery-band`: `max-height: 60dvh` from 720 to 1099 only (DEVIATIONS #39 amended); D144's morph wrapper, underlay and vignette are untouched inside it. | Long accessory names pushed `Add to cart` below the phone fold; the full-bleed square gallery buried the panel on tablets (launch audit, D145, UI-CRITIQUE). | Owner, 2026-10-04: "Apply all code items" |
| D153 | 2026-10-05 | (1) The `pdp-gallery-band` utility also caps the gallery box below 720: `max-height: max(240px, 100svh - 482px)`. 482 = 470 of page outside the gallery plus a 12px margin. The 470: above it 119 (header 68, crumb pt 16 + row 19, gallery mt 16) and below it 351 (panel pt 32, brand 12 + 6, two-line h1 103, 6, size line 18, gap 16, quantity 78, gap 16, `Add to cart` 8 + 56); it matches the audit's measured 845 at 375x812 (375 + 470). Photo stays whole; 720-1099 (60dvh) and desktop unchanged (DEVIATIONS row #117). The box takes an explicit `height: min(100vw, cap)` and `aspect-square` is `md:` only: as `aspect-square` + `max-height` it shrank in width as well as height (a 390 box became ~240 wide), so the photo sat left, the badge overhung it and the bottom was cut (owner, 2026-10-05, "it overlaps and spills"). (2) The wheel `Finish`, `Finish family`, `Colour` and the accessory `Finish` rows read the vendor's `W/` as "with" through `catalog/adapter.ts` `expandWith()`. (3) A wheel with no bolt pattern shows `Bolt pattern: Undrilled, drilled to order`. | (1) Add to cart ended 14px below the fold at 390x844. (2) `catalog/llm.md` Open 7. (3) The 386 wheels with no pattern are undrilled blanks: PRO WHEELS' own `pcd1` reads `BLANK` (7 of 7 sampled), Auto Country's names say `blank` or `0x0`. No vendor site offers a blank filter (PRO WHEELS / Dealer Wheels' bolt pattern selector lists 50 real patterns; Direct Auto Import searches by vehicle only), so a spec row is all there is. | Owner, 2026-10-05: "Yes, shorter photo"; "check if vendor has filter, then keep else just add spec" |
| — | — | None other folder-scoped. | Every PDP ruling is global. | root `llm.md` §5b |

**D141** (2026-10-04, owner: *"symmetry should be maintained"*; DEVIATIONS #114): from `lg:` the `SimilarProducts` heading and grid (both `Similar products` and `Other sizes`) are capped at `max-w-content` and centred, matching the buy panel and specifications; the card `sizes` gains a fixed `324px` from 1440. Identical at ≤1440; the mobile/tablet scroller is untouched.

Referenced: **D125** (unbranded accessories, the new spec rows, `extraSpecs`, vendor price staff only),
**D50** (quantity is `?qty=`), **D52** (similar = same season, self excluded), **D53** (derived
rulings), **D6** (no sticky buy bar), **D21** (`Price context="pdp"`), **D37** (imports go through
`catalog/`), **D47(2)** (no trust line), **D122** (the cart; this page adds, the cart asks).

## Connects to
- **Depends on:** `src/features/catalog/` — `Product`, `queries.ts`, `adapter.ts`, `ProductCard`,
  `AddToCartButton`, `cartItem()`, `configFor` / `categoryConfig`, `productImageSrc` (D37);
  `src/components/ui/` — `Badge`, `Button`, `Price`, `Input`, `FieldLabel`, `FieldError`;
  `src/components/site/` — `SiteHeader`, `SiteFooter`; `src/lib/{site,routes,cart}.ts`
  (`PRICES_VISIBLE`, `CartItem`); `src/app/globals.css` for `pdp-split`, `qty-grid`, `similar-track`;
  `src/features/finder/fitment.ts` and `tire-fit.ts` in `load.ts` only (D171, one way).
- **Depended on by:** `src/app/(storefront)/products/[slug]/page.tsx` (five sections + `productView`).

## Don't
- **Don't bring a form back onto this page.** The quote is the cart's (D122); a second way to ask from
  here splits the lead into two shapes.
- **Don't let `Similar products` return the current product** (D52), and **don't let a wheel or accessory
  PDP recommend a tire** (D59(6)).
- **Don't add `Michroma` or `Manrope`** (`product.md` §5.2; D20).
- **Don't widen `Product` to carry spec strings.** Derive them (D53).

## Open
1. **`Vehicle` is declared three times** — here, `results/types.ts`, and implied by `finder/`. A third
   consumer means it belongs in `src/lib/`. **Owner** (root `llm.md` §7).
2. ~~**`M+S` is derived from the winter badge**~~ Closed by **D136**: the badge follows the vendor's `Mud & snow` value.
3. **One photo per SKU** until the admin's photo uploads reach the gallery (`HANDOFF.md` §7). **Client.**
4. **`How many?` reads oddly on an accessory** whose size says `Set of 20`; every PDP opens on `1`
   (D127). **Owner's**, if the wording should change.
5. **The unavailable PDP (D108b, undrawn)** borrows the card's treatment: the badge, the ghost CTA, the
   price dimmed when prices show. The photo is not dimmed. **Owner**, if it should be.
