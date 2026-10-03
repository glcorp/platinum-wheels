import Image from "next/image";

/**
 * The hero — full-bleed tread photo, bottom scrim, eyebrow + h1 + subhead
 * anchored lower-left. It is the page's first block; the header is NOT
 * composed here — the page renders `<SiteHeader variant="over-hero"/>` as an
 * absolutely positioned sibling (D38), so `relative` on the wrapper is for
 * that sibling, not for anything inside this component.
 *
 * Measured: design/inventory/home.md §2.1 lines 113-128 (element table),
 * lines 18-23 (manifest), lines 397-399 (gradients).
 *
 * D91b (KBD-2, WCAG 1.4.12): the drawn heights are a MINIMUM, not a fixed
 * box. The copy used to be `absolute … bottom-*` inside `h-* overflow-hidden`,
 * so a reader's text-spacing override grew the stack upward past the clip
 * (eyebrow lost by 216px at 1440). Now the copy is in flow, bottom-anchored by
 * `justify-end` + the same bottom inset as padding, and the hero grows when
 * the copy needs more room. `pt-17 sm:pt-22` reserves the absolute over-hero
 * header's own height (site-header.tsx `h-17 sm:h-22`) so grown copy never
 * slides under it. At default spacing the copy fits well inside the minimum,
 * so rest geometry at 390 and 1440 is unchanged.
 *
 * D128 (owner, 2026-10-03: "no matter what the device is, before scrolling at
 * the end only find my tire should be there"): the minimum is now `hero-fit`,
 * the drawn height capped by what leaves the finder on screen, and the h1
 * steps down a token on short screens. 1440x900 is unchanged; 390x844 is not
 * (hero 720 -> 575, so the finder's CTA ends 21px above the fold instead of
 * 124px below it).
 */
export function Hero() {
  return (
    <div
      data-probe="hero"
      className={[
        "relative flex flex-col justify-end overflow-hidden",
        /* D128: `hero-fit` (globals.css D128 block) is the drawn 720 / 760 /
           900 (were `min-h-180 sm:min-h-190 md:min-h-225`) wherever the screen
           is tall enough, and otherwise shrinks so the finder below it, CTA
           included, is on screen before any scroll. */
        "hero-fit",
        // Insets: 16px mobile -> 48px desktop; bottom 100px -> 200px
        // (home.md:22 mobile, :21 desktop). Were the copy's absolute offsets.
        "px-4 pt-17 pb-25 sm:px-12 sm:pt-22 sm:pb-50",
        /* D128: on the shortest phones (`fold-minimal`, under 600px tall) the
           gap between the lede and the overlapping finder closes from 28px to
           16px (100 -> 88), which is the room the copy needs to clear the
           header at 320x568. */
        "max-sm:fold-minimal:pb-22",
      ].join(" ")}
    >
      {/* Photo: hero-tread.webp (D4), not the artboard's hotlinked Vossen/Ferrari
          shot (ASSET-CREDITS.md). Because the shipped photo differs from the
          artboard's, the artboard's measured object-position (home.md:117 —
          `center 60%` desktop, `70% 60%` mobile) does not transfer to a
          different image's composition: `object-center` is what the shipped
          crop actually needs. Flagged as a deviation candidate below. */}
      <Image
        src="/images/photos/hero-tread.webp"
        alt=""
        fill
        priority
        /* `priority` (and its Next 16 replacement `preload`) only emits the
           `<link rel="preload" as="image">`; it does NOT set the priority hint
           on it. The preload options are built from the `fetchPriority` prop
           alone — `next/dist/client/image-component.js:231` feeds
           `imgAttributes.fetchPriority` into `getDynamicProps`, and
           `next/dist/shared/lib/get-img-props.js:484` passes the prop straight
           through with no default. So Lighthouse (mobile, 2026-09-21: LCP
           3.8s, 473ms render delay) correctly reported the hero preload
           without `fetchpriority=high`; this supplies it. */
        fetchPriority="high"
        sizes="100vw"
        className="object-cover object-center"
      />

      {/* TOKEN MISSING: @utility hero-scrim / hero-scrim-desktop — see final
          report for the exact gradient declarations (home.md:397-399). These
          classes do not exist in globals.css yet. */}
      <div className="absolute inset-0 hero-scrim sm:hero-scrim-desktop" />

      <div
        className={[
          // `relative` keeps the in-flow copy painted above the absolute
          // photo and scrim (positioned boxes paint over static ones).
          "relative",
          // Stack gap: 16px mobile -> 28px desktop (home.md:21-22).
          "flex flex-col gap-4 sm:gap-7",
          // TOKEN MISSING: --container-hero: 1100px -> max-w-hero (home.md:21
          // `max-width:1100px`, desktop only — mobile has none, home.md:22).
          "md:max-w-hero",
        ].join(" ")}
      >
        <p
          data-probe="hero-eyebrow"
          className="label text-accent text-11 leading-relaxed tracking-14 sm:text-12 sm:leading-flat sm:tracking-16"
        >
          Brampton · Tires · Wheels · Accessories
        </p>

        <h1
          data-probe="hero-h1"
          className={[
            "display text-on-photo text-display-56 sm:text-display-88 md:text-display-120 md:text-balance",
            /* D128: on a short screen the drawn size steps down one token at a
               time, so the copy fits the shorter hero and the finder stays
               above the fold. Heights are the `fold-*` variants (globals.css
               D128 block); at 820px and taller nothing here applies. */
            "max-sm:fold-short:text-display-48 max-sm:fold-cramped:text-display-40 max-sm:fold-minimal:text-display-32",
            "sm:fold-short:text-display-56 sm:fold-cramped:text-display-48",
            "md:fold-short:text-display-88 md:fold-cramped:text-display-56",
          ].join(" ")}
        >
          The right tires. Confirmed by people who know.
        </h1>

        <p
          data-probe="hero-lede"
          className={[
            /* `opacity-82` removed (D67). The artboard declares `opacity:.82`
               here, but pixel-sampled against the tread photo the line measured
               **1.1:1 minimum / 4.7:1 median** — over the bright part of the
               tread the first sentence on the site was effectively invisible at
               16px. `--on-photo` already carries the intended tone; the 82% is
               what pushed it under AA. design/DEVIATIONS.md #58. */
            "text-on-photo",
            // 16px/1.5 mobile -> 20px/1.5 desktop (home.md:22 mobile, :21 desktop).
            "text-16 leading-body sm:text-20",
            // TOKEN MISSING: --container-hero-lede: 560px -> max-w-hero-lede
            // (home.md:21 `max-width:560px`, desktop only).
            "sm:max-w-hero-lede",
          ].join(" ")}
        >
          {/* D130 (owner, 2026-10-03): no em dash in visible copy. The drawn
              line was "We match, confirm fitment and quote — you just drive." */}
          Search by your vehicle. We find the match, check the fit and quote
          you.
        </p>
      </div>
    </div>
  );
}
