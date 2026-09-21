"use client";

/* ---------------------------------------------------------------------------
   SortSelect — the `/results` sort control, drawn twice

   One native `<select>` in two boxes: the desktop toolbar's 200px field
   (`results-desktop.html:117`) and the mobile sticky bar's bordered half-cell
   (`results-mobile.html:100`). Both are `<span>`s on the artboards — an
   artboard is a snapshot; the element is ours (`src/components/ui/select.tsx`),
   and `docs/decisions.md` §5 makes the native control the rule.

   State is the URL (D44): the component holds none. On change it replaces the
   current href with `resultsHref(withSort(query, value))`, `scroll:false`, so
   the server re-sorts and the page does not jump. `useRouter` comes from
   `next/navigation` and `replace` takes `{ scroll }` — verified in this Next
   version's own docs
   (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md`).

   The desktop `Sort` label is rendered by the toolbar, not here, so it can sit
   in the artboard's `gap:12px` cluster; it points at `id`.
   --------------------------------------------------------------------------- */

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

import { resultsHref, withSort } from "@/features/results/query";
import { SORT_OPTIONS, type ResultsQuery } from "@/features/results/types";

export interface SortSelectProps {
  query: ResultsQuery;
  /** `toolbar` = the desktop 200px field; `bar` = the mobile sticky-bar cell. */
  variant: "toolbar" | "bar";
  id: string;
}

/* Chevron, both variants: `stroke-width:1.6`, `--text-muted`,
   `path d="M6 9l6 6 6-6"` — 16px in the toolbar (results-desktop.html:117),
   14px in the bar (results-mobile.html:100). Stroke width is an SVG attribute,
   not a length utility, so it needs no token. */
function Chevron({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.6}
      className={className}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function SortSelect({ query, variant, id }: SortSelectProps) {
  const router = useRouter();
  /* `isPending` was discarded, so the sort control gave no feedback between
     the change and the re-render. `aria-busy`, not a spinner: no motion, no
     new visual. D66. */
  const [isPending, startTransition] = useTransition();

  /* `key={query.sort}` below re-mounts the select once the server confirms the
     new sort, which drops keyboard focus to <body> — a keyboard user had to Tab
     from the top of the document again after every sort change. Measured live
     before the fix: focus on the select, change, focus lands on BODY. This is
     the same re-focus-by-id pattern filter-panel.tsx uses for its keyed form.
     Craft audit P1 #2. */
  const refocusRef = useRef(false);

  useEffect(() => {
    if (!refocusRef.current) return;
    refocusRef.current = false;
    document.getElementById(id)?.focus({ preventScroll: true });
  }, [query.sort, id]);

  function handleChange(value: string) {
    const sort = SORT_OPTIONS.find((option) => option.value === value);
    if (sort === undefined) return;
    refocusRef.current = true;
    const href = resultsHref(withSort(query, sort.value));
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  const toolbar = variant === "toolbar";

  return (
    <span
      data-probe={toolbar ? "sort-toolbar" : "sort-bar"}
      className={
        toolbar ? "relative inline-block" : "relative block w-full"
      }
    >
      <select
        id={id}
        name="sort"
        aria-label="Sort"
        aria-busy={isPending}
        /* Same bfcache reasoning as the size selects: a restored value would
           silently disagree with `?sort=`. D66. */
        autoComplete="off"
        /* Uncontrolled + `key`: a controlled `value` would snap back to the old
           sort for as long as the transition is pending. `key` re-mounts the
           select once the server has confirmed the new sort. */
        key={query.sort}
        defaultValue={query.sort}
        onChange={(event) => {
          handleChange(event.currentTarget.value);
        }}
        className={[
          /* Both boxes: 44px, no native arrow, instant (no transition on any
             control — globals.css). Focus is 2px --accent at offset 0
             (DESIGN.md §4). */
          "h-11 w-full cursor-pointer appearance-none touch-manipulation",
          "focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-0",
          /* The artboards draw `border:1px solid var(--border-strong)` on both.
             This is a form control, so D14 applies and the hairline is
             `--border-control` — design/DEVIATIONS.md #14. */
          "border border-border-control",
          toolbar
            ? [
                /* results-desktop.html:117 — `min-width:200px;
                   background:var(--surface-2); border-radius:var(--radius-ctl);
                   padding:0 14px`, value `font:700 14px/1 var(--font-body)`.
                   `pr-11.5` = the 14px inset + the 16px chevron + the row's own
                   16px gap, so the value can never run under the mark. */
                "min-w-50 rounded-ctl bg-surface-2",
                "pl-3.5 pr-11.5",
                "font-sans text-14 font-bold leading-flat text-ink",
              ].join(" ")
            : [
                /* results-mobile.html:100 — no fill, no radius, centred
                   `font:500 12px/1; letter-spacing:.06em; uppercase`. A select
                   cannot centre a cluster, so the chevron is absolute and the
                   asymmetric padding (8px left, 14px inset + 14px mark + 8px
                   clearance right) puts the text's centre within ~2px of the
                   artboard's. */
                "bg-transparent text-center",
                "pl-2 pr-9",
                "label text-12 tracking-6 text-ink",
              ].join(" "),
        ].join(" ")}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {/* The bar is drawn reading `Sort: Best match`
                (results-mobile.html:100) — it carries no separate label, so the
                prefix is part of the option copy there. New copy shape, D47(4). */}
            {toolbar ? option.label : `Sort: ${option.label}`}
          </option>
        ))}
      </select>
      <Chevron
        className={
          toolbar
            ? "pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 stroke-ink-muted"
            : "pointer-events-none absolute top-1/2 right-3.5 size-3.5 -translate-y-1/2 stroke-ink-muted"
        }
      />
    </span>
  );
}
