/* ---------------------------------------------------------------------------
   The admin home's greeting (D118).

   Owner, 2026-10-01: the admin home is a welcome "like welcome {back} back is
   dynamic how its there in claude code where its always some personalised
   message according to time". One line per time band since D140 (owner,
   2026-10-04, "Plain greetings"), which replaced the rotating lines; the
   picker still takes a list, so a band can hold more than one again. No
   name, because the sign-in is one shared account (D95).

   The band is read in Brampton time (`@/lib/time`), never the server's UTC.
   New copy under `.claude/rules/ui.md` "Copy": short, declarative, no
   exclamation marks, no emoji. The owner may rewrite any line; the bands are
   the structure, the lines are copy.
   --------------------------------------------------------------------------- */

import { shopHour } from "@/lib/time";

type Band = "morning" | "afternoon" | "evening" | "night";

const LINES: Record<Band, readonly string[]> = {
  morning: ["Good morning."],
  afternoon: ["Good afternoon."],
  evening: ["Good evening."],
  night: ["Working late."],
};

function bandFor(hour: number): Band {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

/** One line for the current Brampton hour. `pick` is a number in [0, 1):
 *  random by default, fixed where a stable line is wanted. */
export function greetingFor(now: Date, pick: number = Math.random()): string {
  const lines = LINES[bandFor(shopHour(now))];
  return lines[Math.min(Math.floor(pick * lines.length), lines.length - 1)];
}
