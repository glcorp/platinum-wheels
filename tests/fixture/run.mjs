#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   One command for the fixture-backed e2e specs (`tests/llm.md`):

     npm run test:e2e:fixture                  build + database + server + the specs
     npm run test:e2e:fixture -- <playwright args>   same, but run what you name
     npm run test:e2e:fixture:up               database + photos + server only, left running
     npm run test:e2e:fixture:down             stop whatever `:up` left

   What a run does, in order:
     1. installs the Postgres binary into tests/fixture on first use;
     2. starts a throwaway Postgres (a real binary, port FIXTURE_DB_PORT, default 55600),
        migrates it, loads tests/fixture/catalogue.csv with the app's importer and
        adds the rows no importer makes (fixture.mjs);
     3. serves stand-in product photos on FIXTURE_PHOTO_PORT (default 3590);
     4. `next build` with the fixture's environment, then `next start` on
        FIXTURE_APP_PORT (default 3500), PRODUCTION build only (D88);
     5. runs Playwright against it with the search-indexing flag OFF, then
        rebuilds with the flag ON and runs `seo` again, because the flag is
        fixed at build time (D112) and one run sees one state;
     6. stops everything it started.

   Everything is local and throwaway: no real database, email, payment gateway
   or photo store is configured, and the shell's own settings for any of them
   are stripped before the build.

   Environment knobs: FIXTURE_APP_PORT, FIXTURE_DB_PORT, FIXTURE_PHOTO_PORT,
   FIXTURE_SKIP_BUILD=1 (reuse the last `.next`, which must have been built by
   this script), FIXTURE_ONE_PASS=1 (skip the indexing-on pass).
   --------------------------------------------------------------------------- */
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import { join } from "node:path";

import {
  DATABASE_URL,
  PHOTO_ORIGIN,
  PHOTO_PORT,
  ensureFixtureDeps,
  here,
  loadDb,
  repo,
  runDir,
  startDb,
  stopDb,
} from "./fixture.mjs";

const APP_PORT = Number(process.env.FIXTURE_APP_PORT ?? 3500);
const STRIPE_PORT = Number(process.env.FIXTURE_STRIPE_PORT ?? 3591);
const mode = process.argv[2] === "up" || process.argv[2] === "down" ? process.argv[2] : "run";
const passthrough = mode === "run" ? process.argv.slice(2) : [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nextBin = join(repo, "node_modules", "next", "dist", "bin", "next");
const stateFile = join(runDir, "state.json");

/** The shell's own settings for anything real are removed first: a fixture run
 *  must never reach Neon, Resend, Stripe, R2 or a Vercel project. */
const SCRUB = /^(DATABASE_URL|DATABASE_URL_UNPOOLED|IMPORT_DATABASE_URL|POSTGRES_|PG[A-Z]*$|NEON_|RESEND_|LEAD_CAPTURE_|AUTO_EMAIL_|R2_|PHOTOS_|BLOB_|STRIPE_|CONVERGE_|FIXIE_|ADMIN_|STOREFRONT_URL|SEARCH_INDEXING_|NEXT_PUBLIC_STOREFRONT_|QA_|VERCEL|CRON_SECRET)/;

function cleanEnv() {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) if (!SCRUB.test(key)) env[key] = value;
  return env;
}

function credentials() {
  if (existsSync(stateFile)) return JSON.parse(readFileSync(stateFile, "utf8")).credentials;
  return { username: "e2e-admin", password: randomBytes(12).toString("hex"), secret: randomBytes(32).toString("hex") };
}

