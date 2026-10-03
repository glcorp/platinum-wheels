"use server";

/* ---------------------------------------------------------------------------
   Product photo Server Actions (D117, storage since D126): upload handshake,
   record, remove, move.

   **How an upload works.** Phone photos run to several megabytes, past the
   4.5 MB a Vercel Function accepts in one request body, so the file never
   passes through this server on its way in:
     1. `requestPhotoUpload` checks the caller, the product, the photo count,
        the type and the size, then signs a 10-minute R2 link that accepts a
        `PUT` of that type at one staging key, `uploads/<product>/<stem>-<id>`.
     2. The browser `PUT`s the original straight to R2 with that link
        (`components/product-photos.tsx`).
     3. `addPhoto` is handed the staging key, never a URL. It asks R2 what is
        really there (type, size), reads it, makes the two stored sizes
        (`@/features/catalog/photo-sizes`), writes them under the product's
        folder, deletes the original and only then writes the row.
   The link cannot cap the size (R2 has no upload policy) and stays good for
   its 10 minutes, so step 3 checks the size, then reads exactly the version
   it checked (`If-Match`) with a byte cap, and deletes an oversized file. An original whose step 3 never runs (tab
   closed) stays under `uploads/`, never shown anywhere; a bucket lifecycle
   rule on that prefix clears it (D126).

   Every action calls `requireAdminAction(formData)` first (D95): each export
   here is a public POST endpoint, and the client calls them directly rather
   than through a `<form>`, so the `FormData` is built by the island.

   These are not shaped for `useActionState`: the photo island calls them in
   sequence and reads the answer, so each takes only `FormData`.
   --------------------------------------------------------------------------- */

import { randomBytes } from "node:crypto";

import { updateTag } from "next/cache";

import { CATALOGUE_TAG } from "@/features/catalog/cache-tag";
import { photoFolder, photoKey, photoSized } from "@/features/catalog/photo-files";
import { makePhotoSizes } from "@/features/catalog/photo-sizes";
import {
  deleteObject,
  getObject,
  headObject,
  keyFromPublicUrl,
  photoStore,
  presignPut,
  publicPhotoUrl,
  putObject,
  type PhotoStore,
} from "@/features/catalog/photo-store";
import {
  addProductPhoto,
  countProductPhotos,
  moveProductPhoto,
  removeProductPhoto,
  type PhotoMove,
} from "@/features/catalog/photos";
import { getProductById } from "@/features/catalog/store";
import { productName } from "@/lib/product-name";

import {
  PHOTO_FIELD,
  PHOTO_LIMITS,
  PRODUCT_ID_FIELD,
  type PhotoActionResult,
  type PhotoUploadTicket,
} from "./product-types";
import { requireAdminAction } from "./session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** How long an upload link stays good. Long enough for a slow phone upload
 *  of 10 MB, short enough that a leaked one is soon useless. */
const TICKET_LIFETIME_SECONDS = 10 * 60;

const NOT_SET_UP = "Photo uploads are not set up on this deployment.";

function readString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

/** The product id as Postgres writes it, lowercase, so it always matches the
 *  folder names built from it. */
function readProductId(formData: FormData): string {
  return readString(formData, PRODUCT_ID_FIELD).toLowerCase();
}

function isAllowedType(type: string): boolean {
  return (PHOTO_LIMITS.contentTypes as readonly string[]).includes(type);
}

/** Where an original waits between the browser's upload and `addPhoto`. */
function stagingKey(productId: string, stem: string, id: string): string {
  return `uploads/${productId}/${stem}-${id}`;
}

/** `stem` and `id` back out of a staging key, or `null` when the key is not
 *  one `requestPhotoUpload` could have issued for this product. */
