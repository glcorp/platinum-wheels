/**
 * Product photo files: their two sizes, their names in the store, and which
 * size a page draws (D126b).
 *
 * Every product photo is stored twice, as WebP: `card` (480px) for product
 * cards, the cart and the admin thumbnails, and `full` (1000px) for the product
 * page. Both are made once, when the photo is stored (`photo-sizes.ts`), so no
 * page ever asks Vercel to resize one: Hobby includes 5,000 resizes a month,
 * and 42,000 product pages would spend that in days.
 *
 * A `product_images.url` always names the `full` file. The `card` file sits
 * beside it under the same name with `-480` in place of `-1000`, so one stored
 * URL gives both and the database never changes shape.
 *
 * Zero imports and no database: a `"use client"` island may import this, and
 * so may a laptop script run by `tsx`.
 */

/** The two stored widths. A photo smaller than a width is never enlarged. */
export const PHOTO_WIDTH = { card: 480, full: 1000 } as const;

export type PhotoSize = keyof typeof PHOTO_WIDTH;

/** Every stored product photo ends in `-480.webp` or `-1000.webp`. */
const SIZED_NAME = /-(480|1000)\.webp$/;

/**
 * Store key of one size of one photo:
 * `products/<product uuid>/<stem>-<id>-<width>.webp`.
 *
 * `stem` is a readable name for a human browsing the bucket and `id` a random
 * hex string that keeps two uploads of `photo.jpg` apart; both are chosen by
 * the caller and must already be lowercase `a-z`, `0-9` and hyphens.
 */
export function photoKey(productId: string, stem: string, id: string, size: PhotoSize): string {
  return `products/${productId}/${stem}-${id}-${PHOTO_WIDTH[size]}.webp`;
}

/**
 * Store key of one size of a shared catalogue photo (D139):
 * `catalog/<category>/<hash>-<width>.webp`.
 *
 * The bulk load stores each vendor photo once and many products point at it
 * (one wheel design across all its sizes). It lives outside every
 * `products/<uuid>/` folder on purpose: the admin's Remove deletes only files
 * under the product's own folder, so removing a shared photo from one product
 * unlinks it there and never deletes it under the others.
 */
export function catalogPhotoKey(category: string, hash: string, size: PhotoSize): string {
  return `catalog/${category}/${hash}-${PHOTO_WIDTH[size]}.webp`;
}

/** The folder every key of one product's photos starts with. */
export function photoFolder(productId: string): string {
  return `products/${productId}/`;
}

/** The other size's key or URL, or `null` when `keyOrUrl` is not a sized
 *  photo name. Works on a key and on a full public URL alike. */
export function photoSized(keyOrUrl: string, size: PhotoSize): string | null {
  if (!SIZED_NAME.test(keyOrUrl)) return null;
  return keyOrUrl.replace(SIZED_NAME, `-${PHOTO_WIDTH[size]}.webp`);
}

/**
 * What a page hands `next/image` for a product photo.
 *
 * A stored photo (any absolute URL) is drawn at the asked size and
 * `unoptimized`: the file is already the right size, and Vercel's resizer is
 * never asked for it. A site-root path (`/images/...`, a photo shipped in
 * `public/`) keeps the default resizer, as before D126b.
 */
export function photoSource(
  src: string,
  size: PhotoSize,
): { src: string; unoptimized: boolean } {
  if (!/^https?:\/\//.test(src)) return { src, unoptimized: false };
  return { src: photoSized(src, size) ?? src, unoptimized: true };
}
