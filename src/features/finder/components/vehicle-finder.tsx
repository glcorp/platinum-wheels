import { FieldLabel } from "@/components/ui/field-label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { FINDER_MAKES, FINDER_YEARS } from "@/features/finder/data";

/**
 * The vehicle finder — Year / Make / Model native selects plus the primary
 * "Find my tires" CTA. Overlaps the hero (design/inventory/home.md:35-37,
 * §2.3 lines 152-165). Ships unselected with a placeholder option per select
 * (D28); the artboard pre-fill `2021 / Honda / Civic` is sample data and does
 * not ship. No JS required to submit — plain GET to ROUTES.results.
 *
 * Submit target and CTA copy are per category (D58). The home hero and
 * `/results` keep the drawn `ROUTES.results` + `Find my tires`, byte for byte;
 * `/wheels` submits to `/wheels` and reads `Find my wheels`, so the disclosure
 * never throws a visitor back to tires. `/accessories` does not render a
 * finder at all — an accessory derives nothing from a vehicle, so a control
 * that changes no result would be a lie (coordinator, 2026-09-21, D58).
 *
 * Two placements, one form:
 * - `hero` (default, unchanged) — the home page panel that overlaps the hero
 *   photo: negative top margin plus its own side margins and container cap.
 * - `inline` (D45) — the `/results` toolbar's `Change vehicle` disclosure.
 *   Drops the overlap and the side margins/cap so the panel takes its
 *   parent's width; the padding, border, fields and CTA are identical.
 *   Only ever one finder per page, so the field `id`s stay unique.
 */
export interface VehicleFinderProps {
  variant?: "hero" | "inline";
  /**
   * Where the GET submit lands. Defaults to `ROUTES.results`, the drawn
   * target, so the home hero and `/results` are unchanged; `/wheels` passes
   * its own route (D58).
   */
  action?: string;
  /**
   * CTA copy. Defaults to the artboard-verbatim `Find my tires`
   * (home-desktop.html:161); `/wheels` passes `Find my wheels`, which is new
   * copy under `.claude/rules/ui.md` and keeps the same two-word shape.
   */
  cta?: string;
}

export function VehicleFinder({
  variant = "hero",
  action = ROUTES.results,
  cta = "Find my tires",
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
          <Select id="finder-year" name="year" required autoComplete="off" defaultValue="">
            <option value="" disabled>
              Year
            </option>
            {FINDER_YEARS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <FieldLabel htmlFor="finder-make">Make</FieldLabel>
          <Select id="finder-make" name="make" required autoComplete="off" defaultValue="">
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
          {/* No JS, so the Model select cannot filter by the chosen Make: it
              renders every model of every make, grouped with <optgroup> per
              make. Honest rather than wrong — see finder llm.md Open. */}
          <Select id="finder-model" name="model" required autoComplete="off" defaultValue="">
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
