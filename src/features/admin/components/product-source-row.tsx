/* ---------------------------------------------------------------------------
   One vendor source row of the product form, and the lowest-price line above
   the rows (D116, D125).

   NO ARTBOARD DRAWS THIS (D89). Its own module, with no `"use client"` and no
   hooks, so `/admin/styleguide` renders the real row inert (D93) rather than a
   copy that drifts: the `QuoteSuccess` precedent. `ProductForm` owns the list
   of rows and passes `onRemove`; the styleguide passes nothing.

   Staff only, all of it. The vendor price is what that vendor charges the
   shop, cents kept, and never reaches the storefront (D125).
   --------------------------------------------------------------------------- */

import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field-label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  PRODUCT_FIELD,
  PRODUCT_LIMITS,
  type ProductFieldErrors,
} from "@/features/catalog/product-input";

import { vendorPriceLabel } from "../product-display";

const F = PRODUCT_FIELD;

/** One row's values, as typed or as saved. */
export interface SourceRowValues {
  vendor: string;
  sku: string;
  url: string;
  /** As typed, `388.12`; `""` when the vendor gave none (D125). */
  price: string;
}

/** The id of the group's one error line; every row's controls point at it. */
export const SOURCES_ERROR_ID = "product-sources-error";

/** The source fields' one shared error, in drawn order. */
export function sourcesError(errors: ProductFieldErrors): string | undefined {
  return errors.sourceVendor ?? errors.sourceSku ?? errors.sourcePrice ?? errors.sourceUrl;
}

export function ProductSourceRow({
  index,
  row,
  vendors,
  errors,
  onRemove,
}: {
  /** Position in the list: the `Source n` label and each control's id. */
  index: number;
  row: SourceRowValues;
  vendors: readonly string[];
  errors: ProductFieldErrors;
  /** Absent on the styleguide, where the button does nothing. */
  onRemove?: () => void;
}) {
  const describedBy = sourcesError(errors) ? SOURCES_ERROR_ID : undefined;
  // A vendor no longer in the catalogue (this row's own, on an edit) stays
  // choosable, so opening the form never blanks it.
  const options =
    vendors.includes(row.vendor) || row.vendor === "" ? vendors : [row.vendor, ...vendors];

  return (
    <div className="bg-surface border-border-strong flex flex-col gap-4 border p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="label text-ink-dim text-11 tracking-12">{`Source ${index + 1}`}</span>
        <Button type="button" variant="tertiary" size="compact" onClick={onRemove}>
          Remove
        </Button>
      </div>
      <div>
        <FieldLabel htmlFor={`product-${F.sourceVendor}-${index}`} required>
          Vendor
        </FieldLabel>
        <Select
          id={`product-${F.sourceVendor}-${index}`}
          name={F.sourceVendor}
          defaultValue={row.vendor}
          invalid={Boolean(errors.sourceVendor)}
          aria-describedby={describedBy}
        >
          <option value="">Choose a vendor</option>
          {options.map((vendor) => (
            <option key={vendor} value={vendor}>
              {vendor}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
        <div>
          <FieldLabel htmlFor={`product-${F.sourceSku}-${index}`} required>
            Vendor SKU
          </FieldLabel>
          <Input
            id={`product-${F.sourceSku}-${index}`}
            name={F.sourceSku}
            autoComplete="off"
            spellCheck={false}
            maxLength={PRODUCT_LIMITS.shortText}
            defaultValue={row.sku}
            invalid={Boolean(errors.sourceSku)}
            aria-describedby={describedBy}
          />
        </div>
        {/* What this vendor charges the shop, cents kept (D125). Every row
            posts one, blank included, so the server reads the four repeated
            names by the same index. */}
        <div>
          <FieldLabel htmlFor={`product-${F.sourcePrice}-${index}`} optional>
            Vendor price
          </FieldLabel>
          <Input
            id={`product-${F.sourcePrice}-${index}`}
            name={F.sourcePrice}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            autoComplete="off"
            placeholder="388.12"
            defaultValue={row.price}
            invalid={Boolean(errors.sourcePrice)}
            aria-describedby={describedBy}
          />
        </div>
      </div>
      <div>
        <FieldLabel htmlFor={`product-${F.sourceUrl}-${index}`} optional>
          Link
        </FieldLabel>
        <Input
          id={`product-${F.sourceUrl}-${index}`}
          name={F.sourceUrl}
          type="url"
          placeholder="https://"
          maxLength={PRODUCT_LIMITS.url}
          defaultValue={row.url}
          invalid={Boolean(errors.sourceUrl)}
          aria-describedby={describedBy}
        />
      </div>
    </div>
  );
}

/** The cheapest vendor price as saved (D125). */
export interface LowestVendorPrice {
  vendor: string;
  price: number;
}

/**
 * `Lowest vendor price $388.12, from Wheel Works.` Edit page only, from the
 * sources as saved, not as typed: it summarises the rows the last time they
 * were stored, so it never moves while staff are editing them.
 */
export function LowestVendorPriceNote({ lowest }: { lowest: LowestVendorPrice }) {
  return (
    <p className="text-ink-muted text-14 leading-body sm:text-15">
      {"Lowest vendor price "}
      <span className="numeral text-ink">{vendorPriceLabel(lowest.price)}</span>
      {`, from ${lowest.vendor}.`}
    </p>
  );
}
