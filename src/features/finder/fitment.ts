import "server-only";

import {
  VEHICLE_ALIASES,
  VEHICLE_FITMENT_DATA,
  VEHICLE_FITMENT_GENERATIONS,
  VEHICLE_SPECS,
  VEHICLE_THREADS,
  VEHICLE_TYPES,
  VEHICLE_WHEEL_SIZES,
} from "./vehicle-fitment-data";

/**
 * Vehicle -> fitment, for the best/similar split on the three results pages.
 * Server only (`results/search.ts`): the real data is large and no island
 * needs it.
 *
 * Every field is real data or absent; nothing is a placeholder (the D48(4)
 * map is gone, owner 2026-10-06).
 *
 * **Sources, per field (D155; owner, 2026-10-06: "priority is vendor then
 * factory").** For one make + model + year each fact takes the first of:
 *
 * 1. `VEHICLE_SPECS` for that exact year, the generated table the Auto
 *    Country lookup leads (`scripts/vehicle-fitment.mjs`; the generator keeps
 *    Auto Country ahead of every other source inside a row);
 * 2. the older sheets for that exact year: the ANKUSI wheel dataset
 *    (`VEHICLE_FITMENT_DATA`), the hand-kept generation rows
 *    (`VEHICLE_FITMENT_GENERATIONS`; a range marked `?` claims nothing),
 *    `VEHICLE_THREADS` and `VEHICLE_WHEEL_SIZES`;
 * 3. the **nearest real year** of the same model across both (D149: equidistant
 *    takes the later year, no distance cap, owner 2026-10-05: "Use the
 *    nearest real year"), marked `yearSource: "nearest"`;
 * 4. nothing.
 *
 * Step 3 runs per **group** of facts, so a year with a bolt pattern and no
 * tire sizes still gets its tires from the nearest year that states them:
 * mount (bolt patterns, bore, offset), lug (thread, fastener), wheels
 * (factory wheel sizes, wheel range) and tires (factory tire sizes, tire
 * range). A year inside a `?` generation range borrows nothing at all (a `?`
 * says two cars share the name, so a neighbour's facts would be the wrong
 * car's). A fact already stated for the exact year is never replaced by a
 * borrowed one.
 *
 * **Old model names** (`VEHICLE_ALIASES`) resolve to the canonical car before
 * any lookup, so a bookmarked URL keeps working.
 */

export type BodyClass = "car" | "mpv" | "truck";

export interface VehicleRim {
  /** Inches, whole. */
  diameter: number;
  /** Inches (`7`, `8.5`). */
  width: number;
  /** `specs`: the generated table. `exact`: ANKUSI's row for the year.
   *  `range`: borrowed from the nearest exact year inside the same generation
   *  range. `sheet`: the hand-kept factory wheel sizes. */
  source: "specs" | "exact" | "range" | "sheet";
}

/** A factory metric tire size (`215/55R16`). */
export interface FactoryTire {
  /** Section width, mm. */
  width: number;
  /** Aspect ratio. */
  profile: number;
  /** Rim diameter, inches. */
  rim: number;
}

/** A factory flotation size (`33x12.50R15`): overall diameter and section
 *  width are inches. */
export interface FactoryFlotationTire {
  diameter: number;
  section: number;
  rim: number;
}

/** The stock tire envelope: overall diameter in inches, section width in mm.
 *  A bound of 0 means the source states none on that side (unbounded). */
export interface TireRange {
  diameterMin: number;
  diameterMax: number;
  widthMin: number;
  widthMax: number;
}

/** The stock wheel envelope: diameter and width in inches, offset in mm. A
 *  diameter or width bound of 0 means the source states none on that side
 *  (unbounded); an offset bound is `null` when none is stated, because 0 mm is
 *  a real offset. */
export interface WheelRange {
  diameterMin: number;
  diameterMax: number;
  widthMin: number;
  widthMax: number;
  offsetMin: number | null;
  offsetMax: number | null;
}

/** Where the bolt pattern came from. `autocountry`, `vendor`, `maker`, `web`
 *  and `sheet` are the generated table's `src` letters; `ankusi` and
 *  `generation` are the older sheets. */
export type BoltSource =
  | "autocountry"
  | "vendor"
  | "maker"
  | "web"
  | "sheet"
  | "ankusi"
  | "generation";

