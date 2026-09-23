# src/features/admin/

## Purpose

The staff-facing half of the product: a sign-in gate and a payment-link builder, served at `/admin`
and destined for `admin.platinumwheels.ca`. It exists because the shop's selling flow ends off-platform
— inquiry, phone call, human quote — and the one step that has to come back on-platform is taking the
money. Delete this folder and the owner has no way to raise a payment link, and the storefront's
quote-first model terminates in a phone call with nothing to send.

It is **UI only** (D54 extended by D89). No database, no payment provider, no real authentication.

## Owns

- [`types.ts`](types.ts) — the contract. Route map, field names, form-state unions, validation ceilings.
  Written by the coordinator before any implementation file (D25). Both actions and both forms code
  against it; nothing here invents a field name.
- [`session.ts`](session.ts) — the stub gate. Credential check, cookie open/close, `requireAdminSession()`.
  **Read the warning block at the top before touching anything auth-shaped.**
- [`auth-actions.ts`](auth-actions.ts) — `"use server"`. `signIn` (validates, opens a session, redirects)
  and `signOut`.
- [`payment-link-actions.ts`](payment-link-actions.ts) — `"use server"`. `createPaymentLink`: validates
  an amount and a description, returns a placeholder URL. Connects to no provider.
- [`components/login-form.tsx`](components/login-form.tsx) — client island. `useActionState` + focus
  management, the `quote-form.tsx` idiom.
- [`components/login-error-summary.tsx`](components/login-error-summary.tsx) — authored error state,
  its own module so `/admin/styleguide` renders the real component.
- [`components/admin-top-bar.tsx`](components/admin-top-bar.tsx) — logo, `Admin` label, sign out. The
  seed of a shell, not a shell.
- [`components/payment-link-form.tsx`](components/payment-link-form.tsx) — client island. Two fields.
- [`components/payment-link-success.tsx`](components/payment-link-success.tsx) — authored success state:
  the link, the amount restated, and the mandatory "not connected yet" notice.
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
- **Provider-agnostic.** The PSP is unchosen. No file here may name, import or be shaped around a
  specific gateway (D92).
- **Two fields.** The builder takes an amount and a description. No line items, no quantities, no fees,
  no HST, no totals — the owner ruled it a wrapper, not a calculator (D92).
- Every protected page calls `requireAdminSession()` first. `proxy.ts` is deferred (D90), so there is no
  single choke point and a page that forgets is simply unprotected.
- The password is never echoed back to the client, in any state.

## Decisions

| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| D89 | 2026-09-21 | Admin is authored with no artboard; Track Night tokens reused, no new theme | The design export covers three storefront routes; a second design system is unaffordable before Oct 15 | Owner |
| D90 | 2026-09-21 | Subdomain rewrite deferred; routes ship at `/admin` | A preview deployment resolves one `*.vercel.app` host, so a host-keyed rule cannot be tested there | Owner |
| D91 | 2026-09-21 | Stub cookie gate, username + password, one shared credential, lands on the builder | One shop, no staff accounts; real auth needs a backend that is deferred | Owner |
| D92 | 2026-09-21 | Payment link = amount + description only; no computation | Owner: *"its simply just a payment link generator … basically just a wrapper on top of payment gateway they choose"* | Owner |
| D93 | 2026-09-21 | Admin authored states go to `/admin/styleguide`, not the storefront's | Staff states do not belong on a public storefront reference page | Owner |
| D94 | 2026-09-21 | The generated link is a realistic placeholder, visibly labelled as not connected | It must demo convincingly without anyone mistaking it for live | Owner |

Global rows live in the root [`llm.md`](../../../llm.md) §5b and are referenced by ID, never restated.

## Connects to

- **Depends on:** `src/components/ui/` (button, input, field-label), `src/lib/site.ts` (`SITE`),
  `next/headers`, `next/navigation`, `node:crypto`. Nothing else — no new dependency.
- **Depended on by:** `src/app/admin/` (layout, three routes).
- **Deliberately does not touch:** `src/features/catalog|finder|home|product|results/`. The admin shares
  the primitives and the tokens, and nothing else. When product CRUD lands it will need `catalog`, and
  that is the point at which the one-way graph in D37 has to be re-read.

## Don't

- **Don't treat `session.ts` as authentication.** It is a placeholder with no hashing at rest, no
  per-user accounts, no rate limiting, no session rotation and no CSRF token. It must be replaced before
  the subdomain is public.
- **Don't use the `Price` primitive for an amount.** `src/components/ui/price.tsx` deliberately forbids
  cents and is parity-measured on all three storefront routes; a payment amount needs `$452.60`.
- **Don't add fields to the builder.** Customer name, email, reference, expiry and line items were all
  offered to the owner and declined this session. Adding one is a scope change, not an improvement.
- **Don't add a local class-merge helper.** The 13 hand-rolled copies the D56 audit found were
  consolidated into [`src/lib/cx.ts`](../../lib/cx.ts) by D63. Import `cx` / `join` from `@/lib/cx`
  when a conditional class list needs one; the admin currently needs neither.
- **Don't build the admin shell here yet.** `AdminTopBar` is intentionally minimal; product CRUD will
  reshape navigation, and a full shell built now is thrown away.

## Open

1. **Real authentication.** Who owns it, and which provider. Blocks the subdomain going public. Owner.
2. **PSP selection.** Until one is chosen, `createPaymentLink` fabricates a URL. The client was to come
   back with a demo account. Client, via owner.
3. **Product CRUD**, deferred until the vendor catalogue lands and the schema is settled. Client, via owner.
4. **Where `ADMIN_USERNAME` / `ADMIN_PASSWORD` are set**, and who holds them. They are not committed and
   no `.env` exists in the repo. Owner.
5. **Session length.** 12 hours was chosen by the coordinator, not ruled on. Vetoable.
6. **No rate limiting or lockout** on the sign-in form — the owner declined that state this session. It
   should be reconsidered when real auth lands, since one shared credential on a public subdomain is
   exactly the case brute-forcing suits.
