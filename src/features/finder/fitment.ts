import "server-only";

import { VEHICLE_FITMENT_DATA, VEHICLE_FITMENT_GENERATIONS } from "./vehicle-fitment-data";

/**
 * Vehicle -> fitment, for the best/similar split on the three results pages.
 * Server only (`results/search.ts`): the real data is ~60 KB and no island
 * needs it.
 *
 * Sources, field by field (LA-05, D145 audit; owner rulings 2026-10-04/05).
 * The bolt pattern takes the first of these that has the vehicle:
 *
 * 1. **An exact-year row** from the ANKUSI wheel fitment dataset
 *    (`scripts/data/vehicle-fitment.csv`, built by `scripts/vehicle-fitment.mjs`).
 * 2. **A generation row** (`scripts/data/vehicle-fitment-generations.csv`,
 *    hand-kept): a year range two independent free sources agree on. A range
 *    marked `?` means the sources disagree: it claims no bolt pattern and the
 *    placeholder is NOT used for those years.
 * 3. **The nearest real year** of the same make + model (rows 1 and 2
 *    together; equidistant takes the later year; no distance cap), for a model
 *    that has real rows but none for the year picked. Owner, 2026-10-05: "Use
 *    the nearest real year". A `?` range blocks it for its years.
 * 4. **The D48(4) placeholder below**, only for a model with no real row at
 *    all (owner: "Keep placeholder for tires", "No, keep until replaced").
 * 5. Nothing.
 *
 * Centre bore follows the row the bolt pattern came from, never the
 * placeholder. The tire size, lug thread and TPMS frequency are always the
 * placeholder: no free source carries them per vehicle. A vehicle in no source filters nothing (D110).
 */

export interface VehicleFitment {
  /** ASCII `5x114.3`, as `WheelSpec.bolt` spells it. `null` = unknown. */
  boltPattern: string | null;
  /** Hub bore in mm (`64.1`), real data only. Not used to filter (see
   *  `src/features/finder/llm.md`). */
  centreBore: string | null;
  /** Where `boltPattern` came from: an exact-year ANKUSI row, a generation
   *  row, the nearest real year of the same model, the D48(4) placeholder, or
   *  nothing. */
  boltSource: "ankusi" | "generation" | "nearest" | "placeholder" | null;
  /** Placeholder (D48(4)): the one tire size the map gives the model. */
  tireSize: { width: string; profile: string; rim: string } | null;
  /** Placeholder (D67): lug-nut thread, ASCII `12x1.5`. */
  thread: string | null;
  /** Placeholder (D67): TPMS sensor frequency in MHz. The catalogue has no
   *  frequency column, so nothing reads it today (D109(12)). */
  tpms: string | null;
}

/* --- Real: exact years (ANKUSI) and generations ---------------------------- */

interface RealYear {
  /** `null` = a generation range the sources disagree on ("?"): claim nothing. */
  bolt: string | null;
  bore: string | null;
  source: "ankusi" | "generation";
}

/** "<Make>|<Model>" -> model year -> real row, built once per model on first use. */
const realCache = new Map<string, Map<number, RealYear> | null>();

function realYears(make: string, model: string): Map<number, RealYear> | null {
  const key = `${make}|${model}`;
  const cached = realCache.get(key);
  if (cached !== undefined) return cached;
  const exact = VEHICLE_FITMENT_DATA[key];
  const generations = VEHICLE_FITMENT_GENERATIONS[key];
  if (exact === undefined && generations === undefined) {
    realCache.set(key, null);
    return null;
  }
  const years = new Map<number, RealYear>();
  for (const entry of generations?.split(" ") ?? []) {
    const [range = "", fit = ""] = entry.split(":");
    const [from, to] = range.split("-").map(Number);
    const [bolt, bore] = fit.split("/");
    if (from === undefined || to === undefined) continue;
    for (let year = from; year <= to; year += 1) {
      years.set(year, {
        bolt: bolt && bolt !== "?" ? bolt : null,
        bore: bore ?? null,
        source: "generation",
      });
    }
  }
  /* An exact-year row wins over a generation row for the same year. */
  for (const entry of exact?.split(" ") ?? []) {
    const [built, fit = ""] = entry.split(":");
    const [bolt, bore] = fit.split("/");
    if (bolt) years.set(Number(built), { bolt, bore: bore ?? null, source: "ankusi" });
  }
  realCache.set(key, years);
  return years;
}

/**
 * The real year closest to `year` that claims a bolt pattern (a `?` range
 * claims none, so it is never borrowed from). Equidistant: the later year.
 * Distance is not capped: the owner ruled "use the nearest real year" for a
 * model that has real rows but none for the year picked (2026-10-05).
 */
