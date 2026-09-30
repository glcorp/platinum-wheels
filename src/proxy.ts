import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { decideHostRouting } from "@/features/admin/host-routing";

/* ---------------------------------------------------------------------------
   Request proxy — host routing for the admin (D97)

   `proxy.ts`, not `middleware.ts`: Next 16 renamed the convention and
   `docs/decisions.md` §2 fixed this file name before it existed. It lives in
   `src/` because the app does; Next looks for it beside `app/`.

   It does one thing — decide which hostname may serve `/admin` and `/pay` — and every
   rule lives in `src/features/admin/host-routing.ts` as a pure function. This
   file only adapts a request to that function and its answer to a response.
   Nothing about sign-in happens here: the gate is `requireAdminSession()` in
   each page and every Server Action (D95), and it must stay there. Next's own
   docs warn that a matcher change can silently drop proxy coverage, so proxy
   is routing, never authorisation.

   **Why the matcher is narrow.** Without a matcher, proxy runs before every
   request on the site — every storefront page, the ones whose mobile LCP is
   already the one red gate (root `llm.md` §7.12). With this matcher it runs on
   `/admin` paths on any host, and on every non-asset path on the admin host,
   and never on ordinary storefront traffic.
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
    // outside Vercel (`next dev`, `next start`) it is unset. Only production
    // enforces host rules — see `host-routing.ts`.
    isProduction: process.env.VERCEL_ENV === "production",
  });

  switch (decision.kind) {
    case "redirect":
      // 307, Next's default: temporary, so a browser does not cache it while
      // the subdomain's shape can still change.
      return NextResponse.redirect(new URL(decision.pathname, request.url));
    case "not-found":
      return NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url));
    case "pass":
      return NextResponse.next();
  }
}

export const config = {
  /* Literal values only: Next analyses `config` statically at build time and
     ignores anything computed, so `ADMIN_HOST` cannot be imported here. The
     host below duplicates `ADMIN_HOST` in `host-routing.ts` — change both. */
  matcher: [
    // Any host: the admin itself, so production can 404 it off the admin host.
    "/admin",
    "/admin/:path*",
    // The admin host only: every path except build output (`_next/`) and
    // public files (anything with a dot — `.webp`, `favicon.ico`), so a stray
    // path there can be sent to `/admin`. `has` compares the `Host` header as
    // a pattern, hence the escaped dots.
    {
      source: "/((?!_next/|.*\\..*).*)",
      has: [{ type: "header", key: "host", value: "admin\\.platinumwheels\\.ca" }],
    },
    // Payments (D105): `/pay` on any host, so production can 404 it off the
    // pay host, and every non-asset path on the pay host. `PAY_HOST` in
    // `host-routing.ts` — change both.
    "/pay",
    "/pay/:path*",
    {
      source: "/((?!_next/|.*\\..*).*)",
      has: [{ type: "header", key: "host", value: "pay\\.platinumwheels\\.ca" }],
    },
  ],
};
