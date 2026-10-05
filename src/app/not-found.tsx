import type { Metadata } from "next";
import { PageStub } from "@/components/site/page-stub";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { PRIMARY_CONTACT } from "@/lib/site";

/* Global 404 — one of the states no artboard draws (design/manifest.md
   "States no artboard shows"). Built from the same chrome and tokens as every
   other page so it is finished to the happy path's level (.claude/rules/ui.md
   "States the design doesn't show"). Copy is new copy: short, declarative.
   Owner ruling 2026-09-30, "Line + two actions": one honest line, then the
   `RouteErrorPanel` action pair (same classes, `route-error.tsx`) — a way
   back into the catalogue and the `tel:` CTA. The apostrophes are the ASCII
   `'` the rest of the copy uses (`&apos;`, as in `winter-promo.tsx`). */
/* `robots: null` clears the site-wide `robots` from the root layout (D112) on
   this page. Next already writes `<meta name="robots" content="noindex">` on
   every 404 (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md`
   "Metadata"), so with the flag on the layout's `index, follow` was a second,
   contradictory tag (launch audit D145, GAP-indexing-flag-on-build; D151).
   Now the 404 carries exactly one: Next's `noindex`. */
export const metadata: Metadata = { title: "Page not found", robots: null };

export default function NotFound() {
  return (
    <PageStub
      title="Page not found"
      lede={
        <>
          That link doesn&apos;t lead anywhere. Start from the catalogue, or
          call us and we&apos;ll find it.
        </>
      }
    >
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button variant="secondary" size="compact" href={ROUTES.tires}>
          Shop tires
        </Button>
        <Button
          variant="accent"
          size="compact"
          href={`tel:${PRIMARY_CONTACT.tel}`}
        >
          Call {PRIMARY_CONTACT.display}
        </Button>
      </div>
    </PageStub>
  );
}
