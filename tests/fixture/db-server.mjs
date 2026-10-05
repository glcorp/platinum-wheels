/* The fixture's Postgres, as its own long-lived process (started by fixture.mjs).
   A real Postgres 17 binary (`embedded-postgres`), an empty data directory made
   fresh each start and removed on exit, on FIXTURE_DB_PORT. Not PGlite: PGlite
   behind a socket shares one session between connections, so the app's parallel
   queries (the results page runs eight at once) collide on the unnamed prepared
   statement and a request fails with "bind message supplies N parameters, but
   prepared statement requires M". Measured 2026-10-05; a real server has no such
   limit. */
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import EmbeddedPostgres from "embedded-postgres";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, ".run", "pgdata");
const port = Number(process.env.FIXTURE_DB_PORT ?? 55600);

rmSync(dir, { recursive: true, force: true });
const server = new EmbeddedPostgres({
  databaseDir: dir,
  user: "postgres",
  password: "postgres",
  port,
  persistent: false,
  postgresFlags: ["-c", "fsync=off", "-c", "synchronous_commit=off", "-c", "full_page_writes=off"],
});

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  try {
    await server.stop();
  } catch {
    /* already down */
  }
  rmSync(dir, { recursive: true, force: true });
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);

await server.initialise();
await server.start();
console.log(`fixture postgres ready on ${port}`);
// Stay alive until told to stop.
setInterval(() => undefined, 1 << 30);
