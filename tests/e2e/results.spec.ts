/**
 * Functional flows on the three results routes (D58): `/results` (tires),
 * `/wheels`, `/accessories`. QA pass D91b, agent RES. See `tests/llm.md`.
 *
 * State is the URL (D44): every assertion here reads the URL, the controls and
 * the count line together, because the defects this page has had were all
 * disagreements between the three (D65 brand casing, D72 live region, D85
 * sheet count).
 *
 * Path by width: the rail is the filter surface from 1100px, the sticky bar +
 * `<dialog>` sheet below it (D46, `usesSheet`). Every filter-group test runs
 * through whichever surface the project renders, never both.
 *
 * Pure-logic flows run once per engine at 1440 and on every device; the
 * 1280/1920 desktop projects re-run only the geometry-sensitive price tests.
 */
import { test, expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { settle, usesSheet, watchProblems as watchAll } from "../helpers";

/* --- Local helpers ------------------------------------------------------- */

/** `watchProblems` minus one Firefox-only warning: "resource … preloaded with
 *  link preload was not used within a few seconds" for the next/font woff2
 *  files. Seen once under a loaded 6-agent machine, not reproduced in
 *  isolation, and unrelated to any flow here — recorded in the RES findings,
 *  not asserted, so it cannot mask an interaction error. */
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

type Category = "tires" | "wheels" | "accessories";

const ROUTE: Record<Category, string> = {
  tires: "/results",
  wheels: "/wheels",
  accessories: "/accessories",
};

/** `RESULTS_WINDOW` (src/features/results/types.ts): 6 best + 3 similar (D47(7)). */
const WINDOW = { best: 6, similar: 3 } as const;

/** The 1280/1920 desktop projects duplicate 1440 for width-independent logic. */
const duplicateDesktop = (info: TestInfo) => /-(1280|1920)$/.test(info.project.name);
const skipDuplicate = (info: TestInfo) =>
  test.skip(duplicateDesktop(info), "width-independent logic: covered at 1440 per engine");

const bestCards = (page: Page) => page.locator('[data-probe="best-grid"] > article');
const similarCards = (page: Page) => page.locator('[data-probe="similar-grid"] > article');
const countLine = (page: Page) => page.locator('[data-probe="count"]');
const loadMore = (page: Page) => page.locator('[data-probe="load-more"] a');
/** The `Filters (n)` trigger is in the DOM at every width (md:hidden), so its
 *  text is the `activeGroups` read-out on the rail path too. */
const filtersTrigger = (page: Page) => page.locator('[data-probe="filters-trigger"]');
const sheet = (page: Page) => page.locator('dialog[data-probe="sheet"]');

/** Mobile WebKit (iPhone/iPad projects): Playwright's mouse does not drive a
 *  range there and it has no touch-move API — a harness limit, not a page one. */
const engine = (info: TestInfo) =>
  info.project.use.browserName ?? info.project.use.defaultBrowserType ?? "chromium";
const mobileWebKit = (info: TestInfo) => engine(info) === "webkit" && !!info.project.use.isMobile;

const prefixOf = (info: TestInfo) => (usesSheet(info) ? "sheet" : "rail");

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

/** Click a checkbox the way a person does: on its visible label (chips and
 *  facet rows are native inputs inside a `<label>`). Playwright's click fails
 *  if anything else receives the pointer — the hit test (D86). */
async function toggle(checkbox: Locator) {
  await checkbox.locator("xpath=ancestor::label[1]").click();
}

async function readCount(page: Page) {
  const text = ((await countLine(page).textContent()) ?? "").trim();
  const m = /^(\d+) match(?:es)?(?: · (\d+) similar)?$/.exec(text);
  expect(m, `count line reads "${text}"`).not.toBeNull();
  return { best: Number(m![1]), similar: Number(m![2] ?? 0), text };
}

/** The count line, the two grids, the empty state and `Load more` must agree. */
async function expectGridAgreesWithCount(page: Page, showAll = false) {
  const { best, similar } = await readCount(page);
  if (best + similar === 0) {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("No matches");
    await expect(bestCards(page)).toHaveCount(0);
    await expect(similarCards(page)).toHaveCount(0);
    await expect(loadMore(page)).toHaveCount(0);
    return;
  }
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Best matches");
  await expect(bestCards(page)).toHaveCount(showAll ? best : Math.min(best, WINDOW.best));
  await expect(similarCards(page)).toHaveCount(
    showAll ? similar : Math.min(similar, WINDOW.similar),
  );
  await expect(page.locator('[data-probe="best-none"]')).toHaveCount(best === 0 ? 1 : 0);
  const hidden = !showAll && (best > WINDOW.best || similar > WINDOW.similar);
  await expect(loadMore(page)).toHaveCount(hidden ? 1 : 0);
}

const param = (page: Page, key: string) => new URL(page.url()).searchParams.getAll(key);

async function expectBadge(page: Page, n: number) {
  await expect(filtersTrigger(page)).toHaveText(n === 0 ? "Filters" : `Filters (${n})`);
}

async function cardTexts(page: Page) {
  return page
    .locator('[data-probe="best-grid"] > article, [data-probe="similar-grid"] > article')
    .allInnerTexts();
}

async function cardPrices(cards: Locator) {
  return (await cards.allInnerTexts()).map((t) => Number(/\$(\d+)/.exec(t)?.[1] ?? NaN));
}

/** Reach a control with the real Tab key from the breadcrumb, the page's first
 *  non-link text inside <main>. WebKit's plain Tab visits only text fields and
 *  selects (Safari's default); Option-Tab is how a Safari keyboard user reaches
 *  every control, so WebKit presses Alt+Tab. The loop does not care which
 *  stops an engine makes on the way. */
async function tabTo(page: Page, info: TestInfo, target: string | Locator, max = 40) {
  const el = typeof target === "string" ? page.locator(`#${target}`) : target;
  const key = engine(info) === "webkit" ? "Alt+Tab" : "Tab";
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(key);
    if (await el.evaluate((node) => node === document.activeElement)) return;
  }
  throw new Error(`${key} never reached ${typeof target === "string" ? `#${target}` : target}`);
}

/** Put the sequential-focus start point at the breadcrumb (a click on text). */
const startAtCrumb = (page: Page) =>
  page.locator('[data-probe="breadcrumb"] span.text-ink').click();

/* --- 2 / 4. Every filter group, per category -------------------------------- */

interface GroupPlan {
  size: { caption: string; value: string; card?: RegExp } | null;
  chip: { label: string; value: string; card?: RegExp };
  brand: { name: string; card: RegExp };
}

/* Values are chosen from each category's own option list (categories.ts) and
   the seed (catalog/data.ts, placeholder D48/D58); card predicates read what
   the card itself prints. */
const PLAN: Record<Category, GroupPlan> = {
  tires: {
    size: { caption: "Rim", value: "16", card: /R16\b/ },
    chip: { label: "Winter", value: "winter", card: /winter/i },
    brand: { name: "Zeta", card: /zeta/i },
  },
  wheels: {
    size: { caption: "Diameter", value: "18", card: /\b18×/ },
    chip: { label: "Gloss black", value: "gloss-black" },
    brand: { name: "Touren", card: /touren/i },
  },
  accessories: {
    size: null,
    chip: { label: "TPMS sensors", value: "tpms", card: /tpms/i },
    brand: { name: "Bosch", card: /bosch/i },
  },
};

for (const category of Object.keys(PLAN) as Category[]) {
  test(`${category}: every filter group commits to the URL, the count and the badge`, async ({
    page,
  }, info) => {
    skipDuplicate(info);
    const plan = PLAN[category];
    const watch = watchProblems(page);
    await page.goto(ROUTE[category]);
    await settle(page);
    await expectBadge(page, 0);
    const initial = await readCount(page);
    await expectGridAgreesWithCount(page);

    const scope = await filterScope(page, info);
    let active = 0;

    // Size group (absent on accessories — #50/D58).
    const sizeGroup = scope.locator('[data-probe="group-size"]');
    if (plan.size === null) {
      await expect(sizeGroup).toHaveCount(0);
    } else {
      const select = scope.getByRole("combobox", { name: plan.size.caption, exact: true });
      await select.selectOption(plan.size.value);
      await expect.poll(() => param(page, select_param(category))).toEqual([plan.size.value]);
      await expectBadge(page, ++active);
      await expect(select).toHaveValue(plan.size.value);
      await expectGridAgreesWithCount(page);
      if (plan.size.card) {
        for (const t of await bestCards(page).allInnerTexts()) expect(t).toMatch(plan.size.card);
        for (const t of await similarCards(page).allInnerTexts())
          expect(t).not.toMatch(plan.size.card);
      }
    }

    // Chip group: Season / Finish / Type.
    const chip = scope.getByRole("checkbox", { name: plan.chip.label, exact: true });
    await toggle(chip);
    await expect.poll(() => param(page, chipParam(category))).toEqual([plan.chip.value]);
    await expectBadge(page, ++active);
    await expect(chip).toBeChecked();
    await expectGridAgreesWithCount(page);
    if (plan.chip.card) for (const t of await cardTexts(page)) expect(t).toMatch(plan.chip.card);

    // Brand facet rows (name + count, so match by prefix).
    const brand = scope.getByRole("checkbox", { name: new RegExp(`^${plan.brand.name}\\b`) });
    await toggle(brand);
    await expect.poll(() => param(page, "brand")).toEqual([plan.brand.name]);
    await expectBadge(page, ++active);
    await expect(brand).toBeChecked();
    await expectGridAgreesWithCount(page);
    for (const t of await cardTexts(page)) expect(t).toMatch(plan.brand.card);

    // Untick the brand: the group drops out of the URL and the badge.
    await toggle(brand);
    await expect.poll(() => param(page, "brand")).toEqual([]);
    await expectBadge(page, --active);
    await expect(brand).not.toBeChecked();
    await expectGridAgreesWithCount(page);

    // `Clear all` keeps the route and drops every filter.
    await scope.getByRole("link", { name: "Clear all" }).click();
    await expect(page).toHaveURL((u) => u.pathname === ROUTE[category] && u.search === "");
    await expectBadge(page, 0);
    await expect(countLine(page)).toHaveText(initial.text);
    await expectGridAgreesWithCount(page);
    if (usesSheet(info)) await expect(sheet(page)).not.toBeVisible();
    watch.expectClean();
  });
}

function select_param(category: Category) {
  return category === "wheels" ? "diameter" : "rim";
}
function chipParam(category: Category) {
  return { tires: "season", wheels: "finish", accessories: "type" }[category];
}

/* --- 3. Price range (D69) ------------------------------------------------- */

async function priceParts(scope: Locator) {
  const track = scope.locator('[data-probe="price-track"]');
  // In the sheet the price group can sit below the scroller's fold (320×640).
  await track.scrollIntoViewIfNeeded();
  await expect(track).toBeInViewport({ ratio: 1 });
  const box = (await track.boundingBox())!;
  const minInput = scope.getByRole("slider", { name: "Minimum price" });
  const lo = Number(await minInput.getAttribute("min"));
  const hi = Number(await minInput.getAttribute("max"));
  const fill = track.locator(":scope > span").nth(1);
  return { track, box, fill, lo, hi, minInput, maxInput: scope.getByRole("slider", { name: "Maximum price" }) };
}

test.describe("price range (D69)", () => {
  test("dragging the minimum handle lands it, the value and the fill end on the same point", async ({
    page,
  }, info) => {
    test.skip(mobileWebKit(info), "no touch drag in Playwright on mobile WebKit (harness)");
    await page.goto(ROUTE.wheels); // widest $ range per px of the three seeds
    await settle(page);
    const scope = await filterScope(page, info);
    const { box, fill, lo, hi } = await priceParts(scope);
    const y = box.y + box.height / 2;
    const target = box.x + box.width * 0.25;
    const perPx = (hi - lo) / box.width;

    // At rest the min handle centre is the track's left edge (D69), and so is the fill's.
    const fill0 = (await fill.boundingBox())!;
    expect(Math.abs(fill0.x - box.x), "fill starts at the track edge").toBeLessThanOrEqual(1);

    await page.mouse.move(box.x, y);
    await page.mouse.down();
    await page.mouse.move(target, y, { steps: 10 });
    await page.mouse.up();

    await expect.poll(() => param(page, "min").length).toBe(1);
    const min = Number(param(page, "min")[0]);
    const expected = lo + 0.25 * (hi - lo);
    expect(
      Math.abs(min - expected),
      `min=${min}, pointer implies ${expected.toFixed(1)} (±2px)`,
    ).toBeLessThanOrEqual(Math.max(1, 2 * perPx));
    // The committed fill end sits under the pointer, i.e. under the handle.
    const fill1 = (await scope.locator('[data-probe="price-track"] > span').nth(1).boundingBox())!;
    expect(Math.abs(fill1.x - target), `fill left ${fill1.x} vs pointer ${target}`).toBeLessThanOrEqual(2);
    await expectGridAgreesWithCount(page);
    for (const p of await cardPrices(
      page.locator('[data-probe="best-grid"] > article, [data-probe="similar-grid"] > article'),
    ))
      expect(p).toBeGreaterThanOrEqual(min);
  });

  test("both handles on the ceiling do not lock the control: min can still be dragged back", async ({
    page,
  }, info) => {
    test.skip(mobileWebKit(info), "no touch drag in Playwright on mobile WebKit (harness)");
    await page.goto(ROUTE.tires);
    await settle(page);
    const scope = await filterScope(page, info);
    const { box, hi } = await priceParts(scope);
    const y = box.y + box.height / 2;

    // Drag min past the right end: both handles now sit on the ceiling.
    await page.mouse.move(box.x, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width + 24, y, { steps: 12 });
    await page.mouse.up();
    await expect.poll(() => param(page, "min")).toEqual([String(hi)]);
    // WDG-07 (D91b): a handle on its bound is no filter, so max stays out of the URL.
    expect(param(page, "max")).toEqual([]);

    // Grab the stacked pair at the ceiling and pull left: min must move.
    const again = await priceParts(await filterScope(page, info));
    const y2 = again.box.y + again.box.height / 2;
    await page.mouse.move(again.box.x + again.box.width, y2);
    await page.mouse.down();
    await page.mouse.move(again.box.x + again.box.width * 0.5, y2, { steps: 12 });
    await page.mouse.up();
    await expect
      .poll(() => Number(param(page, "min")[0]), { message: "min moved off the ceiling" })
      .toBeLessThan(hi - 5);
    expect(param(page, "max")).toEqual([]); // WDG-07 (D91b): max sits on its bound, so it is not in the URL
  });

  test("keyboard arrows step the minimum and keep focus on it", async ({ page }, info) => {
    skipDuplicate(info);
    await page.goto(ROUTE.tires);
    await settle(page);
    const scope = await filterScope(page, info);
    const { lo, minInput } = await priceParts(scope);
    const id = `${prefixOf(info)}-price-min`;
    if (!usesSheet(info)) await startAtCrumb(page);
    await tabTo(page, info, id);

    await page.keyboard.press("ArrowRight");
    await expect.poll(() => param(page, "min")).toEqual([String(lo + 1)]);
    await expect(minInput).toBeFocused();
    await expect(minInput).toHaveAttribute("aria-valuetext", `$${lo + 1}`);
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => param(page, "min")).toEqual([String(lo + 2)]);
    await expect(minInput).toBeFocused();
    await expectBadge(page, 1);
  });
});

