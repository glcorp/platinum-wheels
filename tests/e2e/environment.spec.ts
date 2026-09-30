/**
 * Hostile-environment pass (D91b follow-up): what the visitor meets when the
 * network drops, storage is refused, images and fonts fail, the CPU is slow,
 * the phone rotates, the page is zoomed or printed, or a second tab is open.
 *
 * Rules: `tests/llm.md`. Production build only (D88). Every assertion is meant
 * to fail on a genuine defect; what the visitor *sees* is recorded as
 * annotations (`observed`, `measured`) and screenshots, not asserted, when the
 * platform (not this site) decides it.
 *
 * Scenario map (numbers match the QA brief):
 *   1 offline mid-session   2 blocked storage   3 failed images and fonts
 *   4 CPU-throttle races    5 rotation          6 zoom 50% / 400%
 *   7 print                 8 two tabs
 */
import {
  test,
  expect,
  type BrowserContext,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import {
  SLUG,
  VEHICLE,
  engineOf,
  expectNoHorizontalOverflow,
  isPhone,
  settle,
  usesSheet,
  viewportWidth,
  watchProblems, skipQuoteTimer } from "../helpers";

// D104: the quote form drops a submit made within 3 s of render; see helpers.ts.
test.beforeEach(async ({ page }) => {
  await skipQuoteTimer(page);
});

/* --- Fixtures ------------------------------------------------------------- */

const PAGES = [
  { name: "home", path: "/" },
  { name: "results", path: "/results" },
  { name: "pdp", path: `/products/${SLUG.tire}?${VEHICLE}&qty=4` },
  { name: "about", path: "/about" },
] as const;

const PHONE_NUMBER = "+1 (437) 882-5000";

/** Record something the visitor sees or a number we measured. Shown in the
 *  JSON/HTML reports and echoed to stdout. */
function note(type: "observed" | "measured", text: string) {
  test.info().annotations.push({ type, description: text });
  console.log(`[${type}] ${test.info().project.name} :: ${test.info().title} :: ${text}`);
}

async function shot(page: Page, name: string) {
  try {
    const body = await page.screenshot({ timeout: 8_000 });
    await test.info().attach(name, { body, contentType: "image/png" });
  } catch (error) {
    note("observed", `screenshot "${name}" failed: ${String(error).slice(0, 120)}`);
  }
}

/* --- Locators and small flows (patterned on the shipped specs) ------------ */

const drawer = (page: Page) => page.locator("dialog#site-nav-drawer");
const menuButton = (page: Page) =>
  page.getByRole("banner").getByRole("button", { name: "Menu", exact: true });
const sheet = (page: Page) => page.locator('dialog[data-probe="sheet"]');
const filtersTrigger = (page: Page) => page.locator('[data-probe="filters-trigger"]');
const sortSelect = (page: Page) => page.locator('select[aria-label="Sort"]:visible').first();
const countLine = (page: Page) => page.locator('[data-probe="count"]');
const quoteForm = (page: Page) => page.locator('[data-probe="quote-form"]');
const submitButton = (page: Page) => quoteForm(page).getByRole("button", { name: /Send inquiry|Sending/ });
const nameField = (page: Page) => page.locator("#quote-name");
const emailField = (page: Page) => page.locator("#quote-email");
const phoneField = (page: Page) => page.locator("#quote-phone");
const successPanel = (page: Page) => page.locator('[data-probe="quote-success"]');
const errorSummary = (page: Page) => quoteForm(page).getByRole("alert");
const qtyCell = (page: Page, label: string) =>
  page.getByRole("group", { name: "How many?" }).getByRole("link", { name: label, exact: true });

/** React 19 stamps `__reactProps$…` on every host node it hydrated; until then
 *  a click or a selectOption only changes the native control. */
async function hydrated(locator: Locator) {
  await expect
    .poll(
      () =>
        locator
          .first()
          .evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps$"))),
      { timeout: 15_000, message: "element never hydrated" },
    )
    .toBe(true);
}

async function fillValid(page: Page) {
  await nameField(page).fill("Test Person");
  await emailField(page).fill("test.person@example.com");
  await phoneField(page).fill("416-555-0123");
}

async function openDrawer(page: Page) {
  await hydrated(menuButton(page));
  await menuButton(page).click();
  await expect(drawer(page)).toBeVisible();
}

/** Real click on a primary-nav link: header link where the header shows one,
 *  the drawer where it does not. */
async function clickNav(page: Page, name: string) {
  if (await menuButton(page).isVisible()) {
    await openDrawer(page);
    await drawer(page).getByRole("link", { name, exact: true }).click();
  } else {
    await page.getByRole("banner").getByRole("link", { name, exact: true }).click();
  }
}

/** The filter surface for this width: the rail, or the opened sheet. */
async function filterScope(page: Page, info: TestInfo): Promise<Locator> {
  if (!usesSheet(info)) {
    const rail = page.getByRole("complementary", { name: "Filters" });
    await expect(rail).toBeVisible();
    return rail;
  }
  const dialog = sheet(page);
  if (!(await dialog.evaluate((d) => (d as HTMLDialogElement).open))) {
    await hydrated(filtersTrigger(page));
    await filtersTrigger(page).click();
  }
  await expect(dialog).toBeVisible();
  return dialog;
}

async function toggleChip(page: Page, info: TestInfo, name: string) {
  const scope = await filterScope(page, info);
  const box = scope.getByRole("checkbox", { name, exact: true });
  await hydrated(box);
  await box.locator("xpath=ancestor::label[1]").click();
}

const seasonParams = (page: Page) => new URL(page.url()).searchParams.getAll("season");

/* --- Observation helpers --------------------------------------------------- */

type LoaderState = "idle" | "loading" | "done" | "gone" | "hung";

/** `NavProgress` writes `data-state` on `.nav-progress`. `gone` = the document
 *  has no app in it (a browser error page, mid-navigation); `hung` = the page
 *  did not answer a trivial evaluate for 3 s. */
async function loaderState(page: Page): Promise<LoaderState> {
  const answer = page
    .evaluate(
      () =>
        (document.querySelector(".nav-progress")?.getAttribute("data-state") ??
          "gone") as LoaderState,
    )
    .catch(() => "gone" as LoaderState);
  const timeout = new Promise<LoaderState>((resolve) => setTimeout(() => resolve("hung"), 3_000));
  return Promise.race([answer, timeout]);
}

async function appAlive(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => !!document.querySelector("main#main"));
  } catch {
    return false;
  }
}

