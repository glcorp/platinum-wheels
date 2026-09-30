/**
 * Route contract: which nav item is current where, and what every URL answers.
 *
 * Part 1 pins the "current nav item" rule. `/about`, `/privacy`, `/terms` and
 * every 404 belong to none of the four items, so none may read as current
 * (aria-current, the desktop `nav-indicator` underline, the drawer's accent
 * rule). The drawn routes each mark exactly their own item.
 *
 * Part 2 is the HTTP status table (report-first: a status that differs from the
 * expectation is reported, not "fixed" by editing the expectation).
 *
 * Runs against the production build (`tests/llm.md`).
 */
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { SLUG, settle, usesSheet } from "../helpers";

/* ---------- Part 1: current nav item ---------- */

type Item = "Tires" | "Wheels" | "Accessories" | "Contact";

const NO_CURRENT = [
  "/about",
  "/privacy",
  "/terms",
  "/this-does-not-exist",
  "/products/not-a-slug",
];

const CURRENT: Array<{ path: string; item: Item }> = [
  { path: "/", item: "Tires" },
  { path: "/tires", item: "Tires" },
  { path: "/wheels", item: "Wheels" },
  { path: "/accessories", item: "Accessories" },
  { path: `/products/${SLUG.tire}`, item: "Tires" },
  { path: `/products/${SLUG.wheel}`, item: "Wheels" },
  { path: `/products/${SLUG.accessory}`, item: "Accessories" },
];

/** Every current-marked link in the header, desktop row and drawer alike. */
const currentLabels = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("header a[aria-current]")].map((a) => a.textContent?.trim() ?? ""),
  );

/** The drawer opens from a real tap/click; the trigger only works once hydrated. */
async function openDrawer(page: Page) {
  const dialog = page.locator("dialog#site-nav-drawer");
  await expect(async () => {
    if (!(await dialog.evaluate((d: HTMLDialogElement) => d.open))) {
      await page.getByRole("button", { name: "Menu" }).click({ timeout: 2_000 });
    }
    await expect(dialog).toBeVisible({ timeout: 1_500 });
  }).toPass();
  return dialog;
}

for (const path of NO_CURRENT) {
  test(`${path}: no nav item is current`, async ({ page }, info) => {
    await page.goto(path);
    await settle(page);
    expect(await currentLabels(page), "aria-current links in the header").toEqual([]);
    await expect(page.locator("header .nav-indicator"), "desktop underline").toHaveCount(0);

    if (usesSheet(info)) {
      const dialog = await openDrawer(page);
      // The four nav links live in the list; the `tel:` CTA sits outside it.
      const links = dialog.locator("ul a");
      await expect(links).toHaveCount(4);
      const rules = await links.evaluateAll((els) =>
        els.map((el) => `${el.textContent?.trim()}: ${getComputedStyle(el).borderBottomColor}`),
      );
      // Every drawer link keeps the same transparent rule; none wears the accent.
      expect(new Set(rules.map((r) => r.split(": ")[1])).size, `drawer rules ${rules.join(" | ")}`).toBe(1);
      await expect(dialog.locator("a[aria-current]")).toHaveCount(0);
    }
  });
}

for (const { path, item } of CURRENT) {
  test(`${path}: ${item} is the one current item`, async ({ page }, info) => {
    await page.goto(path);
    await settle(page);
    // Desktop row and drawer each carry it: two links, both the same item.
    expect(await currentLabels(page)).toEqual([item, item]);
    await expect(page.locator("header .nav-indicator")).toHaveCount(1);
    await expect(
      page.locator("header .nav-indicator").locator("xpath=ancestor::a"),
    ).toHaveText(item);

    if (usesSheet(info)) {
      const dialog = await openDrawer(page);
      const current = dialog.locator("a[aria-current]");
      await expect(current).toHaveCount(1);
      await expect(current).toHaveText(item);
      const rules = await dialog.locator("ul a").evaluateAll((els) =>
        els.map((el) => ({
          name: el.textContent?.trim(),
          accent: getComputedStyle(el).borderBottomColor !== "rgba(0, 0, 0, 0)",
        })),
      );
      expect(rules.filter((r) => r.accent).map((r) => r.name)).toEqual([item]);
    }
  });
}

