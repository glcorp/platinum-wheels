import Image from "next/image";
import { ViewTransition } from "react";

import { ProductPhotoPlaceholder } from "@/features/catalog/components/product-photo-placeholder";
import { photoSized, photoSource } from "@/features/catalog/photo-files";
import { productImageSrc, type AccessoryType } from "@/features/catalog/types";

import { Badge } from "@/components/ui/badge";
import { PdpGalleryCarousel } from "@/features/product/components/pdp-gallery-carousel";
import type { PdpBadge } from "@/features/product/types";
import { productName } from "@/lib/product-name";

/* ---------------------------------------------------------------------------
   PdpGallery — every photo of the product (D167; owner, 2026-10-11: "if the
   product has multiple images, then on the product page, multiple images
   should be displayed"). One photo, or none, renders exactly as drawn: one
   image, no thumbs, no dots, no arrows, no zoom (D53(4), `product.md` §4).
   Two or more go to `PdpGalleryCarousel`, a leaf island: a swipeable
   scroll-snap track, arrows and a `2 / 5` counter on the photo, and
   thumbnails under it from 1100. D53(4)'s "one image" is superseded for
   products with several photos; `DEVIATIONS.md` #133.

   Only the FIRST photo is the morph's end (D92b, D144): it keeps the
   `product-photo-<slug>` name and the card-size underlay, so a card still
   flies into the first slide. The others are plain lazy images.

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
   page — a `?qty=` click must not crossfade the gallery. The named element is
   a wrapper holding the picture (or tile), the card-size underlay and the
   vignette, so the arriving snapshot holds a picture from its first frame
   and nothing changes when the morph ends (owner, 2026-10-04, "the image
   transition is not smooth"; `globals.css` `.morph`). The frame and the
   mobile badge row stay part of the page and do not travel.
   --------------------------------------------------------------------------- */

/* The image box itself: 1:1 at both widths. Desktop adds the border and
   explicit `--bg` fill and drops the mobile `margin-top:16px`
   (`product-desktop.html:102` vs `product-mobile.html:91`). The frame and
   `pdp-gallery-band` are explained where the box renders, below; one string,
   so the single photo and the gallery cannot drift. */
const BOX =
  "pdp-gallery-band relative mt-4 overflow-hidden md:aspect-square md:mt-0 md:border md:border-border md:bg-bg";

export interface PdpGalleryProps {
  /** `null` on an unbranded accessory (D125). */
  brand: string | null;
  model: string;
  /** Names the shared-element transition this box is one end of (D92b). */
  slug: string;
  /** The product's photo (`Product.image`). Absent = the placeholder tile. */
  image?: string;
  /** Every photo, in order, the first being `image` (`Product.images`,
   *  D167). Two or more turn the box into a gallery. */
  images?: readonly string[];
  /** Printed in the placeholder tile when there is no brand (D133). */
  accessoryType?: AccessoryType;
  /** Mobile-only badge overlay (`product.md` §3.1). Omit to render no
   *  overlay — the desktop caller never passes it (badges live in the buy
   *  panel there). */
  badges?: readonly PdpBadge[];
}

