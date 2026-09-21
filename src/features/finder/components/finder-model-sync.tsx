"use client";

import { useEffect } from "react";

/**
 * Narrows the finder's `Model` select to the chosen `Make` — **D70**
 * (owner, 2026-09-22: "model should only show for those whose make is
 * selected").
 *
 * This is progressive enhancement, not a rewrite. `VehicleFinder` stays a
 * Server Component and keeps rendering every `<optgroup>` of every make
 * (D45 chose the inline finder explicitly as "Inline finder, no JS", and the
 * plain GET submit is load-bearing on all three results routes — D44, D58,
 * D67). This island renders **nothing** — no element, no class, no style — and
 * only mutates two boolean attributes — on the optgroups **and on their
 * child options** — that are already in the document. With scripting off the
 * control is byte-identical to what shipped before D70, so every model stays
 * reachable and the form still submits. That is also why this folder's
 * "don't make the finder a client component" rule is intact: the finder is
 * not a client component; this leaf is, and it has no UI.
 *
 * Why `hidden` **and** `disabled`, and why on the `<option>`s too, rather
 * than removing or rebuilding them:
 * - `<option>`/`<optgroup>` visibility is the one genuinely inconsistent
 *   corner of native selects. `hidden` is honoured by current Chrome, Firefox
 *   and Safari, but older WebKit ignores it (and has always ignored
 *   `display:none` on an option). So `hidden` alone could leave a browser
 *   showing models the make does not have.
 * - `disabled` on an `<optgroup>` has no such history: every engine greys its
 *   options out and refuses the selection, including with a keyboard.
 * - Setting `hidden`/`disabled` on the `<optgroup>` alone is not enough:
 *   `disabled` cascades to child options in every engine (which is why an
 *   earlier version already greyed the wrong makes' models out), but `hidden`
 *   on the group only suppresses the group's own `<label>` text — the
 *   browser still paints each child `<option>`. The fix is to set both
 *   attributes on every `<option>` as well as its `<optgroup>`.
 * - Together they degrade cleanly. Best case the wrong makes' models are gone
 *   from the list; worst case they are visible but unselectable. Neither case
 *   can produce a Make/Model pair that disagrees.
 * - Removing or rebuilding the option nodes was rejected: those nodes are
 *   owned by React's server-rendered tree, and deleting them behind React's
 *   back risks an `insertBefore` against a node that is no longer in the
 *   document on a later re-render. Setting an attribute React never set is
 *   safe — reconciliation only writes properties whose props changed.
 *
 * Before a make is chosen nothing is narrowed: the list is exactly the no-JS
 * list, so a visitor who knows their model can still find it, and the `Model`
 * placeholder copy ships unchanged (D28). The owner's rule is conditional on a
 * make being selected; with none selected there is no "those".
 */
export interface FinderModelSyncProps {
  /** `id` of the Make `<select>` — `VehicleFinder` owns both ids. */
  makeId: string;
  /** `id` of the Model `<select>`, whose `<optgroup label>`s are the makes. */
  modelId: string;
}

export function FinderModelSync({ makeId, modelId }: FinderModelSyncProps) {
  useEffect(() => {
    // Located by id rather than by ref: a ref would need a rendered element,
    // and rendering nothing is what guarantees this island cannot move a
    // measured value. Both ids are unique per document — there is only ever
    // one finder on a page (see `vehicle-finder.tsx`).
    const makeNode = document.getElementById(makeId);
    const modelNode = document.getElementById(modelId);
    if (
      !(makeNode instanceof HTMLSelectElement) ||
      !(modelNode instanceof HTMLSelectElement)
    ) {
      return;
    }
    const makeSelect = makeNode;
    const modelSelect = modelNode;
    const groups = Array.from(modelSelect.getElementsByTagName("optgroup"));

    const sync = () => {
      const make = makeSelect.value;
      for (const group of groups) {
        // `group.label` is the make, spelled by `FINDER_MAKES` in both
        // selects, so the comparison needs no second map to fall out of date.
        const matches = make === "" || group.label === make;
        group.hidden = !matches;
        group.disabled = !matches;
        // `hidden`/`disabled` on an <optgroup> is not reliably inherited by
        // its <option> children: `disabled` cascades in every engine (hence
        // the grey-but-visible models the owner saw), but `hidden` on the
        // group only suppresses the group's own label — the browser still
        // paints each child option. Setting both attributes on every option
        // too is what actually removes them from the rendered list.
        for (const option of Array.from(group.getElementsByTagName("option"))) {
          option.hidden = !matches;
          option.disabled = !matches;
        }
      }

      // A Make change that orphans the chosen Model resets it to the
      // placeholder rather than leaving a pair that disagrees. No field
      // carries `required` (D79 — the browser's own validation bubble cannot
      // be restyled, so the fields stop asking it to fire), so this reset is
      // no longer the only thing standing between a scripted visitor and a
      // mismatched submit. It does not need to be: a reset-to-placeholder
      // model, or a genuine mismatch from a scripting-off visitor who ignores
      // the `<optgroup>` grouping, both resolve the same harmless way at
      // `src/features/results/query.ts` ("All three or none") and
      // `findFitment()` (`data.ts`, `"<make>|<model>"` lookup returning
      // `null` on no match) — no vehicle is named, or none is matched, and
      // the page renders as if none had been.
      if (make === "") return;
      const chosen = modelSelect.selectedOptions[0];
      const parent = chosen?.parentElement;
      if (parent instanceof HTMLOptGroupElement && parent.label !== make) {
        modelSelect.value = "";
      }
    };

    // Once on mount as well as on change: a back/forward restore can hand the
    // form a make that was chosen before the island existed.
    sync();
    makeSelect.addEventListener("change", sync);
    return () => makeSelect.removeEventListener("change", sync);
  }, [makeId, modelId]);

  return null;
}