async function busyCount(page: Page): Promise<number> {
  try {
    return await page.evaluate(() => document.querySelectorAll('[aria-busy="true"]').length);
  } catch {
    return 0;
  }
}

async function describeVisit(page: Page, label: string) {
  const url = page.url();
  let text = "";
  let title = "";
  try {
    title = await page.title();
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(0, 160);
  } catch {
    text = "(document unreadable)";
  }
  note("observed", `${label}: url=${url} title="${title}" text="${text}"`);
  await shot(page, label.replace(/\W+/g, "-"));
}

/* ==========================================================================
   1. Offline mid-session
   ========================================================================== */

/** Wait for the loader to leave `loading` within the 15 s safety plus slack. */
async function expectLoaderReleased(page: Page, label: string) {
  const started = Date.now();
  let last: LoaderState = "loading";
  let failure: unknown;
  try {
    await expect
      .poll(
        async () => {
          last = await loaderState(page);
          return last;
        },
        { timeout: 19_000, intervals: [400, 800, 1_000], message: `${label}: loader still up` },
      )
      .not.toMatch(/^(loading|hung)$/);
  } catch (error) {
    failure = error;
  }
  note("measured", `${label}: loader state "${last}" after ${Date.now() - started}ms`);
  if (failure) throw failure;
}

function attachDialogLog(page: Page) {
  const dialogs: string[] = [];
  page.on("dialog", (d) => {
    dialogs.push(`${d.type()}: ${d.message().slice(0, 60)}`);
    void d.accept();
  });
  return dialogs;
}

/** Two kinds of link: a primary-nav link the router has already prefetched
 *  (`prefetch={true}`, D92b), and a footer link below the fold that no
 *  viewport observer has warmed while the network was up. Going offline first
 *  and only then clicking the footer link is the only way to make the soft
 *  navigation itself fail. */
const NAV_KINDS = [
  { kind: "header", target: /\/wheels$/, path: "/wheels" },
  { kind: "footer", target: /\/terms$/, path: "/terms" },
] as const;

async function clickNavKind(page: Page, kind: "header" | "footer") {
  if (kind === "header") await clickNav(page, "Wheels");
  else await page.getByRole("contentinfo").getByRole("link", { name: "Terms & Conditions", exact: true }).click();
}

