/**
 * Structural production-config validation (no secrets printed, no network).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { auditProductionConfig } from "../src/lib/runtime-config";
import { getAuthMode } from "../src/lib/auth-mode";
import { getPersistenceMode } from "../src/lib/persistence-mode";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
} from "../src/lib/supabase/env";
import { evaluateEntitlement, mapStripeSubscriptionStatus } from "../src/lib/billing/entitlements";
import { mapStripeSubscriptionToLume } from "../src/lib/billing/stripe-map";
import { checkRateLimit, resetRateLimitStoreForTests } from "../src/lib/rate-limit";

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

const root = path.resolve(__dirname, "..");

check("production rejects demo auth + local persistence", () => {
  const issues = auditProductionConfig({
    NODE_ENV: "production",
    LUME_AUTH: "demo",
    DEMO_USERS: "a@b.com:x",
    LUME_PERSISTENCE: "local",
    NEXT_PUBLIC_SUPABASE_URL: "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    OPENAI_API_KEY: "",
  } as NodeJS.ProcessEnv);
  const codes = issues.map((i) => i.code);
  assert.ok(codes.includes("demo_auth_in_production"));
  assert.ok(codes.includes("local_persistence_in_production"));
  assert.ok(codes.includes("missing_supabase_public"));
  assert.ok(codes.includes("missing_openai"));
});

check("production with proper public config is clean of fatal issues when keys present", () => {
  const issues = auditProductionConfig({
    NODE_ENV: "production",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    OPENAI_API_KEY: "sk-test",
    NEXT_PUBLIC_SITE_URL: "https://app.example.com",
  } as NodeJS.ProcessEnv);
  assert.equal(issues.filter((i) => i.severity === "error").length, 0);
});

check("production auth mode never returns demo", () => {
  const mode = getAuthMode({
    NODE_ENV: "production",
    LUME_AUTH: "demo",
    DEMO_USERS: "a@b.com:x",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  } as NodeJS.ProcessEnv);
  assert.equal(mode, "supabase");
});

check("production persistence is supabase", () => {
  const mode = getPersistenceMode({
    NODE_ENV: "production",
    LUME_PERSISTENCE: "local",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  } as NodeJS.ProcessEnv);
  assert.equal(mode, "supabase");
});

check("developer tools gated by NODE_ENV in Sidebar", () => {
  const sidebar = fs.readFileSync(
    path.join(root, "src/components/app-shell/Sidebar.tsx"),
    "utf8",
  );
  assert.match(sidebar, /NODE_ENV === \"development\"/);
  assert.match(sidebar, /Golden Test/);
  assert.match(sidebar, /AI Cockpit/);
});

check("dev pages call notFound outside development", () => {
  for (const rel of [
    "src/app/dev/golden-test/page.tsx",
    "src/app/dev/ai-cockpit/page.tsx",
    "src/app/dev/review-preview/page.tsx",
    "src/app/dev/reliability-preview/page.tsx",
    "src/app/dev/reset-preview/page.tsx",
  ]) {
    const src = fs.readFileSync(path.join(root, rel), "utf8");
    assert.match(src, /notFound/);
  }
});

check("auth callback + reset routes exist", () => {
  assert.equal(fs.existsSync(path.join(root, "src/app/auth/callback/route.ts")), true);
  assert.equal(fs.existsSync(path.join(root, "src/app/reset-password/page.tsx")), true);
  assert.equal(fs.existsSync(path.join(root, "src/app/forgot-password/page.tsx")), true);
});

check("empty production users get zero demo projects (loader + store)", () => {
  const loader = fs.readFileSync(
    path.join(root, "src/lib/data/supabase/load-mission-state.ts"),
    "utf8",
  );
  assert.match(loader, /emptyMissionState/);
  assert.match(loader, /Never seeds ATLAS/);
  const store = fs.readFileSync(path.join(root, "src/lib/store.tsx"), "utf8");
  assert.match(store, /NODE_ENV === \"production\"/);
  assert.match(store, /emptyMissionState/);
  const idx = store.indexOf("function readStoredState");
  const slice = store.slice(idx, idx + 500);
  assert.match(slice, /emptyMissionState/);
});

check("trialing/active allowed; expired denied; cancel-at-period-end allowed", () => {
  const now = new Date("2026-08-13T12:00:00.000Z");
  const trialing = evaluateEntitlement(
    "ws",
    {
      workspace_id: "ws",
      status: "trialing",
      trial_started_at: "2026-08-01T00:00:00.000Z",
      trial_ends_at: "2026-08-20T00:00:00.000Z",
      current_period_end: null,
      cancel_at_period_end: false,
    },
    { now },
  );
  assert.equal(trialing.canUseLume, true);

  const active = evaluateEntitlement(
    "ws",
    {
      workspace_id: "ws",
      status: "active",
      trial_started_at: null,
      trial_ends_at: null,
      current_period_end: "2026-09-01T00:00:00.000Z",
      cancel_at_period_end: false,
    },
    { now },
  );
  assert.equal(active.canUseLume, true);

  const expired = evaluateEntitlement(
    "ws",
    {
      workspace_id: "ws",
      status: "expired",
      trial_started_at: null,
      trial_ends_at: "2026-08-01T00:00:00.000Z",
      current_period_end: null,
      cancel_at_period_end: false,
    },
    { now },
  );
  assert.equal(expired.canUseLume, false);

  const cancelledLive = evaluateEntitlement(
    "ws",
    {
      workspace_id: "ws",
      status: "cancelled",
      trial_started_at: null,
      trial_ends_at: null,
      current_period_end: "2026-09-01T00:00:00.000Z",
      cancel_at_period_end: true,
    },
    { now },
  );
  assert.equal(cancelledLive.canUseLume, true);
  assert.equal(cancelledLive.reason, "cancelled_until_period_end");
});

check("stripe status mapper", () => {
  assert.equal(mapStripeSubscriptionStatus("trialing"), "trialing");
  assert.equal(mapStripeSubscriptionStatus("active"), "active");
  assert.equal(mapStripeSubscriptionStatus("past_due"), "past_due");
  assert.equal(
    mapStripeSubscriptionStatus("canceled", {
      currentPeriodEnd: "2026-09-01T00:00:00.000Z",
      now: new Date("2026-08-13T00:00:00.000Z"),
    }),
    "cancelled",
  );
});

check("stripe subscription map carries workspace metadata", () => {
  const patch = mapStripeSubscriptionToLume({
    id: "sub_1",
    status: "active",
    customer: "cus_1",
    items: { data: [{ price: { id: "price_1" } }] },
    current_period_end: Math.floor(Date.now() / 1000) + 86400,
    metadata: { workspace_id: "ws-123" },
  });
  assert.equal(patch.workspaceIdFromMetadata, "ws-123");
  assert.equal(patch.status, "active");
});

check("rate limit blocks after window quota", () => {
  resetRateLimitStoreForTests();
  const key = "capture:test-user";
  assert.equal(checkRateLimit({ key, limit: 2, windowMs: 60_000 }).allowed, true);
  assert.equal(checkRateLimit({ key, limit: 2, windowMs: 60_000 }).allowed, true);
  assert.equal(checkRateLimit({ key, limit: 2, windowMs: 60_000 }).allowed, false);
});

check("billing migration + RLS deny authenticated writes", () => {
  const sql = fs.readFileSync(
    path.join(root, "supabase/migrations/20260813140000_billing_foundation.sql"),
    "utf8",
  );
  assert.match(sql, /create table public\.subscriptions/);
  assert.match(sql, /create table public\.billing_customers/);
  assert.match(sql, /create table public\.billing_events/);
  assert.match(sql, /billing_customers_select_member/);
  assert.match(sql, /subscriptions_select_member/);
  assert.match(sql, /No INSERT\/UPDATE\/DELETE policies for authenticated/);
  assert.match(sql, /ensure_workspace_trial/);
});

check("billing routes exist and webhook is signature-gated in code", () => {
  for (const rel of [
    "src/app/api/billing/status/route.ts",
    "src/app/api/billing/checkout/route.ts",
    "src/app/api/billing/portal/route.ts",
    "src/app/api/billing/webhook/route.ts",
  ]) {
    assert.equal(fs.existsSync(path.join(root, rel)), true, rel);
  }
  const webhook = fs.readFileSync(
    path.join(root, "src/app/api/billing/webhook/route.ts"),
    "utf8",
  );
  assert.match(webhook, /constructEvent/);
  assert.match(webhook, /recordBillingEventIfNew/);
});

check("AI routes import requireAiCaller", () => {
  for (const rel of [
    "src/app/api/capture/route.ts",
    "src/app/api/coach/route.ts",
    "src/app/api/transcribe/route.ts",
    "src/app/api/new-project/route.ts",
    "src/app/api/tell-me/route.ts",
    "src/app/api/tell-me/refresh/route.ts",
  ]) {
    const src = fs.readFileSync(path.join(root, rel), "utf8");
    assert.match(src, /requireAiCaller/);
  }
});

check("ai-gate enforces entitlement for supabase callers", () => {
  const gate = fs.readFileSync(path.join(root, "src/lib/ai-gate.ts"), "utf8");
  assert.match(gate, /getWorkspaceEntitlement/);
  assert.match(gate, /canUseLume/);
  assert.match(gate, /entitlement_required/);
  assert.match(gate, /403/);
});

check("coach prompt is not hard-coded to Tom", () => {
  const coach = fs.readFileSync(path.join(root, "src/lib/pm-coach.ts"), "utf8");
  assert.doesNotMatch(coach, /\bTom\b/);
  assert.match(coach, /resolveCoachManagerLabel/);
  assert.match(coach, /the project manager/);
});

check("past_due remains soft-allowed (grace)", () => {
  const pastDue = evaluateEntitlement(
    "ws",
    {
      workspace_id: "ws",
      status: "past_due",
      trial_started_at: null,
      trial_ends_at: null,
      current_period_end: "2026-09-01T00:00:00.000Z",
      cancel_at_period_end: false,
    },
    { now: new Date("2026-08-13T12:00:00.000Z") },
  );
  assert.equal(pastDue.canUseLume, true);
  assert.equal(pastDue.reason, "past_due_grace");
});

check("env example documents public vs server vars", () => {
  const env = fs.readFileSync(path.join(root, ".env.local.example"), "utf8");
  assert.match(env, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(env, /OPENAI_API_KEY/);
  assert.match(env, /STRIPE_SECRET_KEY/);
  assert.match(env, /STRIPE_WEBHOOK_SECRET/);
  assert.match(env, /STRIPE_PRICE_ID/);
  assert.doesNotMatch(env, /NEXT_PUBLIC_STRIPE_SECRET/);
  assert.doesNotMatch(env, /NEXT_PUBLIC_SUPABASE_SERVICE/);
});

check("next production build typechecks the app, not verify scripts", () => {
  const nextConfig = fs.readFileSync(path.join(root, "next.config.ts"), "utf8");
  assert.match(nextConfig, /tsconfigPath:\s*"tsconfig\.build\.json"/);
  const buildTsconfig = JSON.parse(
    fs.readFileSync(path.join(root, "tsconfig.build.json"), "utf8"),
  ) as { exclude?: string[] };
  assert.ok(
    (buildTsconfig.exclude ?? []).includes("scripts"),
    "tsconfig.build.json must exclude scripts so next build cannot fail on test helpers",
  );
});

check("browser supabase helpers use static NEXT_PUBLIC process.env access", () => {
  const src = fs.readFileSync(
    path.join(root, "src/lib/supabase/env.ts"),
    "utf8",
  );
  assert.match(src, /process\.env\.NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(src, /process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.match(src, /process\.env\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
});

check("supabase public env helpers honour an explicit overlay for tests", () => {
  const overlay = {
    NODE_ENV: "test",
    NEXT_PUBLIC_SUPABASE_URL: "https://overlay.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-overlay",
  } as NodeJS.ProcessEnv;
  assert.equal(getSupabaseUrl(overlay), "https://overlay.supabase.co");
  assert.equal(getSupabaseAnonKey(overlay), "anon-overlay");
});

console.log(`\n${passed} production/billing readiness checks passed.`);
