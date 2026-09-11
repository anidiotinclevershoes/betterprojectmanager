import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.LUME_E2E_BASE_URL?.replace(/\/$/, "") ?? "";
const bypass =
  process.env.LUME_E2E_VERCEL_BYPASS_SECRET ||
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET ||
  "";

const extraHTTPHeaders: Record<string, string> = {};
if (bypass) {
  extraHTTPHeaders["x-vercel-protection-bypass"] = bypass;
  extraHTTPHeaders["x-vercel-set-bypass-cookie"] = "true";
}

export default defineConfig({
  globalSetup: "./global-setup.ts",
  testDir: ".",
  testMatch: "journeys.spec.ts",
  timeout: 240_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "../test-results/hosted-vertical/html" }],
    ["./reporter.ts"],
  ],
  outputDir: "../test-results/hosted-vertical/work",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: baseURL || "http://127.0.0.1:9",
    extraHTTPHeaders,
    navigationTimeout: 20_000,
    actionTimeout: 15_000,
    trace: "off",
    screenshot: "off",
    video: "off",
    ignoreHTTPSErrors: true,
  },
});
