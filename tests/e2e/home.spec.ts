/**
 * Home + site chrome (D91b QA pass, agent HPD).
 *
 * Covers: the nav drawer (D31, D66), the desktop header nav (D7, D39), the
 * featured carousel (D30, D66, D74), cold-load and in-app `#contact` /
 * `#how-it-works` anchors (D66, D80), `tel:` hrefs site-wide (D76), the
 * category tiles (D39, D63), and the product card's image link (D86).
 *
 * Rules: `tests/llm.md`. Real mouse/keyboard only; hit-test where stacking
 * could intercept a click.
 */
import { test, expect, type Page, type Locator, type TestInfo } from "@playwright/test";
import {
  ROUTES,
  settle,
  watchProblems,
  viewportWidth,
  isTouch,
  scrollSettled as documentScrollSettled,
} from "../helpers";

/** `src/lib/site.ts` CONTACTS — the only two numbers the site may dial. */
const ALLOWED_TEL = ["tel:+14378825000", "tel:+13659980990"];
const PRIMARY_TEL = "tel:+14378825000";

/** `src/features/catalog/data.ts` FEATURED_ROW (D74): the four drawn SKUs in
 *  drawn order, then the two appended. Seed data (D48). */
const FEATURED_ORDER = [
  "zeta-antarctica-sport",
  "zmax-winterhawk",
  "zmax-landgema",
  "mazzini-snowleopard",
  "zeta-antarctica-sport-235-40r18",
  "mazzini-snowleopard-225-50r17",
];

/** Header link row shows from `md:` 1100 (site-header.tsx); drawer below. */
const DRAWER_MAX = 1100;
/** Carousel desktop arrows from `sm:` 720; mobile Next + dots below. */
const SM = 720;

/**
 * The drawer is only reachable below 1100. Device projects exercise it on
 * WebKit and Chromium; `firefox-1280` is resized to 1024 so Gecko is covered
 * too. Other desktop projects skip (they would repeat Chromium/WebKit).
 */
async function prepareDrawerViewport(page: Page, info: TestInfo) {
  if (viewportWidth(info) < DRAWER_MAX) return;
  test.skip(info.project.name !== "firefox-1280", "drawer only renders below 1100px");
  await page.setViewportSize({ width: 1024, height: 800 });
}

/**
 * WebKit follows Safari's default: plain Tab skips links and buttons, and
 * Option+Tab is the platform's all-controls traversal. Uses the `browserName`
 * fixture, not `engineOf()` — device projects set no `use.browserName`, so
 * `engineOf()` reports "chromium" for the WebKit iPhones and iPads.
 */
const tabKey = (browserName: string) => (browserName === "webkit" ? "Alt+Tab" : "Tab");

const drawer = (page: Page) => page.locator("dialog#site-nav-drawer");
const menuButton = (page: Page) =>
  page.getByRole("banner").getByRole("button", { name: "Menu", exact: true });

/** Pointer-open the drawer, retried until hydration has wired the trigger. */
async function openDrawer(page: Page) {
  await expect(async () => {
    await menuButton(page).click();
    await expect(drawer(page)).toBeVisible({ timeout: 1_000 });
  }).toPass();
}

async function activeInfo(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    const dialog = document.getElementById("site-nav-drawer");
    return {
      tag: el?.tagName.toLowerCase() ?? "null",
      label: el?.getAttribute("aria-label") ?? el?.textContent?.trim().slice(0, 40) ?? "",
      inDialog: !!(el && dialog?.contains(el)),
      isBody: el === document.body || el === null,
    };
  });
}

// ---------------------------------------------------------------------------
// 1. Nav drawer + header nav
// ---------------------------------------------------------------------------

