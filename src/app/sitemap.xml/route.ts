import { mayIndexHost } from "@/features/seo/indexing";
import {
  sitemapIndexXml,
  sitemapNotFound,
  xmlResponse,
} from "@/features/seo/sitemap";

/* `/sitemap.xml`: the index of the four files under `/sitemaps/` (D112). A 404
   unless the indexing flag is on and the request came in on the canonical
   host, so `admin.`, `pay.` and the `*.vercel.app` alias never list the
   storefront. Rules: `src/features/seo/indexing.ts`; XML: `sitemap.ts`. */

export async function GET(request: Request): Promise<Response> {
  if (!mayIndexHost(request.headers.get("host"))) return sitemapNotFound();
  return xmlResponse(sitemapIndexXml());
}
