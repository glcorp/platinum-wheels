/* ---------------------------------------------------------------------------
   SiteFooter — shared by all three designed routes
   (design/inventory/home.md §2.10 "footer", lines 337-361).
   --------------------------------------------------------------------------- */

import Image from "next/image";
import Link from "next/link";
import { PRICES_VISIBLE, SITE } from "@/lib/site";
import { ROUTES } from "@/lib/routes";
import { shopYear } from "@/lib/time";

export function SiteFooter() {
  // Year computed at render — never hard-coded (D32). Drives both "Winter
  // <year>" below and the "© <year>" bottom-bar line.
  const year = shopYear();

  // Shop / Company / Legal columns — verbatim copy, home.md:351-355.
  const linkColumns = [
    {
      heading: "Shop",
      links: [
        { label: "Tires", href: ROUTES.tires },
        { label: "Wheels", href: ROUTES.wheels },
        { label: "Accessories", href: ROUTES.accessories },
        { label: `Winter ${year}`, href: ROUTES.winter },
      ],
    },
    {
      heading: "Company",
      links: [
        { label: "About the shop", href: ROUTES.about },
        { label: "How it works", href: ROUTES.howItWorks },
        { label: "Contact", href: ROUTES.contact },
      ],
    },
    {
      heading: "Legal",
      links: [
        { label: "Privacy Policy", href: ROUTES.privacy },
        { label: "Terms & Conditions", href: ROUTES.terms },
      ],
    },
  ] as const;

  return (
    <footer
      /* border-t border-border-strong — home.md:339. padding 56px 16px 120px
         mobile (home-mobile.html:336) → 80px 48px 40px desktop
         (home-desktop.html:381); tablet side padding 32px, DESIGN.md §8. The
         mobile wrapper's margin-top:56px (home-mobile.html:335) is the page's
         section gap, not the footer's own — composed by the page, per the
         BUILD SPEC. */
      className="bg-bg border-border-strong border-t px-4 pt-14 pb-30 sm:px-8 sm:pt-20 sm:pb-10 md:px-12"
    >
      {/* Top grid: 1 col mobile, 1.2fr/1fr from sm: — sm:grid-cols-11 with
          6/5 split (6:5 = 1.2:1 exactly, home.md:341/346). gap 40px mobile
          (home-mobile.html:337) → 24px desktop (home-desktop.html:382). */}
      {/* D141: both rows take the page's 1344px frame from lg:, centred
          (`lg:mx-auto lg:max-w-content`), so above 1440 the logo and the last
          column end on the content edges; the background and top border stay
          full-bleed on the <footer>. At 1440 the content box is already
          1440 − 2×48 = 1344, so nothing moves. */}
      <div className="grid grid-cols-1 gap-10 sm:grid-cols-11 sm:gap-6 lg:mx-auto lg:max-w-content">
        <div className="flex flex-col items-start gap-4 sm:col-span-6">
          {/* Logo — 120px at every width, home.md:343/85. Same file as the
              header; 512x507 intrinsic. */}
          <Image
            src="/images/logo/platinum-wheels-logo-transparent.webp"
            alt="Platinum Wheels"
            width={512}
            height={507}
            sizes="121px"
            className="h-30 w-auto"
          />
          {/* The three social squares (Instagram/Facebook/Google Business,
              home-desktop.html:386-388) are omitted — D34, "No social links
              yet". */}
        </div>

        {/* Right: link columns — grid-cols-2 gap-10 mobile (home-mobile.html:346,
            three children wrap 2+1) → sm:grid-cols-3 sm:gap-6 desktop
            (home-desktop.html:391). */}
        <div
          /* `id`: the no-JS target of the header Menu link (NJR-5, D91b;
             `site-nav-drawer.tsx`). A `div`, not a `<nav>`: a second labelled
             landmark would be new copy, and an unlabelled one fails axe's
             landmark-unique. The header is static, so no `scroll-mt` is needed;
             the "Shop" heading is the first thing in the box. */
          id="site-footer-nav"
          className="grid grid-cols-2 gap-10 sm:col-span-5 sm:grid-cols-3 sm:gap-6"
        >
          {linkColumns.map((column) => (
            <div key={column.heading} className="flex flex-col gap-3">
              <span className="label text-11 tracking-12 text-ink-dim">
                {column.heading}
              </span>
              {column.links.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  /* text-15 leading-normal text-ink-muted py-1 hover:text-ink —
                     home.md:347-349. tap-extend recovers the 44px tap-target
                     floor without changing the measured box (DEVIATIONS #16).
                     `active:opacity-70` is the text-link press (D92b); the
                     hover colour itself eases over `--duration-feedback` in
                     the base layer (DEVIATIONS #75). `break-words` (D91b,
                     KBD-7): at 768 a column is 86px and `Accessories` needs
                     79px, so a reader's text-spacing override pushed the word
                     13px past it; it now breaks only when it would overflow,
                     which at default spacing is never. */
                  className="tap-extend text-15 leading-normal text-ink-muted hover:text-ink py-1 break-words active:opacity-70"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar — mt-12 pt-6 (48px/24px, home-desktop.html:428) border-t
          border-border. Byte-identical on both artboards. */}
      <div className="border-border mt-12 flex flex-wrap justify-between gap-3 border-t pt-6 lg:mx-auto lg:max-w-content">
        <span className="text-13 leading-relaxed text-ink-dim">
          {/* Artboard reads "© 2026 Platinum Wheels and Tire Solutions Inc."
              (home-desktop.html:429); SITE.legalName now carries the "Inc."
              itself, so nothing is appended here. Year computed at render
              (D32). */}
          © {year} {SITE.legalName}
        </span>
        {/* D122: the currency line only while prices show. */}
        <span className="text-13 leading-relaxed text-ink-dim">
          {PRICES_VISIBLE ? SITE.priceNote : SITE.placeNote}
        </span>
      </div>
    </footer>
  );
}
