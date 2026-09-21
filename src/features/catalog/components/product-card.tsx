import Image from "next/image";
import Link from "next/link";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { configFor } from "@/features/catalog/categories";
import {
  productImageSrc,
  type Product,
  type ProductBadge,
} from "@/features/catalog/types";
import { cx } from "@/lib/cx";
import { productRoute, quoteRoute } from "@/lib/routes";

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
   `src/lib/routes.ts` (D18, D39); the card imports `productRoute` and
   `quoteRoute` from there rather than owning a path literal. */

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
  summer: { variant: "outline", copy: "Summer" },
  oem: { variant: "outline", copy: "OEM" },
  studdable: { variant: "outline", copy: "Studdable" },
};

/** `design/DESIGN.md:201` — "Maximum two badges per card; WINTER first." */
const MAX_BADGES = 2;

/**
 * `sizes` for the square cut-out. The card has a hard ceiling: it is 328px at
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
  * space (`in oklab`) that a computed-style parity read would catch. */

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
   * `/results` has no hero, so its first row of cards plays that role — the
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
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
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
      className="bg-surface border-border text-ink transition-card ease-card relative flex h-full flex-col border font-sans duration-150 hover:-translate-y-0.5 hover:border-accent-hover"
    >
      {/* `position:relative;aspect-ratio:1/1;background:var(--bg);
          overflow:hidden` — results-desktop.html:157. The square is the
          reserved aspect box, so the photo costs no layout shift. */}
      <div className="bg-bg relative aspect-square overflow-hidden">
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
            D65). */}
        <Link
          href={productRoute(slug)}
          tabIndex={-1}
          aria-hidden="true"
          className="block h-full w-full"
        >
          <Image
            src={productImageSrc(product)}
            alt={`${brand} ${model}`}
            width={1000}
            height={1000}
            sizes={IMAGE_SIZES}
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
        </Link>

        <div aria-hidden="true" className="photo-vignette absolute inset-0" />

        {/* `position:absolute;top:16px;left:16px;right:16px;display:flex;
            gap:6px;flex-wrap:wrap` — results-desktop.html:160; mobile inset
            10px — results-mobile.html:110. Rows wrap rather than overflow
            (`design/DESIGN.md:201`). */}
        <div className="absolute top-2.5 right-2.5 left-2.5 flex flex-wrap gap-1.5 sm:top-4 sm:right-4 sm:left-4">
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
            (24px) and `tracking-8` override its display leading and tracking. */}
        <span className="display text-ink-muted leading-badge absolute top-2.5 right-2.5 text-11 tracking-8 sm:top-4 sm:right-4">
          {brand}
        </span>
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
              results-mobile.html:121. */}
          <span className="text-ink font-sans text-12 leading-snug font-bold sm:text-15">
            {brand}
          </span>

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
               drawn geometry is affected. */
            className="display text-ink text-display-24 tap-extend break-words sm:text-display-28"
          >
            {model}
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
        <Price
          amount={price}
          context="card"
          unavailable={!available}
          unit={configFor(product).unit.card}
          className="mt-1"
        />

        {/* `display:flex;flex-direction:row;gap:8px;margin-top:auto;
            padding-top:8px` — results-desktop.html:185. `margin-top:auto` is
            what pins the CTA to the bottom of an equal-height card. */}
        <div className="mt-auto flex flex-row gap-2 pt-2">
          {/* Primary `background:var(--accent);color:var(--on-accent)`, copy
              `Request a quote` — results-desktop.html:188. Ghost
              `border:1px solid var(--text);color:var(--text);
              background:transparent`, copy `Inquire about restock` —
              results-desktop.html:453. Both `height:48px` / 44px mobile,
              `padding:0 20px`, `flex:1`, `min-width:0`, `text-align:center`,
              `border-radius:var(--radius-ctl)`, `+0.04em` — the Button
              primitive's `card` size. Quote-first: there is no cart
              (`docs/decisions.md:105`).

              The sr-only tail names the product so 30 identical
              `Request a quote` links on one page do not read identically out of
              context; the visible label stays the link's leading text, so the
              accessible name still contains it. */}
          <Button
            href={quoteRoute(slug)}
            variant={available ? "primary" : "secondary"}
            size="card"
            className="flex-1"
          >
            {available ? "Request a quote" : "Inquire about restock"}
            <span className="sr-only">{` ${brand} ${model} ${size}`}</span>
          </Button>
        </div>
      </div>
    </article>
  );
}
