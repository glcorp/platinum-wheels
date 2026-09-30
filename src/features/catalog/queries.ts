/**
 * Storefront reads: everything a public page asks the catalogue.
 *
 * Plain async functions for Server Components to call; there is no REST layer
 * in between. Server only: never import this from a `"use client"` file, it
 * opens database connections (`src/db/llm.md`).
 *
 * Visibility is decided here and nowhere else:
 *   - listings, facets, "other sizes", "similar" and the sitemap see
 *     `published` products only;
 *   - a product page loads `published` and `discontinued`;
 *   - `hidden` is never returned by anything in this file.
 * Vendor sources are staff-only and are not read here at all.
 */

import {
  and,
  arrayContains,
  arrayOverlaps,
  asc,
  between,
  count,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  max,
  min,
  ne,
  not,
  sql,
  type SQL,
} from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  accessorySpecs,
  productImages,
  products,
  tireSpecs,
  wheelSpecs,
} from "@/db/schema";

import {
  ACCESSORY_KINDS,
  TIRE_SEASONS,
  type AccessoryKind,
  type CatalogFacets,
  type CatalogProduct,
  type CatalogProductDetail,
  type CatalogSort,
  type FacetCount,
  type ListProductsInput,
  type ProductCategory,
  type ProductFilters,
  type ProductList,
  type TireSeason,
} from "./catalog-types";
import {
  loadImages,
  PRODUCT_SELECTION,
  toCatalogProduct,
  toCatalogProducts,
  withSpecs,
} from "./rows";
import { normalizeBoltPattern, normalizeThreadSize } from "./size";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 150;
const MAX_OFFSET = 1_000_000;
/** The `products_slug_format` CHECK. Anything else cannot be a slug, so it is
 *  a 404 without asking the database (which refuses some of it outright). */
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SLUG_MAX_LENGTH = 200;

/** How far "near" reaches. A tire one step wider or one profile taller; a
 *  wheel up to an inch wider or narrower. */
const NEAR = { tireWidth: 10, tireAspectRatio: 5, wheelWidth: 1 } as const;

const NOTHING = sql`false`;

const HAS_PHOTO = sql`exists (select 1 from ${productImages} where ${productImages.productId} = ${products.id})`;

/* --- Filters → SQL ------------------------------------------------------- */

/** A facet's own group is left out when counting its options, so a count says
 *  what choosing that option would yield given every OTHER filter. */
type FilterGroup = "brands" | "chips";

/**
 * Filters arrive from a query string, so a value may be anything. One that
 * its column could never hold is treated as "not given" rather than sent to
 * Postgres, which would answer with an error instead of an empty list.
 */
function wholeNumber(value: number | undefined): number | undefined {
  return value !== undefined &&
    Number.isInteger(value) &&
    value > 0 &&
    value < 10_000
    ? value
    : undefined;
}

function measure(value: number | undefined): number | undefined {
  return value !== undefined &&
    Number.isFinite(value) &&
    value > 0 &&
    value < 1_000
    ? value
    : undefined;
}

function amount(value: number | undefined): number | undefined {
  return value !== undefined &&
    Number.isFinite(value) &&
    value >= 0 &&
    value < 100_000_000
    ? value
    : undefined;
}

/** The three tire size parts and the three wheel size parts, cleaned. A bolt
 *  pattern is stored in one spelling, so the filter is put into it too. */
function sizeParts(filters: ProductFilters) {
  const boltPattern = filters.wheel?.boltPattern;
  return {
    tire: {
      width: wholeNumber(filters.tire?.width),
      aspectRatio: wholeNumber(filters.tire?.aspectRatio),
      rimDiameter: measure(filters.tire?.rimDiameter),
    },
    wheel: {
      diameter: measure(filters.wheel?.diameter),
      width: measure(filters.wheel?.width),
      // `null` = a bolt pattern was given and is not one: match nothing.
      boltPattern:
        boltPattern === undefined ? undefined : normalizeBoltPattern(boltPattern),
    },
  };
}

