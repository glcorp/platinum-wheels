# src/features/product

## Purpose
The `/products/[slug]` page: gallery, buy panel, spec table, quote band and the similar-products row.
Since **D58** (2026-09-21) it serves **all three catalogue categories** from one route — a tire, a wheel
and an accessory are the same page, and everything that differs (spec rows, price unit, quantity
wording, breadcrumb crumb and back link, similar list) is derived from the product's own
`CategoryConfig`, never branched in a component. It is the only page in the build where a visitor
converts — every `Request a quote` CTA on `/` and `/results` lands on the `#quote` anchor here
(`src/lib/routes.ts` `quoteRoute()`), so this folder owns the storefront's one form, and the
quote-first premise (`docs/decisions.md:105-107`) has nowhere else to land.

## Owns
- [`types.ts`](types.ts) — the contract, written before any component (D25). `ProductView` is what the
  page hands every section; `QuantityKey` / `QUANTITY_OPTIONS` are the buy panel's four cells (D50);
  `QuoteFormState` / `QUOTE_FIELD` / `CONTACT_METHODS` are the form half (D51); `PdpBadge` and
  `ProductSpecRow` are derived from `Product` (D53). **D58** added `ProductView.config` and replaced
  `QUANTITY_OPTIONS[].quoteLabel` with `quantityQuoteLabel(value, unit)` — the cells are
  category-independent, the wording is not. **D65** added `DEFAULT_QUANTITY_BY_CATEGORY`, read by
  `view.ts`'s `parseQuantity(params, category)`: accessories open on `1`, tires and wheels on `4`.
  `QUOTE_FIELD.customQuantity` and `CUSTOM_QUANTITY_MIN`/`MAX` (2026-09-22, `DEVIATIONS.md` #70) back
  the `Custom` cell's free-text field.
- `view.ts` — `productView(product, searchParams)`, pure. The only place any PDP value is computed.
  Per category (D58): a **tire** splits `Product.size` on ` · ` into `sizeCode` + `loadSpeed` and builds
  the six drawn spec rows, the three badges and the season-grouped similar list, exactly as before; a
  **wheel** keeps its whole size string intact and builds Brand / Model / Size / Bolt pattern / Offset /
  Finish from `product.wheel`; an **accessory** builds Brand / Model / Type / Fits. Wheels and
  accessories carry **no badges** (D59(4)). `backHref` points at the product's own category route, and
  `buildSimilar` never leaves the product's own category, ranking by shared chip value (D59(6)).
- `actions.ts` — `submitQuote`, the `"use server"` action (D51). Spam checks first (honeypot
  `website`, 3 s timer from the hidden `renderedAt`; a bot gets a normal `success`), then validation,
  then `deliverQuote()` (D104). A failed owner alert returns `status: "failed"` with the typed values.
  Looks `slug` up (`catalog/findProduct`/`productCategory`) so an
  unrecognised `quantity` falls back to the product's own category default, not a flat `4` (2026-09-22
  fix, was category-blind); bounds a non-blank `customQuantity` to 1–99, blank legal (`DEVIATIONS.md` #70).
- `quote-email.ts` — `deliverQuote()` (D104): the owner alert and the fixed auto-reply, plain text,
  through Resend's REST API with `fetch`. **Sends only when `AUTO_EMAIL_LEAD_CAPTURE_ENABLED` is exactly
  `true`**; needs `RESEND_API_KEY` and `LEAD_CAPTURE_EMAIL` (the shop address: sender and alert inbox). Never logs personal data. Not a `"use server"` file: only
  `actions.ts` imports it.
- `components/pdp-breadcrumb.tsx` · `pdp-gallery.tsx` · `buy-panel.tsx` · `quantity-control.tsx` —
  the split column. `product-desktop.html:101-125`, `product-mobile.html:90-100`.
- `components/specifications.tsx` · `similar-products.tsx` — `:126-131` / `:159-315`.
- `components/quote-band.tsx` · `quote-form.tsx` — `:132-157`. `quote-form.tsx` is the folder's only
  client island (`useActionState`); its Quantity select is controlled (2026-09-22 fix, see Rules) so it
  and `Custom` stay correct across a `?qty=` nav, which doesn't remount the island.
- `components/quote-success.tsx` — `QuoteSuccess`, the authored post-submit panel (D51), its own module
  so `/styleguide` renders the real component, not a drifting copy (`ResultsEmpty` precedent). `role`/
  `tabIndex` are props: the live form passes and focuses them; the styleguide renders it inert.
- `components/quote-error-summary.tsx` — `QuoteErrorSummary`, the authored **failed**-submit
  announcement (D57, audit C2/C3, `DEVIATIONS.md` #46), same module shape and props as above.
  `sendFailed` (D104) swaps the count sentence for the could-not-send one with the fallback phone.
  `role="alert"` is implicitly assertive/atomic, so **mounting the node is the announcement**; it renders
  `null` at a count of 0. **Reachable only because the form is `noValidate`** (D65 — see Rules).

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
- **No sticky mobile buy bar** — D6, confirmed by measurement: zero `position:fixed`/`sticky` in
  `product-mobile.html` (`product.md` §1.3). The footer's 120px bottom reserve is not an invitation.
- **No fitment or install trust line in the buy panel** — D47(2), and `product.md` §3.6 is explicit:
  "Do not synthesise a trust line into the panel." The page's one fitment sentence lives in the quote
  band and is **desktop-only**, as drawn.
- **Quantity is a URL param** (D50). The cells are links that set `?qty=`; the panel stays a Server
  Component. `qty` never reaches the breadcrumb's `backHref`. The *selected* cell defaults per category
  (D65) — only the default, never the four cells or their labels, which stay as drawn (D63).
  `role="group" aria-labelledby="qty-label"` on the cell grid (**D66**). `custom`'s link also carries
  `#quote`: the quote form's Quantity select server-renders a bounded `Input` in the Optional group on
  reading it (`DEVIATIONS.md` #70, closing Open #6). A `?qty=` click doesn't remount `quote-form.tsx`
  (same-route search-param nav), so the select is controlled and resynced during render, not via
  `defaultValue` (2026-09-22 fix, wiring only, no `DEVIATIONS.md` row).
- **`noValidate` on the quote form is load-bearing** (D65): native validation fired the browser's bubble
  before the Server Action ran, so both D57 fixes (`role="alert"` summary, focus-first-invalid) were dead
  on that path. `required` stays for semantics; `actions.ts` is the real validator.
- **A `beforeunload` guard protects typed input** (D65): the `?qty=` cells are real navigations that
  emptied fields already typed; `onInput` arms it, `success` disarms it.
- **`quote-h2` steps 48 → 56 → 88 at `sm`/`lg`, not 48 → 88 at `sm`** (2026-09-22, no `DEVIATIONS.md`
  row). Both artboards wrap the line to two at their own width — drawn, and DESIGN.md §3's own ceiling
  at the 88 role — so 390 and 1440 are untouched. But 88 at `sm` (720) wrapped it to two lines while
  still single-column, and to **three** at `md` (1100–1319, measured) — past that ceiling, no artboard to
  license it. `56` is the token `winter-promo.tsx` already uses for this gap (D41 "promo h2 56"); it
  holds through 720–1319 (one line to 1099, a clean two after), 88 resuming only at `lg` (1320).
- **Spec table is derived, never typed** (D53) — the same principle as D42 on `/results`. Six rows from
  `Product` + `studdable`; if a value cannot be derived the row is dropped, not invented.
- **The gallery is one image, no thumbnails** (D53). The desktop column's inert `gap:12px` is the slot a
  thumb strip *would* take; the export has no thumbs, dots, arrows or zoom (`product.md` §4). D7.
- **`ProductCard` renders the similar row unchanged.** It is the same card as home and `/results`
  (`src/features/catalog/llm.md`); no PDP variant.
- **CASL renders unticked** (`docs/decisions.md:118`) — `Checkbox variant="consent"` refuses `checked`.
- **Sample form data does not ship** (`Priya Sandhu` etc., `design/DEVIATIONS.md` "Sample data") — fields render empty, real placeholders only.
- Server Components by default; one `"use client"` leaf (`quote-form.tsx`). Named exports, no barrel.
  Tokens only, no arbitrary values (`.claude/rules/ui.md`).

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | None folder-scoped. | Every PDP ruling is global. | root `llm.md` §5b |

Referenced: **D50** (quantity is `?qty=`), **D51** (Server Action + success state), **D52** (similar =
same season, self excluded), **D53** (derived rulings), **D6** (no sticky buy bar), **D21** (`Price
context="pdp"`), **D37** (imports go through `catalog/`), **D47(2)** (no trust line), **D32** (year).

## Connects to
- **Depends on:** `src/features/catalog/` — `Product`, `findProduct`, `productsIn`, `ProductCard`,
  `configFor` / `CategoryConfig`, `productImageSrc` (D37); `src/components/ui/` — `Badge`, `Button`,
  `Price`, `Input`, `Textarea`, `Select`, `FieldLabel`, `FieldError`, `Checkbox`;
  `src/components/site/` — `SiteHeader`, `SiteFooter`; `src/lib/{site,routes}.ts`;
  `src/app/globals.css` for `pdp-split`, `quote-grid`, `qty-grid`, `similar-track`,
  `photo-inset-gallery`, `photo-vignette-gallery`, `display`, `label`, `numeral`.
- **Depended on by:** `src/app/(storefront)/products/[slug]/page.tsx` (six sections + `productView`),
  and `src/app/(storefront)/styleguide/page.tsx` §11, which renders `QuoteSuccess`.

## Don't
- **Don't add a cart, a stepper, a `+/−` control or a numeric quantity input.** The artboard draws four
  cells and no stepper (`product.md` §3.4); there is no cart anywhere in this build
  (`docs/decisions.md:105`).
- **Don't reproduce the desktop `Send inquiry` button's drawn state.** It ships pre-hovered
  (`--accent-hover` + `translateY(1px)`) — a state demo, not rest (`product.md` §2.6).
- **Don't copy the segmented control's drawn double right edge.** Every segment carries
  `border-right`, including the last (`product.md` §2.6); that is an export artefact.
- **Don't let `Similar products` return the current product.** The artboard's third card is the PDP
  subject in another size; `product.md` §7.6 flags it as something a real feed should not do. D52.
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
1. ~~**Where a submitted quote goes.**~~ **Closed 2026-09-24 by D104** (email via Resend, behind
   `AUTO_EMAIL_LEAD_CAPTURE_ENABLED`). All three env vars are in Vercel with the flag `false`; turning it on is `todo.md` item 2.
2. **`Vehicle` is declared three times** — here, `results/types.ts`, and implied by `finder/`. A third
   consumer means it belongs in `src/lib/`. Coordinator or **owner** (root `llm.md` §7).
3. **`M+S` is derived from the winter badge**, not a fact `Product` carries (`types.ts` `PdpBadge`).
   Real sidewall markings come with real catalogue data (D48). **Client.**
4. **One photo per SKU.** The gallery shows the card's cut-out; four cover nine tire SKUs (D43), three
   cover nine wheel SKUs, and **one lifestyle photograph covers all nine accessory SKUs** via
   `productImageSrc()` (D58, `DEVIATIONS.md` #51). Per-SKU photography — `HANDOFF.md` §7. **Client.**
5. **`How many?` reads oddly on an accessory** whose `size` already says `Set of 20`, so the cells offer
   one, two or four *sets*. **Half-closed 2026-09-22 by D65:** accessories now open on `1`. The cells
   and their **labels** are untouched (D50, D63). Still **owner's**, if the wording should change.
6. ~~**`Custom` collects no number.**~~ **Closed 2026-09-22** — see Rules ("Quantity is a URL param") and
   `DEVIATIONS.md` #70: a bounded free-text field renders in the Optional group whenever the selection is
   `custom`. No new island, no drawn pixel moved.
