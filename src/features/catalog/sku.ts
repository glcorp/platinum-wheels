/**
 * The shop's product code (D192): `PW-T482913`, the category letter then six
 * digits the database draws at random (migration `0008`). Pure: server and
 * client safe.
 */

/** `products_sku_format`, in JavaScript. */
export const SKU_PATTERN = /^PW-[TWA][1-9][0-9]{5}$/;

/**
 * A typed code in any of the ways people write one, read as the stored code:
 * `PW-T482913`, `pwt482913`, `PW T 482913`, `T482913`, `t-482913`. `null`
 * when the text is not a whole code. A bare `482913` is not one: without its
 * letter it could be any of three products, so callers match it as text.
 */
export function skuFromQuery(text: string): string | null {
  const match = /^\s*(?:pw)?[\s-]*([twa])[\s-]*([1-9]\d{5})\s*$/i.exec(text);
  return match ? `PW-${match[1].toUpperCase()}${match[2]}` : null;
}
