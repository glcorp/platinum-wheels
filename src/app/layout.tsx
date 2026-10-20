import type { Metadata, Viewport } from "next";
import { barlow, barlowCondensed } from "./fonts";
import "./globals.css";
import Script from "next/script";
import { preconnect } from "react-dom";
import { photosBaseUrl } from "@/features/catalog/photo-store";
import { HashScroll } from "@/components/site/hash-scroll";
import { NavProgress } from "@/components/site/nav-progress";
import { siteRobots } from "@/features/seo/indexing";
import { SITE_PREVIEW } from "@/features/seo/metadata";
import { SITE_URL } from "@/lib/site";

/* D92b motion bootstrap — needs no hydration and adds no `"use client"`.
   (1) Image fade-in: sets `data-img-fade` on <html> and marks each image
   `data-loaded` on its `load` or `error` (capture phase — neither event
   bubbles). `globals.css` holds a lazy image at opacity 0 until it is marked,
   then eases it in over its own ground. Without this script neither attribute
   exists and every image renders exactly as before.
   It does NOT run before the first `<img>` parses: Next 16 serves a
   `beforeInteractive` script as a `self.__next_s` push that its runtime
   executes at hydration, after the document has parsed. Any image already
   loaded by then had fired its `load` unseen, stayed unmarked and so stayed
   at opacity 0 for good — measured on `/tires` at 1440, the second row of
   cards painted blank (D91b). So after arming the listeners it also marks
   every image that is already `complete`; the listener covers the rest.
   (2) Press feedback on iOS: Safari applies `:active` only when a touch
   listener exists, so every `active:` press state in the build is dead on an
   iPhone without this one passive no-op. */
const MOTION_BOOT = `(function(){var d=document;d.documentElement.setAttribute("data-img-fade","");function m(e){var t=e.target;if(t&&t.tagName==="IMG")t.setAttribute("data-loaded","")}d.addEventListener("load",m,true);d.addEventListener("error",m,true);for(var i=d.images,k=0;k<i.length;k++)if(i[k].complete)i[k].setAttribute("data-loaded","");d.addEventListener("touchstart",function(){},{passive:true})})();`;

/* Site-wide metadata (D112). What is set here is inherited by every route that
   does not set the same field itself, and the merge is shallow, so an
   indexable page builds its whole set with `pageMetadata()`
   (`src/features/seo/metadata.ts`) rather than adding to this one.
   - `metadataBase` is the one canonical origin. Every relative canonical and
     preview-image URL below it resolves against it.
   - `robots` is the launch switch: `noindex` on every page until
     `SEARCH_INDEXING_ENABLED` is exactly `true` (`src/features/seo/indexing.ts`).
   - **No `alternates.canonical` here.** A canonical set on the root layout
     would be inherited by every page as `/`. */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Tires, Wheels and Accessories Across Canada · Platinum Wheels",
    template: "%s · Platinum Wheels",
  },
  description:
    "Online store for tires, wheels and accessories across Canada. Search by your vehicle. We confirm the fitment and send you a quote.",
  robots: siteRobots(),
  ...SITE_PREVIEW,
};

export const viewport: Viewport = {
  themeColor: "#0B0B0D",
  colorScheme: "dark",
  /* Without `cover`, iOS reports every safe-area inset as 0 and `pb-safe`
     (D66) never engaged on a real iPhone. The side insets it exposes are
     handled in globals.css (D91b). */
  viewportFit: "cover",
};

/* The origin the product photos load from (`PHOTOS_BASE_URL`, D126b), or
   `null` when it is not set or not a URL. */
function photoOrigin(): string | null {
  const base = photosBaseUrl();
  if (!base) return null;
  try {
    return new URL(base).origin;
  } catch {
    return null;
  }
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  /* Open the connection to the photo host while the HTML is still parsing, so
     the first card photo does not pay DNS + TCP + TLS after the CSS and the
     image tag are found (mobile LCP, launch audit). React hoists this into
     `<head>` as `<link rel="preconnect">`.
     No `crossOrigin`: card and gallery photos are plain `<img>` elements with
     no `crossorigin` attribute, so the browser fetches them in no-CORS mode
     on a connection that is not the CORS one. A preconnect with `crossorigin`
     opens only the CORS connection, which those images would not reuse, so it
     would waste the connection. Only the origin, never a path, and nothing at
     all when the variable is unset. */
  const photos = photoOrigin();
  if (photos) preconnect(photos);

  return (
    <html
      lang="en"
      /* D92b: `<html>` scrolls smoothly (globals.css) so a same-page fragment
         link glides; this attribute tells Next 16 to switch that off for route
         navigations, which must land at the top instantly. */
      data-scroll-behavior="smooth"
      className={`${barlowCondensed.variable} ${barlow.variable} h-full antialiased`}
    >
      <body className="bg-bg text-ink-muted flex min-h-full flex-col font-sans">
        <Script id="motion-boot" strategy="beforeInteractive">
          {MOTION_BOOT}
        </Script>
        {/* Skip link — the first focusable element in the document, and the
            only thing that may precede the header. Without it a keyboard or
            switch user crosses six tab stops of header nav before reaching
            <main> on every route: WCAG 2.4.1 Bypass Blocks, Level A. It lives
            here rather than in a page because every route needs it and pages
            stay thin (`docs/decisions.md` §3).

            `skip-link` (globals.css) parks it off-screen with a transform and
            brings it back on :focus-visible — off-screen, not `display:none`,
            so it stays focusable. Each route's <main> carries `id="main"` and
            `tabIndex={-1}` so the jump lands focus, not just the scroll
            position. Audit finding C1, design/reports/audit.md. */}
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {/* Made `/#contact` and `/#how-it-works` work while `loading.tsx`'s
            Suspense boundary (D62) streamed the section in after the browser
            had resolved the fragment (D80). That boundary is gone (D91b), so
            the page arrives whole; this stays as a bounded, harmless safety net
            for any future boundary. A leaf island, so this file stays a Server
            Component. */}
        <HashScroll />
        {/* The top loading bar for any wait longer than 150ms — a page change,
            a GET form, or a filter/sort round-trip. Here, not in a page,
            because the root layout persists across navigations and the bar
            has to outlive the page that started it. Owner, 2026-09-29. */}
        <NavProgress />
        {children}
      </body>
    </html>
  );
}
