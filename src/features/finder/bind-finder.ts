/**
 * The finder's Year / Make / Model narrowing, as one self-contained function
 * that runs in two places (D168, C3).
 *
 * **Why two places.** The Model list (~1,060 options) ships as text, never as
 * elements, so a phone does not parse and style it on load (D157(3)). Until
 * 2026-10-11 the text was read back from the `<noscript>` beside the Model
 * select by a React island, and that broke in two ways the client reported as
 * "Glitch in selecting model, sometimes have to refresh again and again":
 *
 * 1. **After any in-site navigation the list was empty** (measured on a
 *    production build: a category tab, the logo, `/about` back to `/`; Year
 *    2020 + Honda gave 1 option, the placeholder, against 14 on a full load).
 *    React draws a page reached by client navigation itself, and React never
 *    renders a `<noscript>`'s children on the client, so the text was `""`.
 *    A refresh is a full load, whose HTML carries the text: hence "refresh
 *    again and again".
 * 2. **Before the page's JavaScript had run** the Model select held only its
 *    placeholder, so a visitor quick enough to open it on a slow phone saw an
 *    empty list.
 *
 * So the same function is called by an inline `<script>` the server writes
 * straight after the form (runs while the HTML is parsed, before React
 * hydrates: case 2), and by `FinderModelSync` on mount with the list handed to
 * it as a prop (a client navigation, where an inline script never runs: case
 * 1). Whichever runs first binds; the other sees the mark and returns.
 *
 * **Self-contained on purpose.** The server inlines it with
 * `bindFinder.toString()`, so it may use only its arguments and browser
 * globals: no imports, no module constants, no helpers defined elsewhere.
 * `builtIn()` from `years.ts` is repeated inside for that reason.
 *
 * What it does is unchanged from D70 / LA-05 / D159(4) / D160(6):
 * - Make: options a year never had get `hidden` and `disabled` (React owns
 *   these nodes, so only attributes change).
 * - Model: on every Year or Make change the select is refilled with fresh
 *   copies of what fits after its own placeholder: a chosen make's models as
 *   plain options, else every make's group (iOS ignores `hidden` on options,
 *   and re-attaching the same nodes left the iPhone picker empty). The
 *   placeholder option is the server's (`dangerouslySetInnerHTML`, so React
 *   never reconciles the list) and is never touched.
 * - A Year or Make change that orphans the chosen Make or Model resets it.
 * - The list is built on the first touch of the finder (pointer, focus or
 *   key), or at once when a Year or Make is already chosen (a back/forward
 *   restore, or a choice made before this ran).
 */

export interface FinderIds {
  yearId: string;
  makeId: string;
  modelId: string;
  /** The `<noscript>` whose text is the whole Model `<select>`, read when no
   *  list is passed in. */
  sourceId: string;
}

