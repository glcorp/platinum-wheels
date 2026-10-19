# Payments — design and runbook (Stripe Checkout)

Status, 2026-10-20: **built on branch `stripe-payments` (D191), not yet merged or deployed.** The client dropped
Converge (Costco / Elavon) for **Stripe**; the Converge demo expired 2026-10-18 and its code is gone. The fixture
runs the whole flow against a stand-in written from the docs, but **nothing has run against Stripe's real API
yet: the sandbox checks in §9 are the first real test.** Not live: payments stay in a Stripe **sandbox** until the
go-live checklist (§11) is ticked.

Everything before the switch (Converge, Fixie, the export script, D99-D108, D119, D125b, D145/D146) is history in
`HANDOFF.md` and root `llm.md` §5b; D191 supersedes the gateway-specific parts. The plan and the verified Stripe
facts behind this build are `STRIPE-MIGRATION-PLAN.md` and `STRIPE-DOCS-DIGEST.md`, kept beside the repo in
`~/lancing/platinumwheels/`.

---

## 1. The shape of the integration

The link is ours (staff create `pay.platinumwheels.ca/pay/<token>`); **Stripe hosts the card page**.

```
staff ──(admin builder: amount incl. HST, description, expiry)──▶ payment_links row   (minimum C$0.50)
customer opens /pay/<token>   ── amount + description + Pay ──
Pay ─▶ startAttempt: lock the link FOR UPDATE
         latest attempt pending with a session? ─▶ re-read it from Stripe:
              open     ─▶ redirect to the SAME Stripe page (never a second one)
              complete ─▶ settle it; the link is paid
              expired  ─▶ mark expired, start a fresh attempt
         else insert pending attempt PW10001N2 (its session lives 60 min), commit
       ─▶ stripe.checkout.sessions.create(...)   built from the attempt row, idempotency key pw-<attemptId>
       ─▶ store the session id ─▶ redirect(session.url)   (a 303; the card is entered on stripe.com)
Stripe ─▶ POST /pay/webhook (signed) ─▶ re-read the session ─▶ applyTransaction ─▶ link paid ─▶ email the shop
browser ─▶ /pay/<token>?paid=1       ─▶ the page settles its OWN stored session (throttled, capped), shows Paid
staff   ─▶ admin list ─▶ [Check payment] on a pending row ─▶ the same settle
```

The database is the source of truth for whether a link is open. **Stripe is the source of truth for whether money
moved**, and it is always asked (the session is re-read), never believed from a webhook body, a URL or the browser.

D108 (the Converge-era "nothing looks it up later") is **reversed**: its reason was Fixie's 500-request quota. There
is still no cron.

## 2. Data model (`src/db/schema.ts`, migrations in `drizzle/`, newest `0007_stripe_checkout`)

| Table | One row per | Key guarantees (enforced by Postgres) |
|---|---|---|
| `payment_links` | link staff create | integer cents > 0 · currency CAD · description 1-200 chars · `expires_at > created_at` · `status='paid' ⇔ paid_at` · `status='cancelled' ⇔ cancelled_at` · unique `reference`, `public_token`, `idempotency_key` |
| `payment_attempts` | trip to Stripe's page | **at most one `approved` per link** · unique `(provider, provider_txn_id)` (the PaymentIntent id) · unique `provider_session_id` (the Checkout Session id) · unique invoice number · approved/duplicate ⇒ txn id and `verified_at` |
| `payment_events` | state change | **append-only** (a trigger rejects UPDATE/DELETE/TRUNCATE) · dotted `type`, letters and underscores only |
| `stripe_events` | webhook delivery accepted | the event id is the key (a redelivery is recognised); `type`, object id, `outcome`, and a refund/dispute `detail`. Feeds the admin flag and the "Last Stripe event" line. Never changes a link. Never holds card or customer data |

- **Expired is derived**: `status='active' AND expires_at <= now()`. An attempt's Stripe session is separate: the
  attempt ends `expired` when its session times out or when we close it.
- **Attempt status:** `pending → approved | expired | duplicate`, or `failed` if no session was issued. `declined`
  exists only on Converge rows (Stripe retries a declined card on its own page, so a decline never reaches us).
