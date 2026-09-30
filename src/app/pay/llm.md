# src/app/pay/

## Purpose

The customer's side of a payment link, served on `pay.platinumwheels.ca` in production (D105). A real
segment rather than a route group, for the same reason as `src/app/admin/`: it needs its `/pay` URL.

## Owns

- [`[token]/page.tsx`](%5Btoken%5D/page.tsx) — `/pay/<token>`: amount, description, reference, expiry and
  the Pay island, or the paid, expired or cancelled state. Dynamic, read at request time.
- [`return/route.ts`](return/route.ts) — `/pay/return`, the one URL Converge sends every customer back to
  (GET or POST). It verifies server-side, then 303s to the link's page.
- [`done/page.tsx`](done/page.tsx) — `/pay/done`, the landing page for a return that matched no link.

## Rules

- **Pages stay thin.** All behaviour lives in `src/features/payments/`.
- **No `"use client"` here.** The Pay island lives in `src/features/payments/components/`.
- **No site chrome.** Storefront links would not resolve on the pay host (D105).
- Response headers for `/pay/**` (no framing, noindex, `no-store`, `Referrer-Policy: strict-origin`) are
  set in `next.config.ts` (D105).
- **Converge portal settings point here** (`todo.md`): Redirect URL, Decline button link and Cancel link are
  all `https://pay.platinumwheels.ca/pay/return`.

## Decisions

| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | None folder-scoped. | See D100, D105, D107 in root `llm.md` §5b. | — |

## Connects to

- **Depends on:** `src/features/payments/`, `src/lib/site.ts` (contacts).
- **Depended on by:** Converge's hosted page (the return URL) and the links staff email out.

## Don't

- Don't render anything from the return request's fields. They are untrusted.

## Open

— none.
