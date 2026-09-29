/**
 * Responsive + edge-content matrix (D91b, agent NJR).
 *
 *  3. Width sweep: every ROUTES entry x 17 widths, one Chromium project, plus
 *     spot widths on Firefox and WebKit.
 *  4. Landscape phones: header, sticky bar, sheet, drawer.
 *  5. dvh tracking and safe-area insets.
 *  6. Long content injected into the real DOM (cards, PDP title, vehicle chip,
 *     quote fields).
 *  7. Empty / one / many results, and a missing product image.
 *
 * The 400% zoom proxy belongs to the a11y spec, not here.
 */
import {
  test,
  expect,
  devices,
  type Browser,
  type BrowserContextOptions,
  type Page,
} from "@playwright/test";
import {
  ROUTES,
  SLUG,
  VEHICLE,
  settle,
  expectNoHorizontalOverflow,
} from "../helpers";

const WIDTHS = [
  320, 360, 375, 390, 412, 600, 720, 768, 900, 1024, 1099, 1100, 1280, 1366,
  1440, 1920, 2560,
] as const;
const SPOT_WIDTHS = [320, 375, 768, 1099, 1100, 1920] as const;

type DesktopProject = "chromium-1440" | "firefox-1440" | "webkit-1440";

/** Call at the top of a `describe`: every test in it runs only in these
 *  desktop projects. Decided from option fixtures (engine, viewport, isMobile),
 *  so a skipped project never launches a page — `test.info().project.name` is
 *  not available at declaration time, and skipping inside the body would. */
function inProjects(...projects: DesktopProject[]) {
  test.skip(
    ({ browserName, viewport, isMobile }) =>
      !!isMobile ||
      !projects.some((p) => p === `${browserName}-${viewport?.width ?? 0}`),
    `runs in ${projects.join(", ")} only`,
  );
}

interface Rect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

/** Same rule as `expectNoHorizontalOverflow`, but it reports every offender with
 *  its measured overhang instead of stopping at the first, so one sweep records
 *  a whole width's worth of evidence. */
async function measureOverflow(page: Page) {
  return page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    const vw = root.clientWidth;
    const offenders: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      let scrolled = false;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (
          ox === "auto" ||
          ox === "scroll" ||
          ox === "hidden" ||
          ox === "clip"
        ) {
          scrolled = true;
          break;
        }
      }
      if (scrolled) continue;
      if (r.right > vw + 1 || r.left < -1) {
        const over = r.right > vw + 1 ? r.right - vw : -r.left;
        const probe = el.getAttribute("data-probe");
        offenders.push(
          `${el.tagName.toLowerCase()}${probe ? `[data-probe=${probe}]` : ""}.${el.className
            .toString()
            .slice(0, 50)} +${over.toFixed(1)}px`,
        );
      }
    }
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: vw,
      offenders: offenders.slice(0, 6),
    };
  });
}

async function waitForLayout(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        void document.fonts.ready.then(() =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      }),
  );
}

/** The sheet slides and the drawer fades (D67, 150ms). Measure at rest, not
 *  mid-transition: WebKit reports the panel 300px off its final box while
 *  its `translate` is still running. */
async function transitionsDone(page: Page, selector: string) {
  await expect
    .poll(() =>
      page
        .locator(selector)
        .first()
        .evaluate((el) => el.getAnimations({ subtree: true }).length),
    )
    .toBe(0);
}

// --- 3. Width sweep -----------------------------------------------------------

test.describe("width sweep: no horizontal overflow", () => {
  inProjects("chromium-1440");
  for (const route of ROUTES) {
    test(`${route.name}: 17 widths, 320-2560`, async ({ page }) => {
      await page.setViewportSize({ width: WIDTHS[0], height: 900 });
      await page.goto(route.path);
      await settle(page);
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await waitForLayout(page);
        const m = await measureOverflow(page);
        expect
          .soft(
            m.offenders,
            `${route.name} @${width}: elements escaping the viewport`,
          )
          .toEqual([]);
        expect
          .soft(m.scrollWidth, `${route.name} @${width}: document scrollWidth`)
          .toBeLessThanOrEqual(m.clientWidth);
      }
    });
  }
});

