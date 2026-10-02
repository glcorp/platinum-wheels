/**
 * Catalogue import, the thinking half: a CSV's rows in, and out comes what
 * would be created and what is refused, with the reason. Nothing is written
 * here; `scripts/catalog-import.ts` reads the file, prints the report and,
 * when told to, hands `products` to `createProductsBatch()`.
 *
 * Pure: no database, no Next, no file system. The same plan drives the dry
 * run and the real load, so the dry run cannot disagree with it.
 *
 * It reports; it does not repair. A row is either valid as the file gives it
 * (after the mapping's exact renames) or it is refused. Cleaning the data and
 * merging duplicates is done before the file gets here.
 */

import type { NewProduct, ProductStatus } from "./catalog-types";
import type { ImportMapping } from "./import-mapping";
import {
  PRODUCT_FIELD,
  parseProductInput,
  readerFromRecord,
  type ProductFieldKey,
} from "./product-input";
import { buildProductSlug, nextFreeSlug } from "./slug";

export interface ImportRow {
  /** The row as a spreadsheet numbers it: the header is row 1. */
  row: number;
  /** One cell per header, in the header's order. */
  cells: readonly string[];
}

export interface PlannedProduct extends NewProduct {
  row: number;
}

export interface RejectedRow {
  row: number;
  /** The row's first source, as the file spells it: how its owner finds it. */
  vendor: string;
  sku: string;
  /** The CSV column to look at (or the field, when no column feeds it). */
  reasons: readonly { column: string; message: string }[];
}

export interface ImportPlan {
  products: PlannedProduct[];
  rejected: RejectedRow[];
  /** Headers nothing reads, so a dropped column is never a surprise. */
  ignoredColumns: string[];
  /** Product fields no column in this file feeds. */
  missingFields: string[];
  /** Accepted products with at least one photo column filled. */
  withPhoto: number;
  /** Accepted products that needed a `-2`, `-3` … on their slug. */
  slugClashes: number;
}

export interface PlanOptions {
  /** Every imported product gets this status; the file does not choose. */
  status: ProductStatus;
  /** Slugs already in the catalogue. */
  takenSlugs?: Iterable<string>;
}

type SourcePart = "vendor" | "sku" | "url" | "price";

interface Layout {
  /** Column index → product field. */
  fields: Map<number, string>;
  /** Source number → the column index of each of its parts. */
  sources: Map<number, Partial<Record<SourcePart, number>>>;
  photos: number[];
  ignored: string[];
  /** Product field → the header that feeds it, for the reject report. */
  headerOf: Map<string, string>;
}

const key = (text: string) => text.trim().toLowerCase();

function readLayout(headers: readonly string[], mapping: ImportMapping): Layout {
  const columns = new Map(
    Object.entries(mapping.columns).map(([header, field]) => [key(header), field]),
  );
  const photos = new Set(mapping.photos.map(key));
  const sourceParts = new Map<string, { part: SourcePart; n: number }>();
  for (let n = 1; n <= mapping.sources.max; n += 1) {
    for (const part of ["vendor", "sku", "url", "price"] as const) {
      sourceParts.set(key(mapping.sources[part].replace("{n}", String(n))), {
        part,
        n,
      });
    }
  }

  const layout: Layout = {
    fields: new Map(),
    sources: new Map(),
    photos: [],
    ignored: [],
    headerOf: new Map(),
  };
  headers.forEach((header, index) => {
    const name = key(header);
    const field = columns.get(name);
    const source = sourceParts.get(name);
    if (field !== undefined && !layout.headerOf.has(field)) {
      layout.fields.set(index, field);
      layout.headerOf.set(field, header.trim());
    } else if (source) {
      const parts = layout.sources.get(source.n) ?? {};
      parts[source.part] = index;
      layout.sources.set(source.n, parts);
    } else if (photos.has(name)) {
      layout.photos.push(index);
    } else if (name !== "") {
      layout.ignored.push(header.trim());
    }
  });
  return layout;
}

/** The file's spelling of a value, turned into ours when the mapping has it. */
function translate(mapping: ImportMapping, field: string, value: string): string {
  const table = mapping.values[field];
  if (!table) return value;
  const wanted = key(value);
  for (const [theirs, ours] of Object.entries(table)) {
    if (key(theirs) === wanted) return ours;
  }
  return value;
}

/** One validator error, pointed at the column its value came from. */
function columnFor(
  layout: Layout,
  mapping: ImportMapping,
  field: ProductFieldKey,
): string {
  const name = PRODUCT_FIELD[field];
  const part: SourcePart | null =
    field === "sourceVendor"
      ? "vendor"
      : field === "sourceSku"
        ? "sku"
        : field === "sourceUrl"
          ? "url"
          : field === "sourcePrice"
            ? "price"
            : null;
  if (part) return mapping.sources[part].replace("{n}", "1");
  return layout.headerOf.get(name) ?? name;
}

