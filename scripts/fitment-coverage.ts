/* ---------------------------------------------------------------------------
   fitment-coverage — offline coverage counter for the vehicle finder (D155).

     npx tsx scripts/fitment-coverage.ts <catalogue.csv> [--out <dir>]

   For EVERY model-year the finder offers (`vehicle-list.ts`) it counts the
   Best and Similar results the three category pages would show with that
   vehicle chosen and no other filter, straight from a catalogue CSV: no
   database, no network, no Next. Then it turns the same pass round: which
   products no vehicle ever reaches.

   What is shared with the app, and what is not:
     - SHARED: `findFitment` (the vehicle's facts), `tireFit` / `wheelFit` (the
       small filter shapes), the CSV -> specs reading (`planImport`, so a row
       becomes exactly the columns the loader would store), and the size and
       bolt-pattern normalisers.
     - NOT SHARED: the matching itself. `src/features/catalog/queries.ts`
       writes it as SQL (`vehicleFit`, `wheelVehicleBest`, `accessory
       Contradiction`, `exactSize`, `nearSize`). This file re-implements those
       rules in plain JS, independently, so a count here that disagrees with
       `searchResults` points at a bug on one side. If you change a rule in
       queries.ts, change it here too.

   The default page has no other filter, so "the results" are every
   published product of the category (the CSV has no status column, so all of
   them: the importer's default is `published`).

   Conventions:
     - A vehicle that narrows nothing (`findFitment` returns null, or the
       fit states nothing for that category) shows EVERYTHING as Best and
       nothing as Similar (D47(8)). Those vehicles are counted that way, and
       flagged `n` in the `*_narrowed` columns.
     - reverse.csv counts a product as reached only through vehicles that
       NARROW that category. Counting the others would make every product
       "reached as Best" by any vehicle with no data, which says nothing.
       Reverse coverage uses Best OR Similar.
     - SQL `NULL` -> `NaN` here: every comparison with a missing value is
       false, the way the queries' `coalesce(..., false)` makes it.

   Output (default `import-report/fitment-coverage/`, git-ignored):
     per-vehicle.csv   one row per model-year
     reverse.csv       one row per catalogue product
     summary.json      the headline numbers

   `server-only` is not installed (Next resolves it itself), and `fitment.ts`
   imports it, so it is stubbed below before that file loads.
   --------------------------------------------------------------------------- */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import Module from "node:module";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { parse } from "csv-parse/sync";

import type {
  TireVehicleFit,
  WheelVehicleFit,
} from "../src/features/catalog/catalog-types";
import { IMPORT_MAPPING } from "../src/features/catalog/import-mapping";
import { planImport, type ImportRow } from "../src/features/catalog/import-plan";
import {
  normalizeBoltPattern,
  normalizeThreadSize,
} from "../src/features/catalog/size";
import type { VehicleFitment } from "../src/features/finder/fitment";
import { yearRanges } from "../src/features/finder/years";

/* --- Stub `server-only`, then load the app's finder modules ------------------ */

type RequireFn = (this: unknown, id: string) => unknown;
const proto = Module.prototype as unknown as { require: RequireFn };
const realRequire = proto.require;
proto.require = function (this: unknown, id: string) {
  return id === "server-only" ? {} : realRequire.call(this, id);
};

/* --- Arguments --------------------------------------------------------------- */

const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: { out: { type: "string" } },
});
const csvPath = positionals[0];
if (!csvPath) {
  console.error("usage: npx tsx scripts/fitment-coverage.ts <catalogue.csv> [--out <dir>]");
  process.exit(1);
}
const outDir = resolve(flags.out ?? "import-report/fitment-coverage");

/* --- Small helpers ----------------------------------------------------------- */

