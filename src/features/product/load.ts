/**
 * The product page's reads. Server only: it calls the database.
 *
 * `loadProduct` is wrapped in React's `cache()` because one request asks for
 * the same product twice, once for `generateMetadata` and once for the page;
 * the wrapper makes that one query. It is a per-request memo, not a cache
 * across requests.
 */

import { cache } from "react";

import type {
  CatalogProduct,
  CatalogProductDetail,
} from "@/features/catalog/catalog-types";
import {
  getOtherSizes,
  getProductBySlug,
  getSimilarProducts,
} from "@/features/catalog/queries";

/** One row of four cards, the width the artboard draws (`product.md` §2.7). */
const ROW = 4;

/** `null` = render a 404: no such slug, or the product is hidden. A
 *  discontinued product loads, and the page shows it as unavailable. */
export const loadProduct = cache(
  (slug: string): Promise<CatalogProductDetail | null> =>
    getProductBySlug(slug),
);

/** The two rows under the page, read together. */
export async function loadProductRows(detail: CatalogProductDetail): Promise<{
  similar: readonly CatalogProduct[];
  otherSizes: readonly CatalogProduct[];
}> {
  const [similar, otherSizes] = await Promise.all([
    getSimilarProducts(detail, ROW),
    getOtherSizes(detail, ROW),
  ]);
  return { similar, otherSizes };
}
