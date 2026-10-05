/**
 * Merges the gap-fill sheets for the vehicle finder's fit data (D155) into
 * scripts/data/vehicle-fitment-vendors.csv, the file `vehicle-fitment.mjs` reads
 * to fill what Auto Country left blank.
 *
 *   node scripts/vehicle-fitment-merge-gaps.mjs <folder>
 *
 * <folder> holds gapfill-*.csv (every file whose name starts `gapfill-` and ends
 * `.csv`, the vendor sheet `gapfill-vendor.csv` included). Header of each input:
 *   make,model,year,bolt_patterns,centre_bore,thread,fastener,offset,tire_sizes,
 *   wheel_sizes,source,source_url,source_url_2,note
 * `source` is a letter, then `1` when one source supports the row: d Direct Auto
 * Import lookup, p PRO WHEELS lookup, m the maker's own page, s our own sheets,
 * w any other website. Safe to re-run: the output is rebuilt from the inputs.
 *
 * Rule (owner, 2026-10-06, verbatim: "A value with one source only: load it
 * directly."; trust order: Auto Country first, then "the other vendors' public
 * lookups, then the car maker's own pages and manuals, then our existing
 * committed sheets, then any other website"): for each make + model + year and
 * each field, the value comes from the highest-trust row that states it,
 * d > p > m > s > w; at equal letter a row with two sources beats a single one;
 * a remaining tie goes to the first row read. A cell holding several values
 * (`;`-joined, in bolt-pattern order) keeps its first value for the centre bore,
 * thread and fastener (the family's base model); every bolt pattern, tire size
 * and wheel size stays. Auto Country is not read here: `vehicle-fitment.mjs`
 * only lets a gap fill fill a blank.
 *
 * Output rows: one per input row that won at least one field, holding only the
 * fields it won (so each field keeps its own source, source_url and note).
 * Values are cleaned like Auto Country's: `ZR` tire sizes read `R`, decimal
 * wheel diameters are kept, `M12x1.5` reads `12x1.5`, an inch thread reads
 * `1/2x20` (UNF), and a bolt pattern with ten or more lugs (centre-lock
 * placeholders; the 10x225 and 10x335 dually patterns stay) or a bore of 0 is
 * dropped and listed. Reports, git-ignored, in import-report/:
 *   vehicle-gapfill-empty.csv     rows that state no fact (note "no NA car")
 *   vehicle-gapfill-conflicts.csv a field two sources state differently
 *   vehicle-gapfill-dropped.csv   values dropped as junk or unreadable
 */

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = "scripts/data/vehicle-fitment-vendors.csv";
const REPORT = "import-report";
const HEADER = [
  "make", "model", "year", "bolt_patterns", "centre_bore", "thread", "fastener", "offset",
  "tire_sizes", "wheel_sizes", "source", "source_url", "source_url_2", "note",
];
const FIELDS = ["bolt_patterns", "centre_bore", "thread", "fastener", "offset", "tire_sizes", "wheel_sizes"];
const RANK = { d: 4, p: 3, m: 2, s: 1, w: 0 };

/* --- CSV (same reader and writer as the other scripts) -------------------------- */

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
        } else quoted = false;
      } else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
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
const csvCell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const toCsv = (header, rows) =>
  `${[header, ...rows.map((row) => header.map((key) => row[key]))]
    .map((cells) => cells.map(csvCell).join(","))
    .join("\n")}\n`;

/* --- Cleaning ------------------------------------------------------------------- */

const num = (value) => String(Number(Number(value).toFixed(2)));
const UNF_PITCH = { "3/8": 24, "7/16": 20, "1/2": 20, "9/16": 18, "5/8": 18 };

