/* ---------------------------------------------------------------------------
   Database schema — catalogue (Drizzle, Postgres on Neon).

   Six tables:

     products          One row per thing a customer can enquire about. One
                       SIZE is one product: a tire model in twelve sizes is
                       twelve rows, each with its own slug and its own page.
     tire_specs        1:1 with a `tires` product.
     wheel_specs       1:1 with a `wheels` product.
     accessory_specs   1:1 with an `accessories` product.
     product_images    Zero or more per product, in a set order.
     product_sources   Which vendor(s) a product can be ordered from. Staff
                       only; never read by a storefront query.

   Shaped from the vendor sheets (four vendors, ~46k rows, 2026-09-30), which
   are a reference for the shape only. Cleaning the data and merging a product
   two vendors both sell into one row is done upstream, before it reaches this
   database — nothing here dedupes.

   Rules this file makes true, so no code path can get them wrong:
     - a spec row can only hang off a product of its own category: each spec
       table carries a `category` column pinned by a CHECK and a composite
       foreign key to `products (id, category)`. A wheel can never grow tire
       specs, and a product that has specs cannot change category;
     - a tire is either `metric` (225/45R17) or `flotation` (35x12.50R20), and
       each format has the columns it needs;
     - a vendor SKU belongs to exactly one product.

   `price` is a number and nothing more. It deliberately carries no currency,
   tax or per-unit meaning: the shop has not decided what it is, and the column
   must not decide for them. It may be empty.

   Deliberately NOT stored: MAP / MSRP / jobber, stock and warehouse counts
   (this is a catalogue, not a store), French text. Each vendor's own price
   IS stored since D125, on its `product_sources` row, staff only.
   --------------------------------------------------------------------------- */

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ===========================================================================
   Enums
   =========================================================================== */

export const productCategory = pgEnum("product_category", [
  "tires",
  "wheels",
  "accessories",
]);

/**
 * Who can see a product.
 *
 *   hidden        Staff only. Not in listings, and its page is a 404.
 *   published     In listings and search, page live.
 *   discontinued  Not in listings, but its page still loads and still takes an
 *                 enquiry, so an old link never dies.
 *
 * There is no in-stock flag: `discontinued` is the only "can't get it" state.
 */
export const productStatus = pgEnum("product_status", [
  "hidden",
  "published",
  "discontinued",
]);

/** `metric` = 225/45R17. `flotation` = 35x12.50R20 (overall diameter x section
 *  width, in inches), which has no width / aspect-ratio split. */
export const tireSizeFormat = pgEnum("tire_size_format", [
  "metric",
  "flotation",
]);

/** All-weather is its own season, not a kind of all-season: every vendor
 *  lists it separately and it carries the winter (3PMSF) rating. */
export const tireSeason = pgEnum("tire_season", [
  "summer",
  "all_season",
  "all_weather",
  "winter",
]);

/** The vendors' own fifteen product types, one key each (D125). The label a
 *  shopper reads is `ACCESSORY_LABEL` in `src/features/catalog/adapter.ts`. */
export const accessoryType = pgEnum("accessory_type", [
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
]);

/** One vendor fact with no column of its own, in the order the vendor gave
 *  it: `{ label: "Weight (lb)", value: "28.9" }`. Only facts too sparse for a
 *  column land here (D125). */
export interface ExtraSpec {
  label: string;
  value: string;
}

