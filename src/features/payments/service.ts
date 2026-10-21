/* ---------------------------------------------------------------------------
   Payments service — every state change a payment link or attempt can make.

   The rules this file enforces (`docs/payments.md` §4–§5):

     1. The amount sent to Stripe comes from the database row, never from the
        browser.
     2. Nothing the browser sends back changes state. The webhook, the pay
        page and the staff "Check payment" button all do the same thing: name a
        Checkout Session, re-read it from Stripe, and let `applyTransaction`
        decide. An attempt is `approved` only when the session is complete and
        paid, in CAD, in the right mode, with no adjustment, and its
        `client_reference_id` and amount match the attempt row.
     3. Creating an attempt locks the link row (`FOR UPDATE`) and refuses a
        paid, cancelled or expired link. The lock is released before any
        network call, so a slow Stripe never holds a row lock.
     4. A second payment on an already-paid link is recorded as `duplicate`
        (a refund for staff to issue in the Dashboard), never folded silently
        into `approved`. The partial unique index makes a second `approved`
        impossible anyway.
     5. Every change writes a `payment_events` row, in the same transaction.
     6. An open session is reused, never duplicated: pressing Pay twice, or in
        two tabs, lands on the same Stripe page. Once one attempt is paid the
        link's other open sessions are expired.

   Callers: the `/pay` routes (customer, webhook) and the admin actions
   (staff). The gateway is passed in, so the money logic runs against a fake
   in tests.

   D108 is superseded: there is no cron, but a pending attempt is looked up
   again when the customer returns, when the admin list renders (bounded) and
   when staff press Check payment. See "Settling" below.
   --------------------------------------------------------------------------- */

import { randomBytes } from "node:crypto";

import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { after } from "next/server";
import type Stripe from "stripe";

import { getDb, type Database } from "@/db/client";
import {
  paymentAttempts,
  paymentEvents,
  paymentLinks,
  stripeEvents,
  type NewPaymentEvent,
  type PaymentAttempt,
  type PaymentLink,
} from "@/db/schema";

import { sendPaymentEmail, sendStripeNoticeEmail, type StripeNotice } from "./payment-email";
import { stripeGateway } from "./stripe";
import { linkState, type Gateway, type GatewayTransaction, type LinkState, type Payer } from "./types";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** A Checkout Session lives 60 minutes (Stripe allows 30 minutes to 24 hours). */
const SESSION_TTL_MS = 60 * 60 * 1000;

/** Attempts per link, so a script cannot mint unbounded Stripe sessions through
 *  one leaked link. An open session is reused, so a real customer rarely
 *  uses more than one or two. */
const MAX_ATTEMPTS_PER_LINK = 10;

/** A pending attempt with no session yet is another request mid-flight for this
 *  long, then it is dead (a crash between the commit and Stripe's answer). */
const SESSION_CREATE_GRACE_MS = 30_000;

/** Page-driven Stripe reads per attempt (the webhook and staff are not counted). */
const MAX_PAGE_CHECKS = 30;

/** Run after the response, so a slow email never delays a customer or a
 *  webhook acknowledgement (Checkout waits at most 10 s for it, and Resend's own
 *  timeout is 10 s). Outside a request scope it just runs. */
function defer(task: () => Promise<void>): void {
  try {
    after(task);
  } catch {
    void task().catch(() => undefined);
  }
}

async function event(tx: Tx, row: NewPaymentEvent): Promise<void> {
  await tx.insert(paymentEvents).values(row);
}

/* ===========================================================================
   Links (staff)
   =========================================================================== */

export interface CreateLinkInput {
  amountCents: number;
  description: string;
  expiresAt: Date;
  idempotencyKey: string;
  createdBy: string;
}

/** Idempotent on `idempotencyKey`: a double-submitted form returns the first
 *  link rather than minting a second one. */
export async function createLink(input: CreateLinkInput, db: Database = getDb()): Promise<PaymentLink> {
  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(paymentLinks)
      .values({
        publicToken: randomBytes(16).toString("base64url"),
        idempotencyKey: input.idempotencyKey,
        amountCents: input.amountCents,
        description: input.description,
        expiresAt: input.expiresAt,
        createdBy: input.createdBy,
      })
      .onConflictDoNothing({ target: paymentLinks.idempotencyKey })
      .returning();

    if (!inserted) {
      const [existing] = await tx
        .select()
        .from(paymentLinks)
        .where(eq(paymentLinks.idempotencyKey, input.idempotencyKey));
      return existing;
    }

    await event(tx, {
      linkId: inserted.id,
      type: "link.created",
      actor: "staff",
      data: {
        amount_cents: inserted.amountCents,
        expires_at: inserted.expiresAt.toISOString(),
        created_by: input.createdBy,
      },
    });
    return inserted;
  });
}

