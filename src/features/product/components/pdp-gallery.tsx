import Image from "next/image";
import { ViewTransition } from "react";

import { productImageSrc } from "@/features/catalog/types";

import { Badge } from "@/components/ui/badge";
import type { PdpBadge } from "@/features/product/types";

/* ---------------------------------------------------------------------------
   PdpGallery — one image, no thumbs, no dots, no arrows, no zoom (D53(4);
   `product.md` §4 "Behaviour implied by the markup": no `<button>`, no thumb
   list, no scroll container, no zoom affordance, no lightbox).

   Desktop box (`product-desktop.html:102`): `aspect-ratio:1/1;
   background:var(--bg);overflow:hidden;border:1px solid var(--border)`,
   computed 704×704px. No badges here — they live in the buy panel
   (`product.md` §4 "No badges overlaid on the desktop gallery").

   Mobile box (`product-mobile.html:91`): full-bleed `margin-top:16px;
   position:relative;aspect-ratio:1/1;overflow:hidden` — 390×390px, NO
   border, NO explicit background (inherits `--bg` from the page). Badge row
   overlays the image `top:16px;left:16px;gap:6px` (`product.md` §3.1).

   Image: `object-fit:contain;padding:8%` (`photo-inset-gallery`,
   globals.css). This is the route's LCP element — `loading="eager"` +
   `fetchPriority="high"`, not `priority`, per `HANDOFF.md` §8.6 and the same
   reasoning `ProductCard`'s `priority` prop documents (deprecated prop,
   ambiguous LCP candidate across widths does not apply here since there is
   exactly one PDP image, but the eager+fetchPriority pairing is the same
   sanctioned mechanism).

   Overlay: `radial-gradient(ellipse at center,transparent 55%,
   var(--scrim-mid) 100%)` — `photo-vignette-gallery` (globals.css), the 55%
   stop that distinguishes it from the cards' 50% (`photo-vignette`).

   Shared element (D92b): the `<Image>` sits in a `<ViewTransition>` named
   `product-photo-<slug>` — the SAME name `ProductCard` gives its photo — so
   the card photo in the grid, the home row or the similar row morphs into
   this box on the way in, and back into the card on the way out (the
   breadcrumb's results crumb is fully prefetched for that reason). The name
   is unique on the page: the gallery renders once and `Similar products`
   excludes this product (D52). `share="morph"` is a plain string here on
   purpose: the gallery is the one fixed end of every pair. The CARD side is
   type-keyed (`product-open` / `product-back`, `product-card.tsx`), so only a
   navigation that opens a product or returns from one to its results page
   pairs a card with this box; card↔card pairs between other pages resolve to
   `none`, and the similar row below renders its cards with `morph={false}`
   so they never pair at all. `share` must be explicit because with
   `default="none"` and no `share` the pair silently never morphs;
   `default="none"` keeps the photo out of every other transition on the
   page — a `?qty=` click must not crossfade the gallery. Only the `<img>` is
   named; the frame, vignette and badge row stay part of the page and do not
   travel.
   --------------------------------------------------------------------------- */

export interface PdpGalleryProps {
  brand: string;
  model: string;
  slug: string;
  /** Cut-out basename when it differs from `slug`, or an absolute path for
   *  the accessories escape hatch (`Product.image`, D43, D58). */
  image?: string;
  /** Mobile-only badge overlay (`product.md` §3.1). Omit to render no
   *  overlay — the desktop caller never passes it (badges live in the buy
   *  panel there). */
  badges?: readonly PdpBadge[];
}

export function PdpGallery({ brand, model, slug, image, badges }: PdpGalleryProps) {
  return (
    /* Desktop's `display:flex;flex-direction:column;gap:12px` column wrapper
       around the one image box (`product-desktop.html:102`) — the gap is
       inert with a single child (`product.md` §4), so it costs nothing on
       mobile, which draws no such wrapper at all. */
    <div className="flex flex-col gap-3">
      {/* The image box itself: 1:1 at both widths. Desktop adds the border
          and explicit `--bg` fill and drops the mobile `margin-top:16px`
          (`product-desktop.html:102` vs `product-mobile.html:91`). */}
      {/* The frame crosses at `md:`, not `sm:`: below 1100 the page keeps the
          mobile stacked arrangement with no side padding, so the image is
          full-bleed and a border would sit flush against the viewport edge.
          It becomes the drawn 704px framed box only once the split activates
          (the same crossover the split itself takes — see `page.tsx`). */}
      <div className="relative mt-4 aspect-square overflow-hidden md:mt-0 md:border md:border-border md:bg-bg">
        <ViewTransition
          name={`product-photo-${slug}`}
          share="morph"
          default="none"
        >
          <Image
            /* One resolver for the card and the gallery, so an accessory
               cannot render its photo in the grid and a 404 on its own page
               (`productImageSrc`, D58). */
            src={productImageSrc({ image, slug })}
            alt={`${brand} ${model}`}
            width={1000}
            height={1000}
            /* The box is 704px only once the split activates at `md:` 1100 (see
               the frame comment below); from 0 to 1099 the gallery is full-bleed,
               so it is `100vw` there. Declaring 704px from 720 made the browser
               pick a candidate ~1/3 the rendered width in the 720-1099 band and
               upscale it. Crossover must match the frame's, not the type's. */
            sizes="(min-width: 1100px) 704px, 100vw"
            loading="eager"
            fetchPriority="high"
            className="photo-inset-gallery block h-full w-full object-contain"
          />
        </ViewTransition>
        <div
          aria-hidden="true"
          className="photo-vignette-gallery absolute inset-0"
        />
        {/* `position:absolute;top:16px;left:16px;display:flex;gap:6px`
            (`product-mobile.html:91`), mobile only — desktop's badge row
            lives in the buy panel. The mobile 3PMSF instance drops the
            snowflake mark and uses the plain outline style (`product.md`
            §3.1: "3PMSF drops the svg"), which is exactly what the shared
            `Badge` primitive renders when given only `badge.label`. */}
        {badges !== undefined && badges.length > 0 ? (
          <div className="absolute top-4 left-4 flex gap-1.5 sm:hidden">
            {badges.map((badge) => (
              <Badge key={badge.label} variant={badge.variant}>
                {badge.label}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