/**
 * True for a lug nut or wheel lock cut to a thread other than the vehicle's.
 * Only a product that STATES a different thread contradicts: one with no
 * thread on record, and every other kind of accessory, never does. `coalesce`
 * keeps a product with no spec row on the "does not contradict" side, so it
 * lands in the matches rather than in neither list.
 */
function contradictsThread(thread: string): SQL {
  return sql`coalesce(${accessorySpecs.accessoryType} in ('lug_nuts', 'wheel_locks') and ${accessorySpecs.threadSize} is not null and ${accessorySpecs.threadSize} <> ${normalizeThreadSize(thread)}, false)`;
}

function vehicleThread(filters: ProductFilters): string | null {
  const thread =
    filters.category === "accessories" ? filters.accessory?.thread?.trim() : "";
  return thread ? thread : null;
}

/** Every size part given, matched exactly. `null` = no size part given. */
function exactSize(filters: ProductFilters): SQL | null {
  const parts: SQL[] = [];
  const thread = vehicleThread(filters);
  if (thread !== null) parts.push(not(contradictsThread(thread)));
  if (filters.category === "tires") {
    const { width, aspectRatio, rimDiameter } = sizeParts(filters).tire;
    if (width !== undefined) parts.push(eq(tireSpecs.width, width));
    if (aspectRatio !== undefined) {
      parts.push(eq(tireSpecs.aspectRatio, aspectRatio));
    }
    if (rimDiameter !== undefined) {
      parts.push(eq(tireSpecs.rimDiameter, rimDiameter));
    }
  }
  if (filters.category === "wheels") {
    const { diameter, width, boltPattern } = sizeParts(filters).wheel;
    if (diameter !== undefined) parts.push(eq(wheelSpecs.diameter, diameter));
    if (width !== undefined) parts.push(eq(wheelSpecs.width, width));
    if (boltPattern === null) parts.push(NOTHING);
    if (boltPattern) {
      parts.push(arrayContains(wheelSpecs.boltPatterns, [boltPattern]));
    }
  }
  return parts.length === 0 ? null : (and(...parts) ?? null);
}

/**
 * The "similar options" list: close to the size asked for, never the size
 * itself. Needs an anchor (a tire's rim, a wheel's diameter) and something to
 * relax (a width or a profile); without both there is nothing similar to show.
 */
function nearSize(filters: ProductFilters): SQL {
  const thread = vehicleThread(filters);
  if (thread !== null) return contradictsThread(thread);

  const exact = exactSize(filters);
  if (exact === null) return NOTHING;

  if (filters.category === "tires") {
    const { width, aspectRatio, rimDiameter } = sizeParts(filters).tire;
    if (rimDiameter === undefined) return NOTHING;
    if (width === undefined && aspectRatio === undefined) return NOTHING;
    const parts: SQL[] = [eq(tireSpecs.rimDiameter, rimDiameter)];
    if (width !== undefined) {
      parts.push(
        between(
          tireSpecs.width,
          width - NEAR.tireWidth,
          width + NEAR.tireWidth,
        ),
      );
    }
    if (aspectRatio !== undefined) {
      parts.push(
        between(
          tireSpecs.aspectRatio,
          aspectRatio - NEAR.tireAspectRatio,
          aspectRatio + NEAR.tireAspectRatio,
        ),
      );
    }
    return and(...parts, not(exact)) ?? NOTHING;
  }

  if (filters.category === "wheels") {
    const { diameter, width, boltPattern } = sizeParts(filters).wheel;
    if (diameter === undefined || width === undefined) return NOTHING;
    const parts: SQL[] = [
      eq(wheelSpecs.diameter, diameter),
      between(
        wheelSpecs.width,
        width - NEAR.wheelWidth,
        width + NEAR.wheelWidth,
      ),
    ];
    if (boltPattern) {
      parts.push(arrayContains(wheelSpecs.boltPatterns, [boltPattern]));
    }
    return and(...parts, not(exact)) ?? NOTHING;
  }

  return NOTHING;
}

