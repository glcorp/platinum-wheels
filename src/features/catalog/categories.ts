/**
 * Per-category configuration — the one table that makes `/tires`, `/wheels`
 * and `/accessories` the same page (D58).
 *
 * Owner, 2026-09-21: *"also add wheels and accessories to scope. keep them
 * same as tires. only filters and skus change but everything else remains as
 * it is."* That sentence is this file: every component, utility, primitive and
 * layout stays exactly as it was, and the two things that genuinely differ —
 * the filter groups and the seed — are read from here.
 *
 * **The tires row reproduces the built page byte for byte.** Its param names
 * (`width` / `profile` / `rim` / `season`), its option labels (`R16`,
 * `All-season`), its group labels (`Tire size`, `Price per tire`) and its
 * serialisation order are the measured values from `design/inventory/results.md`
 * and are not "config" in any live sense — changing one is a parity change.
 * The wheels and accessories rows are new and authored under
 * `.claude/rules/ui.md` "Copy".
 *
 * **It lives in `catalog/`, not `results/`, on purpose.** Three consumers need
 * it — `results/` for the facets, `product/` for the spec table and the unit
 * copy, and `ProductCard` for the card's price suffix — and D37 routes every
 * cross-feature import through `catalog/`, the shared product domain. The one
 * consumer outside a feature, `src/components/ui/price.tsx`, is given a plain
 * `unit` string by its caller instead, because `src/components/*` never
 * imports a feature (D37).
 *
 * Client-safe: type-only imports plus pure functions, **no database import**.
 * `FilterPanel` is a `"use client"` island and reads its labels from here, so
 * anything that reads products belongs in `results/search.ts` instead — which
 * is also where the vehicle → size fitment lives, because that needs the
 * finder seed (D48).
 *
 * Since the catalogue moved into Postgres (D105b, D108b) this table holds copy
 * and param names only. It used to carry a `read` / `match` function per
 * field, which pulled a value off a seed product in memory; filtering and
 * counting are SQL now (`catalog/queries.ts`), so those are gone.
 */

import { ACCESSORY_LABEL } from "./adapter";
import type { AccessoryType, Product, ProductCategory } from "./types";
import { productCategory } from "./types";
import { ROUTES } from "@/lib/routes";

/* --- Size fields ---------------------------------------------------------- */

/**
 * One of the three selects in the size group. The group is drawn as a
 * three-track grid (`results-desktop.html:129`) and the artboard gives it no
 * fourth track, so a category gets exactly three fields or none at all —
 * which is why wheel offset is a spec row and not a filter (owner, 2026-09-21).
 */
export interface SizeFieldConfig {
  /** Query-string param and form control `name`. */
  param: string;
  /** Caption above the select — `Width`, `Diameter`, `Bolt pattern`. */
  caption: string;
  /** Prefix the option label carries but the param value does not. Tires' rim
   *  reads `R16` in the rail (`results-desktop.html:131`) and `16` in the URL. */
  labelPrefix?: string;
  /** Strips `labelPrefix` back off an inbound value, so a URL carrying either
   *  spelling resolves. Tires' rim only. */
  strip?: RegExp;
  /** How a URL value is put into its one spelling before it is compared with
   *  the options: `number` (`17.0` → `17`, `8.50` → `8.5`) or `bolt`
   *  (`5X114.3`, `5×114.3`, `5x114.30` → `5x114.3`). Defaults to `number`. */
  kind?: "number" | "bolt";
}

/* --- Extra filter groups --------------------------------------------------- */

/**
 * Filters that sit beside the size group, each only where the vendor data is
 * filled in for most of the products it applies to (owner, 2026-10-03: at least
 * 70%): wheel offset, centre bore and finish family, tire load index, and the
 * thread size of lug nuts, lug bolts and wheel locks. Not offered: tire speed
 * rating, XL / run-flat / 3PMSF / studdable, accessory seat type (all thinner).
 */
export type ExtraGroupId =
  | "loadIndex"
  | "centerBore"
  | "offset"
  | "finish"
  | "thread";

/** Query-string params, and the form control names the rail posts. */
export const EXTRA_PARAM = {
  /** `load=98` — the lowest load index wanted. */
  loadIndex: "load",
  /** `bore=66.6` — one centre bore, mm. */
  centerBore: "bore",
  /** `offset_min=-10&offset_max=45` — mm, signed, inclusive. */
  offsetMin: "offset_min",
  offsetMax: "offset_max",
  /** `finish=Gloss+Black&finish=Silver` — finish families. */
  finish: "finish",
  /** `thread=14x1.5&thread=1/2+UNF` — lug thread sizes. */
  thread: "thread",
} as const;

