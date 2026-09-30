import { CopyLinkButton } from "@/features/admin/components/copy-link-button";
import { LinkRowActions } from "@/features/admin/components/link-row-actions";
import { payLinkUrl } from "@/features/payments/config";
import { displayCents } from "@/features/payments/money";
import type { LinkSummary } from "@/features/payments/service";

/* ---------------------------------------------------------------------------
   PaymentLinkList — the latest links and whether each was paid (D106).

   NO ARTBOARD DRAWS THIS (D89). Stacked cards, not a table: the owner works
   on a phone and a tablet ("mostly on phone and tab", D89), and a six-column
   table cannot fit 375px without scrolling sideways, which is a measured gate
   in this repo. Tokens and roles are the success panel's.

   The status word is the database's, derived at request time: `expired` is
   computed, never stored (`src/db/schema.ts`).
   --------------------------------------------------------------------------- */

const DATE = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Toronto",
});

const STATE_LABEL = {
  active: "Open",
  paid: "Paid",
  expired: "Expired",
  cancelled: "Cancelled",
} as const;

export function PaymentLinkList({
  links,
  origin,
  csrfToken,
}: {
  links: LinkSummary[];
  origin: string;
  csrfToken: string;
}) {
  if (links.length === 0) {
    return <p className="text-ink-muted text-15 leading-body">No payment links yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {links.map(({ link, state, approved, pendingAttempts, duplicateAttempts }) => (
        <li key={link.id} className="bg-surface border-border-strong flex flex-col gap-3 border p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="numeral text-ink text-20 leading-flat">{`${displayCents(link.amountCents)} CAD`}</span>
            <span
              className={`label text-11 tracking-12 ${state === "paid" ? "text-accent" : state === "active" ? "text-ink" : "text-ink-dim"}`}
            >
              {STATE_LABEL[state]}
            </span>
          </div>

          <p className="text-ink text-15 leading-body">{link.description}</p>

          <dl className="text-ink-muted text-13 leading-body flex flex-col gap-0.5">
            <div className="flex flex-wrap gap-2">
              <dt className="text-ink-dim">Reference</dt>
              <dd className="numeral">{link.reference}</dd>
            </div>
            <div className="flex flex-wrap gap-2">
              <dt className="text-ink-dim">Created</dt>
              <dd>{DATE.format(link.createdAt)}</dd>
            </div>
            {state === "paid" && link.paidAt ? (
              <div className="flex flex-wrap gap-2">
                <dt className="text-ink-dim">Paid</dt>
                <dd>
                  {DATE.format(link.paidAt)}
                  {approved?.cardBrand || approved?.cardLast4
                    ? ` · ${approved.cardBrand ?? "Card"} ending ${approved.cardLast4 ?? "????"}`
                    : ""}
                  {approved?.approvalCode ? ` · approval ${approved.approvalCode}` : ""}
                </dd>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <dt className="text-ink-dim">{state === "expired" ? "Expired" : "Open until"}</dt>
                <dd>{DATE.format(link.expiresAt)}</dd>
              </div>
            )}
          </dl>

          {duplicateAttempts > 0 ? (
            <p role="alert" className="border-accent bg-accent-subtle text-ink text-13 leading-body border p-3">
              {duplicateAttempts === 1 ? "One payment" : `${duplicateAttempts} payments`} went through that this link
              should not have taken. Refund {duplicateAttempts === 1 ? "it" : "them"} in the payment portal (invoice
              numbers start {link.reference}).
            </p>
          ) : null}
          {pendingAttempts > 0 && state !== "paid" ? (
            <p className="text-ink-muted text-13 leading-body">
              A payment was started and not confirmed yet. It is checked automatically once a day, or press Check
              payment.
            </p>
          ) : null}

          {state === "active" ? <CopyLinkButton value={payLinkUrl(origin, link.publicToken)} /> : null}

          <LinkRowActions
            csrfToken={csrfToken}
            linkId={link.id}
            canCancel={state === "active"}
            canCheck={pendingAttempts > 0}
          />
        </li>
      ))}
    </ul>
  );
}
