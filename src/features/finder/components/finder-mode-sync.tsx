"use client";

import { useEffect } from "react";

import { useFinderCategory } from "@/lib/finder-category-store";

/**
 * The home finder's `Vehicle | Size` switch and size selects (D169, C4).
 * Renders nothing.
 *
 * What works without it: the switch is two native radios, and the
 * `finder-show` rules (globals.css, Stream C block) show the matching fields
 * off `:has(:checked)`, so with scripting off or before hydration the visitor
 * can switch modes and submit. The category is tires then (the server's), and
 * every tire field submits; an empty select sends an empty value, which the
 * results page reads as no filter.
 *
 * What this adds:
 * - `data-finder-category` on the form, from the header and tab switch (D128,
 *   D158), which the same rules read, so wheels show their own size fields
 *   and accessories show the vehicle alone.
 * - `disabled` on every select the current category and mode hide, so only
 *   what the visitor sees is sent (tires and wheels both name a field
 *   `width`; the wheel selects are served disabled for that reason).
 * - Narrowing: each size select lists only the values found together with
 *   the others chosen, from the combinations `size-lists.ts` sends, and keeps
 *   its own value. The options are server markup React never reconciles
 *   (`dangerouslySetInnerHTML`), refilled with fresh copies on each change,
 *   the way the Model list is (iOS ignores `hidden` on an option).
 * - Season (D185, QA HOMEFIND-3; amends D132 for this panel only): in tire
 *   Size mode the Season select offers only the seasons that exist for the
 *   width, profile and rim chosen so far (all of them while none is chosen),
 *   from the digits `size-lists.ts` puts after each size. A season the
 *   chosen size does not come in is cleared. Without it every season shows.
 * - A submit leaves out the selects nothing was chosen in, so an empty
 *   search is `/tires`, not `/tires?width=&profile=&rim=&season=` (QA
 *   HOMEFIND-5). Scripting off keeps the empty values, which the results
 *   page reads as no filter.
 */
export interface FinderModeSyncProps {
  formId: string;
  /** `id` of the `Size` radio. */
  sizeRadioId: string;
  /** Size select ids per category, in combination order. */
  tireIds: readonly [width: string, profile: string, rim: string];
  wheelIds: readonly [bolt: string, diameter: string, width: string];
  /** `id` of the Season select (tires only). */
  seasonId: string;
  /** `a,b,c;a,b,c` per category (`size-lists.ts`), or `null` with no list. */
  tireCombos: string | null;
  wheelCombos: string | null;
}

type Field = { select: HTMLSelectElement; options: HTMLOptionElement[] };

function parse(combos: string | null): string[][] {
  if (combos === null || combos === "") return [];
  return combos.split(";").map((row) => row.split(","));
}

/** Refill each select with the values that exist beside the others' choices. */
function narrow(fields: Field[], combos: string[][]) {
  if (combos.length === 0) return;
  const chosen = fields.map(({ select }) => select.value);
  fields.forEach(({ select, options }, index) => {
    const allowed = new Set<string>();
    for (const combo of combos) {
      const fits = chosen.every(
        (value, other) => other === index || value === "" || combo[other] === value,
      );
      if (fits) allowed.add(combo[index]);
    }
    const current = select.value;
    for (const node of Array.from(select.children)) {
      if (node instanceof HTMLOptionElement && node.value === "") continue;
      node.remove();
    }
    const fill = document.createDocumentFragment();
    for (const option of options) {
      if (option.value === "") continue;
      if (allowed.has(option.value) || option.value === current) {
        fill.appendChild(option.cloneNode(true));
      }
    }
    select.appendChild(fill);
    select.value = current;
  });
}

