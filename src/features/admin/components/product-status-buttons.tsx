"use client";

/* ---------------------------------------------------------------------------
   ProductStatusButtons — Publish / Hide / Discontinue for one product (D116).

   On every list card and on the edit page (owner, 2026-10-01). One form, one
   submit button per status the product is NOT in; the pressed button's
   `name="status"` value is what posts. No confirm: every status change is
   undone by pressing another button, and nothing is deleted (D105b).

   A successful change expires the catalogue cache and re-renders the page
   (`updateTag`, D109), so the product's new status shows without a message
   here. Only a failure says anything.
   --------------------------------------------------------------------------- */

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { PRODUCT_STATUSES, type ProductStatus } from "@/features/catalog/catalog-types";

import { setProductStatusAction } from "../product-actions";
import {
  PRODUCT_ID_FIELD,
  PRODUCT_STATUS_FIELD,
  PRODUCT_STATUS_INITIAL_STATE,
  PRODUCT_STATUS_VERB,
} from "../product-types";
import { ADMIN_CSRF_FIELD } from "../types";

export function ProductStatusButtons({
  csrfToken,
  productId,
  status,
}: {
  csrfToken: string;
  productId: string;
  status: ProductStatus;
}) {
  const [state, formAction, isPending] = useActionState(setProductStatusAction, PRODUCT_STATUS_INITIAL_STATE);
  const targets = PRODUCT_STATUSES.filter((value) => value !== status);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name={ADMIN_CSRF_FIELD} value={csrfToken} />
      <input type="hidden" name={PRODUCT_ID_FIELD} value={productId} />
      <div className="flex flex-wrap gap-2">
        {targets.map((target) => (
          <Button
            key={target}
            type="submit"
            name={PRODUCT_STATUS_FIELD.status}
            value={target}
            // Publishing is the one move that puts a product in front of
            // customers, so it is the one filled button.
            variant={target === "published" ? "primary" : "secondary"}
            size="compact"
            disabled={isPending}
          >
            {PRODUCT_STATUS_VERB[target]}
          </Button>
        ))}
      </div>
      {state.status === "invalid" ? (
        <p role="status" className="text-ink text-13 leading-body">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
