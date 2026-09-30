# src/features/payments/

## Purpose

Taking the money. Staff create a link in the admin; the customer opens `pay.platinumwheels.ca/pay/<token>`
and presses Pay; Converge's hosted page takes the card; we confirm the result server-side and mark the
link paid. This folder is the only code that knows the gateway exists (D99). Delete it and the admin's
links point at nothing.

## Owns

- [`types.ts`](types.ts) — the contract: the `Gateway` interface the service talks to, `GatewayTransaction`,
  and `linkState()` (expiry is derived, never stored).
- [`config.ts`](config.ts) — env vars (`CONVERGE_*`, `FIXIE_URL`), `PAY_HOST`, and the link URL builder.
  Server only: it reads the PIN.
- [`converge.ts`](converge.ts) — the Converge adapter: session token, `txnquery` by transaction id and by
  invoice number, the static-IP proxy, XML parsing, and the whitelist that redacts gateway data. The only
  file that speaks Elavon's wire format.
- [`money.ts`](money.ts) — integer cents ⇄ `"452.60"` without floats.
- [`service.ts`](service.ts) — every state change: `createLink` (idempotent), `cancelLink`, `listLinks`,
  `getPayPage`, `startAttempt` (row lock, then network), `handleReturn`, `reconcilePending` (cron),
  `reconcileLink` (staff). The money rules are listed at the top of the file.
- [`pay-actions.ts`](pay-actions.ts) — `"use server"`. `startPayment`: the Pay button. Its only input is the
  link token, bound by the page.
- [`components/pay-button.tsx`](components/pay-button.tsx) — client island. Opens a session, then POSTs the
  one-time token to the hosted page (D107).

## Rules

- **Never trust the browser** (`docs/payments.md` §5). The amount comes from the attempt row. A return
  redirect only names a transaction to look up, and state changes only on a server-side `txnquery` whose
  invoice number and amount match the attempt.
- **Every state change writes a `payment_events` row in the same transaction.** Events are append-only
  (DB trigger), and gateway data goes in only through `REDACTED_FIELDS`.
- **Row lock first, network after.** `startAttempt` commits the pending attempt before calling Converge,
  so a 60 s gateway timeout never holds a lock.
- **A second approval is `duplicate`, never `approved`.** The unique index makes it impossible anyway.
  Staff refund it in the Converge portal.
- **No refunds, voids or any money-out operation here** (`docs/payments.md` §5.7).
- **Credentials:** never log, return or store `CONVERGE_PIN` or `FIXIE_URL`. Never disable TLS
  verification. **After 5 wrong PINs Converge blocks the calling IP**, the Fixie IPs included: check
  credentials with one call before any loop.
- **Nothing here is imported by a client component except `pay-actions.ts`** (a Server Action reference) and
  `components/`.

## Decisions

| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | None folder-scoped. | The payment decisions are global: D99–D103, D105–D107 in root `llm.md` §5b. | — |

## Connects to

- **Depends on:** `src/db/` (schema, `getDb`), `undici` (fetch + `ProxyAgent`), `src/components/ui/button`,
  env vars in `docs/payments.md` §7.
- **Depended on by:** `src/app/pay/**` (customer routes), `src/app/api/cron/reconcile/route.ts`, and
  `src/features/admin/` (D106: `service`, `config`, `money` only, never `converge.ts`).

## Don't

- Don't import `converge.ts` outside this folder and the two route files that need a gateway.
- Don't send `ssl_transaction_currency`: it errors (5087) on a CAD-only terminal.
- Don't add a stored `expired` status. It is derived; the cron runs once a day.
- Don't delete a link. Cancel it.

## Open

1. The items `docs/payments.md` §10 marks UNCONFIRMED (`ssl_merchant_id` vs `ssl_account_id`,
   `ssl_description` on the token call, GET or POST on the return, the `txnquery` single-result shape).
   All are settled by the first demo call.
2. A payment-received email to the owner. Not built; Resend lives on the `quote-email-delivery` branch (D104).
