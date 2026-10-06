/**
 * Turns the saved Auto Country vehicle-lookup answers into the two committed
 * CSVs the finder's fit data is built from (D155). Reads files only: it never
 * calls Auto Country (`scripts/autocountry-crawl.mjs` is the one thing that
 * does, and it saves every answer).
 *
 *   node scripts/vehicle-fitment-autocountry.mjs [--raw <dir>]
 *
 * Safe to re-run while the crawl is still going or after it finishes: it reads
 * whatever years are saved and rewrites both CSVs from scratch.
 *
 * Reads (outside the repo, never committed):
 *   ~/Platinum Wheels Vendor Data/Individual Vendors/Auto Country/_working/nero/raw/
 *     makes/<year>.json, models/<year>/<make>.json,
 *     options/<year>/<make>/<model>/<trim>.json,
 *     vehicle-ranges/<year>/<make>/<model>/<body>/<chassisId>.json
 *   scripts/data/vehicles.csv (our NHTSA vPIC list; only to decide aliases),
 *   scripts/data/vehicle-fitment.csv and vehicle-fitment-generations.csv (only
 *   to keep two cars with different bolt patterns from being called one car).
 *
 * Writes (committed):
 *   scripts/data/vehicle-fitment-autocountry.csv
 *       One row per Auto Country make + model + model year, in Auto Country's
 *       own spelling: the union over every trim and body of that model year.
 *   scripts/data/vehicle-aliases.csv
 *       Which of Auto Country's models are the same car as one of ours, and what
 *       becomes of each name (see "Names" below).
 *   import-report/vehicle-alias-review.csv (git-ignored)
 *       Pairs the rules could not decide, for a person to look at.
 *
 * `scripts/vehicle-fitment.mjs` reads both CSVs and writes
 * src/features/finder/vehicle-fitment-data.ts (VEHICLE_SPECS, VEHICLE_ALIASES)
 * and vehicle-list.ts. See scripts/data/llm.md.
 *
 * What one answer holds, and how each part is read (measured on the saved
 * 2005-2006 and 2019-2022 files):
 *   - An options answer is one trim. `chassis` carries the bolt pattern (pcd),
 *     centre bore, offset, nut or bolt and thread of the trim's FIRST body.
 *     `vehicles[]` lists every body with its own `fitments[].chassisId`; when
 *     that id differs from `chassis.chassisId` the body sits on another
 *     chassis (19 cases in 1,090: Savana 2500 passenger vs cargo van, F-350 cab
 *     styles, Jetta, Cobalt coupe). Those chassis facts are not in the options
 *     answer; the vehicle-ranges answer for that body and chassis carries its
 *     bolt pattern as a +-1 mm band (`5x113.3` .. `5x115.3` for a 5x114.3), so
 *     the pattern is the midpoint and the bore is `bore.min`. Thread, nut or
 *     bolt and offset of such a chassis are unknown and cast no vote.
 *   - A fitment option reads `17" Option (225/65R17, 17x7)`. A staggered one
 *     lists front and rear (`235/45R17 / 255/50R17, 17x8.5 / 17x9.5`); every
 *     size on either axle is kept. Flotation sizes (`31x10.50R15`) are kept as
 *     written. Suffixes (`M+S`) and a `P`/`LT` prefix are stripped. A size that
 *     is neither metric nor flotation (the TRX `265-680ZR500A`) is dropped.
 *   - Thread: `M12x1.5` becomes `12x1.5`; an inch thread (`1/2 UNF`) becomes
 *     `1/2x20` (UNF pitch from the diameter: lug hardware is always UNF). A
 *     value that is neither (`Peg`) is left blank.
 *   - Ranges come from the `oem` tier of vehicle-ranges at lift 0, union
 *     (min of mins, max of maxes) over every body and axle. 999 means
 *     unbounded and is dropped.
 *   - Per model year the centre bore, thread, fastener and offset are the most
 *     common value across trims (a tie takes the larger bore, and the first
 *     seen for the others); bolt_patterns lists every distinct pattern.
 *   - `tpms` (D156): "on" when any trim of the year says on, else "off" for a
 *     year before 2008 (see `tpmsOf`), else blank. Auto Country never says off.
 *
 * Trim routing (derived, coordinator 2026-10-06): when one of OUR models is an
 * Auto Country model plus a trim word that matches an Auto Country submodel of
 * the same model year (Civic "Type R" / "Type R Limited Edition" -> our "Civic
 * Type R"; Lancer "Evolution GSR" -> "Lancer Evolution"; Jetta "GLI"), that
 * trim's facts go to a row under OUR model's name and are left out of the parent
 * model's union, so a plain Civic keeps one bolt pattern. Matching is loose
 * (case and punctuation ignored, the submodel may continue past our trim words;
 * a one-letter trim must match exactly), only against a model Auto Country does
 * not itself list that year, and only within the year. Such a row carries
 * `routed_from` ("Civic: Type R") and every routing is a line of
 * import-report/vehicle-trim-routing.csv. A range answer follows the submodel
 * the crawler asked it for, so a routed trim that shares its chassis with other
 * trims may have no range of its own.
 *
 * A trim whose name holds a slash ("R/T") answers 404 and cannot be fetched.
 * Every model year with such a trim is listed in
 * import-report/vehicle-missing-trims.csv, with whether it has any answered
 * trim left; a model year whose ONLY trims are slash-named is marked
 * only_trims_404.
 *
 * Names (owner, 2026-10-06, verbatim): "union of both is best. dont lose
 * data." and "One car, one entry: where both lists have the same car under two
 * names, Auto Country's name wins and ours becomes an alias so old URLs still
 * resolve. Nothing offered today disappears." The rules below are DERIVED from
 * that, applied per make and model year, and every decision is a row of
 * vehicle-aliases.csv (columns: make, model, year_from, year_to,
 * canonical_make, canonical_model, relation, note; `make`/`model` is the name
 * the row is about, `canonical_*` the entry that carries its fit):
 *   same       one Auto Country model and one of ours are the same car spelled
 *              differently. Auto Country's name is the entry; ours is the alias
 *              (model = ours, canonical_model = Auto Country's). Spelling alone
 *              (case, spaces, punctuation, "&"/"and", a make prefix, the hand
 *              table SAME) decides it, and two cars whose bolt patterns differ
 *              that year are never `same`.
 *   member     several Auto Country models are variants of one of ours (Mercedes
 *              "C230", "C320" -> "C-Class"; Chevrolet "Suburban 1500" ->
 *              "Suburban") and all share one bolt pattern that year. Our name
 *              stays the entry, its fit is the union of the members, and each
 *              Auto Country name is an alias (model = Auto Country's,
 *              canonical_model = ours).
 *   split      the variants' bolt patterns differ that year (Express 1500 vs
 *              2500, Silverado 1500 vs 1500 HD). Each Auto Country model is an
 *              entry in its own right AND our family name stays an entry whose
 *              fit is the union (model = Auto Country's, canonical_model =
 *              ours). Nothing disappears.
 *   ac-only    an Auto Country model with no counterpart: added under its name.
 *   ours-only  one of ours with no Auto Country counterpart: stays as it is.
 * Make spelling is ours (MINI, Infiniti); only models follow Auto Country. A
 * year of ours that Auto Country does not list (2027, a skipped year) of a
 * model that is `same` elsewhere takes the nearest year's Auto Country name
 * (equidistant takes the later year), so the model stays one entry.
 * What the rules cannot decide goes to import-report/vehicle-alias-review.csv.
 */

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DEFAULT_RAW = path.join(
  os.homedir(),
  "Platinum Wheels Vendor Data/Individual Vendors/Auto Country/_working/nero/raw",
);
const VEHICLES = "scripts/data/vehicles.csv";
const OUR_EXACT = "scripts/data/vehicle-fitment.csv";
const OUR_GENERATIONS = "scripts/data/vehicle-fitment-generations.csv";
const OUT_FITMENT = "scripts/data/vehicle-fitment-autocountry.csv";
const OUT_ALIASES = "scripts/data/vehicle-aliases.csv";
const OUT_REVIEW = "import-report/vehicle-alias-review.csv";
const OUT_ROUTING = "import-report/vehicle-trim-routing.csv";
const OUT_MISSING = "import-report/vehicle-fitment-missing-trims.csv";
const OUT_JUNK = "import-report/vehicle-fitment-junk.csv";

