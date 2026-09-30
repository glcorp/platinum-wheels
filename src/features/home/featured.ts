/**
 * The home page's featured row: which products, and the read that fetches
 * them. Server only: it calls the database.
 *
 * **The row is a fixed list in code**, by owner ruling (2026-09-30, D108):
 * not an automatic rule, and not a tick in the admin. To change what the home
 * page features, edit `FEATURED_SLUGS` and deploy.
 *
 * A slug that does not resolve is skipped, never an error: the product may
 * have been hidden or discontinued since it was listed. If nothing resolves
 * the section does not render at all (`FeaturedTires`).
 *
 * Cached, because `/` is the one storefront page that is prerendered and the
 * row must not make it dynamic. The entry is tagged `CATALOGUE_TAG`, which the
 * product admin's actions expire on every write, and it also expires on its
 * own after `FEATURED_REVALIDATE_SECONDS`. A failed read is thrown out of the
 * cached function so it is never stored: the row comes back on the next
 * request instead of staying empty for five minutes.
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
 * PLACEHOLDER SLUGS. They are winter tires from the vendors' own sheets, which
 * is all the catalogue held when this was written; a slug is brand + model +
 * size, so they resolve if the approved catalogue carries the same products.
 * **Replace them once the client-approved data is loaded** (`llm.md` Open).
 */
export const FEATURED_SLUGS: readonly string[] = [
  "continental-vikingcontact-8-225-45r17-94",
  "pirelli-ice-friction-235-55r19-105",
  "nexen-winguard-winspike-3-215-55r17-98",
  "yokohama-iceguard-g075-225-65r17-102",
  "mazzini-snowleopard-225-50r17-98v",
  "nexen-winguard-sport-2-205-55r16-91",
];

export const FEATURED_REVALIDATE_SECONDS = 300;

const readFeatured = unstable_cache(
  async (slugs: readonly string[]): Promise<Product[]> =>
    (await getProductsBySlugs(slugs)).map(toProduct),
  ["home-featured-products"],
  { tags: [CATALOGUE_TAG], revalidate: FEATURED_REVALIDATE_SECONDS },
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
