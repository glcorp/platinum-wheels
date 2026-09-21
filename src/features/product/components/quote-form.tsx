"use client";

/* ---------------------------------------------------------------------------
   QuoteForm — the page's one client island (D51)

   `useActionState(submitQuote, QUOTE_INITIAL_STATE)` — same shape as
   `src/features/results/components/filter-panel.tsx`'s form-as-source-of-truth
   idiom, but this form has no URL state to sync: it posts once, to a Server
   Action, and swaps itself for a confirmation panel on success.

   Fields in drawn order: `product-desktop.html:140-153`,
   `product-mobile.html:111-121`; every box, gap and type value below cites one
   of those two lines or `design/inventory/product.md` §2.6 / §5.3.

   NO SAMPLE DATA. The artboards stage `Priya Sandhu` / `priya.s@` /
   `(905) 000-0000` / a focused-Email caret as an interaction demo
   (`product.md` §7.4) — none of it ships. Every field below renders empty; the
   phone number appears only as a `placeholder` attribute.
   --------------------------------------------------------------------------- */

import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError, FieldLabel } from "@/components/ui/field-label";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { submitQuote } from "@/features/product/actions";
import {
  CONTACT_METHODS,
  DEFAULT_CONTACT_METHOD,
  QUANTITY_OPTIONS,
  QUOTE_FIELD,
  QUOTE_INITIAL_STATE,
  quantityQuoteLabel,
  type QuantityKey,
} from "@/features/product/types";
import { cx } from "@/lib/cx";
import { QuoteErrorSummary } from "./quote-error-summary";
import { QuoteSuccess } from "./quote-success";

export interface QuoteFormProps {
  /** Hidden `slug` field — which product this inquiry is about. */
  slug: string;
  /** The buy panel's current selection (D50), the Quantity select's default. */
  quantity: QuantityKey;
  /**
   * The category's unit pair (D58, `CategoryConfig.unit`), passed as a plain
   * `{ one, many }` prop rather than importing `CATEGORY_CONFIG` into this
   * `"use client"` island — the table stays out of the client bundle, and the
   * server parent (`quote-band.tsx`) is the one place that already resolves
   * `view.config`. Feeds `quantityQuoteLabel()` below.
   */
  unit: { one: string; many: string };
  /**
   * Message-field placeholder, per category (`CategoryConfig.copy`, D59(7)).
   * A tire renders the artboard string verbatim; wheels and accessories render
   * a variant of it, because no artboard draws their PDP and the drawn wording
   * names tires specifically.
   */
  placeholder: string;
  /** CASL consent line, per category, same reasoning as `placeholder`. */
  consent: string;
}

