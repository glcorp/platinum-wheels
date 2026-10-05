/* ---------------------------------------------------------------------------
   The e2e suite's fixture: a throwaway Postgres, the app's own schema, a small
   catalogue loaded by the app's own importer, and a few rows no importer makes
   (a discontinued product, a hidden one, photos, payment links).

   Library only; `run.mjs` is the entry point. Nothing here touches a real
   database or service: the database is a real Postgres binary started in
   `db-server.mjs` on a local port with a throwaway data directory, the photos
   are drawn by `photos.mjs`, and the payment gateway is a closed port.

   Why `embedded-postgres` and not a Postgres install: the suite must run on a
   laptop and in CI with `npm ci` and nothing else. The binary lives in
   `tests/fixture/package.json`, never in the app's dependencies. (PGlite was
   tried first and dropped: see `db-server.mjs`.)
   --------------------------------------------------------------------------- */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";
import sharp from "sharp";

export const here = dirname(fileURLToPath(import.meta.url));
export const repo = join(here, "..", "..");
export const runDir = join(here, ".run");
export const slugs = JSON.parse(readFileSync(join(here, "slugs.json"), "utf8"));

export const DB_PORT = Number(process.env.FIXTURE_DB_PORT ?? 55600);
export const PHOTO_PORT = Number(process.env.FIXTURE_PHOTO_PORT ?? 3590);
export const DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${DB_PORT}/postgres?sslmode=disable`;
export const PHOTO_ORIGIN = `http://127.0.0.1:${PHOTO_PORT}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** `npm install` inside tests/fixture on first use (or when the lockfile moved). */
export function ensureFixtureDeps() {
  if (existsSync(join(here, "node_modules", "embedded-postgres"))) return;
  console.log("fixture: installing the Postgres binary into tests/fixture (first run only) ...");
  const res = spawnSync("npm", ["ci", "--no-audit", "--no-fund"], { cwd: here, stdio: "inherit" });
  if (res.status !== 0) throw new Error("fixture: npm ci in tests/fixture failed");
}

/* ---- the database ---- */

async function canConnect() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    await client.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** Starts Postgres on DB_PORT with an empty database. Refuses to
 *  reuse a server already on the port: a leftover from another run would carry
 *  that run's rows. */
export async function startDb() {
  if (await canConnect()) {
    throw new Error(
      `fixture: something already answers on 127.0.0.1:${DB_PORT}. Stop it, or set FIXTURE_DB_PORT to a free port.`,
    );
  }
  mkdirSync(runDir, { recursive: true });
  const log = join(runDir, "db.log");
  const child = spawn(process.execPath, [join(here, "db-server.mjs")], {
    cwd: here,
    env: { ...process.env, FIXTURE_DB_PORT: String(DB_PORT) },
    detached: true,
    stdio: ["ignore", openLog(log), openLog(log)],
  });
  child.unref();
  writeFileSync(join(runDir, "db.pid"), String(child.pid));
  for (let i = 0; i < 200; i++) {
    if (await canConnect()) return child.pid;
    await sleep(300);
  }
  throw new Error(`fixture: Postgres did not come up on ${DB_PORT} (see ${log})`);
}

function openLog(path) {
  return openSync(path, "a");
}

export function stopDb() {
  const pidFile = join(runDir, "db.pid");
  if (!existsSync(pidFile)) return;
  const pid = Number(readFileSync(pidFile, "utf8"));
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  }
  rmSync(pidFile, { force: true });
}

function run(cmd, args, env, label) {
  const res = spawnSync(cmd, args, { cwd: repo, env: { ...process.env, ...env }, stdio: "inherit" });
  if (res.status !== 0) throw new Error(`fixture: ${label} failed (exit ${res.status})`);
}

/** Migrations, then the catalogue through the importer, then the extra rows. */
export async function loadDb() {
  run("node", ["scripts/db-migrate.mjs"], { DATABASE_URL_UNPOOLED: DATABASE_URL }, "migrations");
  run(
    "npx",
    [
      "tsx",
      "scripts/catalog-import.ts",
      "tests/fixture/catalogue.csv",
      "--write",
      "--yes",
      "--out",
      "tests/fixture/.run/import-report",
    ],
    { IMPORT_DATABASE_URL: DATABASE_URL },
    "catalogue import",
  );
  await seedExtras();
}

