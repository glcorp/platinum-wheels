import type { Metadata } from "next";
import { notFound } from "next/navigation";

/* ---------------------------------------------------------------------------
   `/pay` on its own is not a page: it renders the pay host's 404
   (`not-found.tsx` beside it). It is also where `decideHostRouting` sends any
   non-`/pay` path on `pay.platinumwheels.ca` in production, so a customer who
   trims the link to the bare host gets the pay 404 with the shop's phone and
   email instead of the storefront's, whose links do not resolve there
   (D105; D145 audit, COPY / SEC-EDGE; D151).
   --------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Payment link not found",
  robots: { index: false, follow: false },
};

export default function PayIndex(): never {
  notFound();
}
