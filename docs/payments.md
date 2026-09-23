# Payments — design (Converge, via Costco / Elavon)

Status: **draft on branch `payments`**, 2026-09-23. Schema, migrations and DB client exist; the gateway
adapter, `/pay` page and admin wiring do not yet. Decision IDs are **not yet assigned** — §9 lists the
proposed rows; they are numbered into root `llm.md` §5b at merge time so they cannot collide with rows
the parallel admin session adds on `main`.

---

## 1. What was chosen and what it actually is

The client chose **Costco Payment Processing**. Costco is a referrer only: the merchant account,
underwriting, gateway and support are **Elavon** ([costcopaymentprocessing.ca](https://www.costcopaymentprocessing.ca/index.html)).
Elavon issued the client a **Converge demo account** (email from Elavon, 2026-09-18, forwarded by the
client; **demo expires 2026-10-18** — request an extension from `#SEDevPortalSupport@elavon.com` at least
5 days before, i.e. by **2026-10-13**).

Elavon has a newer REST gateway (EPG) with a real payment-links API and signed webhooks, but its Canadian
availability is unconfirmed and the client's account is on **Converge**. This design is Converge-first.

## 2. The shape of the integration

Converge has **no API that mints a payment link** with an amount and an expiry. Its Pay-by-Link lives in
the Converge web UI; its Billing & Invoicing API emails Elavon's own invoice. Neither fits a builder that
hands staff a URL to paste. So **the link is ours**:

```
staff ──(admin builder: amount, description, expiry)──▶ payment_links row
                                                         public URL: platinumwheels.ca/pay/<token>
customer opens /pay/<token>   ── page shows amount + description + Pay ──
customer presses Pay ─▶ server: lock link FOR UPDATE, check payable,
                          insert payment_attempts row (pending, invoice PW-10001-n),
                          POST Converge /hosted-payments/transaction_token  (via static-IP proxy)
                        ─▶ browser redirected to Converge Hosted Payment Page (card entered there)
Converge ─▶ browser redirected back to /pay/<token>/return?ssl_txn_id=…   (UNTRUSTED)
server: TXNQUERY by ssl_txn_id (via proxy) ─▶ verify amount, invoice number, result
        ─▶ attempt approved/declined; link paid (or attempt 'duplicate' if already paid)
daily cron: TXNQUERY by date range ─▶ resolve every still-pending attempt by invoice number
```

The database is the source of truth for whether a link is open. The gateway is the source of truth for
whether money moved. Nothing the browser sends is trusted for either.

## 3. Data model (`src/db/schema.ts`, migrations in `drizzle/`)

| Table | One row per | Key guarantees (enforced by Postgres) |
|---|---|---|
| `payment_links` | link staff create | integer cents > 0 · currency = CAD · description 1–200 chars · `expires_at > created_at` · `status='paid' ⇔ paid_at` · `status='cancelled' ⇔ cancelled_at` · unique `reference`, `public_token`, `idempotency_key` |
| `payment_attempts` | trip to the hosted page | **at most one `approved` per link** (partial unique index) · unique `(provider, provider_txn_id)` · unique invoice number · approved/duplicate ⇒ has txn id and `verified_at` · last4 is 4 digits |
| `payment_events` | thing that happened | **append-only**: a trigger rejects UPDATE, DELETE, TRUNCATE · dotted `type` format |

- **Expired is derived, not stored**: `status='active' AND expires_at <= now()`. Vercel Hobby cron runs
  once a day; a stored flag would lie for up to 24 hours.
- **References**: `PW-10001` from a Postgres sequence; attempt invoice `PW-10001-2` is what Converge
  prints on the cardholder's statement and what the reconcile matches on.
- **Links are never deleted** (FK `ON DELETE RESTRICT` from attempts and events). Cancel instead.
- **No card data**: brand + last four only (PCI DSS permits). The Hosted Payment Page keeps us at
  **SAQ A**.

Verified 2026-09-23 against a real Postgres (PGlite): both migrations apply, and 20 constraint cases
(positive and negative) behave as specified.

## 4. State machines

**Link:** `active → paid` (verified approval) · `active → cancelled` (staff) · `active` + past expiry =
expired (derived). `paid` and `cancelled` are terminal.

**Attempt:** `pending → approved | declined | expired | duplicate`, or `failed` if no session was ever
issued. A customer may retry after `declined`/`failed`/`expired`; each retry is a new attempt.

**Race rule:** creating an attempt locks the link row (`SELECT … FOR UPDATE`) and refuses if the link
is paid, cancelled or expired. Two tabs can still both reach the hosted page inside one 15-minute
window; if both approve, the second is recorded as `duplicate` and must be refunded in the Converge UI.
Loud, never silent.

## 5. Security and correctness rules (industry baseline)

1. **Amount comes from the database, never the browser.** The session token request is built from the
   attempt row.
2. **Return redirects are untrusted.** Every outcome is confirmed by a server-side `TXNQUERY`, checking
   `ssl_txn_id`, `ssl_invoice_number`, amount and result before any state change.
3. **Idempotency:** the builder carries a per-render `idempotency_key`; the return handler is a no-op on
   an already-verified txn id (unique index).
4. **Credentials:** `CONVERGE_PIN` and the proxy URL are Vercel **Sensitive** env vars, server-only,
   never logged. Converge's sample code disables TLS verification — **we never do**.
5. **Redaction:** gateway payloads are whitelisted into `payment_events.data`; `ssl_pin` and any card
   number beyond last four are dropped.
6. **Timeouts:** 60 s on gateway calls (Elavon recommends 60–120 s); a timeout marks the attempt
   `failed` only if no session was issued — otherwise it stays `pending` for the reconcile.
7. **Refunds and voids are out of scope** and done in the Converge UI. The admin is behind a stub gate
   (D91), so it must never be able to move money out.

## 6. Static outbound IP (Converge requires it)

Converge only accepts session-token requests from allowlisted IPs, and Vercel functions egress from
changing IPs. Vercel Static IPs need Pro and cost $100/month per project, so we send **only the Converge
calls** through **Fixie** (HTTPS `CONNECT` tunnel — TLS is end-to-end, the proxy cannot read the PIN).

**Fixie free tier limits** ([pricing](https://usefixie.com/pricing)):
- **500 requests / month, 100 MB transfer.**
- At 75% Fixie emails a warning; **at 100% requests fail with HTTP 407** until the month rolls over or
  the plan is upgraded ([docs](https://usefixie.com/documentation/)).
- Budget: ~3 requests per payment attempt (session token + verification query + possible reconcile
  share) ⇒ roughly **150 attempts / month** on the free tier. Next tier is $5/month for 2,500.
- Fixie's IPs must be sent to Elavon for the account's Merchant IP Filter (the demo email asks for
  exactly this). Local development uses the same proxy, so one allowlist covers dev, preview and prod.
- A 407 from the proxy is surfaced to the customer as "payments are temporarily unavailable, call us",
  never as a card decline.

## 7. Environment variables

| Name | Where | Sensitive | Notes |
|---|---|---|---|
| `DATABASE_URL` | Vercel (Neon integration) | yes | pooled; app runtime |
| `DATABASE_URL_UNPOOLED` | Vercel (Neon integration) | yes | migrations only |
| `CONVERGE_ENV` | Vercel | no | `demo` \| `production`; picks `api.demo.convergepay.com` vs `api.convergepay.com` |
| `CONVERGE_ACCOUNT_ID` | Vercel | no | `ssl_account_id` (formerly `ssl_merchant_id`) |
| `CONVERGE_USER_ID` | Vercel | no | the **API user**, not the web login |
| `CONVERGE_PIN` | Vercel | **yes** | never in the repo, a log, or a chat |
| `FIXIE_URL` | Vercel | **yes** | `http://fixie:<secret>@<host>:80` |
| `CRON_SECRET` | Vercel | **yes** | authenticates the daily reconcile |

Local development uses a **Neon `dev` branch** URL in `.env.local` (gitignored), never production.

## 8. Open items

1. **Rotate the demo `ssl_pin`.** It was pasted into a chat on 2026-09-23 together with the account ID
   and API user; the web password was changed, the PIN was not. Demo-only, but the habit matters —
   production credentials must never travel that way. Owner.
2. **Sign up for Fixie** (free) and send its two IPs to Elavon to add to the Merchant IP Filter. Owner.
3. **Demo expiry 2026-10-18** — extension request due by 2026-10-13. Owner, via client.
4. **Converge vendor ID and certification test script** — Elavon supplies both before go-live. Client.
5. **Confirm with Elavon** that TXNQUERY is not IP-filtered separately, and the HPP return field set
   (`ssl_receipt_link_method=REDG`). Verified on first demo call.
6. **Expiry field** amends D92: the owner chose *"Add an expiry field"* (2026-09-23). The admin form
   change is in the parallel admin session's area — coordinate before editing `src/features/admin/`.

## 9. Proposed decision rows (numbered at merge)

- **PSP = Converge (Elavon, via Costco Payment Processing), Hosted Payment Page.** Owner: client chose
  Costco; Elavon issued a Converge demo account 2026-09-18. Supersedes D92's "provider-agnostic" rule
  for gateway code only — the admin form still names no gateway.
- **The payment link is ours, not the gateway's** (§2): Converge has no link-creation API.
- **ORM = Drizzle + node-postgres on Neon.** Owner chose *"Drizzle (Recommended)"* (2026-09-23) after
  comparing: SQL-fluent team; constraints, partial unique indexes and row locks are first-class.
- **Static egress via Fixie free tier.** Owner: *"go with your recommendation with whatever free option
  is available"* (2026-09-23).
- **Payment links carry an expiry chosen by staff.** Owner chose *"Add an expiry field"* (2026-09-23),
  amending D92.
