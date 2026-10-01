/**
 * The staff side of the catalogue: reads that see every status and every
 * vendor source, and every write.
 *
 * NOT GATED. Nothing here checks who is calling, because more than the admin
 * needs it (an import has no browser session). The callers are the gate:
 *   - a page calls these through `src/features/admin/product-queries.ts`,
 *     which checks the session first;
 *   - a form calls these through `src/features/admin/product-actions.ts`,
 *     which checks session, origin and CSRF token first.
 * Never import this file from a storefront page. The storefront reads through
 * `queries.ts`, which cannot return a hidden product or a vendor source.
 *
 * There is no delete. A product leaves the site by becoming `hidden` or
 * `discontinued`, so nothing is lost by accident and old links keep working.
 */

import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  like,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  accessorySpecs,
  products,
  productSources,
  tireSpecs,
  wheelSpecs,
} from "@/db/schema";

import type {
  AdminListInput,
  AdminProduct,
  AdminProductFilter,
  NewProduct,
  ProductInput,
  ProductList,
  ProductSource,
  ProductStatus,
  WriteProductResult,
} from "./catalog-types";
import {
  loadImages,
  PRODUCT_SELECTION,
  toCatalogProduct,
  toCatalogProducts,
  withSpecs,
  type Executor,
} from "./rows";
import { buildProductSlug, nextFreeSlug } from "./slug";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_OFFSET = 1_000_000;

/* --- Filter → SQL -------------------------------------------------------- */

/** `%` and `_` typed into the search box are text, not wildcards. */
function likePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/**
 * Reads `products` columns and one EXISTS only, no joins, so the same
 * conditions drive the list (a SELECT) and the bulk status change (an
 * UPDATE): what staff see filtered is exactly what the bulk action touches.
 */
function filterConditions(filter: AdminProductFilter): SQL[] {
  const where: SQL[] = [];
  if (filter.category) where.push(eq(products.category, filter.category));
  if (filter.status) where.push(eq(products.status, filter.status));

  const brand = filter.brand?.trim();
  if (brand) {
    where.push(eq(sql`lower(${products.brand})`, brand.toLowerCase()));
  }

  const search = filter.search?.trim();
  if (search) {
    const pattern = likePattern(search);
    const db = getDb();
    const matches = or(
      ilike(products.name, pattern),
      ilike(products.brand, pattern),
      ilike(products.model, pattern),
      ilike(products.slug, pattern),
      exists(
        db
          .select({ one: sql`1` })
          .from(productSources)
          .where(
            and(
              eq(productSources.productId, products.id),
              ilike(productSources.vendorSku, pattern),
            ),
          ),
      ),
    );
    if (matches) where.push(matches);
  }
  return where;
}

function isEmptyFilter(filter: AdminProductFilter): boolean {
  return filterConditions(filter).length === 0;
}

/* --- Reads --------------------------------------------------------------- */

/** Every product, whatever its status, newest change first. */
export async function listAllProducts(
  input: AdminListInput = {},
): Promise<ProductList> {
  const db = getDb();
  const where = and(...filterConditions(input));
  // A NaN limit would drop the LIMIT clause and return the whole catalogue.
  const finite = (value: number | undefined, fallback: number) =>
    value !== undefined && Number.isFinite(value) ? Math.trunc(value) : fallback;
  const limit = Math.min(Math.max(finite(input.limit, DEFAULT_LIMIT), 1), MAX_LIMIT);
  const offset = Math.min(Math.max(finite(input.offset, 0), 0), MAX_OFFSET);

  const [rows, [totals]] = await Promise.all([
    withSpecs(db.select(PRODUCT_SELECTION).from(products).$dynamic())
      .where(where)
      .orderBy(desc(products.updatedAt), asc(products.id))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(products).where(where),
  ]);

  return {
    items: await toCatalogProducts(db, rows),
    total: totals?.total ?? 0,
  };
}

