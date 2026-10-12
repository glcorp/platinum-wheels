/**
 * Product listings and the product gallery (D164–D167). Needs the fixture
 * database (`npm run test:e2e:fixture`): the named tire carries three photos,
 * and three products are `discontinued`, one `hidden` (`tests/fixture/fixture.mjs`).
 *
 * Serial, one project: the last test reorders the named tire's photos in the
 * admin and puts them back, and the gallery tests read that order.
 */
import { test, expect, type Page } from "@playwright/test";
import { SLUG, settle } from "../helpers";

const PORT = process.env.PW_PORT ?? "3100";
const ADMIN = `http://admin.localhost:${PORT}`;
const USER = process.env.FIXTURE_ADMIN_USERNAME;
const PASSWORD = process.env.FIXTURE_ADMIN_PASSWORD;

/** A size with best matches and a few nearby sizes, in the fixture. */
const SIZED = "/tires?width=225&profile=60&rim=17";
/** A size with no exact match: best is empty, only nearby sizes. */
const NO_EXACT = "/tires?width=225&profile=55&rim=17";

test.describe.configure({ mode: "serial" });

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "chromium-1440", "one project; the admin step needs Chromium");
});

/* ---------- D175: May also fit, one row and Show more ---------- */

test("`May also fit` shows one row under the best matches", async ({ page }) => {
  await page.goto(SIZED);
  await settle(page);
  await expect(page.getByRole("heading", { level: 2, name: "May also fit" })).toBeVisible();
  // The count line is unchanged (D57, D72).
  await expect(page.locator("[data-probe=count]")).toHaveText(/\d+ match(es)? · \d+ similar/);
  const grid = page.locator("[data-probe=similar-grid]");
  await expect(grid.locator("article").first()).toBeVisible();
  expect(await grid.locator("article").count()).toBeLessThanOrEqual(3);
  await expect(page.locator("[data-probe=similar] details")).toHaveCount(0);
});

test("`May also fit` shows when there is no exact match", async ({ page }) => {
  await page.goto(NO_EXACT);
  await settle(page);
  await expect(page.locator("[data-probe=best-none]")).toBeVisible();
  await expect(page.locator("[data-probe=similar-grid] article").first()).toBeVisible();
});

