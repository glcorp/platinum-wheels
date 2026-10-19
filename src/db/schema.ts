/* ---------------------------------------------------------------------------
   Database schema — payments (Drizzle, Postgres on Neon).

   Three tables, one job each:

     payment_links     What staff create: an amount, a description, an
                       expiry. The thing the customer's URL points at.
     payment_attempts  One row per trip to the gateway's hosted payment
                       page. A link can have several (a decline, then a
                       retry); at most one of them may ever be approved.
     payment_events    Append-only audit log of everything that happened to
                       a link — who created it, every gateway response,
                       every state change. Never updated, never deleted.

   Why the link lives here and not at the gateway: Converge has no API for
   creating payment links (see `docs/payments.md` §2). The URL we hand the
   customer is ours — `/pay/<public_token>` — and only when they press Pay do
   we ask Converge for a one-time, 15-minute hosted-payment session. So this
   database, not the gateway, is the source of truth for whether a link is
   open, paid, cancelled or expired.

   Money rules, enforced here so no code path can get them wrong:
     - amounts are INTEGER CENTS, never floats or numeric strings;
     - currency is pinned to CAD by a CHECK, not by convention;
     - the partial unique index `payment_attempts_one_approved_per_link`
       makes a second approved payment on one link unrecordable — the
       application has to file it as `duplicate` (a refund to issue), which
       is the whole point: a double charge must be loud, never silent.

   Card data: nothing here is in PCI scope. The hosted payment page collects
   the card; we only ever store the brand and last four digits the gateway
   returns, which PCI DSS explicitly permits.
   --------------------------------------------------------------------------- */

import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ===========================================================================
   Enums
   =========================================================================== */

/**
 * Stored link states. **`expired` is deliberately not one of them**: expiry is
 * derived at read time as `status = 'active' AND expires_at <= now()`. Storing
 * it would need a job to flip rows at the right moment, and there is none
 * (D108). Derived, it is exact.
 */
export const paymentLinkStatus = pgEnum("payment_link_status", [
  "active",
  "paid",
  "cancelled",
]);

/**
 * Attempt lifecycle.
 *
 *   pending    Checkout Session issued; the customer is (or was) on Stripe's
 *              page. Resolved by the webhook, the pay page, or staff's Check
 *              payment.
 *   approved   Verified paid by re-reading the session from Stripe. At most
 *              one per link (partial unique index below).
 *   declined   Converge only. Stripe retries a declined card on its own page,
 *              so a Stripe attempt never ends here.
 *   failed     We never got a usable session (Stripe error, timeout,
 *              misconfiguration). No money moved.
 *   expired    The Stripe session ended unpaid (timed out, or closed by us
 *              because another attempt was paid or the link was cancelled).
 *   duplicate  Verified paid, but the link was already paid or cancelled.
 *              Money moved twice: staff must refund this one in the Dashboard.
 */
export const paymentAttemptStatus = pgEnum("payment_attempt_status", [
  "pending",
  "approved",
  "declined",
  "failed",
  "expired",
  "duplicate",
]);

/** Gateway identity. `converge` rows are history (the Elavon demo, switched
 *  off 2026-10); new attempts are `stripe`. An enum so a gateway is a
 *  migration, not a free-text typo. */
export const paymentProvider = pgEnum("payment_provider", ["converge", "stripe"]);

/** Which gateway environment an attempt ran against. Recorded per attempt so
 *  demo transactions can never be mistaken for real money in a report. For
 *  Stripe, `demo` is a sandbox key (`sk_test_`) and `production` a live key. */
export const paymentEnvironment = pgEnum("payment_environment", [
  "demo",
  "production",
]);

/** Who caused an event. `staff` is the shared admin credential today (D91);
 *  `created_by` columns hold the identity once real auth lands. */
export const paymentEventActor = pgEnum("payment_event_actor", [
  "staff",
  "customer",
  "system",
  "provider",
]);

/* ===========================================================================
   Sequences
   =========================================================================== */

/**
 * Feeds the human reference `PW-10001`, `PW-10002`, … Staff read it to a
 * customer on the phone, and it prefixes the invoice number Converge prints on
 * the cardholder's statement. Starts at 10001 so every reference has the same
 * width for a long while. Gaps are fine (a rolled-back insert burns a value);
 * uniqueness is what matters, and the unique index guarantees it.
 */
export const paymentLinkReferenceSeq = pgSequence("payment_link_reference_seq", {
  startWith: 10001,
  increment: 1,
});

/* ===========================================================================
   payment_links
   =========================================================================== */

