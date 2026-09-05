/**
 * Deterministic classification proofs for npm run git:preflight.
 * Run: npx tsx scripts/verify-git-preflight.ts
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { classifyBranch, isMaterialPath } from "./lib/git-preflight";

function check(name: string, fn: () => void) {
  fn();
  console.log(`ok  ${name}`);
}

check("material paths include capture, persist, store, types, migrations", () => {
  assert.equal(isMaterialPath("src/lib/capture/apply/readiness.ts"), true);
  assert.equal(isMaterialPath("src/lib/store.tsx"), true);
  assert.equal(isMaterialPath("src/lib/types.ts"), true);
  assert.equal(isMaterialPath("supabase/migrations/20260831160000_x.sql"), true);
  assert.equal(isMaterialPath("docs/README.md"), false);
});

check("fresh main is CURRENT", () => {
  const r = classifyBranch({
    experiment: false,
    containsCurrentMain: true,
    behindCount: 0,
    filesChangedOnMainSinceMergeBase: [],
  });
  assert.equal(r.classification, "CURRENT");
  assert.equal(r.failNormalWork, false);
});

check("docs-only drift is MINOR DRIFT", () => {
  const r = classifyBranch({
    experiment: false,
    containsCurrentMain: false,
    behindCount: 3,
    filesChangedOnMainSinceMergeBase: ["docs/README.md", "README.md"],
  });
  assert.equal(r.classification, "MINOR DRIFT");
  assert.equal(r.failNormalWork, false);
});

check("capture/persist drift is MATERIALLY STALE and fails normal work", () => {
  const r = classifyBranch({
    experiment: false,
    containsCurrentMain: false,
    behindCount: 8,
    filesChangedOnMainSinceMergeBase: [
      "docs/README.md",
      "src/lib/capture/apply/readiness.ts",
    ],
  });
  assert.equal(r.classification, "MATERIALLY STALE");
  assert.equal(r.failNormalWork, true);
});

check("experiment hatch is EXPERIMENT and does not fail", () => {
  const r = classifyBranch({
    experiment: true,
    containsCurrentMain: false,
    behindCount: 90,
    filesChangedOnMainSinceMergeBase: ["src/lib/capture/apply/readiness.ts"],
  });
  assert.equal(r.classification, "EXPERIMENT");
  assert.equal(r.failNormalWork, false);
});

check("live repo: current HEAD vs origin/main is CURRENT", () => {
  const out = execSync("npx --yes tsx scripts/git-preflight.ts", {
    encoding: "utf8",
    env: { ...process.env, LUME_PREFLIGHT_SKIP_FETCH: "1" },
  });
  assert.match(out, /Branch classification: CURRENT/);
  assert.match(out, /Contains current main\?: YES/);
});

check("live desert tip vs origin/main is MATERIALLY STALE when the ref exists", () => {
  let hasDesert = true;
  try {
    execSync("git rev-parse --verify origin/cursor/capture-v2-desert-new-project-56c9", {
      stdio: "pipe",
    });
  } catch {
    hasDesert = false;
  }
  if (!hasDesert) {
    console.log("skip live desert ref (not fetched in this checkout)");
    return;
  }
  const mergeBase = execSync(
    "git merge-base origin/main origin/cursor/capture-v2-desert-new-project-56c9",
    { encoding: "utf8" },
  ).trim();
  const behindFiles = execSync(`git diff --name-only ${mergeBase} origin/main`, {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
  const r = classifyBranch({
    experiment: false,
    containsCurrentMain: false,
    behindCount: behindFiles.length,
    filesChangedOnMainSinceMergeBase: behindFiles,
  });
  assert.equal(r.classification, "MATERIALLY STALE");
  assert.equal(r.failNormalWork, true);
  assert.ok(r.materialFilesOnMain.some((f) => f.startsWith("src/lib/capture/")));
});

console.log("verify-git-preflight: all checks passed");
