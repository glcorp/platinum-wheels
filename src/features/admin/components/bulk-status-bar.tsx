"use client";

/* ---------------------------------------------------------------------------
   BulkStatusBar — change the status of many products at once (D116).

   Two scopes, one control (owner, 2026-10-01):
     - **Ticked:** the rows ticked on this page. Each card's checkbox is
       `form="product-bulk"`, so it belongs to this form wherever it sits.
     - **All matching:** everything the list's current search and filters
       match, on every page. Offered only when a search or filter is set, and
       always behind a confirm that states the count.

   The two scopes must never mix: the action treats any posted `ids` as
   "ticked" and ignores the filter (`product-actions.ts`), so "all matching"
   is posted as a FormData built here with the filter and no ids at all. An
   empty ticked submit is stopped here and refused by the server anyway; it
   can never mean the whole catalogue (D107b).
   --------------------------------------------------------------------------- */

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field-label";
import { Select } from "@/components/ui/select";
import { PRODUCT_STATUSES } from "@/features/catalog/catalog-types";

import { bulkSetProductStatusAction } from "../product-actions";
import {
  BULK_FORM_ID,
  BULK_IDS_MAX,
  PRODUCT_STATUS_FIELD,
  PRODUCT_STATUS_INITIAL_STATE,
  PRODUCT_STATUS_LABEL,
  type ProductListQuery,
} from "../product-types";
import { ADMIN_CSRF_FIELD } from "../types";

const TICKBOX_SELECTOR = `input[type="checkbox"][form="${BULK_FORM_ID}"][name="${PRODUCT_STATUS_FIELD.ids}"]`;

function tickboxes(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>(TICKBOX_SELECTOR));
}

export function BulkStatusBar({
  csrfToken,
  filter,
  total,
}: {
  csrfToken: string;
  /** The list's active search and filters; empty when none is set. */
  filter: Omit<ProductListQuery, "page">;
  /** How many products the filter matches, across every page. */
  total: number;
}) {
  const [state, formAction, isPending] = useActionState(bulkSetProductStatusAction, PRODUCT_STATUS_INITIAL_STATE);
  const [ticked, setTicked] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const statusRef = useRef<HTMLSelectElement>(null);
  const filtered = Object.values(filter).some((value) => value !== undefined && value !== "");

  // Keep the ticked count live as rows are ticked anywhere on the page.
  useEffect(() => {
    const recount = () => setTicked(tickboxes().filter((box) => box.checked).length);
    recount();
    document.addEventListener("change", recount);
    return () => document.removeEventListener("change", recount);
  }, []);

  // After a change lands the page re-renders with fresh rows; clear the ticks.
  useEffect(() => {
    if (state.status !== "done") return;
    for (const box of tickboxes()) box.checked = false;
    // Unticking from script fires no `change`; send one so the listener
    // above recounts.
    document.dispatchEvent(new Event("change"));
  }, [state]);

  function targetLabel(): string {
    const value = statusRef.current?.value ?? "";
    return PRODUCT_STATUS_LABEL[value as keyof typeof PRODUCT_STATUS_LABEL] ?? value;
  }

  function submitTicked(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const formData = new FormData(event.currentTarget);
    const count = formData.getAll(PRODUCT_STATUS_FIELD.ids).length;
    if (count === 0) {
      setNotice("Tick some products first.");
      return;
    }
    if (count > BULK_IDS_MAX) {
      setNotice(`Tick at most ${BULK_IDS_MAX} products at a time.`);
      return;
    }
    if (!window.confirm(`Change ${count === 1 ? "1 product" : `${count} products`} to ${targetLabel()}?`)) return;
    startTransition(() => formAction(formData));
  }

  function submitAllMatching() {
    setNotice(null);
    const formData = new FormData();
    formData.set(ADMIN_CSRF_FIELD, csrfToken);
    formData.set(PRODUCT_STATUS_FIELD.status, statusRef.current?.value ?? "");
    if (filter.search) formData.set(PRODUCT_STATUS_FIELD.filterSearch, filter.search);
    if (filter.category) formData.set(PRODUCT_STATUS_FIELD.filterCategory, filter.category);
    if (filter.status) formData.set(PRODUCT_STATUS_FIELD.filterStatus, filter.status);
    if (filter.brand) formData.set(PRODUCT_STATUS_FIELD.filterBrand, filter.brand);
    // D127b. Every filter the list shows must ride along, or the change would
    // reach products the list did not show.
    if (filter.vendor) formData.set(PRODUCT_STATUS_FIELD.filterVendor, filter.vendor);
    if (filter.accessoryType) formData.set(PRODUCT_STATUS_FIELD.filterAccessoryType, filter.accessoryType);
    if (filter.rim !== undefined) formData.set(PRODUCT_STATUS_FIELD.filterRim, String(filter.rim));
    if (filter.noPhoto) formData.set(PRODUCT_STATUS_FIELD.filterNoPhoto, "1");
    const products = total === 1 ? "1 product" : `${total.toLocaleString("en-CA")} products`;
    if (!window.confirm(`Change all ${products} this list matches, on every page, to ${targetLabel()}?`)) return;
    startTransition(() => formAction(formData));
  }

  return (
    <form
      id={BULK_FORM_ID}
      onSubmit={submitTicked}
      className="bg-surface border-border-strong flex flex-col gap-4 border p-4 sm:p-5"
    >
      <input type="hidden" name={ADMIN_CSRF_FIELD} value={csrfToken} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="label text-ink text-11 tracking-12" aria-live="polite">
          {ticked === 1 ? "1 ticked" : `${ticked} ticked`}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="tertiary"
            size="compact"
            onClick={() => {
              const boxes = tickboxes();
              const tickAll = boxes.some((box) => !box.checked);
              for (const box of boxes) box.checked = tickAll;
              setTicked(tickAll ? boxes.length : 0);
            }}
          >
            Tick all on page
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-60">
          <FieldLabel htmlFor="product-bulk-status">Change to</FieldLabel>
          <Select id="product-bulk-status" name={PRODUCT_STATUS_FIELD.status} ref={statusRef} density="compact" defaultValue="published">
            {PRODUCT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {PRODUCT_STATUS_LABEL[value]}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary" size="compact" disabled={isPending}>
          Apply to ticked
        </Button>
        {filtered && total > 0 ? (
          <Button type="button" variant="secondary" size="compact" disabled={isPending} onClick={submitAllMatching}>
            {`Apply to all ${total.toLocaleString("en-CA")} matching`}
          </Button>
        ) : null}
      </div>
      {notice ? (
        <p role="status" className="text-ink text-13 leading-body">
          {notice}
        </p>
      ) : state.status === "invalid" ? (
        <p role="status" className="text-ink text-13 leading-body">
          {state.message}
        </p>
      ) : state.status === "done" ? (
        <p role="status" className="text-ink text-13 leading-body">
          {`${state.changed === 1 ? "1 product" : `${state.changed.toLocaleString("en-CA")} products`} changed to ${PRODUCT_STATUS_LABEL[state.to]}.`}
        </p>
      ) : null}
    </form>
  );
}
