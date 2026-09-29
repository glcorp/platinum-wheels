import { ViewTransition, type ReactNode } from "react";

/* ---------------------------------------------------------------------------
   PageTransition — the route-level view transition (D92b, owner ruling
   "Expressive", 2026-09-29). Server Component: `<ViewTransition>` from React
   renders in either environment, so no directive and no client bundle cost.

   Page-level, never layout-level. Layouts persist across navigations, so a
   boundary in a `layout.tsx` only ever fires on first mount and never enters
   or exits on a route change (node_modules/next/dist/docs/01-app/02-guides/
   view-transitions.md, "Put the wrapper in each page.tsx, not the layout").

   What each navigation does — the classes are defined in globals.css under
   "D92b — view transitions":
     - a `<Link transitionTypes={["nav-forward"]}>` (into a category, into a
       product) slides the leaving view left and the arriving one in from the
       right; `nav-back` (breadcrumbs, the logo) mirrors it;
     - an untyped navigation (header nav between categories, footer links)
       crossfades: `route-out` on the
       leaving view, `route-in` — a fade with a small rise — on the arriving
       one. The `loading.tsx` skeleton handing over to real content is also a
       Suspense reveal with no type, so it takes the same `route-in`.
     - browser Back/Forward animate nothing: Next restores a history traversal
       outside a React transition, so no boundary fires — measured, zero
       view-transition frames (design/reports/motion.md "Limits").

   `default="none"`: a same-route update — a filter, a sort, `Load more`,
   `?qty=` on the PDP — is still a transition, and without this the whole page
   would crossfade on every one of them. Those changes animate their own
   parts (the result cards) or nothing at all.

   Callers wrap `<main>` AND `<SiteFooter />` together, as siblings inside a
   fragment, so the boundary directly contains DOM nodes — a wrapper `<div>`
   between this and the content would suppress enter/exit. Never the header:
   it is pinned by its own `view-transition-name: site-header` and must not
   slide with the content it anchors.
   --------------------------------------------------------------------------- */

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      enter={{
        "nav-forward": "nav-forward",
        "nav-back": "nav-back",
        default: "route-in",
      }}
      exit={{
        "nav-forward": "nav-forward",
        "nav-back": "nav-back",
        default: "route-out",
      }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