export function QuoteForm({
  slug,
  quantity,
  unit,
  placeholder,
  consent,
}: QuoteFormProps) {
  const [state, formAction, isPending] = useActionState(submitQuote, QUOTE_INITIAL_STATE);
  const successRef = useRef<HTMLDivElement>(null);
  const errorSummaryRef = useRef<HTMLParagraphElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  // Move focus to the confirmation once it replaces the form, so a screen
  // reader (and a sighted keyboard user) lands on the thing that changed.
  useEffect(() => {
    if (state.status === "success") {
      successRef.current?.focus();
    }
  }, [state.status]);

  // Audit C3: a rejected submit used to leave focus on <body>, so a keyboard
  // or screen-reader user had no indication anything happened. Same pattern
  // as the success effect above — focus the first field that actually failed
  // validation, in drawn field order, rather than a fixed field. `errors`
  // keys are a subset of `name`/`email`/`phone`/`message` (`actions.ts`).
  useEffect(() => {
    if (state.status !== "invalid" || !state.errors) {
      return;
    }
    if (state.errors.name) {
      nameRef.current?.focus();
    } else if (state.errors.email) {
      emailRef.current?.focus();
    } else if (state.errors.phone) {
      phoneRef.current?.focus();
    } else if (state.errors.message) {
      messageRef.current?.focus();
    } else {
      errorSummaryRef.current?.focus();
    }
  }, [state]);

  if (state.status === "success") {
    /* Authored state — see `quote-success.tsx` for why it has no artboard and
       why it lives in its own module. `role="status"` and `tabIndex={-1}` are
       passed only here, in the live form: the effect above focuses it. */
    return <QuoteSuccess ref={successRef} role="status" tabIndex={-1} />;
  }

  const values = state.status === "invalid" ? state.values : undefined;
  const errors = state.status === "invalid" ? state.errors : undefined;
  const selectedContact = values?.contact ?? DEFAULT_CONTACT_METHOD;
  const errorCount = errors ? Object.keys(errors).length : 0;

  return (
    <form action={formAction} data-probe="quote-form" className="flex flex-col gap-8">
      {/* Hidden: which product this inquiry is about. */}
      <input type="hidden" name={QUOTE_FIELD.slug} value={slug} />

      {/* Audit C2: the build had no live region anywhere, so a rejected
          submit was as silent to a screen reader as it was to a keyboard
          user (compounds C3 above). `role="alert"` is implicitly
          `aria-live="assertive"` and `aria-atomic="true"`, so mounting this
          node is itself the announcement — no extra ARIA needed, and it
          renders nothing at a count of 0. It lives in its own module so
          `/styleguide` can render the real component inert rather than a
          copy that drifts (the `QuoteSuccess` precedent). `tabIndex={-1}`
          lets the effect above focus it in the one-error-key-unknown
          fallback case without adding it to the tab order. */}
      <QuoteErrorSummary
        count={errorCount}
        role="alert"
        tabIndex={-1}
        ref={errorSummaryRef}
      />

      {/* Field grid. Desktop `grid-template-columns:1fr 1fr;gap:16px`, Full
          name `grid-column:1/3` (product-desktop.html:140). Mobile stack
          `gap:14px` (product-mobile.html:111). Each field's own label->box
          and box->error spacing comes from `FieldLabel`/`FieldError`
          (6px/8px, already the finder's measured rhythm); the grid gap here
          is field-to-field only. */}
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

      {/* Optional group. `border-top:1px solid var(--border-strong)`,
          padding-top 20px mobile (product-mobile.html:117) -> 24px desktop
          (product-desktop.html:145); group gap 14px mobile -> 16px desktop,
          same lines. */}
      <div className="border-border-strong flex flex-col gap-3.5 border-t pt-5 sm:gap-4 sm:pt-6">
        {/* `Optional` eyebrow: `font:500 10px/1;letter-spacing:.14em;uppercase;
            color:var(--text-dim)` mobile -> `11px` desktop, same lines. */}
        <span className="label text-ink-dim text-10 tracking-14 sm:text-11">Optional</span>

        {/* Quantity + Preferred contact. Desktop `1fr 2fr;gap:16px`
            (product-desktop.html:146); mobile stacked, same 14px group gap
            (product-mobile.html:117-118). */}
        <div className="flex flex-col gap-3.5 sm:grid sm:grid-cols-[1fr_2fr] sm:gap-4">
          <div>
            <FieldLabel htmlFor="quote-quantity">Quantity</FieldLabel>
            {/* Defaults to the buy panel's own selection (D50) unless a
                previous submit's echoed value overrides it. */}
            <Select
              id="quote-quantity"
              name={QUOTE_FIELD.quantity}
              defaultValue={values?.quantity ?? quantity}
            >
              {QUANTITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {quantityQuoteLabel(option.value, unit)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            {/* Visible caption matching the drawn `Preferred contact` label
                (product-desktop.html:146); the group's accessible name comes
                from the fieldset's own `<legend>` below, so this span is
                `aria-hidden` rather than double-announced. `FieldLabel` is not
                used here: it renders a real `<label htmlFor>`, which cannot
                correctly address a three-radio group. */}
            <span
              aria-hidden="true"
              className="label text-ink-muted mb-1.5 block text-11 tracking-12 sm:mb-2 sm:text-12"
            >
              Preferred contact
            </span>
            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className="sr-only">Preferred contact</legend>
              {/* Segmented control: `height:56px;grid-template-columns:1fr 1fr
                  1fr;border:1px solid var(--border-strong);border-radius:
                  var(--radius-ctl);overflow:hidden` desktop
                  (product-desktop.html:146) -> `52px` mobile
                  (product-mobile.html:118). Separators go BETWEEN segments
                  only: the export's `border-right` on every segment (including
                  the last) is an artefact and is not ported
                  (`src/features/product/llm.md` Don't). The input is a CHILD
                  of the label it styles, so the selected state is
                  `has-checked:`, not `peer-checked:`
                  (`src/components/ui/chip.tsx:148-160`). */}
              <div className="rounded-ctl border-border-strong grid h-13 grid-cols-3 overflow-hidden border sm:h-14">
                {CONTACT_METHODS.map((method, index) => (
                  <label
                    key={method.value}
                    className={cx(
                      // 14px/1, weight 500 — no tracking, no uppercase: the
                      // one control in the system that is neither
                      // (product-desktop.html:146).
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
        </div>

        <div>
          <FieldLabel htmlFor="quote-message">Message</FieldLabel>
          {/* Placeholder: the desktop string ships at every width — see the
              module's report note on why. Artboard copy, so the em dash and
              the ellipsis character stay (`.claude/rules/ui.md` "Copy": the
              em-dash ban is new copy only). */}
          <Textarea
            id="quote-message"
            name={QUOTE_FIELD.message}
            ref={messageRef}
            placeholder={placeholder}
            defaultValue={values?.message}
            invalid={Boolean(errors?.message)}
            aria-describedby={errors?.message ? "quote-message-error" : undefined}
          />
          {errors?.message ? (
            <FieldError id="quote-message-error">{errors.message}</FieldError>
          ) : null}
        </div>

        {/* CASL consent: renders unticked, always — `Checkbox` never accepts
            `checked`/`defaultChecked` from this call site (docs/decisions.md:118). */}
        <Checkbox id="quote-consent" name={QUOTE_FIELD.consent} variant="consent">
          {consent}
        </Checkbox>
      </div>

      {/* Submit. `fullWidth` + `sm:w-auto` is the `load`-size pattern
          documented in `src/components/ui/button.tsx`: a `sm:` variant always
          sorts after the unvariant `w-full`, so the override is reliable
          where a plain className swap is not. Rest state only — `--accent`
          fill, no translate; the artboard's `--accent-hover` +
          `translateY(1px)` is a hover/pressed demo, not the resting button
          (`src/features/product/llm.md` Don't). */}
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
