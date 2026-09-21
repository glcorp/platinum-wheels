import type { Metadata } from "next";
import { PageStub } from "@/components/site/page-stub";

/* Global 404 — one of the states no artboard draws (design/manifest.md
   "States no artboard shows"). Built from the same chrome and tokens as every
   other page so it is finished to the happy path's level (.claude/rules/ui.md
   "States the design doesn't show"). Copy is new copy: short, declarative. */
export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return <PageStub title="Page not found" />;
}
