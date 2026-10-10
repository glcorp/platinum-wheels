/**
 * What a shopper typed, read into the things the catalogue can filter on
 * (D173). Pure: no I/O, so a test or a script can run it on its own.
 *
 * Sizes are pulled out of the text first, longest pattern first, then the
 * category, season and accessory words; whatever is left is matched as text
 * against brand, model, name and part number. So `245/35R19 michelin` is a
 * tire size plus the word `michelin`, and `winter tires` is a season and a
 * category with no text at all.
 *
 * Tire sizes in every spelling the trade uses: `2453519`, `245/35R19`,
 * `245 35 19`, `245/35ZR19`, `P245/35R19`, `LT245/75R16`, `245-35-19`, the
 * width and profile alone (`245/35`), and flotation `33x12.50R20`. Wheels:
 * `20x9`, `18x8.5`, a bolt pattern `5x114.3`, and a bare rim size `R19` or
 * `19"`.
 */

import type { AccessoryKind, TireSeason } from "@/features/catalog/catalog-types";
import type { ProductCategory } from "@/features/catalog/types";
import { normalizeBoltPattern, normalizeThreadSize } from "@/features/catalog/size";

/** Longest query read. A pasted paragraph is cut, not refused. */
export const QUERY_MAX_LENGTH = 100;
/** Most text words matched. More would only narrow an already empty page. */
const MAX_WORDS = 6;

export type TireSizeQuery =
  | {
      format: "metric";
      width: number;
      aspectRatio: number;
      /** `null` for `245/35`, the width and profile alone. */
      rim: number | null;
      /** `LT` when the shopper typed it. Only orders the list (LT first). */
      serviceType: "LT" | null;
    }
  | {
      format: "flotation";
      overallDiameter: number;
      sectionWidth: number;
      rim: number;
    };

export interface WheelSizeQuery {
  diameter: number;
  width: number;
}

export interface ParsedSearch {
  /** The query as typed, trimmed and cut to `QUERY_MAX_LENGTH`. */
  text: string;
  tire: TireSizeQuery | null;
  wheel: WheelSizeQuery | null;
  /** Normalised (`5x114.3`), as `wheel_specs.bolt_patterns` stores it. */
  bolt: string | null;
  /** A bare rim size: `R19`, `19"`, `19 inch`. */
  rim: number | null;
  /** A lug thread, `12x1.5`, normalised as `accessory_specs.thread_size`
   *  stores it. Narrows lug nuts, lug bolts and wheel locks. */
  thread: string | null;
  /** Categories the words named (`tires`, `rims`, `accessories`); empty: none named. */
  categories: ProductCategory[];
  seasons: TireSeason[];
  accessoryKinds: AccessoryKind[];
  /** Leftover words, lower case, for the text match. */
  words: string[];
}

/* --- Sizes --------------------------------------------------------------- */

/* Order matters: flotation before a wheel size (`33x12.50R20` begins like
   `33x12.50`), a bolt pattern before a wheel size (`5x114.3` is not a
   5-inch wheel), and the metric tire last because its compact form
   (`2453519`) is the loosest. Each pattern is tried on the whole text with
   the spans already read blanked out. */
const FLOTATION =
  /(?<![\dA-Z.])(?:LT)?(\d{2}(?:\.\d)?)\s*X\s*(\d{1,2}(?:\.\d{1,2})?)\s*(?:R|-|\/)\s*(\d{2})(?:LT)?(?![\dA-Z.])/g;
