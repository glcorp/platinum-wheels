import type { ReactNode } from "react";

import { PageTransition } from "@/components/site/page-transition";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

/* ---------------------------------------------------------------------------
   ProsePage — the shell behind the three written pages, `/about`, `/privacy`
   and `/terms`. Sibling to `page-stub.tsx`, which goes back to being what its
   own header always said it was: the shell behind an undesigned route and the
   404.

   **No artboard draws any of these three pages** (D26, D39, D63), so there is
   no measured parity to hold here and nothing to deviate from. Everything
   below is composed from tokens, role utilities and idioms that already ship
   somewhere else in this build; nothing is invented and no token was added.

   WHY THIS SHAPE. The pages previously set a ~420px measure (`max-w-measure`)
   against the left edge of a 1344px container, which left roughly 900px of
   dead ground beside every line at 1440. The container was already centred —
   `lg:mx-auto lg:max-w-content`, the same idiom `hero`, `contact` and
   `how-it-works` use — so the defect was never the centring; it was that the
   type held a quarter of the frame and nothing held the rest.

   The answer is the one `design/DESIGN.md` §5 already gives: "Asymmetry is the
   default … never centred stacks" and "Left-edge alignment. Headline, body,
   CTA, price and image share one left edge within their column." So:

     - the page header is a 12-column row, eyebrow + `<h1>` on the left six,
       the lede on the right five, bottom-aligned the way `SectionHeading`
       aligns its own header row (`align-items:flex-end`, home-desktop.html:187);
     - every section is a side-head: its `<h2>` in the left four
       columns, its prose in the right eight, capped at 560px because
       `DESIGN.md` §3 sets the reading measure at 60–72 characters and caps a
       text column at 560px. `--container-hero-lede` is that 560px;
     - each section opens on a full-width `--border-strong` hairline, which is
       what actually carries the right half of the frame — the same device
       `Specifications` and `HowItWorks` use. `DESIGN.md` §5: "Sections are
       separated by air or one hairline, never by boxes or colour blocks."

   Every line stays flush-left and ragged-right. Nothing here is centre-aligned
   (`.claude/rules/ui.md`, "Flush-left").

   Copy passed in by the three pages is new copy under `.claude/rules/ui.md`
   "Copy": short, declarative, no em dash, no exclamation mark, "you" for the
   customer and "we" for the shop.
   --------------------------------------------------------------------------- */

type NavKey = "tires" | "wheels" | "accessories" | "contact";

/* The prose link. The old treatment was `text-ink … hover:text-ink-muted`,
   which dimmed a link the moment you pointed at it — the interaction removed
   emphasis instead of adding it, and on hover the link landed on exactly the
   colour of the paragraph around it.

   Here the ink never moves: `--text` at rest and `--text` on hover, so the
   text contrast cannot fall. The underline does the work, going 1px → 2px and
   picking up `--accent`. That keeps the accent to one element at a time (only
   one link is ever hovered) rather than painting every inline link lime, which
   `DESIGN.md` §7 forbids. `underline-offset-4` is the exports' own text-link
   offset (`results.md` §2.4, `Clear all`).

   `active:opacity-70` is the text-link press (D92b). It is a press, not a hover,
   so the rule above still holds: pointing at the link never dims it. The
   underline-colour change eases over `--duration-feedback` in the base layer
   (DEVIATIONS #75). */
export const PROSE_LINK =
  "text-ink underline decoration-1 underline-offset-4 hover:decoration-2 hover:decoration-accent active:opacity-70";

/* Small caption label: the `label` role utility at the size and tracking the
   contact section's `Phone & inquiry hours` / `Email` captions already use
   (`src/features/home/components/contact.tsx`, home.md:77,332). */
export const CAPTION = "label text-ink-dim text-10 tracking-12 sm:text-11";

export interface ProsePageProps {
  /** Eyebrow above the `<h1>`, e.g. `Legal`. Barlow 500, uppercase. */
  eyebrow: string;
  /** The page `<h1>`. One per page. */
  title: string;
  /** One sentence beside the `<h1>` on desktop, under it below `md:`. */
  lede: string;
  /** Which nav item the header marks as current. Omitted means none, which is
   *  what all three written pages pass: they belong to no nav item. */
  active?: NavKey;
  /** Full-width band under the page header: the fact row on `/about`. Unused
   *  on `/privacy` and `/terms` since the 2026-09-22 simplification dropped
   *  the section index (owner: *"dont add On this page etc — just simple
   *  plain"*). */
  meta?: ReactNode;
  /** `ProseSection`s. */
  children: ReactNode;
}

