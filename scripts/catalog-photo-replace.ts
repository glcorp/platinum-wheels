/* ---------------------------------------------------------------------------
   catalog-photo-replace — swap shared catalogue photos for clearer ones, and
   take wrong photos off products (D190b).

     npm run catalog:photo-replace -- <plan.csv> --env <file> [--env <file>]          dry run
     npm run catalog:photo-replace -- <plan.csv> --env <file> [--env <file>] --upload  store the new files
     npm run catalog:photo-replace -- <plan.csv> --env <file> [--env <file>] --write   repoint the rows

   <plan.csv>, one row per change:
     action    `replace` or `remove`
     old_url   the 1000px URL production holds today
     new_file  replace: the new 1000×1000 WebP on disk (absolute path)
     slug      remove: the one product to take the photo off (blank for replace)
     reason    why, for the report

   What it does, in order:
     1. checks the plan: every new file is a 1000×1000 WebP whose content
        hash differs from the old one, every old URL is a shared catalogue
        photo (`catalog/<category>/<hash>-1000.webp`, D139b); a staff upload
        under `products/<uuid>/` is refused. Any problem stops the run.
     2. `--upload`: stores each new file at a NEW key named by its own content
        hash, `catalog/<category>/<new hash>-1000.webp` as given and `-480.webp`
        (the card size, `makePhotoSize()`), card first. A key already holding a
        file of the same size is skipped; one holding a different size stops
        the run. **No existing key is ever overwritten or deleted**: the files
        are cached `immutable` for a year (D126b), and the old files stay so
        the change can be rolled back. Then fetches public URLs to prove the
        new files serve.
     3. `--write`: in ONE transaction, locks the affected rows, repoints every
        `product_images` row `WHERE url = old_url` to the new URL, deletes each
        `remove` row and closes up that product's photo order to 0..n-1. Before
        COMMIT the row counts must equal the dry run's exactly, or it rolls
        back. Writes `rollback.csv` (row id, product id, sort order, old url,
        new url; a removed row has a blank new url and its alt text) so a
        reverse UPDATE or INSERT restores it. `products.updated_at` is left
        alone, as the bulk load left it (D139b).

   Settings come only from the `--env` files (later files win); the shell's own
   variables are never read: the five R2 settings (`photo-store.ts`) and
   `IMPORT_DATABASE_URL` (the DIRECT Neon address).

   Options:
     --env <file>       settings file, repeatable (required for --upload and --write)
     --upload           store the new files in R2
     --write            repoint the rows (the files must be stored already)
     --yes              skip the typed confirmations
     --workers <n>      parallel uploads (default 6)
     --out <dir>        report folder (default photo-report/replace-<timestamp>)
   --------------------------------------------------------------------------- */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs, parseEnv } from "node:util";

import { parse } from "csv-parse/sync";
import { Pool, type PoolClient } from "pg";
import sharp from "sharp";

import { catalogPhotoKey } from "@/features/catalog/photo-files";
import { makePhotoSize } from "@/features/catalog/photo-sizes";
import { headObject, photoStore, publicPhotoUrl, putObject, type PhotoStore } from "@/features/catalog/photo-store";

const ATTEMPTS = 3;
const OLD_URL = /\/catalog\/(tires|wheels|accessories)\/([0-9a-f]{16})-1000\.webp$/;

const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    env: { type: "string", multiple: true },
    upload: { type: "boolean", default: false },
    write: { type: "boolean", default: false },
    yes: { type: "boolean", default: false },
    workers: { type: "string", default: "6" },
    out: { type: "string" },
  },
});

function fail(message: string): never {
  console.error(`catalog-photo-replace: ${message}`);
  process.exit(1);
}

const planFile = positionals[0];
if (!planFile || positionals.length > 1) fail("give the plan file. Example: npm run catalog:photo-replace -- plan.csv --env ~/r2.env");
const workers = Number(flags.workers);
if (!Number.isInteger(workers) || workers < 1 || workers > 16) fail("--workers must be a whole number from 1 to 16.");
if ((flags.upload || flags.write) && !flags.env?.length) fail("--upload and --write need --env <settings file>. Nothing was touched.");

