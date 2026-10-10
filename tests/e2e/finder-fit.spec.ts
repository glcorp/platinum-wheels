import { test, expect, type Page } from "@playwright/test";
import { SLUG, VEHICLE, settle } from "../helpers";

/* Stream C (D168-D171), against the fixture database. One project
   (`chromium-1440`); the full engine and device matrix behind D168 was run by
   hand and is in the PR. */

async function modelOptions(page: Page): Promise<string[]> {
  return page
    .locator("#finder-model option")
    .evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLOptionElement).value).filter((v) => v !== ""),
    );
}

/* D168 (C3): the client's "Glitch in selecting model, sometimes have to
   refresh". After a client navigation the Model list was empty: React leaves a
   `<noscript>` empty when it draws a page itself. */
test("Model list fills after a client navigation (vehicle sheet)", async ({ page }) => {
  await page.goto("/tires");
  await settle(page);
  await page.locator('header a[href^="/wheels"]').first().click();
  await page.waitForURL(/\/wheels/);
  await settle(page);
  await page.locator('[data-probe="vehicle-button"]:visible').first().click();
  await expect(page.locator("#vehicle-sheet[open]")).toHaveCount(1);
  await page.selectOption("#finder-year", "2020");
  await page.selectOption("#finder-make", "Honda");
  expect(await modelOptions(page)).toContain("Civic");
});

test("Model list fills before the page's JavaScript has run", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/_next\/static\/chunks\/.*\.js/, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.selectOption("#finder-year", "2020");
  await page.selectOption("#finder-make", "Honda");
  expect(await modelOptions(page)).toContain("Civic");
  await page.selectOption("#finder-model", "Civic");
  release();
  await settle(page);
  await expect(page.locator("#finder-model")).toHaveValue("Civic");
  await expect(page.locator("#finder-make")).toHaveValue("Honda");
});

/* D169 (C4): the home finder's Vehicle | Size switch. */
test("home Size mode sends the size and season only", async ({ page }) => {
  await page.goto("/");
  await settle(page);
  await page.locator('label[for="finder-by-size"]').click();
  await expect(page.locator("#finder-width")).toBeVisible();
  await expect(page.locator("#finder-year")).toBeHidden();
  const width = await page
    .locator("#finder-width option")
    .evaluateAll((n) => (n as HTMLOptionElement[]).map((o) => o.value).filter(Boolean)[0]);
  await page.selectOption("#finder-width", width);
  await page.selectOption("#finder-season", "winter");
  await page.locator('#vehicle-finder button[type="submit"]').click();
  await page.waitForURL(/\/tires\?/);
  const url = new URL(page.url());
  expect(url.searchParams.get("width")).toBe(width);
  expect(url.searchParams.get("season")).toBe("winter");
  expect(url.searchParams.has("year")).toBe(false);
});

test("home Size mode on wheels shows the wheel fields", async ({ page }) => {
  await page.goto("/?finder=wheels");
  await settle(page);
  await page.locator('label[for="finder-by-size"]').click();
  await expect(page.locator("#finder-bolt")).toBeVisible();
  await expect(page.locator("#finder-bolt")).toBeEnabled();
  await expect(page.locator("#finder-width")).toBeDisabled();
  await expect(page.locator("#finder-season")).toBeHidden();
});

test.describe("JavaScript off", () => {
  test.use({ javaScriptEnabled: false });
  test("home Size mode switches and submits", async ({ page }) => {
    await page.goto("/");
    await page.locator('label[for="finder-by-size"]').click();
    await expect(page.locator("#finder-width")).toBeVisible();
    await expect(page.locator("#finder-year")).toBeHidden();
    await page.selectOption("#finder-season", "winter");
    await page.locator('#vehicle-finder button[type="submit"]').click();
    await page.waitForURL(/\/tires\?/);
    expect(new URL(page.url()).searchParams.get("season")).toBe("winter");
  });
});

/* D170 (C2): a wheel size picked beside a car keeps the car's bolt pattern. */
test("a car plus a picked diameter lists only the car's bolt pattern", async ({ page }) => {
  await page.goto(`/wheels?${VEHICLE}&diameter=19`);
  await settle(page);
  const lines = await page.locator("main article").allInnerTexts();
  for (const text of lines) expect(text).toContain("5×114.3");
  const bolts = await page
    .locator('select[name="bolt"] option')
    .evaluateAll((n) => (n as HTMLOptionElement[]).map((o) => o.value).filter(Boolean));
  expect(bolts).toEqual(["5x114.3"]);
});

/* D171 (C1): with a car, Other sizes lists only its factory sizes. */
test("Other sizes with a car lists only the car's factory sizes", async ({ page }) => {
  await page.goto(`/products/${SLUG.tire}?${VEHICLE}`);
  await settle(page);
  const row = page.locator('[data-probe="other-sizes-products"] article');
  const texts = await row.allInnerTexts();
  for (const text of texts) expect(text).toMatch(/215\/55R16|215\/50R17|235\/40R18/);
});
