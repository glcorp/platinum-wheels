/**
 * Storefront search, end to end (D173). Needs the fixture database
 * (`tests/llm.md`): 126 products, among them the Zeta Antarctica Sport in
 * 225/60R17, four 17-inch wheels (7.5, 8, 8.5 and 9 inches wide), the GT
 * Off-Road lug nuts `GT14156LB`, and one hidden tire.
 *
 * What it proves: every common spelling of a tire size finds the same tires,
 * a tire size brings the 17-inch wheels that suit it and leaves out the ones
 * too wide, a part number (the vendor's SKU, D193) finds nothing, a hidden
 * product never shows, no price reaches the page while prices are off, the
 * page is `noindex`, works with JS off, the header's box searches from 720
 * and its icon opens a field below that (D177), and every group shows one row
 * then `See all` on its category page (D178).
 */
import { test, expect, type Page } from "@playwright/test";
import { SLUG, VEHICLE, settle } from "../helpers";

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "chromium-1440" && !info.project.name.startsWith("iphone"), "server results: one desktop and one phone run");
});

const TIRE_225 = SLUG.tire; // zeta-antarctica-sport-225-60r17-103t

const productLinks = (page: Page) =>
  page.locator('main a[href^="/products/"]').evaluateAll((links) =>
    [...new Set(links.map((link) => new URL((link as HTMLAnchorElement).href).pathname.replace("/products/", "")))],
  );

async function search(page: Page, q: string) {
  const res = await page.goto(`/search?${new URLSearchParams({ q }).toString()}`);
  expect(res?.status()).toBe(200);
  await settle(page);
}

test("every spelling of a tire size finds the same tires", async ({ page }) => {
  let first: string[] | null = null;
  for (const q of ["2256017", "225/60R17", "225 60 17", "225/60ZR17", "P225/60R17", "225-60-17"]) {
    await search(page, q);
    const tires = page.locator("#search-tires");
    await expect(tires.getByRole("heading", { level: 2, name: "Tires" })).toBeVisible();
    await expect(page.getByText("Tires in 225/60R17", { exact: false })).toBeVisible();
    const slugs = (await productLinks(page)).filter((slug) => slug.includes("225-60r17"));
    expect(slugs).toContain(TIRE_225);
    first ??= slugs;
    expect(slugs.sort()).toEqual([...first].sort());
  }
});

test("a tire size brings the wheels that suit it, not every wheel of its rim", async ({ page }) => {
  await search(page, "2256017");
  const wheels = page.locator("#search-wheels");
  await expect(wheels.getByRole("heading", { level: 2, name: "Wheels" })).toBeVisible();
  const sizes = await wheels.locator("article").allInnerTexts();
  const joined = sizes.join("\n");
  expect(joined).toMatch(/17×8\b/);
  expect(joined).toMatch(/17×7\.5/);
  expect(joined).not.toMatch(/17×8\.5/);
  expect(joined).not.toMatch(/17×9\b/);
  // `See all` opens every 17-inch wheel on the category page.
  await expect(wheels.getByRole("link", { name: "See all 17-inch wheels" })).toHaveAttribute("href", "/wheels?diameter=17");
  await expect(page.locator("#search-tires").getByRole("link", { name: "See all tires" })).toHaveAttribute(
    "href",
    "/tires?width=225&profile=60&rim=17",
  );
});

test("a part number finds nothing, with or without its punctuation (D193)", async ({ page }) => {
  for (const q of ["GT14156LB", "gt-14156-lb"]) {
    await search(page, q);
    expect(await productLinks(page)).not.toContain(SLUG.accessory);
  }
});

test("brand words, and a hidden product never shows", async ({ page }) => {
  await search(page, "zeta antarctica");
  const slugs = await productLinks(page);
  expect(slugs).toContain(TIRE_225);
  expect(slugs).not.toContain(SLUG.hidden);
  await search(page, "195/60R15");
  expect(await productLinks(page)).not.toContain(SLUG.hidden);
});

