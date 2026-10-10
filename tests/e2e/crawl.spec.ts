/**
 * Every-control crawl (D91b, `tests/llm.md`).
 *
 * For each route in `ROUTES`, and for each extra state a control can hide in
 * (the mobile drawer, the filter sheet, the `Change vehicle` disclosure), the
 * crawl enumerates every visible, enabled, interactive element and asserts:
 *
 *   1. HIT-TEST   — `document.elementFromPoint` at the box centre, after the
 *                   element is scrolled to rest, lands on the control or inside
 *                   it. The D86 lesson: markup can look right and be dead.
 *   2. NAME       — the accessibility tree gives every control a name, and no
 *                   two links share a name while pointing at different targets.
 *   3. LINKS      — every same-origin href answers < 400 (a redirect is reported,
 *                   not failed), same-page and cross-page `#fragments` resolve,
 *                   every `tel:` is E.164 AND `PRIMARY_CONTACT` (D161), `mailto:` is
 *                   well formed, no `href="#"`, no `javascript:`.
 *   4. EFFECT     — every non-submit button / summary / select / checkbox /
 *                   radio / range is activated with real input and must change
 *                   something observable (URL, aria state, dialog, `<details>`,
 *                   a field value, the text, a scroller, or focus moving to a
 *                   different element). Filter-rail, sheet and sort controls
 *                   must change the URL (D44). State is restored by reloading.
 *   5. TARGET     — WCAG 2.5.8: 24x24 CSS px, with the inline-text, spacing and
 *                   label-equivalence exemptions.
 *
 * Findings are collected across the whole route/state and asserted softly, so
 * one run lists every defect. Known and accepted items are annotated, not
 * failed: D69 (the price-range thumbs are 16px pseudo-elements the DOM cannot
 * measure). NJR-5 (Menu inert without JS) is n/a — this crawl runs with JS.
 *
 * Deliberate harness notes:
 *  - `<select>` is driven with `selectOption`: the option list is OS-drawn UI
 *    Playwright cannot click, and `selectOption` dispatches the same
 *    input/change events a picked option does.
 *  - Elements are tagged `data-crawl-id` so the harness can find them again; it
 *    is a crawler, not a locator convention for the product's own specs.
 *  - Styleguide specimens are inert demos (a Server Component page, no
 *    handlers, no form), so step 4 is skipped there and annotated; its hit
 *    test, names, sizes and links still run.
 *  - Evidence JSON is attached per test and, when `CRAWL_EVIDENCE_DIR` is set,
 *    also written there (attachments of passing tests are discarded).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { ROUTES, scrollSettled, settle, usesSheet, viewportWidth } from "../helpers";
import { PRIMARY_CONTACT, SITE } from "../../src/lib/site";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type State = "base" | "drawer" | "sheet" | "vehicle";

interface Ctl {
  id: number;
  clickId: number | null;
  tag: string;
  role: string;
  type: string;
  name: string;
  href: string | null;
  sig: string;
  probes: string[];
  text: string;
  rect: { x: number; y: number; w: number; h: number };
  size: { w: number; h: number };
  tabbable: boolean;
  ariaHidden: boolean;
  inline: boolean;
  srOnly: boolean;
  offscreen: boolean;
  submit: boolean;
  textEntry: boolean;
  checked: boolean | null;
}

interface LinkInfo {
  attr: string;
  abs: string;
  target: string | null;
  rel: string | null;
  ariaHidden: boolean;
}

interface Enumeration {
  controls: Ctl[];
  links: LinkInfo[];
  counts: { candidates: number; invisible: number; disabled: number; inert: number };
}

interface HitResult {
  id: number;
  ok: boolean;
  reason?: string;
  hit?: string;
}

interface Snap {
  url: string;
  aria: string;
  dialogs: number;
  details: string;
  values: string;
  text: string;
  scroll: string;
  focus: string;
}

// ---------------------------------------------------------------------------
// In-page functions (serialised by Playwright: they must be self-contained)
// ---------------------------------------------------------------------------

function enumerateInPage(rootSel: string | null): Enumeration {
  document.querySelectorAll("[data-crawl-id]").forEach((e) => e.removeAttribute("data-crawl-id"));
  document.querySelectorAll("[data-crawl-click]").forEach((e) => e.removeAttribute("data-crawl-click"));

  const root: ParentNode = rootSel ? (document.querySelector(rootSel) as ParentNode) : document;
  const NATIVE =
    'a[href], button, summary, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="slider"], [role="tab"]';
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(`${NATIVE}, [tabindex]`));

  const roleOf = (el: HTMLElement): string => {
    const r = el.getAttribute("role");
    if (r) return r;
    const t = el.localName;
    if (t === "a") return "link";
    if (t === "button" || t === "summary") return "button";
    if (t === "select") return "combobox";
    if (t === "textarea") return "textbox";
    if (t === "input") {
      const ty = (el as HTMLInputElement).type;
      const map: Record<string, string> = {
        checkbox: "checkbox",
        radio: "radio",
        range: "slider",
        button: "button",
        submit: "button",
        reset: "button",
        image: "button",
        search: "searchbox",
      };
      return map[ty] ?? "textbox";
    }
    return "generic";
  };

  const contentName = (node: Node): string => {
    if (node.nodeType === 3) return node.textContent ?? "";
    if (node.nodeType !== 1) return "";
    const e = node as Element;
    if (e.getAttribute("aria-hidden") === "true") return "";
    const cs = getComputedStyle(e);
    if (cs.display === "none" || cs.visibility === "hidden") return "";
    if (e.localName === "img") return e.getAttribute("alt") ?? "";
    if (e.localName === "svg") {
      const t = e.querySelector(":scope > title");
      return t?.textContent ?? e.getAttribute("aria-label") ?? "";
    }
    const al = e.getAttribute("aria-label");
    if (al) return al;
    return Array.from(e.childNodes).map(contentName).join(" ");
  };

  const accName = (el: HTMLElement): string => {
    const lb = el.getAttribute("aria-labelledby");
    if (lb) {
      const t = lb
        .split(/\s+/)
        .map((id) => document.getElementById(id))
        .filter((n): n is HTMLElement => !!n)
        .map((n) => contentName(n))
        .join(" ");
      if (t.trim()) return t.replace(/\s+/g, " ").trim();
    }
    const al = el.getAttribute("aria-label");
    if (al?.trim()) return al.trim();
    const tag = el.localName;
    if (tag === "input" || tag === "select" || tag === "textarea") {
      const inp = el as HTMLInputElement;
      if (["button", "submit", "reset"].includes(inp.type) && inp.value) return inp.value;
      const labels = Array.from(inp.labels ?? [])
        .map((l) => {
          // A label's own text without the control's option list.
          return Array.from(l.childNodes)
            .filter((n) => !(n instanceof HTMLElement && (n.localName === "select" || n.localName === "textarea")))
            .map(contentName)
            .join(" ");
        })
        .join(" ");
      if (labels.trim()) return labels.replace(/\s+/g, " ").trim();
    } else {
      const c = Array.from(el.childNodes).map(contentName).join(" ").replace(/\s+/g, " ").trim();
      if (c) return c;
    }
    const title = el.getAttribute("title");
    if (title?.trim()) return title.trim();
    return "";
  };

  const visible = (e: Element): boolean => {
    const cv = (e as Element & { checkVisibility?: (o?: object) => boolean }).checkVisibility;
    return typeof cv === "function" ? cv.call(e, { visibilityProperty: true, contentVisibilityAuto: true }) : true;
  };

  const controls: Ctl[] = [];
  const seenSig = new Map<string, number>();
  const counts = { candidates: candidates.length, invisible: 0, disabled: 0, inert: 0 };
  let nextId = 0;

  for (const el of candidates) {
    const nativeOrRole = el.matches(NATIVE);
    if (!nativeOrRole && el.tabIndex < 0) continue;
    if (el.closest("[inert]")) {
      counts.inert++;
      continue;
    }
    if (
      (el as HTMLButtonElement).disabled === true ||
      el.closest("fieldset[disabled]") ||
      el.getAttribute("aria-disabled") === "true"
    ) {
      counts.disabled++;
      continue;
    }
    const r = el.getBoundingClientRect();
    if (!visible(el) || (r.width === 0 && r.height === 0 && el.getClientRects().length === 0)) {
      counts.invisible++;
      continue;
    }

    const tag = el.localName;
    const type = tag === "input" ? (el as HTMLInputElement).type : "";
    const role = roleOf(el);
    const srOnly = r.width <= 2 || r.height <= 2;

    // A visually replaced input (sr-only radio in a segmented control) is
    // clicked through its label.
    let clickId: number | null = null;
    let labelEl: HTMLElement | null = null;
    if (tag === "input") {
      const l = (el as HTMLInputElement).labels?.[0] ?? null;
      if (l && visible(l)) labelEl = l;
    }

    const id = nextId++;
    el.setAttribute("data-crawl-id", String(id));
    if (srOnly && labelEl) {
      clickId = id;
      labelEl.setAttribute("data-crawl-click", String(id));
    }

    // Effective target for WCAG 2.5.8: an input beside its own label is one
    // target; take the union of the two boxes.
    let sw = r.width;
    let sh = r.height;
    if (labelEl) {
      const lr = labelEl.getBoundingClientRect();
      const l = Math.min(r.left, lr.left);
      const t2 = Math.min(r.top, lr.top);
      sw = Math.max(r.right, lr.right) - l;
      sh = Math.max(r.bottom, lr.bottom) - t2;
    }
    // `tap-extend` / `tap-extend-lg` widen the hit area with an absolutely
    // positioned ::after band the DOM box does not include. The pointer
    // target is the union of the two.
    for (const pseudo of ["::after", "::before"]) {
      const ps = getComputedStyle(el, pseudo);
      if (ps.content === "none" || ps.content === "normal" || ps.position !== "absolute") continue;
      const pl = parseFloat(ps.left);
      const pt = parseFloat(ps.top);
      const pw = parseFloat(ps.width);
      const ph = parseFloat(ps.height);
      if ([pl, pt, pw, ph].some((n) => Number.isNaN(n))) continue;
      // Relative to the element's padding box; the element is `position:relative`.
      const left = Math.min(0, pl);
      const top = Math.min(0, pt);
      const right = Math.max(sw, pl + pw);
      const bottom = Math.max(sh, pt + ph);
      sw = right - left;
      sh = bottom - top;
    }

    const parent = el.parentElement;
    const inline =
      getComputedStyle(el).display === "inline" &&
      !!parent &&
      (parent.textContent ?? "").trim().length > (el.textContent ?? "").trim().length + 1;

    const probes: string[] = [];
    for (let p: Element | null = el; p; p = p.parentElement) {
      const dp = p.getAttribute("data-probe");
      if (dp) probes.push(dp);
    }

    const href = tag === "a" ? el.getAttribute("href") : null;
    const name = accName(el);
    const baseSig = [tag, role, type, name, href ?? "", el.id, el.getAttribute("name") ?? ""].join("|");
    const occ = seenSig.get(baseSig) ?? 0;
    seenSig.set(baseSig, occ + 1);

    const submit =
      el instanceof HTMLButtonElement
        ? el.type === "submit" && !!el.form
        : el instanceof HTMLInputElement
          ? ["submit", "image"].includes(el.type) && !!el.form
          : false;

    controls.push({
      id,
      clickId,
      tag,
      role,
      type,
      name,
      href,
      sig: `${baseSig}#${occ}`,
      probes,
      text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60),
      rect: { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height },
      size: { w: sw, h: sh },
      tabbable: el.tabIndex >= 0,
      ariaHidden: !!el.closest('[aria-hidden="true"]'),
      inline,
      srOnly,
      offscreen: r.right <= 0 || r.bottom <= 0,
      submit,
      textEntry:
        tag === "textarea" ||
        (tag === "input" &&
          !["checkbox", "radio", "range", "button", "submit", "reset", "image", "file", "color"].includes(type)),
      checked: type === "checkbox" || type === "radio" ? (el as HTMLInputElement).checked : null,
    });
  }

  const links: LinkInfo[] = Array.from(root.querySelectorAll<HTMLAnchorElement>("a[href]")).map((a) => ({
    attr: a.getAttribute("href") ?? "",
    abs: a.href,
    target: a.getAttribute("target"),
    rel: a.getAttribute("rel"),
    ariaHidden: !!a.closest('[aria-hidden="true"]'),
  }));

  return { controls, links, counts };
}

async function hitBatchInPage(ids: number[]): Promise<HitResult[]> {
  const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
  const describe = (e: Element | null): string => {
    if (!e) return "null";
    const parts: string[] = [];
    for (let n: Element | null = e, i = 0; n && i < 3; n = n.parentElement, i++) {
      const cls = (n.getAttribute("class") ?? "").split(/\s+/).slice(0, 4).join(".");
      const probe = n.getAttribute("data-probe");
      parts.push(`${n.localName}${n.id ? `#${n.id}` : ""}${cls ? `.${cls}` : ""}${probe ? `[data-probe=${probe}]` : ""}`);
    }
    const txt = (e.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
    return `${parts.join(" < ")}${txt ? ` "${txt}"` : ""}`;
  };
  const out: HitResult[] = [];
  for (const id of ids) {
    const el = document.querySelector<HTMLElement>(`[data-crawl-id="${id}"]`);
    if (!el) {
      out.push({ id, ok: false, reason: "gone" });
      continue;
    }
    const via = document.querySelector<HTMLElement>(`[data-crawl-click="${id}"]`);
    const target = via ?? el;
    target.scrollIntoView({ block: "center", inline: "center", behavior: "instant" as ScrollBehavior });
    // Rest: the box must hold still for two frames (covers any glide, the
    // sticky bar and the one-shot below-the-fold reveal).
    let prev = "";
    for (let i = 0; i < 60; i++) {
      await frame();
      const b = target.getBoundingClientRect();
      const key = `${b.left.toFixed(1)},${b.top.toFixed(1)},${b.width.toFixed(1)},${b.height.toFixed(1)}`;
      if (key === prev) break;
      prev = key;
    }
    const rects = Array.from(target.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
    const rect = rects[0];
    if (!rect) {
      out.push({ id, ok: false, reason: "no box" });
      continue;
    }
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const l = Math.max(rect.left, 0);
    const t = Math.max(rect.top, 0);
    const rr = Math.min(rect.right, vw);
    const bb = Math.min(rect.bottom, vh);
    if (rr <= l || bb <= t) {
      out.push({ id, ok: false, reason: `outside the viewport after scrollIntoView (${rect.left | 0},${rect.top | 0} ${rect.width | 0}x${rect.height | 0})` });
      continue;
    }
    let cx = (l + rr) / 2;
    const cy = (t + bb) / 2;
    // A dual range takes pointer events on its thumb only (`range-input`:
    // `pointer-events:none` with the thumb `auto`), so its box centre is the
    // track by design. Test the thumb itself, where the value puts it.
    if (el instanceof HTMLInputElement && el.type === "range") {
      const lo = Number(el.min || 0);
      const hi = Number(el.max || 100);
      const frac = hi > lo ? (Number(el.value) - lo) / (hi - lo) : 0;
      cx = rect.left + 8 + frac * (rect.width - 16);
    }
    const hit = document.elementFromPoint(cx, cy);
    const ok = !!hit && (target === hit || target.contains(hit) || el.contains(hit));
    out.push(ok ? { id, ok } : { id, ok, reason: `at (${cx | 0},${cy | 0})`, hit: describe(hit) });
  }
  return out;
}

function snapInPage(): Snap {
  const parts: string[] = [];
  document
    .querySelectorAll<HTMLElement>(
      "[aria-expanded],[aria-pressed],[aria-checked],[aria-selected],[aria-current],[aria-valuenow],[aria-busy]",
    )
    .forEach((e) => {
      for (const a of ["aria-expanded", "aria-pressed", "aria-checked", "aria-selected", "aria-current", "aria-valuenow"]) {
        const v = e.getAttribute(a);
        if (v !== null) parts.push(`${e.localName}#${e.id}:${a}=${v}`);
      }
    });
  const values: string[] = [];
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select, textarea").forEach((e) => {
    values.push(`${e.getAttribute("name") ?? e.id}:${(e as HTMLInputElement).checked ?? ""}:${e.value}`);
  });
  const details = Array.from(document.querySelectorAll("details"))
    .map((d) => (d.open ? "1" : "0"))
    .join("");
  // Text, skipping aria-hidden subtrees (the idle NavProgress overlay) and non-content.
  let text = "";
  const walk = (n: Node) => {
    if (n.nodeType === 3) {
      text += (n.textContent ?? "") + " ";
      return;
    }
    if (n.nodeType !== 1) return;
    const e = n as HTMLElement;
    if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(e.tagName) || e.getAttribute("aria-hidden") === "true" || e.hidden) return;
    n.childNodes.forEach(walk);
  };
  walk(document.body);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  const scrollers: string[] = [];
  document.querySelectorAll<HTMLElement>("*").forEach((e) => {
    if (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1) {
      if (e.scrollLeft || e.scrollTop) scrollers.push(`${e.localName}.${e.className.toString().slice(0, 20)}:${e.scrollLeft | 0},${e.scrollTop | 0}`);
    }
  });
  const ae = document.activeElement as HTMLElement | null;
  const focus = ae?.getAttribute("data-crawl-id")
    ? ae.getAttribute("data-crawl-id")!
    : ae?.closest("[data-crawl-click]")
      ? ae.closest("[data-crawl-click]")!.getAttribute("data-crawl-click")!
      : `(${ae?.localName}#${ae?.id}.${(ae?.getAttribute("class") ?? "").slice(0, 20)})`;
  return {
    url: location.pathname + location.search + location.hash,
    aria: parts.join("|"),
    dialogs: document.querySelectorAll("dialog[open]").length,
    details,
    values: values.join("|"),
    text: `${text.length}:${h}`,
    scroll: `${scrollX | 0},${scrollY | 0};${scrollers.join(";")}`,
    focus,
  };
}

function diffKinds(a: Snap, b: Snap, selfId: number): string[] {
  const k: string[] = [];
  if (a.url !== b.url) k.push("url");
  if (a.aria !== b.aria) k.push("aria");
  if (a.dialogs !== b.dialogs) k.push("dialog");
  if (a.details !== b.details) k.push("details");
  if (a.values !== b.values) k.push("value");
  if (a.text !== b.text) k.push("text");
  if (a.scroll !== b.scroll) k.push("scroll");
  if (a.focus !== b.focus && b.focus !== String(selfId)) k.push("focus");
  return k;
}

// ---------------------------------------------------------------------------
// Harness helpers
// ---------------------------------------------------------------------------

const RESULTS_FAMILY = new Set(["results", "results-vehicle", "wheels", "accessories"]);
const VEHICLE_DETAILS = 'details:has(> summary[data-probe="change-vehicle"])';
const DRAWER = 'dialog[aria-label="Menu"]';
const SHEET = "dialog[open]";

function statesFor(routeName: string, info: TestInfo): State[] {
  const s: State[] = ["base"];
  // The styleguide is specimens only: it renders no site header, so no drawer.
  if (viewportWidth(info) < 1100 && routeName !== "styleguide") s.push("drawer");
  if (RESULTS_FAMILY.has(routeName)) {
    if (usesSheet(info)) s.push("sheet");
    s.push("vehicle");
  }
  return s;
}

/** Scroll top to bottom once so the one-shot below-the-fold reveals have run. */
async function warmScroll(page: Page) {
  await page.evaluate(async () => {
    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    const h = document.documentElement.scrollHeight;
    const step = Math.max(200, window.innerHeight - 100);
    for (let y = 0; y < h; y += step) {
      window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
      await frame();
      await frame();
    }
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    await frame();
  });
  await scrollSettled(page);
}

