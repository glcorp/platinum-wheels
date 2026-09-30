/**
 * The route error boundary, end to end (D62, D91b). `/qa-error` throws only on a
 * server started with QA_ERROR_ROUTE=1 (playwright.config.ts); elsewhere it 404s.
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("a render error lands on the branded boundary, not a crash", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  const res = await page.goto("/qa-error");
  // A real 500, not a 200 with an error page in it (D91b removed loading.tsx,
  // whose Suspense boundary had already streamed a 200 before the throw).
  expect(res?.status()).toBe(500);

  const main = page.locator("main#main");
  await expect(main).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "Something went wrong" })).toBeVisible();
  // Scoped to <main>: Next's route announcer is also role="alert".
  await expect(main.getByRole("alert")).toContainText("Something went wrong");
  await expect(page.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  await expect(page.getByRole("link", { name: /^Call / })).toHaveAttribute(
    "href",
    "tel:+14378825000",
  );
  // Production replaces the message; the digest is the only handle (route-error.tsx).
  await expect(page.getByText(/^Reference \S+/)).toBeVisible();
  await expect(page.getByText("QA fixture")).toHaveCount(0);

  // Try again re-renders the segment; it throws again, and the boundary must hold.
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Something went wrong" })).toBeVisible();
  expect(pageErrors, "the boundary must catch, not escalate").toEqual([]);
});

test("the boundary passes axe", async ({ page }) => {
  await page.goto("/qa-error");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});

/**
 * `global-error.tsx` (D93b): an error thrown in the root layout itself, which the
 * storefront boundary cannot catch. Only provable on a server whose layout
 * throws, so it is skipped unless `PW_ROOT_ERROR=1` points at one (a scratch
 * build of the repo with `layout.tsx` throwing when `ROOT_ERROR=1`; the real
 * layout never does).
 */
test.describe("root layout error", () => {
  test.skip(process.env.PW_ROOT_ERROR !== "1", "needs a server whose root layout throws");

  test("lands on the branded global-error, not Next's bare page", async ({ page }) => {
    const res = await page.goto("/results");
    expect(res?.status()).toBe(500);

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    // The theme's --bg (#0B0B0D): global-error carries its own <html>/<body>
    // and globals.css, so the page is dark rather than the browser default white.
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(11, 11, 13)");
    await expect(page).toHaveTitle("Something went wrong · Platinum Wheels");

    await expect(page.getByRole("heading", { level: 1, name: "Something went wrong" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Call / })).toHaveAttribute(
      "href",
      "tel:+14378825000",
    );
    const home = page.getByRole("link", { name: "Home" });
    await expect(home).toHaveAttribute("href", "/");
    await home.click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("the root boundary passes axe", async ({ page }) => {
    await page.goto("/results");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});
