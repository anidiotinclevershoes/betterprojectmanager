/**
 * Account export + deletion for controlled external V1.
 * Credential-free. No live Supabase.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  ACCOUNT_EXPORT_FORMAT,
  buildAccountExport,
} from "../src/lib/account/export";
import {
  DELETE_CONFIRMATION,
  isAccountDeleteConfirmation,
} from "../src/lib/account/delete";
import type { MissionState } from "../src/lib/types";

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

const OWN_PROJECT = "11111111-1111-4111-8111-111111111111";

function sampleState(): MissionState {
  return {
    projects: [
      {
        id: OWN_PROJECT,
        name: "Harbourline",
        code: "HBR",
        summary: "Own project",
        status: "healthy",
        currentFocus: "Ship V1",
        stakeholders: [{ id: "s1", name: "Ada", role: "Sponsor" }],
      },
    ],
    memories: [
      {
        id: "m1",
        type: "conversation",
        projectId: OWN_PROJECT,
        title: "Setup",
        content: "Remember the harbour wall.",
        tags: ["project-setup"],
        occurredAt: "2026-09-01T00:00:00.000Z",
        createdAt: "2026-09-01T00:00:00.000Z",
        source: "capture",
      },
    ],
    recommendations: [],
    meetings: [],
    releases: [],
    todos: [
      {
        id: "t1",
        projectId: OWN_PROJECT,
        title: "Write the brief",
        done: false,
        createdAt: "2026-09-01T00:00:00.000Z",
        kind: "ACTION",
      },
    ],
    knowledge: [],
    risks: [
      {
        id: "r1",
        projectId: OWN_PROJECT,
        title: "Weather",
        status: "open",
        source: "manual",
      },
    ],
    timeline: [],
    history: [],
  };
}

check("typed confirmation is exact and rejects near-misses", () => {
  assert.equal(isAccountDeleteConfirmation(DELETE_CONFIRMATION), true);
  assert.equal(isAccountDeleteConfirmation(` ${DELETE_CONFIRMATION} `), true);
  assert.equal(isAccountDeleteConfirmation("delete my account"), false);
  assert.equal(isAccountDeleteConfirmation("DELETE MY ACCOUNT!"), false);
  assert.equal(isAccountDeleteConfirmation(""), false);
  assert.equal(isAccountDeleteConfirmation(null), false);
});

check("export contains representative project truth and no secrets", () => {
  const payload = buildAccountExport({
    exportedAt: "2026-09-09T12:00:00.000Z",
    userId: "user-1",
    email: "ada@example.com",
    workspaceId: "ws-1",
    state: sampleState(),
  });
  assert.equal(payload.format, ACCOUNT_EXPORT_FORMAT);
  assert.equal(payload.projects[0]?.id, OWN_PROJECT);
  assert.equal(payload.todos[0]?.title, "Write the brief");
  assert.equal(payload.people[0]?.name, "Ada");
  assert.equal(payload.memories[0]?.content, "Remember the harbour wall.");
  const json = JSON.stringify(payload);
  assert.doesNotMatch(json, /sk_live|sk_test|whsec_|SUPABASE_SERVICE|service_role|OPENAI_API_KEY|STRIPE_SECRET/);
  assert.doesNotMatch(json, /eyJhbGciOi/);
  assert.equal("stripeCustomerId" in payload, false);
  assert.equal("accessToken" in payload, false);
});

check("export builder does not invent a second truth model", () => {
  const src = read("src/lib/account/export.ts");
  assert.match(src, /state\.projects/);
  assert.match(src, /state\.todos/);
  assert.doesNotMatch(src, /createClient|service_role|STRIPE_SECRET/);
});

check("export API is authenticated, scoped, and attachment-only", () => {
  const route = read("src/app/api/account/export/route.ts");
  assert.match(route, /auth\.getUser/);
  assert.match(route, /loadMissionStateFromSupabase/);
  assert.match(route, /loaded\.userId !== user\.id/);
  assert.match(route, /lume-export\.json/);
  assert.match(route, /Sign in required/);
  assert.doesNotMatch(route, /createServiceSupabaseClient/);
});

check("delete API is server-authoritative and does not create a workspace", () => {
  const route = read("src/app/api/account/delete/route.ts");
  assert.match(route, /isAccountDeleteConfirmation/);
  assert.match(route, /auth\.getUser/);
  assert.match(route, /auth\.admin\.deleteUser/);
  assert.match(route, /status: 401/);
  assert.match(route, /status: 409/);
  assert.match(route, /other members/);
  assert.match(route, /more than one workspace/);
  assert.doesNotMatch(route, /ensurePersonalWorkspace/);
  assert.match(route, /from\("workspaces"\)[\s\S]*\.delete\(\)/);
  assert.match(route, /signOut/);
});

check("Account UI requires typed confirmation and offers export", () => {
  const account = read("src/app/account/page.tsx");
  assert.match(account, /Export my data/);
  assert.match(account, /\/api\/account\/export/);
  assert.match(account, /DELETE_CONFIRMATION/);
  assert.match(account, /\/api\/account\/delete/);
  assert.match(account, /danger-btn/);
  assert.match(account, /clearAuthenticatedBrowserState/);
  assert.match(account, /navigateAuthBoundary\("\/welcome"\)/);
  assert.match(account, /deletePhrase\.trim\(\) !== DELETE_CONFIRMATION/);
});

console.log(`\n${passed} account-lifecycle checks passed.`);
