/**
 * The customer's payment pages, end to end (D100, D105): the four states a
 * link can be in, the 404s, and the capability headers. The Stripe round trip
 * (Pay, the webhook, the return, cancel) is `pay-stripe.spec.ts`. Needs the
 * fixture database (`tests/llm.md`), which seeds one link per state a customer
 * can meet (`tests/fixture/fixture.mjs`): open, paid, cancelled and expired.
 *
 * Reaching `/pay` locally: the host rules are production only (D97, D115), so
 * outside production `/pay/**` is served on the storefront host itself and no
 * `Host` header is needed. Production serves it on `pay.platinumwheels.ca`
 * alone; that is a deploy check, not provable here.
 *
 * Stripe is a stand-in in the fixture (`tests/fixture/stripe-fake.mjs`), so no
 * money, real session or email can be involved.
 */
import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { PAY_TOKEN, settle } from "../helpers";

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "chromium-1440", "server-rendered states; one project is enough");
});

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

/* The pay 404 must paint without JavaScript (QA COPY-1, D184): Next 16.4 gives a
   `notFound()` thrown from a page an empty shell that only a browser running
   scripts fills, so `src/proxy.ts` serves the branded page itself. A customer
   with scripting off, or a mail client's link preview, still reads the phone
   and email. */
test.describe("the pay 404 without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  for (const path of [`/pay/${PAY_TOKEN.unknown}`, "/pay", "/pay/not/a/page", "/pay/short"]) {
    test(`${path} is a 404 with the branded page, the shop's phone and email and the pay headers`, async ({
      page,
    }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(404);
      expect(res?.headers()["x-robots-tag"]).toContain("noindex");
      expect(res?.headers()["cache-control"]).toContain("no-store");
      await expect(page.getByRole("heading", { level: 1, name: "Payment link not found" })).toBeVisible();
      await expect(page.getByRole("link", { name: /^\+1 / })).toHaveAttribute("href", /^tel:\+1\d{10}$/);
      await expect(page.getByRole("link", { name: /@/ })).toHaveAttribute("href", /^mailto:/);
      await expect(page.getByRole("button", { name: /^Pay / })).toHaveCount(0);
    });
  }

  test("a link that exists is not caught by it", async ({ page }) => {
    const res = await page.goto(`/pay/${PAY_TOKEN.open}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Payment request" })).toBeVisible();
  });
});

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
