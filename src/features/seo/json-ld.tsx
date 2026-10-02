import type { JsonLdNode } from "@/features/seo/schema";

/* ---------------------------------------------------------------------------
   JsonLd — structured data as an inline `<script type="application/ld+json">`

   A Server Component with no client code: the markup is in the HTML the server
   sends, which is what `docs/decisions.md` §4 asks of all SEO content. A native
   `<script>`, not `next/script`: this is data, not code to load or run
   (`node_modules/next/dist/docs/01-app/02-guides/json-ld.md`). It is inline, so
   it is not a third-party script (`docs/decisions.md` §6).

   `<` is written as `<`, the escape the Next guide gives. A product name
   comes from the catalogue, and a name containing `</script>` would otherwise
   close the tag and put whatever follows it into the page.
   --------------------------------------------------------------------------- */

export interface JsonLdProps {
  /** One node, or several: each becomes its own `<script>`. */
  data: JsonLdNode | readonly JsonLdNode[];
}

export function JsonLd({ data }: JsonLdProps) {
  const nodes: readonly JsonLdNode[] = Array.isArray(data) ? data : [data];
  return (
    <>
      {nodes.map((node, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(node).replace(/</g, "\\u003c"),
          }}
        />
      ))}
    </>
  );
}
