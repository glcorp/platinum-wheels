"use client";

/* ---------------------------------------------------------------------------
   FilterPanel — the one `/tires` filter form, drawn twice

   The desktop rail (`results-desktop.html:121-147`) and the mobile sheet body
   (`results-mobile-filters.html:76-82`) are the same groups with different
   shells, so they are one component with a `variant`. Every difference between
   the two is measured and cited inline; the summary table is
   `design/inventory/results.md` §4.6.

   **The drawn `Category` group is not built (`DEVIATIONS.md` #60).** The
   artboards draw five groups; the panel renders **four** on tires and wheels
   and **three** on accessories, which draw no size group (#50). Category was
   navigation, never a filter — it set no param and never counted towards
   `Filters (n)` — so nothing about the query, the counts or the best/similar
   split moves with it. The three category routes are reached from the site
   header nav and the footer's first column.

   **State is the URL (D44).** The panel stores nothing a query string does not.
   It is one `<form method="get" action="/tires">` whose control `name`s are
   `RESULTS_PARAM`, so:
     - with JS, the form's native `change` event rebuilds the query from its own
       `FormData` and `router.replace`s it, `scroll:false`, inside a transition —
       every control, size fields included, commits on `change`;
     - without JS, the **sheet** still commits: its footer `Show N matches`
       (`filter-sheet.tsx`, `form="results-filter-sheet"`) is a plain GET that
       submits this same form. **The rail has no submit control of any kind**
       since the per-group `Apply` was removed (owner instruction, `DEVIATIONS.md`
       #71) — the rail was the button's only reason to exist, so removing it
       removes the rail's entire no-JS commit path, not only for size: brand,
       chips and price change the DOM state but a no-JS visitor has no way to
       turn that into a navigation. `design/DEVIATIONS.md` #71 is the record.
   The native `change` event is used deliberately: React's `onChange` is the
   `input` event, which would fire on every pixel of a range drag. `change` is
   the commit, so a slider navigates once, on release
   (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md`
   for `replace(href, { scroll })`).

   The form is keyed on the current href so its uncontrolled inputs re-read
   their `default*` whenever the URL moves — including a `Clear all`, a back
   button or a sort change from outside the panel. That re-mount would drop
   focus, so the control that fired the change is re-focused by `id` once the
   new URL has rendered; the ids are why every control has one.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChipCheckbox } from "@/components/ui/chip";
import { CATEGORY_CONFIG } from "@/features/catalog/categories";
import {
  clearFilters,
  parseResultsQuery,
  resultsHref,
  withPriceBounds,
} from "@/features/results/query";
import {
  BRAND_WINDOW,
  DEFAULT_SORT,
  RESULTS_PARAM,
  type FacetOption,
  type RawSearchParams,
  type ResultsView,
  type SizeOption,
} from "@/features/results/types";
import { cx } from "@/lib/cx";

/* --- Shared bits ---------------------------------------------------------- */

/** `Zeta` → `zeta`, `BF Goodrich` → `bf-goodrich`. Ids only, never a URL. */
function slugifyId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/** `$140` — whole dollars, no cents, the artboards' own format
 *  (results-desktop.html:147). */
function money(value: number): string {
  return `$${value}`;
}

function percentOf(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return ((value - min) / (max - min)) * 100;
}

/** Every string value in the form, repeat names collapsed to an array — the
 *  exact shape `parseResultsQuery` takes from a page's `searchParams`, so the
 *  island and a no-JS GET produce byte-identical hrefs. */
function readForm(form: HTMLFormElement): RawSearchParams {
  const raw: RawSearchParams = {};
  new FormData(form).forEach((value, key) => {
    if (typeof value !== "string") return;
    const existing = raw[key];
    if (existing === undefined) {
      raw[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      raw[key] = [existing, value];
    }
  });
  return raw;
}

/* Collapse chevron, `stroke-width:1.6`, `--text-muted`, pointing UP (expanded):
   `<svg width="16" height="16"><path d="M18 15l-6-6-6 6">` — drawn on every
   rail group (results-desktop.html:128,134,136,144; :123 was Category, #60)
   and on the sheet's size group only (results-mobile-filters.html:78; the
   sheet's other chevron was Category's, :77).
   It ships as static decoration: no group collapses, because no artboard draws
   a collapsed group and nothing specifies one. `aria-hidden` so it is never
   announced as a control that does nothing. */
function CollapseMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.6}
      className="size-4 shrink-0 stroke-ink-muted"
    >
      <path d="M18 15l-6-6-6 6" />
    </svg>
  );
}

