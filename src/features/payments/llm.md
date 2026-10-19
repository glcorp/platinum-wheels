# src/features/payments/

## Purpose

Taking the money. Staff create a link in the admin; the customer opens `pay.platinumwheels.ca/pay/<token>` and
presses Pay; **Stripe's hosted Checkout page** takes the card; we confirm the result server-side and mark the link
paid. This folder is the only code that knows the gateway exists (D99, D191). Delete it and the admin's links
point at nothing. Design and runbook: `docs/payments.md`.

## Owns

- [`types.ts`](types.ts) — the contract: the `Gateway` interface the service talks to, `GatewayTransaction`,
  `GatewaySession`, `Payer`, and `linkState()` (expiry is derived, never stored).
- [`config.ts`](config.ts) — env vars (`STRIPE_*`, `PAYMENTS_ENABLED`), the key guards, `PAY_HOST`, and the link
  URL builder. Server only. A live key is refused outside Vercel production; a test key when
  `STRIPE_REQUIRE_LIVE=1`; `REPLACE_ME` counts as unset.
- [`stripe.ts`](stripe.ts) — the Stripe adapter: the lazy pinned client (`2026-09-30.endive`), `createSession`,
  `retrieveSession`, `expireSession`, and `toGatewayTransaction`, the one place a session becomes `approved`. The
  only file that speaks Stripe's wire format.
- [`link-exists.ts`](link-exists.ts) — `payLinkExists`: one indexed read for `src/proxy.ts` (QA COPY-1, D184), in its own
  module so the proxy bundle never pulls in the Stripe SDK.
- [`money.ts`](money.ts) — integer cents ⇄ `"452.60"` without floats.
- [`service.ts`](service.ts) — every state change: `createLink` (idempotent), `cancelLink` (+ post-commit session
  expiry), `listLinks` (with refund/dispute flags), `webhookHealth`, `countOpenLinks` (D118), `getPayPage`,
  `startAttempt` (row lock, reuse an open
  session, then network), `settleAttempt` / `settleBySessionId` / `settleLinkForPage` / `settlePendingForAdmin` /
  `checkLinkPayment` (the three ways to ask Stripe about a pending attempt), and `processStripeEvent` (the
  webhook). The money rules are listed at the top of the file.
- [`payment-email.ts`](payment-email.ts) — the shop's "Payment received" / "Refund needed" email (D120), with who
  paid, and the notify-only refund and dispute emails, via Resend. Sent after the response (`after()`).
- [`pay-actions.ts`](pay-actions.ts) — `"use server"`. `startPayment`: the Pay button. Its only input is the link
  token, bound by the page. Ends in `redirect(session.url)`, outside any try/catch.
- [`components/pay-button.tsx`](components/pay-button.tsx) — client island. One plain form; while pending the button
  is `aria-disabled` (presses refused in its click handler), never `disabled`, so keyboard focus stays on it; an
  error alert takes focus (D151). A `pageshow` handler reloads a page restored from the back/forward cache.

## Rules

- **Never trust the browser or the webhook body** (`docs/payments.md` §5). The amount comes from the attempt row.
  State changes only after the session is **re-read from Stripe** and passes `toGatewayTransaction` (complete,
  paid, CAD, same mode, no adjustment, a PaymentIntent) and `applyTransaction` (invoice and amount match).
- **Every state change writes a `payment_events` row in the same transaction.** Events are append-only (DB
  trigger). Gateway data goes in only through `toGatewayTransaction`'s whitelist.
- **Row lock first, network after.** `startAttempt` commits the pending attempt before calling Stripe, so a slow
  call never holds a lock. Cancel and sibling expiry call Stripe **after** their commit and never fail it.
- **Reuse an open session.** A second press, a second tab or a double submit lands on the same Stripe page.
- **A second payment is `duplicate`, never `approved`.** Staff refund it in the Dashboard.
- **The page settles its own stored session, never the one in the URL**, throttled and capped (`MAX_PAGE_CHECKS`).
  The webhook and staff are not capped.
- **Refunds and disputes notify only.** They write an audit event, one email, and a `stripe_events` row. They never
  change a link's status. **No refunds, voids or any money-out call here.**
- **Credentials:** never log, return or store `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET`; never log session
  URLs, webhook bodies or `customer_details`. Payer details live in the shop email only.
- **Nothing here is imported by a client component** except `pay-actions.ts` (a Server Action reference) and
  `components/`.

## Decisions

The payment decisions are global: D99–D106, D120 and **D191** (the Stripe switch; it supersedes D102, D107, D108,
D119, D121, D125b and the return gate D145/D146) in root `llm.md` §5b.

## Connects to

- **Depends on:** `src/db/` (schema, `getDb`), `stripe` (the SDK), `after()` from `next/server`, `src/components/ui/button`, env vars in `docs/payments.md` §6.
- **Depended on by:** `src/app/pay/**` (customer routes and the webhook) and `src/features/admin/` (D106:
  `service`, `config` and `money` only, never `stripe.ts`).

## Don't

- Don't import `stripe.ts` outside this folder and the route files that need a gateway.
- Don't pass `payment_method_types` to Checkout: it was removed in API `2026-09-30.endive` (400).
- Don't compute `expires_at` from `Date.now()` inside `createSession`: an idempotent retry must send identical
  params, so it comes from the stored attempt row.
- Don't mark anything paid from `session.status === "complete"` alone.
- Don't add a stored `expired` link status. It is derived; an attempt's own `expired` is its session ending.
- Don't delete a link. Cancel it.
- Don't send a Stripe call under a row lock.

## Open

1. **Nothing has run against Stripe's real API.** The sandbox checks in `docs/payments.md` §9 come first; in
   particular `billing_address_collection`, `phone_number_collection` and `request_three_d_secure: "any"` are
   unverified on `2026-09-30.endive` (none is load-bearing: drop a rejected one), and `session.url` on a
   retrieve is assumed (the code falls back to expire-and-recreate).
2. **Back from Stripe on a phone** (iPhone Safari, Android Chrome) is untested; the `pageshow` reload is the first
   defence and a 303 route handler the fallback.
3. **Go-live gates** (`docs/payments.md` §11): Stripe activation, Vercel Pro, privacy/terms/refund wording
   (`privacy` and `terms` still say no payment is taken), the restricted live key.
4. **Not built, by ruling or for scope:** an in-app refund button, "mark paid offline", a CSV export for the
   bookkeeper, a per-hour cap on new sessions (the 10-attempts-per-link cap bounds Stripe calls per link).
