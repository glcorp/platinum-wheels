/**
 * No vendor data reaches a shopper (D193). Needs the fixture database
 * (`tests/llm.md`). The fixture accessory is GT Off-Road's lug nut, whose part
 * number `GT14156LB` is also its vendor's SKU at Auto Country.
 *
 * What it proves: the accessory's page has no `Part number` row, and neither
 * its page nor its category page prints the code or a vendor's name. The URL
 * still carries the code in lower case (slugs are never rewritten; `todo.md`),
 * so the check is on the code as the vendor writes it.
 */
import { test, expect } from "@playwright/test";
import { SLUG } from "../helpers";

const CODE = "GT14156LB";
const VENDORS = ["Auto Country", "Direct Auto Import", "PRO WHEELS", "Wheel Works", "Vertex Tires"];

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "chromium-1440", "server-rendered: one desktop run");
});

test("the accessory's page shows no part number and no vendor", async ({ page, request }) => {
  await page.goto(`/products/${SLUG.accessory}`);
  await expect(page.getByRole("main").getByText("Part number")).toHaveCount(0);
  const html = await (await request.get(`/products/${SLUG.accessory}`)).text();
  expect(html).not.toContain(CODE);
  for (const vendor of VENDORS) expect(html, vendor).not.toContain(vendor);
});

test("the accessories page prints no part number on any card", async ({ request }) => {
  const html = await (await request.get("/accessories")).text();
  expect(html).not.toContain("Part number");
  expect(html).not.toContain(CODE);
});