const FIT_HEADER = [
  "make", "model", "year", "trims", "bodies", "bolt_patterns", "centre_bore", "thread", "fastener",
  "offset", "tire_sizes", "wheel_sizes", "tire_dia_min", "tire_dia_max", "tire_width_min",
  "tire_width_max", "wheel_dia_min", "wheel_dia_max", "wheel_width_min", "wheel_width_max",
  "offset_min", "offset_max", "classes", "routed_from", "tpms",
];
const ALIAS_HEADER = [
  "make", "model", "year_from", "year_to", "canonical_make", "canonical_model", "relation", "note",
];

/* --- Hand tables ------------------------------------------------------------ */

/**
 * Pairs spelling rules cannot find. [make (ours), our model, Auto Country model,
 * reason]. Used only when both exist; a pair whose bolt patterns differ that
 * year is still refused.
 */
const SAME = [
  ["Mazda", "MX-5", "MX-5 Miata", "Miata is the North American name of the MX-5"],
  ["Mazda", "MX-5", "Miata", "Miata is the North American name of the MX-5"],
  ["Toyota", "Corolla Matrix", "Matrix", "the Matrix is the Corolla Matrix (vPIC files it as Corolla Matrix)"],
  ["Toyota", "Camry Solara", "Solara", "the Solara is the Camry Solara (vPIC files it as Camry Solara)"],
  ["Chevrolet", "Malibu Classic", "Classic", "2005 Chevrolet Classic is the previous-generation Malibu, which vPIC calls Malibu Classic"],
  ["MINI", "Hardtop", "Cooper", "the Cooper Hardtop is the Cooper"],
  ["MINI", "Clubman", "Cooper Clubman", "the Cooper Clubman is the Clubman"],
  ["MINI", "Countryman", "Cooper Countryman", "the Cooper Countryman is the Countryman"],
  ["Nissan", "Qashqai", "Rogue Sport", "Rogue Sport is the North American Qashqai (vehicles-fetch.mjs RENAMED)"],
  ["Chevrolet", "Astro Van", "Astro", "spelling"],
  ["GMC", "Jimmy Utility", "Jimmy", "spelling"],
  ["Toyota", "Supra", "GR Supra", "the 2020 Supra is sold as GR Supra by Auto Country, Supra by vPIC"],
  ["BMW", "1M", "1 Series M", "same car: the 2011 1 Series M Coupe"],
  ["BMW", "B7", "Alpina B7", "same car: Alpina B7 (vPIC drops the make word)"],
  ["Volvo", "S60CC", "S60 Cross Country", "vPIC abbreviates Cross Country to CC"],
  ["Volvo", "V60CC", "V60 Cross Country", "vPIC abbreviates Cross Country to CC"],
  ["Volvo", "V90CC", "V90 Cross Country", "vPIC abbreviates Cross Country to CC"],
  ["MINI", "Paceman", "Cooper Paceman", "the Cooper Paceman is the Paceman"],
  ["MINI", "Cooper Convertible", "Cooper", "the convertible is a Cooper body on the same hub (Auto Country has one Cooper entry)"],
  ["Volkswagen", "Jetta Wagon", "Jetta", "the wagon is a Jetta body on the same hub"],
  ["Volkswagen", "Jetta SportWagen", "Jetta", "the SportWagen is a Jetta body on the same hub"],
  ["Volkswagen", "GLI", "Jetta", "the GLI is a Jetta trim on the same hub"],
  ["Mitsubishi", "Lancer SportBack", "Lancer", "the Sportback is a Lancer body on the same hub"],
  ["Suzuki", "Grand Vitara XL-7", "XL-7", "the 2006-2008 XL-7 is vPIC's Grand Vitara XL-7"],
  ["Alfa Romeo", "8C Competizione Spider", "8C", "the 8C Competizione and its Spider"],
];

/**
 * Familiar display names (D156, owner 2026-10-06: "Familiar names
 * (Recommended)"). Where Auto Country's model name is a bare number or letter
 * that the maker itself markets with a prefix, the finder shows the familiar
 * name and Auto Country's spelling becomes an alias (so `model=3` in an old URL
 * still resolves). This is the one exception to "Auto Country's name wins"
 * (D155); maker capitals (LYRIQ, TITAN, ESCALADE IQ) and real numeric names
 * (Ram 1500, Chrysler 300, Fiat 500, Porsche 911, BMW 328i) are not touched.
 * [make, Auto Country model, name the finder shows, reason]. Applied to the
 * Auto Country rows before anything is decided, so the fitment CSV, the alias
 * rows and every later step see the familiar name; one alias row per entry
 * records the old spelling. A member such as "3 Sport" then folds into the
 * familiar name by the FAMILY rules.
 */
const DISPLAY = [
  ["Mazda", "2", "Mazda2", "Mazda markets the model as Mazda2; Auto Country lists the bare 2"],
  ["Mazda", "3", "Mazda3", "Mazda markets the model as Mazda3; Auto Country lists the bare 3"],
  ["Mazda", "5", "Mazda5", "Mazda markets the model as Mazda5; Auto Country lists the bare 5"],
  ["Mazda", "6", "Mazda6", "Mazda markets the model as Mazda6; Auto Country lists the bare 6"],
  ["Tesla", "3", "Model 3", "Tesla's name is Model 3; Auto Country drops the word Model"],
  ["Tesla", "S", "Model S", "Tesla's name is Model S; Auto Country drops the word Model"],
  ["Tesla", "X", "Model X", "Tesla's name is Model X; Auto Country drops the word Model"],
  ["Tesla", "Y", "Model Y", "Tesla's name is Model Y; Auto Country drops the word Model"],
];

/**
 * Near-name pairs looked at and kept as two entries (derived). [make (ours),
 * Auto Country model, our model, reason]. They are left out of the review file.
 */
const SEPARATE = [
  ["Ford", "E-Transit", "Transit", "the electric van is its own model; Auto Country files Transit-150/250/350 as the Transit family"],
  ["BMW", "Alpina B7", "Alpina B8", "two different cars with different bolt patterns (5x120 and 5x112)"],
];

/**
 * Auto Country models that are variants of one of ours without sharing a
 * prefix with it. [make (ours), pattern on Auto Country's model name, our
 * family, reason]. The prefix rule (our name followed by a space) needs no row.
 */
