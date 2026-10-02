/**
 * A product's name as a sentence reads it: `Zeta Antarctica Sport`, brand
 * first. An unbranded accessory (D125) has no brand, and its descriptive name
 * already says what it is, so it reads as that name alone: never `null Lug
 * Nut Kit`, never a leading space, never a stand-in brand.
 *
 * One function for every place the two halves are joined (card alt text, the
 * PDP title, structured data, the cart, the owner alert, photo alt text), so
 * none of them grows its own rule. Zero imports: it lives in `src/lib/` so the
 * cart store, which imports no feature (D37), can use it too.
 */
export function productName(brand: string | null | undefined, model: string): string {
  const trimmed = brand?.trim();
  return trimmed ? `${trimmed} ${model}` : model;
}
