/**
 * Small staff-side reads the product admin needs beside `store.ts` (D116):
 * the vendor list for the sources dropdown, the "is this one we already have"
 * checks behind the brand and vendor dropdowns, a count by status for the
 * admin home, and the rim sizes for the list's filter (D127b).
 *
 * Brands and vendors are pick-from-existing on the admin (owner, 2026-10-01):
 * there is no brands or vendors table, so "existing" means "already on a
 * product in the catalogue". A new brand or vendor arrives through the
 * catalogue import, not the admin.
 *
 * NOT GATED, like `store.ts`; `src/features/admin/` is the gate. Server only.
 */

import { and, asc, count, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { products, productSources, tireSpecs, wheelSpecs } from "@/db/schema";

import type { ProductCategory, ProductStatus } from "./catalog-types";

/** Every vendor name on a product source, A to Z. */
export async function listVendors(): Promise<string[]> {
  const rows = await getDb()
    .selectDistinct({ vendor: productSources.vendor })
    .from(productSources)
    .orderBy(asc(productSources.vendor));
  return rows.map((row) => row.vendor);
}

/** Exact spelling, as the dropdown offers it, on a product of the same
 *  category (D127b): the form offers only that category's brands. */
export async function brandExists(
  brand: string,
  category: ProductCategory,
): Promise<boolean> {
  const [row] = await getDb()
    .select({ brand: products.brand })
    .from(products)
    .where(and(eq(products.brand, brand), eq(products.category, category)))
    .limit(1);
  return row !== undefined;
}

/** Exact spelling, as the dropdown offers it. */
export async function vendorExists(vendor: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ vendor: productSources.vendor })
    .from(productSources)
    .where(eq(productSources.vendor, vendor))
    .limit(1);
  return row !== undefined;
}

export async function countProductsByStatus(status: ProductStatus): Promise<number> {
  const [row] = await getDb()
    .select({ total: count() })
    .from(products)
    .where(eq(products.status, status));
  return row?.total ?? 0;
}

/**
 * Every rim size in the catalogue, smallest first: a tire's rim diameter and a
 * wheel's diameter, in inches, one entry per size (17 and 17.0 are one). The
 * admin list's Rim size filter (D127b).
 */
export async function listRimSizes(): Promise<number[]> {
  const db = getDb();
  const rows = await db
    .selectDistinct({ rim: tireSpecs.rimDiameter })
    .from(tireSpecs)
    .union(db.selectDistinct({ rim: wheelSpecs.diameter }).from(wheelSpecs));
  return [...new Set(rows.map((row) => Number(row.rim)))]
    .filter((rim) => Number.isFinite(rim))
    .sort((a, b) => a - b);
}
