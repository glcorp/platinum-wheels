import type { ComponentPropsWithoutRef } from "react";

import { cx } from "@/lib/cx";

/* ---------------------------------------------------------------------------
   Badge — winter / accent / outline / unavailable

   Not interactive, so no hover, focus or tap-target rule applies. Radius is 0:
   `--radius-ctl` is for controls only and badges are explicitly excluded
   ("cards/images/badges stay 0", globals.css; product.md §5.4 lists badges
   under "radius 0 (none declared)"), so this file deliberately carries no
   `rounded-*` class.
   --------------------------------------------------------------------------- */

type BadgeVariant = "winter" | "accent" | "outline" | "unavailable";

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
  /* WINTER — drawn `background:var(--accent);color:var(--on-accent);
     font:500 11px/24px`, no border (results.md §3.3, product.md §3.1). Since
     2026-10-07 an icy aqua `--winter` fill with a snowflake (owner: "make
     winter tag aqua and frosty element", DEVIATIONS #126); box and type
     unchanged. */
  winter: "bg-winter leading-badge text-on-winter",

  /* The drawn filled badge, lime. All-Season wears it since 2026-10-07
     (owner: "make all season green filled like winter", DEVIATIONS #125). */
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

/* The frost on the Winter badge: a six-armed snowflake, 12px, stroked in the
   badge's own ink, `gap-1.5` from the word (the 3PMSF badge's icon gap).
   Decorative; the word says the season. */
function Snowflake() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="size-3 shrink-0"
    >
      <path d="M12 2v20M3.3 7l17.4 10M3.3 17l17.4-10M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5M3.6 10.4 7 9.5 6.1 6.1M17.9 17.9 17 14.5l3.4-.9M3.6 13.6 7 14.5l-.9 3.4M17.9 6.1 17 9.5l3.4.9" />
    </svg>
  );
}

export function Badge({ variant = "outline", className, children, ...rest }: BadgeProps) {
  return (
    <span {...rest} className={cx(badgeBase, variantClass[variant], className)}>
      {variant === "winter" ? <Snowflake /> : null}
      {children}
    </span>
  );
}
