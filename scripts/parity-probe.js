/**
 * Parity probe — the measurement half of docs/decisions.md §9.
 *
 * Paste the body of `probe` into the browser console (or run it through the
 * browser tool's javascript_exec) against BOTH the artboard and the app at the
 * same viewport, then diff the two JSON blobs into design/reports/<page>.md.
 *
 * Usage in the page:
 *   probe([
 *     ['hero headline', 'h1'],
 *     ['hero eyebrow',  '[data-probe="eyebrow"]'],
 *     ['finder panel',  '[data-probe="finder"]'],
 *   ])
 *
 * The artboard exports have no data-attributes, so pass real CSS selectors or
 * nth-of-type paths for the baseline and data-probe hooks for the app.
 * Never eyeball a match — every row in the report comes from this.
 */

const PROPS = [
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "text-transform",
  "color",
  "background-color",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-top-color",
  "border-radius",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin-top",
  "margin-bottom",
  "gap",
  "row-gap",
  "column-gap",
  "grid-template-columns",
  "flex-direction",
  "align-items",
  "justify-content",
  "text-align",
  "object-fit",
  "font-variant-numeric",
];

function probe(pairs) {
  const out = {
    viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
    scrollWidth: document.documentElement.scrollWidth,
    horizontalOverflow:
      document.documentElement.scrollWidth > document.documentElement.clientWidth,
    elements: {},
    missing: [],
  };

  for (const [label, selector] of pairs) {
    const el = document.querySelector(selector);
    if (!el) {
      out.missing.push({ label, selector });
      continue;
    }
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const style = {};
    for (const p of PROPS) style[p] = cs.getPropertyValue(p);
    out.elements[label] = {
      selector,
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || "").trim().slice(0, 80),
      box: {
        x: +r.x.toFixed(1),
        y: +r.y.toFixed(1),
        w: +r.width.toFixed(1),
        h: +r.height.toFixed(1),
      },
      style,
    };
  }
  return out;
}

/** Every element that overflows the viewport horizontally — the 375/768/1280 gate. */
function overflowers() {
  const vw = document.documentElement.clientWidth;
  return [...document.querySelectorAll("*")]
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { el, right: r.right, left: r.left, w: r.width };
    })
    .filter((x) => x.right > vw + 1 || x.left < -1)
    .slice(0, 25)
    .map((x) => ({
      tag: x.el.tagName.toLowerCase(),
      cls: (x.el.className || "").toString().slice(0, 90),
      left: +x.left.toFixed(1),
      right: +x.right.toFixed(1),
      width: +x.w.toFixed(1),
      viewport: vw,
    }));
}

/** Count accent-coloured elements in a subtree — the one-accent-per-frame audit. */
function accentCount(rootSelector, accent = "rgb(201, 242, 58)") {
  const root = document.querySelector(rootSelector);
  if (!root) return { error: "root not found: " + rootSelector };
  const hits = [];
  for (const el of [root, ...root.querySelectorAll("*")]) {
    const cs = getComputedStyle(el);
    const where = [];
    if (cs.backgroundColor === accent) where.push("background");
    if (cs.color === accent) where.push("color");
    for (const side of ["Top", "Right", "Bottom", "Left"]) {
      if (
        cs[`border${side}Color`] === accent &&
        parseFloat(cs[`border${side}Width`]) > 0
      ) {
        where.push("border-" + side.toLowerCase());
      }
    }
    if (where.length) {
      hits.push({
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || "").trim().slice(0, 40),
        where,
      });
    }
  }
  return { root: rootSelector, count: hits.length, hits };
}

if (typeof module !== "undefined") {
  module.exports = { probe, overflowers, accentCount, PROPS };
}
