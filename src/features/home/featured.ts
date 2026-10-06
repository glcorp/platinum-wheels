/**
 * The home page's featured row: which products, and the read that fetches
 * them. Server only: it calls the database.
 *
 * **The row is a fixed list in code**, by owner ruling (2026-09-30, D108b):
 * not an automatic rule, and not a tick in the admin. To change what the home
 * page features, edit `FEATURED_SLUGS` and deploy.
 *
 * A slug that does not resolve is skipped, never an error: the product may
 * have been hidden or discontinued since it was listed. If nothing resolves
 * the section does not render at all (`FeaturedTires`).
 *
 * Cached, because `/` is the one storefront page that is prerendered and the
 * row must not make it dynamic. The entry is tagged `CATALOGUE_TAG`, which the
 * product admin's actions expire on every write. **It has no timer** (owner,
 * 2026-09-30, D111): a timed revalidation makes Next send
 * `stale-while-revalidate` on `/`, the header D93b reverted (WDG-09). So the
 * row follows the database when staff save a product and on every deploy; a
 * bulk load made outside the admin shows after a redeploy. A failed read is
 * thrown out of the cached function so it is never stored.
 *
 * "On every deploy" is made true by `DEPLOYMENT` in the cache key. An
 * `unstable_cache` entry outlives the deployment that wrote it (Next's own
 * docs: "across requests and deployments"), so without it a row cached while
 * the catalogue was empty would be served, still empty, by every later deploy.
 */

import { unstable_cache } from "next/cache";

import { toProduct } from "@/features/catalog/adapter";
import { CATALOGUE_TAG } from "@/features/catalog/cache-tag";
import { getProductsBySlugs } from "@/features/catalog/queries";
import type { Product } from "@/features/catalog/types";

/**
 * The row, in the order it is shown. The heading reads `Winter sets, in stock
 * now.`, so these are winter tires.
 *
 * Seven winter tires from seven brands, each with a photo of the whole tire
 * on a wheel (owner, 2026-10-07: "update the featured winter tires with good
 * images … these ones are not good"). The 2026-10-03 row (six brands in
 * 205/55R16) was mostly flat tread close-ups on white. Each slug below is a
 * size whose photo is the whole-tire shot; another size of the same model can
 * carry a tread close-up, so check the photo before swapping a size. Sizes
 * are common 17" and 18" car and crossover sizes; Yokohama's whole-tire photo
 * exists in one size only. Pirelli has no whole-tire winter photo yet. Keep
 * six or more so both desktop arrows have something to scroll (D74).
 */
export const FEATURED_SLUGS: readonly string[] = [
  "michelin-x-ice-snow-225-50r17-98h",
  "bridgestone-blizzak-6-225-50r18-99",
  "continental-vikingcontact-8-215-65r17-103h",
  "goodyear-wintercommand-ultra-225-50r18-99",
  "yokohama-iceguard-ig53-245-50r18-104",
  "toyo-observe-g3-ice-225-50r17-94",
  "general-tire-altimax-arctic-x-225-50r17",
];

/** One cache entry per deployment. Vercel sets both; a local build has
 *  neither and shares one entry, which `rm -rf .next` clears. */
const DEPLOYMENT =
  process.env.VERCEL_DEPLOYMENT_ID ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  "local";

const readFeatured = unstable_cache(
  async (slugs: readonly string[]): Promise<Product[]> =>
    (await getProductsBySlugs(slugs)).map(toProduct),
  ["home-featured-products", DEPLOYMENT],
  { tags: [CATALOGUE_TAG], revalidate: false },
);

/**
 * The featured products that exist and are published, in list order. Empty
 * when none do, and also when the catalogue cannot be read: the home page is
 * the front door, and a database outage must cost it one row, not the page.
 */
export async function getFeaturedProducts(): Promise<Product[]> {
  try {
    return await readFeatured(FEATURED_SLUGS);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "home.featured.read_failed",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return [];
  }
}