/* --- 4. Removable chip (the only one ships on /styleguide) ---------------- */

test("removable chip is named by its action, not only its value (D66)", async ({ page }, info) => {
  skipDuplicate(info);
  test.skip(info.project.name !== "chromium-1440" && !/^(firefox|webkit)-1440$/.test(info.project.name),
    "static markup check: once per engine");
  await page.goto("/styleguide");
  await settle(page);
  const chip = page.getByRole("button", { name: "Remove 215/55R16" });
  await expect(chip).toBeVisible();
  await expect(chip).not.toHaveAttribute("aria-pressed");
});

/* --- 5. Brand case-insensitivity (D65) ------------------------------------ */

test("brand matching ignores case in the grid and in the facet row (D65)", async ({ page }, info) => {
  skipDuplicate(info);
  const texts: string[] = [];
  for (const brand of ["Zeta", "zeta", "ZETA"]) {
    await page.goto(`${ROUTE.tires}?brand=${brand}`);
    await settle(page);
    texts.push((await readCount(page)).text);
    await expect(page.locator("#rail-brand-zeta")).toBeChecked();
    await expect(page.locator("#sheet-brand-zeta")).toBeChecked();
    await expectBadge(page, 1);
    await expectGridAgreesWithCount(page);
  }
  expect(new Set(texts).size, texts.join(" | ")).toBe(1);
  expect(texts[0]).not.toBe("0 matches");
});

