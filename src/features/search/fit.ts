/**
 * Which wheel widths suit a tire, loosely (D173(1); "loose fit is fine",
 * D155). Pure.
 *
 * A tire is designed around a measuring rim, roughly its section width times
 * a ratio that falls as the sidewall gets taller (the same table
 * `catalog/queries.ts` uses for vehicle fit). The trade mounts a tire on rims
 * from about one inch narrower to one and a half inches wider than that. On
 * the tire makers' own charts this reproduces 205/55R16 → 5.5 to 7.5 in and
 * 275/70R18 → 7 to 9 in, and gives 245/35R19 → 7.5 to 9.5 in (charts: 8 to
 * 9.5): close enough for a search, which shows candidates, not a fitment.
 */

/** Ratio of measuring rim to section width, by aspect ratio. */
export function measuringRatio(aspectRatio: number): number {
  if (aspectRatio >= 70) return 0.7;
  if (aspectRatio >= 60) return 0.75;
  if (aspectRatio >= 50) return 0.78;
  if (aspectRatio >= 40) return 0.82;
  return 0.85;
}

/** A flotation tire's section width is in inches; its rim is about 80% of it. */
export const FLOTATION_RATIO = 0.8;

/** How far either side of the measuring rim a wheel may be, in inches. */
export const RIM_SLACK = { narrower: 1, wider: 1.5 } as const;

export interface WidthRange {
  min: number;
  max: number;
}

/** The measuring rim of a metric tire, in inches. */
export function metricMeasuringRim(widthMm: number, aspectRatio: number): number {
  return (widthMm * measuringRatio(aspectRatio)) / 25.4;
}

/** Wheel widths (inches) that suit a tire whose measuring rim is `measuring`. */
export function wheelWidthRange(measuring: number): WidthRange {
  return {
    min: Math.round((measuring - RIM_SLACK.narrower) * 100) / 100,
    max: Math.round((measuring + RIM_SLACK.wider) * 100) / 100,
  };
}
