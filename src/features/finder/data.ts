/**
 * SAMPLE DATA (D27) — Year/Make/Model seed for the vehicle finder.
 *
 * The owner's ruling was explicit: "you can make a small list yourself now,
 * use excel if needed or scrape from online" (root llm.md §5b D27). This is
 * NOT derived from the wheel CSV (D9 — "use as reference. dont make changes
 * pr decisons based on these"); it is a small, plausible list of years, makes
 * and models common on Ontario roads, built from public manufacturer model
 * lists checked via web search on 2026-09-20 (Honda, Toyota, Ford, Chevrolet,
 * Hyundai, Kia, Nissan, Mazda, Volkswagen, Subaru, Jeep, Ram, Dodge, GMC and
 * Tesla Canada lineup pages — see the finder llm.md Open section). Replace
 * with real fitment data once the shop's own catalogue exists.
 *
 * Notes on choices made while checking sources:
 * - Ford Escape is being discontinued for 2026 and is left off; Bronco, Edge,
 *   Explorer, F-150 and Mustang are current.
 * - Nissan Altima is discontinued for the Canadian market after MY2025 and is
 *   left off in favour of Kicks, Pathfinder, Rogue and Sentra.
 * - Ram's lineup is trims of one truck family, not distinct nameplates, so
 *   the "models" are its cab/payload series: 1500, 2500, 3500.
 */

/** Current year down to eleven years back — computed, never hard-coded (D32 precedent). */
const CURRENT_YEAR = new Date().getFullYear();

export const FINDER_YEARS: readonly number[] = Array.from(
  { length: 12 },
  (_, index) => CURRENT_YEAR - index,
);

export interface FinderMake {
  make: string;
  models: readonly string[];
}

/** Sorted alphabetically by make; each make's models sorted alphabetically. */
export const FINDER_MAKES: ReadonlyArray<FinderMake> = [
  { make: "Chevrolet", models: ["Equinox", "Malibu", "Silverado", "Traverse", "Trax"] },
  { make: "Dodge", models: ["Charger", "Durango", "Hornet"] },
  { make: "Ford", models: ["Bronco", "Edge", "Explorer", "F-150", "Mustang"] },
  { make: "GMC", models: ["Acadia", "Sierra 1500", "Terrain", "Yukon"] },
  { make: "Honda", models: ["Accord", "CR-V", "Civic", "HR-V", "Pilot"] },
  { make: "Hyundai", models: ["Elantra", "Kona", "Santa Fe", "Tucson"] },
  { make: "Jeep", models: ["Compass", "Grand Cherokee", "Wrangler"] },
  { make: "Kia", models: ["Forte", "Sorento", "Sportage", "Telluride"] },
  { make: "Mazda", models: ["CX-30", "CX-5", "CX-90", "Mazda3"] },
  { make: "Nissan", models: ["Kicks", "Pathfinder", "Rogue", "Sentra"] },
  { make: "Ram", models: ["1500", "2500", "3500"] },
  { make: "Subaru", models: ["Crosstrek", "Forester", "Impreza", "Outback"] },
  { make: "Tesla", models: ["Model 3", "Model S", "Model X", "Model Y"] },
  { make: "Toyota", models: ["Camry", "Corolla", "Highlander", "RAV4", "Tacoma"] },
  { make: "Volkswagen", models: ["Atlas", "Jetta", "Tiguan"] },
];

/* --- Fitment (placeholder) ------------------------------------------------ */

/**
 * PLACEHOLDER FITMENT DATA (D48 item 4) — generated 2026-09-21.
 *
 * Owner, 2026-09-21 (root llm.md §5b D48): "all 5 are upto you. for data
 * related issues, they will be added later, use placeholder and temporary
 * data genrated by you"
 *
 * One tire size per make/model pair, keyed `"<Make>|<Model>"` exactly as
 * `FINDER_MAKES` spells them, one entry for every pair with no gaps.
 *
 * **Year is ignored.** The map has no year axis, so every year of a model
 * resolves to the same size. Real fitment data is year- and trim-specific;
 * this is not, and `findFitment()` deliberately takes no year argument.
 *
 * NOT derived from the wheel CSV (D9). These are NOT verified OE specs: sizes
 * are deliberately skewed toward the five sizes the catalog seed actually
 * carries — 215/55R16, 215/50R17, 225/45R17, 225/50R17, 235/40R18
 * (`src/features/catalog/data.ts`) — so that a finder submit produces a real
 * best/similar split (D47(8)). 38 of the 60 pairs land on one of those five;
 * the remaining 22 — full-size trucks, three-row SUVs and large-wheel EVs —
 * carry honest sizes the seed does not stock, so the empty `Best matches`
 * state is reachable from the finder. Replace the whole map with real fitment
 * data when the client supplies it (root llm.md §7.13).
 */

export interface FitmentSize {
  width: string;
  profile: string;
  rim: string;
}

