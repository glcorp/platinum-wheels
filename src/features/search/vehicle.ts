import { isFinderVehicle } from "@/features/finder/data";
import type { VehicleParams } from "@/lib/routes";

/**
 * The car a search was started with (D185, owner 2026-10-13: "Search keeps
 * the vehicle"): `year`, `make` and `model` in the URL, accepted only when
 * `isFinderVehicle` says the finder offers that car, the one check every page
 * uses (D91b). Anything else is "no car": an unchecked value is never put
 * back in a link or a field. Pure, client-safe.
 */
export function searchVehicle(
  params: Record<string, string | string[] | undefined>,
): VehicleParams | null {
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
  const year = one(params.year);
  const make = one(params.make);
  const model = one(params.model);
  return isFinderVehicle(year, make, model) ? { year, make, model } : null;
}
