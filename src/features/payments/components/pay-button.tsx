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

   The button disables while pending: a second press would open a second
   session, and two sessions on one link is how a double charge starts.
   --------------------------------------------------------------------------- */

import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { startPayment, type PayState } from "@/features/payments/pay-actions";

const INITIAL: PayState = { status: "idle" };

export function PayButton({ publicToken, amountLabel }: { publicToken: string; amountLabel: string }) {
  const [state, formAction, isPending] = useActionState(startPayment.bind(null, publicToken), INITIAL);
  const handoffRef = useRef<HTMLFormElement>(null);

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
    <form key="start" action={formAction} className="flex flex-col gap-3">
      <Button type="submit" variant="primary" size="panel" fullWidth disabled={isPending}>
        {isPending ? "Opening secure payment…" : `Pay ${amountLabel}`}
      </Button>
      {state.status === "error" ? (
        <p role="alert" className="text-ink text-14 leading-body">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
