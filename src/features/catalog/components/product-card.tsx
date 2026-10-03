import Image from "next/image";
import Link from "next/link";
import { ViewTransition } from "react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Price } from "@/components/ui/price";
import { cartItem } from "@/features/catalog/cart-item";
import { configFor } from "@/features/catalog/categories";
import { AddToCartButton } from "@/features/catalog/components/add-to-cart-button";
import { ProductPhotoPlaceholder } from "@/features/catalog/components/product-photo-placeholder";
import {
  productImageSrc,
  type Product,
  type ProductBadge,
} from "@/features/catalog/types";
import { cx } from "@/lib/cx";
import { productName } from "@/lib/product-name";
import { productRoute } from "@/lib/routes";
import { PRICES_VISIBLE } from "@/lib/site";

/* ---------------------------------------------------------------------------
   ProductCard — the storefront's most reused component.

   One shell, three homes: the home `featured-tires` row
   (`design/inventory/home.md:237`), the results grid
   (`design/inventory/results.md:264`) and the PDP `similar-products` row
   (`design/inventory/product.md:167`). All three extractions measure the card
   byte-identically, so there is one component and no per-context variant —
   `design/inventory/results.md:264` §3 is the spec and the other two are the
   cross-check.

   Authority: where DESIGN.md and the artboards give different numbers for the
   same thing, the artboards win (`docs/decisions.md:25`). Every measured value
   below carries its source. Desktop values come from
   `design/assets/results-desktop.html` (1440 artboard), mobile from
   `design/assets/results-mobile.html` (390 artboard). The mobile→desktop
   crossover is `sm:` 720px — breakpoints come from DESIGN.md §8 and nowhere
   else, because the exports contain zero `@media` rules
   (`docs/decisions.md:84`).

   Server Component. Hover is pure CSS, so there is no `"use client"`
   (`docs/decisions.md:73`).
   --------------------------------------------------------------------------- */

/* --- Routing ---------------------------------------------------------------
   No route is drawn anywhere: every `href` in all seven exports is `"#"`
   (`design/inventory/results.md:716`). The shape lives in one place,
   `src/lib/routes.ts` (D18, D39); the card imports `productRoute` from there
   rather than owning a path literal. */

/* --- Badges ----------------------------------------------------------------
   Copy ships in the artboards' source case; `text-transform:uppercase` on the
   Badge primitive renders it uppercase, which is why DESIGN.md writes `WINTER`
   and the export writes `Winter` (`.claude/rules/ui.md:49`, artboard copy
   verbatim). `winter` is the only filled variant; everything else takes the
   `1px --text-muted` outline (`design/DESIGN.md:197-199`,
   `design/assets/results-desktop.html:162` and `:239`). */
type BadgeVariant = NonNullable<BadgeProps["variant"]>;

const BADGE_PRESENTATION: Record<
  ProductBadge,
  { variant: BadgeVariant; copy: string }
> = {
  winter: { variant: "winter", copy: "Winter" },
  "all-season": { variant: "outline", copy: "All-Season" },
  /* New copy (D105b), in the drawn `All-Season` badge's own capitalisation. */
  "all-weather": { variant: "outline", copy: "All-Weather" },
  summer: { variant: "outline", copy: "Summer" },
  oem: { variant: "outline", copy: "OEM" },
  studdable: { variant: "outline", copy: "Studdable" },
};

/** `design/DESIGN.md:201` — "Maximum two badges per card; WINTER first." */
const MAX_BADGES = 2;

/**
 * Default `sizes` for the square cut-out — what an un-passed caller gets
 * (`/styleguide`). The three storefront homes pass their own through the
 * `sizes` prop, because their grids cross at different widths (D91b, WDG-06;
 * `HANDOFF.md` §8.7 "`sizes` must cross at the layout's breakpoint"). The
 * card has a hard ceiling: it is 328px at
 * the 1440 artboard (3-up in a 1016px results column) and 324px 4-up in the
 * 1344px container, and 358px at the 390 artboard (full width less 2×16px)
 * — `design/inventory/results.md:571`. So above the 720px crossover the box
 * never exceeds ~330px and 348px carries the headroom; between 400 and 720 the
 * grid is 2-up (`design/DESIGN.md:220`, §8) so each card is half the viewport;
 * below 400 it is 1-up.
 */
