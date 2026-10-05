/**
 * Real wheel fitment for the vehicle finder, from the ANKUSI wheel fitment
 * dataset, plus the two small TypeScript modules the app reads.
 *
 *   node scripts/vehicle-fitment.mjs --ankusi <ankusi.csv> [--review <file>]
 *       rebuild scripts/data/vehicle-fitment.csv from the ANKUSI file, write
 *       the review list (default import-report/vehicle-fitment-review.csv,
 *       git-ignored), then the two app modules below
 *   node scripts/vehicle-fitment.mjs
 *       only rewrite the app modules from the committed CSVs (run it after
 *       `npm run vehicles:fetch` changes vehicles.csv, or after editing
 *       vehicle-fitment-generations.csv). It validates the generation CSV and
 *       fails loudly on a bad row; it lists every year where a generation row
 *       and an exact-year ANKUSI row disagree (import-report/, git-ignored)
 *
 * The ANKUSI file is not committed. Download it from
 * https://ankusiwheels.com/wp-content/uploads/dataset/ankusi-wheel-fitment.csv
 * (owner, 2026-10-04: use it, with no credit on the site; see
 * scripts/data/llm.md). The app never reads it, and never calls ANKUSI.
 *
 * What it writes:
 *   - scripts/data/vehicle-fitment.csv: one row per make + model + model year
 *     that ANKUSI publishes for THAT year, in vehicles.csv's own spelling. A
 *     year ANKUSI does not publish is left out: it is never filled from a
 *     neighbouring year, because a model's bolt pattern can change between
 *     generations (a 2005-2014 Subaru Outback is 5x100, a 2025 one 5x114.3).
 *   - src/features/finder/vehicle-list.ts: every make, model and its model
 *     years, from vehicles.csv. Client-safe and small; the finder renders it
 *     and `isFinderVehicle` checks against it.
 *   - src/features/finder/vehicle-fitment-data.ts: bolt pattern and centre
 *     bore per make + model + year (from vehicle-fitment.csv) and per
 *     generation year range (from vehicle-fitment-generations.csv, LA-05).
 *     Server only; `results/search.ts` reads it through `finder/fitment.ts`,
 *     which applies the precedence: exact-year ANKUSI row, then generation
 *     row, then the D48(4) placeholder, then nothing.
 *
 * Auto Country (D155). `scripts/vehicle-fitment-autocountry.mjs` turns the saved
 * answers of Auto Country's vehicle lookup into scripts/data/vehicle-fitment-
 * autocountry.csv (one row per model year: bolt patterns, bore, thread, factory
 * tire and wheel sizes, stock ranges) and scripts/data/vehicle-aliases.csv
 * (which of its models are ours under another name). This script reads both
 * (and, when present, scripts/data/vehicle-fitment-vendors.csv: the same columns
 * plus `source` d|p|m|s|w (+ optional 1), and optional source_url columns, for gap fills from other vendors, makers and the web)
 * and writes, besides the exports above:
 *   - VEHICLE_SPECS in vehicle-fitment-data.ts: per entry, per year range, one
 *     record of ten `;`-joined fields (bolts, bore, thread, fastener, offset,
 *     tires, wheels, tire range, wheel range, source). Auto Country's fields are
 *     never overwritten by another source; a gap is filled only where it is blank.
 *   - VEHICLE_ALIASES: our old or other spelling -> the entry's canonical name.
 *   - vehicle-list.ts as the UNION of Auto Country's list and vehicles.csv in
 *     canonical names ("union of both is best. dont lose data.", owner 2026-10-06).
 *   - design/reports/fitment-overrides.csv: every make + model + year where an
 *     Auto Country value disagrees with what the older sheets say.
 * The older sheets (VEHICLE_FITMENT_DATA, _GENERATIONS, _THREADS, _WHEEL_SIZES,
 * VEHICLE_TYPES) are re-keyed to the canonical entry names, so one key finds
 * every source for a car; where two of our models are one entry the first
 * source in sheet order wins a year.
 *
 * scripts/data/vehicle-fitment-generations.csv is hand-kept (never written by
 * this script): one row per make + model + generation year range, added only
 * when two independent free sources on two different websites agree on the
 * bolt pattern. A row whose bolt_pattern is `unknown` records a generation
 * whose sources disagree: it blanks the placeholder for those years instead
 * of letting a known-doubtful guess stand, and stops the nearest-year rule
 * (fitment.ts) from borrowing across it. It needs one source_1 page that shows
 * why; source_2 may be blank. See scripts/data/llm.md.
 *
 * How an ANKUSI row becomes a fitment row (each rule is here because the data
 * needed it, measured on the 2026.10.04 release):
 *   - English rows only (`source_lang` en). The other editions add Thai,
 *     Russian, Gulf and Latin American market cars, never a Canadian one.
 *   - The model name loses its make prefix ("Toyota Tacoma" -> "Tacoma") and
 *     its market tag ("[US]"). A tag naming another market ("[EU]", "[UK]",
 *     "[JP]" ...) drops the row: the same name can be a different car there
 *     (an EU 2020 Corolla is 5x114.3, a Canadian one 5x100).
 *   - A row matches a vehicles.csv model when the names are equal ignoring
 *     case, spaces and punctuation, or when ANKUSI's name is the model plus
 *     trim words only (`TRIM_WORDS`: "Tacoma TRD Pro", "RAV4 Hybrid"). Trims
 *     that change the hub (Type R, Heavy Duty, Raptor, SRT ...) are not trim
 *     words, and body styles (Sedan, Hatchback) are not either, because ANKUSI
 *     uses them for other markets' cars. `ALIASES` maps the few names that
 *     differ outright.
 *   - For one make + model + year: rows tagged for North America win; then
 *     untagged rows of the model itself; then untagged trim rows. Every row
 *     of the chosen set must agree on the bolt pattern, or the year is held
 *     back and listed for review. Centre bore and OE wheel size are kept only
 *     where every chosen row agrees, and OE size only from a single-size,
 *     same-front-and-rear `oe_wheel`.
 *   - `EXCLUDED` drops rows found wrong for the Canadian car on review, each
 *     with its reason. A bolt pattern that is not "<lugs>x<pcd>" (centre-lock,
 *     staggered front/rear) never becomes a row.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const VEHICLES = "scripts/data/vehicles.csv";
const FITMENT = "scripts/data/vehicle-fitment.csv";
const GENERATIONS = "scripts/data/vehicle-fitment-generations.csv";
const THREADS = "scripts/data/vehicle-thread-generations.csv";
const WHEEL_SIZES = "scripts/data/vehicle-wheel-sizes.csv";
const AC_FITMENT = "scripts/data/vehicle-fitment-autocountry.csv";
const ALIAS_FILE = "scripts/data/vehicle-aliases.csv";
const VENDOR_FILE = "scripts/data/vehicle-fitment-vendors.csv";
const OVERRIDES = "design/reports/fitment-overrides.csv";
const GENERATION_REVIEW = "import-report/vehicle-fitment-generation-review.csv";
const LIST_MODULE = "src/features/finder/vehicle-list.ts";
const FITMENT_MODULE = "src/features/finder/vehicle-fitment-data.ts";
const DEFAULT_REVIEW = "import-report/vehicle-fitment-review.csv";

/** ANKUSI make spelling -> vehicles.csv make spelling, where they differ. */
const MAKE_NAMES = { Mini: "MINI" };

/** Market tags that mean the North American car. */
const NA_TAGS = new Set(["US", "USA", "CA", "CAN", "NA", "USDM", "US-SPEC"]);

/**
 * Words a trim may add to a model name without changing its hub. Lowercase.
 * Deliberately missing: type (Type R / Type S change the hub on Honda and
 * Acura), hd / heavy / duty / 2500 / 3500, raptor, srt, hellcat, trx, shelby,
 * nismo, ev / electric, and body styles (sedan, hatchback, coupe, wagon,
 * convertible), which ANKUSI uses for other markets' versions.
 */
