/* ---------------------------------------------------------------------------
   AdminTopBar — the bar every `/admin` page renders above its content (D90:
   routes ship at `/admin`, not a subdomain, until the rewrite lands).

   NO ARTBOARD DRAWS ANY OF THIS (D89) — the `design/` export covers three
   storefront routes and nothing else, so the admin has no authority-level-2
   source. The logo's box and dimensions are copied from `SiteHeader`
   (`src/components/site/site-header.tsx`) rather than re-measured, since that
   is the one place in this repo those numbers are already verified against
   the real asset (512x507 intrinsic,
   `public/images/logo/platinum-wheels-logo-transparent.webp`). Bar height and
   horizontal padding likewise reuse `SiteHeader`'s own values
   (`h-17 sm:h-22`, `px-4 sm:px-8 md:px-12`) rather than inventing new ones,
   and the content is capped the same way every storefront section caps
   itself (`lg:mx-auto lg:max-w-content`) so "full-bleed bar, contained
   content" means the same thing here as everywhere else in the codebase.

   Deliberately NOT the full admin shell. Owner ruling this session was
   "minimal top bar" (`llm.md` "Don't": "AdminTopBar is intentionally
   minimal") — no nav links, no breadcrumbs, no user menu — because product
   CRUD (P2, not yet built) will reshape real admin navigation once there is
   more than one destination to move between. Building more than logo + Admin
   label + sign out now would be a shell for pages that do not exist yet, and
   it would be thrown away when they land.

   Sign out is a `<form action={signOut}>`, not a link, because it is a
   mutation — it clears the session cookie
   (`src/features/admin/session.ts`) — and a GET-style link would let a
   prefetch or a crawler silently sign the owner out. It is persistently
   visible at every width: no hover reveal, since `hover:` compiles to
   `@media (hover: hover)` repo-wide (`src/components/ui/button.tsx`) and is
   unreachable on the owner's phone and tablet, which is what he actually
   uses (D89 / `llm.md` "Rules").
   --------------------------------------------------------------------------- */

import Image from "next/image";

import { Button } from "@/components/ui/button";
import { signOut } from "@/features/admin/auth-actions";

export function AdminTopBar() {
  return (
    <header className="bg-surface border-border-strong border-b">
      <div className="flex h-17 items-center justify-between px-4 sm:h-22 sm:px-8 md:px-12 lg:mx-auto lg:max-w-content">
        <div className="flex items-center gap-2.5">
          {/* Same box as `SiteHeader`'s logo: h-13 (52px) mobile ->
              sm:h-16 (64px) desktop. Not a `Link`: the gate gives the admin
              exactly one destination once signed in (`ADMIN_ROUTES.home`),
              so a logo-as-home-link would just relink the page it is
              already on. */}
          {/* A real `alt`, unlike the decorative `alt=""` on `/admin/login`.
              The rule is the same in both places — is the site named in
              adjacent text? On the sign-in page the `<h1>` reads "Platinum
              Wheels admin", so the mark is decorative and a real alt would
              announce the name twice. Here the only adjacent text is the word
              "Admin", so an empty alt would leave a screen-reader user never
              hearing whose admin this is. Together the two nodes announce
              "Platinum Wheels Admin". */}
          <Image
            src="/images/logo/platinum-wheels-logo-transparent.webp"
            alt="Platinum Wheels"
            width={512}
            height={507}
            sizes="(min-width: 720px) 65px, 53px"
            className="h-13 w-auto sm:h-16"
          />
          {/* `label` role utility (Barlow 500, uppercase, `globals.css`) so
              the staff tool is never mistaken for the storefront the same
              logo appears on. */}
          <span className="label text-ink text-11 tracking-12 sm:text-12">Admin</span>
        </div>

        {/* Mutation, not navigation — see the module comment. `compact` is
            already 44px (`h-11`, `src/components/ui/button.tsx`'s
            `sizeBox`), which clears the tap-target floor on its own, so no
            `tap-extend` is needed here. */}
        <form action={signOut}>
          <Button type="submit" variant="tertiary" size="compact">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
