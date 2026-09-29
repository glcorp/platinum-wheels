import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip } from "@/components/ui/chip";
import { FieldError, FieldLabel } from "@/components/ui/field-label";
import { Input, Textarea } from "@/components/ui/input";
import { Price } from "@/components/ui/price";
import { SectionHeading } from "@/components/ui/section-heading";
import { ProductCard } from "@/features/catalog/components/product-card";
import { VehicleFinder } from "@/features/finder/components/vehicle-finder";
import { ResultsEmpty } from "@/features/results/components/results-grid";
import { QuoteErrorSummary } from "@/features/product/components/quote-error-summary";
import { PageTransition } from "@/components/site/page-transition";
import { LoaderMark } from "@/components/site/nav-progress";
import { RouteErrorPanel } from "@/components/site/route-error";
import { QuoteSuccess } from "@/features/product/components/quote-success";
import type { Product } from "@/features/catalog/types";
import { Select } from "@/components/ui/select";
import { StripeDivider } from "@/components/ui/stripe-divider";
import { ROUTES } from "@/lib/routes";
import { PRIMARY_CONTACT } from "@/lib/site";

/* Never indexed, and excluded from the sitemap when one exists. */
export const metadata: Metadata = {
  title: "Styleguide",
  robots: { index: false, follow: false },
};

/* ---------------------------------------------------------------------------
   Contrast ratios are computed, not asserted — see design/DEVIATIONS.md #14.
   Shown on the page so the accessibility reasoning is visible rather than
   buried in a markdown file.
   --------------------------------------------------------------------------- */
const INK = [
  { name: "--text", hex: "#F4F4F5", util: "text-ink", onBg: 17.89, role: "Headlines, prices, spec values" },
  { name: "--text-muted", hex: "#A7A7AE", util: "text-ink-muted", onBg: 8.22, role: "Body copy, labels" },
  { name: "--text-dim", hex: "#8B909A", util: "text-ink-dim", onBg: 6.14, role: "Meta, placeholders, disabled" },
  { name: "--accent", hex: "#C9F23A", util: "text-accent", onBg: 15.21, role: "The one accent per frame" },
];

const GROUND = [
  { name: "--bg", hex: "#0B0B0D", util: "bg-bg", role: "Page, hero, nav, image grounds" },
  { name: "--surface", hex: "#16161A", util: "bg-surface", role: "Cards, panels, drawers" },
  { name: "--surface-2", hex: "#1F1F24", util: "bg-surface-2", role: "Inputs, nested fills, row hover" },
  { name: "--border", hex: "#1F1F24", util: "bg-border", role: "Hairlines on --surface" },
  { name: "--border-strong", hex: "#35353B", util: "bg-border-strong", role: "Panel edges, dividers, card hairlines" },
  { name: "--border-control", hex: "#69696F", util: "bg-border-control", role: "Field borders only — 3:1 per WCAG 1.4.11" },
  { name: "--winter", hex: "#8FC9F2", util: "bg-winter", role: "Seasonal ink — spec tables only" },
  { name: "--all-season", hex: "#D9C29A", util: "bg-all-season", role: "Seasonal ink — spec tables only" },
];

/* Seed products transcribed from the artboards — brand, model, size, price and
   badges all verbatim from design/inventory/results.md §7. The unavailable one
   is the artboard's own out-of-stock instance. */
const DEMO: Product[] = [
  {
    slug: "zeta-antarctica-sport",
    brand: "Zeta",
    model: "Antarctica Sport",
    size: "215/55R16 · 97T XL",
    price: 129,
    currency: "CAD",
    badges: ["winter"],
    threePeakMountainSnowflake: true,
    available: true,
  },
  {
    slug: "touren-tr76",
    brand: "Touren",
    model: "TR76",
    size: "18×8.5 ET35",
    price: 149,
    currency: "CAD",
    badges: ["all-season"],
    threePeakMountainSnowflake: false,
    available: true,
  },
  {
    slug: "zmax-winterhawk",
    brand: "ZMAX",
    model: "Winterhawk",
    size: "215/55R16 · 97T",
    price: 119,
    currency: "CAD",
    badges: ["winter"],
    threePeakMountainSnowflake: true,
    available: false,
  },
  {
    slug: "mazzini-snowleopard",
    brand: "Mazzini",
    model: "Snowleopard",
    size: "205/60R16 · 96H",
    price: 115,
    currency: "CAD",
    badges: ["winter", "studdable"],
    threePeakMountainSnowflake: true,
    available: true,
  },
];

