import { mayIndexHost } from "@/features/seo/indexing";
import {
  parseSitemapSection,
  sitemapEntries,
  sitemapNotFound,
  urlsetXml,
  xmlResponse,
} from "@/features/seo/sitemap";

/* `/sitemaps/pages.xml`, `/sitemaps/tires.xml`, `/sitemaps/wheels.xml` and
   `/sitemaps/accessories.xml` (D112). Same gate as the index: a 404 unless the
   flag is on and the host is the canonical one. An unknown file name is a 404
   too. The product files read the catalogue when asked, and the response is
   kept at the CDN for a day (`xmlResponse`, D194). */

export async function GET(
  request: Request,
  context: RouteContext<"/sitemaps/[section]">,
): Promise<Response> {
  if (!mayIndexHost(request.headers.get("host"))) return sitemapNotFound();

  const { section: segment } = await context.params;
  const section = parseSitemapSection(segment);
  if (section === null) return sitemapNotFound();

  return xmlResponse(urlsetXml(await sitemapEntries(section)));
}