test.describe("nav drawer (below 1100)", () => {
  test("opens modal, traps Tab, Esc closes, focus + scroll lock round-trip", async ({
    page,
    browserName,
  }, info) => {
    await prepareDrawerViewport(page, info);
    const watch = watchProblems(page);
    await page.goto("/");
    await settle(page);

    const trigger = menuButton(page);
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toHaveAttribute("aria-controls", "site-nav-drawer");

    // Open by keyboard (real key press on the focused trigger). Retried
    // until hydration has attached the handler.
    const dialog = drawer(page);
    await expect(async () => {
      await trigger.focus();
      await page.keyboard.press("Enter");
      await expect(dialog).toBeVisible({ timeout: 1_000 });
    }).toPass();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(await dialog.evaluate((d) => d.matches(":modal"))).toBe(true);
    await expect(dialog).toHaveAccessibleName("Menu");

    // Focus moves into the drawer on open.
    await expect.poll(async () => (await activeInfo(page)).inDialog).toBe(true);

    // Body scroll is locked.
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe(
      "hidden",
    );

    // Tab trap: 12 presses never land on page content behind the modal.
    // At the wrap point a modal <dialog> may hand focus to browser chrome
    // (Gecko keeps activeElement on the last control; Blink reports body),
    // which is the platform's trap, not an escape.
    const seen = new Set<string>([(await activeInfo(page)).label]);
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press(tabKey(browserName));
      const a = await activeInfo(page);
      if (a.inDialog) seen.add(a.label.replace(/\s+/g, " "));
      expect(a.inDialog || a.isBody, `Tab ${i + 1} escaped the drawer: ${a.tag} ${a.label}`).toBe(
        true,
      );
    }
    // Every drawer control is reachable by keyboard.
    for (const name of ["Close menu", "Tires", "Wheels", "Accessories", "Contact"]) {
      expect([...seen], `${name} reached by Tab`).toContain(name);
    }
    expect([...seen].some((l) => l.startsWith("Call +1"))).toBe(true);

    // Esc closes and returns focus to the trigger.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe(
      "hidden",
    );

    // Pointer path: tap/click open, Close menu button closes.
    await trigger.click();
    await expect(dialog).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await dialog.getByRole("button", { name: "Close menu" }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    // WebKit does not focus a <button> on mouse click (Safari platform
    // behaviour), so there is no prior focus to restore on that engine.
    if (browserName !== "webkit") await expect(trigger).toBeFocused();

    watch.expectClean();
  });

  test("contents: four links, E.164 tel CTA, safe-area bottom padding", async ({
    page,
  }, info) => {
    await prepareDrawerViewport(page, info);
    await page.goto("/");
    await settle(page);
    await openDrawer(page);
    const dialog = drawer(page);

    const nav = dialog.getByRole("navigation", { name: "Primary" });
    const links = nav.getByRole("link");
    const hrefs = await links.evaluateAll((els) =>
      els.map((el) => [el.textContent?.trim() ?? "", el.getAttribute("href") ?? ""]),
    );
    expect(hrefs.slice(0, 4)).toEqual([
      ["Tires", "/results"],
      ["Wheels", "/wheels"],
      ["Accessories", "/accessories"],
      ["Contact", "/#contact"],
    ]);

    const tel = dialog.getByRole("link", { name: /Call \+1 \(437\) 882-5000/ });
    await expect(tel).toBeVisible();
    await expect(tel).toHaveAttribute("href", PRIMARY_TEL);

    // `pb-safe` = calc(20px + env(safe-area-inset-bottom)); inset is 0 here.
    const pb = await nav.evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
    expect(pb).toBeGreaterThanOrEqual(20);

    // The CTA sits inside the viewport (not under the fold of a dvh drawer).
    const box = await tel.boundingBox();
    const vh = await page.evaluate(() => window.innerHeight);
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(vh);
  });

  test("a drawer link navigates, closes the drawer and releases the scroll lock", async ({
    page,
  }, info) => {
    await prepareDrawerViewport(page, info);
    await page.goto("/");
    await settle(page);
    await openDrawer(page);
    await drawer(page).getByRole("link", { name: "Wheels", exact: true }).click();
    await expect(page).toHaveURL(/\/wheels$/);
    await expect(page.locator("main#main")).toHaveCount(1);
    await expect(drawer(page)).toBeHidden();
    // A leaked `overflow:hidden` would freeze the next page.
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
      .not.toBe("hidden");
    await expect(menuButton(page)).toHaveAttribute("aria-expanded", "false");
    // The new page scrolls (wheel input where the engine supports it).
    if (!isTouch(info)) {
      await page.mouse.wheel(0, 600);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    }
  });

  test("drawer Contact on / closes and lands on #contact", async ({ page }, info) => {
    await prepareDrawerViewport(page, info);
    await page.goto("/");
    await settle(page);
    await openDrawer(page);
    await drawer(page).getByRole("link", { name: "Contact", exact: true }).click();
    await expect(drawer(page)).toBeHidden();
    await expectLandedOn(page, "contact");
  });
});

