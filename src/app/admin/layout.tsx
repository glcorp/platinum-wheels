import type { Metadata } from "next";
import type { ReactNode } from "react";

/* ---------------------------------------------------------------------------
   Admin layout — the staff tool's root (D89-D94)

   NOT a route group. `src/app/(admin)/` was the obvious shape by analogy with
   `(storefront)`, and it is wrong: a parenthesised group contributes no URL
   segment, so `(admin)/page.tsx` resolves to `/` and collides with the
   storefront home. A real `admin` segment is required, and this layout gives
   the same isolation a group would have.

   This layout deliberately renders no chrome. The storefront composes its
   header and footer per page rather than in a layout (D38), and the admin has
   a further reason: the sign-in page must NOT show the top bar, because there
   is no session to sign out of yet. `AdminTopBar` is therefore composed by the
   pages that are behind the gate, never here.

   The `<body>` element, the font variables and the skip link all come from the
   root layout (`src/app/layout.tsx`) and are not repeated.
   --------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: {
    default: "Admin · Platinum Wheels",
    template: "%s · Platinum Wheels Admin",
  },
  /* Never indexed. This is staff-facing, it will live on its own subdomain,
     and until real auth replaces the stub gate (D91) the only thing keeping it
     out of a search result is this header. `nocache` also asks engines not to
     retain a snapshot of a page they should never have fetched. */
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

/* `children` is typed explicitly rather than with the generated `LayoutProps<
   "/admin">` helper the root layout uses. That helper is produced by
   `next typegen` and does not exist until a build or typegen run has seen this
   brand-new route — and this repo currently has no `node_modules`, so nothing
   local can generate it (`HANDOFF.md` §1). An explicit `ReactNode` cannot fail
   either way. Switch to `LayoutProps<"/admin">` once the route has shipped and
   typegen has run, if matching the root layout's style is worth it. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
