/**
 * Accessibility — axe (WCAG 2.2 AA) per route and state, document structure,
 * live regions, target size (2.5.8) and focus-not-obscured (2.4.11). D91b, QA
 * agent `AXE`. Rules: `tests/llm.md`.
 *
 * Known and deliberately NOT re-reported (they are cited where they are
 * excluded, never silently dropped):
 * - The price-range thumbs are 20px tall — the D69 motor finding, known and
 *   "not attempted" (root `llm.md` D69). Excluded from the generic axe and
 *   target-size assertions; carried by its own `test.fixme` below.
 * - Contrast over photography: axe returns it as `incomplete`, never as a
 *   violation, and a CSS-compositing checker cannot see a photo (D65/D67).
 *   The pixel-sampling agent owns it; this spec attaches the incomplete list.
 * - `Load more` drops focus and announces nothing (D68;
 *   `src/features/results/llm.md` Open #7) — known, not asserted here.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

import { ROUTES, SLUG, VEHICLE, isPhone, settle, usesSheet, viewportWidth } from "../helpers";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** axe is the slow part of this spec. One project per engine at 1440 plus the
 *  device classes whose layout differs (phone webkit, phone chromium, tablet,
 *  the 320 floor). The 1280/1920 desktops and the remaining phones render the
 *  same responsive band as a project already in this list. */
const AXE_PROJECTS = [
  "chromium-1440",
  "firefox-1440",
  "webkit-1440",
  "iphone-se",
  "pixel-7",
  "ipad-mini",
  "floor-320",
];
const onAxeProject = (info: TestInfo) => AXE_PROJECTS.includes(info.project.name);
const SKIP_REASON = "same responsive band as a project in AXE_PROJECTS";

/** Below `md:` 1100 the header collapses to the drawer (site-nav-drawer.tsx). */
const usesDrawer = (info: TestInfo) => viewportWidth(info) < 1100;

/** The results routes: three categories share one composition (D58). */
const RESULTS_ROUTES = [
  { name: "results", path: "/results" },
  { name: "wheels", path: "/wheels" },
  { name: "accessories", path: "/accessories" },
] as const;

/** D69: the two native range inputs are 20px tall; known, not attempted. */
const PRICE_RANGE = /#(rail|sheet)-price-(min|max)\b/;

const EMPTY_RESULTS = "/results?brand=nonexistent";

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

/** Waits until every finite animation/transition on the page has finished, so
 *  axe never measures a fading panel mid-flight (D67 added several 150ms
 *  fades; a mid-fade label measured 3.52:1 in a probe). */
async function quiesce(page: Page) {
  await page.evaluate(async () => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const finite = document.getAnimations().filter((a) => {
      const t = a.effect?.getComputedTiming();
      return t && t.iterations !== Infinity && t.endTime !== Infinity;
    });
    await Promise.all(finite.map((a) => a.finished.catch(() => undefined)));
  });
}

interface AxeRow {
  rule: string;
  impact: string;
  target: string;
  summary: string;
}

/** Runs axe with the WCAG 2.2 AA tag set, attaches the full result, and soft-
 *  asserts that no violation remains beyond the named known exclusions. */