/** The settings, from the `--env` files only; `process.env` is never read. */
const settings: Record<string, string | undefined> = {};
for (const file of flags.env ?? []) {
  try {
    Object.assign(settings, parseEnv(readFileSync(file, "utf8")));
  } catch {
    fail(`could not read the settings file ${file}.`);
  }
}

/* --- 1. Read and check the plan --------------------------------------------- */

interface Replace {
  oldUrl: string;
  category: string;
  newFile: string;
  newHash: string;
  bytes: Buffer;
  reason: string;
}
interface Remove {
  oldUrl: string;
  slug: string;
  reason: string;
}

async function readPlan(): Promise<{ replaces: Replace[]; removes: Remove[] }> {
  let records: Record<string, string>[];
  try {
    records = parse(readFileSync(planFile!, "utf8"), { columns: true, skip_empty_lines: true, bom: true });
  } catch (error) {
    fail(`could not read ${planFile}: ${error instanceof Error ? error.message : error}`);
  }
  const problems: string[] = [];
  const replaces: Replace[] = [];
  const removes: Remove[] = [];
  const seenOld = new Set<string>();
  for (const [index, record] of records.entries()) {
    const line = index + 2;
    const action = (record.action ?? "").trim();
    const oldUrl = (record.old_url ?? "").trim();
    const reason = (record.reason ?? "").trim();
    const old = OLD_URL.exec(oldUrl);
    if (!old) {
      problems.push(`line ${line}: old_url is not a shared catalogue photo (staff uploads are never touched)`);
      continue;
    }
    if (action === "replace") {
      if (seenOld.has(oldUrl)) problems.push(`line ${line}: ${oldUrl} is replaced twice`);
      seenOld.add(oldUrl);
      const newFile = (record.new_file ?? "").trim();
      let bytes: Buffer;
      try {
        bytes = readFileSync(newFile);
      } catch {
        problems.push(`line ${line}: new_file ${newFile} is missing`);
        continue;
      }
      const meta = await sharp(bytes).metadata().catch(() => null);
      if (!meta || meta.format !== "webp" || meta.width !== 1000 || meta.height !== 1000) {
        problems.push(`line ${line}: new_file is not a 1000×1000 WebP`);
        continue;
      }
      const newHash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
      if (newHash === old[2]) problems.push(`line ${line}: new_file is the old file`);
      replaces.push({ oldUrl, category: old[1]!, newFile, newHash, bytes, reason });
    } else if (action === "remove") {
      const slug = (record.slug ?? "").trim();
      if (!slug) problems.push(`line ${line}: remove needs a slug`);
      removes.push({ oldUrl, slug, reason });
    } else {
      problems.push(`line ${line}: action must be replace or remove`);
    }
  }
  const newKeys = new Map<string, string>();
  for (const r of replaces) {
    const other = newKeys.get(r.newHash);
    if (other && other !== r.oldUrl) problems.push(`two old photos would share the new file ${r.newHash}`);
    newKeys.set(r.newHash, r.oldUrl);
  }
  if (problems.length > 0) {
    for (const p of problems.slice(0, 30)) console.error(`  ${p}`);
    fail(`${problems.length} problems in the plan. Nothing was touched.`);
  }
  return { replaces, removes };
}

/* --- Helpers ------------------------------------------------------------------ */

const csvCell = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const csvText = (header: string[], lines: string[][]) =>
  [header, ...lines].map((cells) => cells.map(csvCell).join(",")).join("\n") + "\n";

async function confirm(question: string): Promise<void> {
  if (flags.yes) return;
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
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
      await new Promise((done) => setTimeout(done, 700 * attempt));
    }
  }
}