test.describe("desktop header nav (1100 and up)", () => {
  test("four links resolve to their routes and navigate", async ({ page }, info) => {
    test.skip(viewportWidth(info) < DRAWER_MAX, "header link row is hidden below 1100");
    await page.goto("/results");
    await settle(page);
    const nav = page.getByRole("banner").getByRole("navigation", { name: "Primary" });
    await expect(menuButton(page)).toBeHidden();
    const expected: Array<[string, string, RegExp]> = [
      ["Tires", "/results", /\/results$/],
      ["Wheels", "/wheels", /\/wheels$/],
      ["Accessories", "/accessories", /\/accessories$/],
    ];
    for (const [name, href, url] of expected) {
      const link = nav.getByRole("link", { name, exact: true });
      await expect(link).toHaveAttribute("href", href);
      await link.click();
      await expect(page).toHaveURL(url);
      await expect(page.locator("main#main")).toHaveCount(1);
    }
    await expect(nav.getByRole("link", { name: "Contact", exact: true })).toHaveAttribute(
      "href",
      "/#contact",
    );
    const tel = page.getByRole("banner").getByRole("link", { name: /^Call / });
    await expect(tel).toHaveAttribute("href", PRIMARY_TEL);
  });
});

// ---------------------------------------------------------------------------
// 2. Featured carousel
// ---------------------------------------------------------------------------

const featured = (page: Page) => page.locator('[data-probe="featured"]');
const track = (page: Page) => featured(page).getByRole("group", { name: "Featured tires" });

async function trackState(t: Locator) {
  return t.evaluate((el) => ({
    left: el.scrollLeft,
    max: el.scrollWidth - el.clientWidth,
    width: el.clientWidth,
  }));
}

/** Wait until the smooth scroll has stopped moving. */
async function scrollSettled(t: Locator) {
  let prev = -1;
  await expect
    .poll(
      async () => {
        const now = (await trackState(t)).left;
        const still = Math.abs(now - prev) < 0.5;
        prev = now;
        return still;
      },
      { intervals: [100, 100, 150, 200, 250] },
    )
    .toBe(true);
  return trackState(t);
}

async function cardSlugs(t: Locator) {
  return t.evaluate((el) =>
    [...el.children].map((c) => {
      const a = c.querySelector<HTMLAnchorElement>("article a.display");
      return a?.getAttribute("href")?.replace("/products/", "") ?? "";
    }),
  );
}

