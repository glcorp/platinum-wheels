/* ---------------------------------------------------------------------------
   Payments service — every state change a payment link or attempt can make.

   The rules this file enforces (`docs/payments.md` §4–§5):

     1. The amount sent to the gateway comes from the database row, never
        from the browser.
     2. Nothing the browser sends back changes state. A return redirect only
        tells us *which* transaction to ask about; the gateway's server-side
        query decides approved or declined, and its amount and invoice number
        must match the attempt before a link is marked paid.
     3. Creating an attempt locks the link row (`FOR UPDATE`) and refuses a
        paid, cancelled or expired link. The lock is released before the
        network call, so a slow gateway never holds a row lock for 60 s.
     4. A second approval on an already-paid link is recorded as `duplicate`
        (a refund for staff to issue), never folded silently into `approved`.
        The partial unique index makes a second `approved` impossible anyway.
     5. Every change writes a `payment_events` row, in the same transaction.
     6. A return redirect reaches the gateway only for an attempt the
        browser's own `pw_pay` cookie names, a bounded number of times, and
        never chooses which link page to send the browser to (LA-01/LA-02,
        D145 audit; see "The return redirect" below).

   Callers: the `/pay` routes (customer) and the admin actions (staff). The
   gateway is passed in, so the money logic runs against a fake in tests.

   There is no reconcile (D108): an attempt whose customer never comes back
   through `/pay/return` stays `pending`, and the admin list says so — unless
   Converge's export script reaches `/pay/notify` (D119), which settles it
   without a gateway query.
   --------------------------------------------------------------------------- */

import { randomBytes } from "node:crypto";

import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { getDb, type Database } from "@/db/client";
import {
  paymentAttempts,
  paymentEvents,
  paymentLinks,
  type NewPaymentEvent,
  type PaymentAttempt,
  type PaymentLink,
} from "@/db/schema";

import { sendPaymentEmail } from "./payment-email";
import { linkState, type Gateway, type GatewayTransaction, type LinkState } from "./types";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Converge session tokens live 15 minutes (Elavon, `docs/payments.md` §2). */
const SESSION_TTL_MS = 15 * 60 * 1000;

/** Attempts per link, so a script cannot burn the proxy quota or the
 *  gateway's fraud rules through one leaked link. */
const MAX_ATTEMPTS_PER_LINK = 10;

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

