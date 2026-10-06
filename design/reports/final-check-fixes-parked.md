# Final-check fixes: what is parked for the owner (2026-10-06)

Points where the fix session (D157) took a call the owner may want to change. Each has a recommendation.
Nothing here blocks the PR.

## P1. The product 404 is decided in `src/proxy.ts`, with one database read

**What was done.** Next 16.4 canary answers a `notFound()` thrown from a page before the first flush with a
404 status but an empty `<html id="__next_error__">` shell; only a browser running JavaScript paints the 404.
This was confirmed with a page that does nothing but `notFound()`, and a segment `not-found.tsx` does not
change it (measured). So `src/proxy.ts` now checks `/products/<slug>` document requests (no `RSC` header)
with one indexed read, `productPageExists()`, and rewrites a missing or hidden slug to the same 404 `/zzz` gets.
Client navigations and prefetches skip the check, and a database error lets the request through.

**The risk.** Every product page a browser or crawler opens directly now costs one extra read, from the
proxy's own `pg` pool. It is cheap only if Vercel runs the Node proxy in the function region (iad1, next to
Neon). If it runs at the edge near the visitor (bom1 for the owner), each product page gains a long round trip.
Neither was measured on Vercel.

**Recommendation.** After the merge deploys, run `curl -s -o /dev/null -w '%{time_starttransfer}'` on one
product page, three times, and compare with the final check's PDP numbers (1.10 s cold, 0.46 s warm). Also check
that `/products/qa-no-such-slug-zz` returns 404 with an `<h1>`. If product pages got more than about 100 ms
slower, revert the proxy half and accept the no-JS blank 404 until Next fixes it. Only visitors with
JavaScript off and crawlers see that blank page.

## P2. Results speed on Neon is inferred, not measured

**What was done.** A results page now makes 5 to 8 reads in 2 rounds (was 9 to 14 in 3 to 5). The heavy
best-match sort joins specs only for the cards it shows. The brand, size and value lists of a whole category
are cached under `CATALOGUE_TAG` with no timer. Locally, with 25 ms added to every query to stand in for Neon,
`/tires?width=205&profile=55&rim=17` went from 166 to 87 ms and `/wheels?bolt=5x114.3&diameter=18` from 184 to 95 ms.

**What is left.** The database pool closes an idle connection after 5 s (`src/db`). After a quiet gap, a
results page opens up to 5 new connections to Neon at once, each with its own TLS and pooler sign-in. That
cost could not be measured here.

**Recommendation.** After deploy, time the two URLs above three times each. If any run is still over 1 s,
raise the pool's `idleTimeoutMillis` (for example to 60 s) in its own change, with an `error` handler on the
pool. Do not fold it into this PR untested.

**Also note.** A bulk load made outside the admin (`catalog:import`, `catalog:photos`) does not expire the
cached lists. They catch up on the next deploy or admin save, the same as the home featured row (D111(5)).
