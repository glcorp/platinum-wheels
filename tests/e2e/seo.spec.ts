/**
 * Search-facing contract (D112, `src/features/seo/llm.md`).
 *
 * Network only: every test uses the `request` fixture, so the spec needs no
 * browser and answers from one project (`chromium-1440`); the other projects
 * skip it. It reads the served HTML, which is what a crawler reads.
 *
 * The indexing flag is fixed when the site is built, so one run sees one state.
 * The spec reads the same env var the server was built with and asserts that
 * state:
 *
 *   npx playwright test seo --project=chromium-1440                          (flag off)
 *   SEARCH_INDEXING_ENABLED=true npx playwright test seo --project=chromium-1440   (flag on)
 *
 * With `PW_PORT` pointing at a private build, export the flag the build used.
 * Stop any server already on the port first: the suite reuses one, and a
 * server built with the other flag state fails every test here by design.
 *
 * Product tests need a product: they read `SLUG.tire` from the fixture
 * database (`tests/fixture/`, run by `npm run test:e2e:fixture`). A 404 there
 * is a failure, not a skip.
 */
import { test, expect, type APIRequestContext } from "@playwright/test";
import { SLUG } from "../helpers";

const INDEXING = process.env.SEARCH_INDEXING_ENABLED === "true";
const SITE_URL = "https://platinumwheels.ca";
const CANONICAL_HOST = "platinumwheels.ca";
/** Hosts that reach the same build and must never list the storefront. */
const OTHER_HOSTS = [
  "admin.platinumwheels.ca",
  "pay.platinumwheels.ca",
  "www.platinumwheels.ca",
  "platinum-wheels-one.vercel.app",
];

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "chromium-1440", "network-only; one project is enough");
});

const get = (request: APIRequestContext, path: string, host = CANONICAL_HOST) =>
  request.get(path, { headers: { Host: host }, maxRedirects: 0 });

/** `<meta name|property="key" content="…">`, anywhere in the document: Next
 *  streams a dynamic page's metadata into `<body>` for a non-bot user agent. */
function meta(html: string, key: string): string[] {
  const tags = html.match(/<meta\s[^>]*>/g) ?? [];
  return tags
    .filter((tag) => new RegExp(`(?:name|property)="${key}"`).test(tag))
    .map((tag) => /content="([^"]*)"/.exec(tag)?.[1] ?? "");
}

function canonical(html: string): string[] {
  const tags = html.match(/<link\s[^>]*>/g) ?? [];
  return tags
    .filter((tag) => /rel="canonical"/.test(tag))
    .map((tag) => /href="([^"]*)"/.exec(tag)?.[1] ?? "");
}

function title(html: string): string {
  return /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "";
}

type Node = Record<string, unknown>;

function jsonLd(html: string): Node[] {
  const blocks = html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) ?? [];
  return blocks.map((block) => JSON.parse(block.replace(/^<script[^>]*>|<\/script>$/g, "")) as Node);
}

/** Every key at any depth, so a forbidden field cannot hide in a nested node. */
function keysDeep(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((item) => keysDeep(item, into));
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      into.add(key);
      keysDeep(child, into);
    }
  }
  return into;
}

/* ---------- robots.txt and the sitemaps ---------- */

test("robots.txt answers on the canonical host and matches the flag", async ({ request }) => {
  const res = await get(request, "/robots.txt");
  expect(res.status()).toBe(200);
  const body = await res.text();
  if (INDEXING) {
    expect(body).toMatch(/^Allow: \/$/m);
    // Open, except the filter URLs of the three category pages: a query string
    // there is a search, and the clean path is the only address (D112).
    const disallowed = [...body.matchAll(/^Disallow: (.*)$/gm)].map((m) => m[1]);
    expect(disallowed).toEqual(["/tires?", "/wheels?", "/accessories?"]);
    expect(body).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
  } else {
    expect(body).toMatch(/^Disallow: \/$/m);
    expect(body).not.toMatch(/^Allow:/m);
    expect(body).not.toContain("Sitemap:");
  }
});

