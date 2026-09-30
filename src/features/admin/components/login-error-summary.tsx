/* ---------------------------------------------------------------------------
   LoginErrorSummary — what `/admin/login` shows when `signIn` returns
   `{ status: "rejected" }` or `{ status: "unavailable" }` (D91).

   Modelled directly on `QuoteErrorSummary`
   (`src/features/product/components/quote-error-summary.tsx`): the same
   `role`/`tabIndex` props so the caller (`LoginForm`) owns focus and
   announcement exactly the way `QuoteForm` owns them, the same visual
   treatment (`text-13 leading-body text-ink-muted`) so the two error
   summaries in this repo read as one system, and the same reason for living
   in its own module rather than inline in the form: `/admin/styleguide`
   (D93) can render the real component, inert, instead of a copy that drifts.

   NO ARTBOARD DRAWS ANY OF THIS (D89) — the `design/` export covers three
   storefront routes and nothing else, so the admin has no authority-level-2
   source at all. This component invents no colour, no radius and no spacing:
   it reuses `QuoteErrorSummary`'s own type role verbatim.

   The one deliberate divergence from that precedent: this takes a `message`
   string, not a `count`. `QuoteErrorSummary` counts failed fields because
   every quote-form failure is a field failure sharing one shape of copy
   ("N fields need a fix…"). The sign-in form has two distinct failure modes
   with unrelated copy — a wrong credential ("rejected") and a missing
   server-side configuration ("unavailable") — and neither is a count of
   anything. (The form's third failure mode, `invalid`, *is* a field failure,
   and is carried by the per-field `FieldError`s in `login-form.tsx` instead —
   this summary renders nothing for it.) With nothing to count, the caller
   decides the copy for whichever mode applies and hands it over as one
   string; this component's only job is to show it, or nothing.
   --------------------------------------------------------------------------- */

export interface LoginErrorSummaryProps {
  /** The full sentence to show. Renders nothing for an empty string. */
  message: string;
  /** `"alert"` in the live form; omitted on `/admin/styleguide`. */
  role?: "alert";
  /** `-1` in the live form so `LoginForm` can focus it. */
  tabIndex?: number;
  ref?: React.Ref<HTMLParagraphElement>;
}

export function LoginErrorSummary({
  message,
  role,
  tabIndex,
  ref,
}: LoginErrorSummaryProps) {
  if (message === "") return null;

  return (
    <p
      ref={ref}
      role={role}
      tabIndex={tabIndex}
      data-probe="admin-login-error"
      className="text-13 leading-body text-ink-muted"
    >
      {message}
    </p>
  );
}
