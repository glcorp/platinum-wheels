/**
 * No-JS matrix (D91b, agent NJR). Every path D44 / D45 / D50 / D83 promises a
 * visitor with scripting off, driven as a plain GET or a plain POST.
 *
 * Out of scope by ruling, not by omission:
 *   - sort is JavaScript-only (D57 addendum to D44) — no test;
 *   - the mobile filter sheet cannot be opened without JS (D83: "cannot be
 *     opened without JS anyway") — recorded by a test, not a defect.
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { SLUG, VEHICLE, scrollSettled, settle, usesSheet, viewportWidth } from "../helpers";

test.use({ javaScriptEnabled: false });

/**
 * Diagnostic switch, OFF by default. Every storefront route streams its page
 * into `<div hidden id="S:0">` behind the `loading.tsx` Suspense fallback (D62),
 * and React's inline `$RC` swap script is what reveals it — so with scripting
 * off the visitor is left on the skeleton (findings NJR-1). `ready()` asserts
 * the real `<main>` is visible, which is the correct behaviour and fails today.
 * `NJR_SIMULATE_SWAP=1` performs that swap by hand after each navigation so the
 * downstream GET/POST paths can still be proven independently of NJR-1. Never
 * set it in CI: it would hide the defect it exists to route around.
 */
const SIMULATE_SWAP = process.env.NJR_SIMULATE_SWAP === "1";

/** No-JS load: `helpers.settle()` cannot be used here — it awaits
 *  `document.fonts.ready` (a promise Firefox never settles with scripting
 *  off) and asserts the streamed swap, which is exactly what NJR-1 is. */
async function loaded(page: Page) {
  await page.waitForLoadState("load");
  await expect(page.locator("main#main")).toHaveCount(1);
}

async function ready(page: Page) {
  await loaded(page);
  if (SIMULATE_SWAP) {
    await page.evaluate(() => {
      for (const seg of [
        ...document.querySelectorAll('div[hidden][id^="S:"]'),
      ]) {
        const tpl = document.getElementById(`B:${seg.id.slice(2)}`);
        const parent = tpl?.parentNode;
        if (!tpl || !parent) continue;
        let node = tpl.nextSibling;
        let depth = 0;
        while (node) {
          const next = node.nextSibling;
          if (node.nodeType === Node.COMMENT_NODE) {
            const data = (node as Comment).data;
            if (data === "/$") {
              if (depth === 0) break;
              depth--;
            } else if (data.startsWith("$")) depth++;
          }
          parent.removeChild(node);
          node = next;
        }
        while (seg.firstChild) parent.insertBefore(seg.firstChild, node);
        seg.remove();
        tpl.remove();
      }
    });
  }
  await expect(
    page.locator("main#main"),
    "the page itself, not the loading.tsx skeleton, is visible without JS",
  ).toBeVisible({ timeout: 3_000 });
}

const CATEGORIES = [
  { name: "tires", route: "/results", cta: "Find my tires" },
  { name: "wheels", route: "/wheels", cta: "Find my wheels" },
  { name: "accessories", route: "/accessories", cta: "Find my accessories" },
] as const;

/** The finder is the only `data-probe="finder"` form on a page. */
const finder = (page: Page) => page.locator('[data-probe="finder"]');

async function pickVehicle(scope: Locator) {
  await scope.getByLabel("Year", { exact: true }).selectOption("2021");
  await scope.getByLabel("Make", { exact: true }).selectOption("Honda");
  await scope.getByLabel("Model", { exact: true }).selectOption("Civic");
}

function paramsOf(page: Page) {
  return new URL(page.url()).searchParams;
}

// --- 1. Finder: home + each category, via the native <details> --------------

