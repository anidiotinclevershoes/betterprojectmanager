/**
 * Page 03 desktop project chrome and Page 09 narrow 160px chrome.
 *
 * Run: npm run verify:project-top-chrome
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

function check(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

check("desktop project routes do not lay out TopHeader", () => {
  const shell = read("src/components/AppShell.tsx");
  const header = read("src/components/app-shell/TopHeader.tsx");
  const css = read("src/app/globals.css");
  assert.match(shell, /projectMobile/);
  assert.match(shell, /activeProject \?/);
  assert.match(header, /is-project-mobile/);
  assert.match(header, /LumeLogo/);
  assert.match(header, />Lume</);
  assert.doesNotMatch(header, /ocean-wordmark-me/);
  assert.match(header, /Open navigation/);
  assert.match(
    css,
    /@media \(min-width:\s*900px\)\s*\{[^}]*\.top-header\.is-project-mobile\s*\{[^}]*display:\s*none/,
  );
  assert.match(shell, /onSignOut=\{\(\) => void signOut\(\)\}/);
  assert.match(shell, /data-testid="ocean-save-error"/);
});

check("non-project TopHeader still carries the page title and sign-out", () => {
  const shell = read("src/components/AppShell.tsx");
  const header = read("src/components/app-shell/TopHeader.tsx");
  assert.match(shell, /title: "Master To Do"/);
  assert.match(header, /page-title/);
  assert.match(header, /Sign out/);
  assert.match(header, /data-testid="app-top-header"/);
});

check("project header is quiet Page 03 identity plus an honest usage callout", () => {
  const header = read("src/components/knowledge-centre/ProjectWorkspaceHeader.tsx");
  const css = read("src/app/globals.css");
  assert.match(header, /project\.name/);
  assert.match(header, /project\.code/);
  assert.match(header, /formatRelativeUpdated/);
  assert.match(header, /analysesRemaining/);
  assert.match(header, /MeMark/);
  assert.match(header, /AI usage · \{usage\.remaining\} local analyses left/);
  assert.match(header, /Account &amp; billing/);
  assert.match(header, /href="\/account"/);
  assert.match(header, /not billing entitlement/);
  assert.match(
    header,
    /OPEN — USAGE METER: local analysis allowance is informational and is not durable billing usage\./,
  );
  assert.match(header, /DeleteProjectButton/);
  assert.doesNotMatch(header, /AI token use/);
  assert.doesNotMatch(header, /Usage & spending/);
  assert.doesNotMatch(header, /€|\$|token count|subscription limit/);
  assert.match(css, /\.ocean-workspace-header\s*\{[^}]*border-radius:\s*0/);
  assert.match(css, /\.ocean-workspace-header\s*\{[^}]*background:\s*transparent/);
  assert.doesNotMatch(
    css,
    /\.ocean-workspace-header\s*\{[^}]*border-radius:\s*14px/,
  );
  assert.match(css, /\.ocean-workspace-usage\s*\{[^}]*width:\s*254px/);
  assert.match(css, /\.ocean-workspace-usage\s*\{[^}]*height:\s*52px/);
  assert.match(css, /\.ocean-workspace-usage\s*\{[^}]*background:\s*#111319/);
});

check("desktop geometry keeps the 220px sidebar and full-bleed tabs", () => {
  const css = read("src/app/globals.css");
  const mode = read("src/components/knowledge-centre/ProjectModeSelector.tsx");
  assert.match(css, /\.app-sidebar\.ocean-sidebar\s*\{[^}]*width:\s*220px/);
  assert.match(css, /\.ocean-mode-selector[\s\S]*height:\s*54px/);
  assert.match(mode, /Home/);
  assert.match(mode, /Knowledge Centre/);
  assert.match(mode, /Project Scan/);
  assert.match(
    css,
    /@media \(min-width:\s*900px\)\s*\{[^}]*\.app-shell\.has-project-workspace \.app-content\s*\{[^}]*padding-left:\s*32px/,
  );
  assert.match(css, /height:\s*106px/);
  assert.match(css, /top:\s*34px/);
  assert.match(css, /top:\s*72px/);
  assert.match(css, /top:\s*24px/);
  assert.match(css, /margin-left:\s*-32px/);
  assert.match(css, /width:\s*calc\(100% \+ 52px\)/);
});

check("narrow chrome is 160px and omits the desktop usage callout", () => {
  const css = read("src/app/globals.css");
  assert.match(css, /\.top-header\.is-project-mobile\s*\{[^}]*height:\s*48px/);
  assert.match(css, /height:\s*64px/);
  assert.match(
    css,
    /@media \(max-width:\s*899px\)\s*\{[\s\S]*\.ocean-workspace-usage\s*\{[^}]*display:\s*none/,
  );
  assert.match(css, /\.ocean-mode-selector\s*\{[^}]*height:\s*48px/);
});

check("desktop Capture hides only the duplicate meter", () => {
  const capture = read("src/components/capture/CaptureWorkspace.tsx");
  const css = read("src/components/capture/capture-composer.css");
  assert.match(capture, /analysesRemaining/);
  assert.match(capture, /usage\.remaining <= 0/);
  assert.match(capture, /\{usage\.remaining\} analyses remaining/);
  assert.match(
    css,
    /@media \(min-width:\s*900px\)\s*\{[^}]*\.ocean-capture-mode \.p09-capture-usage[^}]*display:\s*none/,
  );
});

check("ProjectModeSelector and the sidebar stay the accepted shell", () => {
  const workspace = read("src/components/knowledge-centre/OceanProjectWorkspace.tsx");
  assert.match(workspace, /ProjectWorkspaceHeader/);
  assert.match(workspace, /ProjectModeSelector/);
  assert.doesNotMatch(workspace, /ProjectIntelligenceStrip/);
  const sidebar = read("src/components/app-shell/Sidebar.tsx");
  assert.match(sidebar, /\+ New project/);
  assert.doesNotMatch(sidebar, /Master To Do/);
  assert.doesNotMatch(sidebar, /href="\/settings"/);
});

console.log("\nproject top chrome checks passed");
