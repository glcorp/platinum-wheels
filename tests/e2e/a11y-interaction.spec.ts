/**
 * Interaction accessibility, WCAG 2.2 AA (D91b, agent KBD). See `tests/llm.md`.
 *
 * Seven concerns, each measured rather than inferred from markup:
 *   1. keyboard walk — order, visible indicator, no traps, nothing hidden takes
 *      focus, focus not obscured by sticky content (2.1.1, 2.1.2, 2.4.3, 2.4.7, 2.4.11)
 *   2. skip link (2.4.1, D57 C1)
 *   3. reflow at 320 CSS px and the 400%-zoom equivalent (1.4.10)
 *   4. text-spacing override (1.4.12)
 *   5. forced colours (Chromium only — the one engine Playwright emulates it in)
 *   6. prefers-reduced-motion (D67: the global kill is claimed to cover everything)
 *   7. contrast of text over photography by PIXEL SAMPLING (the D67 lesson:
 *      a CSS-composited sweep cannot see a photo), plus a CSS-background sweep
 *
 * WebKit on macOS does not Tab to links unless "full keyboard access" is on;
 * Playwright's WebKit follows that default, so `Alt+Tab` (Option+Tab, the
 * Safari shortcut that includes links) is used there. Platform behaviour, not
 * a site defect.
 */
import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { writeFile } from "node:fs/promises";
import sharp from "sharp";

import { ROUTES, engineOf, settle, usesSheet } from "../helpers";

/** Evidence goes to test-results as a file (readable without the HTML report) and is attached. */
async function save(info: TestInfo, name: string, data: unknown) {
  const path = info.outputPath(name);
  await writeFile(path, JSON.stringify(data, null, 2));
  await info.attach(name, { path, contentType: "application/json" });
}

/**
 * `settle` plus network idle: the home page streams its lower sections after
 * `main#main` exists, and a probe run in that gap measured 2 of 14 images.
 */
async function settleFull(page: Page) {
  await settle(page);
  await page.waitForLoadState("networkidle");
}

/* ------------------------------------------------------------------------ */
/* Project predicates                                                        */
/* ------------------------------------------------------------------------ */

/**
 * `helpers.engineOf` reads `use.browserName`, which the Playwright device
 * descriptors do not set (they set `defaultBrowserType`), so it reports
 * "chromium" for the iPhone/iPad projects. Read both here.
 */
const engine = (info: TestInfo) =>
  info.project.use.browserName ?? info.project.use.defaultBrowserType ?? engineOf(info);
const tabKey = (info: TestInfo) => (engine(info) === "webkit" ? "Alt+Tab" : "Tab");
const isDesktopAt = (info: TestInfo, width: number) =>
  new RegExp(`^(chromium|firefox|webkit)-${width}$`).test(info.project.name);
const routePath = (name: (typeof ROUTES)[number]["name"]) =>
  ROUTES.find((r) => r.name === name)!.path;

/* ------------------------------------------------------------------------ */
/* In-page probes. Each is self-contained: Playwright serialises the source. */
/* ------------------------------------------------------------------------ */

interface FocusStop {
  id: string;
  tag: string;
  name: string;
  top: number; // page coordinates
  left: number;
  right: number;
  bottom: number;
  height: number;
  /** Viewport box at focus time, for the pixel fallback. */
  vx: number;
  vy: number;
  vw: number;
  vh: number;
  /** Horizontal scroller the stop lives in, and its box in scroll-content coordinates. */
  scroller: string | null;
  cLeft: number;
  cRight: number;
  inFixed: boolean;
  hidden: string[];
  indicator: string | null;
  ring: string;
  obscured: "none" | "partly" | "entirely";
}

/** Records every element's resting focus-relevant styles, before any Tab. */
function snapshotRest() {
  const w = window as unknown as { __kbdRest: WeakMap<Element, Record<string, string>> };
  w.__kbdRest = new WeakMap();
  const props = [
    "outline-style",
    "outline-width",
    "outline-color",
    "box-shadow",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
    "border-top-width",
    "border-bottom-width",
    "background-color",
    "text-decoration-line",
    "color",
  ];
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    const rec: Record<string, string> = {};
    for (const p of props) rec[p] = cs.getPropertyValue(p);
    w.__kbdRest.set(el, rec);
  }
}

