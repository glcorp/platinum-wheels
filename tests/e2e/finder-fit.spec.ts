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
  /* The header's links fold into the menu below 1100 (D158): there the
     category tab under the header is the visible way to Wheels. */
  await page
    .locator('header a[href^="/wheels"]:visible, [data-sticky-filter-bar] a[href^="/wheels"]:visible')
    .first()
    .click();
  await page.waitForURL(/\/wheels/);
  await settle(page);
  await page.locator('[data-probe="vehicle-button"]:visible').first().click();
  await expect(page.locator("#vehicle-sheet[open]")).toHaveCount(1);
  await page.selectOption("#finder-year", "2020");
  await page.selectOption("#finder-make", "Honda");
  expect(await modelOptions(page)).toContain("Civic");
});

/* D176: adding a car keeps the size already picked. */
test("adding a vehicle keeps the picked tire size", async ({ page }) => {
  await page.goto("/tires?width=225&profile=60&rim=17");
  await settle(page);
  await page.locator('[data-probe="vehicle-button"]:visible').first().click();
  await expect(page.locator("#vehicle-sheet[open]")).toHaveCount(1);
  await page.selectOption("#finder-year", "2020");
  await page.selectOption("#finder-make", "Honda");
  await page.selectOption("#finder-model", "Civic");
  await page.locator('#vehicle-sheet button[type="submit"]').click();
  await page.waitForURL(/year=2020/);
  const url = new URL(page.url());
  expect(url.searchParams.get("model")).toBe("Civic");
  expect(url.searchParams.get("width")).toBe("225");
  expect(url.searchParams.get("profile")).toBe("60");
  expect(url.searchParams.get("rim")).toBe("17");
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

/* QA fixes (D184, D185), 2026-10-13. */

/* MODEL-1: with JavaScript off the `Add vehicle` link targets the sheet, whose
   panel must come up on screen (it stayed translated out of view). */
test.describe("JavaScript off, vehicle sheet", () => {
  test.use({ javaScriptEnabled: false });
  for (const path of ["/tires", "/wheels", "/accessories"]) {
    test(`${path}: the sheet opens in view and submits`, async ({ page }) => {
      await page.goto(path);
      await page.locator('a[href="#vehicle-sheet"]:visible').first().click();
      const year = page.locator("#finder-year");
      await expect(year).toBeVisible();
      await expect
        .poll(async () => {
          const box = await page.locator("#vehicle-sheet .sheet-panel").boundingBox();
          const view = page.viewportSize();
          return box !== null && view !== null && box.y >= -1 && box.y + box.height <= view.height + 1;
        })
        .toBe(true);
      await year.selectOption("2020");
      await page.locator("#finder-make").selectOption("Honda");
      await page.locator("#finder-model-all").selectOption("Civic");
      await page.locator('#vehicle-sheet button[type="submit"]').click();
      await page.waitForURL(/year=2020/);
      expect(new URL(page.url()).searchParams.get("model")).toBe("Civic");
    });
  }
});

/* MODEL-2: a Make change the page missed is re-applied when the page is shown. */
test("a missed Make change is healed on the next page show", async ({ page }) => {
  await page.goto("/");
  await settle(page);
  await page.selectOption("#finder-year", "2020");
  await page.evaluate(() => {
    (document.querySelector("#finder-make") as HTMLSelectElement).value = "Honda";
  });
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })),
  );
  const makes = await page
    .locator("#finder-model optgroup")
    .count();
  expect(makes).toBe(0);
  expect(await modelOptions(page)).toContain("Civic");
});

/* GATE-1: the Vehicle | Size switch's checked segment carries the forced-colours
   hook on the element that has the radio inside it. */