export const paymentLinks = pgTable(
  "payment_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** `PW-10001`. Generated by the database, never typed. */
    reference: text("reference")
      .notNull()
      .default(sql`('PW-' || nextval('payment_link_reference_seq'))`),

    /**
     * The secret in the customer's URL, `/pay/<public_token>`: 128 random bits,
     * base64url. It is a capability, not a password — it lets the holder pay
     * this one amount, nothing else — so it is stored as-is, because staff
     * must be able to copy the link again from the admin later. It is never
     * sequential and never derived from `id` or `reference`.
     */
    publicToken: text("public_token").notNull(),

    /**
     * Client-generated key from the builder form, so a double-tapped submit
     * or a retried Server Action returns the first link instead of minting a
     * second one for the same job.
     */
    idempotencyKey: uuid("idempotency_key").notNull(),

    amountCents: integer("amount_cents").notNull(),
    currency: char("currency", { length: 3 }).notNull().default("CAD"),
    description: text("description").notNull(),

    status: paymentLinkStatus("status").notNull().default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Shared admin credential today (D91), so this reads `admin` for every
     *  row until per-user auth exists. Kept so the column is already there. */
    createdBy: text("created_by").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),

    paidAt: timestamp("paid_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: text("cancelled_by"),
  },
  (t) => [
    uniqueIndex("payment_links_reference_key").on(t.reference),
    uniqueIndex("payment_links_public_token_key").on(t.publicToken),
    uniqueIndex("payment_links_idempotency_key_key").on(t.idempotencyKey),
    // The admin list: newest first, filtered by state.
    index("payment_links_status_created_at_idx").on(t.status, t.createdAt),

    check("payment_links_amount_positive", sql`${t.amountCents} > 0`),
    check("payment_links_currency_cad", sql`${t.currency} = 'CAD'`),
    check(
      "payment_links_description_length",
      sql`char_length(${t.description}) between 1 and 200`,
    ),
    check(
      "payment_links_token_length",
      sql`char_length(${t.publicToken}) >= 22`,
    ),
    check(
      "payment_links_expires_after_created",
      sql`${t.expiresAt} > ${t.createdAt}`,
    ),
    // State and timestamp can never disagree.
    check(
      "payment_links_paid_state",
      sql`(${t.status} = 'paid') = (${t.paidAt} is not null)`,
    ),
    check(
      "payment_links_cancelled_state",
      sql`(${t.status} = 'cancelled') = (${t.cancelledAt} is not null)`,
    ),
  ],
);

/* ===========================================================================
   payment_attempts
   =========================================================================== */

export const paymentAttempts = pgTable(
  "payment_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    linkId: uuid("link_id")
      .notNull()
      .references(() => paymentLinks.id, { onDelete: "restrict" }),

    /** 1, 2, 3 … within a link. Allocated under the link's row lock. */
    attemptNo: integer("attempt_no").notNull(),

    provider: paymentProvider("provider").notNull(),
    environment: paymentEnvironment("environment").notNull(),

    /**
     * Sent to Converge as `ssl_invoice_number`: `PW10001N2` (alphanumeric;
     * `PW-10001-2` before 2026-10-03, see `invoiceNumberFor`). Unique per
     * attempt, which is how staff find the transaction in the Converge
     * portal when the customer closed the tab before the return redirect
     * (D108: nothing looks it up automatically).
     */
    providerInvoiceNumber: text("provider_invoice_number").notNull(),

    /**
     * Snapshot of the link's amount at the moment the session was requested.
     * The session is created from this value, server-side — never from
     * anything the browser sends — and verification compares the gateway's
     * reported amount against it.
     */
    amountCents: integer("amount_cents").notNull(),
    currency: char("currency", { length: 3 }).notNull().default("CAD"),

    status: paymentAttemptStatus("status").notNull().default("pending"),

    /** Stripe Checkout Session id (`cs_...`), stored as soon as the session is
     *  created. How a webhook, the pay page and staff find the attempt. Null on
     *  Converge rows and on an attempt whose session was never issued. */
    providerSessionId: text("provider_session_id"),
    /** Gateway transaction id: Converge `ssl_txn_id`, or the Stripe
     *  PaymentIntent id (`pi_...`). Null until the gateway reports a payment. */
    providerTxnId: text("provider_txn_id"),
    /** Converge `ssl_approval_code`. Present on approvals only. */
    approvalCode: text("approval_code"),
    /** `ssl_result_message`, e.g. `APPROVAL`, `DECLINED`. For staff, not logic. */
    resultMessage: text("result_message"),
    /** `ssl_card_short_description`, e.g. `VISA`. */
    cardBrand: text("card_brand"),
    /** Last four digits only. Never the masked PAN, never the full PAN. */
    cardLast4: char("card_last4", { length: 4 }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Converge session tokens live 15 minutes; after this the attempt can
     *  no longer be resolved by the customer, and stays `pending` (D108). */
    sessionExpiresAt: timestamp("session_expires_at", {
      withTimezone: true,
    }).notNull(),
    /** When a gateway transaction query confirmed the final state. */
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    /** Last time the pay page, a render of the admin list or staff asked Stripe
     *  about this session. Throttles the lazy settle. */
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    /** Page-driven lookups so far (the webhook and staff are not counted),
     *  capped so a token holder cannot make unbounded Stripe reads. */
    settleChecks: integer("settle_checks").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("payment_attempts_link_attempt_no_key").on(
      t.linkId,
      t.attemptNo,
    ),
    uniqueIndex("payment_attempts_invoice_number_key").on(
      t.providerInvoiceNumber,
    ),
    // A Stripe session belongs to exactly one attempt.
    uniqueIndex("payment_attempts_provider_session_key")
      .on(t.providerSessionId)
      .where(sql`${t.providerSessionId} is not null`),
    // One gateway transaction maps to exactly one attempt — replaying the
    // same return redirect can never double-count a payment.
    uniqueIndex("payment_attempts_provider_txn_key")
      .on(t.provider, t.providerTxnId)
      .where(sql`${t.providerTxnId} is not null`),
    // THE money invariant: one approved payment per link, full stop.
    uniqueIndex("payment_attempts_one_approved_per_link")
      .on(t.linkId)
      .where(sql`${t.status} = 'approved'`),
    // Unresolved attempts, oldest first. Unused since D108; kept to avoid a migration.
    index("payment_attempts_pending_idx")
      .on(t.createdAt)
      .where(sql`${t.status} = 'pending'`),

    check("payment_attempts_attempt_no_positive", sql`${t.attemptNo} >= 1`),
    check("payment_attempts_amount_positive", sql`${t.amountCents} > 0`),
    check("payment_attempts_currency_cad", sql`${t.currency} = 'CAD'`),
    check(
      "payment_attempts_last4_digits",
      sql`${t.cardLast4} is null or ${t.cardLast4} ~ '^[0-9]{4}$'`,
    ),
    // Money moved ⇒ we hold the gateway's id for it and verified it.
    check(
      "payment_attempts_settled_has_txn",
      sql`${t.status} not in ('approved', 'duplicate') or (${t.providerTxnId} is not null and ${t.verifiedAt} is not null)`,
    ),
  ],
);

