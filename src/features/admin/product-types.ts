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
  AccessoryKind,
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
  /** D127. `filterNoPhoto` is `1` or absent; `filterRim` is inches. */
  filterVendor: "filter_vendor",
  filterAccessoryType: "filter_accessory_type",
  filterRim: "filter_rim",
  filterNoPhoto: "filter_no_photo",
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
  /** D127: vendor, accessory type (only with the accessories category), rim
   *  size in inches, and "no photo" (`true` or absent, never `false`). */
  vendor?: string;
  accessoryType?: AccessoryKind;
  rim?: number;
  noPhoto?: true;
  page?: number;
}

/** Rows per page on the admin product list. */
export const PRODUCT_LIST_PAGE_SIZE = 50;

/** Ceiling on ticked rows in one bulk submit. Anything larger should use the
 *  filter form instead, which has no ceiling. */
export const BULK_IDS_MAX = 500;

/** The list page's query-string keys. One place, because the filter form, the
 *  pagination links and the "change all matching" form all build them. */
export const PRODUCT_LIST_PARAM = {
  search: "q",
  category: "category",
  status: "status",
  brand: "brand",
  vendor: "vendor",
  accessoryType: "type",
  rim: "rim",
  /** `1` when ticked; absent otherwise. */
  noPhoto: "no_photo",
  page: "page",
} as const;

/** The bulk status form's id. Each list card's tick box carries
 *  `form={BULK_FORM_ID}` so it belongs to that form wherever it sits. Lives
 *  here, not in the client island, because a server component that imports
 *  a value from a `"use client"` module gets a client reference, not the
 *  string. */
export const BULK_FORM_ID = "product-bulk";

/** Staff-facing words for each status. The enum values stay the database's. */
export const PRODUCT_STATUS_LABEL = {
  hidden: "Hidden",
  published: "Published",
  discontinued: "Discontinued",
} as const satisfies Record<ProductStatus, string>;

/** The verb on the button that moves a product INTO each status. */
export const PRODUCT_STATUS_VERB = {
  hidden: "Hide",
  published: "Publish",
  discontinued: "Discontinue",
} as const satisfies Record<ProductStatus, string>;

/* --- Photos (D117) ------------------------------------------------------- */

/** Field names the photo actions read, beside `PRODUCT_ID_FIELD` and the
 *  CSRF field. */
export const PHOTO_FIELD = {
  photoId: "photo_id",
  move: "move",
  key: "key",
  fileName: "file_name",
  contentType: "content_type",
  size: "size",
} as const;

/** What a photo may be (owner, 2026-10-01): 8 per product, 10 MB each, JPEG,
 *  PNG or WebP. The count is enforced beside the writes, in
 *  `@/features/catalog/photos` (`MAX_PHOTOS_PER_PRODUCT`), and repeated here
 *  only so a client island can state it without importing that module. */
export const PHOTO_LIMITS = {
  perProduct: 8,
  maxBytes: 10 * 1024 * 1024,
  contentTypes: ["image/jpeg", "image/png", "image/webp"],
} as const;

/** `accept` for the file input: the three types, by MIME and extension. An
 *  iPhone converts a HEIC photo to JPEG when the input does not accept HEIC. */
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

/** The upload handshake's answer (D126): the staging key `addPhoto` is then
 *  handed, and the short-lived signed link that accepts one `PUT` there. */
export type PhotoUploadTicket =
  | { ok: true; key: string; uploadUrl: string }
  | { ok: false; message: string };

/** Result of add / remove / move. */
export type PhotoActionResult = { ok: true } | { ok: false; message: string };
