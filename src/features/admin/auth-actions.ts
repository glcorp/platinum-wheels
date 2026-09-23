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

   ⚠️  TODO(auth) — `verifyAdminCredentials` (`src/features/admin/session.ts`)
   is a STUB GATE, not authentication (D91, and the loud warning at the top of
   `session.ts`). Before `admin.platinumwheels.ca` is public, real auth must
   replace it and add everything this stub is missing:
     - password hashing at rest — today the credential is a plaintext
       `ADMIN_PASSWORD` env var, compared in `session.ts`'s `safeEqual`
     - per-user accounts and roles — today it is one shared username/password
       for the whole shop, with no identity behind either
     - rate limiting / lockout on repeated failed attempts — the owner
       declined this state this session (`llm.md` Open #6), and a shared
       credential on a public subdomain is exactly the case brute-forcing
       suits
     - session rotation and server-side revocation — today the session cookie
       is a constant (`SESSION_VALUE = "1"`, `session.ts`) that never changes
       per sign-in and cannot be revoked individually, only cleared entirely
     - a CSRF token — today there is none; the gate relies entirely on the
       cookie's own `sameSite: "lax"` (`session.ts`)
   Do not treat this file as a model for how the real gate should validate a
   credential. It exists only so the sign-in flow can be walked end to end and
   demonstrated on a preview deployment before real auth is built.
   --------------------------------------------------------------------------- */

import { redirect } from "next/navigation";

import {
  endAdminSession,
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

  const result = verifyAdminCredentials(username, password);

  if (result === "unavailable") {
    // The env vars are missing server-side — our misconfiguration, not the
    // visitor's mistake. Must never read as "wrong password" (`session.ts`).
    return { status: "unavailable" };
  }

  if (result === "rejected") {
    return { status: "rejected", values: { username } };
  }

  // result === "ok"
  await startAdminSession();

  // `redirect()` throws by design — it is Next's control-flow signal for a
  // navigation, not an error. It must not be wrapped in a `try`/`catch`, and
  // nothing above this line can throw, so there is no broad `try` block here
  // to accidentally swallow it in.
  redirect(ADMIN_ROUTES.home);
}

export async function signOut(): Promise<void> {
  await endAdminSession();
  redirect(ADMIN_ROUTES.login);
}