/** Describes document.activeElement: identity, geometry, visibility, indicator. */
function inspectFocus(): FocusStop | null {
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === document.body || el === document.documentElement) return null;
  const w = window as unknown as {
    __kbdRest?: WeakMap<Element, Record<string, string>>;
    __kbdSeq?: number;
  };
  if (!el.dataset.kbdId) {
    w.__kbdSeq = (w.__kbdSeq ?? 0) + 1;
    el.dataset.kbdId = String(w.__kbdSeq);
  }
  const props = [
    "outline-style",
    "outline-width",
    "outline-color",
    "box-shadow",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
    "border-top-width",
    "border-bottom-width",
    "background-color",
    "text-decoration-line",
    "color",
  ];
  const alphaOf = (c: string) => {
    if (!c || c === "transparent") return 0;
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const parts = m[1].split(/[\s,/]+/).filter(Boolean);
      return parts.length >= 4 ? parseFloat(parts[3]) : 1;
    }
    return /\/\s*0(\.0+)?\s*\)$/.test(c) ? 0 : 1;
  };
  const ringOn = (r: Record<string, string>) =>
    r["outline-style"] !== "none" &&
    r["outline-style"] !== "hidden" &&
    parseFloat(r["outline-width"]) > 0 &&
    alphaOf(r["outline-color"]) > 0;
  const read = (e: Element) => {
    const cs = getComputedStyle(e);
    const rec: Record<string, string> = {};
    for (const p of props) rec[p] = cs.getPropertyValue(p);
    return rec;
  };
  const visuallyHidden = (e: Element) => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    return (
      r.width <= 1 ||
      r.height <= 1 ||
      cs.clip === "rect(0px, 0px, 0px, 0px)" ||
      cs.clipPath === "inset(50%)"
    );
  };
  const input = el as HTMLInputElement;
  const proxy: Element | null =
    (input.labels && input.labels[0]) || el.closest("label") || null;
  const target: Element = visuallyHidden(el) ? (proxy ?? el.parentElement ?? el) : el;

  // --- indicator -----------------------------------------------------------
  const candidates = new Set<Element>([el, target]);
  if (proxy) {
    candidates.add(proxy);
    proxy.querySelectorAll("*").forEach((d, i) => i < 12 && candidates.add(d));
  }
  if (el.parentElement) {
    candidates.add(el.parentElement);
    [...el.parentElement.children].slice(0, 8).forEach((s) => candidates.add(s));
  }
  let indicator: string | null = null;
  for (const c of candidates) {
    const r = c.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const now = read(c);
    const rest = w.__kbdRest?.get(c);
    const who = c === el ? "self" : c === proxy ? "label" : c.tagName.toLowerCase();
    if (ringOn(now) && !(rest && ringOn(rest))) {
      indicator = `outline@${who} ${now["outline-width"]} ${now["outline-style"]} ${now["outline-color"]}`;
      break;
    }
    if (!rest) continue;
    if (now["box-shadow"] !== rest["box-shadow"] && now["box-shadow"] !== "none") {
      indicator = `box-shadow@${who}`;
      break;
    }
    const borderKeys = [
      "border-top-color",
      "border-right-color",
      "border-bottom-color",
      "border-left-color",
      "border-top-width",
      "border-bottom-width",
    ];
    const hasBorder =
      parseFloat(now["border-top-width"]) > 0 || parseFloat(now["border-bottom-width"]) > 0;
    if (hasBorder && borderKeys.some((k) => now[k] !== rest[k])) {
      indicator = `border@${who}`;
      break;
    }
    if (now["background-color"] !== rest["background-color"]) {
      indicator = `background@${who}`;
      break;
    }
    if (now["text-decoration-line"] !== rest["text-decoration-line"]) {
      indicator = `underline@${who}`;
      break;
    }
  }
  const selfCs = getComputedStyle(el);
  const ring = `${selfCs.outlineWidth} ${selfCs.outlineStyle} ${selfCs.outlineColor} offset ${selfCs.outlineOffset}`;

  // --- hidden-but-focused ---------------------------------------------------
  const hidden: string[] = [];
  const tr = target.getBoundingClientRect();
  if (tr.width < 1 || tr.height < 1) hidden.push(`zero-size ${tr.width}x${tr.height}`);
  if (selfCs.visibility !== "visible") hidden.push(`visibility:${selfCs.visibility}`);
  let op = 1;
  for (let a: Element | null = target; a; a = a.parentElement) {
    op *= parseFloat(getComputedStyle(a).opacity);
  }
  if (op < 0.05) hidden.push(`opacity ${op.toFixed(2)}`);
  if (el.closest('[aria-hidden="true"]')) hidden.push("inside aria-hidden");
  if (el.closest("[inert]")) hidden.push("inside inert");
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  if (tr.right <= 0 || tr.bottom <= 0 || tr.left >= vw || tr.top >= vh) {
    hidden.push(`outside viewport (${Math.round(tr.left)},${Math.round(tr.top)})`);
  }
  let box = { l: tr.left, t: tr.top, r: tr.right, b: tr.bottom };
  for (let a = target.parentElement; a && a !== document.body; a = a.parentElement) {
    const cs = getComputedStyle(a);
    if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
    const ar = a.getBoundingClientRect();
    box = {
      l: Math.max(box.l, ar.left),
      t: Math.max(box.t, ar.top),
      r: Math.min(box.r, ar.right),
      b: Math.min(box.b, ar.bottom),
    };
    if (box.r - box.l < 1 || box.b - box.t < 1) {
      hidden.push(`clipped away by ${a.tagName.toLowerCase()}.${String(a.className).slice(0, 40)}`);
      break;
    }
  }

  // --- obscured by author fixed/sticky content (2.4.11) ---------------------
  const inFixedChain = (e: Element | null) => {
    for (let a = e; a; a = a.parentElement) {
      const p = getComputedStyle(a).position;
      if (p === "fixed" || p === "sticky") return a;
    }
    return null;
  };
  let total = 0;
  let covered = 0;
  for (const fx of [0.15, 0.5, 0.85]) {
    for (const fy of [0.15, 0.5, 0.85]) {
      const x = tr.left + tr.width * fx;
      const y = tr.top + tr.height * fy;
      if (x < 0 || y < 0 || x >= vw || y >= vh) continue;
      total++;
      const hit = document.elementFromPoint(x, y);
      if (!hit || target.contains(hit) || hit.contains(target) || el.contains(hit)) continue;
      const fixed = inFixedChain(hit);
      if (fixed && !fixed.contains(el)) covered++;
    }
  }
  const obscured =
    total > 0 && covered === total ? "entirely" : covered > total / 2 ? "partly" : "none";

  let scroller: string | null = null;
  let cLeft = tr.left;
  let cRight = tr.right;
  for (let a = target.parentElement; a; a = a.parentElement) {
    const ox = getComputedStyle(a).overflowX;
    if (ox === "auto" || ox === "scroll") {
      if (!(a as HTMLElement).dataset.kbdSc) (a as HTMLElement).dataset.kbdSc = String(Math.random()).slice(2, 8);
      scroller = (a as HTMLElement).dataset.kbdSc!;
      const sr = a.getBoundingClientRect();
      cLeft = tr.left - sr.left + a.scrollLeft;
      cRight = tr.right - sr.left + a.scrollLeft;
      break;
    }
  }

  const name =
    el.getAttribute("aria-label") ||
    (el.innerText || "").trim().replace(/\s+/g, " ").slice(0, 40) ||
    el.querySelector("img")?.getAttribute("alt") ||
    (input.labels && input.labels[0]?.innerText.trim().slice(0, 40)) ||
    el.getAttribute("name") ||
    "";
  return {
    id: el.dataset.kbdId,
    tag: el.tagName.toLowerCase() + (input.type ? `[${input.type}]` : ""),
    name,
    top: tr.top + scrollY,
    left: tr.left + scrollX,
    right: tr.right + scrollX,
    bottom: tr.bottom + scrollY,
    height: tr.height,
    vx: tr.left,
    vy: tr.top,
    vw: tr.width,
    vh: tr.height,
    scroller,
    cLeft,
    cRight,
    inFixed: !!inFixedChain(target),
    hidden,
    indicator,
    ring,
    obscured,
  };
}

interface ClipProblem {
  text: string;
  el: string;
  by: string;
  axis: "x" | "y";
  px: number;
}

/**
 * Text clipped by a non-scrolling overflow ancestor, and text escaping the
 * viewport horizontally. Scrolling ancestors are excluded — content inside
 * them is reachable (carousels are designed to overflow).
 */
function textClipProblems(args: { axes: "x" | "xy"; within?: string; exclude?: string }) {
  const out: ClipProblem[] = [];
  const scope: Element = args.within ? document.querySelector(args.within)! : document.body;
  const vw = document.documentElement.clientWidth;
  const srOnly = (e: Element) => {
    for (let a: Element | null = e; a; a = a.parentElement) {
      const cs = getComputedStyle(a);
      const r = a.getBoundingClientRect();
      if (cs.clip === "rect(0px, 0px, 0px, 0px)" || cs.clipPath === "inset(50%)") return true;
      if (cs.position === "absolute" && r.width <= 1 && r.height <= 1) return true;
      if (cs.visibility === "hidden") return true;
    }
    return false;
  };
  const desc = (e: Element) =>
    `${e.tagName.toLowerCase()}${e.getAttribute("data-probe") ? `[data-probe=${e.getAttribute("data-probe")}]` : ""}.${String(e.className).slice(0, 50)}`;
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  const seen = new Set<Element>();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const txt = (n.textContent ?? "").trim();
    if (!txt) continue;
    const el = n.parentElement;
    if (!el || seen.has(el)) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
    if (!rects.length || srOnly(el)) continue;
    const closed = el.closest("details:not([open])");
    if (closed && !el.closest("summary")) continue;
    if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) continue;
    if (args.exclude && el.closest(args.exclude)) continue;
    for (let a: Element | null = el; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      const scrollX = cs.overflowX === "auto" || cs.overflowX === "scroll";
      const scrollY = cs.overflowY === "auto" || cs.overflowY === "scroll";
      if (scrollX || scrollY) break;
      const clipX = cs.overflowX === "hidden" || cs.overflowX === "clip";
      const clipY = args.axes === "xy" && (cs.overflowY === "hidden" || cs.overflowY === "clip");
      if (!clipX && !clipY) continue;
      const ar = a.getBoundingClientRect();
      let worst = 0;
      let axis: "x" | "y" = "x";
      for (const r of rects) {
        if (clipX) {
          const o = Math.max(ar.left - r.left, r.right - ar.right);
          if (o > worst) {
            worst = o;
            axis = "x";
          }
        }
        if (clipY) {
          const o = Math.max(ar.top - r.top, r.bottom - ar.bottom);
          if (o > worst) {
            worst = o;
            axis = "y";
          }
        }
      }
      if (worst > 1.5) {
        seen.add(el);
        out.push({ text: txt.slice(0, 40), el: desc(el), by: desc(a), axis, px: Math.round(worst * 10) / 10 });
        break;
      }
    }
    if (!seen.has(el)) {
      // Escaping the viewport with no scroller to reach it.
      let inScroller = false;
      for (let a = el.parentElement; a; a = a.parentElement) {
        const ox = getComputedStyle(a).overflowX;
        if (ox === "auto" || ox === "scroll") inScroller = true;
      }
      const o = Math.max(...rects.map((r) => Math.max(-r.left, r.right - vw)));
      if (!inScroller && o > 1.5) {
        seen.add(el);
        out.push({ text: txt.slice(0, 40), el: desc(el), by: "viewport", axis: "x", px: Math.round(o * 10) / 10 });
      }
    }
  }
  const root = document.scrollingElement ?? document.documentElement;
  return { problems: out, docOverflow: root.scrollWidth - root.clientWidth };
}

