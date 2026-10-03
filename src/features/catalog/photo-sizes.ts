/**
 * Makes a product photo's two stored sizes (D126). Server and laptop only:
 * `sharp` is a native module.
 *
 * The admin upload (`src/features/admin/photo-actions.ts`) and the bulk photo
 * load both call this, so a photo looks the same however it arrived.
 *
 * Each size is fitted inside a square of its width, keeping its proportions:
 * never cropped (D117 draws photos whole) and never enlarged. The camera's
 * rotation is applied first, so a phone photo stands the right way up.
 */

import sharp from "sharp";

import { PHOTO_WIDTH, type PhotoSize } from "./photo-files";

/** WebP quality for both sizes. */
const WEBP_QUALITY = 82;

/** Refuse anything over 100 megapixels before decoding it: a small file can
 *  claim a huge canvas, and a phone photo is under 50. */
const MAX_INPUT_PIXELS = 100_000_000;

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

/** One pass per size, straight from the original: rotate, fit, encode. */
function fitted(original: Uint8Array, width: number): Promise<Buffer> {
  return sharp(original, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize({ width, height: width, fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}