/* Group label: `font:500 12px/1 var(--font-body); letter-spacing:.12em;
   text-transform:uppercase`, colour inherits `--text`
   (results.md §2.4 "Group shell", §4.4). The row is the artboard's own
   `display:flex;justify-content:space-between` with no `align-items`. */
function GroupLabel({
  id,
  mark,
  children,
}: {
  id: string;
  mark: boolean;
  children: string;
}) {
  return (
    <div className="flex justify-between">
      <span id={id} className="label text-12 tracking-12 text-ink">
        {children}
      </span>
      {mark ? <CollapseMark /> : null}
    </div>
  );
}

/* `Clear all`: `font:500 12px/1; letter-spacing:.08em; uppercase;
   color:var(--text-muted); text-decoration:underline; text-underline-offset:4px`
   — identical in the rail header (results-desktop.html:122) and the sheet
   header (results-mobile-filters.html:75). `tap-extend` lifts the 12px line to
   the 44px hit floor without changing a measured box (globals.css). */
export const CLEAR_ALL_CLASS =
  "label tap-extend text-12 tracking-8 text-ink-muted underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-0";

/* --- Tire size field ------------------------------------------------------ */

/* Field box, both variants (results-desktop.html:129, sheet identical):
   `height:44px; background:var(--surface-2); padding:0 10px`, value
   `font:700 15px/1; font-variant-numeric:tabular-nums`, 14px chevron, and
   **no radius** (results.md §5.4 lists the tire-size field boxes among the
   "not declared (= 0)" set).
   The artboard's `1px solid var(--border-strong)` becomes `--border-control`:
   this is a form control and D14 scopes that token to exactly these
   (design/DEVIATIONS.md #14).
   15px stays 15px: iOS only zooms on `<input>`/`<textarea>` focus, never on a
   `<select>`, so the 16px floor in docs/decisions.md §5 does not bite here. */
