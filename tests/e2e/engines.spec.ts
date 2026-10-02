/**
 * ENGINES — platform features whose support differs between Blink, Gecko and
 * WebKit (D91b). Runs on every desktop engine project and the WebKit device
 * projects; the Chromium phone profiles add nothing here that `chromium-*`
 * does not already cover.
 *
 * Each test asserts the user-visible outcome, not the feature flag: a sheet
 * that ends fully on screen, a thumb that paints and moves, a selected chip
 * that fills. Which engine lacks which feature is recorded as an annotation.
 *
 * Dialog tests run at 390×844 on desktop projects (the sheet and drawer only
 * exist below 1100, D46/D31) — the engine is the variable, not the width.
 */
import { test, expect, type Page, type Locator, type TestInfo } from "@playwright/test";
import { SLUG, VEHICLE, watchProblems, settle, usesSheet, isTouch, engineOf } from "../helpers";

const CHROMIUM_DEVICES = ["pixel-7", "floor-320"];
const PHONE = { width: 390, height: 844 };

/** Streamed pages land in `<div hidden>` first; wait for the reveal. */
async function ready(page: Page) {
  await settle(page);
  await expect(page.locator("main#main")).toBeVisible();
}

function note(info: TestInfo, type: string, value: unknown) {
  info.annotations.push({ type, description: typeof value === "string" ? value : JSON.stringify(value) });
}

/** Run a dialog test at phone width unless the project already is one. */
async function atSheetWidth(page: Page, info: TestInfo) {
  if (!usesSheet(info)) await page.setViewportSize(PHONE);
}

async function openSheet(page: Page) {
  await page.getByRole("button", { name: /^Filters/ }).click();
  const sheet = page.getByRole("dialog", { name: "Filters" });
  await expect(sheet).toBeVisible();
  return sheet;
}

/** Wait until the element's box stops moving (a transition has finished or never ran). */
async function settledRect(el: Locator) {
  let last = "";
  await expect
    .poll(
      async () => {
        const r = await el.evaluate((n) => {
          const b = n.getBoundingClientRect();
          return `${b.x.toFixed(1)},${b.y.toFixed(1)},${b.width.toFixed(1)},${b.height.toFixed(1)}|${getComputedStyle(n).opacity}`;
        });
        const same = r === last;
        last = r;
        return same;
      },
      { timeout: 8_000, intervals: [50, 100, 100, 200] },
    )
    .toBe(true);
}

/**
 * Count painted columns inside an element screenshot, in CSS pixels: a column
 * "paints a thumb" when it holds a run of near-`--text` pixels at least
 * `minRun` tall. The 2px fill cannot satisfy that; a 16px thumb does.
 */
async function thumbColumns(page: Page, target: Locator, minRun: number) {
  // The thumbs travel in a box 8px wider than the track on each side (D69),
  // so half of each end thumb lies outside the track: capture 12px beyond it.
  const b = (await target.boundingBox())!;
  const png = await page.screenshot({
    clip: { x: b.x - 12, y: b.y - 2, width: b.width + 24, height: b.height + 4 },
    scale: "css",
    animations: "disabled",
  });
  return page.evaluate(
    async ({ b64, minRun }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
      const tall: boolean[] = [];
      for (let x = 0; x < width; x++) {
        let run = 0;
        let best = 0;
        for (let y = 0; y < height; y++) {
          const i = (y * width + x) * 4;
          const bright = data[i] > 225 && data[i + 1] > 225 && data[i + 2] > 225;
          run = bright ? run + 1 : 0;
          best = Math.max(best, run);
        }
        tall.push(best >= minRun);
      }
      const third = Math.floor(width / 3);
      return {
        width,
        height,
        left: tall.slice(0, third).filter(Boolean).length,
        right: tall.slice(width - third).filter(Boolean).length,
      };
    },
    { b64: png.toString("base64"), minRun },
  );
}