- **References:** `PW-10001` from a sequence; the attempt's `PW10001N2` is sent as `client_reference_id` and is the
  match key. Search it, or the `pi_…` id, in the Stripe Dashboard.
- **Environment:** a `sk_test_` key records attempts as `demo`, a live key as `production` (the existing enum).
- **Race rule:** creating an attempt locks the link row and refuses a paid, cancelled or expired link. An open
  session is reused, so two taps or two tabs reach one Stripe page. When one attempt is paid, the link's other open
  sessions are expired. If a second payment still lands (a page expired a moment too late) it is recorded as
  `duplicate` and the shop gets a "Refund needed" email.
- **Links are never deleted.** Cancel instead; cancelling closes any open Stripe page (after the commit, never under
  the lock, never failing the cancel).
- **No card data**: brand and last four only. Redirecting to Stripe's hosted page keeps the shop at **SAQ A**.

## 3. Verification: the only path to `approved`

`toGatewayTransaction` (`stripe.ts`) marks a session `approved` only when **all** hold, otherwise `other` (recorded
for staff, never marks anything paid):

- `status === "complete"` and `payment_status === "paid"` (`complete` alone is not proof);
- currency `cad`;
- the session's `livemode` equals the key's;
- `amount_total === amount_subtotal` (no tax, discount or shipping crept in);
- a PaymentIntent id exists.

Then `applyTransaction` also requires `client_reference_id === attempt.provider_invoice_number` and
`amount_total === attempt.amount_cents`. A replay (same PaymentIntent, already verified) is `unchanged`.

## 4. The webhook (`POST /pay/webhook`)

- **URL:** `https://pay.platinumwheels.ca/pay/webhook`, **no trailing slash** (a redirect is a failed delivery). In
  production only the `pay.` host serves `/pay/*`. `pay.` must stay a DNS-only Cloudflare CNAME (never the orange
  cloud) and is exempt from Vercel SSO protection. Preview URLs return 401 to Stripe, so previews rely on the page
  settle and Check payment.
- **Handler rules:** the body is read once as text; `constructEvent` with the default tolerance (never 0); 400 only
  for a bad or missing signature; 200 for a valid event that matches nothing (the client's account may hold other
  sales) and for an event of the other `livemode`; 500 only for our own failure (database, Stripe unreachable, not
  configured) so Stripe retries; the email is sent after the response so the acknowledgement is fast (Checkout
  waits up to 10 s). `STRIPE_WEBHOOK_SECRET_PREVIOUS` is honoured while a rolled secret overlaps.
- **Events (snapshot payload, API version `2026-09-30.endive`):** `checkout.session.completed`,
  `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
  (the async pair is inert with cards only) and, **notify only**, `charge.refunded`, `charge.dispute.created`,
  `charge.dispute.closed`. A refund or dispute emails the shop once, writes an audit event and flags the admin row.
  It **never** changes `payment_links.status`: a refunded link stays Paid.
- **An unrecorded session** (we created it but crashed before saving its id) is bound by its `client_reference_id`,
  so a payment on it is never lost.
- **Never logged:** the body, secrets, session URLs, customer details. Logged: event id, type, outcome.
- **Post-deploy gate:** `curl -X POST https://pay.platinumwheels.ca/pay/webhook -d x` returns **400** (not
  404/401/308/403/429), and a Dashboard "Resend" of a real event shows 200.

## 5. Security and correctness rules

1. **Amount, description and reference come from the database**, never the browser.
2. **Nothing the browser or a webhook body says changes state.** A session id is only a pointer; the session is
   re-read from Stripe and must pass §3 first.
3. **The page settles its own stored session**, not one named in the URL (`?paid=1` only says "look now").
   Page-driven Stripe reads are throttled (2 s after a return, 30 s otherwise) and capped at 30 per attempt; the
   webhook and staff are not capped.
4. **Environment guards (`config.ts`):** a malformed key, `REPLACE_ME`, a **live key outside Vercel production** and
   a test key when `STRIPE_REQUIRE_LIVE=1` are all refused. A live key can never run on a Preview or a laptop, and
   the shop cannot silently stay on the sandbox after launch.
5. **Cards only** (`allowed_payment_method_types: ["card"]`; Apple Pay and Google Pay are cards): no Link, no
   buy-now-pay-later, no delayed debit can appear on a C$1,000+ payment with no tested path.
