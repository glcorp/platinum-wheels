import { ViewTransition } from "react";

import { Button } from "@/components/ui/button";
import { CATEGORY_CONFIG } from "@/features/catalog/categories";
import { ProductCard } from "@/features/catalog/components/product-card";
import type { Product } from "@/features/catalog/types";
import { clearFilters, resultsHref, withMore } from "@/features/results/query";
import { RESULTS_WINDOW, type ResultsView } from "@/features/results/types";
import { PRIMARY_CONTACT } from "@/lib/site";

/* ---------------------------------------------------------------------------
   ResultsGrid — `Best matches`, `Similar matches`, the load-more window and
   the empty state. Server Component: the window is a URL read, not state
   (D44), and `Load more` is a `?show=all` link, not a button.

   Measured: `design/inventory/results.md` §2.5 (headings), §2.6 (load more),
   `design/assets/results-desktop.html:151-154, 382-386, 496-498` and
   `design/assets/results-mobile.html:102-104, 220-222, 296-301`.

   D  the results column is `display:flex;flex-direction:column;gap:80px`
      (results-desktop.html:151) and each section `gap:32px` (:152); the
      sections carry NO padding of their own — the grid shell in
      `src/app/(storefront)/tires/page.tsx` provides `40px 48px 0`.
   M  each section carries its own padding: best `40px 16px 0` with `gap:20px`
      (results-mobile.html:102), similar `56px 16px 0` (:220).
   Tablet 720-1099 keeps the mobile arrangement (D46) and steps the page
   padding to 32px (`sm:px-8`, DESIGN.md §8); the card grid goes 2-up from
   `sm:` 720 (DESIGN.md §8) and 3-up beside the rail from `md:` 1100.
   --------------------------------------------------------------------------- */

export interface ResultsGridProps {
  view: ResultsView;
}

/* Section shell. M owns its padding; from `md:` the grid shell owns it, so
   the side padding and the per-section top padding are both zeroed here
   (explicit longhands rather than `md:p-0`, so the reset cannot lose a
   shorthand-vs-longhand sort to the base `pt-10` / `pt-14`). */
const SECTION =
  "flex flex-col gap-5 px-4 sm:px-8 md:gap-8 md:px-0 md:pt-0";

/* Card grid: `minmax(0,1fr);gap:12px` M (results-mobile.html:104),
   `repeat(3,minmax(0,1fr));gap:16px` D (results-desktop.html:154). The 2-up
   step at `sm:` is DESIGN.md §8 (D46); `minmax(0,1fr)` is what
   `grid-cols-<n>` already emits. */
const CARD_GRID = "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3";

/* The card photo's `sizes`, crossing where `CARD_GRID` does (D91b, WDG-06;
   `HANDOFF.md` §8.7). Below 720 the grid is 1-up, so a card is the viewport
   less the 16px gutters — `100vw` covers it; the card's old default claimed
   `50vw` from 400, so a 412px phone at DPR 2.6 fetched a candidate half the
   size it painted. 720–1099 is 2-up with 32px padding and a 16px gap, under
   `50vw`. From 1100 it is 3-up beside the 280px rail in the 1344px
   container, which never exceeds 328px (the 1440 artboard), so `348px`
   keeps the headroom the default already carried. */
const CARD_SIZES = "(min-width: 1100px) 348px, (min-width: 720px) 50vw, 100vw";

/* Heading type: Barlow Condensed 700 / 0.92 / -0.015em / uppercase at 32px M,
   40px D (`results.md` §2.5) — the `display` utility carries all four, the
   size stays an explicit token (DESIGN.md §3). `text-ink` is explicit because
   `globals.css` sets `body { color: var(--text-muted) }`. */
const HEADING = "display text-ink text-display-32 md:text-display-40";

/* Header stack: `gap:10px` M (results-mobile.html:103), `12px` D
   (results-desktop.html:153). The artboard draws it as a column with a gap
   around a single child — a slot for a heading and the line that supports it,
   which is exactly the shape the empty state and the `best-none` line already
   use. Since D72 the count is that supporting line. */
const HEAD_STACK = "flex flex-col gap-2.5 md:gap-3";

/* The supporting line under a heading: `400 15px/1.5 --text-muted`. */
const SUPPORT = "text-ink-muted text-15 leading-body max-w-measure";

/* Count type, carried over unchanged from the toolbar it left: `400 14px/1
   tabular --text-muted` M, 15px D (`design/inventory/results.md` §2.2 row 6).
   Only the toolbar's flex-alignment classes are dropped, because the count is
   no longer a flex item in a 44px row. */
const COUNT = "text-ink-muted text-14 leading-flat tabular-nums md:text-15";

