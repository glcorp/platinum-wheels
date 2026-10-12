/**
 * Storefront search reads (D173). Server only: imports the database client.
 *
 * One statement per group (tires, wheels, accessories), run together, each
 * ranked on id and sort keys first and joined to its specs only for the cards
 * it shows, the shape `catalog/queries.ts` `listProducts` uses (D157). Then
 * one read for photos and one for look-alikes, also together.
 *
 * Kept out of `catalog/queries.ts` on purpose: that file belongs to the
 * listings, and the search's rules (text match, cross-category groups) are
 * its own.
 *
 * Never selects `product_sources`: vendor names, SKUs and vendor prices are
 * staff data (owner, 2026-10-11: "No, part numbers only (Recommended)").
 */

import { and, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";

import { getDb, type Database } from "@/db/client";
import {
  accessorySpecs,
  productImages,
  products,
  productSearchText,
  tireSpecs,
  wheelSpecs,
} from "@/db/schema";
import { accessoryParam, seasonParam, toProduct } from "@/features/catalog/adapter";
import type { CatalogProduct } from "@/features/catalog/catalog-types";
import {
  CATEGORY_CONFIG,
  EXTRA_PARAM,
  THREADED_ACCESSORY_TYPES,
} from "@/features/catalog/categories";
import {
  loadImages,
  PRODUCT_SELECTION,
  toCatalogProduct,
  withSpecs,
  type Executor,
} from "@/features/catalog/rows";
import { listedStatus } from "@/features/catalog/listing-status";
import { listingFacts } from "@/features/catalog/siblings";
import type { Product, ProductCategory } from "@/features/catalog/types";
import type { VehicleParams } from "@/lib/routes";
import { PRICES_VISIBLE } from "@/lib/site";

import { FLOTATION_RATIO, measuringRatio, metricMeasuringRim, RIM_SLACK, wheelWidthRange } from "./fit";
import type { ParsedSearch } from "./parse";

export const SEARCH_CATEGORIES: readonly ProductCategory[] = ["tires", "wheels", "accessories"];

/** Cards per group: one row of four on a laptop (D178). Every group then
 *  offers `See all`, the category page with the search's filters set; the
 *  page has the filters, sort and `Load more` a long list needs. Owner,
 *  2026-10-11: "on search page display some results and then an option to go
 *  to tires page to see all results, same for wheels and tires". */
export const GROUP_LIMIT = 4;

export interface SearchGroup {
  category: ProductCategory;
  products: Product[];
  total: number;
  /** The category page with every filter the query maps onto (D178). Always
   *  there; it carries the whole search when `exact`, else only the parts the
   *  category page can filter on (free words and part numbers it cannot). */
  seeAll: { href: string; label: string; exact: boolean };
}

export interface SearchOutcome {
  /** Groups that matched something, in category order. */
  groups: SearchGroup[];
  /** The categories the query reads (`scopeOf`), whether or not each had a
   *  match. The "read as" line says only what was searched (QA SEARCH-4). */
  scope: ProductCategory[];
}

/* --- Which groups, and on what ------------------------------------------ */

/**
 * The categories a query reads. Named categories win (`winter rims` reads
 * wheels); otherwise the words imply one (a season → tires, an accessory
 * type or a lug thread → accessories); otherwise all three.
 */
export function scopeOf(parsed: ParsedSearch): ProductCategory[] {
  if (parsed.categories.length > 0) return SEARCH_CATEGORIES.filter((c) => parsed.categories.includes(c));
  const implied = new Set<ProductCategory>();
  if (parsed.seasons.length > 0) implied.add("tires");
  if (parsed.accessoryKinds.length > 0 || parsed.thread !== null) implied.add("accessories");
  return implied.size > 0 ? SEARCH_CATEGORIES.filter((c) => implied.has(c)) : [...SEARCH_CATEGORIES];
}

const escapeLike = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);
const SEARCH_TEXT = productSearchText(products);

