"use client";

import { useEffect } from "react";

import { builtIn } from "@/features/finder/years";

/**
 * Narrows the finder's `Make` and `Model` selects to the chosen `Year` and
 * `Make`: **D70** (owner, 2026-09-22: "model should only show for those whose
 * make is selected"), and since LA-05 (D145 audit; D110 approved
 * year-dependent model lists) by year as well, so a 2014 Tesla Model Y can
 * no longer be picked.
 *
 * This is progressive enhancement, not a rewrite. `VehicleFinder` stays a
 * Server Component and keeps rendering every make and every `<optgroup>` of
 * every model, each option carrying the years it was built in `data-years`
 * (D45 chose the inline finder explicitly as "Inline finder, no JS", and the
 * plain GET submit is load-bearing on all three results routes: D44, D58,
 * D67). This island renders **nothing** and only sets two boolean attributes
 * on nodes already in the document. With scripting off the controls are the
 * full list, every model stays reachable, and a model picked for a year it was
 * not built in names no vehicle (`isFinderVehicle`), which the results page
 * then asks the visitor to finish (`partialVehicle`).
 *
 * Why `hidden` **and** `disabled`, and why on the `<option>`s too, rather
 * than removing or rebuilding them:
 * - `<option>`/`<optgroup>` visibility is the one genuinely inconsistent
 *   corner of native selects. `hidden` is honoured by current Chrome, Firefox
 *   and Safari, but older WebKit ignores it. `disabled` has no such history.
 * - `hidden` on an `<optgroup>` only suppresses the group's own label; the
 *   browser still paints each child `<option>`, so both attributes go on every
 *   option as well as its group.
 * - Together they degrade cleanly: best case the wrong choices are gone,
 *   worst case they are visible but unselectable.
 * - Removing or rebuilding the option nodes was rejected: React owns them,
 *   and deleting them behind its back risks an `insertBefore` against a node
 *   that is no longer in the document. Setting an attribute React never set
 *   is safe.
 *
 * With no year and no make chosen nothing is narrowed: the list is exactly
 * the no-JS list (D28). A Year or Make change that orphans the chosen Make or
 * Model resets it to its placeholder rather than leaving a vehicle that never
 * existed.
 *
 * `focusId` (LA-05 P2): when the results page sends a part-filled vehicle
 * back, the field to finish is focused once on mount.
 */
export interface FinderModelSyncProps {
  /** `id` of the Year `<select>`. `VehicleFinder` owns all three ids. */
  yearId: string;
  /** `id` of the Make `<select>`; its options carry `data-years`. */
  makeId: string;
  /** `id` of the Model `<select>`, whose `<optgroup label>`s are the makes. */
  modelId: string;
  /** `id` of a field to focus once on mount, or omitted. */
  focusId?: string;
}

/** Show or hide one option (or group) by both attributes. */
function show(node: HTMLOptionElement | HTMLOptGroupElement, visible: boolean) {
  node.hidden = !visible;
  node.disabled = !visible;
}

export function FinderModelSync({ yearId, makeId, modelId, focusId }: FinderModelSyncProps) {
  useEffect(() => {
    // Located by id rather than by ref: a ref would need a rendered element,
    // and rendering nothing is what guarantees this island cannot move a
    // measured value. One finder per page, so the ids are unique.
    const yearNode = document.getElementById(yearId);
    const makeNode = document.getElementById(makeId);
    const modelNode = document.getElementById(modelId);
    if (
      !(yearNode instanceof HTMLSelectElement) ||
      !(makeNode instanceof HTMLSelectElement) ||
      !(modelNode instanceof HTMLSelectElement)
    ) {
      return;
    }
    const yearSelect = yearNode;
    const makeSelect = makeNode;
    const modelSelect = modelNode;
    const makeOptions = Array.from(makeSelect.options).filter((o) => o.value !== "");
    const groups = Array.from(modelSelect.getElementsByTagName("optgroup"));

    const fits = (node: HTMLOptionElement, year: number | null) =>
      year === null || builtIn(node.dataset.years ?? "", year);

    const sync = () => {
      const year = yearSelect.value === "" ? null : Number(yearSelect.value);

      for (const option of makeOptions) show(option, fits(option, year));
      if (makeSelect.selectedOptions[0]?.hidden) makeSelect.value = "";

      const make = makeSelect.value;
      for (const group of groups) {
        // `group.label` is the make, spelled by `FINDER_MAKES` in both selects.
        const sameMake = make === "" || group.label === make;
        let any = false;
        for (const option of Array.from(group.getElementsByTagName("option"))) {
          const visible = sameMake && fits(option, year);
          show(option, visible);
          any ||= visible;
        }
        show(group, any);
      }
      if (modelSelect.selectedOptions[0]?.hidden) modelSelect.value = "";
    };

    // Once on mount as well as on change: a back/forward restore can hand the
    // form a year or make chosen before the island existed.
    sync();
    if (focusId !== undefined) document.getElementById(focusId)?.focus();
    yearSelect.addEventListener("change", sync);
    makeSelect.addEventListener("change", sync);
    return () => {
      yearSelect.removeEventListener("change", sync);
      makeSelect.removeEventListener("change", sync);
    };
  }, [yearId, makeId, modelId, focusId]);

  return null;
}
