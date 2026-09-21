import type { ComponentPropsWithRef } from "react";

/**
 * The text field box, and the shared recipe every other boxed control reuses.
 *
 * Canonical box measured from the vehicle finder, which is the one place the
 * artboards draw the box DESIGN.md §4 "Input" specifies — the two agree exactly:
 *   home-desktop.html:130 — `height:56px; background:var(--surface-2);
 *     border:1px solid var(--border-strong); border-radius:var(--radius-ctl);
 *     padding:0 16px` with the value at `font:700 17px/1 var(--font-body);
 *     color:var(--text)`
 *   home-mobile.html:102  — `height:52px; padding:0 14px`, value `font:700 16px/1`
 *
 * The quote band draws the same control with a local override — fill `--bg`
 * (it sits inside a `--surface-2` band) and values at `400 16px/1`
 * (product-desktop.html:140, product-mobile.html:111). That is the band's
 * inversion of the system box, not a second system box, so the finder + §4
 * values ship and the band can override the fill where it needs to.
 */

/** 56px desktop (56/52 responsive) vs the 48px DESIGN.md §4 calls for in compact panels. */
export type FieldDensity = "default" | "compact";

export interface FieldBoxOptions {
  density?: FieldDensity;
  /** Error state: border swaps to `--accent`. The helper copy is NOT coloured. */
  invalid?: boolean;
  className?: string;
}

/**
 * Classes shared by `Input` and `Select` so "same box as Input" is literally the
 * same string rather than two copies that drift.
 */
export function fieldBoxClasses({
  density = "default",
  invalid = false,
  className,
}: FieldBoxOptions = {}): string {
  return [
    // Fill + hairline + radius: home-desktop.html:130
    //   background:var(--surface-2); border:1px solid var(--border-strong);
    //   border-radius:var(--radius-ctl)  (--radius-ctl = 2px)
    "bg-surface-2 rounded-ctl border",

    // Error: border -> --accent (DESIGN.md §4 Input; the artboards use the same
    // accent border for the focused Email field, product-desktop.html:141).
    // Hover: border -> --text-dim (DESIGN.md §4 Input). `enabled:` keeps hover
    // off a disabled control regardless of how Tailwind orders the variants.
    invalid
      ? "border-accent"
      : "border-border-control enabled:hover:border-ink-dim",

    // Height: 52px home-mobile.html:102 / 56px home-desktop.html:130.
    // Compact 48px is DESIGN.md §4 ("48px in compact panels"); no artboard draws
    // a compact panel, so there is no measurement to contradict it.
    // Both clear the 44px tap-target floor (docs/decisions.md §5).
    density === "compact" ? "h-12" : "h-13 sm:h-14",

    // Inline padding: 14px home-mobile.html:102 / 16px home-desktop.html:130
    "px-3.5 sm:px-4",

    // Value type: Barlow 700, 16px mobile (home-mobile.html:102 `700 16px/1`),
    // 17px desktop (home-desktop.html:130 `700 17px/1`), colour --text.
    // Form controls do not inherit body font, hence the explicit `font-sans`.
    // Both sizes are >=16px, so iOS does not zoom the viewport on focus
    // (docs/decisions.md §5).
    "font-sans text-16 leading-flat font-bold text-ink sm:text-17",

    // Placeholder --text-dim: DESIGN.md §4 Input; product-desktop.html:142 draws
    // the Phone field's placeholder at `color:var(--text-dim)`.
    "placeholder:text-ink-dim",

    // Focus: border -> accent plus a 2px accent ring at offset 0, 0ms.
    // DESIGN.md §4 Input and globals.css `:focus-visible`. The artboards draw
    // `outline-offset:-1px` (product-desktop.html:141); DESIGN.md §4, the
    // decisions.md §1 authority for focus, and globals.css all say 0 — 0 ships.
    // No transition is declared anywhere on a control, so the swap is instant.
    "focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-0",

    // Disabled: DESIGN.md §4 Button disabled row (fill --surface, border
    // --border, text --text-dim); globals.css documents --text-dim as the
    // disabled ink. The artboards draw no disabled control.
    "disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-ink-dim",

    "w-full touch-manipulation",

    className,
  ]
    .filter(Boolean)
    .join(" ");
}

