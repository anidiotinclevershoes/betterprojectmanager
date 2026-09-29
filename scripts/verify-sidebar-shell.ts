/**
 * Page 09 / Page 07 sidebar (`601:836`) and the project-gutter compensation.
 *
 * Run: npm run verify:sidebar-shell
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

function check(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

check("desktop sidebar is 220px", () => {
  const css = read("src/app/globals.css");
  assert.match(css, /\.app-sidebar\.ocean-sidebar\s*\{[^}]*width:\s*220px/);
  assert.doesNotMatch(css, /\.app-sidebar\.is-collapsed/);
});

check("brand uses the lightbulb and plain Lume", () => {
  const sidebar = read("src/components/app-shell/Sidebar.tsx");
  assert.match(sidebar, /LumeLogo/);
  assert.match(sidebar, /ocean-brand-name">Lume</);
  assert.doesNotMatch(sidebar, /ocean-wordmark-me/);
  assert.doesNotMatch(sidebar, /text-decoration:\s*underline/);
  assert.doesNotMatch(sidebar, />me</);
});

check("New project stays on /projects/new with the purple action", () => {
  const sidebar = read("src/components/app-shell/Sidebar.tsx");
  const css = read("src/app/globals.css");
  assert.match(sidebar, /href="\/projects\/new"/);
  assert.match(sidebar, /\+ New project/);
  assert.match(
    css,
    /\.ocean-sidebar \.ocean-new-project\s*\{[^}]*background:\s*#7c5cff/,
  );
  assert.doesNotMatch(css, /\.ocean-new-project\s*\{[^}]*var\(--success\)/);
});

check("projects and Account stay; Settings is not mounted", () => {
  const sidebar = read("src/components/app-shell/Sidebar.tsx");
  assert.match(sidebar, /state\.projects\.map/);
  assert.match(sidebar, /\/projects\/\$\{project\.id\}/);
  assert.match(sidebar, /activeProjectId === project\.id/);
  assert.match(sidebar, /href="\/account"/);
  assert.match(sidebar, />Account</);
  assert.doesNotMatch(sidebar, /href="\/settings"|Settings</);
  assert.match(sidebar, /BLOCKED — PRODUCT SURFACE: signed sidebar requires Settings/);
  assert.match(sidebar, /ocean-sidebar-bottom/);
  assert.match(read("src/app/globals.css"), /margin-top:\s*auto/);
});

check("superseded primary links are unmounted and their routes remain", () => {
  const sidebar = read("src/components/app-shell/Sidebar.tsx");
  for (const gone of [
    "Master To Do",
    'href="/todos"',
    'href="/history"',
    'href="/captures"',
    "Help & support",
    "Golden Test",
    "AI Cockpit",
    "Reset demo",
    "EvalsNavLink",
    "Collapse",
    "mc-sidebar-collapsed-v1",
  ]) {
    assert.doesNotMatch(sidebar, new RegExp(gone.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  const shell = read("src/components/AppShell.tsx");
  assert.doesNotMatch(shell, /mc-sidebar-collapsed-v1|onToggleCollapse|sidebar-collapsed/);
  for (const route of [
    "src/app/todos/page.tsx",
    "src/app/history/page.tsx",
    "src/app/captures/page.tsx",
    "src/app/account/page.tsx",
    "src/app/dev/golden-test/page.tsx",
    "src/app/dev/ai-cockpit/page.tsx",
    "src/components/evals/EvalsNavLink.tsx",
    "src/components/dev/ResetDemoDataButton.tsx",
    "src/lib/support.ts",
  ]) {
    assert.equal(existsSync(join(root, route)), true, route);
  }
});

check("mobile hamburger and save error stay", () => {
  const header = read("src/components/app-shell/TopHeader.tsx");
  const shell = read("src/components/AppShell.tsx");
  assert.match(header, /Open navigation/);
  assert.match(header, /onOpenMobileNav/);
  assert.match(shell, /mobileOpen/);
  assert.match(shell, /setMobileOpen\(false\)/);
  assert.match(read("src/components/app-shell/Sidebar.tsx"), /sidebar-backdrop/);
  assert.match(shell, /data-testid="ocean-save-error"/);
});

check("project content gutter compensates the narrower sidebar", () => {
  const css = read("src/app/globals.css");
  assert.match(css, /\.app-content\s*\{[^}]*padding:\s*16px 20px 32px/);
  assert.match(
    css,
    /@media \(min-width:\s*900px\)\s*\{[^}]*\.app-shell\.has-project-workspace \.app-content\s*\{[^}]*padding-left:\s*32px/,
  );
  const mode = read("src/components/knowledge-centre/ProjectModeSelector.tsx");
  assert.match(mode, /Home/);
  assert.match(mode, /Knowledge Centre/);
  assert.match(mode, /Project Scan/);
});

console.log("\nsidebar shell checks passed");
