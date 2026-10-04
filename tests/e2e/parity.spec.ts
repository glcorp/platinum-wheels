/**
 * PARITY — computed style + box of the app against the frozen artboards
 * (`docs/decisions.md` §9, `design/reports/README.md`).
 *
 * The artboards are served on :4000 (D36; the config's second webServer).
 * Every row below is a row of `design/reports/{home,results,product}.md` that
 * the report marks ✓, measured again here in both documents. A delta outside
 * the README tolerances fails the page's test with the row, the property and
 * both numbers. Where a later DEVIATIONS row or D-row moved a drawn value, the
 * row carries `dev` — the value the app is now EXPECTED to have — and the
 * citation, so a known deviation is asserted, not ignored.
 *
 * Chromium only, run in project `chromium-1440`; the viewport is set per test.
 * The app is measured with reduced motion so no reveal or transition is caught
 * mid-flight (a transform moves `getBoundingClientRect`).
 */
import { test, expect, type Page } from "@playwright/test";
import { SLUG, VEHICLE, settle, skipQuoteTimer } from "../helpers";

// D104: the quote form drops a submit made within 3 s of render; see helpers.ts.
test.beforeEach(async ({ page }) => {
  await skipQuoteTimer(page);
});

const DESIGN = "http://localhost:4000";

/* `scripts/parity-probe.js` PROPS, ported verbatim. */
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
] as const;

type CssProp = (typeof PROPS)[number];
/** Box keys are document coordinates (`y` includes scroll), as in the reports. */
type Prop = CssProp | "opacity" | "x" | "y" | "w" | "h";

/**
 * How to find one element in a document. `text` is matched against the
 * whitespace-collapsed `textContent` of the deepest rendered element carrying
 * it (or starting with it, when `prefix`); `css` is a selector. Then `up`
 * climbs to an ancestor and `child` descends to an element child — the
 * artboards have no hooks, so structure is the only handle on a box.
 */
interface Loc {
  text?: string;
  css?: string;
  prefix?: boolean;
  nth?: number;
  up?: number;
  child?: number;
}

interface Row {
  label: string;
  design: Loc;
  /** Defaults to `design` when both documents carry the same text. */
  app?: Loc;
  props: Prop[];
  /** App values that a DEVIATIONS / D-row now requires instead of the drawn one. */
  dev?: Partial<Record<Prop, string | number>>;
  /** The row(s) that justify every `dev` entry. */
  cite?: string;
}

interface Board {
  name: string;
  artboard: string;
  app: string;
  viewport: { width: number; height: number };
  rows: Row[];
}

interface Measured {
  tag: string;
  text: string;
  values: Record<string, string | number>;
}

const t = (text: string, extra: Omit<Loc, "text"> = {}): Loc => ({ text, ...extra });
const css = (sel: string, extra: Omit<Loc, "css"> = {}): Loc => ({ css: sel, ...extra });

const TYPE: Prop[] = ["font-family", "font-size", "font-weight", "line-height", "letter-spacing", "text-transform", "color"];
const RESULTS_STAGED = `/tires?width=215&profile=55&rim=16&${VEHICLE}`;
const PDP_STAGED = `/products/${SLUG.tire}?${VEHICLE}&qty=4`;

/* ------------------------------------------------------------------------ */
/* Rows                                                                      */
/* ------------------------------------------------------------------------ */

const HOME_H1 = "The right tires. Confirmed by people who know.";