for (const nav of NAV_KINDS) {
  for (const p of PAGES) {
    if (nav.kind === "header" && p.name !== "home") continue;
    test(`1 offline: ${nav.kind} nav click on ${p.name} never hangs; back online it works`, async ({
      page,
      context,
    }) => {
      test.setTimeout(100_000);
      const watch = watchProblems(page);
      const dialogs = attachDialogLog(page);
      await page.goto(p.path);
      await settle(page);
      await hydrated(page.locator("main#main"));
      await context.setOffline(true);
      await clickNavKind(page, nav.kind);
      await expectLoaderReleased(page, `offline ${nav.kind} nav`);
      const alive = await appAlive(page);
      const arrived = alive && new URL(page.url()).pathname === nav.path;
      note(
        "observed",
        `page still the app: ${alive}; arrived at ${nav.path} from cache: ${arrived}; dialogs=${JSON.stringify(dialogs)}`,
      );
      await describeVisit(page, `offline-${nav.kind}-nav-${p.name}`);
      expect(watch.problems.pageErrors, "uncaught errors while offline").toEqual([]);
      if (alive) {
        await expect(page.locator("main#main")).toBeVisible();
        expect(
          (await page.locator("main#main").innerText()).trim().length,
          "page stays readable",
        ).toBeGreaterThan(40);
      }

      await context.setOffline(false);
      if (!(await appAlive(page))) await page.reload();
      else if (!arrived) await clickNavKind(page, nav.kind);
      await expect(page).toHaveURL(nav.target);
      await settle(page);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }
}

test("1 offline: a filter chip on /results never hangs; back online it works", async ({
  page,
  context,
  browserName,
}, info) => {
  // ENV-3 (design/reports/qa.md §7.2): in WebKit (desktop and the iPhone/iPad
  // projects) the offline filter transition never settles, so `aria-busy` stays
  // on the form. Not fixed: whether real Safari behaves the same needs a real
  // device, and the fix (a client-side abort) needs an owner ruling.
  test.fixme(browserName === "webkit", "ENV-3: WebKit offline filter leaves aria-busy set (owner ruling pending)");
  test.setTimeout(100_000);
  const watch = watchProblems(page);
  const dialogs = attachDialogLog(page);
  await page.goto("/results");
  await settle(page);
  await hydrated(page.locator("main#main"));
  await filterScope(page, info); // on a phone this opens the sheet (local state)
  await context.setOffline(true);
  await toggleChip(page, info, "Winter");
  await expectLoaderReleased(page, "offline filter");
  // A control must not be left "busy" for ever once the wait is over.
  const alive = await appAlive(page);
  const busy = alive ? await busyCount(page) : 0;
  note("observed", `page still the app: ${alive}; aria-busy left on ${busy}; dialogs=${JSON.stringify(dialogs)}`);
  await describeVisit(page, "offline-filter");
  expect(watch.problems.pageErrors, "uncaught errors while offline").toEqual([]);
  if (alive) {
    expect(busy, "a control left aria-busy after the loader gave up").toBe(0);
    await expect(page.locator("main#main")).toBeVisible();
  }

  await context.setOffline(false);
  if (!(await appAlive(page))) await page.goto("/results");
  await settle(page);
  await hydrated(page.locator("main#main"));
  await toggleChip(page, info, "Summer");
  await expect.poll(() => seasonParams(page).length).toBeGreaterThan(0);
  await expect(countLine(page)).toBeVisible();
});

test("1 offline: a quantity cell on the PDP never hangs; back online it works", async ({
  page,
  context,
}) => {
  test.setTimeout(100_000);
  const watch = watchProblems(page);
  const dialogs = attachDialogLog(page);
  await page.goto(`/products/${SLUG.tire}?${VEHICLE}&qty=4`);
  await settle(page);
  await hydrated(qtyCell(page, "2"));
  await context.setOffline(true);
  await qtyCell(page, "2").click();
  await expectLoaderReleased(page, "offline qty");
  const alive = await appAlive(page);
  note("observed", `page still the app: ${alive}; url=${page.url()}; dialogs=${JSON.stringify(dialogs)}`);
  await describeVisit(page, "offline-qty");
  expect(watch.problems.pageErrors, "uncaught errors while offline").toEqual([]);
  if (alive) await expect(page.locator("main#main")).toBeVisible();

  await context.setOffline(false);
  if (!(await appAlive(page))) await page.reload();
  await settle(page);
  await hydrated(qtyCell(page, "1"));
  await qtyCell(page, "1").click();
  await expect(page).toHaveURL(/qty=1/);
  await expect(qtyCell(page, "1")).toHaveAttribute("aria-current", "true");
});

test("1 offline: a quote submit keeps the visitor's words and never sticks on Sending", async ({
  page,
  context,
}) => {
  test.setTimeout(100_000);
  const watch = watchProblems(page);
  const dialogs = attachDialogLog(page);
  await page.goto(`/products/${SLUG.tire}?${VEHICLE}&qty=4`);
  await settle(page);
  await hydrated(quoteForm(page));
  await fillValid(page);
  await page.locator("#quote-message").fill("Please quote four, need them before the first snow.");
  await context.setOffline(true);
  await submitButton(page).click();
  // Give the action its full chance to fail or hang.
  await expectLoaderReleased(page, "offline submit").catch((e) => note("observed", `loader: ${String(e).slice(0, 100)}`));
  // The button may not be stuck on "Sending…" once the wait is over (a form
  // that is gone is reported below, not here).
  await expect
    .poll(
      async () => {
        if (!(await appAlive(page)) || (await submitButton(page).count()) === 0) return "no-form";
        return (await submitButton(page).innerText()).trim();
      },
      { timeout: 19_000, message: "submit button still says Sending after 19s offline" },
    )
    .not.toMatch(/Sending/);
  const alive = await appAlive(page);
  const state = alive
    ? {
        form: await quoteForm(page).count(),
        name: await nameField(page).inputValue().catch(() => null),
        message: await page.locator("#quote-message").inputValue().catch(() => null),
        alert: await errorSummary(page).innerText().catch(() => ""),
        routeError: await page.getByRole("button", { name: /try again/i }).count(),
        body: (await page.locator("main#main").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 200),
      }
    : null;
  note("observed", `page still the app: ${alive}; state=${JSON.stringify(state)}; dialogs=${JSON.stringify(dialogs)}; pageErrors=${JSON.stringify(watch.problems.pageErrors)}`);
  await describeVisit(page, "offline-submit");
  expect(watch.problems.pageErrors, "uncaught errors on a failed offline submit").toEqual([]);
  expect(alive, "the page was replaced on a failed submit").toBe(true);
  expect(state?.routeError, "a failed submit threw the visitor into the route error boundary").toBe(0);
  expect(state?.form, "the quote form disappeared").toBe(1);
  expect(state?.alert, "the visitor is told the send failed").toContain("couldn't send");
  expect(state?.name, "typed name lost").toBe("Test Person");
  expect(state?.message, "typed message lost").toContain("first snow");

  await context.setOffline(false);
  await submitButton(page).click();
  await expect(successPanel(page)).toBeVisible();
});

/* ==========================================================================
   2. Blocked storage
   ========================================================================== */

async function blockStorage(page: Page) {
  await page.addInitScript(() => {
    for (const key of ["localStorage", "sessionStorage"] as const) {
      Object.defineProperty(window, key, {
        configurable: true,
        get() {
          throw new DOMException("The operation is insecure.", "SecurityError");
        },
      });
    }
  });
}

async function storageThrows(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const key of ["localStorage", "sessionStorage"] as const) {
      try {
        void window[key];
        out.push(`${key}:readable`);
      } catch (e) {
        out.push(`${key}:${(e as DOMException).name}`);
      }
    }
    return out;
  });
}

for (const p of PAGES) {
  test(`2 blocked storage: ${p.name} renders clean`, async ({ page }) => {
    await blockStorage(page);
    const watch = watchProblems(page);
    const res = await page.goto(p.path);
    expect(res?.status()).toBe(200);
    await settle(page);
    await hydrated(page.locator("main#main"));
    expect(await storageThrows(page), "harness: storage must actually throw").toEqual([
      "localStorage:SecurityError",
      "sessionStorage:SecurityError",
    ]);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    watch.expectClean();
  });
}

test("2 blocked storage: every island still works", async ({ page }, info) => {
  test.setTimeout(90_000);
  await blockStorage(page);
  const watch = watchProblems(page);

  // Drawer (phones) on the home page.
  await page.goto("/");
  await settle(page);
  if (await menuButton(page).isVisible()) {
    await openDrawer(page);
    await drawer(page).getByRole("button", { name: "Close menu" }).click();
    await expect(drawer(page)).toBeHidden();
  }

  // Sort and filter on /results.
  await page.goto("/results");
  await settle(page);
  await hydrated(sortSelect(page));
  await sortSelect(page).selectOption("price-asc");
  await expect(page).toHaveURL(/sort=price-asc/);
  await toggleChip(page, info, "Winter");
  await expect.poll(() => seasonParams(page)).toEqual(["winter"]);
  await expect(countLine(page)).toBeVisible();
  if (usesSheet(info)) {
    await sheet(page).getByRole("button", { name: "Close filters" }).click();
    await expect(sheet(page)).toBeHidden();
  }

  // Qty cell and quote submit on the PDP.
  await page.goto(`/products/${SLUG.tire}?${VEHICLE}&qty=4`);
  await settle(page);
  await hydrated(quoteForm(page));
  await qtyCell(page, "2").click();
  await expect(page).toHaveURL(/qty=2/);
  await submitButton(page).click();
  await expect(errorSummary(page)).toBeVisible();
  await fillValid(page);
  await submitButton(page).click();
  await expect(successPanel(page)).toBeVisible();
  watch.expectClean();
});