export type CancelResult = { ok: true } | { ok: false; state: LinkState | "not_found" };

export async function cancelLink(
  linkId: string,
  cancelledBy: string,
  db: Database = getDb(),
  getGateway: () => Gateway = stripeGateway,
): Promise<CancelResult> {
  const result = await db.transaction(async (tx): Promise<CancelResult> => {
    const [link] = await tx.select().from(paymentLinks).where(eq(paymentLinks.id, linkId)).for("update");
    if (!link) return { ok: false, state: "not_found" };
    // An expired link can still be cancelled: it tidies the list, and a
    // cancelled link can never be revived by an expiry change later.
    if (link.status !== "active") return { ok: false, state: linkState(link) };

    await tx
      .update(paymentLinks)
      .set({ status: "cancelled", cancelledAt: new Date(), cancelledBy })
      .where(eq(paymentLinks.id, linkId));
    await event(tx, { linkId, type: "link.cancelled", actor: "staff", data: { cancelled_by: cancelledBy } });
    return { ok: true };
  });

  // After the commit, never under the row lock, and never failing the cancel:
  // close any Stripe page the customer may still have open. A payment that
  // slips through anyway settles as `duplicate` with a refund email.
  if (result.ok) await expireOpenSessions(linkId, null, getGateway, db);
  return result;
}

export type LinkFlag =
  | "refunded"
  | "partially_refunded"
  | "dispute_open"
  | "dispute_won"
  | "dispute_lost"
  | "dispute_closed";

export interface LinkSummary {
  link: PaymentLink;
  state: LinkState;
  /** The approved attempt, when paid: brand, last four, PaymentIntent id. */
  approved: PaymentAttempt | null;
  pendingAttempts: number;
  expiredAttempts: number;
  duplicateAttempts: number;
  /** Refund or dispute noticed by the webhook (notify only, plan v3 §8.2). */
  flag: LinkFlag | null;
}

/** Links a customer can still pay: `active` and not yet past their expiry.
 *  The same rule as `linkState()`, as one count, for the admin home (D118). */
export async function countOpenLinks(db: Database = getDb()): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(paymentLinks)
    .where(and(eq(paymentLinks.status, "active"), sql`${paymentLinks.expiresAt} > now()`));
  return row?.total ?? 0;
}

const FLAG_EVENT_TYPES = ["charge.refunded", "charge.dispute.created", "charge.dispute.closed"];

function flagFor(rows: { type: string; detail: string | null }[]): LinkFlag | null {
  // `rows` is newest first. A dispute outranks a refund.
  const dispute = rows.find((row) => row.type.startsWith("charge.dispute."));
  if (dispute) {
    if (dispute.type === "charge.dispute.created") return "dispute_open";
    return dispute.detail === "won" ? "dispute_won" : dispute.detail === "lost" ? "dispute_lost" : "dispute_closed";
  }
  const refund = rows.find((row) => row.type === "charge.refunded");
  if (refund) return refund.detail === "full" ? "refunded" : "partially_refunded";
  return null;
}

/** The admin list: newest first. */
export async function listLinks(limit = 50, db: Database = getDb()): Promise<LinkSummary[]> {
  const links = await db.select().from(paymentLinks).orderBy(desc(paymentLinks.createdAt)).limit(limit);
  if (links.length === 0) return [];
  const ids = links.map((l) => l.id);

  const attempts = await db
    .select()
    .from(paymentAttempts)
    .where(and(inArray(paymentAttempts.linkId, ids), inArray(paymentAttempts.status, ["approved", "pending", "duplicate", "expired"])));
  const noted = await db
    .select({ linkId: stripeEvents.linkId, type: stripeEvents.type, detail: stripeEvents.detail })
    .from(stripeEvents)
    .where(and(inArray(stripeEvents.linkId, ids), inArray(stripeEvents.type, FLAG_EVENT_TYPES)))
    .orderBy(desc(stripeEvents.receivedAt));

  const now = new Date();
  return links.map((link) => {
    const mine = attempts.filter((a) => a.linkId === link.id);
    return {
      link,
      state: linkState(link, now),
      approved: mine.find((a) => a.status === "approved") ?? null,
      pendingAttempts: mine.filter((a) => a.status === "pending").length,
      expiredAttempts: mine.filter((a) => a.status === "expired").length,
      duplicateAttempts: mine.filter((a) => a.status === "duplicate").length,
      flag: flagFor(noted.filter((row) => row.linkId === link.id)),
    };
  });
}

