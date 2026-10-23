/**
 * Where staff open a vendor's listing for a product (D193): the vendor's own
 * product page when the catalogue holds one, else the vendor's website, so
 * every source in the sourcing email has somewhere to click. Pure; staff data
 * only, read by the sourcing email and nothing on the storefront.
 *
 * The websites are the vendors' own (owner, 2026-10-24: *"just the base URL of
 * vendor works for now"*), taken from the product links the catalogue already
 * holds. A vendor not listed here, or spelled another way, gets no website
 * link; its name and SKU still print.
 */

import type { ProductSource } from "./catalog-types";

/** By vendor name, lower case and letters and digits only. */
const VENDOR_SITES: Readonly<Record<string, string>> = {
  autocountry: "https://autocountry.ca/",
  directautoimport: "https://directautoimport.com/",
  prowheels: "https://prowheels.ca/",
  vertex: "https://www.vertextires.ca/",
  vertextires: "https://www.vertextires.ca/",
  wheelworks: "https://wheelworkstires.com/",
  wheelworkstires: "https://wheelworkstires.com/",
};

export interface VendorLink {
  href: string;
  /** `product`: the vendor's page for this product. `site`: its home page. */
  kind: "product" | "site";
}

export function vendorLink(
  source: Pick<ProductSource, "vendor" | "vendorUrl">,
): VendorLink | null {
  const url = source.vendorUrl?.trim() ?? "";
  if (/^https?:\/\//i.test(url)) return { href: url, kind: "product" };
  const site = VENDOR_SITES[source.vendor.toLowerCase().replace(/[^a-z0-9]+/g, "")];
  return site ? { href: site, kind: "site" } : null;
}
