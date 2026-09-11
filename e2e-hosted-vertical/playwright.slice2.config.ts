import base from "./playwright.config";
import { defineConfig } from "@playwright/test";

/** Isolated Slice 2 Apply/receipt proof. Not part of the calibrated six-journey suite. */
export default defineConfig({
  ...base,
  testMatch: "slice2-apply-proof.spec.ts",
});
