import {
  createHash,
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_CSRF_FIELD, ADMIN_ROUTES, type AdminSession } from "./types";

/* No `import "server-only"` here: that package is not a dependency of this
   repo and is absent from `package-lock.json` (only `client-only` is present,
   as a Next transitive), so importing it would fail to resolve at build time.
   `next/headers` and `node:crypto` are themselves server-only — importing this
   module from a client component is already a build error — so the guard would
   be belt-and-braces rather than load-bearing. Do not add the import without
   adding the dependency. */

/* ---------------------------------------------------------------------------
   Admin session — one shared account, hardened (D91, D95)

   One username and password for the whole shop, by owner ruling: "dont need
   this only one login account password works" (D95). Everything here is sized
   for that, and for nothing more.

   What it does:
     - Password at rest: `ADMIN_PASSWORD_HASH` (scrypt, made by
       `scripts/hash-admin-password.mjs`) is checked in preference to the
       plaintext `ADMIN_PASSWORD`, which still works so the switch can happen
       without a lockout, and logs a warning while it is in use.
     - Session: the cookie is `v1.<expiresAtMs>.<nonce>.<hmac>`, never a
       constant (until 2026-09-23 it was the literal "1", and anyone could set
       it by hand). The expiry is checked here, on the server; the cookie's
       `maxAge` is only a hint to the browser. `__Host-` pins it to this exact
       host over HTTPS, and `SameSite=Strict` keeps it off every cross-site
       request.
     - Revocation: the signing key is derived from `ADMIN_SESSION_SECRET` AND
       the configured credential, so changing the password (or rotating the
       secret) signs every session out at once.
     - CSRF: every admin Server Action checks the request is same-origin
       (`Origin` + `Sec-Fetch-Site`), on top of Next's own Origin/Host check,
       and every signed-in form also carries a session-bound token
       (`ADMIN_CSRF_FIELD`) that `requireAdminAction()` verifies.
     - Audit: sign-ins and rejected requests are logged with the client IP.

   What it deliberately does NOT do, by owner ruling (D95):
     - no failed-login limit or lockout — "lets not build limit failed login".
       scrypt's cost (~50ms per attempt) is the only brake on guessing.
     - no per-user accounts and no second factor.
     - no per-session revocation; the two levers above sign everyone out.

   The gate is enforced per page AND per action. A page calls
   `requireAdminSession()` first; a Server Action calls `requireAdminAction()`
   first, because an action is a public POST endpoint whether or not the page
   that renders its form is gated (Next's data-security guide: "Always verify
   authentication and authorization inside each Server Function").
   --------------------------------------------------------------------------- */

/** `__Host-` makes the browser refuse the cookie unless it is `Secure`,
 *  `Path=/` and carries no `Domain`, so nothing on a sibling subdomain can set
 *  or read it. */
const SESSION_COOKIE = "__Host-pw_admin_session";

/** Token format version, signed along with the rest so an old-format cookie
 *  can never verify against a future format. */
const SESSION_TOKEN_VERSION = "v1";

/** Shortest `ADMIN_SESSION_SECRET` accepted. An HMAC key is only as strong as
 *  its entropy, and `openssl rand -base64 32` yields 44 characters, so 32 is a
 *  floor a generated secret clears and a typed-in word does not. */
const SESSION_SECRET_MIN_LENGTH = 32;

/** One working day. Short on purpose: a shared credential should not leave a
 *  session open for weeks on a device that gets left on a counter. */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

/** Largest scrypt cost accepted from `ADMIN_PASSWORD_HASH`. The script writes
 *  2^15; the cap stops a mistyped value from asking for gigabytes of memory on
 *  every sign-in. */
const SCRYPT_MAX_COST = 2 ** 17;

export type CredentialCheck = "ok" | "rejected" | "unavailable";

interface PasswordHash {
  cost: number;
  blockSize: number;
  parallelization: number;
  salt: Buffer;
  hash: Buffer;
}

