/**
 * Size parsing: the text a vendor or a member of staff writes, turned into the
 * columns the database filters on. Pure, no imports beyond types, so the admin
 * form, the import script and a test can all use it.
 *
 */

import type { TireSizeFormat } from "./catalog-types";

export interface ParsedTireSize {
  sizeFormat: TireSizeFormat;
  /** Canonical spelling: upper case, no spaces, `x` lower case. */
  size: string;
  width: number | null;
  aspectRatio: number | null;
  rimDiameter: number;
  overallDiameter: number | null;
  sectionWidth: number | null;
  /** `P`, `LT`, `ST`, `HL` or `C`, when the size itself carries one. */
  serviceType: string | null;
}

/* 225/45R17 · P215/70R16 · LT275/70R18 · HL275/50R22 · 255/35ZR20 · 185R14C */
const METRIC =
  /^(P|LT|ST|HL)?(\d{3})(?:\/(\d{2,3}))?(ZR|R|D|B|-)(\d{2}(?:\.\d)?)(C|LT)?$/;

/* 35x12.50R20 · LT33x12.50R17 · 37x13.50R22LT. The overall diameter takes one
   decimal, the section width two: what their columns hold. */
const FLOTATION =
  /^(LT)?(\d{2}(?:\.\d)?)X(\d{1,2}(?:\.\d{1,2})?)(ZR|R|D|B|-)(\d{2}(?:\.\d)?)(LT)?$/;

/** `225/00R17` has the right shape and is not a tire. The database refuses a
 *  zero dimension, so the parser does first. */
function allPositive(...values: number[]): boolean {
  return values.every((value) => value > 0);
}

/**
 * `null` when the text is not a size this catalogue understands. The caller
 * decides whether that is an error (the admin form) or a row to report (the
 * import).
 */
export function parseTireSizeSpec(raw: string): ParsedTireSize | null {
  const text = raw.replace(/\s+/g, "").toUpperCase();
  if (text === "") return null;

  const metric = METRIC.exec(text);
  if (metric) {
    const [, prefix, width, aspect, , rim, suffix] = metric;
    if (!allPositive(Number(width), Number(aspect ?? 1), Number(rim))) {
      return null;
    }
    return {
      sizeFormat: "metric",
      size: text,
      width: Number(width),
      aspectRatio: aspect ? Number(aspect) : null,
      rimDiameter: Number(rim),
      overallDiameter: null,
      sectionWidth: null,
      serviceType: prefix ?? suffix ?? null,
    };
  }

  const flotation = FLOTATION.exec(text);
  if (flotation) {
    const [, prefix, overall, section, , rim, suffix] = flotation;
    if (!allPositive(Number(overall), Number(section), Number(rim))) {
      return null;
    }
    return {
      sizeFormat: "flotation",
      // `35X12.50R20` reads wrong; the trade writes a lower-case `x`.
      size: text.replace("X", "x"),
      width: null,
      aspectRatio: null,
      rimDiameter: Number(rim),
      overallDiameter: Number(overall),
      sectionWidth: Number(section),
      serviceType: prefix ?? suffix ?? null,
    };
  }

  return null;
}

/* Metric `5x114.3` and inch `5x4.5` / `8x6.5`. */
const BOLT_PATTERN = /^(\d{1,2})X(\d{1,3}(?:\.\d{1,2})?)$/;
const BARE_PCD = /^\d{1,3}(?:\.\d{1,2})?$/;

/** Longest bolt-pattern text worth reading, and the most patterns one wheel
 *  can sensibly carry. Both stop a pasted wall of text before it is parsed. */
const BOLT_PATTERNS_MAX_LENGTH = 200;
const BOLT_PATTERNS_MAX_COUNT = 6;

/**
 * `5x114.3`, `5X114.3`, `5×114.3`, `5 x 114.3`, `5x114.30` → `5x114.3`. `null`
 * when it is not a bolt pattern. The stored spelling is what the filter compares, so every writer
 * goes through here.
 */
export function normalizeBoltPattern(raw: string): string | null {
  // `×` (U+00D7) is how the page spells it; a pasted URL may carry it.
  const match = BOLT_PATTERN.exec(
    raw.replace(/\s+/g, "").replace(/\u00D7/g, "x").toUpperCase(),
  );
  if (!match) return null;
  const lugs = Number(match[1]);
  const pcd = Number(match[2]);
  if (lugs <= 0 || pcd <= 0) return null;
  // `Number` drops a trailing `.0`, so `5x120.0` and `5x120` are one value.
  return `${lugs}x${pcd}`;
}

const METRIC_THREAD = /^(\d{1,2}(?:\.\d+)?)[X\u00D7](\d(?:\.\d+)?)$/;

/**
 * A lug thread in its one stored spelling: `12x1.50`, `12 X 1.5` and
 * `12×1.5` all become `12x1.5`. Anything that is not a metric thread
 * (`1/2"`, `9/16 UNF`) is kept as typed, trimmed. The vehicle filter compares
 * threads for equality, so both sides go through here.
 */
export function normalizeThreadSize(raw: string): string {
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  const match = METRIC_THREAD.exec(compact);
  if (!match) return raw.trim();
  return `${Number(match[1])}x${Number(match[2])}`;
}

/**
 * A wheel drilled for two patterns arrives as `6x135/6x139.7` or
 * `6x135, 6x139.7`. Returns the normalised list, or `null` if any part is not
 * a bolt pattern. An empty string is an empty list, not an error, and so is
 * `blank`: the trade's word for a wheel sold undrilled.
 *
 * A bare number after the first pattern borrows its lug count, because vendors
 * write `8x165.1/180` for `8x165.1` and `8x180`.
 */
export function parseBoltPatterns(raw: string): string[] | null {
  if (raw.length > BOLT_PATTERNS_MAX_LENGTH) return null;
  if (raw.trim().toLowerCase() === "blank") return [];
  const parts = raw
    .split(/[,/;|]/)
    .map((part) => part.trim())
    .filter((part) => part !== "");
  const patterns: string[] = [];
  if (parts.length > BOLT_PATTERNS_MAX_COUNT) return null;
  let lugs: string | null = null;
  for (const part of parts) {
    const compact = part.replace(/\s+/g, "");
    const pattern = normalizeBoltPattern(
      lugs !== null && BARE_PCD.test(compact) ? `${lugs}x${compact}` : part,
    );
    if (pattern === null) return null;
    lugs = pattern.split("x")[0] ?? null;
    if (!patterns.includes(pattern)) patterns.push(pattern);
  }
  return patterns;
}

const PLAIN_NUMBER = /^\d{1,4}(?:\.\d{1,4})?$/;

/**
 * A size value off a URL in its one spelling: `17.0` → `17`, `8.50` → `8.5`,
 * `12.50` → `12.5`. The selects list `String(number)`, so a hand-typed
 * `width=9.0` must become `9` before it is compared with them. `null` when the
 * text is not a plain positive decimal (`abc`, `1e1`, `-5`, `9,5`), which the
 * caller treats as an unknown value.
 */
export function canonicalSizeNumber(raw: string): string | null {
  const text = raw.trim();
  if (!PLAIN_NUMBER.test(text)) return null;
  const value = Number(text);
  return value > 0 ? String(value) : null;
}
