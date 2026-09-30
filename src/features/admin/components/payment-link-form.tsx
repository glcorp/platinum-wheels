"use client";

/* ---------------------------------------------------------------------------
   PaymentLinkForm — the admin home route's one client island (D89, D92).

   Same idiom as `src/features/product/components/quote-form.tsx`:
   `useActionState(createPaymentLink, PAYMENT_LINK_INITIAL_STATE)`, a focus
   effect that moves to the confirmation panel on success, a focus-first-
   invalid effect on a rejected submit, and a swap-to-success-panel render
   rather than a conditional block inside one form. `PAYMENT_LINK_FIELD` /
   `PAYMENT_LINK_INITIAL_STATE` are the contract (`src/features/admin/types.ts`,
   written before this file, D25).

   NO ARTBOARD DRAWS ANY OF THIS. The `design/` export covers three storefront
   routes only, so the admin has no authority-level-2 source (D89). Every box,
   gap and type value below reuses an existing token or primitive rather than
   inventing one, per `.claude/rules/ui.md` "States the design doesn't show".

   Three fields: amount and description (D92, owner ruling: no line items, no
   quantities, no fees, no tax, no totals block — the owner works the number
   out himself and types it once) and expiry (D103). Do not add a field here
   without an owner ruling; if something looks missing, that belongs in a
   report, not in this file.
   --------------------------------------------------------------------------- */

import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { FieldError, FieldLabel } from "@/components/ui/field-label";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createPaymentLink } from "@/features/admin/payment-link-actions";
import {
  ADMIN_CSRF_FIELD,
  PAYMENT_LINK_EXPIRY,
  PAYMENT_LINK_EXPIRY_DEFAULT,
  PAYMENT_LINK_FIELD,
  PAYMENT_LINK_INITIAL_STATE,
} from "@/features/admin/types";
import { PaymentLinkSuccess } from "./payment-link-success";

/** `csrfToken` comes from the page's `requireAdminSession()` (D95);
 *  `idempotencyKey` is minted by the page per render (`docs/payments.md` §5.3),
 *  so a double-tapped submit returns the same link. */
