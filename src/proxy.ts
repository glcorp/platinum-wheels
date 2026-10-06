import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  ADMIN_FOLDER,
  PAY_HOST,
  PAY_NOT_FOUND_PATH,
  decideHostRouting,
  isAdminHost,
  normalizeHost,
} from "@/features/admin/host-routing";
import { productPageExists } from "@/features/catalog/queries";

/* ---------------------------------------------------------------------------
   Request proxy — host routing for the admin (D97, D115) and payments (D105)

   `proxy.ts`, not `middleware.ts`: Next 16 renamed the convention and
   `docs/decisions.md` §2 fixed this file name before it existed. It lives in
   `src/` because the app does; Next looks for it beside `app/`.

   It decides which hostname serves the admin and `/pay`, and serves the
   admin's prefix-less URLs from the `src/app/admin/` folder (D115). Every rule
   lives in `src/features/admin/host-routing.ts` as a pure function; this file
   only adapts a request to that function and its answer to a response.
   Nothing about sign-in happens here: the gate is `requireAdminSession()` in
   each page and every Server Action (D95), and it must stay there. Next's own
   docs warn that a matcher change can silently drop proxy coverage, so proxy
   is routing, never authorisation.

   **Why the matcher is narrow.** Without a matcher, proxy runs before every
   request on the site — every storefront page, the ones whose mobile LCP is
   already the one red gate (root `llm.md` §7.12). With this matcher it runs on
   `/admin` and `/pay` paths on any host, and on every non-asset path on the
   admin and pay hosts, and never on ordinary storefront traffic.

   **Undecodable paths (launch audit D145, SEC-EDGE; D151).** A path
   whose percent-encoding is malformed (`/products/%FF`, `/products/abc%`)
   makes Next throw "failed to decode param" while matching a dynamic
   segment: an unbranded 500 (or a dropped HTTP/2 stream) instead of a 404.
   Proxy answers it first with the branded 404. It can only do that where it
   runs, so the matcher takes two more entries: the storefront's dynamic
   routes `/products/**` and `/sitemaps/**`, where the audit measured the
   failure (both read the database per request already, so one edge hop more
   costs little), and any path that contains a `%` at all, which no page on
   this site has (slugs are `[a-z0-9-]`, D107b), so ordinary storefront
   traffic, and the static pages the LCP note above protects, still never
   reach proxy. If a platform ever decodes the path before testing the
   matcher, that second entry simply matches nothing; the first still holds.

   Server Actions are POSTs to the page's own URL, so an admin form posted to
   `/products` is rewritten to `/admin/products` like the page itself was
   (Next's proxy docs: "Server Functions … are handled as POST requests to the
   route where they are used").
   --------------------------------------------------------------------------- */

/** A path no route answers. Folders starting with `_` are private in the App
 *  Router, so this can never collide with a real page; rewriting to it renders
 *  `src/app/not-found.tsx` with a real 404 status, not a redirect that would
 *  advertise where the admin actually lives. */
const NOT_FOUND_PATH = "/_admin-not-served-on-this-host";

/** `/products/<slug>` and nothing deeper (`/products/<slug>/og.jpg` is a route
 *  handler that already answers a real 404 by itself). */
const PRODUCT_PAGE = /^\/products\/([^/]+)\/?$/;

/** `true` when the path cannot be percent-decoded. `nextUrl.pathname` is
 *  still encoded (WHATWG URL parsing never decodes), so this is the same
 *  decode Next's route matcher will attempt, run first. */
function isUndecodable(pathname: string): boolean {
  try {
    decodeURIComponent(pathname);
    return false;
  } catch {
    return true;
  }
}

/** The slug of a storefront product page request that should be checked
 *  against the catalogue, else `null`: only a document request (a browser
 *  navigation, a crawler, a link unfurler). Client navigations and prefetches
 *  carry an `RSC` header and are left alone: the page's own `notFound()`
 *  covers them. */
function productSlugToCheck(request: NextRequest): string | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (request.headers.has("rsc")) return null;
  const match = PRODUCT_PAGE.exec(request.nextUrl.pathname);
  // The path was already shown to be decodable above.
  return match ? decodeURIComponent(match[1]) : null;
}

