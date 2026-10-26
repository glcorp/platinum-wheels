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
import { payLinkExists } from "@/features/payments/link-exists";

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

   **Product 404 (D157).** On `/products/<slug>` document requests proxy also
   reads the catalogue once (`productPageExists`) and answers an unknown or
   hidden slug with the branded 404, because a `notFound()` thrown from the
   page gives a 404 whose body only JavaScript paints. That is the one
   database read proxy makes (not kept: proxy has no data cache, D194); see
   the `pass` case below.

   **Kept product pages (D194).** A bare `/products/<slug>` request (a
   document, a client navigation or a prefetch alike; see `productSlugToCheck`)
   that passes that check is rewritten to `/product-cache/<slug>`, the same
   page rendered once and then served from the cache, so a crawler's repeat
   visit runs no render and no database read beyond the check above. A URL with a query string keeps
   the per-request route, and `/product-cache/**` asked for by name is the
   storefront 404.

   **Pay 404 (D184, QA COPY-1).** The same empty-shell behaviour hit
   `/pay/<unknown token>`, bare `/pay` and every deeper pay path, and a plain
   rewrite to a 404 path would render the storefront's page, whose links are
   dead on the pay host. On `/pay` document requests proxy asks
   `payLinkExists` (one indexed read) and, for a path that will 404, fetches
   the branded page `/pay/link-not-found` from the same deployment and returns
   its HTML with status 404 (`payNotFound`). A failed fetch falls back to the
   storefront 404; a database error lets the request through.

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

/** The kept product page's folder, `src/app/(storefront)/product-cache` (D194).
 *  Only proxy's rewrite reaches it. */
const PRODUCT_CACHE_PATH = "/product-cache";

/** `/product-cache` and anything under it, asked for by name. */
const PRODUCT_CACHE = /^\/product-cache(\/|$)/;

/** The pay host's 404 as a real page (`src/app/pay/link-not-found`). Fetched
 *  by `payNotFound` below; never linked. */
const PAY_NOT_FOUND_PAGE = "/pay/link-not-found";

/** `/pay/<segment>` routes that exist, so they are never a 404. */
const PAY_ROUTES = new Set(["webhook", "link-not-found"]);

/** A payment link token (the shape `[token]/page.tsx` accepts). */
const PAY_TOKEN = /^[A-Za-z0-9_-]{22,64}$/;

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
 *  against the catalogue, else `null`. Every GET or HEAD is: a client
 *  navigation or prefetch looks like a document request here, because Next
 *  strips the Flight headers (`rsc`, `next-router-prefetch`) before proxy
 *  sees the request (`proxy.md`, "RSC requests and rewrites"), so the
 *  `rsc` test this function once made never fired. `NextResponse.rewrite`
 *  carries those headers on, so a client navigation to a bare product URL
 *  gets the kept page's payload (D194). */
function productSlugToCheck(request: NextRequest): string | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const match = PRODUCT_PAGE.exec(request.nextUrl.pathname);
  // The path was already shown to be decodable above.
  return match ? decodeURIComponent(match[1]) : null;
}

/** `true` when a `/pay` document request will end in the pay 404: bare `/pay`,
 *  a path deeper than `/pay/<one segment>`, one segment that is neither a pay
 *  route nor a token-shaped string, or a token no payment link carries. Only a
 *  browser navigation is looked at (client navigations carry an `RSC` header
 *  and keep the page's own `notFound()`). A database error returns `false`: an
 *  outage must never turn a real link into a 404 (D157's rule for products). */
async function isPayNotFound(request: NextRequest): Promise<boolean> {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (request.headers.has("rsc")) return false;
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  if (segments[0] !== "pay") return false;
  if (segments.length === 1 || segments.length > 2) return true;
  const segment = decodeURIComponent(segments[1]);
  if (PAY_ROUTES.has(segment)) return false;
  if (!PAY_TOKEN.test(segment)) return true;
  try {
    return !(await payLinkExists(segment));
  } catch {
    return false;
  }
}

/** The pay 404 with a real server-rendered body (QA COPY-1, D184).
 *
 *  A rewrite to an unmatched path gets Next's server-rendered 404 with the 404
 *  status, but that is the STOREFRONT's page (links dead on the pay host), and
 *  a `notFound()` thrown from a pay page is the empty JavaScript-only shell
 *  (`src/app/pay/link-not-found/page.tsx`). So the branded page is fetched
 *  from the same deployment and returned here with status 404. Rewrites cannot
 *  set a status, a response built here can. The pay security headers still
 *  apply: `next.config.ts` rules run on the URL as requested, before proxy.
 *  If the fetch fails for any reason, the storefront 404 (a real 404, no
 *  phone-and-email) is the fallback, never a blank page or a 200. */
async function payNotFound(request: NextRequest): Promise<NextResponse> {
  try {
    const page = await fetch(new URL(PAY_NOT_FOUND_PAGE, request.url), {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(4_000),
    });
    if (page.status === 200) {
      const html = request.method === "HEAD" ? null : await page.text();
      return new NextResponse(html, {
        status: 404,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "private, no-store",
        },
      });
    }
  } catch {
    // Fall through to the storefront's 404.
  }
  return NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url));
}

export async function proxy(request: NextRequest) {
  if (isUndecodable(request.nextUrl.pathname)) {
    const host = request.headers.get("host");
    const isProduction = process.env.VERCEL_ENV === "production";
    if (isProduction && !isAdminHost(host, isProduction) && normalizeHost(host) === PAY_HOST) {
      return payNotFound(request);
    }
    // Each host's own 404: the admin's catch-all (`src/app/admin/[...missing]`)
    // on the admin host, the pay 404 on the pay host in production (the
    // server-rendered one, `payNotFound`), the storefront's everywhere else.
    // No target carries the bad bytes.
    const target = isAdminHost(host, isProduction)
      ? `${ADMIN_FOLDER}/_undecodable`
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
      // Production only: a stray path on the pay host, answered by the pay
      // 404 rather than the storefront's (D105, D151, D184).
      if (decision.pathname === PAY_NOT_FOUND_PATH) return payNotFound(request);
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
      if (await isPayNotFound(request)) return payNotFound(request);
      /* The kept product page is reached only through the rewrite below
         (D194): asked for by name, it is the storefront 404, so it is never
         a second address for a product. */
      if (PRODUCT_CACHE.test(request.nextUrl.pathname)) {
        return NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url));
      }
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
        /* A bare product URL is served from the kept page (D194): the same
           page with an empty query, rendered once and then answered from the
           cache until a catalogue write expires it. A URL with any query
           string (`?qty=`, a carried vehicle) keeps the per-request route. */
        if (request.nextUrl.search === "") {
          return NextResponse.rewrite(
            new URL(`${PRODUCT_CACHE_PATH}/${encodeURIComponent(slug)}`, request.url),
          );
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
    // The kept product page (D194), so it can 404 when asked for by name.
    "/product-cache",
    "/product-cache/:path*",
    "/:path(.*%.*)",
    {
      source: "/((?!_next/|.*\\..*).*)",
      has: [{ type: "header", key: "host", value: "pay\\.platinumwheels\\.ca" }],
    },
  ],
};
