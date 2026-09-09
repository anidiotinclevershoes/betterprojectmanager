/**
 * LUME_BILLING_ENABLED is independent of Stripe keys.
 * Checkout must fail closed while billing is off.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { evaluateEntitlement } from "../src/lib/billing/entitlements";
import { earlyAccessCopy } from "../src/lib/billing/display";
import { isBillingEnabled, isStripeConfigured } from "../src/lib/runtime-config";

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
function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const stripeEnv = {
  STRIPE_SECRET_KEY: "sk_test_not_real",
  STRIPE_PRICE_ID: "price_not_real",
} as unknown as NodeJS.ProcessEnv;

check("Stripe keys do not enable billing by themselves", () => {
  assert.equal(isStripeConfigured(stripeEnv), true);
  assert.equal(isBillingEnabled(stripeEnv), false);
  assert.equal(
    isBillingEnabled({
      ...stripeEnv,
      LUME_BILLING_ENABLED: "true",
    } as unknown as NodeJS.ProcessEnv),
    true,
  );
  assert.equal(
    isBillingEnabled({
      LUME_BILLING_ENABLED: "false",
    } as unknown as NodeJS.ProcessEnv),
    false,
  );
});

check("billing disabled allows early access even after a trial clock would have expired", () => {
  const ended = evaluateEntitlement(
    "ws",
    {
      workspace_id: "ws",
      status: "trialing",
      trial_started_at: "2026-01-01T00:00:00.000Z",
      trial_ends_at: "2026-01-15T00:00:00.000Z",
      current_period_end: null,
      cancel_at_period_end: false,
    },
    {
      now: new Date("2026-09-07T00:00:00.000Z"),
      stripeConfigured: true,
      billingEnabled: false,
    },
  );
  assert.equal(ended.canUseLume, true);
  assert.equal(ended.reason, "early_access");
});

check("billing enabled still expires a finished trial", () => {
  const ended = evaluateEntitlement(
    "ws",
    {
      workspace_id: "ws",
      status: "trialing",
      trial_started_at: "2026-01-01T00:00:00.000Z",
      trial_ends_at: "2026-01-15T00:00:00.000Z",
      current_period_end: null,
      cancel_at_period_end: false,
    },
    {
      now: new Date("2026-09-07T00:00:00.000Z"),
      stripeConfigured: true,
      billingEnabled: true,
    },
  );
  assert.equal(ended.canUseLume, false);
  assert.equal(ended.status, "expired");
});

check("checkout and portal refuse billing_disabled before Stripe", () => {
  for (const rel of [
    "src/app/api/billing/checkout/route.ts",
    "src/app/api/billing/portal/route.ts",
  ]) {
    const src = read(rel);
    const disabled = src.indexOf("isBillingEnabled()");
    const configured = src.indexOf("isStripeConfigured()");
    assert.ok(disabled >= 0, rel);
    assert.ok(configured > disabled, `${rel}: flag must be checked before keys`);
    assert.match(src, /billing_disabled/);
    assert.match(src, /status: 403/);
  }
});

check("Account and EntitlementGate hide checkout while billing is off", () => {
  const account = read("src/app/account/page.tsx");
  assert.match(account, /billingEnabled/);
  assert.match(account, /earlyAccessCopy/);
  assert.match(account, /Export my data/);
  const gate = read("src/components/billing/EntitlementGate.tsx");
  assert.match(gate, /billingEnabled && entitlement && !entitlement.canUseLume/);
  assert.match(earlyAccessCopy(), /early access/i);
});

check("status API reports billingEnabled separately from Stripe keys", () => {
  const status = read("src/app/api/billing/status/route.ts");
  assert.match(status, /billingEnabled: isBillingEnabled\(\)/);
  assert.match(status, /billingConfigured: isStripeConfigured\(\)/);
  const service = read("src/lib/billing/service.ts");
  assert.match(service, /if \(!isBillingEnabled\(\)\)/);
  assert.match(service, /ensure_workspace_trial/);
});

check("billing flag does not touch Capture Apply or persist", () => {
  const apply = read("src/lib/capture/apply/apply-approved.ts");
  assert.doesNotMatch(apply, /LUME_BILLING_ENABLED|isBillingEnabled/);
  const persist = read("src/lib/data/supabase/persist-mutations.ts");
  assert.doesNotMatch(persist, /LUME_BILLING_ENABLED|isBillingEnabled/);
});

check("env example documents the flag without making keys the rollout switch", () => {
  const env = read(".env.local.example");
  assert.match(env, /LUME_BILLING_ENABLED/);
  assert.match(env, /LUME_TRIAL_DAYS/);
});

console.log(`\n${passed} billing-flag checks passed.`);
