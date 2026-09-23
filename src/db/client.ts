/* ---------------------------------------------------------------------------
   Database client — one `pg` pool per function instance, shared by Drizzle.

   Why `pg` (node-postgres) and not Neon's HTTP driver: payments need
   interactive transactions with `SELECT … FOR UPDATE` (lock the link, check
   it is still payable, allocate the next attempt number, commit). Neon's HTTP
   driver cannot hold a transaction open across statements; a TCP pool can.
   On Vercel Fluid Compute one instance serves many requests, so a small pool
   is reused rather than reconnected per request.

   `attachDatabasePool` lets Vercel close idle clients before an instance is
   suspended, so the pool never leaks connections into Neon's limit.

   Connection string: `DATABASE_URL` is Neon's **pooled** (PgBouncer) URL, set
   by the Vercel Neon integration. Migrations use `DATABASE_URL_UNPOOLED`
   instead (`drizzle.config.ts`), because DDL must not go through PgBouncer's
   transaction mode.

   Lazy on purpose: the pool is built on first `getDb()` call, not at import.
   A module that throws at import would take down `next build` for every route
   that transitively imports it, even ones that never touch the database.
   --------------------------------------------------------------------------- */

import { attachDatabasePool } from "@vercel/functions";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

let instance: Database | undefined;

export function getDb(): Database {
  if (instance) return instance;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Locally, put the Neon dev branch's pooled URL in .env.local; on Vercel, the Neon integration sets it.",
    );
  }

  const pool = new Pool({
    connectionString: url,
    // Small on purpose: Neon's pooler multiplexes, and a Fluid instance is one
    // process. Five covers concurrent admin + customer requests on one instance.
    max: 5,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
  });
  attachDatabasePool(pool);

  instance = drizzle({ client: pool, schema });
  return instance;
}