test.describe("featured carousel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await featured(page).scrollIntoViewIfNeeded();
  });

  test("six SKUs, drawn four first in drawn order", async ({ page }) => {
    expect(await cardSlugs(track(page))).toEqual(FEATURED_ORDER);
  });

  test("desktop arrows scroll the track, clamp to the end and wrap (D74)", async ({
    page,
  }, info) => {
    test.skip(viewportWidth(info) < SM, "desktop arrows render from 720px");
    const t = track(page);
    const next = featured(page).getByRole("button", { name: "Next" }).locator("visible=true");
    const prev = featured(page).getByRole("button", { name: "Previous" });
    await expect(next).toHaveCount(1);
    await expect(prev).toBeVisible();

    const start = await trackState(t);
    expect(start.left).toBe(0);
    expect(start.max, "track must overflow so the arrows can act").toBeGreaterThan(0);

    // At rest the four drawn cards are fully visible (4-up from 1100, 3-up below).
    const perView = viewportWidth(info) >= DRAWER_MAX ? 4 : 3;
    const fullyVisible = await t.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return [...el.children].filter((c) => {
        const b = c.getBoundingClientRect();
        return b.left >= r.left - 1 && b.right <= r.right + 1;
      }).length;
    });
    expect(fullyVisible).toBe(perView);

    await next.click();
    const one = await scrollSettled(t);
    expect(one.left).toBeGreaterThan(0);

    // Keep pressing: must reach the end exactly (last card fully revealed).
    for (let i = 0; i < 6 && (await trackState(t)).left < one.max - 1; i++) {
      await next.click();
      await scrollSettled(t);
    }
    const end = await trackState(t);
    expect(Math.abs(end.left - end.max)).toBeLessThanOrEqual(1);
    const lastVisible = await t.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const b = el.lastElementChild!.getBoundingClientRect();
      return b.right <= r.right + 1;
    });
    expect(lastVisible).toBe(true);

    // Previous steps back; Next at the end wraps to 0.
    await prev.click();
    const back = await scrollSettled(t);
    expect(back.left).toBeLessThan(end.left);
    await next.click();
    const again = await scrollSettled(t);
    expect(Math.abs(again.left - again.max)).toBeLessThanOrEqual(1);
    // From the end, Next wraps home.
    await next.click();
    expect((await scrollSettled(t)).left).toBe(0);
  });

  test("mobile Next reveals every card and lights every dot (D74 off-by-one)", async ({
    page,
  }, info) => {
    test.skip(viewportWidth(info) >= SM, "mobile Next + dots render below 720px");
    const t = track(page);
    const next = featured(page).getByRole("button", { name: "Next" }).locator("visible=true");
    await expect(next).toHaveCount(1);

    const dots = () =>
      featured(page).evaluate((section) => {
        // The dot row: six aria-hidden 3px bars after the track wrapper.
        const bars = [...section.querySelectorAll<HTMLElement>("span[aria-hidden='true']")].filter(
          (s) => Math.round(s.getBoundingClientRect().height) === 3,
        );
        return bars.map((b) => Math.round(b.getBoundingClientRect().width));
      });

    expect(await dots()).toEqual([28, 12, 12, 12, 12, 12]);

    const litSeen = new Set<number>([0]);
    for (let i = 1; i < FEATURED_ORDER.length; i++) {
      await next.click();
      await scrollSettled(t);
      const d = await dots();
      litSeen.add(d.indexOf(28));
      expect(d.filter((w) => w === 28)).toHaveLength(1);
    }
    expect([...litSeen].sort()).toEqual([0, 1, 2, 3, 4, 5]);

    // Card 4 (and the last card) were each revealed by the button alone.
    const end = await trackState(t);
    expect(Math.abs(end.left - end.max)).toBeLessThanOrEqual(1);
    const lastInView = await t.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const b = el.lastElementChild!.getBoundingClientRect();
      return b.right <= r.right + 1;
    });
    expect(lastInView).toBe(true);

    // Next at the end wraps to the start and the first dot relights.
    await next.click();
    expect((await scrollSettled(t)).left).toBe(0);
    expect((await dots())[0]).toBe(28);
  });

  test("touch swipe scroll snaps to a card edge", async ({ page }, info) => {
    test.skip(!isTouch(info), "needs touch emulation");
    const t = track(page);
    // A programmatic scroll to a mid-card offset must be pulled to a snap point.
    await t.evaluate((el) => el.scrollTo({ left: 130, behavior: "instant" as ScrollBehavior }));
    const s = await scrollSettled(t);
    const snapPoints = await t.evaluate((el) => {
      const base = (el.firstElementChild as HTMLElement).offsetLeft;
      return [...el.children].map((c) => (c as HTMLElement).offsetLeft - base);
    });
    const nearest = Math.min(
      ...[...snapPoints, s.max].map((p) => Math.abs(p - s.left)),
    );
    expect(nearest, `scrollLeft ${s.left} not on a snap point ${snapPoints}`).toBeLessThanOrEqual(1);
  });

  test("track is keyboard-focusable and arrow keys scroll it (D66)", async ({ page }) => {
    const t = track(page);
    await expect(t).toHaveAttribute("tabindex", "0");
    // Start sequential navigation at the visible Next button, then Tab.
    const next = featured(page).getByRole("button", { name: "Next" }).locator("visible=true");
    await next.focus();
    await page.keyboard.press("Tab");
    await expect(t).toBeFocused();
    await expect
      .poll(() => t.evaluate((el) => getComputedStyle(el).outlineStyle))
      .not.toBe("none");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect.poll(async () => (await trackState(t)).left).toBeGreaterThan(0);
  });

  test("card hover lift is not clipped by the scroller (D74)", async ({ page }, info) => {
    test.skip(isTouch(info) || viewportWidth(info) < SM, "hover lift is desktop-pointer only");
    const t = track(page);
    const article = t.locator("article").first();
    // Scroll first and let the D92b smooth scroll come to rest, or hover()
    // lands on where the card was mid-glide (scrollSettled, helpers.ts).
    await article.scrollIntoViewIfNeeded();
    await documentScrollSettled(page);
    // Re-hover on each poll: this test is about the lifted card not being
    // clipped, and a snap or glide that slides the card out from under a
    // stale pointer (measured 2/6 at 1920 under load) is not what it checks.
    await expect
      .poll(async () => {
        await article.hover();
        return article.evaluate((el) => getComputedStyle(el).translate);
      })
      .toMatch(/-2px/);
    const { cardTop, clipTop } = await t.evaluate((el) => ({
      clipTop: el.getBoundingClientRect().top,
      cardTop: el.querySelector("article")!.getBoundingClientRect().top,
    }));
    expect(cardTop).toBeGreaterThanOrEqual(clipTop - 0.5);
  });
});

