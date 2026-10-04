/* ---------------------------------------------------------------------------
   catalog-photos — put the catalogue's product photos in the R2 photo bucket
   and link them to the products (D139).

     npm run catalog:photos -- <folder> --env <file>            dry run
     npm run catalog:photos -- <folder> --env <file> --upload   store the files
     npm run catalog:photos -- <folder> --env <file> --link     write the rows

   <folder> is the co-founder's photo hand-off: `product-images.csv` (one row
   per product photo: slug, category, sort_order, file, alt, vendor,
   vendor_sku, …) and `images/{tires,wheels,accessories}/<16 hex>.webp`, every
   file already a final 1000×1000 WebP.

   What it does, in order:
     1. reads the sheet and checks every row: the file exists, the photo
        order of each product is 0..n-1 with at most 8, the alt text is there.
        Any problem stops the run, before anything is touched.
     2. `--upload`: stores each FILE once, however many products use it, at
        `catalog/<category>/<hash>-1000.webp` (the vendor's file, byte for
        byte) and `-480.webp` (the card size, made here). A file already in
        the bucket at the same size is skipped, so a stopped run just runs
        again. Then fetches a few public URLs to prove they serve.
     3. `--link`: checks every row against production: the slug exists AND
        that product has a source with the same vendor + vendor SKU. Any
        mismatch stops the run, with nothing written. Products that already
        have a photo (staff added one) are skipped and listed. The rest get
        their `product_images` rows, in batches, each in a transaction.

   It only creates. No product, source or existing photo is updated or
   deleted (products keep their `updated_at`), and nothing in the bucket is
   deleted; a file is only rewritten when the bucket holds a different size
   at its key, which content-hash names make the same picture. Run again, it
   adds nothing twice: stored files are skipped, and a product that has
   photos is skipped.

   Settings come from the `--env` file and nowhere else: the shell's own
   variables are never read, so a database exported for another script cannot
   be written by mistake, and no secret sits in shell history or on screen.
   The file holds the five R2 settings (`src/features/catalog/photo-store.ts`)
   and, for `--link`, `IMPORT_DATABASE_URL` (the DIRECT Neon address). Without
   `--env` the run only checks the sheet.

   Options:
     --env <file>       settings file (required for --upload and --link)
     --upload           store the files in R2
     --link             write the product_images rows
     --yes              skip the typed confirmations
     --workers <n>      parallel uploads (default 8)
     --batch <n>        rows per INSERT (default 1000)
     --out <dir>        report folder (default photo-report/<timestamp>)
   --------------------------------------------------------------------------- */

import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs, parseEnv } from "node:util";

import { parse } from "csv-parse/sync";
import { inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/db/schema";
import { productImages, products, productSources } from "@/db/schema";
import { catalogPhotoKey } from "@/features/catalog/photo-files";
import { makePhotoSize } from "@/features/catalog/photo-sizes";
import {
  headObject,
  photoStore,
  publicPhotoUrl,
  putObject,
  type PhotoStore,
} from "@/features/catalog/photo-store";
import { MAX_PHOTOS_PER_PRODUCT } from "@/features/catalog/photos";

/** On top of aws4fetch's own retries of 5xx and 429: this covers a dropped
 *  connection, which aws4fetch does not retry. */
const ATTEMPTS = 2;
const MAX_ALT = 300;
const CATEGORIES = new Set(["tires", "wheels", "accessories"]);
const FILE_PATTERN = /^images\/(tires|wheels|accessories)\/([0-9a-f]{16})\.webp$/;
const REQUIRED = ["slug", "category", "sort_order", "file", "alt", "vendor", "vendor_sku"] as const;

const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    env: { type: "string" },
    upload: { type: "boolean", default: false },
    link: { type: "boolean", default: false },
    yes: { type: "boolean", default: false },
    workers: { type: "string", default: "8" },
    batch: { type: "string", default: "1000" },
    out: { type: "string" },
  },
});

function fail(message: string): never {
  console.error(`catalog-photos: ${message}`);
  process.exit(1);
}

function wholeNumber(name: string, text: string, max: number): number {
  const value = Number(text);
  if (!Number.isInteger(value) || value < 1 || value > max) {
    fail(`--${name} must be a whole number from 1 to ${max}.`);
  }
  return value;
}

