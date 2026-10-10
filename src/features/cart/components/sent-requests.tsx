import Link from "next/link";

import type { SentLine, SentRequest } from "@/lib/cart";
import { productRoute } from "@/lib/routes";
import { SHOP_DATE_TIME } from "@/lib/time";

/* ---------------------------------------------------------------------------
   Sent quote requests on `/cart` (D162)

   Owner brief, 2026-10-11: "Quote request sent" stays on `/cart` after a
   refresh, and earlier requests stay listed. The record is the browser's own
   (`src/lib/cart.ts` `useSentRequests`): the time and the products, never the
   visitor's details (owner: "Products and time only").

   Undrawn. Built from what the cart already uses: the `QuoteSuccess` panel for
   the newest request, the cart line's brand label, display model name and
   numeral size line, and the page's hairlines. No new token.

   No `"use client"`: both pieces render inside `CartView`'s island, and the
   styleguide renders them inert from a Server Component.
   --------------------------------------------------------------------------- */

/** `1 tire`, `4 tires`: `amountLabel` in `src/lib/cart.ts`, repeated here
 *  because that module is client-only (`useSyncExternalStore`) and
 *  `/styleguide`, a Server Component, renders this file. */
function amount(line: SentLine): string {
  return line.quantity === 1 ? line.unit.one : `${line.quantity} ${line.unit.many}`;
}

/** New copy: the one control that empties the record. */
export const CLEAR_LABEL = "Clear sent requests";

/** `Sent Oct 11, 2026, 3:42 p.m.`, Brampton time (D118). */
export function sentLabel(sentAt: string): string {
  return `Sent ${SHOP_DATE_TIME.format(new Date(sentAt))}`;
}

/** The products of one request: name linked to its page, size, amount. */
export function SentLines({ lines }: { lines: readonly SentLine[] }) {
  return (
    <ul className="flex flex-col">
      {lines.map((line) => (
        <li
          key={line.slug}
          className="border-border flex flex-col gap-1 border-t py-3 first:border-t-0 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <Link
              href={productRoute(line.slug)}
              className="text-ink tap-extend text-15 leading-snug font-medium break-words underline-offset-3 hover:underline active:opacity-70 sm:text-16"
            >
              {/* The brand's own spelling, never translated (D93b, WDG-15). */}
              {line.brand ? <span translate="no">{line.brand} </span> : null}
              {line.model}
            </Link>
            <span className="numeral text-ink-muted text-13 leading-tight sm:text-14">
              {line.size}
            </span>
          </span>
          <span className="text-ink-muted text-14 leading-tight whitespace-nowrap">
            {amount(line)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export interface SentRequestListProps {
  requests: readonly SentRequest[];
  /** `Sent from this browser` beside a full cart, `Earlier requests` under
   *  the newest request's panel. */
  title: string;
  /** Clears every sent request. Absent under the newest request's panel
   *  (which carries its own) and on `/styleguide`, where the list is inert. */
  onClear?: () => void;
}

/** Sent requests, newest first, each with its time and products. */
export function SentRequestList({ requests, title, onClear }: SentRequestListProps) {
  if (requests.length === 0) return null;
  return (
    <section
      aria-labelledby="sent-requests-heading"
      data-probe="sent-requests"
      className="border-border-strong flex flex-col gap-5 border-t pt-8 sm:gap-6 sm:pt-10"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2
          id="sent-requests-heading"
          className="display text-ink text-display-28 sm:text-display-40"
        >
          {title}
        </h2>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="text-ink-muted tap-extend text-14 leading-body underline underline-offset-3 hover:text-ink active:opacity-70"
          >
            {CLEAR_LABEL}
          </button>
        ) : null}
      </div>
      <ol className="flex flex-col gap-4">
        {requests.map((request) => (
          <li
            key={request.id}
            className="bg-surface border-border-strong flex flex-col gap-4 border p-5 sm:p-6"
          >
            <span className="label text-ink-dim text-11 tracking-14 sm:text-12">
              <time dateTime={request.sentAt}>{sentLabel(request.sentAt)}</time>
            </span>
            <SentLines lines={request.lines} />
          </li>
        ))}
      </ol>
    </section>
  );
}
