"use client";

/* ---------------------------------------------------------------------------
   `/(storefront)` route error boundary — one of the two states no artboard
   draws (D62). It wraps every storefront page: `/`, `/tires`, `/wheels`,
   `/accessories`, `/products/[slug]`, `/styleguide` and the stubs.

   **This is one of two `"use client"` directives under `src/app/` (the other
   is `src/app/global-error.tsx`, D93b), and it is a framework requirement, not
   a choice.** Next 16 rejects anything else —
   verified by building it, not assumed:

     Error: src/app/(storefront)/error.tsx must be a Client Component.
            Add the "use client" directive the top of the file to resolve this issue.

   A re-export from a module that carries the directive was tried first and
   produced exactly that error, so the directive has to sit in this file. The
   rule it bends is `.claude/rules/ui.md` / `docs/decisions.md` §4, "`use
   client` only on leaf islands — never inside `src/app/`"; the alternative was
   shipping no branded error page at all. Ruled as **D62**, and both rules now
   name this file as their one exception.

   What is preserved is the rule's intent: **no component code lives here.**
   The directive and a one-line re-export are the whole file; the boundary
   itself is `src/components/site/route-error.tsx`, in the leaf-island folder
   with every other island. Read that file for why the boundary renders no
   site chrome, and for the `retry` prop (renamed from `reset` in this canary).

   It does NOT wrap `src/app/layout.tsx` above it; an error thrown there is
   caught by `src/app/global-error.tsx`, which renders this same `RouteError`
   inside its own `<html>` and `<body>`. That file was first ruled "not owed"
   (HANDOFF §6) and was added on the owner's ruling of 2026-09-30, "Add a
   branded global-error" (D93b).
   --------------------------------------------------------------------------- */

export { RouteError as default } from "@/components/site/route-error";