interface CredentialConfig {
  username: string;
  /** Set when `ADMIN_PASSWORD_HASH` is. Takes precedence over `plaintext`. */
  passwordHash: PasswordHash | null;
  plaintext: string | null;
  /** HMAC key for session tokens and CSRF tokens. Derived from the secret and
   *  the credential, so changing either invalidates every session. */
  sessionKey: Buffer;
}

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
 * Parses `scrypt:<cost>:<blockSize>:<parallelization>:<salt>:<hash>`, salt
 * and hash base64url — the format `scripts/hash-admin-password.mjs` prints.
 * Colons, not the usual `$`, because Next's `.env` loader expands `$…`.
 */
function parsePasswordHash(raw: string): PasswordHash | null {
  const parts = raw.trim().split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return null;
  }
  const [cost, blockSize, parallelization] = parts.slice(1, 4).map(Number);
  const salt = Buffer.from(parts[4], "base64url");
  const hash = Buffer.from(parts[5], "base64url");
  const isPowerOfTwo = Number.isInteger(cost) && cost > 1 && (cost & (cost - 1)) === 0;
  if (
    !isPowerOfTwo ||
    cost > SCRYPT_MAX_COST ||
    !Number.isInteger(blockSize) ||
    blockSize < 1 ||
    !Number.isInteger(parallelization) ||
    parallelization < 1 ||
    salt.length < 16 ||
    hash.length < 32
  ) {
    return null;
  }
  return { cost, blockSize, parallelization, salt, hash };
}

/**
 * Reads the credential config from the environment, or `null` when the gate
 * cannot run. A malformed `ADMIN_PASSWORD_HASH` is `null` too — it never falls
 * back to the plaintext variable, which would silently undo the switch.
 *
 * Set in the Vercel project, never committed (`.gitignore` excludes `.env*`):
 * `ADMIN_USERNAME`, `ADMIN_SESSION_SECRET` (32+ characters,
 * `openssl rand -base64 32`), and `ADMIN_PASSWORD_HASH` or, until that is set,
 * `ADMIN_PASSWORD`.
 */
function readCredentialConfig(): CredentialConfig | null {
  const username = process.env.ADMIN_USERNAME;
  const secret = process.env.ADMIN_SESSION_SECRET;
  const rawHash = process.env.ADMIN_PASSWORD_HASH;
  const plaintext = process.env.ADMIN_PASSWORD || null;

  if (!username || !secret || secret.length < SESSION_SECRET_MIN_LENGTH) {
    return null;
  }

  let passwordHash: PasswordHash | null = null;
  if (rawHash) {
    passwordHash = parsePasswordHash(rawHash);
    if (!passwordHash) {
      console.error(
        JSON.stringify({ event: "admin.config.invalid", reason: "ADMIN_PASSWORD_HASH is malformed" }),
      );
      return null;
    }
  } else if (!plaintext) {
    return null;
  }

  const credentialFingerprint = createHash("sha256")
    .update(`${username}\n${rawHash ? rawHash.trim() : `plain:${plaintext}`}`, "utf8")
    .digest("hex");
  const sessionKey = createHmac("sha256", secret)
    .update(`pw-admin-session|${credentialFingerprint}`, "utf8")
    .digest();

  return { username, passwordHash, plaintext, sessionKey };
}

function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

async function passwordMatches(password: string, config: CredentialConfig): Promise<boolean> {
  if (config.passwordHash) {
    const { cost, blockSize, parallelization, salt, hash } = config.passwordHash;
    const derived = await scryptAsync(password, salt, hash.length, {
      N: cost,
      r: blockSize,
      p: parallelization,
      // scrypt needs 128 * N * r bytes; the default 32 MiB ceiling is exactly
      // the script's own cost, so leave headroom.
      maxmem: 256 * cost * blockSize,
    });
    return timingSafeEqual(derived, hash);
  }
  warnPlaintextPasswordOnce();
  return safeEqual(password, config.plaintext ?? "");
}