function nearestReal(years: Map<number, RealYear>, year: number): RealYear | null {
  let best: { year: number; row: RealYear } | null = null;
  for (const [known, row] of years) {
    if (row.bolt === null) continue;
    if (
      best === null ||
      Math.abs(known - year) < Math.abs(best.year - year) ||
      (Math.abs(known - year) === Math.abs(best.year - year) && known > best.year)
    ) {
      best = { year: known, row };
    }
  }
  return best?.row ?? null;
}

/* --- Placeholder (D48(4), D58, D67) ---------------------------------------- */

/**
 * PLACEHOLDER FITMENT DATA (D48 item 4), generated 2026-09-21 and kept by the
 * owner until replaced. Owner, 2026-09-21: "all 5 are upto you. for data
 * related issues, they will be added later, use placeholder and temporary
 * data genrated by you".
 *
 * One tire size, one bolt pattern, one lug thread and one TPMS frequency per
 * make and model, **year-blind**, keyed `"<Make>|<Model>"` as vehicles.csv
 * spells them (`Chevrolet|Silverado` became `Silverado 1500` when the finder
 * moved to that list). NOT verified OE specs: the sizes were skewed toward
 * what the old seed stocked; the bolt patterns were assigned by make and the
 * D145 audit found 21 of 60 wrong, which is why a real bolt pattern for the
 * year always wins. Thread and TPMS were assigned by make (D67); Volkswagen's
 * `14x1.5` is a simplification, VW holds wheels on with bolts, not nuts.
 */
type Placeholder = readonly [
  width: string,
  profile: string,
  rim: string,
  bolt: string,
  thread: string,
  tpms: string,
];

const PLACEHOLDER: Readonly<Record<string, Placeholder>> = {
  "Chevrolet|Equinox": ["225", "50", "17", "5x114.3", "12x1.5", "315"],
  "Chevrolet|Malibu": ["225", "45", "17", "5x114.3", "12x1.5", "315"],
  "Chevrolet|Silverado 1500": ["265", "70", "17", "6x139.7", "14x1.5", "315"],
  "Chevrolet|Traverse": ["255", "65", "18", "5x114.3", "12x1.5", "315"],
  "Chevrolet|Trax": ["215", "50", "17", "5x114.3", "12x1.5", "315"],
  "Dodge|Charger": ["225", "45", "17", "5x114.3", "14x1.5", "315"],
  "Dodge|Durango": ["265", "60", "18", "5x114.3", "14x1.5", "315"],
  "Dodge|Hornet": ["225", "50", "17", "5x114.3", "14x1.5", "315"],
  "Ford|Bronco": ["255", "70", "16", "5x114.3", "14x1.5", "315"],
  "Ford|Edge": ["235", "65", "18", "5x114.3", "14x1.5", "315"],
  "Ford|Explorer": ["255", "65", "18", "5x114.3", "14x1.5", "315"],
  "Ford|F-150": ["275", "65", "18", "6x139.7", "14x1.5", "315"],
  "Ford|Mustang": ["225", "45", "17", "5x114.3", "14x1.5", "315"],
  "GMC|Acadia": ["225", "50", "17", "5x114.3", "12x1.5", "315"],
  "GMC|Sierra 1500": ["265", "70", "17", "6x139.7", "14x1.5", "315"],
  "GMC|Terrain": ["225", "50", "17", "5x114.3", "12x1.5", "315"],
  "GMC|Yukon": ["275", "60", "20", "6x139.7", "14x1.5", "315"],
  "Honda|Accord": ["225", "50", "17", "5x114.3", "12x1.5", "315"],
  "Honda|CR-V": ["225", "50", "17", "5x114.3", "12x1.5", "315"],
  "Honda|Civic": ["215", "55", "16", "5x114.3", "12x1.5", "315"],
  "Honda|HR-V": ["215", "50", "17", "5x114.3", "12x1.5", "315"],
  "Honda|Pilot": ["245", "60", "18", "5x114.3", "12x1.5", "315"],
  "Hyundai|Elantra": ["215", "55", "16", "5x114.3", "12x1.5", "433"],
  "Hyundai|Kona": ["215", "50", "17", "5x114.3", "12x1.5", "433"],
  "Hyundai|Santa Fe": ["225", "50", "17", "5x114.3", "12x1.5", "433"],
  "Hyundai|Tucson": ["225", "50", "17", "5x114.3", "12x1.5", "433"],
  "Jeep|Compass": ["225", "50", "17", "5x114.3", "12x1.25", "315"],
  "Jeep|Grand Cherokee": ["265", "60", "18", "5x114.3", "14x1.5", "315"],
  "Jeep|Wrangler": ["245", "75", "17", "6x139.7", "14x1.5", "315"],
  "Kia|Forte": ["215", "55", "16", "5x114.3", "12x1.5", "433"],
  "Kia|Sorento": ["225", "50", "17", "5x114.3", "12x1.5", "433"],
  "Kia|Sportage": ["225", "50", "17", "5x114.3", "12x1.5", "433"],
  "Kia|Telluride": ["245", "60", "18", "5x114.3", "12x1.5", "433"],
  "Mazda|CX-30": ["215", "50", "17", "5x114.3", "12x1.5", "315"],
  "Mazda|CX-5": ["225", "50", "17", "5x114.3", "12x1.5", "315"],
  "Mazda|CX-90": ["255", "55", "19", "5x114.3", "12x1.5", "315"],
  "Mazda|Mazda3": ["225", "45", "17", "5x114.3", "12x1.5", "315"],
  "Nissan|Kicks": ["215", "50", "17", "5x114.3", "12x1.25", "315"],
  "Nissan|Pathfinder": ["255", "65", "18", "5x114.3", "12x1.25", "315"],
  "Nissan|Rogue": ["225", "50", "17", "5x114.3", "12x1.25", "315"],
  "Nissan|Sentra": ["215", "55", "16", "5x114.3", "12x1.25", "315"],
  "Ram|1500": ["275", "65", "18", "6x139.7", "14x1.5", "315"],
  "Ram|2500": ["275", "70", "18", "6x139.7", "14x1.5", "315"],
  "Ram|3500": ["235", "80", "17", "6x139.7", "14x1.5", "315"],
  "Subaru|Crosstrek": ["225", "50", "17", "5x100", "12x1.25", "315"],
  "Subaru|Forester": ["225", "50", "17", "5x100", "12x1.25", "315"],
  "Subaru|Impreza": ["215", "50", "17", "5x100", "12x1.25", "315"],
  "Subaru|Outback": ["225", "50", "17", "5x100", "12x1.25", "315"],
  "Tesla|Model 3": ["235", "40", "18", "5x114.3", "14x1.5", "433"],
  "Tesla|Model S": ["235", "40", "18", "5x114.3", "14x1.5", "433"],
  "Tesla|Model X": ["265", "45", "20", "5x114.3", "14x1.5", "433"],
  "Tesla|Model Y": ["235", "40", "18", "5x114.3", "14x1.5", "433"],
  "Toyota|Camry": ["225", "45", "17", "5x114.3", "12x1.5", "315"],
  "Toyota|Corolla": ["215", "55", "16", "5x114.3", "12x1.5", "315"],
  "Toyota|Highlander": ["235", "65", "18", "5x114.3", "12x1.5", "315"],
  "Toyota|RAV4": ["225", "50", "17", "5x114.3", "12x1.5", "315"],
  "Toyota|Tacoma": ["265", "70", "16", "6x139.7", "12x1.5", "315"],
  "Volkswagen|Atlas": ["245", "60", "18", "5x112", "14x1.5", "433"],
  "Volkswagen|Jetta": ["215", "55", "16", "5x112", "14x1.5", "433"],
  "Volkswagen|Tiguan": ["225", "50", "17", "5x112", "14x1.5", "433"],
};