/** Controls whose boxes overlap a neighbour, and text lines overlapping other text. */
function overlapProblems() {
  const vis = (e: Element) => {
    const r = e.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return false;
    if (r.bottom + scrollY <= 0 || r.right + scrollX <= 0) return false; // parked off-canvas (skip link)
    // A closed <details> keeps boxes for its content in some engines (content-visibility: hidden).
    const d = e.closest("details:not([open])");
    if (d && !e.closest("summary")) return false;
    if (e.checkVisibility && !e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    for (let a: Element | null = e; a; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.visibility === "hidden" || cs.clip === "rect(0px, 0px, 0px, 0px)" || cs.clipPath === "inset(50%)") return false;
      if (parseFloat(cs.opacity) === 0) return false;
    }
    return true;
  };
  const label = (e: Element) =>
    `${e.tagName.toLowerCase()} "${(e.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 30)}"`;
  const ctrls = [
    ...document.querySelectorAll(
      'a[href], button, label, select, input:not([type="hidden"]):not([type="range"]), textarea, summary, [role="button"]',
    ),
  ].filter(vis);
  const controls: string[] = [];
  for (let i = 0; i < ctrls.length; i++) {
    const a = ctrls[i];
    const ra = a.getBoundingClientRect();
    for (let j = i + 1; j < ctrls.length; j++) {
      const b = ctrls[j];
      if (a.contains(b) || b.contains(a)) continue;
      if ((a as HTMLLabelElement).htmlFor && (a as HTMLLabelElement).htmlFor === b.id) continue;
      if ((b as HTMLLabelElement).htmlFor && (b as HTMLLabelElement).htmlFor === a.id) continue;
      const rb = b.getBoundingClientRect();
      const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (w > 2 && h > 2) controls.push(`${label(a)} ∩ ${label(b)} (${Math.round(w)}×${Math.round(h)})`);
    }
  }
  // Text escaping its own control's box.
  const escapes: string[] = [];
  for (const c of ctrls) {
    const cs = getComputedStyle(c);
    if (cs.display === "inline") continue;
    const cr = c.getBoundingClientRect();
    const tw = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
    let worst = 0;
    for (let t = tw.nextNode(); t; t = tw.nextNode()) {
      if (!(t.textContent ?? "").trim() || !t.parentElement || !vis(t.parentElement)) continue; // sr-only
      const range = document.createRange();
      range.selectNodeContents(t);
      for (const r of range.getClientRects()) {
        if (r.width < 1) continue;
        worst = Math.max(worst, cr.left - r.left, r.right - cr.right, cr.top - r.top, r.bottom - cr.bottom);
      }
    }
    if (worst > 2) escapes.push(`${label(c)} text escapes by ${Math.round(worst)}px`);
  }
  // Text-on-text overlap between different text nodes.
  const lines: { r: DOMRect; n: Node; owner: Element }[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!(n.textContent ?? "").trim() || !n.parentElement || !vis(n.parentElement)) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      if (r.width > 1 && r.height > 1) lines.push({ r, n, owner: n.parentElement });
    }
  }
  const text: string[] = [];
  lines.sort((x, y) => x.r.top - y.r.top);
  for (let i = 0; i < lines.length && text.length < 20; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].r.top > lines[i].r.bottom) break;
      if (lines[i].n === lines[j].n) continue;
      const a = lines[i].r;
      const b = lines[j].r;
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      // Content-area boxes of adjacent lines touch by a pixel or two; require a real collision.
      if (w > 3 && h > Math.min(a.height, b.height) * 0.3) {
        text.push(`${label(lines[i].owner)} ∩ ${label(lines[j].owner)} (${Math.round(w)}×${Math.round(h)})`);
      }
    }
  }
  return { controls, escapes, text };
}

/* ------------------------------------------------------------------------ */
/* Keyboard walk driver                                                      */
/* ------------------------------------------------------------------------ */

/**
 * Fallback for rings drawn on a pseudo-element getComputedStyle cannot read
 * (the range thumb's `::-webkit-slider-thumb` outline): count accent-lime
 * pixels in the focused box ±4px. Nothing in a control's rest state is lime
 * except the lime-filled buttons, whose rings the computed-style probe sees.
 */
async function accentPixels(
  page: Page,
  s: FocusStop,
  ink: readonly [number, number, number] = [201, 242, 58],
): Promise<string | null> {
  const vp = page.viewportSize();
  if (!vp) return null;
  const x = Math.max(0, Math.floor(s.vx - 4));
  const y = Math.max(0, Math.floor(s.vy - 4));
  const w = Math.min(vp.width - x, Math.ceil(s.vw + 8));
  const h = Math.min(vp.height - y, Math.ceil(s.vh + 8));
  if (w < 2 || h < 2) return null;
  const buf = await page.screenshot({ clip: { x, y, width: w, height: h }, scale: "css", animations: "disabled" });
  const { data } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  for (let o = 0; o < data.length; o += 3) {
    if (Math.abs(data[o] - ink[0]) + Math.abs(data[o + 1] - ink[1]) + Math.abs(data[o + 2] - ink[2]) < 50) n++;
  }
  return n >= 8 ? `pixels: ${n} px of rgb(${ink.join(",")}) (pseudo-element ring)` : null;
}

/** Lets a focus-triggered transition (the skip link's 150ms slide) finish before measuring. */
const animationsDone = (page: Page) =>
  page.evaluate(() =>
    Promise.race([
      Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
      new Promise((r) => setTimeout(r, 600)),
    ]).then(() => undefined),
  );

async function walk(
  page: Page,
  key: string,
  max: number,
  ringInk?: readonly [number, number, number],
) {
  await page.evaluate(snapshotRest);
  const stops: FocusStop[] = [];
  let end: "body" | "wrap" | "repeat" | "max" = "max";
  let nulls = 0;
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(key);
    await animationsDone(page);
    let s = await page.evaluate(inspectFocus);
    if (s?.hidden.some((h) => h.startsWith("outside viewport") || h.startsWith("opacity"))) {
      // WebKit reveals a focused text field on a later frame, and a below-the-fold
      // section may still be fading in (D92b scroll reveal); give either up to 1s.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            const t0 = performance.now();
            const tick = () => {
              const a = document.activeElement;
              const r = a?.getBoundingClientRect();
              const inView = !!r && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
              let op = 1;
              for (let e: Element | null | undefined = a; e; e = e.parentElement) {
                op *= parseFloat(getComputedStyle(e).opacity);
              }
              if ((inView && op > 0.95) || performance.now() - t0 > 1000) resolve();
              else requestAnimationFrame(tick);
            };
            tick();
          }),
      );
      s = await page.evaluate(inspectFocus);
    }
    if (!s) {
      if (stops.length) {
        end = "body";
        break;
      }
      if (++nulls > 3) break;
      continue;
    }
    if (stops.length && s.id === stops[0].id) {
      end = "wrap";
      break;
    }
    // Firefox leaves activeElement on the last element when Tab moves into browser chrome.
    if (stops.length && s.id === stops[stops.length - 1].id) {
      end = "body";
      break;
    }
    if (stops.some((x) => x.id === s.id)) {
      end = "repeat";
      stops.push(s);
      break;
    }
    if (!s.indicator && !s.hidden.length) s.indicator = await accentPixels(page, s, ringInk);
    stops.push(s);
  }
  return { stops, end };
}