const BOARDS: Board[] = [
  {
    name: "home 1440",
    artboard: "/home-desktop",
    app: "/",
    viewport: { width: 1440, height: 900 },
    rows: [
      { label: "header bar", design: t("Wheels", { up: 2 }), app: css("header"), props: ["h", "background-color"] },
      {
        label: "nav Wheels (inactive)",
        design: t("Wheels"),
        props: ["font-size", "font-weight", "letter-spacing", "color", "x", "y", "w", "h"],
        dev: { x: 532.02 },
        cite: "DEVIATIONS #66, corrected D91b (VPE-7: the wider D76 pill pulls the nav 14.6px left)",
      },
      {
        label: "header phone CTA",
        design: t("Call 647-989-6178"),
        app: css('header a[href^="tel:"]'),
        props: ["h", "font-size", "font-weight", "letter-spacing", "border-top-color", "gap", "padding-left", "w", "y"],
        dev: { w: 223.48 },
        cite: "DEVIATIONS #66 / D76 (pill widens 195.02 → 223.48)",
      },
      {
        label: "hero eyebrow",
        design: t(HOME_H1, { up: 1, child: 0 }),
        app: css('[data-probe="hero-eyebrow"]'),
        props: ["font-size", "font-weight", "letter-spacing", "color", "text-transform", "x", "y"],
      },
      { label: "h1", design: t(HOME_H1), app: css('[data-probe="hero-h1"]'), props: [...TYPE, "x", "y"], cite: "DEVIATIONS #113 / D140 (copy rewritten; width and wrap follow the new words)" },
      {
        label: "hero lede",
        design: t("Search by your vehicle", { prefix: true }),
        app: css('[data-probe="hero-lede"]'),
        props: ["font-size", "font-weight", "line-height", "color", "opacity", "y", "w"],
        dev: { opacity: "1" },
        cite: "DEVIATIONS #58 / D67 (opacity-82 dropped)",
      },
      {
        label: "finder panel",
        design: t("Year", { up: 3 }),
        app: css('[data-probe="finder"]'),
        props: ["padding-top", "padding-left", "background-color", "border-top-width", "border-top-color", "x", "y", "w", "h"],
      },
      {
        label: "finder row",
        design: t("Year", { up: 2 }),
        app: css('[data-probe="finder"]', { child: 0 }),
        props: ["grid-template-columns", "column-gap"],
      },
      {
        label: "finder label",
        design: t("Year"),
        app: t("Year", { nth: 0 }),
        props: ["font-size", "font-weight", "letter-spacing", "color", "text-transform"],
      },
      {
        label: "finder CTA",
        design: t("Find my tires", { prefix: true }),
        props: ["h", "w", "font-size", "font-weight", "letter-spacing", "background-color", "color"],
      },
      { label: "tiles h2", design: t("Everything between you and the road."), app: t("Tires, wheels and accessories."), props: [...TYPE, "x", "y"], cite: "DEVIATIONS #113 / D140 (copy rewritten; width and wrap follow the new words)" },
      { label: "promo h2", design: t("Book your winter set before the first snow."), props: [...TYPE, "x", "y", "w"] },
      {
        label: "promo copy panel",
        design: t("Book your winter set before the first snow.", { up: 1 }),
        props: ["background-color", "padding-top", "padding-left", "row-gap", "w", "h"],
      },
      {
        label: "promo CTA",
        design: t("Shop winter tires"),
        props: ["h", "w", "padding-left", "font-size", "letter-spacing", "background-color", "color"],
      },
      { label: "hiw numeral", design: t("01"), props: ["font-size", "line-height", "color", "y"] },
      {
        label: "hiw grid",
        design: t("01", { up: 2 }),
        app: css('[data-probe="hiw"]'),
        props: ["grid-template-columns", "border-top-color", "border-top-width", "y"],
      },
      { label: "featured h2", design: t("Winter sets, in stock now."), props: ["font-size", "line-height", "x", "y"] },
      {
        label: "product card",
        design: t("Antarctica Sport", { up: 3 }),
        app: t("Antarctica Sport", { nth: 0, up: 3, prefix: true }),
        props: ["w", "h", "background-color", "border-top-color", "x", "y"],
      },
      {
        label: "brand strip item",
        design: t("ZMAX", { nth: 4 }),
        props: ["font-size", "line-height", "letter-spacing", "color", "w"],
      },
      {
        label: "brand strip",
        design: t("ZMAX", { nth: 4, up: 1 }),
        app: css('[data-probe="brands"]'),
        props: ["padding-top", "padding-left", "grid-template-columns", "background-color", "y"],
      },
      { label: "contact h2", design: t("Platinum Wheels"), props: ["font-size", "line-height", "y"] },
      {
        label: "contact card",
        design: t("Inderpal Singh", { up: 1 }),
        props: ["w", "padding-top", "row-gap", "border-top-color", "background-color", "x", "y"],
      },
      { label: "contact name", design: t("Inderpal Singh"), props: ["font-size", "line-height", "letter-spacing"] },
      {
        label: "contact phone",
        design: t("647-989-6178"),
        app: css('[data-probe="contact-phone-1"]'),
        props: ["h", "font-size", "font-weight", "border-top-color", "padding-left", "w"],
        dev: { w: 215.5 },
        cite: "DEVIATIONS #66 / D76 (184.6 → 215.5)",
      },
      { label: "footer heading", design: t("Shop"), props: ["font-size", "font-weight", "letter-spacing", "color", "y"] },
    ],
  },
  {
    name: "home 390",
    artboard: "/home-mobile",
    app: "/",
    viewport: { width: 390, height: 844 },
    rows: [
      {
        label: "hero eyebrow",
        design: t("Brampton", { prefix: true }),
        app: css('[data-probe="hero-eyebrow"]'),
        props: ["font-size", "font-weight", "line-height", "letter-spacing", "color", "x", "y"],
      },
      { label: "h1", design: t(HOME_H1), app: css('[data-probe="hero-h1"]'), props: [...TYPE, "x", "y"], cite: "DEVIATIONS #113 / D140 (copy rewritten; width and wrap follow the new words)" },
      {
        label: "hero lede",
        design: t("Search by your vehicle", { prefix: true }),
        app: css('[data-probe="hero-lede"]'),
        props: ["font-size", "line-height", "color", "opacity", "y"],
        dev: { opacity: "1" },
        cite: "DEVIATIONS #58 / D67",
      },
      {
        label: "finder panel",
        design: t("Year", { up: 2 }),
        app: css('[data-probe="finder"]'),
        props: ["padding-top", "row-gap", "background-color", "border-top-color", "x", "y", "w", "h"],
      },
      { label: "finder label", design: t("Year"), props: ["font-size", "font-weight", "letter-spacing", "color"] },
      {
        label: "finder CTA",
        design: t("Find my tires", { prefix: true }),
        props: ["h", "w", "x", "y", "font-size", "letter-spacing", "background-color"],
      },
      { label: "tiles h2", design: t("Everything between you and the road."), app: t("Tires, wheels and accessories."), props: [...TYPE, "y"], cite: "DEVIATIONS #113 / D140 (copy rewritten; width and wrap follow the new words)" },
      {
        label: "tile Tires",
        design: t("Tires", { nth: 0, up: 2 }),
        app: css('[data-probe="tile-tires"]'),
        props: ["w", "h", "x", "y"],
      },
      { label: "tile label", design: t("Tires", { nth: 0 }), props: ["font-size", "line-height", "x"] },
      { label: "promo h2", design: t("Book your winter set before the first snow."), props: ["font-size", "line-height", "letter-spacing", "y", "w"] },
      { label: "hiw numeral", design: t("01"), props: ["font-size", "line-height", "letter-spacing", "y"] },
      { label: "featured h2", design: t("Winter sets, in stock now."), props: ["font-size", "y", "w"] },
      { label: "brand strip item", design: t("ZMAX", { nth: 4 }), props: ["font-size", "letter-spacing", "x", "y"] },
      { label: "contact h2", design: t("Platinum Wheels"), props: ["font-size", "y"] },
      {
        label: "contact card",
        design: t("Inderpal Singh", { up: 1 }),
        props: ["padding-top", "row-gap", "w", "h", "y"],
      },
    ],
  },
  {
    name: "results 1440",
    artboard: "/results-desktop",
    app: RESULTS_STAGED,
    viewport: { width: 1440, height: 900 },
    rows: [
      {
        label: "breadcrumb",
        design: t("Home", { prefix: true }),
        app: css('[data-probe="breadcrumb"]'),
        props: ["font-size", "font-weight", "letter-spacing", "color", "text-transform", "x", "y", "w"],
      },
      {
        label: "vehicle chip",
        design: t("2021 Honda Civic"),
        app: css('[data-probe="vehicle-chip"]'),
        props: ["font-size", "font-weight", "padding-left", "background-color", "border-top-color", "x", "y", "w", "h"],
        dev: { "background-color": "rgba(201, 242, 58, 0.12)", "border-top-color": "rgb(201, 242, 58)" },
        cite: "DEVIATIONS #61 / D72",
      },
      {
        label: "Change vehicle",
        design: t("Change vehicle"),
        props: ["font-size", "font-weight", "color", "letter-spacing", "text-transform", "x", "y"],
        dev: { "letter-spacing": "0px", "text-transform": "none" },
        cite: "DEVIATIONS #62 / D72",
      },
      {
        label: "Sort label",
        design: t("Sort"),
        app: css('[data-probe="sort-label"]'),
        props: ["font-size", "font-weight", "letter-spacing", "color", "x", "y"],
      },
      {
        label: "sort box",
        design: t("Best match", { up: 1 }),
        app: css('[data-probe="sort-toolbar"] select'),
        props: ["h", "w", "x", "y", "background-color", "border-radius", "padding-left", "border-top-color"],
        dev: { "border-top-color": "rgb(105, 105, 111)" },
        cite: "DEVIATIONS #14 / #28",
      },
      {
        label: "rail",
        design: t("Filters", { up: 2 }),
        app: css('[data-probe="rail"]'),
        props: ["x", "y", "w"],
      },
      {
        label: "Filters title",
        design: t("Filters"),
        app: css('[data-probe="rail"] [data-probe="filters-title"]'),
        props: [...TYPE, "x", "y", "w", "h"],
      },
      {
        label: "Clear all",
        design: t("Clear all"),
        app: css('[data-probe="rail"] [data-probe="clear-all"]'),
        props: ["font-size", "letter-spacing", "color", "x", "y"],
      },
      {
        label: "first group shell (size; Category removed)",
        design: t("Category", { up: 2 }),
        app: css('[data-probe="rail"] [data-probe="group-size"]'),
        props: ["border-top-color", "border-top-width", "padding-top", "y"],
        cite: "DEVIATIONS #60: the size group's border-top lands where Category's did (y 264)",
      },
      { label: "group label", design: t("Tire size"), props: ["font-size", "font-weight", "letter-spacing", "color", "h"] },
      { label: "size caption", design: t("Width"), props: ["font-size", "letter-spacing", "color"] },
      {
        label: "size grid",
        design: t("Width", { up: 2 }),
        app: t("Width", { up: 2 }),
        props: ["grid-template-columns", "column-gap", "h"],
      },
      {
        label: "chip (rest)",
        design: t("Summer"),
        app: t("Summer", { nth: 0 }),
        props: ["font-size", "font-weight", "color", "border-top-color", "border-radius", "padding-left", "h", "w"],
      },
      { label: "brand name", design: t("Zeta", { nth: 0 }), props: ["font-size", "color", "x"] },
      { label: "price group label", design: t("Price per tire"), props: ["font-size", "letter-spacing", "color"] },
      { label: "Best matches", design: t("Best matches"), props: [...TYPE, "x", "y", "w"] },
      {
        label: "product card",
        design: t("Antarctica Sport", { nth: 0, up: 3 }),
        // The app's model link carries an sr-only size tail (2.4.4, D93b).
        app: t("Antarctica Sport", { nth: 0, up: 3, prefix: true }),
        props: ["w", "h", "background-color", "border-top-color", "x"],
      },
      {
        label: "best grid",
        design: t("Antarctica Sport", { nth: 0, up: 4 }),
        app: t("Antarctica Sport", { nth: 0, up: 4, prefix: true }),
        props: ["grid-template-columns", "column-gap", "x"],
      },
      { label: "Similar matches", design: t("Similar matches"), props: ["font-size", "line-height", "x", "w"] },
      {
        label: "similar header",
        design: t("Similar matches", { up: 1 }),
        props: ["border-top-color", "border-top-width", "padding-top"],
      },
      {
        label: "Load more",
        design: t("Load more"),
        props: ["h", "w", "padding-left", "font-size", "letter-spacing", "border-top-color", "border-radius", "x"],
      },
    ],
  },
  {
    name: "results 390",
    artboard: "/results-mobile",
    app: RESULTS_STAGED,
    viewport: { width: 390, height: 844 },
    rows: [
      {
        label: "breadcrumb",
        design: t("Home", { prefix: true }),
        app: css('[data-probe="breadcrumb"]'),
        props: ["font-size", "font-weight", "letter-spacing", "color", "x", "y"],
      },
      {
        label: "breadcrumb row height",
        design: t("Home", { prefix: true }),
        app: css('[data-probe="breadcrumb"]', { up: 1 }),
        props: ["h", "y"],
      },
      {
        label: "vehicle chip",
        design: t("2021 Honda Civic"),
        app: css('[data-probe="vehicle-chip"]'),
        props: ["h", "w", "x", "y", "background-color", "border-top-color"],
        dev: { "background-color": "rgba(201, 242, 58, 0.12)", "border-top-color": "rgb(201, 242, 58)" },
        cite: "DEVIATIONS #61",
      },
      {
        label: "Change vehicle",
        design: t("Change vehicle"),
        props: ["font-size", "letter-spacing", "text-transform", "padding-top"],
        dev: { "letter-spacing": "0px", "text-transform": "none" },
        cite: "DEVIATIONS #62",
      },
      {
        label: "sticky bar",
        design: t("Filters", { prefix: true, up: 1 }),
        app: css('[data-probe="sticky-bar"]'),
        props: ["h", "padding-top", "padding-left", "background-color", "border-top-color", "grid-template-columns", "column-gap", "y"],
        // The drawn count row (14px) and its 12px gap left the toolbar (#63),
        // so the bar sits 26px above its drawn 197.
        dev: { y: 171 },
        cite: "DEVIATIONS #63 / D72 (count row removed: 197 − 14 − 12)",
      },
      {
        label: "Filters (n)",
        design: t("Filters", { prefix: true }),
        app: css('[data-probe="filters-trigger"]'),
        props: ["h", "w", "x", "border-top-color", "font-size", "font-weight", "letter-spacing"],
      },
      {
        label: "sort control",
        design: t("Sort: Best match", { prefix: true }),
        app: css('[data-probe="sort-bar"] select'),
        props: ["h", "w", "x", "font-size", "letter-spacing", "border-top-color"],
        dev: { "border-top-color": "rgb(105, 105, 111)" },
        cite: "DEVIATIONS #14 / #28 / #30",
      },
      { label: "Best matches", design: t("Best matches"), props: [...TYPE, "x", "w"] },
      {
        label: "product card",
        design: t("Antarctica Sport", { nth: 0, up: 3 }),
        // The app's model link carries an sr-only size tail (2.4.4, D93b).
        app: t("Antarctica Sport", { nth: 0, up: 3, prefix: true }),
        props: ["w", "h", "x", "background-color", "border-top-color"],
      },
      {
        label: "Load more",
        design: t("Load more"),
        props: ["h", "w", "border-top-color", "border-radius", "font-size", "letter-spacing"],
      },
      {
        label: "call panel",
        design: t("Not sure which one?", { up: 1 }),
        app: css('[data-probe="call-panel"]'),
        props: ["w", "h", "padding-top", "row-gap", "background-color", "border-top-color"],
      },
      { label: "call panel heading", design: t("Not sure which one?"), props: TYPE },
      { label: "call panel body", design: t("Call the shop", { prefix: true }), props: ["font-size", "line-height", "color"] },
    ],
  },
  {
    name: "product 1440",
    artboard: "/product-desktop",
    app: PDP_STAGED,
    viewport: { width: 1440, height: 900 },
    rows: [
      {
        label: "breadcrumb type",
        design: t("Home", { prefix: true }),
        app: t("Home", { prefix: true, up: 2 }),
        props: ["font-size", "font-weight", "letter-spacing", "text-transform", "color", "x"],
      },
      {
        label: "breadcrumb block height",
        design: t("Home", { prefix: true }),
        app: css('nav[aria-label="Breadcrumb"]:visible'),
        props: ["h", "y"],
      },
      {
        label: "badge Winter",
        design: t("Winter", { nth: 0 }),
        props: ["h", "padding-left", "background-color", "color", "font-size", "line-height", "letter-spacing", "x", "y"],
      },
      {
        label: "brand label",
        design: css("h1", { up: 1, child: 0 }),
        props: ["font-size", "font-weight", "letter-spacing", "text-transform", "color", "x", "y"],
      },
      { label: "h1", design: css("h1"), props: [...TYPE, "x", "y", "w"] },
      {
        label: "size numeral",
        design: t("215/55R16 97T XL"),
        props: ["font-size", "font-weight", "line-height", "color", "font-variant-numeric", "h", "y"],
      },
      {
        label: "price amount",
        design: t("$129", { prefix: true }),
        props: ["font-size", "font-weight", "letter-spacing", "color", "font-variant-numeric", "x", "h", "y"],
      },
      { label: "price suffix", design: t("per tire · before tax"), props: ["font-size", "line-height", "color"] },
      {
        label: "quantity grid",
        design: t("Custom", { up: 2 }),
        props: ["grid-template-columns", "column-gap", "h", "w", "y"],
      },
      {
        label: "quantity cell Custom",
        design: t("Custom", { up: 1 }),
        props: ["h", "w", "background-color", "border-top-color", "padding-left"],
      },
      {
        label: "CTA primary",
        design: t("Request a quote", { prefix: true, nth: 0 }),
        props: ["h", "w", "x", "y", "font-size", "letter-spacing", "text-transform", "background-color", "color", "border-radius"],
      },
      {
        label: "CTA secondary",
        design: t("Call us", { prefix: true }),
        props: ["h", "w", "background-color", "border-top-color", "color"],
      },
      { label: "Specifications h2", design: t("Specifications"), props: ["font-size", "line-height", "letter-spacing", "x", "y", "w"] },
      {
        label: "spec row",
        design: t("Brand", { nth: 0, up: 1 }),
        props: ["h", "padding-left", "background-color", "grid-template-columns", "x", "w"],
      },
      { label: "spec key", design: t("Brand", { nth: 0 }), props: ["font-size", "color", "text-align", "x"] },
      {
        label: "quote band",
        design: t("Tell us where to send it.", { up: 3 }),
        app: css('[data-probe="quote-band"]'),
        props: ["padding-top", "padding-left", "background-color", "border-top-color", "y", "h"],
        dev: { h: 833 },
        cite: "DEVIATIONS #80 / D91b (VPE-6: the consent row's 44px floor, 807 → 833)",
      },
      {
        label: "quote eyebrow",
        design: t("Tell us where to send it.", { up: 1, child: 0 }),
        props: ["font-size", "letter-spacing", "text-transform", "color"],
      },
      { label: "quote h2", design: t("Tell us where to send it."), props: [...TYPE, "x", "w"] },
      {
        label: "quote chip",
        design: t("Inquiring about", { up: 1 }),
        app: css('[data-probe="quote-chip"]'),
        props: ["padding-top", "padding-left", "background-color", "border-top-color", "w", "h"],
      },
      {
        label: "Send inquiry",
        design: t("Send inquiry", { prefix: true }),
        props: ["h", "w", "x", "font-size", "letter-spacing", "padding-left", "background-color"],
        dev: { "background-color": "rgb(201, 242, 58)" },
        cite: "DEVIATIONS #37 (drawn pre-hovered)",
      },
      { label: "Similar products h2", design: t("Similar products"), props: ["font-size", "x", "w"] },
    ],
  },
  {
    name: "product 390",
    artboard: "/product-mobile",
    app: PDP_STAGED,
    viewport: { width: 390, height: 844 },
    rows: [
      {
        label: "breadcrumb",
        design: t("Home", { prefix: true }),
        app: t("Home", { prefix: true, up: 2 }),
        props: ["font-size", "letter-spacing", "color", "x", "y", "w"],
      },
      {
        label: "brand label",
        design: css("h1", { up: 1, child: 0 }),
        props: ["font-size", "letter-spacing", "x", "y"],
      },
      { label: "h1", design: css("h1"), props: [...TYPE, "x", "y", "w", "h"] },
      { label: "size numeral", design: t("215/55R16 97T XL"), props: ["font-size", "line-height", "h", "y"] },
      { label: "price amount", design: t("$129", { prefix: true }), props: ["font-size", "letter-spacing", "x", "h", "y"] },
      {
        label: "quantity grid",
        design: t("Custom", { up: 2 }),
        props: ["grid-template-columns", "column-gap", "h", "y"],
      },
      {
        label: "CTA primary",
        design: t("Request a quote", { prefix: true, nth: 0 }),
        props: ["h", "w", "font-size", "letter-spacing", "y"],
      },
      { label: "Specifications h2", design: t("Specifications"), props: ["font-size", "x", "w", "y"] },
      { label: "spec row", design: t("Brand", { nth: 0, up: 1 }), props: ["h", "padding-left", "x", "w"] },
      { label: "quote h2", design: t("Tell us where to send it."), props: ["font-size", "line-height", "x", "w"] },
      { label: "Similar products h2", design: t("Similar products"), props: ["font-size", "x"] },
    ],
  },
];