/** `12 matches · 6 similar` — `results-desktop.html:115`, U+00B7 spaced. The
 *  numbers are computed from the seed, never typed (D42).
 *
 *  `N matches` counts the BEST list, not the total (D49): once a vehicle
 *  derives a size (D48) the two diverge, and `9 matches · 9 similar` for a
 *  vehicle with no exact fit reads as a contradiction. **This line is now the
 *  only place a count is stated.** The filter sheet's footer button used to
 *  carry one and no longer does (#74, D85): a total-based button read
 *  `Show 9 matches` over this line reading `0 matches · 9 similar` for the
 *  same URL, and a `best.length` one agreed with this line but then revealed
 *  three similar cards after saying `Show 0 matches`. Size splits the set
 *  rather than shrinking it (D47(8)), so two numbers are true at once and the
 *  button carries neither; it reads `Apply`.
 *
 *  The `similar` half disappears when there is none, and `matches`
 *  singularises at one — new copy under `.claude/rules/ui.md` "Copy".
 *
 *  Moved here from `results-toolbar.tsx` by D72 together with the element it
 *  feeds; it is still the only place the string is built. */
const COUNT_FORMAT = new Intl.NumberFormat("en-CA");

function countCopy(best: number, similar: number): string {
  const matches = `${COUNT_FORMAT.format(best)} ${best === 1 ? "match" : "matches"}`;
  return similar > 0
    ? `${matches} · ${COUNT_FORMAT.format(similar)} similar`
    : matches;
}

/* The empty state's action pair, shared by `ResultsEmpty` (which `/styleguide`
   renders) and by `ResultsGrid`'s own zero-results branch, so the two cannot
   drift — the `QuoteSuccess` / `QuoteErrorSummary` precedent (D57). */
function EmptyActions({ clearHref }: { clearHref: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Button variant="secondary" size="compact" href={clearHref}>
        Clear all
      </Button>
      <Button
        variant="accent"
        size="compact"
        href={`tel:${PRIMARY_CONTACT.tel}`}
      >
        Call {PRIMARY_CONTACT.display}
      </Button>
    </div>
  );
}

/** The empty state's heading, shared for the same reason as `EmptyActions`. */
const EMPTY_HEADING = "No matches";

/** The empty state's default body line, shared for the same reason. */
const EMPTY_BODY = "Nothing fits those filters yet. Clear them, or call us.";

