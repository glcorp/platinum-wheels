/**
 * StripeDivider — the diagonal lime stripe section divider.
 *
 * DESIGN.md §5: "one 1–2px `--accent` line at 135° spanning the container, used
 * as a section divider at most **twice per page**. It counts as that section's
 * accent." The artboards are silent — home.md §4 conflict #50 records the stripe
 * as "Not present" in any export — so DESIGN.md governs here
 * (docs/decisions.md §1: "Where the artboards are silent, the spec governs").
 *
 * Purely decorative: `aria-hidden`, no text, no role, nothing focusable.
 *
 * Two usage rules this primitive cannot enforce, so they are the caller's:
 *  - at most two per page;
 *  - it IS that section's accent — do not put a second accent in the same frame
 *    (DESIGN.md §1.1 as softened in docs/decisions.md §1.1: judge by the frame).
 *
 * Geometry. A true `rotate(45deg)` hairline cannot span the container: crossing
 * 1344px of content at 45° needs 1344px of height. So the line spans the
 * container's full width and is skewed so it descends left→right — the same
 * direction CSS's `135deg` names — and the band's height is the rise. At the
 * 1344px content width (`--container-content`) a 2° skew drops the line
 * 1344 × tan 2° ≈ 47px, so it crosses the 48px band corner to corner.
 *
 * No gradient: the line is a solid `--accent` block. DESIGN.md §6 permits
 * gradients only as photographic scrims, and a stripe is a line, not a fill.
 */

import { cx } from "@/lib/cx";

export interface StripeDividerProps {
  /** Line weight in px. DESIGN.md §5 allows 1–2px; 1 by default. */
  thickness?: 1 | 2;
  className?: string;
}

export function StripeDivider({
  thickness = 1,
  className,
}: StripeDividerProps) {
  return (
    <div
      aria-hidden="true"
      /* 48px band — DESIGN.md §5 spacing scale (8/16/24/32/48/80/120). The
         skewed line is clipped to the band so it never bleeds into the
         neighbouring sections. */
      className={cx(
        "flex h-12 w-full items-center overflow-hidden",
        className,
      )}
    >
      <span
        className={cx(
          /* 1–2px solid --accent (DESIGN.md §5), skewed to the 135° direction. */
          "w-full skew-y-2 bg-accent",
          thickness === 2 ? "h-0.5" : "h-px",
        )}
      />
    </div>
  );
}
