/**
 * Product photos: the staff-side reads and writes of `product_images` (D117).
 *
 * The files themselves live in the R2 photo bucket (D126); this module only
 * records which public URL belongs to which product, in which order.
 * Uploading and deleting the files is `src/features/admin/photo-actions.ts`'s
 * job, so nothing here talks to the bucket and everything here is plain
 * Postgres.
 *
 * NOT GATED, like `store.ts`: the admin actions are the gate. Never import
 * this from a storefront page; the storefront reads photos through
 * `queries.ts` / `rows.ts` `loadImages()`.
 *
 * Order: `sort_order` ascending, lowest first; the first photo is the card's
 * photo (`rows.ts`). Every write here leaves the product's photos numbered
 * 0..n-1 with no gaps, so "first" is never ambiguous.
 *
 * Every write locks the product row first and bumps `products.updated_at`, so the admin list (newest
 * change first) shows a product whose photos just changed at the top.
 */

import { and, asc, count, eq, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import { productImages, products } from "@/db/schema";

import type { Executor } from "./rows";

export interface ProductPhoto {
  id: string;
  url: string;
  alt: string;
  sortOrder: number;
}

/** Ceiling on photos per product (owner, 2026-10-01). */
export const MAX_PHOTOS_PER_PRODUCT = 8;

export async function listProductPhotos(productId: string): Promise<ProductPhoto[]> {
  return getDb()
    .select({
      id: productImages.id,
      url: productImages.url,
      alt: productImages.alt,
      sortOrder: productImages.sortOrder,
    })
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt));
}

export async function countProductPhotos(productId: string): Promise<number> {
  const [row] = await getDb()
    .select({ total: count() })
    .from(productImages)
    .where(eq(productImages.productId, productId));
  return row?.total ?? 0;
}

async function touchProduct(tx: Executor, productId: string): Promise<void> {
  await tx
    .update(products)
    .set({ updatedAt: sql`now()` })
    .where(eq(products.id, productId));
}

/** Renumber a product's photos 0..n-1 in the order given. */
async function renumber(tx: Executor, ids: readonly string[]): Promise<void> {
  for (const [index, id] of ids.entries()) {
    await tx
      .update(productImages)
      .set({ sortOrder: index })
      .where(eq(productImages.id, id));
  }
}

export type AddPhotoResult =
  | { ok: true; photo: ProductPhoto }
  /** `duplicate`: this URL is already one of this product's photos. */
  | { ok: false; reason: "not_found" | "full" | "duplicate" };

/** Locks the product row for the rest of the transaction, so photo writes
 *  on one product apply one after another. `false` when it is gone. */
async function lockProduct(tx: Executor, productId: string): Promise<boolean> {
  const [product] = await tx
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, productId))
    .for("update");
  return product !== undefined;
}

/**
 * Appends a photo after the product's last one. The product row is locked
 * for the duration, so two uploads finishing at once cannot both take the
 * eighth slot.
 */
export async function addProductPhoto(
  productId: string,
  url: string,
  alt: string,
): Promise<AddPhotoResult> {
  return getDb().transaction(async (tx) => {
    if (!(await lockProduct(tx, productId))) return { ok: false, reason: "not_found" };

    // The same file twice would be two rows on one blob, and removing either
    // would delete the file under the other.
    const [existing] = await tx
      .select({ id: productImages.id })
      .from(productImages)
      .where(eq(productImages.url, url))
      .limit(1);
    if (existing) return { ok: false, reason: "duplicate" };

    const [{ total } = { total: 0 }] = await tx
      .select({ total: count() })
      .from(productImages)
      .where(eq(productImages.productId, productId));
    if (total >= MAX_PHOTOS_PER_PRODUCT) return { ok: false, reason: "full" };

    const [photo] = await tx
      .insert(productImages)
      .values({ productId, url, alt, sortOrder: total })
      .returning({
        id: productImages.id,
        url: productImages.url,
        alt: productImages.alt,
        sortOrder: productImages.sortOrder,
      });
    await touchProduct(tx, productId);
    return { ok: true, photo };
  });
}

/**
 * Removes one photo's row and closes the gap it leaves. Returns the removed
 * URL so the caller can delete the file, or `null` when the photo was already
 * gone (removed in another tab).
 */
export async function removeProductPhoto(
  productId: string,
  photoId: string,
): Promise<string | null> {
  return getDb().transaction(async (tx) => {
    // Lock first, like add and move: without it a concurrent move could
    // deadlock against this one, or a concurrent add count the row being
    // deleted and leave a gap in the order.
    if (!(await lockProduct(tx, productId))) return null;
    const [removed] = await tx
      .delete(productImages)
      .where(and(eq(productImages.id, photoId), eq(productImages.productId, productId)))
      .returning({ url: productImages.url });
    if (!removed) return null;

    const rest = await tx
      .select({ id: productImages.id })
      .from(productImages)
      .where(eq(productImages.productId, productId))
      .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt));
    await renumber(
      tx,
      rest.map((row) => row.id),
    );
    await touchProduct(tx, productId);
    return removed.url;
  });
}

export type PhotoMove = "first" | "earlier" | "later";

/**
 * Moves one photo: to the front ("Make main"), or one place earlier or later.
 * `false` when the photo is not this product's. A move past either end is a
 * no-op that still succeeds.
 */
export async function moveProductPhoto(
  productId: string,
  photoId: string,
  move: PhotoMove,
): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    // Lock the product so two moves in two tabs apply one after the other.
    if (!(await lockProduct(tx, productId))) return false;

    const ids = (
      await tx
        .select({ id: productImages.id })
        .from(productImages)
        .where(eq(productImages.productId, productId))
        .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt))
    ).map((row) => row.id);

    const from = ids.indexOf(photoId);
    if (from === -1) return false;

    const to =
      move === "first" ? 0 : move === "earlier" ? Math.max(from - 1, 0) : Math.min(from + 1, ids.length - 1);
    if (to !== from) {
      const [moved] = ids.splice(from, 1);
      ids.splice(to, 0, moved);
    }
    await renumber(tx, ids);
    await touchProduct(tx, productId);
    return true;
  });
}
