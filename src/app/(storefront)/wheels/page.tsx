import type { Metadata } from "next";
import { PageStub } from "@/components/site/page-stub";

/* Planned route, undesigned (D26, D39). Nav "Wheels" and the Wheels tile land here. */
export const metadata: Metadata = { title: "Wheels" };

export default function WheelsPage() {
  return <PageStub title="Wheels" active="wheels" />;
}
