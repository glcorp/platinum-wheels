/**
 * The photo store: a Cloudflare R2 bucket, spoken to over R2's S3 API (D126b).
 *
 * Photos are served to visitors from `PHOTOS_BASE_URL`, the bucket's own
 * subdomain (`https://photos.platinumwheels.ca`), where Cloudflare's cache
 * answers most requests without reaching the bucket. Writes, reads by key and
 * deletes go to the S3 endpoint with an access key scoped to this one bucket.
 *
 * Settings, all five required (`photoStore()` is `null` while any is missing):
 *   R2_ACCOUNT_ID         Cloudflare account id (names the S3 endpoint)
 *   R2_BUCKET             bucket name
 *   R2_ACCESS_KEY_ID      R2 API token's access key id      (Sensitive)
 *   R2_SECRET_ACCESS_KEY  R2 API token's secret access key  (Sensitive)
 *   PHOTOS_BASE_URL       public origin of the bucket, no trailing slash
 *
 * Server and laptop only: it reads the secret key. Used by the admin photo
 * actions, the product link-preview card and the bulk photo load.
 */

import { AwsClient } from "aws4fetch";

export interface PhotoStore {
  /** `https://<account>.r2.cloudflarestorage.com/<bucket>` */
  readonly endpoint: string;
  /** `https://photos.platinumwheels.ca`, no trailing slash. */
  readonly publicBase: string;
  readonly client: AwsClient;
}

/** One year: a stored key is never reused for a different picture (a staff
 *  upload's key carries a random id, a catalogue photo's its content hash,
 *  D139b), so a file at a URL never changes. */
export const PHOTO_CACHE_CONTROL = "public, max-age=31536000, immutable";

/** The store from the environment, or `null` when it is not set up. */
export function photoStore(env: Readonly<Record<string, string | undefined>> = process.env): PhotoStore | null {
  const accountId = env.R2_ACCOUNT_ID?.trim();
  const bucket = env.R2_BUCKET?.trim();
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim();
  const publicBase = env.PHOTOS_BASE_URL?.trim().replace(/\/+$/, "");
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey || !publicBase) return null;
  return {
    endpoint: `https://${accountId}.r2.cloudflarestorage.com/${bucket}`,
    publicBase,
    client: new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" }),
  };
}

/** The public origin alone, for code that only needs to recognise a photo
 *  URL and holds no keys (`PHOTOS_BASE_URL`, no trailing slash). */
export function photosBaseUrl(env: Readonly<Record<string, string | undefined>> = process.env): string | null {
  return env.PHOTOS_BASE_URL?.trim().replace(/\/+$/, "") || null;
}

function objectUrl(store: PhotoStore, key: string): string {
  return `${store.endpoint}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** The address a visitor's browser loads `key` from. */
export function publicPhotoUrl(store: Pick<PhotoStore, "publicBase">, key: string): string {
  return `${store.publicBase}/${key}`;
}

/** The key behind a public photo URL, or `null` when the URL is not ours. */
export function keyFromPublicUrl(store: Pick<PhotoStore, "publicBase">, url: string): string | null {
  const prefix = `${store.publicBase}/`;
  if (!url.startsWith(prefix)) return null;
  const key = url.slice(prefix.length);
  return key && !key.includes("..") ? key : null;
}

/** A URL the browser may `PUT` to, at `key` only, with exactly this
 *  `Content-Type`, until `seconds` pass. It is reusable until then, and the
 *  size is not limited by the link (R2 has no upload policy for that), so the
 *  caller checks what arrived and reads it pinned to that check (`getObject`'s
 *  `ifMatch`). */
export async function presignPut(
  store: PhotoStore,
  key: string,
  contentType: string,
  seconds: number,
): Promise<string> {
  const url = new URL(objectUrl(store, key));
  url.searchParams.set("X-Amz-Expires", String(seconds));
  const signed = await store.client.sign(url.toString(), {
    method: "PUT",
    headers: { "Content-Type": contentType },
    aws: { signQuery: true, allHeaders: true },
  });
  return signed.url;
}

export interface StoredObject {
  size: number;
  contentType: string;
  /** Pins a later `getObject` to exactly this version of the object. */
  etag: string;
}

/** What is at `key`, or `null` when nothing is. Throws on any other answer. */
export async function headObject(store: PhotoStore, key: string): Promise<StoredObject | null> {
  const response = await store.client.fetch(objectUrl(store, key), { method: "HEAD" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`R2 HEAD ${response.status}`);
  return {
    size: Number(response.headers.get("content-length") ?? "0"),
    contentType: (response.headers.get("content-type") ?? "").split(";")[0]!.trim(),
    etag: response.headers.get("etag") ?? "",
  };
}

/** The object's bytes. With `ifMatch`, only the version a `headObject` saw
 *  (R2 answers 412 if it was replaced since); with `maxBytes`, refuses
 *  anything larger instead of reading it. */
export async function getObject(
  store: PhotoStore,
  key: string,
  options: { ifMatch?: string; maxBytes?: number } = {},
): Promise<Uint8Array> {
  const response = await store.client.fetch(objectUrl(store, key), {
    headers: options.ifMatch ? { "If-Match": options.ifMatch } : {},
  });
  if (!response.ok) throw new Error(`R2 GET ${response.status}`);
  const limit = options.maxBytes ?? Number.POSITIVE_INFINITY;
  if (Number(response.headers.get("content-length") ?? "0") > limit) {
    await response.body?.cancel();
    throw new Error("R2 GET over the size limit");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > limit) throw new Error("R2 GET over the size limit");
  return bytes;
}

export async function putObject(
  store: PhotoStore,
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  const response = await store.client.fetch(objectUrl(store, key), {
    method: "PUT",
    // A copy on its own `ArrayBuffer`: `fetch` takes no view of a shared one.
    body: new Uint8Array(body),
    headers: { "Content-Type": contentType, "Cache-Control": PHOTO_CACHE_CONTROL },
  });
  if (!response.ok) throw new Error(`R2 PUT ${response.status}`);
}

/** Deleting a key that does not exist succeeds, as S3 does. */
export async function deleteObject(store: PhotoStore, key: string): Promise<void> {
  const response = await store.client.fetch(objectUrl(store, key), { method: "DELETE" });
  if (!response.ok && response.status !== 404) throw new Error(`R2 DELETE ${response.status}`);
}
