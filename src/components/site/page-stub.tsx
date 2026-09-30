import type { ReactNode } from "react";

import { PageTransition } from "@/components/site/page-transition";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

/* ---------------------------------------------------------------------------
   PageStub — the shell behind an undesigned route (D26, D39): solid header,
   one `<h1>`, one line, footer. It exists so the links the artboards draw as
   `href="#"` resolve today instead of 404ing, and it is also what the 404
   itself renders.

   As of 2026-09-22 the 404 is its only caller. D63 gave it a `body` prop so
   `/about`, `/privacy` and `/terms` could carry real content; those three now
   render `src/components/site/prose-page.tsx` instead, which gives a written
   page the composition a one-line stub never had. `body` and the `StubSection`
   helper went with them rather than staying here unused — this file is back to
   the single job its header has always described.

   Copy here is new copy (no artboard draws a 404), written under
   .claude/rules/ui.md "Copy": short, declarative, no em dash, no exclamation.
   --------------------------------------------------------------------------- */

type NavKey = "tires" | "wheels" | "accessories" | "contact";

export interface PageStubProps {
  title: string;
  /** The one paragraph under the `<h1>`. The caller owns the wording: the 404
   *  is the only caller, and the old built-in "This page is being built" line
   *  was wrong for it (owner ruling 2026-09-30, "Line + two actions"). */
  lede: ReactNode;
  /** Which nav item is active for this route. Omitted means none: the 404
   *  belongs to no nav item, and defaulting to Tires marked it current. */
  active?: NavKey;
  /** Content under the lede: the 404's action pair. */
  children?: ReactNode;
}

export function PageStub({ title, lede, active, children }: PageStubProps) {
  return (
    <>
      <SiteHeader variant="solid" active={active} />
      {/* D92b: `<main>` and the footer's wrapper enter and leave together; the
          header stays outside, pinned by its own view-transition name. */}
      <PageTransition>
        <main id="main" tabIndex={-1} className="flex-1 px-4 pt-14 sm:px-8 sm:pt-20 md:px-12 md:pt-30">
          <div className="lg:mx-auto lg:max-w-content">
            <h1 className="display text-ink text-display-56 sm:text-display-88">
              {title}
            </h1>
            <p className="text-16 leading-body text-ink-muted mt-6 max-w-measure">
              {lede}
            </p>
            {children}
          </div>
        </main>
        <div className="mt-14 sm:mt-20 md:mt-30">
          <SiteFooter />
        </div>
      </PageTransition>
    </>
  );
}
