/**
 * Row plumbing shared by the storefront reads (`queries.ts`) and the staff
 * side (`store.ts`): the one join that loads a product with its specs, and
 * the one mapper that turns that row into a `CatalogProduct`. Server only:
 * it imports the schema, which pulls in the database driver.
 */

import { asc, eq, inArray } from "drizzle-orm";
import type { PgSelect } from "drizzle-orm/pg-core";

import type { Database } from "@/db/client";
import {
  accessorySpecs,
  productImages,
  products,
  tireSpecs,
  wheelSpecs,
  type AccessorySpecsRow,
  type ProductRow,
  type TireSpecsRow,
  type WheelSpecsRow,
} from "@/db/schema";

import type {
  CatalogImage,
  CatalogProduct,
  CatalogSpecs,
} from "./catalog-types";

/** A transaction handle has the same query surface as the database. */
export type Executor = Pick<
  Database,
  "select" | "selectDistinct" | "selectDistinctOn" | "insert" | "update" | "delete"
>;

export const PRODUCT_SELECTION = {
  product: products,
  tire: tireSpecs,
  wheel: wheelSpecs,
  accessory: accessorySpecs,
};

export interface ProductJoinRow {
  product: ProductRow;
  tire: TireSpecsRow | null;
  wheel: WheelSpecsRow | null;
  accessory: AccessorySpecsRow | null;
}

/**
 * Left-joins all three spec tables. Each is a primary-key lookup, and only
 * the one matching the product's category can ever hit (the composite foreign
 * keys in `catalog-schema.ts` guarantee it), so joining all three costs little
 * and keeps every query the same shape.
 */
export function withSpecs<T extends PgSelect>(query: T) {
  return query
    .leftJoin(tireSpecs, eq(tireSpecs.productId, products.id))
    .leftJoin(wheelSpecs, eq(wheelSpecs.productId, products.id))
    .leftJoin(accessorySpecs, eq(accessorySpecs.productId, products.id));
}

function stripKeys<T extends { productId: string; category: unknown }>(
  row: T | null,
): Omit<T, "productId" | "category"> | null {
  if (row === null) return null;
  const copy: Partial<T> = { ...row };
  delete copy.productId;
  delete copy.category;
  return copy as Omit<T, "productId" | "category">;
}

function specsOf(row: ProductJoinRow): CatalogSpecs {
  switch (row.product.category) {
    case "tires":
      return { category: "tires", specs: stripKeys(row.tire) };
    case "wheels":
      return { category: "wheels", specs: stripKeys(row.wheel) };
    case "accessories":
      return { category: "accessories", specs: stripKeys(row.accessory) };
  }
}

export function toCatalogProduct(
  row: ProductJoinRow,
  image: CatalogImage | null,
): CatalogProduct {
  const { product } = row;
  return {
    id: product.id,
    slug: product.slug,
    brand: product.brand,
    model: product.model,
    name: product.name,
    description: product.description,
    price: product.price,
    status: product.status,
    gtin: product.gtin,
    updatedAt: product.updatedAt,
    image,
    ...specsOf(row),
  };
}

/** Every image of the given products, grouped by product, in display order. */
export async function loadImages(
  db: Executor,
  productIds: readonly string[],
): Promise<Map<string, CatalogImage[]>> {
  const byProduct = new Map<string, CatalogImage[]>();
  if (productIds.length === 0) return byProduct;
  const rows = await db
    .select({
      productId: productImages.productId,
      url: productImages.url,
      alt: productImages.alt,
    })
    .from(productImages)
    .where(inArray(productImages.productId, [...productIds]))
    .orderBy(
      asc(productImages.productId),
      asc(productImages.sortOrder),
      asc(productImages.createdAt),
    );
  for (const { productId, url, alt } of rows) {
    const list = byProduct.get(productId) ?? [];
    list.push({ url, alt });
    byProduct.set(productId, list);
  }
  return byProduct;
}

/** Rows → products, each with its first image. One extra query per page. */
export async function toCatalogProducts(
  db: Executor,
  rows: readonly ProductJoinRow[],
): Promise<CatalogProduct[]> {
  const images = await loadImages(
    db,
    rows.map((row) => row.product.id),
  );
  return rows.map((row) =>
    toCatalogProduct(row, images.get(row.product.id)?.[0] ?? null),
  );
}