export function bindFinder(ids: FinderIds, list: string | null): void {
  const year = document.getElementById(ids.yearId);
  const make = document.getElementById(ids.makeId);
  const model = document.getElementById(ids.modelId);
  if (
    !(year instanceof HTMLSelectElement) ||
    !(make instanceof HTMLSelectElement) ||
    !(model instanceof HTMLSelectElement)
  ) {
    return;
  }
  /* One binding per Model select. An expando, not an attribute: nothing in
     the markup changes, so hydration has nothing to compare. */
  const marked = model as HTMLSelectElement & {
    pwFinderBound?: boolean;
    pwFinderRefresh?: () => void;
  };
  if (marked.pwFinderBound) {
    /* Already bound by the inline script. Hydration comes later than the
       browser's own form restore (Back in Safari refills Year and Make after
       the script ran), so look again. */
    marked.pwFinderRefresh?.();
    return;
  }

  /* The list as text: the prop (client navigation) or the `<noscript>`'s
     text (a full load). Without either, and with no groups already in the
     select (a part-filled vehicle ships them as markup), there is nothing to
     narrow yet: stay unbound so the other caller can still bind. */
  const text = list ?? document.getElementById(ids.sourceId)?.textContent ?? "";
  const served = model.getElementsByTagName("optgroup").length > 0;
  if (text === "" && !served) return;
  marked.pwFinderBound = true;

  const builtIn = (years: string, at: number) =>
    years
      .split(";")
      .filter((part) => part !== "")
      .some((part) => {
        const [from, to] = part.split("-");
        return at >= Number(from) && at <= Number(to ?? from);
      });

  type Group = { label: string; options: HTMLOptionElement[] };
  let groups: Group[] | null = null;
  const capture = (root: ParentNode): Group[] =>
    Array.from(root.querySelectorAll("optgroup")).map((group) => ({
      label: group.label,
      options: Array.from(group.getElementsByTagName("option")),
    }));
  /* Parsed once, on first need, outside the document. The text is either a
     whole `<select>` (the `<noscript>`) or its inside (the prop). */
  const load = (): Group[] => {
    if (groups !== null) return groups;
    if (served) {
      groups = capture(model);
      return groups;
    }
    const holder = document.createElement("template");
    holder.innerHTML = text.trimStart().startsWith("<select")
      ? text
      : `<select>${text}</select>`;
    groups = capture(holder.content);
    return groups;
  };

  const makeOptions = Array.from(make.options).filter((option) => option.value !== "");
  const fits = (option: HTMLOptionElement, at: number | null) =>
    at === null || builtIn(option.dataset.years ?? "", at);

  const sync = () => {
    const all = load();
    const at = year.value === "" ? null : Number(year.value);
    for (const option of makeOptions) {
      const visible = fits(option, at);
      option.hidden = !visible;
      option.disabled = !visible;
    }
    if (make.selectedOptions[0]?.hidden) make.value = "";

    const chosenMake = make.value;
    const chosen = model.value;
    for (const node of Array.from(model.children)) {
      if (node instanceof HTMLOptionElement && node.value === "") continue;
      node.remove();
    }
    const fill = document.createDocumentFragment();
    for (const group of all) {
      if (chosenMake !== "" && group.label !== chosenMake) continue;
      const keep: HTMLOptionElement[] = [];
      for (const option of group.options) {
        if (fits(option, at)) keep.push(option.cloneNode(true) as HTMLOptionElement);
      }
      if (keep.length === 0) continue;
      if (chosenMake !== "") {
        fill.append(...keep);
      } else {
        const copy = document.createElement("optgroup");
        copy.label = group.label;
        copy.append(...keep);
        fill.appendChild(copy);
      }
    }
    model.appendChild(fill);
    model.value = chosen;
    if (model.value !== chosen) model.value = "";
  };

  /* First touch builds the list. A touch on the Model select itself builds at
     once, before its picker opens; on Year or Make, a task later, so the
     picker the visitor asked for opens first. Capture phase on the form. */
  let primed = false;
  const prime = () => {
    if (primed) return;
    primed = true;
    sync();
  };
  const form = model.form;
  const onTouch = (event: Event) => {
    if (primed) return;
    if (event.target === model) prime();
    else window.setTimeout(prime, 0);
  };
  if (form !== null) {
    for (const type of ["pointerdown", "focusin", "keydown"]) {
      form.addEventListener(type, onTouch, true);
    }
  }
  const onChange = () => {
    primed = true;
    sync();
  };
  year.addEventListener("change", onChange);
  make.addEventListener("change", onChange);
  /* A choice already made (a back/forward restore, or a pick before this
     ran) needs the narrowed list now. The browser may restore Year and Make
     only after this ran (WebKit does, measured on Back), so the same check
     runs again when the document has loaded, on a page-cache restore, and
     when the island mounts (`pwFinderRefresh`). A chosen Make is re-applied
     every time, primed or not (QA MODEL-2): a Make `change` that was missed
     would otherwise leave the year-only list for good. `sync()` is idempotent;
     it is skipped while the Model picker is the focused control, so a list
     the visitor has open is never rebuilt under them. */
  const refresh = () => {
    if (document.activeElement === model) return;
    if ((!primed && year.value !== "") || make.value !== "") onChange();
  };
  marked.pwFinderRefresh = refresh;
  refresh();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh, { once: true });
  }
  window.addEventListener("load", refresh, { once: true });
  window.addEventListener("pageshow", refresh);
}