const folderArg = positionals[0];
if (!folderArg || positionals.length > 1) {
  fail("give the photo folder. Example: npm run catalog:photos -- ~/Downloads/photos-for-cloudflare");
}
const folder = resolve(folderArg);
const workers = wholeNumber("workers", flags.workers, 32);
const batchSize = wholeNumber("batch", flags.batch, 5000);
if ((flags.upload || flags.link) && !flags.env) {
  fail("--upload and --link need --env <settings file>. Nothing was touched.");
}
/** The settings, from the `--env` file only; `process.env` is never read. */
let settings: Record<string, string | undefined> = {};
if (flags.env) {
  try {
    settings = parseEnv(readFileSync(flags.env, "utf8"));
  } catch {
    fail(`could not read the settings file ${flags.env}.`);
  }
}

/* --- 1. Read and check the sheet ------------------------------------------ */

interface PhotoRow {
  line: number;
  slug: string;
  sortOrder: number;
  alt: string;
  vendor: string;
  vendorSku: string;
  /** The shared file: its category folder and its 16-hex name. */
  category: string;
  hash: string;
  path: string;
}

interface StoredFile {
  category: string;
  hash: string;
  path: string;
  bytes: number;
  fullKey: string;
  cardKey: string;
}

const problems: string[][] = [];
const problem = (line: number, slug: string, reason: string) =>
  problems.push([String(line), slug, reason]);

function readSheet(): { rows: PhotoRow[]; files: Map<string, StoredFile> } {
  let records: Record<string, string>[];
  try {
    records = parse(readFileSync(join(folder, "product-images.csv"), "utf8"), {
      columns: true,
      skip_empty_lines: true,
      bom: true,
    });
  } catch (error) {
    fail(`could not read product-images.csv: ${error instanceof Error ? error.message : error}`);
  }
  const first = records[0];
  if (!first) fail("product-images.csv has no rows.");
  for (const column of REQUIRED) {
    if (!(column in first)) fail(`product-images.csv has no "${column}" column.`);
  }

  const rows: PhotoRow[] = [];
  const files = new Map<string, StoredFile>();
  records.forEach((record, index) => {
    const line = index + 2;
    const cell = (column: (typeof REQUIRED)[number]) => (record[column] ?? "").trim();
    const slug = cell("slug");
    const file = FILE_PATTERN.exec(cell("file"));
    const sortOrder = /^\d+$/.test(cell("sort_order")) ? Number(cell("sort_order")) : -1;
    const alt = cell("alt");
    if (!slug) return problem(line, slug, "no slug");
    if (!CATEGORIES.has(cell("category"))) return problem(line, slug, `unknown category "${cell("category")}"`);
    if (!file) return problem(line, slug, `file "${cell("file")}" is not images/<category>/<16 hex>.webp`);
    if (file[1] !== cell("category")) return problem(line, slug, `category "${cell("category")}" but the file is under ${file[1]}/`);
    if (!Number.isInteger(sortOrder) || sortOrder < 0) return problem(line, slug, "sort_order is not 0 or more");
    if (!alt || alt.length > MAX_ALT) return problem(line, slug, `alt text is empty or over ${MAX_ALT}`);
    if (!cell("vendor") || !cell("vendor_sku")) return problem(line, slug, "no vendor or vendor_sku");

    const [, category, hash] = file as unknown as [string, string, string];
    const path = join(folder, file[0]);
    if (!files.has(path)) {
      let bytes = 0;
      try {
        bytes = statSync(path).size;
      } catch {
        return problem(line, slug, `file ${file[0]} is missing`);
      }
      if (bytes === 0) return problem(line, slug, `file ${file[0]} is empty`);
      files.set(path, {
        category,
        hash,
        path,
        bytes,
        fullKey: catalogPhotoKey(category, hash, "full"),
        cardKey: catalogPhotoKey(category, hash, "card"),
      });
    }
    rows.push({
      line,
      slug,
      sortOrder,
      alt,
      vendor: cell("vendor"),
      vendorSku: cell("vendor_sku"),
      category,
      hash,
      path,
    });
  });

  // Per product: one vendor + SKU, photo order 0..n-1, at most 8, no file twice.
  for (const group of groupBySlug(rows).values()) {
    const [head] = group;
    if (!head) continue;
    const orders = group.map((row) => row.sortOrder).sort((a, b) => a - b);
    if (orders.some((order, index) => order !== index)) {
      problem(head.line, head.slug, `photo order is ${orders.join(",")}, not 0..${group.length - 1}`);
    }
    if (group.length > MAX_PHOTOS_PER_PRODUCT) {
      problem(head.line, head.slug, `${group.length} photos, over ${MAX_PHOTOS_PER_PRODUCT}`);
    }
    if (new Set(group.map((row) => row.path)).size !== group.length) {
      problem(head.line, head.slug, "the same file twice");
    }
    if (group.some((row) => row.vendor !== head.vendor || row.vendorSku !== head.vendorSku)) {
      problem(head.line, head.slug, "rows disagree on vendor + vendor_sku");
    }
  }
  return { rows, files };
}