export interface WebhookHealth {
  /** Newest webhook delivery we accepted, or null if none ever. */
  lastEventAt: Date | null;
  lastEventType: string | null;
  /** Newest payment we marked paid. A paid link newer than the newest event
   *  means a payment settled without its webhook reaching us. */
  lastPaidAt: Date | null;
}

export async function webhookHealth(db: Database = getDb()): Promise<WebhookHealth> {
  const [last] = await db
    .select({ at: stripeEvents.receivedAt, type: stripeEvents.type })
    .from(stripeEvents)
    .orderBy(desc(stripeEvents.receivedAt))
    .limit(1);
  const [paid] = await db
    .select({ at: sql<Date | null>`max(${paymentLinks.paidAt})` })
    .from(paymentLinks)
    .innerJoin(paymentAttempts, and(eq(paymentAttempts.linkId, paymentLinks.id), eq(paymentAttempts.provider, "stripe")));
  return {
    lastEventAt: last?.at ?? null,
    lastEventType: last?.type ?? null,
    lastPaidAt: paid?.at ? new Date(paid.at) : null,
  };
}

/* ===========================================================================
   The customer's page
   =========================================================================== */

export interface PayPageView {
  link: PaymentLink;
  state: LinkState;
  /** The most recent attempt, for "continue" / "timed out" notices. */
  latestAttempt: PaymentAttempt | null;
}

export async function getPayPage(publicToken: string, db: Database = getDb()): Promise<PayPageView | null> {
  const [link] = await db.select().from(paymentLinks).where(eq(paymentLinks.publicToken, publicToken));
  if (!link) return null;
  const [latestAttempt] = await db
    .select()
    .from(paymentAttempts)
    .where(eq(paymentAttempts.linkId, link.id))
    .orderBy(desc(paymentAttempts.attemptNo))
    .limit(1);
  return { link, state: linkState(link), latestAttempt: latestAttempt ?? null };
}

/* ===========================================================================
   Pressing Pay
   =========================================================================== */

export type StartAttemptResult =
  | { kind: "redirect"; url: string }
  | { kind: "not_payable"; state: LinkState | "not_found" | "too_many_attempts" }
  /** Another request is opening this link's payment page right now. */
  | { kind: "in_progress" }
  | { kind: "unavailable" };

/**
 * The customer pressed Pay. Lock, check, then either hand back the page that is
 * already open for this link or record a new pending attempt, commit, and ask
 * Stripe for a session built from the attempt row.
 *
 * `returnUrl` is the link's own `/pay/<token>` page, absolute.
 */
