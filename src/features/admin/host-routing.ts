/* ---------------------------------------------------------------------------
   Admin host routing — which host serves the admin, and at what paths (D115)

   The one decision `src/proxy.ts` makes, kept as a pure function so it can be
   tested without Next, a server or `node_modules`: no imports, no request
   objects, strings in and a plain result out. `proxy.ts` is only the adapter
   that reads the request and turns the result into a `NextResponse`.

   The rules:
     - **The admin lives on its own host and its URLs carry no `/admin`.**
       Owner, 2026-10-01: *"since the admin portal stays on a subdomain admin.xxx
       we should not build admin routes as /admin"*. On an admin host every
       path is served from the `src/app/admin/` folder: `/` from `/admin`,
       `/products` from `/admin/products`. The folder name is an internal
       detail Next needs (it cannot route by hostname, and `/` is the
       storefront home); it never appears in a URL.
     - **`/admin` itself is a 404 everywhere.** On an admin host it is served
       from `/admin/admin`, which no page answers, so the admin's own 404
       renders. No redirect from the old prefixed URLs: the site is not live
       and the owner ruled bookmarks don't matter.
     - **Any other host never serves the admin.** `/admin/**` there is a 404.
       Previews have no admin host, so previews have no admin (owner ruling,
       2026-10-01).
     - **`PAY_HOST` (D105), production only:** `/pay` and everything under it
       passes — the customer's `/pay/<token>` page and Stripe's
       `/pay/webhook` — and any other path is a 404. Elsewhere `/pay` is a 404.
       Unchanged by D115. That 404 is the pay host's own (D145 audit; D151):
       a stray path is served from `PAY_NOT_FOUND_PATH`, which only ever
       renders `src/app/pay/not-found.tsx`, the page with the shop's phone and
       email. The storefront's 404 answered before, and every link on it was
       itself a 404 on the pay host.

   Which hosts count as the admin host: `ADMIN_HOST` always, and outside
   production also `admin.localhost`, so `next dev` can still reach the admin
   at `http://admin.localhost:3000/` (browsers resolve `*.localhost` to this
   machine). Production accepts `ADMIN_HOST` only.

   `PAY_HOST` lives here beside `ADMIN_HOST` because this module is the one
   place host rules are decided; `src/features/payments/config.ts` repeats the
   literal to build link URLs (this file has no imports, by design).
   --------------------------------------------------------------------------- */

/** The admin's one production hostname (D96). Wired 2026-09-23: a DNS-only
 *  Cloudflare CNAME to Vercel. Duplicated as a literal in `src/proxy.ts`'s
 *  `matcher` and in `next.config.ts`'s header rules, because Next requires
 *  those values to be static — change all three together. */
export const ADMIN_HOST = "admin.platinumwheels.ca";

/** The development admin host. Never accepted in production. */
export const DEV_ADMIN_HOST = "admin.localhost";

/** The customer payment hostname (D105): a DNS-only Cloudflare CNAME to
 *  Vercel, like `ADMIN_HOST`. Duplicated in `src/proxy.ts`'s `matcher` and in
 *  `src/features/payments/config.ts` — change all three. */
export const PAY_HOST = "pay.platinumwheels.ca";

/** Where a stray path on `PAY_HOST` is served from. `src/app/pay/page.tsx`
 *  answers it with `notFound()`, so it renders the pay host's own 404 with a
 *  real 404 status. */
export const PAY_NOT_FOUND_PATH = "/pay";

/** The folder under `src/app/` that holds every admin page. Internal only. */
export const ADMIN_FOLDER = "/admin";

export type HostRoutingDecision =
  | { kind: "pass" }
  | { kind: "rewrite"; pathname: string }
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

export function isAdminHost(host: string | null, isProduction: boolean): boolean {
  const normalized = normalizeHost(host);
  return normalized === ADMIN_HOST || (!isProduction && normalized === DEV_ADMIN_HOST);
}

/** `/admin` and anything under `/admin/`, but not `/administrator` or
 *  `/admin-tools`, which merely share the prefix. */
export function isAdminPath(pathname: string): boolean {
  return pathname === ADMIN_FOLDER || pathname.startsWith(`${ADMIN_FOLDER}/`);
}

/** `/pay` and anything under `/pay/`, but not `/payments` or `/pay-later`. */
export function isPayPath(pathname: string): boolean {
  return pathname === "/pay" || pathname.startsWith("/pay/");
}

/** The internal path an admin-host URL is served from: `/` → `/admin`,
 *  `/products/new` → `/admin/products/new`. */
export function adminFolderPath(pathname: string): string {
  return pathname === "/" ? ADMIN_FOLDER : `${ADMIN_FOLDER}${pathname}`;
}

/** The storefront host that sits beside an admin host:
 *  `admin.localhost:3000` → `localhost:3000`. Outside production the
 *  customer's `/pay` page is served there, because an admin host serves only
 *  the admin; production uses `PAY_HOST` instead. Any other host is returned
 *  as it is. */
export function storefrontHost(host: string): string {
  return host.replace(/^admin\./i, "");
}

export function decideHostRouting({
  host,
  pathname,
  isProduction,
}: HostRoutingInput): HostRoutingDecision {
  if (isAdminHost(host, isProduction)) {
    // Every path, `/admin/...` included: that one lands on `/admin/admin/...`,
    // which no page answers, so the admin's own 404 renders.
    return { kind: "rewrite", pathname: adminFolderPath(pathname) };
  }

  if (isAdminPath(pathname)) return { kind: "not-found" };

  if (!isProduction) return { kind: "pass" };

  if (normalizeHost(host) === PAY_HOST) {
    return isPayPath(pathname) ? { kind: "pass" } : { kind: "rewrite", pathname: PAY_NOT_FOUND_PATH };
  }

  return isPayPath(pathname) ? { kind: "not-found" } : { kind: "pass" };
}
