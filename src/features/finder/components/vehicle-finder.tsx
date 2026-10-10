import { FieldLabel } from "@/components/ui/field-label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CategoryTabs } from "@/components/site/category-tabs";
import { FINDER_CATEGORIES, FINDER_FORM_ID } from "@/lib/finder-category";
import { ROUTES } from "@/lib/routes";
import { CATEGORY_CONFIG } from "@/features/catalog/categories";
import { FINDER_MAKES, finderYears, type PartialVehicle } from "@/features/finder/data";
import { FinderModelSync } from "@/features/finder/components/finder-model-sync";
import { FinderSwitchSubmit } from "@/features/finder/components/finder-switch-submit";
import {
  modelOptionsHtml,
  modelPlaceholderHtml,
  sizeOptionsHtml,
} from "@/features/finder/options-html";
import { FinderModeSync } from "@/features/finder/components/finder-mode-sync";
import type { FinderSizeLists } from "@/features/finder/size-lists";
import { bindFinder, type FinderIds } from "@/features/finder/bind-finder";

/**
 * The vehicle finder — Year / Make / Model native selects plus the primary
 * "Find my tires" CTA. Overlaps the hero (design/inventory/home.md:35-37,
 * §2.3 lines 152-165). Ships unselected with a placeholder option per select
 * (D28); the artboard pre-fill `2021 / Honda / Civic` is sample data and does
 * not ship. No JS required to submit — plain GET to ROUTES.tires.
 *
 * Still a Server Component after D70. The lists are NHTSA vPIC's (D110, via
 * `data.ts`; LA-05): 47 makes and every model under an `<optgroup>` per make,
 * each make and model option carrying the years it was built in `data-years`.
 * That is the whole list a scripting-off visitor needs; the one leaf island,
 * `FinderModelSync`, renders no markup and narrows Make to the chosen Year
 * and Model to the chosen Year and Make when JS is available.
 *
 * No field carries `required` (D79). None of the three selects fires the
 * browser's native constraint-validation bubble ("Please select an item in
 * the list") on an empty submit — that bubble is browser chrome, not page
 * content, so it cannot be restyled to match the design (root `llm.md` §5b
 * D79). An empty submit is not an error: `parseResultsQuery` treats
 * year/make/model as all-or-nothing (`src/features/results/query.ts`), so it
 * names no vehicle and the destination renders unfiltered. A part-filled one
 * (or a model the chosen year never had) still names no vehicle, but since
 * LA-05 it is not dropped silently: the results page opens its finder with the
 * known fields kept and a prompt for the rest (`partial` below). Nothing
 * downstream receives a vehicle `isFinderVehicle` (`data.ts`) has not passed.
 *
 * Submit target and CTA copy are per category (D58). The home hero and
 * `/tires` keep the drawn `ROUTES.tires` + `Find my tires`, byte for byte;
 * `/wheels` submits to `/wheels` and reads `Find my wheels`, and `/accessories`
 * to `/accessories` reading `Find my accessories` (D67) — so the disclosure
 * never throws a visitor back to tires. All three targets come from
 * `CATEGORY_CONFIG[category].route` and `.finder.cta`; this component only
 * takes them as props.
 *
 * Two placements, one form:
 * - `hero` (default, unchanged) — the home page panel that overlaps the hero
 *   photo: negative top margin plus its own side margins and container cap.
 * - `inline` (D45) — the `/tires` toolbar's `Change vehicle` disclosure.
 * - `sheet` (D159) — inside the results pages' vehicle sheet, which already
 *   draws the box: no border or fill of its own, and the fields stay stacked
 *   / two-up at every width (the sheet is at most 720px wide, too narrow for
 *   the desktop four-column row).
 *   Drops the overlap and the side margins/cap so the panel takes its
 *   parent's width; the padding, border, fields and CTA are identical.
 *   Only ever one finder per page, so the field `id`s stay unique.
 *
 * `partial` (LA-05 P2): the results page hands back a part-filled submit
 * (Year and Make, no Model, say). The known values are preselected, a one-line
 * prompt says what is left, and the first missing field is focused. Only
 * values from the finder's own list are ever passed in (`partialVehicle`).
 *
 * `switchable` (D128, home only): the header's Tires / Wheels / Accessories
 * switch this finder instead of leaving `/`. The submit becomes the
 * `FinderSwitchSubmit` leaf island, which reads the category the header set
 * (`src/lib/finder-category.ts`) and swaps the CTA copy and the submit target;
 * the form, its `action` and the three selects are unchanged, so the no-JS
 * page is the page that shipped before D128.
 */