/* --- 6. Sort (D65 refocus) ------------------------------------------------ */

test("sort by keyboard reorders the grid and focus stays on the select (D65)", async ({
  page,
}, info) => {
  skipDuplicate(info);
  const watch = watchProblems(page);
  await page.goto(ROUTE.tires);
  await settle(page);
  const id = usesSheet(info) ? "results-sort-bar" : "results-sort";
  const select = page.locator(`#${id}`);
  await expect(select).toBeVisible();
  await startAtCrumb(page);
  await tabTo(page, info, id, 12);

  // Typeahead on a closed select: "p" → "Price: low to high" (the bar variant
  // prefixes "Sort: ", so it is typed out). ArrowDown opens the popup on macOS.
  await page.keyboard.type(usesSheet(info) ? "Sort: P" : "P");
  await expect.poll(() => param(page, "sort")).toEqual(["price-asc"]);
  await expect(select).toHaveValue("price-asc");
  await expect(select, "focus survives the keyed re-mount").toBeFocused();
  const prices = await cardPrices(bestCards(page));
  expect(prices).toEqual([...prices].sort((a, b) => a - b));
  await expect(select).toHaveAttribute("aria-busy", "false");
  watch.expectClean();
});

/* --- 7. Load more (D68) --------------------------------------------------- */