const TRIM_WORDS = new Set(
  [
    "trd", "pro", "series", "off", "road", "hybrid", "plug-in", "phev", "se",
    "xse", "xle", "le", "limited", "platinum", "sport", "edition", "special",
    "woodland", "trailhunter", "adventure", "capstone", "1794", "10th", "40th",
    "50th", "anniversary", "denali", "ultimate", "at4", "at4x", "nightfall",
    "laramie", "longhorn", "night", "package", "wilderness", "rt", "sxt",
    "slt", "gt", "overland", "summit", "trailhawk", "rubicon", "sahara",
    "altitude", "mojave", "willys", "performance", "touring", "premium",
    "lariat", "king", "ranch", "xlt", "tremor", "timberline", "titanium",
    "awd", "4wd", "4x4", "4xe", "rock", "creek", "a-spec", "n", "line",
    "black", "blacktop", "launch", "inspiration", "f", "f-sport",
    /* Body and cab styles. They are trim words for every model except where
       ANKUSI uses them for another market's car (`EXCLUDED`). */
    "sedan", "hatchback", "5door", "5-door", "4-door", "3-door", "2-door",
    "wagon", "coupe", "convertible", "cab", "crew", "extended", "regular",
    "double", "quad", "supercrew", "supercab", "unlimited",
  ].map((word) => word.toLowerCase()),
);

/**
 * ANKUSI base names that name a vehicles.csv model differently. Keyed
 * "<vehicles.csv make>|<ANKUSI name without make prefix or tag>"; the ANKUSI
 * name may carry trim words after it, as for any model.
 */
const ALIASES = {
  "Mazda|3": "Mazda3",
  "Mazda|2": "Mazda2",
  "Mazda|5": "Mazda5",
  "Mazda|6": "Mazda6",
  "Mazda|6 US-spec": "Mazda6",
  "Nissan|Rogue Sport": "Qashqai",
  "GMC|Sierra": "Sierra 1500",
  "Chevrolet|Silverado": "Silverado 1500",
};

/**
 * Rows dropped on review: "<vehicles.csv make>|<vehicles.csv model>|<year>"
 * -> reason. Each one was checked against a public source (scripts/data/llm.md).
 */
const EXCLUDED = {
  /* ANKUSI's 2019+ Corolla rows (untagged, "Hatchback", even "Hybrid [US]")
     carry the European car's 5x114.3 / 60.1; the North American E210 is
     5x100 / 54.1 (wheel-sizes.com 2020, boltpatternhq.com 2019 hatchback). */
  "Toyota|Corolla|2019": "the European car's 5x114.3; the North American Corolla is 5x100",
  "Toyota|Corolla|2020": "the European car's 5x114.3; the North American Corolla is 5x100",
  "Toyota|Corolla|2023": "the European car's 5x114.3; the North American Corolla is 5x100",
  "Toyota|Corolla|2025": "the European car's 5x114.3; the North American Corolla is 5x100",
  /* Public sources disagree on 4x100 or 5x100 for this year (trim and market). */
  "Toyota|Corolla|2005": "4x100 or 5x100 depending on trim and market; not settled",
  /* The U-body minivan's six-lug pattern is 6x115 (wheel-sizes.com, O'Reilly). */
  "Buick|Terraza|2006": "ANKUSI says 6x114.3; the Terraza is 6x115",
  "Buick|Terraza|2007": "ANKUSI says 6x114.3; the Terraza is 6x115",
  /* One name, two hubs: base and LS 4x100, SS and Sport 5x110. */
  "Chevrolet|Cobalt|2005": "4x100 on base and LS, 5x110 on SS and Sport",
  /* vPIC files the carried-over 1500 Classic (5x139.7) under "1500" too. */
  "Ram|1500|2019": "vehicles.csv's 1500 includes the 1500 Classic, which is 5x139.7",
  /* vPIC files the petrol Macan (5x112) and the Macan Electric (5x130) as one. */
  "Porsche|Macan|2025": "vehicles.csv's Macan includes the petrol car (5x112) and the Electric (5x130)",
};

/* --- CSV ------------------------------------------------------------------ */

/** RFC 4180 reader: quoted fields, doubled quotes, CRLF, a leading BOM. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((cells) => cells.some((c) => c !== ""));
  return body.map((cells) =>
    Object.fromEntries(header.map((name, i) => [name.trim(), (cells[i] ?? "").trim()])),
  );
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(header, rows) {
  return `${[header, ...rows.map((row) => header.map((key) => row[key]))]
    .map((cells) => cells.map(csvCell).join(","))
    .join("\n")}\n`;
}

/* --- Helpers -------------------------------------------------------------- */

/** "2005-2011;2019-2027" -> Set of years. */
function yearSet(ranges) {
  const years = new Set();
  for (const part of ranges.split(";")) {
    const [from, to = from] = part.split("-").map(Number);
    for (let year = from; year <= to; year += 1) years.add(year);
  }
  return years;
}

/** ANKUSI `year`: "2019", "2017-2025" or "2017–2025". */
function ankusiYears(raw) {
  const match = /^(\d{4})(?:\s*[-–]\s*(\d{4}))?$/.exec(raw);
  if (!match) return [];
  const from = Number(match[1]);
  const to = Number(match[2] ?? match[1]);
  const years = [];
  for (let year = from; year <= to; year += 1) years.push(year);
  return years;
}

const norm = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

const BOLT = /^(\d{1,2})x(\d{2,3}(?:\.\d{1,2})?)$/;

/** One factory size, same front and rear: { diameter, width, offset } or null. */
function oeWheel(raw) {
  if (raw === "" || /\bF:|\bR:|\bF\s|\/\s*R\s|;/.test(raw.replace(/F\/R/g, ""))) {
    return null;
  }
  const sizes = [...raw.matchAll(/(\d{2}(?:\.\d)?)x(\d{1,2}(?:\.\d{1,2})?)J/g)];
  if (sizes.length !== 1) return null;
  const offsets = [...raw.matchAll(/ET\s*(-?\d{1,3}(?:\.\d)?)/g)];
  if (offsets.length > 1) return null;
  return {
    diameter: String(Number(sizes[0][1])),
    width: Number(sizes[0][2]).toFixed(1),
    offset: offsets.length === 1 ? String(Number(offsets[0][1])) : "",
  };
}

/** The one value every item agrees on, or "" when they differ or are blank. */
function agreed(values) {
  const set = new Set(values);
  return set.size === 1 ? [...set][0] : "";
}

/* --- vehicles.csv --------------------------------------------------------- */

async function readVehicles() {
  const rows = parseCsv(await readFile(VEHICLES, "utf8"));
  return rows.map((row) => ({
    make: row.make,
    model: row.model,
    years: row.years,
    types: row.types,
    yearSet: yearSet(row.years),
  }));
}

/* --- Build vehicle-fitment.csv from ANKUSI ---------------------------------- */

