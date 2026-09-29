/* ---------------------------------------------------------------------------
   SiteHeader — shared nav bar for all three designed routes (D7 / DEVIATIONS
   #11). Server Component; the only client piece is the mobile drawer, which
   is extracted to `site-nav-drawer.tsx` (docs/decisions.md §4 "use client"
   never inside src/app/, only on leaf islands).

   Two variants, one markup: `over-hero` is absolutely positioned inside the
   hero (design/manifest.md:44, "not sticky"); `solid` is the same bar on
   every other route. Both read `background:var(--scrim-strong)` on the
   artboards themselves (home-desktop.html:95, home-mobile.html:77,
   results-desktop.html:86 — the drawn "solid" header) even though
   DESIGN.md §4 describes the non-home header as "--bg". Per the authority
   chain (root llm.md §4, "artboards win on any number") the measured value
   governs; see the deviation noted in the build report.

   Motion (D92b). The header is per page (D38) but must read as one object
   across a navigation, so both variants carry `view-transition-name:
   site-header`, which globals.css pins: never slid, never faded, drawn above
   the content that moves beneath it. The active nav underline is its own
   element inside a named `<ViewTransition>`, so on a category change it
   travels from one item to the next instead of vanishing and reappearing.
   --------------------------------------------------------------------------- */

import Image from "next/image";
import Link from "next/link";
import { ViewTransition } from "react";
import { Button } from "@/components/ui/button";
import { SiteNavDrawer, type SiteNavDrawerLink } from "@/components/site/site-nav-drawer";
import { PRIMARY_CONTACT } from "@/lib/site";
import { ROUTES } from "@/lib/routes";

type NavItemId = "tires" | "wheels" | "accessories" | "contact";

/* Four nav items, in artboard order — design/inventory/home.md:137-139,
   home-desktop.html:100-109. Routes from src/lib/routes.ts (D39). */
const NAV_ITEMS: ReadonlyArray<{ id: NavItemId; label: string; href: string }> = [
  { id: "tires", label: "Tires", href: ROUTES.tires },
  { id: "wheels", label: "Wheels", href: ROUTES.wheels },
  { id: "accessories", label: "Accessories", href: ROUTES.accessories },
  { id: "contact", label: "Contact", href: ROUTES.contact },
];

