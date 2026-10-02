"use server";

/* ---------------------------------------------------------------------------
   Product photo Server Actions (D117): upload handshake, record, remove, move.

   **How an upload works.** Phone photos run to several megabytes, past the
   4.5 MB a Vercel Function accepts in one request body, so the file never
   passes through this server:
     1. `requestPhotoUpload` checks the caller, the product, the photo count,
        the type and the size, then mints a short-lived Blob client token that
        allows exactly one file, at one path, of those types, up to 10 MB.
     2. The browser `put()`s the file straight to Vercel Blob with that token
        (`components/product-photos.tsx`).
     3. `addPhoto` records the uploaded URL against the product. It does not
        trust the URL it is handed: it asks Blob (`head()`) whether that file
        exists in OUR store, under this product's folder, as an image within
        the limits, and only then writes the row.
   A file uploaded in step 2 whose step 3 never runs (tab closed) is an
   orphan in the store; it is never shown anywhere. Accepted, not cleaned up.

   Every action calls `requireAdminAction(formData)` first (D95): each export
   here is a public POST endpoint, and the client calls them directly rather
   than through a `<form>`, so the `FormData` is built by the island.

   These are not shaped for `useActionState`: the photo island calls them in
   sequence and reads the answer, so each takes only `FormData`.
   --------------------------------------------------------------------------- */

import { del, head } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { updateTag } from "next/cache";

import { CATALOGUE_TAG } from "@/features/catalog/cache-tag";
import {
  addProductPhoto,
  countProductPhotos,
  moveProductPhoto,
  removeProductPhoto,
  type PhotoMove,
} from "@/features/catalog/photos";
import { getProductById } from "@/features/catalog/store";

import {
  PHOTO_FIELD,
  PHOTO_LIMITS,
  PRODUCT_ID_FIELD,
  type PhotoActionResult,
  type PhotoUploadTicket,
} from "./product-types";
import { requireAdminAction } from "./session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** How long a client token stays good. Long enough for a slow phone upload
 *  of 10 MB, short enough that a leaked one is soon useless. */
const TICKET_LIFETIME_MS = 10 * 60 * 1000;

function readString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function isAllowedType(type: string): boolean {
  return (PHOTO_LIMITS.contentTypes as readonly string[]).includes(type);
}

/** Blob folder for one product's photos. The id is a UUID, so it needs no
 *  escaping. */
function photoFolder(productId: string): string {
  return `products/${productId}/`;
}

/** `IMG 2041 (1).HEIC.jpeg` → `img-2041-1-heic.jpeg`. The name is only for a
 *  human reading the store; Blob adds a random suffix, so two uploads of
 *  `photo.jpg` never collide. */