function conditions(
  filters: ProductFilters,
  options: { omit?: FilterGroup; sizeMatch?: "exact" | "near" } = {},
): SQL[] {
  const where: SQL[] = [
    eq(products.category, filters.category),
    eq(products.status, "published"),
  ];

  // Exact, because the brand facet groups exactly: the count beside a brand
  // and the list it opens must be the same products.
  if (options.omit !== "brands" && filters.brands && filters.brands.length > 0) {
    where.push(inArray(products.brand, [...filters.brands]));
  }
  const priceMin = amount(filters.priceMin);
  const priceMax = amount(filters.priceMax);
  if (priceMin !== undefined) where.push(gte(products.price, priceMin));
  if (priceMax !== undefined) where.push(lte(products.price, priceMax));

  if (options.omit !== "chips") {
    // A value outside the enum is dropped, not sent: Postgres would refuse it.
    if (filters.category === "tires" && filters.tire?.seasons?.length) {
      const seasons = filters.tire.seasons.filter((season) =>
        TIRE_SEASONS.includes(season),
      );
      where.push(
        seasons.length > 0 ? inArray(tireSpecs.season, seasons) : NOTHING,
      );
    }
    if (filters.category === "accessories" && filters.accessory?.kinds?.length) {
      const kinds = filters.accessory.kinds.filter((kind) =>
        ACCESSORY_KINDS.includes(kind),
      );
      where.push(
        kinds.length > 0
          ? inArray(accessorySpecs.accessoryType, kinds)
          : NOTHING,
      );
    }
  }

  if (options.sizeMatch === "near") {
    where.push(nearSize(filters));
  } else {
    const exact = exactSize(filters);
    if (exact !== null) where.push(exact);
  }

  return where;
}

function orderBy(sort: CatalogSort): SQL[] {
  // `id` last, so two pages of one query never disagree about the order.
  switch (sort) {
    case "price-asc":
      return [sql`${products.price} asc nulls last`, asc(products.id)];
    case "price-desc":
      return [sql`${products.price} desc nulls last`, asc(products.id)];
    case "best":
      /* Every brand's strongest card before any brand's second: rank each
         brand's products (one with a photo first, then the lowest price), and
         read across the ranks. Sorting by brand alone opened every list with
         six cards from whichever brand is first in the alphabet. */
      return [
        sql`row_number() over (partition by ${products.brand} order by (${HAS_PHOTO}) desc, ${products.price} asc nulls last, ${products.id}) asc`,
        sql`${products.price} asc nulls last`,
        asc(products.id),
      ];
  }
}

function clampLimit(limit: number | undefined, fallback: number): number {
  if (limit === undefined || !Number.isFinite(limit)) return fallback;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
}

function clampOffset(offset: number | undefined): number {
  if (offset === undefined || !Number.isFinite(offset)) return 0;
  return Math.min(Math.max(Math.trunc(offset), 0), MAX_OFFSET);
}

/* --- Listings ------------------------------------------------------------ */

/**
 * One page of a category's published products, and how many match in all.
 * Backs `/results`, `/wheels` and `/accessories`. Call it once with
 * `sizeMatch: "exact"` for the matches and once with `"near"` for the
 * "similar options" row beneath them.
 */
export async function listProducts(
  input: ListProductsInput,
): Promise<ProductList> {
  const db = getDb();
  const where = and(...conditions(input, { sizeMatch: input.sizeMatch }));

  const [rows, [totals]] = await Promise.all([
    withSpecs(db.select(PRODUCT_SELECTION).from(products).$dynamic())
      .where(where)
      .orderBy(...orderBy(input.sort ?? "best"))
      .limit(clampLimit(input.limit, DEFAULT_LIMIT))
      .offset(clampOffset(input.offset)),
    withSpecs(db.select({ total: count() }).from(products).$dynamic()).where(
      where,
    ),
  ]);

  return {
    items: await toCatalogProducts(db, rows),
    total: totals?.total ?? 0,
  };
}

/* --- Facets -------------------------------------------------------------- */

function sortedNumbers(values: ReadonlyArray<number | null>): number[] {
  return values
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
}

/** The lowest and highest price among a category's published products.
 *  `null` when nothing in it is priced. */
