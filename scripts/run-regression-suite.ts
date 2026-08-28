/**
 * Deterministic Lume regression suite (non-AI).
 * Aggregates trust-critical verify scripts. Skips live Supabase / OpenAI evals.
 *
 * Run: npm run test
 *  or: npm run verify:regression
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const ROOT = process.cwd();

/** Fast, credential-free, deterministic product regression. */
const SUITE: Array<{ name: string; script: string }> = [
  { name: "knowledge-reconcile", script: "scripts/verify-knowledge-reconcile.ts" },
  { name: "project-truth-safety", script: "scripts/verify-project-truth-safety.ts" },
  { name: "risk-lifecycle", script: "scripts/verify-risk-lifecycle.ts" },
  { name: "people-entities", script: "scripts/verify-people-entities.ts" },
  { name: "ask-context-authority", script: "scripts/verify-ask-context-authority.ts" },
  { name: "ocean-knowledge-centre", script: "scripts/verify-ocean-knowledge-centre.ts" },
  { name: "search-authority", script: "scripts/verify-search-authority.ts" },
  { name: "ocean-capture", script: "scripts/verify-ocean-capture.ts" },
  { name: "ocean-item-detail", script: "scripts/verify-ocean-item-detail.ts" },
  { name: "people-context-ui", script: "scripts/verify-people-context-ui.ts" },
  { name: "capture-trust-boundary", script: "scripts/verify-capture-trust-boundary.ts" },
  { name: "phase3b-capture-boundary", script: "scripts/verify-phase3b-capture-boundary.ts" },
  { name: "phase0-capture-baseline", script: "scripts/verify-phase0-capture-baseline.ts" },
  { name: "capture-v2", script: "scripts/verify-capture-v2.ts" },
  { name: "new-project-v2", script: "scripts/verify-new-project-v2.ts" },
  { name: "desert-theme", script: "scripts/verify-desert-theme.ts" },
  { name: "phase6-worlds", script: "scripts/verify-phase6-worlds.ts" },
  { name: "canonical-truth", script: "scripts/verify-canonical-truth.ts" },
  { name: "tell-me", script: "scripts/verify-tell-me.ts" },
  { name: "capture-context", script: "scripts/verify-capture-context.ts" },
  { name: "capture-review", script: "scripts/verify-capture-review.ts" },
  { name: "capture-workspace", script: "scripts/verify-capture-workspace-refinement.ts" },
  { name: "golden-test", script: "scripts/verify-golden-test.ts" },
  { name: "findings", script: "scripts/verify-findings.ts" },
  { name: "capture-reliability", script: "scripts/verify-capture-reliability.ts" },
  { name: "context-integrity", script: "scripts/verify-context-integrity.ts" },
  { name: "trust-intelligence", script: "scripts/verify-trust-intelligence.ts" },
  { name: "phase3a-integrity", script: "scripts/verify-phase3a-integrity.ts" },
  { name: "project-delete", script: "scripts/verify-project-delete.ts" },
  { name: "new-project", script: "scripts/verify-new-project-onboarding.ts" },
  { name: "seed-reset", script: "scripts/verify-seed-reset.ts" },
  { name: "rls-policies", script: "scripts/verify-rls-policies.ts" },
  { name: "production-config", script: "scripts/verify-production-config.ts" },
  { name: "phase2-auth", script: "scripts/verify-phase2-auth.ts" },
  { name: "hydrate-session", script: "scripts/verify-hydrate-session.ts" },
  { name: "model-tidy", script: "scripts/verify-model-tidy.ts" },
];

let failed = 0;
const results: Array<{ name: string; ok: boolean }> = [];

console.log("Lume deterministic regression suite");
console.log("(excludes live Supabase + OpenAI evals)\n");

for (const item of SUITE) {
  const path = join(ROOT, item.script);
  process.stdout.write(`→ ${item.name} … `);
  const run = spawnSync("npx", ["--yes", "tsx", path], {
    cwd: ROOT,
    env: {
      ...process.env,
      OPENAI_API_KEY: "",
    },
    encoding: "utf8",
  });

  if (run.status === 0) {
    console.log("OK");
    results.push({ name: item.name, ok: true });
  } else {
    console.log("FAIL");
    failed += 1;
    results.push({ name: item.name, ok: false });
    const out = `${run.stdout ?? ""}\n${run.stderr ?? ""}`.trim();
    if (out) console.log(out.split("\n").slice(-25).join("\n"));
  }
}

console.log("\n── Summary ──");
for (const r of results) {
  console.log(`${r.ok ? "✓" : "✗"} ${r.name}`);
}
console.log(
  `\n${results.length - failed}/${results.length} suites passed` +
    (failed ? ` (${failed} failed)` : ""),
);

process.exit(failed ? 1 : 0);