async function eachLimited<T>(items: readonly T[], task: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(workers, items.length) }, async () => {
      while (next < items.length) await task(items[next++]!);
    }),
  );
}

const newUrl = (store: Pick<PhotoStore, "publicBase">, r: Replace) =>
  publicPhotoUrl(store, catalogPhotoKey(r.category, r.newHash, "full"));

/* --- 2. Files in R2 --------------------------------------------------------- */

/** Which new files are stored already (the 1000 file at its exact size; the
 *  card is written first). A different size at a new key stops the run. */
async function storedAlready(store: PhotoStore, replaces: readonly Replace[]): Promise<Set<string>> {
  const done = new Set<string>();
  const clashes: string[] = [];
  await eachLimited(replaces, async (r) => {
    const found = await withRetry(() => headObject(store, catalogPhotoKey(r.category, r.newHash, "full")));
    if (!found) return;
    if (found.size === r.bytes.length) done.add(r.oldUrl);
    else clashes.push(catalogPhotoKey(r.category, r.newHash, "full"));
  });
  if (clashes.length > 0) fail(`${clashes.length} new keys already hold a different file (${clashes[0]}). Nothing was overwritten.`);
  return done;
}

async function upload(store: PhotoStore, replaces: readonly Replace[]): Promise<string[][]> {
  const failed: string[][] = [];
  let finished = 0;
  await eachLimited(replaces, async (r) => {
    try {
      const card = await makePhotoSize(r.bytes, "card");
      await withRetry(() => putObject(store, catalogPhotoKey(r.category, r.newHash, "card"), card, "image/webp"));
      await withRetry(() => putObject(store, catalogPhotoKey(r.category, r.newHash, "full"), r.bytes, "image/webp"));
    } catch (error) {
      failed.push([r.newFile, error instanceof Error ? error.message : String(error)]);
    }
    finished++;
    if (finished % 100 === 0 || finished === replaces.length) console.log(`  ${finished} of ${replaces.length}`);
  });
  return failed;
}

