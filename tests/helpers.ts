/**
 * Shared fixtures for the QA suite (D91b). See `tests/llm.md`.
 * Every spec imports routes and slugs from here; none re-declares one.
 */
import { expect, type Page, type TestInfo } from "@playwright/test";

/** One PDP per category, plus each category's drawn unavailable SKU. These
 *  were the slugs of the sample catalogue (`src/features/catalog/data.ts`,
 *  deleted by D108b). The suite is parked until a fixture database carries
 *  them again (D111, `tests/llm.md` Open). */
export const SLUG = {
  tire: "zeta-antarctica-sport",
  wheel: "touren-tr76-18x8",
  accessory: "gorilla-lug-nuts-acorn",
  tireUnavailable: "zmax-winterhawk-215-50r17",
  wheelUnavailable: "spec1-sp51-20x9",
  accessoryUnavailable: "sentali-centre-cap-black",
} as const;

export const VEHICLE = "year=2021&make=Honda&model=Civic";

/** Every route the matrix covers (`design/reports/qa.md` §1). */
export const ROUTES = [
  { name: "home", path: "/" },
  { name: "results", path: "/tires" },
  { name: "results-vehicle", path: `/tires?${VEHICLE}` },
  { name: "wheels", path: "/wheels" },
  { name: "accessories", path: "/accessories" },
  { name: "pdp-tire", path: `/products/${SLUG.tire}?${VEHICLE}&qty=4` },
  { name: "pdp-wheel", path: `/products/${SLUG.wheel}` },
  { name: "pdp-accessory", path: `/products/${SLUG.accessory}` },
  { name: "pdp-unavailable", path: `/products/${SLUG.tireUnavailable}` },
  { name: "about", path: "/about" },
  { name: "privacy", path: "/privacy" },
  { name: "terms", path: "/terms" },
  { name: "styleguide", path: "/styleguide" },
  { name: "not-found", path: "/this-route-does-not-exist" },
] as const;

export type RouteName = (typeof ROUTES)[number]["name"];

/** Project kinds, derived from the project name in `playwright.config.ts`. */
/** Device descriptors set `defaultBrowserType`, not `browserName` — read both. */
export const engineOf = (info: TestInfo) =>
  info.project.use.browserName ?? info.project.use.defaultBrowserType ?? "chromium";
export const isPhone = (info: TestInfo) =>
  ["iphone-se", "iphone-15-pro", "pixel-7", "floor-320"].includes(info.project.name);
export const isTouch = (info: TestInfo) => !!info.project.use.hasTouch;
/** Below `md:` 1100 the results page uses the sticky bar + sheet, not the rail (D46). */
export const usesSheet = (info: TestInfo) => (info.project.use.viewport?.width ?? 1280) < 1100;
/** Below `lg:` the header collapses to the drawer (DESIGN.md §8). */
export const viewportWidth = (info: TestInfo) => info.project.use.viewport?.width ?? 1280;

export interface PageProblems {
  console: string[];
  failedRequests: string[];
  pageErrors: string[];
}

/**
 * Collects console errors/warnings, uncaught page errors and any same-origin
 * response >= 400. Attach before `goto`. `expectClean()` asserts all three
 * empty — a hydration mismatch surfaces as a console error in production.
 */
export function watchProblems(page: Page) {
  const problems: PageProblems = { console: [], failedRequests: [], pageErrors: [] };
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      problems.console.push(`${msg.type()}: ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    // WebKit reports a router prefetch/RSC fetch it aborted mid-navigation as
    // "… ?_rsc=… due to access control checks." — a cancelled request, not an error.
    if (/_rsc=.*due to access control checks/.test(err.message)) return;
    problems.pageErrors.push(err.message);
  });
  page.on("response", (res) => {
    const url = new URL(res.url());
    if (url.port === String(process.env.PW_PORT ?? 3100) && res.status() >= 400) {
      problems.failedRequests.push(`${res.status()} ${url.pathname}${url.search}`);
    }
  });
  return {
    problems,
    expectClean(opts: { allow404For?: string } = {}) {
      const failed = problems.failedRequests.filter(
        (r) => !(opts.allow404For && r === `404 ${opts.allow404For}`),
      );
      // A 404 page logs its own 404 document load as a console error in some engines.
      const consoleMsgs = problems.console.filter(
        (m) => !(opts.allow404For && /status of 404/.test(m)),
      );
      expect.soft(problems.pageErrors, "uncaught page errors").toEqual([]);
      expect.soft(consoleMsgs, "console errors/warnings").toEqual([]);
      expect.soft(failed, "same-origin responses >= 400").toEqual([]);
    },
  };
}

/** Wait until fonts are in and exactly one visible `<main>` is in the document. */
export async function settle(page: Page) {
  await page.waitForLoadState("load");
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await expect(page.locator("main#main")).toHaveCount(1);
  // `loading.tsx` is gone (D91b), so nothing streams into a hidden container
  // any more; this guard stays so a returning Suspense boundary fails loudly.
  await expect(page.locator("main#main")).toBeVisible();
  await page.waitForFunction(
    () => document.querySelectorAll("main").length === 1 && !document.querySelector("[hidden] main"),
  );
}

/**
 * Wait until the document stops scrolling. `<html>` is `scroll-behavior:
 * smooth` (D92b), so a `fill()` that scrolls a field into view starts a glide,
 * and a `click()` issued mid-glide re-scrolls on every retry and never sees
 * its target stable — a harness artifact, not something a pointer user meets.
 */
export async function scrollSettled(page: Page) {
  let last = -1;
  await expect
    .poll(
      async () => {
        const y = await page.evaluate(() => window.scrollY);
        const still = y === last;
        last = y;
        return still;
      },
      { intervals: [100], message: "document still scrolling" },
    )
    .toBe(true);
}

/** WCAG 1.4.10 / the standing gate: no horizontal scroll at any width. */
export async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, clientWidth, offenders } = await page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    const vw = root.clientWidth;
    const offenders = [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        // Inside a horizontal scroller (carousels) overflow is the design.
        for (let p = el.parentElement; p; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") return false;
        }
        return r.right > vw + 1 || r.left < -1;
      })
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className.toString().slice(0, 60)}`);
    return { scrollWidth: root.scrollWidth, clientWidth: vw, offenders };
  });
  expect(offenders, "elements escaping the viewport").toEqual([]);
  expect(scrollWidth, "document scrollWidth").toBeLessThanOrEqual(clientWidth);
}

/**
 * The quote form ignores a submit made less than `QUOTE_MIN_FILL_MS` (3 s)
 * after the page rendered and answers "success" without validating (D104,
 * `submitQuote`). Tests submit in milliseconds, so with JS on they backdate the
 * hidden `renderedAt` field just before each submit. Without JS nothing can run
 * a script, so a no-JS test waits the real time instead (`waitForQuoteTimer`).
 */
export async function skipQuoteTimer(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener(
      "submit",
      (event) => {
        const field = (event.target as HTMLFormElement | null)?.querySelector<HTMLInputElement>(
          'input[name="renderedAt"]',
        );
        if (field) field.value = "1";
      },
      true,
    );
  });
}

/** Wait until the server's 3 s "too fast to be a person" window has passed. */
export async function waitForQuoteTimer(page: Page) {
  await page.waitForFunction(() => {
    const field = document.querySelector<HTMLInputElement>('input[name="renderedAt"]');
    return field ? Date.now() - Number(field.value) > 3200 : true;
  }, null, { timeout: 15_000 }).catch(() => undefined);
}
