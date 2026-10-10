"use client";

/* ---------------------------------------------------------------------------
   CartView — everything on `/cart` below the heading (D122)

   Owner, 2026-10-01: "once the user clicks on the cart they get to see which
   all products have they added to the cart with the quantity ... change their
   quantity, remove any product if they want ... and there in the cart is where
   it says request for a quote. ... clicking request a quote brings the form
   pop-up where they can fill in the information and that's how we capture the
   lead".

   Undrawn. Composed from the system the PDP already uses: the cart-grid split
   (`globals.css`, the quote band's own 64px gap), the quote band's
   `--surface-2` panel for the request, display type for its heading, the
   `panel` CTA pair (`Request a quote` over `Call us`), and the filter sheet's
   bottom-sheet dialog for the form (`sheet-dialog`, D67 / D92b motion),
   centred at `--container-dialog` from `md:`.

   States: before hydration (the cart lives in the browser, so the server knows
   nothing: a quiet line of the right height), empty, filled, and sent. Since
   D162 "sent" is read from the browser's record of sent requests, so it
   survives a refresh: an empty cart with a record shows the newest request's
   panel and lists the earlier ones; a full cart lists them all below it. When
   the page opens, the catalogue's current facts replace each line's snapshot;
   a product the catalogue no longer lists is removed and a note says how many
   (owner ruling). If the catalogue cannot be read, the cart keeps its
   snapshots and says nothing.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { refreshCart } from "@/features/cart/actions";
import { CartLineRow } from "@/features/cart/components/cart-line";
import { QuoteForm } from "@/features/cart/components/quote-form";
import { QuoteSuccess } from "@/features/cart/components/quote-success";
import {
  CLEAR_LABEL,
  SentLines,
  SentRequestList,
  sentLabel,
} from "@/features/cart/components/sent-requests";
import {
  pickQuoteCopy,
  type PostedLine,
  type QuoteCopyByCategory,
} from "@/features/cart/types";
import {
  cartUnits,
  clearCart,
  clearSentRequests,
  reconcileCart,
  recordSentRequest,
  removeFromCart,
  setCartQuantity,
  useCartLines,
  useSentRequests,
  type CartLine,
} from "@/lib/cart";
import { ROUTES } from "@/lib/routes";
import { PRIMARY_CONTACT } from "@/lib/site";

const DIALOG_ID = "cart-quote-dialog";

function PhoneIcon() {
  return (
    <svg
      width="18"
      height="18"
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

/** `2 products` / `1 product`. */
function productCount(count: number): string {
  return count === 1 ? "1 product" : `${count} products`;
}

function removedCopy(count: number): string {
  return count === 1
    ? "1 product is no longer listed, so we took it out of your cart."
    : `${count} products are no longer listed, so we took them out of your cart.`;
}

/** The note after the refresh removed lines. New copy, `.claude/rules/ui.md`.
 *  Visual only: `CartView` announces the same words through a live region
 *  that is mounted before they arrive, so a screen reader hears them. */
export function CartRemovedNote({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <p
      data-probe="cart-removed"
      className="bg-surface border-border-strong text-ink-muted enter-rise border p-4 text-14 leading-body"
    >
      {removedCopy(count)}
    </p>
  );
}

/** The empty cart. New copy; the recovery is the tire category and the phone,
 *  the same pair the results page's empty state offers. */
export function CartEmpty() {
  return (
    <div data-probe="cart-empty" className="flex flex-col items-start gap-6">
      <p className="text-ink-muted max-w-measure text-17 leading-body">
        Your cart is empty. Add tires, wheels or accessories, then request one quote for all of
        them.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button href={ROUTES.tires} variant="primary" size="promo">
          Shop tires
        </Button>
        <Button href={`tel:${PRIMARY_CONTACT.tel}`} variant="secondary" size="promo">
          <PhoneIcon />
          Call us
        </Button>
      </div>
    </div>
  );
}

/** The request panel beside the lines. `onRequest` is absent on
 *  `/styleguide`, where the panel renders inert. */
