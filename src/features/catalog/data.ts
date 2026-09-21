/**
 * SAMPLE DATA (D29, D43) — "use the arboards one"
 *
 * `FEATURED_PRODUCTS` is the four SKUs of the home `featured-tires` row
 * (`design/inventory/home.md:278-285`); the home page's measured parity
 * depends on that list staying exactly those four, in that order.
 *
 * `PRODUCTS` is the `/results` seed: all **nine** distinct SKUs the results
 * artboards draw, in artboard order — best matches 1-6 then similar 7-9,
 * exactly `design/inventory/results.md` §7.4 (D43). The first four are the
 * same objects as `FEATURED_PRODUCTS`, so `sort=best` (seed order) reproduces
 * the artboard grid.
 *
 * The five extra SKUs are other sizes of the same four tires, with
 * size-suffixed slugs and `image` pointing at the base slug's cut-out: four
 * product photos cover nine SKUs, as the artboards do
 * (`design/inventory/results.md` §7.2). Real per-SKU photography and the two
 * low-resolution cut-outs remain client blockers (`HANDOFF.md` §7).
 *
 * All four base SKUs share `215/55R16` because the artboard staged them as a
 * pre-filled result set for the finder's Civic default — "a staged result for
 * that vehicle, not a real merchandising selection" (`design/DEVIATIONS.md`
 * "Sample data", `src/features/catalog/llm.md` Open #1). This is NOT derived
 * from the wheel CSV: "use as reference. dont make changes pr decisons based
 * on these" (D9).
 *
 * Every count on `/results` — facets, `Filters (n)`, price bounds, the match
 * count — is computed from this list and never typed (D42).
 */

import type { Product } from "./types";

export const FEATURED_PRODUCTS: readonly Product[] = [
  {
    slug: "zeta-antarctica-sport",
    brand: "Zeta",
    model: "Antarctica Sport",
    size: "215/55R16 · 97T XL",
    price: 129,
    currency: "CAD",
    badges: ["winter"],
    threePeakMountainSnowflake: true,
    available: true,
    /* product-desktop.html:129 spec row `Season` → `Winter (studdable)`. */
    studdable: true,
  },
  {
    slug: "zmax-winterhawk",
    brand: "ZMAX",
    model: "Winterhawk",
    size: "215/55R16 · 97T XL",
    price: 119,
    currency: "CAD",
    badges: ["winter"],
    threePeakMountainSnowflake: true,
    available: true,
  },
  {
    slug: "zmax-landgema",
    brand: "ZMAX",
    model: "Landgema",
    size: "215/55R16 · 97V XL",
    price: 99,
    currency: "CAD",
    badges: ["all-season"],
    threePeakMountainSnowflake: false,
    available: true,
  },
  {
    slug: "mazzini-snowleopard",
    brand: "Mazzini",
    model: "Snowleopard",
    size: "215/55R16 · 97T XL",
    price: 115,
    currency: "CAD",
    badges: ["winter"],
    threePeakMountainSnowflake: true,
    available: true,
  },
];

/**
 * The nine artboard SKUs in artboard order (D43). Cards 1-4 are the featured
 * four; 5-9 are `design/inventory/results.md` §7.4 rows 5-9.
 */
export const PRODUCTS: readonly Product[] = [
  ...FEATURED_PRODUCTS,
  {
    /* §7.4 row 5 — desktop best-match card 5. */
    slug: "zeta-antarctica-sport-235-40r18",
    image: "zeta-antarctica-sport",
    brand: "Zeta",
    model: "Antarctica Sport",
    size: "235/40R18 · 95T XL",
    price: 149,
    currency: "CAD",
    badges: ["winter"],
    threePeakMountainSnowflake: true,
    available: true,
    /* Same tire as the 215/55R16 above, so the same sidewall. */
    studdable: true,
  },
  {
    /* §7.4 row 6 — desktop best-match card 6. */
    slug: "zmax-landgema-235-40r18",
    image: "zmax-landgema",
    brand: "ZMAX",
    model: "Landgema",
    size: "235/40R18 · 95W XL",
    price: 124,
    currency: "CAD",
    badges: ["all-season"],
    threePeakMountainSnowflake: false,
    available: true,
  },
  {
    /* §7.4 row 7 — first similar-match card. */
    slug: "mazzini-snowleopard-225-50r17",
    image: "mazzini-snowleopard",
    brand: "Mazzini",
    model: "Snowleopard",
    size: "225/50R17 · 98T XL",
    price: 132,
    currency: "CAD",
    badges: ["winter"],
    threePeakMountainSnowflake: true,
    available: true,
  },
  {
    /* §7.4 row 8 — the drawn unavailable card: `Currently unavailable` takes
       the badge slot (derived from `available`, `types.ts:25-28`), the 3PMSF
       mark is dropped, and the page still returns 200
       (`docs/decisions.md:116`). */
    slug: "zmax-winterhawk-215-50r17",
    image: "zmax-winterhawk",
    brand: "ZMAX",
    model: "Winterhawk",
    size: "215/50R17 · 95T XL",
    price: 127,
    currency: "CAD",
    badges: ["winter"],
    threePeakMountainSnowflake: false,
    available: false,
  },
  {
    /* §7.4 row 9 — last similar-match card. */
    slug: "zmax-landgema-225-45r17",
    image: "zmax-landgema",
    brand: "ZMAX",
    model: "Landgema",
    size: "225/45R17 · 94W XL",
    price: 109,
    currency: "CAD",
    badges: ["all-season"],
    threePeakMountainSnowflake: false,
    available: true,
  },
];

/** Looks up a product by its slug (the URL segment; the image basename is
 *  `image ?? slug`). Searches the full nine-SKU seed. */
export function findProduct(slug: string): Product | undefined {
  return PRODUCTS.find((product) => product.slug === slug);
}
