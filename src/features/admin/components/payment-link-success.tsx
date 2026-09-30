import { CopyLinkButton } from "@/features/admin/components/copy-link-button";
import { PAYMENT_LINK_CURRENCY } from "@/features/admin/types";

/* ---------------------------------------------------------------------------
   PaymentLinkSuccess — what the builder shows once `createPaymentLink`
   returns `{ status: "success" }` (D92).

   NO ARTBOARD DRAWS THIS. The `design/` export covers three storefront routes
   and nothing else (D89) — the admin has no authority-level-2 source at all.
   Every value below is authored from `.claude/rules/ui.md` "States the design
   doesn't show", reusing the exact tokens and roles `quote-success.tsx` uses
   for the storefront's own authored success state: the `--surface` panel,
   the `--border-strong` hairline, and the display heading ramp. It invents no
   colour, no radius and no spacing value of its own.

   It lives in its own module, not inside `payment-link-form.tsx`, for the
   same two reasons as `QuoteSuccess`: `/admin/styleguide` renders the real
   component rather than a copy that can drift (D93), and keeping it a Server
   Component keeps its markup out of the client bundle the form ships.

   The caller (`PaymentLinkForm`) owns focus: it moves focus here on success
   so a screen reader and a keyboard user both land on the thing that
   changed. `role` and `tabIndex` are props for the same reason as
   `QuoteSuccess`'s — so `/admin/styleguide` can render this inert. A live
   `role="status"` on a reference page would announce itself on load.

   D94: no payment service provider is chosen yet, so `url` is a fabricated
   placeholder (`payment-link-actions.ts`'s `TODO(psp)`). It resolves to
   nothing. The notice below is mandatory, not decoration — the owner demos
   this to real clients, and nobody may mistake the placeholder for a working
   link.
   --------------------------------------------------------------------------- */

export interface PaymentLinkSuccessProps {
  url: string;
  /** Canonical two-decimal string, e.g. `"452.60"` — never re-parsed here. */
  amount: string;
  description: string;
  /** `"status"` in the live form; omitted on `/admin/styleguide`. */
  role?: "status";
  /** `-1` in the live form so `PaymentLinkForm` can focus it. */
  tabIndex?: number;
  ref?: React.Ref<HTMLDivElement>;
}

export function PaymentLinkSuccess({
  url,
  amount,
  description,
  role,
  tabIndex,
  ref,
}: PaymentLinkSuccessProps) {
  return (
    <div
      ref={ref}
      role={role}
      tabIndex={tabIndex}
      data-probe="payment-link-success"
      className="bg-surface border-border-strong flex flex-col items-start gap-4 border p-5 sm:gap-5 sm:p-8"
    >
      <h2 className="display text-ink text-display-28 sm:text-display-40">
        Payment link ready.
      </h2>

      {/* Mandatory, unmissable notice (D94). Accent is the one colour in the
          system that reads as "pay attention" without reading as an error —
          there is no danger/warning token in this palette, and inventing one
          is out of scope for this file. Sentence case, no exclamation marks
          (`.claude/rules/ui.md` "Copy"). */}
      <div className="border-accent bg-accent-subtle flex flex-col gap-1 border p-3.5 sm:gap-1.5 sm:p-4">
        <span className="label text-ink text-10 tracking-14 sm:text-11">
          Sample link
        </span>
        <p className="text-ink text-13 leading-body sm:text-14">
          No payment gateway is connected yet. This link is a preview only and
          does not process a real payment.
        </p>
      </div>

      {/* Restated so the owner can verify at a glance what he is about to
          paste into an email — a bare URL with no amount beside it is
          unverifiable. `numeral` gives the amount tabular figures; the `$` is
          full size and never superscript, matching the storefront's own
          price rule even though `Price` itself is not used here (it forbids
          cents, and a payment amount needs them). */}
      <dl className="flex flex-col gap-1 sm:gap-1.5">
        <div className="flex flex-wrap items-baseline gap-2">
          <dt className="label text-ink-dim text-11 tracking-12 sm:text-12">
            Amount
          </dt>
          <dd className="numeral text-ink text-20 leading-flat sm:text-22">
            {`$${amount} ${PAYMENT_LINK_CURRENCY}`}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="label text-ink-dim text-11 tracking-12 sm:text-12">
            Description
          </dt>
          <dd className="text-ink text-15 leading-body sm:text-16">
            {description}
          </dd>
        </div>
      </dl>

      {/* `break-all`: horizontal overflow is a measured gate in this repo —
          no page may scroll sideways at any width, and a long generated id
          has no natural break point for `break-words` to use. */}
      <div className="bg-surface-2 w-full p-3.5 sm:p-4">
        <p className="numeral text-ink text-14 leading-body break-all sm:text-15">
          {url}
        </p>
      </div>

      <CopyLinkButton value={url} />
    </div>
  );
}
