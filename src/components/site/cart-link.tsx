"use client";

/* ---------------------------------------------------------------------------
   CartLink — the header's cart, its count and the "View cart" prompt (D122)

   Owner, 2026-10-01: the cart button sits "in the nav bar top right on the
   mobile phone it doesn't need to be inside the hamburger it needs to stay
   outside it needs to display the amount of products added to the cart as a
   number like it's there on any e-commerce website". Placement ruling: logo ·
   phone · cart · menu; the icon always shows, the count only when the cart is
   not empty. The count is units (four tires read `4`), as shops count.

   No artboard draws any of this; it is authored under `.claude/rules/ui.md`
   "States the design doesn't show" from existing tokens: the menu trigger's
   44×44 box and 22px stroke icon, the accent fill and on-accent ink for the
   count, the `--surface` panel with a `--border-strong` hairline for the
   prompt. Square corners at `--radius-ctl`: nothing here is a pill.

   Motion (owner ruling, "Button tick + badge pop"): an add pops the count
   (`cart-pop`, globals.css) and raises the prompt (`enter-rise`). Neither runs
   on a page load that finds a cart already full, because the header mounts
   again on every navigation (D38) and a count that pops on every page means
   nothing. Reduced motion is the global kill in globals.css.

   The prompt is a polite live region that is always mounted, so screen
   readers announce each add even though the button's own label change is
   visual only (`add-to-cart-button.tsx`).
   --------------------------------------------------------------------------- */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cartUnits, onCartAdded, useCartLines, type CartAddedNotice } from "@/lib/cart";
import { ROUTES } from "@/lib/routes";

/** How long the prompt stays up unless it is closed or hovered. */
const PROMPT_MS = 6000;

const CART_ICON = (
  /* 22×22, stroke 1.6, round caps: the menu icon's weight
     (site-nav-drawer.tsx, home-mobile.html:88-90). */
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 4h2.2l2.3 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2" />
    <circle cx="9.5" cy="20" r="1.2" />
    <circle cx="17" cy="20" r="1.2" />
  </svg>
);

function countLabel(units: number): string {
  return units > 99 ? "99+" : String(units);
}

export function CartLink() {
  const lines = useCartLines();
  const units = lines === null ? 0 : cartUnits(lines);
  const [notice, setNotice] = useState<CartAddedNotice | null>(null);
  /** Bumped by an add; keys the count so it re-mounts and pops. `0` = no
   *  add yet on this page, so the count renders still. */
  const [pops, setPops] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const held = useRef(false);

  useEffect(() => {
    const stop = onCartAdded((next) => {
      setNotice(next);
      setPops((count) => count + 1);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        if (!held.current) setNotice(null);
      }, PROMPT_MS);
    });
    return () => {
      stop();
      window.clearTimeout(timer.current);
    };
  }, []);

  /** Pointer or focus inside the prompt: no timer runs (WCAG 2.2.1). */
  function hold() {
    held.current = true;
    window.clearTimeout(timer.current);
  }

  /** Pointer and focus both gone: half the time again, unless held anew. */
  function release() {
    held.current = false;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (!held.current) setNotice(null);
    }, PROMPT_MS / 2);
  }

  return (
    <>
      <Link
        href={ROUTES.cart}
        aria-label={units > 0 ? `Cart, ${units} ${units === 1 ? "item" : "items"}` : "Cart"}
        data-probe="cart-link"
        className="text-on-photo relative inline-flex size-11 touch-manipulation items-center justify-center active:translate-y-px"
      >
        {CART_ICON}
        {units > 0 ? (
          <span
            key={pops}
            aria-hidden="true"
            data-probe="cart-count"
            className={
              pops > 0
                ? "numeral bg-accent text-on-accent rounded-ctl cart-pop absolute top-0.5 right-0 inline-flex h-4.5 min-w-4.5 items-center justify-center px-1 text-11 leading-flat"
                : "numeral bg-accent text-on-accent rounded-ctl absolute top-0.5 right-0 inline-flex h-4.5 min-w-4.5 items-center justify-center px-1 text-11 leading-flat"
            }
          >
            {countLabel(units)}
          </span>
        ) : null}
      </Link>

      {/* The prompt. `fixed`, full width less the 16px page gutter on a phone
          and the 420px measure in the bottom-right corner from `sm:`, above
          the page and below any open dialog (dialogs sit in the top layer). */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-20 sm:inset-x-auto sm:right-8 sm:bottom-8 sm:w-measure"
      >
        {notice ? (
          <div
            data-probe="cart-prompt"
            onPointerEnter={hold}
            onPointerLeave={release}
            onFocus={hold}
            onBlur={(event) => {
              // Tabbing from `View cart` to `Close` stays inside: still held.
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) release();
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setNotice(null);
            }}
            className="bg-surface border-border-strong text-ink enter-rise pointer-events-auto flex items-center gap-3 border p-3 pl-4"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="label text-accent text-11 tracking-12">
                {notice.updated ? "Cart updated" : "Added to cart"}
              </span>
              <span className="text-ink line-clamp-2 text-14 leading-snug font-bold">
                {notice.name}
              </span>
              <span className="text-ink-muted text-13 leading-snug">{notice.amount}</span>
            </div>
            <Button href={ROUTES.cart} variant="secondary" size="compact">
              View cart
            </Button>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setNotice(null)}
              className="text-ink-muted hover:text-ink inline-flex size-11 shrink-0 touch-manipulation items-center justify-center bg-transparent active:translate-y-px"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
