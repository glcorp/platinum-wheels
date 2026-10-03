"use client";

/* ---------------------------------------------------------------------------
   CategoryTypeFilter — the product list's Category select, and the
   Accessory type select that appears beside it while Accessories is chosen
   (D127).

   A client island only so the type select can appear the moment Accessories
   is picked, without an Apply first. Both stay plain fields of the list's GET
   form (`product-filters.tsx`): when another category is chosen the type
   select unmounts, so it is never posted, and the page ignores a type without
   the accessories category anyway (`src/app/admin/products/page.tsx`).

   Returns two grid cells, so it sits in the filter grid like any other field.
   --------------------------------------------------------------------------- */

import { useState } from "react";

import { FieldLabel } from "@/components/ui/field-label";
import { Select } from "@/components/ui/select";
import {
  ACCESSORY_KINDS,
  PRODUCT_CATEGORIES,
  type AccessoryKind,
  type ProductCategory,
} from "@/features/catalog/catalog-types";

import { CATEGORY_PLURAL, accessoryKindLabel } from "../product-display";
import { PRODUCT_LIST_PARAM } from "../product-types";

export function CategoryTypeFilter({
  category,
  accessoryType,
}: {
  category?: ProductCategory;
  accessoryType?: AccessoryKind;
}) {
  const [chosen, setChosen] = useState<string>(category ?? "");

  return (
    <>
      <div>
        <FieldLabel htmlFor="product-filter-category">Category</FieldLabel>
        <Select
          id="product-filter-category"
          name={PRODUCT_LIST_PARAM.category}
          density="compact"
          defaultValue={category ?? ""}
          onChange={(event) => setChosen(event.currentTarget.value)}
        >
          <option value="">All categories</option>
          {PRODUCT_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {CATEGORY_PLURAL[value]}
            </option>
          ))}
        </Select>
      </div>
      {chosen === "accessories" ? (
        <div>
          <FieldLabel htmlFor="product-filter-type">Accessory type</FieldLabel>
          <Select
            id="product-filter-type"
            name={PRODUCT_LIST_PARAM.accessoryType}
            density="compact"
            defaultValue={accessoryType ?? ""}
          >
            <option value="">All types</option>
            {ACCESSORY_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {accessoryKindLabel(kind)}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
    </>
  );
}
