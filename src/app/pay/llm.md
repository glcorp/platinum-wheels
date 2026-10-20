# src/app/pay/

## Purpose

The customer's side of a payment link, served on `pay.platinumwheels.ca` in production (D105). A real
segment rather than a route group, for the same reason as `src/app/admin/`: it needs its `/pay` URL.

## Owns

- [`[token]/page.tsx`](%5Btoken%5D/page.tsx) — `/pay/<token>`: amount, description, reference, expiry and
  the Pay button, or the paid, expired or cancelled state, or "pay by phone" when payments are off or Stripe is not
  configured (D191). Dynamic, read at request time. Before reading, it settles the link's pending attempt (bounded,
  errors swallowed): `?paid=1` is Stripe's `success_url`, and only says "look now". The staff-typed
  description wraps anywhere (`wrap-anywhere`), so one long word cannot widen the page (D145 audit).
- [`webhook/route.ts`](webhook/route.ts) — `POST /pay/webhook`, Stripe's event destination (D191). Reads the raw
  body once, verifies the signature (400 on failure), ignores the other `livemode`, then hands the event to
  `processStripeEvent` (`src/features/payments/service.ts`). 500 only for our own failure so Stripe retries. Never
  answers with payment data. GET is a 405.
- [`not-found.tsx`](not-found.tsx) — the pay host's 404 (D145 audit, COPY / SEC-EDGE; D151): the
  pay page's logo row and panel, *Payment link not found*, and the shop's phone and email from
  `PRIMARY_CONTACT` (no name, "Call us at", D161) and `SITE.email`. No storefront link. Answers an unknown token, every path below.
- [`page.tsx`](page.tsx) and [`[...missing]/page.tsx`](%5B...missing%5D/page.tsx) — `notFound()` only,
  so bare `/pay` and any deeper unknown path render that 404, not the storefront's. In production
  `decideHostRouting` rewrites every non-`/pay` path on the pay host to `/pay` (`PAY_NOT_FOUND_PATH`).
  **With JavaScript off those `notFound()`s paint nothing** (Next 16.4 canary answers a thrown `notFound()`
  with an empty `<html id="__next_error__">` shell, as D157 found for products), so `src/proxy.ts` answers
  every pay document request that would 404 itself: it fetches [`link-not-found/page.tsx`](link-not-found/page.tsx)
  (a plain render of `not-found.tsx`, 200 and noindex, never linked) and returns its HTML with status 404
  (QA COPY-1, D184). The `notFound()`s stay for client navigations.
- [`link-not-found/page.tsx`](link-not-found/page.tsx) — the page the proxy fetches (above). Visited directly it
  is a 200 with `noindex`; no token can collide with it (tokens are 22 to 64 characters).

## Rules

- **Pages stay thin.** All behaviour lives in `src/features/payments/`.
- **No `"use client"` here.** The Pay island lives in `src/features/payments/components/`.
- **No site chrome.** Storefront links would not resolve on the pay host (D105).
- Response headers for `/pay/**` (no framing, noindex, `no-store`, `Referrer-Policy: strict-origin`) are
  set in `next.config.ts` (D105).
- **The Stripe event destination points here** (`docs/payments.md` §7): `https://pay.platinumwheels.ca/pay/webhook`,
  no trailing slash (a redirect is a failed delivery).

## Decisions

| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | None folder-scoped. | See D100, D105, D191 in root `llm.md` §5b. | — |

## Connects to

- **Depends on:** `src/features/payments/`, `src/lib/site.ts` (contacts).
- **Depended on by:** Stripe (the webhook, and the `success_url` / `cancel_url` it sends the customer back to) and
  the links staff email out.

## Don't

- Don't turn the pay 404 back into a bare `notFound()` for document requests: it is blank without
  JavaScript (D184). Keep the proxy answer.
- Don't render anything from the request's query. `?paid=1` is a hint; the page reads its own stored attempt.
- Don't read a webhook body for anything but `type` and the object id. Re-read the session from Stripe.
- Don't register the webhook URL with a trailing slash, or put `pay.` behind the Cloudflare proxy.

## Open

1. ~~A stray path on the pay host lacks the `/pay/:path*` headers.~~ **Closed.** D151 keyed the pay
   headers on the host, and a production-mode run on 2026-10-13 (D184, QA COPY-1) saw `X-Robots-Tag`,
   `X-Frame-Options` and `no-store` on stray pay-host paths, now answered by `payNotFound` in `src/proxy.ts`.