const DISPLAY_RAMP = [
  { util: "text-display-120", note: "Home hero. Once per page.", cls: "text-display-120" },
  { util: "text-display-88", note: "Section heroes, PDP titles.", cls: "text-display-88" },
  { util: "text-display-56", note: "Section headings.", cls: "text-display-56" },
  { util: "text-display-40", note: "Group and card-row titles.", cls: "text-display-40" },
  { util: "text-display-28", note: "Product names in cards.", cls: "text-display-28" },
];

/* §12 Motion. `demo` drives the bar with the real token, so the motion is
   the source of truth even if a label here drifts from globals.css. */
const MOTION_TOKENS = [
  { name: "--duration-feedback", value: "120ms", use: "Hover fills and press, every control.", demo: { transitionDuration: "var(--duration-feedback)", transitionTimingFunction: "var(--ease-card)" } },
  { name: "--duration-state", value: "200ms", use: "Disclosures, small enters, image fade-in, crossfades.", demo: { transitionDuration: "var(--duration-state)", transitionTimingFunction: "var(--ease-card)" } },
  { name: "--duration-exit", value: "150ms", use: "Anything leaving. Exits run faster than entries.", demo: { transitionDuration: "var(--duration-exit)", transitionTimingFunction: "var(--ease-leave)" } },
  { name: "--duration-overlay", value: "280ms", use: "Filter sheet, photo morph, card travel, nav indicator.", demo: { transitionDuration: "var(--duration-overlay)", transitionTimingFunction: "var(--ease-arrive)" } },
  { name: "--duration-reveal", value: "300ms", use: "Below-the-fold reveal on the home page, once.", demo: { transitionDuration: "var(--duration-reveal)", transitionTimingFunction: "var(--ease-arrive)" } },
  { name: "--duration-route", value: "350ms", use: "Directional slide between pages.", demo: { transitionDuration: "var(--duration-route)", transitionTimingFunction: "var(--ease-arrive)" } },
  { name: "--ease-arrive", value: ".16 1 .3 1", use: "Arrivals: decelerate into place.", demo: { transitionDuration: "var(--duration-route)", transitionTimingFunction: "var(--ease-arrive)" } },
  { name: "--ease-leave", value: ".4 0 1 1", use: "Exits: accelerate out of the way.", demo: { transitionDuration: "var(--duration-route)", transitionTimingFunction: "var(--ease-leave)" } },
  { name: "--ease-card", value: ".2 0 0 1", use: "The artboards' card hover curve; feedback and state.", demo: { transitionDuration: "var(--duration-route)", transitionTimingFunction: "var(--ease-card)" } },
] as const;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-border-strong flex flex-col gap-3 border-t py-6 sm:flex-row sm:gap-8">
      <p className="label text-11 tracking-12 text-ink-dim shrink-0 sm:w-56">{label}</p>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </div>
  );
}

function Block({ id, index, eyebrow, title, children }: {
  id: string;
  index: number;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="pt-14 sm:pt-20">
      <SectionHeading index={index} eyebrow={eyebrow} title={title} />
      <div className="mt-8">{children}</div>
    </section>
  );
}