export async function startAttempt(
  publicToken: string,
  gateway: Gateway,
  returnUrl: string,
  db: Database = getDb(),
  /** Internal: one retry after a stale session is found and closed. */
  retried = false,
): Promise<StartAttemptResult> {
  const prepared = await db.transaction(async (tx) => {
    const [link] = await tx
      .select()
      .from(paymentLinks)
      .where(eq(paymentLinks.publicToken, publicToken))
      .for("update");
    if (!link) return { kind: "not_payable", state: "not_found" } as const;

    const state = linkState(link);
    if (state !== "active") return { kind: "not_payable", state } as const;

    const [latest] = await tx
      .select()
      .from(paymentAttempts)
      .where(eq(paymentAttempts.linkId, link.id))
      .orderBy(desc(paymentAttempts.attemptNo))
      .limit(1);

    if (latest?.status === "pending") {
      // A session exists: ask Stripe about it (outside the lock) and reuse it.
      if (latest.providerSessionId) return { kind: "reuse", attempt: latest } as const;
      // No session yet: another press is creating it right now, or it died.
      if (Date.now() - latest.createdAt.getTime() < SESSION_CREATE_GRACE_MS) return { kind: "in_progress" } as const;
      await tx.update(paymentAttempts).set({ status: "failed" }).where(eq(paymentAttempts.id, latest.id));
      await event(tx, { linkId: link.id, attemptId: latest.id, type: "attempt.session_failed", actor: "system", data: { detail: "no session was issued" } });
    }

    const last = latest?.attemptNo ?? 0;
    if (last >= MAX_ATTEMPTS_PER_LINK) return { kind: "not_payable", state: "too_many_attempts" } as const;

    const attemptNo = last + 1;
    const [attempt] = await tx
      .insert(paymentAttempts)
      .values({
        linkId: link.id,
        attemptNo,
        provider: "stripe",
        environment: gateway.environment,
        // Letters and digits only: `PW-10007` attempt 1 → `PW10007N1`. Sent to
        // Stripe as `client_reference_id`, and the match key for a payment.
        providerInvoiceNumber: invoiceNumberFor(link.reference, attemptNo),
        amountCents: link.amountCents,
        sessionExpiresAt: new Date(Date.now() + SESSION_TTL_MS),
      })
      .returning();
    await event(tx, {
      linkId: link.id,
      attemptId: attempt.id,
      type: "attempt.created",
      actor: "customer",
      data: { attempt_no: attemptNo, invoice_number: attempt.providerInvoiceNumber },
    });
    return { kind: "created", link, attempt } as const;
  });

  if (prepared.kind === "not_payable" || prepared.kind === "in_progress") return prepared;

  if (prepared.kind === "reuse") {
    const { attempt } = prepared;
    const looked = await gateway.retrieveSession(attempt.providerSessionId!);
    if (!looked.ok) {
      console.error(JSON.stringify({ at: "payments.startAttempt", reuse: "retrieve_failed", detail: looked.detail }));
      return { kind: "unavailable" };
    }
    const { session } = looked;
    if (session.status === "open" && session.url) {
      console.info(JSON.stringify({ at: "payments.startAttempt", invoice: attempt.providerInvoiceNumber, session: "reused" }));
      return { kind: "redirect", url: session.url };
    }
    if (session.status === "complete") {
      // Paid while the customer was away: settle it, and the link is paid.
      await settleAttempt(attempt.id, gateway, "page", db);
      return { kind: "not_payable", state: "paid" };
    }
    // Expired, or open without a url: close it and start fresh, once.
    if (session.status === "open") await gateway.expireSession(session.sessionId);
    await markExpired(attempt.id, db);
    if (retried) return { kind: "unavailable" };
    return startAttempt(publicToken, gateway, returnUrl, db, true);
  }

  const { link, attempt } = prepared;
  const session = await gateway.createSession({
    attemptId: attempt.id,
    invoiceNumber: attempt.providerInvoiceNumber,
    reference: link.reference,
    amountCents: attempt.amountCents,
    description: link.description,
    returnUrl,
    expiresAt: attempt.sessionExpiresAt,
  });

  await db.transaction(async (tx) => {
    if (session.ok) {
      await tx
        .update(paymentAttempts)
        .set({ providerSessionId: session.sessionId, sessionExpiresAt: session.expiresAt })
        .where(eq(paymentAttempts.id, attempt.id));
      await event(tx, { linkId: link.id, attemptId: attempt.id, type: "attempt.session_created", actor: "system", data: {} });
    } else {
      // No session was issued, so no money can have moved on this attempt.
      await tx
        .update(paymentAttempts)
        .set({ status: "failed" })
        .where(and(eq(paymentAttempts.id, attempt.id), eq(paymentAttempts.status, "pending")));
      await event(tx, {
        linkId: link.id,
        attemptId: attempt.id,
        type: "attempt.session_failed",
        actor: "system",
        data: { detail: session.detail },
      });
    }
  });

  if (!session.ok) {
    console.error(JSON.stringify({ at: "payments.startAttempt", invoice: attempt.providerInvoiceNumber, detail: session.detail }));
    return { kind: "unavailable" };
  }
  console.info(JSON.stringify({ at: "payments.startAttempt", invoice: attempt.providerInvoiceNumber, session: "issued" }));
  return { kind: "redirect", url: session.url };
}

export function invoiceNumberFor(reference: string, attemptNo: number): string {
  return `${reference.replace(/[^A-Za-z0-9]/g, "")}N${attemptNo}`;
}

/* ===========================================================================
   Verification — the only path to `approved`
   =========================================================================== */

export type ResolveOutcome = "approved" | "duplicate" | "unchanged" | "mismatch";
export type SettleSource = "webhook" | "page" | "staff";

/**
 * Apply one Stripe-verified payment to its attempt. `txn` comes from a
 * server-side retrieve of the session, never from the browser or from the
 * webhook's own body. Whichever path moves the attempt sends the shop's email;
 * the others see `unchanged` and send none.
 */
async function resolveAttempt(
  attemptId: string,
  txn: GatewayTransaction,
  payer: Payer | null,
  source: SettleSource,
  gateway: Gateway,
  db: Database,
): Promise<ResolveOutcome> {
  const outcome = await applyTransaction(attemptId, txn, source, db);
  if (outcome === "approved" || outcome === "duplicate") {
    const [row] = await db
      .select({ link: paymentLinks, attempt: paymentAttempts })
      .from(paymentAttempts)
      .innerJoin(paymentLinks, eq(paymentLinks.id, paymentAttempts.linkId))
      .where(eq(paymentAttempts.id, attemptId));
    if (row) {
      // After the commit and after the response (D120): a slow or failed send
      // never holds a row lock, delays the webhook's 200 or undoes a payment.
      defer(() => sendPaymentEmail(outcome, row.link, row.attempt, payer));
      // One payment per link: close any other page still open on it.
      if (outcome === "approved") await expireOpenSessions(row.link.id, attemptId, () => gateway, db);
    }
  }
  return outcome;
}

