# src/app/admin/

## Purpose

The admin route segment: thin routes plus a layout, serving the staff tool on `admin.platinumwheels.ca`.
**The folder name is internal** (D115): `src/proxy.ts` serves the admin host's prefix-less URLs from it
(`/products` from `admin/products/page.tsx`), and `/admin/...` itself is a 404 on every host. It exists so
the storefront's quote-first flow has somewhere to terminate (the owner raises a payment link here) and
so staff can keep the catalogue (D116). Delete this folder and `src/features/admin/` has no entry point.

## Owns

- [`layout.tsx`](layout.tsx) — admin metadata and `robots: noindex`. Renders **no chrome** (see Rules).
URLs below are the admin host's.

- [`page.tsx`](page.tsx) — `/`, the admin home: greeting, date, two tiles with live counts (D118).
- [`login/page.tsx`](login/page.tsx) — `/login`. Redirects home if a session already exists.
- [`payment-links/page.tsx`](payment-links/page.tsx) — `/payment-links`, the payment-link builder and the
  recent-links list (D106), moved unchanged from the root by D118. Mints the form's idempotency key, and
  renders if the links list fails.
- [`products/page.tsx`](products/page.tsx) — `/products`, the product list (D116): filters in the URL,
  bulk status, pagination.
- [`products/new/page.tsx`](products/new/page.tsx) — `/products/new`, category first, then the form.
- [`products/[id]/page.tsx`](products/[id]/page.tsx) — `/products/<id>`: status, View on site, photos
  (D117), the edit form.
- [`styleguide/page.tsx`](styleguide/page.tsx) — `/styleguide`, the admin's authored states (D93).
- [`[...missing]/page.tsx`](%5B...missing%5D/page.tsx) and [`not-found.tsx`](not-found.tsx) — the admin's
  own 404 for any path no page answers (D115), so the storefront's 404 never renders on the staff tool.

## Rules

- **This is a real segment, not a route group.** `(admin)` was the obvious shape by analogy with
  `(storefront)` and it is wrong: a parenthesised group contributes no URL segment, so `(admin)/page.tsx`
  resolves to `/` and collides with the storefront home at build time. Never reintroduce the parentheses.
- **Pages stay thin** (`docs/decisions.md` §3): metadata, landmarks, composition. All behaviour lives in
  `src/features/admin/`.
- **No `"use client"` in this folder, ever** (`docs/decisions.md` §4 — a client boundary under `src/app/`
  is a build failure by policy). The three client islands all live in the feature folder.
- **Every gated page calls `requireAdminSession()` as its first statement** and passes the `csrfToken`
  it returns to every form it renders (D95). `src/proxy.ts` (D97) decides which host
  may serve these routes but is not a gate, so there is still no single choke point; a page that forgets
  it is simply unprotected. Response headers for every `/admin` path are set
  in `next.config.ts` (D95), not here.
- **No link or redirect names the folder.** Every href and `redirect()` uses `ADMIN_ROUTES`
  (`src/features/admin/types.ts`), which is prefix-less (D115). `/admin/...` in a URL is a 404.
- Every gated page renders `AdminTopBar` with its `current` section (`home`, `paymentLinks`, `products`).
- **`/login` is deliberately not gated** and deliberately renders no `AdminTopBar` — there is no
  session to sign out of, so the bar would offer a control that cannot work.
- One `<h1>` per page. `<main id="main" tabIndex={-1}>` on every route, so the root layout's skip link
  lands focus (D57/C1).
- `robots: noindex` is set once, on the layout, and inherited. Until real auth replaces the stub gate it
  is the only thing keeping staff pages out of a search index.

## Decisions

| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| D90 | 2026-09-21 | **Superseded by D97 (2026-09-23).** Routes ship at `/admin/*`; the `admin.platinumwheels.ca` rewrite is deferred | A preview deployment resolves one `*.vercel.app` host, so a host-keyed `proxy.ts` rule never fires and cannot be verified there | Owner |
| D97 | 2026-09-23 | `src/proxy.ts`: admin host serves only `/admin/**` (other paths 307 there); every other host 404s `/admin/**`; production only | `admin.platinumwheels.ca` is wired (D96), so the rule is finally testable | Owner |
| D115 | 2026-10-01 | Prefix-less URLs on the admin host; this folder is the proxy's internal target; `/admin/**` 404s everywhere; previews have no admin; stray paths get the admin's 404. Supersedes D97's prefix and D90 | Owner: *"we should not build admin routes as /admin"* | Owner |
| D116 | 2026-10-01 | `products/`, `products/new`, `products/[id]` | The P2 product CRUD screens | Owner |
| D118 | 2026-10-01 | The root is the admin home; the builder moved to `payment-links/` | Owner: *"root is admin home like welcome {back}"* | Owner |
| D93 | 2026-09-21 | `/styleguide` (admin host) is separate from the storefront `/styleguide` | Staff-facing states do not belong on a public storefront reference page, and this one sits behind the same gate | Owner |
| — | 2026-09-21 | `src/app/admin/`, not `src/app/(admin)/` | A route group adds no segment and would collide with `/` | Coordinator, *derived* — forced by Next's routing, not a preference |
| — | 2026-09-21 | `children` typed as `ReactNode`, not the generated `LayoutProps<"/admin">` | `next typegen` has never seen this route and `node_modules` is absent, so the generated helper may not resolve. Vetoable once the route has shipped | Coordinator, *derived* |

Global rows live in the root [`llm.md`](../../../llm.md) §5b.

## Connects to

- **Depends on:** `src/features/admin/` (all four components used here, `session.ts`, `types.ts`),
  `src/lib/site.ts`, `src/app/layout.tsx` (body, fonts, skip link), `src/app/globals.css` (tokens).
- **Depended on by:** nothing. These are leaf routes. No storefront page links here — the admin is
  staff-only and unlisted, and `src/lib/routes.ts` deliberately contains no admin entry.

## Don't

- **Don't write `/admin` in an href, a `redirect()` or a test URL.** The folder is not a URL (D115).
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

1. ~~**`proxy.ts`**~~ **Written 2026-09-23 (D97), verified live 2026-09-24** on production `2df8092`:
   the admin host's 307s and the vercel.app host's 404 behave as specified (`HANDOFF.md` §5).
2. **What D95 declined** (per-user accounts, a second factor, a login limit). See
   `src/features/admin/llm.md` Open #1 and #6.
3. **No `loading.tsx` or `error.tsx` for the admin** (a staff 404 exists since D115). An error here falls
   through to Next's default boundary. Adding one means a staff-facing copy of the route-error state, and an `error.tsx` must
   carry `"use client"` itself — the one exception `.claude/rules/ui.md` and `docs/decisions.md` §4
   grant today names only the storefront file (D62), so it would need extending. Owner.
4. ~~**Where product CRUD lands**~~ **Closed by D116 and D118:** `products/` beside `payment-links/`, and
   `AdminTopBar` gained two section links.
5. **Paths with a dot skip the proxy on the admin host.** The matcher leaves out anything with a `.` so
   public files (the logo) load, which also means `admin.platinumwheels.ca/robots.txt` or any dotted
   storefront path is served by the storefront rather than a 404 (the admin headers still apply). Older
   than D115; harmless while nothing dotted is sensitive. Tighten the matcher to `/images/` and named
   files if that changes. Owner.
6. **After signing in on a local build (`next start`, `next dev`), the admin host shows the storefront home
   until a reload** (found 2026-10-02 at the canonical merge, D124). `signIn` ends in
   `redirect(ADMIN_ROUTES.home)`, and Next renders a Server Action's redirect target by fetching it from
   the server's own origin (`localhost:<port>`; `createRedirectRenderResult` in
   `node_modules/next/dist/server/app-render/action-handler.js`), so `src/proxy.ts` sees a storefront host.
   Sign-out and the `router.push` after creating a product are unaffected. Not yet looked at on
   production: sign in once after the deploy. If production shows it too, sign-in should navigate in the
   browser instead of calling `redirect()`.
