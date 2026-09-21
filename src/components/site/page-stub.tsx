import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

/* ---------------------------------------------------------------------------
   PageStub — the minimal page behind every planned-but-undesigned route
   (D26, D39): solid header, one `<h1>`, one line, footer. It exists so the
   links the artboards draw as `href="#"` resolve today instead of 404ing.
   Copy here is new copy (no artboard draws these pages), written under
   .claude/rules/ui.md "Copy": short, declarative, no em dash, no exclamation.
   Replace each stub with its designed page; nothing else depends on this file.
   --------------------------------------------------------------------------- */

type NavKey = "tires" | "wheels" | "accessories" | "contact";

export interface PageStubProps {
  title: string;
  /** Which nav item is active for this route. */
  active?: NavKey;
  /** Optional body under the standard line, e.g. the results query echo. */
  children?: ReactNode;
}

export function PageStub({ title, active = "tires", children }: PageStubProps) {
  return (
    <>
      <SiteHeader variant="solid" active={active} />
      <main id="main" tabIndex={-1} className="flex-1 px-4 pt-14 sm:px-8 sm:pt-20 md:px-12 md:pt-30">
        <div className="lg:mx-auto lg:max-w-content">
          <h1 className="display text-ink text-display-56 sm:text-display-88">
            {title}
          </h1>
          <p className="text-16 leading-body text-ink-muted mt-6 max-w-measure">
            This page is being built. Call us and we will help you today.
          </p>
          {children}
        </div>
      </main>
      <div className="mt-14 sm:mt-20 md:mt-30">
        <SiteFooter />
      </div>
    </>
  );
}