const FAMILY = [
  ["Mercedes-Benz", /^C\s?\d{2,3}[a-z]{0,2}\b/i, "C-Class", "C230, C320 ... are C-Class trims"],
  ["Mercedes-Benz", /^E\s?\d{2,3}[a-z]{0,2}\b/i, "E-Class", "E350 ... are E-Class trims"],
  ["Mercedes-Benz", /^S\s?\d{2,3}[a-z]{0,2}\b/i, "S-Class", "S550 ... are S-Class trims"],
  ["Mercedes-Benz", /^CLK\s?\d{2,3}[a-z]{0,2}\b/i, "CLK-Class", "CLK350 ... are CLK-Class trims"],
  ["Mercedes-Benz", /^CLS\s?\d{2,3}[a-z]{0,2}\b/i, "CLS-Class", "CLS550 ... are CLS-Class trims"],
  ["Mercedes-Benz", /^CL\s?\d{2,3}[a-z]{0,2}\b/i, "CL-Class", "CL500 ... are CL-Class trims"],
  ["Mercedes-Benz", /^CLA\s?\d{2,3}[a-z]{0,2}\b/i, "CLA-Class", "CLA250 ... are CLA-Class trims"],
  ["Mercedes-Benz", /^SLK\s?\d{2,3}[a-z]{0,2}\b/i, "SLK-Class", "SLK350 ... are SLK-Class trims"],
  ["Mercedes-Benz", /^SL\s?\d{2,3}[a-z]{0,2}\b/i, "SL-Class", "SL550 ... are SL-Class trims"],
  ["Mercedes-Benz", /^ML\s?\d{2,3}[a-z]{0,2}\b/i, ["M-Class", "ML-Class"], "ML350 ... are M-Class trims (ML-Class in 2012-2015)"],
  ["Mercedes-Benz", /^GL\s?\d{2,3}[a-z]{0,2}\b/i, "GL-Class", "GL450 ... are GL-Class trims"],
  ["Mercedes-Benz", /^GLK\s?\d{2,3}[a-z]{0,2}\b/i, "GLK-Class", "GLK350 ... are GLK-Class trims"],
  ["Mercedes-Benz", /^GLC\s?\d{2,3}[a-z]{0,2}\b/i, "GLC-Class", "GLC300 ... are GLC-Class trims"],
  ["Mercedes-Benz", /^GLE\s?\d{2,3}[a-z]{0,2}\b/i, "GLE-Class", "GLE350 ... are GLE-Class trims"],
  ["Mercedes-Benz", /^GLS\s?\d{2,3}[a-z]{0,2}\b/i, "GLS-Class", "GLS450 ... are GLS-Class trims"],
  ["Mercedes-Benz", /^GLA\s?\d{2,3}[a-z]{0,2}\b/i, "GLA-Class", "GLA250 ... are GLA-Class trims"],
  ["Mercedes-Benz", /^G\s?\d{2,3}[a-z]{0,2}\b/i, "G-Class", "G500 ... are G-Class trims"],
  ["Mercedes-Benz", /^R\s?\d{2,3}[a-z]{0,2}\b/i, "R-Class", "R350 ... are R-Class trims"],
  ["Mercedes-Benz", /^B\s?\d{2,3}[a-z]{0,2}\b/i, "B-Class", "B250 ... are B-Class trims"],
  ["BMW", /^[1]\d{2}[a-z]{0,2}$/i, "1 Series", "128i, 135i ... are 1 Series trims"],
  ["BMW", /^[2]\d{2}[a-z]{0,2}$/i, "2 Series", "228i ... are 2 Series trims"],
  ["BMW", /^[3]\d{2}[a-z]{0,2}$/i, "3 Series", "325i, 330Ci ... are 3 Series trims"],
  ["BMW", /^[4]\d{2}[a-z]{0,2}$/i, "4 Series", "428i ... are 4 Series trims"],
  ["BMW", /^[5]\d{2}[a-z]{0,2}$/i, "5 Series", "528i, 550i ... are 5 Series trims"],
  ["BMW", /^[6]\d{2}[a-z]{0,2}$/i, "6 Series", "645Ci ... are 6 Series trims"],
  ["BMW", /^[7]\d{2}[a-z]{0,2}$/i, "7 Series", "745Li ... are 7 Series trims"],
  ["BMW", /^[8]\d{2}[a-z]{0,2}$/i, "8 Series", "840i ... are 8 Series trims"],
  ["Lexus", /^(ES|GS|IS|LS|RX|GX|LX|NX|UX|RC|CT|LC|SC|HS|TX|RZ)\s?\d{2,3}[a-z]{0,2}\b/i, null, "Lexus names the model by its letters and the engine by its digits"],
  ["Acura", /^(MDX|RDX|TLX|ILX|RLX|TSX|TL|RL|ZDX|RSX|CL)\b.+/i, null, "trim words after the model"],
  ["Infiniti", /^(QX\d{2}|Q\d{2}|FX\d{2}|EX\d{2}|JX\d{2}|G\d{2}|M\d{2})[a-z]?\b.+/i, null, "trim words after the model"],
  ["Audi", /^(A\d|S\d|RS\d|Q\d|TT|R8)\b.+/i, null, "trim words after the model"],
  ["Chevrolet", /^(Silverado|Sierra)\s*\d{4}\s*HD$/i, null, "heavy-duty variants are split by bolt pattern"],
  ["Chevrolet", /^Suburban\s*\d{4}$/i, "Suburban", "Suburban 1500/2500"],
  ["Chevrolet", /^Tahoe\s*\d{4}$/i, "Tahoe", "Tahoe 1500"],
  ["GMC", /^Yukon\s*XL\s*\d{4}$/i, "Yukon XL", "Yukon XL 1500/2500"],
  ["Chevrolet", /^Express\s*\d{4}$/i, "Express", "Express 1500/2500/3500"],
  ["Jeep", /^TJ$/, "Wrangler", "TJ is the 2005-2006 Wrangler"],
  ["Mercedes-Benz", /^A\s?\d{2,3}[a-z]{0,2}\b/i, "A-Class", "A220, A250, A35 AMG are A-Class trims"],
  ["Mercedes-Benz", /^B\s?Electric Drive$/i, "B-Class", "B Electric Drive is a B-Class"],
  ["Mercedes-Benz", /^CLE\s?\d{2}/i, "CLE", "CLE300, CLE450, CLE53 AMG are CLE trims"],
  ["Mercedes-Benz", /^GLB\s?\d{2,3}[a-z]{0,2}\b/i, "GLB-Class", "GLB250, GLB35 AMG are GLB-Class trims"],
  ["Mercedes-Benz", /^SLC\s?\d{2,3}[a-z]{0,2}\b/i, "SLC-Class", "SLC300, SLC43 AMG are SLC-Class trims"],
  ["Mercedes-Benz", /^SLS\b/i, "SLS-Class", "SLS AMG is the SLS-Class"],
  ["Mercedes-Benz", /^EQB\b/i, "EQB-Class", "EQB 250+, 300, 350 are EQB-Class trims"],
  ["Mercedes-Benz", /^EQE\b.*\bSUV\b/i, "EQE-Class SUV", "EQE ... SUV trims"],
  ["Mercedes-Benz", /^EQE\b/i, "EQE-Class Sedan", "EQE sedan trims"],
  ["Mercedes-Benz", /^EQS\b.*\bSUV\b/i, "EQS-Class SUV", "EQS ... SUV trims"],
  ["Mercedes-Benz", /^EQS\b/i, "EQS-Class Sedan", "EQS sedan trims"],
  ["Nissan", /^NV\d{4}$/, "NV", "NV1500, NV2500, NV3500 are NV vans"],
  ["Mazda", /^3 Sport$/, "Mazda3", "3 Sport is the Mazda3 hatchback"],
  ["Kia", /^Forte5$/, "Forte", "Forte5 is the Forte hatchback"],
  ["BMW", /^i3s$/, "i3", "i3s is the i3"],
  ["Subaru", /^XV Crosstrek$/, "Crosstrek", "XV Crosstrek is the Crosstrek"],
  ["Genesis", /^Electrified G80$/, "G80", "the electric G80"],
  ["Genesis", /^Electrified GV70$/, "GV70", "the electric GV70"],
  ["Jaguar", /^(XJ8|Super V8|Vanden Plas)$/, "XJ", "XJ8, Super V8 and Vanden Plas are XJ models"],
  ["Mazda", /^B\d{4}$/, "B-Series", "B2300, B3000, B4000 are B-Series trucks"],
  ["Chevrolet", /^Aveo5$/, "Aveo", "Aveo5 is the Aveo hatchback"],
  ["Kia", /^Rio5$/, "Rio", "Rio5 is the Rio hatchback"],
  ["Kia", /^Spectra5$/, "Spectra", "Spectra5 is the Spectra hatchback"],
  ["Pontiac", /^Wave5$/, "Wave", "Wave5 is the Wave hatchback"],
  ["Chevrolet", /^Silverado\s*3500(?:\s*Classic)?$/i, "Silverado 3500HD", "vPIC calls the 3500 Silverado 3500HD"],
  ["Chevrolet", /^Silverado\s*2500\s*HD\s*Classic$/i, "Silverado 2500HD", "vPIC calls it Silverado 2500HD"],
  ["GMC", /^Sierra\s*3500(?:\s*Classic)?$/i, "Sierra 3500HD", "vPIC calls the 3500 Sierra 3500HD"],
  ["GMC", /^Sierra\s*2500\s*HD\s*Classic$/i, "Sierra 2500HD", "vPIC calls it Sierra 2500HD"],
  ["GMC", /^Savana\s*\d{4}$/i, "Savana", "Savana 1500/2500/3500"],
];

/* --- CSV ---------------------------------------------------------------------- */

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

/* --- Small helpers ------------------------------------------------------------ */

const norm = (text) =>
  text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]/g, "");
const safe = (s) => encodeURIComponent(String(s)).replace(/%20/g, "_").replace(/\*/g, "%2A");

/** A number as the shortest text: 7 -> "7", 6.50 -> "6.5". */
const num = (value) => String(Number(Number(value).toFixed(2)));

