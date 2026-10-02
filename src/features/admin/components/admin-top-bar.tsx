/* ---------------------------------------------------------------------------
   AdminTopBar — the bar every signed-in admin page renders above its content.

   NO ARTBOARD DRAWS ANY OF THIS (D89) — the `design/` export covers three
   storefront routes and nothing else, so the admin has no authority-level-2
   source. The logo's box and dimensions are copied from `SiteHeader`
   (`src/components/site/site-header.tsx`) rather than re-measured, since that
   is the one place in this repo those numbers are already verified against
   the real asset (512x507 intrinsic,
   `public/images/logo/platinum-wheels-logo-transparent.webp`). Bar height and
   horizontal padding likewise reuse `SiteHeader`'s own values
   (`h-17 sm:h-22`, `px-4 sm:px-8 md:px-12`), and the content is capped the
   same way every storefront section caps itself (`lg:mx-auto
   lg:max-w-content`).

   **Navigation (D118).** Product CRUD gave the admin more than one place to
   go, which is what the minimal bar was waiting for. The logo links home; two
   links reach the two sections. On a phone the links take a second row under
   the logo, full width, so neither they nor Sign out shrink below a 44px tap
   target; from `sm:` up they sit inline between the logo and Sign out. Every
   control is persistently visible: no hover reveal, since `hover:` compiles
   to `@media (hover: hover)` repo-wide and is unreachable on the owner's
   phone and tablet ("mostly on phone and tab", D89).

   Sign out is a `<form action={signOut}>`, not a link, because it is a
   mutation — it clears the session cookie (`session.ts`) — and a GET-style
   link would let a prefetch or a crawler silently sign the owner out.
   --------------------------------------------------------------------------- */

import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { signOut } from "@/features/admin/auth-actions";
import { ADMIN_CSRF_FIELD, ADMIN_ROUTES } from "@/features/admin/types";

export type AdminSection = "home" | "paymentLinks" | "products";

const SECTIONS = [
  { key: "paymentLinks", label: "Payment links", href: ADMIN_ROUTES.paymentLinks },
  { key: "products", label: "Products", href: ADMIN_ROUTES.products },
] as const;

/** `csrfToken` comes from the page's `requireAdminSession()`; sign out is a
 *  Server Action and checks it like any other (D95). `current` marks the
 *  section the page belongs to; `null` on reference pages. */
export function AdminTopBar({
  csrfToken,
  current,
}: {
  csrfToken: string;
  current: AdminSection | null;
}) {
  return (
    <header className="bg-surface border-border-strong border-b">
      <div className="flex flex-wrap items-center px-4 sm:px-8 md:px-12 lg:mx-auto lg:max-w-content">
        {/* Same logo box as `SiteHeader`: h-13 (52px) mobile -> sm:h-16
            (64px). A real `alt`: the only adjacent text is "Admin", so the
            two nodes announce "Platinum Wheels Admin". */}
        <Link
          href={ADMIN_ROUTES.home}
          aria-current={current === "home" ? "page" : undefined}
          className="flex h-17 items-center gap-2.5 sm:h-22"
        >
          <Image
            src="/images/logo/platinum-wheels-logo-transparent.webp"
            alt="Platinum Wheels"
            width={512}
            height={507}
            sizes="(min-width: 720px) 65px, 53px"
            className="h-13 w-auto sm:h-16"
          />
          <span className="label text-ink text-11 tracking-12 sm:text-12">Admin</span>
        </Link>

        <nav
          aria-label="Admin sections"
          className="border-border-strong order-last flex w-full gap-6 border-t sm:order-none sm:ml-10 sm:w-auto sm:border-t-0"
        >
          {SECTIONS.map((section) => {
            const active = current === section.key;
            return (
              <Link
                key={section.key}
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={`label flex h-12 items-center border-b-2 text-12 tracking-12 sm:h-22 sm:text-13 ${
                  active ? "border-accent text-ink" : "text-ink-muted border-transparent"
                }`}
              >
                {section.label}
              </Link>
            );
          })}
        </nav>

        <form action={signOut} className="ml-auto">
          <input type="hidden" name={ADMIN_CSRF_FIELD} value={csrfToken} />
          <Button type="submit" variant="tertiary" size="compact">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
