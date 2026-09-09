/**
 * Product analytics: catalogued events fire; sensitive contents never ship.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ANALYTICS_EVENTS } from "../src/lib/analytics/events";
import {
  getAnalyticsDistinctId,
  identifyAnalyticsUser,
  resetAnalyticsClientForTests,
  resetAnalyticsIdentity,
  setAnalyticsSinkForTests,
  trackAnalyticsEvent,
  type AnalyticsSinkEvent,
} from "../src/lib/analytics/client";
import {
  analyticsPathname,
  looksLikeSensitiveAnalyticsValue,
  sanitizeAnalyticsEvent,
} from "../src/lib/analytics/sanitize";
import { getPosthogProjectKey, isProductAnalyticsConfigured } from "../src/lib/analytics/config";

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

check("catalog covers the stranger activation funnel", () => {
  for (const name of [
    "landing_viewed",
    "signup_started",
    "signup_completed",
    "first_project_created",
    "capture_used",
    "review_reached",
    "apply_completed",
    "login_completed",
  ]) {
    assert.equal(
      ANALYTICS_EVENTS[name as keyof typeof ANALYTICS_EVENTS],
      name,
    );
  }
});

check("sanitize drops unknown events", () => {
  assert.equal(sanitizeAnalyticsEvent("adhoc_debug", { path: "/" }), null);
});

check("sanitize keeps only allowed behavioural props", () => {
  const clean = sanitizeAnalyticsEvent("capture_used", {
    source: "typed",
    has_project_scope: true,
    content: "Sarah owns the harbour permit — delay risk",
    email: "pm@example.com",
    title: "Order blue lighthouse lens",
    captureText: "meeting notes about Finance",
  });
  assert.ok(clean);
  assert.equal(clean.event, "capture_used");
  assert.deepEqual(clean.properties, {
    source: "typed",
    has_project_scope: true,
  });
});

check("sanitize rejects emails and secrets in values", () => {
  assert.equal(looksLikeSensitiveAnalyticsValue("pm@example.com"), true);
  const clean = sanitizeAnalyticsEvent("signup_completed", {
    path: "pm@example.com",
    source: "sk-live-not-a-real-key",
  });
  assert.ok(clean);
  assert.deepEqual(clean.properties, {});
});

check("path helper strips query strings that may hold auth codes", () => {
  assert.equal(
    analyticsPathname("/auth/callback?code=secret-auth-code&next=/"),
    "/auth/callback",
  );
  assert.equal(analyticsPathname("https://evil.example/login"), "/");
});

check("track drops forbidden payloads and records clean ones", () => {
  resetAnalyticsClientForTests();
  const captured: AnalyticsSinkEvent[] = [];
  setAnalyticsSinkForTests({
    capture: (event) => captured.push(event),
    identify: () => undefined,
    reset: () => undefined,
  });

  assert.equal(
    trackAnalyticsEvent("not_a_real_event", { path: "/signup" }),
    false,
  );
  assert.equal(
    trackAnalyticsEvent("apply_completed", {
      outcome: "wrote",
      domain: "todo",
      text: "Order blue lighthouse lens before Friday",
      notes: "Confidential harbour delay",
    }),
    true,
  );
  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.event, "apply_completed");
  assert.deepEqual(captured[0]?.properties, {
    outcome: "wrote",
    domain: "todo",
  });
  resetAnalyticsClientForTests();
});

check("identify uses opaque user id and ignores email", () => {
  resetAnalyticsClientForTests();
  identifyAnalyticsUser("pm@example.com");
  assert.doesNotMatch(getAnalyticsDistinctId(), /@/);
  identifyAnalyticsUser("541360f6-44e0-4985-b401-f30dd3c2ee4a");
  assert.equal(
    getAnalyticsDistinctId(),
    "user:541360f6-44e0-4985-b401-f30dd3c2ee4a",
  );
  resetAnalyticsIdentity();
  resetAnalyticsClientForTests();
});

check("PostHog project token is optional and public-only", () => {
  assert.equal(isProductAnalyticsConfigured({} as NodeJS.ProcessEnv), false);
  assert.equal(
    getPosthogProjectKey({
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "phc_example",
    } as unknown as NodeJS.ProcessEnv),
    "phc_example",
  );
  const envExample = fs.readFileSync(path.join(root, ".env.local.example"), "utf8");
  assert.match(envExample, /NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN/);
  assert.match(envExample, /NEXT_PUBLIC_POSTHOG_HOST/);
  assert.doesNotMatch(envExample, /POSTHOG_PERSONAL_API_KEY/);
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_POSTHOG_SECRET/);
});

check("client bundle can inline the public PostHog token", () => {
  const config = fs.readFileSync(
    path.join(root, "src/lib/analytics/config.ts"),
    "utf8",
  );
  assert.match(config, /process\.env\.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN/);
  assert.match(config, /process\.env\.NEXT_PUBLIC_POSTHOG_HOST/);
  assert.match(config, /process\.env\.NEXT_PUBLIC_POSTHOG_KEY/);
});

check("instrumentation never sends Capture or Knowledge text fields", () => {
  const files = [
    "src/components/onboarding/NewProjectExperience.tsx",
    "src/components/capture/CaptureSessionContext.tsx",
    "src/app/signup/page.tsx",
    "src/app/login/page.tsx",
    "src/components/analytics/AnalyticsProvider.tsx",
  ];
  const callRe = /trackAnalyticsEvent\(([\s\S]*?)\)/g;
  const forbiddenProp = /(?:content|email|notes|title|detail|transcript|text)\s*:/;
  for (const rel of files) {
    const src = fs.readFileSync(path.join(root, rel), "utf8");
    assert.match(src, /trackAnalyticsEvent/, rel);
    const calls = [...src.matchAll(callRe)].map((m) => m[1] ?? "");
    assert.ok(calls.length > 0, rel);
    for (const call of calls) {
      assert.doesNotMatch(call, forbiddenProp, `${rel}: ${call}`);
    }
  }
});

check("no PostHog autocapture or session replay is wired", () => {
  const client = fs.readFileSync(
    path.join(root, "src/lib/analytics/client.ts"),
    "utf8",
  );
  const provider = fs.readFileSync(
    path.join(root, "src/components/analytics/AnalyticsProvider.tsx"),
    "utf8",
  );
  assert.doesNotMatch(client, /autocapture:\s*true/);
  assert.doesNotMatch(provider, /sessionRecording|startSessionRecording/);
  assert.match(client, /\/capture\//);
});

console.log(`\n${passed} analytics privacy/funnel checks passed.`);
