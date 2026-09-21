import type { Metadata, Viewport } from "next";
import { barlow, barlowCondensed } from "./fonts";
import "./globals.css";

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
      className={`${barlowCondensed.variable} ${barlow.variable} h-full antialiased`}
    >
      <body className="bg-bg text-ink-muted flex min-h-full flex-col font-sans">
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
        {children}
      </body>
    </html>
  );
}
