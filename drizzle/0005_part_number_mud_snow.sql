ALTER TABLE "products" ADD COLUMN "part_number" text;--> statement-breakpoint
ALTER TABLE "tire_specs" ADD COLUMN "mud_snow" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- D142: two facts leave extra_specs for columns of their own. Hand-added data
-- move, the 0001 / 0003 pattern. Runs once, before the CHECKs below, so a part
-- number over 70 characters stops the deploy instead of being cut short.
-- Slugs are never touched (D107b(1)), and nor is updated_at: this moves where
-- a fact is kept, not the fact, so the admin list keeps its order.
--
-- (1) A wheel's or accessory's "Part number" becomes products.part_number.
UPDATE "products" AS p SET "part_number" = btrim(spec.value)
FROM (
  SELECT DISTINCT ON (pr."id") pr."id", e.elem->>'value' AS value
  FROM "products" AS pr
  CROSS JOIN LATERAL jsonb_array_elements(pr."extra_specs") WITH ORDINALITY AS e(elem, n)
  WHERE pr."category" <> 'tires'
    AND regexp_replace(lower(btrim(e.elem->>'label')), '\s+', ' ', 'g') = 'part number'
    AND btrim(coalesce(e.elem->>'value', '')) <> ''
  ORDER BY pr."id", e.n
) AS spec
WHERE p."id" = spec."id";--> statement-breakpoint
-- (2) A tire whose "Mud & snow" (or "Mud and snow") says yes is M+S.
UPDATE "tire_specs" AS t SET "mud_snow" = true
FROM "products" AS p
WHERE p."id" = t."product_id"
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(p."extra_specs") AS e(elem)
    WHERE regexp_replace(lower(btrim(e.elem->>'label')), '\s+', ' ', 'g') IN ('mud & snow', 'mud and snow')
      AND lower(btrim(e.elem->>'value')) = 'yes'
  );--> statement-breakpoint
-- (3) Both pairs leave extra_specs on every product, the rest keeping their
-- order. A tire's "Part number" is dropped, not moved: the vendors' tire codes
-- were size codes and store codes (owner, 2026-10-04: "yes drop the tire ones").
UPDATE "products" AS p SET "extra_specs" = coalesce((
  SELECT jsonb_agg(e.elem ORDER BY e.n)
  FROM jsonb_array_elements(p."extra_specs") WITH ORDINALITY AS e(elem, n)
  WHERE coalesce(regexp_replace(lower(btrim(e.elem->>'label')), '\s+', ' ', 'g'), '') NOT IN ('part number', 'mud & snow', 'mud and snow')
), '[]'::jsonb)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(p."extra_specs") AS e(elem)
  WHERE regexp_replace(lower(btrim(e.elem->>'label')), '\s+', ' ', 'g') IN ('part number', 'mud & snow', 'mud and snow')
);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_part_number_length" CHECK ("products"."part_number" is null or char_length(btrim("products"."part_number")) between 1 and 70);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_part_number_not_tire" CHECK ("products"."part_number" is null or "products"."category" <> 'tires');