function yearRanges(years) {
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  const out = [];
  for (const year of sorted) {
    const last = out[out.length - 1];
    if (last && year === last[1] + 1) last[1] = year;
    else out.push([year, year]);
  }
  return out;
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

async function listJson(dir) {
  try {
    const names = await readdir(dir, { recursive: true });
    return names.filter((n) => n.endsWith(".json")).sort().map((n) => path.join(dir, n));
  } catch {
    return [];
  }
}

/** Most common value; `larger` breaks a tie toward the bigger number, else first seen. */
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

/* --- Parsing one answer ------------------------------------------------------- */

const BOLT = /^(\d{1,2})x(\d{2,3}(?:\.\d{1,2})?)$/;

function normBolt(text) {
  const match = BOLT.exec(String(text ?? "").trim());
  return match ? `${match[1]}x${num(match[2])}` : "";
}

const UNF_PITCH = { "3/8": 24, "7/16": 20, "1/2": 20, "9/16": 18, "5/8": 18 };
const stats = { halfInch: 0, threadUnreadable: new Map(), tireDropped: new Map(), staggered: 0, flotation: 0, lt: 0 };

function normThread(text) {
  const raw = String(text ?? "").trim();
  if (raw === "") return "";
  const metric = /^M(\d{1,2})x(\d(?:\.\d+)?)$/i.exec(raw);
  if (metric) return `${metric[1]}x${metric[2]}`;
  const inch = /^(\d{1,2}\/\d{1,2})\s*UNF\b/i.exec(raw);
  if (inch && UNF_PITCH[inch[1]]) return `${inch[1]}x${UNF_PITCH[inch[1]]}`;
  stats.threadUnreadable.set(raw, (stats.threadUnreadable.get(raw) ?? 0) + 1);
  return "";
}

function normTire(text) {
  const raw = text.trim();
  const metric = /^(?:P|LT|ST|T)?(\d{3})\/(\d{2,3})\s*Z?R(\d{2}(?:\.\d)?)/i.exec(raw);
  if (metric) {
    if (/^LT/i.test(raw)) stats.lt += 1;
    return `${metric[1]}/${metric[2]}R${num(metric[3])}`;
  }
  const flotation = /^(\d{2}(?:\.\d)?)x(\d{1,2}(?:\.\d{1,2})?)\s*R(\d{2}(?:\.\d)?)/i.exec(raw);
  if (flotation) {
    stats.flotation += 1;
    return `${num(flotation[1])}x${Number(flotation[2]).toFixed(2)}R${num(flotation[3])}`;
  }
  stats.tireDropped.set(raw, (stats.tireDropped.get(raw) ?? 0) + 1);
  return "";
}

function normWheel(text) {
  const match = /^(\d{2}(?:\.\d)?)\s*x\s*(\d{1,2}(?:\.\d{1,2})?)/i.exec(text.trim());
  return match ? `${num(match[1])}x${num(match[2])}` : "";
}

/**
 * `17" Option (235/45R17 / 255/50R17, 17x8.5 / 17x9.5)` -> { tires, wheels }.
 * Auto Country writes a 19.5 inch commercial wheel as `19x6` (its `diameter`
 * field is 19) beside a `225/70R19.5` tire; a tire that size only fits a 19.5
 * inch wheel, so a wheel whose whole-inch diameter equals the tire's rim minus
 * its half inch takes the tire's rim (19.5, 17.5, 16.5).
 */
function parseOption(option) {
  const inside = /\((.*)\)\s*$/.exec(option)?.[1];
  if (inside === undefined) return { tires: [], wheels: [], fixedHalf: 0 };
  const cut = inside.lastIndexOf(", ");
  if (cut === -1) return { tires: [], wheels: [], fixedHalf: 0 };
  const tireText = inside.slice(0, cut);
  const wheelText = inside.slice(cut + 2);
  if (tireText.includes(" / ") || wheelText.includes(" / ")) stats.staggered += 1;
  const tires = tireText.split(" / ").map(normTire);
  const rimOf = (size) => /R(\d{2}(?:\.\d)?)$/.exec(size)?.[1];
  let fixedHalf = 0;
  const wheels = wheelText
    .split(" / ")
    .map((text, index) => {
      const wheel = normWheel(text);
      if (!wheel) return "";
      const rim = rimOf(tires[Math.min(index, tires.length - 1)] ?? "");
      const [diameter, width] = wheel.split("x");
      if (rim !== undefined && rim.endsWith(".5") && Number(diameter) === Math.floor(Number(rim))) {
        fixedHalf += 1;
        return `${rim}x${width}`;
      }
      return wheel;
    });
  return { tires: tires.filter(Boolean), wheels: wheels.filter(Boolean), fixedHalf };
}

/** Body styles to the finder's vPIC-style class. */
function bodyClass(body) {
  if (/van/i.test(body) || /sport utility/i.test(body)) return "mpv";
  if (/pickup|cab & chassis|chassis/i.test(body)) return "truck";
  return "car";
}

/** Overall range of one tier-"oem" entry list, 999 dropped. */
function takeBound(into, key, bound) {
  for (const side of ["min", "max"]) {
    const value = bound?.[side];
    if (typeof value !== "number" || value >= 999) continue;
    const slot = into[key] ?? (into[key] = { min: Infinity, max: -Infinity });
    slot.min = Math.min(slot.min, value);
    slot.max = Math.max(slot.max, value);
  }
}

/* --- Load the raw answers ----------------------------------------------------- */

async function loadRaw(raw, ours, canonicalMake) {
  /** "<make>|<model>|<year>" -> accumulator */
  const years = new Map();
  const acc = (make, model, year) => {
    const key = `${make}|${model}|${year}`;
    let item = years.get(key);
    if (!item) {
      item = {
        make, model, year,
        trims: [], bodies: new Set(), classes: new Set(),
        bolt: [], bore: [], thread: [], fastener: [], offset: [], tpms: [],
        tires: new Set(), wheels: new Set(),
        otherChassis: new Map(), ranges: {},
        hasOptions: false, routedFrom: new Set(),
      };
      years.set(key, item);
    }
    return item;
  };

  const routing = [];
  const routeOf = new Map(); // "<year>|<make>|<model>|<trim>" -> our model
  const answered = new Map(); // answered trims per Auto Country model year, routed or not
  const failed = []; // { make, model, year, trim }
  const report = { junk: [], optionFiles: 0, optionOk: 0, option404: 0, trimNames404: [], noBodies: 0, chassisUnits: 0 };

  const byFile = new Map(); // "<year>|<safe make>|<safe model>" -> Auto Country names
  const listed = new Set(); // "<canonical make>|<year>|<norm model>"
  /* The model lists: every model Auto Country offers, with or without fit data. */
  for (const file of await listJson(path.join(raw, "makes"))) {
    const year = Number(path.basename(file, ".json"));
    const makes = (await readJson(file))?.body?.data ?? [];
    for (const { make } of makes) {
      const models = (await readJson(path.join(raw, "models", String(year), `${safe(make)}.json`)))?.body?.data ?? [];
      for (const { model } of models) {
        acc(make, model, year);
        byFile.set(`${year}|${safe(make)}|${safe(model)}`, { make, model });
        listed.add(`${canonicalMake(make)}|${year}|${norm(model)}`);
      }
    }
  }

  /** Our models by canonical make, to route a trim to a separate model of ours. */
  const oursByMake = new Map();
  for (const v of ours.vehicles) {
    if (!oursByMake.has(v.make)) oursByMake.set(v.make, []);
    oursByMake.get(v.make).push(v);
  }
  const routeTrim = (make, model, year, trim) => {
    const cm = canonicalMake(make);
    const tNorm = norm(trim);
    if (tNorm === "") return null;
    let best = null;
    for (const v of oursByMake.get(cm) ?? []) {
      if (v.model.length <= model.length || !v.model.toLowerCase().startsWith(model.toLowerCase())) continue;
      const next = v.model[model.length];
      const boundary = !/[a-z0-9]/i.test(next) || (/\d$/.test(model) && /[a-z]/i.test(next));
      if (!boundary) continue;
      if (listed.has(`${cm}|${year}|${norm(v.model)}`)) continue; // Auto Country lists it itself
      const rem = norm(v.model.slice(model.length));
      if (rem === "") continue;
      const hit = tNorm === rem ? "exact" : rem.length >= 2 && tNorm.startsWith(rem) ? "prefix" : null;
      if (hit && (best === null || rem.length > best.rem.length)) best = { target: v.model, rem, rule: hit };
    }
    return best;
  };

  /* Options: one trim per file. */
  const ownChassis = new Map(); // "<year>|<make>|<model>|<body>|<chassisId>" -> first-chassis marker
  for (const file of await listJson(path.join(raw, "options"))) {
    report.optionFiles += 1;
    const answer = await readJson(file);
    const data = answer?.status === 200 ? answer.body?.data : null;
    if (!data) {
      report.option404 += 1;
      report.trimNames404.push(path.relative(raw, file));
      const [yearPart, makePart, modelPart, trimPart] = path.relative(path.join(raw, "options"), file).split(path.sep);
      const known = byFile.get(`${yearPart}|${makePart}|${modelPart}`);
      if (known && trimPart) {
        let trim = trimPart.replace(/\.json$/, "");
        try {
          trim = decodeURIComponent(trim.replace(/_/g, " "));
        } catch {}
        failed.push({ make: known.make, model: known.model, year: Number(yearPart), trim });
      }
      continue;
    }
    report.optionOk += 1;
    const answeredKey = `${data.make}|${data.model}|${data.year}`;
    answered.set(answeredKey, (answered.get(answeredKey) ?? 0) + 1);
    const route = routeTrim(data.make, data.model, Number(data.year), data.subModel ?? "");
    const item = route
      ? acc(data.make, route.target, Number(data.year))
      : acc(data.make, data.model, Number(data.year));
    if (route) {
      item.routedFrom.add(`${data.model}: ${data.subModel}`);
      routeOf.set(`${data.year}|${data.make}|${data.model}|${data.subModel}`, route.target);
      routing.push({
        make: data.make, year: data.year, ac_model: data.model, trim: data.subModel,
        routed_to: route.target, rule: route.rule,
      });
    }
    item.hasOptions = true;
    item.trims.push(data.subModel);
    const chassis = data.chassis ?? {};
    const junk = (field, raw) =>
      report.junk.push({ make: data.make, model: data.model, year: data.year, trim: data.subModel, field, raw });
    /* Centre-lock and junk values: a bolt pattern with ten or more lugs (12x112,
       15x130) and a bore of 0 are Auto Country's placeholders, not facts. The
       10x225 and 10x335 patterns of dually trucks are real and stay. */
    let bolt = normBolt(chassis.pcd);
    if (bolt === "" && chassis.pcd) junk("bolt_pattern", chassis.pcd);
    if (bolt !== "" && Number(bolt.split("x")[0]) >= 10 && !/^10x(225|335)$/.test(bolt)) {
      junk("bolt_pattern", chassis.pcd);
      bolt = "";
    }
    item.bolt.push(bolt);
    const bore = chassis.centreBoreR ? Number(chassis.centreBoreR) : 0;
    if (chassis.centreBoreR && !(bore > 0)) junk("centre_bore", chassis.centreBoreR);
    item.bore.push(bore > 0 ? num(bore) : "");
    const thread = normThread(chassis.threadType);
    if (thread === "" && chassis.threadType) junk("thread", chassis.threadType);
    item.thread.push(thread);
    item.fastener.push(chassis.nutOrBolt === "nut" || chassis.nutOrBolt === "bolt" ? chassis.nutOrBolt : "");
    item.tpms.push(chassis.tpms === "on" || chassis.tpms === "off" ? chassis.tpms : "");
    item.offset.push(chassis.rimOffset !== null && chassis.rimOffset !== undefined && chassis.rimOffset !== ""
      && Number.isFinite(Number(chassis.rimOffset)) ? String(Math.round(Number(chassis.rimOffset))) : "");
    const vehicles = data.vehicles ?? [];
    if (vehicles.length === 0) report.noBodies += 1;
    for (const body of vehicles) {
      item.bodies.add(body.body);
      item.classes.add(bodyClass(body.body));
      for (const fitment of body.fitments ?? []) {
        const { tires, wheels, fixedHalf } = parseOption(fitment.option ?? "");
        stats.halfInch += fixedHalf;
        for (const tire of tires) item.tires.add(tire);
        for (const wheel of wheels) item.wheels.add(wheel);
        if (fitment.chassisId !== undefined && fitment.chassisId !== chassis.chassisId) {
          item.otherChassis.set(`${body.body}|${fitment.chassisId}`, {
            body: body.body, id: fitment.chassisId, parent: data.model,
          });
        }
      }
    }
    ownChassis.set(`${data.year}|${data.make}|${data.model}`, true);
  }

  /* Ranges: the oem tier, union per model year; and the other chassis' facts. */
  const rangeByChassis = new Map();
  for (const file of await listJson(path.join(raw, "vehicle-ranges"))) {
    const answer = await readJson(file);
    const data = answer?.status === 200 ? answer.body?.data : null;
    const request = answer?.request;
    if (!data || !request) continue;
    const chassisId = Number(path.basename(file, ".json"));
    const routed = routeOf.get(`${request.year}|${request.make}|${request.model}|${request.sub_model}`);
    const item = acc(request.make, routed ?? request.model, Number(request.year));
    const first = (list) => (Array.isArray(list) ? list.find((entry) => entry.tier === "oem") : undefined);
    for (const axle of Object.values(data.wheels ?? {})) {
      const oem = first(axle);
      if (!oem) continue;
      takeBound(item.ranges, "wheelDia", oem.diameter);
      takeBound(item.ranges, "wheelWidth", oem.width);
      takeBound(item.ranges, "offset", oem.offset);
      rangeByChassis.set(`${request.year}|${request.make}|${request.model}|${request.body}|${chassisId}`, oem);
    }
    for (const axle of Object.values(data.tires ?? {})) {
      const oem = first(axle);
      if (!oem) continue;
      takeBound(item.ranges, "tireDia", oem.diameter);
      takeBound(item.ranges, "tireWidth", oem.width);
    }
  }

  /* The other chassis of a model year: bolt pattern = midpoint of its band. */
  for (const item of years.values()) {
    for (const { body, id, parent } of item.otherChassis.values()) {
      const oem = rangeByChassis.get(`${item.year}|${item.make}|${parent ?? item.model}|${body}|${id}`);
      report.chassisUnits += 1;
      if (!oem?.boltPattern) {
        report.chassisMissing = (report.chassisMissing ?? 0) + 1;
        continue;
      }
      const low = /^(\d{1,2})x(\d{2,3}(?:\.\d+)?)$/.exec(oem.boltPattern.min ?? "");
      const high = /^(\d{1,2})x(\d{2,3}(?:\.\d+)?)$/.exec(oem.boltPattern.max ?? "");
      if (low && high && low[1] === high[1] && Number(low[1]) < 10) {
        item.bolt.push(normBolt(`${low[1]}x${((Number(low[2]) + Number(high[2])) / 2).toFixed(2)}`));
        report.chassisResolved = (report.chassisResolved ?? 0) + 1;
      }
      const bore = oem.bore?.min;
      if (typeof bore === "number" && bore > 0 && bore < 999) item.bore.push(num(bore));
    }
  }
  report.routing = routing;
  report.failed = failed;
  report.answered = answered;
  return { years, report };
}

/* --- One Auto Country model year -> one CSV row ------------------------------- */

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

function distinctByCount(values) {
  const counts = new Map();
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value]) => value);
}