function SizeField({
  id,
  name,
  caption,
  options,
  value,
  probe,
  dense,
  spanTwo,
}: {
  id: string;
  name: string;
  caption: string;
  options: readonly SizeOption[];
  value: string | null;
  probe?: string;
  /** Tighter padding for a `dense` group (`Facets["sizeGroup"].dense`) — the
   *  measured 10 + 14 + 6 padding only clears a tire value; a bolt pattern
   *  (`5x114.3`) needs the room back. Tires never pass this. #67. */
  dense?: boolean;
  /** Bolt pattern's own two-track width in the `dense` 4-column grid (#71) —
   *  a stock `col-span-2`, never set on tires. */
  spanTwo?: boolean;
}) {
  return (
    /* Field column `gap:6px` (results-desktop.html:129). */
    <div className={cx("flex flex-col gap-1.5", spanTwo && "col-span-2")}>
      {/* Caption `font:500 10px/1; letter-spacing:.1em; uppercase;
          color:var(--text-dim)`. */}
      <label htmlFor={id} className="label text-10 tracking-10 text-ink-dim">
        {caption}
      </label>
      <span className="relative block">
        <select
          id={id}
          name={name}
          data-probe={probe}
          defaultValue={value ?? ""}
          /* State is the URL (D44). Without this, bfcache and session form
             restoration can re-seat a value the query string does not hold, so
             the control and the grid disagree after a Back. `vehicle-finder`
             already does this. D66. */
          autoComplete="off"
          className={[
            "h-11 w-full cursor-pointer appearance-none touch-manipulation",
            "border border-border-control bg-surface-2",
            /* 10px inset, and 10 + 14 + 6 on the right so the value can never
               run under the 14px mark — the measured tire padding. `dense`
               (wheels only, #67) trims it to 8 + 14 + 12: the chevron is still
               clear of the text, just without the tire group's extra 6px of
               air, and the saved 6px goes to the bolt-pattern column's content
               box. */
            dense ? "pl-2 pr-6.5" : "pl-2.5 pr-7.5",
            "numeral text-15 leading-flat text-ink",
            "focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-0",
          ].join(" ")}
        >
          {/* `Any` is new copy for the unselected state — the artboard is drawn
              pre-filled with sample data (D28 precedent, D47(4)). */}
          <option value="">Any</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {/* 14×14, stroke 1.6, --text-muted, `M6 9l6 6 6-6`. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth={1.6}
          className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 stroke-ink-muted"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </span>
    </div>
  );
}

/* --- Price group ---------------------------------------------------------- */

/* Track (results-desktop.html:146, byte-identical in the sheet):
   `position:relative;height:20px;margin:0 8px`, a 2px `--border-strong` rail at
   `top:9px`, a 2px `--text` fill between the two handles, and two 16×16
   `--text` handles at `top:2px` with `--radius-ctl`. The handles here are the
   two native `<input type="range">` thumbs the `range-input` utility paints
   (globals.css), so the pair is keyboard-operable and submits without JS.

   `top-1/2 -translate-y-1/2` puts the 2px rail at y=9–11 in the 20px box, which
   is the artboard's `top:9px`. No `top-2.25` utility exists and an arbitrary
   value is banned, so the centring form is used instead — same pixels.

   The fill's `left`/`right` are inline `style`: they are the live position of
   the selection, i.e. state, not a design value. Nothing measured is inline. */
function PriceGroup({
  idPrefix,
  rail,
  min,
  max,
  selectedMin,
  selectedMax,
}: {
  idPrefix: string;
  rail: boolean;
  min: number;
  max: number;
  selectedMin: number;
  selectedMax: number;
}) {
  /* Transient drag position only. It is seeded from the URL-derived facet and
     re-seeded on every URL change, because the form this lives in is keyed on
     the href — so no filter state outlives the query string (D44). */
  const [range, setRange] = useState({ min: selectedMin, max: selectedMax });

  const leftPercent = percentOf(range.min, min, max);
  const rightPercent = 100 - percentOf(range.max, min, max);

  return (
    <>
      <div data-probe="price-track" className="relative mx-2 h-5">
        {/* Rail: 2px, --border-strong. */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-border-strong"
        />
        {/* Fill: 2px, --text, between the handles. */}
        <span
          aria-hidden="true"
          data-price-fill=""
          className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-ink"
          style={{ left: `${leftPercent}%`, right: `${rightPercent}%` }}
        />
        {/* Thumb travel box, 8px wider than the track on each side (D69).
            A native range thumb travels `w/2 … width − w/2`, so with the
            inputs laid straight over the track box the 16px thumb centre
            only ever reached 8px…256px of the 264px rail: it stopped short
            of both ends, and at the artboard's drawn `left:14%` it sat at
            16.2% — 5.7px right of the measured handle
            (results-desktop.html:146). Stretching the inputs 8px past each
            edge maps thumb centre to exactly 0–100% of the track box, so a
            handle lands on its drawn percentage and the fill's `left` /
            `right` mark the same two points the handles do. The overhang at
            the extremes is what the track box's own `margin:0 8px` is for:
            half a handle hangs off the rail exactly as the artboard draws
            it with `margin-left:-8px`. */}
        <div className="pointer-events-none absolute -inset-x-2 top-0 h-5">
          <input
            id={`${idPrefix}-price-min`}
            type="range"
            name={RESULTS_PARAM.min}
            min={min}
            max={max}
            step={1}
            value={range.min}
            aria-label="Minimum price"
            aria-valuetext={money(range.min)}
            onChange={(event) => {
              const next = Number(event.currentTarget.value);
              /* The two thumbs share a box, so the lower one is clamped rather
                 than allowed to pass the upper. `parseResultsQuery` also swaps a
                 crossed pair, so a hand-typed URL still resolves. */
              setRange((current) => ({
                min: Math.min(next, current.max),
                max: current.max,
              }));
            }}
            /* Both inputs fill the box, so the later one in the DOM owns any
               pixel where the two 16px thumbs overlap. That is harmless until
               the pair collapses on the ceiling: `max` cannot be dragged below
               `min`, `min` is buried underneath it, and the control locks with
               no way back. Lifting `min` above `max` in exactly that state is
               the whole fix, and it paints nothing — both inputs are
               transparent. D69. */
            className={cx(
              "range-input absolute inset-x-0 top-0",
              range.min >= max && "z-10",
            )}
          />
          <input
            id={`${idPrefix}-price-max`}
            type="range"
            name={RESULTS_PARAM.max}
            min={min}
            max={max}
            step={1}
            value={range.max}
            aria-label="Maximum price"
            aria-valuetext={money(range.max)}
            onChange={(event) => {
              const next = Number(event.currentTarget.value);
              setRange((current) => ({
                min: current.min,
                max: Math.max(next, current.min),
              }));
            }}
            className="range-input absolute inset-x-0 top-0"
          />
        </div>
      </div>

      {/* Value row: `font:700 15px/1`, tabular in the rail and **non-tabular**
          in the sheet — results.md §4.4 group 5 records the missing
          `font-variant-numeric` as drawn, so `numeral` (which forces tabular)
          is only used on the rail. */}
      <div data-probe="price-values" className="flex justify-between">
        <span
          className={
            rail
              ? "numeral text-15 leading-flat text-ink"
              : "font-sans text-15 leading-flat font-bold text-ink"
          }
        >
          {money(range.min)}
        </span>
        <span
          className={
            rail
              ? "numeral text-15 leading-flat text-ink"
              : "font-sans text-15 leading-flat font-bold text-ink"
          }
        >
          {money(range.max)}
        </span>
      </div>

      {/* Bounds row: rail only — the sheet drops it (results.md §4.4 group 5) —
          and only once a price filter narrows the range (DEVIATIONS.md #68).
          `selectedMin`/`selectedMax` are the URL-derived committed range
          (`search.ts` `priceFacet()`), the same comparison `countActiveGroups`
          makes for `Filters (n)`; at rest they equal `min`/`max`, so this row
          and the value row above it would render the same two numbers twice.
          `font:400 12px/1; color:var(--text-dim)`. */}
      {rail && (selectedMin !== min || selectedMax !== max) ? (
        <div className="flex justify-between">
          <span className="text-12 leading-flat text-ink-dim">{money(min)}</span>
          <span className="text-12 leading-flat text-ink-dim">{money(max)}</span>
        </div>
      ) : null}
    </>
  );
}

/* --- Panel ---------------------------------------------------------------- */

export interface FilterPanelProps {
  view: ResultsView;
  /** `rail` = the 280px desktop aside; `sheet` = the mobile dialog body. */
  variant: "rail" | "sheet";
  /** Namespaces every control id — the panel is rendered twice per page. */
  idPrefix: string;
  /** Lets the sheet footer's submit button live outside the `<form>`. */
  formId?: string;
  /** Called once the submitted URL has rendered — the sheet closes on it. */
  onNavigate?: () => void;
}

export function FilterPanel({
  view,
  variant,
  idPrefix,
  formId,
  onNavigate,
}: FilterPanelProps) {
  const router = useRouter();
  /* `isPending` was discarded, so a filter change had no busy affordance at
     all while the server re-filtered — the grid simply sat still. Surfaced as
     `aria-busy` on the form rather than a spinner: no motion, no new visual,
     nothing the artboards do not draw. D66. */
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const refocusRef = useRef<string | null>(null);
  const closeOnArrivalRef = useRef(false);

  const { query, facets } = view;
  const rail = variant === "rail";
  const href = resultsHref(query);
  const priceFloor = facets.price.min;
  const priceCeiling = facets.price.max;

  /* The URL a form commits to. A range input always submits both handles, so
     the raw form pins `min`/`max` at the bounds on every commit; a bound that
     equals the seed's is no filter and stays out of the href, the same as the
     server drops it (`withPriceBounds`, QA WDG-07). */
  const hrefFromForm = useCallback(
    (form: HTMLFormElement) =>
      resultsHref(
        withPriceBounds(parseResultsQuery(query.category, readForm(form)), {
          min: priceFloor,
          max: priceCeiling,
        }),
      ),
    [query.category, priceFloor, priceCeiling],
  );

  /* Commit: the form's own FormData is the single source of the next URL, so a
     scripted change and a no-JS submit can never disagree.

     `useLayoutEffect`, not `useEffect` (D91b). The form is keyed on `href`, so
     every committed URL change mounts a brand-new `<form>` with no listener on
     it. A passive effect runs *after* paint, and the browser is free to
     dispatch the next input event in between: a click on the next control
     toggled it, fired `change` at a form nobody was listening to, and
     committed nothing — measured in WebKit at ~1 in 4 when a brand was ticked
     the instant `season=winter` reached the URL, and the cause of the flaky
     "filter survives a PDP and Back", price-arrow and every-group tests. A
     layout effect runs synchronously inside the commit that inserts the form,
     before the browser can paint or dispatch anything, so the window is gone.
     `formRef.current` is already attached by then (child refs attach before a
     parent's layout effects). The native `change` event stays, for the reason
     in the header. */
  useLayoutEffect(() => {
    const form = formRef.current;
    if (form === null) return;

    const handleChange = (event: Event) => {
      const target = event.target;
      refocusRef.current =
        target instanceof HTMLElement && target.id !== "" ? target.id : null;
      const next = hrefFromForm(form);
      startTransition(() => {
        router.replace(next, { scroll: false });
      });
    };

    form.addEventListener("change", handleChange);
    return () => {
      form.removeEventListener("change", handleChange);
    };
  }, [href, hrefFromForm, router, startTransition]);

  /* The href has changed, so the keyed form has just re-mounted: put focus back
     on the control the user operated, and only then tell the sheet to close.
     A layout effect for the same commit-time reason as above (D91b): the new
     DOM is already in the document, so `getElementById` finds the fresh
     control, and focus is back before the first paint of the new form rather
     than a frame after it, so focus is never observably on <body>. Nothing
     here reads layout, and `onNavigate` only sets the sheet's open state, so
     running it synchronously in the commit is safe. */
  useLayoutEffect(() => {
    const id = refocusRef.current;
    refocusRef.current = null;
    if (id !== null) {
      document.getElementById(id)?.focus({ preventScroll: true });
    }
    if (closeOnArrivalRef.current) {
      closeOnArrivalRef.current = false;
      onNavigate?.();
    }
  }, [href, onNavigate]);

  /* Group shells.
     Rail (results-desktop.html:128): `gap:14px; border-top:1px solid
     var(--border-strong); padding-top:20px`, Price `gap:20px`.
     Sheet (results.md §4.4): `gap:12px; padding:16px 0; border-bottom`, Brand
     `gap:8px`, Price `gap:16px` and no bottom hairline. */
  const shell = rail
    ? "flex flex-col gap-3.5 border-t border-border-strong pt-5"
    : "flex flex-col gap-3 border-b border-border-strong py-4";
  const shellBrand = rail
    ? "flex flex-col gap-3.5 border-t border-border-strong pt-5"
    : "flex flex-col gap-2 border-b border-border-strong py-4";
  const shellPrice = rail
    ? "flex flex-col gap-5 border-t border-border-strong pt-5"
    : "flex flex-col gap-4 py-4";

  /* Brand rows. `facets.brands` arrives most-products-first. */
  const primaryBrands = facets.brands.filter(
    (option, index) => option.selected || index < BRAND_WINDOW,
  );
  const foldedBrands = facets.brands
    .filter((option, index) => !option.selected && index >= BRAND_WINDOW)
    .sort((a, b) => a.label.localeCompare(b.label));
  /* Rail: one column, `gap:2px`, rows 40px / `gap:12px`, name `flex:1`,
     count 13px tabular (results-desktop.html:137).
     Sheet: `grid-template-columns:1fr 1fr`, rows 44px / `gap:10px`, name
     not flexed, count 12px non-tabular (results.md §4.4 group 4). */
  const brandList = rail ? "flex flex-col gap-0.5" : "grid grid-cols-2";
  const brandRow = (option: FacetOption) => (
    <Checkbox
      key={option.value}
      variant="facet"
      id={`${idPrefix}-brand-${slugifyId(option.value)}`}
      name={RESULTS_PARAM.brand}
      value={option.value}
      defaultChecked={option.selected}
      labelClassName={rail ? "h-10 gap-3" : "h-11 gap-2.5"}
      labelProbe="brand-row"
    >
      <span
        className={cx(
          "text-15 leading-flat font-normal text-ink",
          rail && "flex-1",
        )}
      >
        {option.label}
      </span>
      <span
        className={
          rail
            ? "text-13 leading-flat font-normal text-ink-dim tabular-nums"
            : "text-12 leading-flat font-normal text-ink-dim"
        }
      >
        {option.count}
      </span>
    </Checkbox>
  );

  return (
    <form
      aria-busy={isPending}
      /* Re-mount on any URL change so the uncontrolled inputs re-read their
         defaults; see the file header for why that is safe for focus. */
      key={href}
      ref={formRef}
      id={formId}
      method="get"
      /* This category's own route (D58) — `CATEGORY_CONFIG[query.category].route`,
         not `resultsHref(clearFilters(query))`, so a no-JS submit posts to the
         plain route even mid-edit, before the rest of the query is known to be
         valid. Tires' route is still the measured `/tires` (D39). */
      action={CATEGORY_CONFIG[query.category].route}
      onSubmit={(event) => {
        event.preventDefault();
        const next = hrefFromForm(event.currentTarget);
        if (next === href) {
          /* Nothing moved, so no navigation will arrive to close on. */
          onNavigate?.();
          return;
        }
        closeOnArrivalRef.current = true;
        startTransition(() => {
          router.replace(next, { scroll: false });
        });
      }}
      /* The aside's own `gap:32px` (results-desktop.html:121) rides on the form
         so `FilterRail` stays a thin wrapper. The sheet's groups carry their own
         `padding:16px 0`, so it has no gap. */
      className={rail ? "flex flex-col gap-8" : "flex flex-col"}
    >
      {/* Params the panel does not draw but the URL must keep, so a no-JS
          submit reproduces the island's href exactly (D44). `show` is
          deliberately absent: a filter change resets the Load-more window. */}
      {query.vehicle !== null ? (
        <>
          <input type="hidden" name={RESULTS_PARAM.year} value={query.vehicle.year} />
          <input type="hidden" name={RESULTS_PARAM.make} value={query.vehicle.make} />
          <input type="hidden" name={RESULTS_PARAM.model} value={query.vehicle.model} />
        </>
      ) : null}
      {query.sort !== DEFAULT_SORT ? (
        <input type="hidden" name={RESULTS_PARAM.sort} value={query.sort} />
      ) : null}

      {/* Rail header (results-desktop.html:122). The sheet's own header carries
          the title and `Clear all`, so it is not repeated here. */}
      {rail ? (
        <div className="flex items-baseline justify-between">
          {/* Barlow Condensed 700 / 28px / line-height 1 / **no tracking** —
              results.md §5.2 "700 / 28px / 1 / no tracking / uppercase". The
              `display` utility would add --display-tracking, and `--tracking-*`
              is reset to `initial` in globals.css so no zero-tracking class
              exists; the properties are spelled out instead, exactly as
              how-it-works.tsx does for the same case (D35(3)). */}
          {/* A `<p>`, not an `<h2>`: `results-page.tsx` renders the rail before
              the grid, so an `<h2>` here opened the document outline at level 2
              and pushed the page `<h1>Best matches>` (results-grid.tsx) into
              second place on /tires, /wheels and /accessories at >=1100px.
              `<aside aria-label="Filters">` (filter-rail.tsx) already names the
              region, so nothing is lost. `<p>` and `<h2>` are both block and
              preflight zeroes both margins, so no pixel moves. Craft audit
              P1 #3. */}
          <p
            data-probe="filters-title"
            className="font-display text-display-28 leading-flat font-bold uppercase text-ink"
          >
            Filters
          </p>
          <Link
            href={resultsHref(clearFilters(query))}
            data-probe="clear-all"
            className={CLEAR_ALL_CLASS}
          >
            Clear all
          </Link>
        </div>
      ) : null}

      {/* 1 — Size (tires and wheels draw a group; accessories draw none) - */}
      {/* `facets.sizeGroup` is `null` for accessories (D58) — the group is
          omitted entirely, so accessories draw three groups where tires and
          wheels draw four (#50 with #60), owner-ruled. Where it exists it is always exactly three fields
          (`categories.ts` "The group is drawn as a three-track grid ... a
          category gets exactly three fields or none at all"), so the 3-track
          grid below is unchanged. */}
      {/* Local const, not `facets.sizeGroup` inline: a property access does not
          keep its `!== null` narrowing inside the `.map` closure below, a
          local `const` binding does. */}
      {(() => {
        const sizeGroup = facets.sizeGroup;
        if (sizeGroup === null) return null;
        return (
          <div
            data-probe="group-size"
            role="group"
            aria-labelledby={`${idPrefix}-size-label`}
            className={shell}
          >
            <GroupLabel id={`${idPrefix}-size-label`} mark>
              {sizeGroup.label}
            </GroupLabel>

            {/* Rail and sheet now share one grid (owner instruction, #71:
                the per-group `Apply` that sat below this grid on the rail and
                inline as its fourth column on the sheet is gone — filters
                already commit on `change`, so it committed nothing new — and
                with it goes the sheet's reserved 88px `Apply` column, so the
                rail's own `grid-template-columns:1fr 1fr 1fr; gap:8px`
                (results-desktop.html:129) now governs both variants directly.
                A `dense` group (wheels, #67, #71) still swaps in a **stock**
                4-column grid with the third field (`Bolt pattern`) on
                `col-span-2` — a 1 : 1 : 2 split from Tailwind's own utilities,
                no arbitrary value, no custom `@utility`. Tires never set
                `dense`, so their `grid-cols-3` is byte-identical to the
                parity-measured rail. */}
            <div
              className={cx(
                "gap-2",
                sizeGroup.dense ? "grid grid-cols-4" : "grid grid-cols-3",
              )}
            >
              {sizeGroup.fields.map((field, index) => (
                <SizeField
                  key={field.param}
                  id={`${idPrefix}-${field.param}`}
                  name={field.param}
                  caption={field.caption}
                  options={field.options}
                  value={field.value}
                  /* `size-width` is the tire rail's own probe id
                     (results-desktop.html:131); kept on the first field
                     generically so it still resolves on every category. */
                  probe={index === 0 ? "size-width" : undefined}
                  dense={sizeGroup.dense}
                  spanTwo={sizeGroup.dense && index === sizeGroup.fields.length - 1}
                />
              ))}
            </div>
          </div>
        );
      })()}

      {/* 2 — Chip group: Season / Type ------------------------------------- */}
      {/* Rail label carries the collapse mark, the sheet's is bare
          (results.md §4.6 "Collapse chevrons | all 5 groups | Category and Tire
          size only" — with Category gone the sheet's only chevron is the size
          group's, #60).
          Wheels have no chip group since D105b (no finish filter), so the rail
          draws one group fewer there. */}
      {(() => {
        const chipGroup = facets.chipGroup;
        if (chipGroup === null) return null;
        return (
          <div
            /* `group-${param}` resolves to the measured `group-season` on tires,
               so every existing probe in `design/reports/results.md` still hits;
               on the other two it reads `group-finish` / `group-type` rather than
               naming a group that is not there (D58). */
            data-probe={`group-${chipGroup.param}`}
            role="group"
            aria-labelledby={`${idPrefix}-season-label`}
            className={shell}
          >
            <GroupLabel id={`${idPrefix}-season-label`} mark={rail}>
              {chipGroup.label}
            </GroupLabel>
            {/* `display:flex;gap:8px;flex-wrap:wrap` (results-desktop.html:134). */}
            <div className="flex flex-wrap gap-2">
              {chipGroup.options.map((option: FacetOption) => (
                <ChipCheckbox
                  key={option.value}
                  /* Tires still emit `rail-season-winter`, unchanged; the param
                     keeps the id honest on the other two categories. */
                  id={`${idPrefix}-${chipGroup.param}-${option.value}`}
                  name={chipGroup.param}
                  value={option.value}
                  defaultChecked={option.selected}
                  /* The sheet is in use to 1099px (D46) and draws 44px chips, so it
                     pins the touch height; the rail takes the primitive's own
                     44 → 40 step. */
                  size={rail ? "auto" : "touch"}
                  data-probe={option.value === "winter" ? "chip-winter" : undefined}
                >
                  {/* Copy verbatim, `All-season` with a lowercase s on tires —
                      unlike the card badge (results.md §6 "Internal
                      inconsistencies" #1). Wheels/accessories options are new
                      copy (`.claude/rules/ui.md` "Copy", `categories.ts`). */}
                  {option.label}
                </ChipCheckbox>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 3 — Brand ------------------------------------------------------- */}
      <div
        data-probe="group-brand"
        role="group"
        aria-labelledby={`${idPrefix}-brand-label`}
        className={shellBrand}
      >
        <GroupLabel id={`${idPrefix}-brand-label`} mark={rail}>
          Brand
        </GroupLabel>
        {/* The catalogue carries up to 150 brands in a category, so the list
            is the first `BRAND_WINDOW` by product count plus anything already
            ticked, and the rest fold into a native `<details>` (D108b): no
            state, no JS, and a box ticked inside a closed `<details>` still
            submits with the form. The folded list reads A to Z, which is how a
            long list is scanned. */}
        <div className={brandList}>{primaryBrands.map(brandRow)}</div>
        {foldedBrands.length === 0 ? null : (
          <details data-probe="brand-more" className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center font-sans text-12 leading-flat font-medium text-ink-muted underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-0 md:text-13 [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">Show all brands</span>
              <span className="hidden group-open:inline">Show fewer brands</span>
            </summary>
            <div className={brandList}>{foldedBrands.map(brandRow)}</div>
          </details>
        )}
      </div>

      {/* 4 — Price per tire / wheel / item -------------------------------- */}
      <div
        data-probe="group-price"
        role="group"
        aria-labelledby={`${idPrefix}-price-label`}
        className={shellPrice}
      >
        <GroupLabel id={`${idPrefix}-price-label`} mark={rail}>
          {facets.priceLabel}
        </GroupLabel>
        <PriceGroup
          idPrefix={idPrefix}
          rail={rail}
          min={facets.price.min}
          max={facets.price.max}
          selectedMin={facets.price.selectedMin}
          selectedMax={facets.price.selectedMax}
        />
      </div>

      {/* The rail's only submit, and only for a visitor with scripting off.
          `Apply` was removed on owner instruction (DEVIATIONS.md #71, D82) —
          with JS it committed nothing the `change` listener had not already
          committed. But it was the generic submit for the WHOLE form, not a
          size control, so removing it left the rail with no submit at all:
          a form with zero submit buttons does not submit on Enter either, so
          a no-JS visitor could tick a brand or drag the price and have no way
          to turn any of it into a navigation. `<noscript>` restores D44's
          guarantee for exactly the visitors who need it and renders nothing
          for everyone else. Sheet is unaffected; its `Show N matches` is a
          separate button that was never removed. D83. */}
      {rail ? (
        <noscript>
          <Button type="submit" variant="secondary" size="compact" fullWidth>
            Apply filters
          </Button>
        </noscript>
      ) : null}
    </form>
  );
}