async function loadSources(
  db: Executor,
  productId: string,
): Promise<ProductSource[]> {
  return db
    .select({
      vendor: productSources.vendor,
      vendorSku: productSources.vendorSku,
      vendorUrl: productSources.vendorUrl,
    })
    .from(productSources)
    .where(eq(productSources.productId, productId))
    .orderBy(asc(productSources.vendor), asc(productSources.vendorSku));
}

/** One product for the edit screen: every image and every vendor source. */
export async function getProductById(id: string): Promise<AdminProduct | null> {
  const db = getDb();
  const [row] = await withSpecs(
    db.select(PRODUCT_SELECTION).from(products).$dynamic(),
  )
    .where(eq(products.id, id))
    .limit(1);
  if (!row) return null;

  const [images, sources] = await Promise.all([
    loadImages(db, [id]),
    loadSources(db, id),
  ]);
  const list = images.get(id) ?? [];
  return {
    ...toCatalogProduct(row, list[0] ?? null),
    images: list,
    createdAt: row.product.createdAt,
    sources,
  };
}

/** Every brand in the catalogue, A to Z: the suggestions under the brand
 *  field, so a new product reuses an existing spelling instead of a typo. */
export async function listBrands(): Promise<string[]> {
  const rows = await getDb()
    .selectDistinct({ brand: products.brand })
    .from(products)
    .orderBy(asc(products.brand));
  return rows.map((row) => row.brand);
}

/* --- Writes -------------------------------------------------------------- */

/** Postgres `unique_violation`. Drizzle wraps the driver error, so the code
 *  may sit on the error or on its `cause`. */
function uniqueViolation(error: unknown): string | null {
  for (const candidate of [error, (error as { cause?: unknown })?.cause]) {
    if (typeof candidate !== "object" || candidate === null) continue;
    const { code, constraint } = candidate as {
      code?: unknown;
      constraint?: unknown;
    };
    if (code === "23505") {
      return typeof constraint === "string" ? constraint : "";
    }
  }
  return null;
}

/** `base`, or `base-2`, `base-3` … whichever is the first not in use. */
async function freeSlug(db: Executor, base: string): Promise<string> {
  const taken = new Set(
    (
      await db
        .select({ slug: products.slug })
        .from(products)
        .where(
          or(
            eq(products.slug, base),
            // A slug is `[a-z0-9-]` only, so it holds no LIKE wildcard.
            like(products.slug, `${base}-%`),
          ),
        )
    ).map((row) => row.slug),
  );
  return nextFreeSlug(base, taken);
}

/** The first of `sources` that a DIFFERENT product already carries. */
async function takenSource(
  db: Executor,
  sources: readonly ProductSource[],
  ownProductId: string | null,
): Promise<ProductSource | null> {
  for (const source of sources) {
    const [hit] = await db
      .select({ productId: productSources.productId })
      .from(productSources)
      .where(
        and(
          eq(productSources.vendor, source.vendor),
          eq(productSources.vendorSku, source.vendorSku),
          ownProductId === null
            ? undefined
            : ne(productSources.productId, ownProductId),
        ),
      )
      .limit(1);
    if (hit) return source;
  }
  return null;
}

async function writeSpecs(
  db: Executor,
  productId: string,
  input: ProductInput,
): Promise<void> {
  switch (input.category) {
    case "tires":
      await db
        .insert(tireSpecs)
        .values({ productId, ...input.specs })
        .onConflictDoUpdate({ target: tireSpecs.productId, set: input.specs });
      return;
    case "wheels":
      await db
        .insert(wheelSpecs)
        .values({ productId, ...input.specs })
        .onConflictDoUpdate({ target: wheelSpecs.productId, set: input.specs });
      return;
    case "accessories":
      await db
        .insert(accessorySpecs)
        .values({ productId, ...input.specs })
        .onConflictDoUpdate({
          target: accessorySpecs.productId,
          set: input.specs,
        });
      return;
  }
}

