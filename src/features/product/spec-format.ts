/**
 * How a catalogue fact is written in the specifications table (D135).
 *
 * Pure string work with no imports, so `view.ts` stays a derivation and a
 * script can prove every rule on its own. Nothing here decides *whether* a row
 * shows; it only decides how a value and a label read once they do.
 */

/* --- Numbers ------------------------------------------------------------- */

const COUNT = new Intl.NumberFormat("en-CA");

/** `1,808 lb`: a weight rating with its thousands separator. */
export function loadRating(pounds: number | null): string | null {
  return pounds === null ? null : `${COUNT.format(pounds)} lb`;
}

/** `6.10 in`: backspacing is quoted to the hundredth. */
export function backspacing(inches: number | null): string | null {
  return inches === null ? null : `${inches.toFixed(2)} in`;
}

/** `+25 mm`, `-12 mm`, `0 mm`. `signed` is `adapter.ts` `signedOffset()`. */
export function offsetMm(
  value: number | null,
  signed: (value: number) => string,
): string | null {
  return value === null ? null : `${signed(value)} mm`;
}

/* --- Extra facts (the vendor's own label and value) ----------------------- */

export interface ExtraPair {
  label: string;
  value: string;
}

/** Tire sidewall codes, spelled out. Anything not listed is shown as given. */
const SIDEWALL: Readonly<Record<string, string>> = {
  BSW: "Black sidewall",
  BL: "Black letters",
  OWL: "Outlined white letters",
  RWL: "Raised white letters",
  WSW: "White sidewall",
  VSB: "Vertical serrated band",
  BLK: "Black",
};

function sidewallWord(part: string): string {
  const known = SIDEWALL[part.trim().toUpperCase()];
  if (known !== undefined) return known;
  /* `BSW OWL`: several codes with spaces. Spelled out only when every word is
     a code, so `Black Sidewall` is never split into `Black, Sidewall`. */
  const words = part.trim().split(/\s+/);
  if (words.length > 1 && words.every((word) => SIDEWALL[word.toUpperCase()])) {
    return words.map((word) => SIDEWALL[word.toUpperCase()]).join(", ");
  }
  return part.trim();
}

export function sidewall(value: string): string {
  return value
    .split(/[,;/]/)
    .map(sidewallWord)
    .filter(Boolean)
    .join(", ");
}

/** A short unit in brackets at the end of a label: `Weight (lb)`. */
const UNIT_LABEL = /^(.*\S)\s*\(([A-Za-z°"'µ²³/.%]{1,6})\)$/;

/**
 * One vendor fact, tidied for display, or `null` when it should not show.
 *
 * - a blank label or value is dropped;
 * - on an accessory, `Model` reads `Style`: the values are `BOLT`, `BLACK`,
 *   `CLOSE END`, and the real model is its own row;
 * - on a tire, `Sidewall` codes are spelled out;
 * - a unit in the label moves to the value: `Weight (lb): 28.9` is
 *   `Weight: 28.9 lb`;
 * - `yes` / `no` read `Yes` / `No`;
 * - a value the sheet joined with `|` (wheel `Fitment`) reads as a comma list.
 */
export function tidyExtra(
  extra: ExtraPair,
  category: "tires" | "wheels" | "accessories",
): ExtraPair | null {
  let label = extra.label.trim();
  let value = extra.value.trim();
  if (label === "" || value === "") return null;

  if (category === "accessories" && label.toLowerCase() === "model") {
    label = "Style";
  }

  if (value.includes("|")) {
    value = value
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean)
      .join(", ");
  }

  if (category === "tires" && label.toLowerCase() === "sidewall") {
    value = sidewall(value);
  }

  const unit = UNIT_LABEL.exec(label);
  if (unit !== null) {
    label = unit[1];
    if (!value.toLowerCase().endsWith(unit[2].toLowerCase())) {
      value = `${value} ${unit[2]}`;
    }
  }

  const lower = value.toLowerCase();
  if (lower === "yes") value = "Yes";
  else if (lower === "no") value = "No";

  return label === "" || value === "" ? null : { label, value };
}
