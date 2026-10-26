/**
 * The product page's reads. Server only: it calls the database.
 *
 * Each read is kept between requests, per slug, under `CATALOGUE_TAG` (D194):
 * the catalogue changes only when staff save, and every save expires the tag,
 * so a crawler or a shopper asking for a product again costs no database read.
 * The `react` `cache()` wrappers stay as the per-request memo: one request asks
 * for the same product twice, once for `generateMetadata` and once for the
 * page, and the title siblings twice too, for the title and the size line
 * (launch audit D145; D151).
 *
 * A kept value comes back through JSON, so the one `Date` a product carries,
 * `updatedAt`, is revived here before anything reads it.
 */

import { unstable_cache } from "next/cache";
import { cache } from "react";

import {
  CATALOGUE_CACHE,
  catalogueCacheKey,
} from "@/features/catalog/cache-tag";
import type {
  CatalogProduct,
  CatalogProductDetail,
} from "@/features/catalog/catalog-types";
import {
  getOtherSizes,
  getProductBySlug,
  getSimilarProducts,
  getTitleSiblings,
  type OtherSizesFit,
} from "@/features/catalog/queries";
import { findFitment } from "@/features/finder/fitment";
import { tireFit, wheelFit } from "@/features/finder/tire-fit";

import type { Vehicle } from "./types";

/** One row of four cards, the width the artboard draws (`product.md` §2.7). */
const ROW = 4;

/** `updatedAt` back to a `Date` after the trip through the cache's JSON. */
function revived<T extends CatalogProduct>(product: T): T {
  return { ...product, updatedAt: new Date(product.updatedAt) };
}

const readProduct = unstable_cache(
  (slug: string) => getProductBySlug(slug),
  catalogueCacheKey("product-detail"),
  CATALOGUE_CACHE,
);

/** `null` = render a 404: no such slug, or the product is hidden. A
 *  discontinued product loads, and the page shows it as unavailable. */
export const loadProduct = cache(
  async (slug: string): Promise<CatalogProductDetail | null> => {
    const detail = await readProduct(slug);
    return detail === null ? null : revived(detail);
  },
);

const readTitleSiblings = unstable_cache(
  async (slug: string): Promise<CatalogProduct[]> => {
    const detail = await loadProduct(slug);
    return detail === null ? [] : getTitleSiblings(detail);
  },
  catalogueCacheKey("product-title-siblings"),
  CATALOGUE_CACHE,
);

/** The products that would share this page's title, so the title and the
 *  size line can name what differs (`catalog/siblings.ts`). Keyed on the
 *  product object, which `loadProduct`'s memo hands both callers. */
export const loadTitleSiblings = cache(
  async (detail: CatalogProductDetail): Promise<CatalogProduct[]> =>
    (await readTitleSiblings(detail.slug)).map(revived),
);

/**
 * The searched car's fit for the `Other sizes` row (C1, owner 2026-10-11:
 * "Exact fit only; nearest without a car"), or `null` with no car. Read here,
 * on the server, the way `results/search.ts` reads it (`findFitment`, then the
 * catalogue's two shapes, D155). A car the data does not cover gives `null`
 * halves, so the row stays as it was without a car.
 */
function vehicleFit(vehicle: Vehicle | null): OtherSizesFit | null {
  if (vehicle === null) return null;
  const fit = findFitment(vehicle.year, vehicle.make, vehicle.model);
  return { tire: tireFit(fit), wheel: wheelFit(fit) };
}

/** The two rows under the page, keyed on the slug and the car's fit (not the
 *  car), so every car with the same fit shares one entry. */
const readRows = unstable_cache(
  async (
    slug: string,
    fit: OtherSizesFit | null,
  ): Promise<{ similar: CatalogProduct[]; otherSizes: CatalogProduct[] }> => {
    const detail = await loadProduct(slug);
    if (detail === null) return { similar: [], otherSizes: [] };
    const [similar, otherSizes] = await Promise.all([
      getSimilarProducts(detail, ROW),
      getOtherSizes(detail, ROW, fit),
    ]);
    return { similar, otherSizes };
  },
  catalogueCacheKey("product-rows"),
  CATALOGUE_CACHE,
);

/** The two rows under the page and the title siblings, read together.
 *  `vehicle` is the page's checked vehicle (`view.ts` `parseVehicle`, D91b),
 *  or `null`: with one, `Other sizes` lists only the sizes that fit it. */
export async function loadProductRows(
  detail: CatalogProductDetail,
  vehicle: Vehicle | null = null,
): Promise<{
  similar: readonly CatalogProduct[];
  otherSizes: readonly CatalogProduct[];
  siblings: readonly CatalogProduct[];
}> {
  const [rows, siblings] = await Promise.all([
    readRows(detail.slug, vehicleFit(vehicle)),
    loadTitleSiblings(detail),
  ]);
  return {
    similar: rows.similar.map(revived),
    otherSizes: rows.otherSizes.map(revived),
    siblings,
  };
}
