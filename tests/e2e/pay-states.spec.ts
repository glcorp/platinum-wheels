/**
 * The customer's payment pages and return route, end to end (D100, D105, D108,
 * LA-01/LA-02). Needs the fixture database (`tests/llm.md`), which seeds one
 * link per state a customer can meet (`tests/fixture/fixture.mjs`): open, paid,
 * cancelled and expired.
 *
 * Reaching `/pay` locally: the host rules are production only (D97, D115), so
 * outside production `/pay/**` is served on the storefront host itself and no
 * `Host` header is needed. Production serves it on `pay.platinumwheels.ca`
 * alone; that is a deploy check, not provable here.
 *
 * No gateway exists in the fixture: `CONVERGE_*` are made-up values and the
 * proxy (`FIXIE_URL`) is a closed port, so a press of Pay reaches nothing and
 * no money, session or email can be involved.
 */
import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { PAY_TOKEN, settle } from "../helpers";

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "chromium-1440", "server-rendered states; one project is enough");
});

const COOKIE = "pw_pay";

/* ---------- the four states a link can be in ---------- */

const STATES = [
  {
    name: "open",
    token: PAY_TOKEN.open,
    heading: "Payment request",
    amount: "$1,284.50 CAD",
    body: /Pay by/,
    pay: true,
  },
  {
    name: "paid",
    token: PAY_TOKEN.paid,
    heading: "Paid. Thank you.",
    amount: "$999.00 CAD",
    body: /Your payment went through\. Keep the reference PW-\d+ for your records\./,
    pay: false,
  },
  {
    name: "cancelled",
    token: PAY_TOKEN.cancelled,
    heading: "This link is closed",
    amount: "$50.00 CAD",
    body: /This payment link has been withdrawn\. Contact us and we'll send you a new one\./,
    pay: false,
  },
  {
    name: "expired",
    token: PAY_TOKEN.expired,
    heading: "This link is closed",
    amount: "$250.00 CAD",
    body: /This payment link has expired\. Contact us and we'll send you a new one\./,
    pay: false,
  },
] as const;

for (const state of STATES) {
  test(`${state.name} link: heading, amount, ${state.pay ? "a Pay button" : "no way to pay"}, and passes axe`, async ({
    page,
  }) => {
    const res = await page.goto(`/pay/${state.token}`);
    expect(res?.status()).toBe(200);
    await settle(page);

    await expect(page.getByRole("heading", { level: 1, name: state.heading })).toBeVisible();
    await expect(page.getByRole("main").getByText(state.amount)).toBeVisible();
    await expect(page.getByRole("main").getByText(state.body)).toBeVisible();
    // The reference is the database's, `PW-<n>`, and is shown in every state.
    await expect(page.getByRole("main").getByText(/^PW-\d+$/)).toBeVisible();

    const pay = page.getByRole("button", { name: /^Pay \$/ });
    if (state.pay) {
      await expect(pay).toBeVisible();
      await expect(pay).toHaveText(`Pay ${state.amount.replace(" CAD", "")}`);
    } else {
      // A paid, withdrawn or expired link must never render a Pay button again.
      await expect(pay).toHaveCount(0);
    }
    // Staff typed the description; it is on the page as text.
    await expect(page.getByRole("main").getByText(/\(fixture\)$/)).toBeVisible();

    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
}

/* ---------- a link the database does not hold ---------- */

for (const [what, token] of [
  ["an unknown token", PAY_TOKEN.unknown],
  ["a token of the wrong shape", "short"],
  ["a token with a path in it", "..%2f..%2fetc%2fpasswd"],
] as const) {
  test(`${what} is a real 404 and never a payment page`, async ({ page, request }) => {
    const raw = await request.get(`/pay/${token}`, { maxRedirects: 0 });
    expect(raw.status()).toBe(404);
    const res = await page.goto(`/pay/${token}`);
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("button", { name: /^Pay / })).toHaveCount(0);
  });
}

/* ---------- headers: the URL is a capability (D105) ---------- */

test("a link page is never cached, never indexed and leaks only an origin", async ({ request }) => {
  const res = await request.get(`/pay/${PAY_TOKEN.open}`);
  const headers = res.headers();
  expect(headers["cache-control"]).toContain("no-store");
  expect(headers["x-robots-tag"]).toContain("noindex");
  expect(headers["referrer-policy"]).toBe("strict-origin");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(await res.text()).toMatch(/<meta name="robots" content="[^"]*noindex/);
});