export interface VehicleFinderProps {
  variant?: "hero" | "inline" | "sheet";
  /**
   * Where the GET submit lands. Defaults to `ROUTES.tires`, the drawn
   * target, so the home hero and `/tires` are unchanged; `/wheels` passes
   * its own route (D58).
   */
  action?: string;
  /**
   * CTA copy. Defaults to the artboard-verbatim `Find my tires`
   * (home-desktop.html:161); `/wheels` passes `Find my wheels` and
   * `/accessories` `Find my accessories`, both new copy under
   * `.claude/rules/ui.md` keeping the drawn phrase's shape.
   */
  cta?: string;
  /**
   * Extra `[name, value]` pairs the GET submit carries as hidden inputs — the
   * results page's own filters, so changing the car keeps them (WDG-17, owner
   * 2026-09-30). The home hero passes none. Plain markup: works with JS off.
   */
  carry?: ReadonlyArray<readonly [string, string]>;
  /**
   * The home hero's finder (D128): the header nav switches its category. Off
   * everywhere else; `/tires`, `/wheels` and `/accessories` keep their fixed
   * `action` + `cta`.
   */
  switchable?: boolean;
  /**
   * A part-filled vehicle sent back by the results page (LA-05 P2). Values
   * come from `partialVehicle()` and are always the list's own strings.
   */
  partial?: PartialVehicle | null;
  /**
   * The home finder's size lists (D169, C4; `size-lists.ts`). With either
   * list the panel gains a `Vehicle | Size` switch, the size fields and a
   * Season select for tires. Home only (`switchable`); `null` (the database
   * was unreachable at render) leaves the vehicle fields alone.
   */
  sizes?: FinderSizeLists | null;
}

const FIELD_ID = { year: "finder-year", make: "finder-make", model: "finder-model" } as const;
/** The home finder's size and season fields (D169). The wheel width has its
 *  own id: tires and wheels both name the field `width`. */
const SIZE_ID = {
  tireWidth: "finder-width",
  profile: "finder-profile",
  rim: "finder-rim",
  season: "finder-season",
  bolt: "finder-bolt",
  diameter: "finder-diameter",
  wheelWidth: "finder-wheel-width",
} as const;
/** D169: on phones under 680px tall the home panel's labels are read, not
 *  shown, so the CTA stays on the first screen (measured 15 to 49px short at
 *  375x667, 360x640 and 320x568 with them). Each select names its own field
 *  until a value is chosen (`Year`, `Make`, `Width` ...), as Year, Make and
 *  Model always have. */
const HOME_LABEL = "max-sm:fold-cramped:sr-only";
const MODE_ID = { vehicle: "finder-by-vehicle", size: "finder-by-size" } as const;
/** The radios' `form` attribute names no form, so the switch is never sent
 *  with the search (it only decides which fields are shown and sent). */
const MODE_FORM = "finder-mode-none";
const TIRE_IDS = [SIZE_ID.tireWidth, SIZE_ID.profile, SIZE_ID.rim] as const;
const WHEEL_IDS = [SIZE_ID.bolt, SIZE_ID.diameter, SIZE_ID.wheelWidth] as const;
/** Which category and mode each home cell belongs to (`data-finder-show`,
 *  read by the Stream C rules in globals.css and by `FinderModeSync`). */
