-- D125: accessory types become the vendors' fifteen. Old values have no safe
-- mapping, so this refuses to run while any accessory carries one. Owner,
-- 2026-10-03: "Exactly 15, merge after emptying prod". Hand-added guard.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "accessory_specs"
    WHERE "accessory_type"::text NOT IN ('center_caps', 'lug_nuts', 'cap_logos_inserts_hardware', 'hub_rings', 'lug_bolts', 'wheel_weights', 'wheel_covers_trim', 'wheel_spacers', 'wheel_locks', 'tpms_sensors_tools', 'tools_gauges_organizers', 'tire_studs', 'valves_caps', 'antennas', 'tire_bags_storage')
  ) THEN
    RAISE EXCEPTION 'D125: empty the catalogue before migrating; accessory_specs holds accessory types that no longer exist.';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_brand_length";--> statement-breakpoint
ALTER TABLE "wheel_specs" DROP CONSTRAINT "wheel_specs_dimensions_positive";--> statement-breakpoint
ALTER TABLE "accessory_specs" ALTER COLUMN "accessory_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."accessory_type";--> statement-breakpoint
CREATE TYPE "public"."accessory_type" AS ENUM('center_caps', 'lug_nuts', 'cap_logos_inserts_hardware', 'hub_rings', 'lug_bolts', 'wheel_weights', 'wheel_covers_trim', 'wheel_spacers', 'wheel_locks', 'tpms_sensors_tools', 'tools_gauges_organizers', 'tire_studs', 'valves_caps', 'antennas', 'tire_bags_storage');--> statement-breakpoint
ALTER TABLE "accessory_specs" ALTER COLUMN "accessory_type" SET DATA TYPE "public"."accessory_type" USING "accessory_type"::"public"."accessory_type";--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "brand" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "accessory_specs" ADD COLUMN "part_type" text;--> statement-breakpoint
ALTER TABLE "accessory_specs" ADD COLUMN "weight_lb" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "product_sources" ADD COLUMN "vendor_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "extra_specs" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "wheel_specs" ADD COLUMN "finish_family" text;--> statement-breakpoint
ALTER TABLE "wheel_specs" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "wheel_specs" ADD COLUMN "lug_count" integer;--> statement-breakpoint
ALTER TABLE "accessory_specs" ADD CONSTRAINT "accessory_specs_weight_positive" CHECK ("accessory_specs"."weight_lb" is null or "accessory_specs"."weight_lb" > 0);--> statement-breakpoint
ALTER TABLE "product_sources" ADD CONSTRAINT "product_sources_vendor_price_not_negative" CHECK ("product_sources"."vendor_price" is null or "product_sources"."vendor_price" >= 0);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_required" CHECK ("products"."brand" is not null or "products"."category" = 'accessories');--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_extra_specs_array" CHECK (jsonb_typeof("products"."extra_specs") = 'array');--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_length" CHECK ("products"."brand" is null or char_length(btrim("products"."brand")) between 1 and 80);--> statement-breakpoint
ALTER TABLE "wheel_specs" ADD CONSTRAINT "wheel_specs_dimensions_positive" CHECK ("wheel_specs"."diameter" > 0 and "wheel_specs"."width" > 0
        and ("wheel_specs"."center_bore_mm" is null or "wheel_specs"."center_bore_mm" > 0)
        and ("wheel_specs"."load_rating_lbs" is null or "wheel_specs"."load_rating_lbs" > 0)
        and ("wheel_specs"."lug_count" is null or "wheel_specs"."lug_count" between 3 and 12));