const IMAGE_SIZES = "(min-width: 720px) 348px, (min-width: 400px) 50vw, 100vw";


 /* The radial vignette sits *above* the photo — the badge row and brand stamp
  * render over it (`design/inventory/results.md:294`). The declaration lives in
  * `@utility photo-vignette` (globals.css) so the exact artboard gradient is
  * written once; Tailwind's `bg-radial` would emit a different interpolation
  * space (`in oklab`) that a computed-style parity read would catch.
  *
  * All three overlays in this box — this vignette, the badge row, and the
  * brand stamp — carry `pointer-events-none`. They are positioned siblings
  * painted *above* the image anchor (when #69 was found the anchor was static,
  * and CSS paints positioned boxes above non-positioned in-flow ones
  * regardless of DOM order; since D91b all four are positioned and paint in
  * DOM order, anchor first) — so without `pointer-events-none` each one sits,
  * invisibly, on top of the anchor and swallows the click meant for it. The vignette alone covers the
  * full `inset-0` box, which is why its missing `pointer-events-none` made
  * the *entire* photo dead to clicks (DEVIATIONS #69, corrected). Confirmed
  * with `elementFromPoint` before and after — see the amended row. */

 /* Card hover, from `design/assets/results-desktop.html:156` — the same
  * declaration appears 30× across the exports, byte-identical, and belongs to
  * card hover only:
  *   `transition:border-color 150ms cubic-bezier(.2,0,0,1),
  *               transform 150ms cubic-bezier(.2,0,0,1)`
  * The property pair lives in `@utility transition-card` (globals.css);
  * duration and curve are `duration-150` / `ease-card` below. v4 implements the
  * lift with the `translate` property rather than `transform`, so `translate`
  * is what animates — same two properties, same motion. DEVIATIONS #15. */

export interface ProductCardProps {
  product: Product;
  /**
   * Marks this card's photo as an above-the-fold LCP candidate: it is
   * preloaded from `<head>` instead of lazy-loaded.
   *
   * `/tires` has no hero, so its first row of cards plays that role — the
   * Lighthouse mobile run of 2026-09-21 (`design/reports/results.md`) measured
   * LCP 3.4s against the 2.5s gate with the first card image at
   * `loading="lazy"` and 523ms of resource load delay. `docs/decisions.md` §4
   * ("the hero carries priority") is the same rule applied to the element that
   * is actually the LCP on this page.
   *
   * NOT implemented with `next/image`'s `priority` or `preload`:
   *
   * - `priority` is **deprecated** in Next 16 in favour of `preload`
   *   (`node_modules/next/dist/shared/lib/get-img-props.d.ts:23-28`; image
   *   docs :291-293), and passing both throws (`get-img-props.js:331`).
   * - `preload` is the wrong tool here. The docs' "when not to use it" list
   *   (image.md:283-289) names this exact case — "multiple images that could
   *   be considered the LCP element depending on the viewport" — and closes
   *   with "In most cases, you should use `loading="eager"` or
   *   `fetchPriority="high"` instead of `preload`". Three cards are marked,
   *   because the first row is 3-up on desktop and 1-up at 390, so which one
   *   is the LCP depends on the width. `preload` also emits a
   *   `<link rel="preload">` that carries no priority hint of its own — the
   *   hint comes from the `fetchPriority` prop alone
   *   (`client/image-component.js:231`, `get-img-props.js:484`), which is why
   *   the 2026-09-21 re-run still reported `lcp-discovery-insight` 0.
   *
   * So `priority` renders `loading="eager"` + `fetchPriority="high"`: the
   * `<img>` is server-rendered and therefore discoverable in the initial HTML
   * on its own, it never waits for the lazy threshold, and it carries the
   * priority hint. Both props are accepted by this canary
   * (`get-img-props.d.ts:29` `loading?: LoadingValue` = `lazy | eager`;
   * `fetchPriority` passes through from the `img` intrinsics).
   *
   * Default `false`: every other caller (home `featured-tires`, PDP
   * `similar-products`, `/styleguide`) keeps the lazy default.
   */
  priority?: boolean;
  /**
   * Wraps the photo in the named `<ViewTransition>` that morphs it into the
   * PDP gallery (D92b). Default `true`.
   *
   * A view-transition name must be unique on the page: two mounted VTs with
   * one name break the morph. `/styleguide` passes `false` so a reference page
   * that renders the same SKU twice never mounts two
   * `product-photo-<slug>` boundaries. The PDP's `similar-products` row also
   * passes `false`, so its cards never pair with a results card on a
   * `product-open` navigation (see the photo link's comment). No storefront
   * page renders one slug twice (the similar row excludes its own subject,
   * D52; best and similar partition the results).
   */
  morph?: boolean;
  /**
   * The photo's `sizes` for THIS caller's grid (D91b, WDG-06). One card, three
   * layouts: the results grid is 1-up / 2-up / 3-up at 720 and 1100, the home
   * featured row a fixed 260px track below 720, the PDP similar row the same
   * 260px track below 1100 — so one string cannot cross at every caller's
   * breakpoints, and an under-declared `sizes` makes the browser fetch a
   * candidate smaller than the box it paints. Each value must be ≥ the
   * rendered card width at every viewport. Defaults to `IMAGE_SIZES`, so a
   * caller that passes nothing is unchanged.
   */
  sizes?: string;
  /**
   * The vehicle the visitor searched, `2021 Honda Civic`, already checked
   * against the finder's list by the page (D91b), or `""`. `Add to cart` saves
   * it on the cart line so the shop knows what the part was for (D122). The
   * results grid and the PDP rows pass it; the home row has none.
   */
  vehicle?: string;
  /**
   * A positional id for the `<article>` (`result-7`, `similar-4`), set only by
   * the results grid so `Load more` can link to the first card it adds and
   * focus that card's product link (D133). It also takes a scroll margin, so
   * a fragment landing leaves a little room above the card; below 1100 that
   * adds to the `scroll-padding-top` under the sticky filter bar (D91b).
   * Every other caller passes nothing and renders no id and no margin.
   */
  anchorId?: string;
}