export async function proxy(request: NextRequest) {
  if (isUndecodable(request.nextUrl.pathname)) {
    const host = request.headers.get("host");
    const isProduction = process.env.VERCEL_ENV === "production";
    // Each host's own 404: the admin's catch-all (`src/app/admin/[...missing]`)
    // on the admin host, the pay 404 on the pay host in production (the same
    // target `decideHostRouting` uses for a stray path there), the
    // storefront's everywhere else. No target carries the bad bytes.
    const target = isAdminHost(host, isProduction)
      ? `${ADMIN_FOLDER}/_undecodable`
      : isProduction && normalizeHost(host) === PAY_HOST
        ? PAY_NOT_FOUND_PATH
        : NOT_FOUND_PATH;
    return NextResponse.rewrite(new URL(target, request.url));
  }

  const decision = decideHostRouting({
    host: request.headers.get("host"),
    pathname: request.nextUrl.pathname,
    // Vercel sets `VERCEL_ENV` to `production`, `preview` or `development`;
    // outside Vercel (`next dev`, `next start`) it is unset. See
    // `host-routing.ts` for what production changes.
    isProduction: process.env.VERCEL_ENV === "production",
  });

  switch (decision.kind) {
    case "rewrite": {
      // Clone so the query string (`?page=2`, the list filters) is kept.
      const url = request.nextUrl.clone();
      url.pathname = decision.pathname;
      return NextResponse.rewrite(url);
    }
    case "not-found":
      return NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url));
    case "pass": {
      /* An unknown or hidden product is answered here, with the 404 document
         `/zzz` gets, rather than by `notFound()` thrown from the page: that
         throw reaches Next before the first byte is flushed, and Next answers
         it with a 404 status but an EMPTY `<html id="__next_error__">` shell
         that only a browser running JavaScript paints (measured on Next
         16.4.0-canary.37 with a bare `notFound()` page too; Next's own advice
         for a real 404 is a proxy check, `loading.md` "Status Codes"). The
         page keeps its `notFound()` for client navigations and for the instant
         a product is hidden between this check and the render. A database
         error lets the request through: an outage must never turn a real
         product into a 404. */
      const slug = productSlugToCheck(request);
      if (slug !== null) {
        let exists = true;
        try {
          exists = await productPageExists(slug);
        } catch {
          // Let the page decide; its own error boundary handles the outage.
        }
        if (!exists) {
          return NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url));
        }
      }
      return NextResponse.next();
    }
  }
}

export const config = {
  /* Literal values only: Next analyses `config` statically at build time and
     ignores anything computed, so `ADMIN_HOST` cannot be imported here. The
     hosts below duplicate `ADMIN_HOST`, `DEV_ADMIN_HOST` and `PAY_HOST` in
     `host-routing.ts` — change both. A `has` value is a regular expression
     matched against the whole header, so the dots are escaped. */
  matcher: [
    // Any host: the admin folder, so it can 404 everywhere it is asked for by
    // name.
    "/admin",
    "/admin/:path*",
    // The admin hosts: every path except build output (`_next/`) and public
    // files (anything with a dot — `.webp`, `favicon.ico`), so each can be
    // served from the admin folder. The dev host carries a port.
    {
      source: "/((?!_next/|.*\\..*).*)",
      has: [{ type: "header", key: "host", value: "admin\\.platinumwheels\\.ca" }],
    },
    {
      source: "/((?!_next/|.*\\..*).*)",
      has: [{ type: "header", key: "host", value: "admin\\.localhost(:\\d+)?" }],
    },
    // Payments (D105): `/pay` on any host, so production can 404 it off the
    // pay host, and every non-asset path on the pay host.
    "/pay",
    "/pay/:path*",
    // The undecodable-path 404 only (D145): the storefront's two dynamic
    // routes, and any path with a `%` in it. `decideHostRouting` passes every
    // decodable one straight through.
    "/products/:path*",
    "/sitemaps/:path*",
    "/:path(.*%.*)",
    {
      source: "/((?!_next/|.*\\..*).*)",
      has: [{ type: "header", key: "host", value: "pay\\.platinumwheels\\.ca" }],
    },
  ],
};