/** New copy under `.claude/rules/ui.md`, in the shape of the groups drawn. */
export const EXTRA_COPY: Readonly<
  Record<ExtraGroupId, { label: string; caption?: string }>
> = {
  loadIndex: { label: "Load index", caption: "Minimum" },
  centerBore: { label: "Centre bore", caption: "Diameter" },
  offset: { label: "Offset" },
  finish: { label: "Finish" },
  thread: { label: "Thread size" },
};

/** Chip values (accessory types) whose products have a thread. The thread
 *  group renders, and the `thread` param counts, only while the type filter
 *  holds at least one of these. */
export const THREADED_ACCESSORY_TYPES: readonly string[] = [
  "lug-nuts",
  "lug-bolts",
  "wheel-locks",
];

/* --- Chip group ----------------------------------------------------------- */

/**
 * The chip row: `Season` on tires (`results-desktop.html:135`), `Type` on
 * accessories. Same markup, same `ChipCheckbox`, same wrap behaviour — only
 * the label, the param and the option list move.
 *
 * **Wheels have none.** They used to filter on four authored finishes; the
 * real catalogue spells finish 500 different ways, so the owner ruled the
 * chip filter out (D105b). Since 2026-10-03 the vendors' finish FAMILY (about
 * fifteen values, filled on 99.9% of wheels) is offered as a checkbox list
 * instead, one of the extra groups below, not a chip row.
 */
export interface ChipGroupConfig {
  label: string;
  param: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}

/* --- Category ------------------------------------------------------------- */

