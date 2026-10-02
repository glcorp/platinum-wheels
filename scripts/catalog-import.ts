/* ---------------------------------------------------------------------------
   catalog-import — load a catalogue CSV into the catalogue tables.

     npm run catalog:import -- <file.csv>            dry run: report only
     npm run catalog:import -- <file.csv> --write    load it

   What it does, in order:
     1. reads the CSV and runs every row through the product validator
        (`src/features/catalog/import-plan.ts`), using the column mapping in
        `src/features/catalog/import-mapping.ts`;
     2. writes a report folder: `summary.txt`, `rejected.csv` (every refused
        row with its reason and its original cells) and `products.csv` (what
        would be created, with its slug);
     3. with `--write`, and only into an EMPTY catalogue, inserts the accepted
        products in batches over several connections.

   It reports bad rows; it never repairs them. It only creates: there is no
   update and no delete here. Loading a revised file means emptying the
   catalogue first, which this script does not do.

   The database is `IMPORT_DATABASE_URL`, deliberately not `DATABASE_URL`, so
   a load can only reach a database somebody named on purpose. Use the DIRECT
   Neon address (no `-pooler`): a batch is one transaction.

   TypeScript, unlike the other scripts here, because it must run the app's
   own validator and store. `tsx` runs it; `npm run check` type-checks it.

   Options:
     --write            write to the database (default: dry run)
     --yes              skip the typed confirmation (for unattended runs)
     --status <s>       status every product gets: published (default) | hidden
     --batch <n>        products per INSERT (default 500)
     --workers <n>      parallel connections (default 8)
     --out <dir>        report folder (default import-report/<timestamp>)
   --------------------------------------------------------------------------- */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";

import { parse } from "csv-parse/sync";
import { count, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/db/schema";
import { products } from "@/db/schema";
import { IMPORT_MAPPING } from "@/features/catalog/import-mapping";
import {
  planImport,
  type ImportPlan,
  type ImportRow,
  type PlannedProduct,
} from "@/features/catalog/import-plan";
import { createProductsBatch } from "@/features/catalog/store";

/** A tire spec row binds 19 values, and one statement holds 65,535. */
const MAX_BATCH = 2000;
const BATCH_ATTEMPTS = 3;

const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    write: { type: "boolean", default: false },
    yes: { type: "boolean", default: false },
    status: { type: "string", default: "published" },
    batch: { type: "string", default: "500" },
    workers: { type: "string", default: "8" },
    out: { type: "string" },
  },
});

function fail(message: string): never {
  console.error(`catalog-import: ${message}`);
  process.exit(1);
}

function wholeNumber(name: string, text: string, max: number): number {
  const value = Number(text);
  if (!Number.isInteger(value) || value < 1 || value > max) {
    fail(`--${name} must be a whole number from 1 to ${max}.`);
  }
  return value;
}

const file = positionals[0];
if (!file || positionals.length > 1) {
  fail("give one CSV file. Example: npm run catalog:import -- catalogue.csv");
}
const status =
  flags.status === "published" || flags.status === "hidden"
    ? flags.status
    : fail("--status must be published or hidden.");
const batchSize = wholeNumber("batch", flags.batch, MAX_BATCH);
const workers = wholeNumber("workers", flags.workers, 32);

/* --- Read and plan --------------------------------------------------------- */

