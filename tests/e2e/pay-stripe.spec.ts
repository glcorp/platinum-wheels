/**
 * The Stripe round trip, end to end, against the fixture's Stripe stand-in
 * (`tests/fixture/stripe-fake.mjs`): press Pay, reuse the open page, settle by
 * webhook and by return, a refund notice, and cancelling a link with a page
 * open. Needs the fixture (`tests/llm.md`): the app runs with a sandbox-shaped
 * key whose API host is the stand-in, and `STRIPE_WEBHOOK_SECRET` below.
 *
 * What the fixture cannot prove: Stripe's own wire format (the stand-in is
 * written from the docs), the hosted page, Back from it on a phone, and the
 * `/pay` host rules (production only). Those are the sandbox checks in
 * `docs/payments.md` §9.
 *
 * Every test uses a link of its own (`fixture.pay.flow*`), because each one
 * changes state; the files that read the shared links never see them.
 */
import { createHmac } from "node:crypto";

import { test, expect, type Page } from "@playwright/test";
import { PAY_TOKEN, settle } from "../helpers";

const PORT = process.env.PW_PORT ?? "3100";
const ADMIN = `http://admin.localhost:${PORT}`;
const FAKE = `http://127.0.0.1:${process.env.FIXTURE_STRIPE_PORT ?? 3591}`;
const WEBHOOK_SECRET = "whsec_fixture_not_a_real_secret";
const USER = process.env.FIXTURE_ADMIN_USERNAME;
const PASSWORD = process.env.FIXTURE_ADMIN_PASSWORD;

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "chromium-1440", "one project; the flows change shared rows");
  test.skip(!process.env.PW_FIXTURE, "needs the fixture's Stripe stand-in: run `npm run test:e2e:fixture`");
});

// Serial, and never retried: every test changes a link's state, so a retry would meet the rows its
// first run left behind and fail for that reason, hiding the real one.
test.describe.configure({ mode: "serial", retries: 0 });

interface FakeSession {
  id: string;
  status: string;
  success_url: string;
  payment_intent: string | null;
}

async function fakeSessions(token: string): Promise<FakeSession[]> {
  const all = (await (await fetch(`${FAKE}/__fake/sessions`)).json()) as FakeSession[];
  return all.filter((session) => session.success_url.includes(`/pay/${token}?`));
}

async function fakePay(sessionId: string) {
  const res = await fetch(`${FAKE}/__fake/pay/${sessionId}`, { method: "POST" });
  expect(res.status).toBe(200);
}

function signed(payload: string, secret = WEBHOOK_SECRET) {
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return { "content-type": "application/json", "stripe-signature": `t=${t},v1=${v1}` };
}

let eventCounter = 0;
function eventBody(type: string, object: Record<string, unknown>) {
  return JSON.stringify({ id: `evt_fixture_${Date.now()}_${++eventCounter}`, object: "event", type, livemode: false, data: { object } });
}

/** Stripe's hosted page does not exist here: answer for it, and record that the
 *  browser got there. */
async function stubCheckout(page: Page) {
  await page.route("https://checkout.stripe.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<title>Stripe Checkout stand-in</title><p>stand-in</p>" }),
  );
}

async function pressPay(page: Page) {
  const pay = page.getByRole("button", { name: /^Pay \$/ });
  // The island works once hydrated; a press before that is a plain form post,
  // which does the same thing.
  await pay.click();
}

async function signIn(page: Page) {
  await page.goto(`${ADMIN}/login`);
  await settle(page);
  await page.getByLabel(/Username/).fill(USER!);
  await page.getByLabel(/Password/).fill(PASSWORD!);
  await page.getByRole("button", { name: /^Sign in/ }).click();
  await expect(page).toHaveURL(`${ADMIN}/`);
  await page.goto(`${ADMIN}/`);
  await settle(page);
}

/* ---------- the webhook's front door ---------- */

