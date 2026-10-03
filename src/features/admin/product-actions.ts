"use server";

/* ---------------------------------------------------------------------------
   Product admin Server Actions: create, edit, and change status (one product
   or many).

   Every action calls `requireAdminAction(formData)` before anything else
   (D95). A Server Action is a public POST endpoint whether or not the page
   that renders its form is gated.

   These are thin on purpose. Validation is `parseProductInput()` and the
   writes are `@/features/catalog/store`; an action only checks the caller,
   reads the form, and turns the store's answer into form state.

   There is no delete action. A product leaves the site by becoming `hidden`
   or `discontinued`.

   Signatures match `useActionState(action, INITIAL_STATE)`, the one form
   idiom in this repo (`payment-link-actions.ts`).
   --------------------------------------------------------------------------- */

import { updateTag } from "next/cache";

import { CATALOGUE_TAG } from "@/features/catalog/cache-tag";
import {
  ACCESSORY_KINDS,
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,
  type AdminProductFilter,
  type ProductInput,
  type ProductStatus,
  type WriteProductResult,
} from "@/features/catalog/catalog-types";
import { brandExists, vendorExists } from "@/features/catalog/lookups";
import {
  PRODUCT_FIELD,
  parseProductInput,
  readerFromFormData,
  type ProductFieldErrors,
} from "@/features/catalog/product-input";
import {
  bulkSetProductStatus,
  createProduct,
  setProductStatus,
  updateProduct,
} from "@/features/catalog/store";

import {
  BULK_IDS_MAX,
  PRODUCT_ID_FIELD,
  PRODUCT_STATUS_FIELD,
  type ProductFormState,
  type ProductStatusState,
} from "./product-types";
import { requireAdminAction } from "./session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

/** The only names echoed back: the product form's own fields. */
const ECHOED_FIELDS: readonly string[] = [
  ...Object.values(PRODUCT_FIELD),
  PRODUCT_ID_FIELD,
];

/**
 * The form's fields as typed, so a rejected submit can refill it. Known names
 * only: the CSRF token and anything else posted alongside are never sent
 * back, and a stray field called `constructor` cannot trip the lookup.
 */
function echo(formData: FormData): Record<string, string[]> {
  const values: Record<string, string[]> = {};
  for (const name of ECHOED_FIELDS) {
    const posted = formData
      .getAll(name)
      .filter((value): value is string => typeof value === "string");
    if (posted.length > 0) values[name] = posted;
  }
  return values;
}

function invalid(
  formData: FormData,
  errors: ProductFieldErrors,
  formError?: string,
): ProductFormState {
  return { status: "invalid", errors, formError, values: echo(formData) };
}

/**
 * A write landed: expire every cached catalogue read (the home page's
 * featured row today), so the storefront is never staler than the last save.
 * `updateTag` also makes Next re-render the route the form was posted from.
 */
function catalogueChanged(): void {
  updateTag(CATALOGUE_TAG);
}

function fromWriteResult(
  formData: FormData,
  result: WriteProductResult,
): ProductFormState {
  if (result.ok) {
    catalogueChanged();
    return { status: "saved", id: result.id, slug: result.slug };
  }
  switch (result.reason) {
    case "source_taken":
      return invalid(formData, {
        sourceSku: `Another product already uses ${result.vendor} SKU ${result.vendorSku}.`,
      });
    case "category_changed":
      return invalid(formData, {
        category: "A product's category can't be changed once it is created.",
      });
    case "not_found":
      return invalid(
        formData,
        {},
        "This product no longer exists. Go back to the list and try again.",
      );
  }
}

/**
 * Brands and vendors are chosen from the catalogue's own, never typed new
 * (owner, 2026-10-01; D116). The dropdowns only offer existing spellings, and
 * this holds the same line for a hand-made POST. A brand must already be on a
 * product of the same category (D127), as the dropdown offers. On an edit the
 * product's own brand is on the product itself, so a product is never stuck on
 * save. An accessory may have no brand at all (D125).
 */
async function unknownNames(input: ProductInput): Promise<ProductFieldErrors> {
  const errors: ProductFieldErrors = {};
  // No brand is legal on an accessory only (D125), and the validator has
  // already refused it on a tire or wheel, so a `null` here has nothing to look
  // up.
  if (input.brand !== null && !(await brandExists(input.brand, input.category))) {
    errors.brand = "Choose a brand from the list.";
  }
  const vendors = [...new Set(input.sources.map((source) => source.vendor))];
  const known = await Promise.all(vendors.map((vendor) => vendorExists(vendor)));
  if (known.includes(false)) {
    errors.sourceVendor = "Choose each vendor from the list.";
  }
  return errors;
}

export async function createProductAction(
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireAdminAction(formData);

  const parsed = parseProductInput(readerFromFormData(formData));
  if (!parsed.ok) return invalid(formData, parsed.errors);
  const unknown = await unknownNames(parsed.input);
  if (Object.keys(unknown).length > 0) return invalid(formData, unknown);

  // A product made here always starts hidden, whatever the form posted (D107b):
  // publishing is its own, deliberate step.
  return fromWriteResult(
    formData,
    await createProduct({ ...parsed.input, status: "hidden" }),
  );
}

