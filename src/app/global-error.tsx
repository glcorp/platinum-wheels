"use client";

/* ---------------------------------------------------------------------------
   Root error boundary — the last resort, for an error thrown in
   `src/app/layout.tsx` itself, which `(storefront)/error.tsx` cannot catch
   (Next 16 `error.md`: an `error.js` "does not wrap the `layout.js` … above
   it"). Owner ruling 2026-09-30, "Add a branded global-error"; **D93b**.

   Next replaces the root layout when this renders, so it must own `<html>` and
   `<body>` and carry what the layout carried: the two font variables, the
   `h-full antialiased` html classes and the body classes, plus `globals.css`.
   Nothing else from the layout comes along: no skip link, no `NavProgress`,
   no `HashScroll`, no header or footer — the layout may be what failed, and a
   root boundary that re-renders it can only throw again.

   The second `"use client"` directive under `src/app/`, on the same footing as
   `(storefront)/error.tsx` (D62): a framework requirement, so no component
   code lives here. The page is `RouteError` from `route-error.tsx`, the same
   one the storefront boundary renders, so both fallbacks stay one design.
   Props are `{ error, retry }` here too (`retry`, not `reset`).

   `metadata` cannot be exported from a Client Component, so the title is the
   React `<title>` element (`error.md` "Global Error").
   --------------------------------------------------------------------------- */

import { RouteError, type RouteErrorProps } from "@/components/site/route-error";
import { barlow, barlowCondensed } from "./fonts";
import "./globals.css";

export default function GlobalError({ error, retry }: RouteErrorProps) {
  return (
    <html
      lang="en"
      className={`${barlowCondensed.variable} ${barlow.variable} h-full antialiased`}
    >
      <body className="bg-bg text-ink-muted flex min-h-full flex-col font-sans">
        <title>Something went wrong · Platinum Wheels</title>
        <RouteError error={error} retry={retry} />
      </body>
    </html>
  );
}