type InputTypeDefaults = {
  inputMode?: ComponentPropsWithRef<"input">["inputMode"];
  autoComplete?: ComponentPropsWithRef<"input">["autoComplete"];
  /** D66: nothing in the build set `spellCheck`, so the UA spellchecker was
   *  red-underlining every address, number and URL typed into these fields. */
  spellCheck?: ComponentPropsWithRef<"input">["spellCheck"];
};

/**
 * Mobile keyboard and autofill defaults per input type (docs/decisions.md §5:
 * "`inputmode` and `autocomplete` set"). Applied before the prop spread, so any
 * caller value wins — a `type="text"` field carrying a name still gets
 * `autoComplete="name"` from the caller.
 */
const INPUT_TYPE_DEFAULTS: Partial<Record<string, InputTypeDefaults>> = {
  email: { inputMode: "email", autoComplete: "email", spellCheck: false },
  tel: { inputMode: "tel", autoComplete: "tel", spellCheck: false },
  url: { inputMode: "url", autoComplete: "url", spellCheck: false },
  search: { inputMode: "search" },
  number: { inputMode: "numeric" },
};

export interface InputProps extends ComponentPropsWithRef<"input"> {
  /** Required so a `FieldLabel htmlFor` always has something to point at. */
  id: string;
  density?: FieldDensity;
  /**
   * Error state. Swaps the border to `--accent` and sets `aria-invalid`.
   * Pair with `aria-describedby` and a `FieldError` for the 13px helper line.
   */
  invalid?: boolean;
}

export function Input({
  id,
  type = "text",
  density = "default",
  invalid = false,
  className,
  ...rest
}: InputProps) {
  const typeDefaults = INPUT_TYPE_DEFAULTS[type] ?? {};

  return (
    <input
      id={id}
      type={type}
      className={fieldBoxClasses({ density, invalid, className })}
      aria-invalid={invalid ? true : undefined}
      inputMode={typeDefaults.inputMode}
      autoComplete={typeDefaults.autoComplete}
      spellCheck={typeDefaults.spellCheck}
      {...rest}
    />
  );
}

export interface TextareaProps extends ComponentPropsWithRef<"textarea"> {
  id: string;
  invalid?: boolean;
}

/**
 * The quote form's Message field.
 *   product-desktop.html:150 — `height:120px; padding:16px; font:400 16px/1.5`
 *   product-mobile.html:120  — `height:100px; padding:14px; font:400 15px/1.5`
 *
 * One deliberate deviation: the mobile size is raised 15px -> 16px. Below 16px
 * iOS zooms the viewport on focus, and docs/decisions.md §5 / .claude/rules/ui.md
 * both require >=16px on inputs. decisions.md is authority level 1 on how a thing
 * is built, so the floor wins over the measured 15px. Logged for DEVIATIONS.md.
 */
export function Textarea({ id, invalid = false, className, ...rest }: TextareaProps) {
  return (
    <textarea
      id={id}
      className={[
        // Same fill, hairline and radius as the boxed controls above.
        "bg-surface-2 rounded-ctl border",
        invalid
          ? "border-accent"
          : "border-border-control enabled:hover:border-ink-dim",
        // 100px mobile (product-mobile.html:120) / 120px desktop (product-desktop.html:150)
        "h-25 sm:h-30",
        // 14px mobile / 16px desktop padding, same two files
        "p-3.5 sm:p-4",
        // Barlow 400 / 1.5 — multi-line prose, not a 700 value line.
        // 16px at every width (see the deviation note above).
        "font-sans text-16 leading-body font-normal text-ink",
        "placeholder:text-ink-dim",
        "focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-0",
        "disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-ink-dim",
        // resize-y is not in the artboards (they are static divs); it keeps a
        // drag-resize from breaking the field grid horizontally.
        "w-full resize-y touch-manipulation",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-invalid={invalid ? true : undefined}
      {...rest}
    />
  );
}
