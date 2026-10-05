import type {
  TireVehicleFit,
  WheelVehicleFit,
} from "@/features/catalog/catalog-types";

import type { BodyClass, VehicleFitment } from "./fitment";

/**
 * Which tires and wheels suit a vehicle, as the catalogue filters the results
 * pages read (D155). The catalogue never learns what a vehicle is; this file
 * turns the finder's facts into the two small shapes it does understand.
 *
 * **Tires.** Owner, 2026-10-06: "priority is vendor then factory. use best
 * and similar both techniques."
 *
 * - With **factory sizes** (the generated table, Auto Country first): a tire
 *   is a best match when its size is one of them; it is similar when it is not
 *   but sits inside the stock envelope (`range`: overall diameter and section
 *   width, with the wheel range's diameters when known). Without the source's
 *   own tire range the envelope is derived from the sizes (*derived*,
 *   coordinator, 2026-10-06): overall diameter over the sizes (half an inch
 *   either side is added in the query), section width with 5% either side,
 *   rim inside the wheel range's diameters when known, else the sizes' rims
 *   one down and two up.
 * - With **no factory sizes** the rim rule decides, the way a fitter reasons
 *   from the wheel (owner, 2026-10-06: "contruct like a human would do"): a
 *   tire suits a wheel when its rim
 *   diameter is the wheel's (a similar tire may be one inch down or two up),
 *   its section width sits in the approved range for the wheel's width, and
 *   its sidewall is a height that vehicle class runs. Factory sizes without
 *   any wheel size lend the rule rims of their own, one per size, as wide as
 *   that tire's measuring rim.
 * - With neither, no tire is narrowed (`null`).
 *
 * Tire results are labelled as suiting the vehicle, not as factory-confirmed.
 *
 * **Wheels.** The bolt pattern must match (both, when the model year came with
 * two). With the stock wheel envelope, a wheel is a best match inside it
 * (diameter, width, offset) and, when the hub bore is known, not narrower than
 * the hub; outside it, or with a bore that is unstated or too small, it is
 * similar. Without an envelope the bolt pattern alone decides, and only a bore
 * narrower than the hub demotes a wheel. An envelope is never derived from the
 * known wheel sizes: one trim's wheel would wrongly exclude the other trims'.
 */

/** Sidewall height in mm (width x aspect ratio / 100) per vehicle class.
 *  Calibrated on known factory sizes: Civic 215/55R16 118, Camry 215/55R17
 *  118, Model 3 235/45R18 106, Rogue 225/65R17 146, CR-V 235/60R18 141,
 *  Wrangler 245/75R17 184, F-150 275/65R18 179, Tacoma 265/70R16 185. */
export const SIDEWALL_MM: Readonly<Record<BodyClass, readonly [number, number]>> = {
  car: [75, 145],
  mpv: [100, 170],
  truck: [125, 205],
};

/** The width of the measuring rim a tire is built for (the 0.70 to 0.85 ratio
 *  `catalog/queries.ts` uses), inches, to the nearest half. */
function measuringRim(width: number, profile: number): number {
  const ratio = profile >= 70 ? 0.7 : profile >= 60 ? 0.75 : profile >= 50 ? 0.78 : profile >= 40 ? 0.82 : 0.85;
  return Math.round(((width * ratio) / 25.4) * 2) / 2;
}

/** The tire filter for a vehicle, or `null` when nothing about its tires is
 *  known (then no tire is narrowed, as before any data existed, D110). */
export function tireFit(fit: VehicleFitment | null): TireVehicleFit | null {
  if (fit === null) return null;
  const sizes = fit.tireSizes.map(({ width, profile, rim }) => ({ width, profile, rim }));
  const flotation = fit.flotationSizes.map(({ diameter, section, rim }) => ({
    diameter,
    section,
    rim,
  }));
  /* The rim rule's wheels: the real ones, else one per factory metric size. */
  const rims =
    fit.rims.length > 0
      ? fit.rims.map(({ diameter, width }) => ({ diameter, width }))
      : sizes.map(({ width, profile, rim }) => ({
          diameter: rim,
          width: measuringRim(width, profile),
        }));
  const hasSizes = sizes.length > 0 || flotation.length > 0;
  if (!hasSizes && rims.length === 0) return null;

  const classes = fit.classes.length > 0 ? fit.classes : (["car", "mpv", "truck"] as const);
  /* The envelope is read only beside factory sizes: it widens the best list's
     similar row, never stands in for it. Without the source's own tire range
     it is derived from the factory sizes (D155, coordinator): overall
     diameter and section width over the sizes, width with 5% either side
     (the diameter's half inch is added in the query), rim inside the wheel
     range's diameters when known, else the sizes' rims one down and two up. */
  let range: TireVehicleFit["range"] = null;
  if (hasSizes) {
    const wheelRims = fit.wheelRange
      ? { rimMin: fit.wheelRange.diameterMin, rimMax: fit.wheelRange.diameterMax }
      : null;
    if (fit.tireRange !== null) {
      range = { ...fit.tireRange, rimMin: wheelRims?.rimMin ?? null, rimMax: wheelRims?.rimMax ?? null };
    } else {
      const diameters = [
        ...sizes.map((s) => s.rim + (2 * s.width * s.profile) / 2540),
        ...flotation.map((s) => s.diameter),
      ];
      const widths = [
        ...sizes.map((s) => s.width),
        ...flotation.map((s) => s.section * 25.4),
      ];
      const sizeRims = [...sizes.map((s) => s.rim), ...flotation.map((s) => s.rim)];
      range = {
        diameterMin: Math.min(...diameters),
        diameterMax: Math.max(...diameters),
        widthMin: Math.min(...widths) * 0.95,
        widthMax: Math.max(...widths) * 1.05,
        rimMin: wheelRims?.rimMin ?? Math.min(...sizeRims) - 1,
        rimMax: wheelRims?.rimMax ?? Math.max(...sizeRims) + 2,
      };
    }
  }
  return {
    sizes,
    flotation,
    range,
    rims,
    sidewallMinMm: Math.min(...classes.map((c) => SIDEWALL_MM[c][0])),
    sidewallMaxMm: Math.max(...classes.map((c) => SIDEWALL_MM[c][1])),
  };
}

/** The wheel filter for a vehicle, or `null` when its bolt pattern is unknown
 *  (then no wheel is narrowed: every pattern is a guess). */
export function wheelFit(fit: VehicleFitment | null): WheelVehicleFit | null {
  if (fit === null || fit.boltPatterns.length === 0) return null;
  const bore = fit.centreBore === null ? NaN : Number(fit.centreBore);
  return {
    boltPatterns: fit.boltPatterns,
    range:
      fit.wheelRange === null
        ? null
        : {
            diameterMin: fit.wheelRange.diameterMin,
            diameterMax: fit.wheelRange.diameterMax,
            widthMin: fit.wheelRange.widthMin,
            widthMax: fit.wheelRange.widthMax,
            offsetMin: fit.wheelRange.offsetMin,
            offsetMax: fit.wheelRange.offsetMax,
          },
    hubBore: Number.isFinite(bore) && bore > 0 ? bore : null,
  };
}
