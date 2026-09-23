"use client";

/* ---------------------------------------------------------------------------
   LoginForm — the `/admin/login` page's one client island (D91).

   Same `useActionState` + focus-management shape as `QuoteForm`
   (`src/features/product/components/quote-form.tsx`), the sign-in form's
   direct precedent: `useActionState(signIn, LOGIN_INITIAL_STATE)`,
   `FieldLabel`/`Input`/`FieldError` for each field, and an effect that moves
   focus to whatever the submit actually changed, so a keyboard or
   screen-reader user is never left on a `<body>` that gave no sign anything
   happened (the same audit finding `quote-form.tsx` cites as C3).

   NO ARTBOARD DRAWS ANY OF THIS (D89) — the `design/` export covers three
   storefront routes and nothing else, so the admin has no authority-level-2
   source. Every box, gap and type value below is an existing token or an
   existing primitive, reused rather than measured, per `.claude/rules/ui.md`
   "States the design doesn't show".

   Fields, in drawn order: Username, then Password (D91 — one shared
   credential, not per-user accounts, hence "username" rather than "email").
   Both are `required`. `Input` does not default `autoComplete` for
   `type="text"` or `type="password"` (`src/components/ui/input.tsx`'s
   `INPUT_TYPE_DEFAULTS` has no entry for either), so both are passed
   explicitly here.

   `values.username` is echoed as `defaultValue` on both the `invalid` and
   `rejected` states, so a failed attempt does not blank a field the visitor
   already typed correctly. The password field never receives a
   `defaultValue` — per `AdminLoginState` (`src/features/admin/types.ts`) the
   password is never sent back to the client in any state, so there is
   nothing to echo, and it is always blank on re-render.

   Focus management mirrors `QuoteForm`'s own effect: on `invalid`, focus the
   first failing field in drawn order (username, then password); on
   `rejected` or `unavailable` — a form-level failure that belongs to neither
   box — focus the error summary instead, the same fallback `QuoteForm` uses
   when no error key maps to a field.
   --------------------------------------------------------------------------- */

import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { FieldError, FieldLabel } from "@/components/ui/field-label";
import { Input } from "@/components/ui/input";
import { signIn } from "@/features/admin/auth-actions";
import { LOGIN_FIELD, LOGIN_INITIAL_STATE } from "@/features/admin/types";
import { LoginErrorSummary } from "./login-error-summary";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signIn, LOGIN_INITIAL_STATE);
  const errorSummaryRef = useRef<HTMLParagraphElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Same pattern as QuoteForm's own effect (quote-form.tsx): focus the first
  // field that actually failed, in drawn order, and fall back to the summary
  // for a form-level failure that points at no single field.
  useEffect(() => {
    if (state.status === "invalid") {
      if (state.errors.username) {
        usernameRef.current?.focus();
      } else if (state.errors.password) {
        passwordRef.current?.focus();
      } else {
        errorSummaryRef.current?.focus();
      }
    } else if (state.status === "rejected" || state.status === "unavailable") {
      errorSummaryRef.current?.focus();
    }
  }, [state]);

  const values =
    state.status === "invalid" || state.status === "rejected" ? state.values : undefined;
  const errors = state.status === "invalid" ? state.errors : undefined;

  const message =
    state.status === "rejected"
      ? "Wrong username or password. Check both and try again."
      : state.status === "unavailable"
        ? "Sign in is not available yet. The admin credentials have not been configured for this deployment."
        : "";

  return (
    <form action={formAction} data-probe="admin-login-form" className="flex flex-col gap-8">
      {/* `invalid` renders nothing here (`message` is "") — its two per-field
          `FieldError`s below carry the whole failure. See the module comment
          on `LoginErrorSummary` for why this takes a message, not a count. */}
      <LoginErrorSummary message={message} role="alert" tabIndex={-1} ref={errorSummaryRef} />

      <div className="flex flex-col gap-3.5 sm:gap-4">
        <div>
          <FieldLabel htmlFor="admin-username" required>
            Username
          </FieldLabel>
          <Input
            id="admin-username"
            name={LOGIN_FIELD.username}
            type="text"
            autoComplete="username"
            // A username is not prose. Without this the UA spellchecker
            // red-underlines it — the bug D66 fixed on the storefront's fields.
            spellCheck={false}
            required
            ref={usernameRef}
            defaultValue={values?.username}
            invalid={Boolean(errors?.username)}
            aria-describedby={errors?.username ? "admin-username-error" : undefined}
          />
          {errors?.username ? (
            <FieldError id="admin-username-error">{errors.username}</FieldError>
          ) : null}
        </div>

        <div>
          <FieldLabel htmlFor="admin-password" required>
            Password
          </FieldLabel>
          <Input
            id="admin-password"
            name={LOGIN_FIELD.password}
            type="password"
            autoComplete="current-password"
            required
            ref={passwordRef}
            // No `defaultValue` — the password is never echoed back, in any
            // state (see the module comment).
            invalid={Boolean(errors?.password)}
            aria-describedby={errors?.password ? "admin-password-error" : undefined}
          />
          {errors?.password ? (
            <FieldError id="admin-password-error">{errors.password}</FieldError>
          ) : null}
        </div>
      </div>

      {/* No `→` arrow — that is a storefront CTA flourish
          (`quote-form.tsx`'s "Send inquiry →"), not an admin control. */}
      <Button type="submit" variant="primary" size="panel" fullWidth disabled={isPending}>
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