/* ==========================================================================
   3. Failed images and fonts
   ========================================================================== */

interface Metrics {
  docH: number;
  cards: number[];
  boxes: number[];
  total: number;
}

async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const step = Math.max(300, window.innerHeight - 100);
    const height = () => document.documentElement.scrollHeight;
    for (let y = 0; y < height(); y += step) {
      window.scrollTo({ top: y, behavior: "instant" });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  // Only images the visitor can reach by scrolling down: a lazy image inside a
  // horizontal scroller (the phone carousel) is never fetched until swiped to,
  // so "every image on the page" would wait for something nobody triggered.
  await page.waitForFunction(
    () =>
      [...document.images].every((i) => {
        const r = i.getBoundingClientRect();
        const inColumn = r.right > 0 && r.left < window.innerWidth;
        return i.complete || !inColumn;
      }),
    null,
    { timeout: 15_000 },
  );
}

const measure = (page: Page): Promise<Metrics> =>
  page.evaluate(() => {
    const r1 = (n: number) => Math.round(n * 10) / 10;
    const imgs = [...document.images];
    return {
      docH: document.documentElement.scrollHeight,
      cards: [...document.querySelectorAll("article")].map((a) => r1(a.getBoundingClientRect().height)),
      boxes: imgs.map((i) => r1(i.parentElement?.getBoundingClientRect().height ?? 0)),
      total: imgs.length,
    };
  });

interface BrokenImage {
  src: string;
  alt: string;
  inCard: boolean;
  box: string;
  contained: boolean;
  opacity: number;
  marked: boolean;
}

const brokenImages = (page: Page): Promise<BrokenImage[]> =>
  page.evaluate(() =>
    [...document.images]
      .filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc !== "")
      .map((img) => {
        const r = img.getBoundingClientRect();
        const holder = img.closest("article") ?? img.parentElement;
        const c = holder?.getBoundingClientRect();
        let opacity = 1;
        for (let n: Element | null = img; n; n = n.parentElement) {
          opacity *= Number(getComputedStyle(n).opacity);
        }
        return {
          src: img.currentSrc.slice(-60),
          alt: img.alt,
          inCard: !!img.closest("article"),
          box: `${Math.round(r.width)}x${Math.round(r.height)}`,
          contained:
            !c ||
            (r.left >= c.left - 1 && r.right <= c.right + 1 && r.top >= c.top - 1 && r.bottom <= c.bottom + 1),
          opacity,
          marked: img.hasAttribute("data-loaded"),
        };
      }),
  );

async function baseline(context: BrowserContext, path: string): Promise<Metrics> {
  const base = await context.newPage();
  try {
    await base.goto(path);
    await settle(base);
    await scrollThrough(base);
    return await measure(base);
  } finally {
    await base.close();
  }
}

function imageFailureTest(kind: "404" | "abort") {
  for (const p of PAGES) {
    test(`3 images ${kind}: ${p.name} stays whole and readable`, async ({ page, context }) => {
      test.setTimeout(90_000);
      const good = await baseline(context, p.path);
      await page.route("**/*", (route) => {
        if (route.request().resourceType() !== "image") return route.continue();
        return kind === "404" ? route.fulfill({ status: 404, body: "" }) : route.abort("failed");
      });
      const watch = watchProblems(page);
      await page.goto(p.path);
      await settle(page);
      await scrollThrough(page);
      const bad = await measure(page);
      const broken = await brokenImages(page);
      await shot(page, `images-${kind}-${p.name}`);

      note(
        "measured",
        `${bad.total} img, ${broken.length} broken; docH ${good.docH} -> ${bad.docH}; ` +
          `broken=${JSON.stringify(broken.slice(0, 4))}`,
      );
      // The server never saw a 404 from *us*: those are the injected ones. Only
      // uncaught errors matter.
      expect(watch.problems.pageErrors, "uncaught errors").toEqual([]);
      await expectNoHorizontalOverflow(page);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const fadeStuck = broken.filter((b) => !b.marked || b.opacity === 0);
      expect(fadeStuck, "errored image left at opacity 0 (D92b fade never released)").toEqual([]);
      const escaping = broken.filter((b) => !b.contained);
      expect(escaping, "broken image box / alt text escapes its card").toEqual([]);

      expect(bad.cards.length).toBe(good.cards.length);
      expect(bad.total).toBe(good.total);
      const cardDrift = bad.cards
        .map((h, i) => ({ i, normal: good.cards[i], failed: h }))
        .filter((c) => Math.abs(c.normal - c.failed) > 1.5);
      expect(cardDrift, "card height changed when its image failed").toEqual([]);
      const boxDrift = bad.boxes
        .map((h, i) => ({ i, normal: good.boxes[i], failed: h }))
        .filter((c) => Math.abs(c.normal - c.failed) > 1.5);
      expect(boxDrift, "image box changed height when its image failed").toEqual([]);
      expect(Math.abs(bad.docH - good.docH), "document height drift").toBeLessThanOrEqual(2);
    });
  }
}
imageFailureTest("404");
imageFailureTest("abort");

