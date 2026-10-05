/**
 * Catalogue data contract: the shapes the database-backed catalogue hands to
 * pages and takes from the admin. Types and four constant lists, no database
 * code, so a `"use client"` island may import it (the `import type`s from
 * `@/db/schema` are erased at build).
 *
 * This sits beside `types.ts`, not in place of it. `types.ts` is `Product`,
 * the shape the cards and pages have always rendered, measured against the
 * artboards. These are the database's own shapes; `adapter.ts` `toProduct()`
 * turns one into the other.
 */

import type {
  AccessorySpecsRow,
  ExtraSpec,
  ProductRow,
  TireSpecsRow,
  WheelSpecsRow,
} from "@/db/schema";

export type ProductCategory = ProductRow["category"];
export type ProductStatus = ProductRow["status"];
export type TireSizeFormat = TireSpecsRow["sizeFormat"];
export type TireSeason = NonNullable<TireSpecsRow["season"]>;
/** Named `Kind` because `types.ts` already exports the seed's four-value
 *  `AccessoryType`. */
export type AccessoryKind = AccessorySpecsRow["accessoryType"];

export const PRODUCT_CATEGORIES = [
  "tires",
  "wheels",
  "accessories",
] as const satisfies readonly ProductCategory[];

export const PRODUCT_STATUSES = [
  "hidden",
  "published",
  "discontinued",
] as const satisfies readonly ProductStatus[];

export const TIRE_SEASONS = [
  "summer",
  "all_season",
  "all_weather",
  "winter",
] as const satisfies readonly TireSeason[];

export type { ExtraSpec };

/** The vendors' fifteen product types (D125), in the order the vendor sheets
 *  rank them by count. Labels: `ACCESSORY_LABEL` in `adapter.ts`. */
export const ACCESSORY_KINDS = [
  "center_caps",
  "lug_nuts",
  "cap_logos_inserts_hardware",
  "hub_rings",
  "lug_bolts",
  "wheel_weights",
  "wheel_covers_trim",
  "wheel_spacers",
  "wheel_locks",
  "tpms_sensors_tools",
  "tools_gauges_organizers",
  "tire_studs",
  "valves_caps",
  "antennas",
  "tire_bags_storage",
] as const satisfies readonly AccessoryKind[];

/* --- Product ------------------------------------------------------------- */

export type TireSpecs = Omit<TireSpecsRow, "productId" | "category">;
export type WheelSpecs = Omit<WheelSpecsRow, "productId" | "category">;
export type AccessorySpecs = Omit<AccessorySpecsRow, "productId" | "category">;

export interface CatalogImage {
  url: string;
  alt: string;
}

/**
 * `specs` is `null` when the product has no spec row yet. The page must
 * survive that: a product with nothing but a brand and a name still renders.
 */
export type CatalogSpecs =
  | { category: "tires"; specs: TireSpecs | null }
  | { category: "wheels"; specs: WheelSpecs | null }
  | { category: "accessories"; specs: AccessorySpecs | null };

export type CatalogProduct = {
  id: string;
  slug: string;
  /** `null` only on an unbranded accessory (D125). */
  brand: string | null;
  model: string | null;
  name: string;
  description: string | null;
  /** Just a number, or `null` when there is none to show. */
  price: number | null;
  status: ProductStatus;
  gtin: string | null;
  /** A wheel's or accessory's vendor part number (D142). Always `null` on a
   *  tire. Not necessarily the maker's MPN. */
  partNumber: string | null;
  /** Vendor facts with no column, in vendor order (D125). Never a price. */
  extraSpecs: readonly ExtraSpec[];
  updatedAt: Date;
  /** The first image by sort order: the card's photo. */
  image: CatalogImage | null;
  /**
   * What tells this product from the look-alikes that share its card (name
   * and size line): `["Centre bore 57.1 mm"]`, `["Left side"]`, `["Part
   * number X"]`. Set only by the storefront listing reads in `queries.ts`
   * (`withTellingFacts`), and only when such a sibling exists; absent
   * everywhere else (the product page, the admin), where it would say
   * nothing. `adapter.ts` `toProduct()` appends it to the card's size line
   * (launch audit D145; D153).
   */
  tellingFacts?: readonly string[];
} & CatalogSpecs;

