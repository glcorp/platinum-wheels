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

/**
 * Current year down to eleven years back — **computed at render** (D32), which
 * is why this is a function and not a constant.
 *
 * It used to be `const CURRENT_YEAR = new Date().getFullYear()` at module
 * scope with a list derived from it, so the list was frozen for the life of the
 * server process and baked into every prerendered page: it went stale across a
 * year boundary until a restart, and would have become a hydration mismatch the
 * moment a `"use client"` file imported it. The comment cited D32 while
 * defeating it. Called per render, the list is correct on every request.
 * (D66, 2026-09-22.)
 */
export function finderYears(): readonly number[] {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 12 }, (_, index) => currentYear - index);
}

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
 *
 * **`bolt` joins every entry (D58).** A wheel is filtered on bolt pattern,
 * not tire size, so the same placeholder map now also drives `/wheels`'
 * best/similar split. Still year-blind, still placeholder, ASCII exactly as
 * `WheelSpec.bolt` spells it (`5x114.3`). Assigned by make, per the
 * coordinator's ruling 2026-09-21:
 *   - Honda, Toyota (except Tacoma), Nissan (except none in this seed),
 *     Mazda, Hyundai, Kia → `5x114.3`
 *   - Subaru → `5x100`
 *   - Volkswagen → `5x112` — **deliberately a pattern no wheel in the seed
 *     carries**, so a VW submit exercises the "no exact fit, here are
 *     similar" path rather than a real match.
 *   - Chevrolet Silverado, GMC Sierra 1500 / Yukon, Ford F-150, Ram (all),
 *     Toyota Tacoma, Jeep Wrangler → `6x139.7` (truck/full-size pattern)
 *   - every other Chevrolet / Ford / GMC / Jeep / Dodge car or crossover →
 *     `5x114.3`
 *   - Tesla is not covered by any named rule; treated as a car/crossover and
 *     given `5x114.3` too, noted per-entry below.
 *
 * **`thread` and `tpms` join every entry (D67, 2026-09-22).** The owner vetoed
 * D59(2) — "an accessory derives nothing from a vehicle" — because the seed
 * contradicts it: it sells lug nuts in 12×1.5 and 12×1.25 and TPMS sensors at
 * 315 MHz and 433 MHz, and the car decides both. `/accessories` now renders
 * the finder, and these two fields are what a vehicle there resolves to.
 *
 * **They are placeholder in exactly the sense the rest of this map is (D48),
 * and MUST be replaced with real data before launch.** They are plausible per
 * make, not verified per trim: a real thread pitch is model- and
 * generation-specific (a 2014 and a 2024 of the same nameplate can differ),
 * and a real TPMS frequency is market- and model-year-specific. Nothing here
 * was looked up against a fitment database. Assigned by make, coordinator
 * 2026-09-22:
 *   `thread` — lug-nut thread pitch, ASCII `<diameter>x<pitch>`, the spelling
 *   the accessory seed's spec strings carry in typographic form (`12×1.5`):
 *   - Honda, Toyota, Mazda, Hyundai, Kia → `12x1.5`
 *   - Nissan, Subaru → `12x1.25`
 *   - Jeep Compass → `12x1.25`; Grand Cherokee and Wrangler → `14x1.5`
 *   - Chevrolet and GMC cars/crossovers → `12x1.5`; Silverado, Sierra 1500
 *     and Yukon → `14x1.5`
 *   - Ford (all, including the cars — modern Ford is `14x1.5` throughout),
 *     Ram, Dodge, Tesla → `14x1.5`
 *   - **Volkswagen → `14x1.5`, and it is a simplification.** VW and Audi
 *     hold the wheel on with BOLTS threaded into the hub, not nuts on studs,
 *     so a "lug nut thread pitch" is not the right fact about the car at all.
 *     The bolt's own thread is `14x1.5`, so that is what is recorded; a real
 *     catalogue would sell a VW owner bolts, not nuts, and this map has no
 *     way to say so. Flagged rather than hidden.
 *   - `14x1.5` is carried by NO accessory in the seed, which is deliberate in
 *     the same way the VW bolt pattern is: a Ford or Ram submit exercises the
 *     "no exact fit, here is what still fits" path.
 *   `tpms` — sensor radio frequency in MHz, `"315"` or `"433"`, matching the
 *   two frequencies the accessory seed stocks:
 *   - Hyundai, Kia, Volkswagen, Tesla → `433`
 *   - every other make → `315`
 */

