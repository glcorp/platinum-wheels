"use server";

/* ---------------------------------------------------------------------------
   startPayment — the customer's Pay button (D100).

   The only input is the link's public token, bound on the server by the page.
   Amount and description are read from the database inside `startAttempt`;
   nothing the browser could edit reaches the gateway.

   Returns the hosted-page URL and one-time token rather than redirecting:
   Elavon's documented hand-off is a browser **POST** of `ssl_txn_auth_token`,
   which a Server Action redirect (always GET) cannot make. The island posts it.
   --------------------------------------------------------------------------- */

import { PaymentsNotConfiguredError } from "./config";
import { convergeGateway } from "./converge";
import { startAttempt } from "./service";

export type PayState =
  | { status: "idle" }
  | { status: "redirect"; hostedPageUrl: string; token: string }
  | { status: "error"; message: string };

export async function startPayment(publicToken: string): Promise<PayState> {
  let gateway;
  try {
    gateway = convergeGateway();
  } catch (error) {
    if (error instanceof PaymentsNotConfiguredError) {
      console.error(JSON.stringify({ at: "payments.startPayment", detail: error.message }));
      return { status: "error", message: "Online payment is not available right now. Please call us to pay." };
    }
    throw error;
  }

  const result = await startAttempt(publicToken, gateway);
  switch (result.kind) {
    case "redirect":
      return { status: "redirect", hostedPageUrl: result.hostedPageUrl, token: result.token };
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
