/**
 * The one cache tag for anything read from the catalogue and kept between
 * requests. Whoever caches a catalogue read tags it with this; the product
 * admin's Server Actions expire it on every write, so a cached read is never
 * staler than the last save.
 *
 * Its own file, with no imports, so the admin can reach it without pulling in
 * the queries.
 */
export const CATALOGUE_TAG = "catalogue";

/**
 * Goes into the key of every catalogue read kept between requests. An
 * `unstable_cache` entry outlives the deployment that wrote it (Next's own
 * docs: "across requests and deployments"), so without this a read cached
 * while the catalogue was empty, or before a bulk load, would be served by
 * every later deploy. Vercel sets both variables; a local build has neither
 * and shares one entry, which `rm -rf .next` clears. Same reasoning, and the
 * same value, as `home/featured.ts`.
 */
export const CACHE_DEPLOYMENT =
  process.env.VERCEL_DEPLOYMENT_ID ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  "local";
