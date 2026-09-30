# Payments — design (Converge, via Costco / Elavon)

Status: **built 2026-09-24 on branch `payments`**: the Converge adapter, `/pay`, the return route, the
reconcile cron and the admin wiring (expiry field, links list). It has been tested against Postgres with a
fake gateway, not yet against Converge: that waits on the owner actions in `todo.md`, chiefly Elavon
allowlisting the Fixie IPs. The schema and migrations have been on `main` and production Neon since
2026-09-24 (PR #5). Decisions: **D99–D103** and **D105–D107** in root `llm.md` §5b (§9).

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
                                                         public URL: pay.platinumwheels.ca/pay/<token>  (D105)
customer opens /pay/<token>   ── page shows amount + description + Pay ──
customer presses Pay ─▶ server: lock link FOR UPDATE, check payable,
                          insert payment_attempts row (pending, invoice PW-10001-n),
                          POST Converge /hosted-payments/transaction_token  (via static-IP proxy)
                        ─▶ browser POSTs ssl_txn_auth_token to the Converge Hosted Payment Page
                           (card entered there)
Converge ─▶ browser sent to /pay/return (GET or POST, ssl_txn_id …)       (UNTRUSTED)
            one URL for every link: it is an account setting in the Converge portal (§10)
server: TXNQUERY by ssl_txn_id (via proxy) ─▶ find the attempt by the gateway's invoice number,
        verify amount + result ─▶ attempt approved/declined; link paid (or 'duplicate')
        ─▶ 303 to /pay/<token>
daily cron: TXNQUERY by ssl_invoice_number for every still-pending attempt (no date range, so no
            terminal-time-zone ambiguity); no transaction after the session died ⇒ 'expired'
staff "Check payment": the same lookup for one link, on demand
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

Connected 2026-09-24: the Vercel Neon integration (prefix `DATABASE`, Sensitive, Production + Preview,
branch per preview deployment, no branch per production deployment) created `DATABASE_URL` and
`DATABASE_URL_UNPOOLED` plus unused `DATABASE_PG*` / `DATABASE_POSTGRES_*` aliases. Because Sensitive
values cannot be pulled, **migrations run in the build** (`scripts/db-migrate.mjs`): a preview build
migrates its own Neon branch, the production build migrates main.

## 8. Open items

The owner's step-by-step actions are in root `todo.md`. In summary:

1. **Rotate the demo `ssl_pin`** (pasted into a chat on 2026-09-23). Owner.
2. **Fixie**: sign up (free) and email its two IPs to `sedevportalsupport@elavon.com` for the **demo**
   account's Online Security Allowed List. The portal's Allowed List Manager is view-only; production IPs
   are added by phone, 1-800-377-3962 (§10). **Nothing works until this is done.** Owner.
3. **Converge portal → Settings → Hosted Payments**: set the Response Page **Redirect URL**, the Decline
   button link and the Payment Page **Cancel Link** to `https://pay.platinumwheels.ca/pay/return` (a
   preview or local URL while testing). Owner.
4. **`pay.platinumwheels.ca`**: a DNS-only Cloudflare CNAME to Vercel, and the domain added to the Vercel
   project (D105). Owner.
5. **Vercel env vars** from §7. Owner.
6. **Demo expiry 2026-10-18**: extension request due by **2026-10-13**. Owner, via client.
7. **Going live**: production credentials, Converge vendor ID and Elavon's certification test script.
   Every portal setting in item 3 must be redone on the production account. Client.
8. The UNCONFIRMED items in §10, each settled by the first demo call.

## 9. Decision rows, numbered D99–D103 at the 2026-09-24 merge (D105–D107 added with the build)

The canonical text is in root `llm.md` §5b. In order: **D99** PSP = Converge HPP · **D100** the link is
ours · **D101** Drizzle + node-postgres · **D102** Fixie · **D103** staff-chosen expiry. The original
proposals follow.

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

## 10. Converge facts the build relies on (researched 2026-09-24, D107)

Elavon's Converge docs now live under `developer.elavon.com/products/hosted-payment-page/v1/*` and
`/products/xml-api/v1/*`. The older `/products/converge/v1/hosted-payments` URL returns 404.

| Fact | Source | Where it lands |
|---|---|---|
| Token: `POST https://api(.demo).convergepay.com/hosted-payments/transaction_token`, form-encoded; the body is the raw token; valid 15 min, single use; 403 = IP not allowlisted | [HPP overview](https://developer.elavon.com/products/hosted-payment-page/v1/overview), [API reference](https://developer.elavon.com/products/hosted-payment-page/v1/api-reference) | `converge.ts` `createSession` |
| Hand-off: the browser POSTs `ssl_txn_auth_token` to `…/hosted-payments/` | [take a payment](https://developer.elavon.com/products/hosted-payment-page/v1/take-a-payment) | `pay-button.tsx` |
| **The IP allowed list is mandatory for tokens; only Elavon can edit it** (demo: `sedevportalsupport@elavon.com`; production: 1-800-377-3962) | [Manage IP Address](https://support.convergepay.com/s/article/Whitelist-an-IP-Address), HPP overview | D102, `todo.md` |
| **Return, decline and cancel URLs are portal settings** (Hosted Payments → Payment Page / Response Page), not token fields | [Customize the HPP](https://support.convergepay.com/s/article/Customize-the-Hosted-Payments-Page) | `/pay/return`, `todo.md` |
| No currency field: `ssl_transaction_currency` is for multi-currency terminals and errors 5087 otherwise; the default is the terminal's (CAD) | [input fields](https://developer.elavon.com/products/xml-api/v1/supported-transaction-input-fields), [error codes](https://developer.elavon.com/products/xml-api/v1/error-codes) | `converge.ts` |
| `ssl_invoice_number` ≤ 25 chars | API reference | `PW-10001-2` fits |
| `txnquery`: `POST …/VirtualMerchant(Demo)/processxml.do`, `xmldata=<txn>…</txn>`; search by `ssl_txn_id` or `ssl_invoice_number`; several results come in `<txnlist>`; errors are `errorCode`/`errorMessage`; `ssl_trans_status` PST/FPR/PRE = failed rules | [transaction management](https://developer.elavon.com/products/hosted-payment-page/v1/transaction-management) | `converge.ts` `query` |
| Approval is read from `ssl_result_message` (`APPROVAL`): the txnquery examples omit `ssl_result` | same | `toGatewayTransaction` |
| 5 wrong PINs put the calling IP on a fraud list | [Cartis FAQ](https://knowledge.cartispayments.com/hc/en-us/articles/4407890739351-Common-Integration-Questions-and-Answers-General-and-Converge) | `payments/llm.md` Rules |
| Demo test cards approve at `$X.00`; `$X.88` declines. Visa `4000000000000002`, Mastercard `5121212121212124` | [test cards](https://developer.elavon.com/test-cards) | the demo walkthrough |

**UNCONFIRMED; the first demo call settles each one:** that `ssl_merchant_id` is still accepted (it is what
Elavon's PHP sample and working integrations send; the docs say `ssl_account_id`); that `ssl_description` is
accepted on the token call; whether the return arrives as GET or POST (both are handled); and whether a
single-id `txnquery` is wrapped in `<txnlist>` (both are parsed). Elavon's own sample disables TLS
verification; we never do (§5.4).
