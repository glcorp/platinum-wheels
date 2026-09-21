import type { Metadata } from "next";
import { PageStub } from "@/components/site/page-stub";

/* Planned route, undesigned (D26, D39). */
export const metadata: Metadata = { title: "Accessories" };

export default function AccessoriesPage() {
  return <PageStub title="Accessories" active="accessories" />;
}