async function applyTransaction(
  attemptId: string,
  txn: GatewayTransaction,
  source: SettleSource,
  db: Database,
): Promise<ResolveOutcome> {
  return db.transaction(async (tx) => {
    // Lock order: link, then attempt — the same order `startAttempt` takes.
    const [{ linkId }] = await tx
      .select({ linkId: paymentAttempts.linkId })
      .from(paymentAttempts)
      .where(eq(paymentAttempts.id, attemptId));
    const [link] = await tx.select().from(paymentLinks).where(eq(paymentLinks.id, linkId)).for("update");
    const [attempt] = await tx.select().from(paymentAttempts).where(eq(paymentAttempts.id, attemptId)).for("update");

    const base = { linkId, attemptId, actor: "provider" as const };
    const data = { source, txn: txn.raw };

    // Replay of something already applied: nothing to do.
    if (attempt.providerTxnId === txn.txnId && attempt.verifiedAt) return "unchanged";

    if (txn.invoiceNumber !== attempt.providerInvoiceNumber || txn.amountCents !== attempt.amountCents) {
      await event(tx, { ...base, type: "attempt.verification_mismatch", data: { ...data, expected_cents: attempt.amountCents } });
      console.error(JSON.stringify({ at: "payments.resolveAttempt", mismatch: true, attemptId, txnId: txn.txnId }));
      return "mismatch";
    }

    if (txn.outcome === "other") {
      await event(tx, { ...base, type: "attempt.verified_unresolved", data });
      return "unchanged";
    }

    // A settled attempt never moves again. (`declined` is a Converge-era
    // status: Stripe retries on its own page, so a decline never reaches us.)
    const open = attempt.status === "pending" || attempt.status === "failed" || attempt.status === "expired";
    if (!open) {
      await event(tx, { ...base, type: "attempt.verified_ignored", data: { ...data, current: attempt.status } });
      return "unchanged";
    }

    const now = new Date();
    const cardFields = {
      providerTxnId: txn.txnId,
      resultMessage: txn.resultMessage,
      cardBrand: txn.cardBrand,
      cardLast4: txn.cardLast4,
      verifiedAt: now,
    };

    // Money moved. Paid link, or a cancelled one (the customer was already on
    // Stripe's page when staff cancelled) → a refund to issue.
    if (link.status !== "active") {
      await tx.update(paymentAttempts).set({ status: "duplicate", ...cardFields }).where(eq(paymentAttempts.id, attemptId));
      await event(tx, { ...base, type: "attempt.duplicate", data: { ...data, link_status: link.status } });
      console.error(JSON.stringify({ at: "payments.resolveAttempt", duplicate: true, reference: link.reference, txnId: txn.txnId }));
      return "duplicate";
    }

    // An expired-but-active link is still paid: the session was issued
    // before the expiry, and the customer did pay.
    await tx.update(paymentAttempts).set({ status: "approved", ...cardFields }).where(eq(paymentAttempts.id, attemptId));
    await tx.update(paymentLinks).set({ status: "paid", paidAt: now }).where(eq(paymentLinks.id, linkId));
    await event(tx, { ...base, type: "attempt.approved", data });
    await event(tx, { linkId, attemptId, actor: "system", type: "link.paid", data: { amount_cents: attempt.amountCents } });
    return "approved";
  });
}

/** `pending` → `expired`, only from `pending`: a paid or settled attempt never
 *  moves backwards. */
async function markExpired(attemptId: string, db: Database): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [{ linkId }] = await tx
      .select({ linkId: paymentAttempts.linkId })
      .from(paymentAttempts)
      .where(eq(paymentAttempts.id, attemptId));
    await tx.select({ id: paymentLinks.id }).from(paymentLinks).where(eq(paymentLinks.id, linkId)).for("update");
    const moved = await tx
      .update(paymentAttempts)
      .set({ status: "expired" })
      .where(and(eq(paymentAttempts.id, attemptId), eq(paymentAttempts.status, "pending")))
      .returning({ id: paymentAttempts.id });
    if (moved.length === 0) return false;
    await event(tx, { linkId, attemptId, type: "attempt.session_expired", actor: "provider", data: {} });
    return true;
  });
}

