/**
 * The vehicle finder: the home hero (`variant="hero"`) and the inline
 * `Change vehicle` / `Add vehicle` disclosure on all three results routes
 * (D45, D58, D67). QA pass D91b, agent RES. See `tests/llm.md`.
 *
 * Governing rows: D28 (ships unselected), D70 (Make narrows Model by
 * `hidden` + `disabled` on groups AND options, progressive enhancement),
 * D79 (no `required`; an empty or mismatched submit is not an error).
 * Fitment numbers are placeholder data (D48); each one asserted here cites
 * where it was recorded.
 */
import { test, expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { settle, watchProblems as watchAll } from "../helpers";

type Category = "tires" | "wheels" | "accessories";

/** `watchProblems` minus one Firefox-only warning ("… preloaded with link
 *  preload was not used within a few seconds", the five next/font woff2
 *  files), seen only on a loaded machine — recorded as RES-3, not asserted
 *  here, so it cannot mask an interaction error. Same wrapper as
 *  `results.spec.ts`. */
function watchProblems(page: Page) {
  const watch = watchAll(page);
  return {
    problems: watch.problems,
    expectClean() {
      watch.problems.console = watch.problems.console.filter(
        (m) => !/preloaded with link preload was not used/.test(m),
      );
      watch.expectClean();
    },
  };
}

const ROUTE: Record<Category, string> = {
  tires: "/tires",
  wheels: "/wheels",
  accessories: "/accessories",
};

/** `CATEGORY_CONFIG[…].finder.cta` (src/features/catalog/categories.ts). */
const CTA: Record<Category, string> = {
  tires: "Find my tires",
  wheels: "Find my wheels",
  accessories: "Find my accessories",
};

const duplicateDesktop = (info: TestInfo) => /-(1280|1920)$/.test(info.project.name);
const skipDuplicate = (info: TestInfo) =>
  test.skip(duplicateDesktop(info), "width-independent logic: covered at 1440 per engine");

const finderOf = (page: Page) => page.locator('form[data-probe="finder"]');
const countLine = (page: Page) => page.locator('[data-probe="count"]');
const chip = (page: Page) => page.locator('[data-probe="vehicle-chip"]');
const params = (page: Page) => new URL(page.url()).searchParams;

/** Every `<optgroup>` of the Model select with its narrowing state. */
async function modelGroups(finder: Locator) {
  return finder.locator("#finder-model").evaluate((select) =>
    Array.from((select as HTMLSelectElement).getElementsByTagName("optgroup")).map((g) => ({
      label: g.label,
      hidden: g.hidden,
      disabled: g.disabled,
      options: Array.from(g.getElementsByTagName("option")).map((o) => ({
        value: o.value,
        hidden: o.hidden,
        disabled: o.disabled,
      })),
    })),
  );
}

/** A real year off the list, not a typed one: the list is computed per render
 *  from the current date (D32, D66), so a literal would rot. */
async function someYear(finder: Locator) {
  const year = await finder
    .locator("#finder-year option:not([disabled])")
    .nth(5)
    .getAttribute("value");
  expect(year).toMatch(/^\d{4}$/);
  return year!;
}

/* --- 1a. D70 narrowing ----------------------------------------------------- */

test("Make narrows Model: other makes' groups AND options are hidden + disabled (D70)", async ({
  page,
}, info) => {
  skipDuplicate(info);
  const watch = watchProblems(page);
  await page.goto("/");
  await settle(page);
  const finder = finderOf(page);

  // Ships unselected (D28) and un-narrowed until a Make is chosen.
  await expect(finder.locator("#finder-year")).toHaveValue("");
  await expect(finder.locator("#finder-make")).toHaveValue("");
  await expect(finder.locator("#finder-model")).toHaveValue("");
  const initial = await modelGroups(finder);
  expect(initial.length).toBeGreaterThan(1);
  for (const g of initial) {
    expect(g.hidden || g.disabled, `${g.label} narrowed before a Make`).toBe(false);
    for (const o of g.options) expect(o.hidden || o.disabled).toBe(false);
  }

  await finder.getByRole("combobox", { name: "Make" }).selectOption("Honda");
  const narrowed = await modelGroups(finder);
  for (const g of narrowed) {
    const keep = g.label === "Honda";
    expect({ label: g.label, hidden: g.hidden, disabled: g.disabled }).toEqual({
      label: g.label,
      hidden: !keep,
      disabled: !keep,
    });
    for (const o of g.options) {
      expect(o, `${g.label} › ${o.value}`).toMatchObject({ hidden: !keep, disabled: !keep });
    }
  }
  expect(narrowed.find((g) => g.label === "Honda")?.options.map((o) => o.value)).toContain("Civic");

  // A Make change that orphans the chosen Model resets it to the placeholder.
  const model = finder.getByRole("combobox", { name: "Model" });
  await model.selectOption("Civic");
  await expect(model).toHaveValue("Civic");
  await finder.getByRole("combobox", { name: "Make" }).selectOption("Toyota");
  await expect(model).toHaveValue("");
  const toyota = await modelGroups(finder);
  expect(toyota.filter((g) => !g.hidden).map((g) => g.label)).toEqual(["Toyota"]);
  watch.expectClean();
});

/* --- 1b. Home hero submit -------------------------------------------------- */

test("home finder submits a full vehicle to /tires with the chip and the fitment split", async ({
  page,
}, info) => {
  skipDuplicate(info);
  const watch = watchProblems(page);
  await page.goto("/");
  await settle(page);
  const finder = finderOf(page);
  const year = await someYear(finder);
  await finder.getByRole("combobox", { name: "Year" }).selectOption(year);
  await finder.getByRole("combobox", { name: "Make" }).selectOption("Honda");
  await finder.getByRole("combobox", { name: "Model" }).selectOption("Civic");
  await finder.getByRole("button", { name: CTA.tires }).click();

  await expect(page).toHaveURL(
    (u) =>
      u.pathname === "/tires" &&
      u.searchParams.get("year") === year &&
      u.searchParams.get("make") === "Honda" &&
      u.searchParams.get("model") === "Civic",
  );
  await settle(page);
  await expect(chip(page)).toHaveText(`${year} Honda Civic`);
  // HANDOFF.md §5: a Civic reads `4 matches · 5 similar` (placeholder FITMENT, D48).
  await expect(countLine(page)).toHaveText("4 matches · 5 similar");
  await expect(page.locator('[data-probe="change-vehicle"]')).toContainText("Change vehicle");
  watch.expectClean();
});

/* --- 1c. D79: empty / partial / mismatched submits are not errors --------- */

test("an empty finder submit is not an error: no required, no bubble, unfiltered page (D79)", async ({
  page,
}, info) => {
  skipDuplicate(info);
  await page.goto("/tires");
  await settle(page);
  const bare = (await countLine(page).textContent())?.trim();

  await page.goto("/");
  await settle(page);
  const finder = finderOf(page);
  await expect(finder.locator("[required]")).toHaveCount(0);
  expect(await finder.evaluate((f) => (f as HTMLFormElement).checkValidity())).toBe(true);
  await finder.getByRole("button", { name: CTA.tires }).click();

  await expect(page).toHaveURL((u) => u.pathname === "/tires");
  await settle(page);
  for (const k of ["year", "make", "model"]) expect(params(page).get(k)).toBeNull();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Best matches");
  await expect(chip(page)).toHaveCount(0);
  await expect(page.locator('[data-probe="change-vehicle"]')).toContainText("Add vehicle");
  await expect(countLine(page)).toHaveText(bare!);
});

test("a partial finder submit names no vehicle (all three or none)", async ({ page }, info) => {
  skipDuplicate(info);
  await page.goto("/");
  await settle(page);
  const finder = finderOf(page);
  await finder.getByRole("combobox", { name: "Year" }).selectOption(await someYear(finder));
  await finder.getByRole("combobox", { name: "Make" }).selectOption("Honda");
  await finder.getByRole("button", { name: CTA.tires }).click();
  await expect(page).toHaveURL((u) => u.pathname === "/tires" && u.searchParams.get("make") === "Honda");
  await settle(page);
  await expect(chip(page)).toHaveCount(0);
  await expect(page.locator('[data-probe="similar"]')).toHaveCount(0);
  await expect(page.locator('[data-probe="change-vehicle"]')).toContainText("Add vehicle");
});

test("a mismatched Make/Model pair returns 200, names no vehicle, every result best (D79, D91b)", async ({
  page,
}, info) => {
  skipDuplicate(info);
  await page.goto("/tires");
  await settle(page);
  const bare = (await countLine(page).textContent())?.trim();

  const res = await page.goto("/tires?year=2024&make=Toyota&model=Civic");
  expect(res?.status()).toBe(200);
  await settle(page);
  await expect(countLine(page)).toHaveText(bare!);
  await expect(countLine(page)).not.toContainText("similar");
  await expect(page.locator('[data-probe="similar"]')).toHaveCount(0);
  // D91b narrows D79: only a vehicle the finder offers is named on the page.
  await expect(chip(page)).toHaveCount(0);
  await expect(page.locator('[data-probe="change-vehicle"]')).toContainText("Add vehicle");
});

/* D91b (WDG-03): the URL is an input. Vehicle text that the finder does not
   offer must never be printed — not in the results chip, not in the PDP quote
   chip or fitment sentence — however it is spelled. */
const SPOOF = "year=2024&make=Call%20416-000-0000&model=to%20claim%20%3Cb%3EFREE%3C%2Fb%3E";
for (const path of [`/tires?${SPOOF}`, `/wheels?${SPOOF}`, `/accessories?${SPOOF}`, `/products/zeta-antarctica-sport?${SPOOF}`]) {
  test(`unknown vehicle text in the URL is never printed: ${path.split("?")[0]} (D91b)`, async ({ page }, info) => {
    skipDuplicate(info);
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await settle(page);
    const text = await page.locator("main").innerText();
    expect(text).not.toContain("416-000-0000");
    expect(text).not.toContain("FREE");
    await expect(chip(page)).toHaveCount(0);
  });
}

/* --- 1d / 8. Inline finder on every category ------------------------------ */

/* Placeholder fitment readings recorded in root llm.md: tires Civic 4 · 5
   (HANDOFF.md §5), accessories Civic 6 · 3 (D67). Wheels' Civic bolt
   pattern split is asserted only for self-consistency. */
const CIVIC_COUNT: Partial<Record<Category, string>> = {
  tires: "4 matches · 5 similar",
  accessories: "6 matches · 3 similar",
};

for (const category of Object.keys(ROUTE) as Category[]) {
  test(`${category}: Add vehicle opens the inline finder, which submits to ${ROUTE[category]}`, async ({
    page,
  }, info) => {
    skipDuplicate(info);
    const watch = watchProblems(page);
    await page.goto(ROUTE[category]);
    await settle(page);

    const summary = page.locator('[data-probe="change-vehicle"]');
    const details = summary.locator("xpath=..");
    await expect(summary).toContainText("Add vehicle");
    await expect(details).not.toHaveAttribute("open");
    await summary.click();
    await expect(details).toHaveAttribute("open", "");

    const finder = details.locator('form[data-probe="finder"]');
    await expect(finder).toBeVisible();
    await expect(finder).toHaveAttribute("action", ROUTE[category]);
    const year = await someYear(finder);
    await finder.getByRole("combobox", { name: "Year" }).selectOption(year);
    await finder.getByRole("combobox", { name: "Make" }).selectOption("Honda");
    await finder.getByRole("combobox", { name: "Model" }).selectOption("Civic");
    const cta = finder.getByRole("button", { name: CTA[category] });
    await expect(cta).toBeVisible();
    await cta.click();

    await expect(page).toHaveURL(
      (u) => u.pathname === ROUTE[category] && u.searchParams.get("model") === "Civic",
    );
    await settle(page);
    await expect(chip(page)).toHaveText(`${year} Honda Civic`);
    await expect(summary).toContainText("Change vehicle");
    const expected = CIVIC_COUNT[category];
    if (expected) await expect(countLine(page)).toHaveText(expected);
    else await expect(countLine(page)).toHaveText(/^\d+ match(es)?( · \d+ similar)?$/);
    watch.expectClean();
  });
}

test("Change vehicle opens from the keyboard and the finder is reachable inside it", async ({
  page,
}, info) => {
  skipDuplicate(info);
  // Safari's plain Tab visits only text fields and selects; Option-Tab reaches
  // every control, so WebKit presses Alt+Tab.
  const key =
    (info.project.use.browserName ?? info.project.use.defaultBrowserType) === "webkit"
      ? "Alt+Tab"
      : "Tab";
  await page.goto(`${ROUTE.wheels}?year=2021&make=Subaru&model=Impreza`);
  await settle(page);
  const summary = page.locator('[data-probe="change-vehicle"]');
  await page.locator('[data-probe="breadcrumb"] span.text-ink').click();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press(key);
    if (await summary.evaluate((el) => el === document.activeElement)) break;
  }
  await expect(summary).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(summary.locator("xpath=..")).toHaveAttribute("open", "");
  await page.keyboard.press(key);
  await expect(page.locator("#finder-year")).toBeFocused();
  // The inline finder ships unselected even with a vehicle in the URL (D28).
  await expect(page.locator("#finder-make")).toHaveValue("");
});

