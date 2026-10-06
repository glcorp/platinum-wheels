# Fix session: the three findings from the 2026-10-06 final check

Paste this whole file into a fresh coordinator session as its first message.

You are the coordinator (Opus) for the Platinum Wheels repo at `/Users/raghavvirmani/platinum-wheels`.
Read root `llm.md` first (rule §1.1), then `HANDOFF.md`, then `design/reports/final-check-2026-10-06.md`
(the report these fixes come from). Implementation may go to Sonnet subagents on disjoint files; you are the
single writer of `src/app/globals.css` and of every `llm.md`. Do not fire subagents before the plan is
confirmed with me, then do not wait on me again: park any disagreement in a file with a recommendation and
keep going. Short, plain replies.

Branch from `main` (last known `d81c25b`, production runs the same commit) as `final-check-fixes`. Fix the
three items below, verify each on a **production build** (never `next dev`, D88), update the folder
`llm.md` files in the same change (rule §1.2), add a root `llm.md` §5b decision row (next free number after
D156, check `git log origin/main` first, D98), add a `design/DEVIATIONS.md` row only where a drawn value
moves, and open one PR titled "Final-check fixes: product 404 without JS, results TTFB, phone main thread".
No other scope: do not touch prices, the cart send, the admin, payments, SEO or fitment.

## Fix 1 (P2, confirmed): a product 404 is blank with JavaScript off

Evidence: `curl https://platinum-wheels-one.vercel.app/products/qa-no-such-slug-zz` and local
`/products/<unknown>` or the hidden fixture slug `zeta-antarctica-ice-195-60r15-88t` return status 404 with no
`<h1>` and no `<main>`; the body is `<div hidden><!--$--><!--/$--></div>` plus scripts and the flight data
carries `NEXT_HTTP_ERROR_FALLBACK;404`. The plain `/zzz` 404 renders the branded page with JS off. So
`notFound()` on the product route is thrown after the shell has started streaming, inside a Suspense
boundary, and the branded not-found is only painted client-side.

Do: find where `src/app/(storefront)/products/[slug]/page.tsx` resolves the product and where the
boundary sits (`PageTransition`, a `Suspense`, or an async child); resolve the product **before** the first
boundary so `notFound()` produces a server-rendered 404 document, keeping D151 (exactly one robots meta,
`robots: null` for a missing product) and D109(10)/D111 (a real 404 status). Verify with
`curl -s <url> | grep -c '<h1'` = 1 on an unknown slug and on the hidden fixture slug, with JS off in
Playwright, and that a known slug still morphs (D92b, D144) and still answers 200. Re-run the fixture gate:
`npm run test:e2e:fixture` (the two `admin-save` failures are a known macOS host-resolution issue in the
suite, not the product; leave them unless the fix is one line: send `Host: admin.localhost:3500` to
`127.0.0.1` from the `request` fixture).

## Fix 2 (P2): filtered results pages are slow on the server

Evidence (production, three runs each): `/tires?width=205&profile=55&rim=17` TTFB 1.57 / 1.12 / 1.39 s;
`/wheels?bolt=5x114.3&diameter=18` 1.37 / 0.69 / 0.68 s; `x-vercel-cache: MISS`, `private, no-store`;
HTML 377 to 432 KB uncompressed. A results page makes eight database reads (D132) per request against Neon
(D109(8): results read Postgres per request, by design; the home row alone is cached, D111(5)). No budget is
written anywhere; take **under 1 s TTFB on a warm function** as the target and report what you reach.

Do, in this order, measuring after each step on a local production build against a copy of the production
catalogue (the fixture's 126 products will not show the cost; ask me for a database URL if you have none,
never use the production `DATABASE_URL`): (a) log every query a results request issues with its time and
find the slow ones (candidates from D137: `wheel_specs(finish_family)`, `wheel_specs(offset_mm)`; check
`EXPLAIN` on the size-facet aggregate and the brand facet); add indexes as a Drizzle migration (`npm run
db:generate`, D101) if a read is sequential-scanning; (b) cache the facet reads that do not depend on the
buyer's filters (the category's brand list, the whole size lists) with `unstable_cache` under the existing
`CATALOGUE_TAG` so admin writes expire them (D111(5) precedent), never cache the count or the cards;
(c) only if still over target, shrink the first card window and let `Load more` (D133) do more. Do **not**
change card prefetch (owner ruling D153 "Keep as is") without asking me first. Record before/after TTFB in
the decision row.

## Fix 3 (P2): phone main thread is blocked after load

Evidence (Lighthouse phone, production, one run each): `/tires` performance 69, TBT 650 ms, main thread busy
3.1 to 3.3 s, bootup 1.4 s; `/` performance 71, TBT 570 ms; PDP 89, TBT 70 ms. JS transfer about 215 KB per
route, CSS 16 KB, CLS 0. Lighthouse flags 27 KiB unused and 14 KiB legacy JS. A `/tires` load at 390 wide
fires 27 `_rsc` prefetches (8 product pages). The LCP gate itself is PARKED (D54) and is not this fix.

Do: profile hydration on `/tires` and `/` in Chrome DevTools (CPU 4x) and name the top three long tasks;
then take the cheap wins that do not change a measured rest value: lazy-mount islands that are below the fold
or inert until interaction (the 31 `"use client"` files are listed by `grep -rl '^"use client"' src`; D128
and D133 added the newest), drop any client-side work that runs at load but could run on first interaction,
and check the `beforeInteractive` bootstrap (D92b) for cost. If the only large lever is the prefetch volume,
stop and ask me, because D153 ruled it kept. Target TBT under 300 ms on both pages; report the numbers
before and after from `npx lighthouse --preset=... --form-factor=mobile` (recipe in
`design/reports/README.md`), one run at a time, and confirm the parity probe (`scripts/parity-probe.js`)
and a full-DOM box diff show no rest-state change on `/`, `/tires` and a PDP at 390 and 1440 (D92b's
"measured, not assumed" standard).

## Before the PR

`npm run check` clean; `npm run test:e2e:fixture` as green as before or better; `next build` no warnings;
0 em or en dashes in anything a visitor reads (D130); the folder `llm.md` files and the root §5b row written;
`HANDOFF.md` §1 to §9 updated with the state. PR body: the three fixes with their before/after numbers, what
was not changed and why, and the test evidence. End the PR body with the attribution line this harness
asks for.
