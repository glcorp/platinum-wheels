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

export const ACCESSORY_KINDS = [
  "lug_nuts",
  "wheel_locks",
  "hub_rings",
  "centre_caps",
  "tpms",
  "spacers",
  "wheel_weights",
  "hub_caps",
  "other",
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
  brand: string;
  model: string | null;
  name: string;
  description: string | null;
  /** Just a number, or `null` when there is none to show. */
  price: number | null;
  status: ProductStatus;
  gtin: string | null;
  updatedAt: Date;
  /** The first image by sort order: the card's photo. */
  image: CatalogImage | null;
} & CatalogSpecs;

/** The product page: every image, in order. */
export type CatalogProductDetail = CatalogProduct & {
  images: readonly CatalogImage[];
};

/* --- Filters ------------------------------------------------------------- */

export type CatalogSort = "best" | "price-asc" | "price-desc";

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
    width?: number;
    aspectRatio?: number;
    rimDiameter?: number;
    seasons?: readonly TireSeason[];
  };
  wheel?: {
    diameter?: number;
    width?: number;
    /** `5x114.3`. Matches a wheel drilled for it, alone or with another. */
    boltPattern?: string;
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
  /** The size selects' options: every value present in the category. */
  tire: {
    widths: readonly number[];
    aspectRatios: readonly number[];
    rimDiameters: readonly number[];
    seasons: readonly FacetCount<TireSeason>[];
  } | null;
  wheel: {
    diameters: readonly number[];
    widths: readonly number[];
    boltPatterns: readonly string[];
  } | null;
  accessory: {
    kinds: readonly FacetCount<AccessoryKind>[];
  } | null;
}

/* --- Staff side ---------------------------------------------------------- */

export interface ProductSource {
  vendor: string;
  vendorSku: string;
  vendorUrl: string | null;
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
  brand: string;
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
  sources: readonly ProductSource[];
} & (
  | { category: "tires"; specs: TireSpecsInput }
  | { category: "wheels"; specs: WheelSpecsInput }
  | { category: "accessories"; specs: AccessorySpecsInput }
);

export type WriteProductResult =
  | { ok: true; id: string; slug: string }
  /** Another product already carries this vendor + SKU. */
  | { ok: false; reason: "source_taken"; vendor: string; vendorSku: string }
  | { ok: false; reason: "not_found" }
  /** A product's category is fixed once it is created. */
  | { ok: false; reason: "category_changed" };