/** Every word must appear in brand, model, name or part number. A word with
 *  punctuation also matches with it stripped, so `dai-123-45` finds the part
 *  number however its dashes fall. */
function wordConditions(words: readonly string[]): SQL[] {
  return words.map((word) => {
    const stripped = word.replace(/[^\p{L}\p{N}]+/gu, "");
    const like = (value: string) => sql`${SEARCH_TEXT} like ${`%${escapeLike(value)}%`}`;
    return stripped !== word && stripped.length > 0 ? (or(like(word), like(stripped)) as SQL) : like(word);
  });
}

/** The measuring rim of a tire, in inches, in SQL (`fit.ts`). */
const TIRE_MEASURING_RIM = sql`(case
  when ${tireSpecs.sectionWidth} is not null then ${tireSpecs.sectionWidth} * ${sql.raw(String(FLOTATION_RATIO))}
  else ${tireSpecs.width} * (case when ${tireSpecs.aspectRatio} >= 70 then ${sql.raw(String(measuringRatio(70)))} when ${tireSpecs.aspectRatio} >= 60 then ${sql.raw(String(measuringRatio(60)))} when ${tireSpecs.aspectRatio} >= 50 then ${sql.raw(String(measuringRatio(50)))} when ${tireSpecs.aspectRatio} >= 40 then ${sql.raw(String(measuringRatio(40)))} else ${sql.raw(String(measuringRatio(0)))} end) / 25.4
end)`;

/** The measuring rim of the tire typed, or `null` with no tire size. */
function queryMeasuringRim(parsed: ParsedSearch): number | null {
  const tire = parsed.tire;
  if (tire === null) return null;
  return tire.format === "flotation"
    ? tire.sectionWidth * FLOTATION_RATIO
    : metricMeasuringRim(tire.width, tire.aspectRatio);
}

/**
 * The conditions one group filters on, or `null` when nothing in the query
 * applies to that category (`5x114.3` says nothing about tires). A
 * criterion that does not apply to a category is ignored there. A named
 * category with nothing else (`tires`) lists the whole category.
 */
export function groupConditions(category: ProductCategory, parsed: ParsedSearch): SQL[] | null {
  const where: SQL[] = [];
  const named = parsed.categories.includes(category);
  const { tire, wheel } = parsed;

  if (category === "tires") {
    if (tire?.format === "metric") {
      where.push(eq(tireSpecs.width, tire.width), eq(tireSpecs.aspectRatio, tire.aspectRatio));
      if (tire.rim !== null) where.push(eq(tireSpecs.rimDiameter, tire.rim));
    } else if (tire?.format === "flotation") {
      where.push(
        eq(tireSpecs.overallDiameter, tire.overallDiameter),
        eq(tireSpecs.sectionWidth, tire.sectionWidth),
        eq(tireSpecs.rimDiameter, tire.rim),
      );
    } else if (wheel !== null) {
      /* A wheel size reads the tires that suit it: same rim, a measuring
         rim inside the slack (`fit.ts`, the reverse of the wheel rule). */
      where.push(
        eq(tireSpecs.rimDiameter, wheel.diameter),
        sql`${TIRE_MEASURING_RIM} between ${wheel.width - RIM_SLACK.wider}::numeric and ${wheel.width + RIM_SLACK.narrower}::numeric`,
      );
    }
    if (parsed.rim !== null && tire === null && wheel === null) {
      where.push(eq(tireSpecs.rimDiameter, parsed.rim));
    }
    if (parsed.seasons.length > 0) where.push(inArray(tireSpecs.season, parsed.seasons));
  }

  if (category === "wheels") {
    if (wheel !== null) {
      where.push(eq(wheelSpecs.diameter, wheel.diameter), eq(wheelSpecs.width, wheel.width));
    } else if (tire !== null && tire.rim !== null) {
      /* D173(1): the wheels that suit the tire, not every wheel of its rim. */
      const range = wheelWidthRange(queryMeasuringRim(parsed) ?? 0);
      where.push(
        eq(wheelSpecs.diameter, tire.rim),
        sql`${wheelSpecs.width} between ${range.min}::numeric and ${range.max}::numeric`,
      );
    }
    if (parsed.bolt !== null) where.push(sql`${wheelSpecs.boltPatterns} @> array[${parsed.bolt}]::text[]`);
    if (parsed.rim !== null && wheel === null && (tire === null || tire.rim === null)) {
      where.push(eq(wheelSpecs.diameter, parsed.rim));
    }
  }

  if (category === "accessories") {
    if (parsed.accessoryKinds.length > 0) {
      where.push(inArray(accessorySpecs.accessoryType, parsed.accessoryKinds));
    }
    if (parsed.thread !== null) where.push(eq(accessorySpecs.threadSize, parsed.thread));
  }

  const words = wordConditions(parsed.words);
  /* Text alone, or a category-specific criterion, or the category named. A
     tire size with no words gives accessories nothing to read. */
  if (where.length === 0 && words.length === 0 && !named) return null;
  return [...where, ...words];
}

