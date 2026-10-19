/* ---------------------------------------------------------------------------
   Payments configuration — env vars and hostnames, read once, server only.

   Every Stripe setting comes from the environment (`docs/payments.md` §7).
   Nothing here is imported by a client component: the secret key and the
   webhook secret would ship to a browser.
   --------------------------------------------------------------------------- */

/** The customer-facing payment host (D105). A DNS-only Cloudflare CNAME to
 *  Vercel, like `admin.` (D96). The host rule itself is `PAY_HOST` in
 *  `src/features/admin/host-routing.ts`, repeated in `src/proxy.ts`'s
 *  `matcher` — change all three together. */
export const PAY_HOST = "pay.platinumwheels.ca";

/** Path prefix of every customer payment page: `/pay/<token>`. */
export const PAY_PATH_PREFIX = "/pay";

/** Our own misconfiguration, never a card problem: the customer is told to
 *  call, not that their payment failed. */
export class PaymentsNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(`Payments are not configured: missing ${missing.join(", ")}`);
    this.name = "PaymentsNotConfiguredError";
  }
}

/** The value a secret holds in Vercel until the owner pastes the real one. It
 *  counts as unset. */
const PLACEHOLDER = "REPLACE_ME";

function isSet(value: string | undefined): boolean {
  const trimmed = value?.trim() ?? "";
  return trimmed !== "" && trimmed !== PLACEHOLDER;
}

/** `sandbox` keys (`sk_test_`) record attempts as `demo`; live keys as
 *  `production` (the existing `payment_environment` values). */
export type PaymentEnvironment = "demo" | "production";

export interface StripeConfig {
  secretKey: string;
  /** `true` for a live key. Webhook events must carry the same value. */
  livemode: boolean;
  environment: PaymentEnvironment;
}

/** `sk_test_...`, `sk_live_...` or a restricted `rk_live_...`. Shape only. */
const KEY_SHAPE = /^(sk|rk)_(test|live)_[A-Za-z0-9]{16,}$/;

/**
 * The Stripe secret key, with the environment guards (plan v3 §0 #4):
 *
 *   - a malformed key is refused (a pasted quote, newline or `REPLACE_ME`
 *     never reaches Stripe);
 *   - a **live key is refused outside Vercel production**, so a Preview or a
 *     laptop can never take or refund real money;
 *   - a test key is refused when `STRIPE_REQUIRE_LIVE=1` (set at go-live), so
 *     the shop cannot silently run on the sandbox after launch.
 */
export function getStripeConfig(): StripeConfig {
  const env = process.env;
  if (!isSet(env.STRIPE_SECRET_KEY)) throw new PaymentsNotConfiguredError(["STRIPE_SECRET_KEY"]);
  const secretKey = env.STRIPE_SECRET_KEY!.trim();
  const match = KEY_SHAPE.exec(secretKey);
  if (!match) throw new PaymentsNotConfiguredError(["STRIPE_SECRET_KEY (not a Stripe secret key)"]);

  const livemode = match[2] === "live";
  if (livemode && env.VERCEL_ENV !== "production") {
    throw new PaymentsNotConfiguredError(["STRIPE_SECRET_KEY (a live key is only allowed in production)"]);
  }
  if (!livemode && env.STRIPE_REQUIRE_LIVE === "1") {
    throw new PaymentsNotConfiguredError(["STRIPE_SECRET_KEY (live mode is required)"]);
  }
  return { secretKey, livemode, environment: livemode ? "production" : "demo" };
}

/** `true` only with a usable live key. The admin says "test mode" otherwise. */
export function paymentsLive(): boolean {
  try {
    return getStripeConfig().livemode;
  } catch {
    return false;
  }
}

/** The webhook signing secrets: the current one, then the previous one while a
 *  rolled secret overlaps (Stripe keeps both valid for up to 24 hours). */
export function getWebhookSecrets(): string[] {
  const current = process.env.STRIPE_WEBHOOK_SECRET;
  if (!isSet(current)) throw new PaymentsNotConfiguredError(["STRIPE_WEBHOOK_SECRET"]);
  const secrets = [current!.trim()];
  const previous = process.env.STRIPE_WEBHOOK_SECRET_PREVIOUS;
  if (isSet(previous)) secrets.push(previous!.trim());
  return secrets;
}

/** Whether the secret key is usable, without throwing. The pay page uses it
 *  to show "pay by phone" instead of a button that cannot work. */
export function stripeConfigured(): boolean {
  try {
    getStripeConfig();
    return true;
  } catch {
    return false;
  }
}

/**
 * The kill switch. `PAYMENTS_ENABLED=0` (or `false`/`off`) turns taking
 * payments off: the pay page shows "pay by phone", no session is created.
 * The webhook keeps settling payments already in flight.
 */
export function paymentsEnabled(): boolean {
  const value = process.env.PAYMENTS_ENABLED?.trim().toLowerCase();
  return !(value === "0" || value === "false" || value === "off");
}

/**
 * Origin the customer's link is built on.
 *
 * Production: always `https://pay.platinumwheels.ca`, whichever host staff
 * generated the link from (they work on `admin.`). Previews and local dev: the
 * host the admin is being used on, so a preview's links open on that preview.
 */
export function publicPayOrigin(requestOrigin: string): string {
  return process.env.VERCEL_ENV === "production" ? `https://${PAY_HOST}` : requestOrigin;
}

export function payLinkUrl(origin: string, publicToken: string): string {
  return `${origin}${PAY_PATH_PREFIX}/${publicToken}`;
}