/** Fetches up to 15 new files (both sizes) by their public URL, as a browser will. */
async function proveServing(store: PhotoStore, replaces: readonly Replace[]): Promise<string[]> {
  const sample = [...replaces].sort(() => Math.random() - 0.5).slice(0, 15);
  const bad: string[] = [];
  for (const r of sample) {
    for (const size of ["full", "card"] as const) {
      const url = publicPhotoUrl(store, catalogPhotoKey(r.category, r.newHash, size));
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

interface RowPlan {
  /** old url → rows today */
  replaceCounts: Map<string, number>;
  /** remove: the product id and its row id, or why it cannot be removed */
  removeRows: { slug: string; productId: string; rowId: string; oldUrl: string }[];
  problems: string[];
}

async function planRows(client: PoolClient, replaces: readonly Replace[], removes: readonly Remove[]): Promise<RowPlan> {
  const replaceCounts = new Map<string, number>();
  const counts = await client.query<{ url: string; n: number }>(
    "select url, count(*)::int as n from product_images where url = any($1) group by url",
    [replaces.map((r) => r.oldUrl)],
  );
  for (const r of replaces) replaceCounts.set(r.oldUrl, 0);
  for (const row of counts.rows) replaceCounts.set(row.url, row.n);
  const problems: string[] = [];
  for (const [url, n] of replaceCounts) if (n === 0) problems.push(`no row holds ${url}`);

  const removeRows: RowPlan["removeRows"] = [];
  for (const r of removes) {
    const found = await client.query<{ product_id: string; id: string }>(
      "select i.product_id, i.id from product_images i join products p on p.id = i.product_id where p.slug = $1 and i.url = $2",
      [r.slug, r.oldUrl],
    );
    if (found.rows.length !== 1) problems.push(`remove ${r.slug}: ${found.rows.length} rows hold ${r.oldUrl}`);
    else removeRows.push({ slug: r.slug, productId: found.rows[0]!.product_id, rowId: found.rows[0]!.id, oldUrl: r.oldUrl });
  }
  const replaced = new Set(replaces.map((r) => r.oldUrl));
  for (const r of removes) if (replaced.has(r.oldUrl)) problems.push(`${r.oldUrl} is both replaced and removed`);
  return { replaceCounts, removeRows, problems };
}

async function writeRows(
  client: PoolClient,
  store: PhotoStore,
  replaces: readonly Replace[],
  plan: RowPlan,
  dir: string,
): Promise<{ updated: number; removed: number; renumbered: number }> {
  const rollback: string[][] = [];
  await client.query("begin");
  try {
    const oldUrls = replaces.map((r) => r.oldUrl);
    const removeIds = plan.removeRows.map((r) => r.rowId);
    // Lock every row this change touches, then record it for the rollback file.
    const locked = await client.query<{ id: string; product_id: string; url: string; alt: string; sort_order: number }>(
      "select id, product_id, url, alt, sort_order from product_images where url = any($1) or id = any($2) for update",
      [oldUrls, removeIds],
    );
    const expectedLocked = [...plan.replaceCounts.values()].reduce((a, b) => a + b, 0) + removeIds.length;
    if (locked.rows.length !== expectedLocked) throw new Error(`locked ${locked.rows.length} rows, the dry run counted ${expectedLocked}`);
    const toNew = new Map(replaces.map((r) => [r.oldUrl, newUrl(store, r)]));
    const removing = new Set(removeIds);
    for (const row of locked.rows) {
      rollback.push([row.id, row.product_id, String(row.sort_order), row.url, removing.has(row.id) ? "" : toNew.get(row.url)!, removing.has(row.id) ? row.alt : ""]);
    }

    let updated = 0;
    for (const r of replaces) {
      const result = await client.query("update product_images set url = $1 where url = $2", [toNew.get(r.oldUrl), r.oldUrl]);
      if (result.rowCount !== plan.replaceCounts.get(r.oldUrl)) {
        throw new Error(`${r.oldUrl}: updated ${result.rowCount} rows, the dry run counted ${plan.replaceCounts.get(r.oldUrl)}`);
      }
      updated += result.rowCount ?? 0;
    }
    let removed = 0;
    let renumbered = 0;
    if (removeIds.length > 0) {
      const result = await client.query("delete from product_images where id = any($1)", [removeIds]);
      if (result.rowCount !== removeIds.length) throw new Error(`deleted ${result.rowCount} rows, expected ${removeIds.length}`);
      removed = result.rowCount ?? 0;
      // Close up each touched product's photo order to 0..n-1.
      const renumber = await client.query(
        `update product_images i set sort_order = o.n
           from (select id, (row_number() over (partition by product_id order by sort_order, created_at, id) - 1)::int as n
                   from product_images where product_id = any($1)) o
          where i.id = o.id and i.sort_order <> o.n`,
        [[...new Set(plan.removeRows.map((r) => r.productId))]],
      );
      renumbered = renumber.rowCount ?? 0;
    }
    const left = await client.query<{ n: number }>("select count(*)::int as n from product_images where url = any($1)", [oldUrls]);
    if (left.rows[0]!.n !== 0) throw new Error(`${left.rows[0]!.n} rows still hold an old url`);
    writeFileSync(join(dir, "rollback.csv"), csvText(["row_id", "product_id", "sort_order", "old_url", "new_url", "removed_alt"], rollback));
    await client.query("commit");
    return { updated, removed, renumbered };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

/* --- Run ---------------------------------------------------------------------- */

async function main(): Promise<void> {
  const { replaces, removes } = await readPlan();
  const dir = flags.out ?? join("photo-report", `replace-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  mkdirSync(dir, { recursive: true });
  console.log(`Plan: ${replaces.length} photos to replace, ${removes.length} rows to remove.`);

  const store = photoStore(settings);
  if (!store) {
    if (flags.upload || flags.write) fail("the five R2 settings are not all set (see photo-store.ts). Nothing was touched.");
    console.log("The R2 settings are not set (--env), so the bucket was not checked.");
  } else {
    console.log(`Bucket: ${store.endpoint}\nPublic: ${store.publicBase}`);
    const already = await storedAlready(store, replaces);
    const todo = replaces.filter((r) => !already.has(r.oldUrl));
    console.log(`New files stored already: ${already.size}. To store: ${todo.length} (${todo.length * 2} writes).`);
    if (flags.upload && todo.length > 0) {
      await confirm(`Store ${todo.length} new files (two sizes each) in ${store.endpoint}?`);
      const failed = await upload(store, todo);
      if (failed.length > 0) {
        writeFileSync(join(dir, "upload-failed.csv"), csvText(["file", "error"], failed));
        fail(`${failed.length} files failed (${dir}/upload-failed.csv). Run again: stored files are skipped.`);
      }
      console.log(`Stored ${todo.length} files.`);
    }
    if (flags.write && !flags.upload && already.size !== replaces.length) {
      fail(`${replaces.length - already.size} new files are not in the bucket. Run --upload first. No rows were written.`);
    }
    if ((flags.upload || flags.write) && replaces.length > 0) {
      const bad = await proveServing(store, replaces);
      if (bad.length > 0) {
        for (const line of bad) console.error(`  ${line}`);
        fail(`new photos do not serve from ${store.publicBase}. No rows were written.`);
      }
      console.log("Serving: sampled new URLs answer 200 image/webp.");
    }
  }

  const url = settings.IMPORT_DATABASE_URL;
  if (!url) {
    if (flags.write) fail("IMPORT_DATABASE_URL is not in the settings files. No rows were written.");
    console.log("No database was named, so none was checked.");
    return;
  }
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    fail("IMPORT_DATABASE_URL is not a valid URL. Nothing was written.");
  }
  const where = `${target.hostname}${target.pathname}`;
  const pool = new Pool({ connectionString: url, max: 1 });
  pool.on("error", () => {});
  const client = await pool.connect();
  // A dropped connection fails the pending query (and with it the run, rolled back by the server)
  // instead of crashing the process from an unhandled event.
  client.on("error", () => {});
  try {
    const plan = await planRows(client, replaces, removes);
    const rows = [...plan.replaceCounts.values()].reduce((a, b) => a + b, 0);
    const line = `Database: ${where}\nDry run: ${rows} rows to repoint across ${replaces.length} photos; ${plan.removeRows.length} rows to remove. Problems: ${plan.problems.length}.`;
    console.log(line);
    writeFileSync(
      join(dir, "dry-run.csv"),
      csvText(["action", "old_url", "rows", "new_url", "slug", "reason"], [
        ...replaces.map((r) => ["replace", r.oldUrl, String(plan.replaceCounts.get(r.oldUrl)), store ? newUrl(store, r) : r.newHash, "", r.reason]),
        ...removes.map((r) => ["remove", r.oldUrl, "1", "", r.slug, r.reason]),
      ]),
    );
    if (plan.problems.length > 0) {
      for (const p of plan.problems.slice(0, 30)) console.error(`  ${p}`);
      fail(`${plan.problems.length} plan rows do not match production. No rows were written.`);
    }
    if (!flags.write) {
      console.log(`Dry run. Nothing was written. Report: ${dir}`);
      return;
    }
    const writeStore = store ?? fail("the R2 settings are not set. No rows were written.");
    await confirm(`Repoint ${rows} rows and remove ${plan.removeRows.length} in ${where}, in one transaction?`);
    const done = await writeRows(client, writeStore, replaces, plan, dir);
    const summary = `Committed: ${done.updated} rows repointed, ${done.removed} removed, ${done.renumbered} renumbered. Rollback file: ${dir}/rollback.csv`;
    console.log(summary);
    writeFileSync(join(dir, "summary.txt"), `${line}\n${summary}\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
