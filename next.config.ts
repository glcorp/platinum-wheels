import type { NextConfig } from "next";

/* Response hardening (launch audit D145, SEC-EDGE; D151).

   Three layers, applied in this order by `headers()` below. Next documents
   that when two rules set the same header key, the LAST one wins, so the base
   layer is listed first and the admin and pay layers override only the keys
   they change.

   No `script-src`, `style-src` or `connect-src` anywhere: Next inlines its own
   bootstrap scripts and the D92b motion bootstrap, so a script policy needs
   per-request nonces, which would make every static page dynamic. The policy
   below stops framing, plugins and `<base>` hijacking, which is what the audit
   asked for, and nothing a page loads. */

/** Never framed (clickjacking); no plugins; no `<base>` rewrite of relative
 *  URLs. `X-Frame-Options` is the same rule for browsers that predate
 *  `frame-ancestors`. */
const CSP = "frame-ancestors 'none'; base-uri 'self'; object-src 'none'";

/** Powerful features nothing on the site uses, switched off for the page and
 *  anything it embeds. `payment=()` is the Payment Request API only: the card
 *  is entered on Converge's own hosted page (D99), which is a top-level
 *  navigation, not an embed, and is not governed by this header. */
const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "browsing-topics=()",
  "camera=()",
  "display-capture=()",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "payment=()",
  "usb=()",
].join(", ");

/* Every response on every host: the storefront, and the base the admin and
   pay layers build on. `strict-origin-when-cross-origin` is the browser
   default made explicit: another site learns only the origin. */
const BASE_SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
];

/* Admin-only response headers (D95). Scoped to the admin host, where every
   admin page and Server Action lives (D115).
   - `same-origin` referrer: a page showing a generated payment link never
     leaks its URL to another site (the D95 reason). It was `no-referrer`
     until the launch audit (D145, UI-ADMIN): under `no-referrer` a browser
     sends `Origin: null` on a form POST (Fetch, "serializing a request
     origin"), so every admin form posted before hydration failed Next's
     Server Action origin check and `assertSameOriginRequest()` with a bare
     "Internal Server Error". `same-origin` sends the real origin to the
     admin's own host and nothing anywhere else.
   - noindex on the response itself, backing up the layout's `robots` meta
   - no opener relationship with any other site's window */
const ADMIN_SECURITY_HEADERS = [
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

/* Customer payment pages (D105). The URL carries the link's secret token, so
   the referrer is cut to the origin: Converge's hosted page (and anything else)
   learns the site, never the token. Never indexed, never cached. Framing,
   sniffing and permissions come from the base layer.

   Deliberately no `form-action`: the Pay island hands off with a top-level
   POST to Converge (`api.convergepay.com` / `api.demo.convergepay.com`,
   `src/features/payments/converge.ts`), and Chrome also applies `form-action`
   to every redirect that POST follows inside Converge, to hosts this repo does
   not know. Getting it wrong blocks every payment, and it cannot be tested
   without a live Converge session. */
const PAY_SECURITY_HEADERS = [
  { key: "Referrer-Policy", value: "strict-origin" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Cache-Control", value: "no-store" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

/* Every host but the canonical one says `noindex` in a header (D112, D145).
   The page `robots` meta is fixed at build time from the flag and cannot see
   the host (reading the request would make every page dynamic,
   `src/features/seo/indexing.ts`), so with the flag on, the `*.vercel.app`
   alias and deployment URLs would serve `index` pages that `robots.txt`
   already disallows there. A header rule costs nothing at render time and
   keeps every page static. The canonical host is left to the flag alone. */
const NON_CANONICAL_HOST_HEADERS = [
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  /* No `images.remotePatterns`, on purpose (D126b). Product photos are full
     URLs on the R2 photo bucket, stored already sized, and every page draws
     them `unoptimized` through `photoSource()`
     (`src/features/catalog/photo-files.ts`), so Vercel's resizer (5,000 a
     month on Hobby) is never asked for one. With no host listed, a remote
     photo that skipped `photoSource()` breaks visibly (an error in dev, a
     broken image in production) instead of quietly spending that allowance. Paths from the site root (`/images/...`) are
     still resized as before. */
  /* The product link-preview route reads a photo stored as a site-root path
     (`/images/products/x.webp`) from `public/` on disk, and Vercel serves
     `public/` from its CDN, not from the function. This puts the product
     images in that one route's bundle (D112, `src/features/seo/preview-cards.tsx`).
     The logo the site card needs is read at build time and needs no entry. */
  outputFileTracingIncludes: {
    "/products/*/og.jpg": ["./public/images/products/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      /* First, so the rules below can override it key by key (last wins). */
      { source: "/:path*", headers: BASE_SECURITY_HEADERS },
      /* `platinumwheels.ca` duplicates `SITE_URL` in `src/lib/site.ts` (a
         literal: Next reads this config statically). `missing` matches when
         the host is anything else, or absent. */
      {
        source: "/:path*",
        missing: [{ type: "host", value: "platinumwheels\\.ca" }],
        headers: NON_CANONICAL_HOST_HEADERS,
      },
      /* Keyed on the admin HOST, not a path (D115): admin URLs carry no
         `/admin` prefix, and these rules are matched against the URL as
         requested, before `src/proxy.ts` serves it from the admin folder.
         `host` matching drops the port and lowercases, so one pattern covers
         `admin.localhost:3000` in development. Duplicates `ADMIN_HOST` and
         `DEV_ADMIN_HOST` in `src/features/admin/host-routing.ts`. */
      {
        source: "/:path*",
        has: [{ type: "host", value: "admin\\.(platinumwheels\\.ca|localhost)" }],
        headers: ADMIN_SECURITY_HEADERS,
      },
      // The folder itself, which 404s on every host; kept so even that answer
      // is never indexed.
      { source: "/admin", headers: ADMIN_SECURITY_HEADERS },
      { source: "/admin/:path*", headers: ADMIN_SECURITY_HEADERS },
      { source: "/pay/:path*", headers: PAY_SECURITY_HEADERS },
      /* The pay HOST (D105), every path: a stray path there is rewritten by
         `src/proxy.ts` to the pay 404, but header rules match the URL as
         requested, so without this its answer missed the rule above.
         Duplicates `PAY_HOST` in `host-routing.ts`. Build output (`/_next/`)
         is left out so `no-store` never lands on the page's own scripts. */
      {
        source: "/:path((?!_next/).*)",
        has: [{ type: "host", value: "pay\\.platinumwheels\\.ca" }],
        headers: PAY_SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
