"use client";

/* ---------------------------------------------------------------------------
   QuoteForm — the cart's quote request (D51, moved to the cart by D122)

   The product page's drawn form (`product-desktop.html:140-153`,
   `product-mobile.html:111-121`) inside the cart's quote dialog. Fields,
   order, boxes and type are unchanged; every value below still cites those
   lines or `design/inventory/product.md` §2.6 / §5.3. What D122 took out: the
   Quantity select and the Custom field (the cart holds every quantity). What
   it added: one hidden field carrying the cart's lines.

   NO SAMPLE DATA. The artboards stage `Priya Sandhu` / `priya.s@` /
   `(905) 000-0000` as an interaction demo (`product.md` §7.4); none of it
   ships. The phone number appears only as a `placeholder` attribute.

   The send runs in `onSubmit` inside a try/catch (D93b, ENV-1): a Server
   Action that never reaches the server throws, and uncaught it lands in the
   route error boundary with everything the visitor typed. Caught, the form
   stays and says so. There is no no-JS path to keep: the cart itself lives in
   the browser, so the cart page needs JavaScript before this form exists.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError, FieldLabel } from "@/components/ui/field-label";
import { Input, Textarea } from "@/components/ui/input";
import { submitCartQuote } from "@/features/cart/actions";
import { QuoteErrorSummary } from "@/features/cart/components/quote-error-summary";
import {
  CONTACT_METHODS,
  DEFAULT_CONTACT_METHOD,
  QUOTE_FIELD,
  QUOTE_INITIAL_STATE,
  type PostedLine,
  type QuoteCopy,
  type QuoteFormState,
} from "@/features/cart/types";
import { cx } from "@/lib/cx";

/** Browser `maxLength` per field (D91b WDG-12). They mirror the caps
 *  `actions.ts` enforces; the server is still the validator (`noValidate`). */
const MAX_LENGTH = { name: 100, email: 254, phone: 32, message: 1000 } as const;

/** New copy (owner-approved 2026-09-30, D93b ENV-1): the send itself failed. */
const SEND_FAILED = "We couldn't send that. Check your connection and try again.";

function failedSendState(formData: FormData): QuoteFormState {
  const values: QuoteFormState["values"] = {};
  for (const field of ["name", "email", "phone", "contact", "message", "consent"] as const) {
    const value = formData.get(field);
    if (typeof value === "string") values[field] = value;
  }
  return { status: "invalid", errors: {}, values, notice: SEND_FAILED };
}

export interface QuoteFormProps {
  /** The cart as it stands when Send is pressed. Read at submit, not at
   *  render, so a quantity changed behind the dialog still goes out right. */
  getLines: () => PostedLine[];
  /** Placeholder and consent words for this cart (`copy.ts`, D59(7)). */
  copy: QuoteCopy;
  /** `performance.now()` at the dialog's first opening: the fill timer's
   *  start (D104, D123(7)). */
  openedAt: number;
  /** The request is in: the cart page empties the cart and confirms. */
  onSuccess: () => void;
}

