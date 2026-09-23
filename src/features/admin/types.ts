/* ---------------------------------------------------------------------------
   Admin contract — written by the coordinator before any implementation file
   (D25: "the coordinator writes the register rows, the folder `llm.md` and a
   `types.ts` contract **before** any agent starts").

   NO ARTBOARD DRAWS ANY OF THIS. The `design/` export covers three storefront
   routes and nothing else, so the admin has no authority-level-2 source at all
   (D89). Every value here comes from `docs/decisions.md`, `.claude/rules/ui.md`
   or an owner ruling in D89-D94, and every authored state lands on
   `/admin/styleguide` (D93).

   Nothing in this file may reference a payment provider. The PSP is unchosen
   (project skill "Open items" #3), so the admin is a provider-agnostic wrapper:
   it collects an amount and a description, and nothing else (D92).
   --------------------------------------------------------------------------- */

/* ===========================================================================
   Routes
   =========================================================================== */

/**
 * Admin route map, mirroring `src/lib/routes.ts` for the storefront.
 *
 * These are the paths the build ships and the paths a Vercel preview serves.
 * The `admin.platinumwheels.ca` subdomain rewrite is **deferred** (D90): a
 * preview deployment resolves a single `*.vercel.app` hostname, so a
 * host-keyed rule in `proxy.ts` can never fire there and cannot be verified
 * until the real domain is wired. When it lands it rewrites the subdomain onto
 * these same paths and blocks them on the apex — no route below changes.
 */
export const ADMIN_ROUTES = {
  /** The payment-link builder. The gate's redirect target (D91). */
  home: "/admin",
  login: "/admin/login",
  styleguide: "/admin/styleguide",
} as const;

/* ===========================================================================
   Sign in
   =========================================================================== */

/**
 * Field names for the sign-in form. Owner chose **username + password** over
 * email + password (D91) — the shop runs one shared credential, and a username
 * says that honestly rather than implying a per-person account.
 *
 * `autoComplete` still uses the `username` / `current-password` token pair:
 * those are what a password manager looks for, and they are what a real auth
 * provider will expect when the stub is replaced.
 */
export const LOGIN_FIELD = {
  username: "username",
  password: "password",
} as const;

export type LoginFieldKey = keyof typeof LOGIN_FIELD;

/**
 * Sign-in result.
 *
 * Shaped like `QuoteFormState` (`src/features/product/types.ts`) so the one
 * form idiom in this repo — `useActionState(action, INITIAL)` returning a
 * discriminated union — is the same idiom here.
 *
 * `invalid` and `rejected` are deliberately separate. `invalid` means the form
 * was not filled in and points at a field; `rejected` means it was filled in
 * correctly and the credential was wrong, which belongs to the form, not to
 * either input. Conflating them would put "Wrong username or password" under
 * the username box and accuse the wrong field.
 *
 * There is no `success` member: the action calls `redirect()` to
 * `ADMIN_ROUTES.home` (D91), which navigates rather than returning.
 */
export type AdminLoginState =
  | { status: "idle" }
  | {
      status: "invalid";
      errors: Partial<Record<LoginFieldKey, string>>;
      /** Echoed so a rejected submit does not blank the form. Password is
       *  never echoed — it is never sent back to the client, in any state. */
      values: { username: string };
    }
  | { status: "rejected"; values: { username: string } }
  /** The credential env vars are missing, so the gate cannot answer. Distinct
   *  from `rejected`: this is our misconfiguration, not the user's mistake,
   *  and it must never read as "wrong password". */
  | { status: "unavailable" };

export const LOGIN_INITIAL_STATE: AdminLoginState = { status: "idle" };

/* ===========================================================================
   Payment link
   =========================================================================== */

/**
 * Field names for the payment-link builder.
 *
 * Two fields, and only two. Owner, this session: *"we dont built a sustem to
 * compute final amount. its simply just a payment link generator which they
 * will send in the email to actual cusotmer. what we are building is basically
 * just a wrapper on top of payment gateway they choose"* (D92).
 *
 * So there are **no line items, no quantities, no unit prices, no fees, no HST
 * and no totals block**. The owner works the number out himself, as he does
 * today, and types it once. Do not add a field here without an owner ruling.
 */
export const PAYMENT_LINK_FIELD = {
  amount: "amount",
  description: "description",
} as const;

export type PaymentLinkFieldKey = keyof typeof PAYMENT_LINK_FIELD;

/**
 * Fixed currency. The storefront is CAD throughout (`src/lib/site.ts`
 * `priceNote`, every `Product.currency`), the shop is in Brampton, and no
 * artboard or decision anywhere contemplates a second currency. Rendered, not
 * selectable — a currency select would be a field the owner never changes.
 */
export const PAYMENT_LINK_CURRENCY = "CAD";

/**
 * Ceiling on the typed amount. Not a design value and not a business rule —
 * nobody has set one. It exists so a slipped keyboard cannot mint a link for
 * six figures, and it is generous enough that a real four-tire-plus-wheels job
 * never approaches it. Revisit when the PSP is chosen and imposes its own.
 */
export const AMOUNT_MAX = 50_000;

/**
 * Description ceiling. Same reasoning as `MESSAGE_MAX_LENGTH` in
 * `src/features/product/actions.ts`: a generous guard, not a drawn limit.
 * Every gateway truncates a statement descriptor far below this.
 */
export const DESCRIPTION_MAX_LENGTH = 200;

/**
 * Payment-link result.
 *
 * `success` carries the generated URL **and** the submitted values, because
 * the success panel restates what the link is for — a bare URL with no amount
 * beside it is unverifiable at a glance, and the owner is about to paste it
 * into an email to a customer.
 *
 * `amount` is carried as the normalised display string (e.g. `"452.60"`), not
 * a number: it was validated as text, and re-formatting a float here is how
 * a cent goes missing.
 */
export type PaymentLinkState =
  | { status: "idle" }
  | {
      status: "invalid";
      errors: Partial<Record<PaymentLinkFieldKey, string>>;
      values: { amount: string; description: string };
    }
  | {
      status: "success";
      /** Placeholder only. No gateway is connected — see D94 and the TODO in
       *  `payment-link-actions.ts`. The success panel must say so on screen. */
      url: string;
      amount: string;
      description: string;
    };

export const PAYMENT_LINK_INITIAL_STATE: PaymentLinkState = { status: "idle" };