test.describe("load more (D68)", () => {
  for (const category of Object.keys(ROUTE) as Category[]) {
    test(`${category}: reveals the rest of the window and holds the scroll position`, async ({
      page,
    }, info) => {
      skipDuplicate(info);
      await page.goto(ROUTE[category]);
      await settle(page);
      const { best } = await readCount(page);
      test.skip(best <= WINDOW.best, "seed no longer overflows the window");
      await expect(bestCards(page)).toHaveCount(WINDOW.best);
      const link = loadMore(page);
      await link.scrollIntoViewIfNeeded();
      // Instant, not a wheel: mobile WebKit has no wheel, and a smooth wheel
      // scroll is still travelling when the reading is taken.
      await page.evaluate(() => window.scrollBy({ top: 120, behavior: "instant" }));
      const before = await page.evaluate(() => window.scrollY);
      expect(before).toBeGreaterThan(0);
      await expect(link).toBeInViewport();
      await link.click();
      await expect.poll(() => param(page, "show")).toEqual(["all"]);
      await expect(bestCards(page)).toHaveCount(best);
      await expectGridAgreesWithCount(page, true);
      const after = await page.evaluate(() => window.scrollY);
      expect(Math.abs(after - before), `scrollY ${before} → ${after}`).toBeLessThanOrEqual(4);
    });
  }

  // Known, not new: src/features/results/llm.md Open #7 and D68 "Not fixed,
  // recorded" — the link unmounts on arrival and focus falls to <body>. Fix
  // needs a leaf island; owner.
  test.fixme("keyboard focus survives Load more (known: results/llm.md Open #7, D68)", async ({
    page,
  }) => {
    await page.goto(ROUTE.tires);
    await settle(page);
    await loadMore(page).focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => param(page, "show")).toEqual(["all"]);
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
  });
});

