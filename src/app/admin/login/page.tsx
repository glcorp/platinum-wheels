import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

import { LoginForm } from "@/features/admin/components/login-form";
import { hasAdminSession } from "@/features/admin/session";
import { ADMIN_ROUTES } from "@/features/admin/types";
import { SITE } from "@/lib/site";

/* ---------------------------------------------------------------------------
   /admin/login — the sign-in page (D91)

   NO ARTBOARD DRAWS THIS. The `design/` export covers `/`, `/tires` and
   `/products/[slug]` and nothing else, so the admin has no authority-level-2
   source at all (D89). Every value on this page comes from the existing token
   system, `docs/decisions.md` and `.claude/rules/ui.md` — nothing is invented
   and no token is added.

   Composition is **flush-left**, not the centred card every admin tool ships.
   `.claude/rules/ui.md` makes flush-left a non-negotiable ("nothing centred
   that could be flush-left"), the owner was asked directly, and chose to keep
   the rule rather than override it for familiarity. The form sits in a
   `max-w-measure` column — 420px, the existing `--container-measure` token, so
   the width is measured rather than picked.

   The page is thin (`docs/decisions.md` §3): metadata, landmarks, composition.
   All behaviour lives in `LoginForm`, the page's one client island.
   --------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function AdminLoginPage() {
  /* Already signed in? Skip the form. Without this, returning to a bookmarked
     /admin/login while holding a valid session presents a sign-in prompt to
     someone who is already through the gate, which reads as a bug. */
  if (await hasAdminSession()) {
    redirect(ADMIN_ROUTES.home);
  }

  return (
    <main
      id="main"
      tabIndex={-1}
      /* `dvh`, never `vh` (docs/decisions.md §5) — on a phone the browser
         chrome makes `100vh` taller than the visible viewport, which would
         push the form under the URL bar on exactly the device he uses most. */
      className="flex min-h-dvh w-full flex-col justify-center px-4 py-14 sm:px-8 sm:py-20 md:px-12 lg:mx-auto lg:max-w-content"
    >
      <div className="w-full max-w-measure">
        {/* Badge only, no wordmark — the same treatment the storefront header
            ships (D7), and the same intrinsic dimensions it declares:
            `site-header.tsx` passes 512x507, the file's real size. The asset is
            NOT square, so a 64x64 here would misstate the aspect ratio and
            reintroduce layout shift on a page whose gate is CLS 0. Height is
            set in CSS and the width follows.

            `alt=""` because the `<h1>` directly below names the site: a screen
            reader would otherwise hear "Platinum Wheels" twice in a row. The
            storefront header uses a real alt because there it is a bare link
            with no adjacent text. */}
        <Image
          src="/images/logo/platinum-wheels-logo-transparent.webp"
          alt=""
          width={512}
          height={507}
          sizes="(min-width: 720px) 65px, 53px"
          priority
          className="h-13 w-auto sm:h-16"
        />

        {/* One `<h1>` per page (docs/decisions.md §4). It names the tool, not
            the action: the person reading it needs to know where they are
            before they know what to do. */}
        <h1 className="display text-ink mt-8 text-display-40 sm:text-display-56">
          {SITE.name} admin
        </h1>

        {/* New copy, authored under `.claude/rules/ui.md` "Copy": short,
            declarative, sentence case, no em dash, no exclamation. It says
            plainly that the credential is shared, because it is — one login
            for the shop, by the owner's decision, with more added by hand if
            they are ever needed. */}
        <p className="text-ink-muted mt-3 text-15 leading-body sm:text-16">
          Sign in with the shop account to manage payment links.
        </p>

        <div className="mt-10 sm:mt-12">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
