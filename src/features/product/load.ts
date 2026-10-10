/**
 * The product page's reads. Server only: it calls the database.
 *
 * `loadProduct` is wrapped in React's `cache()` because one request asks for
 * the same product twice, once for `generateMetadata` and once for the page;
 * the wrapper makes that one query. It is a per-request memo, not a cache
 * across requests. `loadTitleSiblings` is memoised for the same reason: the
 * title and the size line both read it (launch audit D145; D151).
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
  getTitleSiblings,
  type OtherSizesFit,
} from "@/features/catalog/queries";
import { findFitment } from "@/features/finder/fitment";
import { tireFit, wheelFit } from "@/features/finder/tire-fit";

import type { Vehicle } from "./types";

/** One row of four cards, the width the artboard draws (`product.md` §2.7). */
const ROW = 4;

/** `null` = render a 404: no such slug, or the product is hidden. A
 *  discontinued product loads, and the page shows it as unavailable. */
export const loadProduct = cache(
  (slug: string): Promise<CatalogProductDetail | null> =>
    getProductBySlug(slug),
);

/** The products that would share this page's title, so the title and the
 *  size line can name what differs (`catalog/siblings.ts`). Keyed on the
 *  product object, which `loadProduct`'s memo hands both callers. */
export const loadTitleSiblings = cache(
  (detail: CatalogProductDetail): Promise<CatalogProduct[]> =>
    getTitleSiblings(detail),
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
  const [similar, otherSizes, siblings] = await Promise.all([
    getSimilarProducts(detail, ROW),
    getOtherSizes(detail, ROW, vehicleFit(vehicle)),
    loadTitleSiblings(detail),
  ]);
  return { similar, otherSizes, siblings };
}