async function expectAxeClean(page: Page, info: TestInfo, label: string) {
  await quiesce(page);
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  const rows: AxeRow[] = results.violations.flatMap((v) =>
    v.nodes.map((n) => ({
      rule: v.id,
      impact: v.impact ?? "",
      target: n.target.join(" "),
      summary: (n.failureSummary ?? "").replace(/\s+/g, " ").slice(0, 200),
    })),
  );
  const known = (r: AxeRow) => r.rule === "target-size" && PRICE_RANGE.test(r.target);
  await info.attach(`axe-${label}.json`, {
    body: JSON.stringify(
      {
        violations: rows,
        incomplete: results.incomplete.map((i) => ({
          rule: i.id,
          nodes: i.nodes.map((n) => n.target.join(" ")),
        })),
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  expect
    .soft(
      rows.filter((r) => !known(r)).map((r) => `${r.rule} [${r.impact}] ${r.target} — ${r.summary}`),
      `axe WCAG 2.2 AA violations: ${label}`,
    )
    .toEqual([]);
}

/** `settle()` plus a guard that no tree sits in a hidden streaming container.
 *  Under D62's `loading.tsx` the real tree sat beside the skeleton (both carry
 *  the site header, so ids and landmarks doubled) — measured on `/results`,
 *  the PDPs and `/styleguide` as `#site-nav-drawer ×2` and zero exposed
 *  `<main>`. That file is gone (D91b); the guard stays as a regression check. */
async function open(page: Page, path: string) {
  const res = await page.goto(path);
  expect(res?.status()).toBe(path === "/this-route-does-not-exist" ? 404 : 200);
  await settle(page);
  await expect(page.locator("main#main")).toBeVisible();
  await page.waitForFunction(
    () => document.querySelectorAll("main").length === 1 && !document.querySelector("[hidden] main"),
  );
}

/** The visible results count (`results-grid.tsx`), the build's live region. */
const countOf = (page: Page) => page.locator('section [data-probe="count"]');

/** The filter form the visitor can actually reach at this width: the rail from
 *  `md:`, else the sheet after opening it (D46). */
async function reachableFilters(page: Page, info: TestInfo): Promise<Locator> {
  if (!usesSheet(info)) return page.getByRole("complementary", { name: "Filters" });
  await page.locator('[data-probe="sticky-bar"]').getByRole("button", { name: /^Filters/ }).click();
  const sheet = page.getByRole("dialog", { name: "Filters" });
  await expect(sheet).toBeVisible();
  await quiesce(page);
  return sheet;
}

/** Next's `<next-route-announcer>` is also `role="alert"`, so scope to the form. */
const quoteAlert = (page: Page) => page.locator('[data-probe="quote-form"]').getByRole("alert");

async function fillValidQuote(page: Page) {
  // Test values for this app on a local host; nothing is sent (D51/D54).
  await page.getByRole("textbox", { name: "Full name" }).fill("Test Person");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("qa@example.test");
  await page.getByRole("textbox", { name: "Phone", exact: true }).fill("905 555 0100");
}

// ---------------------------------------------------------------------------
// 1. axe — every route at rest, plus the empty-results state
// ---------------------------------------------------------------------------

test.describe("axe: rest state", () => {
  const cells = [...ROUTES, { name: "results-empty", path: EMPTY_RESULTS }];
  for (const route of cells) {
    test(`axe rest: ${route.name}`, async ({ page }, info) => {
      test.skip(!onAxeProject(info), SKIP_REASON);
      await open(page, route.path);
      await expectAxeClean(page, info, `${route.name}-rest`);
    });
  }
});

// ---------------------------------------------------------------------------
// 1. axe — interactive states
// ---------------------------------------------------------------------------

test.describe("axe: states", () => {
  for (const route of RESULTS_ROUTES) {
    test(`axe state: filter sheet open on ${route.name}`, async ({ page }, info) => {
      test.skip(!onAxeProject(info), SKIP_REASON);
      test.skip(!usesSheet(info), "the sheet exists below md: 1100 only (D46)");
      await open(page, route.path);
      await reachableFilters(page, info);
      await expectAxeClean(page, info, `${route.name}-sheet-open`);
    });

    test(`axe state: Change vehicle open on ${route.name}`, async ({ page }, info) => {
      test.skip(!onAxeProject(info), SKIP_REASON);
      await open(page, `${route.path}?${VEHICLE}`);
      const summary = page.locator('summary[data-probe="change-vehicle"]');
      await summary.click();
      await expect(page.locator('details:has(> summary[data-probe="change-vehicle"])')).toHaveAttribute(
        "open",
        "",
      );
      await expect(page.locator('[data-probe="finder"]')).toBeVisible();
      await expectAxeClean(page, info, `${route.name}-change-vehicle-open`);
    });
  }

  test("axe state: nav drawer open", async ({ page }, info) => {
    test.skip(!onAxeProject(info), SKIP_REASON);
    test.skip(!usesDrawer(info), "the drawer replaces the header nav below md: 1100 only");
    await open(page, "/");
    await page.getByRole("banner").getByRole("button", { name: "Menu" }).click();
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
    await expectAxeClean(page, info, "home-drawer-open");
  });

  for (const slug of [SLUG.tire, SLUG.accessory] as const) {
    test(`axe state: quote form error (empty submit) on ${slug}`, async ({ page }, info) => {
      test.skip(!onAxeProject(info), SKIP_REASON);
      await open(page, `/products/${slug}`);
      await page.getByRole("button", { name: /Send inquiry/ }).click();
      await expect(quoteAlert(page)).toContainText(/fields? needs? a fix/);
      await expectAxeClean(page, info, `${slug}-quote-error`);
    });
  }

  test("axe state: quote form success", async ({ page }, info) => {
    test.skip(!onAxeProject(info), SKIP_REASON);
    await open(page, `/products/${SLUG.tire}?${VEHICLE}&qty=4`);
    await fillValidQuote(page);
    await page.getByRole("button", { name: /Send inquiry/ }).click();
    await expect(page.getByRole("status")).toBeFocused();
    await expectAxeClean(page, info, "pdp-quote-success");
  });
});

// ---------------------------------------------------------------------------
// 2. Structure — outline, landmarks, names, ids, alt, lang, titles
// ---------------------------------------------------------------------------

interface Structure {
  headings: { level: number; text: string }[];
  duplicateIds: string[];
  orphanRefs: string[];
  imgNoAlt: string[];
  lang: string;
  mainIds: string[];
}

/** DOM facts the accessibility tree is built from. Headings count only when
 *  exposed: rendered (a closed `<dialog>` and `display:none` responsive pairs
 *  are not) and not under `aria-hidden`/`inert`. */
async function readStructure(page: Page): Promise<Structure> {
  return page.evaluate(() => {
    const exposed = (el: Element) =>
      el.checkVisibility({ visibilityProperty: true }) &&
      !el.closest('[aria-hidden="true"], [inert]');
    const headings = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6, [role=heading]")]
      .filter(exposed)
      .map((h) => ({
        level: Number(h.getAttribute("aria-level") ?? h.tagName.slice(1)),
        text: (h.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40),
      }));
    const seen = new Map<string, number>();
    for (const el of document.querySelectorAll("[id]")) seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
    const duplicateIds = [...seen].filter(([, n]) => n > 1).map(([id, n]) => `${id} ×${n}`);
    const orphanRefs: string[] = [];
    for (const el of document.querySelectorAll("label[for]")) {
      const id = el.getAttribute("for")!;
      if (!document.getElementById(id)) orphanRefs.push(`label[for=${id}]`);
    }
    for (const attr of ["aria-describedby", "aria-labelledby", "aria-controls", "aria-errormessage"]) {
      for (const el of document.querySelectorAll(`[${attr}]`)) {
        for (const id of (el.getAttribute(attr) ?? "").split(/\s+/).filter(Boolean)) {
          if (!document.getElementById(id)) orphanRefs.push(`${attr}=${id} on <${el.tagName.toLowerCase()}>`);
        }
      }
    }
    const imgNoAlt = [...document.images].filter((i) => !i.hasAttribute("alt")).map(
      (i) => (i as HTMLImageElement).currentSrc || i.getAttribute("src") || "?",
    );
    const mainIds = [...document.querySelectorAll("main")].filter(exposed).map((m) => m.id);
    return { headings, duplicateIds, orphanRefs, imgNoAlt, lang: document.documentElement.lang, mainIds };
  });
}

/** Controls whose accessible name is empty, read from the accessibility tree
 *  itself (Playwright's aria snapshot computes names per accname). */
function unnamedControls(snapshot: string): string[] {
  const roles = "button|link|textbox|combobox|checkbox|radio|slider|spinbutton|searchbox|switch|listbox";
  const re = new RegExp(`^\\s*- (${roles})(\\s*\\[[^\\]]*\\])?\\s*:?\\s*$`);
  return snapshot.split("\n").filter((l) => re.test(l)).map((l) => l.trim());
}

test.describe("structure", () => {
  for (const route of [...ROUTES, { name: "results-empty", path: EMPTY_RESULTS }]) {
    test(`structure: ${route.name}`, async ({ page }, info) => {
      test.skip(!onAxeProject(info), SKIP_REASON);
      await open(page, route.path);
      const s = await readStructure(page);

      // One h1, first in the outline, no skipped level anywhere after it.
      const h1s = s.headings.filter((h) => h.level === 1);
      expect.soft(h1s.length, `exactly one exposed h1: ${JSON.stringify(h1s)}`).toBe(1);
      expect.soft(s.headings[0]?.level, `outline opens at h1: ${JSON.stringify(s.headings.slice(0, 3))}`).toBe(1);
      const skips = s.headings
        .map((h, i) => ({ h, prev: s.headings[i - 1] }))
        .filter(({ h, prev }) => prev && h.level > prev.level + 1)
        .map(({ h, prev }) => `h${prev!.level} "${prev!.text}" → h${h.level} "${h.text}"`);
      expect.soft(skips, "skipped heading levels").toEqual([]);

      // Landmarks (the accessibility tree, via role queries that exclude hidden).
      expect.soft(s.mainIds, "exactly one exposed <main>, id=main (D57 C1)").toEqual(["main"]);
      await expect.soft(page.getByRole("main")).toHaveCount(1);
      // `/styleguide` is a noindex reference page that renders no site chrome
      // by design (`src/app/(storefront)/llm.md`), so it has no banner/footer.
      const chrome = route.name === "styleguide" ? 0 : 1;
      await expect.soft(page.getByRole("banner")).toHaveCount(chrome);
      await expect.soft(page.getByRole("contentinfo")).toHaveCount(chrome);
      const navs = page.getByRole("navigation");
      const navNames = await navs.evaluateAll((els) =>
        els.map((e) => e.getAttribute("aria-label") ?? e.getAttribute("aria-labelledby") ?? ""),
      );
      if (navNames.length > 1) {
        expect.soft(navNames.filter((n) => !n), `every nav named when >1: ${navNames}`).toEqual([]);
        expect.soft(new Set(navNames).size, `nav names distinct: ${navNames}`).toBe(navNames.length);
      }

      // Names, ids, references, alt, lang.
      const snapshot = await page.locator("body").ariaSnapshot();
      expect.soft(unnamedControls(snapshot), "controls with no accessible name").toEqual([]);
      expect.soft(s.duplicateIds, "duplicate ids (D57 idPrefix)").toEqual([]);
      expect.soft(s.orphanRefs, "label[for]/aria-* pointing at nothing").toEqual([]);
      expect.soft(s.imgNoAlt, "<img> with no alt attribute").toEqual([]);
      expect.soft(s.lang, "<html lang>").toMatch(/^en(-[A-Z]{2})?$/);
    });
  }

  test("structure: page titles are unique and descriptive per route", async ({ page }, info) => {
    test.skip(info.project.name !== "chromium-1440", "DOM-only, engine-independent; once is enough");
    const titles: { name: string; path: string; title: string }[] = [];
    for (const route of ROUTES) {
      await open(page, route.path);
      titles.push({ name: route.name, path: route.path.split("?")[0], title: await page.title() });
    }
    await info.attach("titles.json", { body: JSON.stringify(titles, null, 2), contentType: "application/json" });
    for (const t of titles) {
      expect.soft(t.title.length, `${t.name} has a title`).toBeGreaterThan(0);
      expect.soft(t.title, `${t.name} title is not a framework default`).not.toMatch(/Create Next App/i);
    }
    // Two routes on the same pathname are the same page in another state
    // (`/results` with and without a vehicle), so they may share a title.
    const byTitle = new Map<string, Set<string>>();
    for (const t of titles) byTitle.set(t.title, (byTitle.get(t.title) ?? new Set()).add(t.path));
    const clashes = [...byTitle].filter(([, paths]) => paths.size > 1).map(([title, p]) => `${title}: ${[...p]}`);
    expect.soft(clashes, "distinct pages sharing one <title>").toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. Live regions actually announce
// ---------------------------------------------------------------------------

test.describe("live regions", () => {
  test("results count: polite+atomic, updates on filter change, same node, announces 0 matches", async ({
    page,
  }, info) => {
    test.skip(!onAxeProject(info), SKIP_REASON);
    await open(page, "/results");
    const count = countOf(page);
    await expect(count).toHaveCount(1);
    await expect(count).toHaveAttribute("aria-live", "polite");
    await expect(count).toHaveAttribute("aria-atomic", "true");
    const before = (await count.textContent())?.trim();
    // Tag the node: D72 says the region is never remounted.
    await count.evaluate((el) => ((el as HTMLElement & { __qaTag?: number }).__qaTag = 1));
    const tagged = () =>
      count.evaluate((el) => (el as HTMLElement & { __qaTag?: number }).__qaTag === 1);

    let filters = await reachableFilters(page, info);
    await filters.getByRole("checkbox", { name: /^Zeta/ }).click();
    await expect(page).toHaveURL(/brand=Zeta/);
    await expect(count).not.toHaveText(before ?? "");
    expect(await tagged(), "count node survived a filter change (not remounted)").toBe(true);

    // `summer` has no seed product (`categories.ts`), so it empties the set.
    filters = usesSheet(info) ? page.getByRole("dialog", { name: "Filters" }) : filters;
    // The chip's input is `sr-only`; the visitor clicks its label (chip.tsx).
    await filters.locator("label").filter({ has: page.getByRole("checkbox", { name: "Summer" }) }).click();
    await expect(page).toHaveURL(/season=summer/);
    await expect(count).toHaveText(/^0 matches$/);
    expect(await tagged(), "count node survived the transition to zero results").toBe(true);
    await expect(count).toHaveAttribute("aria-live", "polite");
  });

  test("quote form: role=alert summary is populated on an invalid submit", async ({ page }, info) => {
    test.skip(!onAxeProject(info), SKIP_REASON);
    await open(page, `/products/${SLUG.tire}`);
    await expect(quoteAlert(page)).toHaveCount(0);
    const email = page.getByRole("textbox", { name: "Email", exact: true });
    const name = page.getByRole("textbox", { name: "Full name" });
    await email.fill("not-an-email");
    await page.getByRole("button", { name: /Send inquiry/ }).click();
    const alert = quoteAlert(page);
    await expect(alert).toHaveText(/^3 fields need a fix/);
    await expect(name).toBeFocused();
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(name).toHaveAccessibleDescription("Enter your name.");
    await expect(email).toHaveAccessibleDescription("Enter an email like name@example.com.");
  });

  test.fixme("results count announces when Load more reveals cards", async () => {
    // Known open, not new: `?show=all` does not change the count, so nothing is
    // announced and focus drops to <body> (D68; src/features/results/llm.md Open #7).
  });
});

// ---------------------------------------------------------------------------
// 4. WCAG 2.2 target size (2.5.8, 24×24 minimum or the spacing exception)
// ---------------------------------------------------------------------------

interface TargetReport {
  what: string;
  box: string;
  hit: string;
  verdict: "ok" | "spacing" | "inline" | "fail" | "occluded";
}

/** Measures every exposed interactive target's HIT AREA, not its box: a probe
 *  walks outward from the centre with `elementFromPoint`, so `tap-extend`
 *  pseudo-elements count and anything stacked on top (D86) does not. */
async function measureTargets(page: Page): Promise<TargetReport[]> {
  return page.evaluate(() => {
    const MIN = 24;
    const sel =
      'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [tabindex]:not([tabindex="-1"])';
    const targets = new Set<HTMLElement>();
    // With a modal open everything outside it is inert: only its targets count.
    const modal = document.querySelector<HTMLDialogElement>("dialog:modal");
    for (const raw of (modal ?? document).querySelectorAll<HTMLElement>(sel)) {
      if (raw.closest('[aria-hidden="true"], [inert]')) continue;
      if (!raw.checkVisibility({ visibilityProperty: true })) continue;
      // A control wrapped in its label: the label is the target.
      const el = (raw.matches("input") && raw.closest("label")) || raw;
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) continue; // sr-only (skip link at rest)
      targets.add(el as HTMLElement);
    }
    const describe = (el: Element) => {
      const name = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 30);
      const id = el.id ? `#${el.id}` : "";
      const probe = el.getAttribute("data-probe") ? `[data-probe=${el.getAttribute("data-probe")}]` : "";
      return `<${el.tagName.toLowerCase()}${id}${probe}> "${name}"`;
    };
    const out: (TargetReport & { el: HTMLElement; cx: number; cy: number })[] = [];
    for (const el of targets) {
      // `inline: "center"` so a card deep in a scroll-snap carousel lands whole.
      el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
      const r = el.getBoundingClientRect();
      // Parked off-canvas until focused (the skip link): not a target at rest.
      if (r.bottom <= 0 || r.right <= 0 || r.top >= innerHeight || r.left >= innerWidth) continue;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const owns = (x: number, y: number) => {
        const hit = document.elementFromPoint(x, y);
        return !!hit && (el === hit || el.contains(hit));
      };
      const reach = (dx: number, dy: number) => {
        let d = 0;
        while (d < MIN && owns(cx + dx * (d + 1), cy + dy * (d + 1))) d++;
        return d;
      };
      const base = {
        el,
        cx,
        cy,
        what: describe(el),
        box: `${Math.round(r.width)}×${Math.round(r.height)}`,
      };
      const top = document.elementFromPoint(cx, cy);
      // Centre still off-screen (a snap carousel refused to centre it): not
      // measurable by hit-testing here, and not evidence of occlusion.
      if (!top && (cx < 0 || cy < 0 || cx >= innerWidth || cy >= innerHeight)) continue;
      if (!owns(cx, cy)) {
        out.push({ ...base, hit: `centre hits ${top ? describe(top) : "nothing"}`, verdict: "occluded" });
        continue;
      }
      const w = 1 + reach(-1, 0) + reach(1, 0);
      const h = 1 + reach(0, -1) + reach(0, 1);
      out.push({ ...base, hit: `${w}×${h}`, verdict: w >= MIN && h >= MIN ? "ok" : "fail" });
    }
    // WCAG 2.5.8 exceptions for the undersized ones. Geometry is in document
    // coordinates so the per-target scrolls above do not matter.
    const doc = new Map<HTMLElement, { x: number; y: number; r: DOMRect }>();
    for (const o of out) {
      const r = o.el.getBoundingClientRect();
      doc.set(o.el, { x: r.left + scrollX + r.width / 2, y: r.top + scrollY + r.height / 2, r });
    }
    const undersized = out.filter((o) => o.verdict === "fail");
    for (const o of undersized) {
      // Inline: a link inside a sentence whose line height constrains it.
      const block = o.el.closest("p, li, dd, td");
      if (
        o.el.matches("a") &&
        block &&
        (block.textContent ?? "").trim().length > (o.el.textContent ?? "").trim().length + 10
      ) {
        o.verdict = "inline";
        continue;
      }
      // Spacing: a 24px circle on its centre touches no other target and no
      // other undersized target's circle.
      const me = doc.get(o.el)!;
      const clear = out.every((other) => {
        if (other.el === o.el || other.el.contains(o.el) || o.el.contains(other.el)) return true;
        const them = doc.get(other.el)!;
        const left = them.r.left + scrollX, top = them.r.top + scrollY;
        const nx = Math.max(left, Math.min(me.x, left + them.r.width));
        const ny = Math.max(top, Math.min(me.y, top + them.r.height));
        if (Math.hypot(me.x - nx, me.y - ny) < MIN / 2) return false;
        if (other.verdict === "fail" && Math.hypot(me.x - them.x, me.y - them.y) < MIN) return false;
        return true;
      });
      if (clear) o.verdict = "spacing";
    }
    scrollTo(0, 0);
    return out.map(({ what, box, hit, verdict }) => ({ what, box, hit, verdict }));
  });
}

test.describe("target size (2.5.8)", () => {
  const TARGET_PROJECTS = ["chromium-1440", "iphone-se", "pixel-7", "floor-320", "webkit-1440"];
  const cells = [
    ...ROUTES.map((r) => ({ ...r, sheet: false })),
    ...RESULTS_ROUTES.map((r) => ({ name: `${r.name}-sheet-open`, path: r.path, sheet: true })),
  ];
  for (const cell of cells) {
    test(`target size ≥24px: ${cell.name}`, async ({ page }, info) => {
      test.skip(!TARGET_PROJECTS.includes(info.project.name), SKIP_REASON);
      test.skip(cell.sheet && !usesSheet(info), "the sheet exists below md: 1100 only (D46)");
      await open(page, cell.path);
      if (cell.sheet) await reachableFilters(page, info);
      const report = await measureTargets(page);
      await info.attach(`targets-${cell.name}.json`, {
        body: JSON.stringify(report, null, 2),
        contentType: "application/json",
      });
      const bad = report
        .filter((t) => t.verdict === "fail" || t.verdict === "occluded")
        .filter((t) => !PRICE_RANGE.test(t.what)) // D69, carried by the fixme below
        .map((t) => `${t.verdict}: ${t.what} box ${t.box} hit ${t.hit}`);
      expect.soft(bad, "targets under 24×24 with no 2.5.8 exception").toEqual([]);
    });
  }

  test.fixme("price-range thumbs meet 24×24 (2.5.8)", async () => {
    // Known, not new: the thumbs are 16px on a 20px-tall input, and enlarging
    // the hit area with a border re-breaks the fill alignment D69 fixed —
    // "Not attempted" (root llm.md D69). axe flags #rail-price-min/max at 280×20.
  });
});

// ---------------------------------------------------------------------------
// 5. Focus not obscured (2.4.11) — phone widths, the sticky filter bar
// ---------------------------------------------------------------------------

interface FocusStep {
  key: string;
  what: string;
  rect: [number, number, number, number];
  hiddenBy: string | null;
  partlyBy: string | null;
}

/** After each real key press: is the focused element FULLY covered by a
 *  sticky/fixed box that is not its own ancestor? (Fully = 2.4.11 AA fail;
 *  partly = 2.4.12 AAA, recorded only.) */
async function focusStep(page: Page, key: string): Promise<FocusStep | null> {
  // `<html>` is `scroll-behavior: smooth` (D92b), so the scroll that brings a
  // newly focused element into view glides; judge where it comes to rest, not
  // a frame mid-glide. Resolves once scrollY holds for 3 frames (cap 1.5s).
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let last = window.scrollY;
        let still = 0;
        const t0 = performance.now();
        const tick = () => {
          const y = window.scrollY;
          still = y === last ? still + 1 : 0;
          last = y;
          if (still >= 3 || performance.now() - t0 > 1500) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  return page.evaluate((key) => {
    const a = document.activeElement as HTMLElement | null;
    if (!a || a === document.body) return null;
    const r = a.getBoundingClientRect();
    let hiddenBy: string | null = null;
    let partlyBy: string | null = null;
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      const pos = getComputedStyle(el).position;
      if (pos !== "sticky" && pos !== "fixed") continue;
      // `opacityProperty`: the idle NavProgress overlay (D92b addendum) is a
      // full-viewport fixed box at opacity 0 — it paints nothing and hides nothing.
      if (el.contains(a) || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      if (el.tagName === "DIALOG" && !(el as HTMLDialogElement).open) continue;
      const s = el.getBoundingClientRect();
      const ix = Math.max(0, Math.min(r.right, s.right) - Math.max(r.left, s.left));
      const iy = Math.max(0, Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top));
      const label = `${el.tagName.toLowerCase()}[data-probe=${el.dataset.probe ?? ""}] ${Math.round(s.top)}–${Math.round(s.bottom)}`;
      // "Fully" allows a sub-2px sliver: a 0.2px strip of a 52px button above
      // a 92%-opaque bar is not a visible focused element (measured on
      // `/results`, where the rounding differs from `/results?vehicle`).
      if (r.width * r.height > 0 && ix * iy >= r.width * (r.height - 2)) hiddenBy = label;
      else if (ix * iy > 0) partlyBy = label;
    }
    const name = (a.getAttribute("aria-label") ?? a.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 30);
    return {
      key,
      what: `<${a.tagName.toLowerCase()}> "${name}"`,
      rect: [r.left, r.top, r.width, r.height].map(Math.round) as [number, number, number, number],
      hiddenBy,
      partlyBy,
    };
  }, key);
}

test.describe("focus not obscured (2.4.11)", () => {
  for (const route of [...RESULTS_ROUTES, { name: "results-vehicle", path: `/results?${VEHICLE}` }]) {
    test(`focus never fully hidden under the sticky bar: ${route.name}`, async ({ page, browserName }, info) => {
      test.skip(!onAxeProject(info), SKIP_REASON);
      test.skip(!isPhone(info) && viewportWidth(info) >= 1100, "the sticky bar exists below md: 1100 only");
      test.setTimeout(120_000);
      // WebKit follows macOS: Tab skips links unless Option is held.
      const tab = browserName === "webkit" ? "Alt+Tab" : "Tab";
      const back = browserName === "webkit" ? "Alt+Shift+Tab" : "Shift+Tab";
      await open(page, route.path);
      const steps: FocusStep[] = [];
      const limit = 90;
      // ~60 stops on these pages at phone width: 90 each way covers the page.
      for (let i = 0; i < limit; i++) {
        await page.keyboard.press(tab);
        const s = await focusStep(page, "Tab");
        if (s) steps.push(s);
      }
      for (let i = 0; i < limit; i++) {
        await page.keyboard.press(back);
        const s = await focusStep(page, "Shift+Tab");
        if (s) steps.push(s);
      }
      await info.attach(`focus-${route.name}.json`, { body: JSON.stringify(steps, null, 2), contentType: "application/json" });
      expect(steps.length, "focus moved at all").toBeGreaterThan(10);
      const hidden = steps.filter((s) => s.hiddenBy).map((s) => `${s.key} → ${s.what} at ${s.rect} under ${s.hiddenBy}`);
      expect.soft(hidden, "focused element fully hidden by a sticky/fixed box").toEqual([]);
    });
  }
});
