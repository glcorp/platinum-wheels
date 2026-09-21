"use client";

/* ---------------------------------------------------------------------------
   FilterPanel — the one `/results` filter form, drawn twice

   The desktop rail (`results-desktop.html:121-147`) and the mobile sheet body
   (`results-mobile-filters.html:76-82`) are the same five groups with different
   shells, so they are one component with a `variant`. Every difference between
   the two is measured and cited inline; the summary table is
   `design/inventory/results.md` §4.6.

   **State is the URL (D44).** The panel stores nothing a query string does not.
   It is one `<form method="get" action="/results">` whose control `name`s are
   `RESULTS_PARAM`, so:
     - without JS, `Apply` / `Show N matches` is a plain GET that lands on the
       same href the island would have pushed;
     - with JS, the form's native `change` event rebuilds the query from its own
       `FormData` and `router.replace`s it, `scroll:false`, inside a transition.
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
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChipCheckbox, chipBox, chipRestClass } from "@/components/ui/chip";
import {
  clearFilters,
  parseResultsQuery,
  resultsHref,
} from "@/features/results/query";
import {
  DEFAULT_SORT,
  RESULTS_PARAM,
  type FacetOption,
  type RawSearchParams,
  type ResultsView,
  type SizeOption,
} from "@/features/results/types";
import { ROUTES } from "@/lib/routes";

/* --- Shared bits ---------------------------------------------------------- */

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

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
   `<svg width="16" height="16"><path d="M18 15l-6-6-6 6">` — drawn on all five
   rail groups (results-desktop.html:123,128,134,136,144) and on the sheet's
   Category and Tire size only (results-mobile-filters.html:77,78).
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
}: {
  id: string;
  name: string;
  caption: string;
  options: readonly SizeOption[];
  value: string | null;
  probe?: string;
}) {
  return (
    /* Field column `gap:6px` (results-desktop.html:129). */
    <div className="flex flex-col gap-1.5">
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
          className={[
            "h-11 w-full cursor-pointer appearance-none touch-manipulation",
            "border border-border-control bg-surface-2",
            /* 10px inset, and 10 + 14 + 6 on the right so the value can never
               run under the 14px mark. */
            "pl-2.5 pr-7.5",
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
          className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-ink"
          style={{ left: `${leftPercent}%`, right: `${rightPercent}%` }}
        />
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
          className="range-input absolute inset-x-0 top-0"
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

      {/* Bounds row: rail only — the sheet drops it (results.md §4.4 group 5).
          `font:400 12px/1; color:var(--text-dim)`. */}
      {rail ? (
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
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const refocusRef = useRef<string | null>(null);
  const closeOnArrivalRef = useRef(false);

  const { query, facets } = view;
  const rail = variant === "rail";
  const href = resultsHref(query);

  /* Commit: the form's own FormData is the single source of the next URL, so a
     scripted change and a no-JS submit can never disagree. */
  useEffect(() => {
    const form = formRef.current;
    if (form === null) return;

    const handleChange = (event: Event) => {
      const target = event.target;
      refocusRef.current =
        target instanceof HTMLElement && target.id !== "" ? target.id : null;
      const next = resultsHref(parseResultsQuery(readForm(form)));
      startTransition(() => {
        router.replace(next, { scroll: false });
      });
    };

    form.addEventListener("change", handleChange);
    return () => {
      form.removeEventListener("change", handleChange);
    };
  }, [href, router, startTransition]);

  /* The href has changed, so the keyed form has just re-mounted: put focus back
     on the control the user operated, and only then tell the sheet to close. */
  useEffect(() => {
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
     Rail (results-desktop.html:123): `gap:14px; border-top:1px solid
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

  /* Category rows, rail: `height:40px; padding:0 12px; font:500 15px/1`,
     selected `background:var(--text); color:var(--on-accent)`, the rest
     `background:transparent; color:var(--text-muted)`
     (results-desktop.html:125). 40px is a desktop-only row — the rail is
     `md:` and up (D46), i.e. pointer devices, so the 44px touch floor in
     docs/decisions.md §5 does not apply to it.
     No hover: results.md §2.4 ends "No hover rules exist on any rail control",
     and DESIGN.md §4's row-hover value (`--bg-alt`) is a token this theme does
     not have (results.md §6 #2, #24), so there is nothing to author from. */
  const categoryRow =
    "flex h-10 items-center justify-between px-3 text-15 font-medium leading-flat focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-0";

  /* Sheet Category chips, 44px, `padding:0 16px; font:500 14px/1` — the `Chip`
     primitive's own box (src/components/ui/chip.tsx), reused as a class recipe
     because these two are `<Link>`s and `Chip` renders a `<button>`. The
     selected `Tires` chip keeps `border:1px solid var(--border-strong)` rather
     than the `--text` border the Season chips get — an inconsistency the
     artboard draws on purpose-or-not (results.md §4.4 group 1, §6 "Internal
     inconsistencies" #4) and that ships as drawn. */
  const chipFocus =
    "focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-0";

  return (
    <form
      /* Re-mount on any URL change so the uncontrolled inputs re-read their
         defaults; see the file header for why that is safe for focus. */
      key={href}
      ref={formRef}
      id={formId}
      method="get"
      action={ROUTES.results}
      onSubmit={(event) => {
        event.preventDefault();
        const next = resultsHref(parseResultsQuery(readForm(event.currentTarget)));
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
          <h2
            data-probe="filters-title"
            className="font-display text-display-28 leading-flat font-bold uppercase text-ink"
          >
            Filters
          </h2>
          <Link
            href={resultsHref(clearFilters(query))}
            data-probe="clear-all"
            className={CLEAR_ALL_CLASS}
          >
            Clear all
          </Link>
        </div>
      ) : null}

      {/* 1 — Category ---------------------------------------------------- */}
      <div
        data-probe="group-category"
        role="group"
        aria-labelledby={`${idPrefix}-category-label`}
        className={shell}
      >
        <GroupLabel id={`${idPrefix}-category-label`} mark>
          Category
        </GroupLabel>

        {rail ? (
          /* List `gap:4px` (results-desktop.html:124). */
          <div className="flex flex-col gap-1">
            <span aria-current="true" className={cx(categoryRow, "bg-ink text-on-accent")}>
              Tires
              {/* Count `font:400 13px/1; color:var(--text-dim); tabular`.
                  Computed from the seed, never typed (D42). */}
              <span className="text-13 leading-flat font-normal text-ink-dim tabular-nums">
                {facets.tireCount}
              </span>
            </span>
            {/* Wheels and Accessories carry no count — no data exists for them
                (D42); they link to their stub routes (D26, D39). */}
            <Link
              href={ROUTES.wheels}
              className={cx(categoryRow, "bg-transparent text-ink-muted")}
            >
              Wheels
            </Link>
            <Link
              href={ROUTES.accessories}
              className={cx(categoryRow, "bg-transparent text-ink-muted")}
            >
              Accessories
            </Link>
          </div>
        ) : (
          <div className="flex gap-2">
            <span
              aria-current="true"
              className={cx(chipBox, "border-border-strong bg-ink text-on-accent")}
            >
              Tires
            </span>
            <Link
              href={ROUTES.wheels}
              className={cx(chipBox, chipRestClass, chipFocus)}
            >
              Wheels
            </Link>
            <Link
              href={ROUTES.accessories}
              className={cx(chipBox, chipRestClass, chipFocus)}
            >
              Accessories
            </Link>
          </div>
        )}
      </div>

      {/* 2 — Tire size --------------------------------------------------- */}
      <div
        data-probe="group-size"
        role="group"
        aria-labelledby={`${idPrefix}-size-label`}
        className={shell}
      >
        <GroupLabel id={`${idPrefix}-size-label`} mark>
          Tire size
        </GroupLabel>

        {/* Rail `grid-template-columns:1fr 1fr 1fr; gap:8px` with `Apply` on its
            own full-width row below (results-desktop.html:129,133).
            Sheet `1fr 1fr 1fr 88px; gap:8px; align-items:end` with `Apply`
            inline (results-mobile-filters.html:78) — the fourth track is a
            fixed 88px, so it is the `size-grid-sheet` utility rather than four
            equal columns (globals.css). */}
        <div className={rail ? "grid grid-cols-3 gap-2" : "size-grid-sheet gap-2"}>
          <SizeField
            id={`${idPrefix}-width`}
            name={RESULTS_PARAM.width}
            caption="Width"
            options={facets.sizes.widths}
            value={query.width}
            probe="size-width"
          />
          <SizeField
            id={`${idPrefix}-profile`}
            name={RESULTS_PARAM.profile}
            caption="Profile"
            options={facets.sizes.profiles}
            value={query.profile}
          />
          <SizeField
            id={`${idPrefix}-rim`}
            name={RESULTS_PARAM.rim}
            caption="Rim"
            options={facets.sizes.rims}
            value={query.rim}
          />
          {rail ? null : (
            <Button type="submit" variant="secondary" size="compact" fullWidth data-probe="apply">
              Apply
            </Button>
          )}
        </div>

        {rail ? (
          <Button type="submit" variant="secondary" size="compact" fullWidth data-probe="apply">
            Apply
          </Button>
        ) : null}
      </div>

      {/* 3 — Season ------------------------------------------------------ */}
      {/* Rail label carries the collapse mark, the sheet's is bare
          (results.md §4.6 "Collapse chevrons | all 5 groups | Category and Tire
          size only"). */}
      <div
        data-probe="group-season"
        role="group"
        aria-labelledby={`${idPrefix}-season-label`}
        className={shell}
      >
        <GroupLabel id={`${idPrefix}-season-label`} mark={rail}>
          Season
        </GroupLabel>
        {/* `display:flex;gap:8px;flex-wrap:wrap` (results-desktop.html:134). */}
        <div className="flex flex-wrap gap-2">
          {facets.seasons.map((option: FacetOption) => (
            <ChipCheckbox
              key={option.value}
              id={`${idPrefix}-season-${option.value}`}
              name={RESULTS_PARAM.season}
              value={option.value}
              defaultChecked={option.selected}
              /* The sheet is in use to 1099px (D46) and draws 44px chips, so it
                 pins the touch height; the rail takes the primitive's own
                 44 → 40 step. */
              size={rail ? "auto" : "touch"}
              data-probe={option.value === "winter" ? "chip-winter" : undefined}
            >
              {/* Copy verbatim, `All-season` with a lowercase s — unlike the
                  card badge (results.md §6 "Internal inconsistencies" #1). */}
              {option.label}
            </ChipCheckbox>
          ))}
        </div>
      </div>

      {/* 4 — Brand ------------------------------------------------------- */}
      <div
        data-probe="group-brand"
        role="group"
        aria-labelledby={`${idPrefix}-brand-label`}
        className={shellBrand}
      >
        <GroupLabel id={`${idPrefix}-brand-label`} mark={rail}>
          Brand
        </GroupLabel>
        {/* Rail: one column, `gap:2px`, rows 40px / `gap:12px`, name `flex:1`,
            count 13px tabular (results-desktop.html:137).
            Sheet: `grid-template-columns:1fr 1fr`, rows 44px / `gap:10px`, name
            not flexed, count 12px non-tabular (results.md §4.4 group 4). */}
        <div className={rail ? "flex flex-col gap-0.5" : "grid grid-cols-2"}>
          {facets.brands.map((option: FacetOption) => (
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
          ))}
        </div>
      </div>

      {/* 5 — Price per tire ---------------------------------------------- */}
      <div
        data-probe="group-price"
        role="group"
        aria-labelledby={`${idPrefix}-price-label`}
        className={shellPrice}
      >
        <GroupLabel id={`${idPrefix}-price-label`} mark={rail}>
          Price per tire
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
    </form>
  );
}