test.describe("spot widths on Firefox and WebKit: no horizontal overflow", () => {
  inProjects("firefox-1440", "webkit-1440");
  for (const route of ROUTES) {
    test(`${route.name}: spot widths, cold load at each`, async ({ page }) => {
      for (const width of SPOT_WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route.path);
        await settle(page);
        const m = await measureOverflow(page);
        expect
          .soft(
            m.offenders,
            `${route.name} @${width}: elements escaping the viewport`,
          )
          .toEqual([]);
        expect
          .soft(m.scrollWidth, `${route.name} @${width}: document scrollWidth`)
          .toBeLessThanOrEqual(m.clientWidth);
      }
    });
  }
});

test.describe("home contact", () => {
  inProjects("chromium-1440", "firefox-1440", "webkit-1440");
  test("phone numbers stay on one line in the tablet band", async ({
    page,
  }) => {
    // 720-1099 is undrawn (D41). A phone number broken across two lines inside
    // a 56px pill (Chromium/WebKit break after "(437)" or after a hyphen) is
    // not a number anyone can read at a glance; Firefox refuses the hyphen
    // break and the pill overflows its card and the page instead.
    const broken: string[] = [];
    for (const width of [720, 768, 800, 900, 1000, 1099, 1100, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await settle(page);
      const found = await page
        .locator('#contact a[href^="tel:"]')
        .evaluateAll((links) =>
          links.flatMap((a) => {
            const card = a.parentElement!.getBoundingClientRect();
            const r = a.getBoundingClientRect();
            const text = [...a.childNodes].find(
              (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
            );
            const range = document.createRange();
            if (text) range.selectNodeContents(text);
            const lines = new Set(
              [...range.getClientRects()].map((q) => Math.round(q.top)),
            ).size;
            const out: string[] = [];
            if (lines > 1)
              out.push(`"${a.textContent?.trim()}" wraps to ${lines} lines`);
            if (r.right > card.right + 0.5)
              out.push(
                `"${a.textContent?.trim()}" overhangs its card by ${(r.right - card.right).toFixed(1)}px`,
              );
            return out;
          }),
        );
      broken.push(...found.map((f) => `@${width}: ${f}`));
    }
    expect(broken).toEqual([]);
  });
});

// --- 4/5. Landscape phones, dvh, safe area ------------------------------------

const LANDSCAPE = [
  { name: "iphone-se-landscape", width: 667, height: 375 },
  { name: "iphone-15-pro-landscape", width: 852, height: 393 },
  { name: "pixel-7-landscape", width: 915, height: 412 },
] as const;

async function phoneContext(
  browser: Browser,
  viewport: { width: number; height: number },
) {
  const opts: BrowserContextOptions = {
    ...devices["iPhone 15 Pro"],
    viewport,
    screen: viewport,
  };
  // WebKit and Chromium both take isMobile/hasTouch; Firefox takes neither.
  const context = await browser.newContext(opts);
  const page = await context.newPage();
  return { context, page };
}

async function rectOf(page: Page, selector: string): Promise<Rect> {
  return page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        left: r.left,
        width: r.width,
        height: r.height,
      };
    });
}

/** The sheet's scroll region: the child of the panel that scrolls. */
const SHEET_BODY = '[data-probe="sheet"] .sheet-panel > div.overflow-y-auto';