/* ------------------------------------------------------------------------ */
/* Measurement (runs in the page)                                            */
/* ------------------------------------------------------------------------ */

async function measure(page: Page, locs: Loc[], props: string[]) {
  return page.evaluate(
    ({ locs, props }) => {
      const norm = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim();
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 || r.height > 0;
      };
      const find = (loc: Loc): Element | null => {
        let el: Element | null = null;
        if (loc.css) {
          const sel = loc.css.replace(/:visible$/, "");
          const all = [...document.querySelectorAll(sel)].filter(visible);
          el = all[loc.nth ?? 0] ?? null;
        } else if (loc.text !== undefined) {
          const want = loc.text;
          const hit = (e: Element) =>
            loc.prefix ? norm(e.textContent).startsWith(want) : norm(e.textContent) === want;
          const all = [...document.querySelectorAll("body *")].filter(
            (e) => hit(e) && ![...e.children].some(hit) && visible(e),
          );
          el = all[loc.nth ?? 0] ?? null;
        }
        for (let i = 0; el && i < (loc.up ?? 0); i++) el = el.parentElement;
        if (el && loc.child !== undefined) el = el.children[loc.child] ?? null;
        return el;
      };
      return locs.map((loc) => {
        const el = find(loc);
        if (!el) return null;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        const values: Record<string, string | number> = {
          x: +r.left.toFixed(2),
          y: +(r.top + scrollY).toFixed(2),
          w: +r.width.toFixed(2),
          h: +r.height.toFixed(2),
        };
        for (const p of props) {
          if (!["x", "y", "w", "h"].includes(p)) values[p] = cs.getPropertyValue(p);
        }
        return { tag: el.tagName.toLowerCase(), text: norm(el.textContent).slice(0, 40), values };
      });
    },
    { locs, props },
  ) as Promise<(Measured | null)[]>;
}