let plaintextWarningLogged = false;

function warnPlaintextPasswordOnce(): void {
  if (plaintextWarningLogged) {
    return;
  }
  plaintextWarningLogged = true;
  console.warn(
    JSON.stringify({
      event: "admin.config.plaintext_password",
      fix: "Set ADMIN_PASSWORD_HASH (npm run admin:hash-password) and delete ADMIN_PASSWORD",
    }),
  );
}

function sign(payload: string, key: Buffer): string {
  return createHmac("sha256", key).update(payload, "utf8").digest("base64url");
}

/** `v1.<expiresAtMs>.<nonce>.<signature>`. The nonce makes every sign-in a
 *  distinct token, and the CSRF token is derived from it. */
function issueSessionToken(key: Buffer): string {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const nonce = randomBytes(16).toString("base64url");
  const payload = `${SESSION_TOKEN_VERSION}.${expiresAt}.${nonce}`;
  return `${payload}.${sign(payload, key)}`;
}

/** The token's nonce if this server signed it and it has not expired;
 *  otherwise `null`. */
function verifySessionToken(token: string, key: Buffer): string | null {
  const parts = token.split(".");
  if (parts.length !== 4) {
    return null;
  }
  const [version, expiresAtRaw, nonce, signature] = parts;
  if (version !== SESSION_TOKEN_VERSION || !/^\d+$/.test(expiresAtRaw) || nonce === "") {
    return null;
  }
  // Signature first, and in constant time. The expiry means nothing until we
  // know we wrote it.
  if (!safeEqual(signature, sign(`${version}.${expiresAtRaw}.${nonce}`, key))) {
    return null;
  }
  return Number(expiresAtRaw) > Date.now() ? nonce : null;
}

function csrfTokenFor(nonce: string, key: Buffer): string {
  return sign(`csrf|${nonce}`, key);
}

interface VerifiedSession {
  nonce: string;
  key: Buffer;
}

async function readVerifiedSession(): Promise<VerifiedSession | null> {
  // `cookies()` MUST run before any early return. It is what opts the calling
  // page out of build-time rendering; returning before it on a missing secret
  // (as `next build` sees it) baked the login redirect in, and every valid
  // session bounced to the login page. Observed, not theoretical.
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const config = readCredentialConfig();
  if (!config || token === undefined) {
    return null;
  }
  const nonce = verifySessionToken(token, config.sessionKey);
  return nonce ? { nonce, key: config.sessionKey } : null;
}

/** First address in `x-forwarded-for` (Vercel sets it), for audit logs only. */
async function clientIp(): Promise<string> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || "unknown";
}

/** One JSON line per security-relevant event, visible in Vercel's runtime
 *  logs. Never logs a submitted username or password: a password typed into
 *  the username box would end up in the log. */
export async function logAdminAuthEvent(
  event: "signin.ok" | "signin.rejected" | "signin.unavailable" | "origin.rejected" | "csrf.rejected",
): Promise<void> {
  const line = JSON.stringify({ event: `admin.${event}`, ip: await clientIp() });
  if (event === "signin.ok") {
    console.info(line);
  } else {
    console.warn(line);
  }
}

/**
 * Checks a submitted credential against the environment.
 *
 * Returns `"unavailable"` rather than `"rejected"` when the config is missing
 * or malformed, so a misconfigured deployment reports our mistake instead of
 * telling the owner his password is wrong. Never throws: a thrown error here
 * would surface as a generic 500 on the login page.
 */
export async function verifyAdminCredentials(
  username: string,
  password: string,
): Promise<CredentialCheck> {
  const config = readCredentialConfig();
  if (!config) {
    return "unavailable";
  }
  try {
    // Both checks always run, so the time taken does not reveal whether the
    // username alone was right.
    const usernameOk = safeEqual(username, config.username);
    const passwordOk = await passwordMatches(password, config);
    return usernameOk && passwordOk ? "ok" : "rejected";
  } catch {
    return "unavailable";
  }
}

