/* ---------------------------------------------------------------------------
   The admin home's greeting (D118).

   Owner, 2026-10-01: the admin home is a welcome "like welcome {back} back is
   dynamic how its there in claude code where its always some personalised
   message according to time". Rotating lines per time band, chosen fresh on
   every visit; no name, because the sign-in is one shared account (D95).

   The band is read in Brampton time (`@/lib/time`), never the server's UTC.
   New copy under `.claude/rules/ui.md` "Copy": short, declarative, no
   exclamation marks, no emoji. The owner may rewrite any line; the bands are
   the structure, the lines are copy.
   --------------------------------------------------------------------------- */

import { shopHour } from "@/lib/time";

type Band = "morning" | "afternoon" | "evening" | "night";

const LINES: Record<Band, readonly string[]> = {
  morning: [
    "Good morning.",
    "Morning. Coffee first?",
    "Morning. Let's get the day moving.",
    "Welcome back. Early start today.",
  ],
  afternoon: [
    "Good afternoon.",
    "Welcome back.",
    "Afternoon. How's the day going?",
    "Back at it.",
  ],
  evening: [
    "Good evening.",
    "Evening. Wrapping up the day?",
    "Welcome back.",
    "Evening shift.",
  ],
  night: [
    "Working late.",
    "Burning the midnight oil.",
    "Late one tonight.",
    "Still at it. Don't stay up too late.",
  ],
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