async function buildFitment(ankusiPath, reviewPath, vehicles) {
  const ankusi = parseCsv(await readFile(ankusiPath, "utf8"));
  const makes = new Set(vehicles.map((v) => v.make));
  /** "<make>|<normalised model>" -> vehicle */
  const byName = new Map(vehicles.map((v) => [`${v.make}|${norm(v.model)}`, v]));
  const byMake = new Map();
  for (const v of vehicles) {
    if (!byMake.has(v.make)) byMake.set(v.make, []);
    byMake.get(v.make).push(v);
  }
  /* Longest model first, so "Grand Cherokee L" is tried before "Grand Cherokee". */
  for (const list of byMake.values()) list.sort((a, b) => b.model.length - a.model.length);

  const review = [];
  const usedAliases = new Set();
  const usedExclusions = new Set();
  /** "<make>|<model>|<year>" -> candidate rows */
  const candidates = new Map();

  for (const row of ankusi) {
    if (row.source_lang !== "en") continue;
    const make = MAKE_NAMES[row.make] ?? row.make;
    if (!makes.has(make)) continue;

    let name = row.model.trim();
    for (const prefix of [row.make, make, "Mercedes-AMG", "Mercedes"]) {
      if (name.toLowerCase().startsWith(`${prefix.toLowerCase()} `)) {
        name = name.slice(prefix.length + 1).trim();
        break;
      }
    }
    let tag = null;
    const tagMatch = /\s*\[([A-Za-z-]+)\]\s*$/.exec(name);
    if (tagMatch) {
      tag = tagMatch[1].toUpperCase();
      name = name.slice(0, tagMatch.index).trim();
    }
    const base = { ankusi: row.model, year: row.year, bolt: row.bolt_pattern };
    if (tag !== null && !NA_TAGS.has(tag)) {
      review.push({ ...base, make, reason: `market tag [${tag}]` });
      continue;
    }

    let vehicle = byName.get(`${make}|${norm(name)}`) ?? null;
    let trim = false;
    if (vehicle === null) {
      /* The model (or an alias of it) followed by trim words only. Longest
         first, so "Grand Cherokee L" is tried before "Grand Cherokee". */
      const bases = [
        ...Object.entries(ALIASES)
          .filter(([key]) => key.startsWith(`${make}|`))
          .map(([key, target]) => ({ name: key.slice(make.length + 1), alias: key, target })),
        ...byMake.get(make).map((v) => ({ name: v.model, alias: null, target: v.model })),
      ].sort((a, b) => b.name.length - a.name.length);
      for (const candidate of bases) {
        const lower = name.toLowerCase();
        const head = candidate.name.toLowerCase();
        if (lower !== head && !lower.startsWith(`${head} `)) continue;
        const words = name.slice(candidate.name.length).trim().toLowerCase().split(/\s+/).filter(Boolean);
        if (!words.every((word) => TRIM_WORDS.has(word))) continue;
        vehicle = byName.get(`${make}|${norm(candidate.target)}`) ?? null;
        if (vehicle === null) break;
        if (candidate.alias !== null) usedAliases.add(candidate.alias);
        trim = words.length > 0;
        break;
      }
    }
    if (vehicle === null) {
      review.push({ ...base, make, reason: "no matching model" });
      continue;
    }
    if (!BOLT.test(row.bolt_pattern)) {
      review.push({ ...base, make, model: vehicle.model, reason: "bolt pattern is not <lugs>x<pcd>" });
      continue;
    }
    const years = ankusiYears(row.year);
    if (years.length === 0) {
      review.push({ ...base, make, model: vehicle.model, reason: "unreadable year" });
      continue;
    }
    for (const year of years) {
      if (!vehicle.yearSet.has(year)) continue;
      const key = `${vehicle.make}|${vehicle.model}|${year}`;
      if (!candidates.has(key)) candidates.set(key, []);
      candidates.get(key).push({
        ankusi: row.model,
        na: tag !== null,
        trim,
        bolt: row.bolt_pattern,
        bore: row.center_bore_mm,
        lugs: row.lug_count,
        oe: oeWheel(row.oe_wheel),
      });
    }
  }

  const out = [];
  for (const [key, rows] of candidates) {
    const [make, model, year] = key.split("|");
    if (EXCLUDED[key] !== undefined) {
      usedExclusions.add(key);
      review.push({
        make, model, year, ankusi: rows.map((r) => r.ankusi).join(" / "),
        bolt: rows.map((r) => r.bolt).join(" / "), reason: `excluded: ${EXCLUDED[key]}`,
      });
      continue;
    }
    const na = rows.filter((r) => r.na);
    const own = rows.filter((r) => !r.na && !r.trim);
    const chosen = na.length > 0 ? na : own.length > 0 ? own : rows;
    const bolts = new Set(chosen.map((r) => r.bolt));
    const allBolts = new Set(rows.map((r) => r.bolt));
    if (bolts.size !== 1) {
      review.push({
        make, model, year, ankusi: chosen.map((r) => r.ankusi).join(" / "),
        bolt: [...bolts].join(" / "), reason: "rows disagree on bolt pattern: held back",
      });
      continue;
    }
    if (allBolts.size > 1) {
      review.push({
        make, model, year, ankusi: rows.map((r) => `${r.ankusi}=${r.bolt}`).join(" / "),
        bolt: [...bolts][0], reason: "lower-priority rows disagree: kept the chosen rows",
      });
    }
    const oe = chosen.map((r) => r.oe);
    const oeAgreed = oe.every((o) => o !== null) ? agreed(oe.map((o) => JSON.stringify(o))) : "";
    const oeValue = oeAgreed === "" ? null : JSON.parse(oeAgreed);
    out.push({
      make,
      model,
      year: Number(year),
      bolt_pattern: [...bolts][0],
      centre_bore_mm: agreed(chosen.map((r) => r.bore)),
      lug_count: agreed(chosen.map((r) => r.lugs)),
      oe_wheel_diameter: oeValue?.diameter ?? "",
      oe_wheel_width: oeValue?.width ?? "",
      oe_offset_mm: oeValue?.offset ?? "",
      source_model: [...new Set(chosen.map((r) => r.ankusi))].join(" / "),
    });
  }
  out.sort(
    (a, b) =>
      a.make.localeCompare(b.make) || a.model.localeCompare(b.model) || a.year - b.year,
  );

  for (const key of Object.keys(ALIASES)) {
    if (!usedAliases.has(key)) console.warn(`alias matched nothing: ${key}`);
  }
  for (const key of Object.keys(EXCLUDED)) {
    if (!usedExclusions.has(key)) console.warn(`exclusion matched nothing: ${key}`);
  }

  await writeFile(
    FITMENT,
    toCsv(
      [
        "make", "model", "year", "bolt_pattern", "centre_bore_mm", "lug_count",
        "oe_wheel_diameter", "oe_wheel_width", "oe_offset_mm", "source_model",
      ],
      out,
    ),
  );
  await mkdir(path.dirname(reviewPath), { recursive: true });
  await writeFile(
    reviewPath,
    toCsv(["make", "model", "year", "ankusi", "bolt", "reason"], review),
  );

  const models = new Set(out.map((r) => `${r.make}|${r.model}`));
  console.log(
    `${FITMENT}: ${out.length} model-years, ${models.size} models, ` +
      `${new Set(out.map((r) => r.make)).size} makes. Review list: ${reviewPath} (${review.length} rows).`,
  );
}

/* --- Generation rows (hand-kept) -------------------------------------------- */

/**
 * Sites refused as a source. Empty since 2026-10-06: the owner lifted the ban on
 * Wheel-Size-derived sites (wheel-size.com, wheel-sizes.com, tirerack.com,
 * tiresize.com, teoalida.com, faultpedia.com, tirewheelguide.com) with "we have
 * permisiion to view and use data from them so go ahead" (recorded as the
 * owner's statement; no document is on file). Add a host here to refuse it again.
 */
const BANNED_SOURCES = [];

/** Sites that share a template, wording and errors count as one source. */
const SAME_OPERATOR = {
  "bolt-patterns.com": "autofiles.com",
  "wheeloffset.net": "autofiles.com",
};

const GENERATION_HEADER = [
  "make", "model", "year_from", "year_to", "bolt_pattern", "centre_bore_mm", "source_1", "source_2",
];

