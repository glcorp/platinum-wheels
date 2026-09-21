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
 */
export function Hero() {
  return (
    <div
      data-probe="hero"
      className="relative overflow-hidden h-180 sm:h-190 md:h-225"
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
          // Insets: 16px mobile -> 48px desktop; bottom 100px -> 200px
          // (home.md:22 mobile, :21 desktop).
          "absolute left-4 right-4 bottom-25 sm:left-12 sm:right-12 sm:bottom-50",
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
          className="display text-on-photo text-display-56 sm:text-display-88 md:text-display-120 md:text-balance"
        >
          The right tires. Confirmed by people who know.
        </h1>

        <p
          data-probe="hero-lede"
          className={[
            "text-on-photo opacity-82",
            // 16px/1.5 mobile -> 20px/1.5 desktop (home.md:22 mobile, :21 desktop).
            "text-16 leading-body sm:text-20",
            // TOKEN MISSING: --container-hero-lede: 560px -> max-w-hero-lede
            // (home.md:21 `max-width:560px`, desktop only).
            "sm:max-w-hero-lede",
          ].join(" ")}
        >
          Search by your vehicle. We match, confirm fitment and quote — you
          just drive.
        </p>
      </div>
    </div>
  );
}
