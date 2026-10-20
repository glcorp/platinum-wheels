/* ---------------------------------------------------------------------------
   A small in-memory rate limiter, keyed by client IP (LA-03, D145 audit).

   Server only. It holds no state of its own until `createRateLimiter()` is
   called, and it imports nothing, so `src/lib/` keeps its no-feature rule
   (D37).

   Sliding windows: for each key it keeps the times of its recent counted
   requests (never more than the largest limit), and a key is limited when any
   window already holds `limit` of them. `check()` only looks; `hit()` counts.
   The caller decides what to count.

   ACCEPTED LIMITS, written down so nobody mistakes this for more:
   - The memory is per server instance. Vercel runs a function on as many
     instances as traffic needs, and a cold start begins empty, so an IP can
     get up to "limit × instances" through. For this shop's traffic that is a
     handful of instances at most; the Vercel firewall rule on the POST
     (`todo.md` item 7) is the platform-wide brake.
   - An attacker with many IP addresses is not stopped by a per-IP cap.
   - The map is bounded (`maxKeys`). When it is full, expired keys are dropped
     first, then the least recently counted ones, so memory can never grow
     without limit; a flood of fresh IPs can push an old key out early.
   --------------------------------------------------------------------------- */

export interface RateWindow {
  /** Counted requests allowed inside the window. */
  limit: number;
  /** Window length in ms. */
  windowMs: number;
}

export interface RateLimiter {
  /** True when `key` has already used up any window. Counts nothing. */
  isLimited(key: string, now?: number): boolean;
  /** Counts one request for `key`. */
  hit(key: string, now?: number): void;
}

export function createRateLimiter(options: {
  windows: readonly RateWindow[];
  maxKeys: number;
}): RateLimiter {
  const { windows, maxKeys } = options;
  const longestMs = Math.max(...windows.map((window) => window.windowMs));
  const keep = Math.max(...windows.map((window) => window.limit));
  /* Map keeps insertion order; a key is deleted and re-set on every hit, so
     the first entry is always the least recently counted. */
  const hits = new Map<string, number[]>();

  function recent(key: string, now: number): number[] {
    const times = hits.get(key);
    if (!times) return [];
    const live = times.filter((time) => now - time < longestMs);
    if (live.length === 0) hits.delete(key);
    else if (live.length !== times.length) hits.set(key, live);
    return live;
  }

  function makeRoom(now: number): void {
    if (hits.size < maxKeys) return;
    for (const [key, times] of hits) {
      if (times.every((time) => now - time >= longestMs)) hits.delete(key);
    }
    while (hits.size >= maxKeys) {
      const oldest = hits.keys().next().value;
      if (oldest === undefined) break;
      hits.delete(oldest);
    }
  }

  return {
    isLimited(key, now = Date.now()) {
      const times = recent(key, now);
      return windows.some(
        (window) => times.filter((time) => now - time < window.windowMs).length >= window.limit,
      );
    },
    hit(key, now = Date.now()) {
      const times = recent(key, now);
      hits.delete(key);
      makeRoom(now);
      hits.set(key, [...times, now].slice(-keep));
    },
  };
}

/**
 * The visitor's IP as Vercel reports it: `x-real-ip` (written by the
 * platform), else the first `x-forwarded-for` entry, else `"unknown"` (every
 * request without one shares that key). Takes the headers object so this file
 * stays import-free; call it with `await headers()`.
 *
 * `src/features/admin/session.ts` has its own `clientIp()` for audit logs,
 * reading `x-forwarded-for` first. It is not shared because `src/lib/` may not
 * import a feature (D37); this one reads `x-real-ip` first.
 */
export function clientIpFrom(requestHeaders: { get(name: string): string | null }): string {
  const real = requestHeaders.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}
