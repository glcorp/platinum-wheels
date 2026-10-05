/**
 * One-time crawl of Auto Country's public vehicle lookup (the "nero" API its
 * own storefront calls), for the vehicle finder's fit data (D155).
 *
 *   node scripts/autocountry-crawl.mjs                 # crawl 2005-2026, resume where it stopped
 *   node scripts/autocountry-crawl.mjs --probe         # five cars only, then stop
 *   node scripts/autocountry-crawl.mjs --years 2021    # a subset of years
 *   node scripts/autocountry-crawl.mjs --no-ranges     # lists and options only
 *
 * Auto Country is the shop's primary supplier and the source of truth for
 * fitment; owner, 2026-10-06: "Yes, we can use AutoPrintly because that is
 * our primary supplier and source of truth." and "go for 8 a second."
 *
 * Rules this file keeps, and why:
 *   - it is the ONLY thing that calls Auto Country: one process, one shared
 *     limit of 8 requests a second, no agent calls the lookup itself;
 *   - anonymous only: no cookie, no credential, no authorization header;
 *   - a 429 or 5xx backs off and retries; a 401, 403 or an HTML challenge
 *     page stops the whole run, because a refusal means stop, never get round;
 *   - every raw answer is saved outside the repo, and a saved answer is never
 *     asked for twice, so a stopped run resumes where it was;
 *   - stock height only: vehicle-ranges is asked at lift 0.
 *
 * Output (outside the repo, never committed):
 *   ~/Platinum Wheels Vendor Data/Individual Vendors/Auto Country/_working/nero/
 *     raw/<stage>/<segments>.json    one file per answer: { status, path, body }
 *     run-log.json                   counts, refusals, gaps; rewritten as it goes
 * `scripts/vehicle-fitment-autocountry.mjs` turns raw/ into the CSVs in
 * scripts/data/.
 */

import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const BASE = "https://autocountry.frb.io/frontend/v2/nero";
const OUT = path.join(
  os.homedir(),
  "Platinum Wheels Vendor Data/Individual Vendors/Auto Country/_working/nero",
);
const RAW = path.join(OUT, "raw");
const RATE = 8; // requests a second, shared by every call
const IN_FLIGHT = 8;
const MAX_TRIES = 6;

const args = process.argv.slice(2);
const PROBE = args.includes("--probe");
const NO_RANGES = args.includes("--no-ranges");
const yearsArg = args.includes("--years") ? args[args.indexOf("--years") + 1] : null;
const YEARS = yearsArg
  ? yearsArg.split(",").flatMap((s) => {
      const [a, b] = s.split("-").map(Number);
      return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a];
    })
  : Array.from({ length: 22 }, (_, i) => 2005 + i);

const PROBE_CARS = [
  [2021, "Honda", "Civic"],
  [2019, "Ford", "F-150"],
  [2022, "Toyota", "RAV4"],
  [2016, "BMW", "3 Series"],
  [2020, "Ram", "1500"],
];

const log = {
  started: new Date().toISOString(),
  finished: null,
  years: YEARS,
  requests: 0,
  cached: 0,
  byStage: {},
  retries: 0,
  failures: [], // { path, status, note }
  stopped: null, // set when a refusal stops the run
};

// ---- rate limit: a token every 1000/RATE ms, at most IN_FLIGHT open --------
let nextSlot = Date.now();
let open = 0;
const waiting = [];
async function slot() {
  while (open >= IN_FLIGHT) await new Promise((r) => waiting.push(r));
  open++;
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + 1000 / RATE;
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}
function release() {
  open--;
  const w = waiting.shift();
  if (w) w();
}

class Refused extends Error {}

const safe = (s) => encodeURIComponent(String(s)).replace(/%20/g, "_").replace(/\*/g, "%2A");
function fileFor(stage, segs) {
  return path.join(RAW, stage, ...segs.slice(0, -1).map(safe), `${safe(segs.at(-1))}.json`);
}

async function exists(f) {
  try {
    await access(f);
    return true;
  } catch {
    return false;
  }
}

