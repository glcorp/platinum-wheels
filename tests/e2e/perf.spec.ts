/**
 * PERF — layout stability and interaction latency under a throttled device
 * (D91b). Chromium projects only: CPU and network throttling are CDP.
 *
 * Conditions: `Emulation.setCPUThrottlingRate {rate: 4}` and Lighthouse's
 * Slow 4G (562.5 ms RTT, 1.4 Mbps × 0.9 down, 675 kbps × 0.9 up).
 *
 * Per page type (home, results, pdp, prose):
 *   - CLS from `layout-shift` entries (buffered, `hadRecentInput` excluded as
 *     the metric defines it) over load + a full scroll + the page's
 *     interactions. Gate < 0.05 (`docs/decisions.md` §9), target 0.
 *   - A client navigation (PDP → /tires) must not shift layout: every
 *     shift after the click is counted, input-excluded or not. This was the
 *     `loading.tsx` skeleton → page swap until D91b removed that file.
 *   - Long tasks during the interactions: count and total, reported.
 *   - INP proxy: the longest `event` timing entry (durationThreshold 16) per
 *     interaction; > 200 ms under 4× CPU is a finding.
 *   - Console clean while throttled.
 *   - LCP is measured and REPORTED ONLY — the LCP gate is PARKED (D54,
 *     root llm.md §7.12). It never fails a test here.
 */
import { test, expect, type Page, type CDPSession, type TestInfo } from "@playwright/test";
import { SLUG, VEHICLE, watchProblems, usesSheet } from "../helpers";

const SLOW_4G = {
  offline: false,
  latency: 562.5,
  downloadThroughput: (1.4 * 1024 * 1024 * 0.9) / 8,
  uploadThroughput: (675 * 1024 * 0.9) / 8,
};

const CLS_GATE = 0.05;
const INP_FLAG_MS = 200;

interface PerfLog {
  shifts: { value: number; t: number; hadRecentInput: boolean; sources: string[] }[];
  longtasks: { t: number; d: number }[];
  events: { name: string; t: number; d: number; target: string; interactionId: number }[];
  lcp: { t: number; el: string }[];
}

/** Installed before any document script, so buffered entries are complete. */
function installObservers() {
  const log: PerfLog = { shifts: [], longtasks: [], events: [], lcp: [] };
  (window as unknown as { __perf: PerfLog }).__perf = log;
  const describe = (n: Node | null | undefined) => {
    if (!n || !(n instanceof Element)) return String(n?.nodeName ?? "?");
    const probe = n.getAttribute("data-probe");
    return `${n.tagName.toLowerCase()}${probe ? `[${probe}]` : ""}${n.id ? `#${n.id}` : ""}`;
  };
  const observe = (type: string, cb: (e: PerformanceEntry) => void, extra: Record<string, unknown> = {}) => {
    try {
      new PerformanceObserver((list) => list.getEntries().forEach(cb)).observe({
        type,
        buffered: true,
        ...extra,
      } as PerformanceObserverInit);
    } catch {
      /* entry type unsupported */
    }
  };
  observe("layout-shift", (e) => {
    const s = e as PerformanceEntry & {
      value: number;
      hadRecentInput: boolean;
      sources?: { node?: Node; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[];
    };
    log.shifts.push({
      value: s.value,
      t: s.startTime,
      hadRecentInput: s.hadRecentInput,
      sources: (s.sources ?? []).map(
        (x) =>
          `${describe(x.node)} (${Math.round(x.previousRect.x)},${Math.round(x.previousRect.y)} ${Math.round(x.previousRect.width)}x${Math.round(x.previousRect.height)} → ${Math.round(x.currentRect.x)},${Math.round(x.currentRect.y)} ${Math.round(x.currentRect.width)}x${Math.round(x.currentRect.height)})`,
      ),
    });
  });
  observe("longtask", (e) => log.longtasks.push({ t: e.startTime, d: e.duration }));
  observe(
    "event",
    (e) => {
      const ev = e as PerformanceEntry & { target?: Node | null; interactionId?: number };
      log.events.push({
        name: e.name,
        t: e.startTime,
        d: e.duration,
        target: describe(ev.target),
        interactionId: ev.interactionId ?? 0,
      });
    },
    { durationThreshold: 16 },
  );
  observe("largest-contentful-paint", (e) => {
    const l = e as PerformanceEntry & { element?: Element | null };
    log.lcp.push({ t: e.startTime, el: describe(l.element) });
  });
}

async function throttle(page: Page): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", SLOW_4G);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  return cdp;
}

