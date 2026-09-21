import type { Metadata } from "next";
import { PageStub } from "@/components/site/page-stub";

/* Planned route, undesigned (D26, D39). Footer "About the shop" lands here. */
export const metadata: Metadata = { title: "About the shop" };

export default function AboutPage() {
  return <PageStub title="About the shop" />;
}
