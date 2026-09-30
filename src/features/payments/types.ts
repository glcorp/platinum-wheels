/* ---------------------------------------------------------------------------
   Payments contract — what the service layer needs from a gateway, and what
   pages read back. The Converge adapter (`converge.ts`) implements `Gateway`;
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
  amountCents: number;
  invoiceNumber: string;
  description: string;
}

export type SessionResult =
  /** The browser must POST `token` as `ssl_txn_auth_token` to `hostedPageUrl`
   *  (Elavon's documented hand-off). */
  | { ok: true; hostedPageUrl: string; token: string }
  /** `unavailable`: proxy quota, timeout, gateway down or misconfigured. The
   *  customer is told to try later or call, never that their card failed. */
  | { ok: false; reason: "unavailable"; detail: string };

/** One transaction as the gateway's server-side query reports it. */
export interface GatewayTransaction {
  txnId: string;
  invoiceNumber: string | null;
  amountCents: number | null;
  /** `approved` only when the gateway says approved and not voided/reversed. */
  outcome: "approved" | "declined" | "other";
  resultMessage: string | null;
  approvalCode: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  /** Whitelisted, redaction-safe copy for `payment_events.data`. */
  raw: Record<string, string>;
}

export type QueryResult =
  | { ok: true; transactions: GatewayTransaction[] }
  | { ok: false; detail: string };

export interface Gateway {
  environment: "demo" | "production";
  createSession(request: SessionRequest): Promise<SessionResult>;
  /** Look up one transaction by the gateway's id (the return redirect). */
  getTransaction(txnId: string): Promise<QueryResult>;
}

export type { PaymentAttempt, PaymentLink };
