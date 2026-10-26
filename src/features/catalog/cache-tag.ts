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

/**
 * Which database this process reads, host and name only (never a
 * credential), for the same keys: the on-disk entries of a local build
 * survive `next build`, so without it a read cached from one database would
 * be served for another (the e2e fixture's, say).
 */
export const CACHE_DATABASE = ((): string => {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return `${url.host}${url.pathname}`;
  } catch {
    return "no-database";
  }
})();

/** The options of every catalogue read kept between requests: kept until a
 *  catalogue write expires the tag (D194). A failed read is thrown out of the
 *  cached function, so it is never stored. */
export const CATALOGUE_CACHE: { tags: string[]; revalidate: false } = {
  tags: [CATALOGUE_TAG],
  revalidate: false,
};

/** The key parts of the catalogue read called `name`. */
export function catalogueCacheKey(name: string): string[] {
  return [name, CACHE_DEPLOYMENT, CACHE_DATABASE];
}
