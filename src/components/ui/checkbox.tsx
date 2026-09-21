import type { ComponentPropsWithRef, ReactNode } from "react";

import { join } from "@/lib/cx";

/**
 * A real native `<input type="checkbox">` with the label beside it.
 *
 * Box measured from the quote band's CASL consent row
 * (product-desktop.html:151, product-mobile.html:121):
 *   `<label style="display:flex;gap:12px;align-items:flex-start">`
 *   box  `width:20px; height:20px; border:1px solid var(--text-dim);
 *         border-radius:var(--radius-ctl); flex:none; margin-top:1px`
 *   copy `font:400 14px/1.5` desktop / `font:400 13px/1.5` mobile,
 *        colour `--text-muted`
 *
 * Checked state comes from the only checked checkbox drawn in any export, the
 * results filter rail (results-desktop.html:141): `border:1px solid var(--text);
 * background:var(--text)` with a 12px tick
 * `stroke="var(--on-accent)" stroke-width="3"`, `path d="M5 12l5 5L20 7"`.
 * (That facet box is 18px; the consent box this primitive is built for is 20px.)
 *
 * The component never sets `checked` or `defaultChecked`, so it renders unticked
 * — which is what docs/decisions.md §7 requires of the CASL consent box. Keeping
 * it uncontrolled also keeps it a Server Component: no JS is involved.
 */

/**
 * `consent` is this primitive's original and only drawn shape: the CASL row's
 * 20px box with its own 13/14px muted copy and a 44px min row.
 *
 * `facet` is the `/results` filter row, which the same three exports draw at a
 * different size: an **18px** box (`width:18px;height:18px`,
 * results-desktop.html:141 / results-mobile-filters.html:80) beside copy the
 * caller supplies — the rail's `name flex:1` + 13px tabular count, or the
 * sheet's un-flexed name + 12px non-tabular count (results.md §4.4). Row height
 * and the box→copy gap differ between rail (40px / 12px) and sheet (44px /
 * 10px), so `facet` carries neither: they arrive on `labelClassName`.
 */
export type CheckboxVariant = "consent" | "facet";

export interface CheckboxProps
  extends Omit<ComponentPropsWithRef<"input">, "type" | "children"> {
  /** Required: the wrapping label points `htmlFor` at it. */
  id: string;
  /** Label copy beside the box. */
  children: ReactNode;
  /** Classes for the label row. `className` goes to the `<input>` itself. */
  labelClassName?: string;
  /** Parity-probe hook for the ROW box; every other prop lands on the input. */
  labelProbe?: string;
  variant?: CheckboxVariant;
}

export function Checkbox({
  id,
  className,
  labelClassName,
  labelProbe,
  children,
  variant = "consent",
  ...rest
}: CheckboxProps) {
  const facet = variant === "facet";

  return (
    <label
      htmlFor={id}
      data-probe={labelProbe}
      className={join(
        facet
          ? // Row height and gap come from the caller — see CheckboxVariant.
            "flex cursor-pointer items-center"
          : [
              // gap:12px, align-items:flex-start — product-desktop.html:151
              "flex cursor-pointer items-start gap-3",
              // 44px floor so the tap target clears docs/decisions.md §5. The
              // artboard row has no min-height; the shipped consent copy wraps well
              // past 44px, so this only ever engages for short labels.
              "min-h-11",
            ].join(" "),
        labelClassName,
      )}
    >
      {/* 20px box, offset 1px from the top of the copy (margin-top:1px).
          18px and vertically centred in the facet row (results.md §2.4 group 4). */}
      <span
        className={
          facet
            ? "relative block size-4.5 shrink-0"
            : "relative mt-px block h-5 w-5 shrink-0"
        }
      >
        <input
          id={id}
          className={join(
            [
              // 20px square (18px facet), 1px --text-dim hairline, --radius-ctl (2px)
              facet
                ? "peer block size-4.5 appearance-none rounded-ctl border border-ink-dim bg-transparent"
                : "peer block h-5 w-5 appearance-none rounded-ctl border border-ink-dim bg-transparent",
              // Checked: --text fill + --text border (results-desktop.html:141)
              "checked:border-ink checked:bg-ink",
              // Hover: hairline --text-dim -> --text. D66: the box had rest,
              // checked, focus and disabled recipes but no hover, so pointing at
              // it changed nothing. Same value the checked row already uses, so
              // a checked box hovers to the border it is already wearing.
              // `enabled:` keeps it off a disabled control; Tailwind v4's
              // `hover:` is already `@media (hover: hover)` (D17).
              "enabled:hover:border-ink",
              // Focus ring: 2px accent, offset 0 (DESIGN.md §4, globals.css)
              "focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-0",
              // Disabled: --border hairline, the quiet edge from DESIGN.md §4's
              // disabled row. No artboard draws a disabled checkbox.
              "disabled:cursor-not-allowed disabled:border-border",
              "cursor-pointer touch-manipulation",
            ].join(" "),
            className,
          )}
          {...rest}
          // After the spread: this control is a checkbox and nothing may change that.
          type="checkbox"
        />
        {/* 12px tick, stroke 3, --on-accent — results-desktop.html:141.
            `inset-0 m-auto` centres it in the 20px box; `peer-checked` reveals it. */}
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute inset-0 m-auto h-3 w-3 stroke-on-accent opacity-0 peer-checked:opacity-100"
        >
          <path d="M5 12l5 5L20 7" />
        </svg>
      </span>
      {/* Copy: Barlow 400, 13px mobile / 14px desktop, line-height 1.5, --text-muted.
          A facet row's copy is two spans with two different type recipes per
          variant (name + count, results.md §2.4 / §4.4), so the caller renders
          them and this primitive passes them through untouched. */}
      {facet ? (
        children
      ) : (
        <span className="text-13 leading-body text-ink-muted sm:text-14">
          {children}
        </span>
      )}
    </label>
  );
}