export function planImport(
  headers: readonly string[],
  rows: readonly ImportRow[],
  mapping: ImportMapping,
  options: PlanOptions,
): ImportPlan {
  const layout = readLayout(headers, mapping);
  const sourceNumbers = [...layout.sources.keys()].sort((a, b) => a - b);

  // Pass 1: every vendor + SKU in the file, valid row or not, so a product
  // cannot slip in ahead of a twin that is rejected for something else.
  const rowsBySource = new Map<string, number[]>();
  const sourcesOf = (row: ImportRow) =>
    sourceNumbers
      .map((n) => {
        const parts = layout.sources.get(n) ?? {};
        const cell = (index: number | undefined) =>
          index === undefined ? "" : (row.cells[index] ?? "").trim();
        return {
          vendor: cell(parts.vendor),
          sku: cell(parts.sku),
          url: cell(parts.url),
          price: cell(parts.price),
        };
      })
      // A blank numbered group is an unused slot, not a source.
      .filter(
        (source) =>
          source.vendor !== "" ||
          source.sku !== "" ||
          source.url !== "" ||
          source.price !== "",
      );
  for (const row of rows) {
    for (const source of sourcesOf(row)) {
      if (source.vendor === "" || source.sku === "") continue;
      const id = `${source.vendor}\u0000${source.sku}`;
      const seen = rowsBySource.get(id);
      if (seen) {
        if (!seen.includes(row.row)) seen.push(row.row);
      } else {
        rowsBySource.set(id, [row.row]);
      }
    }
  }

  const plan: ImportPlan = {
    products: [],
    rejected: [],
    ignoredColumns: layout.ignored,
    missingFields: Object.values(PRODUCT_FIELD).filter(
      (field) =>
        !layout.headerOf.has(field) &&
        field !== PRODUCT_FIELD.status &&
        field !== PRODUCT_FIELD.sourceVendor &&
        field !== PRODUCT_FIELD.sourceSku &&
        field !== PRODUCT_FIELD.sourceUrl &&
        field !== PRODUCT_FIELD.sourcePrice,
    ),
    withPhoto: 0,
    slugClashes: 0,
  };
  const taken = new Set(options.takenSlugs ?? []);

  // Pass 2: validate, in file order, so slugs come out the same on every run.
  for (const row of rows) {
    const record: Record<string, string | string[]> = {
      [PRODUCT_FIELD.status]: options.status,
    };
    for (const [index, field] of layout.fields) {
      record[field] = translate(mapping, field, row.cells[index] ?? "");
    }
    const sources = sourcesOf(row);
    record[PRODUCT_FIELD.sourceVendor] = sources.map((source) => source.vendor);
    record[PRODUCT_FIELD.sourceSku] = sources.map((source) => source.sku);
    record[PRODUCT_FIELD.sourceUrl] = sources.map((source) => source.url);
    record[PRODUCT_FIELD.sourcePrice] = sources.map((source) => source.price);

    const reasons: { column: string; message: string }[] = [];
    // More cells than the header has columns means a cell has shifted (an
    // unquoted comma, usually), and every value after it is in the wrong field.
    if (row.cells.length > headers.length) {
      reasons.push({
        column: "",
        message: `This row has ${row.cells.length} cells and the header has ${headers.length}. Check for an unquoted comma.`,
      });
    }
    const parsed = parseProductInput(readerFromRecord(record));
    if (!parsed.ok) {
      for (const [field, message] of Object.entries(parsed.errors)) {
        reasons.push({
          column: columnFor(layout, mapping, field as ProductFieldKey),
          message,
        });
      }
    }
    for (const source of sources) {
      const twins = rowsBySource.get(`${source.vendor}\u0000${source.sku}`);
      if (twins && twins.length > 1) {
        reasons.push({
          column: mapping.sources.sku.replace("{n}", "1"),
          message: `${source.vendor} SKU ${source.sku} is on rows ${twins.join(", ")}. A vendor SKU belongs to one product.`,
        });
      }
    }

    if (!parsed.ok || reasons.length > 0) {
      plan.rejected.push({
        row: row.row,
        vendor: sources[0]?.vendor ?? "",
        sku: sources[0]?.sku ?? "",
        reasons,
      });
      continue;
    }

    const base = buildProductSlug(parsed.input);
    const slug = nextFreeSlug(base, taken);
    taken.add(slug);
    if (slug !== base) plan.slugClashes += 1;
    if (layout.photos.some((index) => (row.cells[index] ?? "").trim() !== "")) {
      plan.withPhoto += 1;
    }
    plan.products.push({ row: row.row, input: parsed.input, slug });
  }

  return plan;
}
