/**
 * Product admin contract: the field names and result shapes the product
 * forms and their Server Actions agree on. Written before the forms exist
 * (D25), so whoever builds the screens codes against this and invents nothing.
 *
 * The product's own fields (brand, size, specs, sources …) are not repeated
 * here: they are `PRODUCT_FIELD` in `@/features/catalog/product-input`, next
 * to the validator that reads them. This file holds only what is the admin's
 * own: which product a form is editing, the status controls, the list filter.
 *
 * Types and constants only, so a `"use client"` form can import it.
 */

import type {
  ProductCategory,
  ProductStatus,
} from "@/features/catalog/catalog-types";
import type { ProductFieldErrors } from "@/features/catalog/product-input";

/** Hidden field on the edit form: which product is being saved. */
export const PRODUCT_ID_FIELD = "product_id";

/**
 * Create / edit result. Shaped like `PaymentLinkState` (`types.ts`): the one
 * `useActionState` idiom this repo uses.
 *
 * `formError` is for a failure that belongs to no single field, e.g. the
 * product was removed in another tab.
 *
 * `errors` is keyed by `ProductFieldKey` (`tireSize`); `values` by the posted
 * field name (`tire_size`). A form goes from one to the other through
 * `PRODUCT_FIELD[key]`.
 */
export type ProductFormState =
  | { status: "idle" }
  | {
      status: "invalid";
      errors: ProductFieldErrors;
      formError?: string;
      /** Everything as typed, keyed by field name, so a rejected submit never
       *  blanks or rewrites the form. Repeated fields keep every value. */
      values: Readonly<Record<string, readonly string[]>>;
    }
  | { status: "saved"; id: string; slug: string };

export const PRODUCT_FORM_INITIAL_STATE: ProductFormState = { status: "idle" };

/**
 * Field names for the status controls.
 *
 * One product: `PRODUCT_ID_FIELD` + `status`.
 * Many products: `status`, plus EITHER `ids` (repeated, the ticked rows) OR
 * the `filter*` fields (the list's current filter, meaning "everything this
 * list matches"). Ticked rows win: if any `ids` field is posted the filter is
 * ignored, and an unreadable id fails the submit rather than falling back to
 * the filter. A "change ticked" form with nothing ticked must therefore post
 * no filter fields, or it means "everything the list matches".
 */
export const PRODUCT_STATUS_FIELD = {
  status: "status",
  ids: "ids",
  filterSearch: "filter_search",
  filterCategory: "filter_category",
  filterStatus: "filter_status",
  filterBrand: "filter_brand",
} as const;

export type ProductStatusState =
  | { status: "idle" }
  | { status: "invalid"; message: string }
  | { status: "done"; to: ProductStatus; changed: number };

export const PRODUCT_STATUS_INITIAL_STATE: ProductStatusState = {
  status: "idle",
};

/** The list page's query string, parsed. Every key is optional. */
export interface ProductListQuery {
  search?: string;
  category?: ProductCategory;
  status?: ProductStatus;
  brand?: string;
  page?: number;
}

/** Rows per page on the admin product list. */
export const PRODUCT_LIST_PAGE_SIZE = 50;

/** Ceiling on ticked rows in one bulk submit. Anything larger should use the
 *  filter form instead, which has no ceiling. */
export const BULK_IDS_MAX = 500;
