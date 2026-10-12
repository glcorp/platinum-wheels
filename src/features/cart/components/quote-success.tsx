import { PRIMARY_CONTACT } from "@/lib/site";

/* ---------------------------------------------------------------------------
   QuoteSuccess — what the cart page shows once `submitCartQuote` returns
   `{ status: "success" }` (D51; on the cart since D122, which also empties
   the cart).

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

   The caller owns focus: `CartView` moves focus here on success so a screen
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
  /** `Sent Oct 11, 2026, 3:42 p.m.` (D162): the panel now stays on `/cart`
   *  after a refresh, so it says when. Omitted on `/styleguide`'s plain copy. */
  sentLabel?: string;
  /** The products that request covered (`SentLines`, D162). */
  children?: React.ReactNode;
}

export function QuoteSuccess({ role, tabIndex, ref, sentLabel, children }: QuoteSuccessProps) {
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
      className="bg-surface border-border-strong flex min-w-0 max-w-full flex-col items-start gap-3 border p-5 sm:gap-4 sm:p-8 enter-rise"
    >
      {/* `h2` under the cart page's `Your cart` (D122). It used to be an
          `h3` under the quote band's own `h2`. */}
      {sentLabel ? (
        <span className="label text-ink-dim text-11 tracking-14 sm:text-12">{sentLabel}</span>
      ) : null}
      <h2 className="display text-ink text-display-28 sm:text-display-40">
        Quote request sent.
      </h2>
      {/* New copy. Says what happens next and by when, and gives the phone as
          the faster path — the quote-first fallback the whole build leans on
          (`docs/decisions.md` §7). No em dash (`.claude/rules/ui.md` "Copy"
          bans it in copy we author; artboard copy keeps its own). */}
      <p className="text-ink-muted text-15 leading-body sm:text-16">
        {`We'll check fitment and stock, then get back to you within 1-2 business days. Need it sooner? Call ${PRIMARY_CONTACT.display}.`}
      </p>
      {children ? <div className="w-full min-w-0 pt-2">{children}</div> : null}
    </div>
  );
}
