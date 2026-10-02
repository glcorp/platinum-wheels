import { configFor } from "@/features/catalog/categories";
import { productCategory, productImageSrc, type Product } from "@/features/catalog/types";
import type { CartItem } from "@/lib/cart";

/**
 * What a cart line shows for a product (D122): the card's own facts, the
 * category's unit words, no price. Built in one place so the card, the
 * product page and the cart's refresh (`src/features/cart/actions.ts`) can
 * never describe one product three ways.
 */
export function cartItem(product: Product): CartItem {
  const { unit } = configFor(product);
  return {
    brand: product.brand,
    model: product.model,
    size: product.size,
    image: productImageSrc(product),
    category: productCategory(product),
    available: product.available,
    unit: { one: unit.one, many: unit.many },
  };
}