export async function getPriceBounds(
  category: ProductCategory,
): Promise<{ min: number | null; max: number | null }> {
  const [row] = await getDb()
    .select({ min: min(products.price), max: max(products.price) })
    .from(products)
    .where(
      and(eq(products.category, category), eq(products.status, "published")),
    );
  return { min: row?.min ?? null, max: row?.max ?? null };
}

/**
 * The filter rail for one category: option lists, and counts that agree with
 * what `listProducts` would return for the same filters.
 */
export async function getFacets(
  filters: ProductFilters,
): Promise<CatalogFacets> {
  const db = getDb();
  const { category } = filters;
  const inCategory = and(
    eq(products.category, category),
    eq(products.status, "published"),
  );

  const totalQuery = withSpecs(
    db.select({ total: count() }).from(products).$dynamic(),
  ).where(and(...conditions(filters)));

  const brandsQuery = withSpecs(
    db
      .select({ value: products.brand, count: count() })
      .from(products)
      .$dynamic(),
  )
    .where(and(...conditions(filters, { omit: "brands" })))
    .groupBy(products.brand)
    .orderBy(asc(products.brand));

  const [[totals], brands, price] = await Promise.all([
    totalQuery,
    brandsQuery,
    getPriceBounds(category),
  ]);

  const facets: CatalogFacets = {
    category,
    total: totals?.total ?? 0,
    brands,
    price,
    tire: null,
    wheel: null,
    accessory: null,
  };

  if (category === "tires") {
    const values = (
      column:
        | typeof tireSpecs.width
        | typeof tireSpecs.aspectRatio
        | typeof tireSpecs.rimDiameter,
    ) =>
      db
        .selectDistinct({ value: column })
        .from(tireSpecs)
        .innerJoin(products, eq(products.id, tireSpecs.productId))
        .where(inCategory);
    const [widths, aspectRatios, rimDiameters, seasons] = await Promise.all([
      values(tireSpecs.width),
      values(tireSpecs.aspectRatio),
      values(tireSpecs.rimDiameter),
      withSpecs(
        db
          .select({ value: tireSpecs.season, count: count() })
          .from(products)
          .$dynamic(),
      )
        .where(
          and(
            ...conditions(filters, { omit: "chips" }),
            isNotNull(tireSpecs.season),
          ),
        )
        .groupBy(tireSpecs.season)
        // Enum order: summer, all-season, all-weather, winter.
        .orderBy(asc(tireSpecs.season)),
    ]);
    facets.tire = {
      widths: sortedNumbers(widths.map((row) => row.value)),
      aspectRatios: sortedNumbers(aspectRatios.map((row) => row.value)),
      rimDiameters: sortedNumbers(rimDiameters.map((row) => row.value)),
      seasons: seasons.filter(
        (row): row is FacetCount<TireSeason> => row.value !== null,
      ),
    };
  }

  if (category === "wheels") {
    const values = (
      column: typeof wheelSpecs.diameter | typeof wheelSpecs.width,
    ) =>
      db
        .selectDistinct({ value: column })
        .from(wheelSpecs)
        .innerJoin(products, eq(products.id, wheelSpecs.productId))
        .where(inCategory);
    const [diameters, widths, boltPatterns] = await Promise.all([
      values(wheelSpecs.diameter),
      values(wheelSpecs.width),
      db
        .selectDistinct({
          value: sql<string>`unnest(${wheelSpecs.boltPatterns})`.as("value"),
        })
        .from(wheelSpecs)
        .innerJoin(products, eq(products.id, wheelSpecs.productId))
        .where(inCategory),
    ]);
    facets.wheel = {
      diameters: sortedNumbers(diameters.map((row) => row.value)),
      widths: sortedNumbers(widths.map((row) => row.value)),
      boltPatterns: boltPatterns
        .map((row) => row.value)
        .sort((a, b) => a.localeCompare(b, "en", { numeric: true })),
    };
  }

  if (category === "accessories") {
    const kinds = await withSpecs(
      db
        .select({ value: accessorySpecs.accessoryType, count: count() })
        .from(products)
        .$dynamic(),
    )
      .where(
        and(
          ...conditions(filters, { omit: "chips" }),
          isNotNull(accessorySpecs.accessoryType),
        ),
      )
      .groupBy(accessorySpecs.accessoryType)
      .orderBy(asc(accessorySpecs.accessoryType));
    facets.accessory = {
      kinds: kinds.filter(
        (row): row is FacetCount<AccessoryKind> => row.value !== null,
      ),
    };
  }

  return facets;
}

