import { Button } from "@/components/ui/button";
import { timesSign } from "@/features/catalog/adapter";
import { CATEGORY_CONFIG } from "@/features/catalog/categories";
import { ProductCard } from "@/features/catalog/components/product-card";
import type { ProductCategory } from "@/features/catalog/types";
import { measuringRatio, FLOTATION_RATIO, wheelWidthRange } from "@/features/search/fit";
import type { ParsedSearch } from "@/features/search/parse";
import type { SearchGroup, SearchOutcome } from "@/features/search/queries";
import { SearchLanding } from "@/features/search/components/search-landing";
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
/* `wrap-anywhere`: the no-matches line quotes the query, and a pasted URL or
   part code has no spaces to break at (QA LAYOUT-1, D141, D151). */
const SUPPORT = "text-ink-muted text-15 leading-body max-w-measure wrap-anywhere";
const COUNT = "text-ink-muted text-14 leading-flat tabular-nums md:text-15";
/* D180: a phone shows 3 cards a group, not 4 (owner, 2026-10-11: "in
   mobile dont display more than 3 options for each search. user should not
   scroll so much"); the fourth is in the page for the 2-up and 4-up grids
   and hidden below 720, where cards stack one a row. */
const CARD_GRID =
  "grid grid-cols-1 gap-3 max-sm:*:nth-[n+4]:hidden sm:grid-cols-2 sm:gap-4 md:grid-cols-4";
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

/** Inches, in half-inch steps inside the range, as a shopper reads them. */
function inches(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/**
 * What the search read the query as, in one plain line, when it found a
 * size. Shoppers type sizes loosely; saying back what was understood is how
 * they can tell `2453519` was read as 245/35R19. It names only the
 * categories actually searched (`scope`): `245/35R19 winter` looks at tires
 * alone, so the line does not promise wheels (QA SEARCH-4).
 */
export function readAs(parsed: ParsedSearch, scope: readonly ProductCategory[]): string | null {
  const { tire, wheel, bolt } = parsed;
  const tires = scope.includes("tires");
  const wheels = scope.includes("wheels");
  let line: string | null = null;
  if (tire !== null) {
    if (tire.format === "metric" && tire.rim === null) {
      line = tires ? `Tires in ${tire.width}/${tire.aspectRatio}, any rim size.` : null;
    } else if (tire.rim !== null) {
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
      const fits = `${tire.rim}-inch wheels from ${inches(min)} to ${inches(max)} inches wide`;
      if (tires && wheels) line = `Tires in ${size}, and ${fits}.`;
      else if (tires) line = `Tires in ${size}.`;
      else if (wheels) line = `${fits[0]?.toUpperCase()}${fits.slice(1)}, to suit ${size}.`;
    }
  } else if (wheel !== null) {
    const pattern = bolt === null ? "" : ` with a ${timesSign(bolt)} bolt pattern`;
    const size = `Wheels in ${timesSign(`${wheel.diameter}x${wheel.width}`)}${pattern}`;
    line = tires ? `${size}, and tires that suit them.` : `${size}.`;
  } else if (bolt !== null) {
    line = `Wheels with a ${timesSign(bolt)} bolt pattern.`;
  } else if (parsed.rim !== null) {
    line =
      tires && wheels
        ? `Tires and wheels for ${parsed.rim}-inch rims.`
        : tires
          ? `Tires for ${parsed.rim}-inch rims.`
          : `Wheels for ${parsed.rim}-inch rims.`;
  }
  /* A season is a tire fact: with tires out of scope it filters nothing. */
  if (parsed.seasons.length > 0 && !tires) {
    const note = "A season only applies to tires, so it is left out.";
    line = line === null ? note : `${line} ${note}`;
  }
  return line;
}

/* --- Group ------------------------------------------------------------- */

function Group({
  group,
  priority,
  alone,
}: {
  group: SearchGroup;
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
      {/* D178: one row, then the category page for the rest, on every
          group. The `Load more` treatment (accent outline, full width on a
          phone, its own row from 1100), the results page's own "more of
          this list" control. With every card already shown it still offers
          the page, quieter, for its filters. */}
      <div className="md:flex md:justify-start">
        <Button
          variant={hidden > 0 ? "accent" : "secondary"}
          size={hidden > 0 ? "load" : "compact"}
          fullWidth
          className="md:w-auto"
          href={seeAll.href}
        >
          {seeAll.label}
        </Button>
      </div>
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
  const interpretation = outcome === null ? null : readAs(parsed, outcome.scope);

  return (
    <div className="flex flex-col gap-14 md:gap-20">
      {/* The count is the page's one live region, present in every state so it
          is never remounted (D72): a new search announces its counts. */}
      <div className={HEAD_STACK}>
        <p
          id="search-summary"
          tabIndex={-1}
          className={COUNT}
          aria-live="polite"
          aria-atomic="true"
        >
          {summary}
        </p>
        <SearchLanding query={query} />
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
          priority={index === 0}
          alone={groups.length === 1}
        />
      ))}
    </div>
  );
}
