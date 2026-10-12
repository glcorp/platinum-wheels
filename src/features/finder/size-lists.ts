import "server-only";

import { CATEGORY_CONFIG } from "@/features/catalog/categories";
import { getCategoryBase } from "@/features/catalog/queries";

/**
 * The home finder's size lists (D169, C4): every tire and wheel size the
 * catalogue holds, for the `Size` mode's selects, plus the size combinations
 * that exist, so each select can narrow to what the others allow (the way
 * Dealer Wheels, PRO WHEELS' site, unlocks Profile from Width).
 *
 * Read from `getCategoryBase`, the results pages' own cached whole-category
 * read (`CATALOGUE_TAG`, no timer, D157), so `/` stays prerendered and adds no
 * database round trip once the cache is warm. A database outage costs the
 * size mode, never the page: the lists come back `null` and the finder offers
 * the vehicle mode alone (D109(9): the home page survives an outage).
 *
 * The lists keep the results rail's order and labels (`results/search.ts`
 * `sizeValues`): Width is metric widths then flotation overall diameters,
 * Profile is aspect ratios then flotation section widths written with two
 * decimals (`12.50`), Rim carries the rail's `R` prefix. So a size picked here
 * arrives on `/tires` as the very option the rail's select shows.
 *
 * The combinations travel as one compact string, `a,b,c;a,b,c`, about 23 KB
 * raw and 5 KB gzipped on the full catalogue (measured 2026-10-11: 553 tire
 * and 966 wheel combinations): tires `width,profile,rim,seasons`, wheels
 * `bolt,diameter,width` with an empty bolt for a wheel with no pattern.
 * `seasons` (D185, QA HOMEFIND-3) is one digit per season the size comes in,
 * each digit the season's position in the Season select
 * (`CATEGORY_CONFIG.tires.chips`), so the Season select can offer only what
 * exists for the chosen size; a size is one row however many seasons it has.
 */

export interface FinderSizeOption {
  value: string;
  label: string;
}

export interface FinderSizeLists {
  tire: {
    width: FinderSizeOption[];
    profile: FinderSizeOption[];
    rim: FinderSizeOption[];
    combos: string;
  } | null;
  wheel: {
    bolt: FinderSizeOption[];
    diameter: FinderSizeOption[];
    width: FinderSizeOption[];
    combos: string;
  } | null;
}

const sorted = (values: Iterable<number | null>): number[] =>
  [...new Set(values)]
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .sort((a, b) => a - b);

const plain = (value: number): FinderSizeOption => ({
  value: String(value),
  label: String(value),
});

/** The Season select's values in its own order, as the database spells them
 *  (`all-season` is `all_season`): a season's digit in a combination is its
 *  index here. */
const SEASON_ORDER = (CATEGORY_CONFIG.tires.chips?.options ?? []).map((option) =>
  option.value.replace(/-/g, "_"),
);

/** `width,profile,rim,seasons` per distinct size. */
function tireCombos(
  rows: ReadonlyArray<
    readonly [
      number | null,
      number | null,
      number | null,
      number | null,
      number | null,
      string | null,
    ]
  >,
): string {
  const sizes = new Map<string, Set<number>>();
  for (const [width, profile, overall, section, rim, season] of rows) {
    const key = [width ?? overall, profile ?? section, rim]
      .map((part) => (part === null ? "" : String(part)))
      .join(",");
    const seasons = sizes.get(key) ?? new Set<number>();
    const index = season === null ? -1 : SEASON_ORDER.indexOf(season);
    if (index >= 0) seasons.add(index);
    sizes.set(key, seasons);
  }
  return [...sizes]
    .map(([key, seasons]) => `${key},${[...seasons].sort().join("")}`)
    .join(";");
}

export async function loadFinderSizes(): Promise<FinderSizeLists> {
  try {
    const [tires, wheels] = await Promise.all([
      getCategoryBase("tires"),
      getCategoryBase("wheels"),
    ]);
    const tire = tires.tire;
    const wheel = wheels.wheel;
    return {
      tire:
        tire === null || tire.combos.length === 0
          ? null
          : {
              width: [
                ...sorted(tire.combos.map((c) => c[0])),
                ...sorted(tire.combos.map((c) => c[2])),
              ].map(plain),
              profile: [
                ...sorted(tire.combos.map((c) => c[1])).map(plain),
                ...sorted(tire.combos.map((c) => c[3])).map((value) => ({
                  value: String(value),
                  label: value.toFixed(2),
                })),
              ],
              rim: sorted(tire.combos.map((c) => c[4])).map((value) => ({
                value: String(value),
                label: `R${value}`,
              })),
              combos: tireCombos(tire.combos),
            },
      wheel:
        wheel === null || wheel.combos.length === 0
          ? null
          : {
              bolt: [
                ...new Set(
                  wheel.combos.flatMap(([, , pattern]) => (pattern === null ? [] : [pattern])),
                ),
              ]
                .sort(byBoltPattern)
                .map((pattern) => ({ value: pattern, label: pattern })),
              diameter: sorted(wheel.combos.map((c) => c[0])).map(plain),
              width: sorted(wheel.combos.map((c) => c[1])).map(plain),
              combos: wheel.combos
                .map(([diameter, width, pattern]) =>
                  [pattern ?? "", diameter ?? "", width ?? ""].join(","),
                )
                .join(";"),
            },
    };
  } catch {
    return { tire: null, wheel: null };
  }
}

/** `4x100` before `5x100` before `5x114.3`: lug count, then circle. */
function byBoltPattern(a: string, b: string): number {
  const [aLugs, aCircle] = a.split("x").map(Number);
  const [bLugs, bCircle] = b.split("x").map(Number);
  return aLugs - bLugs || aCircle - bCircle || a.localeCompare(b);
}
