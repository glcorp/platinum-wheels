"use client";

/* ---------------------------------------------------------------------------
   ProductForm — create and edit one product (D116).

   NO ARTBOARD DRAWS THIS (D89). Every box reuses an existing primitive and
   token; the form idiom is `payment-link-form.tsx`'s: `useActionState` on a
   Server Action, the server echoing every typed value back on a rejected
   save, focus moved to the first field that failed.

   **Why the fields remount after every save.** React resets a form after
   its action runs, back to each input's `defaultValue`. The fields here
   (repeatable source rows included) take their defaults from one value map,
   the product as saved or the server's echo of what was typed, and the whole
   field block is keyed by a counter that moves on every answer. So a rejected
   save shows exactly what was typed, and a successful edit shows exactly what
   was saved, with no field-by-field state to keep in step.

   **What the form never posts.** Status: a new product always starts hidden
   (D107b) and status changes are their own buttons. Category: fixed once
   created, so it rides along as a hidden field.

   Brand and vendor are dropdowns of what the catalogue already has (owner,
   2026-10-01: pick from existing only). The action enforces the same, D116.
   --------------------------------------------------------------------------- */

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError, FieldLabel } from "@/components/ui/field-label";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  ACCESSORY_KINDS,
  TIRE_SEASONS,
  type ProductCategory,
} from "@/features/catalog/catalog-types";
import {
  PRODUCT_FIELD,
  PRODUCT_LIMITS,
  type ProductFieldErrors,
  type ProductFieldKey,
} from "@/features/catalog/product-input";

import { createProductAction, updateProductAction } from "../product-actions";
import {
  CATEGORY_LABEL,
  SEASON_LABEL,
  accessoryKindLabel,
} from "../product-display";
import {
  PRODUCT_FORM_INITIAL_STATE,
  PRODUCT_ID_FIELD,
  type ProductFormState,
} from "../product-types";
import { ADMIN_CSRF_FIELD, adminProductRoute } from "../types";

type Values = Readonly<Record<string, readonly string[]>>;
type Versioned = ProductFormState & { version: number };

const F = PRODUCT_FIELD;

/** Drawn order, for "focus the first field that failed". */
const FIELD_ORDER: readonly ProductFieldKey[] = [
  "brand",
  "model",
  "name",
  "description",
  "price",
  "gtin",
  "tireSize",
  "season",
  "loadIndex",
  "speedRating",
  "loadRange",
  "plyRating",
  "serviceType",
  "utqg",
  "wheelDiameter",
  "wheelWidth",
  "boltPatterns",
  "offsetMm",
  "centerBoreMm",
  "backspacing",
  "wheelFinish",
  "material",
  "wheelSeatType",
  "loadRatingLbs",
  "tpmsCompatible",
  "winterCompatible",
  "accessoryType",
  "threadSize",
  "accessorySeatType",
  "accessoryFinish",
  "packQuantity",
  "outerDiameterMm",
  "innerDiameterMm",
  "sourceVendor",
  "sourceSku",
  "sourceUrl",
];

/** The id of the control a field's error should focus. Source errors belong
 *  to the whole group, so they focus its first row. */
function controlId(key: ProductFieldKey): string {
  if (key === "sourceVendor" || key === "sourceSku" || key === "sourceUrl") {
    return `product-${F[key]}-0`;
  }
  return `product-${F[key]}`;
}

function first(values: Values, field: string): string {
  return values[field]?.[0] ?? "";
}

/* --- Field helpers ------------------------------------------------------- */

interface FieldCommon {
  fieldKey: ProductFieldKey;
  label: string;
  values: Values;
  errors: ProductFieldErrors;
  required?: boolean;
  hint?: string;
}

function errorId(key: ProductFieldKey): string {
  return `product-${F[key]}-error`;
}