/* ---------- Part 2: status table ---------- */

// `/robots.txt` answers 200 in both states of the indexing flag; what it says,
// and `/sitemap.xml` (a bare 404 until the flag is on), are `seo.spec.ts` (D112).
const OK = ["/", "/tires", "/wheels", "/accessories", "/about", "/privacy", "/terms", "/styleguide", "/favicon.ico", "/robots.txt"];

const NOT_FOUND = [
  "/products",
  "/products/not-a-slug",
  "/products/ZETA-ANTARCTICA-SPORT",
  `/products/${SLUG.tire}/extra`,
  "/Tires",
  "/tires/x",
  // The tire category lived here until D112; it moved with no redirect.
  "/results",
  "/results/x",
  "/contact",
  "/index.html",
  "/apple-touch-icon.png",
  "/manifest.json",
  "/.env",
  "/api",
  "/products/%00",
  "/products/..%2f..%2fetc",
];

const SLASH_REDIRECT: Array<[string, string]> = [
  ["/products/", "/products"],
  ["/tires/", "/tires"],
  [`/products/${SLUG.tire}/`, `/products/${SLUG.tire}`],
];

const table: string[] = [];
test.afterAll(() => {
  // Printed once per worker so the measured table lands in the run output.
  console.log(`STATUS TABLE\n${table.join("\n")}`);
});

for (const path of OK) {
  test(`status ${path} is 200`, async ({ request }) => {
    const res = await request.get(path, { maxRedirects: 0 });
    table.push(`${res.status()}  ${path}`);
    expect(res.status()).toBe(200);
  });
}

test("status /qa-error is 500 on a QA_ERROR_ROUTE=1 server", async ({ request }) => {
  const res = await request.get("/qa-error", { maxRedirects: 0 });
  table.push(`${res.status()}  /qa-error`);
  expect(res.status()).toBe(500);
});

for (const [from, to] of SLASH_REDIRECT) {
  test(`status ${from} is 308 to ${to}`, async ({ request }) => {
    const res = await request.get(from, { maxRedirects: 0 });
    const location = res.headers()["location"] ?? "";
    table.push(`${res.status()}  ${from}  ->  ${location}`);
    expect(res.status()).toBe(308);
    expect(new URL(location, res.url()).pathname).toBe(to);
  });
}

for (const path of NOT_FOUND) {
  test(`status ${path} is 404, branded, noindex and accessible`, async ({ page, request }) => {
    const raw = await request.get(path, { maxRedirects: 0 });
    table.push(`${raw.status()}  ${path}`);
    expect(raw.status()).toBe(404);

    const res = await page.goto(path);
    expect(res?.status()).toBe(404);
    await settle(page);
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    // Owner ruling 2026-09-30, "Line + two actions": one line, a way into the
    // catalogue, and the tel: CTA (the same pair the route error boundary shows).
    await expect(page.locator("main#main p").first()).toHaveText(
      "That link doesn't lead anywhere. Start from the catalogue, or call us and we'll find it.",
    );
    await expect(page.getByRole("main").getByRole("link", { name: "Shop tires" })).toHaveAttribute(
      "href",
      "/tires",
    );
    await expect(page.getByRole("main").getByRole("link", { name: /^Call / })).toHaveAttribute(
      "href",
      "tel:+14378825000",
    );

    const metaRobots = await page.locator('meta[name="robots"]').getAttribute("content");
    const headerRobots = res?.headers()["x-robots-tag"] ?? "";
    expect(`${metaRobots ?? ""} ${headerRobots}`, "robots directive").toContain("noindex");

    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
}