function hostOf(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** The registrable-ish domain: the last two labels (three for co.uk-style). */
function siteOf(host) {
  const labels = host.split(".");
  return labels.slice(-2).join(".");
}

/**
 * Reads and validates the generation CSV. Throws (loudly) on the first bad
 * row, listing every problem found. Returns rows with numeric years.
 */
async function readGenerations(vehicles) {
  const text = await readFile(GENERATIONS, "utf8");
  const rows = parseCsv(text);
  const header = text.split(/\r?\n/, 1)[0].replace(/^\uFEFF/, "").split(",").map((c) => c.trim());
  const problems = [];
  if (GENERATION_HEADER.some((name, i) => header[i] !== name)) {
    problems.push(`header must start ${GENERATION_HEADER.join(",")}`);
  }
  const byName = new Map(vehicles.map((v) => [`${v.make}|${v.model}`, v]));
  /** "<make>|<model>" -> accepted ranges, for the overlap check */
  const seen = new Map();
  const out = [];
  rows.forEach((row, index) => {
    const line = index + 2;
    const where = `${GENERATIONS}:${line} (${row.make} ${row.model} ${row.year_from}-${row.year_to})`;
    const fail = (message) => problems.push(`${where}: ${message}`);
    const key = `${row.make}|${row.model}`;
    const vehicle = byName.get(key);
    if (vehicle === undefined) {
      fail("make + model is not in vehicles.csv (spell it exactly as vehicles.csv does)");
      return;
    }
    const from = Number(row.year_from);
    const to = Number(row.year_to);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1990 || to > 2035) {
      fail("year_from and year_to must be whole years");
      return;
    }
    if (from > to) fail("year_from is after year_to");
    const unknown = row.bolt_pattern === "unknown";
    if (!unknown && !BOLT.test(row.bolt_pattern)) {
      fail(`bolt_pattern "${row.bolt_pattern}" is not <lugs>x<pcd> like 5x114.3 (or "unknown")`);
    }
    if (row.centre_bore_mm !== "" && !/^\d{2,3}(?:\.\d{1,2})?$/.test(row.centre_bore_mm)) {
      fail(`centre_bore_mm "${row.centre_bore_mm}" is not a number like 64.1`);
    }
    if (unknown && row.centre_bore_mm !== "") fail("an unknown row carries no centre bore");
    const sites = [];
    for (const field of ["source_1", "source_2"]) {
      /* An `unknown` row claims nothing, so it needs one page that shows why
         (a disagreement, a split model); source_2 may be blank. */
      if (unknown && field === "source_2" && row[field] === "") continue;
      const host = hostOf(row[field]);
      if (host === null) {
        fail(`${field} must be a full http(s) URL`);
        continue;
      }
      if (BANNED_SOURCES.some((banned) => host === banned || host.endsWith(`.${banned}`))) {
        fail(`${field} is a banned source (${host})`);
      }
      const site = siteOf(host);
      sites.push(SAME_OPERATOR[site] ?? site);
    }
    if (!unknown && sites.length === 2 && sites[0] === sites[1]) {
      fail("source_1 and source_2 are on the same website or sister sites; two independent sites are required");
    }
    if ([...vehicle.yearSet].every((year) => year < from || year > to)) {
      fail("no model year in this range is one the finder offers for the model");
    }
    const ranges = seen.get(key) ?? [];
    for (const other of ranges) {
      if (from <= other.to && other.from <= to) {
        fail(`overlaps the row for ${other.from}-${other.to} (line ${other.line})`);
      }
    }
    ranges.push({ from, to, line });
    seen.set(key, ranges);
    out.push({
      make: row.make, model: row.model, from, to,
      bolt: unknown ? null : row.bolt_pattern,
      bore: row.centre_bore_mm, line,
    });
  });
  if (problems.length > 0) {
    throw new Error(`${GENERATIONS} has ${problems.length} problem(s):\n  ${problems.join("\n  ")}`);
  }
  return out;
}

/** `12x1.5`, `14x2.0`, `1/2x20`, `9/16x18`: the thread a lug fastener is cut to. */
const THREAD = /^(?:\d{1,2}(?:\.\d)?|\d{1,2}\/\d{1,2})x\d{1,2}(?:\.\d{1,2})?$/;

/**
 * Lug thread per make + model + year range, from the hand-kept
 * scripts/data/vehicle-thread-generations.csv. Same rules as the generation
 * sheet: two independent free sources on two different websites agree, none of
 * them a banned one. A vehicle with no row here narrows no lug nut.
 */
async function readThreads(vehicles) {
  const text = await readFile(THREADS, "utf8");
  const rows = parseCsv(text);
  const problems = [];
  const byName = new Map(vehicles.map((v) => [`${v.make}|${v.model}`, v]));
  const seen = new Map();
  const out = [];
  rows.forEach((row, index) => {
    const where = `${THREADS}:${index + 2} (${row.make} ${row.model} ${row.year_from}-${row.year_to})`;
    const fail = (message) => problems.push(`${where}: ${message}`);
    const key = `${row.make}|${row.model}`;
    if (!byName.has(key)) {
      fail("make + model is not in vehicles.csv (spell it exactly as vehicles.csv does)");
      return;
    }
    const from = Number(row.year_from);
    const to = Number(row.year_to);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1990 || to > 2035 || from > to) {
      fail("year_from and year_to must be whole years, from <= to");
      return;
    }
    if (!THREAD.test(row.thread)) fail(`thread "${row.thread}" is not like 12x1.5 or 1/2x20`);
    if (row.fastener !== "nut" && row.fastener !== "bolt") fail('fastener must be "nut" or "bolt"');
    const sites = [];
    for (const field of ["source_1", "source_2"]) {
      const host = hostOf(row[field]);
      if (host === null) {
        fail(`${field} must be a full http(s) URL`);
        continue;
      }
      if (BANNED_SOURCES.some((banned) => host === banned || host.endsWith(`.${banned}`))) {
        fail(`${field} is a banned source (${host})`);
      }
      const site = siteOf(host);
      sites.push(SAME_OPERATOR[site] ?? site);
    }
    if (sites.length === 2 && sites[0] === sites[1]) {
      fail("source_1 and source_2 are on the same website or sister sites; two independent sites are required");
    }
    const ranges = seen.get(key) ?? [];
    for (const other of ranges) {
      if (from <= other.to && other.from <= to) fail(`overlaps the row for ${other.from}-${other.to}`);
    }
    ranges.push({ from, to });
    seen.set(key, ranges);
    out.push({ make: row.make, model: row.model, from, to, thread: row.thread, fastener: row.fastener });
  });
  if (problems.length > 0) {
    throw new Error(`${THREADS} has ${problems.length} problem(s):\n  ${problems.join("\n  ")}`);
  }
  return out;
}

/** `16x7;17x7.5`: factory wheel sizes, diameter x width in inches. */
const WHEEL_SIZE_LIST = /^\d{2}(?:\.\d)?x\d{1,2}(?:\.\d)?(?:;\d{2}(?:\.\d)?x\d{1,2}(?:\.\d)?)*$/;

/**
 * Every factory wheel size per make + model + year range, the union across
 * trims and option packages, from the hand-kept
 * scripts/data/vehicle-wheel-sizes.csv. A row needs a manufacturer page, or
 * two independent free websites; banned sources are refused. The tire fit
 * (`finder/tire-fit.ts`) is derived from these. A vehicle with no row here and
 * no ANKUSI rim narrows no tire.
 */
async function readWheelSizes(vehicles) {
  const text = await readFile(WHEEL_SIZES, "utf8");
  const rows = parseCsv(text);
  const problems = [];
  const byName = new Map(vehicles.map((v) => [`${v.make}|${v.model}`, v]));
  const seen = new Map();
  const out = [];
  rows.forEach((row, index) => {
    const where = `${WHEEL_SIZES}:${index + 2} (${row.make} ${row.model} ${row.year_from}-${row.year_to})`;
    const fail = (message) => problems.push(`${where}: ${message}`);
    const key = `${row.make}|${row.model}`;
    if (!byName.has(key)) {
      fail("make + model is not in vehicles.csv (spell it exactly as vehicles.csv does)");
      return;
    }
    const from = Number(row.year_from);
    const to = Number(row.year_to);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1990 || to > 2035 || from > to) {
      fail("year_from and year_to must be whole years, from <= to");
      return;
    }
    if (!WHEEL_SIZE_LIST.test(row.wheel_sizes)) fail(`wheel_sizes "${row.wheel_sizes}" is not like 16x7;17x7.5`);
    const sites = [];
    for (const field of ["source_1", "source_2"]) {
      if (field === "source_2" && row[field] === "") continue;
      const host = hostOf(row[field]);
      if (host === null) {
        fail(`${field} must be a full http(s) URL`);
        continue;
      }
      if (BANNED_SOURCES.some((banned) => host === banned || host.endsWith(`.${banned}`))) {
        fail(`${field} is a banned source (${host})`);
      }
      const site = siteOf(host);
      sites.push(SAME_OPERATOR[site] ?? site);
    }
    if (sites.length === 2 && sites[0] === sites[1]) {
      fail("source_1 and source_2 are on the same website or sister sites");
    }
    const ranges = seen.get(key) ?? [];
    for (const other of ranges) {
      if (from <= other.to && other.from <= to) fail(`overlaps the row for ${other.from}-${other.to}`);
    }
    ranges.push({ from, to });
    seen.set(key, ranges);
    out.push({ make: row.make, model: row.model, from, to, sizes: row.wheel_sizes.split(";") });
  });
  if (problems.length > 0) {
    throw new Error(`${WHEEL_SIZES} has ${problems.length} problem(s):\n  ${problems.join("\n  ")}`);
  }
  return out;
}