/* --- 9. Filter sheet (below 1100 only) ------------------------------------ */

test.describe("filter sheet", () => {
  test.beforeEach(({}, info) => {
    test.skip(!usesSheet(info), "the sheet is the <1100px surface (D46)");
  });

  test("opens modal, locks scroll, closes by button / Esc / backdrop, focus returns", async ({
    page,
  }, info) => {
    const watch = watchProblems(page);
    await page.goto(ROUTE.tires);
    await settle(page);
    const trigger = page.getByRole("button", { name: /^Filters/ });
    const dialog = sheet(page);

    // Opened from the keyboard, so "focus returns" is tested the way a
    // keyboard user meets it. (A tapped WebKit button never takes focus, so a
    // pointer-opened sheet there has nothing to return focus to.)
    const open = async () => {
      await startAtCrumb(page);
      await tabTo(page, info, trigger);
      await page.keyboard.press("Enter");
      await expect(dialog).toBeVisible();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      expect(await dialog.evaluate((d) => d.matches(":modal"))).toBe(true);
      expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    };
    const expectClosed = async () => {
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await expect(trigger, "focus returns to the trigger").toBeFocused();
      expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
    };

    await open();
    await dialog.getByRole("button", { name: "Close filters" }).click();
    await expectClosed();

    await open();
    await page.keyboard.press("Escape");
    await expectClosed();

    await open();
    // The scrim: the dialog box itself above the panel (panel = 100dvh - 144px).
    const vp = page.viewportSize()!;
    await page.mouse.click(vp.width / 2, 40);
    await expectClosed();

    // Overscroll containment on the body scroller (D65).
    await open();
    const scroller = dialog.locator("form").locator("xpath=..");
    expect(await scroller.evaluate((el) => getComputedStyle(el).overscrollBehaviorY)).toBe("contain");
    watch.expectClean();
  });

  test("Tab stays inside the open sheet", async ({ page }, info) => {
    await page.goto(ROUTE.tires);
    await settle(page);
    await page.getByRole("button", { name: /^Filters/ }).click();
    const dialog = sheet(page);
    await expect(dialog).toBeVisible();
    const escaped: string[] = [];
    const key = engine(info) === "webkit" ? "Alt+Tab" : "Tab";
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press(key);
      const where = await page.evaluate(() => {
        const a = document.activeElement;
        const d = document.querySelector('dialog[data-probe="sheet"]');
        if (!a || a === document.body || a === document.documentElement) return "chrome";
        return d?.contains(a) ? "inside" : `${a.tagName}.${a.className.toString().slice(0, 40)}`;
      });
      // Leaving to browser chrome (body) is how a native modal wraps; landing
      // on page content behind it is the failure.
      if (where !== "inside" && where !== "chrome") escaped.push(where);
    }
    expect(escaped).toEqual([]);
  });

  test("a change commits live; Apply closes the sheet and keeps the committed state (D85)", async ({
    page,
  }, info) => {
    await page.goto(ROUTE.tires);
    await settle(page);
    const trigger = page.getByRole("button", { name: /^Filters/ });
    await startAtCrumb(page);
    await tabTo(page, info, trigger);
    await page.keyboard.press("Enter");
    const dialog = sheet(page);
    await expect(dialog).toBeVisible();
    const brand = dialog.getByRole("checkbox", { name: /^ZMAX\b/ });
    await toggle(brand);
    await expect.poll(() => param(page, "brand")).toEqual(["ZMAX"]);
    await expect(dialog, "a change does not close the sheet").toBeVisible();
    await expect(brand).toBeChecked();
    const apply = dialog.getByRole("button", { name: "Apply", exact: true });
    await expect(apply).toHaveText("Apply");
    await apply.click();
    await expect(dialog).not.toBeVisible();
    expect(param(page, "brand")).toEqual(["ZMAX"]);
    await expect(trigger).toHaveText("Filters (1)");
    await expect(trigger).toBeFocused();
    await expectGridAgreesWithCount(page);
  });

  test("the sheet closes itself when the viewport crosses into the rail layout", async ({ page }) => {
    await page.goto(ROUTE.tires);
    await settle(page);
    await page.getByRole("button", { name: /^Filters/ }).click();
    await expect(sheet(page)).toBeVisible();
    await page.setViewportSize({ width: 1200, height: 900 });
    await expect(sheet(page)).not.toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  });
});

