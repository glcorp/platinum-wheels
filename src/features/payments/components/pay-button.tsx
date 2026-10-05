"use client";

/* ---------------------------------------------------------------------------
   PayButton — the `/pay/<token>` page's one client island.

   Press Pay → `startPayment` opens a Converge session → this island renders a
   form that POSTs the one-time token to Converge's hosted page and submits it.
   The form is visible, with its own button, so a browser that blocks the
   automatic submit still has a way forward.

   The hand-off form is a NEW element (its own `key`), never the Pay form
   reused (D125b). The server renders the Pay form with hidden `$ACTION_*`
   inputs for progressive enhancement; React leaves them in the DOM after
   hydration. When both states rendered a <form> at the same position, React
   kept that element, so the hand-off posted `$ACTION_KEY`, `$ACTION_1:0`
   and `$ACTION_1:1` to Converge along with the token. Converge stored them
   on the session and its hosted page then failed every card with
   errorType SYSTEM. Only `ssl_txn_auth_token` may be posted.

   The button ignores presses while pending: a second press would open a
   second session, and two sessions on one link is how a double charge starts.
   It is `aria-disabled`, not `disabled` (D145 audit, A11Y-MANUAL; D151):
   a `disabled` button drops keyboard focus to <body>, and focus stayed there
   when an error came back. The click handler is what refuses the press; the
   classes repeat the primary button's `disabled:` look for `aria-disabled`.
   When an error comes back, focus moves to it.
   --------------------------------------------------------------------------- */

import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { startPayment, type PayState } from "@/features/payments/pay-actions";

const INITIAL: PayState = { status: "idle" };

export function PayButton({ publicToken, amountLabel }: { publicToken: string; amountLabel: string }) {
  const [state, formAction, isPending] = useActionState(startPayment.bind(null, publicToken), INITIAL);
  const handoffRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  // A new state object per answer, so a second identical error refocuses too.
  useEffect(() => {
    if (state.status === "error") errorRef.current?.focus();
  }, [state]);

  useEffect(() => {
    if (state.status !== "redirect") return;
    const form = handoffRef.current;
    if (!form) return;
    // Belt and braces: nothing but the token leaves this form (D125b).
    for (const input of Array.from(form.querySelectorAll("input"))) {
      if (input.name !== "ssl_txn_auth_token") input.remove();
    }
    form.submit();
  }, [state]);

  if (state.status === "redirect") {
    return (
      <form
        key="handoff"
        ref={handoffRef}
        method="post"
        action={state.hostedPageUrl}
        className="flex flex-col gap-3"
      >
        <input type="hidden" name="ssl_txn_auth_token" value={state.token} />
        <p role="status" className="text-ink-muted text-14 leading-body">
          Taking you to our secure payment page…
        </p>
        <Button type="submit" variant="primary" size="panel" fullWidth>
          Continue to payment
        </Button>
      </form>
    );
  }

  return (
    <form key="start" action={formAction} aria-busy={isPending || undefined} className="flex flex-col gap-3">
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
