import Form from "next/form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldLabel } from "@/components/ui/field-label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PRODUCT_STATUSES } from "@/features/catalog/catalog-types";

import { PRODUCT_LIST_PARAM, PRODUCT_STATUS_LABEL, type ProductListQuery } from "../product-types";
import { ADMIN_ROUTES } from "../types";
import { CategoryTypeFilter } from "./category-type-filter";

/* ---------------------------------------------------------------------------
   ProductFilters — search and filter the admin product list (D116, D127).

   A GET form: the filter lives in the URL, so a filtered list can be
   reloaded, shared between the owner's phone and tablet, and paged. `next/
   form` turns the submit into a client navigation. Changing a filter starts
   again at page 1, because the form never posts `page`.

   Brand and vendor are dropdowns of the catalogue's own spellings (owner,
   2026-10-01). D127 adds Vendor, Accessory type (shown while Accessories is
   chosen, `category-type-filter.tsx`), Rim size (a tire's rim or a wheel's
   diameter) and a no-photo tick box. "Change all matching" honours every one.
   --------------------------------------------------------------------------- */

/** The dropdowns' choices, read from the catalogue by the page. */
export interface ProductFilterOptions {
  brands: readonly string[];
  vendors: readonly string[];
  /** Inches, smallest first. */
  rims: readonly number[];
}

export function ProductFilters({
  query,
  options,
}: {
  query: Omit<ProductListQuery, "page">;
  options: ProductFilterOptions;
}) {
  const filtered = Object.values(query).some((value) => value !== undefined && value !== "");

  return (
    // Keyed on the query so Clear, Back and a filter change re-render the
    // controls from the URL: an uncontrolled field keeps its old DOM value
    // across a client navigation to the same route.
    <Form key={JSON.stringify(query)} action={ADMIN_ROUTES.products} className="flex flex-col gap-4" role="search">
      <div>
        <FieldLabel htmlFor="product-search">Search</FieldLabel>
        <Input
          id="product-search"
          name={PRODUCT_LIST_PARAM.search}
          type="search"
          density="compact"
          defaultValue={query.search ?? ""}
          placeholder="Name, brand, model or vendor SKU"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <CategoryTypeFilter category={query.category} accessoryType={query.accessoryType} />
        <div>
          <FieldLabel htmlFor="product-filter-status">Status</FieldLabel>
          <Select id="product-filter-status" name={PRODUCT_LIST_PARAM.status} density="compact" defaultValue={query.status ?? ""}>
            <option value="">Any status</option>
            {PRODUCT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {PRODUCT_STATUS_LABEL[status]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor="product-filter-brand">Brand</FieldLabel>
          <Select id="product-filter-brand" name={PRODUCT_LIST_PARAM.brand} density="compact" defaultValue={query.brand ?? ""}>
            <option value="">All brands</option>
            {options.brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor="product-filter-vendor">Vendor</FieldLabel>
          <Select id="product-filter-vendor" name={PRODUCT_LIST_PARAM.vendor} density="compact" defaultValue={query.vendor ?? ""}>
            <option value="">All vendors</option>
            {options.vendors.map((vendor) => (
              <option key={vendor} value={vendor}>
                {vendor}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor="product-filter-rim">Rim size (in)</FieldLabel>
          <Select
            id="product-filter-rim"
            name={PRODUCT_LIST_PARAM.rim}
            density="compact"
            defaultValue={query.rim === undefined ? "" : String(query.rim)}
          >
            <option value="">All sizes</option>
            {options.rims.map((rim) => (
              <option key={rim} value={String(rim)}>
                {String(rim)}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <Checkbox
        id="product-filter-no-photo"
        name={PRODUCT_LIST_PARAM.noPhoto}
        value="1"
        defaultChecked={query.noPhoto === true}
      >
        Only products with no photo
      </Checkbox>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="secondary" size="compact">
          Apply
        </Button>
        {filtered ? (
          <Button href={ADMIN_ROUTES.products} variant="tertiary" size="compact">
            Clear
          </Button>
        ) : null}
      </div>
    </Form>
  );
}
