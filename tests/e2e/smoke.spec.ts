import { test, expect } from "@playwright/test";
import { ROUTES, watchProblems, settle, expectNoHorizontalOverflow } from "../helpers";

for (const route of ROUTES) {
  test(`${route.name}: loads clean, one h1, no overflow`, async ({ page }) => {
    const watch = watchProblems(page);
    const res = await page.goto(route.path);
    expect(res?.status()).toBe(route.name === "not-found" ? 404 : 200);
    await settle(page);
    await expect(page.locator("h1")).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
    watch.expectClean({ allow404For: route.name === "not-found" ? route.path : undefined });
  });
}

/* A soft 404 (the right page on a 200) was the default for unknown product
   slugs until D91b; these must be real 404s. */
for (const path of ["/products/not-a-slug", "/wheels/anything", "/results/extra"]) {
  test(`${path}: a real 404`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  });
}

/* Every loaded image paints (D91b). The D92b image fade holds a lazy image at
   opacity 0 until the motion bootstrap marks it `data-loaded`; Next 16 runs
   that bootstrap at hydration, so an image that loaded first was never marked
   and stayed invisible — measured: the second row of cards on /results @1440
   painted blank. Scrolled top to bottom so every lazy image is pulled in. */
for (const route of ROUTES.filter((r) => r.name !== "not-found")) {
  test(`${route.name}: every loaded image paints (no stuck fade)`, async ({ page }) => {
    await page.goto(route.path);
    await settle(page);
    await page.evaluate(async () => {
      const frame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));
      const root = document.scrollingElement ?? document.documentElement;
      for (let y = 0; y < root.scrollHeight; y += Math.floor(innerHeight * 0.8)) {
        window.scrollTo({ top: y, behavior: "instant" });
        await frame();
        await frame();
      }
    });
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            [...document.images]
              .filter((im) => im.complete && im.naturalWidth > 0)
              .filter((im) => {
                const r = im.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
              })
              // Opacity 0 is the stuck fade. An unavailable card's media is dimmed
              // to .35 on purpose (docs/decisions.md §7), so partial is not a fail.
              .filter((im) => parseFloat(getComputedStyle(im).opacity) < 0.01)
              .map((im) => im.alt || im.currentSrc.slice(-60)),
          ),
        { message: "loaded images still at opacity 0", timeout: 5_000 },
      )
      .toEqual([]);
  });
}
