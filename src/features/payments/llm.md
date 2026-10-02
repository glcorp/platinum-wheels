# src/features/payments/

## Purpose

Taking the money. Staff create a link in the admin; the customer opens `pay.platinumwheels.ca/pay/<token>`
and presses Pay; Converge's hosted page takes the card; we confirm the result server-side and mark the
link paid. This folder is the only code that knows the gateway exists (D99). Delete it and the admin's
links point at nothing.

## Owns

- [`types.ts`](types.ts) — the contract: the `Gateway` interface the service talks to, `GatewayTransaction`,
  and `linkState()` (expiry is derived, never stored).
- [`config.ts`](config.ts) — env vars (`CONVERGE_*`, `FIXIE_URL`, `CONVERGE_NOTIFY_*`), `PAY_HOST`, and the
  link URL builder. Server only: it reads the PIN. The placeholder `REPLACE_ME` counts as unset (D121).
- [`converge.ts`](converge.ts) — the Converge adapter: session token, `txnquery` by transaction id,
  the static-IP proxy, XML parsing, the whitelist that redacts gateway data, and the export script's
  source ranges and parser (D119). The only
  file that speaks Elavon's wire format.
- [`money.ts`](money.ts) — integer cents ⇄ `"452.60"` without floats.
- [`service.ts`](service.ts) — every state change: `createLink` (idempotent), `cancelLink`, `listLinks`,
  `countOpenLinks` (the admin home's tile, D118),
  `getPayPage`, `startAttempt` (row lock, then network), `handleReturn` (with `handleEmptyReturn` for Converge's
  empty POSTs, matched by the `pw_pay` cookie), `handleNotify` (D119). The money rules are listed at
  the top of the file.
- [`payment-email.ts`](payment-email.ts) — the shop's "Payment received" / "Refund needed" email via
  Resend (D120). Sent after the commit, by whichever path settled the attempt.
- [`pay-actions.ts`](pay-actions.ts) — `"use server"`. `startPayment`: the Pay button. Its only input is the
  link token, bound by the page.
- [`components/pay-button.tsx`](components/pay-button.tsx) — client island. Opens a session, then POSTs the
  one-time token to the hosted page (D107) from a **new** form element that carries nothing else (D125).

## Rules

- **Never trust the browser** (`docs/payments.md` §5). The amount comes from the attempt row. A return
  redirect only names a transaction to look up, and state changes only on a server-side `txnquery` whose
  invoice number and amount match the attempt.
- **Every state change writes a `payment_events` row in the same transaction.** Events are append-only
  (DB trigger), and gateway data goes in only through `REDACTED_FIELDS`.
- **Only the return redirect and Converge's export script settle an attempt (D108, D119).** No cron and
  no staff check: each would cost Fixie requests. An attempt with neither stays `pending`.
- **The export script is trusted on source range plus Basic credentials, never on its own.** It is
  unsigned. Its fields go through `toGatewayTransaction` and the same amount and invoice checks as a query.
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
- **Only `ssl_txn_auth_token` goes to the hosted page (D125).** The Pay form is a Server Action form, and the
  server renders hidden `$ACTION_*` inputs into it that React keeps after hydration. The hand-off form has
  its own `key` so it is a fresh element, and the effect strips every other input before `submit()`. Any
  extra field on that POST is stored on the Converge session and makes its hosted page fail with
  errorType SYSTEM.

## Decisions

| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | None folder-scoped. | The payment decisions are global: D99–D103, D105–D108 in root `llm.md` §5b. | — |

## Connects to

- **Depends on:** `src/db/` (schema, `getDb`), `undici` (fetch + `ProxyAgent`), `src/components/ui/button`,
  env vars in `docs/payments.md` §7.
- **Depended on by:** `src/app/pay/**` (customer routes) and
  `src/features/admin/` (D106: `service`, `config`, `money` only, never `converge.ts`).

## Don't

- Don't import `converge.ts` outside this folder and the route files that need a gateway.
- Don't send `ssl_transaction_currency`: it errors (5087) on a CAD-only terminal.
- Don't add a stored `expired` status. It is derived; no job exists to flip it (D108).
- Don't add a gateway call that a customer's payment did not cause (a cron, a staff button, a page
  load). The Fixie free tier is 500 requests a month (D108).
- Don't delete a link. Cancel it.

## Open

1. Settled 2026-10-03 (D125): the demo approves end to end. Still unconfirmed: the `txnquery`
   single-result shape (both shapes are parsed), and whether a Converge return ever arrives as GET
   (an approval arrives as a POST with `ssl_txn_id`, `ssl_result`, `ssl_approval_code`).
2. **The export script is built (D119) but unproven.** Elavon's sample POST has no `ssl_invoice_number`;
   if the real one lacks it too, notify matches nothing (logged as `unmatched`) and the 1-request saving
   does not happen. Then the option is to send our invoice in a field Converge echoes back, or to match
   on `ssl_txn_id` after the return has run once.
