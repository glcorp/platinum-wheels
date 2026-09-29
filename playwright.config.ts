/**
 * End-to-end QA suite (D91b). Owned by `tests/llm.md` — read it before editing.
 *
 * Runs against the PRODUCTION build only (D88): `next dev` streams a hidden
 * duplicate tree that fakes both failures and passes. A server already on
 * :3100 is reused, so stop it after any `src/` change or the suite tests the
 * old build.
 */
import { defineConfig, devices } from "@playwright/test";

/* PW_PORT lets a second production build (e.g. a scratch copy under test)
   run the suite without disturbing the one on :3100. */
const PORT = Number(process.env.PW_PORT ?? 3100);
export const BASE_URL = `http://localhost:${PORT}`;

const desktop = (["chromium", "firefox", "webkit"] as const).flatMap((engine) =>
  ([1280, 1440, 1920] as const).map((width) => ({
    name: `${engine}-${width}`,
    use: {
      browserName: engine,
      viewport: { width, height: width === 1920 ? 1080 : 900 },
    },
  })),
);

export default defineConfig({
  testDir: "./tests/e2e",
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}-{platform}{ext}",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : "50%",
  timeout: 45_000,
  expect: {
    timeout: 7_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: "disabled", caret: "hide" },
  },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    ...desktop,
    // iPhone SE 2nd/3rd gen (Playwright's descriptor is the 320px 1st gen).
    {
      name: "iphone-se",
      use: { ...devices["iPhone SE"], viewport: { width: 375, height: 667 } },
    },
    { name: "iphone-15-pro", use: { ...devices["iPhone 15 Pro"] } },
    { name: "pixel-7", use: { ...devices["Pixel 7"] } },
    { name: "ipad-mini", use: { ...devices["iPad Mini"] } },
    {
      name: "ipad-pro-landscape",
      use: { ...devices["iPad Pro 11 landscape"], viewport: { width: 1366, height: 1024 } },
    },
    // The reflow floor (WCAG 1.4.10): 320 CSS px.
    {
      name: "floor-320",
      use: { ...devices["Pixel 7"], viewport: { width: 320, height: 640 } },
    },
  ],
  webServer: [
    {
      command: `npx next build && QA_ERROR_ROUTE=1 npx next start -p ${PORT}`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
    {
      // The artboard baseline for the parity spec (D36).
      command: "npx --yes serve design -l 4000",
      url: "http://localhost:4000/home-desktop",
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
