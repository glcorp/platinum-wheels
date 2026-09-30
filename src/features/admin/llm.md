# src/features/admin/

## Purpose

The staff-facing half of the product: a sign-in gate and a payment-link builder, served at `/admin`
and destined for `admin.platinumwheels.ca`. It exists because the shop's selling flow ends off-platform
— inquiry, phone call, human quote — and the one step that has to come back on-platform is taking the
money. Delete this folder and the owner has no way to raise a payment link, and the storefront's
quote-first model terminates in a phone call with nothing to send.

Since D99–D108 it is backed by real payments: the builder writes a `payment_links` row through
`src/features/payments/` and hands back the customer's `pay.platinumwheels.ca/pay/<token>` URL, and the
links list shows which links were paid (D106). Sign-in is still one shared account, hardened by D95
rather than replaced by an auth system. Since D105b the folder also holds the product admin's server side
(gated reads and Server Actions); its screens are not built.

## Owns

- [`host-routing.ts`](host-routing.ts) — which host may serve `/admin` (D97) and `/pay` (D105). A pure
  function with no imports, so it is testable without Next; `src/proxy.ts` is its only caller.
  `ADMIN_HOST` and `PAY_HOST` are duplicated as literals in the proxy's `matcher` (and `PAY_HOST` in
  `src/features/payments/config.ts`). Change them together.
- [`types.ts`](types.ts) — the contract. Route map, field names, form-state unions, validation ceilings.
  Written by the coordinator before any implementation file (D25). Both actions and both forms code
  against it; nothing here invents a field name.
- [`session.ts`](session.ts) — the gate (D95). scrypt credential check, the signed `__Host-` session
  cookie, `requireAdminSession()` for pages (returns the CSRF token), `requireAdminAction()` for Server
  Actions, `assertSameOriginRequest()`, `logAdminAuthEvent()`. **Read the block at the top before
  touching anything auth-shaped.**
- [`auth-actions.ts`](auth-actions.ts) — `"use server"`. `signIn` (origin check, validates, opens a
  session, logs, redirects) and `signOut` (`requireAdminAction()`, then clears the cookie).
- [`payment-link-actions.ts`](payment-link-actions.ts) — `"use server"`, two actions, each calling
  `requireAdminAction()` first. `createPaymentLink` validates amount, description and expiry, then
  creates the link (idempotent on a per-render key). `cancelPaymentLink` serves the links list
  (D106). There is no check-payment action: the admin never calls the gateway (D108).
- [`product-types.ts`](product-types.ts) — the product admin contract (D105b): `PRODUCT_ID_FIELD`,
  `PRODUCT_STATUS_FIELD`, `ProductFormState`, `ProductStatusState`, `ProductListQuery`. The product's
  own field names are `PRODUCT_FIELD` in `@/features/catalog/product-input`.
- [`product-queries.ts`](product-queries.ts) — gated reads for Server Components: `adminListProducts`,
  `adminGetProduct`, `adminListBrands`. Each calls `requireAdminSession()` first. Not `"use server"`.
- [`product-actions.ts`](product-actions.ts) — `"use server"`. `createProductAction`,
  `updateProductAction`, `setProductStatusAction`, `bulkSetProductStatusAction`. Each calls
  `requireAdminAction(formData)` first and then `catalog/store.ts`; the create and update actions
  validate with `parseProductInput()` in between.
- [`components/login-form.tsx`](components/login-form.tsx) — client island. `useActionState` + focus
  management, the `quote-form.tsx` idiom.
- [`components/login-error-summary.tsx`](components/login-error-summary.tsx) — authored error state,
  its own module so `/admin/styleguide` renders the real component.
- [`components/admin-top-bar.tsx`](components/admin-top-bar.tsx) — logo, `Admin` label, sign out. The
  seed of a shell, not a shell.
- [`components/payment-link-form.tsx`](components/payment-link-form.tsx) — client island. Amount,
  description, expiry (D103), plus the hidden idempotency key.
- [`components/payment-link-success.tsx`](components/payment-link-success.tsx) — authored success state:
  the link, reference, amount, expiry, and the **test mode** notice while the gateway is the demo (D107).
- [`components/payment-link-list.tsx`](components/payment-link-list.tsx) — the latest 50 links as stacked
  cards: status, paid-with card and approval code, duplicate-payment alert, the *Payment started, not
  confirmed* note for an attempt that never returned (D108), copy link (D106).
- [`components/link-row-actions.tsx`](components/link-row-actions.tsx) — client island. Cancel (with a
  confirm) for one row.
