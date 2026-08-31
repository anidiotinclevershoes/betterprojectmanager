/**
 * Phase 2 auth structural + unit checks (no network required).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  passwordRequirementsCopy,
  validatePassword,
  friendlyAuthError,
} from "../src/lib/auth-password";
import { clearAuthenticatedBrowserState } from "../src/lib/session-cleanup";

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

check("password min length enforced", () => {
  assert.equal(validatePassword("short"), "Password must be at least 8 characters.");
  assert.equal(validatePassword("longenough"), null);
  assert.match(passwordRequirementsCopy(), /8/);
});

check("friendly auth errors hide raw provider text", () => {
  assert.match(friendlyAuthError("Invalid login credentials"), /credentials/i);
  assert.match(friendlyAuthError("Email not confirmed"), /confirm/i);
  assert.doesNotMatch(friendlyAuthError("Invalid login credentials"), /supabase/i);
});

check("auth pages exist", () => {
  for (const rel of [
    "src/app/login/page.tsx",
    "src/app/signup/page.tsx",
    "src/app/forgot-password/page.tsx",
    "src/app/reset-password/page.tsx",
    "src/app/auth/callback/route.ts",
    "src/app/api/auth/signup/route.ts",
    "src/app/api/auth/forgot-password/route.ts",
    "src/app/api/auth/reset-password/route.ts",
  ]) {
    assert.equal(fs.existsSync(path.join(root, rel)), true, rel);
  }
});

check("proxy treats auth pages as public", () => {
  const proxy = fs.readFileSync(path.join(root, "src/proxy.ts"), "utf8");
  assert.match(proxy, /\/signup/);
  assert.match(proxy, /\/forgot-password/);
  assert.match(proxy, /\/reset-password/);
  assert.match(proxy, /\/auth\/callback/);
  assert.match(proxy, /updateSupabaseSession|getAuthMode/);
});

check("production New Project UI is a single four-frame compose page", () => {
  const ui = fs.readFileSync(
    path.join(root, "src/components/onboarding/NewProjectExperience.tsx"),
    "utf8",
  );
  assert.match(ui, /Create Project/);
  assert.match(ui, /Organise notes/);
  assert.match(ui, /np-frame-issues/);
  assert.match(ui, /np-frame-people/);
  assert.match(ui, /np-frame-todo/);
  assert.match(ui, /np-frame-knowledge/);
  assert.doesNotMatch(ui, /Talk It Through/);
  assert.doesNotMatch(ui, /Start Recording/);
});

check("logout clears authenticated browser caches helper", () => {
  assert.equal(typeof clearAuthenticatedBrowserState, "function");
  const cleanup = fs.readFileSync(
    path.join(root, "src/lib/session-cleanup.ts"),
    "utf8",
  );
  assert.match(cleanup, /mission-control-state-v5/);
  assert.match(cleanup, /lume-capture-sessions-v1/);
  assert.match(cleanup, /lume-tell-me-snapshots-v1/);
  assert.match(cleanup, /lume-project-dictionary-v1/);
  assert.match(cleanup, /mc-workspace-layout-v3:/);
});

check("login and signup wipe browser project state before entering the app", () => {
  const login = fs.readFileSync(path.join(root, "src/app/login/page.tsx"), "utf8");
  const signup = fs.readFileSync(path.join(root, "src/app/signup/page.tsx"), "utf8");
  assert.match(login, /clearAuthenticatedBrowserState/);
  assert.match(login, /window\.location\.assign/);
  assert.match(signup, /clearAuthenticatedBrowserState/);
  assert.match(signup, /window\.location\.assign/);
});

check("browser wipe removes project-domain keys including prefixes", () => {
  const mem: Record<string, string> = {
    "lume-tell-me-snapshots-v1": "snap",
    "lume-project-dictionary-v1": "dict",
    "lume-mission-supabase-cache-v1": "cache",
    "mc-workspace-layout-v3:proj-a": "layout",
    "mc-appearance-v1": "keep-theme",
  };
  const makeStorage = () => {
    const storage = {
      removeItem(key: string) {
        delete mem[key];
      },
      key(index: number) {
        return Object.keys(mem)[index] ?? null;
      },
      get length() {
        return Object.keys(mem).length;
      },
    };
    return storage;
  };
  (globalThis as { window?: unknown }).window = {
    localStorage: makeStorage(),
    sessionStorage: makeStorage(),
  };
  clearAuthenticatedBrowserState();
  assert.equal(mem["lume-tell-me-snapshots-v1"], undefined);
  assert.equal(mem["lume-project-dictionary-v1"], undefined);
  assert.equal(mem["lume-mission-supabase-cache-v1"], undefined);
  assert.equal(mem["mc-workspace-layout-v3:proj-a"], undefined);
  assert.equal(mem["mc-appearance-v1"], "keep-theme");
  delete (globalThis as { window?: unknown }).window;
});

check("phase 2 workspace bootstrap migration exists", () => {
  const mig = path.join(
    root,
    "supabase/migrations/20260812203000_phase2_ensure_personal_workspace.sql",
  );
  assert.equal(fs.existsSync(mig), true);
  const sql = fs.readFileSync(mig, "utf8");
  assert.match(sql, /ensure_personal_workspace/);
  assert.match(sql, /Personal Lume Workspace/);
});

check("persistence helpers exist", () => {
  assert.equal(
    fs.existsSync(
      path.join(root, "src/lib/data/supabase/load-mission-state.ts"),
    ),
    true,
  );
  assert.equal(
    fs.existsSync(
      path.join(root, "src/lib/data/supabase/persist-mutations.ts"),
    ),
    true,
  );
});

console.log(`\n${passed} Phase 2 auth/persistence structural checks passed.`);