function safeFileName(raw: string, contentType: string): string {
  const extension =
    contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const stem = raw
    .replace(/\.[^.]*$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${stem || "photo"}.${extension}`;
}

function logPhotoEvent(at: string, detail: string): void {
  console.error(JSON.stringify({ at, detail }));
}

function catalogueChanged(): void {
  updateTag(CATALOGUE_TAG);
}

/* --- 1. Handshake -------------------------------------------------------- */

export async function requestPhotoUpload(formData: FormData): Promise<PhotoUploadTicket> {
  await requireAdminAction(formData);

  const readWriteToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!readWriteToken) {
    return { ok: false, message: "Photo uploads are not set up on this deployment." };
  }

  const productId = readString(formData, PRODUCT_ID_FIELD);
  const contentType = readString(formData, PHOTO_FIELD.contentType);
  const size = Number(readString(formData, PHOTO_FIELD.size));

  if (!isAllowedType(contentType)) {
    return { ok: false, message: "Use a JPEG, PNG or WebP photo." };
  }
  if (!Number.isFinite(size) || size <= 0 || size > PHOTO_LIMITS.maxBytes) {
    return { ok: false, message: "Use a photo of 10 MB or less." };
  }
  if (!UUID.test(productId) || !(await getProductById(productId))) {
    return { ok: false, message: "This product no longer exists. Go back to the list." };
  }
  if ((await countProductPhotos(productId)) >= PHOTO_LIMITS.perProduct) {
    return {
      ok: false,
      message: `This product already has ${PHOTO_LIMITS.perProduct} photos. Remove one first.`,
    };
  }

  const pathname = `${photoFolder(productId)}${safeFileName(
    readString(formData, PHOTO_FIELD.fileName),
    contentType,
  )}`;
  try {
    const token = await generateClientTokenFromReadWriteToken({
      token: readWriteToken,
      pathname,
      allowedContentTypes: [...PHOTO_LIMITS.contentTypes],
      maximumSizeInBytes: PHOTO_LIMITS.maxBytes,
      addRandomSuffix: true,
      validUntil: Date.now() + TICKET_LIFETIME_MS,
    });
    return { ok: true, pathname, token };
  } catch (error) {
    logPhotoEvent("admin.photo.ticket", error instanceof Error ? error.message : "unknown");
    return { ok: false, message: "The upload could not be started. Try again in a minute." };
  }
}

/* --- 3. Record ----------------------------------------------------------- */

export async function addPhoto(formData: FormData): Promise<PhotoActionResult> {
  await requireAdminAction(formData);

  const productId = readString(formData, PRODUCT_ID_FIELD);
  const url = readString(formData, PHOTO_FIELD.url);
  if (!UUID.test(productId)) {
    return { ok: false, message: "This product no longer exists. Go back to the list." };
  }

  // Ask Blob, with our own read-write token, what is at this URL. A URL from
  // another store, or a path outside this product's folder, never verifies.
  let stored: Awaited<ReturnType<typeof head>>;
  try {
    stored = await head(url);
  } catch (error) {
    logPhotoEvent("admin.photo.head", error instanceof Error ? error.message : "unknown");
    return { ok: false, message: "The uploaded photo could not be found. Try uploading it again." };
  }
  if (
    !stored.pathname.startsWith(photoFolder(productId)) ||
    !isAllowedType(stored.contentType) ||
    stored.size > PHOTO_LIMITS.maxBytes
  ) {
    return { ok: false, message: "That file can't be used as this product's photo." };
  }

  const product = await getProductById(productId);
  if (!product) {
    return { ok: false, message: "This product no longer exists. Go back to the list." };
  }

  // Alt text is generated, never typed (owner, 2026-10-01): brand and name
  // say what the photo shows on every card and gallery it appears in.
  const alt = `${product.brand} ${product.name}`.slice(0, 300);
  const result = await addProductPhoto(productId, stored.url, alt);
  if (!result.ok) {
    if (result.reason === "duplicate") {
      // Already recorded: the file belongs to that row, so it stays.
      return { ok: false, message: "That photo is already on this product." };
    }
    // Refused and recorded nowhere (the duplicate check ran under the same
    // lock), so the file would be an orphan: remove it.
    await deleteFile(stored.url);
    return result.reason === "full"
      ? {
          ok: false,
          message: `This product already has ${PHOTO_LIMITS.perProduct} photos. Remove one first.`,
        }
      : { ok: false, message: "This product no longer exists. Go back to the list." };
  }
  catalogueChanged();
  return { ok: true };
}

/* --- Remove and reorder -------------------------------------------------- */

async function deleteFile(url: string): Promise<void> {
  try {
    await del(url);
  } catch (error) {
    // The photo is already off the product; a file left in the store is
    // invisible everywhere. Logged, not surfaced.
    logPhotoEvent("admin.photo.delete", error instanceof Error ? error.message : "unknown");
  }
}

/** Removes the photo from the product, then deletes the file from Blob
 *  (owner, 2026-10-01: "delete it from storage too"). */
export async function removePhoto(formData: FormData): Promise<PhotoActionResult> {
  await requireAdminAction(formData);

  const productId = readString(formData, PRODUCT_ID_FIELD);
  const photoId = readString(formData, PHOTO_FIELD.photoId);
  if (!UUID.test(productId) || !UUID.test(photoId)) {
    return { ok: false, message: "This photo is already gone. Reload the page." };
  }
  const url = await removeProductPhoto(productId, photoId);
  if (url === null) {
    return { ok: false, message: "This photo is already gone. Reload the page." };
  }
  catalogueChanged();
  await deleteFile(url);
  return { ok: true };
}

const MOVES: readonly PhotoMove[] = ["first", "earlier", "later"];

export async function movePhoto(formData: FormData): Promise<PhotoActionResult> {
  await requireAdminAction(formData);

  const productId = readString(formData, PRODUCT_ID_FIELD);
  const photoId = readString(formData, PHOTO_FIELD.photoId);
  const move = MOVES.find((value) => value === readString(formData, PHOTO_FIELD.move));
  if (!UUID.test(productId) || !UUID.test(photoId) || move === undefined) {
    return { ok: false, message: "This photo could not be moved. Reload the page." };
  }
  if (!(await moveProductPhoto(productId, photoId, move))) {
    return { ok: false, message: "This photo is already gone. Reload the page." };
  }
  catalogueChanged();
  return { ok: true };
}
