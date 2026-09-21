import type { ComponentPropsWithoutRef } from "react";

import { cx } from "@/lib/cx";

/* ---------------------------------------------------------------------------
   Badge — winter / outline / unavailable

   Not interactive, so no hover, focus or tap-target rule applies. Radius is 0:
   `--radius-ctl` is for controls only and badges are explicitly excluded
   ("cards/images/badges stay 0", globals.css; product.md §5.4 lists badges
   under "radius 0 (none declared)"), so this file deliberately carries no
   `rounded-*` class.
   --------------------------------------------------------------------------- */

type BadgeVariant = "winter" | "outline" | "unavailable";

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
  /* WINTER — `background:var(--accent);color:var(--on-accent);
     font:500 11px/24px` — no border. "Spends the frame's accent"
     (DESIGN.md §4). results.md §3.3, product.md §3.1. */
  winter: "bg-accent leading-badge text-on-accent",

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

export function Badge({ variant = "outline", className, ...rest }: BadgeProps) {
  return (
    <span {...rest} className={cx(badgeBase, variantClass[variant], className)} />
  );
}
