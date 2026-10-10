-- Storefront search (D173). pg_trgm ships with Postgres and Neon; created here
-- because drizzle-kit does not manage extensions. A plain CREATE INDEX (no
-- CONCURRENTLY, which cannot run inside the migrator's transaction): it
-- blocks writes to products, not reads, for a few seconds on ~40k rows.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "products_search_trgm_idx" ON "products" USING gin ((lower(coalesce("brand", '') || ' ' || coalesce("model", '') || ' ' || coalesce("name", '') || ' ' || coalesce("part_number", '') || ' ' || regexp_replace(coalesce("part_number", ''), '[^A-Za-z0-9]+', '', 'g'))) gin_trgm_ops);