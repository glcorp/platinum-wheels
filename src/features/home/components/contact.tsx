/* ---------------------------------------------------------------------------
   Contact — "04 — Contact". Server Component. `id="contact"` is the anchor
   `ROUTES.contact` ("/#contact") resolves to (`src/lib/routes.ts`).

   Desktop `padding:120px 48px;display:grid;grid-template-columns:5fr 7fr;
   gap:48px;align-items:stretch` — `design/inventory/home.md:77,347`.
   Mobile `padding:56px 16px 0;display:flex;flex-direction:column;gap:24px` —
   `design/inventory/home.md:78,309`; the 56px bottom gap is carried by the
   footer wrapper, so nothing is added here below `md:`.

   ONE DOM (D22): rather than two DOM orders for two viewports, this is a
   single flat grid of four blocks — A (eyebrow+h2+paragraph), B (hours+email),
   C (two contact cards), D (photo panel) — placed with explicit grid position
   at `sm:`/`md:` and CSS `order` on mobile. Desktop visual result: A/B stacked
   left (5fr), C/D stacked right (7fr) — `design/inventory/home.md:77`. Mobile
   visual result: A, then C, then B, with D hidden below 720 (D22: "contact
   photo hidden <720, not removed").

   Tablet (720–1099) is 55/45 rather than 50/50 (`design/DESIGN.md` §8): a
   20-column grid with the text column (A/B) at 9/20 (45%) and the cards+photo
   column (C/D) at 11/20 (55%) — same "type is narrower" direction as the
   desktop 5fr/7fr split.

   Vertical rhythm: the artboard's left column is one flex stack with a flat
   32px gap between every item (eyebrow, h2, p, hours, email —
   `design/inventory/home.md:77`); the right column gap is 16px (cards →
   photo). Splitting A and B into two grid rows means the row gap must equal
   the right column's 16px (`md:gap-y-4`), so B gets an extra `md:mt-4` on top
   of that (16 + 16 = 32) to reproduce the left column's 32px rhythm. Same
   arithmetic at `sm:` with `sm:gap-y-6` + B's `sm:mt-2` (24 + 8 doesn't apply —
   tablet has no drawn value, so it inherits the general 4px-step rhythm
   nearest 32: `sm:gap-y-6` alone, no extra margin, is accepted as a smooth
   step between the mobile 24px flow and the desktop 32px one). Comment only —
   not a designed value.

   `SectionHeading` is NOT used for A: its own eyebrow→title gap is 12/16px,
   but this column's gap is a flat 32px (desktop) applying to eyebrow, h2 AND
   the paragraph alike (`design/inventory/home.md:77`), so eyebrow+h2+p are
   built inline here instead, each spaced by the same token as the rest of the
   column.
   --------------------------------------------------------------------------- */

import Image from "next/image";

import { CONTACTS, SITE } from "@/lib/site";