export interface FitmentSize {
  width: string;
  profile: string;
  rim: string;
  /** Placeholder bolt pattern, ASCII exactly as `WheelSpec.bolt` spells it
   *  (`5x114.3`). Drives the best/similar split on `/wheels` (D58). */
  bolt: string;
  /** Placeholder lug-nut thread pitch, ASCII `<diameter>x<pitch>` —
   *  `12x1.5`, `12x1.25`, `14x1.5`. The accessory seed spells the same fact
   *  typographically inside a spec string (`Set of 20 · 12×1.5`, U+00D7), so
   *  `results/search.ts` normalises both sides before comparing rather than
   *  matching raw text. Drives half the best/similar split on `/accessories`
   *  (D67). */
  thread: string;
  /** Placeholder TPMS sensor frequency in MHz — `"315"` or `"433"`, the two
   *  the accessory seed stocks. Drives the other half of the
   *  `/accessories` split (D67). */
  tpms: string;
}

/** Keyed `"<Make>|<Model>"`. Sample data — see the block comment above. */
export const FITMENT: Readonly<Record<string, FitmentSize>> = {
  /* Chevrolet — car/crossover → 5x114.3; Silverado is a truck → 6x139.7 */
  "Chevrolet|Equinox": { width: "225", profile: "50", rim: "17", bolt: "5x114.3", thread: "12x1.5", tpms: "315" },
  "Chevrolet|Malibu": { width: "225", profile: "45", rim: "17", bolt: "5x114.3", thread: "12x1.5", tpms: "315" },
  "Chevrolet|Silverado": { width: "265", profile: "70", rim: "17", bolt: "6x139.7", thread: "14x1.5", tpms: "315" },
  "Chevrolet|Traverse": { width: "255", profile: "65", rim: "18", bolt: "5x114.3", thread: "12x1.5", tpms: "315" },
  "Chevrolet|Trax": { width: "215", profile: "50", rim: "17", bolt: "5x114.3", thread: "12x1.5", tpms: "315" },

  /* Dodge — car/crossover, none are trucks → 5x114.3 */
  "Dodge|Charger": { width: "225", profile: "45", rim: "17", bolt: "5x114.3", thread: "14x1.5", tpms: "315" },
  "Dodge|Durango": { width: "265", profile: "60", rim: "18", bolt: "5x114.3", thread: "14x1.5", tpms: "315" },
  "Dodge|Hornet": { width: "225", profile: "50", rim: "17", bolt: "5x114.3", thread: "14x1.5", tpms: "315" },

  /* Ford — car/crossover → 5x114.3; F-150 is a truck → 6x139.7 */
  "Ford|Bronco": { width: "255", profile: "70", rim: "16", bolt: "5x114.3", thread: "14x1.5", tpms: "315" },
  "Ford|Edge": { width: "235", profile: "65", rim: "18", bolt: "5x114.3", thread: "14x1.5", tpms: "315" },
  "Ford|Explorer": { width: "255", profile: "65", rim: "18", bolt: "5x114.3", thread: "14x1.5", tpms: "315" },
  "Ford|F-150": { width: "275", profile: "65", rim: "18", bolt: "6x139.7", thread: "14x1.5", tpms: "315" },
  "Ford|Mustang": { width: "225", profile: "45", rim: "17", bolt: "5x114.3", thread: "14x1.5", tpms: "315" },

  /* GMC — car/crossover → 5x114.3; Sierra 1500 and Yukon are trucks → 6x139.7 */
  "GMC|Acadia": { width: "225", profile: "50", rim: "17", bolt: "5x114.3", thread: "12x1.5", tpms: "315" },
  "GMC|Sierra 1500": { width: "265", profile: "70", rim: "17", bolt: "6x139.7", thread: "14x1.5", tpms: "315" },
  "GMC|Terrain": { width: "225", profile: "50", rim: "17", bolt: "5x114.3", thread: "12x1.5", tpms: "315" },
  "GMC|Yukon": { width: "275", profile: "60", rim: "20", bolt: "6x139.7", thread: "14x1.5", tpms: "315" },

  /* Honda → 5x114.3 */
  "Honda|Accord": { width: "225", profile: "50", rim: "17", bolt: "5x114.3", thread: "12x1.5", tpms: "315" },
  "Honda|CR-V": { width: "225", profile: "50", rim: "17", bolt: "5x114.3", thread: "12x1.5", tpms: "315" },
  "Honda|Civic": { width: "215", profile: "55", rim: "16", bolt: "5x114.3", thread: "12x1.5", tpms: "315" },
  "Honda|HR-V": { width: "215", profile: "50", rim: "17", bolt: "5x114.3", thread: "12x1.5", tpms: "315" },
  "Honda|Pilot": { width: "245", profile: "60", rim: "18", bolt: "5x114.3", thread: "12x1.5", tpms: "315" },

  /* Hyundai → 5x114.3 */
  "Hyundai|Elantra": { width: "215", profile: "55", rim: "16", bolt: "5x114.3", thread: "12x1.5", tpms: "433" },
  "Hyundai|Kona": { width: "215", profile: "50", rim: "17", bolt: "5x114.3", thread: "12x1.5", tpms: "433" },
  "Hyundai|Santa Fe": { width: "225", profile: "50", rim: "17", bolt: "5x114.3", thread: "12x1.5", tpms: "433" },
  "Hyundai|Tucson": { width: "225", profile: "50", rim: "17", bolt: "5x114.3", thread: "12x1.5", tpms: "433" },

  /* Jeep — car/crossover → 5x114.3; Wrangler is on the truck/off-road list → 6x139.7 */
  "Jeep|Compass": { width: "225", profile: "50", rim: "17", bolt: "5x114.3", thread: "12x1.25", tpms: "315" },
  "Jeep|Grand Cherokee": { width: "265", profile: "60", rim: "18", bolt: "5x114.3", thread: "14x1.5", tpms: "315" },
  "Jeep|Wrangler": { width: "245", profile: "75", rim: "17", bolt: "6x139.7", thread: "14x1.5", tpms: "315" },

  /* Kia → 5x114.3 */
  "Kia|Forte": { width: "215", profile: "55", rim: "16", bolt: "5x114.3", thread: "12x1.5", tpms: "433" },
  "Kia|Sorento": { width: "225", profile: "50", rim: "17", bolt: "5x114.3", thread: "12x1.5", tpms: "433" },
  "Kia|Sportage": { width: "225", profile: "50", rim: "17", bolt: "5x114.3", thread: "12x1.5", tpms: "433" },
  "Kia|Telluride": { width: "245", profile: "60", rim: "18", bolt: "5x114.3", thread: "12x1.5", tpms: "433" },

  /* Mazda → 5x114.3 */
  "Mazda|CX-30": { width: "215", profile: "50", rim: "17", bolt: "5x114.3", thread: "12x1.5", tpms: "315" },
  "Mazda|CX-5": { width: "225", profile: "50", rim: "17", bolt: "5x114.3", thread: "12x1.5", tpms: "315" },
  "Mazda|CX-90": { width: "255", profile: "55", rim: "19", bolt: "5x114.3", thread: "12x1.5", tpms: "315" },
  "Mazda|Mazda3": { width: "225", profile: "45", rim: "17", bolt: "5x114.3", thread: "12x1.5", tpms: "315" },

  /* Nissan — Titan/Frontier are excluded by the rule but neither is in this
     seed, so every Nissan model here → 5x114.3 */
  "Nissan|Kicks": { width: "215", profile: "50", rim: "17", bolt: "5x114.3", thread: "12x1.25", tpms: "315" },
  "Nissan|Pathfinder": { width: "255", profile: "65", rim: "18", bolt: "5x114.3", thread: "12x1.25", tpms: "315" },
  "Nissan|Rogue": { width: "225", profile: "50", rim: "17", bolt: "5x114.3", thread: "12x1.25", tpms: "315" },
  "Nissan|Sentra": { width: "215", profile: "55", rim: "16", bolt: "5x114.3", thread: "12x1.25", tpms: "315" },

  /* Ram — all Ram is a truck family → 6x139.7 */
  "Ram|1500": { width: "275", profile: "65", rim: "18", bolt: "6x139.7", thread: "14x1.5", tpms: "315" },
  "Ram|2500": { width: "275", profile: "70", rim: "18", bolt: "6x139.7", thread: "14x1.5", tpms: "315" },
  "Ram|3500": { width: "235", profile: "80", rim: "17", bolt: "6x139.7", thread: "14x1.5", tpms: "315" },

  /* Subaru → 5x100 */
  "Subaru|Crosstrek": { width: "225", profile: "50", rim: "17", bolt: "5x100", thread: "12x1.25", tpms: "315" },
  "Subaru|Forester": { width: "225", profile: "50", rim: "17", bolt: "5x100", thread: "12x1.25", tpms: "315" },
  "Subaru|Impreza": { width: "215", profile: "50", rim: "17", bolt: "5x100", thread: "12x1.25", tpms: "315" },
  "Subaru|Outback": { width: "225", profile: "50", rim: "17", bolt: "5x100", thread: "12x1.25", tpms: "315" },

  /* Tesla — not covered by a named rule; treated as a car/crossover → 5x114.3 */
  "Tesla|Model 3": { width: "235", profile: "40", rim: "18", bolt: "5x114.3", thread: "14x1.5", tpms: "433" },
  "Tesla|Model S": { width: "235", profile: "40", rim: "18", bolt: "5x114.3", thread: "14x1.5", tpms: "433" },
  "Tesla|Model X": { width: "265", profile: "45", rim: "20", bolt: "5x114.3", thread: "14x1.5", tpms: "433" },
  "Tesla|Model Y": { width: "235", profile: "40", rim: "18", bolt: "5x114.3", thread: "14x1.5", tpms: "433" },

  /* Toyota → 5x114.3; Tacoma is a truck → 6x139.7 */
  "Toyota|Camry": { width: "225", profile: "45", rim: "17", bolt: "5x114.3", thread: "12x1.5", tpms: "315" },
  "Toyota|Corolla": { width: "215", profile: "55", rim: "16", bolt: "5x114.3", thread: "12x1.5", tpms: "315" },
  "Toyota|Highlander": { width: "235", profile: "65", rim: "18", bolt: "5x114.3", thread: "12x1.5", tpms: "315" },
  "Toyota|RAV4": { width: "225", profile: "50", rim: "17", bolt: "5x114.3", thread: "12x1.5", tpms: "315" },
  "Toyota|Tacoma": { width: "265", profile: "70", rim: "16", bolt: "6x139.7", thread: "12x1.5", tpms: "315" },

  /* Volkswagen → 5x112 — deliberately a pattern no wheel in the seed carries,
     so a VW submit exercises the "no exact fit, here are similar" path. */
  "Volkswagen|Atlas": { width: "245", profile: "60", rim: "18", bolt: "5x112", thread: "14x1.5", tpms: "433" },
  "Volkswagen|Jetta": { width: "215", profile: "55", rim: "16", bolt: "5x112", thread: "14x1.5", tpms: "433" },
  "Volkswagen|Tiguan": { width: "225", profile: "50", rim: "17", bolt: "5x112", thread: "14x1.5", tpms: "433" },
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