/* --- Ordering ------------------------------------------------------------ */

const HAS_PHOTO = sql`exists (select 1 from ${productImages} where ${productImages.productId} = ${products.id})`;

interface OrderKey {
  expr: SQL;
  dir: "asc" | "desc";
}

function orderKeys(category: ProductCategory, parsed: ParsedSearch): OrderKey[] {
  const keys: OrderKey[] = [];
  /* A part number typed whole comes first. */
  const typed = parsed.words.join("").replace(/[^\p{L}\p{N}]+/gu, "");
  if (category !== "tires" && typed.length >= 3) {
    keys.push({
      expr: sql`(regexp_replace(lower(coalesce(${products.partNumber}, '')), '[^a-z0-9]+', '', 'g') = ${typed})`,
      dir: "desc",
    });
  }
  if (category === "tires" && parsed.tire?.format === "metric" && parsed.tire.serviceType === "LT") {
    keys.push({ expr: sql`(coalesce(${tireSpecs.serviceType}, '') = 'LT')`, dir: "desc" });
  }
  /* Wheels for a tire size: the width nearest the tire's own rim first. */
  const measuring = queryMeasuringRim(parsed);
  if (category === "wheels" && parsed.wheel === null && measuring !== null) {
    keys.push({ expr: sql`abs(${wheelSpecs.width} - ${measuring}::numeric)`, dir: "asc" });
  }
  /* Then every brand's strongest card before any brand's second, as the
     listings do (`catalog/queries.ts` `orderKeys`, D109(3)). `id` last, so
     two reads of one query agree. */
  keys.push(
    {
      expr: sql`row_number() over (partition by ${products.brand} order by (${HAS_PHOTO}) desc, ${products.id})`,
      dir: "asc",
    },
    { expr: sql`${products.id}`, dir: "asc" },
  );
  return keys;
}

/** `k0 desc`, `ranked.k1 asc` ...: one sort key, named by its position. */
function orderClause(key: OrderKey, index: number, table?: string): SQL {
  const column =
    table === undefined
      ? sql.identifier(`k${index}`)
      : sql`${sql.identifier(table)}.${sql.identifier(`k${index}`)}`;
  return sql`${column} ${sql.raw(key.dir)}`;
}

/* --- Reads --------------------------------------------------------------- */