const SHOW = {
  vehicle: "tires:vehicle wheels:vehicle accessories:vehicle",
  tireSize: "tires:size",
  wheelSize: "wheels:size",
  season: "tires:vehicle tires:size",
} as const;
const PROMPT_ID = "finder-prompt";
/** The `<noscript>` holding the full model list, read by `bindFinder()`. */
const MODEL_NOSCRIPT_ID = "finder-model-options";
const BIND_IDS: FinderIds = {
  yearId: FIELD_ID.year,
  makeId: FIELD_ID.make,
  modelId: FIELD_ID.model,
  sourceId: MODEL_NOSCRIPT_ID,
};
/** `bindFinder()` as an inline script, run while the HTML is parsed (D168).
 *  The ids are this file's own constants, so the JSON is fixed. */
const BIND_SCRIPT = `(${bindFinder.toString()})(${JSON.stringify(BIND_IDS)},null)`;

/** "Choose your model to see what fits." / "Choose your make and model to see
 *  what fits." New copy under `.claude/rules/ui.md` "Copy": plain, no dash. */
function promptCopy(missing: PartialVehicle["missing"]): string {
  const words = missing.map((field) => field);
  const list =
    words.length === 1
      ? words[0]
      : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
  return `Choose your ${list} to see what fits.`;
}

/** What `FinderSwitchSubmit` needs per category, read from the one table that
 *  already holds it (D58): the route, the CTA, and the breadcrumb label in
 *  lower case for the `Searching wheels` announcement. A category whose
 *  `finder` is `null` would keep the default CTA; none is today. */
function switchOptions(fallbackCta: string) {
  return Object.fromEntries(
    FINDER_CATEGORIES.map((id) => {
      const config = CATEGORY_CONFIG[id];
      return [
        id,
        {
          route: config.route,
          cta: config.finder?.cta ?? fallbackCta,
          noun: config.crumb.toLowerCase(),
        },
      ];
    }),
  ) as Record<(typeof FINDER_CATEGORIES)[number], { route: string; cta: string; noun: string }>;
}

/**
 * `Vehicle | Size` (D169, C4; owner, 2026-10-11, choosing "Vehicle / Size
 * switch, season on tires"). Two native radios, so the switch works with
 * scripting off and before hydration: the Stream C rules in globals.css show
 * the fields of the checked one (`:has(:checked)`). Their `form` attribute
 * names no form, so the choice itself is never part of the search. The look
 * is the results rail's selected chip (`chip.tsx`): `--text` fill, dark ink.
 * Hidden on accessories, which have no size. Dealer Wheels (PRO WHEELS) offers
 * the same split as tabs, `By vehicle` / `Tires by size` / `Wheels by size`.
 */
function ModeSwitch() {
  const segment = (id: string, value: string, label: string, first: boolean) => (
    <label
      htmlFor={id}
      className={[
        "font-sans flex flex-1 cursor-pointer items-center justify-center text-14 leading-flat font-medium",
        "text-ink-muted hover:text-ink active:opacity-70",
        "has-checked:bg-ink has-checked:text-on-accent",
        "has-focus-visible:relative has-focus-visible:z-10 has-focus-visible:outline-2 has-focus-visible:outline-offset-0 has-focus-visible:outline-accent",
        first ? "rounded-l-ctl" : "rounded-r-ctl border-border-strong border-l",
      ].join(" ")}
    >
      <input
        type="radio"
        id={id}
        name="finder-by"
        value={value}
        form={MODE_FORM}
        defaultChecked={first}
        data-segment=""
        className="sr-only"
      />
      {label}
    </label>
  );
  return (
    <fieldset className="finder-mode sm:w-60 sm:shrink-0">
      <legend className="sr-only">Search by</legend>
      <div className="rounded-ctl border-border-strong grid h-11 grid-cols-2 border max-sm:fold-cramped:h-10">
        {segment(MODE_ID.vehicle, "vehicle", "Vehicle", true)}
        {segment(MODE_ID.size, "size", "Size", false)}
      </div>
    </fieldset>
  );
}