/** Stops whose page y goes backwards by more than one row without moving to a column on the right. */
function backwardsJumps(stops: FocusStop[]) {
  const out: string[] = [];
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    if (a.inFixed || b.inFixed || a.hidden.length || b.hidden.length) continue;
    const row = Math.max(a.height, b.height, 24);
    const newColumn =
      a.scroller && a.scroller === b.scroller ? b.cLeft >= a.cRight - 1 : b.left >= a.right - 1;
    if (b.top < a.top - row && !newColumn) {
      out.push(
        `#${i - 1} ${a.tag} "${a.name}" (y ${Math.round(a.top)}) → #${i} ${b.tag} "${b.name}" (y ${Math.round(b.top)}, x ${Math.round(b.left)} < prev right ${Math.round(a.right)})`,
      );
    }
  }
  return out;
}

const fmt = (s: FocusStop) => `${s.tag} "${s.name}"`;

/* ======================================================================== */
/* 1. Keyboard-only walk                                                     */
/* ======================================================================== */

test.describe("keyboard walk", () => {
  for (const route of ROUTES) {
    test(`keyboard walk: ${route.name}`, async ({ page }, info) => {
      test.skip(
        !isDesktopAt(info, 1440),
        "Tab order is width-independent above md: 1100; one walk per desktop engine at 1440",
      );
      test.setTimeout(120_000);
      await page.goto(route.path);
      await settleFull(page);
      const { stops, end } = await walk(page, tabKey(info), 320);
      await save(info, "stops.json", { end, stops });

      expect(stops.length, "the walk found focus stops").toBeGreaterThan(3);
      expect.soft(stops[0]?.name, "first stop is the skip link").toBe("Skip to content");
      expect
        .soft(end, `walk must leave the document (body) or wrap; "${end}" = trap or unterminated`)
        .toMatch(/^(body|wrap)$/);
      expect
        .soft(
          stops.filter((s) => s.hidden.length).map((s) => `${fmt(s)}: ${s.hidden.join(", ")}`),
          "focus landed on a hidden element",
        )
        .toEqual([]);
      expect
        .soft(
          stops.filter((s) => !s.indicator).map((s) => `${fmt(s)} ring=${s.ring}`),
          "focus stop with no visible indicator (2.4.7)",
        )
        .toEqual([]);
      expect
        .soft(
          stops.filter((s) => s.obscured === "entirely").map(fmt),
          "focused element entirely hidden by fixed/sticky content (2.4.11)",
        )
        .toEqual([]);
      expect.soft(backwardsJumps(stops), "tab order runs backwards (2.4.3)").toEqual([]);
    });
  }
});

/* ======================================================================== */
/* 2. Skip link                                                              */
/* ======================================================================== */

test.describe("skip link", () => {
  for (const name of ["home", "results", "pdp-tire", "about"] as const) {
    test(`skip link: ${name}`, async ({ page }, info) => {
      await page.goto(routePath(name));
      await settleFull(page);
      await page.keyboard.press(tabKey(info));
      const skip = page.getByRole("link", { name: "Skip to content" });
      await expect(skip, "first Tab lands on the skip link").toBeFocused();
      await expect
        .poll(
          () =>
            skip.evaluate((el) => {
              const r = el.getBoundingClientRect();
              return r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.width > 20 && r.height > 20;
            }),
          { message: "skip link is fully inside the viewport once focused" },
        )
        .toBe(true);
      const shown = await skip.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const cs = getComputedStyle(el);
        return { onTop: !!hit && (hit === el || el.contains(hit)), visibility: cs.visibility, opacity: cs.opacity };
      });
      expect(shown, "skip link is painted on top and opaque").toEqual({
        onTop: true,
        visibility: "visible",
        opacity: "1",
      });
      await page.keyboard.press("Enter");
      await expect(page.locator("main#main"), "Enter moves focus into main#main").toBeFocused();
      await page.keyboard.press(tabKey(info));
      const inside = await page.evaluate(() => {
        const main = document.getElementById("main");
        const a = document.activeElement;
        return !!main && !!a && a !== main && main.contains(a);
      });
      expect(inside, "the next Tab continues inside <main>, not back in the header").toBe(true);
    });
  }
});

/* ======================================================================== */
/* 3. Reflow — 320 CSS px and the 400%-zoom equivalent                       */
/* ======================================================================== */

async function reflowPage(
  page: Page,
  browser: Browser,
  baseURL: string | undefined,
  info: TestInfo,
): Promise<{ p: Page; ctx?: BrowserContext; mode: string }> {
  if (info.project.name === "floor-320") return { p: page, mode: "floor-320 (Pixel 7 @ 320×640)" };
  // 1280×1024 at 400% zoom = 320×256 CSS px at deviceScaleFactor 1.
  const ctx = await browser.newContext({
    baseURL,
    viewport: { width: 320, height: 256 },
    deviceScaleFactor: 1,
  });
  return { p: await ctx.newPage(), ctx, mode: "400% zoom of 1280×1024 (320×256 @1x)" };
}

const BRAND_STRIP = '[data-probe="brands"]';

const reflowApplies = (info: TestInfo) =>
  info.project.name === "floor-320" || isDesktopAt(info, 1280);
const REFLOW_SKIP = "reflow runs on floor-320 and, as the 400%-zoom equivalent, on each engine's 1280 project";

test.describe("reflow", () => {
  for (const route of ROUTES) {
    test(`reflow 320: ${route.name}`, async ({ page, browser, baseURL }, info) => {
      test.skip(!reflowApplies(info), REFLOW_SKIP);
      const { p, ctx, mode } = await reflowPage(page, browser, baseURL, info);
      try {
        await p.goto(route.path);
        await settleFull(p);
        // The mobile brand strip is `overflow:hidden` by the artboard — see the fixme below.
        const r = await p.evaluate(textClipProblems, { axes: "x" as const, exclude: BRAND_STRIP });
        await save(info, "reflow.json", { mode, ...r });
        expect.soft(r.docOverflow, `${mode}: document scrolls horizontally`).toBeLessThanOrEqual(0);
        expect.soft(r.problems, `${mode}: text clipped horizontally`).toEqual([]);
      } finally {
        await ctx?.close();
      }
    });
  }

  // Artboard-mandated: home-mobile draws the brand band as `display:flex;gap:28px;
  // overflow:hidden` (design/inventory/home.md:70,306-308; brand-strip.tsx), so
  // below 720 most of the twelve wordmarks are clipped at every phone width, not
  // only at 320. The <ul aria-label="Brands"> still exposes all twelve to AT.
  // Content visible at 1280 and lost at 320 — a 1.4.10 question for the owner.
  test.fixme("reflow 320: every brand wordmark is visible (artboard clips the mobile band — home.md:306-308)", async ({ page }) => {
    await page.goto("/");
    await settleFull(page);
    const r = await page.evaluate(textClipProblems, { axes: "x" as const, within: BRAND_STRIP });
    expect(r.problems).toEqual([]);
  });

  test("reflow 320: nav drawer and filter sheet keep every control reachable", async ({ page, browser, baseURL }, info) => {
    test.skip(!reflowApplies(info), REFLOW_SKIP);
    const { p, ctx, mode } = await reflowPage(page, browser, baseURL, info);
    const key = tabKey(info);
    try {
      for (const [path, trigger, dialogName] of [
        ["/", "Menu", "Menu"],
        ["/tires", "Filters", "Filters"],
      ] as const) {
        await p.goto(path);
        await settleFull(p);
        await p.getByRole("button", { name: trigger, exact: true }).click();
        const dialog = p.getByRole("dialog", { name: dialogName });
        await expect(dialog).toBeVisible();
        await animationsDone(p); // the drawer fades and the sheet slides in (D67)
        const clip = await p.evaluate(textClipProblems, { axes: "xy" as const, within: "dialog[open]" });
        expect.soft(clip.problems, `${mode} ${path}: text clipped inside the ${dialogName} dialog`).toEqual([]);
        // Every control in the dialog can be reached and is scrolled into view when focused.
        const unreachable: string[] = [];
        const seen = new Set<string>();
        for (let i = 0; i < 60; i++) {
          await p.keyboard.press(key);
          await animationsDone(p);
          const s = await p.evaluate(inspectFocus);
          if (!s || seen.has(s.id)) break;
          seen.add(s.id);
          if (s.hidden.length) unreachable.push(`${fmt(s)}: ${s.hidden.join(", ")}`);
        }
        expect.soft(seen.size, `${path}: dialog has focus stops`).toBeGreaterThan(1);
        expect.soft(unreachable, `${mode} ${path}: focused control not visible in the ${dialogName} dialog`).toEqual([]);
        await p.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
      }
    } finally {
      await ctx?.close();
    }
  });
});

