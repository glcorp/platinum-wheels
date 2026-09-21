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

   Steps data ships inline; copy is artboard-verbatim
   (design/assets/home-desktop.html "02 — How it works" block). Title 03's
   "&" is written as a plain "&" in the JSX string (source is `&amp;` only
   because it sits in raw HTML).

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
    body: "Year, make, model. No tire codes to decipher.",
  },
  {
    n: "02",
    title: "Pick a match, send an inquiry",
    body: "Best matches first, similar sizes below. Choose one and tell us how many.",
  },
  {
    n: "03",
    title: "We confirm fitment & send a quote",
    body: "A person checks your exact trim and stock, then emails a firm price.",
  },
  {
    n: "04",
    title: "Pay via secure link, collect from us",
    body: "No payment on this site. Pay the quote, then pick up or book install.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      /* `scroll-mt-*`: `ROUTES.howItWorks` points the nav at this anchor, and
         `scroll-margin-top` was set nowhere in the build, so following the link
         landed the section flush at y=0 with no breathing room. D66. */
      className="scroll-mt-14 sm:scroll-mt-20 pt-14 px-4 sm:pt-20 sm:px-8 md:pt-30 md:px-12"
    >
      <div className="flex flex-col gap-5 md:gap-10 lg:mx-auto lg:max-w-content">
        {/* Eyebrow only — no title on this section (home.md:215). */}
        <p className="label text-ink-dim text-11 tracking-14 sm:text-12">
          02 — How it works
        </p>

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
                <span className="font-display font-bold uppercase leading-display text-display-24 md:display md:text-display-28">
                  {step.title}
                </span>
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
