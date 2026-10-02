import Link from "next/link";

import { CATEGORY_CONFIG } from "@/features/catalog/categories";
import { VehicleFinder } from "@/features/finder/components/vehicle-finder";
import { SortSelect } from "@/features/results/components/sort-select";
import {
  DEFAULT_SORT,
  RESULTS_PARAM,
  type ResultsView,
} from "@/features/results/types";
import { ROUTES } from "@/lib/routes";

/* ---------------------------------------------------------------------------
   ResultsToolbar — breadcrumb, active-vehicle chip, `Change vehicle`
   disclosure and (desktop only) the sort cluster. The result count was the
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

/* `<svg width="18" height="18" … stroke-width="1.5" stroke-linejoin="round">`
   — `results-desktop.html:113`, identical on mobile (`results-mobile.html:95`).
   `text-accent` is the D72 highlight: the glyph strokes `currentColor`, so the
   class is the only thing that changes and the geometry is untouched. */
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
      className="text-accent shrink-0"
    >
      <path d="M3 13l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5v5H3z" />
      <circle cx="7.5" cy="16.5" r="1.5" />
      <circle cx="16.5" cy="16.5" r="1.5" />
    </svg>
  );
}

export function ResultsToolbar({ view }: ResultsToolbarProps) {
  const { vehicle, category } = view.query;
  /* `Tires` on tires since D112 (the artboard draws `Results`,
     `design/DEVIATIONS.md` #95); `Wheels` / `Accessories` are new copy (D58,
     `categories.ts` "crumb"). */
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

  /* Owner, 2026-09-30 (WDG-17, "Keep filters, stay empty"): choosing another
     car keeps the rest of the page's filters. The finder's GET form carries
     the chips, brands, price range and sort as hidden fields. Size is left out
     because the new vehicle derives it, the vehicle is left out because the
     three selects are it, and `show` is left out because a new search resets
     the Load-more window (D44). Read off the parsed, normalised query, so the
     fields are the ones the page itself would serialise. */
  const q = view.query;
  /* Wheels have no chip group (D105b), and then no chips to carry. */
  const chipParam = config.chips?.param;
  const carried: Array<[string, string]> = [
    ...(chipParam === undefined
      ? []
      : q.chips.map((chip): [string, string] => [chipParam, chip])),
    ...q.brands.map((brand): [string, string] => [RESULTS_PARAM.brand, brand]),
  ];
  if (q.priceMin !== null) carried.push([RESULTS_PARAM.min, String(q.priceMin)]);
  if (q.priceMax !== null) carried.push([RESULTS_PARAM.max, String(q.priceMax)]);
  if (q.sort !== DEFAULT_SORT) carried.push([RESULTS_PARAM.sort, q.sort]);

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
                 (results-desktop.html:111, chip :113, link :114).
                 `active:opacity-70`: the whole summary row is the toggle
                 (consequence 1 in the header), so the whole row takes the
                 D92b text-link press.
                 D91b (NJR-9/NJR-10, WDG-16, KBD-8): `flex-wrap` so the row
                 can never push past the gutter. The drawn row is one line
                 with a short vehicle, and it still is — a line only breaks
                 when chip + gap + link would overflow, e.g. `2024 Jeep Grand
                 Cherokee` at 320, where `Change vehicle` drops under the
                 chip instead of running 45px off-screen. */
              className="flex list-none flex-wrap items-center justify-between gap-3 active:opacity-70 md:min-h-11 md:justify-start md:gap-5 [&::-webkit-details-marker]:hidden"
            >
              {vehicleLabel === null ? null : (
                /* Vehicle chip — `height:44px` M / `40px` D, `padding:0 14px`,
                   `gap:10px`, `700 14px/1`, radius 0 (`results.md` §2.2 row 4,
                   §5.4; results-desktop.html:113, results-mobile.html:95). Not
                   the `numeral` utility: the drawn chip has no tabular-nums
                   (`results.md` §5.2).

                   **D72 (owner, 2026-09-22): "higlight the vehicle more".**
                   Every box metric above is the drawn one and is unchanged —
                   only the two colour properties move: the `--surface` fill
                   becomes `--accent-subtle` and the `1px --border-strong`
                   becomes `1px --accent`, with the car glyph in `--accent`
                   (`CarIcon`). Both are tokens the artboards' own `:root`
                   declares and the results export never spends
                   (`design/inventory/results.md`, token block: "Declared but
                   never referenced … `--accent-subtle`"), so nothing is
                   invented. The label stays `--text` 700/14 rather than going
                   accent: `--accent-subtle` over `--bg` composites to ~#222712
                   and #F4F4F5 on that is ~15:1, where lime-on-lime-tint would
                   not be. No shadow, blur, gradient, radius or motion — the
                   bans in `.claude/rules/ui.md` rule out every other way of
                   making an element louder, which is why the answer is the
                   colour pair and nothing else. D5: a second accent in the
                   frame is not a defect here. Deviation #61.

                   D91b (NJR-10): the year/make/model come from the URL
                   unvalidated, so the label has no length bound. The chip is
                   `max-w-full min-w-0` (was `shrink-0`) and the label sits in
                   its own `truncate` span: a label wider than the row ends in
                   an ellipsis inside the drawn 44px box instead of running
                   the chip off-screen. CSS truncation leaves the whole string
                   in the DOM, so the accessible name is still the full
                   vehicle. At a drawn width the label fits and nothing is
                   clipped — the span is the same flex item the bare text node
                   was. `py-1` gives the clip box room for descenders
                   (`overflow:hidden` at `leading-flat` would crop the `g` of
                   `Tiguan`); the chip centres the span, so no glyph moves. */
                <span
                  data-probe="vehicle-chip"
                  className="bg-accent-subtle border-accent text-ink inline-flex h-11 max-w-full min-w-0 items-center gap-2.5 border px-3.5 font-sans text-14 leading-flat font-bold md:h-10"
                >
                  <CarIcon />
                  <span className="min-w-0 truncate py-1">{vehicleLabel}</span>
                </span>
              )}
              {/* `Change vehicle` — `500 12px/1 +.06em uppercase --text-muted`
                  underlined at 4px offset, `padding:12px 0` for touch (M,
                  results-mobile.html:95); `500 13px/1` and no padding on D
                  (results-desktop.html:114).

                  **D72 (owner, 2026-09-22): "make change vehicle lower caps".**
                  Sentence case, matching the authored strings above, which are
                  already written `Change vehicle` / `Add vehicle` — so both
                  states change by construction and cannot drift apart.

                  The uppercase came from the shared `label` utility
                  (`globals.css` `@utility label` → `text-transform:uppercase`),
                  which 24 files use. It is NOT edited, and no `normal-case`
                  override is used either: both `.label` and `.normal-case` are
                  single-class utilities in the same Tailwind layer, so which
                  wins is source-order, not specificity. Instead this one span
                  opts out of the utility and spells the three properties
                  `label` would have given it — `font-sans` (`--font-body`),
                  `font-medium` (500), `leading-flat` (1) — leaving the drawn
                  family, weight and leading byte-identical and dropping only
                  the transform. `tracking-6` goes with it: `+.06em` is an
                  uppercase device on this page (it rides `text-transform`
                  on every control that carries it — this link, `Clear all`,
                  `Apply`, the sticky-bar pair), and lowercase at 12px does
                  not want it. Deviation #62. */}
              <span className="text-ink-muted shrink-0 cursor-pointer font-sans text-12 leading-flat font-medium underline underline-offset-4 py-3 md:py-0 md:text-13">
                {disclosureCopy}
              </span>
            </summary>
            {/* The open panel: in flow, full width of the disclosure (D45).
                It submits to THIS category's route, not the hard-coded
                `/tires` — otherwise `Change vehicle` on `/wheels` would
                land the visitor back in tires (D58). Tires keep the drawn
                target and the drawn `Find my tires` CTA, unchanged. */}
            <VehicleFinder
              variant="inline"
              action={config.route}
              cta={finder.cta}
              carry={carried}
            />
          </details>
          )}

          {/* The count used to sit here, third in the left cluster on D and
              row 3 on M (`results.md` §2.2 row 6). **D72 (owner, 2026-09-22):
              "put 9 matches somewhere else"** — it moved to the `Best matches`
              header stack in `results-grid.tsx`, where it labels the list it
              counts. Its `aria-live` region moved with it, intact and still
              the build's only one; `countCopy` moved with it too, so the
              string is still produced in exactly one place. Deviation #63. */}
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