test.describe("finder submits as a plain GET", () => {
  test("home hero finder -> /results with the vehicle", async ({ page }) => {
    await page.goto("/");
    await ready(page);
    const form = finder(page);
    await pickVehicle(form);
    await Promise.all([
      page.waitForURL(/\/results\?/),
      form.getByRole("button", { name: /Find my tires/ }).click(),
    ]);
    const p = paramsOf(page);
    expect([p.get("year"), p.get("make"), p.get("model")]).toEqual([
      "2021",
      "Honda",
      "Civic",
    ]);
    await expect(page.locator('[data-probe="vehicle-chip"]')).toContainText(
      "2021 Honda Civic",
    );
  });

  for (const cat of CATEGORIES) {
    test(`${cat.name}: 'Add vehicle' <details> opens natively and submits to ${cat.route}`, async ({
      page,
    }) => {
      await page.goto(cat.route);
      await ready(page);
      const summary = page.locator('[data-probe="change-vehicle"]');
      await expect(summary).toContainText("Add vehicle");
      const details = page.locator("details").filter({ has: summary });
      await expect(details).not.toHaveAttribute("open", /.*/);
      await summary.click();
      await expect(details).toHaveAttribute("open", "");
      const form = finder(page);
      await expect(form).toBeVisible();
      await expect(form).toHaveAttribute("action", cat.route);
      await pickVehicle(form);
      await Promise.all([
        page.waitForURL(
          (u) =>
            u.pathname === cat.route && u.searchParams.get("model") === "Civic",
        ),
        form.getByRole("button", { name: new RegExp(cat.cta) }).click(),
      ]);
      await ready(page);
      await expect(page.locator('[data-probe="vehicle-chip"]')).toContainText(
        "2021 Honda Civic",
      );
      await expect(summary).toContainText("Change vehicle");
    });
  }

  test("results with a vehicle: 'Change vehicle' re-opens and re-submits", async ({
    page,
  }) => {
    await page.goto(`/results?${VEHICLE}`);
    await ready(page);
    const summary = page.locator('[data-probe="change-vehicle"]');
    await expect(summary).toContainText("Change vehicle");
    await summary.click();
    const form = finder(page);
    await expect(form).toBeVisible();
    await form.getByLabel("Year", { exact: true }).selectOption("2019");
    await form.getByLabel("Make", { exact: true }).selectOption("Toyota");
    await form.getByLabel("Model", { exact: true }).selectOption("Camry");
    await Promise.all([
      page.waitForURL((u) => u.searchParams.get("model") === "Camry"),
      form.getByRole("button", { name: /Find my tires/ }).click(),
    ]);
    await expect(page.locator('[data-probe="vehicle-chip"]')).toContainText(
      "2019 Toyota Camry",
    );
  });
});

// --- 2. Model select without JS: every make's optgroup (D70 no-JS path) ------

test("finder Model select without JS lists every make's optgroup, none hidden or disabled", async ({
  page,
}) => {
  await page.goto("/");
  await ready(page);
  const form = finder(page);
  const makes = await form
    .getByLabel("Make", { exact: true })
    .locator("option:not([value=''])")
    .allTextContents();
  const model = form.getByLabel("Model", { exact: true });
  const groups = await model.locator("optgroup").evaluateAll((els) =>
    els.map((g) => ({
      label: g.getAttribute("label"),
      hidden: g.hasAttribute("hidden"),
      disabled: g.hasAttribute("disabled"),
      options: g.querySelectorAll("option").length,
      badOptions: g.querySelectorAll("option[hidden], option[disabled]").length,
    })),
  );
  expect(groups.map((g) => g.label)).toEqual(makes);
  expect(
    groups.filter((g) => g.hidden || g.disabled || g.badOptions > 0),
  ).toEqual([]);
  expect(groups.every((g) => g.options > 0)).toBe(true);
  // Choosing a Make does not narrow Model without JS — every model stays selectable.
  await form.getByLabel("Make", { exact: true }).selectOption("Honda");
  await model.selectOption("Camry");
  await expect(model).toHaveValue("Camry");
});

// --- 3. Rail (>=1100): the <noscript> Apply filters submit (D83) --------------

