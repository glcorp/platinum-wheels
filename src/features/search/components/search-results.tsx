import { Button } from "@/components/ui/button";
import { timesSign } from "@/features/catalog/adapter";
import { CATEGORY_CONFIG } from "@/features/catalog/categories";
import { ProductCard } from "@/features/catalog/components/product-card";
import type { ProductCategory } from "@/features/catalog/types";
import { measuringRatio, FLOTATION_RATIO, wheelWidthRange } from "@/features/search/fit";
import type { ParsedSearch } from "@/features/search/parse";
import type { SearchGroup, SearchOutcome } from "@/features/search/queries";
import { ROUTES } from "@/lib/routes";
import { PRIMARY_CONTACT, SITE } from "@/lib/site";

/* ---------------------------------------------------------------------------
   SearchResults — the body of `/search` under its field (D173). Server
   Component; nothing here needs the browser.

   Undrawn: no artboard has a search page, so it is composed from the results
   page's own pieces (`.claude/rules/ui.md` "States the design doesn't
   show"): the `display` heading at 32/40, the muted count line that carries
   the live region (D57/D72), the card grid's gaps, `ProductCard` unchanged,
   and the primitives' buttons. One difference: there is no filter rail
   beside the grid, so from `md:` 1100 it is four cards across in the
   1344px frame, the home featured row's measure (D74), instead of three.
   --------------------------------------------------------------------------- */

const HEADING = "display text-ink text-display-32 md:text-display-40";
const HEAD_STACK = "flex flex-col gap-2.5 md:gap-3";
const SUPPORT = "text-ink-muted text-15 leading-body max-w-measure";
const COUNT = "text-ink-muted text-14 leading-flat tabular-nums md:text-15";
const CARD_GRID = "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-4";
/* 1-up below 720 (the viewport less 16px gutters), 2-up to 1099 (under
   50vw), 4-up in the 1344px frame from 1100 (at most 324px). */
const CARD_SIZES = "(min-width: 1100px) 336px, (min-width: 720px) 50vw, 100vw";

const COUNT_FORMAT = new Intl.NumberFormat("en-CA");

const NOUN: Record<ProductCategory, [string, string]> = {
  tires: ["tire", "tires"],
  wheels: ["wheel", "wheels"],
  accessories: ["accessory", "accessories"],
};

function counted(category: ProductCategory, total: number): string {
  const [one, many] = NOUN[category];
  return `${COUNT_FORMAT.format(total)} ${total === 1 ? one : many}`;
}

export function groupId(category: ProductCategory): string {
  return `search-${category}`;
}

/** `/search?q=…&more=tires#search-tires`: one group raised to `GROUP_MORE`. */
function moreHref(query: string, category: ProductCategory): string {
  const params = new URLSearchParams({ q: query, more: category });
  return `${ROUTES.search}?${params.toString()}#${groupId(category)}`;
}

/** Inches, in half-inch steps inside the range, as a shopper reads them. */
function inches(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/**
 * What the search read the query as, in one plain line, when it found a
 * size. Shoppers type sizes loosely; saying back what was understood is how
 * they can tell `2453519` was read as 245/35R19.
 */
export function readAs(parsed: ParsedSearch): string | null {
  const { tire, wheel, bolt } = parsed;
  if (tire !== null) {
    if (tire.format === "metric" && tire.rim === null) {
      return `Tires in ${tire.width}/${tire.aspectRatio}, any rim size.`;
    }
    const size =
      tire.format === "metric"
        ? `${tire.serviceType ?? ""}${tire.width}/${tire.aspectRatio}R${tire.rim}`
        : `${tire.overallDiameter}x${tire.sectionWidth.toFixed(2)}R${tire.rim}`;
    const measuring =
      tire.format === "metric"
        ? (tire.width * measuringRatio(tire.aspectRatio)) / 25.4
        : tire.sectionWidth * FLOTATION_RATIO;
    const range = wheelWidthRange(measuring);
    const min = Math.ceil(range.min * 2) / 2;
    const max = Math.floor(range.max * 2) / 2;
    return `Tires in ${size}, and ${tire.rim}-inch wheels from ${inches(min)} to ${inches(max)} inches wide.`;
  }
  if (wheel !== null) {
    const pattern = bolt === null ? "" : ` with a ${timesSign(bolt)} bolt pattern`;
    return `Wheels in ${timesSign(`${wheel.diameter}x${wheel.width}`)}${pattern}, and tires that suit them.`;
  }
  if (bolt !== null) return `Wheels with a ${timesSign(bolt)} bolt pattern.`;
  if (parsed.rim !== null) return `Tires and wheels for ${parsed.rim}-inch rims.`;
  return null;
}

/* --- Group ------------------------------------------------------------- */

function Group({
  group,
  query,
  expanded,
  priority,
  alone,
}: {
  group: SearchGroup;
  query: string;
  expanded: boolean;
  priority: boolean;
  /** The only group: the summary above already says its count. */
  alone: boolean;
}) {
  const { category, products, total, seeAll } = group;
  const id = groupId(category);
  const hidden = total - products.length;
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="flex flex-col gap-5 md:gap-8">
      <div className={HEAD_STACK}>
        <h2 id={`${id}-heading`} className={HEADING}>
          {CATEGORY_CONFIG[category].crumb}
        </h2>
        {alone ? null : <p className={COUNT}>{counted(category, total)}</p>}
      </div>
      <div className={CARD_GRID}>
        {products.map((product, index) => (
          <ProductCard
            key={product.slug}
            product={product}
            priority={priority && index === 0}
            sizes={CARD_SIZES}
          />
        ))}
      </div>
      {hidden > 0 || seeAll !== null ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {hidden > 0 && !expanded ? (
            <Button variant="secondary" size="compact" href={moreHref(query, category)} scroll={false}>
              Show more
            </Button>
          ) : null}
          {seeAll !== null ? (
            <Button variant="tertiary" size="compact" href={seeAll.href}>
              {seeAll.label}
            </Button>
          ) : null}
        </div>
      ) : null}
      {hidden > 0 && expanded ? (
        <p className={SUPPORT}>
          {`Showing ${COUNT_FORMAT.format(products.length)} of ${counted(category, total)}. Add a brand or a size to narrow it.`}
        </p>
      ) : null}
    </section>
  );
}