/* --- D70 is progressive enhancement: the no-JS path ------------------------ */

test("with scripting off every model stays reachable and the GET submit still works (D70, D44)", async ({
  browser,
}, info) => {
  skipDuplicate(info);
  test.skip(!/-1440$/.test(info.project.name), "no-JS markup: once per desktop engine");
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL: info.project.use.baseURL,
    viewport: info.project.use.viewport,
  });
  const page = await context.newPage();
  await page.goto("/");
  const finder = finderOf(page);
  // Markup half (passes): nothing narrowed, every model group enabled.
  const groups = await modelGroups(finder);
  expect(groups.length).toBeGreaterThan(1);
  expect(groups.every((g) => !g.hidden && !g.disabled)).toBe(true);
  // Rendered half: the finder must be on screen. Under D62's `loading.tsx`
  // the body arrived inside a streamed `<div hidden id="S:0">` and only the
  // skeleton showed with scripting off (RES-1, fixed by D91b removing it).
  await expect(finder, "finder visible with JS off").toBeVisible();
  await finder.getByRole("combobox", { name: "Make" }).selectOption("Honda");
  await finder.getByRole("combobox", { name: "Year" }).selectOption(await someYear(finder));
  await finder.getByRole("combobox", { name: "Model" }).selectOption("Civic");
  await finder.getByRole("button", { name: CTA.tires }).click();
  await expect(page).toHaveURL((u) => u.pathname === "/tires" && u.searchParams.get("make") === "Honda");
  await expect(countLine(page)).toHaveText("4 matches · 5 similar");
  await context.close();
});