6. **Fraud signals:** billing address required, phone collected, 3-D Secure requested on every card
   (`request_three_d_secure: "any"`). These parameters are unverified against the real API (§9 item 1): a 400 in the
   sandbox means drop the offending one; none is load-bearing.
7. **No refunds, voids or any money-out operation here.** Refunds and dispute responses are done in the Stripe
   Dashboard. The admin is a shared login (D91), so it must never be able to move money out.
8. **Who paid** (name, email, phone, billing postal code) goes from the retrieved session into the shop's email
   only. It is not stored and never logged.
9. Secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) are Vercel **Sensitive**, server-only, never logged,
   never pasted in a chat. **The user pastes them into Vercel; Claude does not.**

## 6. Environment variables

| Name | Production | Preview | Local / fixture | Notes |
|---|---|---|---|---|
| `STRIPE_SECRET_KEY` (Sensitive) | sandbox `sk_test_` until go-live, then a live **restricted** key `rk_live_` | sandbox only (the code refuses live) | `.env.local` | the restricted key needs Checkout Sessions: write, PaymentIntents: read, Charges: read (verify in the sandbox first, watch the request log for 403s) |
| `STRIPE_WEBHOOK_SECRET` (Sensitive) | the **production** event destination's `whsec_` for that mode | none | the `whsec_` that `stripe listen` prints | must belong to the same mode as the key; paste with no newline, quotes or spaces |
| `STRIPE_WEBHOOK_SECRET_PREVIOUS` | only while a rolled secret overlaps | | | up to 24 h |
| `STRIPE_REQUIRE_LIVE` | unset now; **`1` at go-live** | unset | unset | refuses a test key |
| `PAYMENTS_ENABLED` | unset (on); `0`, `false` or `off` turns payments off | | | the kill switch (§8) |
| `STRIPE_STATEMENT_SUFFIX` | unset; `1` once the account has a shortened statement-descriptor prefix | | | appends the link reference to the card statement; off by default because a wrong account setting would reject every session |
| `STRIPE_API_HOST`, `STRIPE_API_PORT` | ignored | ignored | the fixture's stand-in | honoured only with a **test** key outside production |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `RESEND_API_KEY`, `LEAD_CAPTURE_EMAIL` | as before | | | unchanged |

**Remove at cutover:** `CONVERGE_ENV`, `CONVERGE_ACCOUNT_ID`, `CONVERGE_USER_ID`, `CONVERGE_PIN`,
`CONVERGE_SEND_INVOICE`, `FIXIE_URL`, and uninstall the **Fixie** integration (Dashboard only). Removing them
earlier only changes an already-dead error message. `undici` is gone from `package.json` (only the Converge adapter
used it).

Migrations run in the build (`scripts/db-migrate.mjs`): the production build migrates Neon main, so `0007` runs
before any code writes `provider='stripe'`.

## 7. Stripe Dashboard setup (the client's account)

The account owner is the client (Platinum Wheels and Tire Solutions Inc.); the developer is invited as a
**Developer**-role team member with 2FA, never given the owner login. Never paste a key into a chat.

1. Confirm the account is **Canada / CAD**.
2. Create a **general sandbox** (account picker → Sandboxes → Create), e.g. `PW dev`. Not the legacy "test mode"
   (it shares some settings with live).
3. Copy the sandbox **Secret key** (`sk_test_…`) from Workbench → API keys into Vercel (Production and, if wanted,
   Preview). No publishable key is needed.
4. Payment methods: Cards on, everything else off (the code also forces cards).
5. Branding (logo, colour) and the statement descriptor (e.g. `PLATINUM WHEELS`); a shortened prefix of 2-10
   characters if `STRIPE_STATEMENT_SUFFIX=1` is wanted. Sandbox settings do not carry to live: redo them.
6. Customer emails: turn on emails for **successful payments** (live only; sandboxes send none).
7. Event destination (after deploy): Workbench → Webhooks → Create an event destination → **Your account**,
   **Snapshot**, API version `2026-09-30.endive`, the seven events in §4, type **Webhook endpoint**, the URL in §4.
   Paste its `whsec_` into Vercel and redeploy. Each mode (sandbox, live) has its own destination and secret.