/** Best effort, after a commit: expire this link's other open Stripe pages
 *  (everything but `exceptAttemptId`) and mark their attempts `expired`. Never
 *  throws: a failure leaves a page open that can only settle as `duplicate`. */
async function expireOpenSessions(
  linkId: string,
  exceptAttemptId: string | null,
  getGateway: () => Gateway,
  db: Database,
): Promise<void> {
  try {
    const open = await db
      .select({ id: paymentAttempts.id, sessionId: paymentAttempts.providerSessionId })
      .from(paymentAttempts)
      .where(and(eq(paymentAttempts.linkId, linkId), eq(paymentAttempts.status, "pending")));
    const targets = open.filter((row) => row.sessionId && row.id !== exceptAttemptId);
    if (targets.length === 0) return;
    const gateway = getGateway();
    for (const target of targets) {
      await gateway.expireSession(target.sessionId!);
      await markExpired(target.id, db);
    }
  } catch (error) {
    console.error(JSON.stringify({ at: "payments.expireOpenSessions", detail: error instanceof Error ? error.message : "unknown" }));
  }
}

/* ===========================================================================
   Settling — three ways to ask Stripe about a pending attempt
   ===========================================================================

   The webhook is the normal path. The other two exist so a wrong secret, an
   outage or a lost event never strands a paid customer (D108 reversed):

     - the pay page, for the attempt the customer just came back to
       (`?paid=1`) or an old pending one, throttled and capped per attempt;
     - staff, with the Check payment button on a pending row.

   All three end in `settleAttempt`: re-read the session, apply it. */

export type SettleOutcome = ResolveOutcome | "open" | "expired" | "no_session" | "error";

export async function settleAttempt(
  attemptId: string,
  gateway: Gateway,
  source: SettleSource,
  db: Database = getDb(),
): Promise<SettleOutcome> {
  const [attempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.id, attemptId));
  if (!attempt?.providerSessionId) return "no_session";

  await db
    .update(paymentAttempts)
    .set({
      lastCheckedAt: new Date(),
      ...(source === "page" ? { settleChecks: sql`${paymentAttempts.settleChecks} + 1` } : {}),
    })
    .where(eq(paymentAttempts.id, attemptId));

  const looked = await gateway.retrieveSession(attempt.providerSessionId);
  if (!looked.ok) {
    console.error(JSON.stringify({ at: "payments.settleAttempt", source, detail: looked.detail }));
    return "error";
  }
  const { session } = looked;
  if (session.status === "complete" && session.txn) {
    return resolveAttempt(attemptId, session.txn, session.payer, source, gateway, db);
  }
  if (session.status === "expired") {
    await markExpired(attemptId, db);
    return "expired";
  }
  return "open";
}

/** The attempt a Checkout Session belongs to. A session we created but failed
 *  to record (a crash between Stripe's answer and our write) is bound by its
 *  `client_reference_id`, so a payment on it is never lost. */
async function attemptForSession(
  sessionId: string,
  gateway: Gateway,
  db: Database,
): Promise<PaymentAttempt | null> {
  const [known] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.providerSessionId, sessionId));
  if (known) return known;

  const looked = await gateway.retrieveSession(sessionId);
  if (!looked.ok) return null;
  const invoice = looked.session.txn?.invoiceNumber ?? null;
  if (!invoice) return null;
  const [byInvoice] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.providerInvoiceNumber, invoice));
  if (!byInvoice || byInvoice.providerSessionId) return null;
  const [bound] = await db
    .update(paymentAttempts)
    .set({ providerSessionId: sessionId })
    .where(and(eq(paymentAttempts.id, byInvoice.id), isNull(paymentAttempts.providerSessionId)))
    .returning();
  if (bound) {
    await db.insert(paymentEvents).values({
      linkId: bound.linkId,
      attemptId: bound.id,
      type: "attempt.session_bound",
      actor: "system",
      data: {},
    });
  }
  return bound ?? null;
}

export type SessionSettle = SettleOutcome | "unmatched";

export async function settleBySessionId(
  sessionId: string,
  gateway: Gateway,
  source: SettleSource,
  db: Database = getDb(),
): Promise<{ outcome: SessionSettle; attempt: PaymentAttempt | null }> {
  const attempt = await attemptForSession(sessionId, gateway, db);
  if (!attempt) return { outcome: "unmatched", attempt: null };
  return { outcome: await settleAttempt(attempt.id, gateway, source, db), attempt };
}