/** The product page: every image, in order. */
export type CatalogProductDetail = CatalogProduct & {
  images: readonly CatalogImage[];
};

/* --- Filters ------------------------------------------------------------- */

export type CatalogSort = "best" | "price-asc" | "price-desc";

/**
 * A vehicle's tires, as a tire filter (the finder's `tire-fit.ts` builds it;
 * the catalogue never learns what a vehicle is, D155). Two ways to read it:
 *
 * - **`sizes` / `flotation` given**: a best match is a tire whose size equals
 *   one of them. The similar row is the tires inside `range` (overall
 *   diameter within half an inch of the stock envelope, section width in it,
 *   rim diameter inside `rimMin`..`rimMax` when known) that are not best.
 *   `tire-fit.ts` always sends a `range` with sizes (derived from them when
 *   the source states none); without one the rim rule's near list is a defence.
 * - **no sizes**: the rim rule alone. A tire suits the vehicle when it suits
 *   any of `rims` (diameter, width range) and its sidewall height is in the
 *   band; the similar row is the plus sizes.
 *
 * The rim rule matches metric tires only (a flotation size has no aspect
 * ratio, so its comparisons are NULL and it matches neither list).
 */
export interface TireVehicleFit {
  /** Factory metric sizes: section width mm, aspect ratio, rim inches. */
  sizes: ReadonlyArray<{ width: number; profile: number; rim: number }>;
  /** Factory flotation sizes: overall diameter, section width, rim inches. */
  flotation: ReadonlyArray<{ diameter: number; section: number; rim: number }>;
  /** The stock envelope: overall diameter in inches, section width in mm. */
  range: {
    diameterMin: number;
    diameterMax: number;
    widthMin: number;
    widthMax: number;
    rimMin: number | null;
    rimMax: number | null;
  } | null;
  /** The rim rule's wheels, inches: a tire suits the vehicle when it suits
   *  any of them. */
  rims: ReadonlyArray<{ diameter: number; width: number }>;
  /** Sidewall height (section width x aspect ratio / 100), mm, inclusive. */
  sidewallMinMm: number;
  sidewallMaxMm: number;
}

/**
 * A vehicle's wheels, as a wheel filter (D155). A wheel must be drilled for
 * one of `boltPatterns` (both, when the model year came with two). With
 * `range` a wheel is a best match inside it (diameter, width and offset; a
 * wheel with no offset on record is not outside it) and not narrower than
 * `hubBore`; a wheel outside it, with no bore on record or a bore too small
 * is similar. With no `range` the bolt pattern alone decides and only a bore
 * narrower than the hub is similar.
 */
export interface WheelVehicleFit {
  boltPatterns: readonly string[];
  range: {
    diameterMin: number;
    diameterMax: number;
    widthMin: number;
    widthMax: number;
    offsetMin: number | null;
    offsetMax: number | null;
  } | null;
  /** The hub bore in mm. */
  hubBore: number | null;
}

/**
 * What a results page can narrow on. Every field is optional; an absent field
 * does not filter. Only the block matching `category` is read.
 */
