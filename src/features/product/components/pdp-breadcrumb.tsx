import Link from "next/link";

import type { ProductView } from "@/features/product/types";
import { cx } from "@/lib/cx";
import { ROUTES } from "@/lib/routes";

/* ---------------------------------------------------------------------------
   PdpBreadcrumb — Home / Results / <leaf>

   Desktop lives inside the buy panel (`product-desktop.html:107`); mobile is
   hoisted above the gallery (`product-mobile.html:90`) — the page decides
   placement (`product.md` §1 "Change": "hoisted out of the buy panel to page
   level"), this component only renders the trail and takes a `className` so
   the page can position it.

   Desktop: `font:500 12px/1;letter-spacing:.1em;text-transform:uppercase;
   color:var(--text-dim)`, separators `<span style="margin:0 6px">/</span>`,
   current crumb `color:var(--text)` (`product-desktop.html:107`).
   Copy: `Home / Results / Zeta Antarctica Sport`.

   Mobile: `font:500 11px/1`, same tracking/transform/colour, separators are
   plain inline text with NO margin spans (`product-mobile.html:90`).
   Copy: `Home / Results / Antarctica Sport` — the leaf drops the brand
   (`product.md` §2.2).

   The middle crumb's label and target are per-category (D58): `view.config.crumb`
   is `Results` on a tire — artboard-verbatim, unchanged — `Wheels` on a wheel,
   `Accessories` on an accessory; `view.backHref` (`view.config.route` plus the
   inbound query) already routes correctly for all three.

   Both widths render in one pass rather than two breadcrumbs, so there is one
   element in the a11y tree at every width: the leaf is `view.fullName` with
   the brand half wrapped in a `sm:`-only span, which disappears below `sm:`
   and leaves `product.model` alone — exactly the mobile copy.
   --------------------------------------------------------------------------- */

export interface PdpBreadcrumbProps {
  view: ProductView;
  className?: string;
}

export function PdpBreadcrumb({ view, className }: PdpBreadcrumbProps) {
  return (
    /* The nav sets its own line box (D91b, VPE-4). As a plain block around an
       inline `<ol>` it inherited the body's 16px x 1.5 strut, 24px tall, and
       pushed every row below it down. The two artboards draw different boxes,
       and each is reproduced:
       - Desktop: the crumb `<span>` is a flex item of the panel column, so
         it is blockified to `12px/1` and the row is 12px tall
         (`product-desktop.html:107`). Hence `md:text-12 md:leading-flat`.
       - Mobile: the `<span>` sits inline in a plain `<div>` at the page's
         16px Barlow with `line-height: normal` (`product-mobile.html:91`), a
         19px row measured on :4000. Barlow's `normal` is 1.2, which is the
         `leading-tight` token, so `text-16 leading-tight` gives the same row
         with the same baseline (crumb y 89, brand y 541, as drawn).
       The `<ol>`/`<li>` stay inline. The crumbs' `tap-extend-lg` band is an
       `::after` on each link, so the hit area (13 + 32 = 45px, D57 C4) does
       not depend on this line box. */
    <nav
      aria-label="Breadcrumb"
      className={cx("text-16 leading-tight md:text-12 md:leading-flat", className)}
    >
      <ol className="label text-ink-dim tracking-10 m-0 inline list-none p-0 text-11 sm:text-12">
        {/* `tap-extend-lg` on both crumb links. The box is ~13px tall
            (11/12px type at line-height 1), which clears WCAG 2.5.8's 24px AA
            minimum but not this project's 44px floor (`docs/decisions.md`
            §5) — `tap-extend`'s +/-12px band only reaches 13+24=37px here, so
            the crumbs use the +/-16px variant instead: 13+32=45px. Audit
            finding C4 (`design/reports/audit.md`) — not DEVIATIONS #16, which
            covers the card's 22px product-name link (that box alone already
            reaches 46.1px with the smaller band). Like `tap-extend`, the
            utility changes no measured property — no padding, no height, no
            layout shift — so every parity row above is unchanged.

            D92b: both crumbs go up the hierarchy, so both carry `nav-back` and
            the page slides back the way it came; `active:opacity-70` is the
            text-link press. The results crumb also carries `product-back`,
            the type the card's type-keyed `share` answers to, and is
            `prefetch={true}`: the
            reverse morph — gallery photo back into its card — only forms if
            the results page renders in the same commit as the navigation
            rather than suspending first (`vercel-react-view-transitions`
            nextjs.md "When Content Must Be Ready"; `loading.tsx` itself was
            removed in D91b). Home has no card to morph into, so it keeps the default
            prefetch. This breadcrumb is instantiated once and placed twice
            (mobile + desktop copies, `page.tsx`); neither copy holds a named
            VT, so the duplicate is harmless. */}
        <li className="inline">
          <Link
            href={ROUTES.home}
            transitionTypes={["nav-back"]}
            className="tap-extend-lg hover:text-ink-muted active:opacity-70"
          >
            Home
          </Link>
        </li>
        {/* Mobile: plain text, no margin span (`product-mobile.html:90`).
            Desktop: `margin:0 6px` (`product-desktop.html:107`) — `mx-1.5`. */}
        <li aria-hidden="true" className="inline">
          <span className="sm:mx-1.5"> / </span>
        </li>
        <li className="inline">
          <Link
            href={view.backHref}
            transitionTypes={["nav-back", "product-back"]}
            prefetch={true}
            className="tap-extend-lg hover:text-ink-muted active:opacity-70"
          >
            {view.config.crumb}
          </Link>
        </li>
        <li aria-hidden="true" className="inline">
          <span className="sm:mx-1.5"> / </span>
        </li>
        <li className="inline">
          <span className="text-ink" aria-current="page">
            {/* Brand half — desktop only, so the leaf reads `Zeta Antarctica
                Sport` at `sm:` and up and `Antarctica Sport` below it. */}
            <span className="hidden sm:inline">{view.product.brand} </span>
            {view.product.model}
          </span>
        </li>
      </ol>
    </nav>
  );
}