test.describe("landscape phones", () => {
  inProjects("chromium-1440", "webkit-1440");
  for (const vp of LANDSCAPE) {
    test(`${vp.name} ${vp.width}x${vp.height}: header, sticky bar, sheet usable`, async ({
      browser,
      browserName,
    }, info) => {
      test.skip(browserName === "firefox", "no isMobile in Firefox");
      const { context, page } = await phoneContext(browser, vp);
      try {
        await page.goto(`/results?${VEHICLE}`);
        await settle(page);
        await expectNoHorizontalOverflow(page);
        const header = await rectOf(page, "header");
        expect(header.top).toBe(0);
        expect(header.height).toBeGreaterThan(0);

        // Sticky bar pins below where the header was, and the page keeps scrolling.
        const bar = page.locator('[data-probe="sticky-bar"]');
        await expect(bar).toBeVisible();
        // Scripted scroll: mobile WebKit has no mouse wheel, and this measures
        // where the bar pins, not how the scroll was produced.
        await page.evaluate(() => window.scrollBy(0, 1200));
        await expect
          .poll(() => page.evaluate(() => window.scrollY))
          .toBeGreaterThan(200);
        const pinned = await rectOf(page, '[data-probe="sticky-bar"]');
        info.annotations.push({
          type: "measure",
          description: `${vp.name}: sticky bar pinned at y=${pinned.top.toFixed(0)}, h=${pinned.height.toFixed(0)} of ${vp.height}px viewport (${((pinned.bottom / vp.height) * 100).toFixed(0)}% consumed from top)`,
        });
        expect(
          pinned.bottom,
          "sticky bar leaves most of the viewport for content",
        ).toBeLessThan(vp.height / 2);

        // Sheet: opens, footer button fully on screen, body scrolls to its last control.
        await page.locator('[data-probe="filters-trigger"]').click();
        const sheet = page.getByRole("dialog", { name: "Filters" });
        await expect(sheet).toBeVisible();
        await transitionsDone(page, '[data-probe="sheet"]');
        const apply = sheet.getByRole("button", { name: "Apply", exact: true });
        await expect(apply).toBeInViewport({ ratio: 1 });
        const body = await page.locator(SHEET_BODY).evaluate((el) => ({
          clientHeight: el.clientHeight,
          scrollHeight: el.scrollHeight,
          overflowY: getComputedStyle(el).overflowY,
        }));
        info.annotations.push({
          type: "measure",
          description: `${vp.name}: sheet body viewport ${body.clientHeight}px of ${body.scrollHeight}px content`,
        });
        expect(body.overflowY).toBe("auto");
        const lastControl = sheet.getByRole("slider", {
          name: "Maximum price",
        });
        await lastControl.scrollIntoViewIfNeeded();
        await expect(lastControl).toBeInViewport();
        // Two 44px touch rows plus the body's 16px padding: the least a scroll
        // window must show to operate a control and see its neighbour.
        expect(
          body.clientHeight,
          "sheet scroll window shows at least two 44px rows",
        ).toBeGreaterThanOrEqual(2 * 44 + 16);
      } finally {
        await context.close();
      }
    });

    test(`${vp.name} ${vp.width}x${vp.height}: nav drawer usable`, async ({
      browser,
      browserName,
    }) => {
      test.skip(browserName === "firefox", "no isMobile in Firefox");
      const { context, page } = await phoneContext(browser, vp);
      try {
        await page.goto("/about");
        await settle(page);
        await page.getByRole("button", { name: "Menu" }).click();
        const drawer = page.getByRole("dialog", { name: "Menu" });
        await expect(drawer).toBeVisible();
        await transitionsDone(page, "#site-nav-drawer");
        const box = await drawer.boundingBox();
        expect(box?.height).toBe(vp.height);
        for (const name of ["Tires", "Wheels", "Accessories", "Contact"]) {
          const link = drawer.getByRole("link", { name, exact: true });
          await link.scrollIntoViewIfNeeded();
          await expect(link).toBeInViewport({ ratio: 1 });
        }
        const call = drawer.getByRole("link", { name: /^Call / });
        await call.scrollIntoViewIfNeeded();
        await expect(call).toBeInViewport({ ratio: 1 });
        await expect(
          drawer.getByRole("button", { name: "Close menu" }),
        ).toBeInViewport({ ratio: 1 });
      } finally {
        await context.close();
      }
    });
  }

  test("landscape: Shift+Tab never parks focus behind the pinned sticky bar", async ({
    browser,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "WebKit does not Tab to links by default (macOS pref)",
    );
    const vp = LANDSCAPE[0];
    const { context, page } = await phoneContext(browser, vp);
    try {
      await page.goto("/results");
      await settle(page);
      // Walk forward into the grid with the real keyboard, then back out.
      await page.locator("body").press("Tab");
      for (let i = 0; i < 60; i++) {
        const inSimilar = await page.evaluate(
          () =>
            !!document.activeElement?.closest('[data-probe="best-grid"]') &&
            (document.activeElement?.closest("article")?.parentElement?.children
              .length ?? 0) > 0 &&
            window.scrollY > 800,
        );
        if (inSimilar) break;
        await page.keyboard.press("Tab");
      }
      const obscured: string[] = [];
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press("Shift+Tab");
        const r = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          const bar = document.querySelector('[data-probe="sticky-bar"]');
          if (!el || !bar || bar.contains(el)) return null;
          const a = el.getBoundingClientRect();
          const b = bar.getBoundingClientRect();
          const hidden = a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5;
          return hidden
            ? `${el.tagName} "${el.textContent?.trim().slice(0, 30)}" y=${a.top.toFixed(0)}-${a.bottom.toFixed(0)} under bar ${b.top.toFixed(0)}-${b.bottom.toFixed(0)}`
            : null;
        });
        if (r) obscured.push(r);
      }
      expect(
        obscured,
        "focused elements entirely behind the sticky bar (WCAG 2.4.11)",
      ).toEqual([]);
    } finally {
      await context.close();
    }
  });
});