function groupBySlug(rows: readonly PhotoRow[]): Map<string, PhotoRow[]> {
  const groups = new Map<string, PhotoRow[]>();
  for (const row of rows) {
    const group = groups.get(row.slug);
    if (group) group.push(row);
    else groups.set(row.slug, [row]);
  }
  return groups;
}

/* --- Small helpers ---------------------------------------------------------- */

const csvCell = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const csvText = (header: string[], lines: string[][]) =>
  [header, ...lines].map((cells) => cells.map(csvCell).join(",")).join("\n") + "\n";

async function confirm(question: string): Promise<void> {
  if (flags.yes) return;
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  // A closed input (no terminal) answers "" rather than leaving the run hanging.
  const answer = await new Promise<string>((done) => {
    prompt.once("close", () => done(""));
    prompt.question(`${question} Type yes: `).then(done, () => done(""));
  });
  prompt.close();
  if (answer.trim().toLowerCase() !== "yes") fail("not confirmed. Nothing more was written.");
}

async function withRetry<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= ATTEMPTS) throw error;
      await new Promise((done) => setTimeout(done, 500 * attempt));
    }
  }
}

/** Runs `task` over `items`, `workers` at a time. */
async function eachLimited<T>(items: readonly T[], task: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(workers, items.length) }, async () => {
      while (next < items.length) await task(items[next++]!);
    }),
  );
}

/* --- 2. Files in R2 --------------------------------------------------------- */

/** Which files are already stored: the 1000 file at the vendor file's exact
 *  size. The card is written first, so a stored 1000 file means both. */
async function storedAlready(store: PhotoStore, files: readonly StoredFile[]): Promise<Set<string>> {
  const done = new Set<string>();
  await eachLimited(files, async (file) => {
    const found = await withRetry(() => headObject(store, file.fullKey));
    if (found && found.size === file.bytes) done.add(file.path);
  });
  return done;
}

async function upload(store: PhotoStore, files: readonly StoredFile[]): Promise<string[][]> {
  const failed: string[][] = [];
  let finished = 0;
  await eachLimited(files, async (file) => {
    try {
      const original = readFileSync(file.path);
      const card = await makePhotoSize(original, "card");
      await withRetry(() => putObject(store, file.cardKey, card, "image/webp"));
      await withRetry(() => putObject(store, file.fullKey, original, "image/webp"));
    } catch (error) {
      failed.push([file.path, error instanceof Error ? error.message : String(error)]);
    }
    finished++;
    if (finished % 250 === 0 || finished === files.length) {
      console.log(`  ${finished} of ${files.length}`);
    }
  });
  return failed;
}

/** Fetches a few stored photos by their public URL, the way a browser will. */
async function proveServing(store: PhotoStore, files: readonly StoredFile[]): Promise<string[]> {
  const pool = [...files];
  const sample: StoredFile[] = [];
  while (sample.length < 10 && pool.length > 0) {
    sample.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]!);
  }
  const bad: string[] = [];
  for (const file of sample) {
    for (const key of [file.fullKey, file.cardKey]) {
      const url = publicPhotoUrl(store, key);
      try {
        const response = await fetch(url);
        const type = response.headers.get("content-type") ?? "";
        if (!response.ok || !type.startsWith("image/webp")) bad.push(`${url} → ${response.status} ${type}`);
      } catch (error) {
        bad.push(`${url} → ${error instanceof Error ? error.message : "no answer"}`);
      }
    }
  }
  return bad;
}

/* --- 3. Rows in the database ------------------------------------------------ */

interface LinkPlan {
  /** slug → product id, for every product the sheet names. */
  ids: Map<string, string>;
  mismatches: string[][];
  skipped: string[];
}

