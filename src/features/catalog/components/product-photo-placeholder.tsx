/**
 * ProductPhotoPlaceholder — what the photo box shows when a product has no
 * photo.
 *
 * No artboard draws this state: the seed always had a cut-out. The real
 * catalogue does not (about a third of one vendor's accessories arrive with no
 * image, and nothing has one until photos are uploaded), so the owner ruled on
 * it, 2026-09-30: a neutral tile, the brand name in the site's display type
 * and nothing else (D108b). Built from existing tokens only, per
 * `.claude/rules/ui.md` "States the design doesn't show", and shown on
 * `/styleguide`.
 *
 * It fills the same reserved square the photo would, so a card with no photo
 * is the same height as its neighbours and costs no layout shift. The brand is
 * set flush-left at the bottom of the box: the top edge belongs to the badges.
 * Decorative: the brand is announced from the card body and the PDP heading,
 * so this is `aria-hidden`.
 *
 * An unbranded accessory (D125) has nothing to set, so the tile is empty: the
 * same square and fill, no stand-in text. Its name is right below it.
 */

import { cx } from "@/lib/cx";

export interface ProductPhotoPlaceholderProps {
  /** `null` on an unbranded accessory (D125): the tile renders empty. */
  brand: string | null;
  /** `card` is the product grid, `gallery` the PDP's photo box. */
  context?: "card" | "gallery";
  /** The unavailable card dims its photo to 35%; the tile follows. */
  dimmed?: boolean;
}

export function ProductPhotoPlaceholder({
  brand,
  context = "card",
  dimmed = false,
}: ProductPhotoPlaceholderProps) {
  return (
    <div
      aria-hidden="true"
      data-probe="photo-placeholder"
      className={cx(
        "bg-surface-2 flex h-full w-full items-end",
        context === "card" ? "p-3.5 sm:p-6" : "p-4 sm:p-8",
        dimmed && "opacity-35",
      )}
    >
      {brand ? (
        <span
          /* A brand name is never machine-translated (D93b, WDG-15). */
          translate="no"
          className={cx(
            "display text-ink-dim break-words",
            context === "card"
              ? "text-display-24 sm:text-display-32"
              : "text-display-40 sm:text-display-56",
          )}
        >
          {brand}
        </span>
      ) : null}
    </div>
  );
}
