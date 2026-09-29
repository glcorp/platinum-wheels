import type { Metadata, Viewport } from "next";
import { barlow, barlowCondensed } from "./fonts";
import "./globals.css";
import Script from "next/script";
import { HashScroll } from "@/components/site/hash-scroll";

/* D92b motion bootstrap — runs before the first `<img>` parses, so it needs no
   hydration and adds no `"use client"`.
   (1) Image fade-in: sets `data-img-fade` on <html> and marks each image
   `data-loaded` on its `load` or `error` (capture phase — neither event
   bubbles). `globals.css` holds a lazy image at opacity 0 until it is marked,
   then eases it in over its own ground. Without this script neither attribute
   exists and every image renders exactly as before.
   (2) Press feedback on iOS: Safari applies `:active` only when a touch
   listener exists, so every `active:` press state in the build is dead on an
   iPhone without this one passive no-op. */
const MOTION_BOOT = `(function(){var d=document;d.documentElement.setAttribute("data-img-fade","");function m(e){var t=e.target;if(t&&t.tagName==="IMG")t.setAttribute("data-loaded","")}d.addEventListener("load",m,true);d.addEventListener("error",m,true);d.addEventListener("touchstart",function(){},{passive:true})})();`;

export const metadata: Metadata = {
  title: {
    default: "Platinum Wheels and Tire Solutions — Brampton, Ontario",
    template: "%s · Platinum Wheels",
  },
  description:
    "Tires, wheels and accessories in Brampton, Ontario. Search by your vehicle — we match, confirm fitment and quote.",
};

export const viewport: Viewport = {
  themeColor: "#0B0B0D",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
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
        {/* Makes `/#contact` and `/#how-it-works` work. `loading.tsx`'s Suspense
            boundary (D62) means the section arrives after the browser has
            already resolved the fragment, so nothing scrolls — measured, ten
            seconds, `scrollY` 0, in a production build. A leaf island, so this
            file stays a Server Component. D80. */}
        <HashScroll />
        {children}
      </body>
    </html>
  );
}
