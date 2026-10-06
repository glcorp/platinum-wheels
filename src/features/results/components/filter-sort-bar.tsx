/* ---------------------------------------------------------------------------
   FilterSortBar — the mobile sticky filter/sort bar

   Since D159 (owner, 2026-10-07: "in mobile view need three sticky") it pins
   the category tabs (D158) and the vehicle button beside `Filters` under the
   pinned header: header, tabs, vehicle + filters. The drawn bar below is the
   original two-cell row; its box (padding, borders, z) is unchanged. The
   drawn `--scrim-strong` fill is `--bg` at 92%, which let cards show through
   once pinned; `bg-bg` is the same colour at rest and opaque.

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

import { CategoryTabs, type CategoryTab } from "@/components/site/category-tabs";
import { CATEGORY_CONFIG } from "@/features/catalog/categories";
import type { FinderCategory } from "@/lib/finder-category";
import { FilterSheet } from "@/features/results/components/filter-sheet";
import { SortSelect } from "@/features/results/components/sort-select";
import { VehicleButton } from "@/features/results/components/vehicle-panel";
import { HAS_SORT_CHOICE, type ResultsView } from "@/features/results/types";

export interface FilterSortBarProps {
  view: ResultsView;
  /** Tires / Wheels / Accessories (D158), pinned in this bar since D159. */
  tabs: ReadonlyArray<CategoryTab>;
  active: FinderCategory;
}

export function FilterSortBar({ view, tabs, active }: FilterSortBarProps) {
  const hasVehicle = CATEGORY_CONFIG[view.query.category].finder !== null;
  return (
    <div
      data-probe="sticky-bar"
      /* Hook for `globals.css`'s scroll-padding rule, which keeps a keyboard
         focus target from landing under this bar (WCAG 2.4.11, D91b). */
      data-sticky-filter-bar=""
      className="sticky top-17 z-3 mt-4 flex flex-col gap-2 border-y border-border bg-bg px-4 py-3 sm:top-22 sm:px-8 md:hidden"
    >
      <CategoryTabs items={tabs} active={active} />
      {/* The vehicle first, `Filters` beside it (owner, 2026-10-07: "instead
          of change vehicle, filter should be there on side"). `Filters` keeps
          a fixed 120px cell so the car's name gets the rest. With prices on,
          `Sort` takes a second row beside `Filters`. */}
      {HAS_SORT_CHOICE ? (
        <div className="grid grid-cols-2 gap-2">
          {hasVehicle ? <VehicleButton query={view.query} className="col-span-2" /> : null}
          <FilterSheet view={{ query: view.query, facets: view.facets }} />
          <SortSelect variant="bar" id="results-sort-bar" query={view.query} />
        </div>
      ) : (
        <div className="flex gap-2">
          {hasVehicle ? <VehicleButton query={view.query} className="flex-1" /> : null}
          {/* The trigger's `<dialog>` is `position:fixed`, out of flow. */}
          <div className={hasVehicle ? "w-30 shrink-0" : "flex-1"}>
            <FilterSheet view={{ query: view.query, facets: view.facets }} />
          </div>
        </div>
      )}
    </div>
  );
}