/** GET or POST one answer, cached on disk. Returns the parsed body or null. */
async function call(stage, segs, { method = "GET", url, body } = {}) {
  const file = fileFor(stage, segs);
  if (await exists(file)) {
    log.cached++;
    const saved = JSON.parse(await readFile(file, "utf8"));
    return saved.status === 200 ? saved.body : null;
  }
  if (log.stopped) throw new Refused(log.stopped);
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    await slot();
    let res, text;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30_000),
      });
      text = await res.text();
    } catch (err) {
      release();
      log.retries++;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      if (attempt === MAX_TRIES) {
        log.failures.push({ path: url, status: 0, note: String(err?.message ?? err) });
        return null;
      }
      continue;
    }
    release();
    log.requests++;
    log.byStage[stage] = (log.byStage[stage] ?? 0) + 1;
    const type = res.headers.get("content-type") ?? "";
    if (res.status === 401 || res.status === 403 || /cf-chl|challenge-platform|captcha/i.test(text)) {
      log.stopped = `${res.status} at ${url}: refusal or challenge, run stopped`;
      await writeLog();
      throw new Refused(log.stopped);
    }
    if (res.status === 429 || res.status >= 500) {
      log.retries++;
      const wait = Number(res.headers.get("retry-after")) * 1000 || 2000 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, wait));
      if (attempt === MAX_TRIES) {
        log.failures.push({ path: url, status: res.status, note: "gave up after retries" });
        return null;
      }
      continue;
    }
    let parsed = null;
    if (type.includes("json")) {
      try {
        parsed = JSON.parse(text);
      } catch {}
    }
    if (!parsed && res.status === 200) {
      log.stopped = `non-JSON 200 at ${url}: treated as a block page, run stopped`;
      await writeLog();
      throw new Refused(log.stopped);
    }
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ status: res.status, path: url, request: body ?? null, body: parsed }));
    if (res.status !== 200) {
      log.failures.push({ path: url, status: res.status, note: parsed?.message ?? "" });
      return null;
    }
    return parsed;
  }
  return null;
}

const enc = encodeURIComponent;
const get = (stage, segs) =>
  call(stage, segs, { url: `${BASE}/${stage}/${segs.map(enc).join("/")}` });

let lastLog = 0;
async function writeLog(force = false) {
  if (!force && Date.now() - lastLog < 5000) return;
  lastLog = Date.now();
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, "run-log.json"), JSON.stringify(log, null, 1));
}

/** Run fn over items with the shared limiter doing the pacing. */
async function each(items, fn) {
  await Promise.all(items.map((it) => fn(it).catch((e) => { if (e instanceof Refused) throw e; log.failures.push({ path: String(it), status: -1, note: String(e) }); })));
}

/** One range per model-year, body and chassis: every trim on the same chassis
 *  gets the same answer (checked on the probe cars), so it is asked once. */
const ranges = new Map();
function rangeFor(year, make, model, sub, data, v, f) {
  const key = [year, make, model, v.body, f.chassisId].join("|");
  if (!ranges.has(key)) {
    ranges.set(
      key,
      call("vehicle-ranges", [year, make, model, v.body, f.chassisId], {
        method: "POST",
        url: `${BASE}/vehicle-ranges`,
        body: { id: data.id, year, make, model, sub_model: sub, body: v.body, fitment: f.id, lift: 0 },
      }),
    );
  }
  return ranges.get(key);
}

async function crawlSubmodel(year, make, model, sub) {
  const opt = await get("options", [year, make, model, sub]);
  const data = opt?.data;
  if (!data || NO_RANGES) return;
  for (const v of data.vehicles ?? []) {
    const f = (v.fitments ?? [])[0];
    if (f) await rangeFor(year, make, model, sub, data, v, f);
  }
  await writeLog();
}

async function crawlModel(year, make, model) {
  const subs = (await get("sub-model", [year, make, model]))?.data ?? [];
  if (!subs.length) log.failures.push({ path: `${year}/${make}/${model}`, status: 200, note: "no submodels" });
  await each(subs.map((s) => s.submodel), (sub) => crawlSubmodel(year, make, model, sub));
}

async function main() {
  await mkdir(RAW, { recursive: true });
  try {
    if (PROBE) {
      await each(PROBE_CARS, ([y, mk, md]) => crawlModel(y, mk, md));
    } else {
      for (const year of YEARS) {
        const makes = (await get("makes", [year]))?.data ?? [];
        await each(makes.map((m) => m.make), async (make) => {
          const models = (await get("models", [year, make]))?.data ?? [];
          await each(models.map((m) => m.model), (model) => crawlModel(year, make, model));
        });
        log.yearsDone = [...(log.yearsDone ?? []), year];
        await writeLog(true);
        console.log(`${year} done: ${log.requests} requests, ${log.cached} cached, ${log.failures.length} failures`);
      }
    }
  } catch (e) {
    if (!(e instanceof Refused)) throw e;
    console.error(e.message);
  }
  log.finished = new Date().toISOString();
  await writeLog(true);
  console.log(JSON.stringify({ requests: log.requests, cached: log.cached, byStage: log.byStage, failures: log.failures.length, stopped: log.stopped }));
}

main();