/* ======================================================================== */
/* 4. Text-spacing override (1.4.12)                                         */
/* ======================================================================== */

const TEXT_SPACING = `* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; }
p { margin-bottom: 2em !important; }`;

test.describe("text spacing", () => {
  for (const route of ROUTES) {
    test(`text spacing 1.4.12: ${route.name}`, async ({ page }, info) => {
      test.skip(
        /^(chromium|firefox|webkit)-(1280|1920)$/.test(info.project.name),
        "desktop covered at 1440 per engine; 1280/1920 add no new line breaks worth the time",
      );
      // `/styleguide` §2 renders the display steps as fixed-size specimens
      // (120/88/56px) on purpose; it is an internal, noindex reference page, and
      // at 320 a specimen word under +.12em tracking cannot fit by construction.
      test.skip(
        route.name === "styleguide" && (info.project.use.viewport?.width ?? 1280) <= 320,
        "styleguide type specimens are fixed-size by design (internal, noindex; qa.md §4)",
      );
      await page.goto(route.path);
      await settleFull(page);
      await page.addStyleTag({ content: TEXT_SPACING });
      await page.evaluate(
        () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
      );
      const clip = await page.evaluate(textClipProblems, { axes: "xy" as const, exclude: BRAND_STRIP });
      const overlap = await page.evaluate(overlapProblems);
      await save(info, "text-spacing.json", { clip, overlap });
      expect.soft(clip.problems, "text clipped under the 1.4.12 override").toEqual([]);
      expect.soft(clip.docOverflow, "document overflows horizontally under the override").toBeLessThanOrEqual(0);
      expect.soft(overlap.escapes, "control text escapes its control").toEqual([]);
      expect.soft(overlap.controls, "controls overlap a neighbour").toEqual([]);
      expect.soft(overlap.text, "text overlaps other text").toEqual([]);
    });
  }
});

/* ======================================================================== */
/* 5. Forced colours (Chromium)                                              */
/* ======================================================================== */

/** `below` extends the capture past the box's bottom edge — the nav's current
 *  underline is its own `nav-indicator` span at `bottom: -2px` (D92b, #76), so
 *  it paints just outside the link's box. */
async function boxPixels(page: Page, loc: Locator, below = 0) {
  await loc.scrollIntoViewIfNeeded();
  const box = below ? await loc.boundingBox() : null;
  const buf = box
    ? await page.screenshot({
        animations: "disabled",
        scale: "css",
        clip: { x: box.x, y: box.y, width: box.width, height: box.height + below },
      })
    : await loc.screenshot({ animations: "disabled", scale: "css" });
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const at = (x: number, y: number) => {
    const xi = Math.max(0, Math.min(info.width - 1, Math.round(x)));
    const yi = Math.max(0, Math.min(info.height - 1, Math.round(y)));
    const o = (yi * info.width + xi) * 3;
    return [data[o], data[o + 1], data[o + 2]] as const;
  };
  return { w: info.width, h: info.height, at, data };
}

const dist = (a: readonly number[], b: readonly number[]) =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

/** Two controls in different states: do fill, top edge or bottom edge pixels differ? */
async function statesDiffer(page: Page, on: Locator, off: Locator, below = 0) {
  const a = await boxPixels(page, on, below);
  const b = await boxPixels(page, off, below);
  const probes = {
    fill: [a.at(4, 4), b.at(4, 4)],
    top: [a.at(a.w / 2, 0), b.at(b.w / 2, 0)],
    bottom: [a.at(a.w / 2, a.h - 1), b.at(b.w / 2, b.h - 1)],
    bottom2: [a.at(a.w / 2, a.h - 2), b.at(b.w / 2, b.h - 2)],
    left: [a.at(0, a.h / 2), b.at(0, b.h / 2)],
  };
  const differs = Object.values(probes).some(([x, y]) => dist(x, y) > 60);
  return { differs, probes: JSON.stringify(probes) };
}