test.describe("dvh: overlays track the viewport height", () => {
  inProjects("chromium-1440", "webkit-1440");
  test("sheet and drawer resize with a URL-bar collapse/expand", async ({
    browser,
    browserName,
  }) => {
    test.skip(browserName === "firefox", "no isMobile in Firefox");
    const tall = { width: 390, height: 844 };
    const short = { width: 390, height: 750 };
    const { context, page } = await phoneContext(browser, tall);
    try {
      await page.goto("/results");
      await settle(page);
      await page.locator('[data-probe="filters-trigger"]').click();
      const sheet = page.getByRole("dialog", { name: "Filters" });
      await expect(sheet).toBeVisible();
      await transitionsDone(page, '[data-probe="sheet"]');
      for (const vp of [tall, short, tall]) {
        await page.setViewportSize(vp);
        await waitForLayout(page);
        await transitionsDone(page, '[data-probe="sheet"]');
        const d = await rectOf(page, '[data-probe="sheet"]');
        const p = await rectOf(page, '[data-probe="sheet"] .sheet-panel');
        expect(d.height, `sheet dialog = 100dvh at ${vp.height}`).toBeCloseTo(
          vp.height,
          0,
        );
        expect(
          p.height,
          `sheet panel = 100dvh - 144 at ${vp.height}`,
        ).toBeCloseTo(vp.height - 144, 0);
        expect(p.bottom).toBeCloseTo(vp.height, 0);
        await expect(
          sheet.getByRole("button", { name: "Apply", exact: true }),
        ).toBeInViewport({ ratio: 1 });
      }
      await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden();

      await page.getByRole("button", { name: "Menu" }).click();
      const drawer = page.getByRole("dialog", { name: "Menu" });
      await expect(drawer).toBeVisible();
      await transitionsDone(page, "#site-nav-drawer");
      for (const vp of [tall, short]) {
        await page.setViewportSize(vp);
        await waitForLayout(page);
        await transitionsDone(page, "#site-nav-drawer");
        const d = await drawer.boundingBox();
        expect(d?.height, `drawer = 100dvh at ${vp.height}`).toBeCloseTo(
          vp.height,
          0,
        );
        await expect(
          drawer.getByRole("link", { name: /^Call / }),
        ).toBeInViewport({ ratio: 1 });
      }
    } finally {
      await context.close();
    }
  });

  test("env(safe-area-inset-*) is live: the viewport meta opts into viewport-fit=cover", async ({
    page,
  }) => {
    // `pb-safe` (globals.css) pads the sheet footer and the drawer's `tel:` CTA
    // with `env(safe-area-inset-bottom)` (docs/decisions.md §5, D66). WebKit
    // reports every safe-area inset as 0 unless the page declares
    // `viewport-fit=cover`, so without it that term is inert on every iPhone.
    await page.goto("/results");
    const meta = await page
      .locator('meta[name="viewport"]')
      .getAttribute("content");
    const usesInset = await page.evaluate(() =>
      [...document.styleSheets].some((s) => {
        try {
          return [...s.cssRules].some((r) =>
            r.cssText.includes("safe-area-inset"),
          );
        } catch {
          return false;
        }
      }),
    );
    expect(usesInset, "the stylesheet uses env(safe-area-inset-*)").toBe(true);
    expect(meta, "viewport meta").toContain("viewport-fit=cover");
  });
});

