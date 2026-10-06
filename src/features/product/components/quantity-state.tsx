"use client";

/* ---------------------------------------------------------------------------
   QuantityProvider — the PDP's selected `How many?` cell, held in the browser
   (2026-10-07).

   D50 made the quantity a `?qty=` URL param that the server rendered, so every
   cell tap was a server round trip and the loader (D92b `NavProgress`) showed
   on each one (owner: "The loader appears every time you change the quantity
   on the product page … The fix is to change the quantity in the browser with
   no reload"). Now the cells (`quantity-control.tsx`) set this state and
   rewrite `?qty=` with `history.replaceState`, which Next keeps in sync with
   its router without a request. The URL still carries the choice, so a
   reload or a shared link opens on it, and the server still renders the
   first state. With JavaScript off the cells stay plain `?qty=` links.

   `replaceState`, not `pushState`: choosing a quantity is not a page the Back
   button should step through.
   --------------------------------------------------------------------------- */

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

import { PRODUCT_PARAM, type QuantityKey } from "@/features/product/types";

interface QuantityState {
  quantity: QuantityKey;
  setQuantity: (next: QuantityKey) => void;
}

const QuantityContext = createContext<QuantityState | null>(null);

export function QuantityProvider({
  initial,
  children,
}: {
  /** The server's reading of `?qty=` (`view.quantity`). */
  initial: QuantityKey;
  children: ReactNode;
}) {
  const [quantity, setLocal] = useState(initial);
  /* A navigation that brings a new `?qty=` from the server (another product,
     Back to a URL the server rendered) resets the choice, during render, the
     D84 pattern; an effect would paint the stale cell for a frame. */
  const [seen, setSeen] = useState(initial);
  if (initial !== seen) {
    setSeen(initial);
    setLocal(initial);
  }

  const setQuantity = useCallback((next: QuantityKey) => {
    setLocal(next);
    const url = new URL(window.location.href);
    url.searchParams.set(PRODUCT_PARAM.qty, next);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  return (
    <QuantityContext.Provider value={{ quantity, setQuantity }}>
      {children}
    </QuantityContext.Provider>
  );
}

/** The live selection, or `null` outside a `QuantityProvider`. */
export function useQuantity(): QuantityState | null {
  return useContext(QuantityContext);
}