export async function cancelLink(linkId: string, cancelledBy: string, db: Database = getDb()): Promise<CancelResult> {
  return db.transaction(async (tx) => {
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
}

export interface LinkSummary {
  link: PaymentLink;
  state: LinkState;
  /** The approved attempt, when paid: brand, last four, approval code. */
  approved: PaymentAttempt | null;
  pendingAttempts: number;
  duplicateAttempts: number;
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

/** The admin list: newest first. */
export async function listLinks(limit = 50, db: Database = getDb()): Promise<LinkSummary[]> {
  const links = await db.select().from(paymentLinks).orderBy(desc(paymentLinks.createdAt)).limit(limit);
  if (links.length === 0) return [];

  const attempts = await db
    .select()
    .from(paymentAttempts)
    .where(
      and(
        inArray(
          paymentAttempts.linkId,
          links.map((l) => l.id),
        ),
        inArray(paymentAttempts.status, ["approved", "pending", "duplicate"]),
      ),
    );

  const now = new Date();
  return links.map((link) => {
    const mine = attempts.filter((a) => a.linkId === link.id);
    return {
      link,
      state: linkState(link, now),
      approved: mine.find((a) => a.status === "approved") ?? null,
      pendingAttempts: mine.filter((a) => a.status === "pending").length,
      duplicateAttempts: mine.filter((a) => a.status === "duplicate").length,
    };
  });
}

/* ===========================================================================
   The customer's page
   =========================================================================== */

export interface PayPageView {
  link: PaymentLink;
  state: LinkState;
  /** The most recent attempt, for "declined, try again" / "confirming". */
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

/**
 * Whether a payment link with this token exists, one indexed read and nothing
 * else. `src/proxy.ts` asks it before the page does, so an unknown token can
 * be answered with a 404 whose body renders without JavaScript (QA COPY-1,
 * D184; the product page's `productPageExists` is the precedent, D157). It says
 * nothing about the link's state: a paid or cancelled link exists. A token
 * that could never be one (the page's own shape test) is `false` unqueried.
 */
export async function payLinkExists(publicToken: string, db: Database = getDb()): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{22,64}$/.test(publicToken)) return false;
  const [row] = await db
    .select({ id: paymentLinks.id })
    .from(paymentLinks)
    .where(eq(paymentLinks.publicToken, publicToken))
    .limit(1);
  return row !== undefined;
}

export type StartAttemptResult =
  | { kind: "redirect"; hostedPageUrl: string; token: string }
  | { kind: "not_payable"; state: LinkState | "not_found" | "too_many_attempts" }
  | { kind: "unavailable" };

/**
 * The customer pressed Pay. Lock, check, record a pending attempt, commit,
 * then ask the gateway for a session built from the attempt row.
 */
export async function startAttempt(
  publicToken: string,
  gateway: Gateway,
  db: Database = getDb(),
): Promise<StartAttemptResult> {
  const created = await db.transaction(async (tx) => {
    const [link] = await tx
      .select()
      .from(paymentLinks)
      .where(eq(paymentLinks.publicToken, publicToken))
      .for("update");
    if (!link) return { kind: "not_payable", state: "not_found" } as const;

    const state = linkState(link);
    if (state !== "active") return { kind: "not_payable", state } as const;

    const [{ last }] = await tx
      .select({ last: sql<number>`coalesce(max(${paymentAttempts.attemptNo}), 0)::int` })
      .from(paymentAttempts)
      .where(eq(paymentAttempts.linkId, link.id));
    if (last >= MAX_ATTEMPTS_PER_LINK) return { kind: "not_payable", state: "too_many_attempts" } as const;

    const attemptNo = last + 1;
    const [attempt] = await tx
      .insert(paymentAttempts)
      .values({
        linkId: link.id,
        attemptNo,
        provider: "converge",
        environment: gateway.environment,
        // Letters and digits only: `PW-10007` attempt 1 → `PW10007N1`. With
        // hyphens (`PW-10007-1`) the demo issued the session, then its hosted
        // page failed every card with errorType SYSTEM, while a Buy Button
        // sale (no invoice) by the same API user approved (2026-10-03).
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

  if (created.kind !== "created") return created;
  const { link, attempt } = created;

  const session = await gateway.createSession({
    amountCents: attempt.amountCents,
    invoiceNumber: attempt.providerInvoiceNumber,
  });

  await db.transaction(async (tx) => {
    if (session.ok) {
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
  return { kind: "redirect", hostedPageUrl: session.hostedPageUrl, token: session.token };
}

/* ===========================================================================
   Verification — the only path to `approved`
   =========================================================================== */

export type ResolveOutcome = "approved" | "duplicate" | "declined" | "unchanged" | "mismatch";

/**
 * Apply one gateway-verified transaction to its attempt. `txn` comes from a
 * server-side query (`return`) or from Converge's authenticated export-script
 * POST (`notify`, D119), never from the browser. Whichever path moves the
 * attempt sends the shop's email; the other sees `unchanged` and sends none.
 */
async function resolveAttempt(
  attemptId: string,
  txn: GatewayTransaction,
  source: "return" | "notify",
  db: Database,
): Promise<ResolveOutcome> {
  const outcome = await applyTransaction(attemptId, txn, source, db);
  if (outcome === "approved" || outcome === "duplicate") {
    // After the commit, outside the transaction: a slow or failed send never
    // holds a row lock or undoes a payment (D120).
    const [row] = await db
      .select({ link: paymentLinks, attempt: paymentAttempts })
      .from(paymentAttempts)
      .innerJoin(paymentLinks, eq(paymentLinks.id, paymentAttempts.linkId))
      .where(eq(paymentAttempts.id, attemptId));
    if (row) await sendPaymentEmail(outcome, row.link, row.attempt);
  }
  return outcome;
}

async function applyTransaction(
  attemptId: string,
  txn: GatewayTransaction,
  source: "return" | "notify",
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

    // A final attempt only ever moves forward to an approval (a decline
    // followed by an approved retry on the same hosted page).
    const isFinal = attempt.status !== "pending" && attempt.status !== "failed" && attempt.status !== "expired";
    if (isFinal && !(attempt.status === "declined" && txn.outcome === "approved")) {
      await event(tx, { ...base, type: "attempt.verified_ignored", data: { ...data, current: attempt.status } });
      return "unchanged";
    }

    const now = new Date();
    const cardFields = {
      providerTxnId: txn.txnId,
      approvalCode: txn.approvalCode,
      resultMessage: txn.resultMessage,
      cardBrand: txn.cardBrand,
      cardLast4: txn.cardLast4,
      verifiedAt: now,
    };

    if (txn.outcome === "declined") {
      await tx.update(paymentAttempts).set({ status: "declined", ...cardFields }).where(eq(paymentAttempts.id, attemptId));
      await event(tx, { ...base, type: "attempt.declined", data });
      return "declined";
    }

    // Approved. Money moved. Paid link, or a cancelled one (the customer was
    // already on the hosted page when staff cancelled) → a refund to issue.
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

const TXN_ID_SHAPE = /^[A-Za-z0-9-]{1,64}$/;
/** Current `PW10007N1`, or the hyphenated `PW-10007-1` of attempts made
 *  before 2026-10-03 (still in the database, still matchable). */
const INVOICE_SHAPE = /^(PW\d+N\d+|PW-\d+-\d+)$/;

export function invoiceNumberFor(reference: string, attemptNo: number): string {
  return `${reference.replace(/[^A-Za-z0-9]/g, "")}N${attemptNo}`;
}

/* ===========================================================================
   The return redirect (LA-01/LA-02, D145 audit; D146)
   ===========================================================================

   `/pay/return` is the customer's browser coming back from the hosted page,
   so anyone can call it with anything. Two rules hold whatever it carries:

     1. **No gateway call unless the return is bound to an attempt we
        started.** The `pw_pay` cookie (set by the Pay button, 30 minutes)
        must name a link; that link's attempt must still be open (pending, or
        declined when a different transaction id arrives: the approval that
        can follow a decline on the same hosted page); an invoice number in
        the return must be one of that link's. Each attempt answers at most
        one completed query per lookup (a transaction id, or its own invoice)
        and `MAX_RETURN_QUERIES_PER_ATTEMPT` queries in all. The claim is an
        event row written under the link's row lock before the network call,
        so two returns at once cannot both query. A failed query is recorded
        against its claim and may be retried within the cap.
     2. **The redirect never comes from return data.** The customer is sent
        to `/pay/<token>` only for the link their own cookie names; everyone
        else gets the neutral `/pay/done`. Invoice numbers are sequential, so
        a lookup by a browser-sent invoice would hand out another customer's
        capability URL.

   No event row is written for a return without that cookie-bound attempt. */

/** Gateway queries one attempt may cause from `/pay/return`, whatever comes
 *  back: the first, a retry after a failed query, and the approval that can
 *  follow a decline. With `MAX_ATTEMPTS_PER_LINK` that bounds one link at 30
 *  return queries beside its 10 session requests. */
const MAX_RETURN_QUERIES_PER_ATTEMPT = 3;

/** A query is about to run for this attempt (written before the call). */
const RETURN_QUERY = "attempt.return_query";
/** That query failed (transport, HTTP or gateway error): the claim may be retried. */
const RETURN_QUERY_FAILED = "attempt.return_query_failed";
/** The customer came back on a transaction already settled (by `/pay/notify`
 *  or an earlier return). Written once per attempt. */
const RETURN_RECEIVED = "attempt.return_received";

/** `randomBytes(16)` base64url is 22 characters; the page accepts 22–64. */
const PUBLIC_TOKEN_SHAPE = /^[A-Za-z0-9_-]{22,64}$/;

/** What the gateway is asked: the transaction the browser named, or, when it
 *  named none, the attempt's own invoice number. */
type ReturnLookup = { via: "txn_id"; txnId: string } | { via: "invoice" };

function lookupKey(lookup: ReturnLookup): string {
  return lookup.via === "txn_id" ? `txn:${lookup.txnId}` : "invoice";
}

function dataField(data: unknown, name: string): unknown {
  return data !== null && typeof data === "object" ? (data as Record<string, unknown>)[name] : undefined;
}

/** The link the browser's own `pw_pay` cookie names. Untrusted like the rest,
 *  but holding it means holding the link's capability URL already. */
async function findCookieLink(token: string | null, db: Database): Promise<PaymentLink | null> {
  if (!token || !PUBLIC_TOKEN_SHAPE.test(token)) return null;
  const [link] = await db.select().from(paymentLinks).where(eq(paymentLinks.publicToken, token));
  return link ?? null;
}

/** The attempt this return may query the gateway about, or null. Read-only;
 *  `claimReturnQuery` runs it again under the link's row lock. */
async function eligibleAttempt(
  tx: Tx,
  linkId: string,
  claimedInvoice: string | null,
  lookup: ReturnLookup,
): Promise<PaymentAttempt | null> {
  const [attempt] = claimedInvoice
    ? await tx
        .select()
        .from(paymentAttempts)
        .where(and(eq(paymentAttempts.linkId, linkId), eq(paymentAttempts.providerInvoiceNumber, claimedInvoice)))
    : await tx
        .select()
        .from(paymentAttempts)
        .where(eq(paymentAttempts.linkId, linkId))
        .orderBy(desc(paymentAttempts.attemptNo))
        .limit(1);
  if (!attempt) return null;

  const open =
    attempt.status === "pending" ||
    (attempt.status === "declined" && lookup.via === "txn_id" && lookup.txnId !== attempt.providerTxnId);
  if (!open) return null;

  const rows = await tx
    .select({ id: paymentEvents.id, type: paymentEvents.type, data: paymentEvents.data })
    .from(paymentEvents)
    .where(and(eq(paymentEvents.attemptId, attempt.id), inArray(paymentEvents.type, [RETURN_QUERY, RETURN_QUERY_FAILED])));
  const claims = rows.filter((row) => row.type === RETURN_QUERY);
  if (claims.length >= MAX_RETURN_QUERIES_PER_ATTEMPT) return null;

  const failed = new Set(rows.filter((row) => row.type === RETURN_QUERY_FAILED).map((row) => dataField(row.data, "claim")));
  const key = lookupKey(lookup);
  const answered = claims.some((claim) => dataField(claim.data, "key") === key && !failed.has(claim.id));
  return answered ? null : attempt;
}

/** Atomically claim one gateway query for this return: lock the link (the
 *  order every writer takes), re-check, record the claim, commit. */
async function claimReturnQuery(
  db: Database,
  linkId: string,
  claimedInvoice: string | null,
  lookup: ReturnLookup,
): Promise<{ claimId: number; attempt: PaymentAttempt } | null> {
  return db.transaction(async (tx) => {
    const [locked] = await tx.select({ id: paymentLinks.id }).from(paymentLinks).where(eq(paymentLinks.id, linkId)).for("update");
    if (!locked) return null;
    const attempt = await eligibleAttempt(tx, linkId, claimedInvoice, lookup);
    if (!attempt) return null;
    const [claim] = await tx
      .insert(paymentEvents)
      .values({
        linkId,
        attemptId: attempt.id,
        type: RETURN_QUERY,
        actor: "customer",
        data: { key: lookupKey(lookup), via: lookup.via, txn_id: lookup.via === "txn_id" ? lookup.txnId : null },
      })
      .returning({ id: paymentEvents.id });
    return { claimId: claim.id, attempt };
  });
}

/** One `attempt.return_received` per attempt, however often the customer
 *  reloads or repeats the return. */
async function recordSettledReturn(settled: { linkId: string; attemptId: string }, txnId: string, db: Database) {
  await db.transaction(async (tx) => {
    await tx.select({ id: paymentLinks.id }).from(paymentLinks).where(eq(paymentLinks.id, settled.linkId)).for("update");
    const [seen] = await tx
      .select({ id: paymentEvents.id })
      .from(paymentEvents)
      .where(and(eq(paymentEvents.attemptId, settled.attemptId), eq(paymentEvents.type, RETURN_RECEIVED)))
      .limit(1);
    if (seen) return;
    await event(tx, {
      linkId: settled.linkId,
      attemptId: settled.attemptId,
      type: RETURN_RECEIVED,
      actor: "customer",
      data: { txn_id: txnId, verified: true, settled: true },
    });
  });
}

/**
 * The browser came back from the hosted page (`fields` untrusted, possibly
 * empty). Returns the public token of the link the browser's own cookie
 * names, so the caller can send the customer back to their page, or null
 * (the neutral page). See the rules above.
 *
 * When the export script has already settled this transaction (D119), the
 * attempt row says so and no gateway query is made: one Fixie request per
 * payment instead of two. `notifyGraceMs` > 0 (only while `/pay/notify` is
 * enabled) waits that long for the POST before querying, and only for a
 * return that would otherwise query.
 *
 * `getGateway` is called only when a query is about to run, so a return that
 * queries nothing needs no gateway configuration.
 */
export async function handleReturn(
  fields: { txnId: string | null; invoiceNumber: string | null },
  getGateway: () => Gateway,
  db: Database = getDb(),
  options: { notifyGraceMs?: number; cookieToken?: string | null } = {},
): Promise<string | null> {
  const link = await findCookieLink(options.cookieToken ?? null, db);
  if (!link) return null;

  const txnId = fields.txnId && TXN_ID_SHAPE.test(fields.txnId) ? fields.txnId : null;
  const claimedInvoice = fields.invoiceNumber && INVOICE_SHAPE.test(fields.invoiceNumber) ? fields.invoiceNumber : null;
  const lookup: ReturnLookup = txnId ? { via: "txn_id", txnId } : { via: "invoice" };

  if (txnId) {
    const open = await db.transaction((tx) => eligibleAttempt(tx, link.id, claimedInvoice, lookup));
    const settled = await findSettled(txnId, db, open ? (options.notifyGraceMs ?? 0) : 0);
    if (settled) {
      if (settled.linkId === link.id) await recordSettledReturn(settled, txnId, db);
      return link.publicToken;
    }
    if (!open) return link.publicToken;
  }

  let gateway: Gateway;
  try {
    gateway = getGateway();
  } catch (error) {
    console.error(JSON.stringify({ at: "payments.handleReturn", detail: error instanceof Error ? error.message : "unknown" }));
    return link.publicToken;
  }

  const claim = await claimReturnQuery(db, link.id, claimedInvoice, lookup);
  if (!claim) return link.publicToken;

  const result =
    lookup.via === "txn_id"
      ? await gateway.getTransaction(lookup.txnId)
      : await gateway.findByInvoice(claim.attempt.providerInvoiceNumber);
  if (!result.ok) {
    console.error(JSON.stringify({ at: "payments.handleReturn", via: lookup.via, detail: result.detail }));
    await db.insert(paymentEvents).values({
      linkId: link.id,
      attemptId: claim.attempt.id,
      type: RETURN_QUERY_FAILED,
      actor: "system",
      data: { claim: claim.claimId },
    });
    return link.publicToken;
  }

  if (lookup.via === "txn_id") {
    const txn = result.transactions.find((t) => t.txnId === lookup.txnId);
    if (!txn) return link.publicToken;
    // The gateway's invoice number names the attempt, and it must be one of
    // this link's: a transaction for another link is left to its own return
    // or to `/pay/notify`.
    const [target] = txn.invoiceNumber
      ? await db
          .select({ id: paymentAttempts.id })
          .from(paymentAttempts)
          .where(and(eq(paymentAttempts.linkId, link.id), eq(paymentAttempts.providerInvoiceNumber, txn.invoiceNumber)))
      : [];
    if (!target) {
      console.error(JSON.stringify({ at: "payments.handleReturn", foreignTransaction: true, txnId: txn.txnId }));
      return link.publicToken;
    }
    await resolveAttempt(target.id, txn, "return", db);
    return link.publicToken;
  }

  // No transaction id: Converge's empty POST after a hosted-page failure
  // (seen 2026-10-02/03), or a return carrying only our invoice. A decline
  // then an approval on the same hosted page: apply in that order, so the
  // attempt ends approved (`applyTransaction` only moves forward).
  const found = result.transactions.filter((t) => t.invoiceNumber === claim.attempt.providerInvoiceNumber);
  const order = { declined: 0, other: 1, approved: 2 } as const;
  for (const txn of [...found].sort((a, b) => order[a.outcome] - order[b.outcome])) {
    await resolveAttempt(claim.attempt.id, txn, "return", db);
  }
  return link.publicToken;
}

const NOTIFY_POLL_MS = 500;

/** An attempt already verified under this gateway txn id: only a server-side
 *  path (query or notify) can have written `provider_txn_id` + `verified_at`,
 *  so the browser naming it proves nothing it could forge. */
async function findSettled(txnId: string, db: Database, graceMs: number) {
  const deadline = Date.now() + graceMs;
  for (;;) {
    const [row] = await db
      .select({ attemptId: paymentAttempts.id, linkId: paymentLinks.id, publicToken: paymentLinks.publicToken })
      .from(paymentAttempts)
      .innerJoin(paymentLinks, eq(paymentLinks.id, paymentAttempts.linkId))
      .where(and(eq(paymentAttempts.providerTxnId, txnId), isNotNull(paymentAttempts.verifiedAt)));
    if (row || Date.now() + NOTIFY_POLL_MS > deadline) return row ?? null;
    await new Promise((resolve) => setTimeout(resolve, NOTIFY_POLL_MS));
  }
}

export type NotifyResult = ResolveOutcome | "unmatched";

/**
 * Converge's export script reported a transaction (D119). The route has
 * already checked Elavon's source range and the agreed credentials; `txn` is
 * what Converge posted. Matched by the invoice number we sent on the session,
 * then held to the same amount and invoice checks as a query result.
 */
export async function handleNotify(txn: GatewayTransaction, db: Database = getDb()): Promise<NotifyResult> {
  const invoice = txn.invoiceNumber && INVOICE_SHAPE.test(txn.invoiceNumber) ? txn.invoiceNumber : null;
  if (!invoice || !TXN_ID_SHAPE.test(txn.txnId)) return "unmatched";

  const [row] = await db
    .select({ attemptId: paymentAttempts.id, linkId: paymentAttempts.linkId })
    .from(paymentAttempts)
    .where(eq(paymentAttempts.providerInvoiceNumber, invoice));
  if (!row) return "unmatched";

  await db.insert(paymentEvents).values({
    linkId: row.linkId,
    attemptId: row.attemptId,
    type: "attempt.notify_received",
    actor: "provider",
    data: { txn: txn.raw },
  });
  return resolveAttempt(row.attemptId, txn, "notify", db);
}