const dropped = [];
function clean(row, field, value) {
  const drop = (reason) => {
    dropped.push({ make: row.make, model: row.model, year: row.year, field, raw_value: value, reason });
    return "";
  };
  const list = (text) => text.split(";").map((part) => part.trim()).filter(Boolean);
  switch (field) {
    case "bolt_patterns": {
      const out = [];
      for (const part of list(value)) {
        const match = /^(\d{1,2})x(\d{2,3}(?:\.\d{1,2})?)$/.exec(part);
        if (!match) {
          drop("not <lugs>x<pcd>");
          continue;
        }
        if (Number(match[1]) >= 10 && !/^10x(225|335)$/.test(part)) {
          drop("ten or more lugs: centre-lock or junk");
          continue;
        }
        out.push(`${match[1]}x${num(match[2])}`);
      }
      return [...new Set(out)].join(";");
    }
    case "centre_bore": {
      const first = list(value)[0];
      if (first === undefined) return "";
      return Number(first) > 0 ? num(first) : drop("bore of 0 or not a number");
    }
    case "thread": {
      const first = list(value)[0];
      if (first === undefined) return "";
      const metric = /^M?(\d{1,2})x(\d(?:\.\d+)?)$/i.exec(first);
      if (metric) return `${metric[1]}x${metric[2]}`;
      const inch = /^(\d{1,2}\/\d{1,2})(?:\s*UNF)?$/i.exec(first);
      if (inch && UNF_PITCH[inch[1]]) return `${inch[1]}x${UNF_PITCH[inch[1]]}`;
      return drop("unreadable thread");
    }
    case "fastener": {
      const first = list(value)[0];
      if (first === undefined) return "";
      return first === "nut" || first === "bolt" ? first : drop('fastener is not "nut" or "bolt"');
    }
    case "offset": {
      return Number.isFinite(Number(value)) ? String(Math.round(Number(value))) : drop("offset is not a number");
    }
    case "tire_sizes": {
      const out = [];
      for (const part of list(value)) {
        const metric = /^(?:P|LT|ST|T)?(\d{3})\/(\d{2,3})\s*Z?R(\d{2}(?:\.\d)?)/i.exec(part);
        const flot = /^(\d{2}(?:\.\d)?)x(\d{1,2}(?:\.\d{1,2})?)\s*R(\d{2}(?:\.\d)?)/i.exec(part);
        if (metric) out.push(`${metric[1]}/${metric[2]}R${num(metric[3])}`);
        else if (flot) out.push(`${num(flot[1])}x${Number(flot[2]).toFixed(2)}R${num(flot[3])}`);
        else drop("unreadable tire size");
      }
      return [...new Set(out)].join(";");
    }
    case "wheel_sizes": {
      const out = [];
      for (const part of list(value)) {
        const match = /^(\d{2}(?:\.\d)?)\s*x\s*(\d{1,2}(?:\.\d{1,2})?)/i.exec(part);
        /* A few sheets write width first (8.5x20): swap when the first number is
           a width and the second a diameter. */
        const swapped = /^(\d{1,2}(?:\.\d{1,2})?)\s*x\s*(\d{2}(?:\.\d)?)$/i.exec(part);
        if (match) out.push(`${num(match[1])}x${num(match[2])}`);
        else if (swapped && Number(swapped[1]) <= 14 && Number(swapped[2]) >= 15) out.push(`${num(swapped[2])}x${num(swapped[1])}`);
        else drop("unreadable wheel size");
      }
      return [...new Set(out)].join(";");
    }
    default:
      return value;
  }
}

/* --- Main ----------------------------------------------------------------------- */

const folder = process.argv[2];
if (!folder) {
  console.error("usage: node scripts/vehicle-fitment-merge-gaps.mjs <folder with gapfill-*.csv>");
  process.exit(1);
}
const files = (await readdir(folder)).filter((n) => /^gapfill-.*\.csv$/.test(n)).sort();
if (files.length === 0) throw new Error(`no gapfill-*.csv in ${folder}`);

