import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cx } from "@/lib/cx";

/* ---------------------------------------------------------------------------
   Chip — the filter chip

   The one control in the system that is NOT uppercase: the exports declare
   `font:500 14px/1 var(--font-body)` with no `text-transform`, so it renders
   sentence case. It therefore does not use the `label` role utility (which
   uppercases); it spells out Barlow 500 instead.
   --------------------------------------------------------------------------- */

/* Box and type — measured, both from the Season chip group:

   height  44px  results.md §4.4 "Season … chips `display:flex;gap:8px`, each
                 `height:44px;padding:0 16px;font:500 14px/1`" (mobile sheet)
           40px  results.md §2.4 "Chip: `height:40px;padding:0 16px;
                 display:inline-flex;align-items:center;font:500 14px/1`"
                 (desktop rail)
   padding 0 16px, both widths (same two lines)
   type    Barlow 500 / 14px / line-height 1, sentence case, both widths

   DESIGN.md §4 gives 36px / `0 14px` / 13px / border `--border`; every one of
   those loses to the measurement (docs/decisions.md §1), and 36px would also
   fail the 44px touch floor in docs/decisions.md §5. Already ratified as
   DEVIATIONS #5. 44 → 40 steps at 720px (`sm:`), which is where DESIGN.md §8
   swaps the mobile filter sheet for the desktop sidebar ("Results controls |
   sidebar | sidebar | sticky … bar, filter sheet from the bottom") — so the
   larger chip is exactly the one on the touch artboard.

   Radius: **0** — no `rounded-*` class, deliberately.
   DESIGN.md §4 "Chip (filter)" says 2px, but the exports declare no
   `border-radius` on any chip, so the computed value is 0px. This is not the
   spec being silent: the very same rows declare `border-radius:var(--radius-ctl)`
   on the buttons and selects beside them (results-desktop.html — the Sort select
   and the tire-size Apply button both carry it, the filter chips do not). The
   artboard is drawing square chips next to 2px controls on purpose, and radius
   is an EXACT-match property in the parity thresholds, so 2px here would fail.
   Artboards win on a measured value (docs/decisions.md §1); ruled as D12,
   design/DEVIATIONS.md #5. */
/* Box only, without the focus ring and without the `sm:` step-down, so a chip
   that is not a `<button>` can wear the same box and carry the ring on a `has-`
   variant instead.
   `chipBase` below re-joins them in their original order — `Chip`'s class
   string is unchanged. */
export const chipBox =
  "font-sans inline-flex h-11 items-center gap-2 border px-4 text-14 font-medium leading-flat touch-manipulation";

const chipFocus =
  "focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-0";

const chipBase = `${chipBox} ${chipFocus} sm:h-10`;

/* State table — results.md §2.4 (desktop rail) and §4.4 (mobile sheet), which
   declare the rest and selected states identically:

   rest      `background:transparent;color:var(--text-muted);
              border:1px solid var(--border-strong)`
   selected  `background:var(--text);color:var(--on-accent);
              border:1px solid var(--text)`

   hover is NOT drawn — results.md §2.4 ends "No hover rules exist on any rail
   control", and results.md §6 #27 records that the three export files contain
   no `:focus`, `:hover`-on-rail or `:active` rule for filters at all. So the
   hover row is DESIGN.md §4's ("border → --text-dim, text → --text"), authored
   under DEVIATIONS #9. Tailwind v4's `hover:` compiles to
   `@media (hover: hover) { &:hover }` (verified in tailwindcss@4.3.3), the
   project's ratified touch guard (DEVIATIONS #10).

   No transition: chips are controls, and controls in this system swap
   instantly (globals.css, "Buttons declare no transition at all"). */
export const chipRestClass =
  "border-border-strong bg-transparent text-ink-muted hover:border-ink-dim hover:text-ink";

export const chipSelectedClass = "border-ink bg-ink text-on-accent";

const restClass = chipRestClass;
const selectedClass = chipSelectedClass;

export type ChipProps = Omit<ComponentPropsWithoutRef<"button">, "children"> & {
  children: ReactNode;
  selected?: boolean;
  /** Facet count rendered after the name — DESIGN.md §4: "Counts follow the
   *  name in `--text-dim` (`Zeta 4`)." */
  count?: number;
  /** Renders a trailing `×`. The whole chip is then the remove control, so it
   *  stays one `<button>` and the mark is decorative. */
  removable?: boolean;
};

