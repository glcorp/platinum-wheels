"use client";

/* ---------------------------------------------------------------------------
   AddToCartPanel — the buy panel's primary CTA (D122)

   Replaces the drawn `Request a quote` link to `#quote`: the product page has
   no quote form since D122, the cart does. It adds what the `How many?` cells
   say (D50, still `?qty=`). The `Custom` cell has no number of its own, so
   while it is selected this island shows the field that used to sit in the
   quote form's Optional group (D50 Open #6), `How many tires?`, and adds what
   is typed there.

   The field is blank at first and must hold a whole number to add; there is
   no upper limit a visitor can meet (owner, "lets not put restrictions of
   cart"), only the store's silent ceiling (`src/lib/cart.ts`). Blank or not a
   number: the field turns invalid, says so, and takes focus.
   --------------------------------------------------------------------------- */

import { useRef, useState } from "react";

import { FieldError, FieldLabel } from "@/components/ui/field-label";
import { Input } from "@/components/ui/input";
import { AddToCartButton } from "@/features/catalog/components/add-to-cart-button";
import { useQuantity } from "@/features/product/components/quantity-state";
import { CART_MAX_QUANTITY, type CartItem } from "@/lib/cart";

/* Any whole number; past the store's invisible ceiling it is clamped there
   (`src/lib/cart.ts`), never refused. */
const WHOLE_NUMBER = /^\d+$/;

export interface AddToCartPanelProps {
  slug: string;
  item: CartItem;
  /** The selected cell's count, or `null` for `Custom`. */
  quantity: number | null;
  /** The checked vehicle from the page URL, or `""` (`ProductView.vehicle`). */
  vehicle: string;
}

export function AddToCartPanel({ slug, item, quantity: served, vehicle }: AddToCartPanelProps) {
  /* The cells' live choice (2026-10-07, `quantity-state.tsx`); the served
     prop only outside a provider. */
  const live = useQuantity();
  const quantity =
    live === null ? served : live.quantity === "custom" ? null : Number(live.quantity);
  const [custom, setCustom] = useState("");
  const [invalid, setInvalid] = useState(false);
  const fieldRef = useRef<HTMLInputElement>(null);

  const typed = custom.trim();
  const customQuantity =
    WHOLE_NUMBER.test(typed) && Number(typed) >= 1
      ? Math.min(Number(typed), CART_MAX_QUANTITY)
      : null;

  return (
    <div className="flex flex-col gap-4">
      {quantity === null ? (
        <div className="enter-rise">
          <FieldLabel htmlFor="pdp-custom-quantity">{`How many ${item.unit.many}?`}</FieldLabel>
          <Input
            id="pdp-custom-quantity"
            ref={fieldRef}
            /* `text` + `inputMode="numeric"`, not `type="number"` (D91b,
               HPD-3/WDG-11): a number field holding `abc` serialises as "". */
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={custom}
            onChange={(event) => {
              setCustom(event.target.value);
              setInvalid(false);
            }}
            invalid={invalid}
            aria-describedby={invalid ? "pdp-custom-quantity-error" : undefined}
          />
          {invalid ? (
            <FieldError id="pdp-custom-quantity-error">Enter a whole number, like 6.</FieldError>
          ) : null}
        </div>
      ) : null}

      <AddToCartButton
        slug={slug}
        item={item}
        quantity={quantity ?? customQuantity}
        vehicle={vehicle}
        onInvalid={() => {
          setInvalid(true);
          fieldRef.current?.focus();
        }}
        size="panel"
      />
    </div>
  );
}