test.describe("engine-sensitive features", () => {
  // Firefox and WebKit share eight CPUs with five other suites; these are
  // condition waits, not sleeps, so a longer budget only costs time on failure.
  test.describe.configure({ timeout: 90_000 });
  test.beforeEach(({}, info) => {
    test.skip(
      CHROMIUM_DEVICES.includes(info.project.name),
      "Chromium phone profiles duplicate chromium-* for engine features; this spec covers desktop engines + WebKit devices.",
    );
  });

  test("range thumbs paint, and keyboard + pointer both move the price", async ({ page }, info) => {
    const watch = watchProblems(page);
    await page.goto("/tires");
    await ready(page);
    const scope = usesSheet(info) ? await openSheet(page) : page.locator('[data-probe="rail"]');
    const track = scope.locator('[data-probe="price-track"]');
    await track.scrollIntoViewIfNeeded();
    const minS = scope.getByRole("slider", { name: "Minimum price" });
    const maxS = scope.getByRole("slider", { name: "Maximum price" });
    await expect(minS).toBeVisible();
    await expect(maxS).toBeVisible();

    // Paint: a 16px square at each end (rest state spans the whole range).
    const cols = await thumbColumns(page, track, 12);
    note(info, "thumb columns (left/right third, css px)", cols);
    expect(cols.left, "min thumb paints (≥14 of its 16 columns carry a ≥12px bright run)").toBeGreaterThanOrEqual(14);
    expect(cols.right, "max thumb paints").toBeGreaterThanOrEqual(14);

    // Keyboard: press on the min thumb (focuses it without moving it), then
    // ArrowRight must raise the value by one step and commit it to the URL.
    const box = (await track.boundingBox())!;
    const midY = box.y + box.height / 2;
    const before = Number(await minS.inputValue());
    await page.mouse.click(box.x + 1, midY);
    const focused = await minS.evaluate((n) => document.activeElement === n);
    note(info, "min slider focused by a press on its thumb", focused);
    if (focused) {
      await page.keyboard.press("ArrowRight");
    } else {
      // WebKit follows the macOS convention and does not focus a form control
      // on press. The subject here is the key handling, not focus-visible, so
      // focus it and send the real key.
      await minS.press("ArrowRight");
    }
    await expect.poll(async () => Number(await minS.inputValue())).toBe(before + 1);
    await expect(page).toHaveURL(new RegExp(`[?&]min=${before + 1}(&|$)`), { timeout: 15_000 });

    // Pointer: drag the max thumb 60px left.
    const scope2 = usesSheet(info) ? page.getByRole("dialog", { name: "Filters" }) : page.locator('[data-probe="rail"]');
    const max2 = scope2.getByRole("slider", { name: "Maximum price" });
    const track2 = scope2.locator('[data-probe="price-track"]');
    await track2.scrollIntoViewIfNeeded();
    const b2 = (await track2.boundingBox())!;
    const maxBefore = Number(await max2.inputValue());
    const y2 = b2.y + b2.height / 2;
    await page.mouse.move(b2.x + b2.width - 1, y2);
    await page.mouse.down();
    await page.mouse.move(b2.x + b2.width - 30, y2, { steps: 4 });
    await page.mouse.move(b2.x + b2.width - 61, y2, { steps: 4 });
    await page.mouse.up();
    await expect.poll(async () => Number(await max2.inputValue())).toBeLessThan(maxBefore);
    await expect(page).toHaveURL(/[?&]max=\d+/, { timeout: 15_000 });
    watch.expectClean();
  });

  test("filter sheet <dialog>: modal, ::backdrop scrim, Esc and backdrop press close it", async ({ page }, info) => {
    const watch = watchProblems(page);
    await atSheetWidth(page, info);
    await page.goto("/tires");
    await ready(page);
    const trigger = page.getByRole("button", { name: /^Filters/ });
    const sheet = await openSheet(page);

    const state = await sheet.evaluate((d) => ({
      open: (d as HTMLDialogElement).open,
      modal: d.matches(":modal"),
      backdrop: getComputedStyle(d, "::backdrop").backgroundColor,
      focusInside: d.contains(document.activeElement),
      bodyOverflow: document.body.style.overflow,
    }));
    note(info, "sheet state", state);
    expect(state.open).toBe(true);
    expect(state.modal, "showModal() — top layer, inert page").toBe(true);
    expect(state.backdrop, "::backdrop is --scrim-mid (D47(3), DEVIATIONS #32)").toBe("rgba(11, 11, 13, 0.68)");
    expect(state.focusInside, "focus moves into the dialog").toBe(true);

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    // Opened by pointer, focus returns to whatever held it before: the trigger
    // in Blink/Gecko, <body> in WebKit, which does not focus a button on press.
    note(info, "focus after Esc (pointer-opened)", await page.evaluate(() => document.activeElement?.tagName));
    expect(await page.evaluate(() => document.activeElement?.closest("dialog") ?? null), "focus left the closed sheet").toBeNull();
    // Opened from the keyboard, every engine must hand focus back to the trigger.
    await trigger.press("Enter");
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(trigger).toBeFocused();

    // Backdrop press: the dialog fills the viewport and the panel sits at the
    // bottom, so a press above the panel lands on the <dialog> itself.
    await openSheet(page);
    // Measure after the entry slide: mid-transition WebKit reports the panel
    // at y −291 (compositor-driven `translate`), which is not where it lands.
    await settledRect(sheet.locator(".sheet-panel").first());
    const panelTop = await sheet.evaluate((d) => d.querySelector(".sheet-panel")!.getBoundingClientRect().top);
    const pressAt = await page.evaluate((top) => ({ x: innerWidth / 2, y: top / 2 }), panelTop);
    const hit = await page.evaluate((p) => document.elementFromPoint(p.x, p.y)?.tagName, pressAt);
    expect(hit, "a press above the panel hits the dialog, not the page").toBe("DIALOG");
    await page.mouse.click(pressAt.x, pressAt.y);
    await expect(sheet).toBeHidden();
    watch.expectClean();
  });

  test("nav drawer <dialog>: opens modal, Esc closes, focus returns to Menu", async ({ page }, info) => {
    const watch = watchProblems(page);
    await atSheetWidth(page, info);
    await page.goto("/");
    await ready(page);
    const menu = page.getByRole("button", { name: "Menu", exact: true });
    await menu.click();
    const drawer = page.getByRole("dialog", { name: "Menu" });
    await expect(drawer).toBeVisible();
    expect(await drawer.evaluate((d) => d.matches(":modal") && d.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    note(info, "focus after Esc (pointer-opened)", await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.tagName));
    await menu.press("Enter");
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(menu, "keyboard-opened drawer returns focus to Menu").toBeFocused();
    watch.expectClean();
  });

  test("@starting-style entry: sheet and drawer always end fully visible (exit snap is known, D67)", async ({
    page,
  }, info) => {
    await atSheetWidth(page, info);
    await page.goto("/tires");
    await ready(page);
    const support = await page.evaluate(() => {
      // No CSS.supports() form exists for an at-rule; probe it: a rule inside
      // @starting-style is only kept in the CSSOM by engines that parse it.
      const s = document.createElement("style");
      s.textContent = "@starting-style { .x { opacity: 0 } }";
      document.head.append(s);
      const ok = (s.sheet?.cssRules.length ?? 0) > 0 && s.sheet!.cssRules[0].constructor.name !== "CSSUnknownRule";
      s.remove();
      return { startingStyle: ok, allowDiscrete: CSS.supports("transition-behavior", "allow-discrete") };
    });
    note(info, "engine support", support);

    const sheet = await openSheet(page);
    const panel = sheet.locator(".sheet-panel").first();
    const early = await panel.evaluate((n) => ({
      top: n.getBoundingClientRect().top,
      translate: getComputedStyle(n).translate,
    }));
    note(info, "sheet panel right after open", early);
    await settledRect(panel);
    const end = await panel.evaluate((n) => {
      const r = n.getBoundingClientRect();
      const cs = getComputedStyle(n);
      return { bottom: r.bottom, vh: innerHeight, opacity: cs.opacity, translate: cs.translate };
    });
    note(info, "sheet panel settled", end);
    expect(Math.abs(end.bottom - end.vh), "panel sits on the bottom edge").toBeLessThanOrEqual(1);
    expect(end.opacity).toBe("1");
    expect(["none", "0px", "0px 0px"]).toContain(end.translate);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();

    const menu = page.getByRole("button", { name: "Menu", exact: true });
    await menu.click();
    const drawer = page.getByRole("dialog", { name: "Menu" });
    await expect(drawer).toBeVisible();
    await settledRect(drawer);
    const d = await drawer.evaluate((n) => ({ opacity: getComputedStyle(n).opacity, top: n.getBoundingClientRect().top }));
    note(info, "drawer settled", d);
    expect(d.opacity, "drawer fade ends at full opacity").toBe("1");
  });

  test(":has() styling: selected chip fills, segmented radio fills, keyboard ring on the label", async ({ page }, info) => {
    note(info, ":has() supported", await page.evaluate(() => CSS.supports("selector(:has(a))")));
    await page.goto("/tires?season=winter");
    await ready(page);
    const scope = usesSheet(info) ? await openSheet(page) : page.locator('[data-probe="rail"]');
    const winter = scope.locator('[data-probe="chip-winter"]');
    await expect(winter).toBeVisible();
    const chip = await winter.evaluate((n) => ({ bg: getComputedStyle(n).backgroundColor, color: getComputedStyle(n).color }));
    expect(chip, "has-checked: selected chip recipe (results.md: #F4F4F5 / #0B0B0D)").toEqual({
      bg: "rgb(244, 244, 245)",
      color: "rgb(11, 11, 13)",
    });

    await page.goto(`/products/${SLUG.tire}?${VEHICLE}&qty=4`);
    await ready(page);
    const group = page.getByRole("group", { name: /preferred contact/i });
    const phone = group.locator("label").filter({ hasText: "Phone" });
    await phone.scrollIntoViewIfNeeded();
    await phone.click();
    await expect(group.getByRole("radio", { name: "Phone" })).toBeChecked();
    const seg = await phone.evaluate((n) => getComputedStyle(n).backgroundColor);
    expect(seg, "has-checked: selected segment fills --text").toBe("rgb(244, 244, 245)");

    // Keyboard ring, by real keyboard only. Start in the Name field (a text
    // input takes focus on press in every engine) and Tab forward to the radio
    // group. WebKit follows macOS: plain Tab skips radios, Option+Tab is the
    // Safari path to them, so that is the key it gets.
    const tabKey = engineOf(info) === "webkit" ? "Alt+Tab" : "Tab";
    await page.locator("#quote-name").click();
    let onRadio = false;
    for (let i = 0; i < 10 && !onRadio; i++) {
      await page.keyboard.press(tabKey);
      onRadio = await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.type === "radio");
    }
    expect(onRadio, `${tabKey} reaches the Preferred contact group`).toBe(true);
    const ringOf = (label: Locator) =>
      label.evaluate((n) => ({
        style: getComputedStyle(n).outlineStyle,
        width: getComputedStyle(n).outlineWidth,
        color: getComputedStyle(n).outlineColor,
      }));
    const RING = { style: "solid", width: "2px", color: "rgb(201, 242, 58)" };
    const landed = await ringOf(phone);
    note(info, "segment focus ring on Tab arrival", landed);
    expect(landed, "has-focus-visible: 2px --accent ring on the label the Tab lands on").toEqual(RING);

    await page.keyboard.press("ArrowRight");
    const email = group.locator("label").filter({ hasText: "Email" });
    await expect(group.getByRole("radio", { name: "Email" })).toBeChecked();
    const moved = await ringOf(email);
    note(info, "segment focus ring after ArrowRight", moved);
    // Known, open: Playwright-WebKit drops the ring on an arrowed radio (qa.md
    // §3 VPE-9); only real Safari can say whether users see it. Carried by the
    // fixme below rather than failing every WebKit project.
    if (engineOf(info) === "webkit") return;
    expect(moved, "the ring follows the arrow key to the newly selected segment").toEqual(RING);
  });

  test.fixme("WebKit: the radio ring follows the arrow key (VPE-9, D91b — needs real Safari)", async () => {});

  test("client navigation works with or without the View Transition API", async ({ page }, info) => {
    const watch = watchProblems(page);
    await page.goto(`/products/${SLUG.tire}`);
    await ready(page);
    note(info, "document.startViewTransition", await page.evaluate(() => "startViewTransition" in document));
    await page
      .getByRole("navigation", { name: "Breadcrumb" })
      .getByRole("link", { name: "Tires", exact: true })
      .filter({ visible: true })
      .click();
    await expect(page).toHaveURL(/\/tires$/);
    await ready(page);
    await expect(page.getByRole("heading", { level: 1, name: "Best matches" })).toBeVisible();
    watch.expectClean();
  });

  test("dvh sizing: sheet panel = 100dvh − 144, desktop rail cap = 100dvh − 96", async ({ page }, info) => {
    note(info, "dvh supported", await page.evaluate(() => CSS.supports("height", "100dvh")));
    await page.goto("/tires");
    await ready(page);
    if (!usesSheet(info)) {
      const rail = await page.locator('[data-probe="rail"]').evaluate((n) => ({
        maxH: getComputedStyle(n).maxHeight,
        vh: innerHeight,
      }));
      note(info, "rail max-height", rail);
      expect(parseFloat(rail.maxH), "filter-rail utility (D68)").toBeCloseTo(rail.vh - 96, 0);
      await page.setViewportSize(PHONE);
    }
    const sheet = await openSheet(page);
    const panel = sheet.locator(".sheet-panel").first();
    await settledRect(panel);
    const h = await panel.evaluate((n) => ({ h: n.getBoundingClientRect().height, vh: innerHeight }));
    note(info, "sheet panel height", h);
    expect(Math.abs(h.h - (h.vh - 144)), "sheet-panel: calc(100dvh - 144px)").toBeLessThanOrEqual(1);
  });

  test("overscroll-behavior: contain on the sheet, its scroller, the drawer and the rail", async ({ page }, info) => {
    note(info, "overscroll-behavior supported", await page.evaluate(() => CSS.supports("overscroll-behavior", "contain")));
    await page.goto("/tires");
    await ready(page);
    if (!usesSheet(info)) {
      expect(await page.locator('[data-probe="rail"]').evaluate((n) => getComputedStyle(n).overscrollBehaviorY)).toBe("contain");
      await page.setViewportSize(PHONE);
    }
    const sheet = await openSheet(page);
    const values = await sheet.evaluate((d) => {
      const panel = d.querySelector(".sheet-panel");
      const scroller = [...d.querySelectorAll<HTMLElement>("*")].find((e) => getComputedStyle(e).overflowY === "auto");
      return {
        panel: panel ? getComputedStyle(panel).overscrollBehaviorY : "missing",
        scroller: scroller ? getComputedStyle(scroller).overscrollBehaviorY : "missing",
      };
    });
    note(info, "sheet", values);
    expect(values).toEqual({ panel: "contain", scroller: "contain" });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    const drawer = page.getByRole("dialog", { name: "Menu" });
    await expect(drawer).toBeVisible();
    const drawerOB = await drawer.evaluate((d) =>
      [d, ...d.querySelectorAll<HTMLElement>("*")].map((e) => getComputedStyle(e).overscrollBehaviorY).includes("contain"),
    );
    expect(drawerOB, "the drawer (or its scroller) contains overscroll (D65)").toBe(true);
  });

  test("hide-scrollbar: both carousels scroll with no scrollbar gutter", async ({ page }, info) => {
    const probe = async (sel: string) =>
      page.locator(sel).evaluate((n) => ({
        gutter: (n as HTMLElement).offsetHeight - (n as HTMLElement).clientHeight - parseFloat(getComputedStyle(n).borderTopWidth) - parseFloat(getComputedStyle(n).borderBottomWidth),
        scrollable: n.scrollWidth > n.clientWidth,
        scrollbarWidth: getComputedStyle(n).getPropertyValue("scrollbar-width") || "(unsupported)",
      }));
    await page.goto("/");
    await ready(page);
    const home = await probe('[data-probe="featured-track"]');
    note(info, "featured track", home);
    expect(home.scrollable, "D74: six cards overflow the row").toBe(true);
    expect(home.gutter, "no horizontal scrollbar gutter").toBe(0);

    await page.setViewportSize(PHONE);
    await page.goto(`/products/${SLUG.tire}`);
    await ready(page);
    const pdp = await probe('[data-probe="similar-track"]');
    note(info, "similar track (390)", pdp);
    expect(pdp.scrollable, "mobile similar row scrolls (D53(5))").toBe(true);
    expect(pdp.gutter).toBe(0);
    if (isTouch(info)) note(info, "touch", "overlay scrollbars on touch devices never take a gutter");
  });
});