export interface ProductFilters {
  category: ProductCategory;
  /** Matched exactly, as the brand facet spells them. */
  brands?: readonly string[];
  /** Inclusive. A product with no price never matches a price bound. */
  priceMin?: number;
  priceMax?: number;
  tire?: {
    /** Section width in mm on a metric size; the OVERALL DIAMETER in inches on
     *  a flotation one (`33` in `33x12.50R20`, the trade's convention). */
    width?: number;
    /** Aspect ratio on a metric size; the SECTION WIDTH in inches on a
     *  flotation one (`12.5`). */
    aspectRatio?: number;
    rimDiameter?: number;
    seasons?: readonly TireSeason[];
    /** The lowest load index wanted. A product with no load index on record
     *  never matches it; a pair (`121/118`) is read by its first number. */
    loadIndexMin?: number;
    /** A vehicle's tires. With `sizeMatch: "exact"` it keeps the best matches;
     *  with `"near"`, the similar ones (`TireVehicleFit`). Never sent together
     *  with an explicit size part. */
    vehicleFit?: TireVehicleFit;
  };
  wheel?: {
    diameter?: number;
    width?: number;
    /** `5x114.3`. Matches a wheel drilled for it, alone or with another. */
    boltPattern?: string;
    /** Millimetres, inclusive, signed. A wheel with no offset on record never
     *  matches a bound. */
    offsetMin?: number;
    offsetMax?: number;
    /** Millimetres, matched exactly. */
    centerBore?: number;
    /** `wheel_specs.finish_family`, matched exactly as the facet spells it. */
    finishes?: readonly string[];
    /** A vehicle's wheels (`WheelVehicleFit`). With `sizeMatch: "exact"` it
     *  keeps the best matches; with `"near"`, the similar ones. Never sent
     *  together with an explicit size part. */
    vehicleFit?: WheelVehicleFit;
  };
  accessory?: {
    kinds?: readonly AccessoryKind[];
    /**
     * The vehicle's lug thread, `12x1.5`. An accessory has no size, so this is
     * what a vehicle narrows it on: with `sizeMatch: "exact"` (the default) it
     * keeps everything that does not contradict the thread, and with `"near"`
     * it returns only the lug nuts and wheel locks cut to a different one.
     */
    thread?: string;
    /**
     * The vehicle's hub bore in mm. A hub ring states the bore it fits as its
     * inner diameter, so a ring whose inner diameter is another size
     * contradicts the vehicle (same asymmetric rule as `thread`: a ring that
     * states no inner diameter never contradicts).
     */
    hubBore?: number;
    /**
     * How the vehicle's wheels are held: `nut` (stud and nut) or `bolt` (hub
     * bolt). A lug nut contradicts a `bolt` vehicle and a lug bolt a `nut`
     * one, by type alone; wheel locks are held to the thread only, because no
     * column says nut or bolt for them.
     */
    fastener?: "nut" | "bolt";
    /**
     * Thread sizes the buyer ticked (`14x1.5`, `1/2 UNF`), matched exactly as
     * the facet spells them. They narrow the lug nuts, lug bolts and wheel
     * locks ONLY: every other type passes untouched, because a centre cap has
     * no thread to match.
     */
    threads?: readonly string[];
  };
}

export interface ListProductsInput extends ProductFilters {
  /**
   * `exact` (default): every size part given must match.
   * `near`: the "similar options" list. Close to the size asked for, never the
   * size itself. Empty unless a rim (tires), a diameter and width (wheels) or
   * a thread (accessories) is given.
   */
  sizeMatch?: "exact" | "near";
  sort?: CatalogSort;
  /** Default 24, capped at 150. */
  limit?: number;
  offset?: number;
}

export interface ProductList {
  items: readonly CatalogProduct[];
  /** Every product the filters match, not just this page of them. */
  total: number;
}

/* --- Facets -------------------------------------------------------------- */

/** `count` = what choosing this option would yield given every OTHER active
 *  filter, so the numbers always add up to what the list shows. */
export interface FacetCount<T extends string = string> {
  value: T;
  count: number;
}