for (const p of PAGES) {
  test(`3 fonts aborted: ${p.name} stays readable in the fallback face`, async ({ page, context }) => {
    test.setTimeout(90_000);
    const good = await baseline(context, p.path);
    let aborted = 0;
    await page.route("**/*.woff2", (route) => {
      aborted += 1;
      return route.abort("failed");
    });
    const watch = watchProblems(page);
    await page.goto(p.path);
    await settle(page);
    await scrollThrough(page);
    const bad = await measure(page);
    await shot(page, `fonts-${p.name}`);
    const text = await page.evaluate(() => {
      const h1 = document.querySelector("h1");
      const s = h1 ? getComputedStyle(h1) : null;
      const r = h1?.getBoundingClientRect();
      const faces = [...document.fonts].map((f) => `${f.family}:${f.status}`);
      let opacity = 1;
      for (let n: Element | null = h1 ?? null; n; n = n.parentElement) {
        opacity *= Number(getComputedStyle(n).opacity);
      }
      return {
        family: s?.fontFamily.slice(0, 80) ?? "",
        color: s?.color ?? "",
        visibility: s?.visibility ?? "",
        opacity,
        width: Math.round(r?.width ?? 0),
        faces,
        bodyFamily: getComputedStyle(document.body).fontFamily.slice(0, 80),
      };
    });
    note("measured", `woff2 aborted=${aborted}; docH ${good.docH} -> ${bad.docH}; ${JSON.stringify(text)}`);
    expect(aborted, "harness: font requests were made").toBeGreaterThan(0);
    expect(watch.problems.pageErrors).toEqual([]);
    await expectNoHorizontalOverflow(page);
    expect(text.visibility).toBe("visible");
    expect(text.opacity, "h1 effectively invisible while the font is missing").toBeGreaterThan(0.9);
    expect(text.width).toBeGreaterThan(20);
    expect(text.color).not.toMatch(/rgba\(.*, 0\)/);
    // A fallback face is a different width, so exact heights differ; a jump of
    // more than 35% would mean the fallback broke the layout, not just the face.
    expect(bad.docH / good.docH, "fallback face blew up the page height").toBeLessThan(1.35);
  });
}

/* ==========================================================================
   4. CPU throttle races (chromium)
   ========================================================================== */

async function throttle(page: Page, rate: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  return async () => {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 }).catch(() => undefined);
  };
}

test.describe("4 CPU throttle x6 (chromium)", () => {
  test.beforeEach(({}, info) => {
    test.skip(engineOf(info) !== "chromium", "CDP throttling is Chromium-only");
  });

  test("double-clicking Send inquiry posts once", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(`/products/${SLUG.tire}?${VEHICLE}&qty=4`);
    await settle(page);
    await hydrated(quoteForm(page));
    await fillValid(page);
    const posts: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST") posts.push(`${r.url()} action=${r.headers()["next-action"] ?? "-"}`);
    });
    const reset = await throttle(page, 6);
    try {
      await submitButton(page).dblclick();
      await expect(successPanel(page)).toBeVisible({ timeout: 30_000 });
      await page.waitForLoadState("networkidle");
    } finally {
      await reset();
    }
    note("measured", `POST count after dblclick = ${posts.length}: ${JSON.stringify(posts)}`);
    expect(posts.length, "a double click submitted the quote more than once").toBe(1);
  });

  test("rapid sort changes settle on the last choice", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/results");
    await settle(page);
    await hydrated(sortSelect(page));
    const reset = await throttle(page, 6);
    try {
      // One synchronous burst on one element: asc, desc, best, desc.
      await sortSelect(page).evaluate((el) => {
        const select = el as HTMLSelectElement;
        for (const value of ["price-asc", "price-desc", "best", "price-desc"]) {
          select.value = value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
      await expect(page).toHaveURL(/sort=price-desc/, { timeout: 30_000 });
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 30_000 });
      await expect.poll(() => loaderState(page), { timeout: 20_000 }).not.toBe("loading");
    } finally {
      await reset();
    }
    expect(new URL(page.url()).searchParams.get("sort"), "final URL sort").toBe("price-desc");
    await expect(sortSelect(page)).toHaveValue("price-desc");
    const prices = await page
      .locator('[data-probe="best-grid"] > article')
      .allInnerTexts()
      .then((t) => t.map((s) => Number(/\$(\d+)/.exec(s)?.[1] ?? NaN)));
    expect(prices.length).toBeGreaterThan(1);
    expect(
      prices.every((v, i) => i === 0 || prices[i - 1] >= v),
      `grid order disagrees with sort=price-desc: ${prices.join(",")}`,
    ).toBe(true);
  });

  test("a filter, then navigating away before it commits, leaves no stale URL", async ({
    page,
  }, info) => {
    test.setTimeout(90_000);
    await page.goto("/results");
    await settle(page);
    await hydrated(page.locator("main#main"));
    await page.evaluate(() => {
      (window as unknown as { __soft: number }).__soft = 1;
    });
    const watch = watchProblems(page);
    // Open the filter surface first (local state), then race.
    const scope = await filterScope(page, info);
    const box = scope.getByRole("checkbox", { name: "Winter", exact: true });
    await hydrated(box);
    const reset = await throttle(page, 6);
    try {
      await box.locator("xpath=ancestor::label[1]").click();
      if (usesSheet(info)) {
        // Sheet is modal: leave through the drawer link in the same task, the
        // nearest thing to a tap that lands before the commit.
        await page.evaluate(() => {
          (document.querySelector('dialog#site-nav-drawer a[href="/wheels"]') as HTMLElement).click();
        });
      } else {
        await page.getByRole("banner").getByRole("link", { name: "Wheels", exact: true }).click();
      }
      await expect(page).toHaveURL(/\/wheels/, { timeout: 30_000 });
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 30_000 });
      await expect.poll(() => loaderState(page), { timeout: 20_000 }).not.toBe("loading");
      // Time IS the thing under test: a filter's router.replace that lands late
      // would rewrite the URL after the navigation, and only waiting shows it.
      await page.waitForTimeout(2_500);
    } finally {
      await reset();
    }
    const soft = await page.evaluate(() => (window as unknown as { __soft?: number }).__soft);
    note("measured", `final url ${page.url()}; soft navigation kept window marker: ${soft === 1}`);
    expect(new URL(page.url()).pathname, "a late filter commit dragged the visitor back").toBe("/wheels");
    expect(new URL(page.url()).search, "stale filter params leaked into /wheels").toBe("");
    await expect(page.locator('[data-probe="group-finish"]').first()).toBeAttached();
    expect(watch.problems.pageErrors).toEqual([]);
  });

  test("Back during a pending filter commit lands on the previous page and stays", async ({
    page,
  }, info) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await settle(page);
    await hydrated(page.locator("main#main"));
    await clickNav(page, "Tires");
    await expect(page).toHaveURL(/\/results$/);
    await settle(page);
    const watch = watchProblems(page);
    const scope = await filterScope(page, info);
    const box = scope.getByRole("checkbox", { name: "Winter", exact: true });
    await hydrated(box);
    const reset = await throttle(page, 6);
    try {
      await box.locator("xpath=ancestor::label[1]").click();
      await page.goBack();
      await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 30_000 });
      await expect.poll(() => loaderState(page), { timeout: 20_000 }).not.toBe("loading");
      // Time IS the thing under test: see the previous test.
      await page.waitForTimeout(2_500);
    } finally {
      await reset();
    }
    note("measured", `final url ${page.url()}`);
    expect(new URL(page.url()).pathname, "the pending filter commit overrode Back").toBe("/");
    expect(new URL(page.url()).search).toBe("");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator('[data-probe="hero"]')).toBeVisible();
    expect(watch.problems.pageErrors).toEqual([]);
  });
});