/**
 * Does the model year carry a tyre pressure sensor (D156)? Auto Country's
 * `chassis.tpms` is "on" or null in all 31,974 saved answers, never "off". A
 * model year is "on" when any trim says on (a car with a sensor on some trim
 * needs sensors). "off" is stated only when no trim says on AND the model year
 * is before TPMS_ABSENT_MEANS_OFF_BEFORE: before the 2008 model year (the US
 * mandate; Canada followed) a blank is a car without the system, while a blank
 * in 2025 or 2026 is Auto Country not having filled the year in yet, so it
 * stays blank (unknown). Derived by the coordinator, vetoable: set the
 * constant to 0 to state "off" only where Auto Country says "off".
 */
const TPMS_ABSENT_MEANS_OFF_BEFORE = 2008;
function tpmsOf(item) {
  if (item.tpms.includes("on")) return "on";
  if (item.tpms.includes("off")) return "off";
  return item.hasOptions && item.year < TPMS_ABSENT_MEANS_OFF_BEFORE ? "off" : "";
}

function toRow(item) {
  const range = (key, side, digits = 1) =>
    item.ranges[key] && Number.isFinite(item.ranges[key][side])
      ? String(Number(item.ranges[key][side].toFixed(digits)))
      : "";
  return {
    make: item.make,
    model: item.model,
    year: item.year,
    trims: [...new Set(item.trims)].join(";"),
    bodies: [...item.bodies].join(";"),
    bolt_patterns: distinctByCount(item.bolt).join(";"),
    centre_bore: mostCommon(item.bore, true),
    thread: mostCommon(item.thread),
    fastener: mostCommon(item.fastener),
    offset: mostCommon(item.offset),
    tire_sizes: [...item.tires].sort(tireOrder).join(";"),
    wheel_sizes: [...item.wheels].sort(wheelOrder).join(";"),
    tire_dia_min: range("tireDia", "min"),
    tire_dia_max: range("tireDia", "max"),
    tire_width_min: range("tireWidth", "min", 0),
    tire_width_max: range("tireWidth", "max", 0),
    wheel_dia_min: range("wheelDia", "min"),
    wheel_dia_max: range("wheelDia", "max"),
    wheel_width_min: range("wheelWidth", "min"),
    wheel_width_max: range("wheelWidth", "max"),
    offset_min: range("offset", "min", 0),
    offset_max: range("offset", "max", 0),
    classes: ["car", "mpv", "truck"].filter((c) => item.classes.has(c)).join(";"),
    routed_from: [...item.routedFrom].join(";"),
    tpms: tpmsOf(item),
  };
}

