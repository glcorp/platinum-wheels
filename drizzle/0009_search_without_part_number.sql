-- Storefront search stops reading the part number (D193): it is the vendor's
-- SKU, and a shopper must not find a product by a vendor's code. Rebuilds the
-- 0006 trigram index over brand, model and name only, the expression
-- productSearchText() now returns. Plain CREATE INDEX, as in 0006: it blocks
-- writes to products, not reads, for a few seconds on ~42k rows.
DROP INDEX "products_search_trgm_idx";--> statement-breakpoint
CREATE INDEX "products_search_trgm_idx" ON "products" USING gin ((lower(coalesce("brand", '') || ' ' || coalesce("model", '') || ' ' || coalesce("name", ''))) gin_trgm_ops);