8. Notifications: email alerts to a **shared** owner inbox for disputes, failed payouts, refunds and webhook
   failures. Radar: default rules on (confirm; no paid add-on is assumed).
9. Interac Debit online is wallet-based and enabled by emailing Stripe; ask whether it can appear on hosted Checkout.

Test cards (any future expiry, any CVC): success `4242 4242 4242 4242`; decline `4000 0000 0000 0002`; 3-D Secure
`4000 0025 0000 3155`; dispute `4000 0000 0000 0259`.

## 8. Operations runbook

- **"I paid but it shows unpaid":** admin links list → **Check payment** on that row (it asks Stripe now) → if it
  still says open, search the reference (`PW-10001`) in the Stripe Dashboard → if Stripe shows a successful payment,
  resend the `checkout.session.completed` event to the destination (Dashboard up to 15 days, CLI 30).
- **"Last Stripe event" warning** (a payment confirmed after the newest webhook): the webhook is not reaching us or
  its secret is wrong. Check Dashboard → Webhooks → Event deliveries, and the mode of `STRIPE_WEBHOOK_SECRET`.
- **Double payment (`duplicate`):** the shop email says "Refund needed"; refund it in the Dashboard.
- **Refund:** in the Dashboard. The shop gets an email; the link stays Paid and shows a "Refunded" flag.
- **Dispute:** the email carries the deadline (`evidence_details.due_by`); respond in the Dashboard with the quote,
  the payment link, the customer's messages and the pickup or installation record.
- **Turn payments off:** set `PAYMENTS_ENABLED=0` and redeploy. The pay page shows "call to pay", no session is
  created, and the webhook still settles payments already in flight. There is no second gateway; the only other
  rollback is redeploying the previous build.
- **Roll the webhook secret:** roll in the Dashboard with an overlap, put the new one in `STRIPE_WEBHOOK_SECRET` and
  the old in `STRIPE_WEBHOOK_SECRET_PREVIOUS`, redeploy, remove the old one after 24 h.
- **Roll the API key:** create the new key, update Vercel, redeploy; the old key works for up to 7 more days.
- **Hosting:** real payments on the Hobby plan breach Vercel's non-commercial terms, and only `glcorp`-authored
  commits deploy (`HANDOFF.md` §7), so a payment hotfix may not be deployable by the developer. **Upgrade to Pro
  before go-live** (§11).
- **Deposit and balance** (special-order tires) are two payment links, each with its own reference.
- **Taxes:** staff type the **final amount including HST**. Stripe's receipt is not an HST invoice: the shop keeps
  issuing its own quote or invoice with the HST number. Description convention:
  `Quote <ref>: 4 x 225/45R17 Brand, installed, incl. HST`. Check the rest with the owner or accountant.
- **Monthly reconciliation:** Stripe payments vs Paid links (count and sum); payouts vs bank deposits; any `pending`
  attempt older than 24 h; refunds and disputes flagged in the list.
- **Retention:** never purge `payment_*` rows or `stripe_events` (the retention period is the owner's accountant's
  call; assume six years).

## 9. Sandbox checks (the first real test; none has run yet)

Run under `stripe listen --forward-to localhost:3000/pay/webhook` (local) or against the production sandbox
destination:

1. **What the fixture cannot prove:** `billing_address_collection: "required"`, `phone_number_collection`,
   `payment_method_options.card.request_three_d_secure: "any"` and `allowed_payment_method_types: ["card"]` are
   accepted by `2026-09-30.endive`; `session.url` is returned when an open session is **retrieved** (if not, the
   code expires it and creates a new one).
