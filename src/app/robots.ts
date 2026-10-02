import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { mayIndexHost } from "@/features/seo/indexing";
import { ROUTES } from "@/lib/routes";
import { SITE_URL } from "@/lib/site";

/* ---------------------------------------------------------------------------
   `/robots.txt` (D112). The rules are in `src/features/seo/indexing.ts`; this
   file only asks them about the host that was requested.

   Closed unless the indexing flag is exactly `true` **and** the request came
   in on `platinumwheels.ca`. So it disallows everything today, and it keeps
   disallowing everything on `admin.` and `pay.` (`src/proxy.ts` lets any path
   with a dot through on those hosts, this one included), on the `*.vercel.app`
   alias and on a preview, whatever the flag says.

   Open, it disallows one thing: any query string on the three category pages.
   Their filters, sorts, vehicle and `?show=` combine without limit, each
   answer is a database read, and each already names the clean path as its
   canonical, so there is nothing in them to index and a great deal to crawl
   (owner, 2026-09-30: "industry standard"; Google's faceted-navigation
   guidance says to block such URLs in robots.txt rather than rely on the
   canonical alone). `/tires?` is a prefix match: it covers `/tires?brand=x`
   and not `/tires` itself, product pages or `/_next/image?…`. A product's
   `?qty=` stays crawlable and canonicalises.

   The pages that must stay out of search (`/styleguide`, `/qa-error`,
   `/cart`, `/pay/**`) are **not** disallowed: they carry `noindex`
   themselves, and a crawler has to be allowed to fetch a page to read that.

   Reading `headers()` makes this a request-time handler rather than a cached
   one (`node_modules/next/dist/docs/01-app/03-api-reference/
   03-file-conventions/01-metadata/robots.md`), which is the point: the answer
   depends on the hostname.
   --------------------------------------------------------------------------- */

/** The pages whose query string is a filter. */
const FILTERABLE_PATHS = [ROUTES.tires, ROUTES.wheels, ROUTES.accessories];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host");

  if (!mayIndexHost(host)) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: FILTERABLE_PATHS.map((path) => `${path}?`),
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