// --- 6. Long content -----------------------------------------------------------

const LONG_BRAND =
  "Continental Hakkapeliitta Performance Rubber Works of Ontario"; // 61
const LONG_MODEL =
  "Ganzjahresreifen WinterContact Hakkapeliitta Extreme Performance All-Terrain Studdable Touring SUV Light Truck Edition X"; // 120

interface CardGeometry {
  card: Rect;
  photo: Rect;
  stamp: Rect;
  badges: Rect[];
  brand: Rect;
  model: Rect;
  price: Rect;
  cta: Rect;
  textEscapes: string[];
}

/** Replace brand + model text in the first card of `grid`, then measure it. */
async function injectIntoCard(
  page: Page,
  gridProbe: string,
  brand: string,
  model: string,
) {
  return page.evaluate(
    ({ gridProbe, brand, model }) => {
      const card = document.querySelector(
        `[data-probe="${gridProbe}"] article`,
      ) as HTMLElement;
      const modelLink = card.querySelector(
        'a[href^="/products/"]:not([tabindex])',
      ) as HTMLElement;
      const oldBrand =
        (modelLink.previousElementSibling as HTMLElement).textContent ?? "";
      for (const el of card.querySelectorAll<HTMLElement>("span")) {
        if (el.children.length === 0 && el.textContent === oldBrand)
          el.textContent = brand;
      }
      modelLink.textContent = model;
      const box = (
        el: Element,
      ): {
        top: number;
        right: number;
        bottom: number;
        left: number;
        width: number;
        height: number;
      } => {
        const r = el.getBoundingClientRect();
        return {
          top: r.top,
          right: r.right,
          bottom: r.bottom,
          left: r.left,
          width: r.width,
          height: r.height,
        };
      };
      const photo = card.firstElementChild as HTMLElement;
      const stamp = [...photo.querySelectorAll<HTMLElement>("span")].find(
        (s) => s.textContent === brand,
      )!;
      const badgeRow = photo.querySelector(".flex-wrap");
      const price = [...card.querySelectorAll<HTMLElement>("*")].find(
        (e) =>
          e.children.length > 0 &&
          /\$\d/.test(e.textContent ?? "") &&
          !e.querySelector("a"),
      )!;
      const cta =
        card.querySelector('a[href*="quote"], a[href*="#quote"]') ??
        card.querySelector("a:last-of-type")!;
      const cardBox = box(card);
      const textEscapes: string[] = [];
      for (const el of card.querySelectorAll<HTMLElement>("span, a, p")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        if (photo.contains(el)) continue; // the photo box clips by design; measured separately
        if (r.left < cardBox.left - 1 || r.right > cardBox.right + 1) {
          textEscapes.push(
            `${el.tagName} "${el.textContent?.slice(0, 20)}" ${r.left.toFixed(0)}-${r.right.toFixed(0)} vs card ${cardBox.left.toFixed(0)}-${cardBox.right.toFixed(0)}`,
          );
        }
        // `sr-only` spans are 1px clip boxes by design; they are not visible text.
        if (el.clientWidth <= 1) continue;
        if (
          el.scrollWidth > el.clientWidth + 1 &&
          getComputedStyle(el).display !== "inline"
        ) {
          textEscapes.push(
            `${el.tagName} "${el.textContent?.slice(0, 20)}" scrollWidth ${el.scrollWidth} > ${el.clientWidth}`,
          );
        }
      }
      return {
        card: cardBox,
        photo: box(photo),
        stamp: box(stamp),
        badges: badgeRow ? [...badgeRow.children].map(box) : [],
        brand: box(modelLink.previousElementSibling!),
        model: box(modelLink),
        price: box(price),
        cta: box(cta),
        textEscapes,
      };
    },
    { gridProbe, brand, model },
  ) as Promise<CardGeometry>;
}