/** queries.ts `measure`: finite, above 0 and below 1000, else "not given". */
function measure(value: number | null | undefined): number | undefined {
  return value !== null &&
    value !== undefined &&
    Number.isFinite(value) &&
    value > 0 &&
    value < 1000
    ? value
    : undefined;
}
/** queries.ts `signedMeasure`. */
function signedMeasure(value: number | null | undefined): number | undefined {
  return value !== null &&
    value !== undefined &&
    Number.isFinite(value) &&
    Math.abs(value) < 10_000
    ? value
    : undefined;
}
/** queries.ts `wholeNumber`. */
function wholeNumber(value: number | undefined): number | undefined {
  return value !== undefined && Number.isInteger(value) && value > 0 && value < 10_000
    ? value
    : undefined;
}
/** search.ts `numeric` for a string. */
function numeric(value: string | null | undefined): number | undefined {
  if (value === null || value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
/** search.ts `catalogueThread`. */
function catalogueThread(thread: string | null): string | undefined {
  if (thread === null) return undefined;
  const inch = /^(\d{1,2}\/\d{1,2})x\d{1,2}$/.exec(thread);
  return inch ? `${inch[1]} UNF` : thread;
}
const EPS = 1e-9;
const csvCell = (value: string | number | null | undefined): string => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const csvLine = (cells: ReadonlyArray<string | number | null | undefined>) =>
  `${cells.map(csvCell).join(",")}\n`;
const yn = (value: boolean) => (value ? "y" : "n");
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}
function tally<K extends string>(map: Map<K, number>, key: K, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}
const obj = (map: Map<string, number>) =>
  Object.fromEntries([...map].sort((a, b) => b[1] - a[1]));

/* --- The catalogue, as the importer would store it ---------------------------- */

interface ProductRef {
  /** CSV `row_id`, else the sheet row. */
  id: string;
  sheetRow: number;
  category: "tires" | "wheels" | "accessories";
  brand: string;
  model: string;
  name: string;
}

const records = parse(readFileSync(csvPath, "utf8"), {
  bom: true,
  relax_column_count: true,
}) as string[][];
const [headers, ...body] = records;
if (!headers) throw new Error("empty CSV");
const rows: ImportRow[] = [];
body.forEach((cells, index) => {
  if (cells.every((cell) => cell.trim() === "")) return;
  rows.push({ row: index + 2, cells });
});
const rowIdColumn = headers.findIndex((h) => h.trim().toLowerCase() === "row_id");
const cellsOfRow = new Map(rows.map((r) => [r.row, r.cells] as const));
const plan = planImport(headers, rows, IMPORT_MAPPING, { status: "published" });
if (plan.rejected.length > 0) {
  console.error(`note: ${plan.rejected.length} CSV rows are refused by the importer and not counted.`);
}

// Tires: parallel arrays (NaN = SQL NULL). Everything the queries' expressions derive is derived once.
const tires: ProductRef[] = [];
const tFormat: Array<"metric" | "flotation"> = [];
const tWidth: number[] = [];
const tAspect: number[] = [];
const tRim: number[] = [];
const tOverall: number[] = [];
const tSection: number[] = [];
const tOverallIn: number[] = []; // OVERALL_DIAMETER_IN
const tSectionMm: number[] = []; // SECTION_WIDTH_MM
const tSidewall: number[] = []; // SIDEWALL_MM
const tMeasRim: number[] = []; // MEASURING_RIM_IN
const tKey = new Map<string, number[]>();

interface WheelRow {
  ref: ProductRef;
  diameter: number;
  width: number;
  bolts: string[];
  offset: number;
  bore: number;
}
const wheels: WheelRow[] = [];
const wheelsByBolt = new Map<string, number[]>();

interface AccessoryRow {
  ref: ProductRef;
  type: string;
  thread: string | null;
  inner: number;
}
const accessories: AccessoryRow[] = [];

const num = (value: number | null | undefined): number =>
  value === null || value === undefined ? NaN : Number(value);

for (const product of plan.products) {
  const cells = cellsOfRow.get(product.row) ?? [];
  const input = product.input;
  const ref: ProductRef = {
    id: rowIdColumn >= 0 ? (cells[rowIdColumn] ?? "") || `row-${product.row}` : `row-${product.row}`,
    sheetRow: product.row,
    category: input.category,
    brand: input.brand ?? "",
    model: input.model ?? "",
    name: input.name,
  };
  if (input.category === "tires") {
    const s = input.specs;
    const i = tires.length;
    tires.push(ref);
    tFormat.push(s.sizeFormat);
    const width = num(s.width);
    const aspect = num(s.aspectRatio);
    const rim = num(s.rimDiameter);
    const overall = num(s.overallDiameter);
    const section = num(s.sectionWidth);
    tWidth.push(width);
    tAspect.push(aspect);
    tRim.push(rim);
    tOverall.push(overall);
    tSection.push(section);
    tOverallIn.push(
      Number.isNaN(overall) ? rim + (2 * width * aspect) / 2540 : overall,
    );
    tSectionMm.push(Number.isNaN(width) ? section * 25.4 : width);
    tSidewall.push((width * aspect) / 100);
    const ratio =
      aspect >= 70 ? 0.7 : aspect >= 60 ? 0.75 : aspect >= 50 ? 0.78 : aspect >= 40 ? 0.82 : 0.85;
    tMeasRim.push((width * ratio) / 25.4);
    const key =
      s.sizeFormat === "flotation" ? `f:${overall}:${section}:${rim}` : `m:${width}:${aspect}:${rim}`;
    const list = tKey.get(key);
    if (list) list.push(i);
    else tKey.set(key, [i]);
  } else if (input.category === "wheels") {
    const s = input.specs;
    const i = wheels.length;
    wheels.push({
      ref,
      diameter: num(s.diameter),
      width: num(s.width),
      bolts: [...s.boltPatterns],
      offset: num(s.offsetMm),
      bore: num(s.centerBoreMm),
    });
    for (const pattern of new Set(s.boltPatterns)) {
      const list = wheelsByBolt.get(pattern);
      if (list) list.push(i);
      else wheelsByBolt.set(pattern, [i]);
    }
  } else {
    const s = input.specs;
    accessories.push({
      ref,
      type: s.accessoryType,
      thread: s.threadSize,
      inner: num(s.innerDiameterMm),
    });
  }
}

/* --- Tires: the SQL rules in JS ------------------------------------------------ */

/** queries.ts FIT_*: kept in step by hand. */
const FIT_WIDTH = { best: 0.75, near: 1.25 } as const;
const FIT_RIM = { down: 1, up: 2 } as const;
const FIT_DIAMETER_SLACK = 0.5;
const BORE_TOLERANCE = 0.15;

const tireStamp = new Int32Array(tires.length);
let tireStampId = 0;

interface TireOutcome {
  best: number;
  similar: number;
  bestIdx: number[];
  similarIdx: number[];
  /** More factory sizes than the SQL reads (it takes the first 12 / 6). */
  truncated: boolean;
}

/** rimRule(): `null` when it can match nothing. */
/* Mirrors queries.ts: the caps on sizes and wheels one query carries. */
const MAX_FACTORY_SIZES = 48;
const MAX_FLOTATION_SIZES = 16;
const MAX_FACTORY_RIMS = 32;

function rimRulePredicate(
  fit: TireVehicleFit,
  kind: "best" | "near",
): ((i: number) => boolean) | null {
  const min = measure(fit.sidewallMinMm);
  const max = measure(fit.sidewallMaxMm);
  const rims: Array<[number, number]> = [];
  for (const rim of fit.rims.slice(0, MAX_FACTORY_RIMS)) {
    const d = measure(rim.diameter);
    const w = measure(rim.width);
    if (d === undefined || w === undefined) continue;
    rims.push([d, w]);
  }
  if (min === undefined || max === undefined || rims.length === 0) return null;
  return (i) => {
    const sidewall = tSidewall[i]!;
    if (!(sidewall >= min && sidewall <= max)) return false;
    const rim = tRim[i]!;
    const meas = tMeasRim[i]!;
    for (const [d, w] of rims) {
      const diameterOk =
        kind === "best"
          ? Math.abs(rim - d) < EPS
          : rim >= d - FIT_RIM.down - EPS && rim <= d + FIT_RIM.up + EPS;
      if (diameterOk && Math.abs(meas - w) <= FIT_WIDTH[kind] + EPS) return true;
    }
    return false;
  };
}

/** The best tires: indices. */
function tireBestIndices(fit: TireVehicleFit): number[] {
  const hasSizes = fit.sizes.length > 0 || fit.flotation.length > 0;
  const out: number[] = [];
  if (hasSizes) {
    const keys = new Set<string>();
    for (const size of fit.sizes.slice(0, MAX_FACTORY_SIZES)) {
      const width = wholeNumber(size.width);
      const profile = wholeNumber(size.profile);
      const rim = measure(size.rim);
      if (width === undefined || profile === undefined || rim === undefined) continue;
      keys.add(`m:${width}:${profile}:${rim}`);
    }
    for (const size of fit.flotation.slice(0, MAX_FLOTATION_SIZES)) {
      const diameter = measure(size.diameter);
      const section = measure(size.section);
      const rim = measure(size.rim);
      if (diameter === undefined || section === undefined || rim === undefined) continue;
      keys.add(`f:${diameter}:${section}:${rim}`);
    }
    for (const key of keys) {
      const list = tKey.get(key);
      if (list) out.push(...list);
    }
    return out;
  }
  const predicate = rimRulePredicate(fit, "best");
  if (predicate === null) return out;
  for (let i = 0; i < tires.length; i += 1) if (predicate(i)) out.push(i);
  return out;
}

function evalTires(fit: TireVehicleFit): TireOutcome {
  tireStampId += 1;
  const bestIdx = tireBestIndices(fit);
  for (const i of bestIdx) tireStamp[i] = tireStampId;
  const hasSizes = fit.sizes.length > 0 || fit.flotation.length > 0;
  const similarIdx: number[] = [];
  let near: ((i: number) => boolean) | null;
  if (hasSizes && fit.range !== null) {
    const r = fit.range;
    const dMin = measure(r.diameterMin);
    const dMax = measure(r.diameterMax);
    const wMin = measure(r.widthMin);
    const wMax = measure(r.widthMax);
    if (dMin === undefined || dMax === undefined || wMin === undefined || wMax === undefined) {
      near = null;
    } else {
      const rMin = measure(r.rimMin ?? undefined);
      const rMax = measure(r.rimMax ?? undefined);
      const lo = dMin - FIT_DIAMETER_SLACK;
      const hi = dMax + FIT_DIAMETER_SLACK;
      near = (i) => {
        const d = tOverallIn[i]!;
        const w = tSectionMm[i]!;
        if (!(d >= lo && d <= hi && w >= wMin && w <= wMax)) return false;
        if (rMin !== undefined && rMax !== undefined) {
          const rim = tRim[i]!;
          if (!(rim >= rMin && rim <= rMax)) return false;
        }
        return true;
      };
    }
  } else {
    near = rimRulePredicate(fit, "near");
  }
  if (near !== null) {
    for (let i = 0; i < tires.length; i += 1) {
      if (tireStamp[i] !== tireStampId && near(i)) similarIdx.push(i);
    }
  }
  return {
    best: bestIdx.length,
    similar: similarIdx.length,
    bestIdx,
    similarIdx,
    truncated: fit.sizes.length > MAX_FACTORY_SIZES || fit.flotation.length > MAX_FLOTATION_SIZES || fit.rims.length > MAX_FACTORY_RIMS,
  };
}

/* --- Wheels --------------------------------------------------------------------- */

const wheelStamp = new Int32Array(wheels.length);
let wheelStampId = 0;

interface WheelOutcome {
  best: number;
  similar: number;
  bestIdx: number[];
  similarIdx: number[];
  /** The normalised patterns the fit asked for (empty: it narrows nothing). */
  patterns: string[];
}

function evalWheels(fit: WheelVehicleFit): WheelOutcome {
  const patterns: string[] = [];
  for (const raw of fit.boltPatterns.slice(0, 6)) {
    const pattern = normalizeBoltPattern(raw);
    if (pattern !== null && !patterns.includes(pattern)) patterns.push(pattern);
  }
  if (patterns.length === 0) {
    // wheelBolt() null: every wheel is best, nothing is similar.
    return {
      best: wheels.length,
      similar: 0,
      bestIdx: wheels.map((_, i) => i),
      similarIdx: [],
      patterns,
    };
  }
  wheelStampId += 1;
  const candidates: number[] = [];
  for (const pattern of patterns) {
    for (const i of wheelsByBolt.get(pattern) ?? []) {
      if (wheelStamp[i] !== wheelStampId) {
        wheelStamp[i] = wheelStampId;
        candidates.push(i);
      }
    }
  }
  const range = fit.range;
  let rangeBroken = false;
  let dMin = 0;
  let dMax = 0;
  let wMin = 0;
  let wMax = 0;
  let oMin: number | undefined;
  let oMax: number | undefined;
  if (range !== null) {
    const a = measure(range.diameterMin);
    const b = measure(range.diameterMax);
    const c = measure(range.widthMin);
    const d = measure(range.widthMax);
    if (a === undefined || b === undefined || c === undefined || d === undefined) {
      rangeBroken = true;
    } else {
      [dMin, dMax, wMin, wMax] = [a, b, c, d];
    }
    oMin = signedMeasure(range.offsetMin);
    oMax = signedMeasure(range.offsetMax);
  }
  const bore = measure(fit.hubBore);
  const bestIdx: number[] = [];
  const similarIdx: number[] = [];
  for (const i of candidates) {
    const w = wheels[i]!;
    let best = !rangeBroken;
    if (best && range !== null) {
      best =
        w.diameter >= dMin &&
        w.diameter <= dMax &&
        w.width >= wMin &&
        w.width <= wMax;
      if (best && oMin !== undefined && oMax !== undefined) {
        best = Number.isNaN(w.offset) || (w.offset >= oMin && w.offset <= oMax);
      }
    }
    if (best && bore !== undefined) {
      // coalesce(center_bore >= bore - tolerance, range === null)
      best = Number.isNaN(w.bore) ? range === null : w.bore >= bore - BORE_TOLERANCE;
    }
    (best ? bestIdx : similarIdx).push(i);
  }
  return { best: bestIdx.length, similar: similarIdx.length, bestIdx, similarIdx, patterns };
}

/* --- Accessories ------------------------------------------------------------------ */

const LUG_TYPES = new Set(["lug_nuts", "lug_bolts", "wheel_locks"]);
const lugKinds = (type: string) => LUG_TYPES.has(type);

interface AccessoryProfile {
  /** The thread as the catalogue spells it, or undefined. */
  thread: string | undefined;
  fastener: "nut" | "bolt" | undefined;
  bore: number | undefined;
}

/** accessoryContradiction() for one product against a profile; false when the
 *  profile has no fact an accessory could contradict. */
function contradicts(a: AccessoryRow, p: AccessoryProfile): boolean {
  if (p.thread !== undefined && p.thread.trim() !== "") {
    if (lugKinds(a.type) && a.thread !== null && a.thread !== normalizeThreadSize(p.thread.trim())) {
      return true;
    }
  }
  if (p.fastener === "nut" || p.fastener === "bolt") {
    const wrong = p.fastener === "bolt" ? "lug_nuts" : "lug_bolts";
    if (a.type === wrong) return true;
  }
  if (p.bore !== undefined) {
    if (a.type === "hub_rings" && !Number.isNaN(a.inner) && Math.abs(a.inner - p.bore) > BORE_TOLERANCE) {
      return true;
    }
  }
  return false;
}

const profileHasParts = (p: AccessoryProfile) =>
  (p.thread !== undefined && p.thread.trim() !== "") ||
  p.fastener === "nut" ||
  p.fastener === "bolt" ||
  p.bore !== undefined;

// Accessories grouped by what the rules read, so a profile costs a few hundred checks.
interface AccessoryGroup {
  type: string;
  thread: string | null;
  inner: number;
  members: number[];
}
const groups = new Map<string, AccessoryGroup>();
accessories.forEach((a, i) => {
  const key = `${a.type}|${a.thread ?? ""}|${Number.isNaN(a.inner) ? "" : a.inner}`;
  const group = groups.get(key);
  if (group) group.members.push(i);
  else groups.set(key, { type: a.type, thread: a.thread, inner: a.inner, members: [i] });
});
const groupRows: AccessoryRow[] = [...groups.values()].map((g) => ({
  ref: accessories[g.members[0]!]!.ref,
  type: g.type,
  thread: g.thread,
  inner: g.inner,
}));
const groupList = [...groups.values()];

interface AccessoryOutcome {
  best: number;
  similar: number;
  lugBest: number;
  lugSimilar: number;
  ringBest: number;
  ringSimilar: number;
}
function evalAccessories(p: AccessoryProfile): AccessoryOutcome {
  const out: AccessoryOutcome = { best: 0, similar: 0, lugBest: 0, lugSimilar: 0, ringBest: 0, ringSimilar: 0 };
  groupList.forEach((g, gi) => {
    const n = g.members.length;
    const bad = contradicts(groupRows[gi]!, p);
    if (bad) out.similar += n;
    else out.best += n;
    if (lugKinds(g.type)) {
      if (bad) out.lugSimilar += n;
      else out.lugBest += n;
    }
    if (g.type === "hub_rings") {
      if (bad) out.ringSimilar += n;
      else out.ringBest += n;
    }
  });
  return out;
}

/* --- Walk every model-year ---------------------------------------------------------- */

interface VehicleRow {
  make: string;
  model: string;
  year: number;
  fit: VehicleFitment | null;
}

async function main(): Promise<void> {
  const started = Date.now();
  const { findFitment } = (await import("../src/features/finder/fitment")) as typeof import("../src/features/finder/fitment");
  const { tireFit, wheelFit } = (await import("../src/features/finder/tire-fit")) as typeof import("../src/features/finder/tire-fit");
  const { VEHICLE_LIST } = (await import("../src/features/finder/vehicle-list")) as typeof import("../src/features/finder/vehicle-list");

  const vehicles: VehicleRow[] = [];
  for (const [make, models] of VEHICLE_LIST) {
    for (const [model, years] of models) {
      for (const [from, to] of yearRanges(years)) {
        for (let year = from; year <= to; year += 1) {
          vehicles.push({ make, model, year, fit: findFitment(String(year), make, model) });
        }
      }
    }
  }

  // Reverse-coverage state: flags set only through vehicles that narrow that category.
  const tireBestHit = new Uint8Array(tires.length);
  const tireSimHit = new Uint8Array(tires.length);
  const wheelBestHit = new Uint8Array(wheels.length);
  const wheelSimHit = new Uint8Array(wheels.length);

  const tireCache = new Map<string, TireOutcome | null>();
  const wheelCache = new Map<string, WheelOutcome | null>();
  const accCache = new Map<string, AccessoryOutcome>();
  const distinctTireFits: TireVehicleFit[] = [];
  const distinctWheelFits: Array<{ fit: WheelVehicleFit; out: WheelOutcome }> = [];
  const distinctProfiles = new Map<string, AccessoryProfile>();

  const perVehicle: string[] = [
    csvLine([
      "make", "model", "year",
      "bolts", "bore", "thread", "fastener",
      "tire_sizes_n", "tire_range", "wheel_range", "rims_n",
      "year_source", "bolt_source",
      "tires_narrowed", "wheels_narrowed", "acc_narrowed", "tire_sizes_truncated",
      "tires_best", "tires_similar", "wheels_best", "wheels_similar",
      "lug_best", "lug_similar", "hubring_best", "hubring_similar",
      "acc_best", "acc_similar",
    ]),
  ];

  // Summary accumulators.
  const total = vehicles.length;
  let noFit = 0;
  const has = { bolts: 0, bore: 0, thread: 0, fastener: 0, tire_sizes: 0, tire_range: 0, wheel_range: 0, rims: 0 };
  const byYearSource = new Map<string, number>();
  const byBoltSource = new Map<string, number>();
  const bestTires: number[] = [];
  const bestWheels: number[] = [];
  let tiresNarrowed = 0;
  let wheelsNarrowed = 0;
  let accNarrowed = 0;
  let zeroTiresBest = 0;
  let zeroTiresBestNarrowed = 0;
  let zeroWheelsAll = 0;
  let zeroWheelsAllNarrowed = 0;
  let zeroWheelsBestNarrowed = 0;
  let zeroLugBest = 0;
  let zeroLugBestNarrowed = 0;
  let zeroLugAll = 0;
  let truncatedVehicles = 0;

  for (const v of vehicles) {
    const fit = v.fit;
    const tf = tireFit(fit);
    const wf = wheelFit(fit);

    // Tires.
    let tOut: TireOutcome | null = null;
    if (tf !== null) {
      const key = JSON.stringify(tf);
      if (!tireCache.has(key)) {
        const out = evalTires(tf);
        tireCache.set(key, out);
        distinctTireFits.push(tf);
        for (const i of out.bestIdx) tireBestHit[i] = 1;
        for (const i of out.similarIdx) tireSimHit[i] = 1;
      }
      tOut = tireCache.get(key)!;
    }
    const tiresBest = tOut ? tOut.best : tires.length;
    const tiresSimilar = tOut ? tOut.similar : 0;

    // Wheels.
    let wOut: WheelOutcome | null = null;
    if (wf !== null) {
      const key = JSON.stringify(wf);
      if (!wheelCache.has(key)) {
        const out = evalWheels(wf);
        wheelCache.set(key, out);
        if (out.patterns.length > 0) {
          distinctWheelFits.push({ fit: wf, out });
          for (const i of out.bestIdx) wheelBestHit[i] = 1;
          for (const i of out.similarIdx) wheelSimHit[i] = 1;
        }
      }
      wOut = wheelCache.get(key)!;
      // A fit whose patterns all fail to normalise narrows nothing.
      if (wOut.patterns.length === 0) wOut = null;
    }
    const wheelsBest = wOut ? wOut.best : wheels.length;
    const wheelsSimilar = wOut ? wOut.similar : 0;

    // Accessories (search.ts: thread / fastener / hub bore from the fit).
    const profile: AccessoryProfile = {
      thread: catalogueThread(fit?.thread ?? null),
      fastener: fit?.fastener ?? undefined,
      bore: measure(numeric(fit?.centreBore)),
    };
    const accNarrows =
      (fit?.thread ?? null) !== null ||
      (fit?.fastener ?? null) !== null ||
      (fit?.centreBore ?? null) !== null;
    const parts = profileHasParts(profile);
    const accKey = parts ? JSON.stringify(profile) : "none";
    if (!accCache.has(accKey)) {
      accCache.set(
        accKey,
        parts
          ? evalAccessories(profile)
          : {
              best: accessories.length,
              similar: 0,
              lugBest: accessories.filter((a) => lugKinds(a.type)).length,
              lugSimilar: 0,
              ringBest: accessories.filter((a) => a.type === "hub_rings").length,
              ringSimilar: 0,
            },
      );
      if (parts) distinctProfiles.set(accKey, profile);
    }
    const acc = accCache.get(accKey)!;
    // Narrowed = the page actually asks for a similar row AND a contradiction exists.
    const accIsNarrowed = accNarrows && parts;

    // Per-vehicle row.
    const tireSizes = (fit?.tireSizes.length ?? 0) + (fit?.flotationSizes.length ?? 0);
    const truncated = tOut?.truncated ?? false;
    if (truncated) truncatedVehicles += 1;
    perVehicle.push(
      csvLine([
        v.make, v.model, v.year,
        fit?.boltPatterns.join("/") ?? "",
        fit?.centreBore ?? "",
        fit?.thread ?? "",
        fit?.fastener ?? "",
        tireSizes,
        yn(fit?.tireRange != null),
        yn(fit?.wheelRange != null),
        fit?.rims.length ?? 0,
        fit ? fit.yearSource : "none",
        fit?.boltSource ?? "",
        yn(tOut !== null),
        yn(wOut !== null),
        yn(accIsNarrowed),
        yn(truncated),
        tiresBest, tiresSimilar, wheelsBest, wheelsSimilar,
        acc.lugBest, acc.lugSimilar, acc.ringBest, acc.ringSimilar,
        acc.best, acc.similar,
      ]),
    );

    // Summary.
    if (fit === null) noFit += 1;
    else {
      if (fit.boltPatterns.length > 0) has.bolts += 1;
      if (fit.centreBore !== null) has.bore += 1;
      if (fit.thread !== null) has.thread += 1;
      if (fit.fastener !== null) has.fastener += 1;
      if (tireSizes > 0) has.tire_sizes += 1;
      if (fit.tireRange !== null) has.tire_range += 1;
      if (fit.wheelRange !== null) has.wheel_range += 1;
      if (fit.rims.length > 0) has.rims += 1;
    }
    tally(byYearSource, fit ? fit.yearSource : "none");
    tally(byBoltSource, fit ? (fit.boltSource ?? "none") : "none");
    if (tOut) { tiresNarrowed += 1; bestTires.push(tiresBest); }
    if (wOut) { wheelsNarrowed += 1; bestWheels.push(wheelsBest); }
    if (accIsNarrowed) accNarrowed += 1;
    if (tiresBest === 0) { zeroTiresBest += 1; if (tOut) zeroTiresBestNarrowed += 1; }
    if (wheelsBest + wheelsSimilar === 0) { zeroWheelsAll += 1; if (wOut) zeroWheelsAllNarrowed += 1; }
    if (wOut && wheelsBest === 0) zeroWheelsBestNarrowed += 1;
    if (acc.lugBest === 0) { zeroLugBest += 1; if (accIsNarrowed) zeroLugBestNarrowed += 1; }
    if (acc.lugBest + acc.lugSimilar === 0) zeroLugAll += 1;
  }

  /* --- Reverse coverage ----------------------------------------------------------- */

  // Facts about what any car reaches, for the reason buckets.
  const carRims = new Set<number>();
  let envDMin = Infinity;
  let envDMax = -Infinity;
  let envWMin = Infinity;
  let envWMax = -Infinity;
  for (const f of distinctTireFits) {
    for (const s of f.sizes) carRims.add(s.rim);
    for (const s of f.flotation) carRims.add(s.rim);
    for (const r of f.rims) for (let d = r.diameter - 1; d <= r.diameter + 2; d += 1) carRims.add(d);
    if (f.range !== null) {
      envDMin = Math.min(envDMin, f.range.diameterMin - FIT_DIAMETER_SLACK);
      envDMax = Math.max(envDMax, f.range.diameterMax + FIT_DIAMETER_SLACK);
      envWMin = Math.min(envWMin, f.range.widthMin);
      envWMax = Math.max(envWMax, f.range.widthMax);
      if (f.range.rimMin !== null && f.range.rimMax !== null) {
        for (let d = Math.ceil(f.range.rimMin); d <= f.range.rimMax; d += 1) carRims.add(d);
      }
    }
  }
  const carPatterns = new Set<string>();
  const envByPattern = new Map<string, Array<{ dMin: number; dMax: number; ranged: boolean }>>();
  for (const { fit, out } of distinctWheelFits) {
    for (const pattern of out.patterns) {
      carPatterns.add(pattern);
      const list = envByPattern.get(pattern) ?? [];
      list.push({
        dMin: fit.range?.diameterMin ?? NaN,
        dMax: fit.range?.diameterMax ?? NaN,
        ranged: fit.range !== null,
      });
      envByPattern.set(pattern, list);
    }
  }
  const profileList = [...distinctProfiles.values()];

  type Status = "best" | "similar_only" | "none";
  const reverse: string[] = [
    csvLine(["category", "id", "sheet_row", "brand", "model", "name", "size", "reached", "reason"]),
  ];
  const reasonTally = {
    tires: new Map<string, number>(),
    wheels: new Map<string, number>(),
    accessories: new Map<string, number>(),
  };
  const statusTally = {
    tires: new Map<string, number>(),
    wheels: new Map<string, number>(),
    accessories: new Map<string, number>(),
  };
  const unreachedPatterns = new Map<string, number>();
  const row = (ref: ProductRef, size: string, status: Status, reason: string) => {
    reverse.push(csvLine([ref.category, ref.id, ref.sheetRow, ref.brand, ref.model, ref.name, size, status, reason]));
    tally(statusTally[ref.category], status);
    if (status !== "best" || reason !== "") tally(reasonTally[ref.category], `${status}:${reason}`);
  };

  // Tires.
  tires.forEach((ref, i) => {
    const size =
      tFormat[i] === "flotation"
        ? `${tOverall[i]}x${tSection[i]}R${tRim[i]}`
        : Number.isNaN(tAspect[i]!)
          ? `${tWidth[i]}R${tRim[i]}`
          : `${tWidth[i]}/${tAspect[i]}R${tRim[i]}`;
    const status: Status = tireBestHit[i] ? "best" : tireSimHit[i] ? "similar_only" : "none";
    let reason = "";
    if (status === "similar_only") reason = "never_a_factory_size";
    if (status === "none") {
      const rim = tRim[i]!;
      if (tFormat[i] === "metric" && Number.isNaN(tAspect[i]!)) reason = "no_aspect_ratio_cannot_compare";
      else if (tFormat[i] === "flotation") {
        reason = tOverall[i]! >= 33 ? "flotation_offroad_ge33in" : "flotation_other";
      } else if (!carRims.has(rim)) reason = `rim_${rim}_not_on_any_car`;
      else if (tOverallIn[i]! >= 33) reason = "offroad_overall_ge33in";
      else if (tAspect[i]! <= 30) reason = "very_low_profile_le30";
      else if (tOverallIn[i]! < envDMin || tOverallIn[i]! > envDMax) reason = "overall_diameter_outside_every_envelope";
      else if (tSectionMm[i]! < envWMin || tSectionMm[i]! > envWMax) reason = "section_width_outside_every_envelope";
      else reason = "other_inside_global_ranges_but_no_car";
    }
    row(ref, size, status, reason);
  });

  // Wheels.
  wheels.forEach((w, i) => {
    const size = `${w.diameter}x${w.width} ${w.bolts.join("/") || "undrilled"} ET${Number.isNaN(w.offset) ? "?" : w.offset}`;
    const status: Status = wheelBestHit[i] ? "best" : wheelSimHit[i] ? "similar_only" : "none";
    let reason = "";
    if (status === "none") {
      if (w.bolts.length === 0) reason = "undrilled_blank";
      else if (!w.bolts.some((p) => carPatterns.has(p))) {
        reason = `bolt_pattern_no_car:${w.bolts.join("/")}`;
        for (const p of w.bolts) tally(unreachedPatterns, p);
      } else reason = "other";
    } else if (status === "similar_only") {
      const envs = w.bolts.flatMap((p) => envByPattern.get(p) ?? []);
      const ranged = envs.filter((e) => e.ranged);
      if (ranged.length === 0) reason = "no_envelope_for_pattern_bore_unstated_or_too_small";
      else if (!ranged.some((e) => w.diameter >= e.dMin && w.diameter <= e.dMax)) reason = "diameter_outside_every_range_with_that_pattern";
      else reason = "width_offset_or_bore_outside";
    }
    row(w.ref, size, status, reason);
  });

  // Accessories: evaluated against every distinct narrowing profile. A vehicle that
  // narrows nothing shows every accessory as Best, so only narrowing profiles count here.
  const narrowedBest = new Map<string, boolean>();
  const narrowedAny = new Map<string, boolean>();
  groupList.forEach((g, gi) => {
    const rep = groupRows[gi]!;
    let b = false;
    let s = false;
    for (const p of profileList) {
      if (contradicts(rep, p)) s = true;
      else b = true;
    }
    const key = `${g.type}|${g.thread ?? ""}|${Number.isNaN(g.inner) ? "" : g.inner}`;
    narrowedBest.set(key, b);
    narrowedAny.set(key, b || s);
  });
  const carThreads = new Set(profileList.map((p) => p.thread).filter((t): t is string => t !== undefined).map((t) => normalizeThreadSize(t.trim())));
  const carBores = profileList.map((p) => p.bore).filter((b): b is number => b !== undefined);
  accessories.forEach((a) => {
    const key = `${a.type}|${a.thread ?? ""}|${Number.isNaN(a.inner) ? "" : a.inner}`;
    const reachedBestNarrowed = narrowedBest.get(key)!;
    const reachedAnyNarrowed = narrowedAny.get(key)!;
    // Narrowing vehicles only (the others show every accessory as Best).
    const status: Status = reachedBestNarrowed ? "best" : reachedAnyNarrowed ? "similar_only" : "none";
    let reason = "";
    if (status === "best") {
      // Reached as Best through some narrowing profile; say when only through
      // profiles that do not state the fact this product states.
      if (lugKinds(a.type) && a.thread !== null) {
        if (!carThreads.has(a.thread)) reason = `thread_no_car:${a.thread}`;
      } else if (a.type === "hub_rings" && !Number.isNaN(a.inner)) {
        if (!carBores.some((b) => Math.abs(b - a.inner) <= BORE_TOLERANCE)) {
          reason = `hub_ring_inner_${a.inner}_no_car`;
        }
      } else if (lugKinds(a.type)) {
        reason = "lug_hardware_states_no_thread";
      } else {
        reason = "universal_states_nothing";
      }
    } else if (status === "similar_only") {
      if (lugKinds(a.type) && a.thread !== null && !carThreads.has(a.thread)) reason = `thread_no_car:${a.thread}`;
      else if (a.type === "hub_rings" && !Number.isNaN(a.inner) && !carBores.some((b) => Math.abs(b - a.inner) <= BORE_TOLERANCE)) {
        reason = `hub_ring_inner_${a.inner}_no_car`;
      } else reason = "contradicts_every_narrowing_vehicle";
    } else reason = "no_narrowing_vehicle_reaches_it";
    const size = [a.type, a.thread ?? "", Number.isNaN(a.inner) ? "" : `inner ${a.inner}`].filter(Boolean).join(" ");
    row(a.ref, size, status, reason);
  });

  /* --- Write -------------------------------------------------------------------- */

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "per-vehicle.csv"), perVehicle.join(""));
  writeFileSync(join(outDir, "reverse.csv"), reverse.join(""));

  const pct = (n: number) => Math.round((n / total) * 1000) / 10;
  const withFit = total - noFit;
  const topPatterns = Object.fromEntries([...unreachedPatterns].sort((a, b) => b[1] - a[1]).slice(0, 25));
  const summary = {
    catalogue: {
      csv: resolve(csvPath),
      products: tires.length + wheels.length + accessories.length,
      tires: tires.length,
      wheels: wheels.length,
      accessories: accessories.length,
      refused_by_importer: plan.rejected.length,
    },
    model_years: {
      total,
      with_any_fit: withFit,
      no_fit_at_all: noFit,
      share_with_fact_pct: {
        bolt_patterns: pct(has.bolts),
        centre_bore: pct(has.bore),
        lug_thread: pct(has.thread),
        fastener: pct(has.fastener),
        factory_tire_sizes: pct(has.tire_sizes),
        tire_range: pct(has.tire_range),
        wheel_range: pct(has.wheel_range),
        factory_wheel_sizes: pct(has.rims),
      },
      counts_with_fact: has,
      by_year_source: obj(byYearSource),
      by_bolt_source: obj(byBoltSource),
      narrowed: {
        tires: tiresNarrowed,
        wheels: wheelsNarrowed,
        accessories: accNarrowed,
        note: "a model-year that narrows nothing shows every product of the category as Best",
      },
      tire_sizes_truncated_by_sql_cap: truncatedVehicles,
    },
    zeros: {
      tires_best_zero_all_model_years: zeroTiresBest,
      tires_best_zero_narrowed_model_years: zeroTiresBestNarrowed,
      wheels_best_plus_similar_zero_all: zeroWheelsAll,
      wheels_best_plus_similar_zero_narrowed: zeroWheelsAllNarrowed,
      wheels_best_zero_narrowed: zeroWheelsBestNarrowed,
      lug_hardware_best_zero_all: zeroLugBest,
      lug_hardware_best_zero_narrowed: zeroLugBestNarrowed,
      lug_hardware_best_plus_similar_zero: zeroLugAll,
    },
    best_counts_narrowed_model_years: {
      tires: { min: Math.min(...bestTires), median: median(bestTires), max: Math.max(...bestTires) },
      wheels: { min: Math.min(...bestWheels), median: median(bestWheels), max: Math.max(...bestWheels) },
    },
    products_reached: {
      note: "through narrowing model-years only; reached = Best or Similar",
      tires: { by_status: obj(statusTally.tires), non_best_reasons: obj(reasonTally.tires) },
      wheels: {
        by_status: obj(statusTally.wheels),
        non_best_reasons: obj(reasonTally.wheels),
        unreached_bolt_patterns_top25: topPatterns,
      },
      accessories: { by_status: obj(statusTally.accessories), non_best_reasons: obj(reasonTally.accessories) },
    },
    distinct_fits_evaluated: {
      tire: tireCache.size,
      wheel: wheelCache.size,
      accessory_profiles: accCache.size,
    },
    seconds: Math.round((Date.now() - started) / 100) / 10,
  };
  writeFileSync(join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nWrote ${outDir}/{per-vehicle.csv,reverse.csv,summary.json}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
