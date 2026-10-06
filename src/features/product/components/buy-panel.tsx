import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { cartItem } from "@/features/catalog/cart-item";
import { AddToCartPanel } from "@/features/product/components/add-to-cart-panel";
import { QuantityProvider } from "@/features/product/components/quantity-state";
import { QuantityControl } from "@/features/product/components/quantity-control";
import { vehicleLabel, type ProductView } from "@/features/product/types";
import { PRICES_VISIBLE, PRIMARY_CONTACT } from "@/lib/site";

/* ---------------------------------------------------------------------------
   BuyPanel — the right column of the split (D "3": gallery 55 / panel 45).

   Drawn order (`product.md` §3 "Element order"): breadcrumb (desktop only,
   passed in — the page decides placement, `pdp-breadcrumb.tsx`), badge row
   (desktop only — mobile's overlay the gallery, `pdp-gallery.tsx`), brand
   label, `<h1>`, size numeral, price, quantity control, CTA pair.
   Explicitly absent, both artboards (`product.md` §3.6): an install/fitment/
   stock/shipping trust line — "Do not synthesise a trust line into the
   panel" (D47(2)). No sticky mobile bar (D6).

   Container — desktop `position:sticky;top:96px;display:flex;
   flex-direction:column;gap:20px`, no padding of its own: the split's 64px
   gap and the page's own padding do that job (`product-desktop.html:106`).
   Mobile `padding:32px 16px 0;display:flex;flex-direction:column;gap:16px`,
   not sticky (`product-mobile.html:92`); the top 32px is 16px below 720
   since 2026-10-07 (owner: "below tire there is so much black space",
   DEVIATIONS #123). Tablet band keeps the mobile
   padding (D41 "page padding 32" from `sm:`) until the split activates at
   `md:` (1100, `product.md` §1.5/1.6), where padding hands off to the split
   wrapper and `md:sticky md:top-24` (96px, the same token name
   `filter-rail.tsx` uses for its own 96px offset) takes over.
   --------------------------------------------------------------------------- */

export interface BuyPanelProps {
  view: ProductView;
  /** Rendered first, desktop only — the caller supplies the element and its
   *  visibility classes (`pdp-breadcrumb.tsx` "the page decides placement").
   *  Omitted entirely on a mobile-only render path. */
  breadcrumb?: ReactNode;
  /** Every other current search param, so `QuantityControl`'s links change
   *  only `qty` (D50). */
  searchParams: Record<string, string | string[] | undefined>;
}

/* `<svg width="14" height="14" … stroke-width="1.5" stroke-linejoin="round">`
   — `product-desktop.html:109`, the 3PMSF mark. Desktop only: the buy
   panel's badge row never renders below `sm:` (`types.ts` `PdpBadge` doc). */
function ThreePeakIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 20L8 9l3 5 3-6 8 12z" />
      <path
        d="M17 3v5M14.5 5.5h5M15.2 3.8l3.6 3.6M18.8 3.8l-3.6 3.6"
        strokeWidth="1.2"
      />
    </svg>
  );
}

/* Phone svg on the secondary CTA — `product-desktop.html:120`
   (`width="18" height="18" stroke-width="1.6"`), 16×16 on mobile
   (`product-mobile.html:100`). Two sized instances toggled by breakpoint,
   the same pattern `quantity-control.tsx`'s chevron uses. */
function PhoneIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}

/* The h1's type step by name length (launch audit, D145, UI-CRITIQUE). The
   artboards draw `Antarctica Sport` (16 characters) at 56px / 88px, and every
   name up to 24 characters keeps exactly that. A vendor accessory name can
   run past 60 (`Center Cap Silver Multi-Fit R132 R192 R322 R42 R61 R62 R72`):
   at 56px that is four or five lines on a phone and pushed `Add to cart`
   below the fold. Longer names step down through the display scale the site
   already uses (48 / 56 to 40 characters, 36 / 48 beyond), never a new size.
   Characters, not measured width: the server cannot measure, and the display
   face is condensed enough that length tracks line count closely.
   DEVIATIONS (D151 row). */
const TITLE_DRAWN_MAX = 24;
const TITLE_LONG_MAX = 40;

function titleSize(model: string): string {
  const length = model.trim().length;
  if (length <= TITLE_DRAWN_MAX) return "text-display-56 sm:text-display-88";
  if (length <= TITLE_LONG_MAX) return "text-display-48 sm:text-display-56";
  return "text-display-36 sm:text-display-48";
}

