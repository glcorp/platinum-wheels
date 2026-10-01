import { notFound } from "next/navigation";

/* ---------------------------------------------------------------------------
   Any admin path no page answers (D115).

   On the admin host every URL is served from this folder (`src/proxy.ts`), so
   a mistyped `/prodcts` arrives here as `/admin/prodcts`. Without this
   catch-all Next would render the storefront's 404, with its shop navigation
   and "call us" copy, on the staff tool. `notFound()` hands it to
   `not-found.tsx` beside it instead. Specific routes always win over a
   catch-all, so this never shadows a real page.
   --------------------------------------------------------------------------- */

export default function MissingAdminPage(): never {
  notFound();
}
