# src/features/product

## Purpose
The `/products/[slug]` page: gallery, buy panel, spec table, quote band and the similar-products row.
Since **D58** (2026-09-21) it serves **all three catalogue categories** from one route — a tire, a wheel
and an accessory are the same page, and everything that differs (spec rows, price unit, quantity
wording, breadcrumb crumb and back link, similar list) is derived from the product's own
`CategoryConfig`, never branched in a component. It is the only page in the build where a visitor
converts — every `Request a quote` CTA on `/` and `/results` lands on the `#quote` anchor here
(`src/lib/routes.ts` `quoteRoute()`), so this folder owns the storefront's one form. Delete it and the
quote-first premise (`docs/decisions.md:105-107`) has nowhere to land.

## Owns
- [`types.ts`](types.ts) — the contract, written before any component (D25). `ProductView` is what the
  page hands every section; `QuantityKey` / `QUANTITY_OPTIONS` are the buy panel's four cells (D50);
  `QuoteFormState` / `QUOTE_FIELD` / `CONTACT_METHODS` are the form half (D51); `PdpBadge` and
  `ProductSpecRow` are the two shapes derived from `Product` (D53). **D58 added** `ProductView.config`
  (the product's `CategoryConfig`) and replaced `QUANTITY_OPTIONS[].quoteLabel` with
  `quantityQuoteLabel(value, unit)` — the four cells are category-independent, only the wording is not.
  **D65 added** `DEFAULT_QUANTITY_BY_CATEGORY`, which `view.ts`'s `parseQuantity(params, category)` now
  reads: an accessory PDP opens on `1`, tires and wheels keep the drawn `4` (`DEFAULT_QUANTITY`).
- `view.ts` — `productView(product, searchParams)`, pure. The only place any PDP value is computed.
  Per category (D58): a **tire** splits `Product.size` on ` · ` into `sizeCode` + `loadSpeed` and builds
  the six drawn spec rows, the three badges and the season-grouped similar list, exactly as before; a
  **wheel** keeps its whole size string intact and builds Brand / Model / Size / Bolt pattern / Offset /
  Finish from `product.wheel`; an **accessory** builds Brand / Model / Type / Fits. Wheels and
  accessories carry **no badges** (D59(4)). `backHref` points at the product's own category route, and
  `buildSimilar` never leaves the product's own category, ranking by shared chip value (D59(6)).
- `actions.ts` — `submitQuote`, the `"use server"` action (D51). Validates, returns `QuoteFormState`.
  **It does not send anything** — the delivery call is a marked TODO until the client supplies a
  destination (root `llm.md` §7).
- `components/pdp-breadcrumb.tsx` · `pdp-gallery.tsx` · `buy-panel.tsx` · `quantity-control.tsx` —
  the split column. `product-desktop.html:101-125`, `product-mobile.html:90-100`.
- `components/specifications.tsx` · `similar-products.tsx` — `:126-131` / `:159-315`.
- `components/quote-band.tsx` · `quote-form.tsx` — `:132-157`. `quote-form.tsx` is the folder's only
  client island (`useActionState`); the band around it is a Server Component.
- `components/quote-success.tsx` — `QuoteSuccess`, the authored post-submit panel (D51). Its own module,
  not inlined in the island, so `/styleguide` renders the real component rather than a copy that can
  drift (the `ResultsEmpty` precedent) and it stays out of that page's client bundle. `role` and
  `tabIndex` are props: the live form passes them and focuses it; the styleguide renders it inert.
- `components/quote-error-summary.tsx` — `QuoteErrorSummary`, the authored **failed**-submit
  announcement (D57, audit C2/C3, `DEVIATIONS.md` #46). Same shape and reasoning as `quote-success.tsx`
  above: its own module so `/styleguide` renders the real component, `role`/`tabIndex` as props so the
  reference page renders it inert. `role="alert"` is implicitly assertive and atomic, so **mounting the
  node is the announcement** — the build had no live region before this. Renders `null` at a count of 0,
  so the caller needs no guard; it borrows `FieldError`'s type role, and no artboard draws an error
  state (#9). **It is only reachable because the form is `noValidate`** (D65 — see Rules).

## Rules
- **Measured baseline is `design/inventory/product.md`** (696 lines). Every number in a component
  carries a `file:line` comment pointing at it or at the artboard, exactly as `src/components/ui/`
  does — "a new variant without one does not ship" (`src/components/ui/llm.md`).
- **The split is 55/45, not 60/40.** `grid-template-columns:55fr 45fr; gap:64px` inside 1344px →
  gallery 704, panel 576 (`product.md` §1.3). DESIGN.md §5's 60/40 is superseded here
  (`DEVIATIONS.md:16`). The quote band is `5fr 7fr` — a *different* split, deliberately flipped.
- **Nothing here branches on the category.** Components read `view.config` (the unit copy, the crumb,
  the route) and `view.specs` (already shaped per category by `view.ts`); the one place that knows a
  wheel from a tire is `view.ts`, and the copy it reads lives in `catalog/categories.ts` (D58). A
  `if (category === …)` in a component is the thing this rule exists to prevent.
- **A tire PDP is parity-measured and byte-identical.** The tire branch of every D58 change is the
  original code path: the six drawn spec rows, `per tire · before tax`, `1 tire` / `4 tires`, the
  `Results` crumb, and both artboard-verbatim quote-form strings. Verified in the browser 2026-09-21.
- **Buy panel is `position:sticky; top:96px` on desktop only** (`product.md` §3). Never on mobile.
- **No sticky mobile buy bar** — D6, and confirmed by measurement: zero `position:fixed`/`sticky`
  matches in `product-mobile.html` (`product.md` §1.3). The mobile footer's 120px bottom reserve is
  not an invitation to add one.
- **No fitment or install trust line in the buy panel** — D47(2), and `product.md` §3.6 is explicit:
  "Do not synthesise a trust line into the panel." The page's one fitment sentence lives in the quote
  band and is **desktop-only**, as drawn.
- **Quantity is a URL param** (D50). The cells are links that set `?qty=`; the panel stays a Server
  Component. `qty` never reaches the breadcrumb's `backHref`. The *selected* cell defaults per category
  (D65) — only the default, never the four cells or their labels, which stay as drawn (D63).
- **The quote form is `noValidate`, and that is load-bearing** (D65). With native constraint validation
  on, the browser's own bubble fired first on the commonest failure — an empty `required` field — so the
  Server Action never ran and **both already-applied D57 fixes were dead on that path**: the
  `role="alert"` summary (C2) and focus-first-invalid (C3) were unreachable. `required` stays on the
  fields for semantics and AT; `actions.ts` was always the real validator and owns the specific messages.
  Removing `noValidate` silently disables C2 and C3 again.
- **A `beforeunload` guard protects typed input** (D65). The quantity cells above the form are `?qty=`
  links, so tapping one is a real navigation that emptied every field already typed. `onInput` arms a
  `dirtyRef`; `success` disarms it so the confirmation never warns. The owner chose this over changing
  D50's URL-param mechanism.
- **Spec table is derived, never typed** (D53) — the same principle as D42 on `/results`. Six rows from
  `Product` + `studdable`; if a value cannot be derived the row is dropped, not invented.
- **The gallery is one image, no thumbnails** (D53). The desktop column's inert `gap:12px` is the slot
  a thumb strip *would* take; the export has no thumbs, no dots, no arrows, no zoom
  (`product.md` §4 "Behaviour implied by the markup"). Undrawn element → artboards (D7 precedent).
- **`ProductCard` renders the similar row unchanged.** It is the same card as home and `/results`
  (`src/features/catalog/llm.md`); no PDP variant.
- **CASL renders unticked** (`docs/decisions.md:118`) — `Checkbox variant="consent"` already refuses to
  set `checked`.
- **Sample form data does not ship**: `Priya Sandhu`, `priya.s@`, `(905) 000-0000`, the drawn `2021
  Honda Civic` (`DEVIATIONS.md:76`, `design/DEVIATIONS.md` "Sample data"). Fields render empty with real placeholders.
- Server Components by default; one `"use client"` leaf (`quote-form.tsx`). Named exports, no barrel.
  Tokens only, no arbitrary values (`.claude/rules/ui.md`).

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | None folder-scoped. | Every PDP ruling is global. | root `llm.md` §5b |

Referenced: **D50** (quantity is `?qty=`), **D51** (Server Action + success state), **D52** (similar =
same season, self excluded), **D53** (the derived-rulings bundle), **D6** (no sticky buy bar),
**D21** (`Price context="pdp"` → `per tire · before tax`), **D37** (imports go through `catalog/`),
**D47(2)** (no trust line here), **D32** (computed year).

## Connects to
- **Depends on:** `src/features/catalog/` — `Product`, `findProduct`, `productsIn`, `ProductCard`,
  `configFor` / `CategoryConfig`, `productImageSrc` (D37);
  `src/components/ui/` — `Badge`, `Button`, `Price`, `Input`, `Textarea`, `Select`, `FieldLabel`,
  `FieldError`, `Checkbox`; `src/components/site/` — `SiteHeader`, `SiteFooter`;
  `src/lib/{site,routes}.ts`; `src/app/globals.css` for `pdp-split`, `quote-grid`, `qty-grid`,
  `similar-track`, `photo-inset-gallery`, `photo-vignette-gallery`, `display`, `label`, `numeral`.
- **Depended on by:** `src/app/(storefront)/products/[slug]/page.tsx` (six sections + `productView`),
  and `src/app/(storefront)/styleguide/page.tsx` §11, which renders `QuoteSuccess`.

## Don't
- **Don't add a cart, a stepper, a `+/−` control or a numeric quantity input.** The artboard draws four
  cells and no stepper (`product.md` §3.4); there is no cart anywhere in this build
  (`docs/decisions.md:105`).
- **Don't reproduce the desktop `Send inquiry` button's drawn state.** It ships pre-hovered —
  `--accent-hover` fill plus `translateY(1px)` — which is a state demo, not the rest state
  (`product.md` §2.6). Ship `--accent` at `translate:none`.
- **Don't copy the segmented control's drawn double right edge.** Every segment carries
  `border-right`, including the last (`product.md` §2.6); that is an export artefact.
- **Don't let `Similar products` return the current product.** The artboard's third card is the PDP
  subject in another size and `product.md` §7.6 flags it: "a real similar-products feed should not
  return the current product." D52.
- **Don't add `Michroma` or `Manrope`.** Both are in the export's font link and referenced by nothing
  (`product.md` §5.2); D20 self-hosts Barlow + Barlow Condensed only.
- **Don't import `CATEGORY_CONFIG` into `quote-form.tsx`.** It is this folder's one client island; the
  unit pair and the two copy strings arrive as plain props from `quote-band.tsx` so the category table
  never reaches the browser bundle (D58).
- **Don't let a wheel or accessory PDP recommend a tire.** `buildSimilar` stays inside the product's own
  category (D59(6)).
- **Don't widen `Product` to carry spec strings.** Derive them (D53); the catalog type stays the list
  of things *cards* vary on (`src/features/catalog/llm.md`).

## Open
1. **PARKED (D54) — where a submitted quote goes.** `actions.ts` validates and returns success; nothing
   is sent, and the delivery call is a marked `TODO`. The UI half is complete and measured; the wiring
   needs a backend, which this engagement does not cover. Owner, 2026-09-21: *"we are just building ui so
   park these"*. Do not implement it unprompted. **Owner, then client.**
2. **`Vehicle` is declared three times** — here, `results/types.ts`, and implied by `finder/`. A third
   consumer means it belongs in `src/lib/`. Coordinator or **owner** (root `llm.md` §7).
3. **`M+S` is derived from the winter badge**, not a fact `Product` carries (`types.ts` `PdpBadge`).
   Real sidewall markings come with real catalogue data (D48). **Client.**
4. **One photo per SKU.** The gallery shows the same cut-out the card does; four cut-outs cover nine
   tire SKUs (D43), three cover nine wheel SKUs, and **one lifestyle photograph covers all nine
   accessory SKUs** via `productImageSrc()`'s absolute-path branch (D58, `DEVIATIONS.md` #51). A real
   gallery needs per-SKU photography — `HANDOFF.md` §7. **Client.**
5. **`How many?` reads oddly on an accessory** whose `size` already says `Set of 20`, so the cells offer
   one, two or four *sets*. **Half-closed 2026-09-22 by D65:** the *default* no longer pre-fills a
   request for eighty lug nuts — accessories open on `1`, tires and wheels on the drawn `4`. The four
   cells and their **labels** are untouched (D50, D63), which is what the owner asked for. Still
   **owner's**, if the wording should change.