export interface VehicleFitment {
  /** ASCII `5x114.3`, as `WheelSpec.bolt` spells it. Empty = unknown; two or
   *  more = the model year came with more than one (trims differ). */
  boltPatterns: readonly string[];
  /** Hub bore in mm (`64.1`), real data only. */
  centreBore: string | null;
  /** Where `boltPatterns` came from; `null` when there are none. */
  boltSource: BoltSource | null;
  /** Factory offset in mm. */
  offset: number | null;
  /** Factory metric tire sizes, the union across trims. */
  tireSizes: readonly FactoryTire[];
  /** Factory flotation sizes (some older trucks). */
  flotationSizes: readonly FactoryFlotationTire[];
  /** The stock tire envelope, `null` when no source states it. */
  tireRange: TireRange | null;
  /** Every factory wheel size known for the year (generated table, else the
   *  union of the hand-kept sheet and ANKUSI's one). */
  rims: readonly VehicleRim[];
  /** The stock wheel envelope, `null` when no source states it. */
  wheelRange: WheelRange | null;
  /** vPIC's body classes for the model; sets the tire height band. */
  classes: readonly BodyClass[];
  /** Lug thread, ASCII `12x1.5`, for the year; `null` = not researched. */
  thread: string | null;
  /** `nut` (stud and nut) or `bolt` (hub bolt), with `thread`. */
  fastener: "nut" | "bolt" | null;
  /** `exact` when every fact is from the year asked for; `nearest` when any
   *  group was borrowed from the nearest real year of the model. */
  yearSource: "exact" | "nearest";
}

/* --- Parsing helpers -------------------------------------------------------- */

