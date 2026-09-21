import { PRIMARY_CONTACT } from "@/lib/site";

/* ---------------------------------------------------------------------------
   QuoteSuccess — what the quote band shows once `submitQuote` returns
   `{ status: "success" }` (D51).

   NO ARTBOARD DRAWS THIS. Neither product export contains a submitted state —
   the only form state they draw is the staged, partly-typed one
   (`design/inventory/product.md` §2.6, §7.4). It is therefore authored under
   `.claude/rules/ui.md` "States the design doesn't show", from existing tokens
   and type roles only: the `--surface` panel and `--border-strong` hairline of
   the `Inquiring about` chip it replaces, and the display ramp the page
   already uses. It invents no colour, no radius and no spacing value.

   It lives in its own module, not inside `quote-form.tsx`, for two reasons:
   `/styleguide` renders the real component rather than a copy that can drift
   (`src/app/(storefront)/llm.md`, and the `ResultsEmpty` precedent), and a
   Server Component keeps it out of the client bundle on that page.

   The caller owns focus: `QuoteForm` moves focus here on success so a screen
   reader and a keyboard user both land on the thing that changed. `role`
   and `tabIndex` are props so the styleguide can render it inert — a live
   `role="status"` on a reference page would announce itself on load.
   --------------------------------------------------------------------------- */

export interface QuoteSuccessProps {
  /** `"status"` in the live form; omitted on `/styleguide`. */
  role?: "status";
  /** `-1` in the live form so `QuoteForm` can focus it. */
  tabIndex?: number;
  ref?: React.Ref<HTMLDivElement>;
}

export function QuoteSuccess({ role, tabIndex, ref }: QuoteSuccessProps) {
  return (
    <div
      ref={ref}
      role={role}
      tabIndex={tabIndex}
      /* Fades in, resting state fully opaque — a failed stylesheet can never
         hide it. The most consequential action on the site used to report its
         own rejection with no visual event at all; D65 fixed the focus and
         announcement half of that, this is the matching visual half.
         `role="alert"` announces content, not opacity, so the 150ms does not
         delay the announcement. D67. */
      data-probe="quote-success"
      className="bg-surface border-border-strong flex flex-col items-start gap-3 border p-5 sm:gap-4 sm:p-8 opacity-100 transition-opacity duration-150 ease-[var(--ease-card)] starting:opacity-0"
    >
      {/* `h3`: the band's own `h2` is `Tell us where to send it.`, and this
          replaces the form beneath it rather than the heading. */}
      <h3 className="display text-ink text-display-28 sm:text-display-40">
        Quote request sent.
      </h3>
      {/* New copy. Says what happens next and by when, and gives the phone as
          the faster path — the quote-first fallback the whole build leans on
          (`docs/decisions.md` §7). No em dash (`.claude/rules/ui.md` "Copy"
          bans it in copy we author; artboard copy keeps its own). */}
      <p className="text-ink-muted text-15 leading-body sm:text-16">
        {`We check fitment and stock, then reply by your preferred contact method within one business day. Need it sooner? Call ${PRIMARY_CONTACT.display}.`}
      </p>
    </div>
  );
}