async function planLinks(db: ReturnType<typeof drizzle<typeof schema>>, groups: Map<string, PhotoRow[]>): Promise<LinkPlan> {
  const productRows = await db.select({ id: products.id, slug: products.slug }).from(products);
  const bySlug = new Map(productRows.map((row) => [row.slug, row.id]));
  const sourceRows = await db
    .select({ productId: productSources.productId, vendor: productSources.vendor, sku: productSources.vendorSku })
    .from(productSources);
  const bySource = new Map(sourceRows.map((row) => [`${row.vendor}\u0000${row.sku}`, row.productId]));
  const withPhotos = new Set(
    (await db.selectDistinct({ productId: productImages.productId }).from(productImages)).map(
      (row) => row.productId,
    ),
  );

  const ids = new Map<string, string>();
  const mismatches: string[][] = [];
  const skipped: string[] = [];
  for (const [slug, group] of groups) {
    const head = group[0]!;
    const id = bySlug.get(slug);
    const sourceOwner = bySource.get(`${head.vendor}\u0000${head.vendorSku}`);
    if (!id) {
      mismatches.push([String(head.line), slug, "no product has this slug"]);
    } else if (sourceOwner !== id) {
      mismatches.push([
        String(head.line),
        slug,
        sourceOwner
          ? `${head.vendor} ${head.vendorSku} belongs to a different product`
          : `${head.vendor} ${head.vendorSku} is not a source of any product`,
      ]);
    } else if (withPhotos.has(id)) {
      skipped.push(slug);
    } else {
      ids.set(slug, id);
    }
  }
  return { ids, mismatches, skipped };
}

async function link(
  db: ReturnType<typeof drizzle<typeof schema>>,
  store: PhotoStore,
  groups: Map<string, PhotoRow[]>,
  plan: LinkPlan,
  files: Map<string, StoredFile>,
): Promise<{ products: number; rows: number; raced: string[] }> {
  const slugs = [...plan.ids.keys()];
  let productCount = 0;
  let rowCount = 0;
  const raced: string[] = [];
  let index = 0;
  while (index < slugs.length) {
    // Whole products per batch, about `batchSize` rows.
    const chunk: string[] = [];
    let size = 0;
    while (index < slugs.length && (chunk.length === 0 || size < batchSize)) {
      const slug = slugs[index++]!;
      chunk.push(slug);
      size += groups.get(slug)!.length;
    }
    await db.transaction(async (tx) => {
      const chunkIds = chunk.map((slug) => plan.ids.get(slug)!);
      // Lock the products the way a staff photo write does (`photos.ts`
      // `lockProduct`), so an admin upload cannot land between the check
      // below and the insert.
      await tx
        .select({ id: products.id })
        .from(products)
        .where(inArray(products.id, chunkIds))
        .for("update");
      // A photo staff added since the plan was made: leave that product alone.
      const taken = new Set(
        (
          await tx
            .selectDistinct({ productId: productImages.productId })
            .from(productImages)
            .where(inArray(productImages.productId, chunkIds))
        ).map((row) => row.productId),
      );
      const values = chunk.flatMap((slug) => {
        const productId = plan.ids.get(slug)!;
        if (taken.has(productId)) {
          raced.push(slug);
          return [];
        }
        return groups.get(slug)!.map((row) => ({
          productId,
          url: publicPhotoUrl(store, files.get(row.path)!.fullKey),
          alt: row.alt,
          sortOrder: row.sortOrder,
        }));
      });
      if (values.length > 0) await tx.insert(productImages).values(values);
      productCount += chunk.length - chunk.filter((slug) => taken.has(plan.ids.get(slug)!)).length;
      rowCount += values.length;
    });
    console.log(`  ${rowCount} rows, ${productCount} products`);
  }
  await db.execute(sql`analyze product_images`);
  return { products: productCount, rows: rowCount, raced };
}

/* --- Run ---------------------------------------------------------------------- */

