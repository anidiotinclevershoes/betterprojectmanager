/**
 * Public sales landing + signed-out / signed-in routing.
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

check("welcome landing exists and uses current product promise", () => {
  assert.equal(fs.existsSync(path.join(root, "src/app/welcome/page.tsx")), true);
  const landing = read("src/components/marketing/PublicLanding.tsx");
  assert.match(landing, /data-testid="public-landing"/);
  assert.match(landing, /entire project in your head/);
  assert.match(landing, /href="\/signup"/);
  assert.match(landing, /href="\/login"/);
  assert.match(landing, /Needs You/);
  assert.match(landing, /landing_viewed/);
  assert.match(landing, /trackAnalyticsEvent/);
  assert.doesNotMatch(landing, /Talk It Through|Paste Project Information/);
  assert.doesNotMatch(landing, /Legal Eagle|pricing table|\$\d+/);
});

check("signed-out home goes to welcome; signed-in auth pages still go home", () => {
  const proxy = read("src/proxy.ts");
  assert.match(proxy, /"\/welcome"/);
  assert.match(proxy, /pathname === "\/"/);
  assert.match(proxy, /redirect\(new URL\("\/welcome"/);
  assert.match(proxy, /isAuthPage\(pathname\)/);
  const authPageFn = proxy.slice(proxy.indexOf("function isAuthPage"));
  assert.match(authPageFn, /\/welcome/);
});

check("workspace chrome is hidden on the public landing", () => {
  const shell = read("src/components/AppShell.tsx");
  const chrome = shell.slice(shell.indexOf("function isAuthChromePath"));
  assert.match(chrome, /\/welcome/);
});

check("authenticated home is still the product, not the sales page", () => {
  const home = read("src/app/page.tsx");
  assert.match(home, /NewProjectExperience/);
  assert.match(home, /variant="first-run"/);
  assert.doesNotMatch(home, /PublicLanding/);
});

check("login and signup connect back to the public surface", () => {
  assert.match(read("src/app/login/page.tsx"), /href="\/welcome"/);
  assert.match(read("src/app/signup/page.tsx"), /href="\/welcome"/);
});

check("landing does not invent a second project-creation path", () => {
  const landing = read("src/components/marketing/PublicLanding.tsx");
  assert.doesNotMatch(landing, /createProject|persistNewProject|\/api\/new-project/);
});

console.log(`\n${passed} public landing / routing checks passed.`);
