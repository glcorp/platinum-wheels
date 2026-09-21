import Link from "next/link";

import { CATEGORY_CONFIG } from "@/features/catalog/categories";
import { VehicleFinder } from "@/features/finder/components/vehicle-finder";
import { SortSelect } from "@/features/results/components/sort-select";
import type { ResultsView } from "@/features/results/types";
import { ROUTES } from "@/lib/routes";

/* ---------------------------------------------------------------------------
   ResultsToolbar — breadcrumb, active-vehicle chip, `Change vehicle`
   disclosure, result count and (desktop only) the sort cluster.
   Server Component; the only client code it renders is `SortSelect` (D44).

   Measured: `design/inventory/results.md` §2.2, from
   `design/assets/results-desktop.html:110-118` (D) and
   `design/assets/results-mobile.html:93-97` (M).

   D  `padding:32px 48px 0; display:flex; align-items:center;
       justify-content:space-between; gap:24px`, left cluster `gap:20px`,
       sort cluster `gap:12px`.
   M  `padding:20px 16px 0; flex-direction:column; gap:12px` — three stacked
       rows (breadcrumb / chip + link / count) and no sort control; sort lives
       in the sticky bar (`results.md` §2.3).
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
     ├─ count               ← M: row 3           D: next to the link
     └─ sort cluster        ← D only

   Consequences, both accepted because the open state is undrawn (D45):
   1. The whole summary row toggles, not just the link — tapping the chip
      opens the vehicle editor, which reads as the same intent, and it gives
      the 12px-tall link a 44px target without `tap-extend`.
   2. On D the `<details>` is a shrink-to-fit flex item, so CLOSED it is
      exactly as wide as the chip + link (parity holds) and OPEN it grows to
      the space left between the breadcrumb and the sort cluster, with the
      count pushed along the top line by `md:items-start`. On M the panel
      opens between row 2 and the count, directly under its trigger.
   No overlay, no absolute positioning, no JS.
   --------------------------------------------------------------------------- */

export interface ResultsToolbarProps {
  view: ResultsView;
}

/* `<svg width="18" height="18" … stroke-width="1.5" stroke-linejoin="round">`
   — `results-desktop.html:113`, identical on mobile (`results-mobile.html:95`). */
function CarIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 13l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5v5H3z" />
      <circle cx="7.5" cy="16.5" r="1.5" />
      <circle cx="16.5" cy="16.5" r="1.5" />
    </svg>
  );
}

/** `12 matches · 6 similar` — `results-desktop.html:115`, U+00B7 spaced. The
 *  numbers are computed from the seed, never typed (D42).
 *
 *  `N matches` counts the BEST list, not the total (D49): once a vehicle
 *  derives a size (D48) the two diverge, and `9 matches · 9 similar` for a
 *  vehicle with no exact fit reads as a contradiction. The filter sheet's
 *  `Show N matches` keeps the total, because that number counts the cards the
 *  sheet reveals.
 *
 *  The `similar` half disappears when there is none, and `matches`
 *  singularises at one — new copy under `.claude/rules/ui.md` "Copy". */
function countCopy(best: number, similar: number): string {
  const matches = `${best} ${best === 1 ? "match" : "matches"}`;
  return similar > 0 ? `${matches} · ${similar} similar` : matches;
}