export interface CatalogFacets {
  category: ProductCategory;
  /** Products matching every active filter. */
  total: number;
  brands: readonly FacetCount[];
  /** Lowest and highest price in the category. `null` when nothing is priced. */
  price: { min: number | null; max: number | null };
  /** The size selects' options: every value present in the category.
   *  `widths` / `aspectRatios` are the METRIC parts; a flotation size has its
   *  own two (`flotationDiameters` = the `33`, `flotationSectionWidths` = the
   *  `12.5`), which the selects list after the metric ones. */
  tire: {
    widths: readonly number[];
    aspectRatios: readonly number[];
    flotationDiameters: readonly number[];
    flotationSectionWidths: readonly number[];
    rimDiameters: readonly number[];
    seasons: readonly FacetCount<TireSeason>[];
    /** Every load index present (first number of a pair), ascending. */
    loadIndexes: readonly number[];
  } | null;
  wheel: {
    diameters: readonly number[];
    widths: readonly number[];
    boltPatterns: readonly string[];
    /** Lowest and highest offset in the category, mm. `null` = none on record. */
    offset: { min: number | null; max: number | null };
    /** Every centre bore present, mm, ascending. */
    centerBores: readonly number[];
    /** Finish families with the count each would yield (own group left out). */
    finishes: readonly FacetCount[];
  } | null;
  accessory: {
    kinds: readonly FacetCount<AccessoryKind>[];
    /** Thread sizes of lug nuts, lug bolts and wheel locks, with counts. */
    threads: readonly FacetCount[];
  } | null;
}

/* --- Staff side ---------------------------------------------------------- */

export interface ProductSource {
  vendor: string;
  vendorSku: string;
  vendorUrl: string | null;
  /** What this vendor charges the shop, cents kept (D125, F17). Staff only:
   *  never on a storefront type, never in a storefront query. */
  vendorPrice: number | null;
}

/** What the admin edits: the product, every image, and where to order it. */
export type AdminProduct = CatalogProductDetail & {
  createdAt: Date;
  sources: readonly ProductSource[];
};

export interface AdminProductFilter {
  /** Matches name, brand, model, slug or a vendor SKU. */
  search?: string;
  category?: ProductCategory;
  status?: ProductStatus;
  brand?: string;
  /** Has a source from this vendor, exact spelling (D127b). */
  vendor?: string;
  /** An accessory of this type (D127b). */
  accessoryType?: AccessoryKind;
  /** A tire with this rim diameter, or a wheel with this diameter, in
   *  inches (D127b). */
  rim?: number;
  /** `true` = only products with no photo (D127b). Never `false`: an unset
   *  filter is absent, so "any filter set?" stays a plain check. */
  noPhoto?: true;
}

export interface AdminListInput extends AdminProductFilter {
  /** Default 50, capped at 200. */
  limit?: number;
  offset?: number;
}

export type TireSpecsInput = TireSpecs;
export type WheelSpecsInput = WheelSpecs;
export type AccessorySpecsInput = AccessorySpecs;

/** A validated product, ready to write. `parseProductInput()` makes these. */
export type ProductInput = {
  /** `null` only for an accessory (D125); the validator refuses it on a tire
   *  or wheel, and so does `products_brand_required`. */
  brand: string | null;
  model: string | null;
  name: string;
  description: string | null;
  price: number | null;
  /**
   * `null` = not stated. A create then starts the product `hidden`; an update
   * leaves its status alone, so saving an edit can never unpublish a product
   * just because the form carried no status field.
   */
  status: ProductStatus | null;
  gtin: string | null;
  /** `null` on every tire: the validator refuses one, and so does
   *  `products_part_number_not_tire` (D142). */
  partNumber: string | null;
  extraSpecs: readonly ExtraSpec[];
  sources: readonly ProductSource[];
} & (
  | { category: "tires"; specs: TireSpecsInput }
  | { category: "wheels"; specs: WheelSpecsInput }
  | { category: "accessories"; specs: AccessorySpecsInput }
);

/** One product of a bulk load: validated, with the slug its loader chose. */
export interface NewProduct {
  input: ProductInput;
  slug: string;
}

export type WriteProductResult =
  | { ok: true; id: string; slug: string }
  /** Another product already carries this vendor + SKU. */
  | { ok: false; reason: "source_taken"; vendor: string; vendorSku: string }
  | { ok: false; reason: "not_found" }
  /** A product's category is fixed once it is created. */
  | { ok: false; reason: "category_changed" };