const csvCell = (value: string | number) => {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const csvLine = (cells: readonly (string | number)[]) =>
  `${cells.map(csvCell).join(",")}\n`;

function readCsv(path: string): { headers: string[]; rows: ImportRow[] } {
  let records: string[][];
  try {
    records = parse(readFileSync(path, "utf8"), {
      bom: true,
      relax_column_count: true,
    });
  } catch (error) {
    fail(`could not read ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const [headers, ...body] = records;
  if (!headers) fail(`${path} is empty.`);
  const rows: ImportRow[] = [];
  body.forEach((cells, index) => {
    // A blank line is not a product and not an error.
    if (cells.every((cell) => cell.trim() === "")) return;
    rows.push({ row: index + 2, cells });
  });
  return { headers, rows };
}

function summarise(plan: ImportPlan, total: number): string {
  const byCategory = new Map<string, number>();
  for (const { input } of plan.products) {
    byCategory.set(input.category, (byCategory.get(input.category) ?? 0) + 1);
  }
  const byReason = new Map<string, number>();
  for (const row of plan.rejected) {
    for (const reason of row.reasons) {
      // Row numbers and SKUs make every duplicate message unique: group them.
      const text = reason.message.includes("A vendor SKU belongs to one product")
        ? "The same vendor SKU is on more than one row."
        : reason.message;
      const label = reason.column ? `${reason.column}: ${text}` : text;
      byReason.set(label, (byReason.get(label) ?? 0) + 1);
    }
  }
  const noSource = plan.products.filter((p) => p.input.sources.length === 0).length;
  const lines = [
    `File:              ${file}`,
    `Rows read:         ${total}`,
    `Would create:      ${plan.products.length}  (status: ${status})`,
    ...[...byCategory].map(([category, n]) => `  ${category.padEnd(16)} ${n}`),
    `Rejected:          ${plan.rejected.length}`,
    ...[...byReason]
      .sort((a, b) => b[1] - a[1])
      .map(([reason, n]) => `  ${String(n).padStart(6)}  ${reason}`),
    `With a photo column filled: ${plan.withPhoto} of ${plan.products.length} (photos are not loaded)`,
    `Slugs that needed a -2, -3 …: ${plan.slugClashes}`,
    `Products with no vendor source: ${noSource}`,
    `Columns ignored:   ${plan.ignoredColumns.join(", ") || "none"}`,
    `Fields with no column in this file: ${plan.missingFields.join(", ") || "none"}`,
  ];
  return `${lines.join("\n")}\n`;
}

function writeReport(
  dir: string,
  headers: readonly string[],
  rows: readonly ImportRow[],
  plan: ImportPlan,
  summary: string,
): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "summary.txt"), summary);

  const cellsByRow = new Map(rows.map((row) => [row.row, row.cells]));
  let rejected = csvLine(["row", "vendor", "sku", "column", "reason", ...headers]);
  for (const row of plan.rejected) {
    rejected += csvLine([
      row.row,
      row.vendor,
      row.sku,
      row.reasons.map((reason) => reason.column).filter(Boolean).join(" | "),
      row.reasons.map((reason) => reason.message).join(" | "),
      ...(cellsByRow.get(row.row) ?? []),
    ]);
  }
  writeFileSync(join(dir, "rejected.csv"), rejected);

  let created = csvLine(["row", "category", "brand", "name", "slug", "vendor", "sku"]);
  for (const { row, input, slug } of plan.products) {
    const source = input.sources[0];
    created += csvLine([
      row,
      input.category,
      input.brand,
      input.name,
      slug,
      source?.vendor ?? "",
      source?.vendorSku ?? "",
    ]);
  }
  writeFileSync(join(dir, "products.csv"), created);
}

/* --- Write ------------------------------------------------------------------ */

type Db = ReturnType<typeof drizzle<typeof schema>>;

/**
 * One batch, as one transaction. A dropped connection can lose the answer to
 * a COMMIT that did land, so before a retry it looks for the batch's first
 * slug: present means the batch is in, and writing it again would only clash.
 */
async function writeBatch(db: Db, batch: readonly PlannedProduct[]): Promise<void> {
  const first = batch[0];
  if (!first) return;
  for (let attempt = 1; ; attempt += 1) {
    try {
      await db.transaction((tx) => createProductsBatch(tx, batch));
      return;
    } catch (error) {
      if (attempt >= BATCH_ATTEMPTS) throw error;
      try {
        const [landed] = await db
          .select({ id: products.id })
          .from(products)
          .where(eq(products.slug, first.slug))
          .limit(1);
        if (landed) return;
      } catch {
        // Still unreachable: the next attempt will say so.
      }
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
}

async function load(db: Db, plan: ImportPlan): Promise<{ written: number; error: unknown }> {
  const batches: PlannedProduct[][] = [];
  for (let start = 0; start < plan.products.length; start += batchSize) {
    batches.push(plan.products.slice(start, start + batchSize));
  }
  let next = 0;
  let written = 0;
  let error: unknown = null;
  await Promise.all(
    Array.from({ length: Math.min(workers, batches.length) }, async () => {
      while (error === null) {
        const batch = batches[next];
        next += 1;
        if (!batch) return;
        try {
          await writeBatch(db, batch);
          written += batch.length;
          console.log(`  loaded ${written} of ${plan.products.length}`);
        } catch (caught) {
          error ??= caught;
        }
      }
    }),
  );
  return { written, error };
}

async function main(): Promise<void> {
  const started = Date.now();
  const { headers, rows } = readCsv(file);
  const plan = planImport(headers, rows, IMPORT_MAPPING, { status });

  const dir = flags.out ?? join("import-report", new Date().toISOString().replace(/[:.]/g, "-"));
  const summary = summarise(plan, rows.length);
  writeReport(dir, headers, rows, plan, summary);
  console.log(summary);
  console.log(`Report folder: ${dir}`);

  const url = process.env.IMPORT_DATABASE_URL;
  if (!url) {
    if (flags.write) fail("IMPORT_DATABASE_URL is not set. Nothing was written.");
    console.log("\nDry run. No database was named (IMPORT_DATABASE_URL), so none was checked.");
    return;
  }

  const target = new URL(url);
  const where = `${target.hostname}${target.pathname}`;
  const pool = new Pool({ connectionString: url, max: workers });
  // An idle connection that drops must not take the process down mid-load.
  pool.on("error", () => {});
  const db = drizzle({ client: pool, schema });
  try {
    const [existing] = await db.select({ n: count() }).from(products);
    const already = existing?.n ?? 0;
    console.log(`\nDatabase: ${where}\nProducts in it now: ${already}`);

    if (already > 0) {
      const message =
        "The catalogue is not empty. This import only loads into an empty catalogue.";
      if (flags.write) fail(`${message} Nothing was written.`);
      console.log(message);
    }
    if (!flags.write) {
      console.log("Dry run. Nothing was written. Add --write to load.");
      return;
    }
    if (plan.products.length === 0) fail("no valid rows to load. Nothing was written.");

    if (!flags.yes) {
      const prompt = createInterface({ input: process.stdin, output: process.stdout });
      const answer = await prompt.question(
        `Load ${plan.products.length} products into ${where}? Type yes: `,
      );
      prompt.close();
      if (answer.trim().toLowerCase() !== "yes") fail("not confirmed. Nothing was written.");
    }

    console.log(`Loading: ${batchSize} per batch, ${workers} connections.`);
    const { written, error } = await load(db, plan);
    if (error !== null) {
      console.error(error);
      fail(
        `stopped after ${written} of ${plan.products.length} products. The catalogue now holds a PARTIAL load: empty it before running again.`,
      );
    }

    // Fresh tables have no statistics; without them the first searches plan badly.
    await db.execute(
      sql`analyze products, tire_specs, wheel_specs, accessory_specs, product_sources`,
    );
    const totals = await db
      .select({ category: products.category, n: count() })
      .from(products)
      .groupBy(products.category);
    const inDatabase = totals.reduce((sum, row) => sum + row.n, 0);
    const line = `Loaded ${written} products in ${Math.round((Date.now() - started) / 1000)} s. In the database now: ${totals
      .map((row) => `${row.category} ${row.n}`)
      .join(", ")} (${inDatabase} in all).`;
    console.log(line);
    writeFileSync(join(dir, "summary.txt"), `${summary}\nDatabase: ${where}\n${line}\n`);
    if (inDatabase !== written) {
      fail("the database's count does not match what was loaded. Check it before going on.");
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