/* ===========================================================================
   payment_events
   =========================================================================== */

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    linkId: uuid("link_id")
      .notNull()
      .references(() => paymentLinks.id, { onDelete: "restrict" }),
    attemptId: uuid("attempt_id").references(() => paymentAttempts.id, {
      onDelete: "restrict",
    }),

    /** Dotted name: `link.created`, `link.cancelled`, `attempt.session_created`,
     *  `attempt.return_received`, `attempt.verified`, `attempt.reconciled` … */
    type: text("type").notNull(),
    actor: paymentEventActor("actor").notNull(),

    /**
     * Event detail. Gateway responses land here **after redaction**: the
     * redactor in `src/features/payments/` drops `ssl_pin`, any card number
     * beyond last four, and anything it does not recognise. Nothing secret is
     * ever written to this column.
     */
    data: jsonb("data").notNull().default(sql`'{}'::jsonb`),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("payment_events_link_created_at_idx").on(t.linkId, t.createdAt),
    check("payment_events_type_format", sql`${t.type} ~ '^[a-z_]+(\\.[a-z_]+)+$'`),
  ],
);

/* ===========================================================================
   stripe_events
   =========================================================================== */

/**
 * One row per Stripe webhook delivery we accepted (event id is the key, so a
 * redelivery is recognised). Not the audit log: `payment_events` stays the
 * append-only record of state changes. This table does three small jobs:
 * dedupe the one-off emails (refund, dispute), feed the admin's "Last Stripe
 * event" line, and carry the refund/dispute flag the admin list shows. It never
 * changes a link's status. Never holds card or customer data.
 */
export const stripeEvents = pgTable(
  "stripe_events",
  {
    /** Stripe's `evt_...` id. */
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    /** `data.object.id` (session, charge or dispute). */
    objectId: text("object_id"),
    livemode: boolean("livemode").notNull(),
    linkId: uuid("link_id").references(() => paymentLinks.id, { onDelete: "restrict" }),
    attemptId: uuid("attempt_id").references(() => paymentAttempts.id, { onDelete: "restrict" }),
    /** What we did with it: `received`, `settled`, `unchanged`, `unmatched`, `noted`, `ignored`. */
    outcome: text("outcome").notNull().default("received"),
    /** Refund or dispute detail for the admin flag, e.g. `full`, `partial`, `won`, `lost`. */
    detail: text("detail"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("stripe_events_received_at_idx").on(t.receivedAt),
    index("stripe_events_link_idx").on(t.linkId),
  ],
);

export type StripeEvent = typeof stripeEvents.$inferSelect;
export type PaymentLink = typeof paymentLinks.$inferSelect;
export type NewPaymentLink = typeof paymentLinks.$inferInsert;
export type PaymentAttempt = typeof paymentAttempts.$inferSelect;
export type NewPaymentAttempt = typeof paymentAttempts.$inferInsert;
export type PaymentEvent = typeof paymentEvents.$inferSelect;
export type NewPaymentEvent = typeof paymentEvents.$inferInsert;

/* ===========================================================================
   Catalogue
   =========================================================================== */

// Products, specs, images and vendor sources live in their own file. They are
// re-exported here because `drizzle.config.ts` and `client.ts` both read the
// schema from this one module.
export * from "./catalog-schema";