async function replaceSources(
  db: Executor,
  productId: string,
  sources: readonly ProductSource[],
): Promise<void> {
  await db.delete(productSources).where(eq(productSources.productId, productId));
  if (sources.length > 0) {
    await db
      .insert(productSources)
      .values(sources.map((source) => ({ productId, ...source })));
  }
}

function sourceTaken(source: ProductSource): WriteProductResult {
  return {
    ok: false,
    reason: "source_taken",
    vendor: source.vendor,
    vendorSku: source.vendorSku,
  };
}

/** How many times a create starts over when another product takes the slug
 *  it chose. Only a clash the lock below cannot see gets this far. */
const SLUG_ATTEMPTS = 4;

/**
 * A write lost a race for a vendor SKU, past the check inside its
 * transaction. Looks again, now that the winner has committed, to name the
 * source that is actually taken rather than guessing the first.
 */
async function sourceTakenAfterRace(
  sources: readonly ProductSource[],
  ownProductId: string | null,
): Promise<WriteProductResult | null> {
  const taken =
    (await takenSource(getDb(), sources, ownProductId)) ?? sources[0];
  return taken ? sourceTaken(taken) : null;
}

/**
 * Creates the product, its spec row and its sources together, or none of
 * them. The slug is built from brand, model and size here and is never
 * rewritten afterwards. A product whose status is not stated starts `hidden`.
 */
export async function createProduct(
  input: ProductInput,
): Promise<WriteProductResult> {
  const base = buildProductSlug(input);

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await getDb().transaction(async (tx) => {
        const taken = await takenSource(tx, input.sources, null);
        if (taken) return sourceTaken(taken);

        // Two creates that would share a slug (two sizes typed alike, a
        // parallel import) queue here, so the second sees the first's slug
        // and takes the next suffix. Held until this transaction ends.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${base}))`);
        const slug = await freeSlug(tx, base);

        const [created] = await tx
          .insert(products)
          .values({
            category: input.category,
            slug,
            brand: input.brand,
            model: input.model,
            name: input.name,
            description: input.description,
            price: input.price,
            status: input.status ?? "hidden",
            gtin: input.gtin,
          })
          .returning({ id: products.id });
        if (!created) throw new Error("createProduct: insert returned no row.");

        await writeSpecs(tx, created.id, input);
        await replaceSources(tx, created.id, input.sources);
        return { ok: true, id: created.id, slug };
      });
    } catch (error) {
      const constraint = uniqueViolation(error);
      // The lock is per base slug, so it cannot see a product whose OWN slug
      // happens to be this one's suffixed form (`x-2` is both "x, second" and
      // a product named x-2). Rare, and choosing again resolves it.
      if (constraint === "products_slug_key" && attempt < SLUG_ATTEMPTS) {
        continue;
      }
      if (constraint === "product_sources_vendor_sku_key") {
        const result = await sourceTakenAfterRace(input.sources, null);
        if (result) return result;
      }
      throw error;
    }
  }
}

/**
 * The bulk form of `createProduct`, for a catalogue load: the same rows, one
 * INSERT per table for the whole batch instead of eight round trips per
 * product. Over a network that is the difference between minutes and a day.
 *
 * What `createProduct` checks per product, the caller checks once for the
 * whole load: every slug is free and no vendor SKU is carried twice. Nothing
 * is looked up here. The unique indexes still refuse a clash, and then the
 * statement throws and the caller's transaction takes the whole batch back.
 *
 * Pass a transaction, so a batch lands whole or not at all. Returns the new
 * ids, in the batch's order.
 */
