/* ---------------------------------------------------------------------------
   Payments contract — what the service layer needs from a gateway, and what
   pages read back. The Stripe adapter (`stripe.ts`) implements `Gateway`;
   `service.ts` only ever talks to this interface, so its money logic can be
   exercised against a fake gateway without a network or a card.
   --------------------------------------------------------------------------- */

import type { PaymentAttempt, PaymentLink } from "@/db/schema";

/** A link's state as people see it. `expired` is derived, never stored
 *  (`src/db/schema.ts` `paymentLinkStatus`). */
export type LinkState = "active" | "paid" | "cancelled" | "expired";

export function linkState(link: Pick<PaymentLink, "status" | "expiresAt">, now = new Date()): LinkState {
  if (link.status === "active" && link.expiresAt.getTime() <= now.getTime()) return "expired";
  return link.status;
}

export interface SessionRequest {
  /** Names the idempotency key: the same attempt always asks the same thing. */
  attemptId: string;
  /** Sent as `client_reference_id`; the attempt's own `PW10001N2`. */
  invoiceNumber: string;
  /** The link's `PW-10001`, shown on the Stripe page and in the Dashboard. */
  reference: string;
  amountCents: number;
  description: string;
  /** `/pay/<token>`, absolute: where Stripe sends the customer back to. */
  returnUrl: string;
  /** Fixed when the attempt row was written, so a retry sends identical params. */
  expiresAt: Date;
}

export type SessionResult =
  | { ok: true; sessionId: string; url: string; expiresAt: Date }
  /** Stripe unreachable, rejected the request, or we are misconfigured. The
   *  customer is told to try later or call, never that their card failed. */
  | { ok: false; reason: "unavailable"; detail: string };

/** One completed payment as Stripe reports it, after our own checks. */
export interface GatewayTransaction {
  /** The PaymentIntent id (`pi_...`). */
  txnId: string;
  /** `client_reference_id`: the attempt's invoice number. */
  invoiceNumber: string | null;
  amountCents: number | null;
  /** `approved` only when every check in `toGatewayTransaction` passed (paid,
   *  complete, CAD, matching mode, no adjustments). Anything odd is `other`. */
  outcome: "approved" | "other";
  resultMessage: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  /** Whitelisted, redaction-safe copy for `payment_events.data`. */
  raw: Record<string, string>;
}

/** Who paid, from the Checkout Session. For the shop's email only: never
 *  stored, never logged (plan v3 §8.3). */
export interface Payer {
  name: string | null;
  email: string | null;
  phone: string | null;
  postalCode: string | null;
}

export interface GatewaySession {
  sessionId: string;
  status: "open" | "complete" | "expired";
  /** Where to send the customer; present only while the session is open. */
  url: string | null;
  expiresAt: Date;
  /** Present when the session is complete. */
  txn: GatewayTransaction | null;
  payer: Payer | null;
}

export type RetrieveResult = { ok: true; session: GatewaySession } | { ok: false; detail: string };

export interface Gateway {
  environment: "demo" | "production";
  /** Whether a webhook or session carrying this `livemode` belongs to us. */
  livemode: boolean;
  createSession(request: SessionRequest): Promise<SessionResult>;
  retrieveSession(sessionId: string): Promise<RetrieveResult>;
  /** Close an open session. Best effort; "already closed" is not an error. */
  expireSession(sessionId: string): Promise<void>;
}

export type { PaymentAttempt, PaymentLink };
