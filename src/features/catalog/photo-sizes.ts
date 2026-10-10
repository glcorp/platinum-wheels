/**
 * Makes a product photo's two stored sizes (D126b). Server and laptop only:
 * `sharp` is a native module.
 *
 * The admin upload (`src/features/admin/photo-actions.ts`) makes both sizes
 * here; the catalogue photo load (`scripts/catalog-photos.ts`, D139b) keeps the
 * vendor's 1000px file and makes only the card size, with the same settings,
 * so a photo looks the same however it arrived.
 *
 * Each size is fitted inside a square of its width, keeping its proportions:
 * never cropped (D117 draws photos whole) and never enlarged. The camera's
 * rotation is applied first, so a phone photo stands the right way up.
 */

import sharp from "sharp";

import { PHOTO_WIDTH, type PhotoSize } from "./photo-files";

/** WebP quality for both sizes. */
const WEBP_QUALITY = 82;

/** Refuse anything over 250 megapixels before decoding it: a small file can
 *  claim a huge canvas. 100 until D166, when uploads grew to 50 MB, which is
 *  where 102 MP medium-format camera files and 200 MP phone photos
 *  (16320×12240) live. Measured on 2026-10-11 with both sizes made in
 *  parallel, as `makePhotoSizes` does: a 51 MB 200 MP JPEG took 0.53 s at
 *  220 MB peak RSS (libvips shrinks a JPEG while decoding it), a 47 MB PNG
 *  0.34 s at 233 MB, and the worst case the cap admits, a 225 MP PNG of one
 *  colour (a 2.8 MB file), 0.26 s at 344 MB. A Vercel function has 2 GB. */
const MAX_INPUT_PIXELS = 250_000_000;

export type PhotoFiles = Record<PhotoSize, Buffer>;

/** Throws on bytes `sharp` cannot read, or on a canvas over the pixel limit;
 *  the caller treats either as "not a photo". */
export async function makePhotoSizes(original: Uint8Array): Promise<PhotoFiles> {
  const [card, full] = await Promise.all([
    fitted(original, PHOTO_WIDTH.card),
    fitted(original, PHOTO_WIDTH.full),
  ]);
  return { card, full };
}

/** One size alone, for a caller that already holds the other (the bulk
 *  catalogue load keeps the vendor's 1000px file as it is, D139b). */
export function makePhotoSize(original: Uint8Array, size: PhotoSize): Promise<Buffer> {
  return fitted(original, PHOTO_WIDTH[size]);
}

/** One pass per size, straight from the original: rotate, fit, encode. */
function fitted(original: Uint8Array, width: number): Promise<Buffer> {
  return sharp(original, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize({ width, height: width, fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}