2. Success, a Canadian Visa, a decline (stays on Stripe's page, no state change), insufficient funds, 3-D Secure
   pass and fail.
3. **Back from Stripe on a real iPhone Safari and Android Chrome:** no auto-bounce, the Pay button is live.
   Fallback if it misbehaves: a plain form to a route handler that returns a 303.
4. Pay, then close the tab before the receipt (the webhook alone settles it).
5. `stripe.checkout.sessions.expire` then Pay again; Pay twice and in two tabs (same page); cancel a link with a
   page open (the page is expired after the commit; a late payment becomes `duplicate` with a refund email).
6. Replay an event (idempotent); a tampered signature (400); a live key in a Preview-scope env (refused); the wrong
   webhook secret (400, logged, Check payment still settles).
7. A slow Resend (the webhook still answers in under 10 s); an amount under C$0.50 is refused in the builder.
8. A Dashboard refund and a dispute (`4000 0000 0000 0259`): the shop email and the admin flag, link status
   unchanged; the shop email names the payer.
9. `PAYMENTS_ENABLED=0` shows "call to pay" and creates no session.
10. The restricted key: no 403s in Workbench's request log for the calls above.

## 10. Cutover

1. **Pre-cutover row audit** (production Neon): `payment_links` by status and `payment_attempts` by
   provider/status/environment. Expect every Converge row `demo`. Decide per open link: cancel (the customer gets a
   fresh Stripe link) or leave (the link is provider-independent). Record the counts in `HANDOFF.md`.
2. PR merged by `glcorp`; the production build runs `0007`.
3. Paste `STRIPE_SECRET_KEY` (sandbox) and `STRIPE_WEBHOOK_SECRET` into Vercel; remove the Converge and Fixie vars.
4. Create the production event destination (§7 step 7); run the post-deploy curl gate (§4).
5. One sandbox payment on `pay.platinumwheels.ca` end to end.

Until then the pay page shows "call to pay" whenever Stripe is not configured, so a customer never meets a button
that cannot work.

## 11. Go-live gate (all ticked before real payments)

- [ ] Stripe live account: charges and payouts enabled, bank verified. **Start activation now: it is the long pole**
      (KYC, bank verification, first payout 7-14 days). The client submits it; Claude never enters identity or bank
      details.
- [ ] The owner has read the fee (about 2.9% + C$0.30 domestic, 0.8% extra international), payout-timing and dispute
      notes. Do not add a card surcharge without legal review.
- [ ] Vercel on **Pro**; the developer's account can deploy (§8).
- [ ] **Privacy, terms and a refund/return policy published**, and the pay page links to the policy. Today `privacy`
      and `terms` say no payment is taken, which becomes false at go-live: name Stripe as the processor, say card
      data goes to Stripe and not to us, say Stripe may process data outside Canada, and fix the "no payment"
      sentences. The owner writes the policy; Ontario consumer-protection wording needs the owner's or a lawyer's
      confirmation.
- [ ] Live **restricted** key verified in the sandbox with no 403s, stored as Sensitive.
- [ ] Live event destination with all seven events; the curl gate returns 400; a real event resend shows 200.
- [ ] `STRIPE_REQUIRE_LIVE=1`; `PAYMENTS_ENABLED` tested on and off.
- [ ] Owner dispute / refund / payout / webhook emails confirmed arriving.
- [ ] Runbook (§8) walked through with the owner.
- [ ] One real C$0.50+ payment, the receipt received, a Dashboard refund, the `refunded` email received, and a payout
      to the bank confirmed.

## 12. Stripe facts the build relies on (docs read 2026-10-19; see `STRIPE-DOCS-DIGEST.md`)

- `stripe@23.0.0`, API `2026-09-30.endive`, Node ≥ 20, pinned in code. `payment_method_types` was **removed** in
  this version (400); `ui_mode` is not passed (the default is the hosted page).
- `expires_at` must be 30 minutes to 24 hours after creation; we use 60 minutes. The idempotency layer rejects a
  retry whose params differ, so `expires_at` comes from the stored attempt row.
- Minimum charge C$0.50 (`AMOUNT_MIN` in the builder).
- `status: "complete"` is not proof of payment; require `payment_status: "paid"`.
- Metadata on the Session does not copy to the PaymentIntent, so it is set on both.
- Webhooks are retried for up to three days in live mode; ordering is not guaranteed; duplicates happen.
- A dispute costs the order amount plus a C$15 fee and has a response deadline.

## 13. What the fixture proves, and what it cannot

`tests/e2e/pay-stripe.spec.ts` runs the whole app against `tests/fixture/stripe-fake.mjs`: JS-off Pay → a 303 to
Stripe's page with no form body; pressing Pay twice reuses one session; a signed webhook settles once and a replay
changes nothing; a refund notice flags the row; a return with no webhook shows Paid; cancelling expires the open page.
It cannot prove Stripe's real wire format, the hosted page, Back on a phone, or the production host rules.
