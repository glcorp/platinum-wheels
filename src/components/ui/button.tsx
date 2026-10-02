import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

import { cx } from "@/lib/cx";

/* ---------------------------------------------------------------------------
   Button — primary / secondary (ghost) / tertiary (text)

   Sizes are named by ROLE, not by pixel height, because every height in the
   artboards is a responsive pair. Where DESIGN.md §4 and the exports disagree
   on a number the export wins (docs/decisions.md §1) — that applies to the
   heights, the type sizes and the tracking, all logged in DEVIATIONS #6.

   The single breakpoint is 720px (`sm:`), which is DESIGN.md §8's only button
   crossover: "Buttons | Desktop ≥1100: 48px, inline | Tablet 720–1099: 48px |
   Mobile <720: 44px, full width in panels". Breakpoint crossovers come from
   DESIGN.md §8 and nowhere else (docs/decisions.md §1) — the exports are fixed
   snapshots at 1440 and 390 and contain zero `@media` rules.
   --------------------------------------------------------------------------- */

/**
 * `accent` is the fourth, artboard-only variant: a 1px `--accent` outline with
 * `--on-photo` ink that fills lime on hover. Drawn once per page as the header
 * phone CTA (`home-desktop.html:109` `.x1`, `results-desktop.html:102` `.x58`,
 * `product-desktop.html:93` `.x112`), always at `compact` size. DESIGN.md §4
 * has no row for it, so active / disabled / focus are authored: active keeps
 * the fill and, since D92b, sinks 1px like every other boxed control (it was
 * "no lift — a link, not a pressed button" until the owner ruled for one
 * consistent press vocabulary), disabled goes to the
 * `--border` outline + `--text-dim` ink like `secondary`, and focus uses the
 * `--text` ring because an accent ring on an accent border is invisible.
 */
type ButtonVariant = "primary" | "secondary" | "tertiary" | "accent";

/**
 * `panel`   the quote-panel / full-width CTA — the biggest control on a page.
 * `card`    the CTA inside a product card, and the default.
 * `compact` a 44px control that never grows: header phone CTA, filter Apply.
 */
type ButtonSize = "panel" | "card" | "compact" | "promo" | "load";

/* `promo`  the home page's 52px → 56px CTAs: the finder submit
 *          (home.md:161 `height:56px`, :164 `height:52px`) and the winter
 *          promo CTA (home.md:205 `height:56px; padding:0 28px`, :208
 *          `height:52px; padding:0 24px`). Type is 14px at both widths, +0.08em.
 *          Added rather than overriding `panel` from a call site: same-specificity
 *          utilities resolve by Tailwind's emission order, not className order,
 *          so an override of `h-14` with `h-13` is not reliable. */

/* Box + type per size. Every value below is measured, with its source:

   panel   60px: product.md §5.3 "60px — desktop buy-panel CTAs `height:60px`;
                 desktop `Send inquiry` `height:60px`"
           56px: product.md §5.3 "56px — mobile buy-panel CTAs `height:56px`"
           type: product.md §3.5 `font:500 15px/1` desktop, `500 14px/1` mobile,
                 `letter-spacing:.08em`, `text-transform:uppercase`
           pad:  `padding:0 40px` on desktop `Send inquiry` (product.md §5.3) and
                 on Load more (results.md §2.6). The stretched buy-panel CTA
                 declares none — with `fullWidth` the padding is inert.
   card    48px: results.md §3.6 Primary "height:48px;font:500 13px/1" (desktop)
           44px: results.md §3.6 Primary "height:44px;font:500 12px/1" (mobile)
           type: `letter-spacing:.04em` (results.md §3.6, both widths)
           pad:  `padding:0 20px` (results.md §3.6, both widths)
   compact 44px: product.md §5.3 "44px — desktop header phone CTA `height:44px`";
                 results.md §2.4 tire-size `Apply` `height:44px`
           type: `font:500 13px/1`, `letter-spacing:.08em` (results.md §2.4 Apply,
                 product.md T28 header phone CTA)
           pad:  phone pill `padding:0 20px` (results.md §5.3)
           Stays 44px at every width — it is already the touch-target floor
           (docs/decisions.md §5), so there is nothing to step up to. */