function appEnv(creds, indexing) {
  return {
    ...cleanEnv(),
    DATABASE_URL,
    DATABASE_URL_UNPOOLED: DATABASE_URL,
    ADMIN_USERNAME: creds.username,
    ADMIN_PASSWORD: creds.password,
    ADMIN_SESSION_SECRET: creds.secret,
    // Quote email OFF (D104): the cart's send answers success without sending.
    AUTO_EMAIL_LEAD_CAPTURE_ENABLED: "false",
    QA_ERROR_ROUTE: "1",
    STOREFRONT_URL: `http://localhost:${APP_PORT}`,
    // Stripe is a local stand-in (`stripe-fake.mjs`): a sandbox-shaped key the
    // fake accepts, and a webhook secret the specs sign with (`STRIPE_WEBHOOK_SECRET`
    // in `helpers.ts`). `stripe.ts` honours the host override only for a test key.
    STRIPE_SECRET_KEY: "sk_test_fixture0000000000000000",
    STRIPE_WEBHOOK_SECRET: "whsec_fixture_not_a_real_secret",
    STRIPE_API_HOST: "127.0.0.1",
    STRIPE_API_PORT: String(STRIPE_PORT),
    SEARCH_INDEXING_ENABLED: indexing ? "true" : "false",
    NEXT_TELEMETRY_DISABLED: "1",
  };
}

function sh(cmd, args, env, label) {
  const res = spawnSync(cmd, args, { cwd: repo, env, stdio: "inherit" });
  if (res.status !== 0) throw new Error(`${label} failed (exit ${res.status})`);
}

function portIsFree(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(true));
  });
}

let appChild = null;
function startApp(env) {
  mkdirSync(runDir, { recursive: true });
  const log = openSync(join(runDir, "app.log"), "w");
  appChild = spawn(process.execPath, [nextBin, "start", "-p", String(APP_PORT)], {
    cwd: repo,
    env,
    detached: true,
    stdio: ["ignore", log, log],
  });
  appChild.unref();
  return appChild.pid;
}

async function waitForApp() {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`http://localhost:${APP_PORT}/robots.txt`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return;
    } catch {
      /* not yet */
    }
    await sleep(500);
  }
  throw new Error(`the app did not answer on :${APP_PORT} (see tests/fixture/.run/app.log)`);
}

function stopApp(pid = appChild?.pid) {
  if (!pid) return;
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    /* gone */
  }
  appChild = null;
}

/** The stand-in photo bucket is its own process: this one blocks on
 *  `spawnSync` (build, Playwright), and a server in-process would not answer a
 *  single image while it does. */
let photoChild = null;
function startPhotos() {
  photoChild = spawn(process.execPath, [join(here, "photos.mjs")], {
    cwd: repo,
    detached: true,
    stdio: "ignore",
  });
  photoChild.unref();
  return photoChild.pid;
}

function stopPhotos(pid = photoChild?.pid) {
  if (!pid) return;
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    /* gone */
  }
  photoChild = null;
}

/** The Stripe stand-in, a separate process for the same reason as the photos. */
let stripeChild = null;
function startStripe() {
  stripeChild = spawn(process.execPath, [join(here, "stripe-fake.mjs")], {
    cwd: repo,
    env: { ...cleanEnv(), FIXTURE_STRIPE_PORT: String(STRIPE_PORT) },
    detached: true,
    stdio: "ignore",
  });
  stripeChild.unref();
  return stripeChild.pid;
}

function stopStripe(pid = stripeChild?.pid) {
  if (!pid) return;
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    /* gone */
  }
  stripeChild = null;
}

function cleanup() {
  stopApp();
  stopPhotos();
  stopStripe();
  stopDb();
  rmSync(stateFile, { force: true });
}

if (mode === "down") {
  if (existsSync(stateFile)) {
    const state = JSON.parse(readFileSync(stateFile, "utf8"));
    stopApp(state.appPid);
    stopPhotos(state.photoPid);
    stopStripe(state.stripePid);
  }
  stopDb();
  rmSync(stateFile, { force: true });
  console.log("fixture: stopped.");
  process.exit(0);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (mode === "run") cleanup();
    process.exit(130);
  });
}