/**
 * Lists every offered model year where a generation row and an exact-year
 * ANKUSI row both exist and disagree on the bolt pattern. Nothing is
 * overridden: the exact-year row wins at runtime. The owner or co-founder
 * decides which is right and edits a CSV (or `EXCLUDED`).
 */
async function reportGenerationConflicts(generations, vehicles) {
  const exact = new Map();
  for (const row of parseCsv(await readFile(FITMENT, "utf8"))) {
    exact.set(`${row.make}|${row.model}|${row.year}`, row.bolt_pattern);
  }
  const byName = new Map(vehicles.map((v) => [`${v.make}|${v.model}`, v]));
  const conflicts = [];
  let shadowed = 0;
  for (const gen of generations) {
    const vehicle = byName.get(`${gen.make}|${gen.model}`);
    for (let year = gen.from; year <= gen.to; year += 1) {
      if (!vehicle.yearSet.has(year)) continue;
      const real = exact.get(`${gen.make}|${gen.model}|${year}`);
      if (real === undefined) continue;
      shadowed += 1;
      if (gen.bolt !== null && real !== gen.bolt) {
        conflicts.push({
          make: gen.make, model: gen.model, year, generation_bolt: gen.bolt,
          ankusi_bolt: real, generation_line: gen.line,
        });
      }
    }
  }
  await mkdir(path.dirname(GENERATION_REVIEW), { recursive: true });
  await writeFile(
    GENERATION_REVIEW,
    toCsv(["make", "model", "year", "generation_bolt", "ankusi_bolt", "generation_line"], conflicts),
  );
  if (conflicts.length > 0) {
    console.warn(
      `${conflicts.length} model-year(s) where a generation row disagrees with an exact ANKUSI row ` +
        `(the exact row wins; listed in ${GENERATION_REVIEW}):`,
    );
    for (const c of conflicts) {
      console.warn(`  ${c.make} ${c.model} ${c.year}: generation ${c.generation_bolt}, ANKUSI ${c.ankusi_bolt}`);
    }
  }
  return { conflicts: conflicts.length, shadowed };
}

/* --- Entries: the union list, canonical names, specs (D155) ------------------ */

const tireOrder = (a, b) => {
  const key = (size) => {
    const metric = /^(\d{3})\/(\d{2,3})R(\d{2}(?:\.\d)?)$/.exec(size);
    if (metric) return [Number(metric[3]), Number(metric[1]), Number(metric[2])];
    const flot = /^(\d{2}(?:\.\d)?)x(\d{1,2}\.\d{2})R(\d{2}(?:\.\d)?)$/.exec(size);
    return flot ? [Number(flot[3]), Number(flot[2]) * 25.4, 0] : [0, 0, 0];
  };
  const [x, y] = [key(a), key(b)];
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};
const wheelOrder = (a, b) => {
  const [ad, aw] = a.split("x").map(Number);
  const [bd, bw] = b.split("x").map(Number);
  return ad - bd || aw - bw;
};