/* --- 10. Back / forward and bfcache (D44, D66) ---------------------------- */

async function expectControlsMatchUrl(page: Page) {
  const url = new URL(page.url());
  const rim = url.searchParams.get("rim") ?? "";
  const seasons = url.searchParams.getAll("season");
  const brands = url.searchParams.getAll("brand").map((b) => b.toLowerCase());
  for (const prefix of ["rail", "sheet"]) {
    await expect(page.locator(`#${prefix}-rim`)).toHaveValue(rim);
    for (const s of ["all-season", "winter", "summer"]) {
      const box = page.locator(`#${prefix}-season-${s}`);
      if (seasons.includes(s)) await expect(box).toBeChecked();
      else await expect(box).not.toBeChecked();
    }
    for (const b of ["zeta", "zmax", "mazzini"]) {
      const box = page.locator(`#${prefix}-brand-${b}`);
      if (brands.includes(b)) await expect(box).toBeChecked();
      else await expect(box).not.toBeChecked();
    }
  }
  await expectGridAgreesWithCount(page, url.searchParams.get("show") === "all");
}

test.describe("history", () => {
  test("back and forward restore filter state: URL, controls and count agree", async ({
    page,
  }, info) => {
    skipDuplicate(info);
    await page.goto(ROUTE.tires);
    await settle(page);
    const plain = (await readCount(page)).text;
    await page.goto(`${ROUTE.tires}?season=winter&brand=Zeta`);
    await settle(page);
    const filtered = (await readCount(page)).text;
    expect(filtered).not.toBe(plain);
    await expectControlsMatchUrl(page);

    await page.goBack();
    await expect(page).toHaveURL((u) => u.pathname === ROUTE.tires && u.search === "");
    await expect(countLine(page)).toHaveText(plain);
    await expectControlsMatchUrl(page);

    await page.goForward();
    await expect(page).toHaveURL(/season=winter/);
    await expect(countLine(page)).toHaveText(filtered);
    await expectControlsMatchUrl(page);
  });

  test("a filter set in the UI survives a trip to a PDP and Back", async ({ page }, info) => {
    skipDuplicate(info);
    await page.goto(ROUTE.tires);
    await settle(page);
    const scope = await filterScope(page, info);
    await scope.getByRole("combobox", { name: "Rim", exact: true }).selectOption("17");
    await expect.poll(() => param(page, "rim")).toEqual(["17"]);
    await toggle(scope.getByRole("checkbox", { name: /^ZMAX\b/ }));
    await expect.poll(() => param(page, "brand")).toEqual(["ZMAX"]);
    const committed = page.url();
    const count = (await readCount(page)).text;
    if (usesSheet(info)) await sheet(page).getByRole("button", { name: "Close filters" }).click();

    // Client-side navigation to a PDP, then Back.
    await bestCards(page)
      .first()
      .locator('a[href^="/products/"]:not([aria-hidden="true"])')
      .first()
      .click();
    await expect(page).toHaveURL(/\/products\//);
    await page.goBack();
    await expect(page).toHaveURL(committed);
    await expect(countLine(page)).toHaveText(count);
    await expectControlsMatchUrl(page);

    // Full-document navigation away (bfcache candidate), then Back.
    await page.goto("/about");
    await page.goBack();
    await expect(page).toHaveURL(committed);
    await settle(page);
    await expect(countLine(page)).toHaveText(count);
    await expectControlsMatchUrl(page);
  });
});

/* --- 11. Empty, one, many; the live region (D57, D72) --------------------- */

test.describe("result states", () => {
  test("filtering to nothing keeps the SAME live-region node and announces 0 matches", async ({
    page,
  }, info) => {
    skipDuplicate(info);
    // Zeta sells no summer tire in the seed (catalog/data.ts, placeholder D48).
    await page.goto(`${ROUTE.tires}?brand=Zeta`);
    await settle(page);
    const live = countLine(page);
    await expect(live).toHaveAttribute("aria-live", "polite");
    await expect(live).toHaveAttribute("aria-atomic", "true");
    const before = (await readCount(page)).text;
    await live.evaluate((el) => ((el as HTMLElement & { __qa?: number }).__qa = 1));

    const scope = await filterScope(page, info);
    const summer = scope.getByRole("checkbox", { name: "Summer", exact: true });
    await toggle(summer);
    await expect.poll(() => param(page, "season")).toEqual(["summer"]);
    await expect(live).toHaveText("0 matches");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("No matches");
    expect(
      await live.evaluate((el) => (el as HTMLElement & { __qa?: number }).__qa),
      "live region was remounted (D72)",
    ).toBe(1);
    await expect(live).toHaveClass(/sr-only/);
    await expectGridAgreesWithCount(page);

    await toggle(scope.getByRole("checkbox", { name: "Summer", exact: true }));
    await expect(live).toHaveText(before);
    expect(await live.evaluate((el) => (el as HTMLElement & { __qa?: number }).__qa)).toBe(1);
  });

  test("the empty state offers Clear all and a call, and Clear all recovers", async ({ page }, info) => {
    skipDuplicate(info);
    await page.goto(`${ROUTE.accessories}?type=centre-caps&brand=Bosch`);
    await settle(page);
    await expect(countLine(page)).toHaveText("0 matches");
    const empty = page.locator('section[data-probe="empty"]');
    await expect(empty.getByRole("link", { name: /^Call / })).toHaveAttribute("href", /^tel:\+1/);
    await empty.getByRole("link", { name: "Clear all" }).click();
    await expect(page).toHaveURL((u) => u.pathname === ROUTE.accessories && u.search === "");
    await expectGridAgreesWithCount(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Best matches");
  });

  test("one result singularises; a size splits best and similar", async ({ page }, info) => {
    skipDuplicate(info);
    // Seed: one bronze Spec-1 wheel (catalog/data.ts, D58 placeholder).
    await page.goto(`${ROUTE.wheels}?finish=bronze&brand=Spec-1`);
    await settle(page);
    await expect(countLine(page)).toHaveText("1 match");
    await expectGridAgreesWithCount(page);
    await expectBadge(page, 2);

    // HANDOFF.md §5: `/results?rim=R17` strips to 17 → 3 matches · 6 similar.
    await page.goto(`${ROUTE.tires}?rim=R17`);
    await settle(page);
    await expect(countLine(page)).toHaveText("3 matches · 6 similar");
    await expectGridAgreesWithCount(page);
    await expect(page.getByRole("heading", { level: 2, name: "Similar matches" })).toBeVisible();

    // Best empty, similar populated (D49). WDG-08 (D91b): the sizes are ones the
    // selects offer (an unknown width is dropped now), but no tire carries them together.
    await page.goto(`${ROUTE.tires}?width=215&profile=45&rim=16`);
    await settle(page);
    const { best, similar } = await readCount(page);
    expect(best).toBe(0);
    expect(similar).toBeGreaterThan(0);
    await expectGridAgreesWithCount(page);
  });
});

/* --- 12. aria-busy during a transition (D66/D67) -------------------------- */

test("the filter form reports aria-busy=true while a change is in flight", async ({ page }, info) => {
  skipDuplicate(info);
  await page.goto(ROUTE.tires);
  await settle(page);
  const scope = await filterScope(page, info);
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __busy: string[] }).__busy = seen;
    new MutationObserver((records) => {
      for (const r of records) {
        const el = r.target as Element;
        if (el.tagName === "FORM") seen.push(el.getAttribute("aria-busy") ?? "");
      }
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["aria-busy"] });
  });
  await toggle(scope.getByRole("checkbox", { name: /^Mazzini\b/ }));
  await expect.poll(() => param(page, "brand")).toEqual(["Mazzini"]);
  const seen = await page.evaluate(() => (window as unknown as { __busy: string[] }).__busy);
  expect(seen, "aria-busy transitions observed on the form").toContain("true");
  const forms = scope.locator("form");
  await expect(forms.first()).toHaveAttribute("aria-busy", "false");
});