/* ------------------------------------------------------------------------ */
/* Tolerances (`design/reports/README.md` "Thresholds")                      */
/* ------------------------------------------------------------------------ */

const px = (v: string | number) => {
  if (typeof v === "number") return v;
  if (v === "normal" || v === "none" || v === "") return 0;
  return parseFloat(v);
};
const firstFamily = (v: string) => v.split(",")[0].replace(/["']/g, "").trim().toLowerCase();

/** Returns null when within tolerance, else a reason. */
function compare(prop: Prop, expected: string | number, actual: string | number, fontSize: number): string | null {
  const fail = (tol: string) => `expected ${expected}, got ${actual} (${tol})`;
  switch (prop) {
    case "font-family":
      return firstFamily(String(expected)) === firstFamily(String(actual)) ? null : fail("exact");
    case "font-size":
    case "line-height":
    case "border-top-width":
    case "border-right-width":
    case "border-bottom-width":
    case "border-left-width": {
      // ±0px; `normal` line-height is never equal to a number.
      if (String(expected) === String(actual)) return null;
      if (String(expected) === "normal" || String(actual) === "normal") return fail("±0px");
      return Math.abs(px(expected) - px(actual)) <= 0.05 ? null : fail("±0px");
    }
    case "letter-spacing":
      return Math.abs(px(expected) - px(actual)) <= 0.01 * fontSize + 0.001 ? null : fail("±0.01em");
    case "padding-top":
    case "padding-right":
    case "padding-bottom":
    case "padding-left":
    case "margin-top":
    case "margin-bottom":
    case "gap":
    case "row-gap":
    case "column-gap":
    case "x":
    case "y":
      return Math.abs(px(expected) - px(actual)) <= 2 ? null : fail("±2px");
    case "w":
    case "h": {
      const e = px(expected);
      const tol = Math.max(4, Math.abs(e) * 0.01);
      return Math.abs(e - px(actual)) <= tol ? null : fail(`±${tol.toFixed(1)}px`);
    }
    case "grid-template-columns": {
      const a = String(expected).split(/\s+/).map(parseFloat);
      const b = String(actual).split(/\s+/).map(parseFloat);
      if (a.length !== b.length) return fail("track count");
      return a.every((v, i) => Math.abs(v - b[i]) <= 2) ? null : fail("±2px per track");
    }
    case "font-variant-numeric": {
      // `numeral` adds `lining-nums`, which is Barlow's default figure style:
      // the token is inert in this face, so the sets compare without it.
      const set = (v: string | number) =>
        String(v).split(/\s+/).filter((x) => x && x !== "lining-nums").sort().join(" ") || "normal";
      return set(expected) === set(actual) ? null : fail("exact");
    }
    case "text-align": {
      // `start` and `left` compute differently and render identically in LTR.
      const n = (v: string | number) => (String(v) === "start" ? "left" : String(v));
      return n(expected) === n(actual) ? null : fail("exact");
    }
    case "opacity":
      return Math.abs(parseFloat(String(expected)) - parseFloat(String(actual))) <= 0.005 ? null : fail("exact");
    default:
      return String(expected).replace(/\s+/g, " ") === String(actual).replace(/\s+/g, " ") ? null : fail("exact");
  }
}

/* ------------------------------------------------------------------------ */
/* Tests                                                                     */
/* ------------------------------------------------------------------------ */

test.describe("parity against the artboards", () => {
  test.beforeEach(({}, info) => {
    test.skip(
      info.project.name !== "chromium-1440",
      "Parity is a Chromium measurement, run once from chromium-1440 with the viewport set per test.",
    );
  });

  for (const board of BOARDS) {
    test(`${board.name}: ${board.rows.length} measured rows within tolerance`, async ({ browser }) => {
      test.setTimeout(60_000);
      const props = [...new Set(board.rows.flatMap((r) => [...r.props, "font-size"]))];
      // Every measured property is one the probe defines (or a box key), so a
      // typo cannot silently compare two empty strings.
      const known = new Set<string>([...PROPS, "opacity", "x", "y", "w", "h"]);
      expect(props.filter((p) => !known.has(p)), "props outside scripts/parity-probe.js PROPS").toEqual([]);

      const designCtx = await browser.newContext({ viewport: board.viewport });
      const appCtx = await browser.newContext({ viewport: board.viewport, reducedMotion: "reduce" });
      try {
        const dp = await designCtx.newPage();
        // The artboards pull Barlow from Google Fonts (DEVIATIONS #2). If that
        // stylesheet fails, `document.fonts.check()` still returns true (no
        // face is declared, so none is "pending") and every box is measured
        // in a fallback face — so require the faces to be LOADED, retrying
        // the navigation a couple of times before giving up.
        let fontsIn = false;
        for (let attempt = 0; attempt < 3 && !fontsIn; attempt++) {
          const res = await dp.goto(`${DESIGN}${board.artboard}`);
          expect(res?.status(), `artboard ${board.artboard} on :4000 (npx --yes serve design -l 4000)`).toBe(200);
          await dp.waitForLoadState("load");
          await dp.evaluate(() => document.fonts.ready.then(() => undefined));
          fontsIn = await dp.evaluate(() => {
            const loaded = [...document.fonts]
              .filter((f) => f.status === "loaded")
              .map((f) => `${f.family.replace(/["']/g, "")} ${f.weight}`);
            return ["Barlow Condensed 700", "Barlow 400", "Barlow 500", "Barlow 700"].every((k) =>
              loaded.includes(k),
            );
          });
        }
        test.skip(!fontsIn, "Artboard web fonts (Google Fonts) did not load after 3 tries — the baseline would be measured in a fallback face.");

        const ap = await appCtx.newPage();
        expect((await ap.goto(board.app))?.status()).toBe(200);
        await settle(ap);
        await expect(ap.locator("main#main")).toBeVisible();

        const designM = await measure(dp, board.rows.map((r) => r.design), props);
        const appM = await measure(ap, board.rows.map((r) => r.app ?? r.design), props);

        const failures: string[] = [];
        board.rows.forEach((row, i) => {
          const d = designM[i];
          const a = appM[i];
          if (!d) return void failures.push(`[${row.label}] not found in the artboard`);
          if (!a) return void failures.push(`[${row.label}] not found in the app`);
          const fontSize = px(a.values["font-size"] ?? 16);
          for (const prop of row.props) {
            const expected = row.dev?.[prop] ?? d.values[prop];
            const why = compare(prop, expected, a.values[prop], fontSize);
            if (why) {
              const drawn = row.dev?.[prop] !== undefined ? ` [drawn ${d.values[prop]}; ${row.cite}]` : "";
              failures.push(`[${row.label}] ${prop}: ${why}${drawn}`);
            }
          }
        });
        test.info().annotations.push({
          type: "parity",
          description: `${board.rows.length} rows, ${board.rows.reduce((n, r) => n + r.props.length, 0)} properties, ${failures.length} outside tolerance`,
        });
        expect(failures, `${board.name}: deltas outside design/reports/README.md tolerances`).toEqual([]);
      } finally {
        await designCtx.close();
        await appCtx.close();
      }
    });
  }
});
