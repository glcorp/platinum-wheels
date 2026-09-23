import type { NextConfig } from "next";

/* Admin-only response headers (D95). Scoped to `/admin`, where every admin
   page and Server Action lives; the storefront is untouched.
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

const nextConfig: NextConfig = {
  /* config options here */
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
      { source: "/admin", headers: ADMIN_SECURITY_HEADERS },
      { source: "/admin/:path*", headers: ADMIN_SECURITY_HEADERS },
    ];
  },
};

export default nextConfig;