test("`Show more` grows only the list, and lands on its first new card", async ({ page }) => {
  await page.goto(SIZED);
  await settle(page);
  const more = page.locator("[data-probe=similar-more]").getByRole("link", { name: "Show more" });
  await expect(more).toHaveAttribute("href", /similar=12#similar-4$/);
  const bestBefore = await page.locator("[data-probe=best-grid] article").count();
  await more.click();
  await expect(page).toHaveURL(/similar=12#similar-4$/);
  await expect(page.locator("#similar-4 [data-card-link]")).toBeFocused();
  await expect(page.locator("[data-probe=best-grid] article")).toHaveCount(bestBefore);
});

test("without JavaScript, `?similar=` arrives with the cards", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${SIZED}&similar=12#similar-4`);
  await expect(page.locator("#similar-4")).toBeVisible();
  await context.close();
});

/* ---------- D164: discontinued lists like any other product ---------- */

test("a discontinued product lists and looks available; a hidden one does not list", async ({ page }) => {
  await page.goto("/tires?width=215&profile=60&rim=16");
  await settle(page);
  const card = page.locator("article").filter({ has: page.locator(`a[href^="/products/${SLUG.tireUnavailable}"]`) });
  await expect(card.first()).toBeVisible();
  await expect(page.getByText("Currently unavailable")).toHaveCount(0);

  await page.goto("/tires?width=195&profile=60&rim=15");
  await settle(page);
  await expect(page.locator(`a[href^="/products/${SLUG.hidden}"]`)).toHaveCount(0);

  await page.goto(`/products/${SLUG.tireUnavailable}`);
  await settle(page);
  await expect(page.getByText("Currently unavailable")).toHaveCount(0);
});

/* ---------- D167: every photo on the product page ---------- */

async function slideSources(page: Page): Promise<string[]> {
  return page
    .locator("#pdp-gallery-track [aria-roledescription=slide]")
    .evaluateAll((slides) =>
      slides.map((slide) => slide.querySelector("img:not([aria-hidden])")?.getAttribute("src") ?? ""),
    );
}

/** A photo's stored name without its size suffix, so the gallery's 1000px
 *  file and the admin's 480px thumbnail compare equal. */
function photoKey(src: string): string {
  const url = decodeURIComponent(src);
  return url.replace(/-(480|1000)\.webp.*$/, "").replace(/^.*\//, "");
}

async function adminOrder(page: Page): Promise<string[]> {
  return page
    .locator("ol li img")
    .evaluateAll((imgs) => imgs.map((img) => img.getAttribute("src") ?? ""))
    .then((srcs) => srcs.map(photoKey));
}

test("a product with three photos is a gallery: arrows, counter, thumbnails", async ({ page }) => {
  await page.goto(`/products/${SLUG.tire}`);
  await settle(page);
  const track = page.locator("#pdp-gallery-track");
  await expect(track.locator("[aria-roledescription=slide]")).toHaveCount(3);
  const count = page.locator("[data-probe=pdp-gallery-count]");
  await expect(count).toHaveText("1 / 3");

  await page.getByRole("button", { name: "Next photo" }).click();
  await expect(count).toHaveText("2 / 3");
  await page.getByRole("button", { name: "Previous photo" }).click();
  await expect(count).toHaveText("1 / 3");
  // Prev on the first wraps to the last.
  await page.getByRole("button", { name: "Previous photo" }).click();
  await expect(count).toHaveText("3 / 3");

  const thumbs = page.locator("[data-probe=pdp-gallery-thumbs] button");
  await expect(thumbs).toHaveCount(3);
  await thumbs.nth(1).click();
  await expect(count).toHaveText("2 / 3");
  await expect(thumbs.nth(1)).toHaveAttribute("aria-current", "true");

  await track.focus();
  await page.keyboard.press("End");
  await expect(count).toHaveText("3 / 3");
  await page.keyboard.press("Home");
  await expect(count).toHaveText("1 / 3");

  // The photo box keeps the drawn 704px square at 1440 (D53).
  const box = await track.locator("..").boundingBox();
  expect(Math.round(box?.width ?? 0)).toBe(704);
  expect(Math.round(box?.height ?? 0)).toBe(704);
});

test("a one-photo product has no gallery controls", async ({ page }) => {
  await page.goto(`/products/${SLUG.wheel}`);
  await settle(page);
  await expect(page.locator("#pdp-gallery-track")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Next photo" })).toHaveCount(0);
});

test("without JavaScript the gallery shows its photos and no dead controls", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`/products/${SLUG.tire}`);
  await expect(page.locator("#pdp-gallery-track [aria-roledescription=slide]")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Next photo" })).toBeHidden();
  await expect(page.locator("[data-probe=pdp-gallery-thumbs]")).toBeHidden();
  await context.close();
});

test("reordering photos in the admin reorders the gallery", async ({ page }) => {
  test.skip(!USER || !PASSWORD, "needs the fixture's admin credentials: run `npm run test:e2e:fixture`");
  // A sign-in, three photo writes and four page loads: under the gate's
  // parallel load this ran past the default 45 s once.
  test.setTimeout(120_000);
  await page.goto(`/products/${SLUG.tire}`);
  await settle(page);
  const before = (await slideSources(page)).map(photoKey);
  expect(before).toHaveLength(3);
  const [a, b, c] = before;

  await page.goto(`${ADMIN}/login`);
  await settle(page);
  await page.getByLabel(/Username/).fill(USER!);
  await page.getByLabel(/Password/).fill(PASSWORD!);
  await page.getByRole("button", { name: /^Sign in/ }).click();
  await expect(page).toHaveURL(`${ADMIN}/`);
  await page.goto(`${ADMIN}/products?q=${encodeURIComponent(SLUG.tire)}`);
  await settle(page);
  await page.getByRole("link", { name: /antarctica sport/i }).first().click();
  // Wait for the edit page itself: read straight after the click, under load
  // the URL was still the list's, and the restore step below went there.
  await expect(page).toHaveURL(new RegExp(`${ADMIN}/products/[0-9a-f-]{36}$`));
  await settle(page);
  const editUrl = page.url();

  await expect.poll(() => adminOrder(page)).toEqual([a, b, c]);
  await page.getByRole("button", { name: "Make main" }).last().click();
  await expect.poll(() => adminOrder(page)).toEqual([c, a, b]);

  await page.goto(`/products/${SLUG.tire}`);
  await settle(page);
  expect((await slideSources(page)).map(photoKey)).toEqual([c, a, b]);

  // Put the order back for every other spec.
  await page.goto(editUrl);
  await settle(page);
  await page.getByRole("button", { name: "Make main" }).first().click();
  await expect.poll(() => adminOrder(page)).toEqual([a, c, b]);
  await page.getByRole("button", { name: "Move photo 3 earlier" }).click();
  await expect.poll(() => adminOrder(page)).toEqual([a, b, c]);
  await page.goto(`/products/${SLUG.tire}`);
  await settle(page);
  expect((await slideSources(page)).map(photoKey)).toEqual(before);
});
