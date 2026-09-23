import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_ROUTES } from "./types";

/* No `import "server-only"` here: that package is not a dependency of this
   repo and is absent from `package-lock.json` (only `client-only` is present,
   as a Next transitive), so importing it would fail to resolve at build time.
   `next/headers` and `node:crypto` are themselves server-only — importing this
   module from a client component is already a build error — so the guard would
   be belt-and-braces rather than load-bearing. Do not add the import without
   adding the dependency. */

/* ---------------------------------------------------------------------------
   Admin session — the stub gate (D91)

   ⚠️  THIS IS NOT AUTHENTICATION. It is a placeholder so the login flow can be
   walked end to end on a preview deployment and demonstrated to the client.
   It is deliberately the smallest thing that gates a route, and it must be
   replaced before `admin.platinumwheels.ca` is public.

   What it does NOT have, and what real auth must add:
     - no password hashing at rest (the credential is a plaintext env var)
     - no per-user accounts, no roles, no audit trail
     - no rate limiting or lockout (the owner declined that state this session)
     - no session rotation, revocation, expiry-on-server or CSRF token
     - the cookie is a constant, not a signed or encrypted token, so anyone who
       learns its value can set it by hand

   The gate is enforced per route, in the page, because `proxy.ts` is deferred
   (D90). Every admin page must call `requireAdminSession()` before rendering.

   Owner ruling, this session: stub gate, one credential, real auth a loud TODO.
   --------------------------------------------------------------------------- */

/** Cookie name. `pw_` prefix so it cannot collide with anything the storefront
 *  sets on the shared apex domain once the subdomain rewrite lands. */
const SESSION_COOKIE = "pw_admin_session";

/** Opaque constant. It is not a token and carries no identity — see the
 *  warning above. Its only job is to be present or absent. */
const SESSION_VALUE = "1";

/** One working day. Short on purpose: a shared credential on a public
 *  subdomain should not leave a session open for weeks on a device that gets
 *  left on a counter. */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export type CredentialCheck = "ok" | "rejected" | "unavailable";

/**
 * Constant-time comparison of two strings.
 *
 * `timingSafeEqual` requires equal-length buffers and throws otherwise, which
 * would itself leak length. Hashing both sides first gives two fixed-width
 * 32-byte digests, so the comparison is uniform regardless of input length.
 */
function safeEqual(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a, "utf8").digest();
  const digestB = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(digestA, digestB);
}

/**
 * Checks a submitted credential against the environment.
 *
 * Returns `"unavailable"` rather than `"rejected"` when the env vars are
 * missing, so a misconfigured deployment reports our mistake instead of
 * telling the owner his password is wrong. Never throws: a thrown error here
 * would surface as a generic 500 on the login page.
 *
 * Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in the Vercel project. They are
 * not committed — `.gitignore` excludes every `.env*`.
 */
export function verifyAdminCredentials(
  username: string,
  password: string,
): CredentialCheck {
  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    return "unavailable";
  }

  // Both comparisons always run — no `&&` short-circuit — so the time taken
  // does not reveal whether the username alone was correct.
  const usernameOk = safeEqual(username, expectedUsername);
  const passwordOk = safeEqual(password, expectedPassword);

  return usernameOk && passwordOk ? "ok" : "rejected";
}

/** Opens a session. Callable only from a Server Action or Route Handler —
 *  Next forbids mutating cookies while rendering. */
export async function startAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, SESSION_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    // Vercel serves every deployment over HTTPS, preview included. Left
    // unconditional so a stray HTTP context cannot downgrade it.
    secure: true,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Ends a session. Same call-site restriction as `startAdminSession`. */
export async function endAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Whether a session cookie is present. Safe to call while rendering. */
export async function hasAdminSession(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value === SESSION_VALUE;
}

/**
 * The gate every admin page calls first.
 *
 * Because `proxy.ts` is deferred (D90) there is no single choke point, so this
 * must be the first statement of every protected page's component body. A page
 * that forgets it is simply unprotected — there is nothing else to catch it.
 * When the rewrite lands, this stays: a host rule is routing, not authorisation.
 */
export async function requireAdminSession(): Promise<void> {
  if (!(await hasAdminSession())) {
    redirect(ADMIN_ROUTES.login);
  }
}
