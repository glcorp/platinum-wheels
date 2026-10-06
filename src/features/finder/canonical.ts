import "server-only";

import { permanentRedirect } from "next/navigation";

import { isFinderVehicle } from "./data";
import { VEHICLE_ALIASES } from "./vehicle-fitment-data";

/**
 * Old vehicle names in a URL resolve to the canonical ones (D155, owner,
 * 2026-10-06: "Auto Country's name wins and ours becomes an alias so old URLs
 * still resolve"). The finder list now spells models the way Auto Country
 * does (`3`, `MX-5 Miata`, Tesla `3`), so a bookmarked `?model=Mazda3` would
 * fail `isFinderVehicle` and silently show the unfiltered page.
 *
 * Server only: `VEHICLE_ALIASES` is generated and large, and `isFinderVehicle`
 * (client-safe, `data.ts`) cannot import it. The category routes and the
 * product page call `redirectToCanonicalVehicle` first; a 308 to the same
 * path puts the canonical names in the address bar, so every later reader of
 * the URL sees a vehicle the finder offers.
 *
 * *Derived* (D155): the redirect itself is not an owner ruling, only the
 * alias rule it serves. The target is built from the list's own strings for
 * `make` and `model` and from the visitor's untouched values for everything
 * else, so no raw `year`, `make` or `model` text is ever echoed (D91b).
 */

type SearchParams = Record<string, string | string[] | undefined>;

function valuesOf(params: SearchParams, key: string): string[] {
  const raw = params[key];
  if (raw === undefined) return [];
  return Array.isArray(raw) ? raw : [raw];
}

/** First non-blank value, trimmed (the reading `results/query.ts` uses). */
function first(params: SearchParams, key: string): string | null {
  for (const value of valuesOf(params, key)) {
    const trimmed = value.trim();
    if (trimmed !== "") return trimmed;
  }
  return null;
}

/**
 * The URL to send an old-name vehicle to, or `null` when nothing changes.
 * `null` also when the URL already names a vehicle the finder offers (no
 * loop), names none, or names an alias whose canonical car was not built that
 * year. Every param keeps its place and value; only `model` (and `make`, if
 * its spelling differs) is replaced, once, at its first position.
 */
export function canonicalVehicleHref(
  pathname: string,
  params: SearchParams,
): string | null {
  const year = first(params, "year");
  const make = first(params, "make");
  const model = first(params, "model");
  if (year === null || make === null || model === null) return null;
  if (isFinderVehicle(year, make, model)) return null;

  const canonical = VEHICLE_ALIASES[`${make}|${model}`];
  if (canonical === undefined) return null;
  const split = canonical.indexOf("|");
  if (split < 0) return null;
  const canonicalMake = canonical.slice(0, split);
  const canonicalModel = canonical.slice(split + 1);
  if (!isFinderVehicle(year, canonicalMake, canonicalModel)) return null;

  const out = new URLSearchParams();
  const written = new Set<string>();
  for (const [key, raw] of Object.entries(params)) {
    if (raw === undefined) continue;
    if (key === "make" || key === "model") {
      if (written.has(key)) continue;
      written.add(key);
      out.append(key, key === "make" ? canonicalMake : canonicalModel);
      continue;
    }
    for (const value of Array.isArray(raw) ? raw : [raw]) out.append(key, value);
  }
  const query = out.toString();
  return query === "" ? pathname : `${pathname}?${query}`;
}

/** `permanentRedirect` to the canonical URL when the vehicle is an old name. */
export function redirectToCanonicalVehicle(
  pathname: string,
  params: SearchParams,
): void {
  const href = canonicalVehicleHref(pathname, params);
  if (href !== null) permanentRedirect(href);
}