/* --- Names: aliases ----------------------------------------------------------- */

async function readOurs() {
  const rows = parseCsv(await readFile(VEHICLES, "utf8"));
  const vehicles = rows.map((row) => {
    const years = new Set();
    for (const part of row.years.split(";")) {
      const [from, to = from] = part.split("-").map(Number);
      for (let year = from; year <= to; year += 1) years.add(year);
    }
    return { make: row.make, model: row.model, years };
  });
  /* Our sheets' bolt patterns, to refuse calling two different cars one. */
  const exact = new Map();
  for (const row of parseCsv(await readFile(OUR_EXACT, "utf8"))) {
    exact.set(`${row.make}|${row.model}|${row.year}`, row.bolt_pattern);
  }
  const generations = new Map();
  for (const row of parseCsv(await readFile(OUR_GENERATIONS, "utf8"))) {
    if (!BOLT.test(row.bolt_pattern)) continue;
    const key = `${row.make}|${row.model}`;
    if (!generations.has(key)) generations.set(key, []);
    generations.get(key).push({ from: Number(row.year_from), to: Number(row.year_to), bolt: row.bolt_pattern });
  }
  const ourBolt = (make, model, year) => {
    const direct = exact.get(`${make}|${model}|${year}`);
    if (direct) return new Set([direct]);
    for (const range of generations.get(`${make}|${model}`) ?? []) {
      if (year >= range.from && year <= range.to) return new Set([range.bolt]);
    }
    return new Set();
  };
  return { vehicles, ourBolt };
}

const matchKeys = (make, name) => {
  const out = new Set();
  const n = norm(name);
  const m = norm(make);
  out.add(n);
  if (n.startsWith(m) && n.length > m.length) out.add(n.slice(m.length));
  out.add(m + n);
  return out;
};

const sameBolts = (a, b) => a.size === 0 || b.size === 0 || [...a].some((x) => b.has(x));

/**
 * Decides every name for every make. Returns:
 *   aliasRows   rows of vehicle-aliases.csv (before collapsing years)
 *   review      pairs nobody decided
 */