- [`components/copy-link-button.tsx`](components/copy-link-button.tsx) — client island. Clipboard write
  with a real failure path.

## Rules

- **Nothing here has an artboard** (D89). The `design/` export covers three storefront routes only, so
  this folder has no authority-level-2 source. Everything is authored from the existing token system
  under `.claude/rules/ui.md`; no token, colour, radius or spacing value may be invented. Where a value
  is genuinely missing, it goes to **Open**, not into the code.
- **Mobile-first, and the tablet band is primary.** The client confirmed he works "mostly on phone and
  tab". iPad portrait (~744–834px) lands in the `sm:` 720–1099 band, so that band is a design target
  here, not a fall-out of `sm:` (contrast D41/D46, which had to rule on it after the fact on the
  storefront).
- **No hover-only affordances.** Hover is scoped to `@media (hover: hover)` repo-wide (D17), so anything
  revealed only on hover is permanently unreachable on his devices. Every control is persistently visible.
- **No gateway in this folder.** The PSP is Converge (D99), but that code lives in
  `src/features/payments/`. This folder may import that feature's `service`, `config` and `money` modules
  (D106), and never `converge.ts`; nothing here may name or be shaped around a gateway (D92, as amended
  by D99).
- **Three fields.** The builder takes an amount, a description and an expiry (D103). No line items, no
  quantities, no fees, no HST, no totals — the owner ruled it a wrapper, not a calculator (D92).
- **Nothing here moves money out.** No refund or void button; those are done in the Converge portal.
- Every protected page calls `requireAdminSession()` first, and **every Server Action here calls
  `requireAdminAction(formData)` first** (`signIn`, which has no session yet, calls
  `assertSameOriginRequest()`). An action is a public POST endpoint whether or not its page is gated, and
  `src/proxy.ts` (D97) routes by host and is deliberately not a gate, so there is still no single choke
  point: a page or action that forgets is simply unprotected (D95).
- **Every signed-in form carries `<input type="hidden" name={ADMIN_CSRF_FIELD}>`** with the token from
  the page's `requireAdminSession()`, passed down as a `csrfToken` prop (D95).
- Credentials live only in Vercel env vars: `ADMIN_USERNAME`, `ADMIN_SESSION_SECRET` (32+ characters),
  `ADMIN_PASSWORD_HASH` from `npm run admin:hash-password` (or `ADMIN_PASSWORD` until that is set).
- The password is never echoed back to the client, in any state.

## Decisions

| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| D89 | 2026-09-21 | Admin is authored with no artboard; Track Night tokens reused, no new theme | The design export covers three storefront routes; a second design system is unaffordable before Oct 15 | Owner |
| D90 | 2026-09-21 | Subdomain rewrite deferred; routes ship at `/admin` | A preview deployment resolves one `*.vercel.app` host, so a host-keyed rule cannot be tested there | Owner |
| D91 | 2026-09-21 | Stub cookie gate, username + password, one shared credential, lands on the builder | One shop, no staff accounts; real auth needs a backend that is deferred | Owner |
| D92 | 2026-09-21 | Payment link = amount + description only; no computation | Owner: *"its simply just a payment link generator … basically just a wrapper on top of payment gateway they choose"* | Owner |
| D93 | 2026-09-21 | Admin authored states go to `/admin/styleguide`, not the storefront's | Staff states do not belong on a public storefront reference page | Owner |
| D94 | 2026-09-21 | ~~The generated link is a realistic placeholder, visibly labelled as not connected~~ **Retired by D107** | It must demo convincingly without anyone mistaking it for live | Owner |
| D95 | 2026-09-23 | One shared sign-in, hardened: scrypt hash, signed `__Host-` cookie, CSRF token + origin check on every action, admin security headers, audit log. No login limit, no per-user accounts, no 2FA | Owner: *"only one login account password works"*, *"lets not build limit failed login"* | Owner |
| D96 | 2026-09-23 | `admin.platinumwheels.ca` wired: a DNS-only Cloudflare CNAME to Vercel; the apex stays on the goodwill site | Owner chose the admin subdomain only; must never proxy the record or move the nameservers (email) | Owner |
| D97 | 2026-09-23 | `src/proxy.ts`: on the admin host non-`/admin` paths 307 to `/admin`; elsewhere `/admin` is a 404; production only | The subdomain became real, so the D90 deferral no longer applied | Owner |

Global rows live in the root [`llm.md`](../../../llm.md) §5b and are referenced by ID, never restated.

## Connects to