test("a webhook signed with the wrong secret is refused with 400", async ({ request }) => {
  const body = eventBody("checkout.session.completed", { id: "cs_test_nope" });
  const res = await request.post("/pay/webhook", { data: body, headers: signed(body, "whsec_someone_elses_secret") });
  expect(res.status()).toBe(400);
});

test("a correctly signed event that matches nothing here is acknowledged with 200", async ({ request }) => {
  const body = eventBody("checkout.session.completed", { id: "cs_test_not_ours" });
  const res = await request.post("/pay/webhook", { data: body, headers: signed(body) });
  expect(res.status()).toBe(200);
});

test("an event from the other mode is acknowledged and never acted on", async ({ request }) => {
  const body = JSON.stringify({ id: "evt_live_elsewhere", type: "checkout.session.completed", livemode: true, data: { object: { id: "cs_live_x" } } });
  const res = await request.post("/pay/webhook", { data: body, headers: signed(body) });
  expect(res.status()).toBe(200);
});

/* ---------- Pay with JavaScript off ---------- */

test.describe("Pay without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a plain form post is answered with a redirect to Stripe's page, and nothing else is sent there", async ({ page }) => {
    await stubCheckout(page);
    await page.goto(`/pay/${PAY_TOKEN.flowNoJs}`);
    await page.getByRole("button", { name: /^Pay \$/ }).click();
    await page.waitForURL(/^https:\/\/checkout\.stripe\.com\/c\/pay\/cs_test_fake\d+$/);
    // A GET with no query and no form body: the Converge-era `$ACTION_*` leak (D125b) cannot recur.
    expect(new URL(page.url()).search).toBe("");
    const [session] = await fakeSessions(PAY_TOKEN.flowNoJs);
    expect(session.status).toBe("open");
    expect(page.url()).toContain(session.id);
  });
});

/* ---------- Pay, reuse, webhook, refund ---------- */

test("pressing Pay twice lands on the same Stripe page; a signed webhook marks the link paid once", async ({
  page,
  request,
}) => {
  test.skip(!USER || !PASSWORD, "needs the fixture's admin credentials");
  await stubCheckout(page);
  await page.goto(`/pay/${PAY_TOKEN.flowWebhook}`);
  await settle(page);
  await pressPay(page);
  await page.waitForURL(/checkout\.stripe\.com\/c\/pay\/cs_test_fake\d+/);
  const first = page.url();

  // Back to our page (a fresh load: the bfcache path is the phone check), and press Pay again.
  await page.goto(`/pay/${PAY_TOKEN.flowWebhook}`);
  await settle(page);
  await expect(page.getByRole("main").getByRole("status")).toContainText("A payment page is already open for this link");
  await pressPay(page);
  await page.waitForURL(/checkout\.stripe\.com\/c\/pay\/cs_test_fake\d+/);
  expect(page.url()).toBe(first);
  const sessions = await fakeSessions(PAY_TOKEN.flowWebhook);
  expect(sessions).toHaveLength(1);

  // The customer pays on Stripe's page; Stripe's webhook arrives.
  await fakePay(sessions[0].id);
  const completed = eventBody("checkout.session.completed", { id: sessions[0].id });
  expect((await request.post("/pay/webhook", { data: completed, headers: signed(completed) })).status()).toBe(200);
  // The same event again (Stripe retries), and a second event for the same session.
  expect((await request.post("/pay/webhook", { data: completed, headers: signed(completed) })).status()).toBe(200);
  const again = eventBody("checkout.session.completed", { id: sessions[0].id });
  expect((await request.post("/pay/webhook", { data: again, headers: signed(again) })).status()).toBe(200);

  await page.goto(`/pay/${PAY_TOKEN.flowWebhook}`);
  await settle(page);
  await expect(page.getByRole("heading", { level: 1, name: "Paid. Thank you." })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Pay \$/ })).toHaveCount(0);

  // A refund Stripe reports: notify only. The link stays Paid and the admin flags it.
  const refund = eventBody("charge.refunded", {
    id: "ch_fixture_refund",
    payment_intent: (await fakeSessions(PAY_TOKEN.flowWebhook))[0].payment_intent,
    refunded: true,
    amount_refunded: 245_075,
  });
  expect((await request.post("/pay/webhook", { data: refund, headers: signed(refund) })).status()).toBe(200);
  expect((await request.post("/pay/webhook", { data: refund, headers: signed(refund) })).status()).toBe(200);

  await page.goto(`/pay/${PAY_TOKEN.flowWebhook}`);
  await expect(page.getByRole("heading", { level: 1, name: "Paid. Thank you." })).toBeVisible();

  await signIn(page);
  await page.goto(`${ADMIN}/payment-links`);
  await settle(page);
  const row = page.getByRole("listitem").filter({ hasText: "Flow: webhook settles (fixture)" });
  await expect(row.getByText("Paid", { exact: true }).first()).toBeVisible();
  await expect(row.getByText(/Refunded in Stripe/)).toBeVisible();
  await expect(row.getByText(/\bpi_fake\d+/).first()).toBeVisible();
  await expect(page.getByText(/^Last Stripe event:/)).toBeVisible();
});

