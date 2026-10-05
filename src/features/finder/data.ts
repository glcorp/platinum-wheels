/**
 * The finder's Year / Make / Model list, and the one check of what counts as a
 * vehicle. Client-safe: `results/query.ts` imports `isFinderVehicle`, and the
 * filter rail (a `"use client"` island) imports that file, so nothing here may
 * pull in fitment data. Fitment lives in `fitment.ts`, which only the server
 * reads.
 *
 * The list is NHTSA vPIC's register of what each maker built in each model
 * year (D110), committed as `scripts/data/vehicles.csv` and compiled into
 * `vehicle-list.ts` by `scripts/vehicle-fitment.mjs`. It replaces the D27
 * 15-make seed (LA-05, D145 audit): 47 makes, 843 models, model years
 * 2005 onward, and each model offered only in the years it was built.
 */

import { shopYear } from "@/lib/time";

import { VEHICLE_LIST } from "./vehicle-list";
import { builtIn, yearRanges } from "./years";

export { builtIn, yearRanges };

export interface FinderModel {
  model: string;
  /** Model years as vehicles.csv writes them: "2005-2011;2019-2027". */
  years: string;
}

export interface FinderMake {
  make: string;
  /** Every year any of this make's models was built, same notation. */
  years: string;
  models: readonly FinderModel[];
}

/** The union of several range strings, compacted back into the same notation. */
function unionRanges(all: readonly string[]): string {
  const years = new Set<number>();
  for (const ranges of all) {
    for (const [from, to] of yearRanges(ranges)) {
      for (let year = from; year <= to; year += 1) years.add(year);
    }
  }
  const sorted = [...years].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let previous = sorted[0];
  for (const year of sorted.slice(1)) {
    if (year === previous + 1) {
      previous = year;
      continue;
    }
    parts.push(start === previous ? `${start}` : `${start}-${previous}`);
    start = year;
    previous = year;
  }
  if (start !== undefined) parts.push(start === previous ? `${start}` : `${start}-${previous}`);
  return parts.join(";");
}

/** Makes A to Z; each make's models in natural order (vehicle-list.ts). */
export const FINDER_MAKES: ReadonlyArray<FinderMake> = VEHICLE_LIST.map(
  ([make, models]) => ({
    make,
    years: unionRanges(models.map(([, years]) => years)),
    models: models.map(([model, years]) => ({ model, years })),
  }),
);

/** Oldest and newest model year anywhere in the list. */
const [FIRST_YEAR, LAST_YEAR] = FINDER_MAKES.reduce<[number, number]>(
  ([first, last], { years }) => {
    for (const [from, to] of yearRanges(years)) {
      first = Math.min(first, from);
      last = Math.max(last, to);
    }
    return [first, last];
  },
  [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY],
);

/**
 * Newest first: next model year (makers register it from mid-year, as
 * vehicles-fetch.mjs does) down to the oldest year in the list. **Computed at
 * render** (D32, D66), so the top of the list moves with the calendar without
 * a restart; the list never offers a year with no model in it.
 */
export function finderYears(): readonly number[] {
  const newest = Math.min(LAST_YEAR, shopYear() + 1);
  const years: number[] = [];
  for (let year = newest; year >= FIRST_YEAR; year -= 1) years.push(year);
  return years;
}

/** The make as the list spells it, or `null`. Exact match: the finder submits these strings. */
export function finderMake(make: string): FinderMake | null {
  return FINDER_MAKES.find((known) => known.make === make) ?? null;
}

/** A year the finder offers, as a number, or `null`. */
export function finderYear(year: string): number | null {
  if (!/^\d{4}$/.test(year)) return null;
  const value = Number(year);
  return finderYears().includes(value) ? value : null;
}

/**
 * True only for a vehicle the finder itself offers (D91b, owner ruling
 * 2026-09-29: "Accept finder vehicles only"): a listed year, a listed make,
 * and a model of that make **built in that year** (LA-05; D110 approved the
 * year-dependent model list). `year`, `make` and `model` come from the URL
 * (D44), and every surface that names the vehicle prints them, so anything
 * else is "no vehicle". Exact match, because the finder submits these strings.
 */
export function isFinderVehicle(year: string, make: string, model: string): boolean {
  const built = finderYear(year);
  if (built === null) return false;
  const entry = finderMake(make)?.models.find((known) => known.model === model);
  return entry !== undefined && builtIn(entry.years, built);
}

/**
 * What a part-filled finder submit is missing (LA-05 P2): the fields, in
 * finder order, that are blank or not a choice the finder offers for the
 * fields before them. `null` when the URL names a whole vehicle, and also when
 * it names nothing at all (no year, no make, no model is not a partial
 * vehicle, it is no vehicle). The year, make and model it returns are only
 * ever values from the list, never URL text, so they are safe to put back in
 * the selects (D91b).
 */
export interface PartialVehicle {
  year: string | null;
  make: string | null;
  model: string | null;
  missing: ReadonlyArray<"year" | "make" | "model">;
}

export function partialVehicle(
  rawYear: string | null,
  rawMake: string | null,
  rawModel: string | null,
): PartialVehicle | null {
  const year = rawYear === "" ? null : rawYear;
  const make = rawMake === "" ? null : rawMake;
  const model = rawModel === "" ? null : rawModel;
  if (year === null && make === null && model === null) return null;
  if (year !== null && make !== null && model !== null && isFinderVehicle(year, make, model)) {
    return null;
  }
  const knownYear = year !== null && finderYear(year) !== null ? year : null;
  const built = knownYear === null ? null : Number(knownYear);
  const entry = make === null ? null : finderMake(make);
  /* A make or model never built in the chosen year is not a choice the
     finder offers for that year (the island hides it), so it counts as
     missing. */
  const knownMake =
    entry !== null && (built === null || builtIn(entry.years, built)) ? entry : null;
  const knownModel =
    knownMake === null || model === null
      ? null
      : (knownMake.models.find(
          (known) => known.model === model && (built === null || builtIn(known.years, built)),
        )?.model ?? null);
  const missing: Array<"year" | "make" | "model"> = [];
  if (knownYear === null) missing.push("year");
  if (knownMake === null) missing.push("make");
  if (knownModel === null) missing.push("model");
  return { year: knownYear, make: knownMake?.make ?? null, model: knownModel, missing };
}