test.describe("forced colours", () => {
  test("forced colours: focus indicator survives on every stop", async ({ page }, info) => {
    test.skip(info.project.name !== "chromium-1440", "forced-colors emulation is Chromium-only; one width suffices");
    test.setTimeout(120_000);
    await page.emulateMedia({ forcedColors: "active" });
    for (const name of ["home", "results", "pdp-tire"] as const) {
      await page.goto(routePath(name));
      await settleFull(page);
      // In forced colours the thumb ring (a pseudo-element) paints CanvasText.
      const canvasText = await page.evaluate(() => {
        const d = document.createElement("div");
        d.style.color = "CanvasText";
        document.body.append(d);
        const c = getComputedStyle(d).color.match(/\d+/g)!.slice(0, 3).map(Number);
        d.remove();
        return c as [number, number, number];
      });
      const { stops } = await walk(page, "Tab", 90, canvasText);
      await page.screenshot({ path: info.outputPath(`forced-colors-${name}.png`) });
      await save(info, `forced-${name}.json`, stops);
      expect
        .soft(
          stops.filter((s) => !s.indicator || !/^(outline|pixels)/.test(s.indicator)).map((s) => `${fmt(s)} → ${s.indicator} ring=${s.ring}`),
          `${name}: focus indicator in forced colours must be a real outline`,
        )
        .toEqual([]);
    }
  });

  test("forced colours: control boundaries, check glyph and selected states", async ({ page }, info) => {
    test.skip(info.project.name !== "chromium-1440", "forced-colors emulation is Chromium-only; one width suffices");
    await page.emulateMedia({ forcedColors: "active" });
    await page.goto("/tires?season=winter&brand=Zeta");
    await settleFull(page);
    await page.screenshot({ path: info.outputPath("forced-colors-results-selected.png"), fullPage: true });

    // Boundaries of form controls (1.4.11 in forced colours: a borderless control vanishes).
    const noBoundary = await page.evaluate(() => {
      const alpha = (c: string) => (c === "transparent" || /rgba\(.*,\s*0\)$/.test(c) ? 0 : 1);
      const out: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>(
        'input:not([type="hidden"]):not([type="range"]), select, textarea',
      )) {
        const r = el.getBoundingClientRect();
        if (r.width <= 1 || r.height <= 1) continue; // sr-only inputs are judged by their label
        const cs = getComputedStyle(el);
        const sides = ["top", "right", "bottom", "left"].filter(
          (s) =>
            parseFloat(cs.getPropertyValue(`border-${s}-width`)) > 0 &&
            cs.getPropertyValue(`border-${s}-style`) !== "none" &&
            alpha(cs.getPropertyValue(`border-${s}-color`)) > 0,
        );
        if (sides.length < 2 && cs.appearance === "none") {
          out.push(`${el.tagName.toLowerCase()}#${el.id} borders=${sides.join(",") || "none"}`);
        }
      }
      return out;
    });
    expect.soft(noBoundary, "form controls with no visible boundary in forced colours").toEqual([]);

    const rail = page.getByRole("complementary").or(page.locator("aside")).first();
    const scope = (await rail.count()) ? rail : page;

    // Checked vs unchecked facet checkbox: the tick must survive.
    const checked = scope.getByRole("checkbox", { name: /^Zeta/, checked: true }).first();
    const unchecked = scope.getByRole("checkbox", { name: /^ZMAX/, checked: false }).first();
    const tick = await statesDiffer(page, checked, unchecked);
    const tickInner = await (async () => {
      const a = await boxPixels(page, checked);
      const b = await boxPixels(page, unchecked);
      let n = 0;
      for (let y = 3; y < a.h - 3; y++) for (let x = 3; x < a.w - 3; x++) if (dist(a.at(x, y), b.at(x, y)) > 60) n++;
      return n;
    })();
    expect.soft(tickInner, `checked checkbox indistinguishable from unchecked (inner px differing; ${tick.probes})`).toBeGreaterThan(6);

    // Season chip: selected vs unselected. The inputs are sr-only; the label is the chip.
    const chipOn = scope.getByRole("checkbox", { name: /Winter/, checked: true }).first().locator("xpath=ancestor::label[1]");
    const chipOff = scope.getByRole("checkbox", { name: /Summer|All.season/, checked: false }).first().locator("xpath=ancestor::label[1]");
    const chips = await statesDiffer(page, chipOn, chipOff);
    expect.soft(chips.differs, `selected season chip indistinguishable in forced colours ${chips.probes}`).toBe(true);

    // Current nav item vs the others.
    const nav = page.getByRole("navigation", { name: "Primary" }).first();
    const nav1 = await statesDiffer(page, nav.getByRole("link", { name: "Tires", exact: true }), nav.getByRole("link", { name: "Wheels", exact: true }), 3);
    expect.soft(nav1.differs, `current nav item indistinguishable in forced colours ${nav1.probes}`).toBe(true);

    // Range thumbs must not vanish: some pixel in the range box differs from Canvas.
    const range = scope.getByRole("slider").first();
    const canvas = await page.evaluate(() => {
      const d = document.createElement("div");
      d.style.background = "Canvas";
      document.body.append(d);
      const c = getComputedStyle(d).backgroundColor;
      d.remove();
      return c.match(/\d+/g)!.slice(0, 3).map(Number);
    });
    const rp = await boxPixels(page, range);
    let inked = 0;
    for (let y = 0; y < rp.h; y++) for (let x = 0; x < rp.w; x++) if (dist(rp.at(x, y), canvas) > 90) inked++;
    expect.soft(inked, "range thumbs/track invisible in forced colours (pixels differing from Canvas)").toBeGreaterThan(40);

    // PDP: quantity cell (aria-current) and the Preferred-contact radio segment.
    await page.goto(routePath("pdp-tire"));
    await settleFull(page);
    await page.screenshot({ path: info.outputPath("forced-colors-pdp.png"), fullPage: true });
    const qty = page.getByRole("group", { name: /how many/i }).first();
    const qtyDiff = await statesDiffer(
      page,
      qty.locator('[aria-current="true"]').first(),
      qty.getByRole("link", { name: "2", exact: true }).first(),
    );
    expect.soft(qtyDiff.differs, `selected quantity cell indistinguishable ${qtyDiff.probes}`).toBe(true);
    const radioOn = page.getByRole("radio", { checked: true }).first().locator("xpath=ancestor::label[1]");
    const radioOff = page.getByRole("radio", { checked: false }).first().locator("xpath=ancestor::label[1]");
    const radios = await statesDiffer(page, radioOn, radioOff);
    expect.soft(radios.differs, `checked Preferred-contact segment indistinguishable ${radios.probes}`).toBe(true);
  });
});

/* ======================================================================== */
/* 6. prefers-reduced-motion                                                 */
/* ======================================================================== */

/** Every element and pseudo whose transition/animation outlives the 0.01ms kill. */
function motionOffenders() {
  const toMs = (v: string) =>
    Math.max(
      0,
      ...v.split(",").map((t) => {
        const s = t.trim();
        return s.endsWith("ms") ? parseFloat(s) : parseFloat(s) * 1000;
      }),
    );
  const out: string[] = [];
  const desc = (e: Element) =>
    `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}.${String(e.className).slice(0, 40)}`;
  const els = [...document.querySelectorAll("*")];
  for (const e of els) {
    const pseudos = [null, "::before", "::after"];
    if (e.tagName === "DIALOG" && (e as HTMLDialogElement).open) pseudos.push("::backdrop");
    for (const p of pseudos) {
      const cs = getComputedStyle(e, p);
      const t = toMs(cs.transitionDuration);
      const a = cs.animationName !== "none" ? toMs(cs.animationDuration) : 0;
      if (t > 0.02 || a > 0.02) out.push(`${desc(e)}${p ?? ""} transition ${t}ms animation ${a}ms`);
    }
  }
  const running = document
    .getAnimations()
    .filter((a) => {
      const d = a.effect?.getComputedTiming().duration;
      return typeof d === "number" && d > 1;
    })
    .map((a) => {
      const t = (a.effect as KeyframeEffect | null)?.target;
      return `${a.constructor.name} on ${t ? desc(t) : "?"} ${a.effect?.getComputedTiming().duration}ms`;
    });
  return { out: out.slice(0, 30), count: out.length, running };
}

test.describe("reduced motion", () => {
  const applies = (info: TestInfo) =>
    isDesktopAt(info, 1440) || ["iphone-se", "pixel-7"].includes(info.project.name);

  for (const name of ["home", "results", "pdp-tire"] as const) {
    test(`reduced motion: nothing animates on ${name}`, async ({ page }, info) => {
      test.skip(!applies(info), "runs per engine at 1440 and on one phone per engine");
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(routePath(name));
      await settleFull(page);
      const m = await page.evaluate(motionOffenders);
      expect.soft(m.out, `${m.count} element(s) keep a transition/animation under reduce`).toEqual([]);
      expect.soft(m.running, "animations still running under reduce").toEqual([]);
    });
  }

  test("reduced motion: sheet, drawer, disclosure and skip link settle in one frame", async ({ page }, info) => {
    test.skip(!applies(info), "runs per engine at 1440 and on one phone per engine");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/tires");
    await settleFull(page);
    const afterFrames = () =>
      page.evaluate(
        () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
      );

    // Skip link (keyboard reveal).
    await page.keyboard.press(tabKey(info));
    await afterFrames();
    const sk = await page.evaluate(motionOffenders);
    expect.soft(sk.running, "skip link reveal animates under reduce").toEqual([]);

    if (usesSheet(info)) {
      await page.getByRole("button", { name: "Filters", exact: true }).click();
      await afterFrames();
      const m = await page.evaluate(motionOffenders);
      expect.soft(m.out, "filter sheet: transitions survive reduce (incl. ::backdrop)").toEqual([]);
      expect.soft(m.running, "filter sheet: animations still running").toEqual([]);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "Filters" })).toBeHidden();
      await page.goto("/");
      await settleFull(page);
      const menu = page.getByRole("button", { name: "Menu", exact: true });
      if (await menu.isVisible()) {
        await menu.click();
        await afterFrames();
        const d = await page.evaluate(motionOffenders);
        expect.soft(d.out, "nav drawer: transitions survive reduce (incl. ::backdrop)").toEqual([]);
        expect.soft(d.running, "nav drawer: animations still running").toEqual([]);
        await page.keyboard.press("Escape");
      }
    } else {
      // Desktop: the Change-vehicle disclosure and a card hover.
      await page.getByText(/change vehicle|add vehicle/i).first().click();
      await afterFrames();
      const m = await page.evaluate(motionOffenders);
      expect.soft(m.running, "disclosure panel still animating under reduce").toEqual([]);
      await page.getByRole("link", { name: /request a quote/i }).first().hover();
      await afterFrames();
      const h = await page.evaluate(motionOffenders);
      expect.soft(h.running, "card hover still animating under reduce").toEqual([]);
    }
  });

  test("reduced motion: featured carousel scrolls instantly", async ({ page }, info) => {
    test.skip(!applies(info), "runs per engine at 1440 and on one phone per engine");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await settleFull(page);
    const track = page.locator('[data-probe="featured-track"]');
    await track.scrollIntoViewIfNeeded();
    expect(await track.evaluate((el) => getComputedStyle(el).scrollBehavior)).toBe("auto");
    const before = await track.evaluate((el) => el.scrollLeft);
    await page.getByRole("button", { name: "Next featured tire", exact: true }).filter({ visible: true }).first().click();
    const firstFrames = await track.evaluate(
      (el) =>
        new Promise<number>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(el.scrollLeft)))),
    );
    // Settled value: poll until two reads 2 frames apart agree.
    let settled = firstFrames;
    await expect
      .poll(async () => {
        const next = await track.evaluate(
          (el) => new Promise<number>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(el.scrollLeft)))),
        );
        const same = next === settled;
        settled = next;
        return same;
      })
      .toBe(true);
    expect(settled, "Next moved the track").not.toBe(before);
    expect(firstFrames, `scroll was smooth: at 2 frames ${firstFrames}, settled ${settled}`).toBe(settled);
  });
});

