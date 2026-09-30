import { FieldLabel } from "@/components/ui/field-label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { FINDER_MAKES, finderYears } from "@/features/finder/data";
import { FinderModelSync } from "@/features/finder/components/finder-model-sync";

/**
 * The vehicle finder — Year / Make / Model native selects plus the primary
 * "Find my tires" CTA. Overlaps the hero (design/inventory/home.md:35-37,
 * §2.3 lines 152-165). Ships unselected with a placeholder option per select
 * (D28); the artboard pre-fill `2021 / Honda / Civic` is sample data and does
 * not ship. No JS required to submit — plain GET to ROUTES.tires.
 *
 * Still a Server Component after D70. The `Model` select renders every make's
 * models under an `<optgroup>` per make, which is the whole list a
 * scripting-off visitor needs; the one leaf island, `FinderModelSync`, renders
 * no markup and narrows that list to the chosen `Make` when JS is available.
 *
 * No field carries `required` (D79). None of the three selects fires the
 * browser's native constraint-validation bubble ("Please select an item in
 * the list") on an empty submit — that bubble is browser chrome, not page
 * content, so it cannot be restyled to match the design (root `llm.md` §5b
 * D79). An empty or partial submit is not an error: `parseResultsQuery`
 * treats year/make/model as all-or-nothing (`src/features/results/query.ts`,
 * "All three or none"), so a half-filled or fully empty finder simply names
 * no vehicle and the destination category page renders unfiltered — the same
 * outcome as typing the bare route. A submitted Make/Model pair that does not
 * belong together resolves the same way: `findFitment` (`data.ts`) does a
 * literal `"<make>|<model>"` lookup and returns `null` on no match, which
 * `fitmentSize()` (`src/features/results/search.ts`) treats identically to no
 * vehicle at all. Nothing downstream can receive a value it cannot handle.
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
}

export function VehicleFinder({
  variant = "hero",
  action = ROUTES.tires,
  cta = "Find my tires",
  carry = [],
}: VehicleFinderProps) {
  return (
    <form
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
        variant === "hero"
          ? "relative z-10 -mt-18 sm:-mt-30 mx-4 sm:mx-8 md:mx-12 lg:mx-auto lg:max-w-content"
          : "w-full",
        // Padding 20px -> 32px (home.md:36-37); inner gap 12px -> 16px.
        "p-5 sm:p-8 flex flex-col gap-3 sm:gap-4",
      ].join(" ")}
    >
      {carry.map(([name, value], index) => (
        <input key={`${name}-${index}`} type="hidden" name={name} value={value} />
      ))}
      <div
        className={[
          // Mobile: stacked full-width fields (home.md:36 "flex-direction:column").
          "flex flex-col gap-3",
          // Tablet: 2x2 grid (DESIGN.md §8 "Finder | ... | 2×2 grid").
          "sm:grid sm:grid-cols-2 sm:gap-4",
          /* Desktop: 1fr 1.2fr 1.2fr 300px (home.md:154 `grid-template-columns`).
             TOKEN MISSING: @utility finder-grid — see final report. Class does
             not exist yet; the coordinator adds it to globals.css. */
          "md:finder-grid md:gap-4 md:items-end",
        ].join(" ")}
      >
        <div>
          <FieldLabel htmlFor="finder-year">Year</FieldLabel>
          <Select id="finder-year" name="year" autoComplete="off" defaultValue="">
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
          <Select id="finder-make" name="make" autoComplete="off" defaultValue="">
            <option value="" disabled>
              Make
            </option>
            {FINDER_MAKES.map(({ make }) => (
              <option key={make} value={make}>
                {make}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <FieldLabel htmlFor="finder-model">Model</FieldLabel>
          {/* Every model of every make ships, grouped with <optgroup> per
              make, because the submit is a plain GET and must work with
              scripting off (D44, D45). `FinderModelSync` below narrows the
              list to the chosen make when JS is available (D70); without it
              this is the whole list, exactly as it was before D70. */}
          <Select id="finder-model" name="model" autoComplete="off" defaultValue="">
            <option value="" disabled>
              Model
            </option>
            {FINDER_MAKES.map(({ make, models }) => (
              <optgroup key={make} label={make}>
                {models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>

        {/* Renders nothing. Leaf island (D70): narrows `Model` to the chosen
            `Make` and clears an orphaned model, by attribute only. See
            `finder-model-sync.tsx` for why `hidden` + `disabled` rather than
            rebuilding the options. */}
        <FinderModelSync makeId="finder-make" modelId="finder-model" />

        <Button
          type="submit"
          variant="primary"
          size="promo"
          fullWidth
          // `promo` = 52 mobile -> 56 desktop, 14px type, 12px icon gap
          // (home.md:161,164). Mobile adds `margin-top:4px` (home.md:164).
          className="mt-1 sm:mt-0"
        >
          {cta} <span aria-hidden="true">→</span>
        </Button>
      </div>
    </form>
  );
}
