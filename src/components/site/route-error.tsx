"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { PRIMARY_CONTACT } from "@/lib/site";

/* ---------------------------------------------------------------------------
   RouteError — the storefront's route error boundary (D62).

   One of the states no artboard draws (`design/manifest.md` "States no
   artboard shows"), so it is built from existing tokens and primitives only,
   at the happy path's level of finish (`.claude/rules/ui.md` "States the
   design doesn't show"), and it renders on `/styleguide` §11.

   --- Why this file exists at all -------------------------------------------
   Next 16 requires an error boundary to be a Client Component
   (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`,
   "Error boundaries must be Client Components"), while `.claude/rules/ui.md`
   and `docs/decisions.md` §4 forbid a `"use client"` directive **inside
   `src/app/`** and the slop grep treats one there as a failure.

   Keeping both was attempted and **does not work**: a bare re-export from
   this module, with no directive in `error.tsx`, fails the build with
   "src/app/(storefront)/error.tsx must be a Client Component". The directive
   has to be in that file. So D62 grants it as the single named exception, and
   the exception is kept as narrow as the framework allows: `error.tsx` is the
   directive plus one re-export line and holds **no component code**. The
   boundary is here, with the other leaf islands, which is what the rule was
   protecting in the first place.

   --- Why it renders no SiteHeader or SiteFooter ----------------------------
   Deliberate, and the one place this build's undrawn states are asymmetric:
   `loading.tsx` renders full chrome, this does not.

   1. Chrome is composed per page, not in a group layout (D38), so an
      `error.tsx` replaces the whole page — header included. To show the
      header here, `SiteHeader` and `SiteFooter` would have to be imported
      into this client module, which would pull both (and `next/image`, and
      the nav data) into the client bundle of every route that has a boundary.
      That is a real cost paid on every page load to style a page almost
      nobody sees.
   2. An error boundary should depend on as little as possible. The chrome may
      be what failed; re-rendering it inside the fallback risks throwing again
      and escalating to `global-error`.

   So the page navigates by link instead: `Home` under the actions, plus the
   `tel:` CTA, which is the one action that works no matter what broke.

   --- Props (this canary) ---------------------------------------------------
   `{ error, retry }` — note **`retry`, not `reset`**. The prop was renamed in
   this version (`error.md` "Reference › Props › retry"); `reset` is the name
   in older docs and in most training data, and it would silently be
   `undefined` here. `error.digest` is the server-side log identifier: in
   production the message is replaced by a generic one, so the digest is the
   only thing a visitor can usefully quote to the shop.
   --------------------------------------------------------------------------- */

export interface RouteErrorProps {
  error: Error & { digest?: string };
  retry: () => void;
}

/**
 * The panel's contents, without the `<main>` wrapper — so `/styleguide` can
 * render the real thing inside its own page instead of a copy that drifts,
 * without a second `<main id="main">` or a second `<h1>` in the document.
 * Same split, and the same reason, as `ResultsEmpty`'s `as` prop (D47(6)) and
 * the `quote-error-summary.tsx` extraction (D57).
 */
export function RouteErrorPanel({
  digest,
  retry,
  as = "h1",
}: {
  /**
   * `error.digest` only — not the `Error` itself. The panel never needs the
   * object, and `/styleguide` is a Server Component: RSC refuses to serialise
   * a function across the boundary, and an `Error` is not worth risking
   * either. Narrowing the prop to a string is what lets the reference page
   * render the real component instead of a copy.
   */
  digest?: string;
  /**
   * Omitted by `/styleguide` for the same reason — a function cannot cross
   * the boundary. Omitting it also makes that instance inert, which is what
   * every other state in §11 is.
   */
  retry?: () => void;
  as?: "h1" | "h2";
}) {
  const Heading = as;
  return (
    <div className="lg:mx-auto lg:max-w-content">
      {/* `role="alert"` so the boundary announces itself: it replaces the page
          after a client-side navigation, and without it a screen-reader user
          gets a silent swap. Same mechanism D57 added to the quote form's
          error summary. `/styleguide` passes `as="h2"`, and that instance is
          inert reference material, so it does not announce on load — the
          `alert` role fires on insertion, not on page load. */}
      <div role="alert">
        <Heading className="display text-ink text-display-56 sm:text-display-88">
          Something went wrong
        </Heading>
        {/* New copy under `.claude/rules/ui.md`: short, declarative, no em
            dash, no exclamation, "you" for the customer and "we" for the
            shop. */}
        <p className="text-16 leading-body text-ink-muted mt-6 max-w-measure">
          That page did not load. Try again, or call us and we will sort it out
          for you.
        </p>
      </div>

      {/* The `ResultsEmpty` action pair, reused rather than re-invented:
          secondary action first, accent `tel:` CTA second
          (`src/features/results/components/results-grid.tsx`). Stacked below
          `sm:`, inline from it. */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button variant="secondary" size="compact" onClick={() => retry?.()}>
          Try again
        </Button>
        <Button
          variant="accent"
          size="compact"
          href={`tel:${PRIMARY_CONTACT.tel}`}
        >
          Call {PRIMARY_CONTACT.display}
        </Button>
      </div>

      {/* Escape hatch: no header renders on the real error page, so this is
          the only way back. Same treatment as the breadcrumb's `Home` crumb,
          including `tap-extend-lg` — an 11/12px line hit-tests 37px with the
          smaller band and 45px with this one (D57, audit C4).
          `active:opacity-70` is the text-link press (D92); the two `Button`s
          above carry the boxed press from the primitive itself. No
          `PageTransition` anywhere in this file: the boundary is a client
          module that renders no chrome (D62), and it replaces the page rather
          than navigating to one. */}
      <p className="mt-6">
        <Link
          href={ROUTES.home}
          className="label text-ink-dim tap-extend-lg text-11 tracking-10 underline underline-offset-4 hover:text-ink-muted active:opacity-70 sm:text-12"
        >
          Home
        </Link>
      </p>

      {/* The server-side log identifier, when there is one. Rendered quietly
          in `--text-dim` because it is for the shop, not the visitor — but
          rendered, because in production the message is replaced by a generic
          one and this is the only handle on what actually failed. */}
      {digest ? (
        <p className="text-12 leading-body text-ink-dim mt-10">
          Reference {digest}
        </p>
      ) : null}
    </div>
  );
}

export function RouteError({ error, retry }: RouteErrorProps) {
  /* The visitor sees a generic message in production, so the real one has to
     reach somewhere a developer can read it. `console.error` is the whole
     reporting pipeline today — there is no error service, the same way there
     is no inbox for the quote form (D54, parked). */
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    /* Same page-body rhythm as `PageStub`, which is the shell the 404 already
       uses: `px-4 pt-14 / sm:px-8 sm:pt-20 / md:px-12 md:pt-30`, capped at the
       1344px content width. `id="main"` + `tabIndex={-1}` so the skip link in
       `layout.tsx` still has a target on this page (D57, audit C1). */
    <main
      id="main"
      tabIndex={-1}
      className="flex-1 px-4 pt-14 sm:px-8 sm:pt-20 md:px-12 md:pt-30"
    >
      <RouteErrorPanel digest={error.digest} retry={retry} />
    </main>
  );
}
