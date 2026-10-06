import type { ComponentPropsWithoutRef } from "react";

import { cx } from "@/lib/cx";

/* ---------------------------------------------------------------------------
   Badge — the four season fills / accent / outline / unavailable

   Not interactive, so no hover, focus or tap-target rule applies. Radius is 0:
   `--radius-ctl` is for controls only and badges are explicitly excluded
   ("cards/images/badges stay 0", globals.css; product.md §5.4 lists badges
   under "radius 0 (none declared)"), so this file deliberately carries no
   `rounded-*` class.
   --------------------------------------------------------------------------- */

type BadgeVariant =
  | "winter"
  | "all-season"
  | "all-weather"
  | "summer"
  | "accent"
  | "outline"
  | "unavailable";

/* Shared box and type — identical across all three variants and across both
   artboards, and the one place DESIGN.md §4 "Badge" and the exports agree
   exactly (product.md §6: "Matches, except outline badges use line-height:22px").

   `height:24px; padding:0 10px; font:500 11px/… var(--font-body);
    letter-spacing:.1em; text-transform:uppercase`
   — results.md §3.3, product.md §3.1.

   Barlow 500 / uppercase comes from the `label` role utility in globals.css;
   the per-variant `leading-*` below overrides its line-height: 1.

   `gap-1.5` is 6px, the icon gap on the 3PMSF badge (product.md §3.1,
   "display:inline-flex;align-items:center;gap:6px"). It is inert on a
   text-only badge. */
const badgeBase =
  "label inline-flex h-6 items-center gap-1.5 px-2.5 text-11 tracking-10";

/* Variant table — results.md §3.3 (card badge row), product.md §3.1 (buy-panel
   badge row). Both artboards declare these byte-identically.

   The height is reached twice over, which is the measured subtlety worth
   keeping: the FILLED badge has no border and sets `line-height:24px`, while
   the OUTLINED badges set `line-height:22px` so 22 + 1px top + 1px bottom
   border is the same 24px box. With `box-sizing:border-box` (Tailwind
   preflight) `h-6` already fixes the outer box at 24px, but the leading tokens
   are what the artboards actually declare and what keeps a badge correct if it
   ever renders as a plain inline span — where `height` would be ignored and
   line-height alone would carry the 24px. */
const variantClass: Record<BadgeVariant, string> = {
  /* Seasons (owner, 2026-10-07; DEVIATIONS #125, #126). The drawn WINTER
     was a borderless `--accent` fill at `font:500 11px/24px`. Winter is now
     an aqua fill with a 1px darker edge, `--on-season` ink and a snowflake;
     the edge plus the outline leading (22 + 2) keeps the drawn 24px box.
     All-Season, Summer and All-Weather share one faint lime look: the 12%
     `--accent-subtle` fill, `--text` ink (about 15:1) and their mark in lime
     (`SEASON_MARK_TINT`), no border, so the fill's own 24px leading holds
     the box ("very translucent … just keep it with a touch of lime"). */
  winter: "bg-winter border border-winter-edge leading-badge-outline text-on-season",
  "all-season": "bg-accent-subtle leading-badge text-ink",
  summer: "bg-accent-subtle leading-badge text-ink",
  "all-weather": "bg-accent-subtle leading-badge text-ink",

  /* The drawn filled badge, lime, with no mark. Kept for a non-season fill;
     no season uses it since each has its own (2026-10-07). */
  accent: "bg-accent leading-badge text-on-accent",

  /* ALL-SEASON / SUMMER / OEM / STUDDABLE / M+S / 3PMSF —
     `border:1px solid var(--text-muted);color:var(--text-muted);
      font:500 11px/22px` — no background.
     results.md §3.3 (All-Season), product.md §3.1 (3PMSF, M+S). */
  outline: "border border-ink-muted leading-badge-outline text-ink-muted",

  /* CURRENTLY UNAVAILABLE — `border:1px solid var(--text-dim);
     color:var(--text-dim);background:var(--surface-2);font:500 11px/22px`.
     results.md §3.3; the variant DESIGN.md §4 does not define
     (results.md §6 #19) but docs/decisions.md §7 requires. */
  unavailable:
    "border border-ink-dim bg-surface-2 leading-badge-outline text-ink-dim",
};

export type BadgeProps = ComponentPropsWithoutRef<"span"> & {
  variant?: BadgeVariant;
};

/* Each season's mark: 12px, stroked in the badge's own ink, `gap-1.5` from
   the word (the 3PMSF badge's icon gap). Decorative; the word says the
   season. */
const SEASON_MARK: Partial<Record<BadgeVariant, string>> = {
  // Six-armed snowflake.
  winter:
    "M12 2v20M3.3 7l17.4 10M3.3 17l17.4-10M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5M3.6 10.4 7 9.5 6.1 6.1M17.9 17.9 17 14.5l3.4-.9M3.6 13.6 7 14.5l-.9 3.4M17.9 6.1 17 9.5l3.4.9",
  // A leaf.
  "all-season": "M5 19C5 10 11 5 20 4c-1 9-6 15-15 15ZM5 19l8-8",
  // The sun.
  summer:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  // A cloud.
  "all-weather": "M7 18h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.7 1.3A3.4 3.4 0 0 0 7 18Z",
};

/* The faint lime seasons draw their mark in lime; Winter's takes its ink. */
const SEASON_MARK_TINT: Partial<Record<BadgeVariant, string>> = {
  "all-season": "text-accent",
  summer: "text-accent",
  "all-weather": "text-accent",
};

function SeasonMark({ path, tint }: { path: string; tint?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx("size-3 shrink-0", tint)}
    >
      <path d={path} />
    </svg>
  );
}

export function Badge({ variant = "outline", className, children, ...rest }: BadgeProps) {
  return (
    <span {...rest} className={cx(badgeBase, variantClass[variant], className)}>
      {SEASON_MARK[variant] ? <SeasonMark path={SEASON_MARK[variant]} tint={SEASON_MARK_TINT[variant]} /> : null}
      {children}
    </span>
  );
}
