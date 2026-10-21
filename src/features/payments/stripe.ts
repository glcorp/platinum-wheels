/* ---------------------------------------------------------------------------
   The Stripe adapter — the only file that speaks Stripe's wire format.

   `service.ts` talks to the `Gateway` interface (`types.ts`); this implements
   it with hosted Checkout Sessions (`docs/payments.md`). What it owns:

     - the lazily built client (`new Stripe()` at import time would throw during
       `next build`, where no key exists);
     - `createSession`: one Checkout Session built from the attempt row (amount,
       description, reference), never from anything the browser sent;
     - `retrieveSession`: re-reads a session from Stripe and turns it into a
       `GatewayTransaction` only if every check in `toGatewayTransaction` holds;
     - `expireSession`.

   The webhook signature check lives in `src/app/pay/webhook/route.ts`.

   No card data passes through here: Stripe's page takes the card (PCI SAQ A).
   The secret key is read in `config.ts` and never logged or returned.
   --------------------------------------------------------------------------- */

import Stripe from "stripe";

import { getStripeConfig, type StripeConfig } from "./config";
import type { Gateway, GatewaySession, GatewayTransaction, Payer, RetrieveResult, SessionRequest, SessionResult } from "./types";

/** Pinned: a future SDK major must not silently change response shapes. */
const API_VERSION = "2026-09-30.endive";

let client: { key: string; stripe: Stripe } | null = null;

/** The client for the configured key. Test and fixture runs may point it at a
 *  local fake (`STRIPE_API_HOST` / `STRIPE_API_PORT`), only with a **test** key
 *  and never in production. */
function getClient(config: StripeConfig): Stripe {
  if (client?.key === config.secretKey) return client.stripe;
  const host = process.env.STRIPE_API_HOST?.trim();
  const override =
    host && !config.livemode && process.env.VERCEL_ENV !== "production"
      ? { host, port: Number(process.env.STRIPE_API_PORT ?? 80), protocol: "http" as const }
      : {};
  const stripe = new Stripe(config.secretKey, {
    apiVersion: API_VERSION,
    // A hung call must not hold a server action for Stripe's 80 s default.
    timeout: 15_000,
    maxNetworkRetries: 1,
    ...override,
  });
  client = { key: config.secretKey, stripe };
  return stripe;
}

/** The webhook route needs the same client for `constructEvent`. */
export function stripeClient(): Stripe {
  return getClient(getStripeConfig());
}

const toDate = (unixSeconds: number) => new Date(unixSeconds * 1000);

/** Stripe's card-statement suffix: letters, digits, spaces and a few symbols,
 *  at most 22 characters in all with the account's prefix, and the account
 *  needs a shortened prefix set first. Off unless `STRIPE_STATEMENT_SUFFIX=1`
 *  (plan v3 §5 step 5): a wrong account setting would reject every session. */
function statementSuffix(reference: string): string | undefined {
  if (process.env.STRIPE_STATEMENT_SUFFIX !== "1") return undefined;
  return /^[A-Za-z0-9 -]{1,10}$/.test(reference) && /[A-Za-z]/.test(reference) ? reference : undefined;
}

function errorDetail(error: unknown): string {
  if (error instanceof Stripe.errors.StripeError) {
    return `${error.type}${error.code ? `/${error.code}` : ""}${error.statusCode ? ` http ${error.statusCode}` : ""}: ${error.message}`.slice(0, 300);
  }
  return error instanceof Error ? error.name : "unknown";
}

/**
 * Turn a retrieved, **complete** session into a transaction. `approved` only
 * when every check holds; anything else is `other` and is recorded for staff,
 * never marks a link paid (plan v3 §0 #9):
 *
 *   - session `complete` and `payment_status === "paid"` (`complete` alone is
 *     not proof: processing may still be under way);
 *   - currency `cad`;
 *   - `livemode` equals the key's (a test session never settles a live link);
 *   - `amount_total === amount_subtotal` (no tax, discount or shipping crept in);
 *   - a PaymentIntent id exists.
 */
