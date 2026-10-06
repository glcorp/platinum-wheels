"use client";

/* ---------------------------------------------------------------------------
   CategoryTabs — Tires | Wheels | Accessories as a visible segmented row,
   below `md:` only (D158).

   Owner, 2026-10-06: "in mobile, it comes under hamburger so essentially it is
   invisible to the client if they doesnt click on it. they dont have the
   option to change to wheel or accessories … it should be easy to switch".
   From `md:` (1100) the header's own link row shows the three categories, so
   this row is hidden there and the desktop pages are unchanged.

   Two places, one component:
   - the results pages (`results-page.tsx`): plain links to the three category
     routes, each carrying the searched vehicle (`categoryHref`), the current
     one `aria-current="page"`;
   - the home hero finder (`vehicle-finder.tsx`, `finderSwitch`): a plain tap
     switches the finder's category in place, as the header links do on `/`
     (D128), and the chosen tab carries `aria-current="true"` because the page
     is still home. The links stay real `<a href>`s, so with JS off, before
     hydration, or on a modified click they open the category page.

   The look is the quote form's Preferred contact segmented control
   (`quote-form.tsx`): one `--border-strong` box, separators between segments
   only. The selected one is filled `--accent` (owner, 2026-10-07: "selected
   category colour should be green and not white"; it was `--text`). 44px
   tall, the touch minimum.
   `data-segment` + `aria-current` is the forced-colours hook (globals.css).
   --------------------------------------------------------------------------- */

import Link from "next/link";
import { finderSwitchRef } from "@/components/site/site-nav-links";
import { cx } from "@/lib/cx";
import {
  FINDER_FORM_ID,
  FINDER_SWITCH_HINT_ID,
  type FinderCategory,
} from "@/lib/finder-category";
import { setFinderCategory, useFinderCategory } from "@/lib/finder-category-store";

export type CategoryTab = { id: FinderCategory; label: string; href: string };

export function CategoryTabs({
  items,
  active,
  finderSwitch = false,
  className,
  listClassName,
  everyWidth = false,
}: {
  items: ReadonlyArray<CategoryTab>;
  /** The route's own category. Ignored with `finderSwitch`, where the
   *  finder's live category is the current one. */
  active?: FinderCategory;
  /** `/` only: a tap switches the hero finder instead of navigating (D128). */
  finderSwitch?: boolean;
  className?: string;
  /** Extra classes on the segmented box, e.g. the home finder's fold step. */
  listClassName?: string;
  /** `/styleguide` only: show the row from `md:` too, so the reference page
   *  can draw it at desktop width. */
  everyWidth?: boolean;
}) {
  const finderCategory = useFinderCategory();
  const current = finderSwitch ? finderCategory : active;

  return (
    <nav aria-label="Shop by category" className={cx(!everyWidth && "md:hidden", className)}>
      {/* No `overflow-hidden` on the box: it would clip the focus ring, which
          sits at offset 0 (D16). The end segments round their own corners. */}
      <ul className={cx("rounded-ctl border-border-strong grid h-11 grid-cols-3 border", listClassName)}>
        {items.map((item, index) => {
          const selected = item.id === current;
          return (
            <li key={item.id} className={cx("flex", index > 0 && "border-border-strong border-l")}>
              <Link
                href={item.href}
                ref={
                  finderSwitch
                    ? finderSwitchRef(() => setFinderCategory(item.id))
                    : undefined
                }
                aria-controls={finderSwitch ? FINDER_FORM_ID : undefined}
                aria-describedby={finderSwitch ? FINDER_SWITCH_HINT_ID : undefined}
                aria-current={selected ? (finderSwitch ? "true" : "page") : undefined}
                data-segment=""
                className={cx(
                  "font-sans flex flex-1 items-center justify-center text-14 leading-flat font-medium",
                  "focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-0",
                  /* A lime ring on the lime segment would vanish; the
                     selected one takes the ink ring instead. */
                  selected ? "focus-visible:outline-ink" : "focus-visible:outline-accent",
                  index === 0 && "rounded-l-ctl",
                  index === items.length - 1 && "rounded-r-ctl",
                  selected
                    ? "bg-accent text-on-accent"
                    : "text-ink-muted hover:text-ink active:opacity-70",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