/* --- WDG-17: Change vehicle keeps the page's other filters ------------------ */

/* Owner, 2026-09-30: "Keep filters, stay empty". The inline finder opens
   unselected (D28) but its GET form carries the chips, brand and sort as
   hidden fields; size params are NOT carried because the new vehicle derives
   the size, and `show` is not carried either. */
const KEEP: Record<Category, { filters: string; sizeParams: string }> = {
  tires: { filters: "season=winter&brand=Zeta&sort=price-asc", sizeParams: "width=205&profile=55&rim=16" },
  wheels: { filters: "finish=gloss-black&brand=Touren&sort=price-asc", sizeParams: "diameter=18&width=8" },
  accessories: { filters: "type=tpms&brand=Bosch&sort=price-asc", sizeParams: "" },
};

function expectKept(page: Page, category: Category) {
  const p = params(page);
  const want = new URLSearchParams(KEEP[category].filters);
  for (const key of want.keys()) expect(p.getAll(key), `${key} kept`).toEqual(want.getAll(key));
  for (const key of new URLSearchParams(KEEP[category].sizeParams).keys()) {
    expect(p.has(key), `${key} dropped: the new vehicle derives the size`).toBe(false);
  }
  expect(p.has("show")).toBe(false);
  expect(p.get("make")).toBe("Ford");
  expect(p.get("model")).toBe("F-150");
}