try {
  ensureFixtureDeps();
  if (!(await portIsFree(APP_PORT))) throw new Error(`:${APP_PORT} is in use. Stop it or set FIXTURE_APP_PORT.`);

  console.log("fixture: starting Postgres and loading the catalogue ...");
  await startDb();
  await loadDb();
  if (!(await portIsFree(PHOTO_PORT))) throw new Error(`:${PHOTO_PORT} is in use. Stop it or set FIXTURE_PHOTO_PORT.`);
  const photoPid = startPhotos();
  console.log(`fixture: photos on ${PHOTO_ORIGIN}`);
  if (!(await portIsFree(STRIPE_PORT))) throw new Error(`:${STRIPE_PORT} is in use. Stop it or set FIXTURE_STRIPE_PORT.`);
  const stripePid = startStripe();
  console.log(`fixture: Stripe stand-in on http://127.0.0.1:${STRIPE_PORT}`);

  const creds = credentials();

  async function pass(indexing, playwrightArgs) {
    const env = appEnv(creds, indexing);
    if (process.env.FIXTURE_SKIP_BUILD === "1" && existsSync(join(repo, ".next", "BUILD_ID"))) {
      console.log("fixture: FIXTURE_SKIP_BUILD=1, reusing .next");
    } else {
      console.log(`fixture: next build (indexing ${indexing ? "ON" : "off"}) ...`);
      sh(process.execPath, [nextBin, "build"], env, "next build");
    }
    startApp(env);
    await waitForApp();
    console.log(`fixture: app on http://localhost:${APP_PORT}`);
    const pwEnv = {
      ...cleanEnv(),
      PW_PORT: String(APP_PORT),
      PW_EXTERNAL_SERVER: "1",
      PW_FIXTURE: "1",
      FIXTURE_STRIPE_PORT: String(STRIPE_PORT),
      FIXTURE_ADMIN_USERNAME: creds.username,
      FIXTURE_ADMIN_PASSWORD: creds.password,
      SEARCH_INDEXING_ENABLED: indexing ? "true" : "false",
    };
    const res = spawnSync("npx", ["playwright", "test", ...playwrightArgs], {
      cwd: repo,
      env: pwEnv,
      stdio: "inherit",
    });
    stopApp();
    await sleep(500);
    return res.status ?? 1;
  }

  if (mode === "up") {
    const env = appEnv(creds, false);
    if (process.env.FIXTURE_SKIP_BUILD !== "1") sh(process.execPath, [nextBin, "build"], env, "next build");
    const appPid = startApp(env);
    await waitForApp();
    mkdirSync(runDir, { recursive: true });
    writeFileSync(
      stateFile,
      JSON.stringify({ appPid, photoPid, stripePid, credentials: creds }, null, 2),
    );
    console.log(`fixture: up. app http://localhost:${APP_PORT}  admin http://admin.localhost:${APP_PORT}  (user ${creds.username}, password in tests/fixture/.run/state.json)`);
    process.exit(0);
  }

  const DEFAULTS = [
    "seo",
    "routes",
    "smoke",
    "error-boundary",
    "cart-send",
    "pay-states",
    "pay-stripe",
    "search",
    "admin-save",
    "listings",
    "finder-fit",
    // Filters match the whole file path, so a bare `sku` also matched every
    // spec in a checkout whose folder name holds it (`platinum-wheels-sku`).
    "e2e/sku",
    "vendor-codes",
    "--project=chromium-1440",
    // One retry, reported as "flaky" and never hidden: a 130-test run on a loaded
    // laptop has produced a single unreproduced miss (`tests/llm.md` Open).
    "--retries=1",
  ];
  const mine = passthrough.length > 0 ? passthrough : DEFAULTS;
  let status = await pass(false, mine);
  if (passthrough.length === 0 && process.env.FIXTURE_ONE_PASS !== "1") {
    console.log("\nfixture: second pass, search indexing ON (seo only) ...");
    const second = await pass(true, ["seo", "--project=chromium-1440"]);
    status = status || second;
  }
  cleanup();
  process.exit(status);
} catch (error) {
  console.error(String(error?.message ?? error));
  if (mode === "run") cleanup();
  process.exit(1);
}
