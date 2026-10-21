/* ---------------------------------------------------------------------------
   A stand-in for Stripe's API, as its own process (`run.mjs`), so the pay
   flow can run end to end with no network, no key and no money: create a
   Checkout Session, read it back, expire it, and (test control) "pay" it.

   It speaks only what `src/features/payments/stripe.ts` calls:
     POST /v1/checkout/sessions            create (idempotency-key honoured)
     GET  /v1/checkout/sessions/:id        retrieve (payment_intent expanded when paid)
     POST /v1/checkout/sessions/:id/expire expire
   and a control surface for the tests, never used by the app:
     GET  /__fake/sessions                 every session, newest last
     POST /__fake/pay/:id                  complete and pay it (a card payment)
     POST /__fake/expire/:id               expire it without the app asking

   The app reaches it through `STRIPE_API_HOST` / `STRIPE_API_PORT`, which
   `stripe.ts` honours only with a test key outside production. It rejects the
   parameter `payment_method_types`, which Stripe removed in API 2026-09-30.
   --------------------------------------------------------------------------- */
import { createServer } from "node:http";

const PORT = Number(process.env.FIXTURE_STRIPE_PORT ?? 3591);

/** @type {Map<string, any>} */
const sessions = new Map();
/** @type {Map<string, string>} */
const idempotent = new Map();
let counter = 0;

const json = (res, status, body) =>
  res.writeHead(status, { "content-type": "application/json", "request-id": `req_fake_${++counter}` }).end(JSON.stringify(body));

const missing = (res, what) =>
  json(res, 404, { error: { type: "invalid_request_error", code: "resource_missing", message: `No such ${what}` } });

/** Stripe reads form bodies with bracket keys (`line_items[0][price_data][unit_amount]`). */
const form = (text) => Object.fromEntries(new URLSearchParams(text));

function view(session, expand) {
  const out = { ...session };
  const paid = session.status === "complete";
  out.url = session.status === "open" ? session.url : null;
  const intent = paid
    ? {
        id: session.payment_intent_id,
        object: "payment_intent",
        latest_charge: {
          id: `ch_fake_${session.payment_intent_id}`,
          object: "charge",
          payment_method_details: { type: "card", card: { brand: "visa", last4: "4242" } },
        },
      }
    : null;
  out.payment_intent = intent ? (expand.includes("payment_intent.latest_charge") ? intent : intent.id) : null;
  delete out.payment_intent_id;
  return out;
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://fake");
  let body = "";
  for await (const chunk of req) body += chunk;
  const fields = form(body);
  const path = url.pathname;

  if (req.method === "POST" && path === "/v1/checkout/sessions") {
    const key = req.headers["idempotency-key"];
    if (typeof key === "string" && idempotent.has(key)) return json(res, 200, view(sessions.get(idempotent.get(key)), []));
    if (Object.keys(fields).some((name) => name.startsWith("payment_method_types"))) {
      return json(res, 400, { error: { type: "invalid_request_error", message: "payment_method_types was removed" } });
    }
    const amount = Number(fields["line_items[0][price_data][unit_amount]"]);
    if (fields.mode !== "payment" || !Number.isInteger(amount) || amount < 50 || !fields.client_reference_id) {
      return json(res, 400, { error: { type: "invalid_request_error", message: "bad checkout session request" } });
    }
    const id = `cs_test_fake${String(++counter).padStart(4, "0")}`;
    const session = {
      id,
      object: "checkout.session",
      status: "open",
      payment_status: "unpaid",
      currency: "cad",
      livemode: false,
      amount_total: amount,
      amount_subtotal: amount,
      client_reference_id: fields.client_reference_id,
      expires_at: Number(fields.expires_at),
      success_url: fields.success_url,
      metadata: { reference: fields["metadata[reference]"] ?? null },
      url: `https://checkout.stripe.com/c/pay/${id}`,
      customer_details: null,
      payment_intent_id: null,
      created_params: fields,
    };
    sessions.set(id, session);
    if (typeof key === "string") idempotent.set(key, id);
    return json(res, 200, view(session, []));
  }

  const one = /^\/v1\/checkout\/sessions\/([^/]+)(\/expire)?$/.exec(path);
  if (one) {
    const session = sessions.get(one[1]);
    if (!session) return missing(res, "checkout.session");
    if (req.method === "POST" && one[2]) {
      if (session.status !== "open") {
        return json(res, 400, { error: { type: "invalid_request_error", message: "Only open sessions can be expired" } });
      }
      session.status = "expired";
      return json(res, 200, view(session, []));
    }
    if (req.method === "GET") {
      const expand = url.searchParams.getAll("expand[]");
      return json(res, 200, view(session, expand));
    }
  }

  if (req.method === "GET" && path === "/__fake/sessions") {
    return json(res, 200, [...sessions.values()].map((s) => ({ ...view(s, []), payment_intent: s.payment_intent_id })));
  }
  const control = /^\/__fake\/(pay|expire)\/([^/]+)$/.exec(path);
  if (req.method === "POST" && control) {
    const session = sessions.get(control[2]);
    if (!session) return missing(res, "checkout.session");
    if (control[1] === "pay") {
      session.status = "complete";
      session.payment_status = "paid";
      session.payment_intent_id = `pi_fake${String(++counter).padStart(4, "0")}`;
      session.customer_details = {
        name: "Fixture Buyer",
        email: "buyer@example.test",
        phone: "+14165550100",
        address: { postal_code: "L6T 1A1" },
      };
    } else {
      session.status = "expired";
    }
    return json(res, 200, { id: session.id, status: session.status, payment_intent: session.payment_intent_id });
  }

  res.writeHead(404).end();
}).listen(PORT, "127.0.0.1");
