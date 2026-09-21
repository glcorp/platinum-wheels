/**
 * Catalog domain types.
 *
 * The field list is not designed, it is measured: `design/inventory/results.md:363`
 * (§3.10 "Variation between card instances") is the exhaustive list of what
 * differs between the 14 card instances across the artboards — image + alt,
 * badge slot, brand stamp/label, model, size, 3PMSF presence, price, CTA
 * variant. Everything else is byte-identical, so nothing else belongs here.
 *
 * Deliberately absent, per `docs/decisions.md:107`: stock counts, shipping,
 * ratings and invented specs are never rendered, so a card never receives them.
 * There is no cart, so there is no quantity, SKU-availability count or
 * add-to-cart affordance either (`docs/decisions.md:105`).
 */

/**
 * Season / fitment badges.
 *
 * WINTER is the only one that takes colour (`design/DESIGN.md:197`); ALL-SEASON,
 * SUMMER, OEM and STUDDABLE all share the `1px --text-muted` outline treatment
 * (`design/DESIGN.md:198-199`). Only `winter` and `all-season` are drawn in the
 * artboards (`design/inventory/results.md:298`); the other three come from the
 * spec's badge table and render through the same outline variant.
 *
 * `Currently unavailable` is deliberately NOT a member: the artboards use it as
 * a *replacement* for the season badge on an out-of-stock card rather than as a
 * value the product carries (`design/inventory/results.md:355`), so it is
 * derived from `available` instead.
 */
export type ProductBadge =
  | "winter"
  | "all-season"
  | "summer"
  | "oem"
  | "studdable";

/* --- Category (D58) -------------------------------------------------------
   The storefront sells three things. Tires are the designed case: every
   artboard draws a tire, so `category` is OPTIONAL and absent means `"tires"`
   — the nine tire SKUs, every measured card and every parity row are
   byte-identical to what they were before wheels existed.

   Wheels and accessories are owner scope added 2026-09-21: "add wheels and
   accessories to scope. keep them same as tires. only filters and skus change
   but everything else remains as it is." Same card, same grid, same PDP; the
   facets and the seed are what differ (D58).
   -------------------------------------------------------------------------- */

export type ProductCategory = "tires" | "wheels" | "accessories";

/** Absent `category` means tires — see the block above. */
export function productCategory(product: Product): ProductCategory {
  return product.category ?? "tires";
}

/**
 * Wheel finish. Values are the `finish` filter's param values and the spec
 * table's `Finish` row; labels live in `src/features/results/categories.ts`
 * so the filter chips and the spec row cannot disagree.
 *
 * SAMPLE (D48): the three client cut-outs are one finish each in reality. The
 * finish spread across the nine seed SKUs is authored, not photographed, and
 * is a client blocker alongside per-SKU wheel photography.
 */
export type WheelFinish = "gloss-black" | "machined" | "bronze" | "silver";

/**
 * Accessory type. Values are the `type` filter's param values and the spec
 * table's `Type` row; labels live beside the finish labels.
 *
 * **This list follows the photography, not the other way round (D63).** It
 * originally carried invented types with no imagery (`valve-stems`,
 * `hub-rings`); when the client supplied real product shots they covered a
 * different set, and the seed was re-cut to match what can actually be shown.
 * Adding a type here without a photo for it puts the build back where it was.
 */
export type AccessoryType =
  | "tpms"
  | "lug-nuts"
  | "wheel-locks"
  | "centre-caps";

/**
 * The four wheel facts the PDP spec table draws and the three the rail filters
 * on. Present on `category: "wheels"` products and on no other.
 *
 * Strings, not numbers, for the same reason `Product.size` is pre-joined: the
 * rail's selects compare against param values, and `8.5` round-tripping
 * through `Number` would render `8.5` but `9.0` as `9`. The seed writes the
 * display spelling once and everything reads it.
 *
 * `offset` carries its own sign (`+35`, `-12`): it is a spec row, never a
 * filter, so nothing parses it (owner's ruling, 2026-09-21 — offset is a
 * continuous range and a select of discrete values reads wrong; bolt pattern
 * is what a buyer filters on).
 */
export interface WheelSpec {
  /** `18` — rim diameter in inches, the `diameter` filter's value. */
  diameter: string;
  /** `8.5` — rim width in inches, the `width` filter's value. */
  width: string;
  /** `5x114.3` — the `bolt` filter's value. Rendered `5×114.3` (U+00D7) by
   *  the label in `categories.ts`; the value stays ASCII so a hand-typed URL
   *  and a form submit spell it the same way. */
  bolt: string;
  /** `+35`. Spec row only; never filtered. */
  offset: string;
  finish: WheelFinish;
}

