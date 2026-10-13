import Link from "next/link";
import { chipBox, chipRestClass, chipSelectedClass } from "@/components/ui/chip";
import { resultsHref } from "@/features/results/query";
import { RESULTS_WINDOW, type ResultsView } from "@/features/results/types";
import { cx } from "@/lib/cx";

/* ---------------------------------------------------------------------------
   DiameterStrip — the wheel diameters as a row of chips, on `/wheels` once a
   vehicle is in the URL (D186).

   Owner, 2026-10-14, on Auto Country's wheel page: "Is it possible to have the
   diameter option out as well once we search for wheels according to
   make/year/model … It feels more comfortable as a customer if one wants to
   upgrade and install bigger wheels for their vehicle". The same choice was
   already in the filter rail and sheet as the `Diameter` select; this puts it
   in the page, under the count, where a phone visitor sees it without opening
   `Filters`.

   The options are the size facet's own diameter list, so with a car they are
   only the diameters made in its bolt pattern, and picking one keeps the car
   (D170). Each chip is a plain link to the same URL with `diameter` set (or
   cleared by `All sizes`), so it works with JavaScript off (D44); the list
   windows reset as any filter change does. `scroll={false}` keeps the reader
   where they tapped. Server Component.
   Undrawn: built from the filter chip's box and states (`chip.tsx`).
   `design/DEVIATIONS.md` #145.
   --------------------------------------------------------------------------- */

const LABEL_ID = "diameter-strip-label";

const CHIP = cx(
  chipBox,
  "sm:h-10 active:translate-y-px focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-0",
);

export function DiameterStrip({ view }: { view: ResultsView }) {
  const { query } = view;
  if (query.category !== "wheels" || query.vehicle === null) return null;

  const field = view.facets.sizeGroup?.fields.find(
    (candidate) => candidate.param === "diameter",
  );
  if (field === undefined || field.options.length < 2) return null;

  const hrefFor = (diameter: string | null) =>
    resultsHref({
      ...query,
      size: { ...query.size, diameter },
      show: RESULTS_WINDOW.best,
      similarShow: RESULTS_WINDOW.similar,
    });

  const chip = (value: string | null, label: string) => {
    const selected = field.value === value;
    return (
      <Link
        key={value ?? "all"}
        href={hrefFor(value)}
        scroll={false}
        aria-current={selected ? "true" : undefined}
        data-chip=""
        data-selected={selected ? "" : undefined}
        className={cx(CHIP, selected ? chipSelectedClass : chipRestClass)}
      >
        {label}
      </Link>
    );
  };

  return (
    <div
      data-probe="diameter-strip"
      role="group"
      aria-labelledby={LABEL_ID}
      className="flex flex-col gap-3 pt-2"
    >
      <p id={LABEL_ID} className="label text-ink-dim text-11 tracking-12">
        Wheel diameter
      </p>
      <div className="flex flex-wrap gap-2">
        {chip(null, "All sizes")}
        {field.options.map((option) => chip(option.value, `${option.value}"`))}
      </div>
    </div>
  );
}
