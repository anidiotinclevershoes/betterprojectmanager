/**
 * Leftover routes hidden; support/privacy exist without legal invention.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

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

check("leftover product routes redirect home", () => {
  for (const rel of [
    "src/app/memory/page.tsx",
    "src/app/coaching/page.tsx",
    "src/app/releases/page.tsx",
  ]) {
    const src = read(rel);
    assert.match(src, /redirect\("\/"\)/);
    assert.doesNotMatch(src, /useMission/);
  }
});

check("support and privacy are public and honest", () => {
  const privacy = read("src/app/privacy/page.tsx");
  assert.match(privacy, /not a lawyer-reviewed policy/);
  assert.match(privacy, /must not receive project contents/);
  assert.match(privacy, /Lawyer-reviewed policy/);
  const terms = read("src/app/terms/page.tsx");
  assert.match(terms, /not a finished legal agreement/);
  assert.match(terms, /Lawyer-reviewed terms/);
  const support = read("src/app/support/page.tsx") + read("src/lib/support.ts");
  assert.match(support, /Reset link expired/);
  assert.match(support, /support@lume\.app/);
  assert.match(support, /SUPPORT_EMAIL/);
  assert.doesNotMatch(support, /@gmail\.com/);
});

check("proxy exposes support pages without making them signed-in redirects", () => {
  const proxy = read("src/proxy.ts");
  assert.match(proxy, /"\/privacy"/);
  assert.match(proxy, /"\/terms"/);
  assert.match(proxy, /"\/support"/);
  assert.match(proxy, /"\/welcome"/);
  assert.match(proxy, /redirect\(new URL\("\/welcome"/);
  const authPage = proxy.slice(proxy.indexOf("function isAuthPage"));
  assert.match(authPage.slice(0, 400), /\/welcome/);
  assert.doesNotMatch(authPage.slice(0, 400), /\/privacy/);
  assert.doesNotMatch(authPage.slice(0, 400), /\/support/);
});

check("workspace chrome stays off welcome and legal pages", () => {
  const chrome = read("src/components/AppShell.tsx").slice(
    read("src/components/AppShell.tsx").indexOf("function isAuthChromePath"),
  );
  assert.match(chrome, /\/welcome/);
  assert.match(chrome, /\/privacy/);
  assert.match(chrome, /\/support/);
});

check("auth chrome includes legal links", () => {
  const shell = read("src/components/auth/AuthShell.tsx");
  assert.match(shell, /href="\/privacy"/);
  assert.match(shell, /href="\/support"/);
});

console.log(`\n${passed} stranger-polish checks passed.`);