export function Chip({
  children,
  selected = false,
  count,
  removable = false,
  className,
  type = "button",
  ...rest
}: ChipProps) {
  return (
    <button
      aria-pressed={removable ? undefined : selected}
      {...rest}
      type={type}
      className={cx(
        chipBase,
        selected ? selectedClass : restClass,
        className,
      )}
    >
      {children}
      {count !== undefined && (
        /* Facet count type, measured: `font:400 13px/1 var(--font-body);
           color:var(--text-dim);font-variant-numeric:tabular-nums`
           (results.md §2.4). On a selected chip the fill is `--text`, where
           `--text-dim` lands at ~2.9:1 — below the 4.5:1 floor in
           docs/decisions.md §9 — so the count inherits the chip's own
           `--on-accent` there. A state the artboards never draw (they carry
           counts on facet rows, never inside a chip), built from existing
           tokens per .claude/rules/ui.md. */
        <span
          className={cx(
            "text-13 font-normal tabular-nums",
            !selected && "text-ink-dim",
          )}
        >
          {count}
        </span>
      )}
      {removable && (
        <span aria-hidden="true" className="leading-flat">
          &times;
        </span>
      )}
    </button>
  );
}

/* ---------------------------------------------------------------------------
   ChipCheckbox — the same chip box as a real `<input type="checkbox">`

   The `/results` Season group has to submit without JS (D44), so each chip is a
   native checkbox in the filter `<form method="get">` rather than a `<button>`.
   The box, type and both state recipes are the ones above — `chipBox`,
   `chipRestClass`, `chipSelectedClass` — reused, not re-measured. The selected
   and focus recipes are repeated once in their `has-*` spelling because
   Tailwind scans source text: a prefix composed at runtime would generate no
   CSS.

   The variant is `has-*`, NOT `peer-*`: the checkbox is a CHILD of the label it
   styles, and `peer-checked:` compiles to a sibling combinator
   (`:is(:where(.peer):checked ~ *)`), which a parent can never match. `has-`
   compiles to `&:has(*:is(:checked))` and is the only form that reaches the
   label from its own input.

   `has-checked:hover:*` restates the selected fill for hover devices so the
   rest-state hover cannot win on a checked chip: the two-condition selector
   outranks the single `hover:` regardless of emission order.

   No count is rendered. The artboards draw the Season chips bare — counts live
   on the Category and Brand rows (design/inventory/results.md §2.4 group 3,
   §4.4 group 3) — so `Chip`'s `count` prop has no twin here (D42).
   --------------------------------------------------------------------------- */

export interface ChipCheckboxProps {
  /** Query-string param this chip contributes to — `RESULTS_PARAM.season`. */
  name: string;
  value: string;
  /** Wired straight from the facet; the URL is the state (D44). */
  defaultChecked?: boolean;
  /** Points the group's `<form>` at the control; also the refocus handle. */
  id: string;
  children: ReactNode;
  /**
   * `auto` is the primitive's own responsive pair — 44px, stepping to 40px at
   * `sm:` (the desktop rail's `height:40px`, results-desktop.html:135).
   * `touch` pins 44px at every width, which the mobile filter sheet needs:
   * the sheet is in use to 1099px (D46) and its chips are drawn at 44px
   * (results-mobile-filters.html:79), so `sm:h-10` would shrink them through
   * the whole 720–1099 band.
   */
  size?: "touch" | "auto";
  className?: string;
  /** Parity-probe hook for the chip box. */
  "data-probe"?: string;
}

export function ChipCheckbox({
  name,
  value,
  defaultChecked = false,
  id,
  children,
  size = "auto",
  className,
  "data-probe": dataProbe,
}: ChipCheckboxProps) {
  return (
    <label
      htmlFor={id}
      data-probe={dataProbe}
      className={cx(
        chipBox,
        size === "auto" && "sm:h-10",
        "relative cursor-pointer",
        chipRestClass,
        /* The `has-checked:` spelling of `chipSelectedClass`. */
        "has-checked:border-ink has-checked:bg-ink has-checked:text-on-accent",
        "has-checked:hover:border-ink has-checked:hover:text-on-accent",
        /* The `has-focus-visible:` spelling of the `Chip` focus ring —
           2px --accent, offset 0 (globals.css `:focus-visible`). */
        "has-focus-visible:outline-2 has-focus-visible:outline-accent has-focus-visible:outline-offset-0",
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="sr-only"
      />
      {children}
    </label>
  );
}
