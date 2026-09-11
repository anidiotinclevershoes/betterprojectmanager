import base from "./playwright.config";
import { defineConfig } from "@playwright/test";

/** Opt-in Capture defect traces. Not part of the calibrated journey suite. */
export default defineConfig({
  ...base,
  testMatch: "capture-trace.spec.ts",
});