interface LazyOptions {
  linkId?: string;
  /** Ignore attempts younger than this (the webhook has had its chance). */
  minAgeMs: number;
  /** Skip an attempt asked about more recently than this. */
  recheckAfterMs: number;
  limit: number;
  timeoutMs: number;
}

/** Look up pending attempts, bounded: a few per call, each throttled and
 *  capped, under a deadline, with every error swallowed. The page and the
 *  admin list must render whatever Stripe does. */
async function settleStalePending(gateway: Gateway, options: LazyOptions, db: Database): Promise<number> {
  const now = Date.now();
  const rows = await db
    .select({ id: paymentAttempts.id })
    .from(paymentAttempts)
    .where(
      and(
        eq(paymentAttempts.status, "pending"),
        eq(paymentAttempts.provider, "stripe"),
        sql`${paymentAttempts.providerSessionId} is not null`,
        lt(paymentAttempts.createdAt, new Date(now - options.minAgeMs)),
        or(isNull(paymentAttempts.lastCheckedAt), lt(paymentAttempts.lastCheckedAt, new Date(now - options.recheckAfterMs))),
        lt(paymentAttempts.settleChecks, MAX_PAGE_CHECKS),
        options.linkId ? eq(paymentAttempts.linkId, options.linkId) : undefined,
      ),
    )
    .orderBy(paymentAttempts.createdAt)
    .limit(options.limit);
  if (rows.length === 0) return 0;

  const work = Promise.all(rows.map((row) => settleAttempt(row.id, gateway, "page", db).catch(() => "error" as const)));
  const deadline = new Promise<never[]>((resolve) => setTimeout(() => resolve([]), options.timeoutMs));
  const results = await Promise.race([work, deadline]);
  return results.filter((outcome) => outcome === "approved" || outcome === "duplicate").length;
}

/** The pay page: settle this link's pending attempt before rendering. `fresh`
 *  is the `?paid=1` return from Stripe: ask at once, then at most every 2 s. */
export async function settleLinkForPage(linkId: string, fresh: boolean, db: Database = getDb()): Promise<void> {
  try {
    await settleStalePending(
      stripeGateway(),
      { linkId, minAgeMs: fresh ? 0 : 2 * 60_000, recheckAfterMs: fresh ? 2_000 : 30_000, limit: 1, timeoutMs: 4_000 },
      db,
    );
  } catch {
    // Not configured, or Stripe is down: the page shows what the database knows.
  }
}

/** The admin list: settle up to a handful of old pending attempts first. */
export async function settlePendingForAdmin(db: Database = getDb()): Promise<void> {
  try {
    await settleStalePending(stripeGateway(), { minAgeMs: 2 * 60_000, recheckAfterMs: 30_000, limit: 5, timeoutMs: 5_000 }, db);
  } catch {
    // Same: the list renders from the database whatever Stripe does.
  }
}

export type CheckResult =
  | { kind: "paid" }
  | { kind: "still_open" }
  | { kind: "timed_out" }
  | { kind: "nothing" }
  | { kind: "error" };

/** Staff pressed Check payment: ask Stripe about every pending attempt on the
 *  link, with no throttle (a person is waiting). */
export async function checkLinkPayment(
  linkId: string,
  db: Database = getDb(),
  getGateway: () => Gateway = stripeGateway,
): Promise<CheckResult> {
  const pending = await db
    .select({ id: paymentAttempts.id })
    .from(paymentAttempts)
    .where(and(eq(paymentAttempts.linkId, linkId), eq(paymentAttempts.status, "pending"), sql`${paymentAttempts.providerSessionId} is not null`));
  if (pending.length === 0) return { kind: "nothing" };

  let gateway: Gateway;
  try {
    gateway = getGateway();
  } catch {
    return { kind: "error" };
  }
  const outcomes: SettleOutcome[] = [];
  for (const row of pending) outcomes.push(await settleAttempt(row.id, gateway, "staff", db));
  if (outcomes.some((o) => o === "approved" || o === "duplicate")) return { kind: "paid" };
  if (outcomes.some((o) => o === "error")) return { kind: "error" };
  if (outcomes.some((o) => o === "open")) return { kind: "still_open" };
  return { kind: "timed_out" };
}

/* ===========================================================================
   The webhook
   =========================================================================== */

export type StripeEventOutcome = "settled" | "unchanged" | "unmatched" | "noted" | "ignored" | "duplicate_event";

function objectId(event: Stripe.Event): string | null {
  const object = event.data.object as { id?: unknown };
  return typeof object.id === "string" ? object.id : null;
}

