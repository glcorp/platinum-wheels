import type { ComponentPropsWithRef, ReactNode } from "react";
import { fieldBoxClasses, type FieldDensity } from "@/components/ui/input";
import { join } from "@/lib/cx";

/**
 * A real native `<select>` wearing the artboard box.
 *
 * docs/decisions.md §5 is a hard rule: "Year / Make / Model use native
 * `<select>` styled to match the design, never a custom combobox." The finder is
 * the site's front door on mobile, and the OS picker beats anything we could
 * build: it needs no JS, so this stays a Server Component, and it gets the
 * platform's own scrolling, search and assistive-tech behaviour for free.
 *
 * The exports render these controls as static `<div>`s (home-desktop.html:130
 * "These are **not** `<select>` elements — they are static divs") because an
 * artboard is a snapshot. The box they draw is the spec; the element is ours.
 */

export interface SelectProps extends ComponentPropsWithRef<"select"> {
  /** Required so a `FieldLabel htmlFor` always has something to point at. */
  id: string;
  density?: FieldDensity;
  /** Error state: border swaps to `--accent` and `aria-invalid` is set. */
  invalid?: boolean;
  /**
   * Classes for the positioning wrapper that carries the chevron.
   * `className` goes to the `<select>` itself.
   */
  wrapperClassName?: string;
  children: ReactNode;
}

export function Select({
  id,
  density = "default",
  invalid = false,
  className,
  wrapperClassName,
  children,
  ...rest
}: SelectProps) {
  return (
    <span className={join("relative block w-full", wrapperClassName)}>
      <select
        id={id}
        className={fieldBoxClasses({
          density,
          invalid,
          className: join(
            [
              // No native arrow (DESIGN.md §4 Input: "Selects use the same box
              // with a 16px chevron (1.6 stroke) in --text-muted; no native
              // arrow"). appearance-none also drops the UA's own fill, which is
              // why the box recipe sets bg-surface-2 explicitly.
              "appearance-none cursor-pointer",
              // Room for the chevron: 14px inset + 16px icon + 6px clearance on
              // mobile, 16px + 16px + 8px on desktop. The insets and clearances
              // are the finder's own (home-mobile.html:102 `padding:0 14px`,
              // home-desktop.html:130 `padding:0 16px`, group gaps 6px/8px).
              "pr-9 sm:pr-10",
            ].join(" "),
            className,
          ),
        })}
        aria-invalid={invalid ? true : undefined}
        // No `inputMode` — a select has no soft keyboard. `autoComplete` is left
        // undefined rather than defaulted to "off": Year/Make/Model have no
        // standard token, but an address or country select does, and defaulting
        // to "off" would suppress a legitimate autofill. Callers set it.
        {...rest}
      >
        {children}
      </select>
      {/* Chevron copied from home-desktop.html:130 / product-desktop.html:148:
          `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="var(--text-muted)" stroke-width="1.6">
            <path d="M6 9l6 6 6-6">`
          The 1.6 stroke is an SVG attribute, not a length utility, so it needs
          no token and is not an arbitrary value. The colour comes from the
          --text-muted token via `stroke-ink-muted`, and 16px from `h-4 w-4`. */}
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth={1.6}
        // right: 14px mobile / 16px desktop — the field's own inline padding, so
        // the chevron's right edge lands exactly where the artboard's does.
        className="pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 stroke-ink-muted sm:right-4"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </span>
  );
}
