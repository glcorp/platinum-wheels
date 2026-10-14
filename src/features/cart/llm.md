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
  `lines`, `elapsed`, `website`; no `contact` since D160, the Preferred contact control is gone), `QuoteFormState`, `PostedLine`, `QuoteCopy` and
  `pickQuoteCopy()` (pure, so the island and the action pick the same words).
- [`copy.ts`](copy.ts) — server only: the quote form's placeholder and consent line per category, and the
  `mixed` pair for a cart of several categories (the wheels/accessories consent line, new placeholder).
- [`actions.ts`](actions.ts) — `"use server"`. `refreshCart(slugs)` returns each product's current card
  facts, `null` for one the catalogue no longer lists, or `{ ok: false }` when it cannot be read.
  `submitCartQuote` is D51's `submitQuote` widened to a cart: a per-IP cap first (LA-03, below), then
  honeypot and 1 s timer (a bot gets a
  normal `success`; the timer reads `elapsed`, a duration from the dialog's first opening, D123(7)), then
  field validation, then `deliverQuote()` (D104). The posted lines are trusted for
  shape only; every product is read again; the consent wording is picked from the products, never from the
  post. Ceilings 200 lines × 9,999 stop tampering, never a person.
- [`quote-email.ts`](quote-email.ts) — `deliverQuote()` (D104), moved from `product/`: one owner alert and
  one auto-reply per request, each listing every line ("One email, all items", owner ruling). Transport
  only: Resend REST with an `html` body and a `text` alternative (D162), **sends only when
  `AUTO_EMAIL_LEAD_CAPTURE_ENABLED` is exactly `true`**, never logs personal data (log lines carry a line
  count). Owns the `QuoteLine` / `QuoteInquiry` shapes.
- [`quote-email-html.ts`](quote-email-html.ts) — the two emails as pure builders (D162):
  `ownerAlertEmail(inquiry)` and `autoReplyEmail(lines, shopAddress)`, each `{ subject, text, html }`. No
  env reads, so a preview can call them. One dark 600px table, inline styles, `bgcolor` beside every
  background, no gradients or images (the goodwill site's inquiry emails). **Every visitor or catalogue
  value goes through `esc()`, attributes included**; a URL is a link only when it starts with `http`.
  Times are Brampton time (`SHOP_DATE_TIME`); the consent record keeps the ISO string. The phone is
  `PRIMARY_CONTACT` only, no person's name. **The plain-text alert prints the visitor's name, email and
  phone on one line each** (`textLine()`: every line-break character becomes a space), so a crafted
  post cannot forge `Consented: YES` lines in the CASL record (QA CART-5, D184).
- `components/cart-view.tsx` — (D160: below 1100 a bottom-pinned `Request a quote` bar shows until the
  summary is on screen; the quote panel is `data-fit`, the form's height up to the full screen.) The page's client island: hydration placeholder, empty state, lines,
  request panel, the removed-products note, the quote dialog (the filter sheet's `sheet-dialog`, centred at
  `--container-dialog` from `md:`) and the sent state. **Since D162 the sent state is read from the
  browser's record** (`useSentRequests`, `src/lib/cart.ts`), so it survives a refresh: a send records the
  time and products, then empties the cart; an empty cart with a record shows the newest request in the
  `QuoteSuccess` panel (with its time and products, `Keep shopping` and `Clear sent requests`) and lists
  the earlier ones; a full cart lists every sent request below it. Also exports `CartEmpty`,
  `CartSummary`, `CartRemovedNote` for `/styleguide`.
- `components/sent-requests.tsx` — `SentRequestList` (a titled list of sent requests, each with its
  Brampton time and products, optional `Clear sent requests`), `SentLines` (one request's products,
  linked to their pages), `sentLabel()` (`Sent Oct 11, 2026, 3:42 p.m. ET`: the zone is named, only here,
  D185) and `CLEAR_LABEL` (D162). Every text of a stored request wraps anywhere (`wrap-anywhere`), so a
  290-character token cannot widen `/cart` (QA CART-3, D184). No `"use client"`: rendered inside
  `CartView` and inert on `/styleguide`.
- `components/cart-line.tsx` — one line: photo, brand, model link, size, `For <vehicle>`, the
  `Unavailable, we'll check restock` badge, a −/field/+ stepper (floor 1, committed on blur or Enter) and
  `Remove`. Handlers optional, so the styleguide renders it inert. An unbranded accessory (D125) has no
  brand label; its name stands alone there, in the added notice and in the owner alert
  (`productName()`, `src/lib/product-name.ts`).
- `components/quote-form.tsx` — the D51 form inside the dialog, minus the quantity fields. Reads the cart
  at the moment of sending (`getLines`). Send runs in `onSubmit` inside a try/catch (D93b ENV-1).
- `components/quote-success.tsx` · `components/quote-error-summary.tsx` — the two authored states (D51,
  D57, D104), moved from `product/` unchanged except the success heading is now an `h2`. Since D162
  `QuoteSuccess` takes an optional `sentLabel` and `children` (the request's products).

## Rules
- **No price anywhere in the cart** (owner ruling for launch, D122), whatever `PRICES_VISIBLE` says.
- **The cart lives in the browser only.** No account, no cookie, nothing stored on the server; the owner
  alert is the only record (D104). The browser's record of sent requests (D162) holds the time and the
  products only, never the visitor's name, email, phone, message or vehicle (owner, 2026-10-11:
  *"Products and time only"*). The privacy page says so (`privacy/page.tsx`, "Cookies and tracking").
- **One request = one owner alert + one auto-reply**, listing every line with its quantity, the searched
  vehicle (unverified, labelled so) and, for a discontinued product, "check restock".
- **The auto-reply never repeats what the visitor typed** (D104): product names come from the catalogue
  and quantities are parsed whole numbers.
- **Every value in an HTML email body is escaped** (D162): visitor text and catalogue text alike, in
  text and in attributes. Build bodies only in `quote-email-html.ts`.
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
| D162 | 2026-10-11 | Sent requests stay on `/cart` after a refresh: a second `localStorage` entry keeps each request's time and products (no personal details), newest first, at most 20; the visitor can clear it. | The success panel vanished on refresh, so a visitor could not tell the request had gone. | Owner brief 2026-10-11; owner: "Products and time only" |
| D162 | 2026-10-11 | Both quote emails are HTML with a plain-text alternative, in the goodwill site's dark table style. The auto-reply still repeats nothing the visitor typed (no name, email, phone, message or vehicle) and gains a Contact us band (email, primary phone, hours); its "Need it sooner? Call us" line folds into that band. Subjects, flag, reply-to and logging unchanged. | Owner brief, 2026-10-11: restyle both quote emails to match the platinumwheels.ca site's template. | D162 |
| D189 | 2026-10-14 | The auto-reply and the success panel read "We'll confirm fitment and stock and get back to you." (no timeframe); the request panel keeps "within 1-2 business days". Emails landing in Gmail Promotions: left as is. | Owner's wording, verbatim. | D189 |
| — | — | Every other cart ruling is global. | — | root `llm.md` D122 |

## Connects to
- **Depends on:** `src/features/catalog/` (`getProductsBySlugs` with `includeDiscontinued`, `toProduct`,
  `cartItem`, `CATEGORY_CONFIG`; D37); `src/lib/cart.ts` (the store), `src/lib/{site,routes}.ts`,
  `src/lib/rate-limit.ts` (the quote cap, LA-03);
  `src/components/ui/` (`Button`, `Badge`, `Input`, `Textarea`, `Checkbox`, `FieldLabel`, `FieldError`);
  `src/app/globals.css` (`cart-grid`, `sheet-dialog`, `sheet-panel`, `--container-dialog`, `enter-rise`).
- **Depended on by:** `src/app/(storefront)/cart/page.tsx`; `src/app/(storefront)/styleguide/page.tsx`
  (`QuoteSuccess`, `QuoteErrorSummary`, `CartLineRow`, `CartEmpty`, `CartSummary`, `CartRemovedNote`,
  `SentRequestList`, `SentLines`, `sentLabel`).

## Don't
- **Don't send one email per product.** Owner ruling: one request, one alert.
- **Don't trust the posted lines** beyond their shape, and don't take the consent wording from the post.
- **Don't raise `QUOTE_MIN_FILL_MS` back to 3 s.** The owner cut it to 1 s (D185, "Shorter timer (1 s)"):
  an autofill and Enter inside 3 s was being dropped, and the visitor was told it was sent.
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