export function PdpGallery({
  brand,
  model,
  slug,
  image,
  images,
  accessoryType,
  badges,
}: PdpGalleryProps) {
  const photo = productImageSrc({ image });
  const name = productName(brand, model);
  /* The gallery's photos: the stored list when it starts with the card's
     photo (it always does: both read `sort_order` first), else that photo
     alone. Blank entries are dropped, as `productImageSrc` drops one. */
  const photos =
    photo === null
      ? []
      : images !== undefined && images[0]?.trim() === photo
        ? images.map((url) => url.trim()).filter(Boolean)
        : [photo];

  /* What the first photo's slot holds, or the placeholder tile (D92b, D144):
     the picture or tile, the card-size underlay and the vignette. */
  const firstContent = (
    <>
        {photo === null ? (
          /* No photo on record: the placeholder tile (D108b). One resolver
             for the card and the gallery (`productImageSrc`), so a product
             cannot show a photo in the grid and a placeholder on its own
             page. */
          <ProductPhotoPlaceholder
            brand={brand}
            accessoryType={accessoryType}
            context="gallery"
          />
        ) : (
          <>
            <Image
              {...photoSource(photo, "full")}
              alt={productName(brand, model)}
              width={1000}
              height={1000}
              /* The box is 704px only once the split activates at `md:`
                 1100 (see the frame comment above); from 0 to 1099 the
                 gallery is full-bleed, so it is `100vw` there. Declaring
                 704px from 720 made the browser pick a candidate ~1/3 the
                 rendered width in the 720-1099 band and upscale it.
                 Crossover must match the frame's, not the type's. */
              sizes="(min-width: 1100px) 704px, 100vw"
              loading="eager"
              fetchPriority="high"
              className="photo-inset-gallery peer relative z-10 block h-full w-full object-contain"
            />
            {/* Underlay. The card shows the 480px file; this box shows the
                1000px one, which is rarely loaded when the card's photo
                morphs in, so the arriving snapshot was empty: the photo
                faded to nothing mid-flight and popped in ~200ms after the
                morph ended (measured on production). The card's own file
                is already in the browser's cache from the grid, so it
                paints in the first frame and the morph lands on a photo;
                the sharp file covers it when it arrives (the snapshot is
                live), and the underlay hides once it has (`data-loaded`
                comes from the image bootstrap in `layout.tsx`). On a direct
                visit it is a small first paint before the sharp file. A
                local image has no `card` file and gets none. */}
            {photoSized(photo, "card") === null ? null : (
              <Image
                {...photoSource(photo, "card")}
                alt=""
                aria-hidden="true"
                width={1000}
                height={1000}
                loading="eager"
                decoding="sync"
                className="photo-inset-gallery absolute inset-0 block h-full w-full object-contain peer-data-loaded:invisible"
              />
            )}
          </>
        )}
        <div
          aria-hidden="true"
          className="photo-vignette-gallery absolute inset-0 z-10"
        />
    </>
  );

  /* The morph's end for a single photo (D92b, D144). With several photos the
     carousel names whichever slide is showing instead (D184, QA PDP-4), so
     going back from photo 2 or 3 also flies the photo that is on screen. */
  const firstSlide = (
    <ViewTransition
      name={`product-photo-${slug}`}
      share="morph"
      default="none"
    >
      {/* The morph's named element is this wrapper (owner, 2026-10-04:
          "the image transition is not smooth"), so everything that should
          travel travels as one: a `<ViewTransition>` names each host child,
          and two named children would break the pair. The vignette is in
          it too: left outside, it belonged to the page under the flying
          photo and darkened the box in one step as the morph ended. */}
      <div className="relative h-full w-full">{firstContent}</div>
    </ViewTransition>
  );

  const badgeRow = (
    <>
      {/* `position:absolute;top:16px;left:16px;display:flex;gap:6px`
          (`product-mobile.html:91`), mobile only — desktop's badge row
          lives in the buy panel. `z-20` (D167): the photo is `z-10`, so an
          opaque photo painted over the badges. The mobile 3PMSF instance drops the
          snowflake mark and uses the plain outline style (`product.md`
          §3.1: "3PMSF drops the svg"), which is exactly what the shared
          `Badge` primitive renders when given only `badge.label`. */}
      {badges !== undefined && badges.length > 0 ? (
        <div className="absolute top-4 left-4 z-20 flex gap-1.5 sm:hidden">
          {badges.map((badge) => (
            <Badge key={badge.label} variant={badge.variant}>
              {badge.label}
            </Badge>
          ))}
        </div>
      ) : null}
    </>
  );

  return (
    /* Desktop's `display:flex;flex-direction:column;gap:12px` column wrapper
       around the image box (`product-desktop.html:102`). The gap is inert
       with one child (`product.md` §4); since D167 it spaces the thumbnail
       row, which renders from 1100 only. */
    <div className="flex flex-col gap-3">
      {/* The frame crosses at `md:`, not `sm:`: below 1100 the page keeps the
          mobile stacked arrangement with no side padding, so the image is
          full-bleed and a border would sit flush against the viewport edge.
          It becomes the drawn 704px framed box only once the split activates
          (the same crossover the split itself takes — see `page.tsx`). */}
      {/* `pdp-gallery-band` (globals.css): from 720 to 1099 the box is still
          full-bleed and square, so on a tablet or small laptop it was
          768-1099px tall and the title and `Add to cart` sat a whole screen
          below it. It caps the height at 60dvh in that band only, where no
          artboard draws the page (D41, DEVIATIONS #39); the photo stays whole
          (`object-contain`) inside the shorter box. Launch audit, D145.
          The same utility caps the box below 720 at `100svh - 482px` (never
          under 240px), so `Add to cart` ends on the first screen of a phone:
          the stack under the gallery is ~470px, so a full-width square pushed
          it below the fold (owner, 2026-10-05, "Yes, shorter photo";
          D153, DEVIATIONS row in `pdp-gallery-band`'s comment). */}
      {photos.length > 1 ? (
        <PdpGalleryCarousel
          boxClassName={BOX}
          name={name}
          morphName={`product-photo-${slug}`}
          slides={photos.map((url, position) =>
            position === 0 ? firstContent : (
              <Image
                key={url}
                {...photoSource(url, "full")}
                alt={`${name}, photo ${position + 1}`}
                width={1000}
                height={1000}
                sizes="(min-width: 1100px) 704px, 100vw"
                loading="lazy"
                className="photo-inset-gallery block h-full w-full object-contain"
              />
            ),
          )}
          thumbs={photos.map((url) => (
            <Image
              key={url}
              {...photoSource(url, "card")}
              alt=""
              width={480}
              height={480}
              sizes="80px"
              loading="lazy"
              className="block h-full w-full object-contain p-1"
            />
          ))}
          overlay={badgeRow}
        />
      ) : (
        <div className={BOX}>
          {firstSlide}
          {badgeRow}
        </div>
      )}
    </div>
  );
}
