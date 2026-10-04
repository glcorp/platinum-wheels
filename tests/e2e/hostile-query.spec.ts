/**
 * Hostile query strings on the three results routes and the tire PDP (D44:
 * the URL is the state, so a hand-typed or forwarded URL is the input). QA
 * pass D91b, agent HOSTILE. See `tests/llm.md`.
 *
 * Every case is measured in a real browser: HTTP status, the count line, the
 * `Filters (n)` badge, whether every group the badge counts has a VISIBLE
 * selected control the visitor can clear, no horizontal overflow, no console
 * or page errors, and no `NaN` / `Infinity` / `undefined` / `<script` in the
 * page text. The badge and the visible controls must agree — that one
 * invariant is what WDG-08 broke (`?width=abc` read `Filters (1)` over a
 * select showing `Any`).
 *
 * Set `HOSTILE_TABLE=<file>` to append one JSON row per case for the report.
 *
 * Also here, each red before its fix and green after it: WDG-07 (a JS commit
 * pins `min`/`max` at the price bounds), WDG-08 (unknown size values and
 * brands count as filters), WDG-18 (an empty category makes `$Infinity`).
 */
import * as fs from "node:fs";
import { test, expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import {
  SLUG,
  expectNoHorizontalOverflow,
  settle,
  usesSheet,
  watchProblems,
} from "../helpers";

type Category = "tires" | "wheels" | "accessories";

const ROUTE: Record<Category, string> = {
  tires: "/tires",
  wheels: "/wheels",
  accessories: "/accessories",
};

const TABLE = process.env.HOSTILE_TABLE;
const record = (row: Record<string, unknown>) => {
  if (TABLE) fs.appendFileSync(TABLE, `${JSON.stringify(row)}\n`);
};

/** Text a visitor must never read (and `<script`, which would mean a param was
 *  written into the page unescaped). */
const BAD_TOKEN = /\bNaN\b|Infinity|\bundefined\b|<script/i;

/* --- The cases -------------------------------------------------------------- */

interface Case {
  q: string;
  /** Categories the query is meaningful on; default all three. */
  on?: readonly Category[];
}

const ALL: readonly Category[] = ["tires", "wheels", "accessories"];

const CASES: readonly Case[] = [
  { q: "width=abc" },
  { q: "width=215&width=225" },
  { q: "width=215.0" },
  { q: "rim=R17", on: ["tires"] },
  { q: "rim=-1", on: ["tires"] },
  { q: "profile=abc", on: ["tires"] },
  { q: "min=-5&max=999999" },
  { q: "min=200&max=100" },
  { q: "min=NaN" },
  { q: "min=1e309" },
  { q: "min=999999" },
  { q: `max=${"9".repeat(400)}` },
  { q: "brand=Nope" },
  { q: "brand=zeta" },
  { q: "brand=Zeta&brand=zeta" },
  { q: "brand=%3Cscript%3Ealert(1)%3C%2Fscript%3E" },
  { q: "season=winter&season=winter", on: ["tires"] },
  { q: "season=Winter", on: ["tires"] },
  { q: "season=spring", on: ["tires"] },
  { q: "sort=evil" },
  { q: "sort=price-asc&sort=price-desc" },
  { q: "show=all&show=all" },
  { q: "show=9999" },
  { q: "year=1900&make=Honda&model=Civic" },
  { q: "year=2021&make=Honda" },
  { q: "make=%00" },
  { q: `brand=${"a".repeat(3000)}` },
  { q: "x=%E0%A4%A" },
  { q: "width[]=215" },
  { q: "__proto__=1&constructor=x" },
  // Parameters that belong to a different category's route.
  { q: "diameter=18&bolt=5x114.3&finish=gloss-black&type=tpms", on: ["tires"] },
  { q: "profile=55&rim=17&season=winter&type=tpms", on: ["wheels"] },
  { q: "width=215&profile=55&rim=17&season=winter&finish=gloss-black&diameter=18&bolt=5x114.3", on: ["accessories"] },
  // Category-specific.
  { q: "diameter=abc&bolt=%00&finish=nope", on: ["wheels"] },
  { q: "type=nope", on: ["accessories"] },
  { q: "type=tpms&type=tpms", on: ["accessories"] },
];

/* --- Reading the page ------------------------------------------------------- */

const countLine = (page: Page) => page.locator('[data-probe="count"]');
const filtersTrigger = (page: Page) => page.locator('[data-probe="filters-trigger"]');
const sheet = (page: Page) => page.locator('dialog[data-probe="sheet"]');

/** The filter surface this project renders: the rail, or the opened sheet. */
async function filterScope(page: Page, info: TestInfo): Promise<Locator> {
  if (!usesSheet(info)) {
    const rail = page.getByRole("complementary", { name: "Filters" });
    await expect(rail).toBeVisible();
    return rail;
  }
  const dialog = sheet(page);
  if (!(await dialog.evaluate((d) => (d as HTMLDialogElement).open))) {
    await page.getByRole("button", { name: /^Filters/ }).click();
  }
  await expect(dialog).toBeVisible();
  return dialog;
}

interface Selected {
  size: number;
  chip: number;
  brand: number;
  price: boolean;
  groups: number;
}

/** Which groups show a selected control the visitor could clear. */
function readSelected(scope: Locator): Promise<Selected> {
  return scope.evaluate((root) => {
    const size = [...root.querySelectorAll<HTMLSelectElement>('[data-probe="group-size"] select')].filter(
      (s) => s.value !== "",
    ).length;
    const checked = [...root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')];
    const brand = checked.filter((c) => c.name === "brand").length;
    const chip = checked.length - brand;
    const lo = root.querySelector<HTMLInputElement>('input[type="range"][name="min"]');
    const hi = root.querySelector<HTMLInputElement>('input[type="range"][name="max"]');
    const price =
      !!lo && !!hi && (Number(lo.value) !== Number(lo.min) || Number(hi.value) !== Number(hi.max));
    return { size, chip, brand, price, groups: [size > 0, chip > 0, brand > 0, price].filter(Boolean).length };
  });
}

async function overflowMessage(page: Page): Promise<string | null> {
  try {
    await expectNoHorizontalOverflow(page);
    return null;
  } catch (error) {
    return String((error as Error).message).split("\n").slice(0, 3).join(" ");
  }
}

function guardDialogs(page: Page) {
  const seen: string[] = [];
  page.on("dialog", (dialog) => {
    seen.push(dialog.message());
    void dialog.dismiss();
  });
  return seen;
}

/* --- Task 1: results routes -------------------------------------------------- */

for (const category of Object.keys(ROUTE) as Category[]) {
  for (const { q, on = ALL } of CASES) {
    if (!on.includes(category)) continue;
    const label = q.length > 60 ? `${q.slice(0, 40)}…(${q.length} chars)` : q;

    test(`${category} ?${label}`, async ({ page }, info) => {
      const alerts = guardDialogs(page);
      const watch = watchProblems(page);
      const response = await page.goto(`${ROUTE[category]}?${q}`);
      const status = response?.status() ?? 0;
      await settle(page);

      const count = ((await countLine(page).textContent()) ?? "").trim();
      const badge = ((await filtersTrigger(page).textContent()) ?? "").trim();
      const badgeN = badge === "Filters" ? 0 : Number(/^Filters \((\d+)\)$/.exec(badge)?.[1] ?? NaN);

      const scope = await filterScope(page, info);
      const selected = await readSelected(scope);

      const mainText = await page.locator("main#main").evaluate((m) => (m as HTMLElement).innerText);
      const mainContent = (await page.locator("main#main").textContent()) ?? "";
      const badToken = BAD_TOKEN.exec(mainText)?.[0] ?? BAD_TOKEN.exec(mainContent)?.[0] ?? null;
      const overflow = await overflowMessage(page);

      record({
        project: info.project.name,
        route: ROUTE[category],
        q: label,
        status,
        count,
        badge,
        visibleGroups: selected.groups,
        selected,
        overflow,
        badToken,
        console: [...watch.problems.console, ...watch.problems.pageErrors],
        failed: watch.problems.failedRequests,
        alerts,
      });

      expect.soft(status, "HTTP status").toBe(200);
      expect.soft(count, "count line").toMatch(/^\d+ match(?:es)?(?: · \d+ similar)?$/);
      expect
        .soft(
          badgeN,
          `Filters badge "${badge}" counts ${badgeN} group(s) but the controls show ${selected.groups} selected (${JSON.stringify(selected)})`,
        )
        .toBe(selected.groups);
      expect.soft(overflow, "horizontal overflow").toBeNull();
      expect.soft(badToken, "forbidden token in main").toBeNull();
      expect.soft(alerts, "an alert() ran").toEqual([]);
      watch.expectClean();
    });
  }
}

/* --- Task 1: the tire PDP --------------------------------------------------- */

const CELL_VALUE: Record<string, string> = { "1": "1", "2": "2", "4": "4", Custom: "custom" };

const PDP_CASES: ReadonlyArray<{ q: string; qty: string }> = [
  { q: "qty=0", qty: "1" },
  { q: "qty=-1", qty: "1" },
  { q: "qty=99999", qty: "1" },
  { q: "qty=custom&qty=2", qty: "custom" },
  { q: "qty=2&qty=custom", qty: "2" },
  { q: "qty=%3Cscript%3Ealert(1)%3C%2Fscript%3E", qty: "1" },
  { q: "qty=%00", qty: "1" },
  { q: "qty=", qty: "1" },
  { q: "qty=1&qty=1", qty: "1" },
  { q: "width=abc&brand=Nope&min=NaN&sort=evil", qty: "1" },
  { q: "year=1900&make=Honda&model=Civic", qty: "1" },
  { q: "year=2021&make=Honda", qty: "1" },
  { q: "year=2021&make=Honda&model=%3Cscript%3Ealert(1)%3C%2Fscript%3E", qty: "1" },
  { q: "make=%00", qty: "1" },
  { q: `brand=${"a".repeat(3000)}&qty=2`, qty: "2" },
  { q: "x=%E0%A4%A", qty: "1" },
  { q: "__proto__=1&constructor=x", qty: "1" },
  { q: "qty[]=2", qty: "1" },
];

for (const { q, qty } of PDP_CASES) {
  const label = q.length > 60 ? `${q.slice(0, 40)}…(${q.length} chars)` : q;
  test(`pdp tire ?${label}`, async ({ page }, info) => {
    const alerts = guardDialogs(page);
    const watch = watchProblems(page);
    const response = await page.goto(`/products/${SLUG.tire}?${q}`);
    const status = response?.status() ?? 0;
    await settle(page);

    const group = page.getByRole("group", { name: "How many?" });
    const current = await group.getByRole("link").evaluateAll((links) =>
      links
        .filter((a) => a.getAttribute("aria-current") === "true")
        .map((a) => (a.textContent ?? "").trim()),
    );
    const select = page
      .locator('[data-probe="quote-form"]')
      .getByRole("combobox", { name: "Quantity", exact: true });
    const selectValue = await select.inputValue();
    const options = await select.locator("option").evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value));

    const mainText = await page.locator("main#main").evaluate((m) => (m as HTMLElement).innerText);
    const mainContent = (await page.locator("main#main").textContent()) ?? "";
    const badToken = BAD_TOKEN.exec(mainText)?.[0] ?? BAD_TOKEN.exec(mainContent)?.[0] ?? null;
    const overflow = await overflowMessage(page);

    record({
      project: info.project.name,
      route: `/products/${SLUG.tire}`,
      q: label,
      status,
      count: "-",
      badge: "-",
      ariaCurrent: current,
      quoteSelect: selectValue,
      overflow,
      badToken,
      console: [...watch.problems.console, ...watch.problems.pageErrors],
      failed: watch.problems.failedRequests,
      alerts,
    });

    expect.soft(status, "HTTP status").toBe(200);
    expect.soft(current, "exactly one aria-current cell").toHaveLength(1);
    expect.soft(CELL_VALUE[current[0] ?? ""], `aria-current cell "${current[0]}"`).toBe(qty);
    expect.soft(selectValue, "quote select follows the cell").toBe(qty);
    expect.soft(options, "quote select holds a real option").toContain(selectValue);
    expect.soft(overflow, "horizontal overflow").toBeNull();
    expect.soft(badToken, "forbidden token in main").toBeNull();
    expect.soft(alerts, "an alert() ran").toEqual([]);
    watch.expectClean();
  });
}