const perfLog = (page: Page) => page.evaluate(() => (window as unknown as { __perf: PerfLog }).__perf);
const now = (page: Page) => page.evaluate(() => performance.now());

/** Revealed, not merely present: the streamed page lands in `<div hidden>` first. */
async function revealed(page: Page) {
  await page.waitForLoadState("load");
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await expect(page.locator("main#main")).toBeVisible({ timeout: 30_000 });
}

async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));
    const root = document.scrollingElement ?? document.documentElement;
    const step = Math.max(200, Math.floor(innerHeight * 0.8));
    for (let y = 0; y < root.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await frame();
      await frame();
    }
    window.scrollTo(0, 0);
    await frame();
  });
}

/** Wait until the event-timing entry for an interaction started after `t0` has been delivered. */
async function interactionLatency(page: Page, t0: number, label: string, results: Record<string, number>) {
  // Event timing entries are dispatched after the next paint; poll for one.
  await expect
    .poll(async () => (await perfLog(page)).events.filter((e) => e.t >= t0 && e.interactionId > 0).length, {
      message: `an event-timing entry for "${label}"`,
      timeout: 3_000,
    })
    .toBeGreaterThan(0)
    .catch(() => undefined); // < 16 ms interactions produce no entry at all — that is a 0.
  // Only entries that belong to an interaction (pointerdown/up, click, key)
  // count toward INP; a `mouseover` re-dispatched when React swaps the node
  // under a resting pointer is not one.
  const evs = (await perfLog(page)).events.filter((e) => e.t >= t0 && e.interactionId > 0);
  results[label] = evs.length ? Math.max(...evs.map((e) => e.d)) : 0;
}

function report(info: TestInfo, name: string, value: unknown) {
  info.annotations.push({ type: name, description: typeof value === "string" ? value : JSON.stringify(value) });
}

async function menuButton(page: Page) {
  const btn = page.getByRole("button", { name: "Menu", exact: true });
  return (await btn.isVisible()) ? btn : null;
}

async function openAndCloseDrawer(page: Page, results: Record<string, number>) {
  const btn = await menuButton(page);
  if (!btn) return false;
  const t0 = await now(page);
  await btn.click();
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
  await interactionLatency(page, t0, "open drawer", results);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeHidden();
  return true;
}

const PAGES = [
  { kind: "home", path: "/" },
  { kind: "results", path: "/tires" },
  { kind: "pdp", path: `/products/${SLUG.tire}?${VEHICLE}&qty=4` },
  { kind: "prose", path: "/about" },
] as const;