for (const host of OTHER_HOSTS) {
  test(`${host}: robots.txt disallows everything and no sitemap is served`, async ({ request }) => {
    const robots = await get(request, "/robots.txt", host);
    // In production the proxy never sees a path with a dot, so this handler
    // answers on every host. Outside production there are no host rules at all.
    expect(robots.status()).toBe(200);
    const body = await robots.text();
    expect(body).toMatch(/^Disallow: \/$/m);
    expect(body).not.toContain("Sitemap:");

    for (const path of ["/sitemap.xml", "/sitemaps/pages.xml", "/sitemaps/tires.xml"]) {
      expect((await get(request, path, host)).status(), `${host}${path}`).toBe(404);
    }
  });
}

const SITEMAP_FILES = ["pages", "tires", "wheels", "accessories"];

test("the sitemap index and its files match the flag", async ({ request }) => {
  const index = await get(request, "/sitemap.xml");
  if (!INDEXING) {
    expect(index.status()).toBe(404);
    expect(index.headers()["x-robots-tag"]).toContain("noindex");
    for (const file of SITEMAP_FILES) {
      expect((await get(request, `/sitemaps/${file}.xml`)).status()).toBe(404);
    }
    return;
  }

  expect(index.status()).toBe(200);
  expect(index.headers()["content-type"]).toContain("application/xml");
  const listed = [...(await index.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(listed).toEqual(SITEMAP_FILES.map((file) => `${SITE_URL}/sitemaps/${file}.xml`));

  const pages = await get(request, "/sitemaps/pages.xml");
  expect(pages.status()).toBe(200);
  const pageUrls = [...(await pages.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(pageUrls).toEqual([
    SITE_URL,
    `${SITE_URL}/tires`,
    `${SITE_URL}/wheels`,
    `${SITE_URL}/accessories`,
    `${SITE_URL}/about`,
    `${SITE_URL}/privacy`,
    `${SITE_URL}/terms`,
  ]);

  for (const file of ["tires", "wheels", "accessories"]) {
    const res = await get(request, `/sitemaps/${file}.xml`);
    expect(res.status(), file).toBe(200);
    const urls = [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    for (const url of urls) {
      // Products only, on the canonical origin, and never a query string.
      expect(url).toMatch(/^https:\/\/platinumwheels\.ca\/products\/[a-z0-9-]+$/);
    }
  }

  expect((await get(request, "/sitemaps/styleguide.xml")).status()).toBe(404);
});

/* ---------- Every indexable page ---------- */

const INDEXABLE = [
  { path: "/", canonical: SITE_URL },
  { path: "/tires", canonical: `${SITE_URL}/tires` },
  { path: "/wheels", canonical: `${SITE_URL}/wheels` },
  { path: "/accessories", canonical: `${SITE_URL}/accessories` },
  { path: "/about", canonical: `${SITE_URL}/about` },
  { path: "/privacy", canonical: `${SITE_URL}/privacy` },
  { path: "/terms", canonical: `${SITE_URL}/terms` },
];

for (const page of INDEXABLE) {
  test(`${page.path}: robots meta, canonical and preview tags`, async ({ request }) => {
    const res = await get(request, page.path);
    expect(res.status()).toBe(200);
    const html = await res.text();

    expect(meta(html, "robots")).toEqual([INDEXING ? "index, follow, max-image-preview:large" : "noindex, nofollow"]);
    expect(canonical(html)).toEqual([page.canonical]);
    expect(meta(html, "og:url")).toEqual([page.canonical]);
    expect(meta(html, "og:site_name")).toEqual(["Platinum Wheels"]);
    expect(meta(html, "og:image")).toEqual([`${SITE_URL}/opengraph-image`]);
    expect(meta(html, "twitter:card")).toEqual(["summary_large_image"]);
    expect(meta(html, "description")[0]?.length ?? 0).toBeGreaterThan(40);
    expect(title(html).length).toBeGreaterThan(10);
  });
}

test("every indexable page has its own title and description", async ({ request }) => {
  const seen = { titles: new Map<string, string>(), descriptions: new Map<string, string>() };
  for (const { path } of INDEXABLE) {
    const html = await (await get(request, path)).text();
    const t = title(html);
    const d = meta(html, "description")[0] ?? "";
    expect(seen.titles.get(t), `title shared by ${path} and ${seen.titles.get(t)}`).toBeUndefined();
    expect(seen.descriptions.get(d), `description shared by ${path} and ${seen.descriptions.get(d)}`).toBeUndefined();
    seen.titles.set(t, path);
    seen.descriptions.set(d, path);
  }
});

for (const path of ["/tires?season=winter&brand=Zeta", "/wheels?diameter=18&sort=price-asc", "/accessories?type=lug-nuts"]) {
  test(`${path}: a filter URL points its canonical at the clean path`, async ({ request }) => {
    const res = await get(request, path);
    expect(res.status()).toBe(200);
    expect(canonical(await res.text())).toEqual([`${SITE_URL}${path.split("?")[0]}`]);
  });
}

/* ---------- The tags are in <head> for a crawler ---------- */

/* Next streams a dynamic page's metadata into `<body>` when it resolves after
   the first flush, for every user agent outside its "HTML-limited" list, and
   that list does not name Googlebot or any AI crawler (`next/dist/shared/lib/
   router/utils/html-bots.js`). Practitioners report Googlebot then missing the
   canonical. It does not happen here, because the category and product pages
   wait on the database with no Suspense boundary above them, so the head is
   complete before anything is sent. A `loading.tsx` or a `<Suspense>` around
   either page would break that silently; this test is the alarm. */
const CRAWLERS = {
  Googlebot:
    "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "OAI-SearchBot": "OAI-SearchBot/1.0; +https://openai.com/searchbot",
  ClaudeBot: "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
  PerplexityBot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
};

for (const [crawler, userAgent] of Object.entries(CRAWLERS)) {
  test(`${crawler} gets the title, canonical and robots meta inside <head>`, async ({ request }) => {
    for (const path of ["/tires?brand=Zeta", "/wheels", "/accessories", `/products/${SLUG.tire}`]) {
      const res = await request.get(path, {
        headers: { Host: CANONICAL_HOST, "User-Agent": userAgent },
        maxRedirects: 0,
      });
      expect(res.status(), `${path} answers`).toBe(200);
      const html = await res.text();
      const headEnd = html.indexOf("</head>");
      for (const tag of ["<title>", 'rel="canonical"', 'name="robots"', 'property="og:image"']) {
        const at = html.indexOf(tag);
        expect(at, `${tag} is present on ${path}`).toBeGreaterThan(-1);
        expect(at, `${tag} is inside <head> on ${path}`).toBeLessThan(headEnd);
      }
    }
  });
}

/* ---------- Pages that are never indexed, in either flag state ---------- */

test("/styleguide is noindex whatever the flag says, and has no canonical", async ({ request }) => {
  const html = await (await get(request, "/styleguide")).text();
  expect(meta(html, "robots")).toEqual(["noindex, nofollow"]);
  expect(canonical(html)).toEqual([]);
});

test("the admin sign-in is noindex in the page and in the response header", async ({ request }) => {
  // The admin answers only on its host, with no `/admin` prefix (D115);
  // outside production that host is `admin.localhost`.
  const res = await get(request, "/login", "admin.localhost");
  expect(res.status()).toBe(200);
  expect(res.headers()["x-robots-tag"]).toContain("noindex");
  expect(meta(await res.text(), "robots").join(" ")).toContain("noindex");
});

test("/pay/done is noindex in the page and in the response header", async ({ request }) => {
  const res = await get(request, "/pay/done");
  expect(res.headers()["x-robots-tag"]).toContain("noindex");
  expect(meta(await res.text(), "robots").join(" ")).toContain("noindex");
});

test("a 404 is noindex and carries no canonical", async ({ request }) => {
  const res = await get(request, "/this-route-does-not-exist");
  expect(res.status()).toBe(404);
  const html = await res.text();
  expect(meta(html, "robots").join(" ")).toContain("noindex");
  expect(canonical(html)).toEqual([]);
});

/* ---------- Structured data ---------- */

/** Never published, by owner ruling (D112): no street address and no opening
 *  hours (there is no shop), no price or offer, and no invented social proof.
 *  The organisation's `address` is city, province and country only. */
const FORBIDDEN_KEYS = [
  "streetAddress",
  "postalCode",
  "postOfficeBoxNumber",
  "geo",
  "hasMap",
  "openingHours",
  "openingHoursSpecification",
  "offers",
  "price",
  "priceCurrency",
  "lowPrice",
  "highPrice",
  "availability",
  "aggregateRating",
  "review",
];

test("the home page describes an online store: no street address, no opening hours", async ({ request }) => {
  const nodes = jsonLd(await (await get(request, "/")).text());
  const org = nodes.find((node) => node["@type"] === "OnlineStore");
  expect(org, "an OnlineStore node").toBeDefined();
  expect(org).toMatchObject({
    name: "Platinum Wheels",
    // Owner ruling 2026-10-05: the legal name carries "Inc." everywhere.
    legalName: "Platinum Wheels and Tire Solutions Inc.",
    url: SITE_URL,
    email: "sales@platinumwheels.ca",
    telephone: "+14378825000",
    // D190 (client, 2026-10-21): "across Canada" (was the GTA, D163).
    areaServed: { "@type": "Country", name: "Canada" },
  });
  // Where the business is based, and nothing a customer could travel to.
  expect(org!.address).toEqual({
    "@type": "PostalAddress",
    addressLocality: "Brampton",
    addressRegion: "ON",
    addressCountry: "CA",
  });

  const keys = keysDeep(nodes);
  for (const key of FORBIDDEN_KEYS) expect(keys.has(key), `forbidden key "${key}"`).toBe(false);

  // The phone hours appear only as contact hours, on the contact points.
  // D161: one number, no names.
  const points = org!.contactPoint as Node[];
  expect(points).toHaveLength(1);
  expect(points[0]).toMatchObject({ telephone: "+14378825000" });
  expect(JSON.stringify(nodes)).not.toMatch(/Inderpal|Harman|3659980990/);
  for (const point of points) {
    expect(point.hoursAvailable).toMatchObject({ opens: "09:00", closes: "20:00" });
  }

  expect(nodes.some((node) => node["@type"] === "WebSite")).toBe(true);
  for (const type of ["LocalBusiness", "Store", "AutoPartsStore", "TireShop"]) {
    expect(nodes.some((node) => node["@type"] === type), type).toBe(false);
  }
});

for (const [path, name] of [["/tires", "Tires"], ["/wheels", "Wheels"], ["/accessories", "Accessories"]] as const) {
  test(`${path}: a breadcrumb of Home and ${name}`, async ({ request }) => {
    const nodes = jsonLd(await (await get(request, path)).text());
    const crumbs = nodes.find((node) => node["@type"] === "BreadcrumbList");
    expect(crumbs?.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name, item: `${SITE_URL}${path}` },
    ]);
  });
}

test("a product page: own title, clean canonical, Product with no price or offer", async ({ request }) => {
  const path = `/products/${SLUG.tire}`;
  const res = await get(request, `${path}?qty=2`);
  expect(res.status()).toBe(200);
  const html = await res.text();

  expect(canonical(html)).toEqual([`${SITE_URL}${path}`]);
  expect(meta(html, "robots")).toEqual([INDEXING ? "index, follow, max-image-preview:large" : "noindex, nofollow"]);

  const nodes = jsonLd(html);
  const product = nodes.find((node) => node["@type"] === "Product");
  expect(product, "a Product node").toBeDefined();
  expect(product).toMatchObject({
    brand: { "@type": "Brand" },
    category: "Tires",
    url: `${SITE_URL}${path}`,
  });
  expect(typeof product!.name).toBe("string");
  expect(title(html)).toContain(product!.name as string);

  const keys = keysDeep(nodes);
  for (const key of FORBIDDEN_KEYS) expect(keys.has(key), `forbidden key "${key}"`).toBe(false);

  const crumbs = nodes.find((node) => node["@type"] === "BreadcrumbList");
  expect((crumbs?.itemListElement as Node[]).map((item) => item.position)).toEqual([1, 2, 3]);
});

/* ---------- Link previews ---------- */

test("the site card is a 1200x630 PNG", async ({ request }) => {
  const res = await get(request, "/opengraph-image");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/png");
  const png = await res.body();
  // The PNG header's IHDR chunk: width and height as big-endian 32-bit ints.
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);
});

test("an unknown product has no preview image", async ({ request }) => {
  expect((await get(request, "/products/not-a-slug/og.jpg")).status()).toBe(404);
});
