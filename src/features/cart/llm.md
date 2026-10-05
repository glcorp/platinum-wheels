# src/features/cart

## Purpose
The `/cart` page and the site's one way to ask for a quote (**D122**). Owner, 2026-10-01: a customer buying
two products should not type their name and number twice, so products go into a browser-only cart and
"there in the cart is where it says request for a quote ... clicking request a quote brings the form
pop-up where they can fill in the information and that's how we capture the lead". Delete this folder
and the storefront captures no leads at all: the product page no longer has a form.

The cart itself (storage, counts, the add) is `src/lib/cart.ts`, because the header's cart link in
`src/components/site/` reads it too and may not import a feature. This folder is the page, the form, the
Server Actions and the emails.

## Owns
- [`types.ts`](types.ts) — the quote contract (D25): `QUOTE_FIELD` (the D51 contact fields plus the hidden
  `lines`, `elapsed`, `website`), `CONTACT_METHODS`, `QuoteFormState`, `PostedLine`, `QuoteCopy` and
  `pickQuoteCopy()` (pure, so the island and the action pick the same words).
- [`copy.ts`](copy.ts) — server only: the quote form's placeholder and consent line per category, and the
  `mixed` pair for a cart of several categories (the wheels/accessories consent line, new placeholder).
- [`actions.ts`](actions.ts) — `"use server"`. `refreshCart(slugs)` returns each product's current card
  facts, `null` for one the catalogue no longer lists, or `{ ok: false }` when it cannot be read.
  `submitCartQuote` is D51's `submitQuote` widened to a cart: a per-IP cap first (LA-03, below), then
  honeypot and 3 s timer (a bot gets a
  normal `success`; the timer reads `elapsed`, a duration from the dialog's first opening, D123(7)), then
  field validation, then `deliverQuote()` (D104). The posted lines are trusted for
  shape only; every product is read again; the consent wording is picked from the products, never from the
  post. Ceilings 200 lines × 9,999 stop tampering, never a person.
- [`quote-email.ts`](quote-email.ts) — `deliverQuote()` (D104), moved from `product/`: one owner alert and
  one auto-reply per request, each listing every line ("One email, all items", owner ruling). Plain text,
  Resend REST, **sends only when `AUTO_EMAIL_LEAD_CAPTURE_ENABLED` is exactly `true`**, never logs
  personal data (log lines carry a line count).
- `components/cart-view.tsx` — the page's client island: hydration placeholder, empty state, lines,
  request panel, the removed-products note, the quote dialog (the filter sheet's `sheet-dialog`, centred at
  `--container-dialog` from `md:`) and the sent state. Also exports `CartEmpty`, `CartSummary`,
  `CartRemovedNote` for `/styleguide`.
- `components/cart-line.tsx` — one line: photo, brand, model link, size, `For <vehicle>`, the
  `Unavailable, we'll check restock` badge, a −/field/+ stepper (floor 1, committed on blur or Enter) and
  `Remove`. Handlers optional, so the styleguide renders it inert. An unbranded accessory (D125) has no
  brand label; its name stands alone there, in the added notice and in the owner alert
  (`productName()`, `src/lib/product-name.ts`).
- `components/quote-form.tsx` — the D51 form inside the dialog, minus the quantity fields. Reads the cart
  at the moment of sending (`getLines`). Send runs in `onSubmit` inside a try/catch (D93b ENV-1).
- `components/quote-success.tsx` · `components/quote-error-summary.tsx` — the two authored states (D51,
  D57, D104), moved from `product/` unchanged except the success heading is now an `h2`.

## Rules
- **No price anywhere in the cart** (owner ruling for launch, D122), whatever `PRICES_VISIBLE` says.
- **The cart lives in the browser only.** No account, no cookie, nothing stored on the server; the owner
  alert is the only record (D104). The privacy page says so (`privacy/page.tsx`, "Cookies and tracking").
- **One request = one owner alert + one auto-reply**, listing every line with its quantity, the searched
  vehicle (unverified, labelled so) and, for a discontinued product, "check restock".
- **The auto-reply never repeats what the visitor typed** (D104): product names come from the catalogue
  and quantities are parsed whole numbers.
- **A database outage costs names, never the lead.** `refreshCart` failing keeps the saved snapshots;
  `submitCartQuote` failing to read products still sends, by slug.
- **`noValidate` on the form is load-bearing** (D65); `actions.ts` is the validator.
- **The quote action is capped per IP before anything else runs** (LA-03, D145 audit; owner on the
  auto-reply: "Keep it, rate-limited"). `QUOTE_LIMITER` in `actions.ts`: **3 per 10 minutes and 5 per 24
  hours**, counting only requests that passed the spam checks and validation (the ones that send email),
  checked before the honeypot and the timer so an IP over the cap cannot probe them. Over the cap: no
  email, `status: "invalid"` with every value echoed and the notice *"You've sent a few requests already.
  Call us at <primary number> and we'll help."*, and one log line `{event: "quote.rate_limited", ip}`. In
  memory per server instance (`src/lib/rate-limit.ts`); the platform-wide brake is the Vercel firewall rule
  (`todo.md` item 7).
- **CASL renders unticked** (`docs/decisions.md:118`); a rejected submit echoes the visitor's own tick
  (WDG-10).
- Never import `CATEGORY_CONFIG` into a client file here: `copy.ts` is resolved by the server page and
  handed down (the D58 bundle rule this form always followed).

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| D93b | 2026-09-30 | An offline send returns `status: "invalid"` with every value echoed and a `notice` ("We couldn't send that. Check your connection and try again."), instead of throwing to the route boundary. Caps name 100 / email 254 / phone 32 / message 1000, mirrored between `actions.ts` and `maxLength`, `\p{Cf}` stripped. | ENV-1, WDG-10/12. Moved here from `product/` with the form (D122). | D93b |
| D147 | 2026-10-04 | Per-IP cap on `submitCartQuote`: 3 / 10 min and 5 / 24 h, counted once a request would send email, checked before the spam guards; the auto-reply stays. | The honeypot and timer are client-controlled; each request sends two emails from a 100-a-day Resend quota shared with another site, and the auto-reply can be aimed at strangers. | LA-03 (D145 audit); owner: "Keep it, rate-limited" |
| D151 | 2026-10-04 | (1) The quote form's submit row is sticky at the bottom of the dialog's scroller, on `--surface`, carrying the scroller's old `pb-safe`; the scroller has `scroll-pb-24` so focus never lands under it (DEVIATIONS #116). (2) The Preferred contact segments carry `data-segment`, the forced-colours hook for the checked segment. | The submit sat below the visible area on common viewports (UI-CRITIQUE); the selected segment vanished in forced colours (A11Y-MANUAL). Launch audit, D145. | Owner, 2026-10-04: "Apply all code items" |
| — | — | Every other cart ruling is global. | — | root `llm.md` D122 |

## Connects to
- **Depends on:** `src/features/catalog/` (`getProductsBySlugs` with `includeDiscontinued`, `toProduct`,
  `cartItem`, `CATEGORY_CONFIG`; D37); `src/lib/cart.ts` (the store), `src/lib/{site,routes}.ts`,
  `src/lib/rate-limit.ts` (the quote cap, LA-03);
  `src/components/ui/` (`Button`, `Badge`, `Input`, `Textarea`, `Checkbox`, `FieldLabel`, `FieldError`);
  `src/app/globals.css` (`cart-grid`, `sheet-dialog`, `sheet-panel`, `--container-dialog`, `enter-rise`).
- **Depended on by:** `src/app/(storefront)/cart/page.tsx`; `src/app/(storefront)/styleguide/page.tsx`
  (`QuoteSuccess`, `QuoteErrorSummary`, `CartLineRow`, `CartEmpty`, `CartSummary`, `CartRemovedNote`).

## Don't
- **Don't send one email per product.** Owner ruling: one request, one alert.
- **Don't trust the posted lines** beyond their shape, and don't take the consent wording from the post.
- **Don't move the cap after validation or the spam checks**, and don't count invalid posts: the first lets
  a capped IP probe the guards, the second would lock out a person fixing typos (LA-03).
- **Don't add a payment, a total or a checkout step.** Quotes stay human (`docs/decisions.md` §7 as amended
  by D122); payment is the admin's payment link.

## Open
1. **No GA4 events** (`add_to_cart`, `view_cart`, `generate_lead`): there is no analytics in the build yet.
   **Owner**, when analytics lands.
2. **The parked e2e suite still asserts the old quote band** (`tests/llm.md` Open). Rewrite with the
   fixture database.
3. **The quote cap is per instance and per IP** (LA-03). Many IPs, or traffic spread over many instances,
   still reach Resend's quota; a shared counter (a database row or a KV store) or a global daily ceiling
   would close that. Not built: the owner ruled a per-IP cap plus the firewall rule. **Owner.**