const overlaps = (a: Rect, b: Rect) =>
  a.left < b.right - 0.5 &&
  a.right > b.left + 0.5 &&
  a.top < b.bottom - 0.5 &&
  a.bottom > b.top + 0.5;

test.describe("long content", () => {
  test("product card: 60-char brand, 120-char model", async ({ page }) => {
    await page.goto("/results");
    await settle(page);
    const g = await injectIntoCard(page, "best-grid", LONG_BRAND, LONG_MODEL);
    await expectNoHorizontalOverflow(page);
    expect(g.textEscapes, "card text escaping the card box").toEqual([]);
    expect(overlaps(g.model, g.price), "model overlaps price").toBe(false);
    expect(overlaps(g.model, g.cta), "model overlaps CTA").toBe(false);
    expect(overlaps(g.brand, g.model), "brand overlaps model").toBe(false);
    expect(g.cta.bottom).toBeLessThanOrEqual(g.card.bottom + 0.5);
  });

  test("product card photo: a 60-char brand stamp stays inside the photo and off the badges", async ({
    page,
  }) => {
    await page.goto("/results");
    await settle(page);
    const g = await injectIntoCard(page, "best-grid", LONG_BRAND, LONG_MODEL);
    expect(
      g.stamp.left,
      "stamp left edge vs photo box (clipped if less)",
    ).toBeGreaterThanOrEqual(g.photo.left - 0.5);
    expect(
      g.badges.filter((b) => overlaps(b, g.stamp)).length,
      "badges under the brand stamp",
    ).toBe(0);
  });
});

test.describe("real seed card geometry", () => {
  inProjects("chromium-1440");
  test("the unavailable badge never collides with the brand stamp", async ({
    page,
  }) => {
    // No injection: the seed's own `Currently unavailable` SKU in each category.
    // 1100-1180 is the narrowest card (3-up beside the rail, D46), an undrawn band.
    const hits: string[] = [];
    for (const route of [
      "/results?show=all",
      "/wheels?show=all",
      "/accessories?show=all",
    ]) {
      for (const width of [1100, 1140, 1180, 1220, 1280, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route);
        await settle(page);
        const found = await page.locator("main article").evaluateAll((cards) =>
          cards.flatMap((card) => {
            const photo = card.firstElementChild!;
            const stamp = photo.querySelector(":scope > span");
            const row = photo.querySelector(".flex-wrap");
            if (!stamp || !row) return [];
            const s = stamp.getBoundingClientRect();
            return [...row.children].flatMap((badge) => {
              const b = badge.getBoundingClientRect();
              const x = Math.min(b.right, s.right) - Math.max(b.left, s.left);
              const y = Math.min(b.bottom, s.bottom) - Math.max(b.top, s.top);
              return x > 0.5 && y > 0.5
                ? [
                    `"${badge.textContent}" x "${stamp.textContent}" ${x.toFixed(1)}px`,
                  ]
                : [];
            });
          }),
        );
        hits.push(...found.map((f) => `${route} @${width}: ${f}`));
      }
    }
    expect(hits, "badge text overlapping the brand stamp").toEqual([]);
  });
});

