# src/app/pay/

## Purpose

The customer's side of a payment link, served on `pay.platinumwheels.ca` in production (D105). A real
segment rather than a route group, for the same reason as `src/app/admin/`: it needs its `/pay` URL.

## Owns

- [`[token]/page.tsx`](%5Btoken%5D/page.tsx) — `/pay/<token>`: amount, description, reference, expiry and
  the Pay island, or the paid, expired or cancelled state. Dynamic, read at request time. The staff-typed
  description wraps anywhere (`wrap-anywhere`), so one long word cannot widen the page (D145 audit).
- [`return/route.ts`](return/route.ts) — `/pay/return`, the one URL Converge sends every customer back to
  (GET or POST). Gated on the `pw_pay` cookie (LA-01/LA-02, D145 audit; D146): only a browser whose
  cookie names a link with an open attempt makes Converge be asked, a bounded number of times per
  attempt, and only that browser is 303'd to its link's page; every other return goes to `/pay/done`.
  It skips the query when `/pay/notify` has already settled that transaction (D119). Logic in
  `handleReturn` (`src/features/payments/service.ts`).
- [`notify/route.ts`](notify/route.ts) — `/pay/notify`, Converge's export script (D119). POST only; 404
  unless `CONVERGE_NOTIFY_USER` and `CONVERGE_NOTIFY_PASSWORD` are set; 403 outside Elavon's ranges; 401
  without the agreed Basic credentials. Never answers with payment data.
- [`not-found.tsx`](not-found.tsx) — the pay host's 404 (D145 audit, COPY / SEC-EDGE; D151): the
  pay page's logo row and panel, *Payment link not found*, and the shop's phone and email from
  `PRIMARY_CONTACT` (no name, "Call us at", D161) and `SITE.email`. No storefront link. Answers an unknown token, every path below.
- [`page.tsx`](page.tsx) and [`[...missing]/page.tsx`](%5B...missing%5D/page.tsx) — `notFound()` only,
  so bare `/pay` and any deeper unknown path render that 404, not the storefront's. In production
  `decideHostRouting` rewrites every non-`/pay` path on the pay host to `/pay` (`PAY_NOT_FOUND_PATH`).
- [`done/page.tsx`](done/page.tsx) — `/pay/done`, the neutral landing page for every return not bound to
  the browser's own link (no cookie, an expired one, or not a customer). It says the payment could not
  be confirmed, not to pay twice, and to call or email the shop (from `PRIMARY_CONTACT` (no name, "Call us at", D161) and `SITE.email`).

## Rules

- **Pages stay thin.** All behaviour lives in `src/features/payments/`.
- **No `"use client"` here.** The Pay island lives in `src/features/payments/components/`.
- **No site chrome.** Storefront links would not resolve on the pay host (D105).
- Response headers for `/pay/**` (no framing, noindex, `no-store`, `Referrer-Policy: strict-origin`) are
  set in `next.config.ts` (D105).
- **Converge portal settings point here** (`todo.md`): Redirect URL, Decline button link and Cancel link are
  all `https://pay.platinumwheels.ca/pay/return`.

## Decisions

| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | None folder-scoped. | See D100, D105, D107, D108, D119 in root `llm.md` §5b. | — |

## Connects to

- **Depends on:** `src/features/payments/`, `src/lib/site.ts` (contacts).
- **Depended on by:** Converge's hosted page (the return URL), Converge's export script (`/pay/notify`) and
  the links staff email out.

## Don't

- Don't render anything from the return request's fields. They are untrusted.
- Don't build a `/pay/<token>` redirect from the return's fields (LA-02): invoice numbers are sequential
  and the token is the link's capability. Only the `pw_pay` cookie picks the link page.

## Open

1. A stray path on the pay host (`/tires`) is served the pay 404 by a proxy rewrite, but `next.config.ts`
   matches header rules on the URL as requested, so that answer lacks the `/pay/:path*` headers
   (no-store, X-Robots-Tag, frame-ancestors). A host-keyed rule like the admin's (D115) would cover it.
   Next's own 404 `noindex` and `robots.txt` (D112) still apply. Coordinator (owns `next.config.ts`).
