import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { FieldError, FieldLabel } from "@/components/ui/field-label";
import { Input } from "@/components/ui/input";
import { LoginErrorSummary } from "@/features/admin/components/login-error-summary";
import { PaymentLinkSuccess } from "@/features/admin/components/payment-link-success";
import { requireAdminSession } from "@/features/admin/session";

/* ---------------------------------------------------------------------------
   /admin/styleguide — the admin's reference page (D93)

   `.claude/rules/ui.md` "States the design doesn't show" requires every
   authored state to land on a reference page at the same level of finish as
   the happy path. The storefront's `/styleguide` is a public URL, and these
   are staff-facing states, so the owner ruled a second page rather than one
   shared one (D93). This one sits behind the same gate as the rest of `/admin`.

   **Every component here is the real one, rendered inert.** Nothing on this
   page is a copy — a copy drifts from the component it documents, which is the
   whole reason `QuoteSuccess` and `QuoteErrorSummary` were extracted to their
   own modules on the storefront. `role` and `tabIndex` are omitted on purpose:
   a live `role="alert"` or `role="status"` on a reference page announces
   itself on load, to a screen-reader user who asked for a reference page and
   not an alert.

   The one exception is `CopyLinkButton`, nested inside `PaymentLinkSuccess`:
   it is a real client island with its own internal state, so it is live here.
   That is harmless — it copies a sample URL — and its three states cannot be
   shown side by side without duplicating it, which the rule above forbids.

   NO ARTBOARD DRAWS ANY OF THIS (D89).
   --------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Admin styleguide",
};

/** Sample values. Obviously fake, never real customer data — the storefront's
 *  own rule against shipping the artboards' `Priya Sandhu` placeholder
 *  (`docs/decisions.md` §8) applies to reference pages too. */
const SAMPLE_URL = "https://pay.platinumwheels.ca/pay/q3Zk9mB2xV7tLpR4nW8sYA";
const SAMPLE_AMOUNT = "452.60";
const SAMPLE_DESCRIPTION = "4x Zeta Antarctica Sport 215/55R16 with install";

function Block({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="border-border-strong border-t pt-8 sm:pt-12">
      <h2 className="display text-ink text-display-24 sm:text-display-28">{title}</h2>
      <p className="text-ink-muted mt-2 max-w-measure text-14 leading-body sm:text-15">
        {note}
      </p>
      <div className="mt-6 flex flex-col gap-8 sm:mt-8">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="label text-ink-dim text-10 tracking-14 sm:text-11">{label}</span>
      {children}
    </div>
  );
}

export default async function AdminStyleguidePage() {
  await requireAdminSession();

  return (
    <main
      id="main"
      tabIndex={-1}
      className="w-full px-4 pt-10 pb-20 sm:px-8 sm:pt-14 sm:pb-30 md:px-12 lg:mx-auto lg:max-w-content"
    >
      <h1 className="display text-ink text-display-40 sm:text-display-56">
        Admin styleguide
      </h1>
      <p className="text-ink-muted mt-3 max-w-measure text-15 leading-body sm:text-16">
        Every state the admin can show that no design draws. Components are
        rendered here exactly as they ship, with their live announcements
        turned off.
      </p>

      <div className="mt-12 flex flex-col gap-12 sm:mt-16 sm:gap-16">
        <Block
          id="sg-admin-signin"
          title="Sign in"
          note="Three failure modes. A wrong credential and a missing server configuration are form-level and go to the summary; an empty field is a field failure and goes under the box."
        >
          <Row label="Form error · wrong credential">
            <LoginErrorSummary message="Wrong username or password. Check both and try again." />
          </Row>

          <Row label="Form error · not configured">
            <LoginErrorSummary message="Sign in is not available yet. The admin credentials have not been configured for this deployment." />
          </Row>

          <Row label="Field error · empty field">
            <div className="max-w-measure">
              <FieldLabel htmlFor="sg-admin-username" required>
                Username
              </FieldLabel>
              <Input
                id="sg-admin-username"
                name="sg-admin-username"
                type="text"
                invalid
                aria-describedby="sg-admin-username-error"
                readOnly
              />
              <FieldError id="sg-admin-username-error">Enter the username.</FieldError>
            </div>
          </Row>

          <Row label="Submit · resting and pending">
            <div className="flex max-w-measure flex-col gap-3">
              <Button type="button" variant="primary" size="panel" fullWidth>
                Sign in
              </Button>
              {/* The real pending state is `disabled` while the action runs. */}
              <Button type="button" variant="primary" size="panel" fullWidth disabled>
                Signing in…
              </Button>
            </div>
          </Row>
        </Block>

        <Block
          id="sg-admin-payment-link"
          title="Payment link"
          note="The success panel is the real component. Its test-mode notice shows while the gateway is the demo account, so a demo link is never mistaken for a live one."
        >
          <Row label="Success panel">
            <div className="max-w-measure">
              <PaymentLinkSuccess
                url={SAMPLE_URL}
                reference="PW-10001"
                amount={SAMPLE_AMOUNT}
                description={SAMPLE_DESCRIPTION}
                expiresLabel="Oct 1, 2026, 2:30 p.m."
                testMode
              />
            </div>
          </Row>

          <Row label="Amount field · error">
            <div className="max-w-measure">
              <FieldLabel htmlFor="sg-payment-amount" required>
                Amount (CAD)
              </FieldLabel>
              {/* The `$` / `CAD` adornments are reproduced here rather than
                  extracted, because they belong to that one field in
                  `payment-link-form.tsx` and are not a shared component. If a
                  second money field is ever added, extract them and render the
                  real thing here instead. */}
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="text-ink-dim font-sans text-16 leading-flat pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-bold sm:left-4 sm:text-17"
                >
                  $
                </span>
                <Input
                  id="sg-payment-amount"
                  name="sg-payment-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="pr-14 pl-7 sm:pr-16 sm:pl-8"
                  invalid
                  aria-describedby="sg-payment-amount-error"
                  readOnly
                />
                <span
                  aria-hidden="true"
                  className="label text-ink-dim text-11 tracking-12 pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 sm:right-4"
                >
                  CAD
                </span>
              </div>
              <FieldError id="sg-payment-amount-error">
                Use at most two decimal places.
              </FieldError>
            </div>
          </Row>
        </Block>
      </div>
    </main>
  );
}