export function FinderModeSync({
  formId,
  sizeRadioId,
  tireIds,
  wheelIds,
  seasonId,
  tireCombos,
  wheelCombos,
}: FinderModeSyncProps) {
  const category = useFinderCategory();

  useEffect(() => {
    const form = document.getElementById(formId);
    const radio = document.getElementById(sizeRadioId);
    if (!(form instanceof HTMLFormElement) || !(radio instanceof HTMLInputElement)) return;

    const field = (id: string): Field | null => {
      const select = document.getElementById(id);
      if (!(select instanceof HTMLSelectElement)) return null;
      /* The served list, kept on the node the first time: a later run (a
         category switch) must not take an already narrowed list for it. */
      const held = select as HTMLSelectElement & { pwAll?: HTMLOptionElement[] };
      held.pwAll ??= Array.from(select.options);
      return { select, options: held.pwAll };
    };
    const season = field(seasonId);
    const tire = tireIds.map(field).filter((f): f is Field => f !== null);
    const wheel = wheelIds.map(field).filter((f): f is Field => f !== null);
    const tireRows = parse(tireCombos);
    const wheelRows = parse(wheelCombos);

    /* Which fields this category and mode show: each cell lists its states in
       `data-finder-show` (`tires:vehicle tires:size` ...). */
    const apply = () => {
      const mode = category === "accessories" || !radio.checked ? "vehicle" : "size";
      const state = `${category}:${mode}`;
      form.dataset.finderCategory = category;
      for (const cell of Array.from(form.querySelectorAll<HTMLElement>("[data-finder-show]"))) {
        const shown = (cell.dataset.finderShow ?? "").split(" ").includes(state);
        for (const select of Array.from(cell.querySelectorAll("select"))) {
          select.disabled = !shown;
        }
      }
      // The mode or category decides whether the sizes narrow Season.
      narrowSeason();
    };
    /* Selects with nothing chosen stay out of the query for the length of the
       submit: the browser reads the form right after this event, so they are
       given back a tick later. */
    const onSubmit = () => {
      const left: HTMLSelectElement[] = [];
      for (const select of Array.from(form.querySelectorAll("select"))) {
        if (select.name !== "" && !select.disabled && select.value === "") {
          select.disabled = true;
          left.push(select);
        }
      }
      window.setTimeout(() => {
        for (const select of left) select.disabled = false;
      }, 0);
    };
    /* Tire Size mode only: in Vehicle mode the size selects are hidden and
       must not decide what Season offers. */
    const narrowSeason = () => {
      if (season === null || tireRows.length === 0) return;
      const chosen = tire.map(({ select }) => select.value);
      const sized = category === "tires" && radio.checked && chosen.some((value) => value !== "");
      const allowed = new Set<string>();
      if (sized) {
        for (const combo of tireRows) {
          const fits = chosen.every((value, at) => value === "" || combo[at] === value);
          if (!fits) continue;
          // A row with no season digits (an older list) allows every season.
          if (combo.length < 4) season.options.forEach((_, at) => allowed.add(String(at - 1)));
          for (const digit of combo[3] ?? "") allowed.add(digit);
        }
      }
      const current = season.select.value;
      for (const node of Array.from(season.select.children)) {
        if (node instanceof HTMLOptionElement && node.value === "") continue;
        node.remove();
      }
      const fill = document.createDocumentFragment();
      // `options[0]` is the placeholder; season N is `options[N + 1]`.
      season.options.slice(1).forEach((option, at) => {
        if (!sized || allowed.has(String(at))) fill.appendChild(option.cloneNode(true));
      });
      season.select.appendChild(fill);
      season.select.value = current;
      if (season.select.value !== current) season.select.value = "";
    };
    const onTireChange = () => {
      narrow(tire, tireRows);
      narrowSeason();
    };
    const onWheelChange = () => narrow(wheel, wheelRows);

    apply();
    // A back/forward restore can hand the form a size chosen earlier.
    onTireChange();
    onWheelChange();
    const radios = Array.from(
      document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${radio.name}"]`),
    );
    form.addEventListener("submit", onSubmit);
    for (const input of radios) input.addEventListener("change", apply);
    for (const { select } of tire) select.addEventListener("change", onTireChange);
    for (const { select } of wheel) select.addEventListener("change", onWheelChange);
    return () => {
      form.removeEventListener("submit", onSubmit);
      for (const input of radios) input.removeEventListener("change", apply);
      for (const { select } of tire) select.removeEventListener("change", onTireChange);
      for (const { select } of wheel) select.removeEventListener("change", onWheelChange);
    };
  }, [category, formId, sizeRadioId, tireIds, wheelIds, seasonId, tireCombos, wheelCombos]);

  return null;
}