export function ProductCard({
  product,
  priority = false,
  morph = true,
  sizes = IMAGE_SIZES,
  vehicle = "",
  anchorId,
}: ProductCardProps) {
  const {
    slug,
    brand,
    model,
    size,
    price,
    badges,
    threePeakMountainSnowflake,
    available,
  } = product;
  const photoSrc = productImageSrc(product);
  /* An unbranded accessory (D125) has no brand: no stamp, no brand line, and
     its name stands alone wherever the two are joined. `|| null` also folds an
     empty string into "no brand". */
  const brandName = brand || null;
  const fullName = productName(brandName, model);

  /* WINTER first, then the rest in the order the caller gave them, capped at
     two (`design/DESIGN.md:201`). On the unavailable card the dim badge takes
     the slot *instead of* a season badge, and the 3PMSF mark is dropped —
     `design/inventory/results.md:355` and `:367`, measured across all 14 card
     instances. */
  const seasonBadges = available
    ? [
        ...badges.filter((badge) => badge === "winter"),
        ...badges.filter((badge) => badge !== "winter"),
      ].slice(0, MAX_BADGES)
    : [];

  /* What fills the photo box, defined once so the `morph` switch below wraps
     the same element it would otherwise render bare. No photo on record: the
     placeholder tile, never a guessed path (D108b). With no brand the tile
     sets the accessory type instead of standing empty (D133); the tile is
     still `photo`, so the named morph below wraps it exactly as before
     (D111(3)). */
  const photo =
    photoSrc === null ? (
      <ProductPhotoPlaceholder
        brand={brandName}
        accessoryType={product.accessoryType}
        dimmed={!available}
      />
    ) : (
      <Image
        src={photoSrc}
        alt={fullName}
        width={1000}
        height={1000}
        sizes={sizes}
        /* See `priority` in ProductCardProps for why this is eager +
           fetchPriority rather than `preload`. Both stay undefined when
           the prop is false, so the default lazy behaviour is
           untouched. */
        loading={priority ? "eager" : undefined}
        fetchPriority={priority ? "high" : undefined}
        className={cx(
          "photo-inset-card block h-full w-full object-contain",
          !available && "opacity-35",
        )}
      />
    );

  return (
    /* `background:var(--surface);border:1px solid var(--border);display:flex;
        flex-direction:column;position:relative;font-family:var(--font-body);
        color:var(--text);height:100%` — results-desktop.html:156.
       No radius (cards stay 0, globals.css:72) and no shadow, ever
       (`design/DESIGN.md:175`). No padding on the shell. `h-full` is what makes
       a row of cards equal-height from the grid rather than a fixed height.
       Hover: border → --accent-hover, translateY(-2px)
       (results-desktop.html:48 `.x59:hover`). Tailwind's `hover:` compiles to
       `@media (hover: hover)`, so it cannot stick after a tap
       (`design/DEVIATIONS.md` #10). The photo does not zoom. */
    <article
      id={anchorId}
      className={cx(
        "bg-surface border-border text-ink transition-card ease-card relative flex h-full flex-col border font-sans duration-150 hover:-translate-y-0.5 hover:border-accent-hover",
        anchorId !== undefined && "scroll-mt-4 md:scroll-mt-10",
      )}
    >
      {/* `position:relative;aspect-ratio:1/1;background:var(--bg);
          overflow:hidden` — results-desktop.html:157. The square is the
          reserved aspect box, so the photo costs no layout shift.

          D91b (NJR-6): the badge row and the brand stamp share this box's
          flow instead of being two independent `absolute` layers. Absolute,
          the full-width badge row could not see the stamp, and at 1100–1180
          (3-up beside the rail, D46 — the narrowest card) `Currently
          unavailable` ran up to 34.6px under it. Now the box is a wrapping
          flex row, padded by the drawn 10px / 16px insets that used to be
          the two `top`/`left`/`right` offsets: badges left, stamp pushed
          right by `ml-auto`, and when both do not fit the stamp takes the
          next line instead of overlapping. At the drawn widths both fit on
          one line, so every badge and the stamp land exactly where the
          absolute insets put them. `content-start` stops a wrapped second
          line being stretched down the photo. The image anchor and the
          vignette stay `absolute inset-0` over the padding box, which the
          square's `border-box` sizing leaves the same size. */}
      <div className="bg-bg relative flex aspect-square flex-wrap content-start items-start gap-1.5 overflow-hidden p-2.5 sm:p-4">
        {/* `width:100%;height:100%;object-fit:contain;padding:6%;
            box-sizing:border-box;display:block` — results-desktop.html:158.
            `photo-inset-card` is that 6% (globals.css:284); the percentage
            resolves against the inline size, so the picture box scales with the
            card — 286.88px inside the 326px desktop card
            (`design/inventory/results.md:290`). Preflight gives img
            `box-sizing:border-box` and `display:block`.
            Unavailable: `opacity:0.35` (results-desktop.html:426); the vignette
            below is unchanged and stays at full strength
            (`design/inventory/results.md:354`).
            `alt` is `<Brand> <Name>` in every artboard instance
            (`design/inventory/results.md:702`). The cut-outs are canvas-
            normalised 1000×1000 transparent webp, so every card renders the
            tire at the same optical size (`design/DESIGN.md:170`).
            The basename is `product.image` when the SKU borrows another SKU's
            cut-out and `slug` otherwise: four photos cover the nine artboard
            SKUs, exactly as the artboards reuse them (D43,
            `design/inventory/results.md` §7.2).

            The photo is also a route to the PDP, same href as the model link
            below — the owner asked for a clickable image (DEVIATIONS #69).
            No artboard draws a link here (none of the seven exports wraps
            this `<img>` in an `<a>` — checked directly), so this is new
            interactive surface, not a parity fix. It is `tabIndex={-1}
            aria-hidden="true"`: the model link is already the card's one
            announced, focusable route to the product, and a second
            identical stop per card would double every keyboard/AT traversal
            of the grid (D57, D66 precedent — this build removes exactly this
            defect shape, it does not reintroduce it). `alt` stays
            `<Brand> <Name>` on the `<img>` itself even though the wrapping
            anchor hides the subtree from the accessibility tree: it is still
            the visible fallback text if the image fails to load, and image
            search crawlers read `<img alt>` independently of `aria-hidden`
            (which only prunes the AT tree, not the raw DOM). The anchor is
            `block h-full w-full` with no padding, so it exactly overlays the
            `<img>` box and adds no layout of its own; cursor and tap
            affordance come free (default anchor cursor, plus the shared `a`
            base rule for `touch-action`/`-webkit-tap-highlight-color`,
            D65).

            The anchor's box was correct from the start; it did not resolve
            hits. It is `position:static`, and the three overlays that follow
            it in the DOM — the vignette, the badge row, the brand stamp — are
            all `position:absolute`. CSS paints positioned boxes above
            non-positioned in-flow ones regardless of source order, so all
            three sat visually on top of this anchor, and none carried
            `pointer-events:none`; the full-box vignette alone was enough to
            intercept every click on the photo (DEVIATIONS #69, corrected —
            confirmed with `elementFromPoint` before and after). The three
            overlays now carry `pointer-events-none`; this anchor's box is
            unchanged. (Since D91b the anchor is itself `absolute` and the
            badge row and stamp are `relative` flex items; all four are
            positioned and paint in DOM order, anchor first, so the overlays
            still sit on top and still need `pointer-events-none`.)

            D92b (owner, "Expressive", 2026-09-29): the photo is the shared
            element that morphs into the PDP gallery, which wraps its own
            `<Image>` in the identical name (`pdp-gallery.tsx`). `share` is
            explicit because with `default="none"` and no `share` the pair
            silently never morphs.

            `share` is TYPE-KEYED on this side (coordinator ruling, derived
            under D92b): only a navigation that opens a product
            (`product-open`, carried by both PDP links below) or returns from
            one (`product-back`, carried by the PDP breadcrumb's results crumb)
            may pair a card with the gallery. Every card on a page holds a
            `product-photo-<slug>` name, so an untyped pairing would also fly
            every card that exists on both pages — six featured cards into the
            `/tires` grid on a Tires-tile click, results cards into the PDP's
            similar row. A tile, nav or crumb navigation to a category carries
            neither type, so those card↔card pairs resolve to `none` and stay
            put. Browser Back/Forward run no view transition at all (Next
            restores a traversal outside a React transition — measured, zero
            frames), so there is no reverse morph there; the breadcrumb's
            `Tires` crumb carries `product-back` and does morph (measured,
            702 → 326px). `default="none"` keeps the photo out of
            every unrelated transition (filter, sort, `Load more`), where the
            card's list-identity VT in `results-grid.tsx` animates the whole
            card instead — the skill's "composing shared elements with list
            identity" pattern. The morph only forms if the PDP renders in the
            same commit as the navigation, with the PDP payload already in
            hand (the storefront has had no `loading.tsx` fallback since
            D91b) — hence `prefetch={true}` on both PDP
            links (`vercel-react-view-transitions` nextjs.md "When Content
            Must Be Ready"). `nav-forward` types the page slide. Press is
            `active:opacity-70`, the text-link/photo half of the D92b press
            vocabulary. */}
        <Link
          href={productRoute(slug)}
          tabIndex={-1}
          aria-hidden="true"
          transitionTypes={["nav-forward", "product-open"]}
          prefetch={true}
          /* `absolute inset-0` (was in-flow `h-full w-full`) since D91b:
             the box's padding now carries the overlay insets, and the photo
             must still fill the whole square. Same box, same hit area. */
          className="absolute inset-0 block active:opacity-70"
        >
          {morph ? (
            <ViewTransition
              name={`product-photo-${slug}`}
              share={{
                "product-open": "morph",
                "product-back": "morph",
                default: "none",
              }}
              default="none"
            >
              {photo}
            </ViewTransition>
          ) : (
            photo
          )}
        </Link>

        <div
          aria-hidden="true"
          className="photo-vignette pointer-events-none absolute inset-0"
        />

        {/* `position:absolute;top:16px;left:16px;right:16px;display:flex;
            gap:6px;flex-wrap:wrap` — results-desktop.html:160; mobile inset
            10px — results-mobile.html:110. Rows wrap rather than overflow
            (`design/DESIGN.md:201`). The insets are the parent's padding
            since D91b; `relative` keeps it painted above the positioned image
            anchor and vignette (DOM order among positioned boxes), and
            `min-w-0` lets it narrow so its own badges wrap. */}
        <div className="pointer-events-none relative flex min-w-0 flex-wrap gap-1.5">
          {available ? (
            seasonBadges.map((badge) => (
              <Badge key={badge} variant={BADGE_PRESENTATION[badge].variant}>
                {BADGE_PRESENTATION[badge].copy}
              </Badge>
            ))
          ) : (
            /* results-desktop.html:432 — copy verbatim, source case. */
            <Badge variant="unavailable">Currently unavailable</Badge>
          )}
        </div>

        {/* `position:absolute;top:16px;right:16px;font:700 11px/24px
            var(--font-display);letter-spacing:.08em;text-transform:uppercase;
            color:var(--text-muted)` — results-desktop.html:167; mobile inset
            10px — results-mobile.html:117. Barlow *Condensed*, unlike every
            other 11px label on the page (`design/inventory/results.md:310`),
            which is what the `display` role utility carries; `leading-badge`
            (24px) and `tracking-8` override its display leading and tracking.
            D91b: a flex item pushed right by `ml-auto` rather than an
            absolute layer (see the photo box), `relative` for paint order,
            `min-w-0 break-words` so a long brand wraps inside the photo.
            Not drawn over the placeholder tile, which already is the brand
            (D108b), and not drawn at all when there is no brand (D125): the
            badge row keeps its place, so the box is unchanged. */}
        {photoSrc === null || brandName === null ? null : (
          <span
            translate="no"
            className="display text-ink-muted leading-badge pointer-events-none relative ml-auto min-w-0 break-words text-11 tracking-8"
          >
            {brandName}
          </span>
        )}
      </div>

      {/* `padding:24px;display:flex;flex-direction:column;gap:8px;flex:1` —
          results-desktop.html:169; `padding:14px` mobile —
          results-mobile.html:119. */}
      <div className="flex flex-1 flex-col gap-2 p-3.5 sm:p-6">
        {/* Name block wrapper `display:flex;flex-direction:column`, no gap —
            results-desktop.html:170. */}
        <div className="flex flex-col">
          {/* `font:700 15px/1.1 var(--font-body);color:var(--text)` —
              results-desktop.html:171; `700 12px/1.1` mobile —
              results-mobile.html:121.
              D125: an unbranded accessory renders no line at all, not an empty
              one. The card body is a column under an equal-height grid track
              (`h-full`, CTA pinned by `mt-auto`), so the card keeps its row's
              height and only the name block starts one line higher. */}
          {brandName === null ? null : (
            <span className="text-ink font-sans text-12 leading-snug font-bold sm:text-15">
              {brandName}
            </span>
          )}

          {/* `font:700 calc(28px * var(--scale-h3))/0.92 var(--font-display);
              letter-spacing:-0.015em;text-transform:uppercase;
              overflow-wrap:break-word;color:var(--text)` —
              results-desktop.html:172; 24px mobile — results-mobile.html:122.
              The `display` utility carries family, 700, 0.92 leading, -0.015em
              tracking and uppercase (globals.css:260).

              This is the card's one path to the product. The whole card is NOT
              an anchor: wrapping it would nest the CTA link inside it. */}
          <Link
            href={productRoute(slug)}
            /* `tap-extend` lifts the touch target to 46px without adding
               padding or height, so every measured property still matches the
               artboard. Display type at 24px/0.92 is only ~22px tall, which
               fails the 44px floor in docs/decisions.md §5 and WCAG 2.5.8's
               24px AA minimum. The artboards draw every href as "#", so no
               drawn geometry is affected.
               D92b: typed (`nav-forward` for the slide, `product-open` for
               the morph) and fully prefetched like the photo link above, so
               both routes into the PDP slide the page and form the morph;
               `active:opacity-70` is the text-link press. */
            transitionTypes={["nav-forward", "product-open"]}
            prefetch={true}
            /* D133: the element `Load more` focuses on the first card it
               adds (`load-more-landing.tsx`). */
            data-card-link=""
            className="display text-ink text-display-24 tap-extend break-words active:opacity-70 sm:text-display-28"
          >
            {model}
            {/* WDG-2.4.4: the same model in two sizes must not read as two
                identical links. Pixels unchanged (`sr-only`). */}
            <span className="sr-only">{` ${size}`}</span>
          </Link>
        </div>

        {/* `display:flex;align-items:center;gap:8px;flex-wrap:wrap` —
            results-desktop.html:174. */}
        <div className="flex flex-wrap items-center gap-2">
          {/* `font:700 15px/1.2 var(--font-body);
              font-variant-numeric:tabular-nums;color:var(--text-muted)` —
              results-desktop.html:175; `700 14px/1.2` mobile —
              results-mobile.html:125. `numeral` is the 700 + tabular role
              (globals.css:276). */}
          <span className="numeral text-ink-muted text-14 leading-tight sm:text-15">
            {size}
          </span>

          {threePeakMountainSnowflake && available ? (
            /* `display:inline-flex;align-items:center;gap:4px;
               color:var(--text-muted)`, svg 16×16 `stroke-width:1.5` with an
               inner path at 1.2, label `font:500 11px/1 var(--font-body);
               letter-spacing:.08em` — results-desktop.html:177, identical on
               mobile. The svg is decorative: the "3PMSF" text beside it carries
               the meaning and `title` supplies the expansion. */
            <span
              title="Three-peak mountain snowflake"
              className="text-ink-muted inline-flex items-center gap-1"
            >
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinejoin="round"
              >
                <path d="M2 20L8 9l3 5 3-6 8 12z" />
                <path
                  d="M17 3v5M14.5 5.5h5M15.2 3.8l3.6 3.6M18.8 3.8l-3.6 3.6"
                  strokeWidth={1.2}
                />
              </svg>
              <span className="font-sans text-11 leading-flat font-medium tracking-8">
                3PMSF
              </span>
            </span>
          ) : null}
        </div>

        {/* `display:flex;align-items:baseline;gap:6px;margin-top:4px;
            flex-wrap:wrap` — results-desktop.html:180. The wrapper's colour is
            `var(--text)`, or `var(--text-dim)` on the unavailable card
            (results-desktop.html:446); `Price` applies that to the amount and
            keeps `from` at `--text-muted`, which is what the artboard's
            explicit per-span colours resolve to. Renders
            `from` · `$129` · `/ tire` (`docs/decisions.md` §7; the drawn
            ` CAD` is dropped site-wide by D77). */}
        {/* D122: no price row at all while prices are switched off, not even
            `Inquire for price`; the CTA keeps its bottom pin (`mt-auto`). */}
        {PRICES_VISIBLE ? (
          <Price
            amount={price}
            context="card"
            unavailable={!available}
            unit={configFor(product).unit.card}
            className="mt-1"
          />
        ) : null}

        {/* `display:flex;flex-direction:row;gap:8px;margin-top:auto;
            padding-top:8px` — results-desktop.html:185. `margin-top:auto` is
            what pins the CTA to the bottom of an equal-height card. */}
        <div className="mt-auto flex flex-row gap-2 pt-2">
          {/* Primary `background:var(--accent);color:var(--on-accent)` —
              results-desktop.html:188. Ghost `border:1px solid var(--text);
              color:var(--text);background:transparent` — results-desktop.html:453.
              Both `height:48px` / 44px mobile, `padding:0 20px`, `flex:1`,
              `min-width:0`, `text-align:center`, `border-radius:var(--radius-ctl)`,
              `+0.04em` — the Button primitive's `card` size.

              D122 (owner, 2026-10-01): the drawn `Request a quote` and
              `Inquire about restock` are now one `Add to cart`, which puts the
              category's set (`addQuantity`: four tires or wheels, one
              accessory) in the browser cart. A discontinued product keeps the
              drawn ghost variant and can still be added; the cart marks it.
              `design/DEVIATIONS.md` #96. The sr-only tail names the product, so
              thirty identical buttons on one page do not read identically out
              of context. */}
          <AddToCartButton
            slug={slug}
            item={cartItem(product)}
            quantity={configFor(product).addQuantity}
            vehicle={vehicle}
            size="card"
            className="flex-1"
            srContext={`${fullName} ${size}`}
          />
        </div>
      </div>
    </article>
  );
}