function CardGrid({
  products,
  probe,
  priorityCount = 0,
  vehicle,
}: {
  products: readonly Product[];
  probe: string;
  /** The checked search vehicle, saved on a cart line by `Add to cart`. */
  vehicle: string;
  /** How many leading cards preload their photo instead of lazy-loading it. */
  priorityCount?: number;
}) {
  /* D92b — list identity. Every filter, sort and `Load more` change is a
     navigation (`router.replace` from the islands, a `<Link>` for `Load
     more`), and every navigation is a React transition, so a keyed
     `<ViewTransition>` per card is what lets the grid say "same cards, new
     arrangement": a surviving card travels to its new cell (`card-move`), a
     dropped one fades (`card-out`), a new one fades up (`card-in-N`). The key
     moves from `ProductCard` to the VT, and `ProductCard` renders its
     `<article>` directly, so no wrapper node sits between the grid and the VT
     — a VT only activates if it precedes the DOM node it wraps.

     Stagger is `index % 6`, capped at step 5: 30ms a card, 150ms at most —
     the owner's D92b ruling. The modulo is why `Load more`'s three new cards
     (positions 6–8) still stagger 0 / 30 / 60ms instead of all waiting 150ms.

     `default="none"` keeps a card out of transitions that are not about the
     list (e.g. a Suspense reveal). The photo inside the card has its own
     named VT that morphs into the PDP gallery; the outer keyed VT here and
     that inner named one are the skill's "composing shared elements with
     list identity" pattern — two concerns, two boundaries. */
  return (
    <div data-probe={probe} className={CARD_GRID}>
      {products.map((product, index) => (
        <ViewTransition
          key={product.slug}
          enter={`card-in-${Math.min(index % 6, 5)}`}
          exit="card-out"
          update="card-move"
          default="none"
        >
          <ProductCard
            product={product}
            priority={index < priorityCount}
            sizes={CARD_SIZES}
            vehicle={vehicle}
          />
        </ViewTransition>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Empty state — undrawn (`.claude/rules/ui.md` "States the design doesn't
   show"), so it is built from tokens and primitives only and rendered on
   `/styleguide`. Copy is new copy under the same rules: short, declarative,
   no em dash, no exclamation. The heading replaces `Best matches` as the
   page `<h1>` (D47(6)); `/styleguide` passes `as="h2"` so that page keeps
   exactly one `<h1>`.

   Since **D72** this component is the `/styleguide` reference only: on the
   live page `ResultsGrid` composes the zero-results state itself, out of the
   same `SECTION`, `HEAD_STACK`, `HEADING`, `SUPPORT`, `EMPTY_HEADING` and
   `EmptyActions` this one uses, because the count's live region has to be the
   same DOM node in every state and a component swap would remount it. The
   shared constants are what stop the two from drifting; the only thing
   written twice is the `<section>` wrapper, and both spell it `${SECTION}
   pt-10`.
   --------------------------------------------------------------------------- */
export interface ResultsEmptyProps {
  /** `resultsHref(clearFilters(query))` — the page with every filter dropped. */
  clearHref: string;
  as?: "h1" | "h2";
  /** The body line. Defaults to `EMPTY_BODY` so the `/styleguide` call site
   *  (`<ResultsEmpty clearHref={…} as="h2" />`, no other props) stays
   *  untouched. The live page renders `CATEGORY_CONFIG[category].copy.empty`
   *  (D58), which today is the same sentence in all three categories — see
   *  the `empty` field in `categories.ts` for why. */
  body?: string;
}

export function ResultsEmpty({
  clearHref,
  as = "h1",
  body = EMPTY_BODY,
}: ResultsEmptyProps) {
  const Heading = as;
  return (
    <section data-probe="empty" className={`${SECTION} pt-10`}>
      <div className={HEAD_STACK}>
        <Heading className={HEADING}>{EMPTY_HEADING}</Heading>
        <p className={SUPPORT}>{body}</p>
      </div>
      <EmptyActions clearHref={clearHref} />
    </section>
  );
}

export function ResultsGrid({ view }: ResultsGridProps) {
  const copy = CATEGORY_CONFIG[view.query.category].copy;
  /* No early return for the zero-results state, deliberately — see the count
     note below. The first `<section>`, its header stack, its `<h1>` and its
     count `<p>` are rendered unconditionally and only their content branches;
     that is what keeps the live region a single, stable DOM node. */
  const empty = view.total === 0;

  /* One window at every width — 6 best + 3 similar, the desktop artboard's own
     counts (D47(7)). The lists arrive already cut to that window: the
     database returns one page and the totals, never the whole set (D108b).

     `Load more` raises `?show=` by one step. It has something to do while
     best matches remain and the window is below its ceiling, or, on the first
     press, while the similar row is still at three of more. */
  const { best, similar } = view;
  /* D122: the search vehicle rides on every card's `Add to cart`. `query.ts`
     has already dropped any vehicle the finder does not offer (D91b). */
  const vehicle =
    view.query.vehicle === null
      ? ""
      : `${view.query.vehicle.year} ${view.query.vehicle.make} ${view.query.vehicle.model}`;
  const bestHidden = view.bestTotal - best.length;
  const similarHidden = view.similarTotal - similar.length;
  const atCeiling = view.query.show >= RESULTS_WINDOW.max;
  const canLoadMore =
    (bestHidden > 0 && !atCeiling) ||
    (similarHidden > 0 && view.query.show === RESULTS_WINDOW.best);

  return (
    <div className="flex flex-col md:gap-20">
      {/* M `padding:40px 16px 0` (results-mobile.html:102); from `md:` the
          grid shell owns the padding and SECTION zeroes this one. */}
      <section
        data-probe={empty ? "empty" : "best"}
        className={`${SECTION} pt-10`}
      >
        <div className={HEAD_STACK}>
          <h1
            data-probe={empty ? "empty-heading" : "best-heading"}
            className={HEADING}
          >
            {empty ? EMPTY_HEADING : "Best matches"}
          </h1>
          {/* ---------------------------------------------------------------
              The result count — **D72 (owner, 2026-09-22): "put 9 matches
              somewhere else"**. It was the toolbar's fourth element; it is now
              the second line of the header stack the artboard already draws as
              a column with a gap (`results-desktop.html:153`), directly under
              the heading it counts. Same measured type, same string, same
              `countCopy` (moved with it).

              **The `aria-live` region moved intact and is still stable.** It
              is the build's only live region (D57 / C2, deviation #45) and an
              ARIA live region only announces if the node is already in the
              accessibility tree when its text changes — a region that unmounts
              and remounts is not reliably announced by any screen reader. The
              zero-results state used to `return <ResultsEmpty/>` from here,
              which would have torn this node out on exactly the two
              transitions that matter most (last filter to no results, and
              back). So the branch was moved BELOW this element instead: every
              state now renders the same `div > section > div > h1 + p`, React
              reconciles by position and element type, the DOM node survives,
              and only its text is rewritten. The empty state announces
              `0 matches`, which it never did before.

              On screen the empty state would then read `0 matches` under the
              display heading `No matches`, so there the line goes `sr-only`:
              the node, its text and its live region are unchanged, only the
              class swaps. --------------------------------------------- */}
          <p
            data-probe="count"
            aria-live="polite"
            aria-atomic="true"
            className={empty ? "sr-only" : COUNT}
          >
            {countCopy(view.bestTotal, view.similarTotal)}
          </p>
          {empty ? <p className={SUPPORT}>{copy.empty}</p> : null}
        </div>
        {/* The first row preloads: `/tires` has no hero, so a best-matches
            card is the LCP element. Lighthouse mobile, 2026-09-21, measured
            LCP 3.4s against the 2.5s gate with the first card image
            lazy-loaded and 523ms of resource load delay
            (`design/reports/results.md`). Three because the desktop first row
            is 3-up (results-desktop.html:154); at 390 the first card is the
            LCP and the other two are harmless preloads. `Similar matches` is
            always below the fold and stays lazy. */}
        {empty ? (
          <EmptyActions clearHref={resultsHref(clearFilters(view.query))} />
        ) : view.bestTotal === 0 ? (
          /* A vehicle now derives a size (D48), so a fitment with no exact
             match lands here: best empty, similar populated. `total === 0` is
             the `empty` branch above. The heading stays — it is the page
             `<h1>` (D47(6)) — and this line replaces the empty grid.
             Undrawn, so new copy under `.claude/rules/ui.md` "Copy": short,
             declarative, no em dash, no exclamation. Type is the same
             `400 15px/1.5 --text-muted` as the empty state's line.
             The noun is `copy.nearMiss` — `size` on tires, `fitment` on
             wheels (D58, `categories.ts`) — so the tire sentence comes out
             character-for-character what it was: "No exact size match
             yet. Similar sizes are below." */
          <p data-probe="best-none" className={SUPPORT}>
            {view.query.vehicle === null
              ? `No exact ${copy.nearMiss} match yet. Similar ${copy.nearMiss}s are below.`
              : `No exact ${copy.nearMiss} match for your ${view.query.vehicle.year} ${view.query.vehicle.make} ${view.query.vehicle.model} yet. Similar ${copy.nearMiss}s are below.`}
          </p>
        ) : (
          <CardGrid products={best} probe="best-grid" priorityCount={3} vehicle={vehicle} />
        )}
      </section>

      {/* Omitted entirely when there is nothing similar — with no size in the
          URL every result is a best match (D47(8)). */}
      {similar.length === 0 ? null : (
        <section
          data-probe="similar"
          className={`${SECTION} pt-14`}
        >
          {/* `border-top:1px solid --border-strong` + `padding-top:24px` and
              `gap:8px` M (results-mobile.html:221); `32px` / `gap:10px` D
              (results-desktop.html:383). */}
          <div className="border-border-strong flex flex-col gap-2 border-t pt-6 md:gap-2.5 md:pt-8">
            <h2 data-probe="similar-heading" className={HEADING}>
              Similar matches
            </h2>
          </div>
          <CardGrid products={similar} probe="similar-grid" vehicle={vehicle} />
        </section>
      )}

      {/* The window has a ceiling (D108b): past it the page stops growing and
          says how to narrow instead. Undrawn, so new copy under
          `.claude/rules/ui.md` "Copy", in the empty state's own type. */}
      {atCeiling && bestHidden > 0 ? (
        <p
          data-probe="load-ceiling"
          className={`${SUPPORT} px-4 pt-5 sm:px-8 md:px-0 md:pt-0 md:pb-30`}
        >
          {`Showing ${COUNT_FORMAT.format(best.length)} of ${COUNT_FORMAT.format(view.bestTotal)}. Filter by size or brand to narrow it down.`}
        </p>
      ) : null}

      {!canLoadMore ? null : (
        /* D: its own row, `justify-content:center` + `padding-bottom:120px`
           (results-desktop.html:498) — the 120px is why the page's footer
           wrapper adds no desktop margin. M: full width inside the flow,
           `margin-top:12px` (results-mobile.html:299).
           The `accent` variant is the drawn treatment exactly: `1px --accent`
           border, `--text` ink (`--on-photo` is the same #F4F4F5), filling
           lime with `--on-accent` ink on hover (`.x77:hover`). Tailwind's
           `hover:` compiles to `@media (hover:hover)`, so the mobile artboard's
           missing hover rule is honoured for free (D17). */
        <div
          data-probe="load-more"
          className="mt-3 px-4 sm:px-8 md:mt-0 md:flex md:justify-center md:px-0 md:pb-30"
        >
          <Button
            variant="accent"
            size="load"
            fullWidth
            className="md:w-auto"
            href={resultsHref(withMore(view.query))}
            /* `scroll={false}`: this is a `?show=` link (D44), and Next
               scrolls a navigation to the top by default — so pressing
               `Load more` threw the reader back to the header, away from the
               cards it had just revealed. Measured before the fix: scrollY
               2146 → 0. The newly revealed cards render directly below the
               button's old position, so holding the scroll position puts them
               exactly where the reader is already looking. D68. */
            scroll={false}
          >
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