/* ---------- return without a webhook ---------- */

test("a customer back from Stripe sees Paid even if the webhook never arrived", async ({ page }) => {
  await stubCheckout(page);
  await page.goto(`/pay/${PAY_TOKEN.flowReturn}`);
  await settle(page);
  await pressPay(page);
  await page.waitForURL(/checkout\.stripe\.com\/c\/pay\/cs_test_fake\d+/);
  const [session] = await fakeSessions(PAY_TOKEN.flowReturn);
  await fakePay(session.id);

  // Stripe sends the browser to `?paid=1`: the page re-reads the stored session.
  await page.goto(`/pay/${PAY_TOKEN.flowReturn}?paid=1`);
  await settle(page);
  await expect(page.getByRole("heading", { level: 1, name: "Paid. Thank you." })).toBeVisible();

  // A session id in the URL changes nothing: the page reads its own attempt.
  await page.goto(`/pay/${PAY_TOKEN.flowReturn}?paid=1&session_id=cs_test_fake9999`);
  await expect(page.getByRole("heading", { level: 1, name: "Paid. Thank you." })).toBeVisible();
});

/* ---------- cancelling a link closes the Stripe page ---------- */

test("cancelling a link with a Stripe page open expires that page", async ({ page }) => {
  test.skip(!USER || !PASSWORD, "needs the fixture's admin credentials");
  await stubCheckout(page);
  await page.goto(`/pay/${PAY_TOKEN.flowCancel}`);
  await settle(page);
  await pressPay(page);
  await page.waitForURL(/checkout\.stripe\.com\/c\/pay\/cs_test_fake\d+/);
  const [before] = await fakeSessions(PAY_TOKEN.flowCancel);
  expect(before.status).toBe("open");

  await signIn(page);
  await page.goto(`${ADMIN}/payment-links`);
  await settle(page);
  const row = page.getByRole("listitem").filter({ hasText: "Flow: cancel closes the page (fixture)" });
  await expect(row.getByText(/Payment started, not confirmed/)).toBeVisible();
  // Check payment asks Stripe: the customer has not finished, so the page is still open.
  await row.getByRole("button", { name: "Check payment" }).click();
  await expect(row.getByText(/has not finished paying/)).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Cancel link" }).click();
  await expect(row.getByText(/Link cancelled/)).toBeVisible();

  await expect.poll(async () => (await fakeSessions(PAY_TOKEN.flowCancel))[0].status).toBe("expired");
  await page.goto(`/pay/${PAY_TOKEN.flowCancel}`);
  await expect(page.getByRole("heading", { level: 1, name: "This link is closed" })).toBeVisible();
});
