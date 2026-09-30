CREATE TYPE "public"."accessory_type" AS ENUM('lug_nuts', 'wheel_locks', 'hub_rings', 'centre_caps', 'tpms', 'spacers', 'wheel_weights', 'hub_caps', 'other');--> statement-breakpoint
CREATE TYPE "public"."product_category" AS ENUM('tires', 'wheels', 'accessories');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('hidden', 'published', 'discontinued');--> statement-breakpoint
CREATE TYPE "public"."tire_season" AS ENUM('summer', 'all_season', 'all_weather', 'winter');--> statement-breakpoint
CREATE TYPE "public"."tire_size_format" AS ENUM('metric', 'flotation');--> statement-breakpoint
CREATE TABLE "accessory_specs" (
	"product_id" uuid PRIMARY KEY NOT NULL,
	"category" "product_category" DEFAULT 'accessories' NOT NULL,
	"accessory_type" "accessory_type" NOT NULL,
	"thread_size" text,
	"seat_type" text,
	"finish" text,
	"pack_quantity" integer,
	"outer_diameter_mm" numeric(6, 2),
	"inner_diameter_mm" numeric(6, 2),
	CONSTRAINT "accessory_specs_category_accessories" CHECK ("accessory_specs"."category" = 'accessories'),
	CONSTRAINT "accessory_specs_pack_quantity_positive" CHECK ("accessory_specs"."pack_quantity" is null or "accessory_specs"."pack_quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"url" text NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_images_url_not_empty" CHECK (char_length(btrim("product_images"."url")) > 0)
);
--> statement-breakpoint
CREATE TABLE "product_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"vendor" text NOT NULL,
	"vendor_sku" text NOT NULL,
	"vendor_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_sources_vendor_not_empty" CHECK (char_length(btrim("product_sources"."vendor")) > 0),
	CONSTRAINT "product_sources_vendor_sku_not_empty" CHECK (char_length(btrim("product_sources"."vendor_sku")) > 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "product_category" NOT NULL,
	"slug" text NOT NULL,
	"brand" text NOT NULL,
	"model" text,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(10, 2),
	"status" "product_status" DEFAULT 'hidden' NOT NULL,
	"gtin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_id_category_key" UNIQUE("id","category"),
	CONSTRAINT "products_slug_format" CHECK ("products"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length("products"."slug") <= 200),
	CONSTRAINT "products_brand_length" CHECK (char_length(btrim("products"."brand")) between 1 and 80),
	CONSTRAINT "products_name_length" CHECK (char_length(btrim("products"."name")) between 1 and 200),
	CONSTRAINT "products_price_not_negative" CHECK ("products"."price" is null or "products"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tire_specs" (
	"product_id" uuid PRIMARY KEY NOT NULL,
	"category" "product_category" DEFAULT 'tires' NOT NULL,
	"size_format" "tire_size_format" NOT NULL,
	"size" text NOT NULL,
	"width" integer,
	"aspect_ratio" integer,
	"rim_diameter" numeric(4, 1) NOT NULL,
	"overall_diameter" numeric(4, 1),
	"section_width" numeric(4, 2),
	"service_type" text,
	"load_index" text,
	"speed_rating" text,
	"load_range" text,
	"ply_rating" integer,
	"is_xl" boolean DEFAULT false NOT NULL,
	"season" "tire_season",
	"winter_approved" boolean DEFAULT false NOT NULL,
	"studdable" boolean DEFAULT false NOT NULL,
	"run_flat" boolean DEFAULT false NOT NULL,
	"utqg" text,
	CONSTRAINT "tire_specs_category_tires" CHECK ("tire_specs"."category" = 'tires'),
	CONSTRAINT "tire_specs_metric_has_width" CHECK ("tire_specs"."size_format" <> 'metric' or "tire_specs"."width" is not null),
	CONSTRAINT "tire_specs_flotation_has_dimensions" CHECK ("tire_specs"."size_format" <> 'flotation' or ("tire_specs"."overall_diameter" is not null and "tire_specs"."section_width" is not null)),
	CONSTRAINT "tire_specs_dimensions_positive" CHECK ("tire_specs"."rim_diameter" > 0
        and ("tire_specs"."width" is null or "tire_specs"."width" > 0)
        and ("tire_specs"."aspect_ratio" is null or "tire_specs"."aspect_ratio" > 0)
        and ("tire_specs"."overall_diameter" is null or "tire_specs"."overall_diameter" > 0)
        and ("tire_specs"."section_width" is null or "tire_specs"."section_width" > 0)),
	CONSTRAINT "tire_specs_size_length" CHECK (char_length(btrim("tire_specs"."size")) between 1 and 40)
);
--> statement-breakpoint
CREATE TABLE "wheel_specs" (
	"product_id" uuid PRIMARY KEY NOT NULL,
	"category" "product_category" DEFAULT 'wheels' NOT NULL,
	"diameter" numeric(5, 2) NOT NULL,
	"width" numeric(5, 2) NOT NULL,
	"bolt_patterns" text[] DEFAULT '{}'::text[] NOT NULL,
	"offset_mm" numeric(5, 1),
	"center_bore_mm" numeric(6, 2),
	"backspacing" numeric(6, 3),
	"finish" text,
	"material" text,
	"seat_type" text,
	"load_rating_lbs" integer,
	"tpms_compatible" boolean,
	"winter_compatible" boolean,
	CONSTRAINT "wheel_specs_category_wheels" CHECK ("wheel_specs"."category" = 'wheels'),
	CONSTRAINT "wheel_specs_dimensions_positive" CHECK ("wheel_specs"."diameter" > 0 and "wheel_specs"."width" > 0
        and ("wheel_specs"."center_bore_mm" is null or "wheel_specs"."center_bore_mm" > 0)
        and ("wheel_specs"."load_rating_lbs" is null or "wheel_specs"."load_rating_lbs" > 0))
);
--> statement-breakpoint
ALTER TABLE "accessory_specs" ADD CONSTRAINT "accessory_specs_product_fk" FOREIGN KEY ("product_id","category") REFERENCES "public"."products"("id","category") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_sources" ADD CONSTRAINT "product_sources_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tire_specs" ADD CONSTRAINT "tire_specs_product_fk" FOREIGN KEY ("product_id","category") REFERENCES "public"."products"("id","category") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wheel_specs" ADD CONSTRAINT "wheel_specs_product_fk" FOREIGN KEY ("product_id","category") REFERENCES "public"."products"("id","category") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accessory_specs_type_idx" ON "accessory_specs" USING btree ("accessory_type");--> statement-breakpoint
CREATE INDEX "product_images_product_order_idx" ON "product_images" USING btree ("product_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "product_sources_vendor_sku_key" ON "product_sources" USING btree ("vendor","vendor_sku");--> statement-breakpoint
CREATE INDEX "product_sources_product_idx" ON "product_sources" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_key" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "products_category_status_brand_idx" ON "products" USING btree ("category","status","brand");--> statement-breakpoint
CREATE INDEX "products_category_status_price_idx" ON "products" USING btree ("category","status","price");--> statement-breakpoint
CREATE INDEX "products_brand_model_idx" ON "products" USING btree ("brand","model");--> statement-breakpoint
CREATE INDEX "tire_specs_size_idx" ON "tire_specs" USING btree ("width","aspect_ratio","rim_diameter");--> statement-breakpoint
CREATE INDEX "tire_specs_rim_idx" ON "tire_specs" USING btree ("rim_diameter");--> statement-breakpoint
CREATE INDEX "tire_specs_season_idx" ON "tire_specs" USING btree ("season");--> statement-breakpoint
CREATE INDEX "wheel_specs_size_idx" ON "wheel_specs" USING btree ("diameter","width");--> statement-breakpoint
CREATE INDEX "wheel_specs_bolt_patterns_idx" ON "wheel_specs" USING gin ("bolt_patterns");