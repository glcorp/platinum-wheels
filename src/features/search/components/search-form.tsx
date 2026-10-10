import Form from "next/form";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field-label";
import { Input } from "@/components/ui/input";
import { QUERY_MAX_LENGTH } from "@/features/search/parse";
import { ROUTES } from "@/lib/routes";

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
   --------------------------------------------------------------------------- */

export function SearchForm({ query, autoFocus = false }: { query: string; autoFocus?: boolean }) {
  return (
    <Form action={ROUTES.search} role="search">
      <FieldLabel htmlFor="search-page-q">Tire size, wheel size, part number or brand</FieldLabel>
      <div className="flex gap-2">
        <Input
          id="search-page-q"
          name="q"
          type="search"
          defaultValue={query}
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
    </Form>
  );
}
