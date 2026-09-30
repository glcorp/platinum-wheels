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