/* ======================================================================== */
/* 7. Contrast — pixel-sampled over photos, computed over CSS backgrounds    */
/* ======================================================================== */

interface PhotoText {
  i: number;
  text: string;
  fg: [number, number, number, number]; // rgba 0-255, alpha 0-1 incl. opacity chain
  large: boolean;
  size: number;
  weight: number;
}

/** Tags every visible text element whose text box sits over an <img> or url() background. */
function findPhotoText(): { targets: PhotoText[]; offscreen: number; photos: number } {
  const cvs = document.createElement("canvas").getContext("2d")!;
  const rgba = (c: string): [number, number, number, number] => {
    cvs.clearRect(0, 0, 1, 1);
    cvs.fillStyle = "#000";
    cvs.fillStyle = c;
    cvs.fillRect(0, 0, 1, 1);
    const d = cvs.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const vw = document.documentElement.clientWidth;
  const photos = [...document.querySelectorAll("img, video, picture, canvas, body *")]
    .filter((e) => e.tagName === "IMG" || e.tagName === "VIDEO" || getComputedStyle(e).backgroundImage.includes("url("))
    .map((e) => e.getBoundingClientRect())
    .filter((r) => r.width > 20 && r.height > 20);
  const targets: PhotoText[] = [];
  let offscreen = 0;
  const seen = new Set<Element>();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || seen.has(el) || !(n.textContent ?? "").trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const rects = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1);
    if (!rects.length) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.clip === "rect(0px, 0px, 0px, 0px)" || cs.clipPath === "inset(50%)") continue;
    if (el.closest("dialog:not([open])")) continue;
    const r = rects[0];
    const cx = r.left + r.width / 2 + scrollX;
    const cy = r.top + r.height / 2 + scrollY;
    const over = photos.some(
      (p) => cx >= p.left + scrollX && cx <= p.right + scrollX && cy >= p.top + scrollY && cy <= p.bottom + scrollY,
    );
    if (!over) continue;
    seen.add(el);
    if (r.right < 0 || r.left > vw) {
      offscreen++;
      continue;
    }
    let op = 1;
    for (let a: Element | null = el; a; a = a.parentElement) op *= parseFloat(getComputedStyle(a).opacity);
    // Not rendered: the idle NavProgress overlay (aria-hidden, opacity 0).
    if (op === 0 && el.closest('[aria-hidden="true"]')) continue;
    const fg = rgba(cs.color);
    fg[3] *= op;
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10);
    const i = targets.length;
    el.setAttribute("data-kbd-c", String(i));
    targets.push({
      i,
      text: (n.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 50),
      fg,
      size,
      weight,
      large: size >= 24 || (size >= 18.66 && weight >= 700),
    });
    if (targets.length >= 40) break;
  }
  return { targets, offscreen, photos: photos.length };
}

const lum = (c: readonly number[]) => {
  const ch = c.slice(0, 3).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};
const ratio = (a: readonly number[], b: readonly number[]) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const HIDE_TEXT = `[data-kbd-hide] { color: transparent !important; -webkit-text-fill-color: transparent !important;
  text-shadow: none !important; text-decoration-color: transparent !important; }`;

const CONTRAST_ROUTES = ["home", "results", "wheels", "accessories", "pdp-tire", "about"] as const;
const CONTRAST_VIEWPORTS = [
  { w: 390, h: 844 },
  { w: 1440, h: 900 },
] as const;

