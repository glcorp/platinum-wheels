"use client";

/* ---------------------------------------------------------------------------
   AddToCartButton — the card's and the product page's one CTA (D122)

   Replaces `Request a quote` / `Inquire about restock`. Owner, 2026-10-01:
   "On the product list page, there was a button request a quote. Instead,
   that button now says add to cart and the product gets added to the cart",
   and the client kept the wording "Add to cart".

   Same `Button` primitive, size and variant as the CTA it replaces, so the
   card's measured box is unchanged (`results-desktop.html:188`, `:453`): the
   primary fill for an available product, the ghost for a discontinued one,
   which can still be added and is marked in the cart (owner ruling).

   Feedback (owner ruling, "Button tick + badge pop"): for `FEEDBACK_MS` the
   label reads `Added` (or `Updated`, when the product was already in the cart
   and its quantity grew) with a tick, and the header's count pops and shows a
   `View cart` prompt (`src/components/site/cart-link.tsx`). That prompt is
   the announcement for screen readers; this label change is visual.

   A client island because it writes `localStorage`. Until it hydrates the
   button is inert: the cart cannot exist without the browser, and the page's
   phone number is the no-JS path.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { addToCart, type CartItem } from "@/lib/cart";

/** How long the label holds its confirmation. Long enough to read, short
 *  enough that a second press reads `Add to cart` again. */
const FEEDBACK_MS = 1800;

export interface AddToCartButtonProps {
  slug: string;
  item: CartItem;
  /**
   * How many to add, or `null` when the caller's own field holds something
   * that is not a number (the PDP's `Custom` cell). `null` adds nothing and
   * calls `onInvalid` instead.
   */
  quantity: number | null;
  onInvalid?: () => void;
  /** `2021 Honda Civic`, the vehicle the visitor searched, checked on the
   *  server against the finder's list (D91b), or `""`. Saved on the line. */
  vehicle: string;
  /** `card` inside a product card, `panel` in the product page's buy panel. */
  size: "card" | "panel";
  className?: string;
  /** Visually hidden tail naming the product, so thirty `Add to cart`
   *  buttons on one page do not read identically out of context. */
  srContext?: string;
}

function TickIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function AddToCartButton({
  slug,
  item,
  quantity,
  onInvalid,
  vehicle,
  size,
  className,
  srContext,
}: AddToCartButtonProps) {
  const [feedback, setFeedback] = useState<"added" | "updated" | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function handleClick() {
    if (quantity === null) {
      onInvalid?.();
      return;
    }
    const result = addToCart({ slug, quantity, vehicle, item });
    if (result === null) return;
    setFeedback(result.updated ? "updated" : "added");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFeedback(null), FEEDBACK_MS);
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      variant={item.available ? "primary" : "secondary"}
      size={size}
      fullWidth={size === "panel"}
      className={className}
      data-probe="add-to-cart"
    >
      {feedback === null ? (
        "Add to cart"
      ) : (
        /* `enter-rise` (D92b): the confirmation arrives rather than pops. */
        <span className="enter-rise inline-flex items-center gap-2">
          <TickIcon />
          {feedback === "added" ? "Added" : "Updated"}
        </span>
      )}
      {srContext ? <span className="sr-only">{` ${srContext}`}</span> : null}
    </Button>
  );
}
