/* ---------------------------------------------------------------------------
   HowItWorks — "02 — How it works"

   Four numbered steps. Desktop: design/assets/home-desktop.html:171-184;
   design/inventory/home.md:56,217-220. Mobile:
   design/assets/home-mobile.html:129-134; design/inventory/home.md:56,231.

   `id="how-it-works"` is the anchor `ROUTES.howItWorks` (`/#how-it-works`)
   depends on (src/features/home/llm.md "Rules").

   Section owns its own top spacing + side padding, content capped at `lg:`
   (D11), same convention as `category-tiles.tsx`. Inner gap 20px → 40px
   (`gap-5 md:gap-10`, home.md:56).

   Eyebrow only, no `<h2>` (home.md:215) — `SectionHeading` requires a
   title the artboard doesn't have, so the eyebrow is rendered directly
   instead of reusing that primitive here. Deviation candidate — see the
   final report.

   Steps data ships inline. The copy was artboard-verbatim
   (design/assets/home-desktop.html "02 — How it works" block) until the
   owner's copy pass of 2026-10-03 (D130) rewrote it in plain words, with step
   02 naming the cart (D122). No title is longer than the drawn one it
   replaced, so no column wraps further.

   Mobile (home.md:231): wrapper `border-t border-border-strong`; each row
   `flex gap-3` with the numeral at `w-14` (56px exact — the
   `grid-cols-[56px_1fr]` the artboard draws needs an arbitrary value, and
   `grid-cols-12` with `col-span-2` misses by 3.7px, so `flex` + a fixed-width
   numeral column reproduces the same box without either). Row
   `py-5 border-b border-border`. Numeral: `font-display font-bold text-display-40
   text-ink-dim leading-flat` (not the `display` utility: the artboard numeral
   has no letter-spacing and no text-transform, home.md:218) — no `tabular-nums` (D35(3), mobile omits it)
   and, per the same ruling, not the `numeral` utility (which would force
   Barlow instead of the display face). Title: `font-display font-bold
   uppercase leading-display` with **no** tracking class — D35(3): the mobile
   artboard computes `letter-spacing: normal` on this title, and
   `--tracking-*` is reset to `initial` in `globals.css`, so there is no
   token that reproduces "normal" short of omitting the class entirely. Body:
   `text-14 leading-body text-ink-muted`.

   Desktop (`md:`, home.md:217-220): `md:grid md:grid-cols-4
   md:border-t md:border-border-strong`; each cell
   `md:pt-8 md:pr-6 md:mr-6 md:border-r md:border-border md:border-b-0
   md:py-0 md:flex md:flex-col md:gap-5` — all four cells, including the
   last, carry the trailing `border-right` + `margin-right:24px` exactly as
   drawn (home.md:220 note). Numeral desktop: `md:text-display-56
   md:tabular-nums` (tabular only from `md:`, D35(3)). Title desktop:
   `md:display md:text-display-28` — `display` is itself a Tailwind utility
   (`@utility display` in globals.css), so it can carry the `md:` variant,
   which is exactly how the artboard's tracking-only-on-desktop split is
   reproduced. Body desktop: `md:text-15`.

   Tablet (720–1099): DESIGN.md §8 is silent for this section, so the mobile
   row layout is kept through `sm:` and the desktop 4-column grid starts at
   `md:` (1100) — the same ruling as `category-tiles.tsx`.

   Server Component. No interactive states (home.md:233).
   --------------------------------------------------------------------------- */

interface Step {
  n: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    n: "01",
    title: "Search your vehicle",
    body: "Year, make and model. You don't need to know your tire size.",
  },
  {
    n: "02",
    title: "Pick a match, ask for a quote",
    body: "Best matches first, close sizes below. Add what you need to your cart.",
  },
  {
    n: "03",
    title: "We check the fit and quote you",
    body: "One of us checks your exact trim and our stock, then emails you a firm price.",
  },
  {
    n: "04",
    title: "Pay by secure link",
    body: "No payment on this site. Pay the quote, then pick up or book an install.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      /* Below-the-fold reveal (D92b): the reveal island arms it only if it
         starts below the viewport; without JS or with reduced motion it is
         never hidden. */
      data-reveal=""
      /* No `scroll-mt-*` since the header is pinned (2026-10-07): the html
         `scroll-padding-top` lands `ROUTES.howItWorks` under the header, and
         the section's own top padding is the breathing room D66 added. */
      className="pt-14 px-4 sm:pt-20 sm:px-8 md:pt-30 md:px-12"
    >
      <div className="flex flex-col gap-5 md:gap-10 lg:mx-auto lg:max-w-content">
        {/* The artboard draws this as an eyebrow with no heading (home.md:215),
            which left the section out of the page outline entirely and gave it
            no accessible name. Element-type-only deviation for accessibility,
            on the `featured-carousel` precedent where drawn inert `<span>`s
            ship as real `<button>`s. Every style is in the classes, so no pixel
            moves. D67, design/DEVIATIONS.md #59. */}
        <h2 className="label text-ink-dim text-11 tracking-14 sm:text-12">
          How it works
        </h2>

        <div
          data-probe="hiw"
          className="border-t border-border-strong md:grid md:grid-cols-4"
        >
          {STEPS.map((step, index) => (
            <div
              key={step.n}
              data-probe={index === 0 ? "hiw-step-1" : undefined}
              className="flex gap-3 border-b border-border py-5 md:mr-6 md:flex-col md:gap-5 md:border-r md:border-b-0 md:py-0 md:pt-8 md:pr-6"
            >
              <span className="font-display text-display-40 text-ink-dim leading-flat w-14 shrink-0 font-bold md:w-auto md:text-display-56 md:tabular-nums">
                {step.n}
              </span>
              <div className="flex flex-col gap-1.5 md:gap-5">
                {/* `<h3>` under the section `<h2>` above — same reason, same
                    zero visual change. D67. `text-ink`: both artboards leave
                    this title on the page colour, `html,body{color:var(--text)}`
                    (home-desktop.html:43), while our `body` is `--text-muted`,
                    so without it the title rendered grey. Launch audit (D145). */}
                <h3 className="font-display font-bold uppercase leading-display text-ink text-display-24 md:display md:text-display-28">
                  {step.title}
                </h3>
                <span className="text-14 leading-body text-ink-muted md:text-15">
                  {step.body}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