export function CartSummary({
  products,
  onRequest,
}: {
  products: number;
  onRequest?: () => void;
}) {
  return (
    <aside
      aria-labelledby="cart-summary-heading"
      data-probe="cart-summary"
      className="bg-surface-2 border-border-strong flex flex-col gap-5 border p-5 sm:gap-6 sm:p-8 md:sticky md:top-24"
    >
      <span className="label text-accent text-11 tracking-16 sm:text-12">Get your quote</span>
      <h2
        id="cart-summary-heading"
        className="display text-ink text-display-40 sm:text-display-56"
      >
        {productCount(products)}
      </h2>
      {/* Owner's wording, 2026-10-04 (D140): replaces the quote band's drawn
          promise and the "No payment is taken here." lead-in. */}
      <p className="text-ink-muted text-15 leading-body sm:text-16">
        We check the fitment, confirm stock, and reply within 1-2 business
        days.
      </p>
      <div className="flex flex-col gap-2 sm:gap-2.5">
        <Button
          type="button"
          variant="primary"
          size="panel"
          fullWidth
          onClick={onRequest}
          aria-haspopup="dialog"
          aria-controls={onRequest ? DIALOG_ID : undefined}
          data-probe="cart-request"
        >
          Request a quote
        </Button>
        <Button href={`tel:${PRIMARY_CONTACT.tel}`} variant="secondary" size="panel" fullWidth>
          <PhoneIcon />
          Call us
        </Button>
      </div>
    </aside>
  );
}

export interface CartViewProps {
  /** Placeholder and consent words per category (`copy.ts`), resolved on the
   *  server so the category table stays out of this bundle. */
  copy: QuoteCopyByCategory;
}