/* --- Task 2: fixes, red then green ------------------------------------------ */

const param = (page: Page, key: string) => new URL(page.url()).searchParams.getAll(key);
const toggle = (checkbox: Locator) => checkbox.locator("xpath=ancestor::label[1]").click();

test.describe("WDG-07: a JS commit does not pin the price bounds", () => {
  for (const category of Object.keys(ROUTE) as Category[]) {
    test(`${category}: ticking a brand leaves min/max out of the URL`, async ({ page }, info) => {
      await page.goto(ROUTE[category]);
      await settle(page);
      const scope = await filterScope(page, info);
      const brand = scope.locator('input[type="checkbox"][name="brand"]').first();
      const name = (await brand.getAttribute("value")) ?? "";
      await toggle(brand);
      await expect.poll(() => param(page, "brand")).toEqual([name]);
      expect(param(page, "min"), "min pinned at the floor").toEqual([]);
      expect(param(page, "max"), "max pinned at the ceiling").toEqual([]);
      // The badge is unchanged by the fix: one group (brand), not two.
      await expect(filtersTrigger(page)).toHaveText("Filters (1)");
    });
  }

  test("a moved handle is kept, the untouched one is not", async ({ page }, info) => {
    await page.goto(ROUTE.tires);
    await settle(page);
    const scope = await filterScope(page, info);
    const lo = scope.getByRole("slider", { name: "Minimum price" });
    const floor = Number(await lo.getAttribute("min"));
    await lo.focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => param(page, "min")).toEqual([String(floor + 1)]);
    expect(param(page, "max"), "max pinned at the ceiling").toEqual([]);
    await expect(filtersTrigger(page)).toHaveText("Filters (1)");
  });

  test("a URL that names a bound is served, and its own links drop it", async ({ page }) => {
    await page.goto(`${ROUTE.tires}?min=0&max=999999`);
    await settle(page);
    // Neither side is a filter: no badge, and `Load more` does not carry them.
    await expect(filtersTrigger(page)).toHaveText("Filters");
    const more = page.locator('[data-probe="load-more"] a');
    await expect(more).toHaveCount(1);
    await expect(more).toHaveAttribute("href", `${ROUTE.tires}?show=all`);
  });
});