/* --- D44 / D83: the no-JS path -------------------------------------------- */

test("with scripting off the results page renders and the rail's noscript submit commits (D44, D83)", async ({
  browser,
}, info) => {
  test.skip(!/-1440$/.test(info.project.name), "no-JS rail path: once per desktop engine");
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL: info.project.use.baseURL,
    viewport: info.project.use.viewport,
  });
  const page = await context.newPage();
  await page.goto(ROUTE.tires);
  // Under D62's `loading.tsx` the body sat in `<div hidden id="S:0">` until an
  // inline script swapped it in, so with scripting off it never showed
  // (RES-1, fixed by D91b removing that file). Regression guard.
  await expect(page.getByRole("heading", { level: 1 }), "page h1 visible with JS off").toBeVisible();
  const rail = page.getByRole("complementary", { name: "Filters" });
  await rail.getByRole("checkbox", { name: /^Zeta\b/ }).check();
  await rail.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/brand=Zeta/);
  await expect(countLine(page)).toHaveText("2 matches");
  await context.close();
});

/* --- D91b WDG-06: the card photo's `sizes` crosses at the grid's breakpoints */

test("card photos fetch a candidate at least as wide as they paint (WDG-06)", async ({
  page,
}, info) => {
  // 412px Pixel 7, DPR 2.625: the 1-up band where the old `sizes` claimed
  // `50vw` and the browser fetched a 640w candidate for a ~378px box.
  test.skip(info.project.name !== "pixel-7", "the 1-up phone band, at a real DPR");
  await page.goto(ROUTE.tires);
  await settle(page);
  const cards = bestCards(page);
  const n = await cards.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const img = cards.nth(i).locator("img").first();
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
      .toBe(true);
    // `naturalWidth` on a srcset image is density-corrected (CSS px), so the
    // file's real pixel width is read by decoding `currentSrc` on its own.
    const m = await img.evaluate(async (el: HTMLImageElement) => {
      const probe = new Image();
      probe.src = el.currentSrc;
      await probe.decode();
      return {
        natural: probe.naturalWidth,
        painted: el.getBoundingClientRect().width,
        dpr: devicePixelRatio,
        src: el.currentSrc,
      };
    });
    expect(
      m.natural,
      `card ${i}: ${m.src} is ${m.natural}px for a ${m.painted.toFixed(0)}px box at DPR ${m.dpr}`,
    ).toBeGreaterThanOrEqual(Math.floor(m.painted * m.dpr));
  }
});