export async function updateProductAction(
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireAdminAction(formData);

  const id = readString(formData, PRODUCT_ID_FIELD);
  if (!UUID.test(id)) {
    return fromWriteResult(formData, { ok: false, reason: "not_found" });
  }

  const parsed = parseProductInput(readerFromFormData(formData));
  if (!parsed.ok) return invalid(formData, parsed.errors);
  const unknown = await unknownNames(parsed.input);
  if (Object.keys(unknown).length > 0) return invalid(formData, unknown);

  return fromWriteResult(formData, await updateProduct(id, parsed.input));
}

function readTargetStatus(formData: FormData): ProductStatus | null {
  const raw = readString(formData, PRODUCT_STATUS_FIELD.status);
  return (PRODUCT_STATUSES as readonly string[]).includes(raw)
    ? (raw as ProductStatus)
    : null;
}

/** Publish, hide or discontinue one product. */
export async function setProductStatusAction(
  _prevState: ProductStatusState,
  formData: FormData,
): Promise<ProductStatusState> {
  await requireAdminAction(formData);

  const status = readTargetStatus(formData);
  if (status === null) {
    return { status: "invalid", message: "Choose a status from the list." };
  }
  const id = readString(formData, PRODUCT_ID_FIELD);
  if (!UUID.test(id) || !(await setProductStatus(id, status))) {
    return {
      status: "invalid",
      message: "This product no longer exists. Reload the list and try again.",
    };
  }
  catalogueChanged();
  return { status: "done", to: status, changed: 1 };
}

/**
 * `null` when a filter value is not one of its options. Dropping it instead
 * would WIDEN the change: `filter_status=Hidden` (wrong case) would quietly
 * become "every status".
 */
function readFilter(formData: FormData): AdminProductFilter | null {
  const rawCategory = readString(formData, PRODUCT_STATUS_FIELD.filterCategory);
  const rawStatus = readString(formData, PRODUCT_STATUS_FIELD.filterStatus);
  const rawType = readString(formData, PRODUCT_STATUS_FIELD.filterAccessoryType);
  const rawRim = readString(formData, PRODUCT_STATUS_FIELD.filterRim);
  const rawNoPhoto = readString(formData, PRODUCT_STATUS_FIELD.filterNoPhoto);
  const category = PRODUCT_CATEGORIES.find((value) => value === rawCategory);
  const status = PRODUCT_STATUSES.find((value) => value === rawStatus);
  const accessoryType = ACCESSORY_KINDS.find((value) => value === rawType);
  const rim = rawRim === "" ? undefined : Number(rawRim);
  if (rawCategory !== "" && category === undefined) return null;
  if (rawStatus !== "" && status === undefined) return null;
  if (rawType !== "" && accessoryType === undefined) return null;
  // The list shows a type only with the accessories category (the page drops
  // it otherwise), so a type without it is a filter no list showed.
  if (accessoryType !== undefined && category !== "accessories") return null;
  if (rim !== undefined && !(Number.isFinite(rim) && rim > 0)) return null;
  if (rawNoPhoto !== "" && rawNoPhoto !== "1") return null;
  return {
    search: readString(formData, PRODUCT_STATUS_FIELD.filterSearch) || undefined,
    brand: readString(formData, PRODUCT_STATUS_FIELD.filterBrand) || undefined,
    vendor: readString(formData, PRODUCT_STATUS_FIELD.filterVendor) || undefined,
    category,
    status,
    accessoryType,
    rim,
    noPhoto: rawNoPhoto === "1" ? true : undefined,
  };
}

/**
 * Publish, hide or discontinue many products: the ticked rows, or everything
 * the list's current filter matches. With neither, nothing is changed; an
 * empty submit must never mean "the whole catalogue".
 */
export async function bulkSetProductStatusAction(
  _prevState: ProductStatusState,
  formData: FormData,
): Promise<ProductStatusState> {
  await requireAdminAction(formData);

  const status = readTargetStatus(formData);
  if (status === null) {
    return { status: "invalid", message: "Choose a status from the list." };
  }

  // Ticked rows and the filter are two different requests, and ticked rows
  // win: once any `ids` field is posted the filter is never consulted, so a
  // mangled id can only fail the submit, never widen it to the whole filter.
  const posted = formData.getAll(PRODUCT_STATUS_FIELD.ids);
  const ids = posted
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim());
  if (posted.length > 0) {
    if (ids.length !== posted.length || !ids.every((id) => UUID.test(id))) {
      return {
        status: "invalid",
        message: "Some selected products could not be read. Reload the list and try again.",
      };
    }
    if (ids.length > BULK_IDS_MAX) {
      return {
        status: "invalid",
        message: `Select at most ${BULK_IDS_MAX} products at a time, or filter the list and change everything it shows.`,
      };
    }
  }

  const filter = posted.length > 0 ? {} : readFilter(formData);
  if (filter === null) {
    return {
      status: "invalid",
      message: "The list filter could not be read. Reload the list and try again.",
    };
  }

  const result = await bulkSetProductStatus({ ids, filter }, status);
  if (!result.ok) {
    return {
      status: "invalid",
      message: "Select some products or filter the list first.",
    };
  }
  catalogueChanged();
  return { status: "done", to: status, changed: result.changed };
}