test.describe("WDG-08: what the page has no control for is not a filter", () => {
  for (const category of Object.keys(ROUTE) as Category[]) {
    test(`${category}: brand=Nope reads like the bare route`, async ({ page }, info) => {
      await page.goto(ROUTE[category]);
      await settle(page);
      const bare = ((await countLine(page).textContent()) ?? "").trim();

      await page.goto(`${ROUTE[category]}?brand=Nope`);
      await settle(page);
      await expect(filtersTrigger(page)).toHaveText("Filters");
      await expect(countLine(page)).toHaveText(bare);
      const scope = await filterScope(page, info);
      expect((await readSelected(scope)).groups).toBe(0);
    });
  }

  test("tires: width=abc reads like the bare route", async ({ page }, info) => {
    await page.goto(ROUTE.tires);
    await settle(page);
    const bare = ((await countLine(page).textContent()) ?? "").trim();
    await page.goto(`${ROUTE.tires}?width=abc&rim=R99&profile=zz`);
    await settle(page);
    await expect(filtersTrigger(page)).toHaveText("Filters");
    await expect(countLine(page)).toHaveText(bare);
    await expect(page.locator('[data-probe="similar"]')).toHaveCount(0);
    const scope = await filterScope(page, info);
    expect((await readSelected(scope)).groups).toBe(0);
  });

  test("wheels: an unknown diameter and bolt pattern are dropped", async ({ page }) => {
    await page.goto(`${ROUTE.wheels}?diameter=abc&bolt=%00`);
    await settle(page);
    await expect(filtersTrigger(page)).toHaveText("Filters");
  });

  test("tires: known sizes that no product carries together still reach 0 best (D49)", async ({ page }, info) => {
    // Each value is one the selects offer; the combination matches nothing.
    await page.goto(`${ROUTE.tires}?width=215&profile=45&rim=16`);
    await settle(page);
    await expect(filtersTrigger(page)).toHaveText("Filters (1)");
    await expect(countLine(page)).toHaveText("0 matches · 9 similar");
    await expect(page.locator('[data-probe="best-none"]')).toHaveCount(1);
    const scope = await filterScope(page, info);
    expect((await readSelected(scope)).size).toBe(3);
  });

  test("a known size and a known brand still filter", async ({ page }) => {
    await page.goto(`${ROUTE.tires}?rim=R16&brand=zeta`);
    await settle(page);
    await expect(filtersTrigger(page)).toHaveText("Filters (2)");
  });
});

test.describe("WDG-18: an empty category has no $Infinity price bounds", () => {
  /* Parked (D111). This called `searchSeed(category, [], {})`, a pure function
     over an explicit product list. D108b deleted the seed and `searchResults`
     reads the database, so an empty category is now a database state: the
     test comes back, against an empty fixture category, with the suite's
     fixture database. The rule itself is kept in `search.ts` `buildPrice`
     (`bounds.min ?? 0`). */
  test.fixme("an empty category returns finite price bounds", async () => {});
});