/* ===========================================================================
   products
   =========================================================================== */

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: productCategory("category").notNull(),

    /**
     * URL segment: brand + model + size, e.g. `pirelli-p-zero-235-45r18-98y`.
     * Set once when the row is created and never rewritten afterwards, so a
     * link or a search ranking never breaks.
     */
    slug: text("slug").notNull(),

    /** Plain text, spelled the way the storefront should show it. The Brand
     *  filter lists the distinct values of this column. Empty only on an
     *  accessory the vendor sells unbranded (D125); a tire or wheel always
     *  has one, which `products_brand_required` makes true. */
    brand: text("brand"),
    /** `P-Zero`. Groups the sizes of one model ("other sizes"). Some
     *  accessories have none. */
    model: text("model"),
    /** Full display title. */
    name: text("name").notNull(),
    description: text("description"),

    /** Just a number. No currency, tax or unit is implied. May be empty. */
    price: numeric("price", { precision: 10, scale: 2, mode: "number" }),

    status: productStatus("status").notNull().default("hidden"),

    /** Barcode (GTIN / UPC / EAN), when the vendor gives one. */
    gtin: text("gtin"),

    /** Vendor facts too sparse for a column of their own (D125), shown in the
     *  product page's specifications after the columns. */
    extraSpecs: jsonb("extra_specs")
      .$type<ExtraSpec[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("products_slug_key").on(t.slug),
    // Target of the spec tables' composite foreign keys. A table CONSTRAINT,
    // not a unique index: drizzle-kit emits indexes after foreign keys, and a
    // foreign key cannot be added before the uniqueness it points at exists.
    unique("products_id_category_key").on(t.id, t.category),
    // Listings: one category, published, optionally one brand.
    index("products_category_status_brand_idx").on(
      t.category,
      t.status,
      t.brand,
    ),
    // Price sort and the price-range filter.
    index("products_category_status_price_idx").on(
      t.category,
      t.status,
      t.price,
    ),
    // "Other sizes": same brand and model.
    index("products_brand_model_idx").on(t.brand, t.model),
    // The admin list: every status, newest change first (D127b). NULLS FIRST
    // because that is what `ORDER BY updated_at DESC` means; an index that
    // orders nulls the other way cannot serve the sort.
    index("products_updated_at_idx").on(t.updatedAt.desc().nullsFirst(), t.id),

    check(
      "products_slug_format",
      sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(${t.slug}) <= 200`,
    ),
    check(
      "products_brand_length",
      sql`${t.brand} is null or char_length(btrim(${t.brand})) between 1 and 80`,
    ),
    check(
      "products_brand_required",
      sql`${t.brand} is not null or ${t.category} = 'accessories'`,
    ),
    check(
      "products_extra_specs_array",
      sql`jsonb_typeof(${t.extraSpecs}) = 'array'`,
    ),
    check(
      "products_name_length",
      sql`char_length(btrim(${t.name})) between 1 and 200`,
    ),
    check(
      "products_price_not_negative",
      sql`${t.price} is null or ${t.price} >= 0`,
    ),
  ],
);

/* ===========================================================================
   tire_specs
   =========================================================================== */

export const tireSpecs = pgTable(
  "tire_specs",
  {
    productId: uuid("product_id").primaryKey(),
    /** Always `tires`. Exists so the composite foreign key below can refuse a
     *  product of any other category. */
    category: productCategory("category").notNull().default("tires"),

    sizeFormat: tireSizeFormat("size_format").notNull(),
    /** The size as it is read out: `225/45R17`, `LT275/70R18`, `35x12.50R20`. */
    size: text("size").notNull(),

    /** Section width in mm. Metric sizes only. */
    width: integer("width"),
    /** Metric sizes only, and absent on the few that omit it (`185R14C`). */
    aspectRatio: integer("aspect_ratio"),
    /** Inches. Every tire has one, whichever the format. */
    rimDiameter: numeric("rim_diameter", {
      precision: 4,
      scale: 1,
      mode: "number",
    }).notNull(),
    /** Inches. Flotation sizes only: the `35` in `35x12.50R20`. */
    overallDiameter: numeric("overall_diameter", {
      precision: 4,
      scale: 1,
      mode: "number",
    }),
    /** Inches. Flotation sizes only: the `12.50` in `35x12.50R20`. */
    sectionWidth: numeric("section_width", {
      precision: 4,
      scale: 2,
      mode: "number",
    }),

    /** `P`, `LT`, `ST`, `HL`, `C`. */
    serviceType: text("service_type"),
    /** Text, not a number: light-truck tires carry a pair, `121/118`. */
    loadIndex: text("load_index"),
    speedRating: text("speed_rating"),
    /** `C` / `D` / `E` / `F`, or `SL` / `XL`. */
    loadRange: text("load_range"),
    plyRating: integer("ply_rating"),
    isXl: boolean("is_xl").notNull().default(false),

    season: tireSeason("season"),
    /** Three-peak mountain snowflake (3PMSF). */
    winterApproved: boolean("winter_approved").notNull().default(false),
    studdable: boolean("studdable").notNull().default(false),
    runFlat: boolean("run_flat").notNull().default(false),

    /** `420 A A`. */
    utqg: text("utqg"),
  },
  (t) => [
    foreignKey({
      name: "tire_specs_product_fk",
      columns: [t.productId, t.category],
      foreignColumns: [products.id, products.category],
    }).onDelete("cascade"),
    check("tire_specs_category_tires", sql`${t.category} = 'tires'`),

    // The size search: width / profile / rim, any subset.
    index("tire_specs_size_idx").on(t.width, t.aspectRatio, t.rimDiameter),
    index("tire_specs_rim_idx").on(t.rimDiameter),
    index("tire_specs_season_idx").on(t.season),

    check(
      "tire_specs_metric_has_width",
      sql`${t.sizeFormat} <> 'metric' or ${t.width} is not null`,
    ),
    check(
      "tire_specs_flotation_has_dimensions",
      sql`${t.sizeFormat} <> 'flotation' or (${t.overallDiameter} is not null and ${t.sectionWidth} is not null)`,
    ),
    check(
      "tire_specs_dimensions_positive",
      sql`${t.rimDiameter} > 0
        and (${t.width} is null or ${t.width} > 0)
        and (${t.aspectRatio} is null or ${t.aspectRatio} > 0)
        and (${t.overallDiameter} is null or ${t.overallDiameter} > 0)
        and (${t.sectionWidth} is null or ${t.sectionWidth} > 0)`,
    ),
    check(
      "tire_specs_size_length",
      sql`char_length(btrim(${t.size})) between 1 and 40`,
    ),
  ],
);

/* ===========================================================================
   wheel_specs
   =========================================================================== */

export const wheelSpecs = pgTable(
  "wheel_specs",
  {
    productId: uuid("product_id").primaryKey(),
    /** Always `wheels`. See `tire_specs.category`. */
    category: productCategory("category").notNull().default("wheels"),

    /** Inches. */
    diameter: numeric("diameter", {
      precision: 5,
      scale: 2,
      mode: "number",
    }).notNull(),
    /** Inches. */
    width: numeric("width", {
      precision: 5,
      scale: 2,
      mode: "number",
    }).notNull(),

    /**
     * `5x114.3`, lower-case `x`, no spaces. A list because some wheels are
     * drilled for two patterns (`6x135` and `6x139.7`); filtering on either
     * one finds the wheel.
     */
    boltPatterns: text("bolt_patterns")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),

    /** Millimetres, signed: `35`, `-44`. */
    offsetMm: numeric("offset_mm", { precision: 5, scale: 1, mode: "number" }),
    centerBoreMm: numeric("center_bore_mm", {
      precision: 6,
      scale: 2,
      mode: "number",
    }),
    /** Inches. */
    backspacing: numeric("backspacing", {
      precision: 6,
      scale: 3,
      mode: "number",
    }),

    /** The vendor's own wording, shown as-is in the specifications. Free text
     *  on purpose: there is no finish filter, so nothing needs to group it. */
    finish: text("finish"),
    /** The finish's family, `Gloss Black` / `Gunmetal & Grey`, as the vendor
     *  sheets group it (D125). Free text; no filter reads it yet. */
    finishFamily: text("finish_family"),
    /** `Black`, `Machined`. */
    color: text("color"),
    /** Studs on the hub. Stored as the vendor gives it (D125), beside the bolt
     *  patterns it usually repeats. */
    lugCount: integer("lug_count"),
    material: text("material"),
    seatType: text("seat_type"),
    /** Pounds. A vendor that quotes kilograms is converted before it lands. */
    loadRatingLbs: integer("load_rating_lbs"),
    /** Empty = the vendor did not say. */
    tpmsCompatible: boolean("tpms_compatible"),
    /** Empty = the vendor did not say. */
    winterCompatible: boolean("winter_compatible"),
  },
  (t) => [
    foreignKey({
      name: "wheel_specs_product_fk",
      columns: [t.productId, t.category],
      foreignColumns: [products.id, products.category],
    }).onDelete("cascade"),
    check("wheel_specs_category_wheels", sql`${t.category} = 'wheels'`),

    index("wheel_specs_size_idx").on(t.diameter, t.width),
    // "Any wheel drilled for 5x114.3".
    index("wheel_specs_bolt_patterns_idx").using("gin", t.boltPatterns),

    check(
      "wheel_specs_dimensions_positive",
      sql`${t.diameter} > 0 and ${t.width} > 0
        and (${t.centerBoreMm} is null or ${t.centerBoreMm} > 0)
        and (${t.loadRatingLbs} is null or ${t.loadRatingLbs} > 0)
        and (${t.lugCount} is null or ${t.lugCount} between 3 and 12)`,
    ),
  ],
);

/* ===========================================================================
   accessory_specs
   =========================================================================== */

export const accessorySpecs = pgTable(
  "accessory_specs",
  {
    productId: uuid("product_id").primaryKey(),
    /** Always `accessories`. See `tire_specs.category`. */
    category: productCategory("category").notNull().default("accessories"),

    accessoryType: accessoryType("accessory_type").notNull(),

    /** `14x1.5`, `1/2"`. */
    threadSize: text("thread_size"),
    seatType: text("seat_type"),
    finish: text("finish"),
    /** Pieces in the pack. */
    packQuantity: integer("pack_quantity"),
    /** The vendor's narrower kind within the type: `Center Cap`, `Logo`,
     *  `Screw` (D125). */
    partType: text("part_type"),
    /** Pounds, as the vendor gives it (D125). */
    weightLb: numeric("weight_lb", { precision: 8, scale: 2, mode: "number" }),
    /** Hub rings. */
    outerDiameterMm: numeric("outer_diameter_mm", {
      precision: 6,
      scale: 2,
      mode: "number",
    }),
    innerDiameterMm: numeric("inner_diameter_mm", {
      precision: 6,
      scale: 2,
      mode: "number",
    }),
  },
  (t) => [
    foreignKey({
      name: "accessory_specs_product_fk",
      columns: [t.productId, t.category],
      foreignColumns: [products.id, products.category],
    }).onDelete("cascade"),
    check(
      "accessory_specs_category_accessories",
      sql`${t.category} = 'accessories'`,
    ),

    index("accessory_specs_type_idx").on(t.accessoryType),

    check(
      "accessory_specs_pack_quantity_positive",
      sql`${t.packQuantity} is null or ${t.packQuantity} > 0`,
    ),
    check(
      "accessory_specs_weight_positive",
      sql`${t.weightLb} is null or ${t.weightLb} > 0`,
    ),
  ],
);

