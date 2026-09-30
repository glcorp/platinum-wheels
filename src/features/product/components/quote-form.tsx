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

import { useActionState, useEffect, useRef, useState, useTransition } from "react";

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
  type QuoteFormState,
} from "@/features/product/types";
import { cx } from "@/lib/cx";
import { QuoteErrorSummary } from "./quote-error-summary";
import { QuoteSuccess } from "./quote-success";

/** Browser `maxLength` per field (D91b WDG-12, owner ruling 2026-09-30). These
 *  mirror the caps `actions.ts` enforces server-side; that file is `"use
 *  server"` and can only export async functions, so the numbers live in both
 *  places and `tests/e2e/product.spec.ts` pins them together. The browser stops
 *  the typing; the server is still the validator (`noValidate`, D65). */
const MAX_LENGTH = { name: 100, email: 254, phone: 32, message: 1000 } as const;

/** New copy (owner-approved 2026-09-30, D93b ENV-1): shown when the send itself
 *  fails, e.g. offline. Plain, no blame, says what to do. */
const SEND_FAILED = "We couldn't send that. Check your connection and try again.";

/** The state shown when the send itself fails (offline, dropped connection).
 *  A Server Action call that never reaches the server throws inside React's
 *  transition and, uncaught, lands in the route error boundary: the form is
 *  gone and so is everything the visitor typed. So, with JS on, `onSubmit`
 *  below runs `submitQuote` itself inside a try/catch and, on failure, shows
 *  an `invalid` state that echoes every field (the same `values` path a
 *  validation error uses) plus a `notice`. The form is untouched, so Send works
 *  again the moment the network does.
 *
 *  The form's `action` stays `useActionState(submitQuote)`'s own `formAction`,
 *  NOT a client wrapper: a client function is not a Server Action reference, so
 *  wrapping it would strip the no-JS POST (D44/D51). React skips its action
 *  when `onSubmit` calls `preventDefault`, so with JS only the guarded path
 *  runs, and without JS only the native POST does (D93b, ENV-1). */