/* ==========================================================================
   5. Rotation
   ========================================================================== */

/** Two animation frames: the resize has been laid out and painted. */
const afterLayout = (page: Page) =>
  page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );

async function dialogGeometry(page: Page, dialog: Locator, controls: Locator[]) {
  const vp = page.viewportSize()!;
  const panel = await dialog.evaluate((d) => {
    const r = d.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, open: (d as HTMLDialogElement).open };
  });
  expect(panel.open, "dialog closed itself on rotation").toBe(true);
  expect(panel.left, "dialog left edge").toBeGreaterThanOrEqual(-1);
  expect(panel.top, "dialog top edge").toBeGreaterThanOrEqual(-1);
  expect(panel.right, "dialog right edge").toBeLessThanOrEqual(vp.width + 1);
  expect(panel.bottom, "dialog bottom edge").toBeLessThanOrEqual(vp.height + 1);
  for (const control of controls) {
    await control.scrollIntoViewIfNeeded();
    const box = await control.boundingBox();
    expect(box, "control has a box").not.toBeNull();
    expect(box!.x + box!.width, "control right edge").toBeLessThanOrEqual(vp.width + 1);
    expect(box!.y + box!.height, "control reachable inside viewport").toBeLessThanOrEqual(vp.height + 1);
    expect(box!.y).toBeGreaterThanOrEqual(-1);
    const hit = await control.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!top && (el === top || el.contains(top));
    });
    expect(hit, "control is hit-testable (nothing covers it)").toBe(true);
  }
  await expectNoHorizontalOverflow(page);
}

const focusInside = (dialog: Locator) =>
  dialog.evaluate((d) => d.contains(document.activeElement) && document.activeElement !== d);

test.describe("5 rotation (phones)", () => {
  test.beforeEach(({}, info) => {
    test.skip(!["iphone-se", "pixel-7"].includes(info.project.name), "portrait phones only");
  });

  test("filter sheet open: portrait -> landscape -> portrait", async ({ page }) => {
    test.setTimeout(60_000);
    const portrait = page.viewportSize()!;
    const landscape = { width: portrait.height, height: portrait.width };
    await page.goto("/results");
    await settle(page);
    await hydrated(filtersTrigger(page));
    await filtersTrigger(page).click();
    const dialog = sheet(page);
    await expect(dialog).toBeVisible();
    // Move focus onto a control inside the sheet the way a keyboard user would.
    await dialog.getByRole("button", { name: "Close filters" }).focus();
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    expect(focused).toBe("Close filters");

    for (const [label, size] of [["landscape", landscape], ["portrait", portrait]] as const) {
      await page.setViewportSize(size);
      await afterLayout(page);
      await shot(page, `rotate-sheet-${label}`);
      await dialogGeometry(page, dialog, [
        dialog.getByRole("button", { name: "Close filters" }),
        dialog.getByRole("button", { name: "Apply" }),
      ]);
      expect(await focusInside(dialog), `focus left the sheet after ${label}`).toBe(true);
      expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toBe("Close filters");
    }
    await dialog.getByRole("button", { name: "Close filters" }).click();
    await expect(dialog).toBeHidden();
  });

  test("nav drawer open: portrait -> landscape -> portrait", async ({ page }) => {
    test.setTimeout(60_000);
    const portrait = page.viewportSize()!;
    const landscape = { width: portrait.height, height: portrait.width };
    await page.goto("/");
    await settle(page);
    await openDrawer(page);
    const dialog = drawer(page);
    await dialog.getByRole("button", { name: "Close menu" }).focus();

    for (const [label, size] of [["landscape", landscape], ["portrait", portrait]] as const) {
      await page.setViewportSize(size);
      await afterLayout(page);
      await shot(page, `rotate-drawer-${label}`);
      await dialogGeometry(page, dialog, [
        dialog.getByRole("button", { name: "Close menu" }),
        dialog.getByRole("link", { name: "Accessories", exact: true }),
        dialog.getByRole("link", { name: /^Call \+1/ }),
      ]);
      expect(await focusInside(dialog), `focus left the drawer after ${label}`).toBe(true);
      expect(await page.evaluate(() => getComputedStyle(document.body).overflow), "scroll lock kept").toBe("hidden");
    }
    await dialog.getByRole("button", { name: "Close menu" }).click();
    await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
  });
});

/* ==========================================================================
   6. Zoom
   ========================================================================== */