/** Opens a session. Callable only from a Server Action or Route Handler —
 *  Next forbids mutating cookies while rendering. Only ever called after
 *  `verifyAdminCredentials` returned `"ok"`, which already read the config. */
export async function startAdminSession(): Promise<void> {
  const config = readCredentialConfig();
  if (!config) {
    throw new Error("Admin credentials are not configured.");
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, issueSessionToken(config.sessionKey), {
    httpOnly: true,
    sameSite: "strict",
    // Required by the `__Host-` prefix. Vercel serves every deployment over
    // HTTPS, and browsers treat http://localhost as secure for this purpose.
    secure: true,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Ends a session. Same call-site restriction as `startAdminSession`. The
 *  delete repeats `secure` + `path` so the browser accepts the `__Host-`
 *  expiry. */
export async function endAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "strict", secure: true, path: "/", maxAge: 0 });
}

/** Whether the request carries a valid, unexpired session this server
 *  signed. Safe to call while rendering. Fails closed without config. */
export async function hasAdminSession(): Promise<boolean> {
  return (await readVerifiedSession()) !== null;
}

/**
 * The gate every admin page calls first. Returns the CSRF token the page's
 * forms must carry in `ADMIN_CSRF_FIELD`.
 *
 * There is no single choke point (`proxy.ts` routes by host, D115, and is not
 * a gate), so this must
 * be the first statement of every protected page's component body. A page
 * that forgets it is simply unprotected.
 */
export async function requireAdminSession(): Promise<AdminSession> {
  const session = await readVerifiedSession();
  if (!session) {
    redirect(ADMIN_ROUTES.login);
  }
  return { csrfToken: csrfTokenFor(session.nonce, session.key) };
}

/**
 * Rejects a Server Action request that did not come from a page on this host.
 *
 * Next already aborts an action whose `Origin` differs from its `Host`; this
 * repeats that check where the rest of the gate lives, so it cannot be lost to
 * a config change like `serverActions.allowedOrigins`, and adds
 * `Sec-Fetch-Site`, which a browser sets and a page cannot forge. A missing
 * `Origin` fails: every browser sends one on a POST.
 */
export async function assertSameOriginRequest(): Promise<void> {
  const requestHeaders = await headers();
  const fetchSite = requestHeaders.get("sec-fetch-site");
  const origin = requestHeaders.get("origin");
  const host = (requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"))
    ?.split(",")[0]
    ?.trim();

  let originHost: string | null = null;
  try {
    originHost = origin ? new URL(origin).host : null;
  } catch {
    originHost = null;
  }

  const fetchSiteOk = fetchSite === null || fetchSite === "same-origin";
  if (!fetchSiteOk || !originHost || !host || originHost !== host) {
    await logAdminAuthEvent("origin.rejected");
    redirect(ADMIN_ROUTES.login);
  }
}

/**
 * The gate every admin Server Action calls first (except `signIn`, which has
 * no session yet and calls `assertSameOriginRequest()` alone).
 *
 * Same origin, a valid session, and a CSRF token matching that session.
 * No session sends the browser to sign in; a token mismatch reloads the admin
 * home, which renders a fresh form, because the realistic cause is a form left
 * open across a sign-out and sign-in in another tab.
 */
export async function requireAdminAction(formData: FormData): Promise<void> {
  await assertSameOriginRequest();
  const session = await readVerifiedSession();
  if (!session) {
    redirect(ADMIN_ROUTES.login);
  }
  const submitted = formData.get(ADMIN_CSRF_FIELD);
  if (
    typeof submitted !== "string" ||
    !safeEqual(submitted, csrfTokenFor(session.nonce, session.key))
  ) {
    await logAdminAuthEvent("csrf.rejected");
    redirect(ADMIN_ROUTES.home);
  }
}