function paymentIntentOf(object: { payment_intent?: unknown }): string | null {
  const intent = object.payment_intent;
  if (typeof intent === "string") return intent;
  if (intent && typeof intent === "object" && typeof (intent as { id?: unknown }).id === "string") return (intent as { id: string }).id;
  return null;
}

/**
 * One verified webhook event (the route has already checked the signature and
 * `livemode`). Records it, then:
 *
 *   - `checkout.session.*`: settle the named session by re-reading it;
 *   - `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`:
 *     **notify only**. Match the PaymentIntent to a link, write the audit
 *     event, email the shop once. The link's status never changes: a refunded
 *     link stays Paid, and the admin shows a flag (plan v3 §8.2).
 *
 * Throws only for our own failures (database), so the route can answer 500 and
 * Stripe retries. An event for something that is not ours is acknowledged.
 */
export async function processStripeEvent(
  event: Stripe.Event,
  gateway: Gateway,
  db: Database = getDb(),
): Promise<StripeEventOutcome> {
  const inserted = await db
    .insert(stripeEvents)
    .values({ id: event.id, type: event.type, objectId: objectId(event), livemode: event.livemode })
    .onConflictDoNothing({ target: stripeEvents.id })
    .returning({ id: stripeEvents.id });
  const isNew = inserted.length > 0;

  const finish = async (
    outcome: string,
    extra: { linkId?: string; attemptId?: string; detail?: string } = {},
  ): Promise<void> => {
    await db
      .update(stripeEvents)
      .set({ outcome, linkId: extra.linkId ?? null, attemptId: extra.attemptId ?? null, detail: extra.detail ?? null })
      .where(eq(stripeEvents.id, event.id));
  };

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const sessionId = objectId(event);
      if (!sessionId) {
        await finish("ignored");
        return "ignored";
      }
      const { outcome, attempt } = await settleBySessionId(sessionId, gateway, "webhook", db);
      const label = outcome === "unmatched" ? "unmatched" : outcome === "approved" || outcome === "duplicate" ? "settled" : "unchanged";
      await finish(label === "settled" ? outcome : label, { linkId: attempt?.linkId, attemptId: attempt?.id });
      if (outcome === "error") throw new Error("could not re-read the session from Stripe");
      return label;
    }

    case "charge.refunded":
    case "charge.dispute.created":
    case "charge.dispute.closed": {
      const object = event.data.object as unknown as Record<string, unknown> & { payment_intent?: unknown };
      const intentId = paymentIntentOf(object);
      const [row] = intentId
        ? await db
            .select({ attempt: paymentAttempts, link: paymentLinks })
            .from(paymentAttempts)
            .innerJoin(paymentLinks, eq(paymentLinks.id, paymentAttempts.linkId))
            .where(and(eq(paymentAttempts.provider, "stripe"), eq(paymentAttempts.providerTxnId, intentId)))
        : [];
      if (!row) {
        await finish("unmatched");
        return "unmatched";
      }

      const notice = noticeFor(event, object);
      await finish("noted", { linkId: row.link.id, attemptId: row.attempt.id, detail: notice.flag });
      if (!isNew) return "duplicate_event";

      await db.insert(paymentEvents).values({
        linkId: row.link.id,
        attemptId: row.attempt.id,
        type: event.type === "charge.refunded" ? "attempt.refund_noted" : "attempt.dispute_noted",
        actor: "provider",
        data: { event: event.type, detail: notice.flag },
      });
      defer(() => sendStripeNoticeEmail(notice.notice, row.link, row.attempt));
      return "noted";
    }

    default:
      await finish("ignored");
      return "ignored";
  }
}

function noticeFor(
  event: Stripe.Event,
  object: Record<string, unknown>,
): { notice: StripeNotice; flag: string } {
  const number = (value: unknown) => (typeof value === "number" ? value : 0);
  if (event.type === "charge.refunded") {
    const full = object.refunded === true;
    return { notice: { kind: "refunded", full, refundedCents: number(object.amount_refunded) }, flag: full ? "full" : "partial" };
  }
  const evidence = object.evidence_details as { due_by?: unknown } | undefined;
  const dueBy = typeof evidence?.due_by === "number" ? new Date(evidence.due_by * 1000) : null;
  if (event.type === "charge.dispute.created") {
    return {
      notice: { kind: "dispute_opened", amountCents: number(object.amount), reason: String(object.reason ?? "unknown"), dueBy },
      flag: "open",
    };
  }
  const status = String(object.status ?? "closed");
  return {
    notice: { kind: "dispute_closed", amountCents: number(object.amount), status },
    flag: status === "won" ? "won" : status === "lost" ? "lost" : "closed",
  };
}