/* ---- rows the importer cannot make ---- */

async function seedExtras() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const one = async (sql, params, what) => {
      const res = await client.query(sql, params);
      if (res.rowCount !== 1) throw new Error(`fixture: expected one row for ${what}, got ${res.rowCount}`);
    };

    // Statuses. The importer loads everything `published` (D113).
    for (const [key, status] of [
      ["tireUnavailable", "discontinued"],
      ["wheelUnavailable", "discontinued"],
      ["accessoryUnavailable", "discontinued"],
      ["hidden", "hidden"],
    ]) {
      await one("update products set status = $1 where slug = $2", [status, slugs[key]], `${key} (${slugs[key]})`);
    }

    // Photos: every other published product gets one, so cards show both a
    // photo and the no-photo tile. The named PDP slugs always get one, except
    // the accessory ones, which stay photo-less on purpose (tile path).
    const withPhoto = new Set([slugs.tire, slugs.wheel, slugs.tireUnavailable, slugs.wheelUnavailable]);
    const { rows } = await client.query("select id, slug, category, brand, name from products order by slug");
    let n = 0;
    for (const row of rows) {
      n += 1;
      const wants = withPhoto.has(row.slug) || (n % 2 === 0 && row.category !== "accessories");
      if (!wants || row.slug === slugs.accessory || row.slug === slugs.accessoryUnavailable) continue;
      const hash = row.id.replaceAll("-", "").slice(0, 16);
      await client.query(
        "insert into product_images (product_id, url, alt, sort_order) values ($1, $2, $3, 0)",
        [row.id, `${PHOTO_ORIGIN}/catalog/${row.category}/${hash}-1000.webp`, `${row.brand} ${row.name}`.slice(0, 120)],
      );
    }

    // Payment links, one per state a customer can meet (D100, D108).
    const link = (key, description, cents, { status = "active", createdAgo = "0 seconds", expiresIn = "7 days", paid = false, cancelled = false }) =>
      client.query(
        `insert into payment_links
           (public_token, idempotency_key, amount_cents, description, status, created_at, expires_at, created_by, paid_at, cancelled_at, cancelled_by)
         values ($1, gen_random_uuid(), $2, $3, $4::payment_link_status,
                 now() - $5::interval, now() + $6::interval, 'qa',
                 case when $7::boolean then now() else null end,
                 case when $8::boolean then now() else null end,
                 case when $8::boolean then 'qa' else null end)`,
        [slugs.pay[key], cents, description, status, createdAgo, expiresIn, paid, cancelled],
      );
    await link("open", "Winter tires, installed (fixture)", 128_450, {});
    await link("paid", "Set of four wheels (fixture)", 99_900, { status: "paid", paid: true });
    await link("cancelled", "Withdrawn quote (fixture)", 5_000, { status: "cancelled", cancelled: true });
    await link("expired", "Old request (fixture)", 25_000, { createdAgo: "3 days", expiresIn: "-1 day" });
  } finally {
    await client.end();
  }
}

/* ---- photos ---- */

/** Stands in for the photo bucket: draws a plain WebP for any
 *  `/catalog/<category>/<hash>-<480|1000>.webp`. Deterministic colour per hash. */
export function startPhotoServer() {
  const cache = new Map();
  const server = createServer(async (req, res) => {
    const match = /^\/catalog\/([a-z]+)\/([0-9a-f]+)-(480|1000)\.webp$/.exec(req.url ?? "");
    if (!match) {
      res.writeHead(404).end();
      return;
    }
    const [, category, hash, width] = match;
    const key = `${category}/${hash}/${width}`;
    let body = cache.get(key);
    if (!body) {
      const size = Number(width);
      const hue = parseInt(hash.slice(0, 4), 16) % 360;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
        <rect width="100" height="100" fill="#0B0B0D"/>
        <circle cx="50" cy="50" r="38" fill="hsl(${hue} 18% 32%)"/>
        <circle cx="50" cy="50" r="24" fill="hsl(${hue} 12% 56%)"/>
        <circle cx="50" cy="50" r="6" fill="#0B0B0D"/></svg>`;
      body = await sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer();
      cache.set(key, body);
    }
    res
      .writeHead(200, { "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable" })
      .end(body);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PHOTO_PORT, "127.0.0.1", () => resolve(server));
  });
}
