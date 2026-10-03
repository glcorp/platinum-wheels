"use client";

/* ---------------------------------------------------------------------------
   CartLineRow — one product in the cart (D122)

   Undrawn, so authored under `.claude/rules/ui.md` "States the design doesn't
   show" from the card's own vocabulary: the square photo on `--bg` inside a
   `--border` hairline, the brand label, the display model linking to the
   product, the tabular size line, and the card's `Currently unavailable`
   badge. Owner rulings: quantities can be changed and lines removed; a
   discontinued product stays, marked "Unavailable, we'll check restock"; the
   searched vehicle shows per line. No price, ever (owner ruling for launch).

   The quantity is a stepper with a typed field between its buttons. The field
   commits on blur or Enter; blank or nonsense puts the old number back. One
   is the floor (`Remove` is the way out); there is no ceiling a person meets
   (owner, "lets not put restrictions of cart").

   Handlers are optional so `/styleguide` can render a real row inert.
   --------------------------------------------------------------------------- */

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { photoSource } from "@/features/catalog/photo-files";
import { amountLabel, CART_MAX_QUANTITY, type CartLine } from "@/lib/cart";
import { productName } from "@/lib/product-name";
import { productRoute } from "@/lib/routes";

const WHOLE_NUMBER = /^\d+$/;

/* `aria-disabled`, not `disabled`, at the ends: a disabled button drops the
   focus of the keyboard user who just stepped down to 1. */
const STEP_CLASS =
  "text-ink hover:bg-surface-2 inline-flex size-11 shrink-0 touch-manipulation items-center justify-center bg-transparent active:translate-y-px aria-disabled:text-ink-dim aria-disabled:hover:bg-transparent aria-disabled:translate-y-0";

export interface CartLineRowProps {
  line: CartLine;
  onQuantity?: (quantity: number) => void;
  onRemove?: () => void;
}

export function CartLineRow({ line, onQuantity, onRemove }: CartLineRowProps) {
  const { slug, quantity, vehicle, item } = line;
  const name = productName(item.brand, item.model);
  const [draft, setDraft] = useState<string | null>(null);
  const inert = !onQuantity;

  function commit(text: string) {
    setDraft(null);
    const typed = text.trim();
    if (!WHOLE_NUMBER.test(typed)) return;
    const next = Math.min(Math.max(Number(typed), 1), CART_MAX_QUANTITY);
    if (next !== quantity) onQuantity?.(next);
  }

  return (
    <li
      data-probe="cart-line"
      className="border-border flex gap-4 border-b py-5 first:border-t sm:gap-6 sm:py-6"
    >
      {/* Photo: the card's square on `--bg`, `object-contain`, never cropped.
          No photo: the empty `--surface-2` tile, without the card
          placeholder's brand wordmark, which does not fit 80px. */}
      <Link
        href={productRoute(slug)}
        tabIndex={-1}
        aria-hidden="true"
        className="bg-bg border-border relative block size-20 shrink-0 overflow-hidden border sm:size-28"
      >
        {item.image ? (
          <Image
            {...photoSource(item.image, "card")}
            alt=""
            width={1000}
            height={1000}
            sizes="(min-width: 720px) 112px, 80px"
            className={
              item.available
                ? "photo-inset-card block h-full w-full object-contain"
                : "photo-inset-card block h-full w-full object-contain opacity-35"
            }
          />
        ) : (
          <span className="bg-surface-2 block h-full w-full" />
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-col gap-1.5">
          {/* No brand line on an unbranded accessory (D125). */}
          {item.brand ? (
            <span translate="no" className="label text-ink-muted text-11 tracking-14 sm:text-12">
              {item.brand}
            </span>
          ) : null}
          <Link
            href={productRoute(slug)}
            className="display text-ink text-display-24 tap-extend break-words active:opacity-70 sm:text-display-28"
          >
            {item.model}
            <span className="sr-only">{` ${item.size}`}</span>
          </Link>
          <span className="numeral text-ink-muted text-14 leading-tight sm:text-15">
            {item.size}
          </span>
          {vehicle ? (
            <span className="text-ink-muted text-13 leading-snug">{`For ${vehicle}`}</span>
          ) : null}
          {item.available ? null : (
            <span className="pt-1">
              <Badge variant="unavailable">Unavailable, we&apos;ll check restock</Badge>
            </span>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex flex-col gap-1.5">
            <div
              role="group"
              aria-label={`Quantity, ${name}`}
              className="border-border-strong rounded-ctl flex h-11 items-stretch overflow-hidden border"
            >
              <button
                type="button"
                aria-label="One fewer"
                aria-disabled={quantity <= 1}
                onClick={() => {
                  if (quantity > 1) onQuantity?.(quantity - 1);
                }}
                className={STEP_CLASS}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <path d="M5 12h14" />
                </svg>
              </button>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label="Quantity"
                readOnly={inert}
                value={draft ?? String(quantity)}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={(event) => commit(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commit(event.currentTarget.value);
                  }
                }}
                className="numeral text-ink border-border-strong w-16 border-x bg-transparent text-center text-16 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
              />
              <button
                type="button"
                aria-label="One more"
                aria-disabled={quantity >= CART_MAX_QUANTITY}
                onClick={() => {
                  if (quantity < CART_MAX_QUANTITY) onQuantity?.(quantity + 1);
                }}
                className={STEP_CLASS}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
            <span className="text-ink-dim text-12 leading-flat">
              {amountLabel(quantity, item.unit)}
            </span>
          </div>

          <Button
            type="button"
            variant="tertiary"
            size="compact"
            onClick={onRemove}
            className="self-start"
          >
            Remove
            <span className="sr-only">{` ${name} ${item.size}`}</span>
          </Button>
        </div>
      </div>
    </li>
  );
}
