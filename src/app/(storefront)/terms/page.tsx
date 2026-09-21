import type { Metadata } from "next";
import { PageStub } from "@/components/site/page-stub";

/* Planned route, undesigned (D26, D39). Copy must come from the client; nothing is invented here. */
export const metadata: Metadata = { title: "Terms & Conditions", robots: { index: false } };

export default function TermsPage() {
  return <PageStub title="Terms & Conditions" />;
}