export function Contact() {
  return (
    <section
      id="contact"
      data-probe="contact"
      /* Below-the-fold reveal (D92b): armed only if it starts below the
         viewport, never hidden without JS or with reduced motion. */
      data-reveal=""
      /* `scroll-mt-*`: `ROUTES.contact` points the nav at this anchor — see
         how-it-works.tsx for why. D66. */
      className="scroll-mt-14 sm:scroll-mt-20 px-4 pt-14 sm:px-8 sm:pt-20 md:px-12 md:pt-30 md:pb-30"
    >
      <div className="flex flex-col gap-6 sm:grid sm:grid-cols-20 sm:gap-x-8 sm:gap-y-6 md:contact-grid md:gap-y-4 lg:mx-auto lg:max-w-content">
        {/* A — eyebrow, h2, paragraph. `design/inventory/home.md:77,347`. */}
        <div className="order-1 flex flex-col gap-6 sm:order-none sm:col-span-9 sm:col-start-1 sm:row-start-1 sm:gap-8 md:col-span-1 md:col-start-1">
          <span className="label text-ink-dim text-11 tracking-14 sm:text-12">
            04 — Contact
          </span>
          <h2
            data-probe="contact-h2"
            className="display text-ink text-display-40 sm:text-display-56"
          >
            Platinum Wheels
          </h2>
          <p className="text-15 leading-body text-ink-muted sm:text-17 sm:max-w-measure">
            {SITE.tagline}
          </p>
        </div>

        {/* C — two contact cards. `design/inventory/home.md:77,323,331`.
            D91b (NJR-7): the cards stack in the undrawn tablet band (D41) and
            sit side by side again from `md:`. At 720–1099 the 11/20 column
            gives each of two cards 99–203px inside its padding, and the
            phone pill needs 215.5px on one line — so the number broke across
            2–4 lines (Firefox refused the break and overflowed the page).
            Stacked, a card is 278px+ inside. 390 and 1440 are unchanged. */}
        <div className="order-2 flex flex-col gap-3 sm:order-none sm:col-span-11 sm:col-start-10 sm:row-start-1 sm:grid sm:grid-cols-1 sm:gap-4 md:col-span-1 md:col-start-2 md:grid-cols-2">
          {CONTACTS.map((contact, index) => (
            <div
              key={contact.tel}
              data-probe={index === 0 ? "contact-card-1" : undefined}
              /* `md:p-6 lg:p-8` (D91b, NJR-7): at 1100 two cards leave 205px
                 inside a 32px padding, 10px short of the one-line pill; 24px
                 gives 221px. The drawn 32px (1440) returns from `lg:` 1320,
                 where it leaves 269px. */
              className="bg-surface border-border-strong flex flex-col items-start gap-3.5 border p-5 sm:gap-5 sm:p-8 md:p-6 lg:p-8"
            >
              {/* `calc(40px * var(--scale-h2))` desktop, `calc(28px * var(--scale-h3))`
                  mobile — `design/inventory/home.md:77`. */}
              <span className="display text-ink text-display-28 sm:text-display-40">
                {contact.name}
              </span>
              {/* Phone link, NOT `Button` — its own border/height/type
                  (`design/inventory/home.md:77,331`). Hover only draws on
                  desktop in the artboard but Tailwind's `hover:` is already
                  `@media (hover: hover)`-scoped, so it stays unprefixed
                  (D17). `active:translate-y-px` is the D92b boxed-control
                  press. `whitespace-nowrap` (D91b, NJR-7): a phone number
                  never breaks mid-number — the card layout above makes room
                  for it instead. */}
              <a
                href={`tel:${contact.tel}`}
                data-probe={index === 0 ? "contact-phone-1" : undefined}
                className="numeral border-accent text-ink hover:bg-accent hover:text-on-accent inline-flex h-13 w-full touch-manipulation items-center whitespace-nowrap justify-center gap-2.5 rounded-ctl border text-17 leading-flat active:translate-y-px sm:mt-auto sm:h-14 sm:w-auto sm:justify-start sm:gap-3 sm:px-5 sm:text-18"
              >
                <svg
                  aria-hidden="true"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
                </svg>
                {contact.display}
              </a>
            </div>
          ))}
        </div>

        {/* B — hours + email. `design/inventory/home.md:77,79,332`. */}
        <div className="order-3 flex flex-col gap-6 sm:order-none sm:col-span-9 sm:col-start-1 sm:row-start-2 sm:gap-8 md:col-span-1 md:col-start-1 md:mt-4">
          <div className="border-border-strong flex flex-col gap-1.5 border-t pt-4 sm:border-0 sm:pt-0">
            <span className="label text-ink-dim text-10 tracking-12 sm:text-11">
              {SITE.hoursLabel}
            </span>
            <span className="numeral text-ink leading-relaxed text-16 sm:text-17">
              {SITE.hours}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="label text-ink-dim text-10 tracking-12 sm:text-11">
              Email
            </span>
            <a
              href={`mailto:${SITE.email}`}
              /* `active:opacity-70`: the D92b text-link press. */
              className="text-ink-muted leading-body text-16 underline underline-offset-3 active:opacity-70 sm:text-17"
            >
              {SITE.email}
            </a>
          </div>
        </div>

        {/* D — photo panel, hidden below 720 (D22). `design/inventory/home.md:77`. */}
        <div className="border-border relative hidden h-70 overflow-hidden border sm:order-none sm:col-span-11 sm:col-start-10 sm:row-start-2 sm:block md:col-span-1 md:col-start-2">
          <Image
            src="/images/photos/winter-tacoma.webp"
            alt=""
            fill
            sizes="(min-width: 1100px) 756px, 100vw"
            className="object-cover"
          />
          {/* TOKEN MISSING: @utility photo-caption-scrim { background-image: linear-gradient(to top, var(--scrim-strong) 0%, transparent 65%); }
              Reported, not invented (`.claude/rules/ui.md`); class name used
              below as instructed. */}
          <div
            aria-hidden="true"
            className="photo-caption-scrim absolute inset-0"
          />
          <span className="text-on-photo leading-relaxed text-15 absolute bottom-6 left-6 font-medium">
            Call or text. We answer.
          </span>
        </div>
      </div>
    </section>
  );
}
