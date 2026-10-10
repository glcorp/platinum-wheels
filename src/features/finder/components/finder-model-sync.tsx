"use client";

import { useEffect } from "react";

import { Select } from "@/components/ui/select";
import { bindFinder, type FinderIds } from "@/features/finder/bind-finder";

/**
 * Narrows the finder's `Make` and `Model` selects to the chosen `Year` and
 * `Make` (D70; by year too since LA-05), and owns the scripting-off Model list.
 * The narrowing itself is `bindFinder()` (`bind-finder.ts`), which the server
 * also runs as an inline script while the page loads, so the list is there
 * before React is (D168, C3). This island binds it on mount, which is what a
 * page reached by client navigation needs: an inline script React inserts
 * never runs, and the `<noscript>` React draws on the client is empty. Hence
 * `list` arrives as a prop and is handed to `bindFinder()` directly, instead
 * of being read back from the page.
 *
 * Renders the `<noscript>` that is the scripting-off visitor's own Model
 * select (the whole list, D44, D45), with a style that hides the
 * placeholder-only select beside it. It lives here, not in the Server
 * Component, so the list travels once: as this prop, which the server also
 * writes into the `<noscript>` (React renders a `<noscript>`'s children on the
 * server only). Placed inside the Model cell, where the select it replaces
 * sits; it draws nothing else.
 *
 * `focusId` (LA-05 P2): when the results page sends a part-filled vehicle
 * back, the field to finish is focused once on mount.
 */
export interface FinderModelSyncProps {
  ids: FinderIds;
  /** The Model select's inside (placeholder + every make's `<optgroup>`),
   *  from `options-html.ts`, or `null` when the visible select already
   *  carries the list (a part-filled vehicle that kept a model). */
  list: string | null;
  /** `id` of the scripting-off Model select inside the `<noscript>`. */
  noscriptSelectId: string;
  /** Passed through to the scripting-off select. */
  describedBy?: string;
  /** `id` of a field to focus once on mount, or omitted. */
  focusId?: string;
}

export function FinderModelSync({
  ids,
  list,
  noscriptSelectId,
  describedBy,
  focusId,
}: FinderModelSyncProps) {
  const { yearId, makeId, modelId, sourceId } = ids;
  useEffect(() => {
    bindFinder({ yearId, makeId, modelId, sourceId }, list);
    if (focusId !== undefined) document.getElementById(focusId)?.focus();
  }, [yearId, makeId, modelId, sourceId, list, focusId]);

  if (list === null) return null;
  return (
    <noscript id={sourceId}>
      <style>{".finder-js-only{display:none!important}"}</style>
      <Select
        id={noscriptSelectId}
        name="model"
        autoComplete="off"
        aria-label="Model"
        aria-describedby={describedBy}
        dangerouslySetInnerHTML={{ __html: list }}
      />
    </noscript>
  );
}
