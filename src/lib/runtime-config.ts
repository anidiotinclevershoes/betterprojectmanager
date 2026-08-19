/**
 * Explicit production vs development runtime contract for Lume.
 *
 * Production (NODE_ENV=production):
 *   Auth → Supabase (required)
 *   Persistence → Supabase (required)
 *   AI → OpenAI (required for AI features)
 *   Demo seed → disabled
 *   Developer tooling → hidden
 *
 * Development may use demo/local explicitly.
 */
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type LumeRuntimeProfile = "production" | "development";

export function getRuntimeProfile(): LumeRuntimeProfile {
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

export function isProductionRuntime(): boolean {
  return getRuntimeProfile() === "production";
}

export type ProductionConfigIssue = {
  code: string;
  message: string;
  severity: "error" | "warn";
};

/**
 * Structural production configuration check (no network, no secret values).
 */
export function auditProductionConfig(
  env: NodeJS.ProcessEnv = process.env,
): ProductionConfigIssue[] {
  const issues: ProductionConfigIssue[] = [];
  const isProd = env.NODE_ENV === "production";

  const hasUrl = Boolean(env.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const hasAnon = Boolean(
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
  );
  const hasOpenAi = Boolean(env.OPENAI_API_KEY?.trim());
  const authMode = (env.LUME_AUTH || "").trim().toLowerCase();
  const persistence = (env.LUME_PERSISTENCE || "").trim().toLowerCase();
  const allowLocal = env.LUME_ALLOW_LOCAL_IN_PRODUCTION === "true";

  if (!isProd) {
    return issues;
  }

  if (!hasUrl || !hasAnon) {
    issues.push({
      code: "missing_supabase_public",
      message:
        "Production requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      severity: "error",
    });
  }

  if (!hasOpenAi) {
    issues.push({
      code: "missing_openai",
      message: "Production requires OPENAI_API_KEY for Capture/Coach/transcription.",
      severity: "error",
    });
  }

  if (authMode === "demo" || Boolean(env.DEMO_USERS?.trim())) {
    issues.push({
      code: "demo_auth_in_production",
      message:
        "Production must not use demo auth (LUME_AUTH=demo / DEMO_USERS).",
      severity: "error",
    });
  }

  if (persistence === "local" && !allowLocal) {
    issues.push({
      code: "local_persistence_in_production",
      message:
        "Production must not use LUME_PERSISTENCE=local (localStorage user data).",
      severity: "error",
    });
  }

  if (authMode === "none" || authMode === "off") {
    issues.push({
      code: "auth_disabled_in_production",
      message: "Production must not disable auth (LUME_AUTH=none).",
      severity: "error",
    });
  }

  if (!env.NEXT_PUBLIC_SITE_URL?.trim()) {
    issues.push({
      code: "missing_site_url",
      message:
        "NEXT_PUBLIC_SITE_URL should be set in production for auth email redirects.",
      severity: "warn",
    });
  }

  return issues;
}

export function assertProductionConfigOrThrow(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const errors = auditProductionConfig(env).filter((i) => i.severity === "error");
  if (!errors.length) return;
  const detail = errors.map((e) => `- ${e.code}: ${e.message}`).join("\n");
  throw new Error(
    `[lume] Invalid production configuration:\n${detail}\nSee docs/VERCEL_PRODUCTION_SETUP.md`,
  );
}

/** True when Stripe server billing credentials are present. */
export function isStripeConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(
    env.STRIPE_SECRET_KEY?.trim() && env.STRIPE_PRICE_ID?.trim(),
  );
}

export function isStripeWebhookConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(env.STRIPE_WEBHOOK_SECRET?.trim());
}

/** Re-export for convenience without circular imports in callers. */
export { isSupabaseConfigured };
