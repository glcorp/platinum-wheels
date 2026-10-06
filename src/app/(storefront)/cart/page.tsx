import type { Metadata } from "next";

import { PageTransition } from "@/components/site/page-transition";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { CartView } from "@/features/cart/components/cart-view";
import { quoteCopyByCategory } from "@/features/cart/copy";
import { PRIMARY_CONTACT } from "@/lib/site";

/* ---------------------------------------------------------------------------
   `/cart` — composition only (`docs/decisions.md` §3). D122.

   Static: the cart lives in the visitor's browser, so the server renders the
   heading and the island renders the lines once it has read them. Never
   indexed (a cart is nobody's search result) and never in the sitemap; the
   `robots` here wins over the site-wide one in both flag states (D112,
   `src/features/seo/indexing.ts`). No nav item is current: the cart is none of
   the four.
   --------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Your cart",
  description: "The products you picked, ready for one quote request.",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return (
    <>
      <SiteHeader variant="solid" />
      <PageTransition>
        <main id="main" tabIndex={-1} className="flex-1">
          <div className="px-4 pt-8 pb-14 sm:px-8 sm:pt-12 md:px-12 md:pb-30">
            <div className="flex flex-col gap-8 sm:gap-10 lg:mx-auto lg:max-w-content">
              {/* The `Request a quote` eyebrow above the title is gone (owner,
                  2026-10-07: "remove request a quote"). */}
              <h1 className="display text-ink text-display-56 sm:text-display-88">Your cart</h1>
              <noscript>
                <p className="text-ink-muted text-17 leading-body">
                  {`Your cart is kept in this browser and needs JavaScript. Turn it on, or call us at ${PRIMARY_CONTACT.display}.`}
                </p>
              </noscript>
              <CartView copy={quoteCopyByCategory()} />
            </div>
          </div>
        </main>
        <SiteFooter />
      </PageTransition>
    </>
  );
}