/* Icon gap lives with the size, not the base: `gap:12px` desktop / `10px`
   mobile on the buy-panel `Call us` (product.md §3.5), `12px` on the finder
   CTA at both widths (home.md:161), `10px` on the 44px header phone CTA at
   both widths (home.md:140). */
/* `load`  the `/tires` `Load more` link: 52px mobile -> 56px desktop, 14px
 *         type at +0.08em uppercase, and — the reason it is its own size —
 *         NO horizontal padding below `md:`, because the mobile artboard
 *         stretches it edge to edge (`design/inventory/results.md` §2.6:
 *         D `height:56px;padding:0 40px`, M `height:52px;margin-top:12px`,
 *         no padding, full width). `promo` matches the heights and the type
 *         but carries `px-6 sm:px-7`, and overriding padding from a call site
 *         is not reliable — same-specificity utilities resolve by Tailwind's
 *         emission order, not className order (HANDOFF §A8.4). Pair it with
 *         `fullWidth` + `className="md:w-auto"`, which IS reliable: a `md:`
 *         variant always sorts after the unvariant `w-full`. */
const sizeBox: Record<ButtonSize, string> = {
  panel: "h-14 sm:h-15 text-14 sm:text-15 tracking-8 gap-2.5 sm:gap-3",
  card: "h-11 sm:h-12 text-12 sm:text-13 tracking-4 gap-2.5 sm:gap-3",
  compact: "h-11 text-13 tracking-8 gap-2.5",
  promo: "h-13 sm:h-14 text-14 tracking-8 gap-3",
  load: "h-13 sm:h-14 text-14 tracking-8 gap-2.5",
};

const sizePad: Record<ButtonSize, string> = {
  panel: "px-10",
  card: "px-5",
  compact: "px-5",
  promo: "px-6 sm:px-7",
  load: "md:px-10",
};

/* Variant table — DESIGN.md §4 "Button". The exports contain no `:focus`,
   `:active` or `:disabled` rule at all (product.md §6, results.md §6 #27), so
   those three rows are authored from §4 and logged as DEVIATIONS #9. Only the
   hover row is drawn, and both sources agree on it.

   | | Primary | Secondary (ghost) | Tertiary (text) |
   | Fill     | --accent            | transparent        | transparent |
   | Border   | none                | 1px --text         | none        |
   | Text     | --on-accent         | --text             | --text      |
   | Hover    | --accent-hover      | --text fill,       | underline 1px |
   |          |                     | --on-accent text   |             |
   | Active   | --accent, +1px y    | --text-muted fill, | opacity .7  |
   |          |                     | +1px y (D92b)       |             |
   | Disabled | --surface fill,     | --border border,   | --text-dim  |
   |          | --text-dim text     | --text-dim text    |             |

   Press vocabulary (D92b, owner ruling "Expressive", 2026-09-29): every
   variant with a fill or a border sinks 1px on `:active` — primary,
   secondary and accent alike — and the text variant dims to .7. Tailwind's
   `active:` is not hover-gated, which is exactly what a touch press needs.
   `disabled:translate-y-0` sits beside each, as it always has on primary, so
   a disabled button never moves.

   No `transition-*` class here, still — but no longer because hover is
   instant. product.md/results.md §5 measure zero transition declarations on
   any button (the 30 in the exports all belong to card hover), and the drawn
   rule was an instant fill swap. D92b replaces that: the globals.css base layer
   eases colour, fill, border, opacity and translate on every `button` and `a`
   over `--duration-feedback` (120ms), so the drawn hover colours below are
   reached in 120ms instead of one frame, and the 1px press glides. Recorded
   as DEVIATIONS #75. Adding a transition class here would only fight that
   one rule.

   Hover is written with Tailwind's `hover:` variant, which in v4 compiles to
   `@media (hover: hover) { &:hover }` (verified in tailwindcss@4.3.3), so it
   cannot stick after a tap. That is the project's ratified pattern —
   DEVIATIONS #10, "Hover styles scoped to `@media (hover: hover)`".

   Focus is `2px --accent`, no offset (DESIGN.md §4), except on primary where
   accent-on-accent is invisible and §4 calls for a white ring — `--text`
   #F4F4F5, since nothing in Track Night is pure white (results.md §6 #6). */