async function readGroup(
  db: Database,
  category: ProductCategory,
  where: SQL[],
  parsed: ParsedSearch,
  limit: number,
) {
  const condition = and(
    eq(products.category, category),
    listedStatus(),
    ...where,
  );
  const keys = orderKeys(category, parsed);
  /* Rank on id and the sort keys, cut, then join the specs for the cut only
     (the D157 shape). The count comes from the same statement. */
  const keyColumns = Object.fromEntries(keys.map((key, index) => [`k${index}`, key.expr.as(`k${index}`)]));
  const ranked = db.$with("ranked").as(
    withSpecs(
      db
        .select({
          id: products.id,
          ...keyColumns,
          total: sql<number>`count(*) over ()`.as("total"),
        })
        .from(products)
        .$dynamic(),
    )
      .where(condition)
      .orderBy(...keys.map((key, index) => orderClause(key, index)))
      .limit(limit),
  );
  const rows = await withSpecs(
    db
      .with(ranked)
      .select({ ...PRODUCT_SELECTION, total: ranked.total })
      .from(ranked)
      .innerJoin(products, eq(products.id, ranked.id))
      .$dynamic(),
  ).orderBy(...keys.map((key, index) => orderClause(key, index, "ranked")));
  return {
    items: rows.map((row) => toCatalogProduct(row, null)),
    total: Number(rows[0]?.total ?? 0),
  };
}

/** Products that may share a card title with the ones shown: same
 *  category, brand and model (or name, with no model). A superset;
 *  `listingFacts` keeps only true title siblings. */
async function readSiblings(db: Executor, shown: readonly CatalogProduct[]): Promise<CatalogProduct[]> {
  const keys = new Map<string, SQL>();
  for (const product of shown) {
    const key = `${product.category}\n${product.brand}\n${product.model ?? `name:${product.name}`}`;
    if (keys.has(key)) continue;
    keys.set(
      key,
      and(
        eq(products.category, product.category),
        product.brand === null ? isNull(products.brand) : eq(products.brand, product.brand),
        product.model === null
          ? sql`${products.model} is null and ${products.name} = ${product.name}`
          : eq(products.model, product.model),
      ) as SQL,
    );
  }
  if (keys.size === 0) return [];
  const rows = await withSpecs(db.select(PRODUCT_SELECTION).from(products).$dynamic())
    .where(and(listedStatus(), or(...keys.values())))
    .limit(2000);
  return rows.map((row) => toCatalogProduct(row, null));
}

/** The brand the leftover words spell exactly (`michelin`, `general tire`),
 *  per category, or nothing. Lets `See all` set the brand filter. */
async function readExactBrands(db: Executor, parsed: ParsedSearch): Promise<Map<ProductCategory, string>> {
  const found = new Map<ProductCategory, string>();
  if (parsed.words.length === 0) return found;
  const spelled = [parsed.words.join(" ")];
  /* `general tire`: the category word was read off, so try it back on. */
  if (parsed.categories.includes("tires")) spelled.push(`${parsed.words.join(" ")} tire`, `${parsed.words.join(" ")} tires`);
  const rows = await db
    .selectDistinct({ category: products.category, brand: products.brand })
    .from(products)
    .where(and(listedStatus(), inArray(sql`lower(${products.brand})`, spelled)));
  for (const row of rows) if (row.brand) found.set(row.category, row.brand);
  return found;
}

/* --- See all ------------------------------------------------------------- */