export function ResultsToolbar({ view }: ResultsToolbarProps) {
  const { vehicle, category } = view.query;
  /* `Results` on tires, artboard-verbatim and unchanged; `Wheels` /
     `Accessories` are new copy (D58, `categories.ts` "crumb"). */
  const config = CATEGORY_CONFIG[category];
  const crumb = config.crumb;
  /* Non-null on all three categories since D67 (owner, 2026-09-22, vetoing
     D59(2)): an accessory does derive something from a vehicle — lug nuts and
     wheel locks have a thread pitch, TPMS sensors a frequency — so the chip
     and the disclosure render here too, each submitting to its own route.
     The `null` branch below is the switch that turns the affordance off and
     is currently taken by no category (`categories.ts` "finder"). */
  const finder = config.finder;
  const vehicleLabel =
    vehicle === null
      ? null
      : `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  /* Without a vehicle in the URL the chip is omitted and the summary reads
     `Add vehicle` (D47(5)). */
  const disclosureCopy = vehicle === null ? "Add vehicle" : "Change vehicle";

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
              the whole breadcrumb measures 118.6px, not 111.4px on `/results`
              (`Results`; `Wheels` / `Accessories` on the other two routes,
              D58 — `CATEGORY_CONFIG[category].crumb`). A flex container
              discards whitespace-only text nodes, so the span has to stay an
              inline formatting context at every width and the flexing moves
              out one level. */}
          <div className="md:flex md:min-h-11 md:shrink-0 md:items-center">
            <span
              data-probe="breadcrumb"
              className="label text-ink-dim text-11 tracking-10 md:text-12"
            >
              {/* The exports' global `a:hover{color:var(--text-muted)}` is the
                  only hover this link has (`results.md` "Global base rules"). */}
              <Link href={ROUTES.home} className="tap-extend-lg hover:text-ink-muted">
                Home
              </Link>{" "}
              {/* `margin:0 6px` — results-desktop.html:112. */}
              <span className="mx-1.5" aria-hidden="true">
                /
              </span>{" "}
              <span className="text-ink">{crumb}</span>
            </span>
          </div>

          {finder === null ? null : (
          <details className="min-w-0">
            <summary
              data-probe="change-vehicle"
              /* Marker suppression: `list-none` plus the WebKit pseudo. These
                 are arbitrary VARIANTS, not arbitrary values, so they are
                 inside `.claude/rules/ui.md` "Tokens only".
                 M row 2: `display:flex;align-items:center;
                 justify-content:space-between;gap:12px` (results-mobile.html:95).
                 D: the chip and the link sit in the 20px left-cluster rhythm
                 (results-desktop.html:111, chip :113, link :114). */
              className="flex list-none items-center justify-between gap-3 md:min-h-11 md:justify-start md:gap-5 [&::-webkit-details-marker]:hidden"
            >
              {vehicleLabel === null ? null : (
                /* Vehicle chip — `height:44px` M / `40px` D, `padding:0 14px`,
                   `--surface` fill, `1px --border-strong`, `700 14px/1`,
                   `gap:10px`, radius 0 (`results.md` §2.2 row 4, §5.4;
                   results-desktop.html:113, results-mobile.html:95). Not
                   the `numeral` utility: the drawn chip has no tabular-nums
                   (`results.md` §5.2). */
                <span
                  data-probe="vehicle-chip"
                  className="bg-surface border-border-strong text-ink inline-flex h-11 shrink-0 items-center gap-2.5 border px-3.5 font-sans text-14 leading-flat font-bold md:h-10"
                >
                  <CarIcon />
                  {vehicleLabel}
                </span>
              )}
              {/* `Change vehicle` — `500 12px/1 +.06em uppercase --text-muted`
                  underlined at 4px offset, `padding:12px 0` for touch (M,
                  results-mobile.html:95); `500 13px/1` and no padding on D
                  (results-desktop.html:114). */}
              <span className="label text-ink-muted shrink-0 cursor-pointer text-12 tracking-6 underline underline-offset-4 py-3 md:py-0 md:text-13">
                {disclosureCopy}
              </span>
            </summary>
            {/* The open panel: in flow, full width of the disclosure (D45).
                It submits to THIS category's route, not the hard-coded
                `/results` — otherwise `Change vehicle` on `/wheels` would
                land the visitor back in tires (D58). Tires keep the drawn
                target and the drawn `Find my tires` CTA, unchanged. */}
            <VehicleFinder
              variant="inline"
              action={config.route}
              cta={finder.cta}
            />
          </details>
          )}

          {/* Count — `400 14px/1 tabular --text-muted` M, 15px D
              (`results.md` §2.2 row 6). */}
          <span
            data-probe="count"
            aria-live="polite"
            aria-atomic="true"
            className="text-ink-muted text-14 leading-flat tabular-nums md:flex md:min-h-11 md:shrink-0 md:items-center md:text-15"
          >
            {countCopy(view.best.length, view.similar.length)}
          </span>
        </div>

        {/* Sort cluster — D only (`results.md` §2.2 rows 7-9); on M the sort
            control moves into the sticky bar. `gap:12px`. */}
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
      </div>
    </div>
  );
}