async function animationsDone(page: Page, sel: string) {
  await page.evaluate(async (s) => {
    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    await frame();
    await frame();
    const el = document.querySelector(s);
    const anims = el
      ? el.getAnimations({ subtree: true }).filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
      : [];
    await Promise.allSettled(anims.map((a) => a.finished));
  }, sel);
}

/** Opens `state` with real clicks; returns the enumeration root (null = document). */
async function enterState(page: Page, state: State): Promise<string | null> {
  if (state === "base") return null;
  if (state === "drawer") {
    await page.getByRole("banner").getByRole("button", { name: "Menu", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
    await animationsDone(page, DRAWER);
    return DRAWER;
  }
  if (state === "sheet") {
    await page
      .locator('[data-probe="sticky-bar"]')
      .getByRole("button", { name: /^Filters/ })
      .click();
    await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
    await animationsDone(page, SHEET);
    return SHEET;
  }
  await page.locator('summary[data-probe="change-vehicle"]').click();
  await expect(page.locator(VEHICLE_DETAILS)).toHaveAttribute("open", "");
  await expect(page.locator('[data-probe="finder"]')).toBeVisible();
  await animationsDone(page, VEHICLE_DETAILS);
  return VEHICLE_DETAILS;
}

async function load(page: Page, url: string, state: State): Promise<string | null> {
  await page.goto(url);
  await settle(page);
  await warmScroll(page);
  return enterState(page, state);
}

// ---------------------------------------------------------------------------
// Accessibility-tree parsing (page-wide ariaSnapshot)
// ---------------------------------------------------------------------------

const NAMED_ROLES = "link|button|checkbox|radio|combobox|textbox|slider|tab|switch|searchbox|spinbutton";

function parseSnapshot(yaml: string) {
  const lines = yaml.split("\n");
  const empties: string[] = [];
  const links: { name: string; url: string; line: number }[] = [];
  const indentOf = (l: string) => l.length - l.trimStart().length;
  const roleRe = new RegExp(`^(\\s*)- (${NAMED_ROLES})((?: \\[[^\\]]*\\])*)(?: "((?:[^"\\\\]|\\\\.)*)")?((?: \\[[^\\]]*\\])*)(:.*)?$`);
  for (let i = 0; i < lines.length; i++) {
    const m = roleRe.exec(lines[i]);
    if (!m) continue;
    const role = m[2];
    const name = m[4] ?? "";
    let url = "";
    if (role === "link") {
      for (let j = i + 1; j < lines.length && indentOf(lines[j]) > indentOf(lines[i]); j++) {
        const u = /^\s*- \/url: (.*)$/.exec(lines[j]);
        if (u) {
          url = u[1].trim();
          break;
        }
      }
      links.push({ name, url, line: i });
    }
    if (!name.trim()) {
      const ctx = lines
        .slice(Math.max(0, i - 2), i + 3)
        .map((l) => l.trim())
        .join(" / ");
      empties.push(`${role}${url ? ` -> ${url}` : ""} :: ${ctx.slice(0, 160)}`);
    }
  }
  return { empties, links };
}

// ---------------------------------------------------------------------------
// Link checks (cached per worker)
// ---------------------------------------------------------------------------

const statusCache = new Map<string, { status: number; location: string | null }>();
const htmlCache = new Map<string, string>();

async function statusOf(page: Page, url: string) {
  const hit = statusCache.get(url);
  if (hit) return hit;
  const res = await page.request.get(url, { maxRedirects: 0, failOnStatusCode: false, timeout: 20_000 });
  const v = { status: res.status(), location: res.headers()["location"] ?? null };
  statusCache.set(url, v);
  return v;
}

async function htmlOf(page: Page, url: string) {
  const hit = htmlCache.get(url);
  if (hit !== undefined) return hit;
  const res = await page.request.get(url, { failOnStatusCode: false, timeout: 20_000 });
  const body = await res.text();
  htmlCache.set(url, body);
  return body;
}

const E164 = /^tel:\+[1-9]\d{6,14}$/;
const MAILTO = /^mailto:[^@\s?]+@[^@\s?]+\.[^@\s?]+(\?.*)?$/;
const CONTACT_TELS = [`tel:${PRIMARY_CONTACT.tel}`];

// ---------------------------------------------------------------------------
// The crawl
// ---------------------------------------------------------------------------

const TARGET_MIN = 24;
/** input[type=range]: the visible thumbs are 16px pseudo-elements. D69. */
const KNOWN_D69 = (c: Ctl) => c.type === "range";

type Defects = Record<
  | "interception"
  | "emptyName"
  | "duplicateName"
  | "focusableHidden"
  | "deadHref"
  | "scheme"
  | "tel"
  | "mailto"
  | "linkStatus"
  | "linkHash"
  | "effect"
  | "targetSize",
  string[]
>;

for (const route of ROUTES) {
  for (const state of ["base", "drawer", "sheet", "vehicle"] as const) {
    test(`crawl ${route.name} [${state}]`, async ({ page }, info) => {
      test.skip(!statesFor(route.name, info).includes(state), `no ${state} state on ${route.name} at this width`);
      test.setTimeout(420_000);
      page.on("dialog", (d) => void d.accept());

      const defects: Defects = {
        interception: [],
        emptyName: [],
        duplicateName: [],
        focusableHidden: [],
        deadHref: [],
        scheme: [],
        tel: [],
        mailto: [],
        linkStatus: [],
        linkHash: [],
        effect: [],
        targetSize: [],
      };
      const notes: string[] = [];
      const note = (type: string, description: string) => {
        notes.push(`${type}: ${description}`);
        info.annotations.push({ type, description });
      };

      const origin = new URL(info.project.use.baseURL ?? "http://localhost:3100").origin;
      const root = await load(page, route.path, state);
      const en = await page.evaluate(enumerateInPage, root);
      const ctls = en.controls;

      // -- 1. hit test ------------------------------------------------------
      const hits: HitResult[] = [];
      // The D104 honeypot is an `sr-only`, `aria-hidden`, untabbable input on purpose:
      // nobody can reach it, so nobody can be blocked from it. Tabbable-in-aria-hidden is
      // still reported below.
      const testable = ctls.filter((c) => !c.offscreen && !(c.ariaHidden && !c.tabbable));
      for (const c of ctls.filter((c) => c.offscreen)) {
        // The skip link waits off-canvas until it takes focus (D57 C1).
        note("offscreen-until-focus", `${c.tag} "${c.name}" ${c.href ?? ""} at (${c.rect.x | 0},${c.rect.y | 0})`);
      }
      for (let i = 0; i < testable.length; i += 40) {
        const batch = testable.slice(i, i + 40).map((c) => c.id);
        hits.push(...(await page.evaluate(hitBatchInPage, batch)));
      }
      const byId = new Map(ctls.map((c) => [c.id, c]));
      for (const h of hits) {
        if (h.ok) continue;
        const c = byId.get(h.id)!;
        defects.interception.push(
          `${c.role} "${c.name}"${c.href ? ` ${c.href}` : ""} ${c.tag}[${c.probes.join(">") || "-"}]: ${h.reason}${h.hit ? ` intercepted by ${h.hit}` : ""}`,
        );
      }
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }));

      // -- 2. accessible names ---------------------------------------------
      const snapshotRoot = root ? page.locator(root) : page.locator("body");
      const parsed = parseSnapshot(await snapshotRoot.ariaSnapshot());
      for (const e of parsed.empties) defects.emptyName.push(e);
      const byName = new Map<string, Set<string>>();
      for (const l of parsed.links) {
        if (!l.name.trim()) continue;
        if (!byName.has(l.name)) byName.set(l.name, new Set());
        byName.get(l.name)!.add(l.url);
      }
      for (const [name, urls] of byName) {
        if (urls.size > 1) defects.duplicateName.push(`link "${name}" -> ${[...urls].join(" | ")}`);
      }
      for (const c of ctls) {
        if (c.ariaHidden && c.tabbable) {
          defects.focusableHidden.push(`${c.role} "${c.name || c.text}" ${c.href ?? ""} is tabbable inside aria-hidden`);
        }
      }

      // -- 3. links ---------------------------------------------------------
      const rawLinks = en.links;
      const uniqueAttr = new Map<string, LinkInfo>();
      for (const l of rawLinks) if (!uniqueAttr.has(l.attr)) uniqueAttr.set(l.attr, l);
      const sameOrigin = new Map<string, string>(); // url-without-hash -> first attr
      const hashChecks = new Map<string, { path: string; hash: string }>();
      const externals: string[] = [];
      let telCount = 0;
      let mailtoCount = 0;
      for (const [attr, l] of uniqueAttr) {
        if (attr === "" || attr === "#" || /^javascript:/i.test(attr)) {
          defects.deadHref.push(`href="${attr}" (${l.abs})`);
          continue;
        }
        if (attr.startsWith("tel:")) {
          telCount++;
          if (!E164.test(attr)) defects.tel.push(`${attr} is not E.164`);
          else if (!CONTACT_TELS.includes(attr)) defects.tel.push(`${attr} is not PRIMARY_CONTACT (${CONTACT_TELS.join(", ")})`);
          continue;
        }
        if (attr.startsWith("mailto:")) {
          mailtoCount++;
          if (!MAILTO.test(attr)) defects.mailto.push(`${attr} is malformed`);
          else if (attr.replace(/^mailto:/, "").split("?")[0] !== SITE.email) note("mailto-differs-from-SITE.email", attr);
          continue;
        }
        if (/^(https?:)?\/\//i.test(attr) || /^[a-z][a-z0-9+.-]*:/i.test(attr)) {
          let u: URL;
          try {
            u = new URL(l.abs);
          } catch {
            defects.scheme.push(`unparseable ${attr}`);
            continue;
          }
          if (u.origin === origin) {
            /* absolute same-origin: falls through below */
          } else if (u.protocol === "http:" || u.protocol === "https:") {
            externals.push(`${attr} target=${l.target ?? "-"} rel=${l.rel ?? "-"}`);
            if (l.target === "_blank" && !/noopener|noreferrer/.test(l.rel ?? "")) {
              note("external-blank-without-rel", `${attr} (implicit noopener in current engines)`);
            }
            continue;
          } else {
            defects.scheme.push(`unexpected scheme: ${attr}`);
            continue;
          }
        }
        const u = new URL(l.abs);
        if (u.origin !== origin) continue;
        const hash = u.hash.replace(/^#/, "");
        u.hash = "";
        // A fragment-only href is the same document: no status request (the
        // 404 page's own "#main" would otherwise report the 404 it is on).
        if (!attr.startsWith("#")) sameOrigin.set(u.toString(), attr);
        if (hash) hashChecks.set(`${u.pathname}#${hash}`, { path: u.toString(), hash: decodeURIComponent(hash) });
      }
      const statusLog: { url: string; status: number; location: string | null }[] = [];
      for (const url of sameOrigin.keys()) {
        const s = await statusOf(page, url);
        statusLog.push({ url: url.replace(origin, ""), ...s });
        if (s.status >= 400) defects.linkStatus.push(`${s.status} ${url.replace(origin, "")}`);
        else if (s.status >= 300) note("redirect", `${s.status} ${url.replace(origin, "")} -> ${s.location}`);
      }
      const here = new URL(page.url());
      for (const { path: p, hash } of hashChecks.values()) {
        const u = new URL(p);
        let found: boolean;
        if (u.pathname === here.pathname && root === null) {
          found = await page.evaluate((h) => !!document.getElementById(h), hash);
        } else {
          const body = await htmlOf(page, p);
          found = body.includes(`id="${hash}"`);
        }
        if (!found) defects.linkHash.push(`${u.pathname}#${hash} has no target id`);
      }

      // -- 5. target size (before the effect phase reloads the page) --------
      for (const c of ctls) {
        if (c.offscreen || c.inline) continue;
        const { w, h } = c.size;
        if (w >= TARGET_MIN && h >= TARGET_MIN) continue;
        if (KNOWN_D69(c)) {
          note("known-D69", `${c.role} "${c.name}" ${w.toFixed(1)}x${h.toFixed(1)} (16px thumbs; accepted)`);
          continue;
        }
        // Spacing exemption: a 24px circle on the centre touches no other target.
        const cx = c.rect.x + c.rect.w / 2;
        const cy = c.rect.y + c.rect.h / 2;
        const clash = ctls.some((o) => {
          if (o.id === c.id || o.offscreen) return false;
          const nx = Math.max(o.rect.x, Math.min(cx, o.rect.x + o.rect.w));
          const ny = Math.max(o.rect.y, Math.min(cy, o.rect.y + o.rect.h));
          return Math.hypot(nx - cx, ny - cy) < TARGET_MIN / 2;
        });
        if (clash) {
          defects.targetSize.push(
            `${c.role} "${c.name || c.text}" ${c.href ?? ""} is ${w.toFixed(1)}x${h.toFixed(1)}px and another target sits within 12px of its centre`,
          );
        }
      }

      // -- 4. observable effect --------------------------------------------
      const isInert = route.name === "styleguide";
      if (isInert) {
        note("effect-skipped", "styleguide specimens are inert demos (Server Component, no handlers, no form)");
      }
      const activatable = ctls.filter((c) => {
        if (isInert || c.offscreen || c.ariaHidden || c.submit || c.textEntry) return false;
        if (c.tag === "a") return false;
        if (c.tag === "input" && c.type === "radio" && c.checked) return false;
        return ["button", "combobox", "checkbox", "radio", "slider"].includes(c.role) || c.tag === "summary";
      });
      const activated: { sig: string; effect: string[]; skipped?: string }[] = [];
      let dirty = false;
      for (const c0 of activatable) {
        if (dirty) {
          await load(page, route.path, state);
          dirty = false;
        }
        const fresh = (await page.evaluate(enumerateInPage, root)).controls;
        const c = fresh.find((x) => x.sig === c0.sig);
        if (!c) {
          defects.effect.push(`${c0.role} "${c0.name}" vanished after reload (unstable DOM)`);
          continue;
        }
        const target = page.locator(c.clickId != null ? `[data-crawl-click="${c.id}"]` : `[data-crawl-id="${c.id}"]`);
        const label = `${c.role} "${c.name || c.text}"${c.href ? ` ${c.href}` : ""} [${c.probes.slice(0, 2).join(">") || "-"}]`;
        await target.evaluate((el) => el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" as ScrollBehavior }));
        await page.evaluate(
          () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
        );
        const before = await page.evaluate(snapInPage);
        const requiresUrl =
          (c.tag === "select" || c.tag === "input") &&
          c.probes.some((p) => ["rail", "sheet", "sort-toolbar", "sort-bar"].includes(p));
        try {
          if (c.tag === "select") {
            const pick = await page.evaluate((id) => {
              const s = document.querySelector<HTMLSelectElement>(`[data-crawl-id="${id}"]`)!;
              const usable = (o: HTMLOptionElement) => {
                const g = o.closest("optgroup");
                return !o.disabled && !o.hidden && !(g && (g.disabled || g.hidden));
              };
              return Array.from(s.options).find((o) => usable(o) && o.value !== s.value)?.value ?? null;
            }, c.id);
            if (pick === null) {
              activated.push({ sig: c.sig, effect: [], skipped: "no alternative option" });
              continue;
            }
            await target.selectOption(pick, { timeout: 4000 });
          } else if (c.role === "slider") {
            // Only the 16px thumb takes the pointer (`range-input`), and WebKit
            // does not focus a range on a bare click, so drag the thumb: real
            // pointer input on every engine.
            const geo = await target.evaluate((el) => {
              const i = el as HTMLInputElement;
              const lo = Number(i.min || 0);
              const hi = Number(i.max || 100);
              return { frac: hi > lo ? (Number(i.value) - lo) / (hi - lo) : 0 };
            });
            const box = await target.boundingBox();
            if (!box) throw new Error("slider has no box");
            const x = box.x + 8 + geo.frac * (box.width - 16);
            const y = box.y + box.height / 2;
            await page.mouse.move(x, y);
            await page.mouse.down();
            await page.mouse.move(x + (geo.frac < 0.5 ? 40 : -40), y, { steps: 8 });
            await page.mouse.up();
          } else {
            await target.click({ timeout: 4000 });
          }
        } catch (e) {
          defects.effect.push(`${label}: real activation failed: ${(e as Error).message.split("\n")[0]}`);
          dirty = true;
          continue;
        }
        dirty = true;
        let after = before;
        let kinds: string[] = [];
        try {
          await expect
            .poll(
              async () => {
                after = await page.evaluate(snapInPage);
                kinds = diffKinds(before, after, c.id);
                return requiresUrl ? kinds.includes("url") : kinds.length > 0;
              },
              { timeout: 4500, intervals: [50, 100, 200, 400] },
            )
            .toBe(true);
        } catch {
          /* handled below */
        }
        activated.push({ sig: c.sig, effect: kinds });
        if (requiresUrl && !kinds.includes("url")) {
          defects.effect.push(`${label}: changed [${kinds.join(",") || "nothing"}] but the URL did not update (D44)`);
        } else if (kinds.length === 0) {
          defects.effect.push(`${label}: no observable effect after activation`);
        }
      }

      // -- evidence ---------------------------------------------------------
      const summary = {
        route: route.name,
        state,
        project: info.project.name,
        controls: ctls.length,
        candidates: en.counts,
        byRole: ctls.reduce<Record<string, number>>((m, c) => ((m[c.role] = (m[c.role] ?? 0) + 1), m), {}),
        hitTested: hits.length,
        links: rawLinks.length,
        uniqueHrefs: uniqueAttr.size,
        sameOriginChecked: sameOrigin.size,
        tel: telCount,
        mailto: mailtoCount,
        external: externals.length,
        activated: activated.length,
        activationSkipped: activated.filter((a) => a.skipped).length,
        defects: Object.fromEntries(Object.entries(defects).map(([k, v]) => [k, v.length])),
      };
      const evidence = {
        summary,
        notes,
        defects,
        externals,
        linkStatus: statusLog,
        controls: ctls.map((c) => ({
          role: c.role,
          tag: c.tag,
          name: c.name,
          href: c.href,
          probes: c.probes.slice(0, 3),
          rect: c.rect,
          size: c.size,
          hit: hits.find((h) => h.id === c.id)?.ok ?? null,
        })),
        activated,
      };
      const json = JSON.stringify(evidence, null, 2);
      await info.attach(`crawl-${route.name}-${state}.json`, { body: json, contentType: "application/json" });
      if (process.env.CRAWL_EVIDENCE_DIR) {
        const dir = path.join(process.env.CRAWL_EVIDENCE_DIR, info.project.name);
        mkdirSync(dir, { recursive: true });
        writeFileSync(path.join(dir, `${route.name}.${state}.json`), json);
      }
      console.log(`CRAWL-SUMMARY ${JSON.stringify(summary)}`);

      expect(ctls.length, "the crawl found no controls: the enumeration is broken").toBeGreaterThan(0);
      expect.soft(defects.interception, "hit-test: elementFromPoint at the box centre is not the control").toEqual([]);
      expect.soft(defects.emptyName, "accessibility tree: controls with no name").toEqual([]);
      expect.soft(defects.duplicateName, "links sharing a name but pointing at different targets").toEqual([]);
      expect.soft(defects.focusableHidden, "tabbable controls inside aria-hidden").toEqual([]);
      expect.soft(defects.deadHref, 'links with href="#", empty or javascript:').toEqual([]);
      expect.soft(defects.scheme, "unexpected link schemes").toEqual([]);
      expect.soft(defects.tel, "tel: links must be E.164 and PRIMARY_CONTACT").toEqual([]);
      expect.soft(defects.mailto, "mailto: links must be well formed").toEqual([]);
      expect.soft(defects.linkStatus, "same-origin links answering >= 400").toEqual([]);
      expect.soft(defects.linkHash, "#fragments with no target").toEqual([]);
      expect.soft(defects.effect, "controls with no observable effect").toEqual([]);
      expect.soft(defects.targetSize, "WCAG 2.5.8 targets under 24x24 CSS px").toEqual([]);
    });
  }
}
