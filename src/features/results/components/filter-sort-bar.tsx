/* ---------------------------------------------------------------------------
   FilterSortBar — the mobile sticky filter/sort bar

   `results-mobile.html:98`:
     `position:sticky; top:68px; margin-top:16px; padding:12px 16px;
      background:var(--scrim-strong);
      border-top:1px solid var(--border); border-bottom:1px solid var(--border);
      display:grid; grid-template-columns:1fr 1fr; gap:8px; z-index:3`

   `top:68px` is the mobile header's height (results.md §5.3, "68px mobile
   header"); from `sm:` the header is 88px (§5.3, "88px desktop header"), so the
   bar re-pins at `sm:top-22`. Side padding follows the page's own 16 → 32 step
   (DESIGN.md §8), which is the only responsive source the fixed-width exports
   leave us (D41).

   Hidden from `md:` (1100px), where the rail takes over — D46.

   Server Component; both cells are the islands.
   --------------------------------------------------------------------------- */

import { FilterSheet } from "@/features/results/components/filter-sheet";
import { SortSelect } from "@/features/results/components/sort-select";
import type { ResultsView } from "@/features/results/types";

export interface FilterSortBarProps {
  view: ResultsView;
}

export function FilterSortBar({ view }: FilterSortBarProps) {
  return (
    <div
      data-probe="sticky-bar"
      className="sticky top-17 z-3 mt-4 grid grid-cols-2 gap-2 border-y border-border bg-scrim-strong px-4 py-3 sm:top-22 sm:px-8 md:hidden"
    >
      {/* Left cell: the trigger; its `<dialog>` is `position:fixed`, so it is
          out of flow and never takes a grid track. */}
      <FilterSheet view={view} />
      <SortSelect variant="bar" id="results-sort-bar" query={view.query} />
    </div>
  );
}
