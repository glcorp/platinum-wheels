/**
 * VISUAL — full-page rest-state baselines (D91b, `tests/llm.md`).
 *
 * Chromium only (baselines are macOS + Chromium, `tests/llm.md` "Owns"), run
 * in project `chromium-1440` and every other project skipped; the viewport is
 * set per test so one project yields both the 390 and 1440 baselines.
 * `not-found` gets one baseline (1440) — it is a single static page.
 *
 * Stabilisation, all condition-based: fonts loaded, exactly one visible
 * `<main>` (`settle`), every lazy image pulled in by a scroll pass and fully
 * decoded, then back to the top. Animations are disabled and the caret hidden
 * by the config's `toHaveScreenshot` defaults. Nothing that is content is
 * masked. `Winter <year>` / `© <year>` are computed (D32) and stable within a
 * year.
 *
 * `/styleguide` §12 shows `LoaderMark` sweeping continuously (D92b addendum,
 * DEVIATIONS #81). Its two shots run under `prefers-reduced-motion: reduce`
 * rather than masking the row: the reduced-motion kill in globals.css settles
 * the sweep to its static ring, so the mark stays in the baseline in the form
 * a reduced-motion visitor sees, and nothing is hidden from the diff.
 *
 * A baseline changes only with a DEVIATIONS.md row or a D-row naming the
 * visual change — `--update-snapshots` alone is not a fix.
 */
import { test, expect, type Page } from "@playwright/test";
import { ROUTES, settle } from "../helpers";

const WIDTHS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

/**
 * A streamed page would first arrive inside a `<div hidden>` (measured under
 * D62's `loading.tsx`: a styleguide capture at 1776px, the skeleton, instead of
 * 9946). That boundary is gone (D91b); the guard stays so a returning one
 * fails here rather than silently baselining a skeleton.
 */
async function waitForReveal(page: Page) {
  await expect(page.locator("main#main")).toBeVisible();
  await page.waitForFunction(() => !document.querySelector("[hidden] main#main"));
}

/** Load every lazy image, wait for decode, return to the top at rest. */
async function stabilise(page: Page) {
  await settle(page);
  await waitForReveal(page);
  // Bring every paintable <img> into view in turn so `loading="lazy"` fires,
  // and wait for its load (or error) event, then for decode. "Paintable"
  // excludes a lazy image inside `display:none` (the contact photo below 720,
  // DEVIATIONS #8) or off the side of a horizontal track: it never loads and
  // never appears in the capture either.
  await page.evaluate(async () => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));
    // One pass top to bottom first, so anything armed on scroll (the D92b
    // below-the-fold reveal) has crossed the viewport before the capture.
    const root = document.scrollingElement ?? document.documentElement;
    const step = Math.max(200, Math.floor(innerHeight * 0.8));
    for (let y = 0; y < root.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: "instant" });
      await frame();
      await frame();
    }
    const paintable = () =>
      [...document.images].filter((img) => {
        const r = img.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth;
      });
    for (const img of paintable()) {
      if (img.complete) continue;
      img.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
      await new Promise<void>((resolve) => {
        if (img.complete) return resolve();
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      });
    }
    await Promise.all(paintable().map((img) => img.decode().catch(() => undefined)));
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  // The D92b reveal flips a section on an IntersectionObserver callback. A
  // fast scroll pass can move a section in and out of view before that
  // callback runs, so it stays `pending` (opacity 0) — and the 2026-09-30
  // home baselines were captured that way, blank from How it works down, and
  // then "confirmed" twice because the race reproduced. Bring each pending
  // section into view and wait for it to flip, then return to the top.
  await page.evaluate(async () => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));
    for (let i = 0; i < 20; i++) {
      const el = document.querySelector<HTMLElement>('[data-reveal="pending"]');
      if (!el) break;
      el.scrollIntoView({ block: "center", behavior: "instant" });
      for (let f = 0; f < 30 && el.dataset.reveal === "pending"; f++) await frame();
    }
  });
  await expect
    .poll(() => page.evaluate(() => document.querySelectorAll('[data-reveal="pending"]').length))
    .toBe(0);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  // Scrolling horizontal tracks back to rest too (the carousel is D30/D74).
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>("*")) {
      if (el.scrollLeft) el.scrollLeft = 0;
    }
  });
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBe(0);
}

test.describe("visual rest states", () => {
  test.beforeEach(({}, info) => {
    test.skip(
      info.project.name !== "chromium-1440",
      "Visual baselines are Chromium-only and generated from chromium-1440 (tests/llm.md).",
    );
  });

  for (const route of ROUTES) {
    for (const size of WIDTHS) {
      if (route.name === "not-found" && size.width !== 1440) continue;
      test(`${route.name} @${size.width}`, async ({ page }) => {
        await page.setViewportSize(size);
        if (route.name === "styleguide") await page.emulateMedia({ reducedMotion: "reduce" });
        const res = await page.goto(route.path);
        expect(res?.status()).toBe(route.name === "not-found" ? 404 : 200);
        await stabilise(page);
        await expect(page).toHaveScreenshot(`${route.name}-${size.width}.png`, {
          fullPage: true,
        });
      });
    }
  }
});