// ---------------------------------------------------------------------------
// 3. Anchors (D66 scroll-mt, D80 HashScroll)
// ---------------------------------------------------------------------------

/**
 * Asserts the section's top sits at its own `scroll-margin-top` below the
 * viewport top, or — when the page cannot scroll that far — that the page is
 * scrolled to its maximum with the section visible.
 */
async function expectLandedOn(page: Page, id: string, timeout = 4_000) {
  await expect
    .poll(
      async () =>
        page.evaluate((sid) => {
          const el = document.getElementById(sid);
          if (!el) return "missing";
          const top = el.getBoundingClientRect().top;
          const mt = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
          const root = document.scrollingElement!;
          const atMax = Math.abs(root.scrollTop - (root.scrollHeight - root.clientHeight)) <= 2;
          if (window.scrollY <= 0) return `scrollY 0 (top ${Math.round(top)})`;
          if (Math.abs(top - mt) <= 2) return "ok";
          if (atMax && top >= 0 && top <= mt + 2) return "ok";
          return `top ${Math.round(top)} vs scroll-mt ${mt}`;
        }, id),
      { timeout, message: `#${id} should land at its scroll-margin-top` },
    )
    .toBe("ok");
}

for (const id of ["contact", "how-it-works"] as const) {
  test(`cold load /#${id} scrolls to the section within 4s (D80)`, async ({ page }) => {
    const watch = watchProblems(page);
    await page.goto(`/#${id}`);
    await expectLandedOn(page, id);
    watch.expectClean();
  });
}

/*
 * Client-side navigation from another route to a home anchor. Three
 * attempts per test: the failure mode (D80's streaming race, seen from a
 * router push rather than a cold load) is intermittent, and one pass proves
 * little. Each attempt starts from a scrolled page, as a real footer or
 * header click would.
 */
test("header Contact from another page lands on #contact", async ({ page }, info) => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto("/results");
    await settle(page);
    if (viewportWidth(info) < DRAWER_MAX) {
      await openDrawer(page);
      await drawer(page).getByRole("link", { name: "Contact", exact: true }).click();
    } else {
      await page
        .getByRole("banner")
        .getByRole("link", { name: "Contact", exact: true })
        .click();
    }
    await expect(page).toHaveURL(/\/#contact$/);
    await test.step(`attempt ${attempt}`, () => expectLandedOn(page, "contact", 6_000));
  }
});

test("header Contact on / lands on #contact", async ({ page }, info) => {
  test.skip(viewportWidth(info) < DRAWER_MAX, "drawer path covered in the drawer block");
  await page.goto("/");
  await settle(page);
  await page.getByRole("banner").getByRole("link", { name: "Contact", exact: true }).click();
  await expect(page).toHaveURL(/\/#contact$/);
  await expectLandedOn(page, "contact");
});

test("footer How it works link lands on #how-it-works from another page", async ({ page }) => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto("/about");
    await settle(page);
    await page
      .getByRole("contentinfo")
      .getByRole("link", { name: "How it works", exact: true })
      .click();
    await expect(page).toHaveURL(/\/#how-it-works$/);
    await test.step(`attempt ${attempt}`, () => expectLandedOn(page, "how-it-works", 6_000));
  }
});

// ---------------------------------------------------------------------------
// 4. tel: links, category tiles, card image link
// ---------------------------------------------------------------------------

test("every tel: link on every route is E.164 and one of the two contacts (D76)", async ({
  page,
}, info) => {
  // Server-rendered markup; one desktop and one phone project are enough.
  test.skip(
    !["chromium-1440", "iphone-se"].includes(info.project.name),
    "markup sweep runs on chromium-1440 and iphone-se only",
  );
  const bad: string[] = [];
  let primarySeen = 0;
  for (const route of ROUTES) {
    await page.goto(route.path);
    await expect(page.locator("main#main")).toHaveCount(1);
    const tels = await page
      .locator('a[href^="tel:"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
    for (const href of tels) {
      if (!/^tel:\+1\d{10}$/.test(href) || !ALLOWED_TEL.includes(href)) {
        bad.push(`${route.path}: ${href}`);
      }
      if (href === PRIMARY_TEL) primarySeen++;
    }
  }
  expect(bad).toEqual([]);
  expect(primarySeen).toBeGreaterThan(0);
});

test("category tiles link to the three routes and the tile hit-tests to its link", async ({
  page,
}) => {
  await page.goto("/");
  await settle(page);
  const tiles: Array<[string, string]> = [
    ["tile-tires", "/results"],
    ["tile-wheels", "/wheels"],
    ["tile-accessories", "/accessories"],
  ];
  for (const [probe, href] of tiles) {
    const tile = page.locator(`[data-probe="${probe}"]`);
    await expect(tile).toHaveAttribute("href", href);
    await tile.scrollIntoViewIfNeeded();
    const hit = await tile.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return at?.closest("a") === el;
    });
    expect(hit, `${probe} centre resolves to its link`).toBe(true);
  }
  await page.locator('[data-probe="tile-accessories"]').click();
  await expect(page).toHaveURL(/\/accessories$/);
});

