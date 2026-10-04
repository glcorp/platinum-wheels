import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

/**
 * SectionHeading — the `01 — Shop by category` pattern.
 *
 * A numbered eyebrow label above a display-scale title, flush-left (ui.md
 * "Flush-left"), with an optional trailing link or action on the same row.
 * Measured from home-desktop.html:187 (`03 — Featured tires`), whose header row
 * is `display:flex; align-items:flex-end; justify-content:space-between` with a
 * left column stack and a right cluster, and from home-mobile.html:135 for the
 * mobile deltas.
 *
 * Note: home-desktop.html:149 (`01 — Shop by category`) puts the eyebrow and the
 * `<h2>` at opposite ends of the same space-between row rather than stacked. That
 * is the odd one out — the other three home sections (`02`, `03`, `04`) and the
 * ui.md flush-left rule all stack eyebrow above title, so that is the pattern
 * built here.
 *
 * Display type is always the `display` utility plus a `text-display-*` token,
 * never a bare pixel size (DESIGN.md §3: headline sizes are written as
 * `calc(56px * var(--scale-h2))`, never as bare pixels).
 *
 * The mobile→desktop crossover is `sm:` (720px) per DESIGN.md §8; the artboards
 * carry no `@media` rules (docs/decisions.md §5).
 */

type HeadingLevel = "h1" | "h2" | "h3";

export interface SectionHeadingProps {
  /** Eyebrow copy without its number, e.g. `Shop by category`. */
  eyebrow: string;
  /** Section number. Rendered zero-padded and em-dashed: `01 — Shop by category`. */
  index?: number;
  /** Display-scale title, e.g. `Tires, wheels and accessories.` */
  title: string;
  /** Heading element. `h2` by default so a page keeps one `h1`. */
  as?: HeadingLevel;
  /** Optional trailing link or control, right-aligned on the same row. */
  action?: ReactNode;
  className?: string;
}

/* Display size per heading level — every value measured, every value a
   `text-display-*` token so it resolves to calc(<n>px * var(--scale-*)).
   h1  56 → 88   product-mobile.html:94 / product-desktop.html:109 (PDP title)
   h2  40 → 56   home-mobile.html:110 / home-desktop.html:149,187,348
   h3  32 → 40   product-mobile.html:102 / product-desktop.html:126 (Specifications) */
const TITLE_SIZE: Record<HeadingLevel, string> = {
  h1: "text-display-56 sm:text-display-88",
  h2: "text-display-40 sm:text-display-56",
  h3: "text-display-32 sm:text-display-40",
};

export function SectionHeading({
  eyebrow,
  index,
  title,
  as = "h2",
  action,
  className,
}: SectionHeadingProps) {
  const Heading = as;
  /* `01 · Shop by category`: two-digit number, then a middle dot. The
     artboard draws an em dash here (home-desktop.html:149); D140 bans it from
     visible copy. Only /styleguide passes an index (D94b dropped the home
     numbers). */
  const eyebrowCopy =
    index === undefined
      ? eyebrow
      : `${String(index).padStart(2, "0")} · ${eyebrow}`;

  return (
    <div
      /* Header row: `align-items:flex-end; justify-content:space-between`
         (home-desktop.html:187); 16px row gap (home-mobile.html:135). */
      className={cx(
        "flex w-full items-end justify-between gap-4",
        className,
      )}
    >
      {/* Left stack: 12px mobile (home-mobile.html:135) → 16px desktop
          (home-desktop.html:187). */}
      <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
        {/* Eyebrow: Barlow 500, 11px mobile → 12px desktop, +0.14em, uppercase,
            --text-dim (home-mobile.html:110 / home-desktop.html:149). The
            `label` utility carries the family, weight 500, line-height 1 and the
            uppercase transform; the tracking stays explicit. */}
        <span className="label text-ink-dim text-11 tracking-14 sm:text-12">
          {eyebrowCopy}
        </span>
        {/* Title: `display` utility (Barlow Condensed 700, 0.92, -0.015em,
            uppercase) plus the level's display token. `text-ink` is explicit
            because globals.css sets `body { color: var(--text-muted) }`, unlike
            the artboards' `color: var(--text)` on the page root. */}
        <Heading className={cx("display text-ink", TITLE_SIZE[as])}>
          {title}
        </Heading>
      </div>
      {action === undefined ? null : (
        /* Right cluster: 8px gap (home-desktop.html:187 prev/next pair). */
        <div className="flex shrink-0 items-center gap-2">{action}</div>
      )}
    </div>
  );
}
