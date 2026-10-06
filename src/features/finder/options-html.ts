/**
 * The finder's Model options as one HTML string.
 *
 * Why a string and not 1,100 `<option>` elements. The list is every model of
 * every make (the plain GET submit must work with scripting off, D44, D45), and
 * a Server Component that renders it as elements serialises each option into
 * the RSC payload and gives it a fibre when React hydrates. As
 * `dangerouslySetInnerHTML` on the `<select>` the markup is the same bytes in
 * the document, the payload carries one string, and React does not walk the
 * children. A `<select>` with no `value` or `defaultValue` is left to the
 * browser, so a preselected model is the `selected` attribute written here,
 * which is what React's server renderer wrote for `defaultValue`.
 *
 * Where the string goes is the finder's business (`vehicle-finder.tsx`): into
 * the visible Model select only for a part-filled vehicle, and otherwise inside
 * a `<noscript>` (so a scripting-off visitor has the whole list while a visitor
 * with scripting never pays to parse and style 1,100 elements they may not
 * open). `FinderModelSync` reads it back from that `<noscript>`.
 *
 * Server side only: `FINDER_MAKES` is a 30 KB module a Client Component should
 * not import for this.
 */

import { FINDER_MAKES } from "@/features/finder/data";

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

/** Text and attribute-safe: every character that can end a tag or a value. */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (character) => ESCAPES[character]);
}

/** `<optgroup>` per make, as the Model select has always rendered them. */
function groups(selected: { make: string | null; model: string } | null): string {
  let used = false;
  return FINDER_MAKES.map(({ make, models }) => {
    const options = models
      .map(({ model, years }) => {
        /* One option is preselected: the first whose text matches (and whose
           group is the vehicle's make, when that is known). A model name two
           makes share would otherwise be marked twice, and a single-choice
           select keeps the last. */
        const pick =
          selected !== null &&
          !used &&
          model === selected.model &&
          (selected.make === null || selected.make === make);
        if (pick) used = true;
        return `<option data-years="${escapeHtml(years)}"${pick ? " selected" : ""}>${escapeHtml(model)}</option>`;
      })
      .join("");
    return `<optgroup label="${escapeHtml(make)}">${options}</optgroup>`;
  }).join("");
}

/** The disabled `Model` placeholder, selected unless a model is preselected. */
export function modelPlaceholderHtml(preselected: boolean): string {
  return `<option value="" disabled${preselected ? "" : " selected"}>Model</option>`;
}

/** Built once per server process: nothing in it depends on the request. */
let unselected: string | null = null;

/**
 * The whole inside of a Model `<select>`: the placeholder and every make's
 * models. `selected` is the vehicle a part-filled submit kept (LA-05 P2), or
 * `null` for an untouched finder.
 */
export function modelOptionsHtml(
  selected: { make: string | null; model: string } | null,
): string {
  if (selected === null) {
    unselected ??= modelPlaceholderHtml(false) + groups(null);
    return unselected;
  }
  return modelPlaceholderHtml(true) + groups(selected);
}
