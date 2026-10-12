/* ---------------------------------------------------------------------------
   The vehicle controls of the three results pages (D159), Server Components:

   - `VehicleButton` — the button that opens the vehicle sheet. With no
     vehicle it reads `Add vehicle`; with one it is the D72 vehicle chip (lime
     border, lime-tinted fill, lime car) naming the car. Same 44px box as the
     `Filters` trigger it sits beside on mobile (owner, 2026-10-07: "the add
     vehicle needs to be a same button as filter on mobile"; "instead of
     change vehicle, filter should be there on side"). It is a link to
     `#vehicle-sheet`: `VehicleSheet` opens the dialog on click, and with JS
     off the link targets the dialog, which a `<noscript>` style shows.
   - `VehiclePanel` — the sheet itself with the finder inside, rendered once
     per page in `results-page.tsx`.

   The finder submits to the category's own route and carries the page's
   other filters (WDG-17, owner 2026-09-30: "Keep filters, stay empty"),
   picked size included since D176: a size beside a car keeps the car (D170),
   so adding a car no longer drops the size (owner, 2026-10-11: "when I added
   the vehicle, the tire size got removed, keep them too"). `show` and
   `similar` are left out because a new search resets the windows (D44). With a vehicle chosen the sheet also
   offers `Remove vehicle`, the same URL without the car.
   --------------------------------------------------------------------------- */

import Link from "next/link";

import { CATEGORY_CONFIG, EXTRA_PARAM } from "@/features/catalog/categories";
import { VehicleFinder } from "@/features/finder/components/vehicle-finder";
import { resultsHref } from "@/features/results/query";
import { VehicleSheet } from "@/features/results/components/vehicle-sheet";
import {
  ALL_BRANDS,
  DEFAULT_SORT,
  RESULTS_PARAM,
  RESULTS_WINDOW,
  VEHICLE_SHEET_ID,
  type ResultsQuery,
} from "@/features/results/types";
import { cx } from "@/lib/cx";

/* The drawn chip glyph, `results-desktop.html:113`, stroked in `--accent`
   (D72). */
function CarIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
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

function vehicleLabel(query: ResultsQuery): string | null {
  const { vehicle } = query;
  return vehicle === null ? null : `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
}

export function VehicleButton({
  query,
  size = "bar",
  className,
}: {
  query: ResultsQuery;
  /** `bar`: the mobile sticky bar's 44px cell, beside `Filters`. `rail`: the
   *  top of the desktop filter column, 64px tall with its label in the
   *  `Filters` title's own type (Barlow Condensed 700, 28px, uppercase;
   *  owner, 2026-10-07: "add vehicle is still small and not visible. keep it
   *  as big as filters font size"), and a `Change` cue after a chosen car. */
  size?: "bar" | "rail";
  className?: string;
}) {
  const label = vehicleLabel(query);
  const rail = size === "rail";
  return (
    <a
      href={`#${VEHICLE_SHEET_ID}`}
      aria-haspopup="dialog"
      aria-label={label === null ? "Add vehicle" : `Change vehicle, ${label}`}
      data-probe="vehicle-button"
      className={cx(
        /* `shrink-0`: the rail is a scrolling flex column (D68), which
           squeezed a 44px button to 28px. */
        "border-accent text-ink inline-flex min-w-0 shrink-0 touch-manipulation items-center border no-underline",
        rail ? "h-16 gap-3 px-4" : "h-11 gap-2.5 px-3.5",
        "hover:bg-accent hover:text-on-accent active:translate-y-px",
        "focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2",
        label === null
          ? rail
            ? "font-display text-display-28 leading-flat justify-center font-bold uppercase"
            : "label justify-center text-12 tracking-6"
          : rail
            ? "bg-accent-subtle font-display text-display-24 leading-flat font-bold uppercase"
            : "bg-accent-subtle font-sans text-14 leading-flat font-bold",
        className,
      )}
    >
      <CarIcon size={rail ? 26 : 18} />
      {label === null ? (
        "Add vehicle"
      ) : (
        <>
          {/* Up to two lines, then an ellipsis, so "2019 Mercedes-Benz
              GLE-Class" shows whole in the 44px bar and 64px rail button
              (QA LAYOUT-2); `break-words` keeps one long word from widening
              the page (D91b). `py-1` keeps descenders inside the clamp. */}
          <span className="min-w-0 flex-1 break-words line-clamp-2 py-1">{label}</span>
          {rail ? (
            <span className="text-ink-muted shrink-0 font-sans text-12 font-medium normal-case underline underline-offset-4">
              Change
            </span>
          ) : null}
        </>
      )}
    </a>
  );
}