function decideNames(acRows, ours, canonicalMake) {
  const { vehicles, ourBolt } = ours;
  /** canonical make -> ours models */
  const oursByMake = new Map();
  for (const v of vehicles) {
    if (!oursByMake.has(v.make)) oursByMake.set(v.make, []);
    oursByMake.get(v.make).push(v);
  }
  /** "<canonical make>|<AC model>|<year>" -> AC row */
  const acBy = new Map();
  const acModelsByMake = new Map();
  for (const row of acRows) {
    const make = canonicalMake(row.make);
    acBy.set(`${make}|${row.model}|${row.year}`, row);
    if (!acModelsByMake.has(make)) acModelsByMake.set(make, new Map());
    const models = acModelsByMake.get(make);
    if (!models.has(row.model)) models.set(row.model, new Set());
    models.get(row.model).add(Number(row.year));
  }
  /* A model year Auto Country lists with no answer yet (a crawl still running,
     or a trim whose name the lookup rejects) takes the bolt pattern of the
     model's nearest year that has one, so a family's relation does not flip
     from year to year with the data that happens to be saved. */
  const acBolt = (make, model, year) => {
    const read = (y) => {
      const row = acBy.get(`${make}|${model}|${y}`);
      return new Set(row ? row.bolt_patterns.split(";").filter(Boolean) : []);
    };
    const own = read(year);
    if (own.size > 0) return own;
    let best = null;
    for (const y of acModelsByMake.get(make)?.get(model) ?? []) {
      const bolts = read(y);
      if (bolts.size === 0) continue;
      const d = Math.abs(y - year);
      if (best === null || d < best.d || (d === best.d && y > best.y)) best = { d, y, bolts };
    }
    return best ? best.bolts : own;
  };

  const out = [];
  const review = [];
  const handSameUsed = new Set();
  const handFamilyUsed = new Set();

  const makes = new Set([...oursByMake.keys(), ...acModelsByMake.keys()]);
  for (const make of [...makes].sort()) {
    const oursModels = oursByMake.get(make) ?? [];
    const acModels = acModelsByMake.get(make) ?? new Map();
    const emit = (row) => out.push({ canonical_make: make, ...row });

    /* Per year decisions. */
    const allYears = new Set();
    for (const years of acModels.values()) for (const y of years) allYears.add(y);
    /** our model -> Map(year -> the AC name it became `same` with) */
    const sameByOurs = new Map();

    for (const year of [...allYears].sort((a, b) => a - b)) {
      const acHere = [...acModels.entries()].filter(([, ys]) => ys.has(year)).map(([m]) => m);
      const claimedAc = new Set();
      const claimedOurs = new Map(); // our model -> AC name matched `same`

      /* 1. same: spelling keys first, then the hand table. */
      const oursKeyed = oursModels.map((v) => ({ v, keys: matchKeys(make, v.model) }));
      const hasData = (ac) => {
        const row = acBy.get(`${make}|${ac}|${year}`);
        return Boolean(row && (row.bolt_patterns || row.tire_sizes));
      };
      const compatible = (ac, ourName) =>
        ac === ourName || sameBolts(acBolt(make, ac, year), ourBolt(make, ourName, year));
      const refuse = (ac, ourName) =>
        review.push({
          make, year, ac_model: ac, our_model: ourName,
          ac_bolts: [...acBolt(make, ac, year)].join(";"),
          our_bolts: [...ourBolt(make, ourName, year)].join(";"),
          reason: "same name or hand pair but the bolt patterns differ: kept apart",
        });
      const claim = (ours, ac, why) => {
        claimedAc.add(ac);
        claimedOurs.set(ours.model, ac);
        emit({
          model: ours.model, year, canonical_model: ac, relation: "same",
          note: ac === ours.model ? "same spelling" : why, _ours: ours.model,
        });
        if (!sameByOurs.has(ours.model)) sameByOurs.set(ours.model, new Map());
        sameByOurs.get(ours.model).set(year, ac);
      };
      /* A second Auto Country model for a model of ours already matched: an
         alias of the first (the entry keeps the first one's name). */
      const second = (ours, ac, why) => {
        claimedAc.add(ac);
        emit({
          model: ac, year, canonical_model: claimedOurs.get(ours.model), relation: "member",
          note: why, _ours: ours.model,
        });
      };
      const acOrder = acHere
        .slice()
        .sort((a, b) => Number(hasData(b)) - Number(hasData(a)) || a.localeCompare(b));
      for (const ac of acOrder) {
        const acKeys = matchKeys(make, ac);
        const hit = oursKeyed.find(({ keys }) => [...acKeys].some((k) => keys.has(k)));
        if (!hit) continue;
        if (!compatible(ac, hit.v.model)) {
          refuse(ac, hit.v.model);
          continue;
        }
        if (claimedOurs.has(hit.v.model)) second(hit.v, ac, "second Auto Country spelling of the same model (data first)");
        else claim(hit.v, ac, "spelling");
      }
      for (const [hMake, hOurs, hAc, why] of SAME) {
        if (hMake !== make || !acHere.includes(hAc)) continue;
        const v = oursModels.find((x) => x.model === hOurs);
        if (!v) continue;
        const ours = claimedOurs.get(v.model);
        if (ours !== undefined) {
          /* Our model is matched already: this Auto Country model is a second name for it. */
          if (claimedAc.has(hAc) || !compatible(hAc, v.model)) continue;
          second(v, hAc, `hand table: ${why}`);
          handSameUsed.add(`${hMake}|${hOurs}|${hAc}`);
        } else if (!compatible(hAc, v.model)) {
          refuse(hAc, v.model);
        } else {
          /* Unclaimed model of ours: it takes the Auto Country name, even when
             another model of ours already has it (two of ours, one entry). */
          claim(v, hAc, `hand table: ${why}`);
          handSameUsed.add(`${hMake}|${hOurs}|${hAc}`);
        }
      }

      /* 2. families: the remaining AC models that are variants of one of ours. */
      /** our family -> [AC models] */
      const families = new Map();
      for (const ac of acHere) {
        if (claimedAc.has(ac)) continue;
        let family = null;
        let why = "";
        for (const [fMake, pattern, target, reason] of FAMILY) {
          if (fMake !== make || !pattern.test(ac)) continue;
          if (target === null) {
            /* The family is our model the name starts with (longest first). */
            const lower = norm(ac);
            const candidates = oursModels
              .filter((v) => lower.startsWith(norm(v.model)) && lower.length > norm(v.model).length)
              .sort((a, b) => b.model.length - a.model.length);
            if (candidates.length === 0) continue;
            family = candidates[0].model;
          } else {
            /* One or several of our models; the one built that year wins. */
            const names = Array.isArray(target) ? target : [target];
            const built = names.find((n) => oursModels.find((v) => v.model === n)?.years.has(year));
            family = built ?? names.find((n) => oursModels.some((v) => v.model === n)) ?? null;
            if (family === null) continue;
          }
          why = `hand table: ${reason}`;
          handFamilyUsed.add(`${fMake}|${pattern}|${String(target)}`);
          break;
        }
        if (family === null) {
          /* Our model name followed by a space: "Suburban 1500" -> "Suburban". */
          const lower = ac.toLowerCase();
          const candidates = oursModels
            .filter((v) => v.model.length >= 2 && (lower.startsWith(`${v.model.toLowerCase()} `) || lower.startsWith(`${v.model.toLowerCase()}-`)))
            .sort((a, b) => b.model.length - a.model.length);
          if (candidates.length > 0) {
            family = candidates[0].model;
            why = "the Auto Country name starts with our model name";
          }
        }
        if (family === null) continue;
        if (!families.has(family)) families.set(family, []);
        families.get(family).push({ ac, why });
      }

      for (const [family, members] of families) {
        /* The family entry's name: Auto Country's spelling if the family is `same` here. */
        const sameAc = claimedOurs.get(family) ?? null;
        const familyEntry = sameAc ?? family;
        const elements = [
          ...(sameAc ? [{ ac: sameAc, why: "same" }] : []),
          ...members,
        ];
        const sigOf = (ac) => [...acBolt(make, ac, year)].sort().join("|");
        const sigs = new Set(elements.map((el) => sigOf(el.ac)).filter(Boolean));
        /* With an anchor (our model is `same` with one of them) the members that
           share its pattern are aliases and the others are entries of their own.
           Without one, any two patterns make every member an entry (split). */
        const anchorSig = sameAc ? sigOf(sameAc) : "";
        for (const el of members) {
          const sig = sigOf(el.ac);
          const relation =
            sigs.size <= 1 || (anchorSig !== "" && (sig === "" || sig === anchorSig)) ? "member" : "split";
          claimedAc.add(el.ac);
          emit({
            model: el.ac, year, canonical_model: familyEntry, relation,
            note: relation === "member"
              ? `${el.why}; ${sigs.size <= 1 ? "one bolt pattern across the family" : "same bolt pattern as the model it follows"}`
              : `${el.why}; bolt patterns differ across the family (${[...sigs].join(" vs ")})`,
            _ours: family,
          });
        }
      }

      /* 3. ac-only. */
      for (const ac of acHere) {
        if (claimedAc.has(ac)) continue;
        emit({ model: ac, year, canonical_model: ac, relation: "ac-only", note: "no counterpart in vehicles.csv", _ours: null });
      }
    }

    /* 4. ours: every year ours offers, after the above. */
    const yearsClaimedBySame = new Map();
    for (const [model, byYear] of sameByOurs) yearsClaimedBySame.set(model, byYear);
    for (const v of oursModels) {
      const byYear = yearsClaimedBySame.get(v.model);
      const familyYears = new Set(
        out.filter((r) => r.canonical_make === make && r._ours === v.model && r.relation !== "same").map((r) => r.year),
      );
      for (const year of [...v.years].sort((a, b) => a - b)) {
        if (byYear?.has(year)) continue;
        /* Auto Country has no `same` partner this year. If it has one in other
           years, the model is still that entry: take the nearest year's name. */
        if (byYear && byYear.size > 0) {
          let best = null;
          for (const [y, ac] of byYear) {
            const distance = Math.abs(y - year);
            if (best === null || distance < best.distance || (distance === best.distance && y > best.y)) {
              best = { y, ac, distance };
            }
          }
          emit({
            model: v.model, year, canonical_model: best.ac, relation: "same",
            note: `no Auto Country listing this year; name follows ${best.y}`, _ours: v.model,
          });
          continue;
        }
        if (familyYears.has(year)) continue; // carried by its members' rows
        emit({ model: v.model, year, canonical_model: v.model, relation: "ours-only", note: "no counterpart in Auto Country's list", _ours: v.model });
      }
    }

    /* 5. One car, one entry: when Auto Country spells a model of ours two ways
       over the years (3 and Mazda3), the spelling used in most years is the
       entry and the other spelling becomes a `member` alias of it. */
    const byOurs = new Map();
    for (const r of out) {
      if (r.canonical_make !== make || r.relation !== "same") continue;
      if (!byOurs.has(r._ours)) byOurs.set(r._ours, []);
      byOurs.get(r._ours).push(r);
    }
    for (const [ourModel, sameRows] of byOurs) {
      const counts = new Map();
      for (const r of sameRows) {
        if (r.note.startsWith("no Auto Country listing")) continue;
        counts.set(r.canonical_model, (counts.get(r.canonical_model) ?? 0) + 1);
      }
      if (counts.size === 0) continue;
      const chosen = [...counts.entries()].sort(
        (a, b) => b[1] - a[1] || Number(b[0] === ourModel) - Number(a[0] === ourModel) || a[0].localeCompare(b[0]),
      )[0][0];
      for (const r of sameRows) {
        if (r.canonical_model === chosen) continue;
        if (!r.note.startsWith("no Auto Country listing")) {
          out.push({
            canonical_make: make, model: r.canonical_model, year: r.year, canonical_model: chosen,
            relation: "member",
            note: `Auto Country spells ${ourModel} "${r.canonical_model}" this year and "${chosen}" in most years`,
            _ours: ourModel,
          });
        }
        r.canonical_model = chosen;
        r.note = r.note.startsWith("no Auto Country listing") ? "no Auto Country listing this year; name follows the other years" : `Auto Country's name this year is another spelling; entry is "${chosen}"`;
      }
      for (const r of out) {
        if (r.canonical_make === make && r._ours === ourModel && (r.relation === "member" || r.relation === "split") && r.canonical_model !== chosen && !(r.note.startsWith("Auto Country spells"))) {
          r.canonical_model = chosen;
        }
      }
    }

    /* Undecided: an AC-only name close to an ours-only name. */
    const acOnlyNames = new Map();
    const oursOnlyNames = new Map();
    for (const r of out) {
      if (r.canonical_make !== make) continue;
      if (r.relation === "ac-only") {
        if (!acOnlyNames.has(r.model)) acOnlyNames.set(r.model, new Set());
        acOnlyNames.get(r.model).add(r.year);
      }
      if (r.relation === "ours-only") {
        if (!oursOnlyNames.has(r.model)) oursOnlyNames.set(r.model, new Set());
        oursOnlyNames.get(r.model).add(r.year);
      }
    }
    for (const [ac, acYears] of acOnlyNames) {
      for (const [ourName, ourYears] of oursOnlyNames) {
        const a = norm(ac);
        const b = norm(ourName);
        const close =
          (Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a))) ||
          (Math.min(a.length, b.length) >= 5 && distance(a, b) <= 1);
        if (!close) continue;
        if (SEPARATE.some(([m, a, o]) => m === make && a === ac && o === ourName)) continue;
        review.push({
          make, year: `${[...acYears].sort()[0]}-${[...acYears].sort().at(-1)} / ${[...ourYears].sort()[0]}-${[...ourYears].sort().at(-1)}`,
          ac_model: ac, our_model: ourName,
          ac_bolts: [...new Set([...acYears].flatMap((y) => [...acBolt(make, ac, y)]))].join(";"),
          our_bolts: [...new Set([...ourYears].flatMap((y) => [...ourBolt(make, ourName, y)]))].join(";"),
          reason: "similar names, no rule matched: left as two entries",
        });
      }
    }
  }

  for (const [hMake, hOurs, hAc] of SAME) {
    if (!handSameUsed.has(`${hMake}|${hOurs}|${hAc}`)) hand.unusedSame.push(`${hMake}|${hOurs}|${hAc}`);
  }
  return { out, review };
}

const hand = { unusedSame: [] };

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const next = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = row[j];
      row[j] = next;
    }
  }
  return row[b.length];
}

