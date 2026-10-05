/* ---------------------------------------------------------------------------
   Regenerates `catalogue.csv` (the e2e fixture) from a full built catalogue.

     node tests/fixture/pick-catalogue.mjs <full catalogue.csv> [out.csv]

   Only needed when the importer's columns change (D142 added two) or the
   fixture needs other products; the committed `catalogue.csv` is what the
   suite loads. The full file comes from `npm run catalog:build-csv`.

   The pick is deterministic, so a rerun on the same input gives the same
   file. What it keeps (and why the specs need it):
     tires        Zeta Antarctica Sport in five sizes (the specs' PDP and the
                  Other sizes row), ten more brands in two or three sizes each
                  (the brand list folds past eight), every season, a
                  flotation size, one winter tire with the 3PMSF mark;
     wheels       Touren and Spec-1 where the file has them, the 5x114.3 and
                  6x139.7 patterns, several diameters and finishes;
     accessories  Lug nuts (with thread sizes), lug bolts, wheel locks, centre
                  caps, hub rings, TPMS, one with no brand;
     every vendor price is replaced by 100.00 (vendor prices are staff-only data).
   --------------------------------------------------------------------------- */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "csv-parse/sync";

const here = dirname(fileURLToPath(import.meta.url));
const [, , source, out = join(here, "catalogue.csv")] = process.argv;
if (!source) {
  console.error("usage: node tests/fixture/pick-catalogue.mjs <full catalogue.csv> [out.csv]");
  process.exit(1);
}

const text = readFileSync(source, "utf8");
const rows = parse(text, { columns: true, skip_empty_lines: true });
const header = Object.keys(rows[0]);

const picked = new Map();
const take = (row) => picked.set(row.row_id, row);
const by = (category) => rows.filter((r) => r.category === category);
const distinct = (list, key) => [...new Set(list.map(key))];

/* ---- tires ---- */
const tires = by("tires");
for (const r of tires.filter((r) => r.brand === "Zeta" && r.model === "Antarctica Sport").slice(0, 5)) take(r);
for (const r of tires.filter((r) => r.brand === "Zeta" && r.model !== "Antarctica Sport").slice(0, 4)) take(r);

const brandOrder = distinct(tires, (r) => r.brand).filter((b) => b && b !== "Zeta").sort();
let seasons = new Set();
for (const brand of brandOrder) {
  if (picked.size >= 46) break;
  const ofBrand = tires.filter((r) => r.brand === brand);
  // The model with the most sizes, so "Other sizes" has something to show.
  const models = distinct(ofBrand, (r) => r.model);
  const model = models.sort((a, b) =>
    ofBrand.filter((r) => r.model === b).length - ofBrand.filter((r) => r.model === a).length || (a < b ? -1 : 1),
  )[0];
  const sizes = ofBrand.filter((r) => r.model === model).slice(0, 3);
  // Prefer a season not yet seen.
  if (seasons.size < 4 && sizes[0] && seasons.has(sizes[0].season)) {
    const alt = ofBrand.find((r) => !seasons.has(r.season));
    if (alt) {
      for (const r of ofBrand.filter((x) => x.model === alt.model).slice(0, 3)) take(r);
      seasons.add(alt.season);
      continue;
    }
  }
  for (const r of sizes) take(r);
  if (sizes[0]) seasons.add(sizes[0].season);
}
take(tires.find((r) => /x/i.test(r.tire_size) && r.brand !== "Zeta"));
take(tires.find((r) => r.winter_approved === "yes" && r.season === "winter"));
take(tires.find((r) => r.mud_snow === "yes"));

/* ---- wheels ---- */
const wheels = by("wheels");
for (const brand of ["Touren", "Spec-1"]) {
  for (const r of wheels.filter((r) => r.brand === brand).slice(0, 5)) take(r);
}
for (const pattern of ["5x114.3", "6x139.7", "5x120", "5x112", "8x170"]) {
  for (const r of wheels.filter((r) => r.bolt_patterns === pattern).slice(0, 3)) take(r);
}
for (const brand of distinct(wheels, (r) => r.brand).sort().slice(0, 40)) {
  if ([...picked.values()].filter((r) => r.category === "wheels").length >= 44) break;
  take(wheels.find((r) => r.brand === brand));
}

/* ---- accessories ---- */
const accessories = by("accessories");
const accessoryPlan = [
  ["Lug Nuts", 8, (r) => r.thread_size],
  ["Lug Bolts", 3],
  ["Wheel Locks", 3],
  ["Center Caps", 5],
  ["Hub Rings", 4],
  ["TPMS Sensors & Tools", 4],
  ["Wheel Spacers", 2],
  ["Valves & Caps", 2],
];
for (const [type, n, filter = () => true] of accessoryPlan) {
  for (const r of accessories.filter((r) => r.accessory_type === type && r.brand && filter(r)).slice(0, n)) take(r);
}
take(accessories.find((r) => !r.brand));

/* Vendor prices are staff-only data (D125) and have no business in a committed
   file: every source price becomes a plain 100.00. The importer needs one. */
for (const r of picked.values()) {
  for (const key of Object.keys(r)) if (/^source_price_\d+$/.test(key) && r[key]) r[key] = "100.00";
}

const quote = (value) => (/[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);
const lines = [header.join(",")];
for (const r of picked.values()) lines.push(header.map((h) => quote(r[h] ?? "")).join(","));
writeFileSync(out, `${lines.join("\n")}\n`);
const count = (c) => [...picked.values()].filter((r) => r.category === c).length;
console.log(`${picked.size} rows -> ${out}  (tires ${count("tires")}, wheels ${count("wheels")}, accessories ${count("accessories")})`);