test("nothing found: the empty state offers a call and an email", async ({ page }) => {
  await search(page, "qqqzzz");
  await expect(page.getByRole("heading", { level: 2, name: "No matches" })).toBeVisible();
  await expect(page.locator('[data-probe="search-empty"] a[href^="tel:"]')).toBeVisible();
  await expect(page.locator('[data-probe="search-empty"] a[href^="mailto:"]')).toBeVisible();
  await expect(page.getByText("0 matches", { exact: true })).toBeVisible();
});

test("never indexed, and no price leaves the server", async ({ request }) => {
  const res = await request.get(`/search?q=2256017`);
  const html = await res.text();
  expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"/);
  expect(html).not.toMatch(/<link rel="canonical"/);
  // Every fixture product is priced at 100. With prices off (D124) the
  // number must not reach the page or its flight data.
  expect(html).not.toMatch(/"price":100\b/);
  expect(html).not.toMatch(/\$100\b/);
});

/** The header's search: a box from 720, an icon below (D177). */
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 720;

test("works with JavaScript off", async ({ browser, baseURL }, info) => {
  const phone = info.project.name.startsWith("iphone");
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
    ...(phone ? { viewport: { width: 390, height: 844 } } : {}),
  });
  const page = await context.newPage();
  await page.goto("/tires");
  if (phone) {
    // The header icon is a plain link to /search until a script runs.
    const icon = page.getByRole("banner").getByRole("link", { name: "Search" });
    await expect(icon).toHaveAttribute("href", "/search");
    await icon.click();
    await expect(page).toHaveURL(/\/search$/);
    // Scoped to `main`: the header's own (hidden) field carries the same label (GATE-4).
    const field = page.getByRole("main").getByLabel("Tire size, wheel size, SKU or brand");
    await field.fill("225/60R17");
    await field.press("Enter");
  } else {
    // The header box is a plain GET form.
    const box = page.getByRole("banner").getByRole("searchbox");
    await box.fill("225/60R17");
    await box.press("Enter");
  }
  await expect(page).toHaveURL(/\/search\?q=225%2F60R17/);
  await expect(page.locator(`main a[href="/products/${TIRE_225}"]`).first()).toBeVisible();
  await context.close();
});

test("the header search sits left of the call button and searches", async ({ page }) => {
  await page.goto("/tires");
  await settle(page);
  const banner = page.getByRole("banner");
  const call = banner.locator('a[href^="tel:"]:visible').first();

  if (isPhone(page)) {
    const trigger = banner.getByRole("button", { name: "Search", exact: true });
    expect((await trigger.boundingBox())!.x).toBeLessThan((await call.boundingBox())!.x);
    await expect(trigger).toHaveCSS("cursor", "pointer");
    await trigger.click();
    const field = banner.getByRole("searchbox");
    await expect(field).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(field).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.keyboard.type("2256017");
    await page.keyboard.press("Enter");
  } else {
    const box = banner.getByRole("searchbox");
    await expect(box).toHaveAttribute("placeholder", "Search");
    expect((await box.boundingBox())!.x).toBeLessThan((await call.boundingBox())!.x);
    await box.click();
    await page.keyboard.type("2256017");
    await page.keyboard.press("Enter");
  }
  await expect(page).toHaveURL(/\/search\?q=2256017/);
  await expect(page.locator(`main a[href="/products/${TIRE_225}"]`).first()).toBeVisible();
});

test("each group shows one row, then See all on its category page", async ({ page }) => {
  await search(page, "tires");
  const tires = page.locator("#search-tires");
  await expect(tires.locator("article")).toHaveCount(4);
  await expect(tires.getByRole("link", { name: "Show more" })).toHaveCount(0);
  const all = tires.getByRole("link", { name: "See all tires" });
  await expect(all).toHaveAttribute("href", "/tires");
  // Free words the category page cannot filter on still get a link (D178).
  await search(page, "zeta antarctica");
  await expect(page.locator("#search-tires").getByRole("link", { name: "See all tires" })).toBeVisible();
});