/** Years of identical rows collapsed into one. */
function collapseAliasRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = [row.canonical_make, row.model, row.canonical_model, row.relation, row.note].join("\u0000");
    if (!groups.has(key)) groups.set(key, { row, years: [] });
    groups.get(key).years.push(row.year);
  }
  const out = [];
  for (const { row, years } of groups.values()) {
    for (const [from, to] of yearRanges(years)) {
      out.push({
        make: row.canonical_make,
        model: row.model,
        year_from: from,
        year_to: to,
        canonical_make: row.canonical_make,
        canonical_model: row.canonical_model,
        relation: row.relation,
        note: row.note,
      });
    }
  }
  const order = { same: 0, member: 1, split: 2, "ac-only": 3, "ours-only": 4 };
  return out.sort(
    (a, b) =>
      a.make.localeCompare(b.make) ||
      a.model.localeCompare(b.model) ||
      order[a.relation] - order[b.relation] ||
      a.year_from - b.year_from,
  );
}

/* --- Main --------------------------------------------------------------------- */

const args = process.argv.slice(2);
const raw = args.includes("--raw") ? args[args.indexOf("--raw") + 1] : DEFAULT_RAW;

const ours = await readOurs();
const ourMakes = new Map(ours.vehicles.map((v) => [norm(v.make), v.make]));
const canonicalMake = (make) => ourMakes.get(norm(make)) ?? make;
const { years, report } = await loadRaw(raw, ours, canonicalMake);
const rows = [...years.values()]
  .map(toRow)
  .sort((a, b) => a.make.localeCompare(b.make) || a.model.localeCompare(b.model) || a.year - b.year);
if (rows.length === 0) throw new Error(`no Auto Country answers found under ${raw}`);
/* Familiar display names (DISPLAY above): rename before anything is decided. */
const displayYears = new Map();
for (const row of rows) {
  const hit = DISPLAY.find(([make, from]) => canonicalMake(row.make) === make && row.model === from);
  if (!hit) continue;
  const key = `${hit[0]}|${hit[1]}`;
  if (!displayYears.has(key)) displayYears.set(key, new Set());
  displayYears.get(key).add(Number(row.year));
  row.model = hit[2];
}
rows.sort((a, b) => a.make.localeCompare(b.make) || a.model.localeCompare(b.model) || a.year - b.year);
await writeFile(OUT_FITMENT, toCsv(FIT_HEADER, rows));

const { out: aliasRows, review } = decideNames(rows, ours, canonicalMake);
const aliases = collapseAliasRows(aliasRows);
/* One alias row per renamed entry: Auto Country's bare spelling -> the familiar name,
   over every year the entry is offered (Auto Country's years plus ours). */
for (const [make, from, to, reason] of DISPLAY) {
  const entryYears = new Set(displayYears.get(`${make}|${from}`) ?? []);
  for (const v of ours.vehicles) if (v.make === make && v.model === to) for (const y of v.years) entryYears.add(y);
  if (!displayYears.has(`${make}|${from}`)) {
    console.warn(`display rule matched nothing: ${make} ${from}`);
    continue;
  }
  for (const [yearFrom, yearTo] of yearRanges([...entryYears])) {
    aliases.push({
      make, model: from, year_from: yearFrom, year_to: yearTo, canonical_make: make,
      canonical_model: to, relation: "same", note: `display table (D156): ${reason}`,
    });
  }
}
const relationOrder = { same: 0, member: 1, split: 2, "ac-only": 3, "ours-only": 4 };
aliases.sort(
  (a, b) =>
    a.make.localeCompare(b.make) ||
    a.model.localeCompare(b.model) ||
    relationOrder[a.relation] - relationOrder[b.relation] ||
    a.year_from - b.year_from,
);
await writeFile(OUT_ALIASES, toCsv(ALIAS_HEADER, aliases));
await mkdir(path.dirname(OUT_REVIEW), { recursive: true });
await writeFile(
  OUT_REVIEW,
  toCsv(["make", "year", "ac_model", "our_model", "ac_bolts", "our_bolts", "reason"], review),
);

await writeFile(
  OUT_ROUTING,
  toCsv(
    ["make", "year", "ac_model", "trim", "routed_to", "rule"],
    [...report.routing].sort((a, b) => a.make.localeCompare(b.make) || a.year - b.year || a.ac_model.localeCompare(b.ac_model) || a.trim.localeCompare(b.trim)),
  ),
);
/* Model years with a trim the lookup answered 404 to (a "/" in the name). */
const missing = new Map();
for (const f of report.failed) {
  const key = `${f.make}|${f.model}|${f.year}`;
  if (!missing.has(key)) missing.set(key, { make: f.make, model: f.model, year: f.year, trims: [] });
  missing.get(key).trims.push(f.trim);
}
const missingRows = [...missing.values()]
  .map((m) => {
    const answered = report.answered.get(`${m.make}|${m.model}|${m.year}`) ?? 0;
    return {
      make: m.make, model: m.model, year: m.year, trims_404: m.trims.join(";"),
      answered_trims: answered, only_trims_404: answered === 0 ? "yes" : "no",
    };
  })
  .sort((a, b) => a.make.localeCompare(b.make) || a.model.localeCompare(b.model) || a.year - b.year);
/* Values Auto Country states that are not facts (see the options pass). */
const junkMap = new Map();
for (const j of report.junk) {
  const key = [j.make, j.model, j.year, j.field, j.raw].join("|");
  if (!junkMap.has(key)) junkMap.set(key, { ...j, trims: [] });
  junkMap.get(key).trims.push(j.trim);
}
const junkRows = [...junkMap.values()]
  .map((j) => ({ make: j.make, model: j.model, year: j.year, field: j.field, raw_value: j.raw, trims: j.trims.join(";") }))
  .sort((a, b) => a.make.localeCompare(b.make) || a.model.localeCompare(b.model) || a.year - b.year || a.field.localeCompare(b.field));
await writeFile(OUT_JUNK, toCsv(["make", "model", "year", "field", "raw_value", "trims"], junkRows));
await writeFile(OUT_MISSING, toCsv(["make", "model", "year", "trims_404", "answered_trims", "only_trims_404"], missingRows));

const withData = rows.filter((r) => r.bolt_patterns !== "" || r.tire_sizes !== "");
const modelsAc = new Set(rows.map((r) => `${r.make}|${r.model}`));
const byRelation = {};
for (const row of aliases) byRelation[row.relation] = (byRelation[row.relation] ?? 0) + 1;
const yearsSeen = [...new Set(rows.map((r) => r.year))].sort();
console.log(
  `${OUT_FITMENT}: ${rows.length} model-years (${withData.length} with fit data, ` +
    `${rows.length - withData.length} listed with none), ${modelsAc.size} models, years ${yearsSeen[0]}-${yearsSeen.at(-1)} ` +
    `(${yearsSeen.length} years present).`,
);
console.log(
  `options: ${report.optionOk} trims read, ${report.option404} answered 404 (trim names with a "/"), ` +
    `${report.noBodies} without a body; other chassis: ${report.chassisUnits} ` +
    `(${report.chassisResolved ?? 0} bolt pattern from the ranges, ${report.chassisMissing ?? 0} not yet crawled).`,
);
console.log(
  `sizes: ${stats.staggered} staggered options, ${stats.flotation} flotation, ${stats.lt} LT, ` +
    `unreadable thread ${JSON.stringify([...stats.threadUnreadable])}, dropped tire sizes ${JSON.stringify([...stats.tireDropped])}`,
);
console.log(
  `${OUT_ROUTING}: ${report.routing.length} trims routed to ${new Set(report.routing.map((r) => `${r.make}|${r.year}|${r.routed_to}`)).size} model-years of our own models.`,
);
console.log(
  `${OUT_MISSING}: ${missingRows.length} model-years with a trim that answered 404, ` +
    `${missingRows.filter((r) => r.only_trims_404 === "yes").length} of them with no answered trim at all.`,
);
console.log(
  `${OUT_JUNK}: ${junkRows.length} junk values left blank ` +
    JSON.stringify(junkRows.reduce((c, r) => ({ ...c, [r.field]: (c[r.field] ?? 0) + 1 }), {})) +
    `; ${stats.halfInch} half-inch wheel diameters taken from the tire's rim.`,
);
console.log(`${OUT_ALIASES}: ${aliases.length} rows ${JSON.stringify(byRelation)}`);
console.log(`${OUT_REVIEW}: ${review.length} undecided pairs`);
if (hand.unusedSame.length > 0) console.log(`hand-table SAME pairs not used yet: ${hand.unusedSame.length}`);
