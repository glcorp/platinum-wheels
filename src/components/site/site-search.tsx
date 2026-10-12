"use client";

/* ---------------------------------------------------------------------------
   SiteSearch — the header's search icon and the field it opens (D173).

   Owner, 2026-10-11, choosing "Icon opens a field (Recommended)": a search
   icon in the header at every width, beside the cart, opens a field pinned
   under the bar. The bar itself never grows, so nothing below it moves at
   rest, and the home finder's CTA stays above the fold (D128, D158).

   Leaf island. Until it hydrates, and with JS off, the icon is a plain link
   to `/search`, whose own field is a GET form; nothing depends on this
   script. Once hydrated it is a toggle: the panel opens with the field
   focused, and Esc, the close button, a click outside it or a submit closes
   it. A submit is `next/form` with a string action, a GET to `/search?q=`
   (client navigation, the loader starts as for any GET form, D92b). It does
   not import `src/features/search` (D37): it only posts `q` to the route.

   D177 (owner, 2026-10-11: "on search icon, hover doesnt change to hand,
   keep left of call, also add a search box with search texxt and icon"):
   from `sm:` (720) the header carries a real search box instead of the
   icon, a magnifier and a `Search` placeholder inside a bordered field, left
   of the phone CTA; Enter sends it to `/search?q=`. It is a plain GET form,
   so it works before hydration and with JS off. Below 720 the bar has no
   room for a box beside the logo, call, cart and menu, so the icon and its
   panel stay, now left of the call button too. Every control here shows the
   pointer: a `<button>` is `cursor: default` under Tailwind's preflight.

   The panel is `absolute top-full` inside the header, which is `fixed` on
   `/` and `sticky` elsewhere, so it stays pinned with it. It takes the
   header's own side padding and the 1344px frame (D141), and a hairline on
   both edges so it reads as a second row of the bar. Motion: the cart
   prompt's `enter-rise` (D92b tokens), killed by reduced motion like every
   transition.
   --------------------------------------------------------------------------- */

import Form from "next/form";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/lib/routes";

const subscribeNever = () => () => {};
function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}

/** Longest query `/search` reads (`QUERY_MAX_LENGTH` in
 *  `src/features/search/parse.ts`, which this file may not import). */
const MAX_LENGTH = 100;

/* `sm:hidden`: from 720 the box below replaces the icon (D177). */
const TRIGGER_CLASS =
  "text-on-photo inline-flex size-11 cursor-pointer touch-manipulation items-center justify-center bg-transparent active:translate-y-px sm:hidden";

/* The header box (D177): 44px, the header's control height (the call pill
   and the icons), on the field recipe's tokens (`fieldBoxClasses`): the
   `--surface-2` fill, `--border-control` edge, `--border-ink-dim` on hover
   and the accent focus. 16px value, the inputs' floor (`.claude/rules/ui.md`),
   regular weight so the placeholder reads as a hint. The icon sits inside
   the left padding and ignores the pointer, so a click on it focuses the field. */
const BOX_CLASS =
  "bg-surface-2 rounded-ctl border-border-control hover:border-ink-dim text-ink placeholder:text-ink-muted focus-visible:border-accent focus-visible:outline-accent h-11 w-44 cursor-pointer touch-manipulation border pr-3 pl-10 font-sans text-16 leading-flat focus-visible:cursor-text focus-visible:outline-2 focus-visible:outline-offset-0 md:w-52";

/* 22x22, stroke 1.6, round caps: the menu and cart icons' drawing. */
const SEARCH_ICON = (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5L21 21" />
  </svg>
);

/* The box's magnifier: the same drawing at 18px, `--text-muted`. */
const BOX_ICON = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    aria-hidden="true"
    className="text-ink-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
  >
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5L21 21" />
  </svg>
);

/** The header search box, 720 and up (D177). */
function SearchBox() {
  const id = useId();
  return (
    <Form action={ROUTES.search} role="search" className="relative hidden sm:block">
      <label htmlFor={id} className="sr-only">
        Search by tire size, wheel size, part number or brand
      </label>
      {BOX_ICON}
      <input
        id={id}
        name="q"
        type="search"
        inputMode="search"
        maxLength={MAX_LENGTH}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="search"
        placeholder="Search"
        className={BOX_CLASS}
      />
    </Form>
  );
}

export function SiteSearch() {
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const inputId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Close when the page changes (a link in the panel's wake, Back).
     "Adjusting state when a prop changes", during render: the project's
     `react-hooks/set-state-in-effect` rule rejects the effect form (D84).
     The pathname only: `useSearchParams` here would opt every static page
     the header sits on into client rendering. A submit closes the panel
     itself (`onSubmit`), which covers `/search` → `/search?q=…`. */
  const pathname = usePathname();
  const [seen, setSeen] = useState(pathname);
  if (seen !== pathname) {
    setSeen(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  /* A press outside the panel and its trigger closes it. */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  if (!hydrated) {
    return (
      <>
        <SearchBox />
        <a href={ROUTES.search} aria-label="Search" className={TRIGGER_CLASS}>
          {SEARCH_ICON}
        </a>
      </>
    );
  }

  return (
    <>
      <SearchBox />
      <button
        ref={triggerRef}
        type="button"
        aria-label="Search"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={TRIGGER_CLASS}
      >
        {SEARCH_ICON}
      </button>

      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
          }}
          className="bg-bg border-border enter-rise absolute inset-x-0 top-full border-y px-4 py-3 sm:px-8 sm:py-4 md:px-12"
        >
          <Form
            action={ROUTES.search}
            role="search"
            onSubmit={() => setOpen(false)}
            className="flex items-center gap-2 lg:mx-auto lg:max-w-content"
          >
            <label htmlFor={inputId} className="sr-only">
              Search by tire size, wheel size, part number or brand
            </label>
            <Input
              ref={inputRef}
              id={inputId}
              name="q"
              type="search"
              maxLength={MAX_LENGTH}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="search"
              placeholder="245/35R19, Michelin"
              className="min-w-0 flex-1"
            />
            <Button type="submit" variant="primary" size="promo" aria-label="Search" className="shrink-0">
              <span className="sm:hidden">{SEARCH_ICON}</span>
              <span className="hidden sm:inline">Search</span>
            </Button>
            <button
              type="button"
              aria-label="Close search"
              onClick={close}
              className="text-ink inline-flex size-11 shrink-0 cursor-pointer touch-manipulation items-center justify-center bg-transparent active:translate-y-px"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M5 5l14 14M19 5L5 19" />
              </svg>
            </button>
          </Form>
        </div>
      ) : null}
    </>
  );
}
