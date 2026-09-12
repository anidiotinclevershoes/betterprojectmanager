import { defineConfig, devices } from "@playwright/test";
import { LONGRUN_PRODUCTION_ORIGIN } from "./types";

const baseURL = (process.env.LUME_LONGRUN_BASE_URL || LONGRUN_PRODUCTION_ORIGIN).replace(/\/$/, "");
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
  timeout: 18_000_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "../test-results/hosted-longrun/html" }],
    ["./reporter.ts"],
  ],
  outputDir: "../test-results/hosted-longrun/work",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    extraHTTPHeaders,
    navigationTimeout: 30_000,
    actionTimeout: 20_000,
    trace: "off",
    screenshot: "off",
    video: "off",
    ignoreHTTPSErrors: true,
  },
});
