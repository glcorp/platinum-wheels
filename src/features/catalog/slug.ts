/**
 * Product slugs: brand + model + size, e.g. `pirelli-p-zero-235-45r18-98y`.
 * Pure. The store appends `-2`, `-3` … when two products would share one.
 *
 * A slug is written once, when the product is created, and never rewritten:
 * it is the product's URL, and a URL that changes is a dead link and a lost
 * search ranking.
 */

import type { ProductInput } from "./catalog-types";

/** Mirrors the `products_slug_format` CHECK, less room for a `-12` suffix. */
const SLUG_MAX_LENGTH = 190;

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The part of the slug that tells two sizes of one model apart. */
function sizePart(input: ProductInput): string {
  switch (input.category) {
    case "tires": {
      const { size, loadIndex, speedRating } = input.specs;
      return `${size} ${loadIndex ?? ""}${speedRating ?? ""}`;
    }
    case "wheels": {
      const { diameter, width, boltPatterns, offsetMm, finish } = input.specs;
      const offset = offsetMm === null ? "" : `et${offsetMm}`;
      return `${diameter}x${width} ${boltPatterns.join(" ")} ${offset} ${finish ?? ""}`;
    }
    case "accessories":
      return input.specs.threadSize ?? "";
  }
}

export function buildProductSlug(input: ProductInput): string {
  const model = input.model ?? "";
  // An accessory's name usually IS the product ("Gloss Black Cap + Chrome GT
  // Logo"); a tire's or wheel's name repeats brand, model and size.
  const parts =
    input.category === "accessories"
      ? [input.brand, model, input.name, sizePart(input)]
      : [input.brand, model, sizePart(input)];
  const slug = slugify(parts.join(" ")).slice(0, SLUG_MAX_LENGTH);
  // The CHECK refuses a trailing hyphen, which a cut at the limit can leave.
  return slug.replace(/-+$/g, "") || "product";
}