/* ===========================================================================
   product_images
   =========================================================================== */

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt").notNull().default(""),
    /** Lowest first. The first image is the card's photo. */
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("product_images_product_order_idx").on(t.productId, t.sortOrder),
    check("product_images_url_not_empty", sql`char_length(btrim(${t.url})) > 0`),
  ],
);

/* ===========================================================================
   product_sources
   =========================================================================== */

export const productSources = pgTable(
  "product_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /** Vendor name, as staff know it: `Auto Country`, `PRO WHEELS`. */
    vendor: text("vendor").notNull(),
    vendorSku: text("vendor_sku").notNull(),
    /** The vendor's own product page, when it has one. */
    vendorUrl: text("vendor_url"),
    /**
     * What this vendor charges the shop, exactly as its portal gives it, cents
     * kept (F17). Staff only, like the rest of this table: no storefront query
     * selects it. It is not the display price; that is `products.price`, set
     * by the shop (D125).
     */
    vendorPrice: numeric("vendor_price", {
      precision: 10,
      scale: 2,
      mode: "number",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // One vendor SKU is one product. A product may have several sources.
    uniqueIndex("product_sources_vendor_sku_key").on(t.vendor, t.vendorSku),
    index("product_sources_product_idx").on(t.productId),
    check(
      "product_sources_vendor_not_empty",
      sql`char_length(btrim(${t.vendor})) > 0`,
    ),
    check(
      "product_sources_vendor_price_not_negative",
      sql`${t.vendorPrice} is null or ${t.vendorPrice} >= 0`,
    ),
    check(
      "product_sources_vendor_sku_not_empty",
      sql`char_length(btrim(${t.vendorSku})) > 0`,
    ),
  ],
);

export type ProductRow = typeof products.$inferSelect;
export type NewProductRow = typeof products.$inferInsert;
export type TireSpecsRow = typeof tireSpecs.$inferSelect;
export type NewTireSpecsRow = typeof tireSpecs.$inferInsert;
export type WheelSpecsRow = typeof wheelSpecs.$inferSelect;
export type NewWheelSpecsRow = typeof wheelSpecs.$inferInsert;
export type AccessorySpecsRow = typeof accessorySpecs.$inferSelect;
export type NewAccessorySpecsRow = typeof accessorySpecs.$inferInsert;
export type ProductImageRow = typeof productImages.$inferSelect;
export type NewProductImageRow = typeof productImages.$inferInsert;
export type ProductSourceRow = typeof productSources.$inferSelect;
export type NewProductSourceRow = typeof productSources.$inferInsert;
