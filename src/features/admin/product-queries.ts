/**
 * Gated reads for the product admin pages.
 *
 * Each function checks the admin session before it touches the database, so a
 * page cannot show a hidden product or a vendor source by forgetting the gate.
 * No session redirects to sign-in (`requireAdminSession()`, D95).
 *
 * Deliberately NOT a `"use server"` file: that would turn every export into a
 * public POST endpoint. These are called by Server Components only.
 */

import type {
  AdminProduct,
  ProductList,
} from "@/features/catalog/catalog-types";
import {
  getProductById,
  listAllProducts,
  listBrands,
} from "@/features/catalog/store";
import { countProductsByStatus, listVendors } from "@/features/catalog/lookups";
import { listProductPhotos, type ProductPhoto } from "@/features/catalog/photos";

import { requireAdminSession } from "./session";
import { PRODUCT_LIST_PAGE_SIZE, type ProductListQuery } from "./product-types";

const MAX_PAGE = 10_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One page of the product list: any status, newest change first. */
export async function adminListProducts(
  query: ProductListQuery = {},
): Promise<ProductList> {
  await requireAdminSession();
  // `?page=abc` parses to NaN upstream; that is page 1, not a failed query.
  const requested = query.page ?? 1;
  const page = Number.isFinite(requested)
    ? Math.min(Math.max(Math.trunc(requested), 1), MAX_PAGE)
    : 1;
  return listAllProducts({
    search: query.search,
    category: query.category,
    status: query.status,
    brand: query.brand,
    limit: PRODUCT_LIST_PAGE_SIZE,
    offset: (page - 1) * PRODUCT_LIST_PAGE_SIZE,
  });
}

/** One product for the edit screen, or `null` to render "not found". */
export async function adminGetProduct(id: string): Promise<AdminProduct | null> {
  await requireAdminSession();
  // A malformed id in the URL is a "not found", not a database error.
  if (!UUID.test(id)) return null;
  return getProductById(id);
}

/** Existing brand spellings, for the suggestions under the brand field. */
export async function adminListBrands(): Promise<string[]> {
  await requireAdminSession();
  return listBrands();
}

/** Vendor names already on a product source, for the sources dropdown (D116). */
export async function adminListVendors(): Promise<string[]> {
  await requireAdminSession();
  return listVendors();
}

/** One product's photos with their ids, for the photo manager (D117). */
export async function adminListPhotos(productId: string): Promise<ProductPhoto[]> {
  await requireAdminSession();
  if (!UUID.test(productId)) return [];
  return listProductPhotos(productId);
}

/** How many products the storefront lists: the admin home's products tile. */
export async function adminCountPublished(): Promise<number> {
  await requireAdminSession();
  return countProductsByStatus("published");
}
