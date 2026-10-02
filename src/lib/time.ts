/* ---------------------------------------------------------------------------
   Shop time — every date and time the application shows or reasons about is
   Brampton time (owner, 2026-10-01: "all times used in application need to be
   brampton time zone").

   Brampton is in Ontario, on Eastern time; IANA has no Brampton entry, and
   `America/Toronto` is the zone that covers it, daylight saving included.
   Formatting a `Date` through these helpers never depends on the server's own
   zone, which on Vercel is UTC.
   --------------------------------------------------------------------------- */

export const SHOP_TIME_ZONE = "America/Toronto";

/** `Oct 1, 2026, 2:30 p.m.` — the admin's one date-and-time format. */
export const SHOP_DATE_TIME = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: SHOP_TIME_ZONE,
});

/** `Wednesday, October 1` — the admin home's date line. */
export const SHOP_WEEKDAY_DATE = new Intl.DateTimeFormat("en-CA", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: SHOP_TIME_ZONE,
});

/** The calendar year in Brampton. `new Date().getFullYear()` reads the
 *  server's zone (UTC on Vercel), which turns the year five hours early on
 *  New Year's Eve. */
export function shopYear(now: Date = new Date()): number {
  const year = new Intl.DateTimeFormat("en-CA", { year: "numeric", timeZone: SHOP_TIME_ZONE })
    .formatToParts(now)
    .find((part) => part.type === "year")?.value;
  return Number(year ?? now.getUTCFullYear());
}

/** The hour of day in Brampton, 0–23. */
export function shopHour(now: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    hourCycle: "h23",
    timeZone: SHOP_TIME_ZONE,
  })
    .formatToParts(now)
    .find((part) => part.type === "hour")?.value;
  return Number(hour ?? 0) % 24;
}
