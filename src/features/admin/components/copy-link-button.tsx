"use client";

/* ---------------------------------------------------------------------------
   CopyLinkButton — a leaf client island that copies one string to the
   clipboard (D89: no artboard draws this; authored from existing tokens).

   The Clipboard API needs a secure context and can reject outright — an
   iOS quirk, a permissions prompt the owner dismissed, an old in-app browser
   webview. None of that may throw unhandled out of a click handler, so every
   path is caught and turned into a visible state instead. The three states
   are idle / copied / failed, and `aria-live="polite"` on the status text
   means a screen reader learns the outcome even though the visible label is
   the only thing that changes — a label swap alone is silent to VoiceOver
   unless the region announcing it is live.

   Deliberately narrow: one prop, one job. It does not know what the value is
   for, so `payment-link-success.tsx` owns the surrounding copy.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

type CopyState = "idle" | "copied" | "failed";

const COPIED_RESET_MS = 2000;

const STATUS_COPY: Record<CopyState, string> = {
  idle: "Copy link",
  copied: "Copied",
  // Honest instruction for the one real-world case that fires this: an iOS
  // webview or a permissions prompt the owner dismissed, where the
  // Clipboard API silently refuses. A long-press select-and-copy always
  // works there even when the API does not.
  failed: "Press and hold to copy",
};

export interface CopyLinkButtonProps {
  value: string;
}

export function CopyLinkButton({ value }: CopyLinkButtonProps) {
  const [state, setState] = useState<CopyState>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clears the pending "copied -> idle" timer on unmount so it can never fire
  // a setState against a component that is no longer mounted.
  useEffect(() => {
    return () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }
    };
  }, []);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      // Permissions denial, non-secure context, or an API the browser does
      // not support — all the same outcome from the owner's side: it did not
      // copy, so say so honestly rather than claiming success.
      setState("failed");
      return;
    }

    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
    }
    resetTimer.current = setTimeout(() => setState("idle"), COPIED_RESET_MS);
  }

  return (
    <div className="inline-flex flex-col items-start">
      {/* The visible label is the primary indicator: it swaps across the
          three states below. A button's own text changing while it already
          has focus is not reliably re-announced by a screen reader on its
          own, so the `sr-only` region beneath it repeats the same message
          inside `aria-live="polite"` — the belt-and-braces the task calls
          for ("do not rely on the label change alone"). It stays mounted at
          every state, empty at idle, so the region is registered before the
          first update ever fires. */}
      <Button
        type="button"
        variant="secondary"
        size="compact"
        onClick={handleClick}
      >
        {STATUS_COPY[state]}
      </Button>
      <p aria-live="polite" className="sr-only">
        {state === "idle" ? "" : STATUS_COPY[state]}
      </p>
    </div>
  );
}
