import { PageTransition } from "@/components/site/page-transition";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

/* ---------------------------------------------------------------------------
   `/(storefront)` loading UI — the second of the two states no artboard draws
   (D62). Shown while a storefront segment streams in.

   Unlike `error.tsx` this is a **Server Component**, so it can render the real
   `SiteHeader` and `SiteFooter` at no client cost. Chrome is composed per page
   (D38), so without them a navigation would flash a bare page and the header
   would visibly disappear and come back; with them only the middle changes,
   which is the whole point of a loading state.

   --- Why blocks and not the word "Loading" --------------------------------
   `PageStub` (the 404's shell) leads with an 88px display heading. That is
   right for a page you have arrived at and wrong for one you are passing
   through: a full-width "LOADING" flashing on every navigation is worse than
   nothing. Instead this reserves the shape of what is coming — a heading bar
   and a card grid matching `results-grid`'s 1 / 2 / 3-up steps — so the layout
   does not jump when content replaces it.

   **No animation.** The taste dial is MOTION_INTENSITY 3 (`.claude/rules/ui.md`)
   — hover fills and a 2px card lift, nothing ambient — and a shimmer would be
   the only perpetually-moving thing in the build. Flat `--surface` blocks on
   `--border` are the card's own rest colours, so this reads as the grid
   arriving rather than as a separate effect. Nothing inside the skeleton
   moves, ever.

   **D92b moves the skeleton as a whole, never inside it.** It rides the same
   `PageTransition` as every page: a typed link slides it in with the page it
   stands in for, and when the content streams in the skeleton fades out
   (`route-out`) while the page fades up (`route-in`), so the handover is a
   reveal rather than a hard swap. No shimmer, still.

   --- Accessibility ---------------------------------------------------------
   The blocks are `aria-hidden`: they are shapes, not content, and announcing
   nine empty boxes is noise. The status lives in one `role="status"` line that
   is visually hidden but announced, so a screen-reader user is told the page
   is loading exactly once.

   **This renders a `<div>`, not `<main id="main">`, and that is not an
   oversight.** The first version used `<main id="main" tabIndex={-1}>` to keep
   the `layout.tsx` skip link pointed at something. Measured in the production
   build: Next emits this fallback into the *same document* as the page it is
   waiting on, so the served HTML for `/styleguide` carried **two**
   `<main id="main">` elements — a duplicate id and two `main` landmarks, which
   is exactly the class of defect the D56 audit exists to catch. A transient
   fallback does not get to own the page's landmark. The cost is that during a
   navigation the skip link briefly targets nothing; that lasts as long as the
   fallback does, and the real `<main id="main">` arrives with the page.
   --------------------------------------------------------------------------- */

/* The card's own rest box: `--surface` fill, 1px `--border`, radius 0, square
   aspect — `src/features/catalog/components/product-card.tsx`. Reusing those
   exact tokens is what makes the placeholder the same size and colour as the
   thing that replaces it. */
const BLOCK = "bg-surface border-border border";

export default function Loading() {
  return (
    <>
      <SiteHeader variant="solid" />
      <PageTransition>
        <div className="flex-1 px-4 pt-14 sm:px-8 sm:pt-20 md:px-12 md:pt-30">
          <div className="lg:mx-auto lg:max-w-content">
            <p role="status" className="sr-only">
              Loading
            </p>

            {/* Heading bar: the height of a `text-display-56` line at mobile and
                `text-display-88` from `sm:`, so the block below it starts where
                the real grid starts. */}
            <div aria-hidden="true" className="flex flex-col gap-4">
              <div className={`${BLOCK} h-14 w-2/3 max-w-measure sm:h-22`} />
              <div className={`${BLOCK} h-4 w-1/3 max-w-measure`} />
            </div>

            {/* Card grid, same steps as `results-grid`: 1-up, 2-up from `sm:`
                720, 3-up from `md:` 1100 (D46). Six blocks is the `RESULTS_WINDOW`
                best-match window. */}
            <div
              aria-hidden="true"
              className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:mt-14 md:grid-cols-3"
            >
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className={`${BLOCK} aspect-square`} />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-14 sm:mt-20 md:mt-30">
          <SiteFooter />
        </div>
      </PageTransition>
    </>
  );
}
