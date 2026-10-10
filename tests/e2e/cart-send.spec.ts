/**
 * The cart's send, end to end (D122, D104, D123). Needs the fixture database
 * (`tests/llm.md`): a product to add, and the production build.
 *
 * Quote email is OFF in the fixture (`AUTO_EMAIL_LEAD_CAPTURE_ENABLED=false`),
 * so `deliverQuote` validates, logs `quote.email.disabled` and the action
 * answers `success`: the app's own success path is what these tests prove.
 * Nothing leaves the machine.
 *
 * One project only. The action is rate limited per IP (3 requests in 10
 * minutes, `LA-03`) and the limiter lives in the server's memory, so every run
 * of this file presents a fresh made-up client address in `x-forwarded-for`
 * and sends exactly one valid request.
 */
import { randomInt } from "node:crypto";

import { test, expect, type Page } from "@playwright/test";
import { SLUG, settle } from "../helpers";

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "chromium-1440", "one valid send per run; the quote form is rate limited per IP");
});

test.use({
  extraHTTPHeaders: { "x-forwarded-for": `10.${randomInt(1, 250)}.${randomInt(1, 250)}.${randomInt(1, 250)}` },
});

/** The header's cart. A link everywhere except on `/cart`, where it stays but
 *  is not a link and reads "..., current page" (D127(3)); matched by its label
 *  so both are one locator. */
const cartLink = (page: Page) => page.getByRole("banner").getByLabel(/^Cart/);

/** Press `Add to cart` on a product page until the header's count shows it.
 *  The button only works once hydrated, so a first press may do nothing; the
 *  loop never presses again once the cart has the product. */
async function addToCart(page: Page, slug: string) {
  await page.goto(`/products/${slug}`);
  await settle(page);
  // The buy panel's own button is named exactly "Add to cart"; the Similar
  // products cards below it carry the product's name after the same words.
  const button = page.getByRole("main").getByRole("button", { name: "Add to cart", exact: true });
  await expect(async () => {
    const label = (await cartLink(page).getAttribute("aria-label")) ?? "";
    if (!/^Cart, \d/.test(label)) {
      await button.click({ timeout: 2_000 });
    }
    await expect(cartLink(page)).toHaveAttribute("aria-label", /^Cart, \d+ items?$/, { timeout: 1_500 });
  }).toPass();
}

test("an empty cart says so and offers the way back", async ({ page }) => {
  await page.goto("/cart");
  await settle(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/^Your cart is empty\./)).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Shop tires" })).toHaveAttribute("href", "/tires");
  await expect(page.getByRole("main").getByRole("link", { name: /^Call / })).toHaveAttribute("href", /^tel:\+1/);
  // No count on the header mark while the cart is empty; not a link on /cart.
  await expect(cartLink(page)).toHaveAttribute("aria-label", "Cart, current page");
  await expect(page.getByRole("banner").getByRole("link", { name: /^Cart/ })).toHaveCount(0);
});

test("add a tire, request one quote, see the success panel, and the cart empties", async ({ page }) => {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(e.message));

  await addToCart(page, SLUG.tire);

  // To the cart by the header link, as a visitor goes.
  await page.getByRole("banner").getByRole("link", { name: /^Cart, 1 item$/ }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await settle(page);
  const lines = page.getByRole("list", { name: "Products in your cart" });
  await expect(lines.getByRole("listitem")).toHaveCount(1);
  await expect(lines.getByRole("link", { name: /Antarctica Sport/ })).toHaveAttribute(
    "href",
    new RegExp(`/products/${SLUG.tire}`),
  );

  // Open the dialog from the one place a request starts (D122).
  await page.getByRole("button", { name: "Request a quote" }).click();
  const dialog = page.getByRole("dialog", { name: "Tell us where to send it." });
  await expect(dialog).toBeVisible();
  const openedAt = await page.evaluate(() => performance.now());

  // The server ignores a send made in under 3 s of the dialog first opening
  // and answers success without validating (D104): even an empty one, which
  // would empty the cart. Wait the real time first, on a condition, so what is
  // proved below is the validation and the send, not the spam guard.
  await page.waitForFunction((t0) => performance.now() - t0 > 3_500, openedAt);

  // An empty send is refused with the summary and focus on the first field.
  await dialog.getByRole("button", { name: /^Send inquiry/ }).click();
  await expect(dialog.getByRole("alert").first()).toContainText(/3 fields need a fix/);
  await expect(dialog.getByRole("textbox", { name: /Full name/ })).toBeFocused();

  await dialog.getByRole("textbox", { name: /Full name/ }).fill("Fixture Customer");
  await dialog.getByRole("textbox", { name: "Email" }).fill("fixture.customer@example.com");
  await dialog.getByRole("textbox", { name: /Phone/ }).fill("(905) 555-0142");
  await dialog.getByRole("textbox", { name: "Message" }).fill("Winter set for a 2021 Civic, fixture test.");

  await dialog.getByRole("button", { name: /^Send inquiry/ }).click();

  // The app's success path: the panel replaces the lines, the cart empties.
  const success = page.getByRole("status").filter({ hasText: "Quote request sent." });
  await expect(success).toBeVisible();
  await expect(success).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("link", { name: "Keep shopping" })).toHaveAttribute("href", "/tires");
  await expect(cartLink(page)).toHaveAttribute("aria-label", "Cart, current page");
  expect(await page.evaluate(() => window.localStorage.getItem("pw-cart")), "cart storage after a send").toBeNull();

  // D162: a reload keeps "Quote request sent." with its time and product,
  // read from the browser's own record, which holds no personal details.
  await page.reload();
  await settle(page);
  const kept = page.getByRole("status").filter({ hasText: "Quote request sent." });
  await expect(kept).toBeVisible();
  await expect(kept).toContainText(/^Sent /i);
  await expect(kept.getByRole("link", { name: /Antarctica Sport/ })).toHaveAttribute(
    "href",
    new RegExp(`/products/${SLUG.tire}`),
  );
  const record = await page.evaluate(() => window.localStorage.getItem("pw-quotes-sent"));
  expect(record, "the sent record").not.toBeNull();
  expect(record).not.toMatch(/Fixture Customer|fixture\.customer|555-0142|Civic, fixture/);

  // Clearing the record leaves the plain empty cart.
  await page.getByRole("button", { name: "Clear sent requests" }).click();
  await expect(page.getByText(/^Your cart is empty\./)).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem("pw-quotes-sent"))).toBeNull();
  expect(problems, "uncaught page errors").toEqual([]);
});

test("a cart line can be removed, and removing the last one empties the page", async ({ page }) => {
  await addToCart(page, SLUG.wheel);
  await page.goto("/cart");
  await settle(page);
  const lines = page.getByRole("list", { name: "Products in your cart" });
  await expect(lines.getByRole("listitem")).toHaveCount(1);
  await lines.getByRole("button", { name: /^Remove/ }).click();
  await expect(page.getByText(/^Your cart is empty\./)).toBeVisible();
  await expect(cartLink(page)).toHaveAttribute("aria-label", "Cart, current page");
});
