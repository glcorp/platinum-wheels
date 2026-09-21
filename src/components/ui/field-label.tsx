import type { ComponentPropsWithRef, ReactNode } from "react";

/**
 * Field furniture: the label above a control, and the helper line below it.
 *
 * Measured from the vehicle finder, which is the only place the artboards draw
 * a label in the exact shape DESIGN.md §4 "Input" describes:
 *   home-desktop.html:130 — `font:500 11px/1 var(--font-body); letter-spacing:.12em;
 *                            text-transform:uppercase; color:var(--text-dim)`
 *   home-desktop.html:129 — field group `display:flex; flex-direction:column; gap:8px`
 *   home-mobile.html:102  — same type, group `gap:6px`
 *
 * The quote band draws a *second* label treatment (12px desktop / 11px mobile,
 * colour `--text` for required fields and `--text-muted` for optional ones,
 * product-desktop.html:140/147). That one is the quote form's local override,
 * not the system label; §4 and the finder agree, so the finder value ships.
 */

function join(base: string, extra?: string): string {
  return extra ? `${base} ${extra}` : base;
}

export interface FieldLabelProps extends ComponentPropsWithRef<"label"> {
  /**
   * `id` of the control this labels. Required, not optional: a label that is
   * not wired to a control is decoration.
   */
  htmlFor: string;
  /**
   * Appends the artboards' separately-tracked `Optional` word.
   * product-desktop.html:145 draws it as its own group heading at
   * `font:500 11px/1; letter-spacing:.14em; uppercase; color:var(--text-dim)` —
   * same size and colour as the field label, +0.14em instead of +0.12em, which
   * is why it is a span with its own tracking rather than plain label text.
   */
  optional?: boolean;
  /**
   * Appends the required marker `*` in `--accent`
   * (product-desktop.html:140 `<span style="color:var(--accent)">*</span>`).
   * Hidden from assistive tech — the control's own `required` announces it.
   */
  required?: boolean;
  children: ReactNode;
}

export function FieldLabel({
  htmlFor,
  optional = false,
  required = false,
  className,
  children,
  ...rest
}: FieldLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={join(
        [
          // `label` = Barlow 500, line-height 1, uppercase (globals.css @utility)
          "label block",
          // 11px: home-desktop.html:130 finder label / product-mobile.html:111 quote label
          "text-11",
          // +0.12em: home-desktop.html:130 `letter-spacing:.12em`
          "tracking-12",
          // --text-dim: home-desktop.html:130 `color:var(--text-dim)`
          "text-ink-dim",
          // label -> field gap: 6px home-mobile.html:102, 8px home-desktop.html:129
          "mb-1.5 sm:mb-2",
        ].join(" "),
        className,
      )}
      {...rest}
    >
      {children}
      {required ? (
        <span aria-hidden="true" className="text-accent">
          {" *"}
        </span>
      ) : null}
      {/* Separated by a literal space: the artboards never draw `Optional` as an
          affix, so there is no measured gap to copy and none is invented. */}
      {optional ? <span className="tracking-14">{" Optional"}</span> : null}
    </label>
  );
}

export interface FieldErrorProps extends ComponentPropsWithRef<"p"> {
  /** Point the control's `aria-describedby` at this id. */
  id: string;
  children: ReactNode;
}

/**
 * The helper line under a field in its error state. DESIGN.md §4 "Input":
 * "Error: border `--accent`, helper text 13px `--text-muted` — the border is the
 * one accent, so error copy is not coloured." The artboards draw no error state,
 * so the size and colour come from §4 and the spacing mirrors the label's own
 * 6px/8px rhythm.
 */
export function FieldError({ id, className, children, ...rest }: FieldErrorProps) {
  return (
    <p
      id={id}
      className={join(
        // 13px / --text-muted: DESIGN.md §4 Input, error row. Never accent-coloured.
        "text-13 leading-body text-ink-muted mt-1.5 sm:mt-2",
        className,
      )}
      {...rest}
    >
      {children}
    </p>
  );
}
