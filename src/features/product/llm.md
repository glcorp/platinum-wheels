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
  `PdpBadge` and `ProductSpecRow` are derived from `Product` (D53). `DEFAULT_QUANTITY_BY_CATEGORY` (D65)
  is read by `view.ts`'s `parseQuantity` and, since D122, derived from `CategoryConfig.addQuantity`, the
  number a card's `Add to cart` adds, so a card and its PDP agree. `vehicleLabel(view)` is the checked
  vehicle string `Add to cart` saves on a cart line (D122).
- `spec-format.ts` — pure spec-row formatters (D136): `tidyExtra`, `sidewall`, `hasMudAndSnow`,
  `loadRating`, `backspacing`, `offsetMm`. No imports.
- `view.ts` — `productView(detail, searchParams, rows)`, pure. Since D136: 3PMSF row only when true,
  M+S from the vendor value, a `Studdable` row off-winter, `description` passed to `Specifications`. The only place any PDP value is computed.
  Since D108b it takes `CatalogProductDetail` plus the two rows and makes the card-shaped `Product` with
  `toProduct()`. Per category (D58): a **tire** builds the six drawn spec rows first, then Load range /
  Ply rating / Run-flat / UTQG when given; a **wheel** Brand / Model / Size / Bolt pattern / Offset /
  Finish, then Finish family / Colour / Lug count (D125), Centre bore, Backspacing, Material, Seat type,
  Load rating, TPMS, Winter use; an **accessory** Brand / Model / Type, then Part type (D125), Thread
  size, Seat type, Finish, Pack quantity, diameters and Weight (`2.5 lb`, D125). **Every category then
  appends the product's `extraSpecs`** (D125), the vendor facts with no column, in vendor order, label
  and value as stored. **A row with no value is dropped** (D53(1), D109(6)), which is also how an
  unbranded accessory loses its `Brand` row. `fullName` is `productName()` (`src/lib/product-name.ts`),
  so it is the bare name when there is no brand. The vehicle is accepted only via `isFinderVehicle` (D91b).
- `load.ts` — server only (D108b). `loadProduct(slug)` in React `cache()`, and `loadProductRows(detail)`.
- `components/pdp-breadcrumb.tsx` · `pdp-gallery.tsx` · `buy-panel.tsx` · `quantity-control.tsx` — the
  split column. `product-desktop.html:101-125`, `product-mobile.html:90-100`.
- `components/add-to-cart-panel.tsx` — the buy panel's primary CTA (D122), a client island. Adds the
  selected cell's count through the catalogue's `AddToCartButton`; while `Custom` is selected it shows
  `How many tires?` (the field that used to sit in the quote form's Optional group, `DEVIATIONS.md` #70)
  and adds what is typed, a whole number, no visible ceiling (owner: "lets not put restrictions of cart").
- `components/specifications.tsx` · `similar-products.tsx` — `:126-131` / `:159-315`.

## Rules
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
- **Quantity is a URL param** (D50). The cells are links that set `?qty=` and keep every other param;
  the panel stays a Server Component apart from the add island. `qty` never reaches `backHref`. The
  *selected* cell defaults per category (D65); the four cells and their labels stay as drawn (D63).
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
- **Motion (D92b).** `pdp-gallery.tsx` wraps its image in the `product-photo-<slug>` view transition with
  `share="morph"`. The breadcrumb's `Tires` crumb carries `["nav-back", "product-back"]` and
  `prefetch={true}`; `Home` carries `["nav-back"]`. `SimilarProducts` renders `morph={false}`. Cells press
  (`active:translate-y-px`). The `Custom` field and the `Added` label arrive with `enter-rise`.

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| D91b | 2026-09-29 | (1) `view.ts` accepts a vehicle only via `isFinderVehicle`, the one cross-feature import outside `catalog/`, on `results/search.ts`'s precedent; (5) cells 1/2/4 are `scroll={false}` and every cell carries `data-qty-cell`; (6) the h1 is `text-ink` and `wrap-anywhere`, the size numeral `leading-flat`, the mobile price row loses a stray `pt-2`. Items (2)–(4), about the quote form, moved with it to `src/features/cart/` (D122). | QA pass (`design/reports/qa.md`). | D91b |
| — | — | None other folder-scoped. | Every PDP ruling is global. | root `llm.md` §5b |

Referenced: **D125** (unbranded accessories, the new spec rows, `extraSpecs`, vendor price staff only),
**D50** (quantity is `?qty=`), **D52** (similar = same season, self excluded), **D53** (derived
rulings), **D6** (no sticky buy bar), **D21** (`Price context="pdp"`), **D37** (imports go through
`catalog/`), **D47(2)** (no trust line), **D122** (the cart; this page adds, the cart asks).

## Connects to
- **Depends on:** `src/features/catalog/` — `Product`, `queries.ts`, `adapter.ts`, `ProductCard`,
  `AddToCartButton`, `cartItem()`, `configFor` / `categoryConfig`, `productImageSrc` (D37);
  `src/components/ui/` — `Badge`, `Button`, `Price`, `Input`, `FieldLabel`, `FieldError`;
  `src/components/site/` — `SiteHeader`, `SiteFooter`; `src/lib/{site,routes,cart}.ts`
  (`PRICES_VISIBLE`, `CartItem`); `src/app/globals.css` for `pdp-split`, `qty-grid`, `similar-track`.
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
4. **`How many?` reads oddly on an accessory** whose size says `Set of 20`; accessories open on `1` (D65).
   **Owner's**, if the wording should change.
5. **The unavailable PDP (D108b, undrawn)** borrows the card's treatment: the badge, the ghost CTA, the
   price dimmed when prices show. The photo is not dimmed. **Owner**, if it should be.
