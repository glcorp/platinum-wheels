import Link from "next/link";

import { CATEGORY_CONFIG } from "@/features/catalog/categories";
import { SortSelect } from "@/features/results/components/sort-select";
import { HAS_SORT_CHOICE, type ResultsView } from "@/features/results/types";
import { ROUTES } from "@/lib/routes";

/* ---------------------------------------------------------------------------
   ResultsToolbar — breadcrumb and (desktop only) the sort cluster. The
   active-vehicle chip and the `Change vehicle` disclosure described below
   left this row at D159 (2026-10-07) for the vehicle button and sheet
   (`vehicle-panel.tsx`); the D45 notes are kept as the history of that row. The result count was the
   row's fourth element until **D72** moved it into the `Best matches` header
   stack (`results-grid.tsx`, deviation #63).
   Server Component; the only client code it renders is `SortSelect` (D44).

   Measured: `design/inventory/results.md` §2.2, from
   `design/assets/results-desktop.html:110-118` (D) and
   `design/assets/results-mobile.html:93-97` (M).

   D  `padding:32px 48px 0; display:flex; align-items:center;
       justify-content:space-between; gap:24px`, left cluster `gap:20px`,
       sort cluster `gap:12px`.
   M  `padding:20px 16px 0; flex-direction:column; gap:12px` — three stacked
       rows as drawn (breadcrumb / chip + link / count); since D72 the third
       is gone and two remain. No sort control; sort lives in the sticky bar
       (`results.md` §2.3).
   Tablet 720-1099 keeps the mobile arrangement (D46) and steps the page
   padding to 32px (`sm:px-8`, DESIGN.md §8).

   --- Why the disclosure is shaped the way it is (D45) -----------------------
   `Change vehicle` is a no-JS `<details>` whose content is the existing
   `VehicleFinder` (D45). Two constraints fight each other: the `<summary>` has
   to sit INLINE in the drawn row (chip left, link right on M; between the
   breadcrumb and the count on D), while the open panel has to be as wide as
   the toolbar. A `<summary>` cannot be placed anywhere but inside its
   `<details>`, and the panel cannot leave it either, so the resolution is to
   make the `<details>` itself the row-2 element and put the chip inside the
   summary:

     toolbar
     ├─ breadcrumb          ← outside: it carries a <a>, and interactive
     │                        content inside a <summary> is an anti-pattern
     ├─ <details>           ← M: a full-width block   D: a flex item
     │   ├─ <summary>       ← M: row 2 (chip + link)  D: chip + link inline
     │   └─ <VehicleFinder variant="inline">   ← opens in flow, full width
     └─ sort cluster        ← D only

   (The drawn fourth element, the count, left this row at D72 — it is now the
   second line of the `Best matches` header stack. On D that makes the open
   `<details>` the only thing between the breadcrumb and the sort cluster, so
   it has strictly more room than before, not less.)

   Consequences, both accepted because the open state is undrawn (D45):
   1. The whole summary row toggles, not just the link — tapping the chip
      opens the vehicle editor, which reads as the same intent, and it gives
      the 12px-tall link a 44px target without `tap-extend`.
   2. On D the `<details>` is a shrink-to-fit flex item, so CLOSED it is
      exactly as wide as the chip + link (parity holds) and OPEN it grows to
      the space left between the breadcrumb and the sort cluster. `items-start`
      keeps the breadcrumb on the top line while it does. On M the panel opens
      directly under its trigger, at the bottom of the toolbar since D72.
   No overlay, no absolute positioning, no JS.
   --------------------------------------------------------------------------- */

export interface ResultsToolbarProps {
  view: ResultsView;
}

