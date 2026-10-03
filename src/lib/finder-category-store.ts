/* ---------------------------------------------------------------------------
   The live value behind `finder-category.ts` (D128): which category the home
   finder shows, set by the header's category links on `/` and read by the
   finder's submit island. Client islands only; it imports React.

   React reads it through `useSyncExternalStore`; the server snapshot is
   `tires`, which is what the prerendered `/` shows.
   --------------------------------------------------------------------------- */

import { useSyncExternalStore } from "react";

import { DEFAULT_FINDER_CATEGORY, type FinderCategory } from "./finder-category";

/** Why the value changed. `user` = a header click, so the finder scrolls into
 *  view and announces itself; `restore` = the `?finder=` deep link on arrival,
 *  which does neither. */
export type FinderCategoryReason = "user" | "restore";

type Listener = (reason: FinderCategoryReason) => void;

let current: FinderCategory = DEFAULT_FINDER_CATEGORY;
const listeners = new Set<Listener>();

export function getFinderCategory(): FinderCategory {
  return current;
}

/**
 * Switch the finder. Listeners hear every call, including a click on the
 * category already showing: the value does not change, but the visitor still
 * asked to see the finder, so it still scrolls into view.
 */
export function setFinderCategory(
  next: FinderCategory,
  reason: FinderCategoryReason = "user",
): void {
  current = next;
  for (const listener of listeners) listener(reason);
}

/** Back to tires without telling anyone: called as the finder leaves the page,
 *  when there is nothing left on screen to update. */
export function resetFinderCategory(): void {
  current = DEFAULT_FINDER_CATEGORY;
}

export function subscribeFinderCategory(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function serverSnapshot(): FinderCategory {
  return DEFAULT_FINDER_CATEGORY;
}

export function useFinderCategory(): FinderCategory {
  return useSyncExternalStore(subscribeFinderCategory, getFinderCategory, serverSnapshot);
}
