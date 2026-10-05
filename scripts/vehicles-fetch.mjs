/**
 * Year / Make / Model list for the vehicle finder, from NHTSA vPIC.
 *
 *   node scripts/vehicles-fetch.mjs            # rewrite scripts/data/vehicles.csv
 *   node scripts/vehicles-fetch.mjs --check    # fetch, report, write nothing
 *
 * vPIC (https://vpic.nhtsa.dot.gov/api/) is free, needs no key, and is the US
 * regulator's own register of what each manufacturer built in each model
 * year. It is asked once here and never at request time: the output is a
 * committed snapshot, so a build, a page and a test never depend on NHTSA
 * being up, and a change to the list is a diff someone can read.
 *
 * What vPIC gets wrong, and what this file does about it:
 *   - its make list is every registered manufacturer, trailers and kit cars
 *     included, so only the makes in `MAKES` are asked for;
 *   - the by-name model endpoint substring-matches ("ford" returns "Bradford
 *     Built"), so models are always fetched by make ID;
 *   - the truck type runs up to chassis cabs and medium-duty trucks, and a
 *     few rows are prototypes or another market's cars: `EXCLUDED` drops them;
 *   - it files a half-ton and a heavy-duty pickup under one name
 *     ("Silverado"), and the two do not share a bolt pattern: `SPLIT` gives
 *     each its own row;
 *   - it is a US register, so a car that Canada names differently, or that
 *     only Canada got, is misnamed or missing: `RENAMED` and `ADDED` cover
 *     those.
 *
 * Every rule below is matched against vPIC's exact spelling. A rule that
 * matches nothing is reported at the end of a run, so a rule vPIC has
 * outgrown does not sit here unnoticed.
 *
 * The list carries no tire size and no bolt pattern. Bolt pattern and bore
 * are `scripts/data/vehicle-fitment.csv`, built by `vehicle-fitment.mjs`
 * from the ANKUSI dataset (LA-05); run that script after this one so the
 * finder's generated list matches. Tire size has no source yet.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const API = "https://vpic.nhtsa.dot.gov/api/vehicles";
const OUT = "scripts/data/vehicles.csv";

/** Oldest model year offered. */
const FIRST_YEAR = 2005;
/** Manufacturers register next year's models from about mid-year. */
const LAST_YEAR = new Date().getFullYear() + 1;

const TYPES = ["car", "mpv", "truck"];

/**
 * The makes the finder asks vPIC for, spelled the way the storefront shows
 * them. A make here that vPIC does not know stops the run, so a typo cannot
 * silently drop a make. Scion is not here: see `SCION`.
 */
const MAKES = [
  "Acura",
  "Alfa Romeo",
  "Audi",
  "BMW",
  "Buick",
  "Cadillac",
  "Chevrolet",
  "Chrysler",
  "Dodge",
  "Fiat",
  "Ford",
  "Genesis",
  "GMC",
  "Honda",
  "Hummer",
  "Hyundai",
  "Infiniti",
  "Jaguar",
  "Jeep",
  "Kia",
  "Land Rover",
  "Lexus",
  "Lincoln",
  "Lucid",
  "Maserati",
  "Mazda",
  "Mercedes-Benz",
  "Mercury",
  "MINI",
  "Mitsubishi",
  "Nissan",
  "Polestar",
  "Pontiac",
  "Porsche",
  "Ram",
  "Rivian",
  "Saab",
  "Saturn",
  "Smart",
  "Subaru",
  "Suzuki",
  "Tesla",
  "Toyota",
  "VinFast",
  "Volkswagen",
  "Volvo",
];

/**
 * Models the finder never offers, by make, spelled as vPIC spells them:
 * medium-duty and commercial chassis, prototypes, another market's cars, and
 * duplicate spellings of a model that is already listed.
 */
