import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

/* ---------------------------------------------------------------------------
   PageStub — the shell behind every undesigned route (D26, D39): solid
   header, one `<h1>`, a body, footer. It exists so the links the artboards
   draw as `href="#"` resolve today instead of 404ing, and it is also what the
   404 itself renders.

   Since D63 it carries real content on `/about`, `/privacy` and `/terms`:
   pass `body` to replace the default "being built" line. `body` defaults to
   that line, so the 404 and any remaining stub are unchanged.
   Copy here is new copy (no artboard draws these pages), written under
   .claude/rules/ui.md "Copy": short, declarative, no em dash, no exclamation.
   Replace each stub with its designed page; nothing else depends on this file.
   --------------------------------------------------------------------------- */

type NavKey = "tires" | "wheels" | "accessories" | "contact";

export interface PageStubProps {
  title: string;
  /** Which nav item is active for this route. */
  active?: NavKey;
  /**
   * Replaces the default "This page is being built" line (D63). A string
   * renders in the standard lede treatment; a node renders as given, which is
   * what the multi-section `/privacy` and `/terms` pages pass.
   */
  body?: ReactNode;
  /** Optional content under the body, e.g. the results query echo. */
  children?: ReactNode;
}

export function PageStub({
  title,
  active = "tires",
  body,
  children,
}: PageStubProps) {
  return (
    <>
      <SiteHeader variant="solid" active={active} />
      <main id="main" tabIndex={-1} className="flex-1 px-4 pt-14 sm:px-8 sm:pt-20 md:px-12 md:pt-30">
        <div className="lg:mx-auto lg:max-w-content">
          <h1 className="display text-ink text-display-56 sm:text-display-88">
            {title}
          </h1>
          {body === undefined ? (
            <p className="text-16 leading-body text-ink-muted mt-6 max-w-measure">
              This page is being built. Call us and we will help you today.
            </p>
          ) : typeof body === "string" ? (
            <p className="text-16 leading-body text-ink-muted mt-6 max-w-measure">
              {body}
            </p>
          ) : (
            <div className="mt-6">{body}</div>
          )}
          {children}
        </div>
      </main>
      <div className="mt-14 sm:mt-20 md:mt-30">
        <SiteFooter />
      </div>
    </>
  );
}

/* ---------------------------------------------------------------------------
   StubSection — one titled block inside a `PageStub` body (D63). Used by
   `/about`, `/privacy` and `/terms`, which are prose rather than a single
   lede line.

   No artboard draws any of these pages, so the treatment is assembled from
   existing tokens only: the section title takes the `label` role utility at
   the same 12px / .12em / uppercase the filter-rail group labels use, and the
   body takes the same `16px / leading-body / --text-muted / max-w-measure`
   as the lede above it. Nothing new was invented and no token was added.
   --------------------------------------------------------------------------- */

export function StubSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="label text-12 tracking-12 text-ink">{title}</h2>
      <div className="text-16 leading-body text-ink-muted mt-3 flex max-w-measure flex-col gap-3">
        {children}
      </div>
    </section>
  );
}