/** One size select: label, then the options as server markup, the field's
 *  own name first (`Width`, empty: no filter). */
function SizeSelect({
  id,
  name,
  label,
  options,
  disabled = false,
}: {
  id: string;
  name: string;
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <>
      <FieldLabel htmlFor={id} className={HOME_LABEL}>
        {label}
      </FieldLabel>
      <Select
        id={id}
        name={name}
        autoComplete="off"
        disabled={disabled}
        dangerouslySetInnerHTML={{ __html: sizeOptionsHtml(label, options) }}
      />
    </>
  );
}

/**
 * The home finder's size fields and Season (D169). Tires: Width, Profile, Rim
 * (the results rail's own params, values and labels, `size-lists.ts`), then
 * Season beside them and beside Year / Make / Model. Wheels: Bolt pattern,
 * Diameter, Width, in Dealer Wheels' order (pattern first: it decides what
 * bolts on). The wheel selects are served `disabled`: tires and wheels both
 * send `width`, and the server's category is tires; `FinderModeSync` enables
 * whichever set is showing. Each select reads its own name (`Season`,
 * `Width`) until chosen, an empty value, so leaving it alone filters nothing,
 * and choosing the name again clears it.
 */
function SizeFields({ sizes }: { sizes: FinderSizeLists }) {
  const seasons = CATEGORY_CONFIG.tires.chips?.options ?? [];
  return (
    <>
      {sizes.tire !== null ? (
        <>
          <div data-finder-show={SHOW.tireSize}>
            <SizeSelect id={SIZE_ID.tireWidth} name="width" label="Width" options={sizes.tire.width} />
          </div>
          <div data-finder-show={SHOW.tireSize}>
            <SizeSelect id={SIZE_ID.profile} name="profile" label="Profile" options={sizes.tire.profile} />
          </div>
          <div data-finder-show={SHOW.tireSize}>
            <SizeSelect id={SIZE_ID.rim} name="rim" label="Rim" options={sizes.tire.rim} />
          </div>
        </>
      ) : null}
      {sizes.wheel !== null ? (
        <>
          <div data-finder-show={SHOW.wheelSize}>
            <SizeSelect id={SIZE_ID.bolt} name="bolt" label="Bolt pattern" options={sizes.wheel.bolt} disabled />
          </div>
          <div data-finder-show={SHOW.wheelSize}>
            <SizeSelect id={SIZE_ID.diameter} name="diameter" label="Diameter" options={sizes.wheel.diameter} disabled />
          </div>
          <div data-finder-show={SHOW.wheelSize} className="finder-cell-wide">
            <SizeSelect id={SIZE_ID.wheelWidth} name="width" label="Width" options={sizes.wheel.width} disabled />
          </div>
        </>
      ) : null}
      <div data-finder-show={SHOW.season}>
        <FieldLabel htmlFor={SIZE_ID.season} className={HOME_LABEL}>
          Season
        </FieldLabel>
        <Select id={SIZE_ID.season} name="season" autoComplete="off" defaultValue="">
          <option value="">Season</option>
          {seasons.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      <FinderModeSync
        formId={FINDER_FORM_ID}
        sizeRadioId={MODE_ID.size}
        tireIds={TIRE_IDS}
        wheelIds={WHEEL_IDS}
        tireCombos={sizes.tire?.combos ?? null}
        wheelCombos={sizes.wheel?.combos ?? null}
      />
    </>
  );
}

export function VehicleFinder({
  variant = "hero",
  action = ROUTES.tires,
  cta = "Find my tires",
  carry = [],
  switchable = false,
  partial = null,
  sizes = null,
}: VehicleFinderProps) {
  const hero = variant === "hero";
  /* The home panel with size search (D169): only the switchable hero finder,
     and only when a size list could be read. */
  const home = switchable;
  const sizeSearch = home && sizes !== null && (sizes.tire !== null || sizes.wheel !== null);
  const sheet = variant === "sheet";
  const firstMissing = partial?.missing[0];
  /* The vehicle a part-filled submit kept a model for, or `null`. */
  const preselected = partial?.model
    ? { make: partial.make, model: partial.model }
    : null;
  const promptFor = (field: keyof typeof FIELD_ID) =>
    partial !== null && partial.missing.includes(field) ? PROMPT_ID : undefined;
  return (
    <form
      // The header's category links point `aria-controls` here on `/` (D128),
      // and `FinderSwitchSubmit` scrolls it into view. One finder per page.
      id={FINDER_FORM_ID}
      method="get"
      action={action}
      data-probe="finder"
      /* D169: the category the home panel shows, for the Stream C rules in
         globals.css; the server's is tires, `FinderModeSync` follows the
         header and tabs. */
      data-finder-category={home ? "tires" : undefined}
      className={[
        home ? "finder-home" : "",
        sheet ? "" : "bg-surface border border-border-strong",
        // `hero`: overlap -72px mobile, -120px desktop (home.md:36-37,
        // -mt-18/-mt-30), plus the panel's own side margins (home.md:35-36
        // `margin:-120px 48px 0`). mx-12 (48px) at md matches the 1344px
        // content width exactly at 1440 (D11); lg:mx-auto lg:max-w-content
        // only matters above 1320px.
        // `inline` (D45): no overlap, no side margins, no cap — it sits inside
        // the results toolbar's disclosure and takes that width.
        hero
          ? "relative z-10 -mt-18 sm:-mt-30 mx-4 sm:mx-8 md:mx-12 lg:mx-auto lg:max-w-content"
          : "w-full",
        // Padding 20px -> 32px (home.md:36-37); inner gap 12px -> 16px. The
        // sheet's own panel pads it (D159).
        sheet ? "" : "p-5 sm:p-8",
        "flex flex-col gap-3 sm:gap-4",
        /* D169: phones under 680px tall close the panel's gaps 12 -> 8 so the
           CTA stays on the first screen (with the 40px tabs and switch). */
        home ? "max-sm:fold-cramped:gap-2" : "",
      ].join(" ")}
    >
      {switchable ? (
        /* D169: on phones the mode switch is a row of its own under the tabs;
           from `sm:` the two share one row; from `md:`, where the tabs give
           way to the header's links, the switch stands alone. */
        <div className="flex flex-col gap-3 max-sm:fold-cramped:gap-2 sm:flex-row sm:items-center sm:gap-4">
          {/* D158 (owner, 2026-10-06): below `md:` the header's category links
              sit in the menu, where a visitor never sees them, so the finder
              shows its own Tires / Wheels / Accessories tabs. A tap switches
              this finder in place, as the header links do (D128); hidden from
              `md:`, where the header row is visible. */}
          <CategoryTabs
            finderSwitch
            /* On short phones the tabs give up 4px so the CTA still ends on
               the first screen: under 600px tall since D128, under 680px since
               D169 added the Vehicle / Size row. 40px stays far above the 24px
               minimum target (WCAG 2.5.8). */
            className="sm:min-w-0 sm:flex-1"
            listClassName="max-sm:fold-cramped:h-10"
            items={FINDER_CATEGORIES.map((id) => ({
              id,
              label: CATEGORY_CONFIG[id].crumb,
              href: CATEGORY_CONFIG[id].route,
            }))}
          />
          {sizeSearch ? <ModeSwitch /> : null}
        </div>
      ) : null}
      {carry.map(([name, value], index) => (
        <input key={`${name}-${index}`} type="hidden" name={name} value={value} />
      ))}
      {partial === null ? null : (
        /* LA-05 P2: a part-filled submit is not dropped silently. Plain text
           in the panel's own flow, tied to the missing selects by
           `aria-describedby`. Same type as the results page's support line. */
        <p id={PROMPT_ID} data-probe="finder-prompt" className="text-ink text-15 leading-body">
          {promptCopy(partial.missing)}
        </p>
      )}
      <div
        className={[
          home
            ? /* D169: the home panel. Phones two up (four fields in two rows,
                 where the stacked column took three for three), tablets four up
                 with the CTA on its own row, desktop the drawn row plus a
                 Season track (`finder-grid-home`, Stream C block). Cells sit on
                 the row's end, as `sm:items-end` does below (D128). */
              "grid grid-cols-2 items-end gap-3 max-sm:fold-cramped:gap-2 sm:grid-cols-4 sm:gap-4 md:finder-grid-home"
            : null,
          /* Every other finder (`/tires`, `/wheels`, `/accessories` sheet)
             keeps the D128 classes below, byte for byte. */
          // Mobile: stacked full-width fields (home.md:36 "flex-direction:column").
          !home && "flex flex-col gap-3",
          /* Short phones, hero only (D128): Year and Make share a row so the
             whole panel, CTA included, fits above the fold. `fold-short` is
             500-819px tall (globals.css D128 block); `max-sm:` keeps it off
             the tablet and desktop grids, which already set their own tracks.
             Model and the CTA span both columns. */
          !home && hero && "max-sm:fold-short:grid max-sm:fold-short:grid-cols-2",
          // Tablet: 2x2 grid (DESIGN.md §8 "Finder | ... | 2×2 grid").
          !home && "sm:grid sm:grid-cols-2 sm:gap-4",
          /* Bottom-aligned from `sm:`, not only `md:` (D128). The CTA carries
             no label, so in the 2x2 grid's second row a top-aligned button sat
             a label's height (19px at 1084) above the Model select beside it.
             Aligning every cell to the row's end lines the CTA up with the
             select it shares a row with, at the selects' own height. */
          !home && "sm:items-end",
          /* Desktop: 1fr 1.2fr 1.2fr 300px (home.md:154 `grid-template-columns`),
             `@utility finder-grid` in globals.css, which also aligns to end. */
          !home && !sheet && "md:finder-grid md:gap-4",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div data-finder-show={home ? SHOW.vehicle : undefined}>
          <FieldLabel htmlFor="finder-year" className={home ? HOME_LABEL : undefined}>
            Year
          </FieldLabel>
          <Select
            id={FIELD_ID.year}
            name="year"
            autoComplete="off"
            defaultValue={partial?.year ?? ""}
            aria-describedby={promptFor("year")}
          >
            <option value="" disabled>
              Year
            </option>
            {/* Called here, not read from a module constant: the year list is
                computed at render (D32, D66) so it cannot go stale in a
                long-lived server process or in a prerendered page. */}
            {finderYears().map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Select>
        </div>

        <div data-finder-show={home ? SHOW.vehicle : undefined}>
          <FieldLabel htmlFor="finder-make" className={home ? HOME_LABEL : undefined}>
            Make
          </FieldLabel>
          <Select
            id={FIELD_ID.make}
            name="make"
            autoComplete="off"
            defaultValue={partial?.make ?? ""}
            aria-describedby={promptFor("make")}
          >
            <option value="" disabled>
              Make
            </option>
            {/* `data-years`: the years any of its models was built, read by
                `FinderModelSync` to hide a make that year never had. */}
            {FINDER_MAKES.map(({ make, years }) => (
              <option key={make} value={make} data-years={years}>
                {make}
              </option>
            ))}
          </Select>
        </div>

        <div
          data-finder-show={home ? SHOW.vehicle : undefined}
          className={
            home
              ? /* Spans two tracks where no Season sits beside it (wheels and
                   accessories, Stream C rules). */
                "finder-cell-model"
              : hero
                ? "max-sm:fold-short:col-span-2"
                : undefined
          }
        >
          <FieldLabel htmlFor="finder-model" className={home ? HOME_LABEL : undefined}>
            Model
          </FieldLabel>
          {/* Every model of every make ships, grouped with <optgroup> per
              make, because the submit is a plain GET and must work with
              scripting off (D44, D45). `FinderModelSync` narrows the list to
              the chosen make when JS is available (D70).

              Where the 1,058 options live depends on who is reading.
              - A part-filled vehicle that kept a model (`preselected`): the
                visible select carries the whole list, with that model
                `selected`. Rare, and the closed select must already read it.
              - Otherwise: the visible select carries only the `Model`
                placeholder, as markup React never reconciles, and the whole
                list is the markup of a second select inside a `<noscript>`
                that `FinderModelSync` renders. With scripting off the browser
                parses it, the `finder-js-only` rule beside it hides the
                placeholder-only select, and the visitor has exactly the list
                they had before. With scripting on the browser keeps the
                `<noscript>` content as text, so 1,100 options are never
                parsed, styled or laid out on load (D157(3)); `bindFinder()`
                builds them on the first touch of the finder, from that text
                on a full load or from the island's prop after a client
                navigation (D168: the `<noscript>` React draws on the client
                is empty, which left the list empty until a refresh).
              The string comes from `options-html.ts`. */}
          {preselected ? (
            <Select
              id={FIELD_ID.model}
              name="model"
              autoComplete="off"
              aria-describedby={promptFor("model")}
              dangerouslySetInnerHTML={{ __html: modelOptionsHtml(preselected) }}
            />
          ) : (
            /* Placeholder only, as markup React never reconciles (D168): the
               list is appended by `bindFinder()`, possibly before React
               hydrates, so React must not compare or reset those nodes. No
               `defaultValue` for the same reason: the placeholder carries
               `selected` itself, and a choice made before hydration stays. */
            <Select
              id={FIELD_ID.model}
              name="model"
              autoComplete="off"
              aria-describedby={promptFor("model")}
              wrapperClassName="finder-js-only"
              dangerouslySetInnerHTML={{ __html: modelPlaceholderHtml(false) }}
            />
          )}
          {/* The scripting-off Model list and the narrowing (D70, LA-05,
              D168); see `finder-model-sync.tsx` and `bind-finder.ts`. */}
          <FinderModelSync
            ids={BIND_IDS}
            list={preselected ? null : modelOptionsHtml(null)}
            noscriptSelectId={`${FIELD_ID.model}-all`}
            describedBy={promptFor("model")}
            focusId={firstMissing === undefined ? undefined : FIELD_ID[firstMissing]}
          />
        </div>

        {sizeSearch && sizes !== null ? (
          <SizeFields sizes={sizes} />
        ) : null}

        {/* `promo` = 52 mobile -> 56 desktop, 14px type, 12px icon gap
            (home.md:161,164). Mobile adds `margin-top:4px` (home.md:164). */}
        {switchable ? (
          <FinderSwitchSubmit
            options={switchOptions(cta)}
            formId={FINDER_FORM_ID}
            className={
              home
                ? "col-span-2 mt-1 max-sm:fold-cramped:mt-0 sm:col-span-4 sm:mt-0 md:col-span-1"
                : hero
                  ? "mt-1 sm:mt-0 max-sm:fold-short:col-span-2"
                  : "mt-1 sm:mt-0"
            }
          />
        ) : (
          <Button
            type="submit"
            variant="primary"
            size="promo"
            fullWidth
            className={hero ? "mt-1 sm:mt-0 max-sm:fold-short:col-span-2" : "mt-1 sm:mt-0"}
          >
            {cta} <span aria-hidden="true">→</span>
          </Button>
        )}
      </div>
      {/* D168: binds the narrowing as soon as the form is parsed, before
          React hydrates. Never runs after a client navigation (React inserts
          scripts inert), where `FinderModelSync` binds it on mount instead. */}
      <script dangerouslySetInnerHTML={{ __html: BIND_SCRIPT }} />
    </form>
  );
}