const EXCLUDED = {
  BMW: [
    "650i, Alpina B6",
    "650i, B6",
    "750i, Alpina B7",
    "750i, B7",
    "750Li, Alpina B7",
    "750Lxi, Alpina B7",
    "750xi, Alpina B7",
    "ActiveE",
  ],
  Cadillac: ["Hearse", "Limousine"],
  Chevrolet: [
    "BrightDrop",
    "Caprice Police Vehicle",
    "Kalos",
    "Matiz",
    "Onix",
    "Silverado HD",
    "Silverado LD",
    "Silverado LTD",
    "Tracker",
    "U100",
  ],
  Dodge: ["Ram Chassis Cab"],
  Fiat: ["Ducato", "Freemont"],
  Ford: ["'34", "E-450", "F-450", "F-550", "F-600", "F-650", "F-750"],
  GMC: ["Cruise Origin AV", "Sierra HD", "Sierra Limited"],
  Hyundai: ["Xcient"],
  Jeep: ["Wrangler JK"],
  "Land Rover": ["New Range Rover"],
  Pontiac: ["Matiz"],
  Ram: ["4000", "4500", "5500", "Cargo Van"],
  Rivian: ["EDV", "RCV"],
  Tesla: ["Cybercab", "Semi"],
  Toyota: ["FCHV-adv"],
  Volvo: [
    "C70 / C30",
    "Cab Behind Engine",
    "Cab Over Engine HT",
    "Cab Over Engine LT",
    "F12 w/F7 Cab",
    "F6 w/F7 Cab",
    "VS",
    "VT",
  ],
};

/**
 * `"<make>|<vPIC model>"` → the name the finder shows. Two rules landing on
 * one name merge into one row.
 */
const RENAMED = {
  "Alfa Romeo|Giulia (952)": "Giulia",
  "Dodge|Caravan/Grand Caravan": "Grand Caravan",
  "Nissan|Ariya Hatchback": "Ariya",
  "Nissan|Ariya MPV": "Ariya",
  "Nissan|Kicks MPV": "Kicks",
  "Nissan|Nissan Z": "Z",
  // Sold in Canada as the Qashqai; "Rogue Sport" is the US name.
  "Nissan|Rogue Sport": "Qashqai",
  "Toyota|COROLLA iM": "Corolla iM",
  "Toyota|Prius Prime (PHEV)": "Prius Prime",
  "Toyota|RAV4 Prime (PHEV)": "RAV4 Prime",
};

/**
 * One vPIC name that covers trucks with different bolt patterns. Each listed
 * model inherits every year of the vPIC row.
 */
const SPLIT = {
  "Chevrolet|Silverado": [
    "Silverado 1500",
    "Silverado 2500HD",
    "Silverado 3500HD",
  ],
  "Dodge|Ram": ["Ram 1500", "Ram 2500", "Ram 3500"],
  "GMC|Sierra": ["Sierra 1500", "Sierra 2500HD", "Sierra 3500HD"],
};

/** vPIC files Scion under Toyota, as "Scion tC". The finder lists it as its
 *  own make. */
const SCION = { from: "Toyota", prefix: "Scion ", make: "Scion" };

/** Canada-only models, which a US register never saw. */
const ADDED = [
  { make: "Acura", model: "CSX", years: [2006, 2011], type: "car" },
  { make: "Acura", model: "EL", years: [2005, 2005], type: "car" },
  { make: "Nissan", model: "Micra", years: [2015, 2019], type: "car" },
];

const CONCURRENCY = 6;
const RETRIES = 4;

async function getJson(url) {
  let lastError;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  throw new Error(`${url}: ${lastError?.message ?? lastError}`);
}