/* QA SEARCH-1 (D184): a thread search names the three threaded accessory types
   in its `See all` link, because the category page applies a thread only while
   one of them is ticked (D137); without them it landed on the whole category. */
test("a thread search's See all lands on the group's set, not the whole category", async ({ page }) => {
  await search(page, "12x1.5");
  const group = page.locator("#search-accessories");
  const total = Number((await page.locator("#search-summary").innerText()).split(" ")[0]?.replace(/,/g, ""));
  expect(total).toBeGreaterThan(0);
  const all = group.getByRole("link", { name: "See all accessories" });
  const href = (await all.getAttribute("href")) ?? "";
  const types = new URL(href, "http://x").searchParams.getAll("type");
  expect(types.sort()).toEqual(["lug-bolts", "lug-nuts", "wheel-locks"]);
  expect(new URL(href, "http://x").searchParams.get("thread")).toBe("12x1.5");
  await all.click();
  await expect(page).toHaveURL(/\/accessories\?/);
  const landed = page.locator("main").getByText(/^[\d,]+ matches?$/).first();
  await expect(landed).toBeVisible();
  const count = Number((await landed.innerText()).split(" ")[0]?.replace(/,/g, ""));
  // The page may lack products the group counts that carry no thread type, never the reverse.
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(total);
});

/* QA SEARCH-2 (D184): the page field follows the URL after Back and after a
   search made from the header. */
test("the page field follows the URL after Back and a header search", async ({ page }) => {
  await search(page, "zeta");
  const field = page.getByRole("main").getByLabel("Tire size, wheel size, SKU or brand");
  await field.fill("fuel");
  await field.press("Enter");
  await expect(page).toHaveURL(/q=fuel/);
  await expect(field).toHaveValue("fuel");
  await page.goBack();
  await expect(page).toHaveURL(/q=zeta/);
  await expect(field).toHaveValue("zeta");
  if (!isPhone(page)) {
    const box = page.getByRole("banner").getByRole("searchbox");
    await box.fill("lug nuts");
    await box.press("Enter");
    await expect(page).toHaveURL(/q=lug(\+|%20)nuts/);
    await expect(field).toHaveValue("lug nuts");
  }
});

/* QA LAYOUT-1 (D184): the no-matches line quotes the query, and a long
   unbroken one (a pasted URL or code) must wrap, not widen the page. */
test("a long unbroken query wraps and never scrolls the page sideways", async ({ page }) => {
  await search(page, "B".repeat(100));
  await expect(page.getByRole("heading", { level: 2, name: "No matches" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

/* QA SEARCH-5 (D184): two search landmarks, two names. */
test("the header and page search landmarks have different names", async ({ page }) => {
  test.skip(isPhone(page), "the header box is the 720+ landmark");
  await search(page, "zeta");
  await expect(page.getByRole("search", { name: "Site search" })).toHaveCount(1);
  await expect(page.getByRole("search", { name: "Search the catalogue" })).toHaveCount(1);
});

/* QA SEARCH-7 (D185): a search started on a page with a searched car keeps the
   car, and only a car the finder offers. */
test("a searched car rides into the search and its See all links", async ({ page }) => {
  test.skip(isPhone(page), "header box path; the 390 panel carries the same hidden fields");
  await page.goto(`/tires?${VEHICLE}`);
  await settle(page);
  const box = page.getByRole("banner").getByRole("searchbox");
  await box.fill("zeta");
  await box.press("Enter");
  await expect(page).toHaveURL(/year=2021&make=Honda&model=Civic/);
  const href = await page.locator("#search-tires").getByRole("link", { name: "See all tires" }).getAttribute("href");
  expect(href).toContain("year=2021");
  expect(href).toContain("make=Honda");
  expect(href).toContain("model=Civic");
  // An unchecked car is no car: nothing of it reaches a link.
  await page.goto("/search?q=zeta&year=1&make=%3Cb%3E&model=x");
  const bare = await page.locator("#search-tires").getByRole("link", { name: "See all tires" }).getAttribute("href");
  expect(bare).not.toContain("year=");
  expect(bare).not.toContain("make=");
});
