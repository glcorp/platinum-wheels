import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { mayIndexHost } from "@/features/seo/indexing";
import { PRODUCT_PATH, ROUTES } from "@/lib/routes";
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
   and not `/tires` itself, product pages or `/_next/image?…`.

   Since D194 it also disallows `/search` (Google's advice for a site's own
   search results; the page is `noindex` too) and any query string on a
   product page, `/products/*?`. Every product page links its `?qty=` cells
   (D50), and a crawler following them rendered three more copies of each of
   the 40,000 pages per request, all canonicalising to the bare URL, which
   is now the kept page (`src/proxy.ts`). The bare URL stays crawlable.

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

/**
 * Crawlers kept off the whole site when it is open (D194). Owner, 2026-10-26:
 * *"Add robots.txt blocks for AI and SEO-tool crawlers to PR #70 (keep Google
 * and Bing)"*. Each one fetched the 40,000 product pages on the free plan's
 * allowance and sends no shopper: model-training crawlers (and the opt-out
 * tokens Google and Apple read for training only, which leave Search and
 * Siri untouched) and SEO-tool crawlers that sell our pages' data to others.
 * Googlebot, Bingbot, Applebot and every crawler not named keep the `*` rules.
 * Kept off this list (*derived*): the AI answer engines' own fetchers
 * (`OAI-SearchBot`, `ChatGPT-User`, `Claude-SearchBot`, `Claude-User`,
 * `PerplexityBot`, `Perplexity-User`), which cite and link the page they
 * read. A crawler that ignores `robots.txt` is the Firewall's job.
 */
const BLOCKED_CRAWLERS = [
  // Model training.
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "CCBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bytespider",
  "meta-externalagent",
  "FacebookBot",
  "Amazonbot",
  "cohere-ai",
  "cohere-training-data-crawler",
  "Diffbot",
  "AI2Bot",
  "Ai2Bot-Dolma",
  "img2dataset",
  "ImagesiftBot",
  "omgili",
  "omgilibot",
  "PanguBot",
  "Timpibot",
  "YouBot",
  "Webzio-Extended",
  // SEO tools.
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "BLEXBot",
  "DataForSeoBot",
  "serpstatbot",
  "Barkrowler",
  "rogerbot",
  "PetalBot",
];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host");

  if (!mayIndexHost(host)) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          ...FILTERABLE_PATHS.map((path) => `${path}?`),
          ROUTES.search,
          `${PRODUCT_PATH}/*?`,
        ],
      },
      { userAgent: BLOCKED_CRAWLERS, disallow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
