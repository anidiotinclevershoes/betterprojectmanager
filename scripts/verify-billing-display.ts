/**
 * Billing display helpers — server remains entitlement authority.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  checkoutNoticeCopy,
  subscriptionStatusLabel,
  trialRemainingCopy,
} from "../src/lib/billing/display";
import { evaluateEntitlement } from "../src/lib/billing/entitlements";

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

check("trial remaining copy does not invent prices", () => {
  const now = new Date("2026-09-07T12:00:00.000Z");
  const copy = trialRemainingCopy("2026-09-17T12:00:00.000Z", now);
  assert.match(copy ?? "", /10 days/);
  assert.doesNotMatch(copy ?? "", /\$|£|price/i);
  assert.match(
    trialRemainingCopy("2026-08-01T00:00:00.000Z", now) ?? "",
    /ended/i,
  );
});

check("checkout notices do not treat the client as billing authority", () => {
  assert.match(checkoutNoticeCopy("success") ?? "", /Stripe confirms/);
  assert.match(checkoutNoticeCopy("cancel") ?? "", /unchanged/);
  assert.equal(checkoutNoticeCopy("nope"), null);
});

check("status labels stay human", () => {
  assert.equal(subscriptionStatusLabel("trialing"), "Trial");
  assert.equal(subscriptionStatusLabel("active"), "Active");
});

check("expired entitlement still comes from server evaluator", () => {
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
    { now: new Date("2026-09-07T00:00:00.000Z"), stripeConfigured: false },
  );
  assert.equal(ended.canUseLume, false);
  assert.equal(ended.status, "expired");
});

check("expired panel no longer advertises hidden Coach", () => {
  const panel = fs.readFileSync(
    path.join(root, "src/components/billing/TrialExpiredPanel.tsx"),
    "utf8",
  );
  assert.doesNotMatch(panel, /Coach/);
  assert.match(panel, /Knowledge Centre/);
  assert.match(panel, /billing is configured/i);
});

check("checkout success and cancel return to account", () => {
  const route = fs.readFileSync(
    path.join(root, "src/app/api/billing/checkout/route.ts"),
    "utf8",
  );
  assert.match(route, /success_url.*\/account\?checkout=success/);
  assert.match(route, /cancel_url.*\/account\?checkout=cancel/);
  assert.match(route, /isBillingEnabled/);
  assert.match(route, /isStripeConfigured/);
});

console.log(`\n${passed} billing display / entitlement checks passed.`);
