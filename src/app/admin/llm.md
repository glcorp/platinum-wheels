# src/app/admin/

## Purpose

The admin route segment: three thin routes plus a layout, serving the staff tool at `/admin`. It exists
so the storefront's quote-first flow has somewhere to terminate — the owner raises a payment link here
and emails it to the customer. Delete this folder and `src/features/admin/` has no entry point.

## Owns

- [`layout.tsx`](layout.tsx) — admin metadata and `robots: noindex`. Renders **no chrome** (see Rules).
- [`login/page.tsx`](login/page.tsx) — `/admin/login`. Redirects to `/admin` if a session already exists.
- [`page.tsx`](page.tsx) — `/admin`, the payment-link builder. Calls `requireAdminSession()` first.
- [`styleguide/page.tsx`](styleguide/page.tsx) — `/admin/styleguide`, the admin's authored states (D93).

## Rules

- **This is a real segment, not a route group.** `(admin)` was the obvious shape by analogy with
  `(storefront)` and it is wrong: a parenthesised group contributes no URL segment, so `(admin)/page.tsx`
  resolves to `/` and collides with the storefront home at build time. Never reintroduce the parentheses.
- **Pages stay thin** (`docs/decisions.md` §3): metadata, landmarks, composition. All behaviour lives in
  `src/features/admin/`.
- **No `"use client"` in this folder, ever** (`docs/decisions.md` §4 — a client boundary under `src/app/`
  is a build failure by policy). The three client islands all live in the feature folder.
- **Every gated page calls `requireAdminSession()` as its first statement.** `proxy.ts` is deferred
  (D90), so there is no single choke point; a page that forgets it is simply unprotected.
- **`/admin/login` is deliberately not gated** and deliberately renders no `AdminTopBar` — there is no
  session to sign out of, so the bar would offer a control that cannot work.
- One `<h1>` per page. `<main id="main" tabIndex={-1}>` on every route, so the root layout's skip link
  lands focus (D57/C1).
- `robots: noindex` is set once, on the layout, and inherited. Until real auth replaces the stub gate it
  is the only thing keeping staff pages out of a search index.

## Decisions

| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| D90 | 2026-09-21 | Routes ship at `/admin/*`; the `admin.platinumwheels.ca` rewrite is deferred | A preview deployment resolves one `*.vercel.app` host, so a host-keyed `proxy.ts` rule never fires and cannot be verified there | Owner |
| D93 | 2026-09-21 | `/admin/styleguide` is separate from the storefront `/styleguide` | Staff-facing states do not belong on a public storefront reference page, and this one sits behind the same gate | Owner |
| — | 2026-09-21 | `src/app/admin/`, not `src/app/(admin)/` | A route group adds no segment and would collide with `/` | Coordinator, *derived* — forced by Next's routing, not a preference |
| — | 2026-09-21 | `children` typed as `ReactNode`, not the generated `LayoutProps<"/admin">` | `next typegen` has never seen this route and `node_modules` is absent, so the generated helper may not resolve. Vetoable once the route has shipped | Coordinator, *derived* |

Global rows live in the root [`llm.md`](../../../llm.md) §5b.

## Connects to

- **Depends on:** `src/features/admin/` (all four components used here, `session.ts`, `types.ts`),
  `src/lib/site.ts`, `src/app/layout.tsx` (body, fonts, skip link), `src/app/globals.css` (tokens).
- **Depended on by:** nothing. These are leaf routes. No storefront page links here — the admin is
  staff-only and unlisted, and `src/lib/routes.ts` deliberately contains no admin entry.

## Don't

- **Don't add the admin to `src/lib/routes.ts`.** That map is the storefront's, and every href in it is
  rendered in public nav, tiles or the footer. A link to the staff tool has no business on the shopfront.
- **Don't hoist `AdminTopBar` into `layout.tsx`.** The sign-in page must not show it. This mirrors D38's
  reasoning on the storefront: chrome is composed per page, because the variation is per page.
- **Don't make the styleguide's components live.** `role` and `tabIndex` are props precisely so the
  reference page renders them inert; a live `role="alert"` announces itself on load.
- **Don't reuse the storefront's error boundary for the admin.** `src/app/(storefront)/error.tsx` (D62)
  is scoped to its route group, so it does not cover `/admin`, and the component it re-exports,
  `src/components/site/route-error.tsx`, speaks to customers: its recovery links point at the
  storefront and its fallback is "call us". A staff error needs its own copy.

## Open

1. **`proxy.ts`** — the subdomain rewrite, plus blocking `/admin` on the apex domain. Deferred to when
   the domain is wired and it can actually be tested (D90). Owner.
2. **Real authentication** before the subdomain is public. See `src/features/admin/llm.md` Open #1.
3. **No `loading.tsx` or `error.tsx` for `/admin`.** An error here falls through to Next's default
   boundary. Adding one means a staff-facing copy of the route-error state, and an `error.tsx` must
   carry `"use client"` itself — the one exception `.claude/rules/ui.md` and `docs/decisions.md` §4
   grant today names only the storefront file (D62), so it would need extending. Owner.
4. **Where product CRUD lands** — a new segment under `/admin`, and what that does to `AdminTopBar`.
   Blocked on the vendor catalogue and the schema. Client, via owner.
