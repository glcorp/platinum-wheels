/* ---------------------------------------------------------------------------
   Admin host routing — which host may serve `/admin` (D97)

   The one decision `src/proxy.ts` makes, kept as a pure function so it can be
   tested without Next, a server or `node_modules`: no imports, no request
   objects, strings in and a plain result out. `proxy.ts` is only the adapter
   that reads the request and turns the result into a `NextResponse`.

   The rules, production only:
     - On `ADMIN_HOST`, `/admin` and everything under it passes; any other path
       redirects to `/admin`, which the page gate (`requireAdminSession`) then
       sends to sign-in. The subdomain has no storefront on it.
     - On `PAY_HOST` (D105), `/pay` and everything under it passes — the
       customer's `/pay/<token>` page and Converge's `/pay/return` — and any
       other path is a 404. The subdomain serves payments and nothing else.
     - On every other host — the apex once it is wired, and the production
       `*.vercel.app` alias today — `/admin` and `/pay` are a 404. Each exists
       on exactly one hostname.

   `PAY_HOST` lives here beside `ADMIN_HOST` because this module is the one
   place host rules are decided; `src/features/payments/config.ts` repeats the
   literal to build link URLs (this file has no imports, by design).

   **Previews and local dev get no host rules at all.** A preview deployment is
   served on a generated `*.vercel.app` hostname, so blocking `/admin` off
   `ADMIN_HOST` there would make the admin impossible to preview. The gate in
   each page still applies everywhere; this file decides which hostnames may
   *serve* the admin, not who may use it.

   Paths keep their `/admin` prefix on the subdomain (`admin.platinumwheels.ca
   /admin/login`) rather than being rewritten onto `/`. Every redirect in the
   app targets `ADMIN_ROUTES` (`/admin`, `/admin/login`), so a prefix-stripping
   rewrite would need a second, host-aware copy of every one of them. This is
   the shape D90 promised: "the rewrite maps the subdomain onto these same
   paths … no route, component or import changes."
   --------------------------------------------------------------------------- */

/** The admin's one production hostname (D96). Wired 2026-09-23: a DNS-only
 *  Cloudflare CNAME to Vercel. Duplicated as a literal in `src/proxy.ts`'s
 *  `matcher`, because Next requires matcher values to be static constants —
 *  change both together. */
export const ADMIN_HOST = "admin.platinumwheels.ca";

/** The customer payment hostname (D105): a DNS-only Cloudflare CNAME to
 *  Vercel, like `ADMIN_HOST`. Duplicated in `src/proxy.ts`'s `matcher` and in
 *  `src/features/payments/config.ts` — change all three. */
export const PAY_HOST = "pay.platinumwheels.ca";

/** Where a stray path on the admin host is sent. Mirrors
 *  `ADMIN_ROUTES.home` in `types.ts`; not imported, to keep this module
 *  dependency-free and runnable on its own. */
export const ADMIN_HOME_PATH = "/admin";

export type HostRoutingDecision =
  | { kind: "pass" }
  | { kind: "redirect"; pathname: string }
  | { kind: "not-found" };

export interface HostRoutingInput {
  /** The request's `Host` header, as received. May carry a port or capitals. */
  host: string | null;
  pathname: string;
  /** `process.env.VERCEL_ENV === "production"`. False in previews and dev. */
  isProduction: boolean;
}

/** `admin.platinumwheels.ca:443` and `Admin.PlatinumWheels.ca` are the same
 *  host. Returns `""` for a missing header, which matches no host. */
export function normalizeHost(host: string | null): string {
  if (!host) return "";
  return host.trim().toLowerCase().replace(/:\d+$/, "");
}

/** `/admin` and anything under `/admin/`, but not `/administrator` or
 *  `/admin-tools`, which merely share the prefix. */
export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/** `/pay` and anything under `/pay/`, but not `/payments` or `/pay-later`. */
export function isPayPath(pathname: string): boolean {
  return pathname === "/pay" || pathname.startsWith("/pay/");
}

export function decideHostRouting({
  host,
  pathname,
  isProduction,
}: HostRoutingInput): HostRoutingDecision {
  if (!isProduction) return { kind: "pass" };

  const normalized = normalizeHost(host);

  if (normalized === ADMIN_HOST) {
    return isAdminPath(pathname)
      ? { kind: "pass" }
      : { kind: "redirect", pathname: ADMIN_HOME_PATH };
  }

  if (normalized === PAY_HOST) {
    return isPayPath(pathname) ? { kind: "pass" } : { kind: "not-found" };
  }

  return isAdminPath(pathname) || isPayPath(pathname) ? { kind: "not-found" } : { kind: "pass" };
}