test("the home Vehicle | Size switch marks the segment, not the radio", async ({ page }) => {
  await page.goto("/");
  await settle(page);
  const hooks = await page.locator("[data-segment]").evaluateAll((nodes) =>
    nodes.map((n) => ({ tag: n.tagName, hasRadio: n.querySelector("input[type=radio]") !== null })),
  );
  const finder = hooks.filter((h) => h.tag === "LABEL" && h.hasRadio);
  expect(finder).toHaveLength(2);
  expect(hooks.some((h) => h.tag === "INPUT")).toBe(false);
});

/* HOMEFIND-3 (owner, 2026-10-13, "Season list narrows by size"): the home
   finder's Season offers only the seasons that exist for the chosen size.
   Fixture sizes: 195/65R15 is all-weather only, 205/55R16 all-season and
   winter. */
test("home Season narrows to the seasons the chosen size comes in", async ({ page }) => {
  await page.goto("/");
  await settle(page);
  const seasons = () =>
    page
      .locator("#finder-season option")
      .evaluateAll((n) => (n as HTMLOptionElement[]).map((o) => o.value).filter(Boolean));
  /* The size selects narrow each other, so clear all three before the next. */
  const size = async (width: string, profile: string, rim: string) => {
    for (const id of ["#finder-width", "#finder-profile", "#finder-rim"]) {
      await page.selectOption(id, "");
    }
    await page.selectOption("#finder-width", width);
    await page.selectOption("#finder-profile", profile);
    await page.selectOption("#finder-rim", rim);
  };
  await page.locator('label[for="finder-by-size"]').click();
  expect((await seasons()).sort()).toEqual(["all-season", "all-weather", "summer", "winter"]);
  await size("195", "65", "15");
  expect(await seasons()).toEqual(["all-weather"]);
  await size("205", "55", "16");
  expect((await seasons()).sort()).toEqual(["all-season", "winter"]);
  // A season the next size does not come in is cleared, not left selected.
  await page.selectOption("#finder-season", "winter");
  await size("195", "65", "15");
  await expect(page.locator("#finder-season")).toHaveValue("");
  // Vehicle mode shows every season again.
  await page.locator('label[for="finder-by-vehicle"]').click();
  expect((await seasons()).sort()).toEqual(["all-season", "all-weather", "summer", "winter"]);
});

/* HOMEFIND-5: an empty submit with scripting on carries no empty keys. */
test("an empty home submit sends no empty parameters", async ({ page }) => {
  await page.goto("/");
  await settle(page);
  await page.locator('#vehicle-finder button[type="submit"]').click();
  await page.waitForURL(/\/tires/);
  expect(new URL(page.url()).search.replace(/^\?$/, "")).toBe("");
  await page.goto("/");
  await settle(page);
  await page.locator('label[for="finder-by-size"]').click();
  await page.selectOption("#finder-season", "winter");
  await page.locator('#vehicle-finder button[type="submit"]').click();
  await page.waitForURL(/\/tires\?/);
  expect(new URL(page.url()).search).toBe("?season=winter");
});

/* FIT-3 (owner, 2026-10-13, "No-data car wording"). */
test("a car with no fit data says so instead of 'Showing what fits'", async ({ page }) => {
  await page.goto("/tires?year=2024&make=Chevrolet&model=Suburban%20HD");
  await settle(page);
  const sheet = page.locator("#vehicle-sheet");
  await expect(sheet).toContainText("We don't have fit data for your 2024 Chevrolet Suburban HD yet, so everything is shown.");
  await expect(sheet).not.toContainText("Showing what fits");
  await page.goto(`/tires?${VEHICLE}`);
  await settle(page);
  await expect(page.locator("#vehicle-sheet")).toContainText("Showing what fits your 2021 Honda Civic.");
});

/* FIT-1: "Similar products" lists a discontinued sibling like any other (D164). */
test("Similar products includes discontinued products", async ({ page }) => {
  await page.goto("/products/gt-off-road-caps-chrome-cap-gloss-black-gt-logo-sc-293c");
  await settle(page);
  await expect(
    page.locator(`a[href^="/products/${SLUG.accessoryUnavailable}"]`).first(),
  ).toHaveCount(1);
});