function seeAllFor(
  category: ProductCategory,
  parsed: ParsedSearch,
  brand: string | undefined,
  vehicle: VehicleParams | null,
): SearchGroup["seeAll"] {
  /* The category pages cannot filter on free text, so a search with words
     that are not exactly a brand links to the page with its other filters
     only (D178; before, it offered no link at all). */
  let exact = parsed.words.length === 0 || brand !== undefined;
  const params = new URLSearchParams();
  const config = CATEGORY_CONFIG[category];
  let label = `See all ${config.crumb.toLowerCase()}`;
  const { tire, wheel } = parsed;

  if (category === "tires") {
    if (tire?.format === "metric") {
      params.set("width", String(tire.width));
      params.set("profile", String(tire.aspectRatio));
      if (tire.rim !== null) params.set("rim", String(tire.rim));
    } else if (tire?.format === "flotation") {
      /* D137: a flotation tire's Width select holds the overall diameter and
         its Profile select the section width. */
      params.set("width", String(tire.overallDiameter));
      params.set("profile", String(tire.sectionWidth));
      params.set("rim", String(tire.rim));
    } else if (wheel !== null) {
      /* A wheel size searched: its tires are those for its rim. */
      params.set("rim", String(wheel.diameter));
      exact = false;
    } else if (parsed.rim !== null) {
      params.set("rim", String(parsed.rim));
    }
    for (const season of parsed.seasons) params.append("season", seasonParam(season));
  }

  if (category === "wheels") {
    if (wheel !== null) {
      params.set("diameter", String(wheel.diameter));
      params.set("width", String(wheel.width));
    } else if (tire !== null && tire.rim !== null) {
      params.set("diameter", String(tire.rim));
      label = `See all ${tire.rim}-inch wheels`;
    } else if (parsed.rim !== null) {
      params.set("diameter", String(parsed.rim));
    }
    if (parsed.bolt !== null) params.set("bolt", parsed.bolt);
  }

  if (category === "accessories") {
    for (const kind of parsed.accessoryKinds) params.append("type", accessoryParam(kind));
    if (parsed.thread !== null) {
      /* D137: the Thread size filter applies only while a threaded type is
         ticked, so a thread search with no type named would land on the whole
         category. Name the three threaded types (QA SEARCH-1); it then lands
         on the group's set less the products with no thread. */
      if (parsed.accessoryKinds.length === 0) {
        for (const type of THREADED_ACCESSORY_TYPES) params.append("type", type);
      }
      params.set(EXTRA_PARAM.thread, parsed.thread);
    }
  }

  if (brand !== undefined) params.set("brand", brand);
  /* D185: the searched car rides along (already checked by the page), so the
     category page splits Best and Similar for it. It narrows nothing. */
  if (vehicle !== null) {
    params.set("year", vehicle.year);
    params.set("make", vehicle.make);
    params.set("model", vehicle.model);
  }
  const query = params.toString();
  return { href: query === "" ? config.route : `${config.route}?${query}`, label, exact };
}

/* --- Entry point --------------------------------------------------------- */

const storefrontPrice = (product: CatalogProduct): CatalogProduct =>
  PRICES_VISIBLE ? product : { ...product, price: null };

export async function searchCatalog(
  parsed: ParsedSearch,
  vehicle: VehicleParams | null = null,
): Promise<SearchOutcome> {
  const db = getDb();
  const scope = scopeOf(parsed);
  const plans = scope
    .map((category) => ({ category, where: groupConditions(category, parsed) }))
    .filter((plan): plan is { category: ProductCategory; where: SQL[] } => plan.where !== null);
  if (plans.length === 0) return { groups: [], scope };

  const [results, brands] = await Promise.all([
    Promise.all(
      plans.map((plan) =>
        readGroup(db, plan.category, plan.where, parsed, GROUP_LIMIT),
      ),
    ),
    readExactBrands(db, parsed),
  ]);

  const shown = results.flatMap((result) => result.items);
  const [images, siblings] = await Promise.all([
    loadImages(
      db,
      shown.map((product) => product.id),
    ),
    readSiblings(db, shown),
  ]);
  const facts = listingFacts(shown, siblings);

  const groups: SearchGroup[] = [];
  plans.forEach((plan, index) => {
    const result = results[index];
    if (result === undefined || result.total === 0) return;
    groups.push({
      category: plan.category,
      total: result.total,
      products: result.items.map((product) => {
        const mine = facts.get(product.id);
        return toProduct(
          storefrontPrice({
            ...product,
            image: images.get(product.id)?.[0] ?? null,
            ...(mine === undefined ? {} : { tellingFacts: mine }),
          }),
        );
      }),
      seeAll: seeAllFor(plan.category, parsed, brands.get(plan.category), vehicle),
    });
  });
  return { groups, scope };
}