test.describe("product card image link (D86)", () => {
  test("image centre and badge corner resolve to the image anchor; click opens the PDP", async ({
    page,
  }) => {
    await page.goto("/");
    await settle(page);
    const card = track(page).locator("article").first();
    await card.scrollIntoViewIfNeeded();
    const result = await card.evaluate((article) => {
      const anchor = article.querySelector<HTMLAnchorElement>('a[aria-hidden="true"]');
      const img = anchor?.querySelector("img");
      if (!anchor || !img) return { error: "no image anchor" };
      const r = img.getBoundingClientRect();
      const centre = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      // A badge sits over the top-left of the photo.
      const badge = [...article.querySelectorAll<HTMLElement>("span")].find(
        (s) => s.textContent?.trim().toLowerCase() === "winter",
      );
      const b = badge?.getBoundingClientRect();
      const corner = b ? document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) : null;
      // Brand stamp top-right.
      const stampPoint = document.elementFromPoint(r.right - 12, r.top + 20);
      return {
        href: anchor.getAttribute("href"),
        centre: centre?.closest("a") === anchor,
        badge: b ? corner?.closest("a") === anchor : "no badge",
        stamp: stampPoint?.closest("a") === anchor,
      };
    });
    expect(result).toEqual({
      href: "/products/zeta-antarctica-sport",
      centre: true,
      badge: true,
      stamp: true,
    });
    await card.locator("img").click();
    await expect(page).toHaveURL(/\/products\/zeta-antarctica-sport$/);
  });

  test("two tab stops per card: model link, then Request a quote", async ({
    page,
    browserName,
  }) => {
    const tab = tabKey(browserName);
    await page.goto("/");
    await settle(page);
    const t = track(page);
    const counts = await t.evaluate((el) =>
      [...el.querySelectorAll("article")].map(
        (a) =>
          [...a.querySelectorAll<HTMLElement>("a, button, input, select, textarea, [tabindex]")].filter(
            (n) => n.tabIndex >= 0 && !n.hasAttribute("disabled"),
          ).length,
      ),
    );
    expect(counts).toEqual(Array(FEATURED_ORDER.length).fill(2));

    // Real keyboard: model link -> CTA -> next card's model link.
    const first = t.locator("article").nth(0);
    const second = t.locator("article").nth(1);
    await first.getByRole("link", { name: "Antarctica Sport", exact: true }).focus();
    await page.keyboard.press(tab);
    await expect(first.getByRole("link", { name: /^Request a quote/ })).toBeFocused();
    await page.keyboard.press(tab);
    await expect(second.getByRole("link", { name: "Winterhawk", exact: true })).toBeFocused();
  });

  test("Request a quote on a card goes to the PDP #quote band", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    const cta = track(page)
      .locator("article")
      .first()
      .getByRole("link", { name: /^Request a quote/ });
    await expect(cta).toHaveAttribute("href", "/products/zeta-antarctica-sport#quote");
    await cta.scrollIntoViewIfNeeded();
    await documentScrollSettled(page);
    await cta.click();
    await expect(page).toHaveURL(/\/products\/zeta-antarctica-sport#quote$/);
    await expectLandedOn(page, "quote", 6_000);
  });

  /* Same arrival, from /results: Next's own fragment scroll glides under
     `scroll-behavior: smooth` and can stop short (D91b), so HashScroll lands
     the section instantly on every committed route change. */
  test("Request a quote on a /results card lands on the PDP #quote band", async ({ page }) => {
    await page.goto("/results");
    await settle(page);
    const cta = page
      .locator("article")
      .first()
      .getByRole("link", { name: /^Request a quote/ });
    await expect(cta).toHaveAttribute("href", /\/products\/[^#]+#quote$/);
    await cta.scrollIntoViewIfNeeded();
    await documentScrollSettled(page);
    await cta.click();
    await expect(page).toHaveURL(/\/products\/[^#]+#quote$/);
    await expectLandedOn(page, "quote", 6_000);
  });
});