export function PaymentLinkForm({ csrfToken, idempotencyKey }: { csrfToken: string; idempotencyKey: string }) {
  const [state, formAction, isPending] = useActionState(
    createPaymentLink,
    PAYMENT_LINK_INITIAL_STATE,
  );
  const successRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const expiryRef = useRef<HTMLSelectElement>(null);

  // Move focus to the confirmation once it replaces the form, so a screen
  // reader (and a sighted keyboard user) lands on the thing that changed —
  // exactly `quote-form.tsx`'s pattern.
  useEffect(() => {
    if (state.status === "success") {
      successRef.current?.focus();
    }
  }, [state.status]);

  // Focus the first field that actually failed validation, in drawn field
  // order, rather than leaving focus on <body> — same pattern as
  // `quote-form.tsx`'s audit-C3 fix.
  useEffect(() => {
    if (state.status !== "invalid" || !state.errors) {
      return;
    }
    if (state.errors.amount) {
      amountRef.current?.focus();
    } else if (state.errors.description) {
      descriptionRef.current?.focus();
    } else if (state.errors.expiry) {
      expiryRef.current?.focus();
    }
  }, [state]);

  if (state.status === "success") {
    return (
      <div className="flex flex-col items-start gap-4 sm:gap-5">
        {/* Authored state — see `payment-link-success.tsx` for why it has no
            artboard and why it lives in its own module. `role="status"` and
            `tabIndex={-1}` are passed only here, in the live form: the
            effect above focuses it. */}
        <PaymentLinkSuccess
          ref={successRef}
          role="status"
          tabIndex={-1}
          url={state.url}
          reference={state.reference}
          amount={state.amount}
          description={state.description}
          expiresLabel={state.expiresLabel}
          testMode={state.testMode}
        />
        {/* Starting another link is a full page reload rather than a local
            state reset. `useActionState`'s state lives inside this component
            instance, so resetting it in place would need a remount trick
            (a changing `key` on the form, or lifting the state up one more
            level) purely to save one navigation — not worth it for an admin
            action the owner runs a handful of times a day, and a reload also
            guarantees a clean, empty form rather than one carrying stale
            client state forward. */}
        <Button
          type="button"
          variant="secondary"
          size="compact"
          onClick={() => window.location.reload()}
        >
          Start another link
        </Button>
      </div>
    );
  }

  const values = state.status === "invalid" || state.status === "unavailable" ? state.values : undefined;
  const errors = state.status === "invalid" ? state.errors : undefined;

  return (
    <form action={formAction} data-probe="payment-link-form" className="flex flex-col gap-5 sm:gap-6">
      <input type="hidden" name={ADMIN_CSRF_FIELD} value={csrfToken} />
      <input type="hidden" name={PAYMENT_LINK_FIELD.idempotencyKey} value={idempotencyKey} />
      <div>
        <FieldLabel htmlFor="payment-amount" required>
          Amount (CAD)
        </FieldLabel>
        {/* `Input` applies its own horizontal padding (`px-3.5 sm:px-4`) as a
            shorthand utility. The `pl-*`/`pr-*` classes below are longhand
            overrides of that same axis — a deliberately different utility
            family, not a second value competing for the same one, which is
            the documented, reliable way to reserve room for an adornment
            without touching `Input`'s own box (unlike overriding one full
            utility with another of the same kind, e.g. a height, which
            `src/components/ui/button.tsx`'s own comments flag as unreliable).
            Both adornments are `aria-hidden`: the label above already says
            "Amount (CAD)", so the accessible name does not depend on them. */}
        <div className="relative">
          <span
            aria-hidden="true"
            className="text-ink-dim font-sans text-16 leading-flat pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-bold sm:left-4 sm:text-17"
          >
            $
          </span>
          <Input
            id="payment-amount"
            name={PAYMENT_LINK_FIELD.amount}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            // Numbers are not prose (D66). Description keeps spellcheck on:
            // it is customer-facing text where a typo is worth catching.
            spellCheck={false}
            placeholder="0.00"
            className="pr-14 pl-7 sm:pr-16 sm:pl-8"
            ref={amountRef}
            defaultValue={values?.amount}
            invalid={Boolean(errors?.amount)}
            aria-describedby={errors?.amount ? "payment-amount-error" : undefined}
          />
          <span
            aria-hidden="true"
            className="label text-ink-dim text-11 tracking-12 pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 sm:right-4"
          >
            CAD
          </span>
        </div>
        {errors?.amount ? (
          <FieldError id="payment-amount-error">{errors.amount}</FieldError>
        ) : null}
      </div>

      <div>
        <FieldLabel htmlFor="payment-description" required>
          Description
        </FieldLabel>
        {/* `Textarea`, not `Input`: up to `DESCRIPTION_MAX_LENGTH` (200)
            characters routinely wraps to two or three lines while typing a
            real job ("4x ... with install, balance and disposal"), and
            `Textarea` already handles that wrap and a manual resize without
            clipping — a single-line `Input` would scroll its own text
            sideways instead. */}
        <Textarea
          id="payment-description"
          name={PAYMENT_LINK_FIELD.description}
          ref={descriptionRef}
          placeholder="4x Zeta Antarctica Sport 215/55R16 with install"
          defaultValue={values?.description}
          invalid={Boolean(errors?.description)}
          aria-describedby={errors?.description ? "payment-description-error" : undefined}
        />
        {errors?.description ? (
          <FieldError id="payment-description-error">{errors.description}</FieldError>
        ) : null}
      </div>

      <div>
        <FieldLabel htmlFor="payment-expiry" required>
          Link stays open for
        </FieldLabel>
        <Select
          id="payment-expiry"
          name={PAYMENT_LINK_FIELD.expiry}
          ref={expiryRef}
          defaultValue={values?.expiry || PAYMENT_LINK_EXPIRY_DEFAULT}
          invalid={Boolean(errors?.expiry)}
          aria-describedby={errors?.expiry ? "payment-expiry-error" : undefined}
        >
          {PAYMENT_LINK_EXPIRY.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        {errors?.expiry ? <FieldError id="payment-expiry-error">{errors.expiry}</FieldError> : null}
      </div>

      {state.status === "unavailable" ? (
        <p role="alert" className="text-ink text-14 leading-body">
          The link could not be saved. Nothing was created. Try again in a minute.
        </p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        size="panel"
        fullWidth
        disabled={isPending}
      >
        {isPending ? "Generating…" : "Generate link"}
      </Button>
    </form>
  );
}
