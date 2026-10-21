import { NextResponse } from "next/server";

import { PaymentsNotConfiguredError, getStripeConfig, getWebhookSecrets } from "@/features/payments/config";
import { processStripeEvent } from "@/features/payments/service";
import { stripeClient, stripeGateway } from "@/features/payments/stripe";

/* ---------------------------------------------------------------------------
   POST /pay/webhook — Stripe's event destination.

   The normal way a payment settles. Everything in the body is UNTRUSTED until
   the signature checks out, and even then only the event's `type` and the
   object's id are used: the session is re-read from Stripe before anything
   changes (`settleAttempt`).

   Rules (plan v3 §3):
     - the body is read once, as text, before anything else (the signature is
       over the raw bytes);
     - 400 only for a bad or missing signature, 500 only for our own failure
       (database, Stripe unreachable), so Stripe retries those;
     - 200 for a valid event that matches nothing here: the client's Stripe
       account may carry other sales;
     - 200 for an event whose `livemode` differs from our key's, never acted on;
     - the default 5-minute timestamp tolerance, never 0;
     - the URL has no trailing slash (a redirect is a failed delivery) and the
       email is sent after the response, so the acknowledgement is quick.

   Never logs the body, the secret or customer details: event id, type, outcome.
   --------------------------------------------------------------------------- */

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  let secrets: string[];
  let livemode: boolean;
  try {
    secrets = getWebhookSecrets();
    livemode = getStripeConfig().livemode;
  } catch (error) {
    if (error instanceof PaymentsNotConfiguredError) {
      // Our setup is wrong, not the sender's: make Stripe retry and alert us.
      console.error(JSON.stringify({ at: "pay.webhook", reason: "not_configured", detail: error.message }));
      return NextResponse.json({ message: "not configured" }, { status: 500 });
    }
    throw error;
  }

  if (!signature) {
    console.warn(JSON.stringify({ at: "pay.webhook", reason: "missing_signature" }));
    return NextResponse.json({ message: "missing signature" }, { status: 400 });
  }

  const stripe = stripeClient();
  let event: ReturnType<typeof stripe.webhooks.constructEvent> | null = null;
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(body, signature, secret);
      break;
    } catch {
      // Try the previous secret (a roll in progress); fall through to 400.
    }
  }
  if (!event) {
    console.warn(JSON.stringify({ at: "pay.webhook", reason: "bad_signature" }));
    return NextResponse.json({ message: "bad signature" }, { status: 400 });
  }

  if (event.livemode !== livemode) {
    console.warn(JSON.stringify({ at: "pay.webhook", reason: "livemode_mismatch", id: event.id, type: event.type }));
    return NextResponse.json({ message: "ignored" }, { status: 200 });
  }

  try {
    const outcome = await processStripeEvent(event, stripeGateway());
    console.info(JSON.stringify({ at: "pay.webhook", id: event.id, type: event.type, outcome }));
    return NextResponse.json({ message: "received" }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({ at: "pay.webhook", id: event.id, type: event.type, detail: error instanceof Error ? error.message : "unknown" }));
    return NextResponse.json({ message: "error" }, { status: 500 });
  }
}
