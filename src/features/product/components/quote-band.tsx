/* ---------------------------------------------------------------------------
   QuoteBand — "Get your quote" / "Tell us where to send it." (D51)

   Server Component. Every `Request a quote` CTA in the build lands on
   `id="quote"` (`src/lib/routes.ts` `quoteRoute()`); this band is what is
   there when it does. The form itself is `QuoteForm`, the folder's one client
   island — this file is layout and copy around it.

   Desktop `product-desktop.html:132-157`, mobile `product-mobile.html:106-123`,
   both measured in `design/inventory/product.md` §2.6 and §5.3.
   --------------------------------------------------------------------------- */

import { QuoteForm } from "@/features/product/components/quote-form";
import type { ProductView } from "@/features/product/types";

export interface QuoteBandProps {
  view: ProductView;
}

export function QuoteBand({ view }: QuoteBandProps) {
  const { product, vehicle, inquiryContext, quantity } = view;

  // D47(2), D53(6): the only fitment sentence on the page, and it never
  // invents a vehicle. With one in the URL it names the model
  // (`product-desktop.html:135` "against your Civic" -> "your <model>");
  // without one it genericises — new copy under `.claude/rules/ui.md`, since
  // no artboard draws this state (D28 precedent).
  //
  // D58 check: neither this clause nor the paragraph it feeds below
  // ("We check the fitment against …, confirm stock, and reply with a firm
  // price and a secure payment link.", `product-desktop.html:135` verbatim
  // minus the vehicle swap already made under D53(6)) names "tire" anywhere,
  // so both already read correctly for a wheel or an accessory PDP with no
  // further change.
  const vehicleClause = vehicle !== null ? `your ${vehicle.model}` : "your vehicle";

  return (
    <section
      id="quote"
      data-probe="quote-band"
      // Fill + hairlines: product-desktop.html:132
      //   background:var(--surface-2); border-top/border-bottom:1px solid var(--border)
      // Margin-top: 56px mobile (product-mobile.html:106) -> 120px desktop (:132)
      // Padding: 56px 16px mobile -> 96px 48px desktop, both same lines.
      className="bg-surface-2 border-border mt-14 border-y px-4 py-14 md:mt-30 md:px-12 md:py-24"
    >
      {/* Inner grid: single column, gap 24px mobile (product-mobile.html:106
          `gap:24px`) -> `quote-grid` (5fr/7fr, 64px gap) desktop
          (product-desktop.html:133; the utility is `globals.css`). */}
      <div className="flex flex-col gap-6 md:quote-grid">
        {/* Left column, `gap:24px` both widths (product-desktop.html:133
            `gap:24px`, product-mobile.html:106 `gap:24px`). */}
        <div className="flex flex-col gap-6">
          {/* Eyebrow: accent, `font:500 12px/1;letter-spacing:.16em;uppercase`
              desktop (product-desktop.html:135), `11px` mobile
              (product-mobile.html:113). Same recipe as the home eyebrows
              (`src/features/home/components/winter-promo.tsx:87`). */}
          <span
            data-probe="quote-eyebrow"
            className="label text-accent text-11 tracking-16 sm:text-12"
          >
            Get your quote
          </span>

          {/* `<h2>` — display, 88px desktop / 48px mobile
              (product-desktop.html:135, product-mobile.html:114). Both
              artboards wrap this line to two on their own: product-mobile
              at its own 390 (358px column, 48px) and product-desktop at its
              own 1440 (533px column, 88px), measured directly on :4000 -
              drawn, not a bug, and DESIGN.md section 3's own stated ceiling
              at the 88 role. Between them, 720 to 1319px, no artboard exists
              and 88px cannot fit this string in the quote-grid 5fr column
              below roughly 2160px, so jumping straight to 88 at sm wrapped
              it to two lines as early as 721px and to three at md,
              1100-1319 (measured), breaking that same two-line ceiling with
              no artboard to license it. Fix: hold 56, the existing token
              winter-promo.tsx already uses for this same tablet gap
              (D41, promo h2 56), through 720-1319, so that band is one line
              at 720-1099 and a clean two, never three, at 1100-1319; 88
              only resumes at lg, 1320, already measured two-line-safe there
              and at 1400/1440. Neither measured breakpoint (390, 1440)
              moved, so no DEVIATIONS row - see product/llm.md Rules. */}
          <h2
            data-probe="quote-h2"
            className="display text-ink text-display-48 sm:text-display-56 lg:text-display-88"
          >
            Tell us where to send it.
          </h2>

          {/* Paragraph: desktop only, absent on mobile
              (product-mobile.html:106-123 has no `<p>`; product.md §2.6
              "same copy except the `<p>` is absent"). `max-w-measure` is the
              420px container token (product-desktop.html:136 `max-width:420px`). */}
          <p
            data-probe="quote-paragraph"
            className="text-ink-muted hidden text-17 leading-body max-w-measure md:block"
          >
            {`We check the fitment against ${vehicleClause}, confirm stock, and reply with a firm price and a secure payment link.`}
          </p>

          {/* "Inquiring about" chip.
              Desktop: inline row, `padding:14px 16px;gap:12px`
              (product-desktop.html:136).
              Mobile: stacked column, `padding:12px 14px;gap:4px`
              (product-mobile.html:115). */}
          <div
            data-probe="quote-chip"
            className="bg-surface border-border-strong flex flex-col items-start gap-1 self-start border p-3 sm:inline-flex sm:flex-row sm:items-center sm:gap-3 sm:p-3.5"
          >
            {/* Label `font:500 10px/1;letter-spacing:.12em;uppercase;
                color:var(--text-dim)` mobile (product-mobile.html:115) ->
                `11px` desktop (product-desktop.html:136). */}
            <span className="label text-ink-dim text-10 tracking-12 sm:text-11">
              Inquiring about
            </span>
            {/* Value `font:700 14px/1.3`, colour inherits `--text`
                (both files, same lines; `--leading-normal` = 1.3,
                globals.css). */}
            <span className="text-ink text-14 leading-normal font-bold">
              {inquiryContext}
            </span>
          </div>
        </div>

        {/* Right column: the form island. `gap:32px` desktop
            (product-desktop.html:136 "display:flex;flex-direction:column;
            gap:32px"); the mobile column has no separate wrapper gap of its
            own (product-mobile.html:106 wraps the whole band at `gap:24px`),
            so the extra desktop gap is `md:` only. */}
        <div className="flex flex-col gap-6 md:gap-8">
          <QuoteForm
            slug={product.slug}
            quantity={quantity}
            unit={view.config.unit}
            /* Placeholder + consent copy, per category. A tire gets the
               artboard string verbatim; the other two get the variant
               (D59(7), `categories.ts` `copy.quotePlaceholder`). Passed as
               props because `QuoteForm` is the folder's one client island and
               has no business importing the category table. */
            placeholder={view.config.copy.quotePlaceholder}
            consent={view.config.copy.quoteConsent}
            /* D104: the vehicle rides along to the owner alert, and the
               render time starts the fill timer. The page reads
               `searchParams`, so it renders per request and this is the
               real render time, not the build's. This is a Server
               Component: it renders once per request and never re-renders,
               which is the case the purity rule guards against. */
            vehicle={vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : ""}
            // eslint-disable-next-line react-hooks/purity -- server render, once per request (D104)
            renderedAt={Date.now()}
          />
        </div>
      </div>
    </section>
  );
}
