/**
 * Product detail page (D91b QA pass, agent HPD).
 *
 * Covers: the `?qty=` cells and the quote-band select that must follow them
 * (D50, D84), per-category default quantity (D65 item 7), the `Custom`
 * quantity field (D75), the quote form's validation, focus and success paths
 * (D51, D57, D65), the `beforeunload` guard (D65 item 6), CASL consent
 * (`docs/decisions.md` §7), the preferred-contact radios (D53(7)), the
 * unavailable SKU (§7.16, PARKED D54), the breadcrumb back-link (D53(6)),
 * similar products (D52, D59(6)) and `tel:` hrefs (D76).
 *
 * Rules: `tests/llm.md`. Real mouse clicks for `?qty=` — a synthetic
 * `.click()` forces a full reload and masked D84.
 */
import { test, expect, type Page } from "@playwright/test";
import { SLUG, VEHICLE, isPhone, isTouch, scrollSettled, settle, watchProblems } from "../helpers";

/** `src/features/catalog/data.ts` — slug → category, for D59(6). Seed data (D48). */
const CATEGORY_SLUGS = {
  tires: [
    "zeta-antarctica-sport",
    "zmax-winterhawk",
    "zmax-landgema",
    "mazzini-snowleopard",
    "zeta-antarctica-sport-235-40r18",
    "zmax-landgema-235-40r18",
    "mazzini-snowleopard-225-50r17",
    "zmax-winterhawk-215-50r17",
    "zmax-landgema-225-45r17",
  ],
  wheels: [
    "touren-tr76-17x7",
    "touren-tr76-18x8",
    "touren-tr76-20x9",
    "touren-tr79-17x7",
    "touren-tr79-18x8",
    "touren-tr79-20x85",
    "spec1-sp51-17x75",
    "spec1-sp51-18x85",
    "spec1-sp51-20x9",
  ],
  accessories: [
    "bosch-tpms-315",
    "bosch-tpms-433",
    "gorilla-lug-nuts-acorn",
    "gorilla-lug-nuts-spike",
    "gorilla-lug-nuts-spike-1225",
    "gorilla-wheel-locks",
    "gorilla-wheel-locks-tuner",
    "sentali-centre-cap-chrome",
    "sentali-centre-cap-black",
  ],
} as const;
type Category = keyof typeof CATEGORY_SLUGS;
const categoryOf = (slug: string): Category | undefined =>
  (Object.keys(CATEGORY_SLUGS) as Category[]).find((c) =>
    (CATEGORY_SLUGS[c] as readonly string[]).includes(slug),
  );

const ALLOWED_TEL = ["tel:+14378825000", "tel:+13659980990"];

const PDPS: Array<{ category: Category; slug: string; crumb: string; route: string; defaultQty: string; unitMany: string }> = [
  { category: "tires", slug: SLUG.tire, crumb: "Results", route: "/results", defaultQty: "4", unitMany: "tires" },
  { category: "wheels", slug: SLUG.wheel, crumb: "Wheels", route: "/wheels", defaultQty: "4", unitMany: "wheels" },
  {
    category: "accessories",
    slug: SLUG.accessory,
    crumb: "Accessories",
    route: "/accessories",
    defaultQty: "1",
    unitMany: "items",
  },
];

// --- locators ----------------------------------------------------------------

const cells = (page: Page) => page.getByRole("group", { name: "How many?" });
const cell = (page: Page, label: string) =>
  cells(page).getByRole("link", { name: label, exact: true });
const quoteForm = (page: Page) => page.locator('[data-probe="quote-form"]');
const qtySelect = (page: Page) =>
  quoteForm(page).getByRole("combobox", { name: "Quantity", exact: true });
const customField = (page: Page) => page.locator("#quote-custom-quantity");
const submit = (page: Page) => quoteForm(page).getByRole("button", { name: /Send inquiry/ });
const nameField = (page: Page) => page.locator("#quote-name");
const emailField = (page: Page) => page.locator("#quote-email");
const phoneField = (page: Page) => page.locator("#quote-phone");
const errorSummary = (page: Page) => quoteForm(page).getByRole("alert");
const successPanel = (page: Page) => page.locator('[data-probe="quote-success"]');

/** Test values only — nothing is sent (D51, delivery PARKED D54). */
async function fillValid(page: Page) {
  await nameField(page).fill("Test Person");
  await emailField(page).fill("test.person@example.com");
  await phoneField(page).fill("416-555-0123");
}