test.describe("contrast", () => {
  for (const name of CONTRAST_ROUTES) {
    for (const vp of CONTRAST_VIEWPORTS) {
      test(`contrast over photos (pixel-sampled): ${name} @${vp.w}`, async ({ browser, baseURL }, info) => {
        test.skip(info.project.name !== "chromium-1440", "pixel sampling runs once, in Chromium, at 390 and 1440 @1x");
        test.setTimeout(120_000);
        const ctx = await browser.newContext({
          baseURL,
          viewport: { width: vp.w, height: vp.h },
          deviceScaleFactor: 1,
          reducedMotion: "reduce", // no reveal/fade mid-capture
        });
        const p = await ctx.newPage();
        try {
          await p.goto(routePath(name));
          await settleFull(p);
          await p.addStyleTag({ content: HIDE_TEXT });
          const { targets, offscreen, photos } = await p.evaluate(findPhotoText);
          const rows: Record<string, string | number>[] = [];
          const fails: string[] = [];
          for (const t of targets) {
            const el = p.locator(`[data-kbd-c="${t.i}"]`);
            await el.evaluate((e) => e.scrollIntoView({ block: "center", inline: "nearest" }));
            await expect
              .poll(() =>
                p.evaluate(() =>
                  [...document.images]
                    .filter((im) => {
                      const r = im.getBoundingClientRect();
                      return r.bottom > 0 && r.top < innerHeight && r.width > 0;
                    })
                    .every(
                      (im) =>
                        im.complete &&
                        im.naturalWidth > 0 &&
                        !(document.documentElement.hasAttribute("data-img-fade") && !im.hasAttribute("data-loaded")),
                    ),
                ),
              )
              .toBe(true);
            const geo = await el.evaluate((e) => {
              const rects: { x: number; y: number; w: number; h: number }[] = [];
              for (const n of e.childNodes) {
                if (n.nodeType !== 3 || !(n.textContent ?? "").trim()) continue;
                const range = document.createRange();
                range.selectNodeContents(n);
                for (const r of range.getClientRects()) {
                  if (r.width > 1 && r.height > 1) rects.push({ x: r.left, y: r.top, w: r.width, h: r.height });
                }
              }
              const c = rects[0];
              // Badges and brand stamps are pointer-events:none (D86); hit-test them as painted.
              const pe = (e as HTMLElement).style.pointerEvents;
              (e as HTMLElement).style.pointerEvents = "auto";
              const hit = c ? document.elementFromPoint(c.x + c.w / 2, c.y + c.h / 2) : null;
              (e as HTMLElement).style.pointerEvents = pe;
              return { rects, onTop: !!hit && (hit === e || e.contains(hit) || hit.contains(e)) };
            });
            if (!geo.rects.length) continue;
            const x0 = Math.max(0, Math.floor(Math.min(...geo.rects.map((r) => r.x))));
            const y0 = Math.max(0, Math.floor(Math.min(...geo.rects.map((r) => r.y))));
            const x1 = Math.min(vp.w, Math.ceil(Math.max(...geo.rects.map((r) => r.x + r.w))));
            const y1 = Math.min(vp.h, Math.ceil(Math.max(...geo.rects.map((r) => r.y + r.h))));
            if (x1 - x0 < 2 || y1 - y0 < 2) continue;
            await el.evaluate((e) => e.setAttribute("data-kbd-hide", ""));
            const buf = await p.screenshot({
              clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 },
              animations: "disabled",
              caret: "hide",
              scale: "css",
            });
            await el.evaluate((e) => e.removeAttribute("data-kbd-hide"));
            const { data, info: meta } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
            const [fr, fg, fb, fa] = t.fg;
            const ratios: number[] = [];
            for (let y = 0; y < meta.height; y++) {
              for (let x = 0; x < meta.width; x++) {
                const px = x + x0 + 0.5;
                const py = y + y0 + 0.5;
                if (!geo.rects.some((r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h)) continue;
                const o = (y * meta.width + x) * 3;
                const bg = [data[o], data[o + 1], data[o + 2]];
                const comp = [fr * fa + bg[0] * (1 - fa), fg * fa + bg[1] * (1 - fa), fb * fa + bg[2] * (1 - fa)];
                ratios.push(ratio(comp, bg));
              }
            }
            if (!ratios.length) continue;
            ratios.sort((a, b) => a - b);
            const q = (f: number) => ratios[Math.min(ratios.length - 1, Math.floor(ratios.length * f))];
            const need = t.large ? 3 : 4.5;
            const row = {
              text: t.text,
              size: t.size,
              weight: t.weight,
              fg: `rgba(${t.fg.map((v, k) => (k === 3 ? v.toFixed(2) : v)).join(",")})`,
              min: +q(0).toFixed(2),
              p10: +q(0.1).toFixed(2),
              median: +q(0.5).toFixed(2),
              need,
              px: ratios.length,
              onTop: geo.onTop ? "yes" : "covered",
            };
            rows.push(row);
            if (geo.onTop && row.p10 < need) {
              fails.push(`"${t.text}" ${t.size}px/${t.weight}: min ${row.min} / p10 ${row.p10} / median ${row.median} (need ${need})`);
            }
          }
          await save(info, `photo-contrast-${name}-${vp.w}.json`, { photos, offscreen, rows });
          expect.soft(fails, `text over photos below threshold at the 10th percentile (${name} @${vp.w})`).toEqual([]);
        } finally {
          await ctx.close();
        }
      });

      test(`contrast over CSS backgrounds (computed): ${name} @${vp.w}`, async ({ browser, baseURL }, info) => {
        test.skip(info.project.name !== "chromium-1440", "computed sweep runs once, in Chromium, at 390 and 1440");
        // Reduced motion so the D92b below-the-fold reveal never holds a section
        // at opacity 0 while the sweep reads it (the photo sweep does the same).
        const ctx = await browser.newContext({
          baseURL,
          viewport: { width: vp.w, height: vp.h },
          deviceScaleFactor: 1,
          reducedMotion: "reduce",
        });
        const p = await ctx.newPage();
        try {
          await p.goto(routePath(name));
          await settleFull(p);
          const res = await p.evaluate(() => {
            const cvs = document.createElement("canvas").getContext("2d")!;
            const rgba = (c: string) => {
              cvs.clearRect(0, 0, 1, 1);
              cvs.fillStyle = "#000";
              cvs.fillStyle = c;
              cvs.fillRect(0, 0, 1, 1);
              const d = cvs.getImageData(0, 0, 1, 1).data;
              return [d[0], d[1], d[2], d[3] / 255];
            };
            const lumi = (c: number[]) => {
              const ch = c.slice(0, 3).map((v) => {
                const s = v / 255;
                return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
              });
              return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
            };
            const rat = (a: number[], b: number[]) => {
              const [x, y] = [lumi(a), lumi(b)].sort((m, n) => n - m);
              return (x + 0.05) / (y + 0.05);
            };
            const over = (top: number[], under: number[]) => [
              top[0] * top[3] + under[0] * (1 - top[3]),
              top[1] * top[3] + under[1] * (1 - top[3]),
              top[2] * top[3] + under[2] * (1 - top[3]),
              1,
            ];
            const photoRects = [...document.querySelectorAll("img, video, body *")]
              .filter(
                (e) =>
                  e.tagName === "IMG" ||
                  e.tagName === "VIDEO" ||
                  getComputedStyle(e).backgroundImage !== "none",
              )
              .map((e) => e.getBoundingClientRect())
              .filter((r) => r.width > 4 && r.height > 4);
            const bgOf = (el: Element) => {
              const chain: Element[] = [];
              for (let a: Element | null = el; a; a = a.parentElement) chain.unshift(a);
              let bg = [255, 255, 255, 1];
              for (const a of chain) bg = over(rgba(getComputedStyle(a).backgroundColor), bg);
              return bg;
            };
            const fails: string[] = [];
            const tokens: Record<string, { min: number; n: number }> = {};
            let checked = 0;
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            const seen = new Set<Element>();
            const judge = (el: Element, fgStr: string, what: string, r: DOMRect) => {
              const cs = getComputedStyle(el);
              if (photoRects.some((p) => r.left + r.width / 2 >= p.left && r.left + r.width / 2 <= p.right && r.top + r.height / 2 >= p.top && r.top + r.height / 2 <= p.bottom)) return;
              let op = 1;
              for (let a: Element | null = el; a; a = a.parentElement) op *= parseFloat(getComputedStyle(a).opacity);
              // Not rendered text: the idle `NavProgress` overlay (D92b addendum) is
              // aria-hidden at opacity 0 until a slow navigation shows it.
              if (op === 0 && el.closest('[aria-hidden="true"]')) return;
              const fg = rgba(fgStr);
              fg[3] *= op;
              const bg = bgOf(el);
              const cr = rat(over(fg, bg), bg);
              const size = parseFloat(cs.fontSize);
              const weight = parseInt(cs.fontWeight, 10);
              const need = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
              checked++;
              const key = `${fgStr} on rgb(${bg.slice(0, 3).map(Math.round).join(",")})`;
              tokens[key] = { min: Math.min(tokens[key]?.min ?? 99, +cr.toFixed(2)), n: (tokens[key]?.n ?? 0) + 1 };
              if (cr < need) fails.push(`${what} "${(el.textContent ?? "").trim().slice(0, 30)}" ${size}px/${weight} ${fgStr}×${op.toFixed(2)} on rgb(${bg.slice(0, 3).map(Math.round).join(",")}) = ${cr.toFixed(2)} (need ${need})`);
            };
            for (let n = walker.nextNode(); n; n = walker.nextNode()) {
              const el = n.parentElement;
              if (!el || seen.has(el) || !(n.textContent ?? "").trim()) continue;
              seen.add(el);
              if (el.closest(":disabled, [aria-disabled='true'], [inert], dialog:not([open])")) continue;
              const cs = getComputedStyle(el);
              if (cs.visibility === "hidden" || cs.clip === "rect(0px, 0px, 0px, 0px)" || cs.clipPath === "inset(50%)") continue;
              const range = document.createRange();
              range.selectNodeContents(n);
              const r = [...range.getClientRects()].find((x) => x.width > 1 && x.height > 1);
              if (!r) continue;
              judge(el, cs.color, "text", r);
            }
            for (const el of document.querySelectorAll<HTMLInputElement>("input[placeholder], textarea[placeholder]")) {
              const r = el.getBoundingClientRect();
              if (r.width <= 1 || !el.placeholder || el.value) continue;
              judge(el, getComputedStyle(el, "::placeholder").color, "placeholder", r);
            }
            return { fails, checked, tokens };
          });
          await save(info, `css-contrast-${name}-${vp.w}.json`, res);
          expect(res.checked, "the sweep measured text").toBeGreaterThan(10);
          expect.soft(res.fails, `text below AA over CSS backgrounds (${name} @${vp.w})`).toEqual([]);
        } finally {
          await ctx.close();
        }
      });
    }
  }
});