export interface Product {
  /**
   * Which of the three catalogue lines this SKU belongs to. **Absent means
   * `"tires"`** (D58) — see `productCategory()` above. Never write
   * `category: "tires"` into the seed: the tire rows are parity-measured and
   * stay exactly as they were.
   */
  category?: ProductCategory;
  /**
   * URL segment and image basename. The optimised cut-out lives at
   * `/images/products/<slug>.webp` (1000×1000, transparent).
   */
  slug: string;
  /**
   * Cut-out basename under `/images/products/<image>.webp`, when it differs
   * from `slug`. Absent = the card uses `slug`.
   *
   * Measured variation, not design: `design/inventory/results.md:363` (§3.10)
   * lists "image src + alt" as one of the things that differs between card
   * instances, and §7.2 records that four cut-outs cover the nine artboard
   * SKUs — the same photo appears on two or three cards because the extra SKUs
   * are other sizes of the same tire (D43). A real per-SKU photo set removes
   * every `image` and leaves `slug` doing the work again.
   */
  /**
   * An absolute path (leading `/`) is used verbatim instead of the
   * `/images/products/<name>.webp` convention. **Accessories only**, and a
   * client blocker: no accessory cut-outs exist, so all nine accessory SKUs
   * point at the lifestyle photo `/images/photos/accessories.webp` (D58).
   * Replace with real per-SKU cut-outs when the client supplies them.
   */
  image?: string;
  /**
   * `Zeta`. Rendered twice per card — the top-right stamp inside the image
   * (`design/assets/results-desktop.html:167`) and the body's brand line
   * (`:171`) — and again as the first half of the image `alt`
   * (`design/inventory/results.md:702`).
   */
  brand: string;
  /** `Antarctica Sport`. Display type, and the card's link to the product. */
  model: string;
  /**
   * `215/55R16 · 97T XL` — `<width>/<ratio>R<rim>` with no spaces, then ` · `
   * (U+00B7, spaced), then `<load index><speed rating> XL`
   * (`design/inventory/results.md:737`). Pre-joined, because the artboards
   * render the whole thing as one tabular string in one span
   * (`design/assets/results-desktop.html:175`).
   *
   * **Per category (D58)** — the card renders this string unchanged in all
   * three cases, and `productView()` is what knows how to split it:
   *   tires        `215/55R16 · 97T XL`   → `Size` + `Load / speed`
   *   wheels       `18×8.5 · 5×114.3`     → never split; the spec rows come
   *                                         from `wheel` instead
   *   accessories  `Set of 4 · 12×1.5`    → never split; a short descriptor
   */
  size: string;
  /**
   * Whole currency units, e.g. `129`. A number, not a string: `Price` formats
   * it so a caller can never reintroduce cents, a shrunken `$` or superscript
   * (`src/components/ui/price.tsx`, `docs/decisions.md` §7).
   */
  price: number;
  /**
   * ISO code for `price`. `CAD` throughout. **Data, not presentation:** since
   * D77 (2026-09-22) no price renders the code — the footer's
   * `Brampton, Ontario · Prices in CAD, before tax` declares it once, site-wide
   * (`src/lib/site.ts` `priceNote`). The field stays because the currency of an
   * amount is a fact a real feed carries and a future `schema.org/Offer`
   * `priceCurrency` would need; `Price` no longer takes it.
   */
  currency: string;
  /**
   * Season / fitment badges, in the order the shop wants them read. The card
   * hoists WINTER to the front and renders at most two
   * (`design/DESIGN.md:201`).
   */
  badges: readonly ProductBadge[];
  /**
   * Three-peak mountain snowflake mark beside the size. Present on every Winter
   * card, absent on every All-Season card and on the unavailable card
   * (`design/inventory/results.md:367`).
   */
  threePeakMountainSnowflake: boolean;
  /**
   * `false` switches the card to the unavailable variant: image at 35%
   * opacity, `Currently unavailable` badge, price in `--text-dim`, ghost CTA
   * reading `Inquire about restock`. The page still returns HTTP 200
   * (`docs/decisions.md:116`, `design/inventory/results.md:352`).
   */
  available: boolean;
  /**
   * Wheel-only facts: diameter, width, bolt pattern, offset, finish.
   * Present iff `category === "wheels"` (D58). The rail filters on the first
   * three; `offset` and `finish` reach the spec table only.
   */
  wheel?: WheelSpec;
  /**
   * Accessory-only fact: which of the five types this is. Present iff
   * `category === "accessories"` (D58). It drives the `Type` chip filter and
   * the spec table's `Type` row.
   */
  accessoryType?: AccessoryType;
  /**
   * Studdable winter tire. The PDP spec table draws `Season` as
   * `Winter (studdable)` (`design/inventory/product.md` §2.5), which no other
   * field can reproduce.
   *
   * Deliberately NOT a `ProductBadge`: `studdable` is a member of that union,
   * but pushing it into `badges` would give the card a second badge and move a
   * measured `/results` parity row. A spec-table fact belongs outside the slot
   * the cards compete for (D53(2)).
   */
  studdable?: boolean;
}

/**
 * Resolves a product's photo `src`. An `image` beginning with `/` is used
 * verbatim — this is the accessories escape hatch (D58): no accessory cut-outs
 * exist, so every accessory SKU points `image` at the single lifestyle photo
 * `/images/photos/accessories.webp` instead of a basename under
 * `/images/products/`. Every other product (every tire, every wheel) keeps the
 * `/images/products/<image ?? slug>.webp` convention.
 *
 * Shared by `ProductCard` and `PdpGallery` so one SKU cannot render one photo
 * on a card and a 404 on its own page. Removing this branch is exactly what
 * real per-SKU accessory photography would allow: drop the absolute path, give
 * each SKU its own cut-out basename, and every product resolves through the
 * one convention again.
 */
export function productImageSrc(
  product: Pick<Product, "image" | "slug">,
): string {
  if (product.image?.startsWith("/")) return product.image;
  return `/images/products/${product.image ?? product.slug}.webp`;
}
