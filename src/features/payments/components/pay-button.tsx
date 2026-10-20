"use client";

/* ---------------------------------------------------------------------------
   PayButton — the `/pay/<token>` page's one client island.

   One plain form. Press Pay → `startPayment` opens (or reopens) a Stripe
   Checkout Session and redirects the browser to it. The action only returns
   for an error, which the island shows.

   The button ignores presses while pending: a second press would only reopen
   the same session now, but it is still a wasted round trip. It is
   `aria-disabled`, not `disabled` (D145 audit, A11Y-MANUAL; D151): a
   `disabled` button drops keyboard focus to <body>, and focus stayed there
   when an error came back. The click handler is what refuses the press; the
   classes repeat the primary button's `disabled:` look for `aria-disabled`.
   When an error comes back, focus moves to it.

   Back from Stripe: Safari and Chrome may restore this page from the
   back/forward cache with the button frozen in its pending state. `pageshow`
   with `persisted` reloads it, so Pay is live again and the page re-reads the
   real state (plan v3 §0 #8).
   --------------------------------------------------------------------------- */

import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { startPayment, type PayState } from "@/features/payments/pay-actions";

const INITIAL: PayState = { status: "idle" };

export function PayButton({ publicToken, amountLabel }: { publicToken: string; amountLabel: string }) {
  const [state, formAction, isPending] = useActionState(startPayment.bind(null, publicToken), INITIAL);
  const errorRef = useRef<HTMLParagraphElement>(null);

  // A new state object per answer, so a second identical error refocuses too.
  useEffect(() => {
    if (state.status === "error") errorRef.current?.focus();
  }, [state]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return (
    <form action={formAction} aria-busy={isPending || undefined} className="flex flex-col gap-3">
      <Button
        type="submit"
        variant="primary"
        size="panel"
        fullWidth
        aria-disabled={isPending || undefined}
        onClick={(event) => {
          // Enter on the focused button arrives here as a click too.
          if (isPending) event.preventDefault();
        }}
        className="aria-disabled:translate-y-0 aria-disabled:bg-surface aria-disabled:text-ink-dim aria-disabled:hover:bg-surface aria-disabled:active:translate-y-0 aria-disabled:active:bg-surface"
      >
        {isPending ? "Opening secure payment…" : `Pay ${amountLabel}`}
      </Button>
      {state.status === "error" ? (
        <p ref={errorRef} role="alert" tabIndex={-1} className="text-ink text-14 leading-body">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