- **Depends on:** `src/components/ui/` (button, input, field-label), `src/lib/site.ts` (`SITE`),
  `next/headers`, `next/navigation`, `node:crypto`. Nothing else — no new dependency.
- **Depended on by:** `src/app/admin/` (layout, three routes).
- **Depends on (D105b):** `src/features/catalog/` — `store.ts`, `product-input.ts`, `catalog-types.ts`.
  This is the D37 graph's existing direction (`features → catalog`), so no edge is reversed.
- **Deliberately does not touch:** `src/features/finder|home|product|results/`. The admin shares the
  primitives and the tokens, and nothing else.

## Don't

- **Don't add a Server Action without `requireAdminAction(formData)` as its first statement**, or a
  signed-in form without the `ADMIN_CSRF_FIELD` hidden input. Either gap reopens what D95 closed.
- **Don't log a submitted username or password.** `logAdminAuthEvent()` logs the event and the IP only;
  a password typed into the username box would otherwise land in Vercel's logs.
- **Don't change the `ADMIN_PASSWORD_HASH` format on one side only.** `session.ts`
  `parsePasswordHash()` and `scripts/hash-admin-password.mjs` must agree.
- **Don't use the `Price` primitive for an amount.** `src/components/ui/price.tsx` deliberately forbids
  cents and is parity-measured on all three storefront routes; a payment amount needs `$452.60`.
- **Don't add fields to the builder.** Customer name, email, reference, expiry and line items were all
  offered to the owner and declined this session. Adding one is a scope change, not an improvement.
  **One exception:** D103 (2026-09-23) adds a staff-chosen expiry. It lands with the payments wiring, not
  before.
- **Don't add a local class-merge helper.** The 13 hand-rolled copies the D56 audit found were
  consolidated into [`src/lib/cx.ts`](../../lib/cx.ts) by D63. Import `cx` / `join` from `@/lib/cx`
  when a conditional class list needs one; the admin currently needs neither.
- **Don't add a delete action for products.** A product leaves the site by becoming `hidden` or
  `discontinued`, so old links keep working (D105b).
- **Don't let a bulk status change run with no ticked rows and no filter.** `bulkSetProductStatus`
  refuses it; an empty submit must never mean the whole catalogue (D107b).
- **Don't put a product read in a `"use server"` file.** Every export there is a public POST endpoint.
- **Don't build the admin shell here yet.** `AdminTopBar` is intentionally minimal; product CRUD will
  reshape navigation, and a full shell built now is thrown away.

## Open

1. **What D95 declined:** per-user accounts, a second factor, per-session revocation (changing the
   password or `ADMIN_SESSION_SECRET` signs everyone out at once). Revisit if staff beyond the owner
   need their own logins. Owner.
2. **PSP selection.** Until one is chosen, `createPaymentLink` fabricates a URL. The client was to come
   back with a demo account. Client, via owner.
3. **Product CRUD screens.** The server side exists (D105b); the list, the create/edit form and their
   `/admin/styleguide` states are not built, and `ADMIN_ROUTES` has no product routes yet. Image upload
   (Vercel Blob) is its own session; `product_images` is ready for it. **The actions return state and
   do not re-render the route**: the screens must call `refresh()` (or the actions must, once there is a
   route to refresh) or a list will show stale statuses after a bulk change. Owner.
4. **Switch production to `ADMIN_PASSWORD_HASH`.** `ADMIN_USERNAME`, `ADMIN_PASSWORD` and
   `ADMIN_SESSION_SECRET` are set in the Vercel project (Production + Preview). Until the hash replaces
   `ADMIN_PASSWORD`, every instance logs `admin.config.plaintext_password`. **Deferred by the owner,
   2026-09-23:** *"without npm run admin:hash-password will the ADMIN_PASSWORD keep working if yes lets defer it for later"*. It does: plaintext is the documented fallback while no hash is set. A
   *malformed* hash never falls back, so set the hash only from the script.
5. **Session length.** 12 hours was chosen by the coordinator, not ruled on. Vetoable.
6. **No rate limiting or lockout** on the sign-in form. Declined twice: 2026-09-21, and 2026-09-23 when
   the storage question was put ("lets not build limit failed login", D95). scrypt's cost per attempt is
   the only brake, so password length is the defence (the hash script enforces 12+). Reconsider if the
   `admin.signin.rejected` log lines show guessing.
7. ~~**Confirm the D96 reading of D95**~~ **Closed 2026-09-23:** *"no i meant admin stays and main website stays deferred"*. Admin subdomain wired, apex
   deferred.