export function ProsePage({
  eyebrow,
  title,
  lede,
  active,
  meta,
  children,
}: ProsePageProps) {
  return (
    <>
      <SiteHeader variant="solid" active={active} />
      {/* D92b: `<main>` and the footer's wrapper enter and leave together; the
          header stays outside, pinned by its own view-transition name. The
          boundary must contain the DOM nodes directly — no wrapper `<div>`
          (see page-transition.tsx). */}
      <PageTransition>
        {/* `id="main" tabIndex={-1}` is the skip-link target on every route
            (D57 / audit C1). Do not drop either. */}
        <main
          id="main"
          tabIndex={-1}
          className="flex-1 px-4 pt-14 sm:px-8 sm:pt-20 md:px-12 md:pt-30"
        >
          <div className="lg:mx-auto lg:max-w-content">
            {/* Page header. `md:items-end` bottom-aligns the lede with the
                headline the way home-desktop.html:187 aligns its header row;
                below `md:` the two simply stack, headline first. */}
            <div className="flex flex-col gap-6 md:grid md:grid-cols-12 md:items-end md:gap-x-8">
              <div className="flex flex-col gap-4 md:col-span-6">
                <span className="label text-ink-dim text-11 tracking-14 sm:text-12">
                  {eyebrow}
                </span>
                {/* 56 → 88, the `SectionHeading` h1 pair, measured from
                    product-mobile.html:94 / product-desktop.html:109. */}
                <h1 className="display text-ink text-display-56 sm:text-display-88">
                  {title}
                </h1>
              </div>
              <p className="text-16 leading-body text-ink-muted max-w-measure sm:text-17 md:col-span-5 md:col-start-8">
                {lede}
              </p>
            </div>

            {meta === undefined ? null : (
              <div className="border-border-strong mt-10 border-t pt-6 sm:mt-14 sm:pt-8">
                {meta}
              </div>
            )}

            {/* Section rhythm: 48px → 56px → 80px, all on the DESIGN.md §5
                spacing scale (8/16/24/32/48/80/120). */}
            <div className="mt-14 flex flex-col gap-12 sm:mt-20 sm:gap-14 md:mt-24 md:gap-20">
              {children}
            </div>
          </div>
        </main>
        <div className="mt-14 sm:mt-20 md:mt-30">
          <SiteFooter />
        </div>
      </PageTransition>
    </>
  );
}

/* ---------------------------------------------------------------------------
   ProseSection — one side-head section inside a `ProsePage`.

   Left four columns: the `<h2>`. Right eight: the prose, capped at the 560px
   reading measure, plus an optional `wide` slot for content that should use
   the whole column (the brand list, the contact pair). Each section opens on
   a full-width `--border-strong` hairline — the one device that still holds
   the right half of the frame once the numbering and the on-page index are
   gone (`DESIGN.md` §5, "separated by air or one hairline").

   Below `md:` the two columns collapse to one stacked column, which is the
   same collapse the rest of the build uses at that width.

   Simplified 2026-09-22 (owner: *"the about, terms and legal looks too much
   now, dont add On this page etc — just simple plain"*): dropped the
   `SectionIndex` nav, the per-section `01`/`02` numeral, and — since nothing
   links to a section anymore — the anchor `id` and its `scroll-mt-*` offset.
   The side-head grid and the hairline stay; they are the fix for the actual
   defect (a 420px measure stranded inside a 1344px container), not ornament.
   --------------------------------------------------------------------------- */

export interface ProseSectionProps {
  title: string;
  children: ReactNode;
  /** Content below the prose that is not held to the reading measure. */
  wide?: ReactNode;
}

export function ProseSection({ title, children, wide }: ProseSectionProps) {
  return (
    <section className="border-border-strong border-t pt-6 sm:pt-8 md:grid md:grid-cols-12 md:gap-x-8">
      <div className="md:col-span-4">
        <h2 className="display text-ink text-display-24 sm:text-display-28">
          {title}
        </h2>
      </div>
      <div className="mt-4 flex flex-col gap-6 md:col-span-8 md:col-start-5 md:mt-0">
        {/* 16px / 1.5 / --text-muted is the body role (DESIGN.md §3). The
            560px cap is §3's own: "on a 60/40 split the text column caps at
            560px" — `--container-hero-lede`. */}
        <div className="text-16 leading-body text-ink-muted flex max-w-hero-lede flex-col gap-4">
          {children}
        </div>
        {wide === undefined ? null : wide}
      </div>
    </section>
  );
}
