/* ---------------------------------------------------------------------------
   Sitemap: an index and four files (D112). Server only: it reads the database.

   `/sitemap.xml` is an index. It lists `/sitemaps/pages.xml` (the home page,
   the three category pages, about, privacy and terms) and one file per product
   category. Per category, because one sitemap file tops out at 50,000 URLs and
   the vendor sheets already hold about 45,700 products (D107b(11), and the
   note on `listProductUrls`).

   Why hand-built XML in two Route Handlers and not Next's `sitemap.ts`: the
   file convention with `generateSitemaps` serves `/sitemap/<id>.xml` and no
   index at `/sitemap.xml`
   (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/
   generate-sitemaps.md`), and a handler has to answer 404 when indexing is off
   or the host is not the canonical one (`indexing.ts`).

   **Never in a sitemap:** any URL with a query string (searches, filters,
   `?qty=`), `/styleguide`, `/qa-error`, `/admin/**`, `/pay/**`, and a product
   that is hidden or discontinued. The lists below are allow-lists, so a new
   route is left out until someone adds it here.

   `listProductUrls` is the one catalogue call.
   --------------------------------------------------------------------------- */

import { listProductUrls } from "@/features/catalog/queries";
import type { ProductCategory } from "@/features/catalog/types";
import { absoluteUrl } from "@/features/seo/schema";
import { ROUTES, productRoute } from "@/lib/routes";

export interface SitemapEntry {
  /** Absolute, on the canonical origin. */
  url: string;
  lastModified?: Date;
}

/** The indexable pages that are not products. */
const PAGE_PATHS: readonly string[] = [
  ROUTES.home,
  ROUTES.tires,
  ROUTES.wheels,
  ROUTES.accessories,
  ROUTES.about,
  ROUTES.privacy,
  ROUTES.terms,
];

const PRODUCT_SECTIONS: readonly ProductCategory[] = [
  "tires",
  "wheels",
  "accessories",
];

export type SitemapSection = "pages" | ProductCategory;

/** In the order the index lists them. */
export const SITEMAP_SECTIONS: readonly SitemapSection[] = [
  "pages",
  ...PRODUCT_SECTIONS,
];

/** `/sitemaps/tires.xml`. */
export function sitemapPath(section: SitemapSection): string {
  return `/sitemaps/${section}.xml`;
}

/** `tires.xml` to `tires`; anything else to `null`, which the handler 404s. */
export function parseSitemapSection(segment: string): SitemapSection | null {
  return (
    SITEMAP_SECTIONS.find((section) => `${section}.xml` === segment) ?? null
  );
}

export async function sitemapEntries(
  section: SitemapSection,
): Promise<SitemapEntry[]> {
  if (section === "pages") {
    /* No `lastModified`: nothing records when a written page last changed, and
       a made-up date is worse than none. */
    return PAGE_PATHS.map((path) => ({ url: absoluteUrl(path) }));
  }
  const products = await listProductUrls(section);
  return products.map(({ slug, updatedAt }) => ({
    url: absoluteUrl(productRoute(slug)),
    lastModified: updatedAt,
  }));
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';
const SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9";

export function urlsetXml(entries: readonly SitemapEntry[]): string {
  const urls = entries.map(({ url, lastModified }) => {
    const lastmod =
      lastModified === undefined
        ? ""
        : `<lastmod>${lastModified.toISOString()}</lastmod>`;
    return `<url><loc>${escapeXml(url)}</loc>${lastmod}</url>`;
  });
  return `${XML_HEADER}\n<urlset xmlns="${SITEMAP_NS}">\n${urls.join("\n")}\n</urlset>\n`;
}

export function sitemapIndexXml(): string {
  const sitemaps = SITEMAP_SECTIONS.map(
    (section) =>
      `<sitemap><loc>${escapeXml(absoluteUrl(sitemapPath(section)))}</loc></sitemap>`,
  );
  return `${XML_HEADER}\n<sitemapindex xmlns="${SITEMAP_NS}">\n${sitemaps.join("\n")}\n</sitemapindex>\n`;
}

/** The response both handlers send for a sitemap. */
export function xmlResponse(body: string): Response {
  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}

/**
 * The response both handlers send when there is nothing to list: indexing is
 * off, the host is not the canonical one, or the file name is unknown. A bare
 * 404, marked `noindex` so the refusal itself is never a search result.
 */
export function sitemapNotFound(): Response {
  return new Response("Not found\n", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