test.describe("desktop rail without JS (D83)", () => {
  test.beforeEach(({}, info) => {
    test.skip(usesSheet(info), "the rail renders from md: 1100 (D46)");
  });

  for (const cat of CATEGORIES) {
    test(`${cat.name}: exactly one noscript 'Apply filters' submit, in the rail`, async ({
      page,
    }) => {
      await page.goto(cat.route);
      await ready(page);
      const rail = page.getByRole("complementary", { name: "Filters" });
      await expect(rail).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Apply filters" }),
      ).toHaveCount(1);
      await expect(
        rail.getByRole("button", { name: "Apply filters" }),
      ).toBeVisible();
      await expect(rail.locator("form")).toHaveAttribute("method", "get");
      await expect(rail.locator("form")).toHaveAttribute("action", cat.route);
    });
  }

  test("size + chip + brand + price all commit through one GET", async ({
    page,
  }) => {
    await page.goto(`/results?${VEHICLE}`);
    await ready(page);
    const rail = page.getByRole("complementary", { name: "Filters" });
    const width = rail.getByLabel("Width", { exact: true });
    const widthValue = await width
      .locator("option:not([value=''])")
      .first()
      .getAttribute("value");
    expect(widthValue).toBeTruthy();
    await width.selectOption(widthValue!);
    // The chip's input is `sr-only` under its label; click the visible chip.
    await rail.getByText("Winter", { exact: true }).click();
    await expect(
      rail.getByRole("checkbox", { name: "Winter", exact: true }),
    ).toBeChecked();
    const brandGroup = rail.getByRole("group", { name: "Brand" });
    const firstBrand = brandGroup.getByRole("checkbox").first();
    const brandValue = await firstBrand.getAttribute("value");
    await firstBrand.check();
    const minSlider = rail.getByRole("slider", { name: "Minimum price" });
    const before = Number(await minSlider.inputValue());
    // Real keyboard: focus the thumb, step it up ten dollars.
    await minSlider.focus();
    for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
    await expect(minSlider).toHaveValue(String(before + 10));

    await Promise.all([
      page.waitForURL((u) => u.searchParams.has("season")),
      rail.getByRole("button", { name: "Apply filters" }).click(),
    ]);
    await ready(page);
    const p = paramsOf(page);
    expect(p.get("width")).toBe(widthValue);
    expect(p.get("season")).toBe("winter");
    expect(p.get("brand")).toBe(brandValue);
    expect(Number(p.get("min"))).toBe(before + 10);
    // The vehicle rides the hidden inputs (D44).
    expect([p.get("year"), p.get("make"), p.get("model")]).toEqual([
      "2021",
      "Honda",
      "Civic",
    ]);
    // The server rendered the committed state back into the controls.
    const railAfter = page.getByRole("complementary", { name: "Filters" });
    await expect(
      railAfter.getByRole("checkbox", { name: "Winter", exact: true }),
    ).toBeChecked();
    await expect(railAfter.getByLabel("Width", { exact: true })).toHaveValue(
      widthValue!,
    );
  });

  // Known P3, open: design/reports/qa.md §3 NJR-4 (D91b).
  test.fixme("price value labels track the thumb without JS (NJR-4, D91b)", async ({ page }) => {
    // With scripting off the `$min` / `$max` readout is React state and never
    // re-renders — the thumb moves and the number beside it does not. Asserting
    // the correct behaviour; see findings NJR for the measurement.
    await page.goto("/results");
    await ready(page);
    const rail = page.getByRole("complementary", { name: "Filters" });
    const minSlider = rail.getByRole("slider", { name: "Minimum price" });
    const before = Number(await minSlider.inputValue());
    await minSlider.focus();
    for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
    await expect(minSlider).toHaveValue(String(before + 10));
    await expect(
      rail.locator('[data-probe="price-values"] span').first(),
    ).toHaveText(`$${before + 10}`);
  });
});

// --- Sheet: JS-only by D83 ----------------------------------------------------

test("below 1100 without JS the sheet cannot open and no noscript submit renders (D83)", async ({
  page,
}, info) => {
  test.skip(!usesSheet(info), "sheet arrangement only");
  await page.goto("/results");
  await ready(page);
  await expect(
    page.getByRole("complementary", { name: "Filters" }),
  ).toBeHidden();
  const trigger = page.locator('[data-probe="filters-trigger"]');
  await trigger.click();
  await expect(page.locator('[data-probe="sheet"]')).not.toHaveAttribute(
    "open",
    /.*/,
  );
  await expect(
    page.getByRole("button", { name: "Apply filters" }),
  ).toBeHidden();
});

// --- Load more ----------------------------------------------------------------

test("Load more is a ?show=all link that reveals the hidden cards", async ({
  page,
}) => {
  await page.goto("/results");
  await ready(page);
  const cards = page.locator('[data-probe="best-grid"] article');
  const before = await cards.count();
  const more = page.getByRole("link", { name: /Load more/i });
  await expect(more).toHaveAttribute("href", /show=all/);
  await Promise.all([page.waitForURL(/show=all/), more.click()]);
  await ready(page);
  expect(await cards.count()).toBeGreaterThan(before);
  await expect(page.getByRole("link", { name: /Load more/i })).toHaveCount(0);
});

// --- PDP ----------------------------------------------------------------------

