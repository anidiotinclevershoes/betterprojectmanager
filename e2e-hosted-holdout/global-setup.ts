import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Records whether required env is present. Never writes secret values.
 */
export default async function globalSetup(): Promise<void> {
  const dir = path.join(process.cwd(), "test-results", "hosted-holdout");
  fs.mkdirSync(dir, { recursive: true });
  const present = {
    suite: "hosted-holdout-v1",
    LUME_E2E_BASE_URL: Boolean(process.env.LUME_E2E_BASE_URL?.trim()),
    LUME_E2E_EMAIL: Boolean(process.env.LUME_E2E_EMAIL?.trim()),
    LUME_E2E_PASSWORD: Boolean(process.env.LUME_E2E_PASSWORD),
    LUME_E2E_VERCEL_BYPASS_SECRET: Boolean(
      process.env.LUME_E2E_VERCEL_BYPASS_SECRET?.trim() ||
        process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim(),
    ),
    LUME_E2E_RUN_ID: process.env.LUME_E2E_RUN_ID || null,
  };
  fs.writeFileSync(path.join(dir, "env-presence.json"), JSON.stringify(present, null, 2));
}