/** Keyed `"<Make>|<Model>"`. Sample data — see the block comment above. */
export const FITMENT: Readonly<Record<string, FitmentSize>> = {
  /* Chevrolet */
  "Chevrolet|Equinox": { width: "225", profile: "50", rim: "17" },
  "Chevrolet|Malibu": { width: "225", profile: "45", rim: "17" },
  "Chevrolet|Silverado": { width: "265", profile: "70", rim: "17" },
  "Chevrolet|Traverse": { width: "255", profile: "65", rim: "18" },
  "Chevrolet|Trax": { width: "215", profile: "50", rim: "17" },

  /* Dodge */
  "Dodge|Charger": { width: "225", profile: "45", rim: "17" },
  "Dodge|Durango": { width: "265", profile: "60", rim: "18" },
  "Dodge|Hornet": { width: "225", profile: "50", rim: "17" },

  /* Ford */
  "Ford|Bronco": { width: "255", profile: "70", rim: "16" },
  "Ford|Edge": { width: "235", profile: "65", rim: "18" },
  "Ford|Explorer": { width: "255", profile: "65", rim: "18" },
  "Ford|F-150": { width: "275", profile: "65", rim: "18" },
  "Ford|Mustang": { width: "225", profile: "45", rim: "17" },

  /* GMC */
  "GMC|Acadia": { width: "225", profile: "50", rim: "17" },
  "GMC|Sierra 1500": { width: "265", profile: "70", rim: "17" },
  "GMC|Terrain": { width: "225", profile: "50", rim: "17" },
  "GMC|Yukon": { width: "275", profile: "60", rim: "20" },

  /* Honda */
  "Honda|Accord": { width: "225", profile: "50", rim: "17" },
  "Honda|CR-V": { width: "225", profile: "50", rim: "17" },
  "Honda|Civic": { width: "215", profile: "55", rim: "16" },
  "Honda|HR-V": { width: "215", profile: "50", rim: "17" },
  "Honda|Pilot": { width: "245", profile: "60", rim: "18" },

  /* Hyundai */
  "Hyundai|Elantra": { width: "215", profile: "55", rim: "16" },
  "Hyundai|Kona": { width: "215", profile: "50", rim: "17" },
  "Hyundai|Santa Fe": { width: "225", profile: "50", rim: "17" },
  "Hyundai|Tucson": { width: "225", profile: "50", rim: "17" },

  /* Jeep */
  "Jeep|Compass": { width: "225", profile: "50", rim: "17" },
  "Jeep|Grand Cherokee": { width: "265", profile: "60", rim: "18" },
  "Jeep|Wrangler": { width: "245", profile: "75", rim: "17" },

  /* Kia */
  "Kia|Forte": { width: "215", profile: "55", rim: "16" },
  "Kia|Sorento": { width: "225", profile: "50", rim: "17" },
  "Kia|Sportage": { width: "225", profile: "50", rim: "17" },
  "Kia|Telluride": { width: "245", profile: "60", rim: "18" },

  /* Mazda */
  "Mazda|CX-30": { width: "215", profile: "50", rim: "17" },
  "Mazda|CX-5": { width: "225", profile: "50", rim: "17" },
  "Mazda|CX-90": { width: "255", profile: "55", rim: "19" },
  "Mazda|Mazda3": { width: "225", profile: "45", rim: "17" },

  /* Nissan */
  "Nissan|Kicks": { width: "215", profile: "50", rim: "17" },
  "Nissan|Pathfinder": { width: "255", profile: "65", rim: "18" },
  "Nissan|Rogue": { width: "225", profile: "50", rim: "17" },
  "Nissan|Sentra": { width: "215", profile: "55", rim: "16" },

  /* Ram */
  "Ram|1500": { width: "275", profile: "65", rim: "18" },
  "Ram|2500": { width: "275", profile: "70", rim: "18" },
  "Ram|3500": { width: "235", profile: "80", rim: "17" },

  /* Subaru */
  "Subaru|Crosstrek": { width: "225", profile: "50", rim: "17" },
  "Subaru|Forester": { width: "225", profile: "50", rim: "17" },
  "Subaru|Impreza": { width: "215", profile: "50", rim: "17" },
  "Subaru|Outback": { width: "225", profile: "50", rim: "17" },

  /* Tesla */
  "Tesla|Model 3": { width: "235", profile: "40", rim: "18" },
  "Tesla|Model S": { width: "235", profile: "40", rim: "18" },
  "Tesla|Model X": { width: "265", profile: "45", rim: "20" },
  "Tesla|Model Y": { width: "235", profile: "40", rim: "18" },

  /* Toyota */
  "Toyota|Camry": { width: "225", profile: "45", rim: "17" },
  "Toyota|Corolla": { width: "215", profile: "55", rim: "16" },
  "Toyota|Highlander": { width: "235", profile: "65", rim: "18" },
  "Toyota|RAV4": { width: "225", profile: "50", rim: "17" },
  "Toyota|Tacoma": { width: "265", profile: "70", rim: "16" },

  /* Volkswagen */
  "Volkswagen|Atlas": { width: "245", profile: "60", rim: "18" },
  "Volkswagen|Jetta": { width: "215", profile: "55", rim: "16" },
  "Volkswagen|Tiguan": { width: "225", profile: "50", rim: "17" },
};

/** Case-insensitive, trimmed lookup into `FITMENT`. Returns `null` when the
 *  pair is not in the map — the caller then treats the vehicle as carrying no
 *  size at all (D47(8): no size given → every result is a best match).
 *  Takes no year: see the block comment above. */
export function findFitment(make: string, model: string): FitmentSize | null {
  const wanted = `${make.trim()}|${model.trim()}`.toLowerCase();
  for (const [key, size] of Object.entries(FITMENT)) {
    if (key.toLowerCase() === wanted) return size;
  }
  return null;
}