test.describe("6 zoom (desktop projects)", () => {
  test.beforeEach(({}, info) => {
    test.skip(viewportWidth(info) < 1100 || isPhone(info), "desktop projects only");
  });

  for (const p of PAGES) {
    test(`50% zoom: ${p.name} (CSS zoom .5 in a 2880-wide viewport)`, async ({ page, browserName }) => {
      // ENV-4 (qa.md §7.2): WebKit reports the PDP h1 hidden under CSS zoom .5.
      // CSS `zoom` is not real browser zoom in WebKit, so this may be a harness
      // artefact; unverifiable without real Safari.
      test.fixme(browserName === "webkit" && p.name === "pdp", "ENV-4: WebKit CSS zoom .5 hides the PDP h1 (unverified)");
      test.setTimeout(60_000);
      await page.setViewportSize({ width: 2880, height: 1800 });
      await page.goto(p.path);
      await settle(page);
      await page.addStyleTag({ content: "html{zoom:.5}" });
      await afterLayout(page);
      await shot(page, `zoom50-${p.name}`);
      const metrics = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      note("measured", JSON.stringify(metrics));
      expect(metrics.sw, "document scrollWidth vs clientWidth").toBeLessThanOrEqual(metrics.cw);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("banner").getByRole("link", { name: "Wheels", exact: true })).toBeVisible();
      await hydrated(page.locator("main#main"));
      await page.getByRole("banner").getByRole("link", { name: "Wheels", exact: true }).click();
      await expect(page).toHaveURL(/\/wheels$/);
    });

    test(`400% zoom (320x256): ${p.name} has no overflow and a usable header`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width: 320, height: 256 });
      await page.goto(p.path);
      await settle(page);
      await shot(page, `zoom400-${p.name}`);
      await expectNoHorizontalOverflow(page);
      await expect(menuButton(page)).toBeVisible();
      await openDrawer(page);
      const link = drawer(page).getByRole("link", { name: "Tires", exact: true });
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeInViewport();
      await drawer(page).getByRole("button", { name: "Close menu" }).click();
      await expect(drawer(page)).toBeHidden();
    });
  }
});

/* ==========================================================================
   7. Print (chromium)
   ========================================================================== */

test.describe("7 print (chromium)", () => {
  test.beforeEach(({}, info) => {
    test.skip(engineOf(info) !== "chromium" || isPhone(info), "page.pdf() is Chromium-only");
  });

  for (const p of PAGES) {
    test(`print: ${p.name}`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.goto(p.path);
      await settle(page);
      await hydrated(page.locator("main#main"));
      // US Letter at 96dpi: the width a printed page lays out at.
      await page.setViewportSize({ width: 816, height: 1056 });
      await page.emulateMedia({ media: "print" });
      await afterLayout(page);

      const report = await page.evaluate(
        ({ phone }) => {
          const ctx = document.createElement("canvas").getContext("2d")!;
          const rgba = (css: string): [number, number, number, number] => {
            ctx.clearRect(0, 0, 1, 1);
            ctx.fillStyle = "#000";
            ctx.fillStyle = css;
            ctx.fillRect(0, 0, 1, 1);
            const d = ctx.getImageData(0, 0, 1, 1).data;
            return [d[0], d[1], d[2], d[3] / 255];
          };
          const lum = ([r, g, b]: number[]) => {
            const f = (v: number) => {
              const s = v / 255;
              return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
            };
            return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
          };
          const contrast = (a: number[], b: number[]) => {
            const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
            return (hi + 0.05) / (lo + 0.05);
          };
          const WHITE = [255, 255, 255];
          const vw = window.innerWidth;
          const vh = window.innerHeight;

          const effOpacity = (el: Element) => {
            let o = 1;
            for (let n: Element | null = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
            return o;
          };
          const rendered = (el: Element) => {
            const s = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0 && effOpacity(el) > 0.02;
          };

          // Fixed boxes repeat on every printed page; report the ones painting.
          const fixed: string[] = [];
          const sticky: string[] = [];
          for (const el of document.querySelectorAll<HTMLElement>("body *")) {
            const pos = getComputedStyle(el).position;
            if (pos !== "fixed" && pos !== "sticky") continue;
            if (!rendered(el)) continue;
            const r = el.getBoundingClientRect();
            if (r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh) continue; // parked off-screen
            const label = `${el.tagName.toLowerCase()}.${el.className.toString().slice(0, 40)}${el.dataset.probe ? `[${el.dataset.probe}]` : ""} ${Math.round(r.width)}x${Math.round(r.height)}`;
            (pos === "fixed" ? fixed : sticky).push(label);
          }

          // Text colours against white paper (Chrome drops backgrounds unless
          // "Background graphics" is ticked, which is off by default).
          const textEls = [...document.querySelectorAll<HTMLElement>("main *, footer *, header *")].filter(
            (el) =>
              rendered(el) &&
              [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 1),
          );
          const onWhite = (el: Element) => contrast(rgba(getComputedStyle(el).color), WHITE);
          const light = textEls.filter((el) => onWhite(el) < 3);
          const bodyStyle = getComputedStyle(document.body);
          const h1 = document.querySelector("h1");
          const printBg = rgba(bodyStyle.backgroundColor);

          const visibleText = (needle: RegExp) => {
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            let n: Node | null;
            while ((n = walker.nextNode())) {
              if (needle.test((n.textContent ?? "").replace(/\u2060/g, "")) && n.parentElement && rendered(n.parentElement)) {
                return { found: true, contrastOnWhite: Number(onWhite(n.parentElement).toFixed(2)) };
              }
            }
            return { found: false, contrastOnWhite: 0 };
          };

          return {
            fixed,
            sticky,
            bodyColor: bodyStyle.color,
            bodyBackground: bodyStyle.backgroundColor,
            bodyContrastOnWhite: Number(contrast(rgba(bodyStyle.color), WHITE).toFixed(2)),
            bodyContrastOnItsBackground: Number(contrast(rgba(bodyStyle.color), printBg).toFixed(2)),
            h1Text: h1?.textContent?.trim().slice(0, 60) ?? "",
            h1ContrastOnWhite: h1 ? Number(onWhite(h1).toFixed(2)) : 0,
            textElements: textEls.length,
            lightOnWhite: light.length,
            lightSample: light.slice(0, 4).map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 24)}" ${getComputedStyle(el).color}`),
            price: visibleText(/\$\s?\d/),
            phone: phone ? visibleText(/\(437\)\s*882-5000/) : null,
          };
        },
        { phone: p.name === "pdp" },
      );

      const pdf = await page.pdf({ format: "Letter", printBackground: false });
      const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
      await test.info().attach(`print-${p.name}.pdf`, { body: pdf, contentType: "application/pdf" });
      note("measured", `pdf pages=${pages}; ${JSON.stringify(report)}`);

      expect(report.fixed, "fixed boxes would repeat over every printed page").toEqual([]);
      // A sticky bar prints once, in flow (it is not stuck on paper), but it
      // is still a Filters button and a Sort select on a sheet of paper.
      expect
        .soft(report.sticky, "interactive sticky bar would be printed on paper")
        .toEqual([]);
      expect(report.bodyContrastOnWhite, `body text ${report.bodyColor} on unprinted-background white paper`).toBeGreaterThanOrEqual(4.5);
      expect(report.h1ContrastOnWhite, `h1 "${report.h1Text}" on white paper`).toBeGreaterThanOrEqual(3);
      expect(report.lightOnWhite, `text elements too light for white paper: ${JSON.stringify(report.lightSample)}`).toBe(0);
      if (p.name === "pdp") {
        expect(report.h1Text.length, "PDP shows the product name in print").toBeGreaterThan(3);
        expect(report.price.found, "PDP shows a price in print").toBe(true);
        expect(report.phone?.found, `PDP shows ${PHONE_NUMBER} in print`).toBe(true);
      }
    });
  }
});