function num(text: string | undefined): number | null {
  if (text === undefined || text.trim() === "") return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** "2021-2023" -> the years in it (bounded: a malformed range cannot loop). */
function yearsIn(range: string): number[] {
  const [from, to] = range.split("-").map(Number);
  if (from === undefined || to === undefined || !Number.isInteger(from) || !Number.isInteger(to)) {
    return [];
  }
  if (to < from || to - from > 60) return [];
  const out: number[] = [];
  for (let year = from; year <= to; year += 1) out.push(year);
  return out;
}

/** "<range>:<value>" entries of a sheet value, split on the first colon. */
function entriesOf(value: string | undefined): Array<[range: string, rest: string]> {
  const out: Array<[string, string]> = [];
  for (const entry of value?.split(" ") ?? []) {
    const at = entry.indexOf(":");
    if (at > 0) out.push([entry.slice(0, at), entry.slice(at + 1)]);
  }
  return out;
}

const SOURCE_BY_LETTER: Readonly<Record<string, BoltSource>> = {
  a: "autocountry",
  d: "vendor",
  p: "vendor",
  m: "maker",
  s: "sheet",
  w: "web",
};

const METRIC_TIRE = /^(\d{3})\/(\d{2,3})(?:Z?R)(\d{2})$/;
const FLOTATION_TIRE = /^(\d{2}(?:\.\d)?)x(\d{1,2}(?:\.\d{1,2})?)R(\d{2})$/;

/* --- The generated table ---------------------------------------------------- */

interface SpecRecord {
  bolts: string[];
  bore: string | null;
  thread: string | null;
  fastener: "nut" | "bolt" | null;
  offset: number | null;
  tires: FactoryTire[];
  flotation: FactoryFlotationTire[];
  wheels: VehicleRim[];
  tireRange: TireRange | null;
  wheelRange: WheelRange | null;
  source: BoltSource | null;
}

function list(field: string | undefined): string[] {
  return (field ?? "").split(",").map((part) => part.trim()).filter((part) => part !== "");
}

function parseRecord(text: string): SpecRecord {
  const f = text.split(";");
  const tires: FactoryTire[] = [];
  const flotation: FactoryFlotationTire[] = [];
  for (const size of list(f[5])) {
    const metric = METRIC_TIRE.exec(size);
    if (metric) {
      tires.push({ width: Number(metric[1]), profile: Number(metric[2]), rim: Number(metric[3]) });
      continue;
    }
    const float = FLOTATION_TIRE.exec(size);
    if (float) {
      flotation.push({
        diameter: Number(float[1]),
        section: Number(float[2]),
        rim: Number(float[3]),
      });
    }
  }
  const wheels: VehicleRim[] = [];
  for (const size of list(f[6])) {
    const [diameter, width] = size.split("x").map(Number);
    if (diameter && width) wheels.push({ diameter, width, source: "specs" });
  }
  /* A bound that is missing or 0 is unbounded on that side (D155,
     coordinator 2026-10-06: Lucid Air 2022-26 states a wheel width minimum of
     0). It is kept as 0, which the queries' `measure()` reads as "not given".
     `split`, not `list`: dropping an empty field would shift the rest. An
     offset keeps `null` for a missing bound, because 0 mm is a real offset. */
  const bound = (text: string | undefined): number => {
    const value = num(text);
    return value !== null && value > 0 ? value : 0;
  };
  const tr = (f[7] ?? "").split(",").map(bound);
  const tireRange =
    tr.some((value) => value > 0)
      ? { diameterMin: tr[0] ?? 0, diameterMax: tr[1] ?? 0, widthMin: tr[2] ?? 0, widthMax: tr[3] ?? 0 }
      : null;
  const wr = (f[8] ?? "").split(",");
  const offsetMin = num(wr[4]);
  const offsetMax = num(wr[5]);
  const wheelBounds = wr.slice(0, 4).map(bound);
  const wheelRange =
    wheelBounds.some((value) => value > 0) || offsetMin !== null || offsetMax !== null
      ? {
          diameterMin: wheelBounds[0] ?? 0,
          diameterMax: wheelBounds[1] ?? 0,
          widthMin: wheelBounds[2] ?? 0,
          widthMax: wheelBounds[3] ?? 0,
          offsetMin,
          offsetMax,
        }
      : null;
  const fastener = f[3] === "b" ? "bolt" : f[3] === "n" ? "nut" : null;
  return {
    bolts: list(f[0]),
    bore: f[1] ? f[1] : null,
    thread: f[2] ? f[2] : null,
    fastener,
    offset: num(f[4]),
    tires,
    flotation,
    wheels,
    tireRange,
    wheelRange,
    source: SOURCE_BY_LETTER[(f[9] ?? "").charAt(0)] ?? null,
  };
}

function specYears(key: string): Map<number, SpecRecord> {
  const out = new Map<number, SpecRecord>();
  for (const [range, record] of entriesOf(VEHICLE_SPECS[key])) {
    const parsed = parseRecord(record);
    for (const year of yearsIn(range)) out.set(year, parsed);
  }
  return out;
}

/* --- The older sheets ------------------------------------------------------- */

interface RealYear {
  /** `null` = a generation range the sources disagree on ("?"): claim nothing. */
  bolt: string | null;
  bore: string | null;
  source: "ankusi" | "generation";
  rim: VehicleRim | null;
}

function realYears(key: string): Map<number, RealYear> {
  const years = new Map<number, RealYear>();
  const ranges: Array<[number, number]> = [];
  for (const [range, fit] of entriesOf(VEHICLE_FITMENT_GENERATIONS[key])) {
    const [bolt, bore] = fit.split("/");
    const inRange = yearsIn(range);
    if (inRange.length === 0) continue;
    ranges.push([inRange[0]!, inRange[inRange.length - 1]!]);
    for (const year of inRange) {
      years.set(year, {
        bolt: bolt && bolt !== "?" ? bolt : null,
        bore: bore ?? null,
        source: "generation",
        rim: null,
      });
    }
  }
  /* An exact-year row wins over a generation row for the same year. Its value
     is `<bolt>[/<bore>[/<diameter>/<width>]]`. */
  const exactRims = new Map<number, VehicleRim>();
  for (const entry of VEHICLE_FITMENT_DATA[key]?.split(" ") ?? []) {
    const [built, fit = ""] = entry.split(":");
    const [bolt, bore, diameter, width] = fit.split("/");
    const year = Number(built);
    if (!Number.isInteger(year)) continue;
    const rim =
      diameter && width
        ? { diameter: Number(diameter), width: Number(width), source: "exact" as const }
        : null;
    if (rim !== null) exactRims.set(year, rim);
    if (bolt) years.set(year, { bolt, bore: bore || null, source: "ankusi", rim });
  }
  /* A year without a rim of its own takes the nearest exact year's inside the
     SAME generation range (equidistant: the later year). */
  for (const [from, to] of ranges) {
    const inside = [...exactRims].filter(([year]) => year >= from && year <= to);
    if (inside.length === 0) continue;
    for (let year = from; year <= to; year += 1) {
      const row = years.get(year);
      if (row === undefined || row.rim !== null) continue;
      let best = inside[0]!;
      for (const candidate of inside) {
        const gap = Math.abs(candidate[0] - year);
        const bestGap = Math.abs(best[0] - year);
        if (gap < bestGap || (gap === bestGap && candidate[0] > best[0])) best = candidate;
      }
      row.rim = { ...best[1], source: "range" };
    }
  }
  return years;
}

interface ThreadRange {
  years: number[];
  thread: string;
  fastener: "nut" | "bolt";
}

function threadRanges(key: string): ThreadRange[] {
  const out: ThreadRange[] = [];
  for (const [range, fit] of entriesOf(VEHICLE_THREADS[key])) {
    const [thread, kind] = fit.split("/");
    if (!thread) continue;
    out.push({ years: yearsIn(range), thread, fastener: kind === "b" ? "bolt" : "nut" });
  }
  return out;
}

interface SizeRange {
  years: number[];
  rims: VehicleRim[];
}

function sheetSizeRanges(key: string): SizeRange[] {
  const out: SizeRange[] = [];
  for (const [range, sizes] of entriesOf(VEHICLE_WHEEL_SIZES[key])) {
    const rims: VehicleRim[] = [];
    for (const size of sizes.split(",")) {
      const [diameter, width] = size.split("x").map(Number);
      if (diameter && width) rims.push({ diameter, width, source: "sheet" });
    }
    out.push({ years: yearsIn(range), rims });
  }
  return out;
}

/** One entry per size; the first one listed wins a duplicate. */
function unionRims(parts: ReadonlyArray<VehicleRim | null>): VehicleRim[] {
  const seen = new Map<string, VehicleRim>();
  for (const rim of parts) {
    if (rim === null) continue;
    const key = `${rim.diameter}x${rim.width}`;
    if (!seen.has(key)) seen.set(key, rim);
  }
  return [...seen.values()];
}

/* --- Every fact of one model, year by year ---------------------------------- */

interface Facts {
  bolts: readonly string[];
  boltSource: BoltSource | null;
  bore: string | null;
  offset: number | null;
  thread: string | null;
  fastener: "nut" | "bolt" | null;
  rims: readonly VehicleRim[];
  wheelRange: WheelRange | null;
  tires: readonly FactoryTire[];
  flotation: readonly FactoryFlotationTire[];
  tireRange: TireRange | null;
}

const NO_FACTS: Facts = {
  bolts: [],
  boltSource: null,
  bore: null,
  offset: null,
  thread: null,
  fastener: null,
  rims: [],
  wheelRange: null,
  tires: [],
  flotation: [],
  tireRange: null,
};

interface ModelFacts {
  years: Map<number, Facts>;
  /** Model years inside a `?` generation range: no source claims a bolt
   *  pattern and nothing is borrowed from a neighbour. */
  blocked: Set<number>;
}

const modelCache = new Map<string, ModelFacts | null>();

/** The facts of every model year any source states, each field resolved by
 *  the precedence in the header (generated table first, then the sheets). */
function modelFacts(key: string): ModelFacts | null {
  const cached = modelCache.get(key);
  if (cached !== undefined) return cached;

  const specs = specYears(key);
  const real = realYears(key);
  const threads = threadRanges(key);
  const sizes = sheetSizeRanges(key);

  const all = new Set<number>([...specs.keys(), ...real.keys()]);
  for (const range of threads) for (const year of range.years) all.add(year);
  for (const range of sizes) for (const year of range.years) all.add(year);
  if (all.size === 0) {
    modelCache.set(key, null);
    return null;
  }

  const years = new Map<number, Facts>();
  const blocked = new Set<number>();
  for (const year of all) {
    const s = specs.get(year);
    const r = real.get(year);
    const realBolts = r !== undefined && r.bolt !== null ? list(r.bolt) : [];
    const specBolts = s?.bolts ?? [];
    const bolts = specBolts.length > 0 ? specBolts : realBolts;
    const boltSource: BoltSource | null =
      specBolts.length > 0 ? (s?.source ?? "sheet") : realBolts.length > 0 ? (r?.source ?? null) : null;
    if (r !== undefined && r.bolt === null && specBolts.length === 0) blocked.add(year);

    /* A real bore belongs to the bolt pattern it was published with: it is
       used only when the generated table has no pattern, or the same one. */
    const realBore =
      r !== undefined && r.bolt !== null && (specBolts.length === 0 || specBolts.includes(r.bolt))
        ? r.bore
        : null;
    const sheetThread = threads.find((range) => range.years.includes(year));
    const thread = s?.thread ?? sheetThread?.thread ?? null;
    const sheetFastener =
      sheetThread !== undefined && sheetThread.thread === thread ? sheetThread.fastener : null;
    const sheetRimList = sizes.filter((range) => range.years.includes(year)).flatMap((range) => range.rims);
    const rims =
      s !== undefined && s.wheels.length > 0 ? s.wheels : unionRims([...sheetRimList, r?.rim ?? null]);

    years.set(year, {
      bolts,
      boltSource,
      bore: s?.bore ?? realBore,
      offset: s?.offset ?? null,
      thread,
      fastener: s?.fastener ?? sheetFastener,
      rims,
      wheelRange: s?.wheelRange ?? null,
      tires: s?.tires ?? [],
      flotation: s?.flotation ?? [],
      tireRange: s?.tireRange ?? null,
    });
  }
  const out = { years, blocked };
  modelCache.set(key, out);
  return out;
}

/**
 * The year closest to `year` among those whose facts pass `has`. Equidistant:
 * the later year. Distance is not capped (D149, owner 2026-10-05).
 */
function nearest(
  years: Map<number, Facts>,
  year: number,
  has: (facts: Facts) => boolean,
): Facts | null {
  let best: { year: number; facts: Facts } | null = null;
  for (const [known, facts] of years) {
    if (!has(facts)) continue;
    if (
      best === null ||
      Math.abs(known - year) < Math.abs(best.year - year) ||
      (Math.abs(known - year) === Math.abs(best.year - year) && known > best.year)
    ) {
      best = { year: known, facts };
    }
  }
  return best?.facts ?? null;
}

function bodyClasses(key: string): readonly BodyClass[] {
  return (VEHICLE_TYPES[key]?.split(";") ?? []).filter(
    (value): value is BodyClass =>
      value === "car" || value === "mpv" || value === "truck",
  );
}

/**
 * The fitment the site uses for a vehicle the finder offers. `null` when no
 * source states anything for the make, model and year, which the caller treats
 * as no vehicle (D47(8): no size given, every result is a best match). Exact
 * strings: `query.ts` has already checked them against the finder list; an
 * old model name is resolved through `VEHICLE_ALIASES` first.
 */
export function findFitment(year: string, make: string, model: string): VehicleFitment | null {
  const built = Number(year);
  if (!Number.isInteger(built)) return null;
  const asked = `${make}|${model}`;
  const key = VEHICLE_ALIASES[asked] ?? asked;
  const data = modelFacts(key);
  if (data === null) return null;

  const own = data.years.get(built) ?? NO_FACTS;
  const blocked = data.blocked.has(built);
  let borrowed = false;
  /* A group's facts: the exact year's when it states any, else the nearest
     year that does, else nothing. A blocked year borrows nothing. */
  const group = (has: (facts: Facts) => boolean): Facts | null => {
    if (has(own)) return own;
    if (blocked) return null;
    const near = nearest(data.years, built, has);
    if (near !== null) borrowed = true;
    return near;
  };
  const mount = group((f) => f.bolts.length > 0);
  /* The other groups are borrowed only from a year with the same bolt
     patterns as the mount that was settled: a new bolt pattern is a new
     platform, and its thread, wheels and tires are another car's. A year that
     states no pattern cannot be told apart and may lend. */
  const sameMount = (f: Facts): boolean =>
    mount === null ||
    f.bolts.length === 0 ||
    (f.bolts.length === mount.bolts.length && f.bolts.every((b) => mount.bolts.includes(b)));
  const lug = group((f) => f.thread !== null && sameMount(f));
  const wheels = group((f) => (f.rims.length > 0 || f.wheelRange !== null) && sameMount(f));
  const tires = group(
    (f) =>
      (f.tires.length > 0 || f.flotation.length > 0 || f.tireRange !== null) && sameMount(f),
  );

  const centreBore = mount?.bore ?? own.bore;
  if (
    mount === null &&
    lug === null &&
    wheels === null &&
    tires === null &&
    centreBore === null
  ) {
    return null;
  }
  return {
    boltPatterns: mount?.bolts ?? [],
    centreBore,
    boltSource: mount?.boltSource ?? null,
    offset: mount?.offset ?? null,
    tireSizes: tires?.tires ?? [],
    flotationSizes: tires?.flotation ?? [],
    tireRange: tires?.tireRange ?? null,
    rims: wheels?.rims ?? [],
    wheelRange: wheels?.wheelRange ?? null,
    classes: bodyClasses(key),
    thread: lug?.thread ?? null,
    fastener: lug?.fastener ?? null,
    yearSource: borrowed ? "nearest" : "exact",
  };
}
