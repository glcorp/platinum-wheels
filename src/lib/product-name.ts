/**
 * A product's name as a sentence reads it: `Zeta Antarctica Sport`, brand
 * first. An unbranded accessory (D125) has no brand, and its descriptive name
 * already says what it is, so it reads as that name alone: never `null Lug
 * Nut Kit`, never a leading space, never a stand-in brand.
 *
 * A vendor often writes the brand into the model as well (`Schrader` +
 * `Schrader TPMS EZ-Sensor`). The brand is never printed twice (D135): when
 * the model already starts with the brand, at a word boundary and ignoring
 * case, the model is the name. `XD` + `XD137 FMJ` is not such a case, since
 * `XD137` is one word.
 *
 * One function for every place the two halves are joined (card alt text, the
 * PDP title, structured data, the cart, the owner alert, photo alt text), so
 * none of them grows its own rule. Zero imports: it lives in `src/lib/` so the
 * cart store, which imports no feature (D37), can use it too.
 */

/** Characters that may sit between a brand and the rest of the model when the
 *  vendor wrote the brand into it: `Schrader - TPMS`, `Schrader: TPMS`. */
const LEADING_SEPARATORS = /^[\s\-–—:,|/]+/;

/**
 * `model` without a leading copy of `brand`, or `model` unchanged. Unchanged
 * when it does not start with the whole brand word(s), when the brand is only
 * the front of a longer word (`XD` in `XD137`), and when removing it would
 * leave nothing to show.
 */
export function stripBrandPrefix(
  brand: string | null | undefined,
  model: string,
): string {
  const name = brand?.trim();
  const text = model.trim();
  if (!name || text.length <= name.length) return model;
  if (text.slice(0, name.length).toLowerCase() !== name.toLowerCase()) {
    return model;
  }
  // Word boundary: the brand must end where a word ends.
  if (/[\p{L}\p{N}]/u.test(text.charAt(name.length))) return model;
  const rest = text.slice(name.length).replace(LEADING_SEPARATORS, "");
  return /[\p{L}\p{N}]/u.test(rest) ? rest : model;
}

export function productName(brand: string | null | undefined, model: string): string {
  const trimmed = brand?.trim();
  if (!trimmed) return model;
  const rest = stripBrandPrefix(trimmed, model);
  if (rest !== model) return `${trimmed} ${rest}`;
  // The model is the brand and nothing else: it is already the whole name.
  if (model.trim().toLowerCase() === trimmed.toLowerCase()) return model.trim();
  return `${trimmed} ${model}`;
}
