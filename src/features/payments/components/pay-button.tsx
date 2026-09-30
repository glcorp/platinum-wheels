"use client";

/* ---------------------------------------------------------------------------
   PayButton — the `/pay/<token>` page's one client island.

   Press Pay → `startPayment` opens a Converge session → this island renders a
   form that POSTs the one-time token to Converge's hosted page and submits it.
   The form is visible, with its own button, so a browser that blocks the
   automatic submit still has a way forward.

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
    if (state.status === "redirect") handoffRef.current?.submit();
  }, [state]);

  if (state.status === "redirect") {
    return (
      <form ref={handoffRef} method="post" action={state.hostedPageUrl} className="flex flex-col gap-3">
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
    <form action={formAction} className="flex flex-col gap-3">
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
