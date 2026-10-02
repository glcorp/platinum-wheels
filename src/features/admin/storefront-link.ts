/**
 * The "View on site" link on the product edit page (D116).
 *
 * The storefront's public address comes from `STOREFRONT_URL` (owner,
 * 2026-10-01): today the production `*.vercel.app` address, at launch
 * `https://platinumwheels.ca`, with no code change at cutover. The admin runs
 * on its own host, so a relative link would point at the admin, not the shop.
 *
 * Unset or not an http(s) URL: no link is shown. Server only (reads env).
 */

import { productRoute } from "@/lib/routes";

function storefrontOrigin(): string | null {
  const raw = process.env.STOREFRONT_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

/** The product's storefront page, or `null` when no storefront is set. */
export function storefrontProductUrl(slug: string): string | null {
  const origin = storefrontOrigin();
  return origin ? `${origin}${productRoute(slug)}` : null;
}
