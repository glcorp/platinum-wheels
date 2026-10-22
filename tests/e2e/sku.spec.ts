/**
 * The shop's own product code, end to end (D192). Needs the fixture database
 * (`tests/llm.md`). Codes are drawn at random by the database on every load,
 * so the tests read the code off the product page and work from it; none is
 * written down here.
 *
 * What it proves: a product page shows its code under the size, in the
 * specifications and in its structured data; its card on the category page
 * shows the same code; the code typed in any spelling on `/search` opens the
 * product; its six digits alone find it; the cart line carries it; and the
 * admin finds the product by it.
 */
import { test, expect, type Page } from "@playwright/test";
import { SLUG, settle } from "../helpers";

const PORT = process.env.PW_PORT ?? "3100";
const ADMIN = `http://admin.localhost:${PORT}`;
const USER = process.env.FIXTURE_ADMIN_USERNAME;
const PASSWORD = process.env.FIXTURE_ADMIN_PASSWORD;

const CODE = /^PW-T[1-9]\d{5}$/;

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "chromium-1440", "server-rendered: one desktop run");
});

/** The tire's code, read off its own product page. */
async function tireCode(page: Page): Promise<string> {
  await page.goto(`/products/${SLUG.tire}`);
  await settle(page);
  const line = page.getByRole("main").getByText(/^SKU PW-T\d{6}$/).first();
  await expect(line).toBeVisible();
  const code = ((await line.textContent()) ?? "").replace(/^SKU /, "");
  expect(code).toMatch(CODE);
  return code;
}

test("the product page shows its code under the size, in the specs and in its structured data", async ({ page }) => {
  const code = await tireCode(page);
  const specs = page.getByRole("main").locator("dl, table").filter({ hasText: "SKU" }).first();
  await expect(specs).toContainText(code);
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  const product = ld.map((text) => JSON.parse(text) as Record<string, unknown>).find((node) => node["@type"] === "Product");
  expect(product?.sku).toBe(code);
});

test("the card on the category page carries the same code", async ({ page }) => {
  const code = await tireCode(page);
  await page.goto("/tires?width=225&profile=60&rim=17");
  await settle(page);
  const card = page.locator("article").filter({ has: page.locator(`a[href^="/products/${SLUG.tire}"]`) }).first();
  await expect(card.getByText(`SKU ${code}`, { exact: true })).toBeVisible();
});

test("a code typed any way on /search opens its product; its digits alone find it", async ({ page }) => {
  const code = await tireCode(page);
  const digits = code.slice(4);
  for (const typed of [code, code.toLowerCase().replace("-", ""), `T ${digits}`, `t-${digits}`]) {
    await page.goto(`/search?${new URLSearchParams({ q: typed }).toString()}`);
    await expect(page, typed).toHaveURL(new RegExp(`/products/${SLUG.tire}$`));
  }
  await page.goto(`/search?q=${digits}`);
  await settle(page);
  await expect(page.locator(`main a[href^="/products/${SLUG.tire}"]`).first()).toBeVisible();
});

test("the cart line carries the code", async ({ page }) => {
  const code = await tireCode(page);
  const button = page.getByRole("main").getByRole("button", { name: "Add to cart", exact: true });
  const cart = page.getByRole("banner").getByLabel(/^Cart/);
  await expect(async () => {
    if (!/^Cart, \d/.test((await cart.getAttribute("aria-label")) ?? "")) await button.click({ timeout: 2_000 });
    await expect(cart).toHaveAttribute("aria-label", /^Cart, \d+ items?$/, { timeout: 1_500 });
  }).toPass();
  await page.goto("/cart");
  await settle(page);
  await expect(page.getByRole("main").getByText(`SKU ${code}`, { exact: true })).toBeVisible();
});

test("the admin finds a product by its code, typed without the dash", async ({ page }) => {
  test.skip(!USER || !PASSWORD, "needs the fixture's admin credentials: run `npm run test:e2e:fixture`");
  const code = await tireCode(page);

  await page.goto(`${ADMIN}/login`);
  await settle(page);
  await page.getByLabel(/Username/).fill(USER!);
  await page.getByLabel(/Password/).fill(PASSWORD!);
  await page.getByRole("button", { name: /^Sign in/ }).click();
  await expect(page).toHaveURL(`${ADMIN}/`);

  // A real load of the filtered list (the sign-in's client redirect is a
  // known local-build quirk, `admin-save.spec.ts`).
  await page.goto(`${ADMIN}/products?q=${encodeURIComponent(code.toLowerCase().replace("-", ""))}`);
  await settle(page);
  const rows = page.getByRole("list").getByRole("listitem").filter({ hasText: code });
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(/zeta/i);
});
