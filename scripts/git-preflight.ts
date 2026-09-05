/**
 * Lume branch preflight. Run before every substantial implementation slice.
 *
 *   npm run git:preflight
 *
 * This script reports topology. It cannot prove that a rebase would preserve
 * semantics. MATERIALLY STALE normal work exits 1.
 *
 * Intentional non-mergeable experiments: LUME_EXPERIMENT=1
 * or a branch name starting with experiment/
 */
import { execSync } from "node:child_process";
import { classifyBranch } from "./lib/git-preflight";

function git(args: string, allowFail = false): string {
  try {
    return execSync(`git ${args}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", allowFail ? "pipe" : "pipe"],
    }).trim();
  } catch (err) {
    if (allowFail) return "";
    throw err;
  }
}

function main() {
  const skipFetch = process.env.LUME_PREFLIGHT_SKIP_FETCH === "1";
  if (!skipFetch) {
    try {
      execSync("git fetch origin main", { stdio: "pipe" });
    } catch {
      console.warn("warning: could not fetch origin/main; using local refs");
    }
  }

  const branch = git("rev-parse --abbrev-ref HEAD");
  const head = git("rev-parse HEAD");
  const mainRef = process.env.LUME_PREFLIGHT_MAIN ?? "origin/main";
  const mainSha = git(`rev-parse ${mainRef}`);
  let mergeBase = git(`merge-base HEAD ${mainRef}`, true);
  if (!mergeBase) {
    // Shallow CI checkouts often have HEAD and origin/main as depth-1
    // tips with no shared object until history is deepened.
    try {
      execSync("git fetch --deepen=200 origin", { stdio: "pipe" });
    } catch {
      try {
        execSync("git fetch --unshallow", { stdio: "pipe" });
      } catch {
        /* keep going — report topology we can still prove */
      }
    }
    mergeBase = git(`merge-base HEAD ${mainRef}`, true);
  }
  if (!mergeBase) {
    console.warn(
      `warning: could not compute merge-base with ${mainRef}; clone is too shallow`,
    );
    mergeBase = head;
  }
  const ahead = Number(git(`rev-list --count ${mainRef}..HEAD`) || "0");
  const behind = Number(git(`rev-list --count HEAD..${mainRef}`) || "0");
  let containsMain = false;
  try {
    execSync(`git merge-base --is-ancestor ${mainRef} HEAD`, { stdio: "pipe" });
    containsMain = true;
  } catch {
    containsMain = false;
  }

  const dirty = git("status --porcelain");
  const behindFiles = git(`diff --name-only ${mergeBase} ${mainRef}`)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const experiment =
    process.env.LUME_EXPERIMENT === "1" ||
    branch.startsWith("experiment/");

  const result = classifyBranch({
    experiment,
    containsCurrentMain: containsMain,
    behindCount: behind,
    filesChangedOnMainSinceMergeBase: behindFiles,
  });

  const treeClean = dirty.length === 0;

  console.log(`Working branch: ${branch}`);
  console.log(`Branch HEAD: ${head}`);
  console.log(`origin/main HEAD: ${mainSha}`);
  console.log(`Merge-base: ${mergeBase}`);
  console.log(`Ahead: ${ahead}`);
  console.log(`Behind: ${behind}`);
  console.log(`Contains current main?: ${containsMain ? "YES" : "NO"}`);
  console.log(`Working tree clean?: ${treeClean ? "YES" : "NO"}`);
  console.log(`PR base: main`);
  console.log(`Dependencies: (declare in the PR)`);
  console.log(`Shared/global files expected: (declare in the PR)`);
  console.log(`Branch classification: ${result.classification}`);

  if (result.materialFilesOnMain.length > 0) {
    console.log("");
    console.log("Material files changed on main since merge-base:");
    for (const file of result.materialFilesOnMain.slice(0, 40)) {
      console.log(`  - ${file}`);
    }
    if (result.materialFilesOnMain.length > 40) {
      console.log(`  … +${result.materialFilesOnMain.length - 40} more`);
    }
    console.log("");
    console.log(
      "Commit counts do not prove semantic safety. Review those files before continuing.",
    );
  }

  if (result.classification === "EXPERIMENT") {
    console.log("");
    console.log(
      "EXPERIMENT: non-mergeable / reference-only unless ported from a fresh main branch.",
    );
  }

  if (result.failNormalWork) {
    console.log("");
    console.log("MATERIALLY STALE = STOP. Do not start normal product implementation.");
    console.log("Recreate from current main, or set LUME_EXPERIMENT=1 for a throwaway experiment.");
    process.exit(1);
  }

}

main();
