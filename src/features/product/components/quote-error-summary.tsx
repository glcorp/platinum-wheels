/* ---------------------------------------------------------------------------
   QuoteErrorSummary — what the quote band shows when `submitQuote` returns
   `{ status: "invalid" }` (D51, audit finding C2/C3, DEVIATIONS #46).

   NO ARTBOARD DRAWS THIS. Neither product export contains an error state at
   all — the exports carry no `:focus`, `:active` or `:disabled` rule either
   (DEVIATIONS #9), so every failure state on this page is authored under
   `.claude/rules/ui.md` "States the design doesn't show". It invents no
   colour, no radius and no spacing: it borrows the `FieldError` type role the
   form already uses for its per-field messages, so the summary and the field
   text read as one system.

   It lives in its own module, not inside `quote-form.tsx`, for the same two
   reasons as `QuoteSuccess`: `/styleguide` renders the real component rather
   than a copy that can drift, and a Server Component keeps it out of the
   client bundle on that page.

   The caller owns focus and announcement. In the live form `role="alert"` is
   implicitly `aria-live="assertive"` and `aria-atomic="true"`, so mounting
   this node *is* the announcement — no extra ARIA needed. Both `role` and
   `tabIndex` are props so `/styleguide` can render it inert; a live alert on
   a reference page would announce itself on load. `tabIndex={-1}` exists only
   so `QuoteForm` can focus the summary in the fallback case where no error
   key maps to a field.
   --------------------------------------------------------------------------- */

export interface QuoteErrorSummaryProps {
  /** How many fields failed validation. Renders nothing at 0. */
  count: number;
  /** `"alert"` in the live form; omitted on `/styleguide`. */
  role?: "alert";
  /** `-1` in the live form so `QuoteForm` can focus it. */
  tabIndex?: number;
  ref?: React.Ref<HTMLParagraphElement>;
}

export function QuoteErrorSummary({
  count,
  role,
  tabIndex,
  ref,
}: QuoteErrorSummaryProps) {
  if (count <= 0) return null;

  return (
    <p
      ref={ref}
      role={role}
      tabIndex={tabIndex}
      /* Arrives with `enter-rise` — a fade up of `--motion-nudge` over
         `--duration-state` via `@starting-style` — resting state fully
         opaque, so a failed stylesheet can never hide it. The most
         consequential action on the site used to report its own rejection
         with no visual event at all; D65 fixed the focus and announcement half
         of that, D67 added a plain fade, and D92b swaps that fade for the shared
         small-enter utility so every in-place panel arrives the same way.
         `role="alert"` announces content, not opacity or position, so the
         motion does not delay the announcement, and focus is untouched. */
      data-probe="quote-error-summary"
      className="text-13 leading-body text-ink-muted enter-rise"
    >
      {/* New copy. Names the count so the announcement is useful on its own,
          and says what it blocks. No em dash (`.claude/rules/ui.md` "Copy"). */}
      {count === 1
        ? "1 field needs a fix before this can be sent."
        : `${count} fields need a fix before this can be sent.`}
    </p>
  );
}
