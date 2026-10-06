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
  variant?: "hero" | "inline";
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
}

const FIELD_ID = { year: "finder-year", make: "finder-make", model: "finder-model" } as const;
const PROMPT_ID = "finder-prompt";

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

export function VehicleFinder({
  variant = "hero",
  action = ROUTES.tires,
  cta = "Find my tires",
  carry = [],
  switchable = false,
  partial = null,
}: VehicleFinderProps) {
  const hero = variant === "hero";
  const firstMissing = partial?.missing[0];
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
      className={[
        "bg-surface border border-border-strong",
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
        // Padding 20px -> 32px (home.md:36-37); inner gap 12px -> 16px.
        "p-5 sm:p-8 flex flex-col gap-3 sm:gap-4",
      ].join(" ")}
    >
      {switchable ? (
        /* D158 (owner, 2026-10-06): below `md:` the header's category links
           sit in the menu, where a visitor never sees them, so the finder
           shows its own Tires / Wheels / Accessories tabs. A tap switches
           this finder in place, as the header links do (D128); hidden from
           `md:`, where the header row is visible. */
        <CategoryTabs
          finderSwitch
          /* On the shortest phones (under 600px tall, D128's `fold-minimal`)
             the tabs give up 4px so the CTA still ends on the first screen:
             measured 569px at 320x568 at 44px. 40px stays far above the
             24px minimum target (WCAG 2.5.8). */
          listClassName="max-sm:fold-minimal:h-10"
          items={FINDER_CATEGORIES.map((id) => ({
            id,
            label: CATEGORY_CONFIG[id].crumb,
            href: CATEGORY_CONFIG[id].route,
          }))}
        />
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
          // Mobile: stacked full-width fields (home.md:36 "flex-direction:column").
          "flex flex-col gap-3",
          /* Short phones, hero only (D128): Year and Make share a row so the
             whole panel, CTA included, fits above the fold. `fold-short` is
             500-819px tall (globals.css D128 block); `max-sm:` keeps it off
             the tablet and desktop grids, which already set their own tracks.
             Model and the CTA span both columns. */
          hero && "max-sm:fold-short:grid max-sm:fold-short:grid-cols-2",
          // Tablet: 2x2 grid (DESIGN.md §8 "Finder | ... | 2×2 grid").
          "sm:grid sm:grid-cols-2 sm:gap-4",
          /* Bottom-aligned from `sm:`, not only `md:` (D128). The CTA carries
             no label, so in the 2x2 grid's second row a top-aligned button sat
             a label's height (19px at 1084) above the Model select beside it.
             Aligning every cell to the row's end lines the CTA up with the
             select it shares a row with, at the selects' own height. */
          "sm:items-end",
          /* Desktop: 1fr 1.2fr 1.2fr 300px (home.md:154 `grid-template-columns`),
             `@utility finder-grid` in globals.css, which also aligns to end. */
          "md:finder-grid md:gap-4",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div>
          <FieldLabel htmlFor="finder-year">Year</FieldLabel>
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

        <div>
          <FieldLabel htmlFor="finder-make">Make</FieldLabel>
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

        <div className={hero ? "max-sm:fold-short:col-span-2" : undefined}>
          <FieldLabel htmlFor="finder-model">Model</FieldLabel>
          {/* Every model of every make ships, grouped with <optgroup> per
              make, because the submit is a plain GET and must work with
              scripting off (D44, D45). `FinderModelSync` below narrows the
              list to the chosen make when JS is available (D70); without it
              this is the whole list, exactly as it was before D70. */}
          <Select
            id={FIELD_ID.model}
            name="model"
            autoComplete="off"
            defaultValue={partial?.model ?? ""}
            aria-describedby={promptFor("model")}
          >
            <option value="" disabled>
              Model
            </option>
            {/* 843 models. No `value` attribute: an option without one submits
                its text, which is the same string, and leaving it off keeps
                the page about 15 KB lighter (LA-05). `data-years` is when the
                model was built. */}
            {FINDER_MAKES.map(({ make, models }) => (
              <optgroup key={make} label={make}>
                {models.map(({ model, years }) => (
                  <option key={model} data-years={years}>
                    {model}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>

        {/* Renders nothing. Leaf island (D70, LA-05): narrows `Make` to the
            chosen `Year` and `Model` to both, clears an orphaned choice, by
            attribute only, and focuses the field a partial vehicle lacks. See
            `finder-model-sync.tsx` for why `hidden` + `disabled` rather than
            rebuilding the options. */}
        <FinderModelSync
          yearId={FIELD_ID.year}
          makeId={FIELD_ID.make}
          modelId={FIELD_ID.model}
          focusId={firstMissing === undefined ? undefined : FIELD_ID[firstMissing]}
        />

        {/* `promo` = 52 mobile -> 56 desktop, 14px type, 12px icon gap
            (home.md:161,164). Mobile adds `margin-top:4px` (home.md:164). */}
        {switchable ? (
          <FinderSwitchSubmit
            options={switchOptions(cta)}
            formId={FINDER_FORM_ID}
            className={hero ? "mt-1 sm:mt-0 max-sm:fold-short:col-span-2" : "mt-1 sm:mt-0"}
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
    </form>
  );
}
