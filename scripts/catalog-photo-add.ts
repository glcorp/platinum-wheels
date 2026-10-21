/* ---------------------------------------------------------------------------
   catalog-photo-add — give a first photo to products that have none (D190b).

     npm run catalog:photo-add -- <plan.csv> --env <file> [--env <file>]           dry run
     npm run catalog:photo-add -- <plan.csv> --env <file> [--env <file>] --upload   store the files
     npm run catalog:photo-add -- <plan.csv> --env <file> [--env <file>] --write    insert the rows

   <plan.csv>, one row per product: slug, new_file (a 1000×1000 WebP on disk, absolute), reason.
   Several products may name one file; it is stored once at `catalog/<category>/<content hash>-1000.webp`
   (+ `-480`), a NEW key, never overwriting or deleting one (the files are cached `immutable`, D126b).
   `--write` inserts one `product_images` row (sort_order 0, alt = brand + model or name) per product, in ONE
   transaction that locks the products and re-checks that each still has no photo (a photo staff added since
   is never pushed aside); it rolls back unless the count equals the dry run's, and leaves `products.updated_at`
   alone (D139b). It writes `rollback.csv` (the inserted row ids). Settings come only from the `--env` files.
   --------------------------------------------------------------------------- */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs, parseEnv } from "node:util";

import { parse } from "csv-parse/sync";
import { Pool } from "pg";
import sharp from "sharp";

import { catalogPhotoKey } from "@/features/catalog/photo-files";
import { makePhotoSize } from "@/features/catalog/photo-sizes";
import { headObject, photoStore, publicPhotoUrl, putObject } from "@/features/catalog/photo-store";

const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    env: { type: "string", multiple: true },
    upload: { type: "boolean", default: false },
    write: { type: "boolean", default: false },
    out: { type: "string" },
  },
});

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const planFile = positionals[0];
if (!planFile) fail("usage: catalog-photo-add <plan.csv> --env <file> [--upload] [--write]");
const settings: Record<string, string | undefined> = {};
for (const file of flags.env ?? []) Object.assign(settings, parseEnv(readFileSync(file, "utf8")));

interface Item {
  slug: string;
  bytes: Buffer;
  hash: string;
  reason: string;
}

async function main() {
  const records: Record<string, string>[] = parse(readFileSync(planFile!, "utf8"), { columns: true, skip_empty_lines: true, bom: true });
  const items: Item[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const [i, r] of records.entries()) {
    const slug = (r.slug ?? "").trim();
    if (!slug || seen.has(slug)) problems.push(`line ${i + 2}: slug missing or repeated`);
    seen.add(slug);
    try {
      const bytes = readFileSync((r.new_file ?? "").trim());
      const meta = await sharp(bytes).metadata();
      if (meta.format !== "webp" || meta.width !== 1000 || meta.height !== 1000) problems.push(`line ${i + 2}: not a 1000x1000 WebP`);
      items.push({ slug, bytes, hash: createHash("sha256").update(bytes).digest("hex").slice(0, 16), reason: (r.reason ?? "").trim() });
    } catch {
      problems.push(`line ${i + 2}: cannot read ${r.new_file}`);
    }
  }
  if (problems.length) {
    problems.slice(0, 20).forEach((p) => console.error("  " + p));
    fail(`${problems.length} problems. Nothing was touched.`);
  }

  const url = settings.IMPORT_DATABASE_URL;
  if (!url) fail("IMPORT_DATABASE_URL is not in the settings files.");
  const pool = new Pool({ connectionString: url, max: 1 });
  const client = await pool.connect();
  const out = flags.out ?? join("photo-report", `add-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  mkdirSync(out, { recursive: true });
  try {
    const found = await client.query<{ id: string; slug: string; category: string; brand: string | null; model: string | null; name: string; has: boolean; status: string }>(
      `select p.id, p.slug, p.category::text, p.brand, p.model, p.name, p.status::text,
              exists (select 1 from product_images i where i.product_id = p.id) as has
         from products p where p.slug = any($1)`,
      [items.map((i) => i.slug)],
    );
    const bySlug = new Map(found.rows.map((r) => [r.slug, r]));
    const bad = items.filter((i) => {
      const p = bySlug.get(i.slug);
      return !p || p.has || !["published", "discontinued"].includes(p.status);
    });
    if (bad.length) fail(`${bad.length} products are missing, hidden or already have a photo (${bad[0]!.slug}). Nothing was touched.`);
    const store = photoStore(settings);
    console.log(`Plan: ${items.length} products, ${new Set(items.map((i) => i.hash)).size} files.`);

    const fileCat = new Map<string, { hash: string; category: string; bytes: Buffer }>();
    for (const i of items) fileCat.set(i.hash, { hash: i.hash, category: bySlug.get(i.slug)!.category, bytes: i.bytes });
    if (flags.upload) {
      if (!store) fail("the R2 settings are not set.");
      for (const f of fileCat.values()) {
        const full = catalogPhotoKey(f.category as "tires", f.hash, "full");
        const have = await headObject(store, full);
        if (have && have.size !== f.bytes.length) fail(`${full} already holds a different file. Nothing overwritten.`);
        if (have) continue;
        await putObject(store, catalogPhotoKey(f.category as "tires", f.hash, "card"), await makePhotoSize(f.bytes, "card"), "image/webp");
        await putObject(store, full, f.bytes, "image/webp");
      }
      console.log(`Stored ${fileCat.size} files.`);
    }
    if (!flags.write) return console.log("Dry run. Nothing was written to the database.");
    if (!store) fail("the R2 settings are not set.");
    for (const f of fileCat.values()) {
      const head = await headObject(store, catalogPhotoKey(f.category as "tires", f.hash, "full"));
      if (!head) fail("a new file is not stored yet; run --upload first.");
    }
    await client.query("begin");
    try {
      await client.query("select id from products where slug = any($1) for update", [items.map((i) => i.slug)]);
      const rollback: string[][] = [];
      for (const i of items) {
        const p = bySlug.get(i.slug)!;
        const again = await client.query("select 1 from product_images where product_id = $1", [p.id]);
        if (again.rowCount) continue;
        const alt = `${p.brand ?? ""} ${p.model ?? p.name}`.trim().slice(0, 200);
        const photoUrl = publicPhotoUrl(store, catalogPhotoKey(p.category as "tires", i.hash, "full"));
        const ins = await client.query<{ id: string }>(
          "insert into product_images (product_id, url, alt, sort_order) values ($1,$2,$3,0) returning id",
          [p.id, photoUrl, alt],
        );
        rollback.push([ins.rows[0]!.id, p.id, i.slug, photoUrl]);
      }
      if (rollback.length !== items.length) throw new Error(`inserted ${rollback.length}, expected ${items.length}`);
      await client.query("commit");
      writeFileSync(join(out, "rollback.csv"), "row_id,product_id,slug,url\n" + rollback.map((r) => r.join(",")).join("\n") + "\n");
      console.log(`Committed: ${rollback.length} rows inserted. Rollback file: ${join(out, "rollback.csv")}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
