"use client";

/* ---------------------------------------------------------------------------
   LinkRowActions — Cancel and Check payment on one row of the links list.

   Each is a small form on its own Server Action (`payment-link-actions.ts`),
   carrying the CSRF token like every admin mutation (D95). Cancel asks for a
   confirm first: it cannot be undone, and the customer may be holding the
   link. Neither can move money; refunds live in the Stripe Dashboard
   (`docs/payments.md` §5.7). Check payment (D108 reversed) asks Stripe about
   the row's pending attempts, for a customer who says they paid.
   --------------------------------------------------------------------------- */

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { cancelPaymentLink, checkPaymentLink } from "@/features/admin/payment-link-actions";
import { ADMIN_CSRF_FIELD, LINK_ACTION_INITIAL_STATE, PAYMENT_LINK_ID_FIELD } from "@/features/admin/types";

export function LinkRowActions({
  csrfToken,
  linkId,
  canCancel,
  canCheck,
}: {
  csrfToken: string;
  linkId: string;
  canCancel: boolean;
  canCheck: boolean;
}) {
  const [cancelState, cancelAction, cancelling] = useActionState(cancelPaymentLink, LINK_ACTION_INITIAL_STATE);
  const [checkState, checkAction, checking] = useActionState(checkPaymentLink, LINK_ACTION_INITIAL_STATE);
  // Both answers stay on screen: Check payment, then Cancel, reads as two things that happened.
  const messages = [checkState, cancelState].flatMap((state) => (state.status === "idle" ? [] : [state.message]));

  if (!canCancel && !canCheck && messages.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {canCheck ? (
          <form action={checkAction}>
            <input type="hidden" name={ADMIN_CSRF_FIELD} value={csrfToken} />
            <input type="hidden" name={PAYMENT_LINK_ID_FIELD} value={linkId} />
            <Button type="submit" variant="secondary" size="compact" disabled={checking}>
              {checking ? "Checking…" : "Check payment"}
            </Button>
          </form>
        ) : null}
        {canCancel ? (
          <form
            action={cancelAction}
            onSubmit={(event) => {
              if (!window.confirm("Cancel this link? The customer will no longer be able to pay it.")) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name={ADMIN_CSRF_FIELD} value={csrfToken} />
            <input type="hidden" name={PAYMENT_LINK_ID_FIELD} value={linkId} />
            <Button type="submit" variant="tertiary" size="compact" disabled={cancelling}>
              {cancelling ? "Cancelling…" : "Cancel link"}
            </Button>
          </form>
        ) : null}
      </div>
      {messages.map((message) => (
        <p key={message} role="status" className="text-ink text-13 leading-body">
          {message}
        </p>
      ))}
    </div>
  );
}
