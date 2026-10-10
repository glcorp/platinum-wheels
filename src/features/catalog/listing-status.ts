/**
 * Which products a storefront LIST shows (D164).
 *
 * `published` and `discontinued` both list; `hidden` never does. To a
 * shopper the two are the same product (owner, 2026-10-11: "Treat
 * discontinued products as normal products. It is just a filter for our
 * client to know that this product is discontinued by the vendors. When the
 * vendor stocks goes out, the client can mark them as hidden."). So a
 * discontinued product takes its normal place in every sort, counts in every
 * facet and in the `N matches` line, and its card looks like any other
 * (`adapter.ts` `toProduct()` reads it as available).
 *
 * One rule, one place: `queries.ts` uses it for the results pages, their
 * facets, the category base and the sitemap, and the search pages reuse it
 * (stream D). Pure: no database connection, just the SQL condition.
 */

import { inArray, type SQL } from "drizzle-orm";

import { products } from "@/db/schema";

/** The statuses a storefront list shows. */
export const LISTED_STATUSES = ["published", "discontinued"] as const;

export type ListedStatus = (typeof LISTED_STATUSES)[number];

/** `products.status in ('published', 'discontinued')`: the WHERE part every
 *  storefront list carries. */
export function listedStatus(): SQL {
  return inArray(products.status, [...LISTED_STATUSES]);
}
