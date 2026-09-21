import Image from "next/image";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

/* ---------------------------------------------------------------------------
   WinterPromo — "Winter <year>"

   Full-bleed photo + tinted copy panel with two spec chips and a primary
   CTA. Desktop: design/assets/home-desktop.html:157-169;
   design/inventory/home.md:49-51,196-208. Mobile:
   design/assets/home-mobile.html:119-128; design/inventory/home.md:50,208.

   Full-bleed exception to the section-spacing convention (home.md:49): no
   side padding, `mt-14 sm:mt-20 md:mt-30` instead of `pt-*`, no
   `lg:mx-auto lg:max-w-content` wrap. The artboard is flush to 1440; above
   1440 this stays full-bleed (not capped) — a deliberate choice, not an
   omission.

   Wrapper: mobile stack (photo above copy); tablet 55/45
   (DESIGN.md §8 "60/40 splits → 55/45" at 720–1099) via a 20-column grid
   (`sm:grid-cols-20`, `sm:col-span-11` / `sm:col-span-9` ≈ 55/45); desktop
   7fr/5fr (home.md:49) via `md:grid-cols-12`, `md:col-span-7` /
   `md:col-span-5`. `md:min-h-160` = 640px (home.md:49). The photo cell
   carries no explicit height at `sm:`/`md:` — it is a grid item with no
   intrinsic content height (the `Image fill` is absolutely positioned), so
   default grid `align-items: stretch` sizes it to match the copy cell / the
   640px floor, reproducing the artboard's equal-height columns without an
   arbitrary value.

   Photo wash: vertical on mobile, a right-edge wash into the copy panel on
   desktop (home.md:402-403). Not expressible as a bare utility (multi-stop
   token gradients on two different axes) — already supplied in
   `src/app/globals.css` as `@utility promo-wash` / `@utility
   promo-wash-desktop` by the globals.css owner, used here as `promo-wash
   sm:promo-wash-desktop` rather than re-reported. D35(1): the artboard's
   mobile-only literal `rgba(13,2,2,0)` is `transparent` here — identical at
   alpha 0 — which is what `promo-wash`'s `transparent 50%` stop already is.

   Copy verbatim is the DESKTOP wording at all widths (D22) — the mobile
   artboard drops "proper" from the body copy; that variant does not ship.
   The apostrophe in "doesn't" is copied byte-for-byte from
   `design/assets/home-desktop.html:162`, which is a plain ASCII `'` — see
   the final report; `design/inventory/home.md:200` claims a typographic
   U+2019 there, but the artboard (authority order, root llm.md §4) is a
   plain apostrophe, so that is what ships.

   Chips: 36px tall, 12px uppercase, 1px `--text-muted` border, radius 0.
   `Chip` (src/components/ui/chip.tsx) is 44/40px and not uppercase, so it is
   not used — the two spec chips are built inline. The 16×16 snowflake path
   data is copied verbatim from `design/assets/home-desktop.html:164`.

   CTA — `Button` `size="promo"` `variant="primary"`: 52px full-width mobile
   / 56px auto-width desktop, `0 24px` → `0 28px` padding, 14px type at both
   widths (home.md:205,208). The 8px desktop top margin stays a call-site class.

   Server Component. Year is computed at render (D32), never hard-coded.
   --------------------------------------------------------------------------- */

export function WinterPromo() {
  const year = new Date().getFullYear();

  return (
    <section
      data-probe="promo"
      className="mt-14 sm:mt-20 sm:grid sm:grid-cols-20 md:mt-30 md:grid-cols-12 md:min-h-160"
    >
      {/* Photo cell — `height:280px` on mobile only (home.md:50); side by
          side from `sm:` with no explicit height (see header comment). */}
      <div className="relative h-70 overflow-hidden sm:col-span-11 sm:h-auto md:col-span-7">
        <Image
          src="/images/photos/winter-tacoma.webp"
          alt=""
          fill
          sizes="(min-width: 720px) 58vw, 100vw"
          className="object-cover"
        />
        <div
          aria-hidden="true"
          className="promo-wash absolute inset-0 sm:promo-wash-desktop"
        />
      </div>

      {/* Copy cell — `padding:8px 16px 48px;gap:16px` mobile →
          `padding:80px 64px;gap:24px` desktop (home.md:198,208). */}
      <div className="bg-accent-subtle flex flex-col items-start gap-4 px-4 pt-2 pb-12 sm:col-span-9 sm:justify-center sm:gap-6 sm:px-8 md:px-16 sm:py-12 md:py-20 md:col-span-5">
        <span className="label text-accent text-11 tracking-16 sm:text-12">
          Winter {year}
        </span>
        <h2
          data-probe="promo-h2"
          className="display text-ink text-display-48 sm:text-display-56 md:text-display-88 sm:text-balance"
        >
          Book your winter set before the first snow.
        </h2>
        <p
          data-probe="promo-body"
          className="text-ink-muted text-15 leading-body sm:text-17 sm:max-w-promo-body"
        >
          Ontario roads sit below 7 °C from November to March. All-seasons
          harden and lose grip — a proper winter compound doesn&apos;t.
        </p>

        {/* Spec chips — 36px tall, 1px `--text-muted` border, radius 0
            (home.md:203-204,208). Not `Chip` — see header comment. */}
        <div className="flex gap-2">
          <span className="label inline-flex h-9 items-center gap-2 border border-ink-muted px-3 text-12 text-ink tracking-10 sm:px-3.5">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 20L8 9l3 5 3-6 8 12z" />
              <path
                d="M17 3v5M14.5 5.5h5M15.2 3.8l3.6 3.6M18.8 3.8l-3.6 3.6"
                strokeWidth="1.2"
              />
            </svg>
            3PMSF
          </span>
          <span className="label inline-flex h-9 items-center border border-ink-muted px-3 text-12 text-ink tracking-10 sm:px-3.5">
            M+S
          </span>
        </div>

        <Button
          href={ROUTES.winter}
          variant="primary"
          size="promo"
          fullWidth
          data-probe="promo-cta"
          className="sm:mt-2 sm:w-auto"
        >
          Shop winter tires
        </Button>
      </div>
    </section>
  );
}