export function toGatewayTransaction(session: Stripe.Checkout.Session, livemode: boolean): GatewayTransaction {
  const intent = typeof session.payment_intent === "string" ? null : session.payment_intent;
  const intentId = typeof session.payment_intent === "string" ? session.payment_intent : (intent?.id ?? null);
  const charge = intent && typeof intent.latest_charge === "object" ? intent.latest_charge : null;
  const card = charge?.payment_method_details?.card ?? null;

  const checks = {
    complete: session.status === "complete",
    paid: session.payment_status === "paid",
    cad: session.currency === "cad",
    mode: session.livemode === livemode,
    untouched: session.amount_total === session.amount_subtotal,
    intent: intentId !== null,
  };
  const approved = Object.values(checks).every(Boolean);

  const raw: Record<string, string> = {
    session: session.id,
    status: String(session.status),
    payment_status: String(session.payment_status),
    currency: String(session.currency),
    livemode: String(session.livemode),
  };
  if (session.amount_total !== null) raw.amount_total = String(session.amount_total);
  if (session.amount_subtotal !== null) raw.amount_subtotal = String(session.amount_subtotal);
  if (intentId) raw.payment_intent = intentId;
  if (card?.brand) raw.card_brand = String(card.brand);
  if (!approved) raw.failed_checks = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name).join(",");

  return {
    txnId: intentId ?? session.id,
    invoiceNumber: session.client_reference_id ?? null,
    amountCents: session.amount_total,
    outcome: approved ? "approved" : "other",
    resultMessage: String(session.payment_status),
    cardBrand: card?.brand ? String(card.brand).toUpperCase() : null,
    cardLast4: card?.last4 && /^[0-9]{4}$/.test(card.last4) ? card.last4 : null,
    raw,
  };
}

function toPayer(session: Stripe.Checkout.Session): Payer | null {
  const details = session.customer_details;
  if (!details) return null;
  return {
    name: details.name ?? null,
    email: details.email ?? null,
    phone: details.phone ?? null,
    postalCode: details.address?.postal_code ?? null,
  };
}

export function stripeGateway(): Gateway {
  const config = getStripeConfig();
  const stripe = getClient(config);

  return {
    environment: config.environment,
    livemode: config.livemode,

    async createSession(request: SessionRequest): Promise<SessionResult> {
      try {
        const session = await stripe.checkout.sessions.create(
          {
            mode: "payment",
            // Omitting `payment_method_types` is not enough: a Dashboard toggle
            // (Link, buy-now-pay-later, delayed debits) would then appear on a
            // C$1,000+ payment with no tested path. Cards only (plan §0 #5);
            // Apple Pay and Google Pay are cards.
            allowed_payment_method_types: ["card"],
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency: "cad",
                  unit_amount: request.amountCents,
                  product_data: { name: request.description.slice(0, 250) },
                },
              },
            ],
            client_reference_id: request.invoiceNumber,
            metadata: { attempt_id: request.attemptId, reference: request.reference },
            payment_intent_data: {
              description: `${request.reference} ${request.description}`.slice(0, 1000),
              metadata: { attempt_id: request.attemptId, reference: request.reference },
              statement_descriptor_suffix: statementSuffix(request.reference),
            },
            // Fraud signals on a high-ticket, resale-prone category (plan §8.4).
            billing_address_collection: "required",
            phone_number_collection: { enabled: true },
            payment_method_options: { card: { request_three_d_secure: "any" } },
            // The page reads the stored session, never this URL (plan §0 #7).
            success_url: `${request.returnUrl}?paid=1`,
            cancel_url: request.returnUrl,
            expires_at: Math.floor(request.expiresAt.getTime() / 1000),
          },
          // Identical params on a retry, so a retried call returns the same session.
          { idempotencyKey: `pw-${request.attemptId}` },
        );
        if (!session.url) return { ok: false, reason: "unavailable", detail: "session has no url" };
        return {
          ok: true,
          sessionId: session.id,
          url: session.url,
          expiresAt: toDate(session.expires_at),
        };
      } catch (error) {
        return { ok: false, reason: "unavailable", detail: errorDetail(error) };
      }
    },

    async retrieveSession(sessionId: string): Promise<RetrieveResult> {
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ["payment_intent.latest_charge"],
        });
        if (session.livemode !== config.livemode) return { ok: false, detail: "livemode mismatch" };
        const result: GatewaySession = {
          sessionId: session.id,
          status: session.status === "complete" ? "complete" : session.status === "expired" ? "expired" : "open",
          url: session.status === "open" ? (session.url ?? null) : null,
          expiresAt: toDate(session.expires_at),
          txn: session.status === "complete" ? toGatewayTransaction(session, config.livemode) : null,
          payer: session.status === "complete" ? toPayer(session) : null,
        };
        return { ok: true, session: result };
      } catch (error) {
        return { ok: false, detail: errorDetail(error) };
      }
    },

    async expireSession(sessionId: string): Promise<void> {
      try {
        await stripe.checkout.sessions.expire(sessionId);
      } catch {
        // Already complete or expired, or Stripe is down: either way there is
        // nothing more to do here, and the caller has already committed.
      }
    },
  };
}
