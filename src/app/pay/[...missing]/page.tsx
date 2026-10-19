import type { Metadata } from "next";
import { notFound } from "next/navigation";

/* ---------------------------------------------------------------------------
   Any `/pay/...` path deeper than one segment that no route answers
   (`/pay/<token>/extra`, `/pay/webhook/x`). Without this catch-all Next would
   render the storefront's 404, whose links do not resolve on the pay host.
   `[token]` and the static `webhook` route always win
   over a catch-all, so this never shadows a real page. The admin's
   `[...missing]` (D115) is the precedent. (D145 audit; D151.)
   --------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Payment link not found",
  robots: { index: false, follow: false },
};

export default function MissingPayPage(): never {
  notFound();
}
