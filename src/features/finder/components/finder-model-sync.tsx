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
 * D67). This island renders **nothing**. It sets two boolean attributes on
 * nodes already in the document and, once, appends the Model list (below).
 * With scripting off the controls are the full list, every model stays
 * reachable, and a model picked for a year it was not built in names no
 * vehicle (`isFinderVehicle`), which the results page then asks the visitor to
 * finish (`partialVehicle`).
 *
 * The Model list is built here on the first touch of the finder, not served
 * to a visitor with scripting. Parsing and styling ~1,100 `<option>`s on load
 * was about a fifth of the main-thread work of `/` and `/tires`, so the page
 * ships them as the text of a `<noscript>` (the no-JS visitor's own Model
 * select, `vehicle-finder.tsx`) and this island turns that text into
 * `<optgroup>`s appended after the placeholder React rendered. Nothing React
 * owns is removed or replaced, so the D70 rule below still holds.
 *
 * **The Model list is narrowed by removing nodes, not by attributes (2026-10-07).**
 * iOS WebKit's native picker ignores `hidden` on an `<option>` or `<optgroup>`
 * and lists every make's models, greyed (owner's iPhone screenshot: Acura and
 * Aston Martin models under a chosen Alfa Romeo). The Model `<optgroup>`s are
 * not React's: they are appended by this island from the `<noscript>` text, or
 * come from `dangerouslySetInnerHTML`, whose children React never reconciles.
 * So the island keeps the full list in memory and puts back into the select
 * only the groups and options that fit. React's own placeholder option is
 * never touched.
 *
 * The Make select keeps the attribute rule below: its options are React's.
 * On iOS a make not built in the chosen year shows greyed and unselectable.
 *
 * Why `hidden` **and** `disabled` on the Make options, rather than removing
 * them:
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
  /**
   * `id` of the `<noscript>` that holds the whole model list, when the Model
   * select was served with only its placeholder (`vehicle-finder.tsx`); the
   * options are built from that text on the first touch of the finder.
   * Omitted when the select already carries them.
   */
  modelOptionsId?: string;
  /** `id` of a field to focus once on mount, or omitted. */
  focusId?: string;
}

/** Show or hide one option (or group) by both attributes. */
function show(node: HTMLOptionElement | HTMLOptGroupElement, visible: boolean) {
  node.hidden = !visible;
  node.disabled = !visible;
}

export function FinderModelSync({
  yearId,
  makeId,
  modelId,
  modelOptionsId,
  focusId,
}: FinderModelSyncProps) {
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
    let groups = Array.from(modelSelect.getElementsByTagName("optgroup"));

    /* The Model select is served with only its placeholder (see the header);
       the whole list is the text of a `<noscript>`, which a browser with
       scripting keeps as text and never parses into elements. It is built
       once, by the first touch of the finder, and appended AFTER the
       placeholder React rendered: nothing React owns is removed or replaced
       (D70), and the chosen option stays the placeholder. */
    const optionsNode =
      modelOptionsId === undefined ? null : document.getElementById(modelOptionsId);
    let built = optionsNode === null || groups.length > 0;
    const build = () => {
      if (built) return;
      built = true;
      const holder = document.createElement("template");
      holder.innerHTML = optionsNode?.textContent ?? "";
      const all = holder.content.querySelector("select");
      if (all === null) return;
      const list = document.createDocumentFragment();
      for (const group of Array.from(all.getElementsByTagName("optgroup"))) {
        list.appendChild(group);
      }
      modelSelect.appendChild(list);
      groups = Array.from(modelSelect.getElementsByTagName("optgroup"));
      captureModels();
    };

    /* The whole Model list, in served order, held outside the document so the
       select can carry only what fits (see the header: iOS ignores `hidden`). */
    let models: Array<{ group: HTMLOptGroupElement; options: HTMLOptionElement[] }> = [];
    const captureModels = () => {
      models = groups.map((group) => ({
        group,
        options: Array.from(group.getElementsByTagName("option")),
      }));
    };
    captureModels();

    const fits = (node: HTMLOptionElement, year: number | null) =>
      year === null || builtIn(node.dataset.years ?? "", year);

    const sync = () => {
      const year = yearSelect.value === "" ? null : Number(yearSelect.value);

      for (const option of makeOptions) show(option, fits(option, year));
      if (makeSelect.selectedOptions[0]?.hidden) makeSelect.value = "";

      const make = makeSelect.value;
      const chosen = modelSelect.value;
      const list = document.createDocumentFragment();
      for (const { group, options } of models) {
        group.remove();
        // `group.label` is the make, spelled by `FINDER_MAKES` in both selects.
        if (make !== "" && group.label !== make) continue;
        const keep = options.filter((option) => fits(option, year));
        group.replaceChildren(...keep);
        if (keep.length > 0) list.appendChild(group);
      }
      modelSelect.appendChild(list);
      // The chosen model survives only if it is still listed.
      modelSelect.value = chosen;
      if (modelSelect.value !== chosen) modelSelect.value = "";
    };

    /* A change always needs the list: it is what gets narrowed. */
    const onChange = () => {
      build();
      sync();
    };

    /* First touch of the finder builds the list. The Model select itself
       needs it before its picker opens, so a touch on it builds at once; a
       touch on Year or Make is a beat ahead of the Model select and builds on
       the next task, so the picker the visitor just asked for is not held up
       by it. Capture phase on the form, so it runs before any picker. */
    const form = modelSelect.form;
    const onTouch = (event: Event) => {
      if (built) return;
      if (event.target === modelSelect) {
        build();
        sync();
      } else {
        window.setTimeout(onChange, 0);
      }
    };
    const touchEvents = ["pointerdown", "focusin", "keydown"] as const;
    if (!built && form !== null) {
      for (const type of touchEvents) form.addEventListener(type, onTouch, true);
    }

    // Once on mount as well as on change: a back/forward restore can hand the
    // form a year or make chosen before the island existed. With neither
    // chosen nothing is narrowed (every option is shown, as served), so the
    // walk over ~1,100 options is skipped on a plain load.
    if (yearSelect.value !== "" || makeSelect.value !== "") onChange();
    if (focusId !== undefined) document.getElementById(focusId)?.focus();
    yearSelect.addEventListener("change", onChange);
    makeSelect.addEventListener("change", onChange);
    return () => {
      if (form !== null) {
        for (const type of touchEvents) form.removeEventListener(type, onTouch, true);
      }
      yearSelect.removeEventListener("change", onChange);
      makeSelect.removeEventListener("change", onChange);
    };
  }, [yearId, makeId, modelId, modelOptionsId, focusId]);

  return null;
}