/* --- Product page -------------------------------------------------------- */

/**
 * The product page. `published` and `discontinued` both load, so an old link
 * still lands on a page that takes an enquiry. `null` = render a 404: either
 * no such slug, or the product is `hidden`.
 */
export async function getProductBySlug(
  slug: string,
): Promise<CatalogProductDetail | null> {
  if (slug.length > SLUG_MAX_LENGTH || !SLUG.test(slug)) return null;
  const db = getDb();
  const [row] = await withSpecs(
    db.select(PRODUCT_SELECTION).from(products).$dynamic(),
  )
    .where(
      and(
        eq(products.slug, slug),
        inArray(products.status, ["published", "discontinued"]),
      ),
    )
    .limit(1);
  if (!row) return null;

  const images = (await loadImages(db, [row.product.id])).get(row.product.id);
  return {
    ...toCatalogProduct(row, images?.[0] ?? null),
    images: images ?? [],
  };
}

/**
 * The same brand and model in its other sizes, nearest to this product's own
 * size first. Nearest, not smallest: a wheel model can come in hundreds of
 * variants, and the first page of those has to be the ones beside the size
 * being looked at. Empty for a product with no model.
 */
export async function getOtherSizes(
  product: CatalogProduct,
  limit = 24,
): Promise<CatalogProduct[]> {
  if (product.model === null) return [];
  const db = getDb();

  const nearest: SQL[] = [];
  if (product.category === "tires" && product.specs) {
    const { rimDiameter, width, aspectRatio } = product.specs;
    nearest.push(sql`abs(${tireSpecs.rimDiameter} - ${rimDiameter}) asc nulls last`);
    if (width !== null) {
      nearest.push(sql`abs(${tireSpecs.width} - ${width}) asc nulls last`);
    }
    if (aspectRatio !== null) {
      nearest.push(
        sql`abs(${tireSpecs.aspectRatio} - ${aspectRatio}) asc nulls last`,
      );
    }
  }
  if (product.category === "wheels" && product.specs) {
    const { diameter, width } = product.specs;
    nearest.push(
      sql`abs(${wheelSpecs.diameter} - ${diameter}) asc nulls last`,
      sql`abs(${wheelSpecs.width} - ${width}) asc nulls last`,
    );
  }

  const rows = await withSpecs(
    db.select(PRODUCT_SELECTION).from(products).$dynamic(),
  )
    .where(
      and(
        eq(products.category, product.category),
        eq(products.status, "published"),
        eq(products.brand, product.brand),
        eq(products.model, product.model),
        ne(products.id, product.id),
      ),
    )
    .orderBy(...nearest, asc(products.name), asc(products.id))
    .limit(clampLimit(limit, 24));
  return toCatalogProducts(db, rows);
}

/**
 * Alternatives to one product, closest first, never another size of the same
 * model (that is `getOtherSizes`).
 *   tires        same rim and season, the same size first, then one step off
 *   wheels       same diameter and a shared bolt pattern, nearest width first
 *   accessories  same type
 */