/* --- States ------------------------------------------------------------ */

const EXAMPLES = ["245/35R19", "20x9", "5x114.3", "Michelin"] as const;

/** No query yet: what to type, with four examples that each run a search. */
export function SearchPrompt() {
  return (
    <div className="flex flex-col gap-3">
      <p className={SUPPORT}>Type a tire size, a wheel size, a part number or a brand.</p>
      <p className="text-ink-muted text-15 leading-body flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>Try</span>
        {EXAMPLES.map((example) => (
          <a
            key={example}
            href={`${ROUTES.search}?${new URLSearchParams({ q: example }).toString()}`}
            className="text-ink tap-extend underline underline-offset-4 hover:decoration-accent"
          >
            {example}
          </a>
        ))}
      </p>
    </div>
  );
}

/** Nothing matched. Exported for `/styleguide`, which renders the real one. */
export function SearchEmpty({ query, as = "h2" }: { query: string; as?: "h1" | "h2" }) {
  const Heading = as;
  return (
    <section data-probe="search-empty" className="flex flex-col gap-5">
      <div className={HEAD_STACK}>
        <Heading className={HEADING}>No matches</Heading>
        <p className={SUPPORT}>
          {`Nothing matches “${query}”. Check the spelling or try a tire size such as 245/35R19. We can also look it up for you.`}
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button variant="accent" size="compact" href={`tel:${PRIMARY_CONTACT.tel}`}>
          Call {PRIMARY_CONTACT.display}
        </Button>
        <Button variant="secondary" size="compact" href={`mailto:${SITE.email}`}>
          Email us
        </Button>
      </div>
    </section>
  );
}

/* --- Page body --------------------------------------------------------- */

export function SearchResults({
  query,
  parsed,
  outcome,
}: {
  query: string;
  parsed: ParsedSearch;
  /** `null` when there is nothing to search on (no query). */
  outcome: SearchOutcome | null;
}) {
  const groups = outcome?.groups ?? [];
  const summary =
    outcome === null
      ? ""
      : groups.length === 0
        ? "0 matches"
        : groups.map((group) => counted(group.category, group.total)).join(" · ");
  const interpretation = outcome === null ? null : readAs(parsed);

  return (
    <div className="flex flex-col gap-14 md:gap-20">
      {/* The count is the page's one live region, present in every state so it
          is never remounted (D72): a new search announces its counts. */}
      <div className={HEAD_STACK}>
        <p className={COUNT} aria-live="polite" aria-atomic="true">
          {summary}
        </p>
        {interpretation !== null ? <p className={SUPPORT}>{interpretation}</p> : null}
        {groups.length > 1 ? (
          <nav aria-label="Jump to" className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
            {groups.map((group) => (
              <a
                key={group.category}
                href={`#${groupId(group.category)}`}
                className="label text-13 tracking-10 text-ink tap-extend underline-offset-4 hover:underline"
              >
                {`${CATEGORY_CONFIG[group.category].crumb} ${COUNT_FORMAT.format(group.total)}`}
              </a>
            ))}
          </nav>
        ) : null}
      </div>

      {outcome === null ? <SearchPrompt /> : null}
      {outcome !== null && groups.length === 0 ? <SearchEmpty query={query} /> : null}
      {groups.map((group, index) => (
        <Group
          key={group.category}
          group={group}
          query={query}
          expanded={outcome?.expanded === group.category}
          priority={index === 0}
          alone={groups.length === 1}
        />
      ))}
    </div>
  );
}