export interface CategoryConfig {
  category: ProductCategory;
  /** This category's results route. Tires is `/tires` (D112; it was
   *  `/results`, D39). */
  route: string;
  /**
   * Breadcrumb leaf. Tires read `Tires` since D112 (owner, 2026-09-30,
   * `design/DEVIATIONS.md` #95); the artboard draws `Results`
   * (`results-desktop.html:112`). The other two are new copy.
   *
   * There is no `label` field. It existed only for the rail's `Category` group
   * row (`Tires` / `Wheels` / `Accessories`, `results-desktop.html:125`), and
   * that group is not built (`design/DEVIATIONS.md` #60, owner, 2026-09-22).
   * D59(1) still governs `crumb` and `route`: both are written out per
   * category, never derived by capitalising the key, because the key is an
   * internal identifier and these are drawn copy.
   */
  crumb: string;
  /** Which `SiteHeader` nav item renders active. */
  nav: "tires" | "wheels" | "accessories";
  /** The three-select size group, or `null` when the category has none.
   *  Accessories have none: most fit everything, so a `Fits` select would be a
   *  filter that filters nothing (owner, 2026-09-21). The rail then draws four
   *  groups instead of five — `design/DEVIATIONS.md`. */
  size: {
    label: string;
    fields: readonly SizeFieldConfig[];
    /** Equal-thirds columns clip a bolt pattern (`5x114.3`, `6x139.7`): the
     *  three-track grid was measured against tire values (`215`/`55`/`R16`,
     *  results-desktop.html:129) and D58 reused it unchanged. `dense` swaps in
     *  an uneven 1 : 1 : 1.6 column split plus tighter select padding for
     *  this group only — no wheels artboard exists to measure against, so
     *  this is an authored value, not a parity number (`design/DEVIATIONS.md`
     *  #67). Tires never set this; their grid and padding are untouched. */
    dense?: boolean;
  } | null;
  /** The chip row, or `null` when the category has none (wheels). */
  chips: ChipGroupConfig | null;
  /** The extra groups, in the order the panel draws them, between the chip row
   *  and Brand. Empty = none. */
  extras: readonly ExtraGroupId[];
  /**
   * The vehicle finder on this category's results page — the `Change vehicle`
   * disclosure in `ResultsToolbar` and the vehicle chip beside it.
   *
   * **All three categories render one (D67, owner, 2026-09-22).** Accessories
   * used to be `null` on the premise that "an accessory derives nothing from a
   * vehicle" (D59(2)). The seed contradicts the premise: it sells lug nuts in
   * 12×1.5 and 12×1.25 and TPMS sensors at 315 MHz and 433 MHz, and the car
   * decides both — they are the two most vehicle-specific parts on the page.
   * The owner vetoed D59(2). An accessory still derives no *size*
   * (`config.size` stays `null`, the rail still draws four groups), so the
   * vehicle drives the best/similar split off the spec string instead —
   * `search.ts`, `accessoryFitsVehicle()`.
   *
   * `null` stays legal: it is the one switch that turns the affordance off,
   * and the rule behind D59(2) still stands for a category whose data genuinely
   * cannot answer a vehicle. No category is `null` today.
   *
   * `cta` is the submit button's copy; the submit target is `route`. Tires
   * keep the artboard-verbatim `Find my tires` (home-desktop.html:161).
   */
  finder: { cta: string } | null;
  /** `Price per tire` verbatim (`results-desktop.html:144`); the other two
   *  follow its shape. */
  priceLabel: string;
  /** Unit copy. `Price` renders `card` / `pdp`; the PDP quantity select
   *  renders `one` / `many` (`4 tires` is artboard-verbatim,
   *  `product-desktop.html:146`). */
  unit: {
    card: string;
    pdp: string;
    one: string;
    many: string;
  };
  copy: {
    /** `ResultsEmpty` body — undrawn, new copy under `.claude/rules/ui.md`.
     *  **All three values are deliberately identical.** The clause that used to
     *  differ per category ("check your size" / "your fitment" / "what fits")
     *  is the clause that pushed the line to two rows at desktop; the owner
     *  asked for one line, so it was cut rather than wrapped. What is left
     *  names both recoveries and no category noun, so it is true everywhere.
     *  The field stays per-category: it is the hook a category would need if
     *  its empty state ever has something of its own to say. */
    empty: string;
    /** `Best matches` is empty but `Similar matches` is not: the noun this
     *  category's near-miss is measured on. Tires match on size, wheels on
     *  bolt pattern, accessories on thread pitch and TPMS frequency (D67) —
     *  all three can render the line. */
    nearMiss: string;
    /**
     * The quote form's message placeholder and the CASL consent line.
     *
     * **Tires ship the artboard string verbatim** (`product-desktop.html:150`),
     * em dash and ellipsis included — artboard copy wins, and the em-dash ban
     * in `.claude/rules/ui.md` applies only to new copy. The other two carry a
     * variant of that sentence, because no artboard draws a wheel or accessory
     * PDP and the drawn wording is factually wrong there: a wheel buyer is not
     * telling us about "current tires". The variant keeps the drawn sentence's
     * structure and punctuation so the field reads as the same control, and
     * swaps only the noun (D59(7), coordinator 2026-09-21, vetoable).
     */
    quotePlaceholder: string;
    quoteConsent: string;
  };
}

/* --- Tires ---------------------------------------------------------------- */

/** Chip copy verbatim and in artboard order — `results-desktop.html:135`
 *  (`All-season` lowercase s, unlike the card badge `All-Season`). Values are
 *  the `ProductBadge` keys, which are the database's season enum spelled with
 *  a hyphen. `All-weather` is new copy (D105b), placed beside the season it is
 *  most often confused with. */
const TIRE_SEASONS: ChipGroupConfig = {
  label: "Season",
  param: "season",
  options: [
    { value: "all-season", label: "All-season" },
    { value: "all-weather", label: "All-weather" },
    { value: "winter", label: "Winter" },
    { value: "summer", label: "Summer" },
  ],
};

const TIRE_SIZE_FIELDS: readonly SizeFieldConfig[] = [
  { param: "width", caption: "Width" },
  { param: "profile", caption: "Profile" },
  { param: "rim", caption: "Rim", labelPrefix: "R", strip: /^[Rr]/ },
];

/* --- Wheels --------------------------------------------------------------- */

const WHEEL_SIZE_FIELDS: readonly SizeFieldConfig[] = [
  { param: "diameter", caption: "Diameter" },
  { param: "width", caption: "Width" },
  /* `5x114.3` in the URL and in the select: the value stays ASCII so a
     hand-typed URL and a form submit spell it the same way. */
  { param: "bolt", caption: "Bolt pattern", kind: "bolt" },
];

/* --- Accessories ---------------------------------------------------------- */

