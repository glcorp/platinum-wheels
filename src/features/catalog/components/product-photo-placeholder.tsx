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
 * is the same height as its neighbours and costs no layout shift. The label is
 * set flush-left at the bottom of the box: the top edge belongs to the badges.
 * Decorative: the brand is announced from the card body and the PDP heading,
 * so this is `aria-hidden`.
 *
 * D133 (owner, 2026-10-03): an unbranded accessory (D125) used to render an
 * empty tile, and those are half of all accessories (925), so half the
 * accessory grid read as blank grey squares. With no brand the tile now sets
 * the accessory TYPE in the same display treatment (`Lug Nuts`, `Wheel Covers
 * & Trim`), using the catalogue's own label table, `ACCESSORY_LABEL` in
 * `adapter.ts` — the words the `Type` chips and the PDP spec table already
 * read, so no new copy is written here. A brand still wins whenever there is
 * one. Only a brand is `translate="no"` (D93b, WDG-15): a type label is an
 * ordinary noun and should translate. With neither (a product with no brand
 * and no type, which the catalogue does not hold today) the tile stays empty
 * rather than inventing a word.
 */

import { ACCESSORY_LABEL } from "@/features/catalog/adapter";
import type { AccessoryType } from "@/features/catalog/types";
import { cx } from "@/lib/cx";

export interface ProductPhotoPlaceholderProps {
  /** `null` on an unbranded accessory (D125): the tile sets the type instead. */
  brand: string | null;
  /** The accessory's type, set on the tile when there is no brand (D133).
   *  Ignored when a brand is present. */
  accessoryType?: AccessoryType;
  /** `card` is the product grid, `gallery` the PDP's photo box. */
  context?: "card" | "gallery";
  /** The unavailable card dims its photo to 35%; the tile follows. */
  dimmed?: boolean;
}

export function ProductPhotoPlaceholder({
  brand,
  accessoryType,
  context = "card",
  dimmed = false,
}: ProductPhotoPlaceholderProps) {
  /* `||` folds an empty string into "no brand", as `ProductCard` does. */
  const brandName = brand || null;
  const typeLabel =
    brandName === null && accessoryType !== undefined
      ? ACCESSORY_LABEL[accessoryType]
      : null;
  const label = brandName ?? typeLabel;

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
      {label === null ? null : (
        <span
          /* A brand name is never machine-translated (D93b, WDG-15); a type
             label is (D133), so the attribute is omitted for it. */
          translate={brandName === null ? undefined : "no"}
          className={cx(
            "display text-ink-dim break-words",
            context === "card"
              ? "text-display-24 sm:text-display-32"
              : "text-display-40 sm:text-display-56",
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}