function mostCommon(values, larger = false) {
  const counts = new Map();
  for (const value of values) {
    if (value === "" || value === null || value === undefined) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount || (larger && count === bestCount && Number(value) > Number(best))) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

const splitList = (text) => (text ?? "").split(";").filter(Boolean);
const unique = (list) => [...new Set(list)];
const yearsToText = (years) => {
  const sorted = [...years].sort((a, b) => a - b);
  const parts = [];
  for (const year of sorted) {
    const last = parts[parts.length - 1];
    if (last && year === last[1] + 1) last[1] = year;
    else parts.push([year, year]);
  }
  return parts.map(([from, to]) => (from === to ? String(from) : `${from}-${to}`)).join(";");
};

/**
 * One make + model year of Auto Country (or another source) as spec fields.
 * `rows` are CSV rows of vehicle-fitment-autocountry.csv shape that contribute
 * to one entry in one year (several for a family: the union).
 */
function mergeRows(rows, primaryName = null) {
  const bounds = (minKey, maxKey) => {
    const mins = rows.map((r) => r[minKey]).filter((v) => v !== "" && v !== undefined).map(Number);
    const maxs = rows.map((r) => r[maxKey]).filter((v) => v !== "" && v !== undefined).map(Number);
    return [mins.length ? Math.min(...mins) : "", maxs.length ? Math.max(...maxs) : ""];
  };
  const range = (pairs) => {
    const values = pairs.flatMap(([a, b]) => [a, b]);
    return values.every((v) => v !== "") ? values.join(",") : "";
  };
  /* A family entry that unites models on different hubs (Express 1500 and 2500,
     Silverado 1500 and 1500 HD) has no single bore, thread or offset: those
     take the value of the model that carries the entry's own name, or stay
     blank. Otherwise the most common value across the rows. */
  const mixed = new Set(rows.map((r) => r.bolt_patterns).filter(Boolean)).size > 1 && rows.length > 1;
  const primary = mixed && primaryName !== null ? rows.find((r) => r.model === primaryName) : undefined;
  const scalar = (key, larger = false) =>
    !mixed ? mostCommon(rows.map((r) => r[key]), larger) : primary ? (primary[key] ?? "") : "";
  const fastener = scalar("fastener");
  return {
    bolts: unique(rows.flatMap((r) => splitList(r.bolt_patterns))).join(","),
    bore: scalar("centre_bore", true),
    thread: scalar("thread"),
    fastener: fastener === "nut" ? "n" : fastener === "bolt" ? "b" : "",
    offset: scalar("offset"),
    tires: unique(rows.flatMap((r) => splitList(r.tire_sizes))).sort(tireOrder).join(","),
    wheels: unique(rows.flatMap((r) => splitList(r.wheel_sizes))).sort(wheelOrder).join(","),
    tireRange: range([bounds("tire_dia_min", "tire_dia_max"), bounds("tire_width_min", "tire_width_max")]),
    wheelRange: range([
      bounds("wheel_dia_min", "wheel_dia_max"),
      bounds("wheel_width_min", "wheel_width_max"),
      bounds("offset_min", "offset_max"),
    ]),
  };
}

const SPEC_FIELDS = ["bolts", "bore", "thread", "fastener", "offset", "tires", "wheels", "tireRange", "wheelRange"];

/**
 * Reads Auto Country's CSV, the aliases and the optional vendor gap fill, and
 * decides every entry (canonical make + model) of the finder's list.
 */
async function buildEntries(vehicles) {
  const have = existsSync(AC_FITMENT) && existsSync(ALIAS_FILE);
  const acRows = have ? parseCsv(await readFile(AC_FITMENT, "utf8")) : [];
  const aliasRows = have ? parseCsv(await readFile(ALIAS_FILE, "utf8")) : [];
  const vendorRows = existsSync(VENDOR_FILE) ? parseCsv(await readFile(VENDOR_FILE, "utf8")) : [];

  const ourMakes = new Map(vehicles.map((v) => [norm(v.make), v.make]));
  const canonMake = (make) => ourMakes.get(norm(make)) ?? make;

  /* our model -> entry name (the `same` rows; the most years wins) */
  const ourVotes = new Map();
  /* "<make>|<Auto Country name>" -> rows deciding where its data goes */
  const acIndex = new Map();
  for (const row of aliasRows) {
    const from = Number(row.year_from);
    const to = Number(row.year_to);
    const span = to - from + 1;
    if (row.relation === "same") {
      const key = `${row.canonical_make}|${row.model}`;
      if (!ourVotes.has(key)) ourVotes.set(key, new Map());
      const votes = ourVotes.get(key);
      votes.set(row.canonical_model, (votes.get(row.canonical_model) ?? 0) + span);
    }
    if (row.relation === "ours-only") continue;
    const acName = row.relation === "same" ? row.canonical_model : row.model;
    const key = `${row.canonical_make}|${acName}`;
    if (!acIndex.has(key)) acIndex.set(key, []);
    acIndex.get(key).push({ from, to, relation: row.relation, canonical: row.canonical_model });
  }
  const entryOfOurs = (make, model) => {
    const votes = ourVotes.get(`${make}|${model}`);
    if (!votes) return model;
    return [...votes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  };
  const targetsOfAc = (make, acName, year) => {
    const targets = new Set();
    for (const r of acIndex.get(`${make}|${acName}`) ?? []) {
      if (year < r.from || year > r.to) continue;
      if (r.relation === "member") targets.add(r.canonical);
      else if (r.relation === "split") {
        targets.add(acName);
        targets.add(r.canonical);
      } else targets.add(r.relation === "same" ? r.canonical : acName);
    }
    if (targets.size === 0) targets.add(acName);
    return [...targets];
  };

  /** "<make>|<entry>" -> { make, model, years, types, rows: Map(year -> AC rows), vendor: Map(year -> rows) } */
  const entries = new Map();
  const entry = (make, model) => {
    const key = `${make}|${model}`;
    let item = entries.get(key);
    if (!item) {
      item = { make, model, years: new Set(), types: new Set(), rows: new Map(), vendor: new Map(), ours: false };
      entries.set(key, item);
    }
    return item;
  };
  for (const v of vehicles) {
    const item = entry(v.make, entryOfOurs(v.make, v.model));
    item.ours = true;
    for (const year of v.yearSet) item.years.add(year);
    for (const type of splitList(v.types)) item.types.add(type);
  }
  for (const row of acRows) {
    const make = canonMake(row.make);
    const year = Number(row.year);
    for (const target of targetsOfAc(make, row.model, year)) {
      const item = entry(make, target);
      item.years.add(year);
      if (!item.ours) for (const c of splitList(row.classes)) item.types.add(c);
      if (row.bolt_patterns !== "" || row.tire_sizes !== "" || row.wheel_sizes !== "") {
        if (!item.rows.has(year)) item.rows.set(year, []);
        item.rows.get(year).push(row);
      }
    }
  }

  /* Alias map: only same + member names, never an entry itself, never chained. */
  const aliasVotes = new Map();
  for (const row of aliasRows) {
    if (row.relation !== "same" && row.relation !== "member") continue;
    if (row.model === row.canonical_model) continue;
    const key = `${row.canonical_make}|${row.model}`;
    if (!aliasVotes.has(key)) aliasVotes.set(key, new Map());
    const votes = aliasVotes.get(key);
    const span = Number(row.year_to) - Number(row.year_from) + 1;
    votes.set(row.canonical_model, (votes.get(row.canonical_model) ?? 0) + span);
  }
  const aliases = {};
  const aliasStats = { total: 0, shadowedByEntry: 0, conflicts: 0 };
  for (const [key, votes] of aliasVotes) {
    const [make] = key.split("|");
    if (entries.has(key)) {
      aliasStats.shadowedByEntry += 1;
      continue;
    }
    const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (ranked.length > 1) aliasStats.conflicts += 1;
    aliases[key] = `${make}|${ranked[0][0]}`;
    aliasStats.total += 1;
  }
  const resolveName = (make, model) => {
    const key = `${canonMake(make)}|${model}`;
    return entries.has(key) ? key : (aliases[key] ?? key);
  };

  /* Vendor, maker and web gap fills (optional): the same columns plus `source`. */
  let vendorUsed = 0;
  const vendorUnmatched = [];
  for (const row of vendorRows) {
    const key = resolveName(row.make, row.model);
    const item = entries.get(key);
    if (!item) {
      vendorUnmatched.push(`${row.make} ${row.model} ${row.year}`);
      continue;
    }
    const year = Number(row.year);
    if (!Number.isInteger(year)) continue;
    item.years.add(year);
    if (!item.vendor.has(year)) item.vendor.set(year, []);
    item.vendor.get(year).push(row);
    vendorUsed += 1;
  }

  return { entries, aliases, aliasStats, entryOfOurs, resolveName, canonMake, counts: { ac: acRows.length, vendorUsed, vendorUnmatched } };
}

/** What the gap fill did: fields filled into Auto Country rows, and years it stood in for. */
const gapStats = { filledFields: {}, filledYears: 0, standaloneYears: {}, standaloneRows: 0 };
const TRUST = ["d", "p", "m", "s", "w"];

/**
 * One record per entry year (ten `;`-joined fields), consecutive equal years
 * collapsed. Auto Country's fields are never overwritten: a vendor, maker or
 * web row (`source` d p m s w, a trailing 1 for one source) only fills a blank,
 * or stands in for a year Auto Country lacks.
 */
function specsFor(item) {
  const years = [...new Set([...item.rows.keys(), ...item.vendor.keys()])].sort((a, b) => a - b);
  const parts = [];
  for (const year of years) {
    const acRows = item.rows.get(year) ?? [];
    const fromAc = acRows.length > 0 ? mergeRows(acRows, item.model) : null;
    const vendorRows = item.vendor.get(year) ?? [];
    let fields = fromAc;
    let source = "a";
    if (vendorRows.length > 0) {
      const sourceOf = (r) => /^([dpmsw])(1?)$/.exec(r.source ?? "") ?? ["", "w", ""];
      const letters = [...new Set(vendorRows.map((r) => sourceOf(r)[1]))].sort(
        (a, b) => TRUST.indexOf(a) - TRUST.indexOf(b),
      );
      const vendor = mergeRows(vendorRows);
      if (fields === null) {
        fields = vendor;
        const single = vendorRows.length === 1 && sourceOf(vendorRows[0])[2] === "1";
        source = `${letters.join("")}${single ? "1" : ""}`;
        gapStats.standaloneRows += 1;
        for (const letter of letters) gapStats.standaloneYears[letter] = (gapStats.standaloneYears[letter] ?? 0) + 1;
      } else {
        fields = { ...fields };
        let filled = false;
        for (const name of SPEC_FIELDS) {
          if (fields[name] === "" && vendor[name] !== "") {
            fields[name] = vendor[name];
            filled = true;
            for (const letter of letters) gapStats.filledFields[letter] = (gapStats.filledFields[letter] ?? 0) + 1;
          }
        }
        if (filled) gapStats.filledYears += 1;
      }
    }
    if (fields === null || SPEC_FIELDS.every((name) => fields[name] === "")) continue;
    const record = [...SPEC_FIELDS.map((name) => fields[name]), source].join(";");
    const last = parts[parts.length - 1];
    if (last && last.record === record && last.to === year - 1) last.to = year;
    else parts.push({ from: year, to: year, record });
  }
  return parts.map((p) => `${p.from}-${p.to}:${p.record}`).join(" ");
}

/**
 * Every make + model + year where an Auto Country value disagrees with what
 * the older committed sheets say. Auto Country wins at runtime; this is the
 * list of what changed (D155: "if there is any disagreement ... put auto
 * country data first", owner 2026-10-06).
 */
async function writeOverrides(names, generations, threads, wheelSizes) {
  const { entries, entryOfOurs } = names;
  const rows = [];
  const exactRows = parseCsv(await readFile(FITMENT, "utf8"));
  /** "<entry key>|<year>" -> list of { field, value, source } the older sheets state */
  const existing = new Map();
  const add = (make, model, year, field, value, source) => {
    if (value === "" || value === undefined) return;
    const key = `${make}|${entryOfOurs(make, model)}|${year}`;
    if (!existing.has(key)) existing.set(key, []);
    existing.get(key).push({ field, value, source });
  };
  for (const row of exactRows) {
    const year = Number(row.year);
    add(row.make, row.model, year, "bolt", row.bolt_pattern, "vehicle-fitment.csv (ANKUSI, exact year)");
    add(row.make, row.model, year, "bore", row.centre_bore_mm, "vehicle-fitment.csv (ANKUSI, exact year)");
    if (row.oe_wheel_diameter !== "" && row.oe_wheel_width !== "") {
      add(row.make, row.model, year, "wheel", `${Number(row.oe_wheel_diameter)}x${Number(row.oe_wheel_width)}`, "vehicle-fitment.csv (ANKUSI, exact year)");
    }
  }
  for (const gen of generations) {
    for (let year = gen.from; year <= gen.to; year += 1) {
      if (gen.bolt !== null) add(gen.make, gen.model, year, "bolt", gen.bolt, "vehicle-fitment-generations.csv");
      add(gen.make, gen.model, year, "bore", gen.bore, "vehicle-fitment-generations.csv");
    }
  }
  for (const t of threads) {
    for (let year = t.from; year <= t.to; year += 1) {
      add(t.make, t.model, year, "thread", t.thread, "vehicle-thread-generations.csv");
      add(t.make, t.model, year, "fastener", t.fastener === "nut" ? "n" : "b", "vehicle-thread-generations.csv");
    }
  }
  for (const w of wheelSizes) {
    for (let year = w.from; year <= w.to; year += 1) {
      for (const size of w.sizes) add(w.make, w.model, year, "wheel", size.replace(";", ""), "vehicle-wheel-sizes.csv");
    }
  }
  for (const item of entries.values()) {
    for (const [year, acRows] of item.rows) {
      const ac = mergeRows(acRows, item.model);
      const known = existing.get(`${item.make}|${item.model}|${year}`) ?? [];
      const seen = new Set();
      for (const fact of known) {
        let differs = false;
        let shown = "";
        if (fact.field === "bolt") {
          differs = ac.bolts !== "" && !ac.bolts.split(",").includes(fact.value);
          shown = ac.bolts;
        } else if (fact.field === "bore") {
          differs = ac.bore !== "" && Math.abs(Number(ac.bore) - Number(fact.value)) > 0.15;
          shown = ac.bore;
        } else if (fact.field === "thread") {
          differs = ac.thread !== "" && ac.thread !== fact.value;
          shown = ac.thread;
        } else if (fact.field === "fastener") {
          differs = ac.fastener !== "" && ac.fastener !== fact.value;
          shown = ac.fastener;
        } else if (fact.field === "wheel") {
          differs = ac.wheels !== "" && !ac.wheels.split(",").includes(fact.value);
          shown = ac.wheels;
        }
        if (!differs) continue;
        const id = `${fact.field}|${fact.value}|${fact.source}`;
        if (seen.has(id)) continue;
        seen.add(id);
        rows.push({
          make: item.make, model: item.model, year, field: fact.field,
          auto_country: shown, existing: fact.value, existing_source: fact.source,
        });
      }
    }
  }
  rows.sort((a, b) => a.make.localeCompare(b.make) || a.model.localeCompare(b.model) || a.year - b.year || a.field.localeCompare(b.field));
  await mkdir(path.dirname(OVERRIDES), { recursive: true });
  await writeFile(OVERRIDES, toCsv(["make", "model", "year", "field", "auto_country", "existing", "existing_source"], rows));
  return rows;
}

/* --- App modules ------------------------------------------------------------ */

const GENERATED =
  "/* GENERATED by scripts/vehicle-fitment.mjs. Do not edit: change the CSV it\n" +
  " * is built from (or the script) and re-run `node scripts/vehicle-fitment.mjs`. */\n";

async function writeListModule(names) {
  const makes = new Map();
  for (const item of names.entries.values()) {
    if (!makes.has(item.make)) makes.set(item.make, []);
    makes.get(item.make).push([item.model, yearsToText(item.years)]);
  }
  const lines = [...makes.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((make) => {
      const models = makes
        .get(make)
        .sort((a, b) => a[0].localeCompare(b[0], "en", { numeric: true }))
        .map(([model, years]) => `[${JSON.stringify(model)}, ${JSON.stringify(years)}]`)
        .join(", ");
      return `  [${JSON.stringify(make)}, [${models}]],`;
    });
  await writeFile(
    LIST_MODULE,
    `${GENERATED}
/**
 * Every make the finder offers, each with its models and the model years each
 * was built ("2005-2011;2019-2027"): the union of Auto Country's list and
 * scripts/data/vehicles.csv (NHTSA vPIC, D110), in canonical names (D155; see
 * scripts/data/vehicle-aliases.csv). Makes A to Z; models in natural order.
 * Client-safe: no fitment.
 */
export const VEHICLE_LIST: ReadonlyArray<
  readonly [make: string, models: ReadonlyArray<readonly [model: string, years: string]>]
> = [
${lines.join("\n")}
];
`,
  );
}

/**
 * One exact-year value: `<bolt>[/<bore>[/<diameter>/<width>]]`. A blank bore
 * keeps its slot (`5x114.3//17/7.0`) so the factory rim size can follow it.
 * The rim size is the one ANKUSI publishes for that year (same front and
 * rear, one size); it feeds the tire fit (`finder/fitment.ts`).
 */
function exactFit(row) {
  const rim = row.oe_wheel_diameter !== "" && row.oe_wheel_width !== "";
  const parts = [row.bolt_pattern, row.centre_bore_mm];
  if (rim) parts.push(row.oe_wheel_diameter, row.oe_wheel_width);
  while (parts.length > 1 && parts[parts.length - 1] === "") parts.pop();
  return parts.join("/");
}

async function writeFitmentModule(generations, threads, names, wheelSizes) {
  /* Every older sheet is keyed by the canonical entry name, so one key finds all
     sources for a car (D155). Two of our models that are one entry share a key. */
  const keyOf = (make, model) => `${make}|${names.entryOfOurs(make, model)}`;
  const rows = parseCsv(await readFile(FITMENT, "utf8"));
  const byVehicle = new Map();
  for (const row of rows) {
    const key = keyOf(row.make, row.model);
    if (!byVehicle.has(key)) byVehicle.set(key, new Map());
    const years = byVehicle.get(key);
    if (!years.has(row.year)) years.set(row.year, exactFit(row));
  }
  const lines = [...byVehicle.entries()].map(
    ([key, years]) =>
      `  ${JSON.stringify(key)}: ${JSON.stringify([...years].map(([year, fit]) => `${year}:${fit}`).join(" "))},`,
  );
  const byGeneration = new Map();
  for (const gen of generations) {
    const key = keyOf(gen.make, gen.model);
    if (!byGeneration.has(key)) byGeneration.set(key, []);
    byGeneration
      .get(key)
      .push({ gen, text: `${gen.from}-${gen.to}:${gen.bolt === null ? "?" : `${gen.bolt}${gen.bore === "" ? "" : `/${gen.bore}`}`}` });
  }
  const generationLines = [...byGeneration.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => {
      list.sort((a, b) => a.gen.from - b.gen.from);
      return `  ${JSON.stringify(key)}: ${JSON.stringify(list.map((item) => item.text).join(" "))},`;
    });
  const byThread = new Map();
  for (const row of threads) {
    const key = keyOf(row.make, row.model);
    if (!byThread.has(key)) byThread.set(key, []);
    byThread.get(key).push({ from: row.from, text: `${row.from}-${row.to}:${row.thread}/${row.fastener === "nut" ? "n" : "b"}` });
  }
  const threadLines = [...byThread.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => {
      list.sort((a, b) => a.from - b.from);
      return `  ${JSON.stringify(key)}: ${JSON.stringify(list.map((item) => item.text).join(" "))},`;
    });
  const bySizes = new Map();
  for (const row of wheelSizes) {
    const key = keyOf(row.make, row.model);
    if (!bySizes.has(key)) bySizes.set(key, []);
    bySizes.get(key).push({ from: row.from, text: `${row.from}-${row.to}:${row.sizes.join(",")}` });
  }
  const sizeLines = [...bySizes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => {
      list.sort((a, b) => a.from - b.from);
      return `  ${JSON.stringify(key)}: ${JSON.stringify(list.map((item) => item.text).join(" "))},`;
    });
  const typeLines = [...names.entries.values()]
    .map((item) => [`${item.make}|${item.model}`, ["car", "mpv", "truck"].filter((t) => item.types.has(t)).join(";")])
    .filter(([, types]) => types !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, types]) => `  ${JSON.stringify(key)}: ${JSON.stringify(types)},`);
  const specLines = [...names.entries.values()]
    .map((item) => [`${item.make}|${item.model}`, specsFor(item)])
    .filter(([, text]) => text !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, text]) => `  ${JSON.stringify(key)}: ${JSON.stringify(text)},`);
  const aliasLines = Object.entries(names.aliases)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`);
  await writeFile(
    FITMENT_MODULE,
    `${GENERATED}
