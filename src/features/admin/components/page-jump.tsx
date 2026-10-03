import Form from "next/form";

import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field-label";
import { Input } from "@/components/ui/input";

import { PRODUCT_LIST_PARAM } from "../product-types";
import { ADMIN_ROUTES } from "../types";

/* ---------------------------------------------------------------------------
   PageJump — "Go to page" beside Previous / Next on the product list (D127).

   NO ARTBOARD DRAWS THIS (D89). A GET form like `ProductFilters`: the list's
   current filter rides along as hidden fields, so jumping keeps it, and the
   page number lands in the URL. The page reads the number strictly: blank or
   junk is page 1, and a number past the end is sent to the last page
   (`src/app/admin/products/page.tsx`). No JavaScript of its own.
   --------------------------------------------------------------------------- */

export function PageJump({
  params,
  page,
}: {
  /** The list's filter as query-string pairs, without `page`. */
  params: readonly (readonly [string, string])[];
  page: number;
}) {
  return (
    // Keyed on where the list is, so the box shows the current page again
    // after a jump: an uncontrolled field keeps its old value across a client
    // navigation to the same route.
    <Form key={`${page}?${new URLSearchParams(params.map(([name, value]) => [name, value])).toString()}`} action={ADMIN_ROUTES.products} className="flex items-end gap-2">
      {params.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {/* The page count is already in the list's heading (`page 3 of 844`). */}
      <div className="w-32">
        <FieldLabel htmlFor="product-page-jump">Go to page</FieldLabel>
        <Input
          id="product-page-jump"
          name={PRODUCT_LIST_PARAM.page}
          type="number"
          inputMode="numeric"
          // No `max`: the browser would refuse a number past the end with its
          // own message, and the page sends one to the last page instead.
          min={1}
          step={1}
          density="compact"
          defaultValue={String(page)}
          autoComplete="off"
        />
      </div>
      <Button type="submit" variant="secondary" size="compact">
        Go
      </Button>
    </Form>
  );
}
