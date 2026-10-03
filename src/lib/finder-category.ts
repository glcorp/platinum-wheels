/* ---------------------------------------------------------------------------
   The home finder's category (D128) — which of `Find my tires`, `Find my
   wheels` or `Find my accessories` the hero finder on `/` is showing.

   Owner, 2026-10-03: on the home page, clicking Wheels or Accessories in the
   header "should stay on the home page and refresh that part only … only the
   find my tires changes to find my wheels or find my accessories", and the
   chosen option: "Header nav switches it, home only". So the header (a
   `src/components/site/` file) writes this value and the finder
   (`src/features/finder/`) reads it. It lives in `src/lib/` because the
   header may not import a feature (D37); that is also why the three
   categories are spelled out here rather than imported from `catalog/`, the
   same reason `cart.ts` spells them.

   In memory only, for the life of the page. No URL write: Next's patched
   `history.replaceState` runs a router transition, which is more machinery
   than a three-way switch is worth. A visit to `/?finder=wheels` is read once
   by the finder on arrival (`restore`), so a link can still open the home
   page on wheels. Leaving `/` puts it back to tires (`resetFinderCategory`),
   so a later visit agrees with the server-rendered page, which always says
   tires.

   Two files: this one is pure (names, ids, guards) so the Server Components
   that render the finder and the header can import it; the live value and
   its React hook are `finder-category-store.ts`, which only the client
   islands import.
   --------------------------------------------------------------------------- */

export const FINDER_CATEGORIES = ["tires", "wheels", "accessories"] as const;

export type FinderCategory = (typeof FINDER_CATEGORIES)[number];

/** `id` of the finder `<form>`. Spelled here so the header can point
 *  `aria-controls` at it without importing the finder (D37). */
export const FINDER_FORM_ID = "vehicle-finder";

/** `id` of the header's visually hidden line that tells a screen reader what
 *  the category links do on `/` (`aria-describedby`). Here for the same
 *  reason: the header renders it, two client islands point at it. */
export const FINDER_SWITCH_HINT_ID = "finder-switch-hint";

/** The category the server renders, and the one a fresh page starts on. */
export const DEFAULT_FINDER_CATEGORY: FinderCategory = "tires";

export function isFinderCategory(value: unknown): value is FinderCategory {
  return (
    typeof value === "string" &&
    (FINDER_CATEGORIES as readonly string[]).includes(value)
  );
}

/**
 * A plain left click with no modifier: the only click that switches the
 * finder. Ctrl, Cmd, Shift, Alt and middle clicks open the category page as
 * the link always did (new tab, new window, download).
 */
export function isPlainPrimaryClick(event: MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}