const variantClass: Record<ButtonVariant, string> = {
  primary: [
    "bg-accent text-on-accent",
    "hover:bg-accent-hover",
    "active:translate-y-px active:bg-accent",
    "disabled:translate-y-0 disabled:bg-surface disabled:text-ink-dim",
    "focus-visible:outline-ink",
  ].join(" "),
  secondary: [
    "border border-ink bg-transparent text-ink",
    "hover:bg-ink hover:text-on-accent",
    "active:translate-y-px active:bg-ink-muted active:text-on-accent",
    "disabled:translate-y-0 disabled:border-border disabled:bg-transparent disabled:text-ink-dim",
    "focus-visible:outline-accent",
  ].join(" "),
  tertiary: [
    "bg-transparent text-ink",
    /* `underline-offset-4` is the exports' own text-link offset —
       `text-underline-offset:4px` on `Clear all` (results.md §2.4, §4.3). */
    "hover:underline hover:decoration-1 hover:underline-offset-4",
    "active:opacity-70",
    "disabled:text-ink-dim disabled:no-underline",
    "focus-visible:outline-accent",
  ].join(" "),
  accent: [
    /* `border:1px solid var(--accent); color:var(--on-photo)`; hover
       `background:var(--accent); color:var(--on-accent)` — home-desktop.html:109
       and its `.x1` rule at :49. `white-space:nowrap` is on the artboard element. */
    "border border-accent bg-transparent text-on-photo whitespace-nowrap",
    "hover:bg-accent hover:text-on-accent",
    "active:translate-y-px active:bg-accent active:text-on-accent",
    "disabled:translate-y-0 disabled:border-border disabled:bg-transparent disabled:text-ink-dim",
    "focus-visible:outline-ink",
  ].join(" "),
};

/* Barlow 500 / uppercase / line-height 1 is the shared `label` role utility in
   globals.css. `gap-2.5 sm:gap-3` is the icon gap on the `Call us` secondary
   CTA — `gap:12px` desktop, `10px` mobile (product.md §3.5). `min-w-0` and
   `text-center` are declared on the card CTA (results.md §3.6). `rounded-ctl`
   is `--radius-ctl` 2px, the only radius any control takes (product.md §5.4).
   `touch-manipulation` per docs/decisions.md §5. */
const buttonBase =
  "label inline-flex min-w-0 items-center justify-center rounded-ctl text-center no-underline touch-manipulation focus-visible:outline-2 focus-visible:outline-offset-0";

function buttonClasses(
  variant: ButtonVariant,
  size: ButtonSize,
  fullWidth: boolean,
  className: string | undefined,
): string {
  return cx(
    buttonBase,
    sizeBox[size],
    /* A text button carries no box, so it keeps the flush-left edge its
       column shares (.claude/rules/ui.md, "Flush-left"). */
    variant !== "tertiary" && sizePad[size],
    variantClass[variant],
    fullWidth && "w-full",
    className,
  );
}

type ButtonOwnProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** DESIGN.md §8, mobile: "44px, full width in panels". */
  fullWidth?: boolean;
};

type NativeButtonProps = ButtonOwnProps &
  ComponentPropsWithoutRef<"button"> & { href?: never };

/** With an `href` this renders `next/link` (docs/decisions.md §4). A link is
 *  never disabled — pass no `href` and use `disabled` for that. */
type LinkButtonProps = ButtonOwnProps & ComponentPropsWithoutRef<typeof Link>;

export type ButtonProps = NativeButtonProps | LinkButtonProps;

export function Button(props: ButtonProps) {
  if (props.href !== undefined) {
    const {
      variant = "primary",
      size = "card",
      fullWidth = false,
      className,
      href,
      ...anchorProps
    } = props;

    return (
      <Link
        {...anchorProps}
        href={href}
        className={buttonClasses(variant, size, fullWidth, className)}
      />
    );
  }

  const {
    variant = "primary",
    size = "card",
    fullWidth = false,
    className,
    type = "button",
    ...buttonProps
  } = props;

  return (
    <button
      {...buttonProps}
      type={type}
      className={buttonClasses(variant, size, fullWidth, className)}
    />
  );
}
