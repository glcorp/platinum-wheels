import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { decideHostRouting } from "@/features/admin/host-routing";

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

export function proxy(request: NextRequest) {
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
    case "pass":
      return NextResponse.next();
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
    {
      source: "/((?!_next/|.*\\..*).*)",
      has: [{ type: "header", key: "host", value: "pay\\.platinumwheels\\.ca" }],
    },
  ],
};