/** "<make>|<model>|<year>" -> input rows in read order */
const byKey = new Map();
let inputRows = 0;
const problems = [];
for (const file of files) {
  const rows = parseCsv(await readFile(path.join(folder, file), "utf8"));
  rows.forEach((row, index) => {
    inputRows += 1;
    const source = /^([dpmsw])(1?)$/.exec(row.source);
    if (!source && row.source !== "") problems.push(`${file}:${index + 2} source "${row.source}" is not d, p, m, s or w (+ optional 1)`);
    if (!Number.isInteger(Number(row.year))) problems.push(`${file}:${index + 2} year "${row.year}"`);
    row._file = file;
    row._rank = source ? RANK[source[1]] : -1;
    row._single = source ? source[2] === "1" : true;
    row._letter = source ? source[1] : "w";
    const key = `${row.make}|${row.model}|${row.year}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(row);
  });
}
if (problems.length > 0) throw new Error(`${problems.length} problem(s):\n  ${problems.join("\n  ")}`);

const out = [];
const empty = [];
const conflicts = [];
const wonByLetter = {};
for (const [key, rows] of byKey) {
  const [make, model, year] = key.split("|");
  /** winning row -> the fields it won */
  const won = new Map();
  let anyFact = false;
  for (const field of FIELDS) {
    const candidates = rows
      .map((row) => ({ row, value: row[field] === "" ? "" : clean(row, field, row[field]) }))
      .filter((c) => c.value !== "");
    if (candidates.length === 0) continue;
    anyFact = true;
    candidates.sort(
      (a, b) => b.row._rank - a.row._rank || Number(a.row._single) - Number(b.row._single),
    );
    const winner = candidates[0];
    for (const other of candidates.slice(1)) {
      if (other.value !== winner.value) {
        conflicts.push({
          make, model, year, field, winner_source: winner.row.source, winner_value: winner.value,
          other_source: other.row.source, other_value: other.value,
        });
      }
    }
    if (!won.has(winner.row)) won.set(winner.row, {});
    won.get(winner.row)[field] = winner.value;
    wonByLetter[winner.row._letter] = (wonByLetter[winner.row._letter] ?? 0) + 1;
  }
  if (!anyFact) {
    for (const row of rows) empty.push({ make, model, year, source: row.source, from: row._file, note: row.note });
    continue;
  }
  for (const [row, fields] of won) {
    out.push({
      make, model, year: Number(year),
      ...Object.fromEntries(FIELDS.map((f) => [f, fields[f] ?? ""])),
      source: row.source, source_url: row.source_url, source_url_2: row.source_url_2, note: row.note,
    });
  }
}
out.sort((a, b) => a.make.localeCompare(b.make) || a.model.localeCompare(b.model) || a.year - b.year || a.source.localeCompare(b.source));
await writeFile(OUT, toCsv(HEADER, out));
await mkdir(REPORT, { recursive: true });
await writeFile(path.join(REPORT, "vehicle-gapfill-empty.csv"), toCsv(["make", "model", "year", "source", "from", "note"], empty));
await writeFile(
  path.join(REPORT, "vehicle-gapfill-conflicts.csv"),
  toCsv(["make", "model", "year", "field", "winner_source", "winner_value", "other_source", "other_value"], conflicts),
);
await writeFile(path.join(REPORT, "vehicle-gapfill-dropped.csv"), toCsv(["make", "model", "year", "field", "raw_value", "reason"], dropped));

console.log(
  `${OUT}: ${out.length} rows from ${inputRows} input rows in ${files.length} files (${files.join(", ")}); ` +
    `${byKey.size} make+model+year; fields won by source letter ${JSON.stringify(wonByLetter)}.`,
);
console.log(
  `${empty.length} model-years state no fact (import-report/vehicle-gapfill-empty.csv), ` +
    `${conflicts.length} field conflicts between sources (vehicle-gapfill-conflicts.csv), ` +
    `${dropped.length} values dropped (vehicle-gapfill-dropped.csv).`,
);