test.describe("long content, continued", () => {
  test("PDP title: 120-char model with long real-world words", async ({
    page,
  }) => {
    // `LONG_MODEL` carries real product-line words (Nokian "Hakkapeliitta",
    // Continental "WinterContact", German "Ganzjahresreifen") — the kind of
    // unbroken token the vendor catalogue (D89b) will bring.
    await page.goto(`/products/${SLUG.tire}?${VEHICLE}&qty=4`);
    await settle(page);
    const r = await page.evaluate((model) => {
      const h1 = document.querySelector("main h1") as HTMLElement;
      // The h1's grid track: the ancestor whose parent lays out in a grid.
      let track: HTMLElement = h1;
      while (
        track.parentElement &&
        getComputedStyle(track.parentElement).display !== "grid"
      ) {
        track = track.parentElement;
      }
      const hasGrid =
        !!track.parentElement && track.parentElement !== document.body;
      const before = track.getBoundingClientRect().width;
      h1.textContent = model;
      const b = h1.getBoundingClientRect();
      return {
        right: b.right,
        bottom: b.bottom,
        nextTop: h1.nextElementSibling?.getBoundingClientRect().top ?? null,
        scrollWidth: h1.scrollWidth,
        clientWidth: h1.clientWidth,
        trackBefore: before,
        trackAfter: track.getBoundingClientRect().width,
        hasGrid,
      };
    }, LONG_MODEL);
    expect
      .soft(r.scrollWidth, "h1 content wider than its box")
      .toBeLessThanOrEqual(r.clientWidth + 1);
    if (r.hasGrid) {
      expect
        .soft(
          r.trackAfter,
          `buy-panel track width ${r.trackBefore} -> ${r.trackAfter} (min-content blowout)`,
        )
        .toBeCloseTo(r.trackBefore, 0);
    }
    if (r.nextTop !== null)
      expect.soft(r.bottom).toBeLessThanOrEqual(r.nextTop + 0.5);
    await expectNoHorizontalOverflow(page);
  });

  test("vehicle chip: the longest seeded vehicles fit the row", async ({
    page,
  }) => {
    // Real finder seed (src/features/finder/data.ts), no injection.
    for (const [make, model] of [
      ["Jeep", "Grand Cherokee"],
      ["Chevrolet", "Silverado"],
      ["Volkswagen", "Tiguan"],
    ] as const) {
      await page.goto(
        `/results?year=2024&make=${make}&model=${encodeURIComponent(model)}`,
      );
      await settle(page);
      const m = await page
        .locator('[data-probe="vehicle-chip"]')
        .evaluate((chip) => {
          const link = chip.nextElementSibling!.getBoundingClientRect();
          const root = document.documentElement;
          return {
            linkRight: link.right,
            vw: root.clientWidth,
            scrollWidth: root.scrollWidth,
          };
        });
      const label = `2024 ${make} ${model}`;
      expect
        .soft(m.scrollWidth, `${label}: document scrollWidth`)
        .toBeLessThanOrEqual(m.vw);
      // px-4 page gutter (DESIGN.md §8): the link may not run into it.
      expect
        .soft(
          m.linkRight,
          `${label}: 'Change vehicle' right edge vs 16px gutter`,
        )
        .toBeLessThanOrEqual(m.vw - 16 + 0.5);
    }
  });

  for (const route of ["/results", "/wheels", "/accessories"] as const) {
    test(`vehicle chip on ${route}: 120-char model from the URL is never printed`, async ({
      page,
    }) => {
      // Only a vehicle the finder offers is accepted (D91b, WDG-03, narrows
      // D79): an unknown model names nothing, so no chip renders and the
      // disclosure reads `Add vehicle`. The overflow gate still has to hold.
      const model = encodeURIComponent(LONG_MODEL);
      await page.goto(`${route}?year=2021&make=Honda&model=${model}`);
      await settle(page);
      await expect(page.locator('[data-probe="vehicle-chip"]')).toHaveCount(0);
      await expect(page.locator("main")).not.toContainText(LONG_MODEL.slice(0, 20));
      await expectNoHorizontalOverflow(page);
    });
  }

  test("quote form: qty 99 and a 254-char email stay inside their fields", async ({
    page,
  }) => {
    await page.goto(`/products/${SLUG.tire}?${VEHICLE}&qty=custom#quote`);
    await settle(page);
    const email = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(57)}.com`;
    expect(email.length).toBe(254);
    const qty = page.getByLabel(/How many tires\?/);
    await qty.fill("99");
    await page.getByRole("textbox", { name: /^Email/ }).fill(email);
    for (const field of [qty, page.getByRole("textbox", { name: /^Email/ })]) {
      const m = await field.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const form = el.closest("form")!.getBoundingClientRect();
        return { left: r.left, right: r.right, fl: form.left, fr: form.right };
      });
      expect(m.left).toBeGreaterThanOrEqual(m.fl - 0.5);
      expect(m.right).toBeLessThanOrEqual(m.fr + 0.5);
    }
    await expectNoHorizontalOverflow(page);
  });
});

// --- 7. Empty / one / many, missing image --------------------------------------

test.describe("result-set sizes", () => {
  const cases = [
    { name: "empty", url: "/results?brand=zzz", cards: 0 },
    { name: "one", url: "/wheels?finish=bronze&brand=Touren", cards: 1 },
    { name: "many", url: "/results?show=all", cards: 9 },
  ] as const;
  for (const c of cases) {
    test(`${c.name}: ${c.url}`, async ({ page }) => {
      await page.goto(c.url);
      await settle(page);
      await expectNoHorizontalOverflow(page);
      const cards = page.locator("main article");
      await expect(cards).toHaveCount(c.cards);
      if (c.cards === 0) {
        await expect(page.locator("h1")).toHaveText("No matches");
        await expect(
          page.getByRole("link", { name: /Clear/i }).first(),
        ).toBeVisible();
        return;
      }
      // A lone card keeps its grid track: it is not stretched across the row.
      const widths = await cards.evaluateAll((els) =>
        els.map((e) => e.getBoundingClientRect().width),
      );
      const grid = await page
        .locator('[data-probe="best-grid"]')
        .evaluate((el) => el.getBoundingClientRect().width);
      const cols = await page
        .locator('[data-probe="best-grid"]')
        .evaluate(
          (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
        );
      for (const w of widths) expect(w).toBeLessThanOrEqual(grid / cols + 1);
      // Rows are equal-height (the card's h-full, results-desktop.html:48).
      const rows = await cards.evaluateAll((els) => {
        const byTop = new Map<number, number[]>();
        for (const e of els) {
          const r = e.getBoundingClientRect();
          const k = Math.round(r.top);
          byTop.set(k, [...(byTop.get(k) ?? []), r.height]);
        }
        return [...byTop.values()].map(
          (hs) => Math.max(...hs) - Math.min(...hs),
        );
      });
      for (const spread of rows) expect(spread).toBeLessThanOrEqual(1);
    });
  }

  test("missing product image: card readable, alt present, height unchanged", async ({
    browser,
  }, info) => {
    const isProductImage = (url: string) =>
      decodeURIComponent(url).includes("/images/products/");
    const context = await browser.newContext(info.project.use);
    try {
      const measure = async (page: Page) => {
        await page.goto("/results");
        await settle(page);
        return page
          .locator('[data-probe="best-grid"] article')
          .first()
          .evaluate((card) => {
            const img = card.querySelector("img")!;
            const box =
              img.parentElement!.parentElement!.getBoundingClientRect();
            const ir = img.getBoundingClientRect();
            return {
              height: card.getBoundingClientRect().height,
              alt: img.alt,
              natural: img.naturalWidth,
              imgInside:
                ir.left >= box.left - 0.5 &&
                ir.right <= box.right + 0.5 &&
                ir.bottom <= box.bottom + 0.5,
              text: (card.textContent ?? "").replace(/\s+/g, " ").trim(),
            };
          });
      };
      const ok = await measure(await context.newPage());
      const broken = await context.newPage();
      await broken.route(
        (url) => isProductImage(url.toString()),
        (r) => r.abort(),
      );
      const b = await measure(broken);
      expect(b.natural, "image actually failed").toBe(0);
      expect(b.alt).toMatch(/\S+ \S+/);
      expect(b.imgInside, "broken-image box stays inside the photo frame").toBe(
        true,
      );
      expect(
        Math.abs(b.height - ok.height),
        `card height ${ok.height} -> ${b.height}`,
      ).toBeLessThanOrEqual(4);
      expect(b.text).toContain("Request a quote");
      await expectNoHorizontalOverflow(broken);
    } finally {
      await context.close();
    }
  });
});
