import * as fs from "node:fs";
import * as path from "node:path";
import { LONGRUN_PRODUCTION_ORIGIN, LONGRUN_SEED, LONGRUN_SUITE_ID } from "./types";

export default async function globalSetup(): Promise<void> {
  const dir = path.join(process.cwd(), "test-results", "hosted-longrun");
  fs.mkdirSync(dir, { recursive: true });
  const present = {
    suite: LONGRUN_SUITE_ID,
    seed: LONGRUN_SEED,
    productionDefault: LONGRUN_PRODUCTION_ORIGIN,
    LUME_LONGRUN_BASE_URL: Boolean(process.env.LUME_LONGRUN_BASE_URL?.trim()),
    LUME_E2E_EMAIL: Boolean(process.env.LUME_E2E_EMAIL?.trim()),
    LUME_E2E_PASSWORD: Boolean(process.env.LUME_E2E_PASSWORD),
    LUME_E2E_VERCEL_BYPASS_SECRET: Boolean(
      process.env.LUME_E2E_VERCEL_BYPASS_SECRET?.trim() ||
        process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim(),
    ),
    LUME_E2E_RUN_ID: process.env.LUME_E2E_RUN_ID || null,
    effectiveBaseUrlHost: new URL(process.env.LUME_LONGRUN_BASE_URL || LONGRUN_PRODUCTION_ORIGIN).host,
  };
  fs.writeFileSync(path.join(dir, "env-presence.json"), JSON.stringify(present, null, 2));
}
