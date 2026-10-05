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

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const VEHICLES = "scripts/data/vehicles.csv";
const FITMENT = "scripts/data/vehicle-fitment.csv";
const GENERATIONS = "scripts/data/vehicle-fitment-generations.csv";
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

/** Sites whose data is Wheel-Size's, or whose terms ban what this does. Owner, 2026-10-05. */
const BANNED_SOURCES = [
  "wheel-size.com", "wheel-sizes.com", "tirerack.com", "tiresize.com", "teoalida.com",
  "faultpedia.com",
  /* Its make list (Aiways, Arcfox, Avatr, Ciimo, Dorcen ...) is Wheel-Size's
     own, so its data is treated as Wheel-Size-derived (LA-05, 2026-10-05). */
  "tirewheelguide.com",
];

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

/* --- App modules ------------------------------------------------------------ */

const GENERATED =
  "/* GENERATED by scripts/vehicle-fitment.mjs. Do not edit: change the CSV it\n" +
  " * is built from (or the script) and re-run `node scripts/vehicle-fitment.mjs`. */\n";

async function writeListModule(vehicles) {
  const makes = new Map();
  for (const v of vehicles) {
    if (!makes.has(v.make)) makes.set(v.make, []);
    makes.get(v.make).push([v.model, v.years]);
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
 * was built ("2005-2011;2019-2027"), from scripts/data/vehicles.csv (NHTSA
 * vPIC, D110). Makes A to Z; models in natural order. Client-safe: no fitment.
 */
export const VEHICLE_LIST: ReadonlyArray<
  readonly [make: string, models: ReadonlyArray<readonly [model: string, years: string]>]
> = [
${lines.join("\n")}
];
`,
  );
}

async function writeFitmentModule(generations) {
  const rows = parseCsv(await readFile(FITMENT, "utf8"));
  const byVehicle = new Map();
  for (const row of rows) {
    const key = `${row.make}|${row.model}`;
    if (!byVehicle.has(key)) byVehicle.set(key, []);
    byVehicle
      .get(key)
      .push(`${row.year}:${row.bolt_pattern}${row.centre_bore_mm === "" ? "" : `/${row.centre_bore_mm}`}`);
  }
  const lines = [...byVehicle.entries()].map(
    ([key, years]) => `  ${JSON.stringify(key)}: ${JSON.stringify(years.join(" "))},`,
  );
  const byGeneration = new Map();
  for (const gen of generations) {
    const key = `${gen.make}|${gen.model}`;
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
  await writeFile(
    FITMENT_MODULE,
    `${GENERATED}
/**
 * Real wheel fitment per vehicle and model year, from
 * scripts/data/vehicle-fitment.csv (ANKUSI wheel fitment dataset, LA-05).
 * Keyed "<Make>|<Model>" as vehicles.csv spells them; each value is a
 * space-separated list of "<year>:<bolt pattern>[/<centre bore mm>]". Only
 * the years the source publishes; a missing year has no row on purpose.
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
await writeListModule(vehicles);
await writeFitmentModule(generations);
console.log(`wrote ${LIST_MODULE} and ${FITMENT_MODULE}`);
