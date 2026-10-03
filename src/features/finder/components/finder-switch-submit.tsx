"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  FINDER_CATEGORIES,
  isFinderCategory,
  type FinderCategory,
} from "@/lib/finder-category";
import {
  getFinderCategory,
  resetFinderCategory,
  setFinderCategory,
  subscribeFinderCategory,
  useFinderCategory,
} from "@/lib/finder-category-store";

/**
 * The home finder's submit button, switchable between tires, wheels and
 * accessories by the header nav — **D128** (owner, 2026-10-03: "only the find
 * my tires changes to find my wheels or find my accessories"; chosen option
 * "Header nav switches it, home only", and "Year/Make/Model on all").
 *
 * Only the CTA copy and where the GET lands change; the three selects are the
 * same for every category. The form's own `action` stays `ROUTES.tires`
 * (`vehicle-finder.tsx`), and this button carries `formAction` = the chosen
 * category's route, so with scripting off the server-rendered button says
 * `Find my tires` and submits to `/tires`, exactly as before D128.
 *
 * All three labels render, stacked in one grid cell, and only the chosen one
 * is opaque, so a switch crossfades (`finder-cta-label`, globals.css D128
 * block) instead of cutting. The others are `aria-hidden`, which takes them
 * out of the button's accessible name. Each label carries its own arrow so the
 * visible label is centred exactly as the single drawn label was; the cell is
 * as wide as `Find my accessories`, measured 237.7px against the 246px button
 * at 320, so the widest label still fits on one line on the narrowest phone.
 *
 * On a header click (`reason: "user"`) it also brings the finder into view if
 * its fields or CTA are off screen, and says `Searching wheels` in a polite live
 * region. The `?finder=` deep link (`reason: "restore"`) does neither.
 */
export interface FinderSwitchSubmitProps {
  /** Per category: the results route, the CTA copy, and the plural noun the
   *  announcement uses. All three come from `CATEGORY_CONFIG` on the server. */
  options: Readonly<Record<FinderCategory, { route: string; cta: string; noun: string }>>;
  /** `id` of the finder `<form>`, brought into view on a switch. Found by id
   *  for the same reason `FinderModelSync` finds its selects by id. */
  formId: string;
  className?: string;
}

/**
 * Bring the finder into view if any of it that matters is off screen: its top
 * edge (the first select) down to the bottom of the CTA. The panel's own
 * bottom padding is allowed past the fold, because the drawn desktop
 * composition puts it there (1440x900: CTA ends 12px above the fold, padding
 * runs 21px past it), and nudging the page 21px on every switch would be
 * motion for nothing. Smooth unless reduced motion is on.
 */
function bringIntoView(form: HTMLFormElement) {
  const top = form.getBoundingClientRect().top;
  const cta = form.querySelector('button[type="submit"]');
  const bottom = (cta ?? form).getBoundingClientRect().bottom;
  if (top >= 0 && bottom <= window.innerHeight) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  form.scrollIntoView({
    behavior: reduce ? "instant" : "smooth",
    // Taller than the screen (a landscape phone): show its top, where the
    // first select is. Otherwise move only as far as it takes.
    block: bottom - top > window.innerHeight ? "start" : "nearest",
  });
}

export function FinderSwitchSubmit({ options, formId, className }: FinderSwitchSubmitProps) {
  const category = useFinderCategory();
  const [announcement, setAnnouncement] = useState("");

  useEffect(
    () =>
      subscribeFinderCategory((reason) => {
        if (reason !== "user") return;
        setAnnouncement(`Searching ${options[getFinderCategory()].noun}`);
        const form = document.getElementById(formId);
        if (form instanceof HTMLFormElement) bringIntoView(form);
      }),
    [options, formId],
  );

  // Arrival and departure. `/` is prerendered and must stay static, so the
  // `?finder=` deep link is read here in the browser rather than on the
  // server; the page paints tires first and switches on hydration. Leaving
  // resets the value so the next visit matches the server render.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("finder");
    if (isFinderCategory(requested) && requested !== getFinderCategory()) {
      setFinderCategory(requested, "restore");
    }
    return resetFinderCategory;
  }, []);

  return (
    <>
      <Button
        type="submit"
        formAction={options[category].route}
        variant="primary"
        size="promo"
        fullWidth
        className={className}
      >
        <span className="grid">
          {FINDER_CATEGORIES.map((id) => (
            <span
              key={id}
              data-active={id === category ? "" : undefined}
              aria-hidden={id === category ? undefined : true}
              className="finder-cta-label inline-flex items-center gap-3 whitespace-nowrap"
            >
              {options[id].cta}
              <span aria-hidden="true">→</span>
            </span>
          ))}
        </span>
      </Button>
      {/* Absolutely positioned (`sr-only`), so it takes no cell in the fields
          grid and no gap in the mobile column. Empty until the first switch:
          a page load announces nothing. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </>
  );
}