export function BuyPanel({ view, breadcrumb, searchParams }: BuyPanelProps) {
  const { product } = view;

  return (
    /* `min-w-0` (D91b, NJR-8): this is the `pdp-split` grid item, and an
       `fr` track's floor is its item's min-content — one long word in the
       h1 grew the 576px column to 606px and squeezed the gallery. */
    <div className="flex min-w-0 flex-col gap-4 px-4 pt-4 sm:gap-5 sm:px-8 sm:pt-8 md:sticky md:top-24 md:gap-5 md:px-0 md:pt-0">
      {breadcrumb}

      {/* Badge row — desktop only (`product-desktop.html:108`); mobile's
          equivalent overlays the gallery image (`pdp-gallery.tsx`).
          `display:flex;gap:8px;align-items:center`. */}
      {view.badges.length > 0 ? (
        <div className="hidden items-center gap-2 sm:flex">
          {view.badges.map((badge) => (
            <Badge key={badge.label} variant={badge.variant}>
              {badge.mark === "three-peak" ? <ThreePeakIcon /> : null}
              {badge.label}
            </Badge>
          ))}
        </div>
      ) : null}

      {/* Title block — `display:flex;flex-direction:column;gap:8px`
          (mobile `gap:6px`) (`product.md` §3.2). */}
      <div className="flex flex-col gap-1.5 sm:gap-2">
        {/* Brand label — `font:500 12px/1;letter-spacing:.14em;
            text-transform:uppercase;color:var(--text-muted)` mobile,
            `13px` desktop (`product-mobile.html:94`,
            `product-desktop.html:109`). */}
        {/* D125: an unbranded accessory has no brand line; the h1 moves up
            into its place rather than sitting under an empty span. */}
        {product.brand ? (
          <span translate="no" className="label text-ink-muted text-12 tracking-14 sm:text-13">
            {product.brand}
          </span>
        ) : null}

        {/* `<h1>` — the page's only h1. `700 calc(56px)/0.92` mobile →
            `700 calc(88px)/0.92` desktop (`product.md` §3.2). `text-ink`
            restores the drawn `--text` white: with no colour of its own it
            inherited the body's `--text-muted` grey (D91b, VPE-2).
            `wrap-anywhere` breaks a single word longer than the column
            (`Ganzjahresreifen` overflowed 320/375 and widened the desktop
            track, D91b NJR-8/KBD-8); every seed name fits, so no rest pixel
            moves. */}
        <h1 className={`display text-ink wrap-anywhere ${titleSize(product.model)}`}>
          {product.model}
        </h1>

        {/* Size numeral — `font:700 18px/1;tabular-nums;color:var(--text-muted)`
            mobile, `22px` desktop (`product-mobile.html:94`,
            `product-desktop.html:109`). `leading-flat` is the drawn `/1`:
            `numeral` sets no line-height, so it read 1.5 (D91b, VPE-3). */}
        <span className="numeral text-ink-muted text-18 leading-flat sm:text-22">
          {view.sizeLine}
        </span>
      </div>

      {/* Price — built for this exact element already; do not restyle it
          (`product.md` §3.3). Wrapper `padding-top:8px` on desktop only
          (`product-desktop.html:110`); the mobile price row has none
          (`product-mobile.html:95`), so `sm:pt-2` — the tablet band takes the
          desktop value from `sm:` per D41 (D91b, VPE-5). `unit` is the
          category's PDP suffix (D58, `CategoryConfig.unit.pdp`) — a tire's is
          `per tire · before tax`, `Price`'s own default, so this is a no-op
          for the built page; a wheel renders `per wheel · before tax`. */}
      {/* D122: no price at all while prices are switched off. */}
      {PRICES_VISIBLE ? (
        <div className="sm:pt-2">
          <Price
            amount={product.price}
            context="pdp"
            /* A discontinued product (D105b): the amount dims, as it does on the
               unavailable card. Undrawn on the PDP, so it borrows the card's
               drawn treatment rather than inventing one. */
            unavailable={!product.available}
            unit={view.config.unit.pdp}
          />
        </div>
      ) : null}

      {/* The cells and `Add to cart` share the selection in the browser
          (2026-10-07, `quantity-state.tsx`): a tap no longer reloads. */}
      <QuantityProvider initial={view.quantity}>
        <QuantityControl quantity={view.quantity} searchParams={searchParams} />

      {/* CTA pair — `flex flex-col;gap:8px;padding-top:8px` mobile,
          `gap:10px` desktop (`product.md` §3.5). `panel` size (`h-14 sm:h-15`
          = 56→60px) already reproduces the drawn pair unchanged. */}
      <div className="flex flex-col gap-2 pt-2 sm:gap-2.5">
        {/* D122: `Add to cart` replaces the drawn `Request a quote` (and the
            unavailable `Inquire about restock`), adding what the cells above
            say; the quote is requested from the cart. Same `panel` size and
            the same primary / ghost swap for a discontinued product, so the
            pair's drawn box is unchanged (`design/DEVIATIONS.md` #96). */}
        <AddToCartPanel
          slug={product.slug}
          item={cartItem(product)}
          quantity={view.quantity === "custom" ? null : Number(view.quantity)}
          vehicle={vehicleLabel(view)}
        />
        <Button
          variant="secondary"
          size="panel"
          fullWidth
          href={`tel:${PRIMARY_CONTACT.tel}`}
        >
          <span className="sm:hidden">
            <PhoneIcon size={16} />
          </span>
          <span className="hidden sm:inline">
            <PhoneIcon size={18} />
          </span>
          Call us
        </Button>
      </div>
      </QuantityProvider>
    </div>
  );
}