export function QuoteForm({ getLines, copy, openedAt, onSuccess }: QuoteFormProps) {
  const [state, setState] = useState<QuoteFormState>(QUOTE_INITIAL_STATE);
  const [isPending, startSend] = useTransition();
  const errorSummaryRef = useRef<HTMLParagraphElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const values =
    state.status === "invalid" || state.status === "failed" ? state.values : undefined;

  useEffect(() => {
    if (state.status === "success") onSuccess();
  }, [state.status, onSuccess]);

  // Audit C3: focus the first field that failed, in drawn order; a send
  // failure or a whole-form notice has no field, so the summary takes focus.
  useEffect(() => {
    if (state.status === "failed") {
      errorSummaryRef.current?.focus();
      return;
    }
    if (state.status !== "invalid") return;
    const errors = state.errors ?? {};
    if (errors.name) nameRef.current?.focus();
    else if (errors.email) emailRef.current?.focus();
    else if (errors.phone) phoneRef.current?.focus();
    else if (errors.message) messageRef.current?.focus();
    else errorSummaryRef.current?.focus();
  }, [state]);

  const errors = state.status === "invalid" ? state.errors : undefined;
  const selectedContact = values?.contact ?? DEFAULT_CONTACT_METHOD;
  const errorCount = errors ? Object.keys(errors).length : 0;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        formData.set(QUOTE_FIELD.lines, JSON.stringify(getLines()));
        formData.set(QUOTE_FIELD.elapsed, String(Math.round(performance.now() - openedAt)));
        startSend(async () => {
          try {
            setState(await submitCartQuote(state, formData));
          } catch {
            setState(failedSendState(formData));
          }
        });
      }}
      data-probe="quote-form"
      /* `noValidate` so the authored validation is the one people meet
         (D65, craft audit P1 #3); `actions.ts` is the validator. */
      noValidate
      className="flex flex-col gap-8"
    >
      {/* Honeypot (D104): out of flow, out of the tab order, hidden from
          assistive technology, so only a bot filling every input sets it. */}
      <div aria-hidden="true" className="sr-only">
        <label htmlFor="quote-website">Website</label>
        <input
          id="quote-website"
          type="text"
          name={QUOTE_FIELD.website}
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      {/* Mounting this node is the announcement (`role="alert"`, audit C2). */}
      <QuoteErrorSummary
        count={errorCount}
        message={state.status === "invalid" ? state.notice : undefined}
        sendFailed={state.status === "failed"}
        role="alert"
        tabIndex={-1}
        ref={errorSummaryRef}
      />

      {/* Field grid. Desktop `1fr 1fr; gap:16px`, Full name `1/3`
          (product-desktop.html:140); mobile stack `gap:14px` (:111). */}
      <div className="flex flex-col gap-3.5 sm:grid sm:grid-cols-2 sm:gap-4">
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="quote-name" required>
            Full name
          </FieldLabel>
          <Input
            id="quote-name"
            name={QUOTE_FIELD.name}
            type="text"
            autoComplete="name"
            maxLength={MAX_LENGTH.name}
            required
            ref={nameRef}
            defaultValue={values?.name}
            invalid={Boolean(errors?.name)}
            aria-describedby={errors?.name ? "quote-name-error" : undefined}
          />
          {errors?.name ? <FieldError id="quote-name-error">{errors.name}</FieldError> : null}
        </div>

        <div>
          <FieldLabel htmlFor="quote-email" required>
            Email
          </FieldLabel>
          <Input
            id="quote-email"
            name={QUOTE_FIELD.email}
            type="email"
            autoComplete="email"
            maxLength={MAX_LENGTH.email}
            required
            ref={emailRef}
            defaultValue={values?.email}
            invalid={Boolean(errors?.email)}
            aria-describedby={errors?.email ? "quote-email-error" : undefined}
          />
          {errors?.email ? <FieldError id="quote-email-error">{errors.email}</FieldError> : null}
        </div>

        <div>
          <FieldLabel htmlFor="quote-phone" required>
            Phone
          </FieldLabel>
          <Input
            id="quote-phone"
            name={QUOTE_FIELD.phone}
            type="tel"
            autoComplete="tel"
            maxLength={MAX_LENGTH.phone}
            required
            ref={phoneRef}
            // Placeholder attribute only, never a value (product.md §7.4).
            placeholder="(905) 000-0000"
            defaultValue={values?.phone}
            invalid={Boolean(errors?.phone)}
            aria-describedby={errors?.phone ? "quote-phone-error" : undefined}
          />
          {errors?.phone ? <FieldError id="quote-phone-error">{errors.phone}</FieldError> : null}
        </div>
      </div>

      {/* Optional group: `border-top:1px solid var(--border-strong)`, padding-top
          20px mobile (product-mobile.html:117) -> 24px desktop (:145). */}
      <div className="border-border-strong flex flex-col gap-3.5 border-t pt-5 sm:gap-4 sm:pt-6">
        <span className="label text-ink-dim text-10 tracking-14 sm:text-11">Optional</span>

        <div>
          {/* The group's accessible name is the fieldset's own legend; this
              visible caption is `aria-hidden` (product-desktop.html:146). */}
          <span
            aria-hidden="true"
            className="label text-ink-muted mb-1.5 block text-11 tracking-12 sm:mb-2 sm:text-12"
          >
            Preferred contact
          </span>
          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className="sr-only">Preferred contact</legend>
            {/* Segmented control: 56px desktop / 52px mobile, separators
                between segments only (product-desktop.html:146, product
                `llm.md` Don't). Selected state is `has-checked:`. */}
            <div className="rounded-ctl border-border-strong grid h-13 grid-cols-3 overflow-hidden border sm:h-14">
              {CONTACT_METHODS.map((method, index) => (
                <label
                  key={method.value}
                  className={cx(
                    "font-sans relative flex cursor-pointer items-center justify-center text-14 leading-flat font-medium",
                    "text-ink-muted has-checked:bg-ink has-checked:text-on-accent",
                    "has-focus-visible:outline-2 has-focus-visible:outline-accent has-focus-visible:outline-offset-0",
                    index > 0 && "border-border-strong border-l",
                  )}
                >
                  <input
                    type="radio"
                    name={QUOTE_FIELD.contact}
                    value={method.value}
                    defaultChecked={selectedContact === method.value}
                    className="sr-only"
                  />
                  {method.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div>
          <FieldLabel htmlFor="quote-message">Message</FieldLabel>
          <Textarea
            id="quote-message"
            name={QUOTE_FIELD.message}
            ref={messageRef}
            placeholder={copy.placeholder}
            maxLength={MAX_LENGTH.message}
            defaultValue={values?.message}
            invalid={Boolean(errors?.message)}
            aria-describedby={errors?.message ? "quote-message-error" : undefined}
          />
          {errors?.message ? (
            <FieldError id="quote-message-error">{errors.message}</FieldError>
          ) : null}
        </div>

        {/* CASL consent (docs/decisions.md:118): a fresh form always renders
            unticked; a rejected submit echoes the visitor's own tick (WDG-10). */}
        <Checkbox
          id="quote-consent"
          name={QUOTE_FIELD.consent}
          variant="consent"
          restoreChecked={Boolean(values?.[QUOTE_FIELD.consent])}
        >
          {copy.consent}
        </Checkbox>
      </div>

      <div className="flex flex-col items-stretch gap-3 sm:items-start">
        <Button
          type="submit"
          variant="primary"
          size="panel"
          fullWidth
          className="sm:w-auto"
          disabled={isPending}
        >
          {isPending ? (
            "Sending…"
          ) : (
            <>
              Send inquiry <span aria-hidden="true">→</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
