/* ---------------------------------------------------------------------------
   Money — integer cents in, two-decimal strings out, no floats in between.

   The database stores integer cents (`src/db/llm.md` Rules). Converge wants
   `ssl_amount` as a decimal string ("452.60") and reports it back the same
   way. Both conversions are string operations here, so a cent can never be
   lost or invented by binary floating point.
   --------------------------------------------------------------------------- */

/** "452.60" / "452.6" / "452" → 45260. Returns null for anything that is not
 *  a plain non-negative decimal with at most two places. */
export function parseAmountToCents(value: string): number | null {
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  const cents = whole * 100 + fraction;
  return Number.isSafeInteger(cents) ? cents : null;
}

/** 45260 → "452.60". The one formatter for amounts sent to the gateway and
 *  shown to people; never `toFixed` on a divided float. */
export function formatCents(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error(`formatCents: not a non-negative integer: ${cents}`);
  }
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");
  return `${whole}.${fraction}`;
}

/** 45260 → "$452.60". Thousands separators for display only. */
export function displayCents(cents: number): string {
  const [whole, fraction] = formatCents(cents).split(".");
  return `$${Number(whole).toLocaleString("en-CA")}.${fraction}`;
}
