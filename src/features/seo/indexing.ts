/* ---------------------------------------------------------------------------
   Search indexing: the one switch (D112)

   Owner, 2026-09-30: search engines stay blocked until launch. Everything is
   built, and one env flag decides whether any of it is offered to a crawler.

   **The flag.** `SEARCH_INDEXING_ENABLED` is on only when its value is exactly
   the string `true`, the D104 pattern. Unset, `TRUE`, `1`, `yes` and a stray
   space are all off, so a typo can only ever keep the site hidden.

   **Flag off** (the state in Vercel until launch): `/robots.txt` disallows
   everything, no sitemap is served, and every page carries `noindex`.
   **Flag on:** normal indexing, on the canonical host only.

   **Two questions, asked in two places.**
   - `isIndexingEnabled()` reads the flag alone. The root layout uses it for
     the `robots` meta on every page. It reads no request, so a page that was
     static stays static: the mobile LCP gate is already red (root `llm.md`
     §7.12) and a per-request host check in the layout would make every page
     dynamic. The value is fixed when the page is built, which is why turning
     the flag on needs a redeploy (`todo.md`).
   - `mayIndexHost(host)` adds the host. `/robots.txt` and the sitemaps use it:
     they are cheap request-time handlers, and they are what a crawler asks a
     hostname for. `admin.` and `pay.` reach them because `src/proxy.ts` skips
     any path with a dot, and the `*.vercel.app` alias serves the same build;
     none of those may advertise the storefront's URLs. On a host that is not
     the canonical one the pages themselves still name the real site in their
     canonical link, so a stray crawl points back to it.

   Pure functions apart from the one `process.env` read, in the shape of
   `src/features/admin/host-routing.ts`: strings in, a boolean out.
   --------------------------------------------------------------------------- */

import type { Metadata } from "next";

import { SITE_URL } from "@/lib/site";

/** The env var's name, for messages and docs. The read below spells it out
 *  literally so a bundler can see it. */
export const INDEXING_FLAG = "SEARCH_INDEXING_ENABLED";

/** `platinumwheels.ca`: the only hostname that may be indexed. */
export const CANONICAL_HOST = new URL(SITE_URL).host;

/** On only at exactly `true` (D104's rule, D112). */
export function isIndexingEnabled(): boolean {
  return process.env.SEARCH_INDEXING_ENABLED === "true";
}

/** `PlatinumWheels.ca:443` and `platinumwheels.ca` are the same host; `www.`
 *  and every subdomain are not. A missing header matches nothing. */
export function isCanonicalHost(host: string | null): boolean {
  if (!host) return false;
  return host.trim().toLowerCase().replace(/:\d+$/, "") === CANONICAL_HOST;
}

/** May a crawler be told this hostname's URLs? The flag and the host, both. */
export function mayIndexHost(host: string | null): boolean {
  return isIndexingEnabled() && isCanonicalHost(host);
}

/**
 * The site-wide `robots` meta, set once in the root layout and inherited. A
 * page that must never be indexed (`/styleguide`, `/qa-error`, `/admin/**`)
 * sets its own `robots` and wins in both states, because metadata merges
 * shallowly and the deepest segment replaces the field.
 */
export function siteRobots(): NonNullable<Metadata["robots"]> {
  return isIndexingEnabled()
    ? /* `large`: a result may show the product photo at full width. The
         default is a standard-size thumbnail. */
      { index: true, follow: true, "max-image-preview": "large" }
    : { index: false, follow: false };
}