function failedSendState(formData: FormData): QuoteFormState {
  const values: Partial<Record<(typeof QUOTE_FIELD)[keyof typeof QUOTE_FIELD], string>> = {};
  for (const field of Object.values(QUOTE_FIELD)) {
    const value = formData.get(field);
    if (typeof value === "string") values[field] = value;
  }
  return { status: "invalid", errors: {}, values, notice: SEND_FAILED };
}

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
  const [serverState, formAction, actionPending] = useActionState(
    submitQuote,
    QUOTE_INITIAL_STATE,
  );
  // Result of the JS-only guarded submit (see `failedSendState`); wins over the
  // action's own state once set, which only ever happens with JS on.
  const [guardedState, setGuardedState] = useState<QuoteFormState | null>(null);
  const [guardedPending, startGuarded] = useTransition();
  const state = guardedState ?? serverState;
  const isPending = actionPending || guardedPending;
  const successRef = useRef<HTMLDivElement>(null);
  const errorSummaryRef = useRef<HTMLParagraphElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const customQuantityRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  // Computed ahead of the `success` early return below so the hooks that
  // follow — the invalid-focus effect and the Custom-quantity field's own
  // state — stay unconditional, per the rules of hooks.
  const values = state.status === "invalid" ? state.values : undefined;

  // Which cell the Quantity select currently shows — also its own controlled
  // `value` below, so a `?qty=` cell click and an invalid-resubmit echo both
  // land on the right option and the Custom field mounts/unmounts in step.
  //
  // A `?qty=` cell click changes `quantity` but does NOT remount this island:
  // Next keeps the same client-component instance across a same-route
  // search-param navigation (verified live — typed field values and this
  // component's own state both survive it). An uncontrolled select only reads
  // `defaultValue` at mount, so it went stale after the first `?qty=` change.
  // Resynced here during render — React's documented "adjusting state when a
  // prop changes" pattern (not an Effect: a `setState` in an Effect body would
  // commit the stale value first and fix it a tick later; this corrects it
  // before that first paint).
  //
  // Synced from the `quantity` PROP only (D91b, WDG-04). It used to track
  // `values?.quantity ?? quantity`, and the invalid-submit echo then shadowed
  // the prop for as long as the error state lived — one rejected submit and
  // the select stopped following the cells (the D84 symptom again). The echo
  // is only a seed: it is the select's own submitted value, which this
  // controlled select still holds after an in-place submit.
  const [selectedQuantity, setSelectedQuantity] = useState<string>(
    values?.quantity ?? quantity,
  );
  const [syncedQuantity, setSyncedQuantity] = useState(quantity);
  if (quantity !== syncedQuantity) {
    setSyncedQuantity(quantity);
    setSelectedQuantity(quantity);
  }

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
  // keys are a subset of `name`/`email`/`phone`/`customQuantity`/`message`
  // (`actions.ts`).
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
    } else if (state.errors.customQuantity) {
      customQuantityRef.current?.focus();
    } else if (state.errors.message) {
      messageRef.current?.focus();
    } else {
      errorSummaryRef.current?.focus();
    }
  }, [state]);

  /* The quantity cells above this form are `?qty=` links (D50), so tapping one
     is a real navigation and it silently emptied every field the user had
     typed — verified live: name, email and message all came back blank. The
     owner ruled for a `beforeunload` guard over changing D50's URL-param
     mechanism. Armed on first input, disarmed on success so the confirmation
     never warns. Craft audit P1 #1. */
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (state.status === "success") dirtyRef.current = false;

    /* D91b, HPD-2: Blink and Gecko dispatch `beforeunload` for an
       external-protocol navigation (`tel:`, `mailto:`) although nothing
       unloads — so tapping `Call us`, the page's other way to ask for a
       quote, raised "Leave site?" over a half-typed form. A capture-phase
       click on any non-http(s) link sets a one-shot flag: the next
       `beforeunload` consumes it, and a short timer drops it if none comes
       (WebKit dispatches none). Not cleared on the next task: Gecko fires
       the event later than that (a 0ms clear still prompted in Firefox,
       measured). A real unload after that window still warns. */
    let externalProtocolClick = false;
    let clearTimer: number | undefined;
    function onClickCapture(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.protocol === "http:" || anchor.protocol === "https:") return;
      externalProtocolClick = true;
      window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => {
        externalProtocolClick = false;
      }, 1000);
    }
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (externalProtocolClick) {
        externalProtocolClick = false;
        return;
      }
      if (!dirtyRef.current) return;
      event.preventDefault();
    }
    document.addEventListener("click", onClickCapture, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.clearTimeout(clearTimer);
    };
  }, [state.status]);

  if (state.status === "success") {
    /* Authored state — see `quote-success.tsx` for why it has no artboard and
       why it lives in its own module. `role="status"` and `tabIndex={-1}` are
       passed only here, in the live form: the effect above focuses it. */
    return <QuoteSuccess ref={successRef} role="status" tabIndex={-1} />;
  }

  const errors = state.status === "invalid" ? state.errors : undefined;
  const selectedContact = values?.contact ?? DEFAULT_CONTACT_METHOD;
  const errorCount = errors ? Object.keys(errors).length : 0;

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startGuarded(async () => {
          try {
            setGuardedState(await submitQuote(state, formData));
          } catch {
            setGuardedState(failedSendState(formData));
          }
        });
      }}
      data-probe="quote-form"
      /* `noValidate` so the authored validation is the one users actually meet.
         With native constraint validation on, the browser's own bubble fired
         first on the commonest failure (an empty required field) and the
         Server Action never ran — which made the `role="alert"` summary (audit
         C2) and the focus-first-invalid effect (C3) unreachable on that path.
         `required` stays on the fields for semantics and AT; `actions.ts` was
         already the real validator and its messages are specific
         ("Enter a 10-digit Canadian phone number."). Craft audit P1 #3. */
      noValidate
      onInput={() => {
        dirtyRef.current = true;
      }}
      className="flex flex-col gap-8"
    >
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
        message={state.status === "invalid" ? state.notice : undefined}
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
            {/* Controlled by `selectedQuantity` (above): defaults to the buy
                panel's own selection (D50) unless a previous submit's echoed
                value overrides it, and stays in sync across a `?qty=` nav —
                see the render-time resync above for why `defaultValue` alone
                was not enough. */}
            <Select
              id="quote-quantity"
              name={QUOTE_FIELD.quantity}
              value={selectedQuantity}
              onChange={(event) => setSelectedQuantity(event.target.value)}
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

        {/* Custom quantity — the field `?qty=custom` promised and never had
            (D50 Open #6). Server-rendered whenever the Quantity select reads
            `custom`, in the Optional group's own drawn order: no new box on
            a page that never draws one, no new island. Blank is legal — the
            group's own eyebrow says `Optional`, so a required field here
            would contradict drawn copy (`actions.ts`). New copy under
            `.claude/rules/ui.md` "Copy": short, specific, names the unit.
            `enter-rise` (D92b): the field arrives after a `Custom` click
            rather than popping in — `@starting-style`, no JS, and a server
            render with no transition simply shows it. It only wraps the
            field; the controlled select above (D84) is untouched. */}
        {selectedQuantity === "custom" ? (
          <div className="enter-rise">
            <FieldLabel htmlFor="quote-custom-quantity">
              {`How many ${unit.many}?`}
            </FieldLabel>
            <Input
              id="quote-custom-quantity"
              name={QUOTE_FIELD.customQuantity}
              /* `text` + `inputMode="numeric"`, not `type="number"` (D91b,
                 HPD-3/WDG-11): a number field holding `abc` reports `badInput`
                 and serialises as "", so Firefox submitted the visible text as
                 a legal blank. As text, the server sees what was typed and
                 answers with the D75 message. `pattern` is affordance only —
                 the form is `noValidate`; `actions.ts` is the validator. */
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              ref={customQuantityRef}
              defaultValue={values?.customQuantity}
              invalid={Boolean(errors?.customQuantity)}
              aria-describedby={
                errors?.customQuantity ? "quote-custom-quantity-error" : undefined
              }
            />
            {errors?.customQuantity ? (
              <FieldError id="quote-custom-quantity-error">
                {errors.customQuantity}
              </FieldError>
            ) : null}
          </div>
        ) : null}

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
            maxLength={MAX_LENGTH.message}
            defaultValue={values?.message}
            invalid={Boolean(errors?.message)}
            aria-describedby={errors?.message ? "quote-message-error" : undefined}
          />
          {errors?.message ? (
            <FieldError id="quote-message-error">{errors.message}</FieldError>
          ) : null}
        </div>

        {/* CASL consent (docs/decisions.md:118): a fresh form ALWAYS renders
            unticked. `restoreChecked` is set from the echo of a rejected
            submit only (`values` is undefined on idle and success), and that
            echo carries the visitor's own tick and nothing else — React resets
            an uncontrolled form after an action, so without it an unrelated
            field error silently unticked their consent (WDG-10, owner ruling
            2026-09-30). */}
        <Checkbox
          id="quote-consent"
          name={QUOTE_FIELD.consent}
          variant="consent"
          restoreChecked={Boolean(values?.[QUOTE_FIELD.consent])}
        >
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