/* ---------- /pay/return (LA-01, LA-02): never a link the cookie does not name ---------- */

const returnTo = async (
  request: import("@playwright/test").APIRequestContext,
  query: string,
  cookie?: string,
) => {
  const res = await request.get(`/pay/return${query}`, {
    maxRedirects: 0,
    headers: cookie ? { Cookie: `${COOKIE}=${cookie}` } : {},
  });
  expect(res.status(), `/pay/return${query}`).toBe(303);
  return new URL(res.headers()["location"] ?? "", res.url()).pathname;
};

test("a return with no cookie lands on /pay/done, whatever it carries", async ({ request }) => {
  expect(await returnTo(request, "")).toBe("/pay/done");
  // A transaction id or an invoice number in the URL must not pick a link page
  // (LA-02): invoice numbers are sequential, so that would walk through links.
  expect(await returnTo(request, "?ssl_txn_id=0123-4567&ssl_invoice_number=PW10001N1")).toBe("/pay/done");
  expect(await returnTo(request, `?ssl_invoice_number=PW10001N1&token=${PAY_TOKEN.open}`)).toBe("/pay/done");
});

test("a return whose cookie names no link lands on /pay/done", async ({ request }) => {
  expect(await returnTo(request, "?ssl_txn_id=0123-4567", PAY_TOKEN.unknown)).toBe("/pay/done");
  expect(await returnTo(request, "", "not-a-token")).toBe("/pay/done");
});

test("a return goes only to the link the browser's own cookie names", async ({ request }) => {
  // The cookie names the paid link; the query tries to name the open one.
  expect(await returnTo(request, `?ssl_invoice_number=PW10001N1&token=${PAY_TOKEN.open}`, PAY_TOKEN.paid)).toBe(
    `/pay/${PAY_TOKEN.paid}`,
  );
  expect(await returnTo(request, "", PAY_TOKEN.open)).toBe(`/pay/${PAY_TOKEN.open}`);
});

test("/pay/done claims nothing about the payment and sends the customer to the shop", async ({ page }) => {
  const res = await page.goto("/pay/done");
  expect(res?.status()).toBe(200);
  await settle(page);
  await expect(page.getByRole("heading", { level: 1, name: "We couldn't confirm your payment" })).toBeVisible();
  await expect(page.getByRole("main").getByText(/please don't pay again/)).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: /^\+1/ })).toHaveAttribute("href", /^tel:\+1/);
  await expect(page.getByRole("main").getByRole("link", { name: "sales@platinumwheels.ca" })).toHaveAttribute(
    "href",
    "mailto:sales@platinumwheels.ca",
  );
});

/* ---------- Pay, with no gateway to reach ---------- */

test("pressing Pay with the gateway unreachable says so, takes no payment and leaves the link open", async ({ page }) => {
  await page.goto(`/pay/${PAY_TOKEN.open}`);
  await settle(page);
  const pay = page.getByRole("button", { name: /^Pay \$/ });
  const alert = page.getByRole("main").getByRole("alert");

  // The island works once hydrated; a press before that is a plain form post.
  await expect(async () => {
    await pay.click({ timeout: 2_000 });
    await expect(alert).toBeVisible({ timeout: 2_500 });
  }).toPass({ timeout: 20_000 });

  await expect(alert).toHaveText(/We couldn't reach the payment service\. No payment was taken\./);
  await expect(alert).toBeFocused();
  // Still on our page: nothing was handed to a gateway.
  await expect(page).toHaveURL(new RegExp(`/pay/${PAY_TOKEN.open}$`));
  await expect(page.getByRole("button", { name: /^Pay \$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue to payment" })).toHaveCount(0);

  // The attempt was recorded as failed, and the page now says what happened
  // and that trying again is safe (D100).
  await page.reload();
  await settle(page);
  await expect(page.getByRole("main").getByRole("status")).toContainText(
    "Your last attempt didn't reach the payment service, so nothing was charged. You can try again.",
  );
  await expect(page.getByRole("button", { name: /^Pay \$/ })).toBeVisible();
});
