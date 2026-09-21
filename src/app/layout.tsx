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
        {children}
      </body>
    </html>
  );
}
