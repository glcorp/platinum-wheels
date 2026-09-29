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
      /* Arrives with `enter-rise` — a fade up of `--motion-nudge` over
         `--duration-state` via `@starting-style` — resting state fully
         opaque, so a failed stylesheet can never hide it. It replaces the form
         in place, and without motion the swap had no visual event connecting
         the submit to its result; D67 added a plain fade, D92b swaps it for the
         shared small-enter utility the error summary also uses. `role="status"`
         announces content, not opacity or position, so the motion does not
         delay the announcement, and `QuoteForm`'s focus move is untouched. */
      data-probe="quote-success"
      className="bg-surface border-border-strong flex flex-col items-start gap-3 border p-5 sm:gap-4 sm:p-8 enter-rise"
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
