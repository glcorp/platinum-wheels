import Form from "next/form";

import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field-label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PRODUCT_CATEGORIES, PRODUCT_STATUSES } from "@/features/catalog/catalog-types";

import { CATEGORY_PLURAL } from "../product-display";
import { PRODUCT_LIST_PARAM, PRODUCT_STATUS_LABEL, type ProductListQuery } from "../product-types";
import { ADMIN_ROUTES } from "../types";

/* ---------------------------------------------------------------------------
   ProductFilters — search and filter the admin product list (D116).

   A GET form: the filter lives in the URL, so a filtered list can be
   reloaded, shared between the owner's phone and tablet, and paged. `next/
   form` turns the submit into a client navigation. Changing a filter starts
   again at page 1, because the form never posts `page`.

   Brand is a dropdown of the catalogue's own spellings (owner, 2026-10-01).
   --------------------------------------------------------------------------- */

export function ProductFilters({
  query,
  brands,
}: {
  query: Omit<ProductListQuery, "page">;
  brands: readonly string[];
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
        <div>
          <FieldLabel htmlFor="product-filter-category">Category</FieldLabel>
          <Select id="product-filter-category" name={PRODUCT_LIST_PARAM.category} density="compact" defaultValue={query.category ?? ""}>
            <option value="">All categories</option>
            {PRODUCT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_PLURAL[category]}
              </option>
            ))}
          </Select>
        </div>
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
            {brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </Select>
        </div>
      </div>
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
