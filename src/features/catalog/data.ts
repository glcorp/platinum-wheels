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
 * the artboard grid. **Neither array nor any of its objects gained a
 * `category` field for D58** — absent means tires (`types.ts`
 * `productCategory()`), and the nine tire SKUs, `ProductCard`'s tire output
 * and the tire price suffix all stay byte-identical to what they were before
 * wheels and accessories existed.
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
 *
 * --- WHEELS and ACCESSORIES (D58, D48) ---------------------------------
 *
 * Owner, 2026-09-21: "also add wheels and accessories to scope. keep them
 * same as tires. only filters and skus change but everything else remains as
 * it is." `WHEELS` and `ACCESSORIES` below are placeholder seed data under
 * the same D48 ruling that covers the tire fitment map — "use placeholder and
 * temporary data genrated by you" — authored by the coordinator, not
 * measured, because no wheel or accessory artboard exists to measure from.
 *
 * Two client blockers join the existing list (`root llm.md` §7.2):
 *   (a) only three wheel cut-outs exist on disk and one of them,
 *       `touren-tr79`, is too low-resolution to normalise — so nine wheel SKUs
 *       render from **two** photos (`touren-tr76`, `spec1-sp51`) via `image`,
 *       the same sharing the five extra tire SKUs do (D43). There is no
 *       per-SKU wheel photography yet.
 *   (b) no accessory cut-outs exist at all: every one of the nine accessory
 *       cards points its `image` at the single lifestyle photograph
 *       `/images/photos/accessories.webp` (an absolute path — the accessory
 *       escape hatch documented on `Product.image` and implemented in
 *       `product-card.tsx`). This is a placeholder, not a design decision.
 *
 * Also unconfirmed: Touren, Spec-1, Schrader, Gorilla and Coyote are real
 * brand names used as sample data; nobody has confirmed the shop stocks them
 * (joins `root llm.md` §7.2's "brand logos and stock confirmation").
 */

import type { Product, ProductCategory } from "./types";

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
    /* Borrows `zmax-winterhawk`'s cut-out. Its own source trims to 546×757
       against a target subject of 880px on a 1000px canvas, so
       `scripts/prepare-assets.mjs` refuses to upscale it and the card renders
       optically small beside the rest of the set. Owner ruling, 2026-09-21:
       "use another image - make duplication. it is only for mock" (D63).
       Same brand, so the duplication reads as a range rather than an error.
       DELETE THIS LINE when the client supplies a usable original — the SKU
       itself is artboard data and stays either way. */
    image: "zmax-winterhawk",
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
    /* Follows its base SKU onto `zmax-winterhawk` (D63) — see the note there. */
    image: "zmax-winterhawk",
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
    /* Follows its base SKU onto `zmax-winterhawk` (D63) — see the note there. */
    image: "zmax-winterhawk",
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

/**
 * The nine wheel SKUs (D58, D48 — sample data, see the file header). Two
 * usable cut-outs (`touren-tr76`, `spec1-sp51`) cover all nine via `image`;
 * the third, `touren-tr79`, cannot be normalised and its three SKUs borrow
 * `touren-tr76` instead (D63). `size` is the card's one-line display string
 * (`<diameter>×<width> · <bolt>`, U+00D7); `wheel.bolt` stays ASCII
 * (`5x114.3`) because it is the `bolt` filter's URL param value — only the
 * display `size` string uses the typographic ×.
 */
export const WHEELS: readonly Product[] = [
  {
    category: "wheels",
    slug: "touren-tr76-17x7",
    image: "touren-tr76",
    brand: "Touren",
    model: "TR76",
    size: "17×7 · 5×114.3",
    price: 149,
    currency: "CAD",
    badges: [],
    threePeakMountainSnowflake: false,
    available: true,
    wheel: { diameter: "17", width: "7", bolt: "5x114.3", offset: "+40", finish: "gloss-black" },
  },
  {
    category: "wheels",
    slug: "touren-tr76-18x8",
    image: "touren-tr76",
    brand: "Touren",
    model: "TR76",
    size: "18×8 · 5×114.3",
    price: 169,
    currency: "CAD",
    badges: [],
    threePeakMountainSnowflake: false,
    available: true,
    wheel: { diameter: "18", width: "8", bolt: "5x114.3", offset: "+35", finish: "machined" },
  },
  {
    category: "wheels",
    slug: "touren-tr76-20x9",
    image: "touren-tr76",
    brand: "Touren",
    model: "TR76",
    size: "20×9 · 6×139.7",
    price: 229,
    currency: "CAD",
    badges: [],
    threePeakMountainSnowflake: false,
    available: true,
    wheel: { diameter: "20", width: "9", bolt: "6x139.7", offset: "+30", finish: "gloss-black" },
  },
  {
    category: "wheels",
    slug: "touren-tr79-17x7",
    /* `touren-tr79`'s source trims to 470×439 and cannot be normalised, so
       all three TR79 SKUs borrow `touren-tr76`'s cut-out — same brand, and
       placeholder data either way (D63). */
    image: "touren-tr76",
    brand: "Touren",
    model: "TR79",
    size: "17×7 · 5×100",
    price: 139,
    currency: "CAD",
    badges: [],
    threePeakMountainSnowflake: false,
    available: true,
    wheel: { diameter: "17", width: "7", bolt: "5x100", offset: "+42", finish: "silver" },
  },
  {
    category: "wheels",
    slug: "touren-tr79-18x8",
    image: "touren-tr76",
    brand: "Touren",
    model: "TR79",
    size: "18×8 · 5×114.3",
    price: 179,
    currency: "CAD",
    badges: [],
    threePeakMountainSnowflake: false,
    available: true,
    wheel: { diameter: "18", width: "8", bolt: "5x114.3", offset: "+38", finish: "gloss-black" },
  },
  {
    category: "wheels",
    slug: "touren-tr79-20x85",
    image: "touren-tr76",
    brand: "Touren",
    model: "TR79",
    size: "20×8.5 · 5×120",
    price: 239,
    currency: "CAD",
    badges: [],
    threePeakMountainSnowflake: false,
    available: true,
    wheel: { diameter: "20", width: "8.5", bolt: "5x120", offset: "+35", finish: "bronze" },
  },
  {
    category: "wheels",
    slug: "spec1-sp51-17x75",
    image: "spec1-sp51",
    brand: "Spec-1",
    model: "SP51",
    size: "17×7.5 · 5×114.3",
    price: 159,
    currency: "CAD",
    badges: [],
    threePeakMountainSnowflake: false,
    available: true,
    wheel: { diameter: "17", width: "7.5", bolt: "5x114.3", offset: "+40", finish: "bronze" },
  },
  {
    category: "wheels",
    slug: "spec1-sp51-18x85",
    image: "spec1-sp51",
    brand: "Spec-1",
    model: "SP51",
    size: "18×8.5 · 5×114.3",
    price: 199,
    currency: "CAD",
    badges: [],
    threePeakMountainSnowflake: false,
    available: true,
    wheel: { diameter: "18", width: "8.5", bolt: "5x114.3", offset: "+35", finish: "gloss-black" },
  },
  {
    category: "wheels",
    slug: "spec1-sp51-20x9",
    image: "spec1-sp51",
    brand: "Spec-1",
    model: "SP51",
    size: "20×9 · 5×114.3",
    price: 269,
    currency: "CAD",
    badges: [],
    threePeakMountainSnowflake: false,
    /* The drawn unavailable-equivalent SKU for this category (D58 mirrors the
       tire seed's one unavailable card, `zmax-winterhawk-215-50r17` above). */
    available: false,
    wheel: { diameter: "20", width: "9", bolt: "5x114.3", offset: "+30", finish: "machined" },
  },
];

/**
 * The nine accessory SKUs (D58, D48 — sample data), **re-cut 2026-09-21 to
 * match the photography the client actually supplied (D63).**
 *
 * The first version invented five types (TPMS, lug nuts, valve stems, hub
 * rings, wheel locks) and had no imagery for any of them. The client then
 * supplied real product shots, and they cover a different set: TPMS sensors,
 * lug nuts, wheel locks and **centre caps**. Rather than keep types no photo
 * depicts, the seed follows the photos — valve stems and hub rings are gone
 * and centre caps are in.
 *
 * Brands follow the photos too, because the marks are legible in them: the
 * TPMS sensor is a Bosch unit and the centre cap carries a Sentali mark. The
 * lug-nut and wheel-lock shots are unbranded, so those keep `Gorilla` from
 * the original placeholder set. **None of these brands is confirmed as
 * stocked** (`HANDOFF.md` §7).
 *
 * Images are the five client photos, keyed off their white backgrounds and
 * normalised to the same 1000px square canvas as every other cut-out by
 * `scripts/prepare-assets.mjs` (`clientProducts()`). Four of the five are
 * shared by two SKUs each, the same reuse the tire and wheel seeds already
 * do. The absolute-path escape hatch in `productImageSrc()` is no longer used
 * by anything — it stays only until the last placeholder is gone.
 */
export const ACCESSORIES: readonly Product[] = [
  {
    category: "accessories",
    slug: "bosch-tpms-315",
    image: "bosch-tpms",
    brand: "Bosch",
    model: "TPMS Sensor 315",
    accessoryType: "tpms",
    size: "Programmable · 315 MHz",
    price: 49,
    currency: "CAD",
    badges: [],
    threePeakMountainSnowflake: false,
    available: true,
  },
  {
    category: "accessories",
    slug: "bosch-tpms-433",
    image: "bosch-tpms",
    brand: "Bosch",
    model: "TPMS Sensor 433",
    accessoryType: "tpms",
    size: "Programmable · 433 MHz",
    price: 52,
    currency: "CAD",
    badges: [],
    threePeakMountainSnowflake: false,
    available: true,
  },
  {
    category: "accessories",
    slug: "gorilla-lug-nuts-acorn",
    image: "gorilla-lug-nuts-acorn",
    brand: "Gorilla",
    model: "Acorn Lug Nuts",
    accessoryType: "lug-nuts",
    size: "Set of 20 · 12×1.5",
    price: 39,
    currency: "CAD",
    badges: [],
    threePeakMountainSnowflake: false,
    available: true,
  },
  {
    category: "accessories",
    slug: "gorilla-lug-nuts-spike",
    image: "gorilla-lug-nuts-spike",
    brand: "Gorilla",
    model: "Spike Lug Nuts",
    accessoryType: "lug-nuts",
    size: "Set of 20 · 12×1.5",
    price: 59,
    currency: "CAD",
    badges: [],
    threePeakMountainSnowflake: false,
    available: true,
  },
  {
    category: "accessories",
    slug: "gorilla-lug-nuts-spike-1225",
    image: "gorilla-lug-nuts-spike",
    brand: "Gorilla",
    model: "Spike Lug Nuts",
    accessoryType: "lug-nuts",
    size: "Set of 20 · 12×1.25",
    price: 59,
    currency: "CAD",
    badges: [],
    threePeakMountainSnowflake: false,
    available: true,
  },
  {
    category: "accessories",
    slug: "gorilla-wheel-locks",
    image: "gorilla-wheel-locks",
    brand: "Gorilla",
    model: "Wheel Lock Set",
    accessoryType: "wheel-locks",
    size: "Set of 4 · 12×1.5",
    price: 34,
    currency: "CAD",
    badges: [],
    threePeakMountainSnowflake: false,
    available: true,
  },
  {
    category: "accessories",
    slug: "gorilla-wheel-locks-tuner",
    image: "gorilla-wheel-locks",
    brand: "Gorilla",
    model: "Tuner Wheel Locks",
    accessoryType: "wheel-locks",
    size: "Set of 4 · 12×1.25",
    price: 44,
    currency: "CAD",
    badges: [],
    threePeakMountainSnowflake: false,
    available: true,
  },
  {
    category: "accessories",
    slug: "sentali-centre-cap-chrome",
    image: "sentali-centre-cap",
    brand: "Sentali",
    model: "Chrome Centre Cap",
    accessoryType: "centre-caps",
    size: "Fits 5-lug · 74 mm",
    price: 29,
    currency: "CAD",
    badges: [],
    threePeakMountainSnowflake: false,
    available: true,
  },
  {
    /* The one unavailable accessory, mirroring the tire and wheel seeds, so
       the dimmed card variant is reachable on every category. */
    category: "accessories",
    slug: "sentali-centre-cap-black",
    image: "sentali-centre-cap",
    brand: "Sentali",
    model: "Gloss Black Centre Cap",
    accessoryType: "centre-caps",
    size: "Fits 5-lug · 74 mm",
    price: 29,
    currency: "CAD",
    badges: [],
    threePeakMountainSnowflake: false,
    available: false,
  },
];

export const ALL_PRODUCTS: readonly Product[] = [...PRODUCTS, ...WHEELS, ...ACCESSORIES];

/** Looks up a product by its slug (the URL segment; the image basename is
 *  `image ?? slug`, unless `image` is an absolute path — see `Product.image`).
 *  Searches every category (D58). */
export function findProduct(slug: string): Product | undefined {
  return ALL_PRODUCTS.find((product) => product.slug === slug);
}

/** The seed array for one category — `PRODUCTS` / `WHEELS` / `ACCESSORIES`.
 *  `results/search.ts` and `product/view.ts` both call this instead of
 *  importing a category's array by name (D58). */
export function productsIn(category: ProductCategory): readonly Product[] {
  switch (category) {
    case "tires":
      return PRODUCTS;
    case "wheels":
      return WHEELS;
    case "accessories":
      return ACCESSORIES;
  }
}