export function CartView({ copy }: CartViewProps) {
  const lines = useCartLines();
  /** Requests sent from this browser, newest first (D162). */
  const sent = useSentRequests();
  const [removed, setRemoved] = useState(0);
  /** A request went out in this visit: focus its panel once it renders. */
  const [justSent, setJustSent] = useState(false);
  const [open, setOpen] = useState(false);
  /** `performance.now()` at the dialog's FIRST opening, `0` before it. The
   *  fill timer counts from here, so a close and reopen does not restart it
   *  (D123(7)). */
  const [openedAt, setOpenedAt] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  /** The summary box is on screen, so the pinned phone bar steps aside. */
  const [summaryVisible, setSummaryVisible] = useState(false);
  const successRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLParagraphElement>(null);
  const refreshed = useRef(false);
  const alive = useRef(false);
  /** The live lines, for the form to read at the moment of sending. */
  const linesRef = useRef<CartLine[]>([]);

  useEffect(() => {
    linesRef.current = lines ?? [];
  }, [lines]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Once per visit: the catalogue's current facts. Not cancelled when the
  // lines change mid-flight (a stepper tap, another tab): `reconcileCart`
  // only touches the slugs it was asked about, so a late answer is safe.
  useEffect(() => {
    if (lines === null || refreshed.current) return;
    refreshed.current = true;
    if (lines.length === 0) return;
    refreshCart(lines.map((line) => line.slug))
      .then((result) => {
        if (!alive.current || !result.ok) return;
        const count = reconcileCart(result.items);
        if (count > 0) setRemoved(count);
      })
      .catch(() => {
        // Offline or the action failed: keep the saved snapshots.
      });
  }, [lines]);

  // The cart emptied under an open dialog (another tab sent or cleared it, or
  // the refresh removed every line): close it rather than unmount it open.
  // Adjusting state during render, React's documented pattern.
  if (open && lines !== null && lines.length === 0) {
    setOpen(false);
  }

  // The dialog follows `open`, the filter sheet's pattern (D31, D67).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) {
      dialog.showModal();
      document.body.style.overflow = "hidden";
    } else if (!open) {
      if (dialog?.open) dialog.close();
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Sent: the record and the emptied cart land in the same render (both are
  // synchronous store writes in `handleSuccess`), so the empty state never
  // paints in between; then the newest request's panel takes focus.
  useEffect(() => {
    if (justSent) successRef.current?.focus();
  }, [justSent]);

  const getLines = useCallback(
    (): PostedLine[] =>
      linesRef.current.map(({ slug, quantity, vehicle, item }) => ({
        slug,
        quantity,
        vehicle,
        category: item.category,
      })),
    [],
  );

  const request = () => {
    setOpenedAt((first) => first || performance.now());
    setOpen(true);
  };

  /* The pinned phone bar hides while the summary box is on screen. */
  const hasLines = (lines?.length ?? 0) > 0;
  useEffect(() => {
    const summary = summaryRef.current;
    if (!hasLines || summary === null) return;
    const observer = new IntersectionObserver(([entry]) => {
      setSummaryVisible(entry?.isIntersecting ?? false);
    });
    observer.observe(summary);
    return () => observer.disconnect();
  }, [hasLines]);

  /* The request is in (D162): keep a record of what was sent (the time and
     the products, never the visitor's details), then empty the cart. The
     record is what keeps "Quote request sent." on this page after a refresh. */
  const handleSuccess = useCallback(() => {
    recordSentRequest(linesRef.current);
    clearCart();
    setOpen(false);
    setJustSent(true);
  }, []);

  /** Empties the sent record. Focus goes to the count line beside a full
   *  cart, or to `<main>` when the panel it sat in is gone. */
  function clearSent() {
    clearSentRequests();
    if ((lines ?? []).length > 0) {
      countRef.current?.focus();
    } else {
      document.getElementById("main")?.focus();
    }
  }

  /** Removing the focused line's button would drop focus to `<body>`: hand
   *  it to the count line, or to `<main>` when the cart is now empty. */
  function remove(slug: string) {
    const remaining = (lines ?? []).length - 1;
    removeFromCart(slug);
    if (remaining > 0) {
      countRef.current?.focus();
    } else {
      document.getElementById("main")?.focus();
    }
  }

  /* One polite live region, the first child in every branch, so it stays
     mounted while the branches swap and its text change is announced. */
  const announcer = (
    <p role="status" className="sr-only">
      {removed > 0 ? removedCopy(removed) : ""}
    </p>
  );

  if (lines === null || sent === null) {
    // Before hydration, and forever with JavaScript off (the page's
    // `<noscript>` says why): an empty box one line tall, so nothing jumps.
    return (
      <>
        {announcer}
        <div aria-hidden="true" className="h-28" />
      </>
    );
  }

  if (lines.length === 0) {
    const [latest, ...earlier] = sent;
    if (latest) {
      /* The newest sent request stands where the empty cart would (D162):
         after a send, and after any refresh until the record is cleared. */
      return (
        <>
          {announcer}
          <div className="flex flex-col gap-10 sm:gap-12">
            <div className="flex flex-col items-start gap-6">
              <CartRemovedNote count={removed} />
              <QuoteSuccess
                ref={successRef}
                role="status"
                tabIndex={-1}
                sentLabel={sentLabel(latest.sentAt)}
              >
                <SentLines lines={latest.lines} />
              </QuoteSuccess>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <Button href={ROUTES.tires} variant="secondary" size="promo">
                  Keep shopping
                </Button>
                <button
                  type="button"
                  onClick={clearSent}
                  className="text-ink-muted tap-extend text-14 leading-body underline underline-offset-3 hover:text-ink active:opacity-70"
                >
                  {CLEAR_LABEL}
                </button>
              </div>
            </div>
            <SentRequestList requests={earlier} title="Earlier requests" />
          </div>
        </>
      );
    }
    return (
      <>
        {announcer}
        <div className="flex flex-col gap-6">
          <CartRemovedNote count={removed} />
          <CartEmpty />
        </div>
      </>
    );
  }

  const quoteCopy = pickQuoteCopy(
    copy,
    lines.map((line) => line.item.category),
  );

  return (
    <>
      {announcer}
      <div className="flex flex-col gap-10 md:cart-grid">
        <div className="flex min-w-0 flex-col gap-6">
          <CartRemovedNote count={removed} />
          <p ref={countRef} tabIndex={-1} className="text-ink-muted text-14 leading-body">
            {`${productCount(lines.length)}, ${cartUnits(lines)} ${cartUnits(lines) === 1 ? "unit" : "units"} in all.`}
          </p>
          <ul aria-label="Products in your cart" className="flex flex-col">
            {lines.map((line) => (
              <CartLineRow
                key={line.slug}
                line={line}
                onQuantity={(quantity) => setCartQuantity(line.slug, quantity)}
                onRemove={() => remove(line.slug)}
              />
            ))}
          </ul>
        </div>

        <div ref={summaryRef}>
          <CartSummary products={lines.length} onRequest={request} />
        </div>
      </div>

      {/* Requests already sent from this browser stay listed under a new
          cart (D162). */}
      {sent.length > 0 ? (
        <div className="pt-6 sm:pt-8">
          <SentRequestList requests={sent} title="Sent from this browser" onClear={clearSent} />
        </div>
      ) : null}

      {/* Below 1100 the summary sits under every line, so on a phone its
          button was a long scroll away (owner, 2026-10-07: "request a quote
          should be accessible always. in mobile we need to scroll down"). A
          bar pinned to the bottom carries the same button until the summary
          itself is on screen; the spacer keeps the last line from sitting
          under it. */}
      <div aria-hidden="true" className="h-22 md:hidden" />
      <div
        data-probe="cart-request-bar"
        hidden={summaryVisible}
        className="border-border-strong bg-bg pb-safe fixed inset-x-0 bottom-0 z-20 border-t px-4 pt-3 sm:px-8 md:hidden"
      >
        <Button
          type="button"
          variant="primary"
          size="promo"
          fullWidth
          onClick={request}
          aria-haspopup="dialog"
          aria-controls={DIALOG_ID}
        >
          Request a quote
        </Button>
      </div>

      <dialog
        id={DIALOG_ID}
        ref={dialogRef}
        aria-labelledby="cart-quote-title"
        data-probe="cart-quote-dialog"
        onClose={() => setOpen(false)}
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          }
        }}
        // A click on the scrim is a click on the dialog box itself.
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpen(false);
        }}
        className="sheet-dialog backdrop:bg-scrim-mid fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none flex-col justify-end border-0 bg-transparent p-0 open:flex"
      >
        {/* `data-fit` (2026-10-07): the panel takes the form's own height, up
            to the whole screen, instead of the filter sheet's fixed
            `100dvh - 144px`, which left the top of the screen to the page and
            the form scrolling below it (owner: "the form is not visible till
            top and needs scrolling"). */}
        <div
          data-fit=""
          className="sheet-panel bg-surface border-border-strong flex w-full flex-col border-t md:mx-auto md:max-w-dialog md:border-x"
        >
          <div className="border-border-strong flex items-center justify-between gap-4 border-b px-4 py-5 sm:px-8">
            <h2 id="cart-quote-title" className="display text-ink text-display-28 sm:text-display-40">
              Tell us where to send it.
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="border-border-strong text-ink inline-flex size-11 shrink-0 touch-manipulation items-center justify-center border bg-transparent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-0"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                className="size-4.5"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          {/* No bottom padding here: `pb-safe` lives on the form's sticky
              submit row, which is the last thing in this scroller, so a
              sticky `bottom-0` has no scroller padding to argue with.
              `scroll-pb-24` (96px) is that row's height (56/60px button +
              16px above + 20px below), so focus never lands under it.
              Launch audit, D145. */}
          <div className="scroll-pb-24 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-4 pt-6 sm:px-8 sm:pt-8">
            <p className="text-ink-muted text-14 leading-body">
              {`Your request covers ${productCount(lines.length)} in your cart.`}
            </p>
            <QuoteForm
              getLines={getLines}
              copy={quoteCopy}
              openedAt={openedAt}
              onSuccess={handleSuccess}
            />
          </div>
        </div>
      </dialog>
    </>
  );
}
