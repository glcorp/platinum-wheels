/* ---------------------------------------------------------------------------
   db-migrate — apply pending SQL migrations in `drizzle/` before `next build`.

   Why at build time: the Neon env vars are Vercel **Sensitive**, so nobody can
   pull them to a laptop. The build is the one place they are readable. With
   Neon's branch-per-preview, each preview build migrates its own copy-on-write
   branch; the production build migrates the main branch. A failed migration
   fails the build, so broken schema never goes live.

   Uses `DATABASE_URL_UNPOOLED`: DDL must not go through PgBouncer.

   Behaviour:
     - on Vercel (VERCEL=1) with no URL  → exit 1. A deploy that silently skips
       its migrations would ship code against a schema that isn't there.
     - off Vercel with no URL            → skip, exit 0. A local `npm run build`
       without a database is a normal thing to do.
   Drizzle records applied migrations in `drizzle.__drizzle_migrations`, so a
   re-run is a no-op.
   --------------------------------------------------------------------------- */

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const url = process.env.DATABASE_URL_UNPOOLED;
const onVercel = process.env.VERCEL === "1";

if (!url) {
  if (onVercel) {
    console.error("db-migrate: DATABASE_URL_UNPOOLED is not set on this Vercel build. Refusing to build.");
    process.exit(1);
  }
  console.log("db-migrate: DATABASE_URL_UNPOOLED not set; skipping migrations (local build).");
  process.exit(0);
}

const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  await migrate(drizzle({ client }), { migrationsFolder: "drizzle" });
  console.log("db-migrate: migrations up to date.");
} catch (error) {
  console.error("db-migrate: migration failed.", error);
  process.exitCode = 1;
} finally {
  await client.end();
}
