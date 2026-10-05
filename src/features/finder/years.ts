/**
 * Model-year ranges as vehicles.csv writes them ("2005-2011;2019-2027").
 * Kept apart from `data.ts` so the finder's leaf island can read a range
 * without pulling the whole vehicle list into its bundle.
 */

/** "2005-2011;2019-2027" -> [[2005, 2011], [2019, 2027]]. */
export function yearRanges(years: string): ReadonlyArray<readonly [number, number]> {
  return years
    .split(";")
    .filter((part) => part !== "")
    .map((part) => {
      const [from, to = from] = part.split("-").map(Number);
      return [from, to] as const;
    });
}

/** True when `year` falls inside one of the ranges. */
export function builtIn(years: string, year: number): boolean {
  return yearRanges(years).some(([from, to]) => year >= from && year <= to);
}