/* --- Rapid filter changes (D91b) -------------------------------------------- */

/* `FilterPanel`'s form is `key={href}`: every committed URL re-mounts it. Its
   native `change` listener used to be attached in a passive `useEffect`, so a
   click landing between the commit that mounted the new form and that effect
   toggled the control and committed nothing — measured ~1 in 4 in WebKit. The
   test clicks the next control the instant the URL shows the previous change,
   with no wait on `aria-busy` or the grid, which is exactly that window. Four
   round trips per category so a 1-in-4 race cannot slip through. */
test.describe("rapid filter changes (D91b)", () => {
  for (const category of Object.keys(PLAN) as Category[]) {
    test(`${category}: a click straight after a commit still commits`, async ({ page }, info) => {
      skipDuplicate(info);
      const plan = PLAN[category];
      const watch = watchProblems(page);
      await page.goto(ROUTE[category]);
      await settle(page);
      const scope = await filterScope(page, info);
      const chip = scope.getByRole("checkbox", { name: plan.chip.label, exact: true });
      const brand = scope.getByRole("checkbox", { name: new RegExp(`^${plan.brand.name}\\b`) });
      const arrives = { timeout: 10_000 };

      for (let round = 1; round <= 4; round++) {
        const at = `round ${round}`;
        await toggle(chip);
        await expect
          .poll(() => param(page, chipParam(category)), { ...arrives, message: `${at}: chip on` })
          .toEqual([plan.chip.value]);
        // No wait for `aria-busy` or the grid: the next click lands as soon as
        // the URL moves.
        await toggle(brand);
        await expect
          .poll(() => param(page, "brand"), { ...arrives, message: `${at}: brand on` })
          .toEqual([plan.brand.name]);
        await toggle(brand);
        await expect
          .poll(() => param(page, "brand"), { ...arrives, message: `${at}: brand off` })
          .toEqual([]);
        await toggle(chip);
        await expect
          .poll(() => param(page, chipParam(category)), { ...arrives, message: `${at}: chip off` })
          .toEqual([]);
      }
      await expectBadge(page, 0);
      await expectGridAgreesWithCount(page);
      watch.expectClean();
    });
  }
});
