import { CATEGORY_CONFIG } from "@/features/catalog/categories";
import type { QuoteCopy, QuoteCopyByCategory } from "@/features/cart/types";
import type { CartCategory } from "@/lib/cart";

/**
 * The quote form's message placeholder and CASL consent line for a cart (D122).
 *
 * A cart of one category uses that category's own words (D59(7): a tire cart
 * gets the artboard strings verbatim). A mixed cart gets `MIXED`: the consent
 * line is the wheels and accessories line, which names no product, and the
 * placeholder is new copy under `.claude/rules/ui.md` "Copy", so it carries
 * no em dash.
 *
 * Server only: it reads the whole category table. The cart page hands
 * `quoteCopyByCategory()` to the client island, which picks with
 * `pickQuoteCopy` (`types.ts`), and the Server Action
 * recomputes the consent line from the products themselves, so the consent
 * record in the owner alert never depends on what the browser posted.
 */
const MIXED: QuoteCopy = {
  placeholder: "Anything we should know: your vehicle, current setup, install timing…",
  consent: CATEGORY_CONFIG.wheels.copy.quoteConsent,
};

export function quoteCopyByCategory(): QuoteCopyByCategory {
  return {
    tires: copyOf("tires"),
    wheels: copyOf("wheels"),
    accessories: copyOf("accessories"),
    mixed: MIXED,
  };
}

function copyOf(category: CartCategory): QuoteCopy {
  const { copy } = CATEGORY_CONFIG[category];
  return { placeholder: copy.quotePlaceholder, consent: copy.quoteConsent };
}
