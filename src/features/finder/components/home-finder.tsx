import { VehicleFinder } from "@/features/finder/components/vehicle-finder";
import { loadFinderSizes } from "@/features/finder/size-lists";

/**
 * The home page's finder (D128, D158, D169): the switchable hero finder with
 * the size lists read on the server. Async only for that read, which is the
 * results pages' cached whole-category read, so `/` stays prerendered.
 */
export async function HomeFinder() {
  const sizes = await loadFinderSizes();
  return <VehicleFinder switchable sizes={sizes} />;
}