export async function getSimilarProducts(
  product: CatalogProduct,
  limit = 6,
): Promise<CatalogProduct[]> {
  if (product.specs === null) return [];
  const db = getDb();

  const where: SQL[] = [
    eq(products.category, product.category),
    eq(products.status, "published"),
    ne(products.id, product.id),
  ];
  // Other sizes of this model belong to `getOtherSizes`. A product with no
  // model has no such row, so its brand-mates stay eligible here; otherwise
  // they would appear in neither list.
  if (product.model !== null) {
    where.push(
      sql`(${products.brand}, coalesce(${products.model}, '')) <> (${product.brand}, ${product.model})`,
    );
  }
  const order: SQL[] = [];

  if (product.category === "tires") {
    const { rimDiameter, season, width, aspectRatio, overallDiameter } =
      product.specs;
    where.push(eq(tireSpecs.rimDiameter, rimDiameter));
    if (season !== null) where.push(eq(tireSpecs.season, season));
    if (width !== null) {
      where.push(
        between(
          tireSpecs.width,
          width - NEAR.tireWidth,
          width + NEAR.tireWidth,
        ),
      );
      order.push(sql`abs(${tireSpecs.width} - ${width}) asc`);
      if (aspectRatio !== null) {
        // Without this a 305/40 would call a 315/70 similar: one step wider,
        // but a different tire altogether.
        where.push(
          between(
            tireSpecs.aspectRatio,
            aspectRatio - 2 * NEAR.tireAspectRatio,
            aspectRatio + 2 * NEAR.tireAspectRatio,
          ),
        );
        order.push(sql`abs(${tireSpecs.aspectRatio} - ${aspectRatio}) asc`);
      }
    } else if (overallDiameter !== null) {
      where.push(
        between(
          tireSpecs.overallDiameter,
          overallDiameter - 1,
          overallDiameter + 1,
        ),
      );
      order.push(
        sql`abs(${tireSpecs.overallDiameter} - ${overallDiameter}) asc`,
      );
    }
  }

  if (product.category === "wheels") {
    const { diameter, width, boltPatterns } = product.specs;
    where.push(eq(wheelSpecs.diameter, diameter));
    if (boltPatterns.length > 0) {
      where.push(arrayOverlaps(wheelSpecs.boltPatterns, boltPatterns));
    }
    order.push(sql`abs(${wheelSpecs.width} - ${width}) asc`);
  }

  if (product.category === "accessories") {
    where.push(eq(accessorySpecs.accessoryType, product.specs.accessoryType));
  }

  /* Closest first; then a photo before none, the lower price, and `id` so
     the order never wavers. */
  const closeness = sql.join(
    [
      ...order,
      sql`(${HAS_PHOTO}) desc`,
      sql`${products.price} asc nulls last`,
      sql`${products.id} asc`,
    ],
    sql`, `,
  );

  const rows = await withSpecs(
    db.select(PRODUCT_SELECTION).from(products).$dynamic(),
  )
    .where(and(...where))
    .orderBy(
      /* One card per model before any model's second: the closest product
         of each brand + model, then the next closest of each. Without this
         the row is four finishes of whichever model sorts first. */
      sql`row_number() over (partition by ${products.brand}, ${products.model} order by ${closeness}) asc`,
      closeness,
    )
    .limit(clampLimit(limit, 6));
  return toCatalogProducts(db, rows);
}

/* --- Hand-picked rows ---------------------------------------------------- */

/**
 * The published products behind a list of slugs, in the list's own order. A
 * slug that does not exist, or whose product is hidden or discontinued, is
 * simply absent from the result: a hand-picked row shrinks, it never breaks.
 */
export async function getProductsBySlugs(
  slugs: readonly string[],
): Promise<CatalogProduct[]> {
  const wanted = [...new Set(slugs)].filter(
    (slug) => slug.length <= SLUG_MAX_LENGTH && SLUG.test(slug),
  );
  if (wanted.length === 0) return [];
  const db = getDb();
  const rows = await withSpecs(
    db.select(PRODUCT_SELECTION).from(products).$dynamic(),
  ).where(
    and(inArray(products.slug, wanted), eq(products.status, "published")),
  );
  const bySlug = new Map(
    (await toCatalogProducts(db, rows)).map((product) => [product.slug, product]),
  );
  return wanted.flatMap((slug) => bySlug.get(slug) ?? []);
}

/* --- Sitemap ------------------------------------------------------------- */

/**
 * Every published product's slug and last change, for one category. One
 * sitemap file tops out at 50,000 URLs and the catalogue is close to that, so
 * the sitemap is built per category, never as one list.
 */
export async function listProductUrls(
  category: ProductCategory,
): Promise<Array<{ slug: string; updatedAt: Date }>> {
  return getDb()
    .select({ slug: products.slug, updatedAt: products.updatedAt })
    .from(products)
    .where(
      and(eq(products.category, category), eq(products.status, "published")),
    )
    .orderBy(asc(products.slug));
}