/** The page's other filters, as hidden `[name, value]` pairs for the finder. */
function carriedFilters(query: ResultsQuery): Array<[string, string]> {
  const config = CATEGORY_CONFIG[query.category];
  const chipParam = config.chips?.param;
  const carried: Array<[string, string]> = [
    /* D176: the picked size, in the selects' own params (`width`, `profile`,
       `rim`; `diameter`, `width`, `bolt`). The sheet's finder draws no size
       field, so nothing else in the form sends these names. */
    ...(config.size?.fields ?? []).flatMap((field): Array<[string, string]> => {
      const value = query.size[field.param] ?? null;
      return value === null || value === "" ? [] : [[field.param, value]];
    }),
    ...(chipParam === undefined
      ? []
      : query.chips.map((chip): [string, string] => [chipParam, chip])),
    ...query.brands.map((brand): [string, string] => [RESULTS_PARAM.brand, brand]),
  ];
  if (query.loadMin !== null) carried.push([EXTRA_PARAM.loadIndex, query.loadMin]);
  if (query.bore !== null) carried.push([EXTRA_PARAM.centerBore, query.bore]);
  if (query.offsetMin !== null) carried.push([EXTRA_PARAM.offsetMin, String(query.offsetMin)]);
  if (query.offsetMax !== null) carried.push([EXTRA_PARAM.offsetMax, String(query.offsetMax)]);
  for (const finish of query.finishes) carried.push([EXTRA_PARAM.finish, finish]);
  for (const thread of query.threads) carried.push([EXTRA_PARAM.thread, thread]);
  if (query.priceMin !== null) carried.push([RESULTS_PARAM.min, String(query.priceMin)]);
  if (query.priceMax !== null) carried.push([RESULTS_PARAM.max, String(query.priceMax)]);
  if (query.sort !== DEFAULT_SORT) carried.push([RESULTS_PARAM.sort, query.sort]);
  /* D132: an opened brand fold stays open across a vehicle change. */
  if (query.allBrands) carried.push([RESULTS_PARAM.brands, ALL_BRANDS]);
  return carried;
}

export function VehiclePanel({
  query,
  fits = true,
}: {
  query: ResultsQuery;
  /** Whether the car narrows this category's list (`ResultsView.vehicleNarrows`).
   *  `false`: no fit data, so everything is shown and the sheet says so
   *  (owner, 2026-10-13: "No-data car wording", D185). */
  fits?: boolean;
}) {
  const config = CATEGORY_CONFIG[query.category];
  const finder = config.finder;
  if (finder === null) return null;
  const partial = query.partialVehicle ?? null;
  const label = vehicleLabel(query);

  return (
    <VehicleSheet
      title={label === null ? "Add vehicle" : "Change vehicle"}
      openOnLoad={partial !== null}
    >
      {label === null ? null : (
        <p className="text-ink-muted text-14 leading-body">
          {fits ? "Showing what fits your " : "We don't have fit data for your "}
          <span className="text-ink font-bold">{label}</span>
          {fits ? ". " : " yet, so everything is shown. "}
          <Link
            href={resultsHref({
              ...query,
              vehicle: null,
              show: RESULTS_WINDOW.best,
              similarShow: RESULTS_WINDOW.similar,
            })}
            className="text-ink underline underline-offset-4 hover:decoration-accent active:opacity-70"
          >
            Remove vehicle
          </Link>
        </p>
      )}
      <VehicleFinder
        variant="sheet"
        action={config.route}
        cta={finder.cta}
        carry={carriedFilters(query)}
        partial={partial}
      />
    </VehicleSheet>
  );
}