async function openPdp(page: Page, path: string) {
  const res = await page.goto(path);
  expect(res?.status()).toBe(200);
  await settle(page);
}

/** The Server Action is only wired after hydration; submit until the form
 *  reacts (summary, success, or a field error), never on a timer. */
async function submitAndWait(page: Page) {
  await expect(async () => {
    await submit(page).click();
    await expect(
      errorSummary(page).or(successPanel(page)).or(page.locator('[id$="-error"]')).first(),
    ).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

async function selectedCells(page: Page) {
  // evaluateAll does not wait: settle on exactly one marked cell first.
  await expect(cells(page).locator('[aria-current="true"]')).toHaveCount(1);
  return cells(page)
    .getByRole("link")
    .evaluateAll((els) =>
      els.filter((e) => e.getAttribute("aria-current") === "true").map((e) => e.textContent?.trim()),
    );
}

/*
 * PDP logic does not change between the 1280/1440/1920 desktop widths (one
 * `md:` split layout), so the desktop matrix runs at 1440 per engine; every
 * device project runs in full.
 */
test.beforeEach(({}, info) => {
  test.skip(/-(1280|1920)$/.test(info.project.name), "PDP desktop coverage runs at 1440 per engine");
});

// ---------------------------------------------------------------------------
// 5. Quantity cells ↔ quote select
// ---------------------------------------------------------------------------

test.describe("quantity cells (D50, D84)", () => {
  test("each real click sets ?qty=, marks the cell and resyncs the quote select", async ({
    page,
  }) => {
    const watch = watchProblems(page);
    await openPdp(page, `/products/${SLUG.tire}?${VEHICLE}`);
    await expect(qtySelect(page)).toHaveValue("4");
    expect(await selectedCells(page)).toEqual(["4"]);

    const steps: Array<[string, string]> = [
      ["1", "1"],
      ["2", "2"],
      ["Custom", "custom"],
      ["4", "4"],
      ["Custom", "custom"],
      ["1", "1"],
    ];
    for (const [label, value] of steps) {
      await cell(page, label).click();
      await expect(page).toHaveURL(new RegExp(`[?&]qty=${value}(&|#|$)`));
      await expect(cell(page, label)).toHaveAttribute("aria-current", "true");
      expect(await selectedCells(page), `after ${label}`).toEqual([label]);
      await expect(qtySelect(page), `select after clicking ${label}`).toHaveValue(value);
      if (value === "custom") {
        await expect(page).toHaveURL(/#quote$/);
        await expect(customField(page)).toBeVisible();
        await expect(page.getByLabel("How many tires?")).toBeVisible();
      } else {
        await expect(customField(page)).toHaveCount(0);
      }
      // The vehicle survives every qty change.
      expect(new URL(page.url()).searchParams.get("model")).toBe("Civic");
    }
    watch.expectClean();
  });

  test("typed quote input survives a ?qty= click (the D65 data-loss premise, D84)", async ({
    page,
  }) => {
    await openPdp(page, `/products/${SLUG.tire}`);
    await nameField(page).fill("Kept Name");
    await emailField(page).fill("kept@example.com");
    await cell(page, "2").click();
    await expect(page).toHaveURL(/qty=2/);
    await expect(qtySelect(page)).toHaveValue("2");
    await expect(nameField(page)).toHaveValue("Kept Name");
    await expect(emailField(page)).toHaveValue("kept@example.com");
  });

  /*
   * WDG-04 (D91b): the invalid-submit echo (`values.quantity`) used to shadow
   * the `quantity` prop, so after ONE rejected submit the select stopped
   * following the cells — the D84 symptom, re-armed by any validation error.
   * Real mouse clicks (tests/llm.md "Real input").
   */
  test("after an invalid submit the select still follows the cells (D84, WDG-04)", async ({
    page,
  }) => {
    await openPdp(page, `/products/${SLUG.tire}`);
    await submitAndWait(page);
    await expect(errorSummary(page)).toBeVisible();
    await expect(qtySelect(page)).toHaveValue("4");
    const steps: Array<[string, string]> = [
      ["2", "2"],
      ["Custom", "custom"],
      ["1", "1"],
    ];
    for (const [label, value] of steps) {
      await cell(page, label).click();
      await expect(page).toHaveURL(new RegExp(`[?&]qty=${value}(&|#|$)`));
      await expect(cell(page, label)).toHaveAttribute("aria-current", "true");
      await expect(qtySelect(page), `select after clicking ${label}`).toHaveValue(value);
      if (value === "custom") {
        await expect(customField(page)).toBeVisible();
      } else {
        await expect(customField(page)).toHaveCount(0);
      }
    }
  });

  /*
   * WDG-05 (D91b): a same-route `?qty=` Link without `scroll={false}` is the
   * mechanism D68 measured throwing `/results` to the top. On a phone the
   * cells sit below the fold, so a tap must hold the reader where they are.
   */
  test("a numeric cell tap holds the scroll position on a phone (D68, WDG-05)", async ({
    page,
  }, info) => {
    test.skip(!isPhone(info), "the cells are below the fold only on phones");
    await openPdp(page, `/products/${SLUG.tire}`);
    // Bring the cells near the top of the viewport, so the page's first
    // element is well off-screen whatever the phone's height.
    // `instant`: the root may carry `scroll-behavior: smooth`, and reading
    // scrollY mid-animation would measure the scroll, not the tap.
    await cell(page, "2").evaluate((el) =>
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - 120,
        behavior: "instant",
      }),
    );
    await expect(cell(page, "2")).toBeInViewport();
    const before = await page.evaluate(() => window.scrollY);
    expect(before, "the page should be scrolled to the cells").toBeGreaterThan(200);
    await cell(page, "2").click();
    await expect(page).toHaveURL(/[?&]qty=2(&|$)/);
    await expect(cell(page, "2")).toHaveAttribute("aria-current", "true");
    // Next applies its scroll in a layout effect after the commit; two frames
    // later it has either happened or it will not.
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    const after = await page.evaluate(() => window.scrollY);
    expect(Math.abs(after - before), `scrollY ${before} -> ${after}`).toBeLessThanOrEqual(1);
  });

  for (const pdp of PDPS) {
    test(`${pdp.category}: default quantity is ${pdp.defaultQty} (D65 item 7)`, async ({ page }) => {
      await openPdp(page, `/products/${pdp.slug}`);
      expect(await selectedCells(page)).toEqual([pdp.defaultQty]);
      await expect(qtySelect(page)).toHaveValue(pdp.defaultQty);
    });
  }

  test("an unknown ?qty= falls back to the category default, not a crash", async ({ page }) => {
    for (const [slug, expected] of [
      [SLUG.tire, "4"],
      [SLUG.accessory, "1"],
    ] as const) {
      await openPdp(page, `/products/${slug}?qty=7`);
      expect(await selectedCells(page)).toEqual([expected]);
      await expect(qtySelect(page)).toHaveValue(expected);
    }
  });

  test("cold ?qty=custom pre-selects Another quantity and renders the field", async ({ page }) => {
    await openPdp(page, `/products/${SLUG.wheel}?qty=custom`);
    await expect(qtySelect(page)).toHaveValue("custom");
    await expect(page.getByLabel("How many wheels?")).toBeVisible();
    // Choosing a number in the select hides the field again.
    await qtySelect(page).selectOption("2");
    await expect(customField(page)).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// 5b. Custom quantity bounds (D75: 1–99, blank legal)
// ---------------------------------------------------------------------------

test.describe("custom quantity field (D75)", () => {
  const cases: Array<{ input: string; ok: boolean; how?: "type" }> = [
    { input: "1", ok: true },
    { input: "99", ok: true },
    { input: "", ok: true },
    { input: "0", ok: false },
    { input: "100", ok: false },
    { input: "-3", ok: false },
    { input: "2.5", ok: false },
    // WDG-11 (D91b): `Number()` spellings that are not decimal digits.
    { input: "1e1", ok: false },
    { input: "+5", ok: false },
    { input: "5.0", ok: false },
  ];
  for (const c of cases) {
    test(`custom quantity "${c.input}" → ${c.ok ? "accepted" : "rejected"}`, async ({ page }) => {
      await openPdp(page, `/products/${SLUG.tire}?qty=custom`);
      await fillValid(page);
      await customField(page).fill(c.input);
      await submitAndWait(page);
      if (c.ok) {
        await expect(successPanel(page)).toBeVisible();
      } else {
        await expect(errorSummary(page)).toHaveText("1 field needs a fix before we can send your inquiry.");
        await expect(page.locator("#quote-custom-quantity-error")).toHaveText(
          "Enter a number between 1 and 99.",
        );
        await expect(customField(page)).toHaveAttribute("aria-invalid", "true");
        await expect(customField(page)).toBeFocused();
        await expect(customField(page)).toHaveValue(c.input);
        // Everything else typed survives the round-trip.
        await expect(nameField(page)).toHaveValue("Test Person");
        await expect(qtySelect(page)).toHaveValue("custom");
      }
    });
  }

  test("non-numeric custom quantity is not silently submitted as blank", async ({ page }) => {
    await openPdp(page, `/products/${SLUG.tire}?qty=custom`);
    await fillValid(page);
    await customField(page).click();
    await page.keyboard.type("abc");
    const { value, badInput } = await customField(page).evaluate((el) => ({
      value: (el as HTMLInputElement).value,
      badInput: (el as HTMLInputElement).validity.badInput,
    }));
    await submitAndWait(page);
    if (badInput || value !== "") {
      // The field visibly holds text. Submitting it as "no custom quantity"
      // loses what the user typed without a word — it must be rejected with
      // the D75 message instead. (Since D91b the field is `type="text"
      // inputMode="numeric"`, so every engine keeps `abc` as its value.)
      await expect(
        successPanel(page),
        "the field held 'abc' yet the quote was accepted",
      ).toHaveCount(0);
      await expect(page.locator("#quote-custom-quantity-error")).toHaveText(
        "Enter a number between 1 and 99.",
      );
    } else {
      // The engine refused the keystrokes; the field is honestly blank.
      expect(value).toBe("");
      await expect(successPanel(page)).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Quote form validation, success, consent, radios, beforeunload
// ---------------------------------------------------------------------------

test.describe("quote form (D51, D57, D65)", () => {
  test("empty submit: alert announces the count, focus on first invalid, aria-invalid", async ({
    page,
  }) => {
    await openPdp(page, `/products/${SLUG.tire}`);
    await submitAndWait(page);
    await expect(errorSummary(page)).toHaveText("3 fields need a fix before we can send your inquiry.");
    await expect(nameField(page)).toBeFocused();
    for (const field of [nameField(page), emailField(page), phoneField(page)]) {
      await expect(field).toHaveAttribute("aria-invalid", "true");
    }
    await expect(nameField(page)).toHaveAccessibleDescription("Enter your name.");
    await expect(emailField(page)).toHaveAccessibleDescription("Enter your email address.");
    await expect(phoneField(page)).toHaveAccessibleDescription("Enter your phone number.");
  });

  test("partial submit keeps typed values and focuses the first remaining error", async ({
    page,
  }) => {
    await openPdp(page, `/products/${SLUG.tire}`);
    await nameField(page).fill("Ada Lovelace");
    await emailField(page).fill("ada@");
    await quoteForm(page).getByText("Email", { exact: true }).last().click();
    await page.locator("#quote-message").fill("Please call after 5.");
    await submitAndWait(page);
    await expect(errorSummary(page)).toHaveText("2 fields need a fix before we can send your inquiry.");
    await expect(emailField(page)).toBeFocused();
    await expect(emailField(page)).toHaveAccessibleDescription("Enter an email like name@example.com.");
    await expect(nameField(page)).toHaveValue("Ada Lovelace");
    await expect(nameField(page)).not.toHaveAttribute("aria-invalid", "true");
    await expect(emailField(page)).toHaveValue("ada@");
    await expect(page.locator("#quote-message")).toHaveValue("Please call after 5.");
    await expect(quoteForm(page).getByRole("radio", { name: "Email" })).toBeChecked();
    await expect(qtySelect(page)).toHaveValue("4");
  });

  test("a bad phone number gets its own message", async ({ page }) => {
    await openPdp(page, `/products/${SLUG.tire}`);
    await fillValid(page);
    await phoneField(page).fill("12345");
    await submitAndWait(page);
    await expect(phoneField(page)).toBeFocused();
    await expect(phoneField(page)).toHaveAccessibleDescription(
      "Enter a 10-digit Canadian phone number.",
    );
  });

  test("a 254-character email (the RFC 5321 maximum) is accepted", async ({ page }) => {
    const email = `${"a".repeat(64)}@${"b".repeat(185)}.com`;
    expect(email).toHaveLength(254);
    await openPdp(page, `/products/${SLUG.tire}`);
    await fillValid(page);
    await emailField(page).fill(email);
    await submitAndWait(page);
    await expect(successPanel(page)).toBeVisible();
  });

  test("success replaces the form and takes focus", async ({ page }) => {
    const watch = watchProblems(page);
    await openPdp(page, `/products/${SLUG.wheel}`);
    await fillValid(page);
    await submitAndWait(page);
    await expect(successPanel(page)).toBeVisible();
    await expect(successPanel(page)).toHaveAttribute("role", "status");
    await expect(successPanel(page)).toBeFocused();
    await expect(successPanel(page).getByRole("heading")).toHaveText("Quote request sent.");
    await expect(quoteForm(page)).toHaveCount(0);
    watch.expectClean();
  });

  test("CASL consent renders unticked and is optional", async ({ page }) => {
    await openPdp(page, `/products/${SLUG.tire}`);
    const consent = quoteForm(page).getByRole("checkbox");
    await expect(consent).toHaveCount(1);
    await expect(consent).not.toBeChecked();
    await expect(consent).toHaveAccessibleName(/send me seasonal offers/);
    await fillValid(page);
    await submitAndWait(page);
    await expect(successPanel(page)).toBeVisible();
  });

  test("preferred contact is a keyboard-operable radio group", async ({ page, browserName }) => {
    await openPdp(page, `/products/${SLUG.tire}`);
    const group = quoteForm(page).getByRole("group", { name: "Preferred contact" });
    const phone = group.getByRole("radio", { name: "Phone" });
    const email = group.getByRole("radio", { name: "Email" });
    const whatsapp = group.getByRole("radio", { name: "WhatsApp" });
    await expect(phone).toBeChecked();

    // Start sequential navigation at the Quantity select, then Tab in.
    await qtySelect(page).focus();
    await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
    await expect(phone).toBeFocused();
    // The focus ring is drawn on the segment (label has-focus-visible).
    const ring = await phone.evaluate((el) => getComputedStyle(el.closest("label")!).outlineStyle);
    expect(ring).not.toBe("none");

    await page.keyboard.press("ArrowRight");
    await expect(email).toBeChecked();
    await expect(email).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(whatsapp).toBeChecked();
    await page.keyboard.press("ArrowLeft");
    await expect(email).toBeChecked();
    await expect(phone).not.toBeChecked();
  });

  test.describe("beforeunload guard (D65 item 6)", () => {
    async function closeAndCaptureDialog(page: Page) {
      const dialogs: string[] = [];
      page.on("dialog", async (d) => {
        dialogs.push(d.type());
        await d.accept();
      });
      const closed = page.waitForEvent("close");
      await page.close({ runBeforeUnload: true });
      await closed;
      return dialogs;
    }

    test("fires when the form is dirty", async ({ page }) => {
      await openPdp(page, `/products/${SLUG.tire}`);
      await nameField(page).click();
      await page.keyboard.type("Half typed");
      expect(await closeAndCaptureDialog(page)).toEqual(["beforeunload"]);
    });

    test("does not fire on a clean form", async ({ page }) => {
      await openPdp(page, `/products/${SLUG.tire}`);
      // A user gesture that is not input: toggling a qty cell.
      await cell(page, "2").click();
      await expect(page).toHaveURL(/qty=2/);
      expect(await closeAndCaptureDialog(page)).toEqual([]);
    });

    /*
     * A `tel:` tap is the page's other way to ask for a quote. It unloads
     * nothing (the page stays, the dialler opens), so the guard must not ask
     * "Leave site?" — measured: Chromium (desktop + Android) and Gecko raise
     * the prompt, WebKit does not.
     */
    test("tapping a tel: link with a dirty form raises no leave-page prompt", async ({ page }) => {
      await openPdp(page, `/products/${SLUG.tire}`);
      await nameField(page).click();
      await page.keyboard.type("Half typed");
      const dialog = page.waitForEvent("dialog", { timeout: 3_000 }).catch(() => null);
      await page.getByRole("main").locator('a[href^="tel:"]').first().click();
      const d = await dialog;
      const type = d?.type() ?? null;
      await d?.dismiss();
      expect(type, "a leave-page prompt fired on a tel: tap").toBeNull();
      await expect(nameField(page)).toHaveValue("Half typed");
    });

    test("does not fire after a successful submit", async ({ page }) => {
      await openPdp(page, `/products/${SLUG.tire}`);
      await nameField(page).click();
      await page.keyboard.type("Test Person");
      await emailField(page).fill("test.person@example.com");
      await phoneField(page).fill("416-555-0123");
      await submitAndWait(page);
      await expect(successPanel(page)).toBeVisible();
      expect(await closeAndCaptureDialog(page)).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// 7. Unavailable PDP
// ---------------------------------------------------------------------------

test.describe("unavailable SKU", () => {
  for (const slug of [SLUG.tireUnavailable, SLUG.wheelUnavailable, SLUG.accessoryUnavailable]) {
    test(`${slug} returns 200 and renders`, async ({ page }) => {
      const watch = watchProblems(page);
      await openPdp(page, `/products/${slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(quoteForm(page)).toBeVisible();
      watch.expectClean();
    });
  }

  // PARKED (D54, root llm.md §7.16): no artboard draws an unavailable PDP, so
  // none is authored. Recorded, not a defect.
  test.fixme("unavailable PDP shows the Currently unavailable state (PARKED, D54 §7.16)", async ({
    page,
  }) => {
    await openPdp(page, `/products/${SLUG.tireUnavailable}`);
    await expect(page.getByRole("main").getByText("Currently unavailable")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 8. Breadcrumb + similar products
// ---------------------------------------------------------------------------

/** Multiset of params, order-insensitive, decoded. */
const paramBag = (search: string) =>
  [...new URLSearchParams(search).entries()].map(([k, v]) => `${k}=${v}`).sort();

test.describe("breadcrumb back-link (D53(6))", () => {
  test("carries every inbound param except qty, before and after a qty click", async ({
    page,
  }) => {
    const inbound =
      "year=2021&make=Jeep&model=Grand+Cherokee&brand=Zeta&brand=ZMAX&season=winter&sort=price-asc&min=100&max=200&qty=2";
    await openPdp(page, `/products/${SLUG.tire}?${inbound}`);
    const crumbNav = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbNav).toHaveCount(1);
    const back = crumbNav.getByRole("link", { name: "Results", exact: true });

    const expected = paramBag(inbound).filter((p) => !p.startsWith("qty="));
    const check = async () => {
      const href = (await back.getAttribute("href")) ?? "";
      const url = new URL(href, "http://x");
      expect(url.pathname).toBe("/results");
      expect(paramBag(url.search)).toEqual(expected);
    };
    await check();
    await cell(page, "1").click();
    await expect(page).toHaveURL(/qty=1/);
    await check();

    await back.click();
    await expect(page).toHaveURL(/\/results\?/);
    expect(paramBag(new URL(page.url()).search)).toEqual(expected);
  });

  for (const pdp of PDPS) {
    test(`${pdp.category}: crumb reads ${pdp.crumb} and points at ${pdp.route}`, async ({ page }) => {
      await openPdp(page, `/products/${pdp.slug}?qty=4`);
      const crumbNav = page.getByRole("navigation", { name: "Breadcrumb" });
      const back = crumbNav.getByRole("link", { name: pdp.crumb, exact: true });
      await expect(back).toHaveAttribute("href", pdp.route);
      await expect(crumbNav.getByRole("link", { name: "Home", exact: true })).toHaveAttribute(
        "href",
        "/",
      );
    });
  }
});

test.describe("similar products (D52, D59(6))", () => {
  const all = [
    ...PDPS.map((p) => ({ category: p.category, slug: p.slug })),
    { category: "tires" as Category, slug: SLUG.tireUnavailable },
    { category: "wheels" as Category, slug: SLUG.wheelUnavailable },
    { category: "accessories" as Category, slug: SLUG.accessoryUnavailable },
  ];
  for (const { category, slug } of all) {
    test(`${slug}: ≤4, never itself, never another category`, async ({ page }) => {
      await openPdp(page, `/products/${slug}`);
      const trackEl = page.getByRole("group", { name: "Similar products" });
      // evaluateAll does not wait; wait for the streamed cards first.
      await expect(trackEl.locator("article").first()).toBeAttached();
      const slugs = await trackEl
        .locator("article")
        .evaluateAll((arts) =>
          arts.map(
            (a) =>
              a
                .querySelector<HTMLAnchorElement>("a.display")
                ?.getAttribute("href")
                ?.replace("/products/", "") ?? "",
          ),
        );
      expect(slugs.length).toBeGreaterThan(0);
      expect(slugs.length).toBeLessThanOrEqual(4);
      expect(slugs).not.toContain(slug);
      expect(new Set(slugs).size).toBe(slugs.length);
      expect(slugs.map((s) => categoryOf(s))).toEqual(slugs.map(() => category));
    });
  }

  test("a similar card's Request a quote lands on that product's #quote band", async ({
    page,
  }) => {
    await openPdp(page, `/products/${SLUG.wheel}`);
    const cta = page
      .getByRole("group", { name: "Similar products" })
      .getByRole("link", { name: /^Request a quote/ })
      .first();
    const href = (await cta.getAttribute("href")) ?? "";
    expect(href).toMatch(/^\/products\/[a-z0-9-]+#quote$/);
    await cta.click();
    await expect(page).toHaveURL(new RegExp(`${href.replace(/[#/]/g, "\\$&")}$`));
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const el = document.getElementById("quote");
            if (!el || window.scrollY <= 0) return "not scrolled";
            const top = el.getBoundingClientRect().top;
            return top >= -2 && top < window.innerHeight / 2 ? "ok" : `top ${Math.round(top)}`;
          }),
        { timeout: 6_000 },
      )
      .toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// 9. tel: links on the PDP
// ---------------------------------------------------------------------------

test("PDP tel: links are E.164 and the buy panel calls the primary contact (D76)", async ({
  page,
}) => {
  for (const pdp of PDPS) {
    await openPdp(page, `/products/${pdp.slug}`);
    const tels = await page
      .locator('a[href^="tel:"]')
      .evaluateAll((els) =>
        els
          .filter((e) => (e as HTMLElement).offsetParent !== null || e.closest("dialog") !== null)
          .map((e) => e.getAttribute("href") ?? ""),
      );
    expect(tels.length).toBeGreaterThan(0);
    for (const t of tels) expect(ALLOWED_TEL).toContain(t);
    const call = page.getByRole("main").getByRole("link", { name: /call/i }).first();
    await expect(call).toHaveAttribute("href", "tel:+14378825000");
    // The buy panel's primary CTA jumps to the quote band.
    await expect(
      page.getByRole("main").getByRole("link", { name: /request a quote/i }).first(),
    ).toHaveAttribute("href", "#quote");
  }
});

// ---------------------------------------------------------------------------
// 7. Owner rulings 2026-09-30 (WDG-10, WDG-12, WDG-13 quantity half)
// ---------------------------------------------------------------------------

test.describe("consent tick survives a failed submit (WDG-10)", () => {
  test("ticked + invalid email: the box is still ticked; a fresh load is unticked", async ({
    page,
  }) => {
    await openPdp(page, `/products/${SLUG.tire}`);
    const consent = quoteForm(page).getByRole("checkbox");
    await nameField(page).fill("Ada Lovelace");
    await emailField(page).fill("ada@");
    await phoneField(page).fill("416-555-0123");
    await consent.scrollIntoViewIfNeeded();
    await scrollSettled(page);
    await consent.check();
    await expect(consent).toBeChecked();
    await submitAndWait(page);
    await expect(errorSummary(page)).toHaveText("1 field needs a fix before we can send your inquiry.");
    // The visitor's own tick comes back with the rest of their input.
    await expect(nameField(page)).toHaveValue("Ada Lovelace");
    await expect(consent, "consent tick dropped by the failed submit").toBeChecked();

    // A fresh render never pre-ticks (docs/decisions.md §7).
    await openPdp(page, `/products/${SLUG.tire}`);
    await expect(quoteForm(page).getByRole("checkbox")).not.toBeChecked();
  });

  test("unticked + invalid email stays unticked", async ({ page }) => {
    await openPdp(page, `/products/${SLUG.tire}`);
    await emailField(page).fill("ada@");
    await submitAndWait(page);
    await expect(errorSummary(page)).toBeVisible();
    await expect(quoteForm(page).getByRole("checkbox")).not.toBeChecked();
  });
});

test.describe("field length caps (WDG-12)", () => {
  test("browser maxlength: name 100, email 254, phone 32, message 1000", async ({ page }) => {
    await openPdp(page, `/products/${SLUG.tire}`);
    await expect(nameField(page)).toHaveAttribute("maxlength", "100");
    await expect(emailField(page)).toHaveAttribute("maxlength", "254");
    await expect(phoneField(page)).toHaveAttribute("maxlength", "32");
    await expect(page.locator("#quote-message")).toHaveAttribute("maxlength", "1000");
  });

  test("typing 150 characters into name keeps 100", async ({ page }) => {
    await openPdp(page, `/products/${SLUG.tire}`);
    await nameField(page).click();
    await page.keyboard.type("n".repeat(150));
    const len = await nameField(page).evaluate((el) => (el as HTMLInputElement).value.length);
    expect(len).toBe(100);
  });

  /* The server is the validator (`noValidate`, D65), so each cap is proved by
     stripping the browser's own `maxlength` and submitting past it. */
  const overCap: Array<{
    label: string;
    field: string;
    value: string;
    length: number;
    error: string;
    errorId: string;
  }> = [
    {
      label: "5000-character name",
      length: 5000,
      field: "#quote-name",
      value: "n".repeat(5000),
      error: "Enter your name.",
      errorId: "quote-name-error",
    },
    {
      label: "255-character email",
      length: 255,
      field: "#quote-email",
      value: `${"a".repeat(64)}@${"b".repeat(186)}.com`,
      error: "Enter an email like name@example.com.",
      errorId: "quote-email-error",
    },
    {
      label: "33-character phone",
      length: 33,
      field: "#quote-phone",
      value: `416${" ".repeat(22)}555-0123`, // 10 digits: passes the digit check, fails the cap
      error: "Enter a 10-digit Canadian phone number.",
      errorId: "quote-phone-error",
    },
    {
      label: "1001-character message",
      length: 1001,
      field: "#quote-message",
      value: "m".repeat(1001),
      error: "Keep your message to 1,000 characters or fewer.",
      errorId: "quote-message-error",
    },
    {
      label: "zero-width-only name",
      length: 3,
      field: "#quote-name",
      value: "\u200b\u200b\u200b",
      error: "Enter your name.",
      errorId: "quote-name-error",
    },
  ];
  for (const c of overCap) {
    test(`${c.label} is rejected by the server`, async ({ page }) => {
      expect(c.value.length).toBe(c.length);
      await openPdp(page, `/products/${SLUG.tire}`);
      await fillValid(page);
      await page.locator(c.field).evaluate((el) => el.removeAttribute("maxlength"));
      await page.locator(c.field).fill(c.value);
      await submitAndWait(page);
      await expect(successPanel(page)).toHaveCount(0);
      await expect(page.locator(`#${c.errorId}`)).toHaveText(c.error);
      await expect(errorSummary(page)).toHaveText("1 field needs a fix before we can send your inquiry.");
    });
  }

  /* Guard, not a red test: a message whose newlines would count twice as CRLF
     but sits under the cap as typed must not be rejected. */
  test("a 1000-code-unit message with many newlines is accepted", async ({ page }) => {
    await openPdp(page, `/products/${SLUG.tire}`);
    await fillValid(page);
    const message = `${"a\n".repeat(400)}${"b".repeat(200)}`;
    expect(message.length).toBe(1000);
    await page.locator("#quote-message").fill(message);
    await submitAndWait(page);
    await expect(successPanel(page)).toBeVisible();
  });
});

test.describe("quantity cell hover (WDG-13)", () => {
  const borderOf = (loc: ReturnType<typeof cell>) =>
    loc.evaluate((el) => getComputedStyle(el).borderTopColor);

  test("an unselected cell's border goes to ink on hover; the selected cell does not change", async ({
    page,
  }, info) => {
    test.skip(isTouch(info), "hover: hover is a desktop-pointer media query (D17)");
    await openPdp(page, `/products/${SLUG.tire}`);
    const selected = cell(page, "4");
    const other = cell(page, "2");
    await other.scrollIntoViewIfNeeded();
    await scrollSettled(page);
    await expect(selected).toHaveAttribute("aria-current", "true");

    const ink = await borderOf(selected); // `border-ink`, the selected cell's own border
    const restOther = await borderOf(other);
    expect(restOther).not.toBe(ink);

    await other.hover();
    await expect
      .poll(() => borderOf(other), { message: "unselected cell border on hover" })
      .toBe(ink);

    // Selected cell: nothing moves under the pointer.
    const restSelectedBg = await selected.evaluate((el) => getComputedStyle(el).backgroundColor);
    await selected.hover();
    await expect.poll(() => borderOf(other), { message: "left the other cell" }).toBe(restOther);
    await expect.poll(() => borderOf(selected)).toBe(ink);
    expect(await selected.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      restSelectedBg,
    );
  });
});
