import { defineConfig } from "drizzle-kit";

/* Migrations run against Neon's **unpooled** URL: DDL through PgBouncer's
   transaction mode can fail or half-apply. `DATABASE_URL_UNPOOLED` is set by
   the Vercel Neon integration alongside the pooled `DATABASE_URL`. */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? "",
  },
});
