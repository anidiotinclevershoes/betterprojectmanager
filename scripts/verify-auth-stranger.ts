/**
 * Stranger auth journeys: expired links, duplicates, next-path safety.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { friendlyAuthError, validatePassword } from "../src/lib/auth-password";
import { safeAuthNextPath } from "../src/lib/auth-mission-ownership";

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

check("duplicate-account copy is calm and does not leak provider text", () => {
  for (const raw of [
    "User already registered",
    "A user with this email address has already been registered",
    "User already exists",
  ]) {
    const msg = friendlyAuthError(raw);
    assert.match(msg, /already exists/i);
    assert.match(msg, /signing in/i);
    assert.doesNotMatch(msg, /supabase/i);
  }
});

check("expired and invalid reset links fail closed with a recovery path", () => {
  assert.match(
    friendlyAuthError("Your reset link is invalid or expired. Request a new one."),
    /expired|invalid/i,
  );
  assert.match(friendlyAuthError("Token has expired or is invalid"), /expired/i);
  const reset = fs.readFileSync(
    path.join(root, "src/app/reset-password/page.tsx"),
    "utf8",
  );
  assert.match(reset, /sessionState/);
  assert.match(reset, /expired/);
  assert.match(reset, /\/forgot-password/);
  assert.match(reset, /\/api\/auth\/me/);
  assert.match(reset, /password_updated/);
  assert.match(reset, /trackAnalyticsEvent/);
});

check("reset API refuses a missing session", () => {
  const api = fs.readFileSync(
    path.join(root, "src/app/api/auth/reset-password/route.ts"),
    "utf8",
  );
  assert.match(api, /getUser/);
  assert.match(api, /invalid or expired/);
  assert.match(api, /status: 401/);
});

check("open-redirect next= values are rejected", () => {
  assert.equal(safeAuthNextPath("/projects/abc"), "/projects/abc");
  assert.equal(safeAuthNextPath("//evil.example"), "/");
  assert.equal(safeAuthNextPath("https://evil.example"), "/");
  assert.equal(safeAuthNextPath(""), "/");
});

check("password rules stay local and do not accept short secrets", () => {
  assert.ok(validatePassword("1234567"));
  assert.equal(validatePassword("longenough"), null);
});

check("generic provider password errors do not dump raw text", () => {
  const msg = friendlyAuthError("Password should be at least 8 characters");
  assert.match(msg, /8 characters/);
  assert.doesNotMatch(msg, /should be at least/);
});

console.log(`\n${passed} stranger-auth checks passed.`);