test.describe("perf under 4× CPU + Slow 4G", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== "chromium", "CPU/network throttling and long-task/event timing are Chromium CDP features.");
  });

  for (const pg of PAGES) {
    test(`${pg.kind}: CLS < ${CLS_GATE}, INP proxy ≤ ${INP_FLAG_MS} ms, console clean (LCP reported, parked D54)`, async ({
      page,
    }, info) => {
      test.setTimeout(180_000);
      const watch = watchProblems(page);
      await page.addInitScript(installObservers);
      await throttle(page);

      const t0 = Date.now();
      await page.goto(pg.path, { timeout: 90_000 });
      await revealed(page);
      const loadMs = Date.now() - t0;
      await scrollThrough(page);

      const inp: Record<string, number> = {};
      const interactionsStart = await now(page);

      if (pg.kind === "home") {
        const drawn = await openAndCloseDrawer(page, inp);
        if (!drawn) {
          const next = page.getByRole("button", { name: /next/i }).first();
          const t = await now(page);
          await next.click();
          await interactionLatency(page, t, "carousel next", inp);
        }
      }

      if (pg.kind === "results") {
        if (usesSheet(info)) {
          const t = await now(page);
          await page.getByRole("button", { name: /^Filters/ }).click();
          const sheet = page.getByRole("dialog", { name: "Filters" });
          await expect(sheet).toBeVisible();
          await interactionLatency(page, t, "open sheet", inp);
          const t2 = await now(page);
          await sheet.getByText("Winter", { exact: true }).click();
          await expect(page).toHaveURL(/season=winter/, { timeout: 30_000 });
          await interactionLatency(page, t2, "filter chip (sheet)", inp);
          await page.keyboard.press("Escape");
          await expect(sheet).toBeHidden();
        } else {
          const t = await now(page);
          await page.locator('[data-probe="rail"]').getByText("Winter", { exact: true }).click();
          await expect(page).toHaveURL(/season=winter/, { timeout: 30_000 });
          await interactionLatency(page, t, "filter chip (rail)", inp);
        }
        await revealed(page);
        await openAndCloseDrawer(page, inp);
      }

      if (pg.kind === "pdp") {
        const t = await now(page);
        await page
          .getByRole("group", { name: /how many/i })
          .getByRole("link", { name: "2", exact: true })
          .click();
        await expect(page).toHaveURL(/qty=2/, { timeout: 30_000 });
        await interactionLatency(page, t, "qty cell", inp);
        await openAndCloseDrawer(page, inp);
      }

      if (pg.kind === "prose") {
        await openAndCloseDrawer(page, inp);
      }

      const afterInteractions = await now(page);

      // Client navigation PDP → /tires. D62's loading.tsx skeleton swap is
      // gone (D91b); count every shift after the click, input-excluded or not.
      let swapShift = 0;
      let swapSources: string[] = [];
      if (pg.kind === "pdp") {
        const tNav = await now(page);
        const crumb = page
          .getByRole("navigation", { name: "Breadcrumb" })
          .getByRole("link", { name: "Tires", exact: true })
          .filter({ visible: true });
        await crumb.click();
        await expect(page).toHaveURL(/\/tires/, { timeout: 60_000 });
        await revealed(page);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const swap = (await perfLog(page)).shifts.filter((s) => s.t >= tNav);
        swapShift = swap.reduce((n, s) => n + s.value, 0);
        swapSources = swap.flatMap((s) => s.sources);
      }

      const log = await perfLog(page);
      const counted = log.shifts.filter((s) => !s.hadRecentInput);
      const cls = counted.reduce((n, s) => n + s.value, 0);
      const longDuring = log.longtasks.filter((l) => l.t >= interactionsStart && l.t <= afterInteractions);
      const lcp = log.lcp.at(-1);

      report(info, "load (wall, throttled)", `${loadMs} ms`);
      report(info, "CLS", {
        cls: +cls.toFixed(4),
        entries: counted.length,
        sources: [...new Set(counted.flatMap((s) => s.sources))].slice(0, 8),
        // Each counted shift against the timeline: before or after the
        // interactions began, and the last input before it.
        timeline: counted.map((s) => ({
          t: Math.round(s.t),
          v: +s.value.toFixed(4),
          phase: s.t < interactionsStart ? "load/scroll" : "interactions",
          sinceLastInput: (() => {
            const prior = log.events.filter((e) => e.t <= s.t).at(-1);
            return prior ? `${Math.round(s.t - prior.t)} ms after ${prior.name} on ${prior.target}` : "no prior input";
          })(),
          sources: s.sources,
        })),
      });
      report(info, "crumb navigation shift", { value: +swapShift.toFixed(4), sources: [...new Set(swapSources)].slice(0, 8) });
      report(info, "long tasks during interactions", {
        count: longDuring.length,
        totalMs: Math.round(longDuring.reduce((n, l) => n + l.d, 0)),
        maxMs: Math.round(Math.max(0, ...longDuring.map((l) => l.d))),
      });
      report(info, "INP proxy (max event duration per interaction, ms)", inp);
      report(info, "LCP (PARKED, D54 — reported, never gated)", lcp ? `${Math.round(lcp.t)} ms on ${lcp.el}` : "none");

      // Accepted by the owner (D91b, VPE-8): on /tires the filter commit lands
      // > 500ms after input under Slow 4G, so the kept D92b card-move motion
      // counts as a shift there. Load + scroll is still gated; the interaction
      // phase is reported above and carried by the fixme below.
      const gated =
        pg.kind === "results"
          ? counted.filter((s) => s.t < interactionsStart).reduce((n, s) => n + s.value, 0)
          : cls;
      expect.soft(gated, `CLS over load + scroll${pg.kind === "results" ? "" : " + interactions"} (sources: ${[...new Set(counted.flatMap((s) => s.sources))].join(", ")})`).toBeLessThan(CLS_GATE);
      expect.soft(swapShift, `layout shift across the PDP → /tires crumb navigation (${swapSources.join(", ")})`).toBeLessThan(0.01);
      for (const [label, ms] of Object.entries(inp)) {
        expect.soft(ms, `INP proxy for "${label}" under 4× CPU`).toBeLessThanOrEqual(INP_FLAG_MS);
      }
      watch.expectClean();
    });
  }

  // Accepted, not fixed (owner, D91b / qa.md §3 VPE-8): keep the D92b card-move
  // motion over this gate. CLS is 0 on unthrottled networks.
  test.fixme("results: filter-commit CLS < 0.05 under Slow 4G + 4× CPU (accepted, D91b VPE-8)", async () => {});
});
