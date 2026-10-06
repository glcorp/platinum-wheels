/**
 * The admin, end to end: the gate, sign-in, and one product edit that must
 * persist (D95, D115, D116, D127b). Needs the fixture database and the
 * credentials `tests/fixture/run.mjs` passes in `FIXTURE_ADMIN_USERNAME` /
 * `FIXTURE_ADMIN_PASSWORD` (made up per run; never a real account).
 *
 * Reaching the admin locally: it lives on its own host and its URLs carry no
 * `/admin` (D115). Outside production the host is `admin.localhost`, which
 * Chromium resolves to this machine. The sign-in cookie is `__Host-` and
 * `Secure`; Chromium accepts it on `*.localhost`. Chromium only: the other
 * engines do not resolve `admin.localhost`, and the gate has nothing
 * engine-specific.
 *
 * One project, one product edited, so two workers never save the same row.
 */
import { test, expect, type Page } from "@playwright/test";
import { SLUG, settle } from "../helpers";

const PORT = process.env.PW_PORT ?? "3100";
const ADMIN = `http://admin.localhost:${PORT}`;
// Node's resolver (macOS getaddrinfo) cannot look up `*.localhost`, so the two
// `request` tests below go to 127.0.0.1 and name the admin host in `Host`, the
// one header the proxy reads. Browser pages still use `ADMIN` directly.
const ADMIN_REQUEST = {
  base: `http://127.0.0.1:${PORT}`,
  headers: { host: `admin.localhost:${PORT}` },
};
const USER = process.env.FIXTURE_ADMIN_USERNAME;
const PASSWORD = process.env.FIXTURE_ADMIN_PASSWORD;

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "chromium-1440", "one project; admin.localhost resolves in Chromium only");
  test.skip(!USER || !PASSWORD, "needs the fixture's admin credentials: run `npm run test:e2e:fixture`");
});

async function signIn(page: Page) {
  await page.goto(`${ADMIN}/login`);
  await settle(page);
  await page.getByLabel(/Username/).fill(USER!);
  await page.getByLabel(/Password/).fill(PASSWORD!);
  await page.getByRole("button", { name: /^Sign in/ }).click();
  await expect(page).toHaveURL(`${ADMIN}/`);
  // Known local-build defect (D124, `src/app/admin/llm.md` Open #6): the
  // sign-in's client-side redirect to `/` renders the STOREFRONT home on the
  // admin host until a real navigation. Load the page for real, then assert it
  // is the admin's.
  await page.goto(`${ADMIN}/`);
  await settle(page);
  await expect(page.getByRole("navigation", { name: "Admin sections" })).toBeVisible();
}

/* ---------- the gate ---------- */

test("every gated page sends a visitor without a session to the sign-in", async ({ request }) => {
  for (const path of ["/", "/products", "/products/new", "/payment-links"]) {
    const res = await request.get(`${ADMIN_REQUEST.base}${path}`, {
      maxRedirects: 0,
      headers: ADMIN_REQUEST.headers,
    });
    expect(res.status(), path).toBe(307);
    expect(new URL(res.headers()["location"] ?? "", ADMIN).pathname, path).toBe("/login");
  }
  // The sign-in itself is public, noindex and never framed.
  const login = await request.get(`${ADMIN_REQUEST.base}/login`, {
    maxRedirects: 0,
    headers: ADMIN_REQUEST.headers,
  });
  expect(login.status()).toBe(200);
  expect(login.headers()["x-robots-tag"]).toContain("noindex");
  expect(login.headers()["x-frame-options"]).toBe("DENY");
});

test("`/admin` is a 404 on the admin host and on the storefront (D115)", async ({ request }) => {
  for (const path of ["/admin", "/admin/login"]) {
    const res = await request.get(`${ADMIN_REQUEST.base}${path}`, {
      maxRedirects: 0,
      headers: ADMIN_REQUEST.headers,
    });
    expect(res.status(), path).toBe(404);
  }
  expect((await request.get("/admin", { maxRedirects: 0 })).status()).toBe(404);
  expect((await request.get("/admin/login", { maxRedirects: 0 })).status()).toBe(404);
  // And the admin's pages are not served on the storefront host at all.
  expect((await request.get("/login", { maxRedirects: 0 })).status()).toBe(404);
});

test("a wrong password is refused, says so, and keeps the username", async ({ page }) => {
  await page.goto(`${ADMIN}/login`);
  await settle(page);
  await page.getByLabel(/Username/).fill(USER!);
  await page.getByLabel(/Password/).fill("not-the-password");
  await page.getByRole("button", { name: /^Sign in/ }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Wrong username or password. Check both and try again.",
  );
  await expect(page.getByLabel(/Username/)).toHaveValue(USER!);
  await expect(page.getByLabel(/Password/)).toHaveValue("");
  await expect(page).toHaveURL(`${ADMIN}/login`);
});

/* ---------- sign in, edit, save, persist ---------- */

test("sign in, change a product's description and display price, save, and it persists", async ({ page, browser }) => {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(e.message));

  await signIn(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // To the list by the top bar, search for the product, open it by its name.
  // The link works once the page has hydrated; under load a first click can land
  // mid-hydration and not navigate (seen once in a 130-test parallel run, never
  // in 8 serial ones), so press again until the URL moves, as a person would.
  const products = page.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name: "Products" });
  await expect(async () => {
    if (page.url() !== `${ADMIN}/products`) await products.click({ timeout: 2_000 });
    await expect(page).toHaveURL(`${ADMIN}/products`, { timeout: 2_500 });
  }).toPass({ timeout: 20_000 });
  await settle(page);
  const search = page.getByRole("search").getByLabel("Search");
  await search.fill(SLUG.wheel);
  await search.press("Enter");
  await expect(page).toHaveURL(/\?.*q=/);
  const row = page.getByRole("list").getByRole("listitem").filter({ hasText: /sledge/i });
  await expect(row).toHaveCount(1);
  await row.getByRole("link", { name: /sledge/i }).click();
  await expect(page).toHaveURL(new RegExp(`${ADMIN}/products/[0-9a-f-]{36}$`));
  await settle(page);
  const editUrl = page.url();

  const description = page.getByLabel("Description");
  const price = page.getByLabel("Display price");
  const stamp = `Edited by the e2e suite ${Date.now()}.`;
  await description.fill(stamp);
  await price.fill("199.99");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

  // Persisted: a fresh load of the page, in a fresh context signed in again,
  // reads what was saved and not what the form still held.
  const other = await browser.newContext();
  const fresh = await other.newPage();
  await signIn(fresh);
  await fresh.goto(editUrl);
  await settle(fresh);
  await expect(fresh.getByLabel("Description")).toHaveValue(stamp);
  await expect(fresh.getByLabel("Display price")).toHaveValue("199.99");
  await other.close();

  // And the storefront shows the description under the spec table (D136).
  await page.goto(`/products/${SLUG.wheel}`);
  await settle(page);
  await expect(page.getByRole("main").getByText(stamp)).toBeVisible();
  expect(problems, "uncaught page errors").toEqual([]);
});

test("a refused save changes nothing and says what to fix", async ({ page }) => {
  await signIn(page);
  await page.goto(`${ADMIN}/products?q=${encodeURIComponent(SLUG.tire)}`);
  await settle(page);
  await page.getByRole("link", { name: /antarctica sport/i }).first().click();
  await settle(page);
  const price = page.getByLabel("Display price");
  await price.fill("not a price");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /fix\. Nothing was saved\./ })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toHaveCount(0);
});