/**
 * Real wheel fitment per vehicle and model year, from
 * scripts/data/vehicle-fitment.csv (ANKUSI wheel fitment dataset, LA-05).
 * Keyed "<Make>|<Model>" in the canonical spelling of \`vehicle-list.ts\`
 * (D155: where Auto Country's name won, our old name resolves through
 * \`VEHICLE_ALIASES\`); each value is a
 * space-separated list of "<year>:<bolt pattern>[/<centre bore mm>[/<diameter>/<width>]]".
 * Only the years the source publishes; a missing year has no row on purpose.
 * Server only: read through \`fitment.ts\`, never from a client island.
 */
export const VEHICLE_FITMENT_DATA: Readonly<Record<string, string>> = {
${lines.join("\n")}
};

/**
 * Real wheel fitment per vehicle and generation year range, from
 * scripts/data/vehicle-fitment-generations.csv (hand-kept; a row needs two
 * independent free sources that agree). Same keys; each value is a
 * space-separated list of "<from>-<to>:<bolt pattern>[/<centre bore mm>]",
 * or "<from>-<to>:?" where sources disagree (no bolt pattern is claimed and
 * the placeholder is not used). An exact-year row above wins over this.
 */
export const VEHICLE_FITMENT_GENERATIONS: Readonly<Record<string, string>> = {
${generationLines.join("\n")}
};

