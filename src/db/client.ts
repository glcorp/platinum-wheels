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

   Time limits (D145 audit, BE-RESILIENCE / BE-DB; D151). Before them a
   hung database held each request 10 to 20 s. Now a connection must open in
   `CONNECT_TIMEOUT_MS` and every query answer within `QUERY_TIMEOUT_MS`, or
   the request gets an error it already handles (the storefront's error page,
   the admin's inline "could not be read" lines, the Pay button's retry).

   **Why client-side, not `statement_timeout` / `lock_timeout`.** node-postgres
   sends those as startup parameters, and Neon's pooled (PgBouncer) endpoint
   refuses any startup parameter it does not track ("unsupported startup
   parameter"), so every connection would fail. A session `SET` is no better:
   in transaction pooling it sticks to whichever server connection ran it and
   leaks into other clients, the catalogue import scripts included. The
   server-side form that is safe on the pooler is `SET LOCAL` inside a
   transaction; that belongs to the code that opens the transaction.

   **A timed-out client is thrown away, never reused.** `query_timeout` only
   stops waiting: the query is still running on the server and the client is
   still busy with it. Inside a transaction Drizzle then queues `rollback`
   behind it (which times out too) and releases the client normally. Back in
   the pool, the next request's statements would run inside that still-open
   transaction once the hung query returned. The `release` listener below ends
   any client released with work still on it; `end()` on a busy client
   destroys the socket, PgBouncer drops the server connection, and Postgres
   rolls the transaction back. `pool.query()` already does this on its own
   (`release(err)` removes the client).

   Scope: the app only. `scripts/db-migrate.mjs`, `catalog-import.ts` and
   `catalog-photos.ts` build their own `pg` clients and are not limited.
   --------------------------------------------------------------------------- */

import { attachDatabasePool } from "@vercel/functions";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

/** Opening a connection (Neon cold start included) may take this long. Neon
 *  resumes a suspended compute in about a second, so 5 s is generous. */
const CONNECT_TIMEOUT_MS = 5_000;

/** Each query may take this long. The slowest measured reads are tens of
 *  milliseconds (`design/reports/launch-audit.md`, BE-DB); the slowest write
 *  is the admin's bulk status change over every matching product. */
const QUERY_TIMEOUT_MS = 8_000;

/** node-postgres internals (pg 8.23, pinned in `package.json`): the query the
 *  client is waiting on, and the ones queued behind it. Read only to decide
 *  whether a released client is still busy. */
interface ClientInternals {
  _getActiveQuery?: () => unknown;
  _queryQueue?: unknown[];
}

function isBusy(client: unknown): boolean {
  const internals = client as ClientInternals;
  return Boolean(internals._getActiveQuery?.()) || (internals._queryQueue?.length ?? 0) > 0;
}

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
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS,
  });
  // Emitted before the pool decides whether to keep the client; `end()` sets
  // `_ending` synchronously, so the pool removes it instead (see the header).
  pool.on("release", (_error, client) => {
    if (isBusy(client)) void client.end().catch(() => undefined);
  });
  attachDatabasePool(pool);

  instance = drizzle({ client: pool, schema });
  return instance;
}