for (const category of Object.keys(ROUTE) as Category[]) {
  test(`${category}: Change vehicle keeps the other filters and opens unselected (WDG-17)`, async ({
    page,
  }, info) => {
    skipDuplicate(info);
    const { filters, sizeParams } = KEEP[category];
    await page.goto(
      `${ROUTE[category]}?${filters}&year=2021&make=Honda&model=Civic&${sizeParams}&show=all`,
    );
    await settle(page);
    const summary = page.locator('[data-probe="change-vehicle"]');
    await expect(summary).toContainText("Change vehicle");
    await summary.click();
    const finder = finderOf(page);
    await expect(finder).toBeVisible();
    // D28 stands: the panel opens empty, not pre-filled with the current car.
    await expect(finder.locator("#finder-make")).toHaveValue("");
    const year = await someYear(finder);
    await finder.getByRole("combobox", { name: "Year" }).selectOption(year);
    await finder.getByRole("combobox", { name: "Make" }).selectOption("Ford");
    await finder.getByRole("combobox", { name: "Model" }).selectOption("F-150");
    await finder.getByRole("button", { name: CTA[category] }).click();

    await expect(page).toHaveURL(
      (u) => u.pathname === ROUTE[category] && u.searchParams.get("model") === "F-150",
    );
    await settle(page);
    expectKept(page, category);
    expect(params(page).get("year")).toBe(year);
    await expect(chip(page)).toHaveText(`${year} Ford F-150`);
  });
}

test("with scripting off, Change vehicle still keeps the other filters (WDG-17)", async ({
  browser,
}, info) => {
  skipDuplicate(info);
  test.skip(!/-1440$/.test(info.project.name), "no-JS markup: once per desktop engine");
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL: info.project.use.baseURL,
    viewport: info.project.use.viewport,
  });
  const page = await context.newPage();
  await page.goto(
    `/tires?${KEEP.tires.filters}&year=2021&make=Honda&model=Civic&${KEEP.tires.sizeParams}`,
  );
  await page.locator('[data-probe="change-vehicle"]').click();
  const finder = finderOf(page);
  await expect(finder).toBeVisible();
  await finder.getByRole("combobox", { name: "Year" }).selectOption(await someYear(finder));
  await finder.getByRole("combobox", { name: "Make" }).selectOption("Ford");
  await finder.getByRole("combobox", { name: "Model" }).selectOption("F-150");
  await finder.getByRole("button", { name: CTA.tires }).click();
  await expect(page).toHaveURL((u) => u.searchParams.get("model") === "F-150");
  expectKept(page, "tires");
  await context.close();
});