test.describe("PDP without JS", () => {
  test("?qty= cells are links and round-trip into the quote select (D50)", async ({
    page,
  }) => {
    await page.goto(`/products/${SLUG.tire}?${VEHICLE}&qty=4`);
    await ready(page);
    const group = page.getByRole("group", { name: "How many?" });
    const cells = group.getByRole("link");
    await expect(cells).toHaveCount(4);
    await expect(
      group.getByRole("link", { name: "4", exact: true }),
    ).toHaveAttribute("aria-current", "true");
    await Promise.all([
      page.waitForURL(/qty=2/),
      group.getByRole("link", { name: "2", exact: true }).click(),
    ]);
    await ready(page);
    await expect(
      page
        .getByRole("group", { name: "How many?" })
        .getByRole("link", { name: "2", exact: true }),
    ).toHaveAttribute("aria-current", "true");
    await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue("2");
    // The vehicle survives the qty link.
    expect(paramsOf(page).get("model")).toBe("Civic");

    await Promise.all([
      page.waitForURL(/qty=custom/),
      page
        .getByRole("group", { name: "How many?" })
        .getByRole("link", { name: /Custom/ })
        .click(),
    ]);
    await ready(page);
    expect(new URL(page.url()).hash).toBe("#quote");
    await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue(
      "custom",
    );
    await expect(page.getByLabel(/How many tires\?/)).toBeVisible();
  });

  test("quote form posts without JS and renders the server's answer", async ({
    page,
  }) => {
    await page.goto(`/products/${SLUG.tire}?${VEHICLE}&qty=4`);
    await ready(page);
    const form = page
      .locator("form")
      .filter({ has: page.getByLabel(/Full name/) });
    await expect(form).toHaveAttribute("method", /post/i);
    // Empty submit: server-side validation must answer (noValidate, D65).
    await Promise.all([
      page.waitForLoadState("load"),
      page.waitForResponse((r) => r.request().method() === "POST"),
      form.getByRole("button", { name: /Send inquiry/ }).click(),
    ]);
    await ready(page);
    await expect(page.getByRole("alert")).toContainText(/field/i);
    await expect(page.getByLabel(/Full name/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    // Valid submit: the success panel replaces the form.
    const again = page
      .locator("form")
      .filter({ has: page.getByLabel(/Full name/) });
    await page.getByLabel(/Full name/).fill("Test Buyer");
    await page
      .getByRole("textbox", { name: /^Email/ })
      .fill("buyer@example.test");
    await page.getByRole("textbox", { name: /^Phone/ }).fill("4165550123");
    await expect(page.getByRole("textbox", { name: /^Phone/ })).toHaveValue("4165550123");
    await scrollSettled(page);
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST"),
      again.getByRole("button", { name: /Send inquiry/ }).click(),
    ]);
    await ready(page);
    await expect(page.getByLabel(/Full name/)).toHaveCount(0);
    await expect(page.locator("main")).toContainText(
      /thank|received|sent|got it/i,
    );
  });
});

// --- Header navigation without JS --------------------------------------------

test.describe("navigation without JS below md: 1100", () => {
  test.beforeEach(({}, info) => {
    test.skip(
      viewportWidth(info) >= 1100,
      "header link row is visible from md:",
    );
  });

  test("footer still reaches every category and page", async ({ page }) => {
    await page.goto("/results");
    await loaded(page);
    const footer = page.getByRole("contentinfo");
    for (const [name, href] of [
      ["Tires", "/results"],
      ["Wheels", "/wheels"],
      ["Accessories", "/accessories"],
      ["About the shop", "/about"],
    ] as const) {
      await expect(
        footer.getByRole("link", { name, exact: true }),
      ).toHaveAttribute("href", href);
    }
  });

  // Known P3, open: design/reports/qa.md §3 NJR-5 (D91b) — senior pass.
  test.fixme("the header Menu button opens navigation without JS (NJR-5, D91b)", async ({
    page,
  }) => {
    // The drawer is a `<dialog>` island (D31). With scripting off the button is
    // visible, focusable and inert; primary nav is reachable only by scrolling
    // to the footer. Asserting the correct behaviour — findings NJR.
    await page.goto("/results");
    await loaded(page);
    const menu = page.getByRole("button", { name: "Menu" });
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
  });
});

// --- With JS: the noscript submit never renders ------------------------------

test.describe("with JS on", () => {
  test.use({ javaScriptEnabled: true });
  test("rail renders no 'Apply filters' button (D82/D83)", async ({
    page,
  }, info) => {
    test.skip(usesSheet(info), "rail only");
    await page.goto("/results");
    await settle(page);
    await expect(
      page.getByRole("button", { name: "Apply filters" }),
    ).toHaveCount(0);
  });
});