function describedBy(key: ProductFieldKey, errors: ProductFieldErrors, hint?: string): string | undefined {
  const ids = [hint ? `product-${F[key]}-hint` : null, errors[key] ? errorId(key) : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

function Hint({ fieldKey, children }: { fieldKey: ProductFieldKey; children: ReactNode }) {
  return (
    <p id={`product-${F[fieldKey]}-hint`} className="text-ink-dim mt-1.5 text-13 leading-body">
      {children}
    </p>
  );
}

function Problem({ fieldKey, errors }: { fieldKey: ProductFieldKey; errors: ProductFieldErrors }) {
  const message = errors[fieldKey];
  return message ? <FieldError id={errorId(fieldKey)}>{message}</FieldError> : null;
}

function TextField({
  fieldKey,
  label,
  values,
  errors,
  required,
  hint,
  inputMode,
  placeholder,
  maxLength,
  spellCheck = false,
}: FieldCommon & {
  inputMode?: "text" | "decimal" | "numeric" | "url";
  placeholder?: string;
  maxLength?: number;
  spellCheck?: boolean;
}) {
  const name = F[fieldKey];
  return (
    <div>
      <FieldLabel htmlFor={`product-${name}`} required={required}>
        {label}
      </FieldLabel>
      <Input
        id={`product-${name}`}
        name={name}
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        spellCheck={spellCheck}
        placeholder={placeholder}
        maxLength={maxLength}
        defaultValue={first(values, name)}
        invalid={Boolean(errors[fieldKey])}
        aria-describedby={describedBy(fieldKey, errors, hint)}
      />
      {hint ? <Hint fieldKey={fieldKey}>{hint}</Hint> : null}
      <Problem fieldKey={fieldKey} errors={errors} />
    </div>
  );
}

function SelectField({
  fieldKey,
  label,
  values,
  errors,
  required,
  hint,
  placeholder,
  options,
}: FieldCommon & {
  placeholder: string;
  options: readonly { value: string; label: string }[];
}) {
  const name = F[fieldKey];
  return (
    <div>
      <FieldLabel htmlFor={`product-${name}`} required={required}>
        {label}
      </FieldLabel>
      <Select
        id={`product-${name}`}
        name={name}
        defaultValue={first(values, name)}
        invalid={Boolean(errors[fieldKey])}
        aria-describedby={describedBy(fieldKey, errors, hint)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      {hint ? <Hint fieldKey={fieldKey}>{hint}</Hint> : null}
      <Problem fieldKey={fieldKey} errors={errors} />
    </div>
  );
}

const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
] as const;

function FlagField({ fieldKey, label, values }: { fieldKey: ProductFieldKey; label: string; values: Values }) {
  const name = F[fieldKey];
  return (
    <Checkbox id={`product-${name}`} name={name} value="on" defaultChecked={first(values, name) === "on"}>
      {label}
    </Checkbox>
  );
}

/** A titled group. A `<section>` + `<h2>` rather than `<fieldset>` +
 *  `<legend>`: a legend paints on the fieldset's top border and ignores flex
 *  gap, and each field here already carries its own label. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = `product-section-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section
      aria-labelledby={id}
      className="border-border-strong flex min-w-0 flex-col gap-5 border-t pt-8 sm:gap-6 sm:pt-10"
    >
      <h2 id={id} className="display text-ink text-display-24 sm:text-display-28">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Pair({ children }: { children: ReactNode }) {
  return <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">{children}</div>;
}

/* --- Sources ------------------------------------------------------------- */

interface SourceRow {
  key: number;
  vendor: string;
  sku: string;
  url: string;
}

function initialRows(values: Values): SourceRow[] {
  const vendors = values[F.sourceVendor] ?? [];
  const skus = values[F.sourceSku] ?? [];
  const urls = values[F.sourceUrl] ?? [];
  const count = Math.max(vendors.length, skus.length, urls.length);
  return Array.from({ length: count }, (_, index) => ({
    key: index,
    vendor: vendors[index] ?? "",
    sku: skus[index] ?? "",
    url: urls[index] ?? "",
  }));
}

function SourcesFields({
  values,
  errors,
  vendors,
}: {
  values: Values;
  errors: ProductFieldErrors;
  vendors: readonly string[];
}) {
  const [rows, setRows] = useState<SourceRow[]>(() => initialRows(values));
  const nextKey = useRef(rows.length);
  const groupError = errors.sourceVendor ?? errors.sourceSku ?? errors.sourceUrl;

  return (
    <Section title="Where to order it">
      <p id="product-sources-hint" className="text-ink-muted -mt-2 text-14 leading-body sm:text-15">
        Staff only. Never shown on the storefront.
      </p>
      {rows.length === 0 ? (
        <p className="text-ink-dim text-14 leading-body">No vendor listed.</p>
      ) : null}
      {rows.map((row, index) => {
        // A vendor no longer in the catalogue (this row's own, on an edit)
        // stays choosable, so opening the form never blanks it.
        const options = vendors.includes(row.vendor) || row.vendor === "" ? vendors : [row.vendor, ...vendors];
        return (
          <div key={row.key} className="bg-surface border-border-strong flex flex-col gap-4 border p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="label text-ink-dim text-11 tracking-12">{`Source ${index + 1}`}</span>
              <Button
                type="button"
                variant="tertiary"
                size="compact"
                onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
              >
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
                aria-describedby={groupError ? "product-sources-error" : undefined}
              >
                <option value="">Choose a vendor</option>
                {options.map((vendor) => (
                  <option key={vendor} value={vendor}>
                    {vendor}
                  </option>
                ))}
              </Select>
            </div>
            <Pair>
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
                  aria-describedby={groupError ? "product-sources-error" : undefined}
                />
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
                  aria-describedby={groupError ? "product-sources-error" : undefined}
                />
              </div>
            </Pair>
          </div>
        );
      })}
      {groupError ? <FieldError id="product-sources-error">{groupError}</FieldError> : null}
      {rows.length < PRODUCT_LIMITS.sources ? (
        <div>
          <Button
            type="button"
            variant="secondary"
            size="compact"
            onClick={() => {
              const key = nextKey.current;
              nextKey.current += 1;
              setRows((current) => [...current, { key, vendor: "", sku: "", url: "" }]);
            }}
          >
            Add a source
          </Button>
        </div>
      ) : null}
    </Section>
  );
}

/* --- Category sections --------------------------------------------------- */

function TireFields({ values, errors }: { values: Values; errors: ProductFieldErrors }) {
  const common = { values, errors };
  return (
    <Section title="Tire details">
      <TextField
        {...common}
        fieldKey="tireSize"
        label="Size"
        required
        placeholder="225/45R17"
        hint="Metric like 225/45R17, or flotation like 35x12.50R20."
      />
      <SelectField
        {...common}
        fieldKey="season"
        label="Season"
        placeholder="Not stated"
        options={TIRE_SEASONS.map((season) => ({ value: season, label: SEASON_LABEL[season] }))}
      />
      <Pair>
        <TextField {...common} fieldKey="loadIndex" label="Load index" placeholder="94" />
        <TextField {...common} fieldKey="speedRating" label="Speed rating" placeholder="H" />
      </Pair>
      <Pair>
        <TextField {...common} fieldKey="loadRange" label="Load range" placeholder="E" />
        <TextField {...common} fieldKey="plyRating" label="Ply rating" inputMode="numeric" placeholder="10" />
      </Pair>
      <Pair>
        <TextField
          {...common}
          fieldKey="serviceType"
          label="Service type"
          placeholder="LT"
          hint="Leave blank to take it from the size."
        />
        <TextField {...common} fieldKey="utqg" label="UTQG" placeholder="500 A A" />
      </Pair>
      <div className="flex flex-col gap-1">
        <FlagField fieldKey="winterApproved" label="Winter approved (3PMSF)" values={values} />
        <FlagField fieldKey="studdable" label="Studdable" values={values} />
        <FlagField fieldKey="isXl" label="Extra load (XL)" values={values} />
        <FlagField fieldKey="runFlat" label="Run-flat" values={values} />
      </div>
    </Section>
  );
}

function WheelFields({ values, errors }: { values: Values; errors: ProductFieldErrors }) {
  const common = { values, errors };
  const triOptions = YES_NO.map((option) => ({ ...option }));
  return (
    <Section title="Wheel details">
      <Pair>
        <TextField {...common} fieldKey="wheelDiameter" label="Diameter (in)" required inputMode="decimal" placeholder="18" />
        <TextField {...common} fieldKey="wheelWidth" label="Width (in)" required inputMode="decimal" placeholder="8.5" />
      </Pair>
      <TextField
        {...common}
        fieldKey="boltPatterns"
        label="Bolt patterns"
        placeholder="5x114.3, 5x120"
        hint="Separate two or more with commas."
      />
      <Pair>
        <TextField {...common} fieldKey="offsetMm" label="Offset (mm)" inputMode="decimal" placeholder="+35" />
        <TextField {...common} fieldKey="centerBoreMm" label="Centre bore (mm)" inputMode="decimal" placeholder="72.6" />
      </Pair>
      <Pair>
        <TextField {...common} fieldKey="backspacing" label="Backspacing (in)" inputMode="decimal" placeholder="6.38" />
        <TextField {...common} fieldKey="loadRatingLbs" label="Load rating (lbs)" inputMode="numeric" placeholder="1800" />
      </Pair>
      <TextField {...common} fieldKey="wheelFinish" label="Finish" placeholder="Gloss black machined" spellCheck />
      <Pair>
        <TextField {...common} fieldKey="material" label="Material" placeholder="Alloy" spellCheck />
        <TextField {...common} fieldKey="wheelSeatType" label="Seat type" placeholder="Conical" spellCheck />
      </Pair>
      <Pair>
        <SelectField {...common} fieldKey="tpmsCompatible" label="TPMS compatible" placeholder="Not stated" options={triOptions} />
        <SelectField {...common} fieldKey="winterCompatible" label="Winter use" placeholder="Not stated" options={triOptions} />
      </Pair>
    </Section>
  );
}

function AccessoryFields({ values, errors }: { values: Values; errors: ProductFieldErrors }) {
  const common = { values, errors };
  return (
    <Section title="Accessory details">
      <SelectField
        {...common}
        fieldKey="accessoryType"
        label="Type"
        required
        placeholder="Choose a type"
        options={ACCESSORY_KINDS.map((kind) => ({ value: kind, label: accessoryKindLabel(kind) }))}
      />
      <Pair>
        <TextField {...common} fieldKey="threadSize" label="Thread size" placeholder="M12x1.5" />
        <TextField {...common} fieldKey="packQuantity" label="Pack quantity" inputMode="numeric" placeholder="20" />
      </Pair>
      <Pair>
        <TextField {...common} fieldKey="accessorySeatType" label="Seat type" placeholder="Conical" spellCheck />
        <TextField {...common} fieldKey="accessoryFinish" label="Finish" placeholder="Chrome" spellCheck />
      </Pair>
      <Pair>
        <TextField {...common} fieldKey="outerDiameterMm" label="Outer diameter (mm)" inputMode="decimal" placeholder="73.1" />
        <TextField {...common} fieldKey="innerDiameterMm" label="Inner diameter (mm)" inputMode="decimal" placeholder="56.1" />
      </Pair>
    </Section>
  );
}

/* --- The form ------------------------------------------------------------ */

export interface ProductFormProps {
  mode: "create" | "edit";
  category: ProductCategory;
  /** The product as saved (edit), or nothing (create). */
  initialValues: Values;
  /** The edited product's id; absent on create. */
  productId?: string;
  brands: readonly string[];
  vendors: readonly string[];
  csrfToken: string;
}

export function ProductForm({
  mode,
  category,
  initialValues,
  productId,
  brands,
  vendors,
  csrfToken,
}: ProductFormProps) {
  const router = useRouter();
  const action = mode === "create" ? createProductAction : updateProductAction;
  const [state, formAction, isPending] = useActionState<Versioned, FormData>(
    async (previous, formData) => ({ ...(await action(previous, formData)), version: previous.version + 1 }),
    { ...PRODUCT_FORM_INITIAL_STATE, version: 0 },
  );
  const savedRef = useRef<HTMLParagraphElement>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);

  const values: Values = state.status === "invalid" ? state.values : initialValues;
  const errors: ProductFieldErrors = state.status === "invalid" ? state.errors : {};
  const formError = state.status === "invalid" ? state.formError : undefined;

  useEffect(() => {
    if (state.status === "saved") {
      if (mode === "create") {
        router.push(`${adminProductRoute(state.id)}?created=1`);
      } else {
        savedRef.current?.focus();
      }
      return;
    }
    if (state.status !== "invalid") return;
    if (state.formError) {
      formErrorRef.current?.focus();
      return;
    }
    const firstKey = FIELD_ORDER.find((key) => state.errors[key]);
    if (firstKey) document.getElementById(controlId(firstKey))?.focus();
  }, [state, mode, router]);

  // A brand no longer in the catalogue (this product's own) stays choosable.
  const brandValue = first(values, F.brand);
  const brandOptions = brandValue === "" || brands.includes(brandValue) ? brands : [brandValue, ...brands];
  const errorCount = Object.keys(errors).length;

  return (
    <form action={formAction} className="flex flex-col gap-10 sm:gap-12" noValidate>
      <input type="hidden" name={ADMIN_CSRF_FIELD} value={csrfToken} />
      <input type="hidden" name={F.category} value={category} />
      {productId ? <input type="hidden" name={PRODUCT_ID_FIELD} value={productId} /> : null}

      {formError ? (
        <p
          ref={formErrorRef}
          tabIndex={-1}
          role="alert"
          className="border-accent bg-accent-subtle text-ink border p-4 text-15 leading-body"
        >
          {formError}
        </p>
      ) : null}

      <div key={state.version} className="flex flex-col gap-10 sm:gap-12">
        <Section title="Basics">
          <SelectField
            fieldKey="brand"
            label="Brand"
            required
            values={values}
            errors={errors}
            placeholder="Choose a brand"
            options={brandOptions.map((brand) => ({ value: brand, label: brand }))}
            hint={mode === "create" ? "Only brands already in the catalogue." : undefined}
          />
          <TextField
            fieldKey="model"
            label="Model"
            values={values}
            errors={errors}
            maxLength={PRODUCT_LIMITS.model}
            placeholder="Antarctica Sport"
            spellCheck
          />
          <TextField
            fieldKey="name"
            label="Product name"
            required
            values={values}
            errors={errors}
            maxLength={PRODUCT_LIMITS.name}
            spellCheck
            hint="As it reads on the card and the product page."
          />
          <div>
            <FieldLabel htmlFor={`product-${F.description}`} optional>
              Description
            </FieldLabel>
            <Textarea
              id={`product-${F.description}`}
              name={F.description}
              maxLength={PRODUCT_LIMITS.description}
              defaultValue={first(values, F.description)}
              invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? errorId("description") : undefined}
            />
            <Problem fieldKey="description" errors={errors} />
          </div>
          <Pair>
            <TextField
              fieldKey="price"
              label="Display price"
              values={values}
              errors={errors}
              inputMode="decimal"
              placeholder="129.99"
              hint="Blank shows Inquire for price."
            />
            <TextField
              fieldKey="gtin"
              label="Barcode (UPC / EAN)"
              values={values}
              errors={errors}
              inputMode="numeric"
              maxLength={PRODUCT_LIMITS.shortText}
            />
          </Pair>
        </Section>

        {category === "tires" ? <TireFields values={values} errors={errors} /> : null}
        {category === "wheels" ? <WheelFields values={values} errors={errors} /> : null}
        {category === "accessories" ? <AccessoryFields values={values} errors={errors} /> : null}

        <SourcesFields values={values} errors={errors} vendors={vendors} />
      </div>

      <div className="border-border-strong flex flex-col gap-4 border-t pt-8 sm:pt-10">
        {errorCount > 0 && !formError ? (
          <p role="alert" className="text-ink text-14 leading-body">
            {errorCount === 1 ? "One field needs a fix." : `${errorCount} fields need a fix.`} Nothing was saved.
          </p>
        ) : null}
        {state.status === "saved" && mode === "edit" ? (
          <p ref={savedRef} tabIndex={-1} role="status" className="text-ink text-14 leading-body">
            Saved.
          </p>
        ) : null}
        <div className="w-full sm:max-w-measure">
          <Button type="submit" variant="primary" size="panel" fullWidth disabled={isPending}>
            {mode === "create"
              ? isPending
                ? "Creating…"
                : `Create ${CATEGORY_LABEL[category].toLowerCase()}`
              : isPending
                ? "Saving…"
                : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}