/**
 * Lug fastener per vehicle and year range, from
 * scripts/data/vehicle-thread-generations.csv (hand-kept; two independent free
 * sources agree). Same keys; each value is a space-separated list of
 * "<from>-<to>:<thread>/<n|b>" (n = lug nut, b = lug bolt). A vehicle with no
 * entry narrows no lug nut.
 */
export const VEHICLE_THREADS: Readonly<Record<string, string>> = {
${threadLines.join("\n")}
};

/**
 * Every factory wheel size per vehicle and year range, the union across trims,
 * from scripts/data/vehicle-wheel-sizes.csv (hand-kept). Same keys; each value
 * is a space-separated list of "<from>-<to>:<DxW>,<DxW>" (inches, \`16x7\`). It
 * adds to the single size ANKUSI states, which comes from one trim.
 */
export const VEHICLE_WHEEL_SIZES: Readonly<Record<string, string>> = {
${sizeLines.join("\n")}
};

/**
 * vPIC's body classes per vehicle ("car", "mpv", "truck", joined by ";"),
 * which set how tall a tire the finder offers for the car (the tire fit,
 * \`fitment.ts\`). Same keys.
 */
export const VEHICLE_TYPES: Readonly<Record<string, string>> = {
${typeLines.join("\n")}
};

/**
 * Auto Country's lookup (D155), one entry of \`vehicle-list.ts\` per key:
 * "<Make>|<Model>" in canonical spelling -> space-separated
 * "<from>-<to>:<record>" (consecutive years with an identical record collapsed;
 * only years a source states). A record is ten ";"-joined fields, empty = unknown:
 * bolts (comma list, "5x114.3,5x120" = trims differ), bore mm, thread ("12x1.5",
 * "1/2x20"), fastener (n stud and nut, b hub bolt), offset mm, tires (comma list,
 * union across trims, bodies and axles, flotation as "33x12.50R15"), wheels
 * (comma list "16x6.5,17x7"), tireRange ("dmin,dmax,wmin,wmax": overall tire
 * diameter in and section width mm at stock height), wheelRange
 * ("dmin,dmax,wmin,wmax,omin,omax": diameter in, width in, offset mm), and src
 * (a Auto Country, d Direct Auto Import, p PRO WHEELS, m maker, s older sheets,
 * w other web; a trailing 1 = one source). Server only; read through \`fitment.ts\`.
 */
export const VEHICLE_SPECS: Readonly<Record<string, string>> = {
${specLines.join("\n")}
};

/**
 * "<Make>|<other spelling>" -> "<Make>|<canonical model>": our old names (where
 * Auto Country's name won) and Auto Country's variant names (where our family
 * name stayed), so old URLs and both lists' spellings resolve. Never chains and
 * never names an entry that exists in \`vehicle-list.ts\`.
 */
export const VEHICLE_ALIASES: Readonly<Record<string, string>> = {
${aliasLines.join("\n")}
};
`,
  );
}

/* --- Main ----------------------------------------------------------------- */

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? null : (args[index + 1] ?? null);
};

const vehicles = await readVehicles();
const ankusiPath = option("--ankusi");
if (ankusiPath !== null) {
  await buildFitment(ankusiPath, option("--review") ?? DEFAULT_REVIEW, vehicles);
}
const generations = await readGenerations(vehicles);
const { conflicts, shadowed } = await reportGenerationConflicts(generations, vehicles);
console.log(
  `${GENERATIONS}: ${generations.length} generation rows, ` +
    `${new Set(generations.map((g) => `${g.make}|${g.model}`)).size} models; ` +
    `${shadowed} offered years also have an exact row (exact wins), ${conflicts} of them disagree.`,
);
const names = await buildEntries(vehicles);
await writeListModule(names);
const threads = await readThreads(vehicles);
console.log(`${THREADS}: ${threads.length} thread rows, ${new Set(threads.map((t) => `${t.make}|${t.model}`)).size} models.`);
const wheelSizes = await readWheelSizes(vehicles);
console.log(`${WHEEL_SIZES}: ${wheelSizes.length} wheel-size rows, ${new Set(wheelSizes.map((t) => `${t.make}|${t.model}`)).size} models.`);
await writeFitmentModule(generations, threads, names, wheelSizes);
const overrides = await writeOverrides(names, generations, threads, wheelSizes);
const byField = {};
for (const row of overrides) byField[row.field] = (byField[row.field] ?? 0) + 1;
const specCount = [...names.entries.values()].filter((item) => item.rows.size > 0 || item.vendor.size > 0).length;
console.log(
  `entries: ${names.entries.size} (vehicles.csv models: ${vehicles.length}); ${specCount} with Auto Country or gap-fill specs; ` +
    `aliases: ${names.aliasStats.total} (${names.aliasStats.shadowedByEntry} left out because the name is itself an entry, ` +
    `${names.aliasStats.conflicts} names mapped to different entries in different years); ${names.counts.ac} Auto Country model-years, ` +
    `${names.counts.vendorUsed} gap-fill rows used, ${names.counts.vendorUnmatched.length} rows named no entry` +
    `${names.counts.vendorUnmatched.length ? ` (${names.counts.vendorUnmatched.slice(0, 8).join("; ")})` : ""}.`,
);
console.log(
  `gap fill: ${gapStats.standaloneRows} entry-years stand alone (no Auto Country row) by source letter ` +
    `${JSON.stringify(gapStats.standaloneYears)}; ${gapStats.filledYears} Auto Country entry-years had blanks filled, ` +
    `fields by source letter ${JSON.stringify(gapStats.filledFields)}.`,
);
console.log(`${OVERRIDES}: ${overrides.length} overrides ${JSON.stringify(byField)}`);
console.log(`wrote ${LIST_MODULE} and ${FITMENT_MODULE}`);
