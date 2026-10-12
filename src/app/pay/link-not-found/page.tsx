import type { Metadata } from "next";

import PayNotFound from "../not-found";

/* ---------------------------------------------------------------------------
   The pay host's 404, as a page that really renders on the server.

   A `notFound()` thrown from a page reaches Next before the first byte is
   flushed, and Next 16.4 canary answers it with a 404 status and an EMPTY
   `<html id="__next_error__">` shell that only JavaScript paints (D157, measured
   on products). That left `/pay/<unknown token>`, bare `/pay` and every other
   dead pay path blank for a customer with scripting off or a mail client's
   link preview (QA COPY-1, D184). Only a path no route matches gets a
   server-rendered not-found, and that is the STOREFRONT's, whose links do not
   resolve on the pay host (D151).

   So `src/proxy.ts` fetches this page (a plain 200 render of `not-found.tsx`)
   and sends its HTML back with status 404 and the pay headers. Visited
   directly it answers 200 with `noindex`; nothing links to it.
   --------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Payment link not found",
  robots: { index: false, follow: false },
};

export default PayNotFound;