export default function StyleguidePage() {
  return (
    <PageTransition>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-content px-4 pt-14 pb-20 sm:px-12 sm:pt-20 sm:pb-30">
        <p className="label text-12 tracking-16 text-accent">Track Night</p>
        <h1 className="display text-display-56 text-ink mt-4 sm:text-display-88">
          Styleguide
        </h1>
        <p className="text-16 leading-body text-ink-muted max-w-measure mt-6">
          Every primitive, every variant, every state. Values are measured from the
          artboards in <code className="text-ink">design/assets/</code>; where the
          spec and the artboards disagree the artboards win, and the difference is
          logged in <code className="text-ink">design/DEVIATIONS.md</code>.
        </p>

        <Block id="ground" index={1} eyebrow="Ground" title="Tonal steps">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {GROUND.map((g) => (
              <div key={g.name} className="border-border border">
                <div className={`${g.util} h-20 w-full`} />
                <div className="flex flex-col gap-1 p-4">
                  <p className="numeral text-13 text-ink">{g.name}</p>
                  <p className="numeral text-12 text-ink-dim">{g.hex}</p>
                  <p className="text-13 leading-normal text-ink-muted mt-1">{g.role}</p>
                </div>
              </div>
            ))}
          </div>
        </Block>

        <Block id="ink" index={2} eyebrow="Ink" title="Text colour and contrast">
          <div className="border-border-strong border-t">
            {INK.map((i) => (
              <div
                key={i.name}
                className="border-border-strong flex flex-col gap-2 border-b py-5 sm:flex-row sm:items-baseline sm:gap-8"
              >
                <p className={`${i.util} text-20 leading-flat font-medium sm:w-64`}>
                  The right tires.
                </p>
                <p className="numeral text-13 text-ink-dim sm:w-40">
                  {i.name} {i.hex}
                </p>
                <p className="numeral text-13 text-ink sm:w-32">{i.onBg}:1</p>
                <p className="text-14 leading-normal text-ink-muted">{i.role}</p>
              </div>
            ))}
          </div>
          <p className="text-14 leading-body text-ink-muted max-w-measure mt-6">
            Every text token clears WCAG AA (4.5:1) on all three grounds. The focus
            ring is <span className="text-ink">15.21:1</span>. Control boundaries
            needed one added token — see Controls below.
          </p>
        </Block>

        <Block id="type" index={3} eyebrow="Type" title="Display ramp">
          <div className="border-border-strong border-t">
            {DISPLAY_RAMP.map((d) => (
              <div key={d.util} className="border-border-strong border-b py-6">
                <p className="numeral text-12 text-ink-dim mb-3">
                  {d.util} · {d.note}
                </p>
                <p className={`display ${d.cls} text-ink`}>Track Night</p>
              </div>
            ))}
          </div>
          <Row label="Body · Barlow 400">
            <p className="text-16 leading-body text-ink-muted max-w-measure">
              Search by your vehicle. We match, confirm fitment and quote — you just
              drive.
            </p>
          </Row>
          <Row label="Labels · Barlow 500">
            <span className="label text-11 tracking-10 text-ink-muted">tracking-10</span>
            <span className="label text-11 tracking-12 text-ink-muted">tracking-12</span>
            <span className="label text-12 tracking-14 text-ink-muted">tracking-14</span>
            <span className="label text-12 tracking-16 text-accent">tracking-16</span>
          </Row>
          <Row label="Numerals · tabular">
            <span className="numeral text-28 text-ink">215/55R16</span>
            <span className="numeral text-28 text-ink">18×8.5 ET35</span>
            <span className="numeral text-28 text-ink">97T XL</span>
          </Row>
        </Block>

        <Block id="buttons" index={4} eyebrow="Controls" title="Button">
          <Row label="Primary · panel / card / compact">
            <Button size="panel">Request a quote</Button>
            <Button size="card">Request a quote</Button>
            <Button size="compact">Apply</Button>
            <Button size="promo">Find my tires</Button>
          </Row>
          <Row label="Secondary (ghost)">
            <Button variant="secondary" size="panel">Call us</Button>
            <Button variant="secondary" size="card">Inquire about restock</Button>
            <Button variant="secondary" size="compact">Load more</Button>
            {/* `load` — the /results `Load more`: 52 -> 56px, no padding and
                full width below `md:`, `px-10` from `md:` (results.md §2.6). */}
            <Button variant="accent" size="load" className="md:w-auto">Load more</Button>
            {/* `accent` — the header phone CTA, D40. */}
            <Button variant="accent" size="compact" href={`tel:${PRIMARY_CONTACT.tel}`}>Call {PRIMARY_CONTACT.display}</Button>
          </Row>
          <Row label="Tertiary (text)">
            <Button variant="tertiary">Change vehicle</Button>
          </Row>
          <Row label="Disabled">
            <Button disabled>Request a quote</Button>
            <Button variant="secondary" disabled>Call us</Button>
            <Button variant="tertiary" disabled>Change vehicle</Button>
          </Row>
          <Row label="As a link (next/link)">
            <Button href="/results">Find my tires</Button>
          </Row>
          <Row label="Full width (mobile panels)">
            <div className="w-full sm:w-80">
              <Button size="panel" fullWidth>
                Request a quote
              </Button>
            </div>
          </Row>
          <p className="text-14 leading-body text-ink-dim mt-4">
            Hover is an instant fill swap — the artboards declare no transition on
            any button. Tab to a control to see the focus ring: white on primary,
            accent elsewhere, no offset.
          </p>
        </Block>

        <Block id="badges" index={5} eyebrow="Controls" title="Badge">
          <Row label="Variants">
            <Badge variant="winter">Winter</Badge>
            <Badge variant="outline">All-Season</Badge>
            <Badge variant="outline">3PMSF</Badge>
            <Badge variant="outline">M+S</Badge>
            <Badge variant="unavailable">Currently unavailable</Badge>
          </Row>
          <Row label="Max two per card, WINTER first">
            <div className="flex gap-2">
              <Badge variant="winter">Winter</Badge>
              <Badge variant="outline">Studdable</Badge>
            </div>
          </Row>
        </Block>

        <Block id="chips" index={6} eyebrow="Controls" title="Chip">
          <Row label="Rest · selected · with count">
            <Chip>All-season</Chip>
            <Chip selected>Winter</Chip>
            <Chip count={4}>Zeta</Chip>
            <Chip removable>215/55R16</Chip>
          </Row>
          <p className="text-14 leading-body text-ink-dim mt-4">
            Radius 0, not 2px. The artboards draw square chips beside 2px selects
            and buttons — deliberate, and radius is an exact-match parity property.
          </p>
        </Block>

        <Block id="fields" index={7} eyebrow="Controls" title="Fields">
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <FieldLabel htmlFor="sg-year">Year</FieldLabel>
              <Select id="sg-year" defaultValue="2021">
                <option value="2021">2021</option>
                <option value="2020">2020</option>
              </Select>
            </div>
            <div>
              <FieldLabel htmlFor="sg-make">Make</FieldLabel>
              <Select id="sg-make" defaultValue="Honda">
                <option value="Honda">Honda</option>
                <option value="Toyota">Toyota</option>
              </Select>
            </div>
            <div>
              <FieldLabel htmlFor="sg-model">Model</FieldLabel>
              <Select id="sg-model" defaultValue="Civic">
                <option value="Civic">Civic</option>
                <option value="Accord">Accord</option>
              </Select>
            </div>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="sg-name" required>Full name</FieldLabel>
              <Input id="sg-name" placeholder="Your name" />
            </div>
            <div>
              <FieldLabel htmlFor="sg-phone" optional>Phone</FieldLabel>
              <Input id="sg-phone" type="tel" placeholder="647-000-0000" />
            </div>
            <div>
              <FieldLabel htmlFor="sg-email" required>Email</FieldLabel>
              <Input id="sg-email" type="email" invalid aria-describedby="sg-email-err" />
              <FieldError id="sg-email-err">Enter an email we can reply to.</FieldError>
            </div>
            <div>
              <FieldLabel htmlFor="sg-disabled">Disabled</FieldLabel>
              <Input id="sg-disabled" disabled placeholder="Unavailable" />
            </div>
          </div>

          <div className="mt-6">
            <FieldLabel htmlFor="sg-msg" optional>Message</FieldLabel>
            <Textarea id="sg-msg" placeholder="Anything we should know about the vehicle?" />
          </div>

          <div className="mt-6">
            <Checkbox id="sg-casl" name="consent">
              Email me about seasonal changeover and tire deals. You can unsubscribe
              any time.
            </Checkbox>
            <p className="text-14 leading-body text-ink-dim mt-3">
              CASL consent renders unticked, always — it is never pre-checked.
            </p>
          </div>

          <div className="border-border-strong mt-10 border-t pt-6">
            <p className="label text-11 tracking-12 text-accent">Resolved</p>
            <p className="text-14 leading-body text-ink-muted max-w-measure mt-3">
              WCAG 1.4.11 wants a control boundary at 3:1 against every{" "}
              <em className="text-ink">adjacent</em> colour — for a field that means
              the fill it encloses as well as the panel behind it.{" "}
              <code className="text-ink">--border-strong</code> manages 1.35:1
              against the fill, and the fill is itself only 1.10:1 against the
              panel, so nothing identified the control.{" "}
              <code className="text-ink">--border-control</code>{" "}
              <span className="numeral text-ink">#69696F</span> is the lowest value
              clearing 3:1 on all three (3.01 / 3.31 / 3.61). It is applied to
              fields only — card edges and dividers are decoration, not controls,
              and stay exactly as drawn.
            </p>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div className="bg-surface border-border border p-6">
                <p className="label text-11 tracking-12 text-ink-dim">Card edge — as drawn, 1.35:1</p>
                <div className="mt-3">
                  <Input
                    id="sg-contrast-a"
                    placeholder="Search by size"
                    className="border-border-strong"
                  />
                </div>
              </div>
              <div className="bg-surface border-border border p-6">
                <p className="label text-11 tracking-12 text-ink-dim">Field — shipped, 3.01:1</p>
                <div className="mt-3">
                  <Input id="sg-contrast-b" placeholder="Search by size" />
                </div>
              </div>
            </div>
          </div>
        </Block>

        <Block id="price" index={8} eyebrow="Content" title="Price">
          <Row label="Card context">
            <Price amount={129} />
          </Row>
          <Row label="Card · unavailable">
            <Price amount={129} unavailable />
          </Row>
          <Row label="PDP context">
            <Price amount={129} context="pdp" />
          </Row>
          <Row label="A $1,900 wheel gets the same treatment">
            <Price amount={1900} context="pdp" />
          </Row>
        </Block>

        <Block id="card" index={9} eyebrow="Content" title="Product card">
          <div className="grid grid-cols-1 gap-4 xs:grid-cols-2 md:grid-cols-4">
            {DEMO.map((p) => (
              /* `morph={false}`: these demo cards must not claim the
                 `product-photo-<slug>` view-transition name a real card and the
                 PDP gallery share (D92b). */
              <ProductCard key={p.slug} product={p} morph={false} />
            ))}
          </div>
          <p className="text-14 leading-body text-ink-dim mt-6">
            Winter · all-season · unavailable · two-badge cap. Cards are equal
            height from the grid track, never a fixed height. Hover one: the border
            goes to <code className="text-ink">--accent-hover</code> and it lifts
            2px over 150ms — the photo does not zoom. On a results page the photo
            is also the shared element that morphs into the product page&rsquo;s
            gallery (§12).
          </p>
        </Block>

        <Block id="divider" index={10} eyebrow="Layout" title="Stripe divider">
          <StripeDivider />
          <p className="text-14 leading-body text-ink-dim mt-6">
            Max twice per page, and it counts as that section&rsquo;s accent.
          </p>
        </Block>

        <section className="pt-14 sm:pt-20">
          <SectionHeading
            index={11}
            eyebrow="Still to build"
            title="States the design never drew"
            as="h2"
          />
          <p className="text-16 leading-body text-ink-muted max-w-measure mt-6">
            The seven exports contain no <code className="text-ink">:focus</code>,{" "}
            <code className="text-ink">:active</code> or{" "}
            <code className="text-ink">:disabled</code> rule — only{" "}
            <code className="text-ink">:hover</code>. Focus, active and disabled are
            authored above from DESIGN.md §4. Form success and form error are
            authored below with the PDP quote band (D51, D57), together with the
            skip link the artboards never drew (D57). The route error is authored
            below (D62). The loading skeleton that sat beside it was removed
            (D91b): it hid every page from visitors without JavaScript and
            turned 404s and 500s into 200s.
          </p>

          {/* Empty results — `/results` with a filter set that matches nothing.
              Rendered from the real component so it cannot drift; `as="h2"`
              because this page already owns an `<h1>` (D47(6)). */}
          <div className="mt-10">
            <p className="numeral text-12 text-ink-dim mb-4">
              Empty results · src/features/results/components/results-grid.tsx
            </p>
            {/* The section zeroes its own padding from `md:` — on `/results`
                the grid shell supplies it — so the demo box adds it back. */}
            <div className="border-border-strong border md:p-6">
              <ResultsEmpty clearHref={ROUTES.results} as="h2" />
            </div>
          </div>

          {/* `Change vehicle`, open. The disclosure itself is drawn closed on
              both results artboards; the open panel is undrawn (D45), so it is
              recorded here. `<details open>` shows the state the toolbar reaches
              with no JS at all. */}
          <div className="mt-10">
            <p className="numeral text-12 text-ink-dim mb-4">
              Change vehicle · open state (D45)
            </p>
            <div className="border-border-strong border p-4">
              <details open>
                <summary className="flex list-none items-center gap-5 [&::-webkit-details-marker]:hidden">
                  <span className="label text-ink-muted cursor-pointer text-12 tracking-6 underline underline-offset-4 md:text-13">
                    Change vehicle
                  </span>
                </summary>
                <VehicleFinder variant="inline" />
              </details>
            </div>
          </div>

          {/* Quote form success. Neither product artboard draws a submitted
              state (`design/inventory/product.md` §2.6), so it is authored
              (D51) and recorded here. Rendered from the real component so it
              cannot drift, and without `role="status"` so a reference page does
              not announce itself on load. */}
          <div className="mt-10">
            <p className="numeral text-12 text-ink-dim mb-4">
              Quote form success · src/features/product/components/quote-success.tsx
            </p>
            <div className="border-border-strong border p-4">
              <QuoteSuccess />
            </div>
          </div>

          {/* Quote form error summary. No artboard draws an error state at all
              (DEVIATIONS #9, #46) — it is authored (D57) and rendered from the
              real component so it cannot drift, without `role="alert"` so a
              reference page does not announce itself on load. Shown at 2 so the
              plural branch is the one on display; the component renders nothing
              at 0 and switches to "1 field needs a fix" at 1. */}
          <div className="mt-10">
            <p className="numeral text-12 text-ink-dim mb-4">
              Quote form error · src/features/product/components/quote-error-summary.tsx
            </p>
            <div className="border-border-strong border p-4">
              <QuoteErrorSummary count={2} />
            </div>
          </div>

          {/* Skip link. The first focusable element on every route and the only
              thing allowed before the header (D57, DEVIATIONS #44). It is
              `position:absolute` and parked at `translateY(-100%)` until focus,
              so the demo box is `relative` to give it a containing block —
              otherwise it would position against the page. Tab to it to see the
              revealed state, the same way the focus rings in §5 are shown; it
              reveals on `:focus`, not `:focus-visible`, because it is
              unreachable except by Tab. `href` points at this page's own
              `<main id="main">`, so activating it here behaves exactly as it
              does everywhere else. */}
          <div className="mt-10">
            <p className="numeral text-12 text-ink-dim mb-4">
              Skip to content · src/app/layout.tsx · Tab into the box to reveal it
            </p>
            <div className="border-border-strong relative h-20 border">
              <a href="#main" className="skip-link">
                Skip to content
              </a>
            </div>
          </div>

          {/* Route error. No artboard draws one (D62). Rendered from the real
              component so it cannot drift — the same rule that put `QuoteSuccess`
              and `QuoteErrorSummary` here rather than a copy.

              Two things are faked and both are deliberate: `retry` is a no-op,
              because the real one re-renders the boundary's children and there
              are none here; and the component is given a `digest`, so the
              reference shows the branch a production error actually takes (the
              `Reference …` line is omitted when there is no digest).

              `RouteErrorPanel` is the boundary's contents without its `<main>`
              wrapper, and takes `as="h2"` — this page already owns an `<h1>` and
              an `<main id="main">`, and a second of either would be a defect the
              audit checks for. Same split as `ResultsEmpty` (D47(6)). */}
          <div className="mt-10">
            <p className="numeral text-12 text-ink-dim mb-4">
              Route error · src/components/site/route-error.tsx
            </p>
            <div className="border-border-strong border p-4">
              {/* No `retry`: this page is a Server Component and RSC refuses to
                  serialise a function across the client boundary — the build
                  fails outright, which is how this was caught. The button is
                  therefore inert here, like `QuoteSuccess` and
                  `QuoteErrorSummary` above it. A `digest` IS supplied, so the
                  reference shows the branch a production error takes; the
                  `Reference …` line is omitted when there is none. */}
              <RouteErrorPanel as="h2" digest="1234567890" />
            </div>
          </div>

        </section>

        {/* ---------------------------------------------------------------
            §12 Motion — D92b (owner, "Expressive", 2026-09-29). The token values
            are copied from `globals.css` @theme as text, because CSS cannot print
            a custom property; the demo bars read the real tokens, so a changed
            value shows up in the motion even if this label goes stale. If a
            value changes there, change it here. Every demo is hover-driven
            (`group-hover:` compiles to `@media (hover:hover)`, D17) and is
            killed by the reduced-motion block like everything else.
            --------------------------------------------------------------- */}
        <section id="motion" className="pt-14 sm:pt-20">
          <SectionHeading index={12} eyebrow="Motion" title="Tokens and states" as="h2" />
          <p className="text-16 leading-body text-ink-muted max-w-measure mt-6">
            Hover a row: the bar travels 60px on that token. Full inventory, with
            measured samples, in <code className="text-ink">design/reports/motion.md</code>.
          </p>

          <div className="mt-8">
            {MOTION_TOKENS.map((token) => (
              <div
                key={token.name}
                className="group border-border-strong flex flex-col gap-3 border-t py-5 sm:flex-row sm:items-center sm:gap-8"
              >
                <p className="numeral text-13 text-ink shrink-0 sm:w-56">{token.name}</p>
                <p className="numeral text-13 text-ink-muted shrink-0 sm:w-20">{token.value}</p>
                <p className="text-14 leading-body text-ink-dim sm:flex-1">{token.use}</p>
                <div aria-hidden="true" className="bg-surface border-border relative h-4 w-full border sm:w-40">
                  <span
                    className="bg-accent absolute top-0 left-0 block h-full w-4 transition-transform group-hover:translate-x-15"
                    style={token.demo}
                  />
                </div>
              </div>
            ))}
          </div>

          <Row label="Nav: hover rule, active indicator">
            <nav aria-label="Motion demo" className="bg-scrim-strong flex items-center gap-10 px-6">
              <a
                href="#motion"
                className="label text-13 tracking-10 text-on-photo relative border-b-2 border-transparent py-2"
              >
                Tires
                <span aria-hidden="true" className="nav-indicator" />
              </a>
              <a
                href="#motion"
                className="label text-13 tracking-10 text-on-photo-muted hover:text-ink-muted nav-rule border-b-2 border-transparent py-2 active:opacity-70"
              >
                Wheels
              </a>
            </nav>
          </Row>

          {/* The live loader is `position:fixed` over the whole viewport and
              appears only when a wait passes 150ms. This is the same
              component, `LoaderMark`, on the same `--scrim-mid` wash, sweeping
              continuously so its motion can be judged here. */}
          <Row label="Loader: waits over 150ms">
            <div
              aria-hidden="true"
              className="bg-scrim-mid border-border grid h-60 w-full place-items-center border sm:w-96"
            >
              <LoaderMark />
            </div>
            <p className="text-14 leading-body text-ink-dim max-w-measure">
              Takes the middle of a dimmed screen during a slow page change or
              filter update, then fades. A quick one shows nothing, and taps
              still reach the page underneath.
            </p>
          </Row>

        <Row label="Disclosure: fades both ways">
            <details className="border-border-strong w-full border sm:w-96">
              <summary className="label text-12 tracking-6 text-ink cursor-pointer px-4 py-3 active:opacity-70">
                Open the panel
              </summary>
              <p className="text-14 leading-body text-ink-muted px-4 pb-4">
                The panel fades in on open and out on close. The height does not
                animate: that would drive layout.
              </p>
            </details>
          </Row>

          <Row label="Across routes">
            <p className="text-14 leading-body text-ink-dim max-w-measure">
              Product photo to product page: a shared-element morph. Into a
              category or product: a 60px slide forward; breadcrumbs and the logo
              slide back. Header links between categories crossfade while the
              lime underline travels. New result cards fade up 30ms apart, 150ms at
              most. None of it runs with reduced motion on.
            </p>
            <Button href={ROUTES.results} variant="accent" size="compact" transitionTypes={["nav-forward"]}>
              Try it on results
            </Button>
          </Row>
        </section>
      </main>
    </PageTransition>
  );
}
