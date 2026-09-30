"use server";

/* ---------------------------------------------------------------------------
   signIn / signOut — the admin sign-in gate's Server Actions (D91).

   `signIn`'s signature matches `useActionState(signIn, LOGIN_INITIAL_STATE)`
   (`src/features/admin/components/login-form.tsx`) — the same
   `(prevState, formData) => Promise<State>` idiom `submitQuote`
   (`src/features/product/actions.ts`) established as the one form idiom in
   this repo. `AdminLoginState` / `LOGIN_FIELD` / `ADMIN_ROUTES` are the
   contract (`src/features/admin/types.ts`), written before this file (D25) —
   nothing here invents a field name or a status the type doesn't already
   carry.

   NO ARTBOARD DRAWS ANY OF THIS (D89) — there is no UI in this file, but the
   copy each state carries is authored the same way the UI is: from
   `.claude/rules/ui.md` "Copy" and "States the design doesn't show", not from
   a design export.

   Hardening lives in `session.ts` (D95, and the block at the top of that
   file): scrypt password hash, signed `__Host-` cookie, same-origin check and
   CSRF token, audit log lines. What is deliberately absent, by owner ruling:
   a failed-login limit ("lets not build limit failed login"), per-user
   accounts ("only one login account password works") and a second factor.
   --------------------------------------------------------------------------- */

import { redirect } from "next/navigation";

import {
  assertSameOriginRequest,
  endAdminSession,
  logAdminAuthEvent,
  requireAdminAction,
  startAdminSession,
  verifyAdminCredentials,
} from "@/features/admin/session";
import {
  ADMIN_ROUTES,
  LOGIN_FIELD,
  type AdminLoginState,
  type LoginFieldKey,
} from "@/features/admin/types";

function readTrimmed(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Unlike `readTrimmed`, this never trims. A trailing space in a password can
 * be a deliberate part of it, and silently stripping it before the credential
 * check would compare a different string than the one the visitor typed.
 */
function readRawPassword(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

export async function signIn(
  _prevState: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  // No session exists yet, so there is no CSRF token to check; the origin
  // check is what stops another site posting a login on the owner's behalf.
  await assertSameOriginRequest();

  const username = readTrimmed(formData, LOGIN_FIELD.username);
  const password = readRawPassword(formData, LOGIN_FIELD.password);

  const errors: Partial<Record<LoginFieldKey, string>> = {};

  if (username === "") {
    errors.username = "Enter the username.";
  }
  if (password === "") {
    errors.password = "Enter the password.";
  }

  if (Object.keys(errors).length > 0) {
    // Password is never echoed back — `values` carries only the username,
    // exactly as `AdminLoginState`'s `invalid` member is shaped
    // (`src/features/admin/types.ts`).
    return { status: "invalid", errors, values: { username } };
  }

  const result = await verifyAdminCredentials(username, password);

  if (result === "unavailable") {
    // The env vars are missing server-side — our misconfiguration, not the
    // visitor's mistake. Must never read as "wrong password" (`session.ts`).
    await logAdminAuthEvent("signin.unavailable");
    return { status: "unavailable" };
  }

  if (result === "rejected") {
    await logAdminAuthEvent("signin.rejected");
    return { status: "rejected", values: { username } };
  }

  // result === "ok"
  await startAdminSession();
  await logAdminAuthEvent("signin.ok");

  // `redirect()` throws by design — it is Next's control-flow signal for a
  // navigation, not an error. It must not be wrapped in a `try`/`catch`, and
  // nothing above this line can throw, so there is no broad `try` block here
  // to accidentally swallow it in.
  redirect(ADMIN_ROUTES.home);
}

export async function signOut(formData: FormData): Promise<void> {
  // A forged sign-out is a nuisance rather than a breach, but it is still a
  // state change another site should not be able to trigger.
  await requireAdminAction(formData);
  await endAdminSession();
  redirect(ADMIN_ROUTES.login);
}
