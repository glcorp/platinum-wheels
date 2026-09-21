/**
 * Class-string helpers.
 *
 * Consolidated on 2026-09-21 from 13 identical, independently hand-rolled
 * copies scattered across `src/components/ui/` and three feature folders —
 * audit finding S2 (`design/reports/audit.md` §4 S2), decision **D63**. Every
 * copy was byte-identical in behaviour; only the location differed. This is
 * the one place either now lives.
 *
 * `cx` and `join` are kept as two separate functions, not merged into one,
 * because they are not interchangeable:
 * - `cx` is variadic and filtering — pass any number of class fragments,
 *   including `false`/`null`/`undefined` (typically from inline conditionals),
 *   and it drops the falsy ones and joins the rest with a single space.
 * - `join` is the two-argument base-then-optional-override idiom — a fixed
 *   `base` class string with an optional `extra` appended after it. It
 *   preserves that base-first argument order rather than filtering a list,
 *   which is what every call site using it relies on.
 *
 * Do not "improve", merge, sort, or deduplicate these. No `clsx` or
 * `tailwind-merge`. Several call sites carry parity-measured class output —
 * changing what either function emits for any existing call site is a
 * parity failure, not a cleanup.
 */

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function join(base: string, extra?: string): string {
  return extra ? `${base} ${extra}` : base;
}
