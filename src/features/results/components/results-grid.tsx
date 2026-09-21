import { Button } from "@/components/ui/button";
import { CATEGORY_CONFIG } from "@/features/catalog/categories";
import { ProductCard } from "@/features/catalog/components/product-card";
import type { Product } from "@/features/catalog/types";
import { clearFilters, resultsHref, withShowAll } from "@/features/results/query";
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
      `src/app/(storefront)/results/page.tsx` provides `40px 48px 0`.
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

/* Heading type: Barlow Condensed 700 / 0.92 / -0.015em / uppercase at 32px M,
   40px D (`results.md` §2.5) — the `display` utility carries all four, the
   size stays an explicit token (DESIGN.md §3). `text-ink` is explicit because
   `globals.css` sets `body { color: var(--text-muted) }`. */
const HEADING = "display text-ink text-display-32 md:text-display-40";

function CardGrid({
  products,
  probe,
  priorityCount = 0,
}: {
  products: readonly Product[];
  probe: string;
  /** How many leading cards preload their photo instead of lazy-loading it. */
  priorityCount?: number;
}) {
  return (
    <div data-probe={probe} className={CARD_GRID}>
      {products.map((product, index) => (
        <ProductCard
          key={product.slug}
          product={product}
          priority={index < priorityCount}
        />
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
   --------------------------------------------------------------------------- */
export interface ResultsEmptyProps {
  /** `resultsHref(clearFilters(query))` — the page with every filter dropped. */
  clearHref: string;
  as?: "h1" | "h2";
  /** The body line. Defaults to the tire copy so the `/styleguide` call site
   *  (`<ResultsEmpty clearHref={…} as="h2" />`, no other props) stays
   *  untouched; `ResultsGrid` passes `CATEGORY_CONFIG[category].copy.empty`
   *  for `/wheels` and `/accessories` (D58). */
  body?: string;
}

export function ResultsEmpty({
  clearHref,
  as = "h1",
  body = "Nothing fits those filters yet. Clear them, or call us and we will check your size.",
}: ResultsEmptyProps) {
  const Heading = as;
  return (
    <section data-probe="empty" className={`${SECTION} pt-10`}>
      <div className="flex flex-col gap-2.5 md:gap-3">
        <Heading className={HEADING}>No matches</Heading>
        <p className="text-ink-muted text-15 leading-body max-w-measure">
          {body}
        </p>
      </div>
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
    </section>
  );
}

export function ResultsGrid({ view }: ResultsGridProps) {
  const copy = CATEGORY_CONFIG[view.query.category].copy;

  if (view.total === 0) {
    return (
      <ResultsEmpty
        clearHref={resultsHref(clearFilters(view.query))}
        body={copy.empty}
      />
    );
  }

  /* One window at every width — 6 best + 3 similar, the desktop artboard's own
     counts (D47(7)). `?show=all` lifts it (D44). */
  const showAll = view.query.showAll;
  const best = showAll ? view.best : view.best.slice(0, RESULTS_WINDOW.best);
  const similar = showAll
    ? view.similar
    : view.similar.slice(0, RESULTS_WINDOW.similar);
  const hiddenCount =
    view.best.length - best.length + (view.similar.length - similar.length);

  return (
    <div className="flex flex-col md:gap-20">
      {/* M `padding:40px 16px 0` (results-mobile.html:102); from `md:` the
          grid shell owns the padding and SECTION zeroes this one. */}
      <section data-probe="best" className={`${SECTION} pt-10`}>
        {/* Header wrapper `gap:10px` M (results-mobile.html:103), `12px` D
            (results-desktop.html:153). */}
        <div className="flex flex-col gap-2.5 md:gap-3">
          <h1 data-probe="best-heading" className={HEADING}>
            Best matches
          </h1>
        </div>
        {/* The first row preloads: `/results` has no hero, so a best-matches
            card is the LCP element. Lighthouse mobile, 2026-09-21, measured
            LCP 3.4s against the 2.5s gate with the first card image
            lazy-loaded and 523ms of resource load delay
            (`design/reports/results.md`). Three because the desktop first row
            is 3-up (results-desktop.html:154); at 390 the first card is the
            LCP and the other two are harmless preloads. `Similar matches` is
            always below the fold and stays lazy. */}
        {view.best.length === 0 ? (
          /* A vehicle now derives a size (D48), so a fitment with no exact
             match lands here: best empty, similar populated. `total === 0`
             still belongs to `ResultsEmpty`. The heading stays — it is the
             page `<h1>` (D47(6)) — and this line replaces the empty grid.
             Undrawn, so new copy under `.claude/rules/ui.md` "Copy": short,
             declarative, no em dash, no exclamation. Type is the same
             `400 15px/1.5 --text-muted` as the empty state's line.
             The noun is `copy.nearMiss` — `size` on tires, `fitment` on
             wheels (D58, `categories.ts`) — so the tire sentence comes out
             character-for-character what it was: "No exact size match
             yet. Similar sizes are below." */
          <p
            data-probe="best-none"
            className="text-ink-muted text-15 leading-body max-w-measure"
          >
            {view.query.vehicle === null
              ? `No exact ${copy.nearMiss} match yet. Similar ${copy.nearMiss}s are below.`
              : `No exact ${copy.nearMiss} match for your ${view.query.vehicle.year} ${view.query.vehicle.make} ${view.query.vehicle.model} yet. Similar ${copy.nearMiss}s are below.`}
          </p>
        ) : (
          <CardGrid products={best} probe="best-grid" priorityCount={3} />
        )}
      </section>

      {/* Omitted entirely when there is nothing similar — with no size in the
          URL every result is a best match (D47(8)). */}
      {view.similar.length === 0 ? null : (
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
          <CardGrid products={similar} probe="similar-grid" />
        </section>
      )}

      {hiddenCount === 0 ? null : (
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
            href={resultsHref(withShowAll(view.query))}
          >
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
