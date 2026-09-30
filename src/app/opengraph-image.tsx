import { PREVIEW_SIZE, SITE_CARD } from "@/features/seo/metadata";
import { renderSiteCard } from "@/features/seo/preview-cards";

/* `/opengraph-image` — the site's link-preview card (D112): the logo and the
   tagline on the brand's dark ground. A generated image, not a file, because
   the file convention takes only `.jpg`, `.png` and `.gif` and every logo in
   the repo is `.webp` (`node_modules/next/dist/docs/01-app/03-api-reference/
   03-file-conventions/01-metadata/opengraph-image.md`). It reads nothing from
   the request, so Next draws it once at build time. The drawing is
   `src/features/seo/preview-cards.tsx`. */

export const alt = SITE_CARD.alt;
export const size = PREVIEW_SIZE;
export const contentType = SITE_CARD.type;

export default function Image() {
  return renderSiteCard();
}