const BOLT = /(?<![\dA-Z.])([4-8])\s*X\s*(\d{3}(?:\.\d{1,2})?)(?![\dA-Z.])/g;
const WHEEL = /(?<![\dA-Z.])(\d{2}(?:\.\d)?)\s*X\s*(\d{1,2}(?:\.\d{1,2})?)(?:\s*(?:IN|INCH|")|J)?(?![\dA-Z.])/g;
const METRIC =
  /(?<![\dA-Z.])(P|LT|ST)?\s*(\d{3})\s*[/\s-]?\s*(\d{2})\s*(?:Z?R|D|B|-|\/|\s)?\s*(\d{2})(?:\s*(?:C|LT|XL))?(?![\dA-Z.])/g;
const METRIC_PARTIAL = /(?<![\dA-Z.])(P|LT|ST)?\s*(\d{3})\s*\/\s*(\d{2})(?:\s*Z?R)?(?![\dA-Z.])/g;
const THREAD = /(?<![\dA-Z.])M?(1[0-6])\s*X\s*(1(?:\.\d{1,2})?|2(?:\.0{1,2})?)(?![\dA-Z.])/g;
/* Imperial threads are stored `1/2 UNF` (the vendors' spelling). */
const THREAD_IMPERIAL = /(?<![\dA-Z.])(1\/2|9\/16|7\/16)(?:"|\s*IN)?\s*(?:(?:-|X)\s*(?:20|18)|UNF)(?:\s*UNF)?(?![\dA-Z.])/g;
const RIM = /(?<![\dA-Z.])(?:R(\d{2})|(\d{2})\s*(?:"|''|IN\b|INCH\b|INCHES\b))(?![\dA-Z.])/g;

const inRange = (value: number, min: number, max: number) =>
  Number.isFinite(value) && value >= min && value <= max;

const validTireWidth = (width: number) => inRange(width, 105, 395) && width % 5 === 0;
const validAspect = (aspect: number) => inRange(aspect, 20, 95) && aspect % 5 === 0;
const validRim = (rim: number) => inRange(rim, 10, 30);

/**
 * Runs `pattern` over `text`, hands each match to `read`, and blanks every
 * span `read` accepted so the next pattern cannot read it again. Returns the
 * first accepted value.
 */
function take<T>(
  state: { text: string },
  pattern: RegExp,
  read: (match: RegExpExecArray) => T | null,
): T | null {
  let found: T | null = null;
  pattern.lastIndex = 0;
  const spans: Array<[number, number]> = [];
  for (const match of state.text.matchAll(pattern)) {
    const value = read(match as RegExpExecArray);
    if (value === null) continue;
    found ??= value;
    spans.push([match.index ?? 0, (match.index ?? 0) + match[0].length]);
  }
  for (const [start, end] of spans.reverse()) {
    state.text = `${state.text.slice(0, start)} ${" ".repeat(end - start)}${state.text.slice(end)}`;
  }
  return found;
}

/* --- Words --------------------------------------------------------------- */

/** Category words, singular and plural. `rim` and `mags` are what people
 *  in Ontario call wheels. */
const CATEGORY_WORDS: Record<string, ProductCategory> = {
  tire: "tires",
  tires: "tires",
  tyre: "tires",
  tyres: "tires",
  wheel: "wheels",
  wheels: "wheels",
  rim: "wheels",
  rims: "wheels",
  mag: "wheels",
  mags: "wheels",
  alloys: "wheels",
  accessory: "accessories",
  accessories: "accessories",
};

/** Season phrases, longest first so `all season` is read before `season`. */
const SEASON_PHRASES: ReadonlyArray<[string, TireSeason]> = [
  ["all weather", "all_weather"],
  ["all-weather", "all_weather"],
  ["allweather", "all_weather"],
  ["all season", "all_season"],
  ["all-season", "all_season"],
  ["allseason", "all_season"],
  ["winter", "winter"],
  ["snow", "winter"],
  ["summer", "summer"],
];

/** Accessory phrases, longest first. Each names one of the fifteen types
 *  (D125) in the words a shopper uses, not the vendors' labels. */
const ACCESSORY_PHRASES: ReadonlyArray<[string, AccessoryKind]> = [
  ["center caps", "center_caps"],
  ["centre caps", "center_caps"],
  ["center cap", "center_caps"],
  ["centre cap", "center_caps"],
  ["lug nuts", "lug_nuts"],
  ["lug nut", "lug_nuts"],
  ["lug bolts", "lug_bolts"],
  ["lug bolt", "lug_bolts"],
  ["wheel locks", "wheel_locks"],
  ["wheel lock", "wheel_locks"],
  ["hub rings", "hub_rings"],
  ["hub ring", "hub_rings"],
  ["hub centric rings", "hub_rings"],
  ["wheel weights", "wheel_weights"],
  ["wheel weight", "wheel_weights"],
  ["wheel spacers", "wheel_spacers"],
  ["wheel spacer", "wheel_spacers"],
  ["spacers", "wheel_spacers"],
  ["spacer", "wheel_spacers"],
  ["wheel covers", "wheel_covers_trim"],
  ["wheel cover", "wheel_covers_trim"],
  ["hubcaps", "wheel_covers_trim"],
  ["hubcap", "wheel_covers_trim"],
  ["tpms sensors", "tpms_sensors_tools"],
  ["tpms sensor", "tpms_sensors_tools"],
  ["tpms", "tpms_sensors_tools"],
  ["tire studs", "tire_studs"],
  ["valve stems", "valves_caps"],
  ["valve stem", "valves_caps"],
  ["valves", "valves_caps"],
  ["valve", "valves_caps"],
  ["antennas", "antennas"],
  ["antenna", "antennas"],
  ["tire bags", "tire_bags_storage"],
  ["tire bag", "tire_bags_storage"],
];

/** Words that say nothing about which product. */
const STOP_WORDS = new Set(["a", "an", "and", "the", "for", "with", "of", "size", "sizes", "set", "new", "in"]);

/** Removes every whole-word occurrence of each phrase and returns what each
 *  one named, in phrase order, without repeats. */
function takePhrases<T>(
  state: { words: string },
  phrases: ReadonlyArray<readonly [string, T]>,
): T[] {
  const found: T[] = [];
  for (const [phrase, value] of phrases) {
    const pattern = new RegExp(`(^|\\s)${phrase.replace(/[-]/g, "\\-")}(?=\\s|$)`, "g");
    if (!pattern.test(state.words)) continue;
    state.words = state.words.replace(pattern, " ");
    if (!found.includes(value)) found.push(value);
  }
  return found;
}

/* --- Read ---------------------------------------------------------------- */

export function cleanQuery(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u2028-\u202F\uFEFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, QUERY_MAX_LENGTH)
    .trim();
}

export function parseSearch(raw: string): ParsedSearch {
  const text = cleanQuery(raw);
  /* Upper case, `×` read as `x`, the curly inch marks as `"`. */
  const state = {
    text: text
      .toUpperCase()
      .replace(/\u00D7/g, "X")
      .replace(/[\u201C\u201D\u2033]/g, '"'),
  };

  const tireFlotation = take(state, FLOTATION, (m): TireSizeQuery | null => {
    const overallDiameter = Number(m[1]);
    const sectionWidth = Number(m[2]);
    const rim = Number(m[3]);
    if (!inRange(overallDiameter, 23, 46) || !inRange(sectionWidth, 7, 21) || !inRange(rim, 14, 26)) {
      return null;
    }
    return { format: "flotation", overallDiameter, sectionWidth, rim };
  });

  const bolt = take(state, BOLT, (m) => {
    const pcd = Number(m[2]);
    return inRange(pcd, 95, 210) ? normalizeBoltPattern(`${m[1]}x${m[2]}`) : null;
  });

  const wheel = take(state, WHEEL, (m): WheelSizeQuery | null => {
    const diameter = Number(m[1]);
    const width = Number(m[2]);
    return inRange(diameter, 13, 30) && inRange(width, 3, 16) ? { diameter, width } : null;
  });

  const metric =
    tireFlotation === null
      ? take(state, METRIC, (m): TireSizeQuery | null => {
          const width = Number(m[2]);
          const aspectRatio = Number(m[3]);
          const rim = Number(m[4]);
          if (!validTireWidth(width) || !validAspect(aspectRatio) || !validRim(rim)) return null;
          return {
            format: "metric",
            width,
            aspectRatio,
            rim,
            serviceType: m[1] === "LT" || /LT$/.test(m[0].trim()) ? "LT" : null,
          };
        })
      : null;

  const partial =
    tireFlotation === null && metric === null
      ? take(state, METRIC_PARTIAL, (m): TireSizeQuery | null => {
          const width = Number(m[2]);
          const aspectRatio = Number(m[3]);
          if (!validTireWidth(width) || !validAspect(aspectRatio)) return null;
          return {
            format: "metric",
            width,
            aspectRatio,
            rim: null,
            serviceType: m[1] === "LT" ? "LT" : null,
          };
        })
      : null;

  /* After the wheel size, which refuses a 1.5-inch width, so `12x1.5` is
     still unread here. */
  const thread =
    take(state, THREAD_IMPERIAL, (m) => `${m[1]} UNF`) ??
    take(state, THREAD, (m) => normalizeThreadSize(`${m[1]}x${m[2]}`));

  const rim = take(state, RIM, (m) => {
    const value = Number(m[1] ?? m[2]);
    return inRange(value, 13, 30) ? value : null;
  });

  /* Words: lower case, punctuation other than the marks part numbers carry
     (`-`, `.`, `/`) turned into spaces. */
  const wordState = {
    words: ` ${state.text.toLowerCase().replace(/[^\p{L}\p{N}\-./&+\s]/gu, " ").replace(/\s+/g, " ").trim()} `,
  };
  const seasons = takePhrases(wordState, SEASON_PHRASES);
  const accessoryKinds = takePhrases(wordState, ACCESSORY_PHRASES);

  const categories: ProductCategory[] = [];
  const words: string[] = [];
  for (const token of wordState.words.split(" ")) {
    const word = token.replace(/^[-./]+|[-./]+$/g, "");
    if (word === "") continue;
    const category = CATEGORY_WORDS[word];
    if (category !== undefined) {
      if (!categories.includes(category)) categories.push(category);
      continue;
    }
    if (STOP_WORDS.has(word) || words.includes(word)) continue;
    words.push(word);
  }

  return {
    text,
    tire: tireFlotation ?? metric ?? partial,
    wheel,
    bolt,
    rim,
    thread,
    categories,
    seasons,
    accessoryKinds,
    words: words.slice(0, MAX_WORDS),
  };
}

/** True when the query holds anything to search on. */
export function hasCriteria(parsed: ParsedSearch): boolean {
  return (
    parsed.tire !== null ||
    parsed.wheel !== null ||
    parsed.bolt !== null ||
    parsed.rim !== null ||
    parsed.thread !== null ||
    parsed.categories.length > 0 ||
    parsed.seasons.length > 0 ||
    parsed.accessoryKinds.length > 0 ||
    parsed.words.length > 0
  );
}
