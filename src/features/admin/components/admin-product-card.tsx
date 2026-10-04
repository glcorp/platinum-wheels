import Image from "next/image";
import Link from "next/link";

import { Checkbox } from "@/components/ui/checkbox";
import type { CatalogProduct } from "@/features/catalog/catalog-types";
import { photoSource } from "@/features/catalog/photo-files";
import { SHOP_DATE_TIME } from "@/lib/time";

import { CATEGORY_LABEL, displayPrice, productSpecLine } from "../product-display";
import { BULK_FORM_ID, PRODUCT_STATUS_FIELD, PRODUCT_STATUS_LABEL } from "../product-types";
import { adminProductRoute } from "../types";
import { ProductStatusButtons } from "./product-status-buttons";

/* ---------------------------------------------------------------------------
   AdminProductCard — one product on the admin list (D116).

   NO ARTBOARD DRAWS THIS (D89). Stacked cards at every width, like the
   payment links list (owner, 2026-10-01): the owner works on a phone and a
   tablet, and a many-column table cannot fit 375px. Tokens and roles are the
   links list's.

   The photo is shown whole inside its square (`object-contain`), the same
   rule the storefront card follows; no photo shows the brand instead, and an
   unbranded accessory with no photo an empty square (D125).

   `inert` renders the card for `/admin/styleguide`: no tick box, no status
   form, so the reference page posts nothing.
   --------------------------------------------------------------------------- */

const STATUS_TONE = {
  published: "text-accent",
  hidden: "text-ink",
  discontinued: "text-ink-dim",
} as const;

export function AdminProductCard({
  product,
  csrfToken,
  inert = false,
}: {
  product: CatalogProduct;
  csrfToken: string;
  inert?: boolean;
}) {
  const href = adminProductRoute(product.id);
  const price = displayPrice(product.price);
  const spec = productSpecLine(product);

  return (
    <li className="bg-surface border-border-strong flex flex-col gap-4 border p-4 sm:p-5">
      <div className="flex gap-4">
        <Link
          href={href}
          tabIndex={-1}
          aria-hidden="true"
          className="bg-surface-2 relative block size-20 shrink-0 sm:size-24"
        >
          {product.image ? (
            <Image
              {...photoSource(product.image.url, "card")}
              alt=""
              fill
              sizes="(min-width: 720px) 96px, 80px"
              className="object-contain"
            />
          ) : product.brand ? (
            <span className="display text-ink-dim absolute inset-0 flex items-center justify-center p-2 text-center text-display-20 leading-flat break-words">
              {product.brand}
            </span>
          ) : null}
        </Link>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="label text-ink-dim text-11 tracking-12">{CATEGORY_LABEL[product.category]}</span>
            <span className={`label text-11 tracking-12 ${STATUS_TONE[product.status]}`}>
              {PRODUCT_STATUS_LABEL[product.status]}
            </span>
          </div>
          {/* An unbranded accessory (D125) says so, so staff can tell it from
              a missing field. */}
          <p className={product.brand ? "text-ink-muted text-13 leading-body" : "text-ink-dim text-13 leading-body"}>
            {product.brand ?? "No brand"}
          </p>
          <Link href={href} className="tap-extend text-ink text-16 leading-snug font-bold underline underline-offset-4">
            {product.name}
          </Link>
          {spec ? <p className="text-ink-muted text-14 leading-body">{spec}</p> : null}
          <p className="text-ink-muted text-13 leading-body">
            <span className={price ? "numeral text-ink" : "text-ink-dim"}>{price ?? "No price"}</span>
            <span className="text-ink-dim">{` · Changed ${SHOP_DATE_TIME.format(product.updatedAt)}`}</span>
          </p>
        </div>
      </div>

      {inert ? null : (
        <div className="border-border-strong flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-start sm:justify-between">
          <Checkbox
            id={`product-tick-${product.id}`}
            name={PRODUCT_STATUS_FIELD.ids}
            value={product.id}
            form={BULK_FORM_ID}
            labelClassName="items-center"
          >
            Select
          </Checkbox>
          <div className="flex flex-wrap items-start gap-2">
            <ProductStatusButtons csrfToken={csrfToken} productId={product.id} status={product.status} />
          </div>
        </div>
      )}
    </li>
  );
}