/** Runs `worker` over `items`, at most `CONCURRENCY` at a time. */
async function pool(items, worker) {
  let next = 0;
  const runners = Array.from({ length: CONCURRENCY }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}

/** vPIC's make IDs, by upper-cased name, across the three vehicle types. */
async function loadMakeIds() {
  const ids = new Map();
  for (const type of TYPES) {
    const body = await getJson(
      `${API}/GetMakesForVehicleType/${type}?format=json`,
    );
    for (const row of body.Results) {
      ids.set(String(row.MakeName).trim().toUpperCase(), row.MakeId);
    }
  }
  return ids;
}

const usedRules = new Set();

/**
 * Where one vPIC row lands in the finder's list: nowhere (excluded), under
 * another name or make, or as several models.
 */
function place(make, model) {
  if (EXCLUDED[make]?.includes(model)) {
    usedRules.add(`EXCLUDED ${make}|${model}`);
    return [];
  }
  if (make === SCION.from && model.startsWith(SCION.prefix)) {
    return [{ make: SCION.make, model: model.slice(SCION.prefix.length) }];
  }
  const key = `${make}|${model}`;
  if (SPLIT[key]) {
    usedRules.add(`SPLIT ${key}`);
    return SPLIT[key].map((name) => ({ make, model: name }));
  }
  if (RENAMED[key]) {
    usedRules.add(`RENAMED ${key}`);
    return [{ make, model: RENAMED[key] }];
  }
  return [{ make, model }];
}

function unusedRules() {
  const all = [
    ...Object.entries(EXCLUDED).flatMap(([make, models]) =>
      models.map((model) => `EXCLUDED ${make}|${model}`),
    ),
    ...Object.keys(RENAMED).map((key) => `RENAMED ${key}`),
    ...Object.keys(SPLIT).map((key) => `SPLIT ${key}`),
  ];
  return all.filter((rule) => !usedRules.has(rule));
}

/** `[2005, 2006, 2007, 2010]` → `2005-2007;2010`. */
function yearRanges(years) {
  const sorted = [...years].sort((a, b) => a - b);
  const ranges = [];
  let start = sorted[0];
  let previous = sorted[0];
  for (const year of sorted.slice(1)) {
    if (year === previous + 1) {
      previous = year;
      continue;
    }
    ranges.push(start === previous ? `${start}` : `${start}-${previous}`);
    start = year;
    previous = year;
  }
  ranges.push(start === previous ? `${start}` : `${start}-${previous}`);
  return ranges.join(";");
}

function csvCell(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const check = process.argv.includes("--check");

const makeIds = await loadMakeIds();
const unknown = MAKES.filter((make) => !makeIds.has(make.toUpperCase()));
if (unknown.length > 0) {
  console.error(`vPIC has no make named: ${unknown.join(", ")}`);
  process.exit(1);
}

const tasks = [];
for (const make of MAKES) {
  const makeId = makeIds.get(make.toUpperCase());
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year += 1) {
    for (const type of TYPES) tasks.push({ make, makeId, year, type });
  }
}

/** `"<make>|<model>"` → `{ make, model, years: Set, types: Set }`. */
const vehicles = new Map();
let done = 0;
let dropped = 0;

function add(make, model, year, type) {
  const key = `${make}|${model.toLowerCase()}`;
  const entry = vehicles.get(key) ?? {
    make,
    model,
    years: new Set(),
    types: new Set(),
  };
  entry.years.add(year);
  entry.types.add(type);
  vehicles.set(key, entry);
}

await pool(tasks, async ({ make, makeId, year, type }) => {
  const body = await getJson(
    `${API}/GetModelsForMakeIdYear/makeId/${makeId}/modelyear/${year}/vehicletype/${type}?format=json`,
  );
  for (const row of body.Results) {
    const name = String(row.Model_Name).trim().replace(/\s+/g, " ");
    if (name === "") continue;
    const placed = place(make, name);
    if (placed.length === 0) dropped += 1;
    for (const vehicle of placed) add(vehicle.make, vehicle.model, year, type);
  }
  done += 1;
  if (done % 500 === 0) console.error(`  ${done} / ${tasks.length} requests`);
});

for (const extra of ADDED) {
  const [from, to] = extra.years;
  for (let year = Math.max(from, FIRST_YEAR); year <= to; year += 1) {
    add(extra.make, extra.model, year, extra.type);
  }
}

const rows = [...vehicles.values()].sort(
  (a, b) =>
    a.make.localeCompare(b.make, "en") ||
    a.model.localeCompare(b.model, "en", { numeric: true }),
);

const lines = ["make,model,years,types"];
for (const row of rows) {
  lines.push(
    [
      row.make,
      row.model,
      yearRanges(row.years),
      TYPES.filter((type) => row.types.has(type)).join(";"),
    ]
      .map(csvCell)
      .join(","),
  );
}

const modelYears = rows.reduce((sum, row) => sum + row.years.size, 0);
const makeCount = new Set(rows.map((row) => row.make)).size;
console.error(
  `${makeCount} makes, ${rows.length} models, ${modelYears} model-years ` +
    `(${FIRST_YEAR}-${LAST_YEAR}); ${dropped} vPIC rows excluded.`,
);
const stale = unusedRules();
if (stale.length > 0) {
  console.error("Rules that matched nothing (vPIC may have changed):");
  for (const rule of stale) console.error(`  ${rule}`);
}

if (check) {
  console.error("--check: nothing written.");
} else {
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, `${lines.join("\n")}\n`);
  console.error(`Wrote ${OUT}.`);
}
