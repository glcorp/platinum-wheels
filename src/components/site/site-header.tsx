/* ---------------------------------------------------------------------------
   SiteHeader — shared nav bar for all three designed routes (D7 / DEVIATIONS
   #11). Server Component; the client pieces are the mobile drawer, which
   is extracted to `site-nav-drawer.tsx` (docs/decisions.md §4 "use client"
   never inside src/app/, only on leaf islands).

   D122 adds the cart link (`cart-link.tsx`, the second client island here)
   between the phone CTA and the menu, at every width.

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

   D128: the desktop link row is `site-nav-links.tsx`, a third client island,
   so that on `/` (`finderSwitch`) the category links switch the hero finder
   instead of leaving the page. The header itself stays a Server Component.
   --------------------------------------------------------------------------- */

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CartLink } from "@/components/site/cart-link";
import { SiteNavDrawer, type SiteNavDrawerLink } from "@/components/site/site-nav-drawer";
import {
  SiteNavLinks,
  type NavItemId,
  type SiteNavItem,
} from "@/components/site/site-nav-links";
import { FINDER_SWITCH_HINT_ID } from "@/lib/finder-category";
import { PRIMARY_CONTACT } from "@/lib/site";
import { ROUTES } from "@/lib/routes";

/* Four nav items, in artboard order — design/inventory/home.md:137-139,
   home-desktop.html:100-109. Routes from src/lib/routes.ts (D39). */
const NAV_ITEMS: ReadonlyArray<SiteNavItem> = [
  { id: "tires", label: "Tires", href: ROUTES.tires },
  { id: "wheels", label: "Wheels", href: ROUTES.wheels },
  { id: "accessories", label: "Accessories", href: ROUTES.accessories },
  { id: "contact", label: "Contact", href: ROUTES.contact },
];

export function SiteHeader({
  variant,
  active,
  finderSwitch = false,
}: {
  variant: "over-hero" | "solid";
  /** The current nav item. Every drawn route passes its own explicitly
   *  (tires on `/`, `/tires` and tire PDPs, results-desktop.html:93). Omitted
   *  means NO item is current, which is what `/about`, `/privacy`, `/terms`
   *  and the 404 need: they belong to none of the four. It used to default to
   *  "tires", so those pages marked Tires as current in the desktop row and
   *  the mobile drawer alike. */
  active?: NavItemId;
  /** `/` only (D128): Tires / Wheels / Accessories switch the hero finder
   *  instead of navigating, in the desktop row and the drawer, and the active
   *  marker follows the finder. Every other page leaves it off. */
  finderSwitch?: boolean;
}) {
  const drawerLinks: SiteNavDrawerLink[] = NAV_ITEMS.map((item) => ({
    id: item.id,
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
      /* px-4 (16px) → px-8 (32px tablet, DESIGN.md §8 page padding) → px-12
         (48px desktop, home-desktop.html:95). The side padding sits on the bar,
         not the nav (D141), so the background and hairline stay full-bleed
         while the nav below takes the page's 1344px frame. */
      className={
        variant === "over-hero"
          ? /* absolute inset-x-0 top-0 z-10 — design/manifest.md:44 (not sticky) */
            "bg-scrim-strong border-border absolute inset-x-0 top-0 z-10 h-17 border-b px-4 sm:h-22 sm:px-8 md:px-12"
          : /* solid: static bar, same background as measured on the artboards
               (results-desktop.html:86) — see deviation note above. */
            "bg-scrim-strong border-border h-17 border-b px-4 sm:h-22 sm:px-8 md:px-12"
      }
    >
      <nav
        aria-label="Primary"
        /* h-17 (68px) → h-22 (88px) from sm: — design/inventory/home.md:28-29;
           DESIGN.md §8 gives 88px at tablet too (~line 297). D141: from lg:
           the row is capped at the 1344px content frame and centred, the
           `lg:mx-auto lg:max-w-content` idiom every page uses, so above 1440
           the logo and the cart/menu line up with the page edges. At 1440 the
           bar's content box is already 1440 − 2×48 = 1344, so nothing moves. */
        className="flex h-full items-center justify-between lg:mx-auto lg:max-w-content"
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
            (DESIGN.md §8 "88px, items collapse"). The links themselves are
            `SiteNavLinks`, a leaf island since D128 so that on `/` they can
            switch the hero finder; their classes and the travelling
            `nav-indicator` (D92b) moved there unchanged. */}
        <div data-print="hide" className="hidden items-center gap-10 md:flex">
          <SiteNavLinks items={NAV_ITEMS} active={active} finderSwitch={finderSwitch} />
        </div>

        {finderSwitch ? (
          /* D128: the one description both link sets point at on `/`
             (`aria-describedby`), so a screen reader hears what the category
             links do here before activating one. Outside the `md:`-only row
             because the drawer's links use it too. */
          <span id={FINDER_SWITCH_HINT_ID} className="sr-only">
            Changes the vehicle finder on this page
          </span>
        ) : null}

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

          {/* Cart — every width, after the phone and before the menu (D122,
              owner ruling "Between phone and menu"; never inside the drawer).
              A client island: the count lives in the browser. */}
          <CartLink />

          {/* Drawer trigger — visible below md: (1100px), the tablet band
              keeps it alongside the pill CTA once the link row collapses. */}
          <div className="md:hidden">
            <SiteNavDrawer
              links={drawerLinks}
              finderSwitch={finderSwitch}
              phone={{ display: PRIMARY_CONTACT.display, tel: PRIMARY_CONTACT.tel }}
            />
          </div>
        </div>
      </nav>
    </header>
  );
}