/** One chip per `AccessoryType`, in the order `adapter.ts` `ACCESSORY_LABEL`
 *  lists them and with its words, the same ones the spec table's `Type` row
 *  reads. Since D125 those are the vendors' fifteen types and their own labels
 *  (`Center Caps`, `TPMS Sensors & Tools`), shipped as the vendors spell them.
 *  A type key in a URL that is not one of these options (a pre-D125 `tpms`,
 *  `spacers`, `other`) is dropped by `parseResultsQuery`, which keeps only
 *  values this list offers, so an old link degrades to "no type filter". */
const ACCESSORY_TYPES: ChipGroupConfig = {
  label: "Type",
  param: "type",
  options: (Object.keys(ACCESSORY_LABEL) as AccessoryType[]).map((value) => ({
    value,
    label: ACCESSORY_LABEL[value],
  })),
};

/* --- The table ------------------------------------------------------------ */

export const CATEGORY_CONFIG: Readonly<Record<ProductCategory, CategoryConfig>> =
  {
    tires: {
      category: "tires",
      route: ROUTES.tires,
      crumb: "Tires",
      nav: "tires",
      size: { label: "Tire size", fields: TIRE_SIZE_FIELDS },
      chips: TIRE_SEASONS,
      extras: ["loadIndex"],
      finder: { cta: "Find my tires" },
      priceLabel: "Price per tire",
      unit: {
        card: "/ tire",
        pdp: "per tire · before tax",
        one: "1 tire",
        many: "tires",
      },
      copy: {
        empty: "Nothing fits those filters yet. Clear them, or call us.",
        nearMiss: "size",
        /* Artboard wording, both PDP exports, with its em dash made a colon
           (owner copy pass, 2026-10-03, D130). */
        quotePlaceholder:
          "Anything we should know: current tires, storage, install timing…",
        quoteConsent:
          "Yes, send me seasonal offers and tire tips from Platinum Wheels. You can unsubscribe anytime.",
      },
    },
    wheels: {
      category: "wheels",
      route: ROUTES.wheels,
      crumb: "Wheels",
      nav: "wheels",
      size: { label: "Wheel size", fields: WHEEL_SIZE_FIELDS, dense: true },
      chips: null,
      extras: ["centerBore", "offset", "finish"],
      finder: { cta: "Find my wheels" },
      priceLabel: "Price per wheel",
      unit: {
        card: "/ wheel",
        pdp: "per wheel · before tax",
        one: "1 wheel",
        many: "wheels",
      },
      copy: {
        empty: "Nothing fits those filters yet. Clear them, or call us.",
        nearMiss: "fitment",
        quotePlaceholder:
          "Anything we should know: current setup, storage, install timing…",
        quoteConsent:
          "Yes, send me seasonal offers and shop news from Platinum Wheels. You can unsubscribe anytime.",
      },
    },
    accessories: {
      category: "accessories",
      route: ROUTES.accessories,
      crumb: "Accessories",
      nav: "accessories",
      size: null,
      chips: ACCESSORY_TYPES,
      extras: ["thread"],
      /* New copy under `.claude/rules/ui.md`, in the shape the other two
         already set (`Find my tires` is artboard-verbatim, `Find my wheels`
         follows it): same verb, same possessive, the category's own noun. */
      finder: { cta: "Find my accessories" },
      priceLabel: "Price per item",
      unit: {
        card: "/ each",
        pdp: "each · before tax",
        one: "1 item",
        many: "items",
      },
      copy: {
        empty: "Nothing fits those filters yet. Clear them, or call us.",
        /* An accessory derives no SIZE from a vehicle, but since D67 it does
           derive a fit — thread pitch and TPMS frequency — so the line does
           render here. `fitment` rather than `fit`: the sentence pluralises
           the noun ("Similar fitments are below"), and "fits" reads as a
           verb. */
        nearMiss: "fitment",
        quotePlaceholder:
          "Anything we should know: your vehicle, wheel size, install timing…",
        quoteConsent:
          "Yes, send me seasonal offers and shop news from Platinum Wheels. You can unsubscribe anytime.",
      },
    },
  };

export function categoryConfig(category: ProductCategory): CategoryConfig {
  return CATEGORY_CONFIG[category];
}

/** The config for a product, via its own (possibly absent) category. */
export function configFor(product: Product): CategoryConfig {
  return CATEGORY_CONFIG[productCategory(product)];
}

/** Size param names for a category, in drawn order. Empty for accessories. */
export function sizeParams(category: ProductCategory): readonly string[] {
  return CATEGORY_CONFIG[category].size?.fields.map((field) => field.param) ?? [];
}