export function SiteHeader({
  variant,
  active = "tires",
}: {
  variant: "over-hero" | "solid";
  /** Defaults to "tires" — the active item on all three artboards, e.g.
   *  results-desktop.html:93. */
  active?: NavItemId;
}) {
  const drawerLinks: SiteNavDrawerLink[] = NAV_ITEMS.map((item) => ({
    label: item.label,
    href: item.href,
    active: item.id === active,
  }));

  return (
    <header
      /* D92b: pinned through every route transition — see the file header and
         `::view-transition-group(site-header)` in globals.css. An inline
         style because Tailwind has no utility for the property and an
         arbitrary value is banned (.claude/rules/ui.md "Tokens only"). */
      style={{ viewTransitionName: "site-header" }}
      className={
        variant === "over-hero"
          ? /* absolute inset-x-0 top-0 z-10 — design/manifest.md:44 (not sticky) */
            "bg-scrim-strong border-border absolute inset-x-0 top-0 z-10 h-17 border-b sm:h-22"
          : /* solid: static bar, same background as measured on the artboards
               (results-desktop.html:86) — see deviation note above. */
            "bg-scrim-strong border-border h-17 border-b sm:h-22"
      }
    >
      <nav
        aria-label="Primary"
        /* h-17 (68px) → h-22 (88px) from sm: — design/inventory/home.md:28-29;
           DESIGN.md §8 gives 88px at tablet too (~line 297). px-4 (16px) →
           px-8 (32px tablet, DESIGN.md §8 page padding) → px-12 (48px desktop,
           home-desktop.html:95). */
        className="flex h-full items-center justify-between px-4 sm:px-8 md:px-12"
      >
        {/* Logo — 512x507 intrinsic (public/images/logo/platinum-wheels-logo-transparent.webp).
            52px mobile → 64px desktop: h-13 (52px, home-mobile.html:79) →
            sm:h-16 (64px, home-desktop.html:97/results-desktop.html:88). No
            wordmark (D7). `nav-back` (D92b): home is the top of the
            hierarchy, so leaving for it slides the page the way a breadcrumb
            does. `active:opacity-70` is the text-link press (D92b). */}
        <Link
          href={ROUTES.home}
          transitionTypes={["nav-back"]}
          className="flex items-center gap-2.5 active:opacity-70"
        >
          <Image
            src="/images/logo/platinum-wheels-logo-transparent.webp"
            alt="Platinum Wheels"
            width={512}
            height={507}
            sizes="(min-width: 720px) 65px, 53px"
            priority
            className="h-13 w-auto sm:h-16"
          />
        </Link>

        {/* Desktop link row — gap-10 (40px, home-desktop.html:100), hidden
            below md: (1100px), tablet band collapses it to the hamburger
            (DESIGN.md §8 "88px, items collapse"). */}
        <div className="hidden items-center gap-10 md:flex">
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === active;
            return (
              <Link
                key={item.id}
                href={item.href}
                /* label text-13 tracking-10 py-2 border-b-2 — home-desktop.html:102-108.
                   Active: text-on-photo + border-accent. Inactive: the artboard's
                   rgba(244,244,245,.68) is the `--color-on-photo-muted` token (home.md:393)
                   is a Tailwind v4 opacity modifier on the token; flagged for
                   emission verification in the build report. Hover is the global
                   `a:hover` → --text-muted, implemented here as hover:text-ink-muted
                   on inactive links only; the base layer eases it over
                   `--duration-feedback` since D92b (DEVIATIONS #75).

                   D92b (DEVIATIONS #76): inactive links add `nav-rule`, a 2px
                   `--border-strong` rule that draws in from the left on hover
                   in the slot the active underline occupies. The active link's
                   drawn `border-accent border-b-2` becomes `border-b-2
                   border-transparent` plus a `nav-indicator` span — the same
                   2px `--accent` bar at the same `bottom:-2px`, so the box is
                   byte-identical — because only an element of its own can be
                   named and carried between items by a view transition.

                   `prefetch={true}`: a shared `nav-indicator` morph only forms
                   if the destination renders in the same transition. A route
                   that suspends into `loading.tsx` renders the skeleton
                   instead, and the incoming half of the pair never exists
                   (vercel-react-view-transitions, references/nextjs.md "When
                   Content Must Be Ready"). A full prefetch makes the three
                   category pages ready before the click. */
                prefetch={true}
                className={
                  isActive
                    ? "label text-13 tracking-10 text-on-photo relative border-b-2 border-transparent py-2"
                    : "label text-13 tracking-10 text-on-photo-muted hover:text-ink-muted nav-rule border-b-2 border-transparent py-2 active:opacity-70"
                }
              >
                {item.label}
                {isActive ? (
                  /* The span must be the boundary's direct child, and `share`
                     must be explicit: `default="none"` would otherwise resolve
                     the pair to none and the bar would never travel. */
                  <ViewTransition name="nav-indicator" share="auto" default="none">
                    <span aria-hidden="true" className="nav-indicator" />
                  </ViewTransition>
                ) : null}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* Phone CTA — accent Button, compact size, visible from sm: (720px).
              No gap override: the `compact` size's own `gap-2.5 sm:gap-3` is
              what ships. An earlier `sm:gap-2.5` here (meant to hold the
              artboard's 10px icon gap past 720px) was removed when the
              override proved unreliable — same-specificity classes resolve by
              emission order, not JSX order (`HANDOFF.md` §8.3). This comment
              described that class for a while after it was gone; corrected
              2026-09-21 (D61, audit finding S4). */}
          <div className="hidden sm:block">
            <Button href={`tel:${PRIMARY_CONTACT.tel}`} variant="accent" size="compact">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
              </svg>
              Call {PRIMARY_CONTACT.display}
            </Button>
          </div>

          {/* Mobile-only 44x44 circular accent call button — home-mobile.html:84-86.
              rounded-full is drawn (border-radius:50%, design/inventory/home.md:589)
              and is the whitelisted exception to "nothing is a pill".
              `hover:bg-accent-hover` added 2026-09-22 (D66): the button was
              `bg-accent` in every state, the only accent CTA in the build with
              no hover. `--accent-hover` is the existing "CTA hover fill
              (instant)" token (globals.css:43) and is exactly what the primary
              Button uses (button.tsx:131). Tailwind v4 compiles `hover:` to
              `@media (hover: hover)` itself (D17), so no hand-rolled query.
              Since D92b the fill eases over `--duration-feedback` (base layer,
              DEVIATIONS #75) and a press sinks it 1px, the boxed-control press
              `Button` uses. */}
          <a
            href={`tel:${PRIMARY_CONTACT.tel}`}
            aria-label="Call now"
            className="bg-accent hover:bg-accent-hover text-on-accent inline-flex size-11 touch-manipulation items-center justify-center rounded-full active:translate-y-px sm:hidden"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
            </svg>
          </a>

          {/* Drawer trigger — visible below md: (1100px), the tablet band
              keeps it alongside the pill CTA once the link row collapses. */}
          <div className="md:hidden">
            <SiteNavDrawer
              links={drawerLinks}
              phone={{ display: PRIMARY_CONTACT.display, tel: PRIMARY_CONTACT.tel }}
            />
          </div>
        </div>
      </nav>
    </header>
  );
}