export function ResultsToolbar({ view }: ResultsToolbarProps) {
  const { category } = view.query;
  /* `Tires` on tires since D112 (the artboard draws `Results`,
     `design/DEVIATIONS.md` #95); `Wheels` / `Accessories` are new copy (D58,
     `categories.ts` "crumb"). */
  const config = CATEGORY_CONFIG[category];
  const crumb = config.crumb;
  return (
    <div
      data-probe="toolbar"
      className="px-4 pt-5 sm:px-8 md:px-12 md:pt-8"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-6 lg:mx-auto lg:max-w-content">
        {/* Left cluster — D `gap:20px` (results-desktop.html:111); M is the
            toolbar's own 12px column (results-mobile.html:93). `items-start`
            so the open panel does not drag the breadcrumb off the top line;
            each sibling centres itself inside the drawn 44px row instead. */}
        <div className="flex min-w-0 flex-col gap-3 md:flex-1 md:flex-row md:items-start md:gap-5">
          {/* Breadcrumb — `500 11px/1 +.1em uppercase --text-dim` (M),
              12px on D. `results.md` §2.2 rows 3-3b.
              The 44px centring box is this WRAPPER, not the breadcrumb span:
              the artboard writes `Home <span style="margin:0 6px">/</span>
              <span>Results</span>` (results-desktop.html:112) with a space
              text node either side of the separator — ~3.6px each at 12px, so
              the whole breadcrumb measured 118.6px, not 111.4px, with the
              drawn `Results` (now `Tires`, #95, so narrower; `Wheels` /
              `Accessories` on the other two routes,
              D58 — `CATEGORY_CONFIG[category].crumb`). A flex container
              discards whitespace-only text nodes, so the span has to stay an
              inline formatting context at every width and the flexing moves
              out one level.
              D91b (VPE-4, restores the drawn value): below `md:` the wrapper
              is a plain block, so its line box took the BODY strut — 16px ×
              1.5 = 24px — around an 11px/1 breadcrumb, and the whole mobile
              toolbar sat 13px below `results-mobile.html:93`. The wrapper now
              carries the breadcrumb's own size and `leading-none`, so the
              strut is 11px and the drawn 11px row returns. From `md:` it is a
              flex container and the span is its own flex item, so the desktop
              row is unchanged. The link's 45px hit band is `tap-extend-lg`'s
              `::after` (D57 C4), independent of this line box. */}
          <div className="text-11 leading-none md:flex md:min-h-11 md:shrink-0 md:items-center md:text-12">
            <span
              data-probe="breadcrumb"
              className="label text-ink-dim text-11 tracking-10 md:text-12"
            >
              {/* The exports' global `a:hover{color:var(--text-muted)}` is the
                  only hover this link has (`results.md` "Global base rules").
                  D92b: `nav-back` because Home is up the hierarchy from a
                  results page, so the page slides the way it came;
                  `active:opacity-70` is the text-link press. */}
              <Link
                href={ROUTES.home}
                transitionTypes={["nav-back"]}
                className="tap-extend-lg hover:text-ink-muted active:opacity-70"
              >
                Home
              </Link>{" "}
              {/* `margin:0 6px` — results-desktop.html:112. */}
              <span className="mx-1.5" aria-hidden="true">
                /
              </span>{" "}
              <span className="text-ink">{crumb}</span>
            </span>
          </div>

          {/* The vehicle chip and the `Change vehicle` / `Add vehicle`
              disclosure (D45, D72) lived here until D159 (owner, 2026-10-07):
              the vehicle is now a button in the mobile sticky bar and at the
              top of the desktop filter rail, opening one sheet
              (`vehicle-panel.tsx`, `vehicle-sheet.tsx`). */}

          {/* The count used to sit here, third in the left cluster on D and
              row 3 on M (`results.md` §2.2 row 6). **D72 (owner, 2026-09-22):
              "put 9 matches somewhere else"** — it moved to the `Best matches`
              header stack in `results-grid.tsx`, where it labels the list it
              counts. Its `aria-live` region moved with it, intact and still
              the build's only one; `countCopy` moved with it too, so the
              string is still produced in exactly one place. Deviation #63. */}
        </div>

        {/* Sort cluster — D only (`results.md` §2.2 rows 7-9); on M the sort
            control moves into the sticky bar. `gap:12px`. Not rendered while
            prices are off: `Best match` alone is no choice (D122). */}
        {HAS_SORT_CHOICE ? (
          <div className="hidden md:flex md:min-h-11 md:shrink-0 md:items-center md:gap-3">
            <label
              data-probe="sort-label"
              htmlFor="results-sort"
              className="label text-ink-dim text-11 tracking-12"
            >
              Sort
            </label>
            <SortSelect id="results-sort" variant="toolbar" query={view.query} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
