/* ---------------------------------------------------------------------------
   Payments configuration — env vars and hostnames, read once, server only.

   Every Converge setting comes from the environment (`docs/payments.md` §7).
   Nothing here is imported by a client component: `CONVERGE_PIN` and
   `FIXIE_URL` are secrets, and a client import would ship them to a browser.
   --------------------------------------------------------------------------- */

/** The customer-facing payment host (D105). A DNS-only Cloudflare CNAME to
 *  Vercel, like `admin.` (D96). The host rule itself is `PAY_HOST` in
 *  `src/features/admin/host-routing.ts`, repeated in `src/proxy.ts`'s
 *  `matcher` — change all three together. */
export const PAY_HOST = "pay.platinumwheels.ca";

/** Path prefix of every customer payment page: `/pay/<token>`. */
export const PAY_PATH_PREFIX = "/pay";

/** Cookie naming the link this browser last pressed Pay on, read by
 *  `/pay/return` when Converge comes back with an empty POST. */
export const PAY_RETURN_COOKIE = "pw_pay";

export type ConvergeEnvironment = "demo" | "production";

export interface ConvergeConfig {
  environment: ConvergeEnvironment;
  accountId: string;
  userId: string;
  pin: string;
  /** `http://fixie:<secret>@<host>:80`, or undefined to call Converge
   *  directly (only works from an IP on the account's allowed list). */
  proxyUrl: string | undefined;
}

/** Thrown when the gateway is not configured. Distinct from a gateway error:
 *  it is our misconfiguration, and the customer is told to call, never that
 *  their card failed. */
export class PaymentsNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(`Payments are not configured: missing ${missing.join(", ")}`);
    this.name = "PaymentsNotConfiguredError";
  }
}

/** The value Vercel holds until the owner pastes the real PIN. It must never
 *  reach Converge: five wrong PINs put the calling IP — the shared Fixie IPs —
 *  on Elavon's fraud list (`llm.md` Rules). So it counts as missing. */
const PLACEHOLDER = "REPLACE_ME";

function isSet(value: string | undefined): boolean {
  const trimmed = value?.trim() ?? "";
  return trimmed !== "" && trimmed !== PLACEHOLDER;
}

export function getConvergeConfig(): ConvergeConfig {
  const env = process.env;
  const missing = (
    ["CONVERGE_ENV", "CONVERGE_ACCOUNT_ID", "CONVERGE_USER_ID", "CONVERGE_PIN"] as const
  ).filter((name) => !isSet(env[name]));
  if (missing.length > 0) throw new PaymentsNotConfiguredError(missing);

  const environment = env.CONVERGE_ENV!.trim();
  if (environment !== "demo" && environment !== "production") {
    throw new PaymentsNotConfiguredError([`CONVERGE_ENV (got "${environment}", want demo | production)`]);
  }

  return {
    environment,
    accountId: env.CONVERGE_ACCOUNT_ID!.trim(),
    userId: env.CONVERGE_USER_ID!.trim(),
    pin: env.CONVERGE_PIN!.trim(),
    proxyUrl: env.FIXIE_URL?.trim() || undefined,
  };
}

/** The username and password Elavon's export script presents on
 *  `/pay/notify` (D119). Both unset, or either a placeholder: the route is off
 *  and answers 404, so nothing can post to it before Elavon has registered it. */
export interface NotifyCredentials {
  username: string;
  password: string;
}

export function getNotifyCredentials(): NotifyCredentials | null {
  const { CONVERGE_NOTIFY_USER: username, CONVERGE_NOTIFY_PASSWORD: password } = process.env;
  if (!isSet(username) || !isSet(password)) return null;
  return { username: username!.trim(), password: password!.trim() };
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
