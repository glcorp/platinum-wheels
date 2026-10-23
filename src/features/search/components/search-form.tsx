"use client";

import Form from "next/form";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field-label";
import { Input } from "@/components/ui/input";
import { QUERY_MAX_LENGTH } from "@/features/search/parse";
import { ROUTES, type VehicleParams } from "@/lib/routes";

/* ---------------------------------------------------------------------------
   SearchForm — the `/search` page's own field (D173). `next/form` with a
   string action: a plain GET `<form>` that works with JS off, and a
   client-side navigation with it on (the admin's list filters use it the
   same way). The header's field (`src/components/site/site-search.tsx`) is a
   second copy of the same three elements, because `src/components/*` may not
   import a feature (D37); both post `q` to `/search`.

   Field: the system `Input` box (52px, 56px from `sm:`) and the primary
   `Button` at `promo` size, which has the same two heights, so the pair
   lines up as the hero finder's fields and CTA do. The label is
   the system `FieldLabel`, visible: a placeholder is not a label.

   D184 (QA SEARCH-2): the field follows the URL's `q`. It was uncontrolled
   (`defaultValue`), and this form instance survives a client navigation
   within `/search`, so Back/Forward and a search made from the header left
   the old text in it. Now it is controlled and resynced during render when
   the `query` prop changes, the D84 pattern (an effect would trip the
   project's `react-hooks/set-state-in-effect` rule and paint the stale text
   for a frame; a `key` would remount it and drop focus). With JS off the
   server-rendered `value` is the same text.

   `data-nav-progress` opts the form into the loader (QA SEARCH-3), and the
   searched car (D158) rides along as hidden fields (D185).
   --------------------------------------------------------------------------- */

export function SearchForm({
  query,
  autoFocus = false,
  vehicle = null,
}: {
  query: string;
  autoFocus?: boolean;
  /** The searched car, already checked by the page (`searchVehicle`). */
  vehicle?: VehicleParams | null;
}) {
  const [value, setValue] = useState(query);
  const [seen, setSeen] = useState(query);
  if (seen !== query) {
    setSeen(query);
    setValue(query);
  }

  return (
    <Form
      action={ROUTES.search}
      role="search"
      aria-label="Search the catalogue"
      data-nav-progress=""
    >
      <FieldLabel htmlFor="search-page-q">Tire size, wheel size, SKU or brand</FieldLabel>
      <div className="flex gap-2">
        <Input
          id="search-page-q"
          name="q"
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={QUERY_MAX_LENGTH}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
          placeholder="245/35R19"
          autoFocus={autoFocus}
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="primary" size="promo" className="shrink-0">
          Search
        </Button>
      </div>
      {vehicle === null ? null : (
        <>
          <input type="hidden" name="year" value={vehicle.year} />
          <input type="hidden" name="make" value={vehicle.make} />
          <input type="hidden" name="model" value={vehicle.model} />
        </>
      )}
    </Form>
  );
}