/* ==========================================================================
   8. Two tabs
   ========================================================================== */

async function instrumentSharedState(context: BrowserContext) {
  await context.addInitScript(() => {
    const w = window as unknown as { __xtab: { bc: number; storageEvents: number; storageWrites: number } };
    w.__xtab = { bc: 0, storageEvents: 0, storageWrites: 0 };
    const BC = window.BroadcastChannel;
    if (BC) {
      window.BroadcastChannel = class extends BC {
        constructor(name: string) {
          super(name);
          w.__xtab.bc += 1;
        }
      };
    }
    window.addEventListener("storage", () => {
      w.__xtab.storageEvents += 1;
    });
    try {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (...args: [string, string]) {
        w.__xtab.storageWrites += 1;
        return set.apply(this, args);
      };
    } catch {
      /* storage may be unavailable; nothing to count */
    }
  });
}

const sharedState = (page: Page) =>
  page.evaluate(() => (window as unknown as { __xtab: unknown }).__xtab);

test("8 two tabs: filters in one tab do not bleed into the other", async ({ context, page: tabA }, info) => {
  test.setTimeout(90_000);
  await instrumentSharedState(context);
  await tabA.goto("/results");
  await settle(tabA);
  await toggleChip(tabA, info, "Winter");
  await expect.poll(() => seasonParams(tabA)).toEqual(["winter"]);
  await expect(countLine(tabA)).toBeVisible();
  const before = {
    url: tabA.url(),
    count: (await countLine(tabA).innerText()).trim(),
    filters: await filtersTrigger(tabA).innerText(),
  };
  if (usesSheet(info)) {
    await sheet(tabA).getByRole("button", { name: "Close filters" }).click();
  }

  const tabB = await context.newPage();
  const watchB = watchProblems(tabB);
  await tabB.goto("/results");
  await settle(tabB);
  // B must start unfiltered: A's filter is not shared through storage.
  expect(new URL(tabB.url()).search).toBe("");
  await toggleChip(tabB, info, "Summer");
  await expect.poll(() => seasonParams(tabB)).toEqual(["summer"]);
  if (usesSheet(info)) await sheet(tabB).getByRole("button", { name: "Close filters" }).click();
  await sortSelect(tabB).selectOption("price-desc");
  await expect(tabB).toHaveURL(/sort=price-desc/);
  await tabB.goto(`/products/${SLUG.tire}?${VEHICLE}&qty=4`);
  await settle(tabB);
  await hydrated(qtyCell(tabB, "2"));
  await qtyCell(tabB, "2").click();
  await expect(tabB).toHaveURL(/qty=2/);

  // Tab A is exactly as it was left.
  await tabA.bringToFront();
  expect(tabA.url()).toBe(before.url);
  expect((await countLine(tabA).innerText()).trim()).toBe(before.count);
  expect(await filtersTrigger(tabA).innerText()).toBe(before.filters);
  const scopeA = await filterScope(tabA, info);
  await expect(scopeA.getByRole("checkbox", { name: "Winter", exact: true })).toBeChecked();
  await expect(scopeA.getByRole("checkbox", { name: "Summer", exact: true })).not.toBeChecked();
  const shared = { a: await sharedState(tabA), b: await sharedState(tabB) };
  note("measured", `cross-tab channels: ${JSON.stringify(shared)}`);
  expect(shared, "BroadcastChannel / localStorage used to share state between tabs").toEqual({
    a: { bc: 0, storageEvents: 0, storageWrites: 0 },
    b: { bc: 0, storageEvents: 0, storageWrites: 0 },
  });
  expect(watchB.problems.pageErrors).toEqual([]);
});

test("8 two tabs: the quote form's leave guard fires only in the tab with the dirty form", async ({
  context,
  page: tabClean,
}) => {
  test.setTimeout(90_000);
  const path = `/products/${SLUG.tire}?${VEHICLE}&qty=4`;
  await tabClean.goto(path);
  await settle(tabClean);
  await hydrated(quoteForm(tabClean));
  const tabDirty = await context.newPage();
  await tabDirty.goto(path);
  await settle(tabDirty);
  await hydrated(quoteForm(tabDirty));
  await nameField(tabDirty).click();
  await tabDirty.keyboard.type("Half typed");
  // The other tab's form is untouched by the typing.
  await tabClean.bringToFront();
  await expect(nameField(tabClean)).toHaveValue("");

  async function closeAndCapture(page: Page) {
    const seen: string[] = [];
    page.on("dialog", (d) => {
      seen.push(d.type());
      void d.accept();
    });
    const closed = page.waitForEvent("close");
    await page.close({ runBeforeUnload: true });
    await closed;
    return seen;
  }
  expect(await closeAndCapture(tabClean), "clean tab raised a leave prompt").toEqual([]);
  expect(await closeAndCapture(tabDirty), "dirty tab did not raise its leave prompt").toEqual(["beforeunload"]);
});