/**
 * The fitment the site uses for a vehicle the finder offers. `null` when
 * neither source knows the make and model at all, which the caller treats as
 * no vehicle (D47(8): no size given, every result is a best match). Exact
 * strings: `query.ts` has already checked them against the finder list.
 */
export function findFitment(year: string, make: string, model: string): VehicleFitment | null {
  const built = Number(year);
  const years = realYears(make, model);
  const placeholder = PLACEHOLDER[`${make}|${model}`] ?? null;
  if (years === null && placeholder === null) return null;

  let boltPattern: string | null = null;
  let boltSource: VehicleFitment["boltSource"] = null;
  let centreBore: string | null = null;
  if (years !== null) {
    /* A model with any real row never uses the placeholder's bolt pattern. */
    const own = Number.isInteger(built) ? (years.get(built) ?? null) : null;
    if (own !== null) {
      boltPattern = own.bolt;
      centreBore = own.bolt === null ? null : own.bore;
      boltSource = own.bolt === null ? null : own.source;
    } else if (Number.isInteger(built)) {
      const near = nearestReal(years, built);
      if (near !== null) {
        boltPattern = near.bolt;
        centreBore = near.bore;
        boltSource = "nearest";
      }
    }
  } else if (placeholder !== null) {
    boltPattern = placeholder[3];
    boltSource = "placeholder";
  }
  return {
    boltPattern,
    centreBore,
    boltSource,
    tireSize:
      placeholder === null
        ? null
        : { width: placeholder[0], profile: placeholder[1], rim: placeholder[2] },
    thread: placeholder?.[4] ?? null,
    tpms: placeholder?.[5] ?? null,
  };
}
