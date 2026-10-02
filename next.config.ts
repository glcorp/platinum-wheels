import type { NextConfig } from "next";

/* Admin-only response headers (D95). Scoped to the admin host, where every
   admin page and Server Action lives (D115); the storefront is untouched.
   - no framing: stops a hostile page overlaying the admin to steal clicks
   - no referrer: a page showing a generated payment link never leaks its URL
   - noindex on the response itself, backing up the layout's `robots` meta */
const ADMIN_SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/* Customer payment pages (D105). The URL carries the link's secret token, so
   the referrer is cut to the origin: Converge's hosted page (and anything else)
   learns the site, never the token. Never framed, never indexed. */
const PAY_SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Cache-Control", value: "no-store" },
];

const nextConfig: NextConfig = {
  /* Product photos come from the database as full URLs once staff can upload
     them (Vercel Blob). `next/image` refuses a host that is not listed, so the
     Blob host is allowed here ahead of that work; a path from the site root
     (`/images/...`) needs no entry. */
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
  },
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
      // is never framed or indexed.
      { source: "/admin", headers: ADMIN_SECURITY_HEADERS },
      { source: "/admin/:path*", headers: ADMIN_SECURITY_HEADERS },
      { source: "/pay/:path*", headers: PAY_SECURITY_HEADERS },
    ];
  },
};

export default nextConfig;
