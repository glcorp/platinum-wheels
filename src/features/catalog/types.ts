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
 * No quantity and no availability count either: since D122 the card has an
 * `Add to cart` button, but the cart (`src/lib/cart.ts`) keeps its own
 * quantities and the product carries none.
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
  | "all-weather"
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
 * Accessory type. Values are the `type` filter's param values and the spec
 * table's `Type` row; labels are `ACCESSORY_LABEL` in `adapter.ts`. The
 * fifteen values are the database's `accessory_type` enum with every
 * underscore spelled as a hyphen: the vendors' own fifteen types (D125),
 * which replaced the nine of D105b.
 */
export type AccessoryType =
  | "center-caps"
  | "lug-nuts"
  | "cap-logos-inserts-hardware"
  | "hub-rings"
  | "lug-bolts"
  | "wheel-weights"
  | "wheel-covers-trim"
  | "wheel-spacers"
  | "wheel-locks"
  | "tpms-sensors-tools"
  | "tools-gauges-organizers"
  | "tire-studs"
  | "valves-caps"
  | "antennas"
  | "tire-bags-storage";

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
  /** `+35`, or `""` when the vendor gave none. Spec row only; never filtered. */
  offset: string;
  /** The vendor's own wording, or `null`. Spec row only: there is no finish
   *  filter (D105b), so nothing groups or translates it. */
  finish: string | null;
}

export interface Product {
  /**
   * Which of the three catalogue lines this product belongs to. Absent means
   * `"tires"` (D58) — see `productCategory()` above. Every product read from
   * the database carries it; the optional form survives for hand-built samples
   * (`/styleguide`).
   */
  category?: ProductCategory;
  /** URL segment. Written once when the product is created and never changed
   *  (D107b), so it is safe to link, share and index. */
  slug: string;
  /**
   * The product's first photo: a full URL, or a path from the site root.
   * **Absent means there is no photo**, and the card and gallery draw the
   * placeholder tile instead (`ProductPhotoPlaceholder`). Never guess a path
   * from the slug: a guessed path is a broken image.
   */
  image?: string;
  /**
   * Every photo of the product, in the admin's order, the first being
   * `image` (D167). Set only on the product page, whose read loads them all
   * (`getProductBySlug`); a card shows its first photo alone and leaves this
   * absent. Each is a full URL or a site-root path, like `image`.
   */
  images?: readonly string[];
  /**
   * `Zeta`. Rendered twice per card — the top-right stamp inside the image
   * (`design/assets/results-desktop.html:167`) and the body's brand line
   * (`:171`) — and again as the first half of the image `alt`
   * (`design/inventory/results.md:702`).
   *
   * `null` on an accessory the vendor sells unbranded (D125): a card has no
   * brand to stamp, and nothing may invent one. A tire or wheel always has one.
   */
  brand: string | null;
  /** `Antarctica Sport`. Display type, and the card's link to the product. A
   *  product with no model (most accessories) shows its name here. */
  model: string;
  /**
   * `215/55R16 · 97T XL` — the size, then ` · ` (U+00B7, spaced), then
   * `<load index><speed rating> XL` (`design/inventory/results.md:737`).
   * Pre-joined, because the artboards render the whole thing as one tabular
   * string in one span (`design/assets/results-desktop.html:175`).
   *
   * **Per category (D58)** — the card renders this string unchanged:
   *   tires        `215/55R16 · 97T XL`, or `35x12.50R20 · 121Q`
   *   wheels       `18×8.5 · 5×114.3`
   *   accessories  `Set of 4 · 12×1.5`, or the type when it states nothing
   * `adapter.ts` builds it; nothing parses it back.
   */
  size: string;
  /**
   * The number to show, or `null` when the catalogue has none, in which case
   * `Price` reads `Inquire for price`. `Price` rounds to whole units, so a
   * caller can never reintroduce cents, a shrunken `$` or superscript
   * (`src/components/ui/price.tsx`, `docs/decisions.md` §7).
   */
  price: number | null;
  /**
   * ISO code for `price`. `CAD` throughout. **Data, not presentation:** since
   * D77 (2026-09-22) no price renders the code — the footer's
   * `Brampton, Ontario · Prices in CAD, before tax` declares it once, site-wide
   * (`src/lib/site.ts` `priceNote`).
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
   *
   * Since D105b this is the product's status: `published` is available,
   * `discontinued` is not. There is no stock count behind it.
   */
  available: boolean;
  /**
   * Wheel-only facts: diameter, width, bolt pattern, offset, finish.
   * Present iff `category === "wheels"` (D58). The rail filters on the first
   * three; `offset` and `finish` reach the spec table only.
   */
  wheel?: WheelSpec;
  /**
   * Accessory-only fact: which of the fifteen types this is. Present iff
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
   * measured `/tires` parity row. A spec-table fact belongs outside the slot
   * the cards compete for (D53(2)).
   */
  studdable?: boolean;
}

/**
 * A product's photo `src`, or `null` when it has none.
 *
 * Shared by `ProductCard` and `PdpGallery` so one product cannot render a
 * photo on its card and a placeholder on its own page.
 */
export function productImageSrc(
  product: Pick<Product, "image">,
): string | null {
  const image = product.image?.trim();
  return image ? image : null;
}
