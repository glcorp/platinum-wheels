"use server";

/* ---------------------------------------------------------------------------
   startPayment — the customer's Pay button (D100).

   The only input is the link's public token, bound on the server by the page.
   Amount and description are read from the database inside `startAttempt`;
   nothing the browser could edit reaches Stripe.

   On success this **redirects** to the Stripe-hosted page (a 303 for a Server
   Action), so it only returns for an error. The redirect happens outside any
   try/catch (Next's redirect is an exception) and, with JavaScript off, the
   form post is answered with a 303 to Stripe that the browser follows with a
   GET and no form body (the Converge-era `$ACTION_*` leak, D125b, cannot recur).
   --------------------------------------------------------------------------- */

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { PAY_PATH_PREFIX, PaymentsNotConfiguredError, paymentsEnabled, publicPayOrigin } from "./config";
import { startAttempt } from "./service";
import { stripeGateway } from "./stripe";

export type PayState = { status: "idle" } | { status: "error"; message: string };

const CALL_US = "Online payment is not available right now. Please call us to pay.";

/** The origin the customer is on. Production always uses the pay host. */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return publicPayOrigin(`${proto}://${host}`);
}

export async function startPayment(publicToken: string): Promise<PayState> {
  if (!paymentsEnabled()) return { status: "error", message: CALL_US };

  let gateway;
  try {
    gateway = stripeGateway();
  } catch (error) {
    if (error instanceof PaymentsNotConfiguredError) {
      console.error(JSON.stringify({ at: "payments.startPayment", detail: error.message }));
      return { status: "error", message: CALL_US };
    }
    throw error;
  }

  const returnUrl = `${await requestOrigin()}${PAY_PATH_PREFIX}/${publicToken}`;
  const result = await startAttempt(publicToken, gateway, returnUrl);
  switch (result.kind) {
    case "redirect":
      // Next splits the `x-action-redirect` header on `;`: a URL carrying one
      // would be cut short. Stripe's never does; refuse rather than misroute.
      if (result.url.includes(";")) {
        console.error(JSON.stringify({ at: "payments.startPayment", detail: "session url contains ;" }));
        return { status: "error", message: CALL_US };
      }
      redirect(result.url);
    // falls through only for the type checker: `redirect` never returns
    case "in_progress":
      return { status: "error", message: "Your payment page is being opened. Wait a few seconds, then press Pay again." };
    case "unavailable":
      return {
        status: "error",
        message: "We couldn't reach the payment service. No payment was taken. Try again in a minute, or call us.",
      };
    case "not_payable":
      return {
        status: "error",
        message:
          result.state === "paid"
            ? "This link has already been paid."
            : result.state === "too_many_attempts"
              ? "This link has had too many payment attempts. Please call us."
              : "This link can no longer be paid. Please contact us for a new one.",
      };
  }
}