async function main(): Promise<void> {
  const started = Date.now();
  const { rows, files } = readSheet();
  const groups = groupBySlug(rows);
  const allFiles = [...files.values()];
  const dir = flags.out ?? join("photo-report", new Date().toISOString().replace(/[:.]/g, "-"));
  mkdirSync(dir, { recursive: true });

  const perCategory = (category: string) =>
    `${category}: ${new Set(rows.filter((row) => row.category === category).map((row) => row.slug)).size} products, ${
      allFiles.filter((file) => file.category === category).length
    } files`;
  const megabytes = Math.round(allFiles.reduce((sum, file) => sum + file.bytes, 0) / 1024 / 1024);
  const summary = [
    `Sheet: ${rows.length} photo rows, ${groups.size} products, ${allFiles.length} files (${megabytes} MB)`,
    ...[...CATEGORIES].map(perCategory),
    `Problems: ${problems.length}`,
  ].join("\n");
  console.log(summary);
  writeFileSync(join(dir, "summary.txt"), `${summary}\n`);
  if (problems.length > 0) {
    writeFileSync(join(dir, "problems.csv"), csvText(["line", "slug", "problem"], problems));
    for (const [line, slug, reason] of problems.slice(0, 20)) console.error(`  line ${line} ${slug}: ${reason}`);
    fail(`${problems.length} problems in the sheet (${dir}/problems.csv). Nothing was touched.`);
  }

  const store = photoStore(settings);
  if (!store) {
    if (flags.upload || flags.link) fail("the five R2 settings are not all set (see photo-store.ts). Nothing was touched.");
    console.log("\nThe R2 settings are not set (--env), so the bucket was not checked.");
  } else {
    console.log(`\nBucket: ${store.endpoint}\nPublic: ${store.publicBase}`);
    const already = await storedAlready(store, allFiles);
    const todo = allFiles.filter((file) => !already.has(file.path));
    console.log(`Stored already: ${already.size}. To store: ${todo.length} files (${todo.length * 2} writes).`);

    if (flags.upload && todo.length > 0) {
      await confirm(`Store ${todo.length} files (two sizes each) in ${store.endpoint}?`);
      const failed = await upload(store, todo);
      if (failed.length > 0) {
        writeFileSync(join(dir, "upload-failed.csv"), csvText(["file", "error"], failed));
        fail(`${failed.length} files failed (${dir}/upload-failed.csv). Run again: stored files are skipped.`);
      }
      console.log(`Stored ${todo.length} files.`);
    }
    if (flags.link && !flags.upload && already.size !== allFiles.length) {
      fail(`${allFiles.length - already.size} files are not in the bucket. Run --upload first. No rows were written.`);
    }
    if (flags.upload || flags.link) {
      const bad = await proveServing(store, allFiles);
      if (bad.length > 0) {
        for (const line of bad) console.error(`  ${line}`);
        fail(`photos do not serve from ${store.publicBase} yet. Check the bucket's custom domain. No rows were written.`);
      }
      console.log(`Serving: 20 sampled URLs answer 200 image/webp.`);
    }
  }

  const url = settings.IMPORT_DATABASE_URL;
  if (!url) {
    if (flags.link) fail("IMPORT_DATABASE_URL is not in the settings file. No rows were written.");
    console.log("\nNo database was named (IMPORT_DATABASE_URL in --env), so none was checked.");
    return;
  }
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    // Never print the string itself: it holds the password.
    fail("IMPORT_DATABASE_URL is not a valid URL. Nothing was written.");
  }
  const where = `${target.hostname}${target.pathname}`;
  const pool = new Pool({ connectionString: url, max: 2 });
  pool.on("error", () => {});
  const db = drizzle({ client: pool, schema });
  try {
    const plan = await planLinks(db, groups);
    const line = `\nDatabase: ${where}\nMatched: ${plan.ids.size} products. Already have photos (skipped): ${plan.skipped.length}. Mismatches: ${plan.mismatches.length}.`;
    console.log(line);
    writeFileSync(join(dir, "summary.txt"), `${summary}\n${line}\n`);
    if (plan.skipped.length > 0) writeFileSync(join(dir, "skipped.csv"), csvText(["slug"], plan.skipped.map((slug) => [slug])));
    if (plan.mismatches.length > 0) {
      writeFileSync(join(dir, "mismatches.csv"), csvText(["line", "slug", "problem"], plan.mismatches));
      for (const [lineNo, slug, reason] of plan.mismatches.slice(0, 20)) console.error(`  line ${lineNo} ${slug}: ${reason}`);
      fail(`${plan.mismatches.length} rows do not match production (${dir}/mismatches.csv). No rows were written.`);
    }
    if (!flags.link) {
      console.log("Dry run. Nothing was written. Add --upload, then --link.");
      return;
    }
    if (plan.ids.size === 0) {
      console.log("Nothing to link: every product in the sheet already has photos.");
      return;
    }
    const linkStore = store ?? fail("the R2 settings are not set. No rows were written.");
    const rowTotal = [...plan.ids.keys()].reduce((sum, slug) => sum + groups.get(slug)!.length, 0);
    await confirm(`Link ${rowTotal} photos to ${plan.ids.size} products in ${where}?`);
    const result = await link(db, linkStore, groups, plan, files);
    const done = `Linked ${result.rows} photos to ${result.products} products in ${Math.round((Date.now() - started) / 1000)} s. Skipped since the plan (staff added a photo): ${result.raced.length}.`;
    console.log(done);
    writeFileSync(join(dir, "summary.txt"), `${summary}\n${line}\n${done}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