export async function createProductsBatch(
  tx: Executor,
  batch: readonly NewProduct[],
): Promise<string[]> {
  if (batch.length === 0) return [];
  // Ids are made here rather than read back, so each spec and source row can
  // name its product without a round trip.
  const rows = batch.map((item) => ({ ...item, id: crypto.randomUUID() }));

  await tx.insert(products).values(
    rows.map(({ id, slug, input }) => ({
      id,
      category: input.category,
      slug,
      brand: input.brand,
      model: input.model,
      name: input.name,
      description: input.description,
      price: input.price,
      status: input.status ?? "hidden",
      gtin: input.gtin,
    })),
  );

  const tires: (typeof tireSpecs.$inferInsert)[] = [];
  const wheels: (typeof wheelSpecs.$inferInsert)[] = [];
  const accessories: (typeof accessorySpecs.$inferInsert)[] = [];
  const sources: (typeof productSources.$inferInsert)[] = [];
  for (const { id, input } of rows) {
    switch (input.category) {
      case "tires":
        tires.push({ productId: id, ...input.specs });
        break;
      case "wheels":
        wheels.push({ productId: id, ...input.specs });
        break;
      case "accessories":
        accessories.push({ productId: id, ...input.specs });
        break;
    }
    for (const source of input.sources) {
      sources.push({ productId: id, ...source });
    }
  }
  if (tires.length > 0) await tx.insert(tireSpecs).values(tires);
  if (wheels.length > 0) await tx.insert(wheelSpecs).values(wheels);
  if (accessories.length > 0) {
    await tx.insert(accessorySpecs).values(accessories);
  }
  if (sources.length > 0) await tx.insert(productSources).values(sources);

  return rows.map((row) => row.id);
}

/**
 * Rewrites a product's fields, specs and sources. Two things never change:
 * the slug (it is the product's URL) and the category (its specs live in a
 * category's own table). A status that is not stated is left as it is.
 */
export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<WriteProductResult> {
  try {
    return await getDb().transaction(async (tx) => {
      const [existing] = await tx
        .select({ category: products.category, slug: products.slug })
        .from(products)
        .where(eq(products.id, id))
        .for("update");
      if (!existing) return { ok: false, reason: "not_found" };
      if (existing.category !== input.category) {
        return { ok: false, reason: "category_changed" };
      }

      const taken = await takenSource(tx, input.sources, id);
      if (taken) return sourceTaken(taken);

      await tx
        .update(products)
        .set({
          brand: input.brand,
          model: input.model,
          name: input.name,
          description: input.description,
          price: input.price,
          gtin: input.gtin,
          ...(input.status === null ? {} : { status: input.status }),
        })
        .where(eq(products.id, id));
      await writeSpecs(tx, id, input);
      await replaceSources(tx, id, input.sources);
      return { ok: true, id, slug: existing.slug };
    });
  } catch (error) {
    if (uniqueViolation(error) === "product_sources_vendor_sku_key") {
      const result = await sourceTakenAfterRace(input.sources, id);
      if (result) return result;
    }
    throw error;
  }
}

/** `false` when there is no such product. */
export async function setProductStatus(
  id: string,
  status: ProductStatus,
): Promise<boolean> {
  const changed = await getDb()
    .update(products)
    .set({ status })
    .where(eq(products.id, id))
    .returning({ id: products.id });
  return changed.length > 0;
}

export type BulkStatusResult =
  | { ok: true; changed: number }
  /** No filter and no ids: refused, because it would mean every product. */
  | { ok: false; reason: "nothing_selected" };

/**
 * Sets one status on many products at once: the ticked ones (`ids`), or
 * everything the list's current filter matches. Products already in that
 * status are left alone, so `changed` is what actually moved.
 */
export async function bulkSetProductStatus(
  target: { ids?: readonly string[]; filter?: AdminProductFilter },
  status: ProductStatus,
): Promise<BulkStatusResult> {
  const ids = target.ids ?? [];
  const filter = target.filter ?? {};
  if (ids.length === 0 && isEmptyFilter(filter)) {
    return { ok: false, reason: "nothing_selected" };
  }

  const where =
    ids.length > 0
      ? inArray(products.id, [...ids])
      : and(...filterConditions(filter));

  const changed = await getDb()
    .update(products)
    .set({ status })
    .where(and(where, ne(products.status, status)))
    .returning({ id: products.id });
  return { ok: true, changed: changed.length };
}