function parseStagingKey(productId: string, key: string): { stem: string; id: string } | null {
  const prefix = `uploads/${productId}/`;
  if (!key.startsWith(prefix)) return null;
  const match = /^([a-z0-9]+(?:-[a-z0-9]+)*)-([0-9a-f]{16})$/.exec(key.slice(prefix.length));
  return match ? { stem: match[1]!, id: match[2]! } : null;
}

/** `IMG 2041 (1).HEIC.jpeg` → `img-2041-1-heic`. The name is only for a human
 *  browsing the bucket; the random id keeps two uploads of `photo.jpg` apart. */
function safeStem(raw: string): string {
  const stem = raw
    .replace(/\.[^.]*$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return stem || "photo";
}

function logPhotoEvent(at: string, detail: string): void {
  console.error(JSON.stringify({ at, detail }));
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "unknown";
}

function catalogueChanged(): void {
  updateTag(CATALOGUE_TAG);
}

async function deleteKeys(store: PhotoStore, keys: readonly string[]): Promise<void> {
  for (const key of keys) {
    try {
      await deleteObject(store, key);
    } catch (error) {
      // A file left in the bucket is invisible everywhere. Logged, not surfaced.
      logPhotoEvent("admin.photo.delete", `${key}: ${errorText(error)}`);
    }
  }
}

/* --- 1. Handshake -------------------------------------------------------- */

export async function requestPhotoUpload(formData: FormData): Promise<PhotoUploadTicket> {
  await requireAdminAction(formData);

  const store = photoStore();
  if (!store) return { ok: false, message: NOT_SET_UP };

  const productId = readProductId(formData);
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

  const key = stagingKey(
    productId,
    safeStem(readString(formData, PHOTO_FIELD.fileName)),
    randomBytes(8).toString("hex"),
  );
  try {
    const uploadUrl = await presignPut(store, key, contentType, TICKET_LIFETIME_SECONDS);
    return { ok: true, key, uploadUrl };
  } catch (error) {
    logPhotoEvent("admin.photo.ticket", errorText(error));
    return { ok: false, message: "The upload could not be started. Try again in a minute." };
  }
}

/* --- 3. Record ----------------------------------------------------------- */

export async function addPhoto(formData: FormData): Promise<PhotoActionResult> {
  await requireAdminAction(formData);

  const store = photoStore();
  if (!store) return { ok: false, message: NOT_SET_UP };

  const productId = readProductId(formData);
  const key = readString(formData, PHOTO_FIELD.key);
  if (!UUID.test(productId)) {
    return { ok: false, message: "This product no longer exists. Go back to the list." };
  }
  // Only a key this product's handshake could have issued is ever read, so a
  // forged key cannot reach another product's files or any other object.
  const staged = parseStagingKey(productId, key);
  if (!staged) {
    return { ok: false, message: "That file can't be used as this product's photo." };
  }

  // Ask R2 what is really at the key: the browser chose what to send.
  let original: Awaited<ReturnType<typeof headObject>>;
  try {
    original = await headObject(store, key);
  } catch (error) {
    logPhotoEvent("admin.photo.head", errorText(error));
    return { ok: false, message: "The uploaded photo could not be checked. Try again in a minute." };
  }
  if (!original) {
    return { ok: false, message: "The uploaded photo could not be found. Try uploading it again." };
  }
  if (!isAllowedType(original.contentType) || original.size > PHOTO_LIMITS.maxBytes) {
    await deleteKeys(store, [key]);
    return { ok: false, message: "That file can't be used as this product's photo." };
  }

  const product = await getProductById(productId);
  if (!product) {
    await deleteKeys(store, [key]);
    return { ok: false, message: "This product no longer exists. Go back to the list." };
  }

  // The two stored sizes (D126). Bytes that are not a readable image stop here.
  let sized: Awaited<ReturnType<typeof makePhotoSizes>>;
  try {
    sized = await makePhotoSizes(
      await getObject(store, key, { ifMatch: original.etag, maxBytes: PHOTO_LIMITS.maxBytes }),
    );
  } catch (error) {
    logPhotoEvent("admin.photo.resize", errorText(error));
    await deleteKeys(store, [key]);
    return { ok: false, message: "That file could not be read as a photo. Try another one." };
  }

  const cardKey = photoKey(productId, staged.stem, staged.id, "card");
  const fullKey = photoKey(productId, staged.stem, staged.id, "full");
  try {
    await putObject(store, cardKey, sized.card, "image/webp");
    await putObject(store, fullKey, sized.full, "image/webp");
  } catch (error) {
    // Nothing is deleted here: a request racing on the same key may already
    // have recorded these very files. A half-written pair is an invisible
    // orphan; logged, not cleaned.
    logPhotoEvent("admin.photo.store", `${fullKey}: ${errorText(error)}`);
    return { ok: false, message: "The photo could not be saved. Try again in a minute." };
  }
  await deleteKeys(store, [key]);

  // Alt text is generated, never typed (owner, 2026-10-01): brand and name
  // say what the photo shows on every card and gallery it appears in.
  // An unbranded accessory's (D125) is its name alone.
  const alt = productName(product.brand, product.name).slice(0, 300);
  let result: Awaited<ReturnType<typeof addProductPhoto>>;
  try {
    result = await addProductPhoto(productId, publicPhotoUrl(store, fullKey), alt);
  } catch (error) {
    // Recorded nowhere: the stored sizes would be orphans outside `uploads/`,
    // where the lifecycle rule never reaches. Remove them.
    logPhotoEvent("admin.photo.record", errorText(error));
    await deleteKeys(store, [cardKey, fullKey]);
    return { ok: false, message: "The photo could not be saved. Try again in a minute." };
  }
  if (!result.ok) {
    if (result.reason === "duplicate") {
      // The same staging key was recorded by a request that ran alongside
      // this one: the files belong to that row, so they stay.
      return { ok: false, message: "That photo is already on this product." };
    }
    // Refused and recorded nowhere (the duplicate check ran under the same
    // lock), so the files would be orphans: remove them.
    await deleteKeys(store, [cardKey, fullKey]);
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

/** Both stored sizes of the photo at `url`, when it is one of ours under this
 *  product's folder. Anything else is left alone. */
function storedKeys(store: PhotoStore, productId: string, url: string): string[] {
  const fullKey = keyFromPublicUrl(store, url);
  if (!fullKey?.startsWith(photoFolder(productId))) {
    logPhotoEvent("admin.photo.delete", `not under this product's folder, left in place: ${url}`);
    return [];
  }
  const cardKey = photoSized(fullKey, "card");
  return cardKey ? [cardKey, fullKey] : [fullKey];
}

/** Removes the photo from the product, then deletes both its files from R2
 *  (owner, 2026-10-01: "delete it from storage too"). The URL is unlinked at
 *  once; copies Cloudflare's edge or a browser already cached may still answer
 *  it until they expire, since the files are marked immutable (D126). */
export async function removePhoto(formData: FormData): Promise<PhotoActionResult> {
  await requireAdminAction(formData);

  const productId = readProductId(formData);
  const photoId = readString(formData, PHOTO_FIELD.photoId);
  if (!UUID.test(productId) || !UUID.test(photoId)) {
    return { ok: false, message: "This photo is already gone. Reload the page." };
  }
  const url = await removeProductPhoto(productId, photoId);
  if (url === null) {
    return { ok: false, message: "This photo is already gone. Reload the page." };
  }
  catalogueChanged();
  const store = photoStore();
  if (store) {
    await deleteKeys(store, storedKeys(store, productId, url));
  } else {
    logPhotoEvent("admin.photo.delete", "photo store not set up; file left in place");
  }
  return { ok: true };
}

const MOVES: readonly PhotoMove[] = ["first", "earlier", "later"];

export async function movePhoto(formData: FormData): Promise<PhotoActionResult> {
  await requireAdminAction(formData);

  const productId = readProductId(formData);
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
