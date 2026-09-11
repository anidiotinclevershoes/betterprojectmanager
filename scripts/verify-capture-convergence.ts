/**
 * Capture convergence gate — deterministic diagnostic.
 *
 * Observe-only. Does not retune Capture. Failures are the map.
 *
 *   npm run verify:capture-convergence
 *   npx tsx scripts/verify-capture-convergence.ts --id cross-andris-olga-uat
 *
 * Exit 0 even when cases fail (baseline map). Use --fail-on-error to exit 1.
 * Held-out cases are labelled. Do not tune production against them until evaluation.
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { architectureJudgement, clusterFailures } from "./capture-convergence/cluster";
import { evaluateCase, executeCase, type Executed } from "./capture-convergence/evaluate";
import {
  allCases,
  catalogueCounts,
  perturbationCount,
} from "./capture-convergence/index";
import type {
  CaseResult,
  ConvergenceReport,
  FamilyId,
  FamilyTotals,
} from "./capture-convergence/types";
import { FAMILIES } from "./capture-convergence/types";

const SOURCE_SHA = "90dfb6cb1f67939358ba3fa3c878f2749d3e4b5b";
const ROOT = process.cwd();

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0) return process.argv[idx + 1];
  return undefined;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function gitSha(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function emptyFamilies(): FamilyTotals {
  return Object.fromEntries(
    FAMILIES.map((id) => [id, { pass: 0, fail: 0, total: 0 }]),
  ) as FamilyTotals;
}

function formatHuman(report: ConvergenceReport): string {
  const lines: string[] = [];
  lines.push("CAPTURE CONVERGENCE GATE — BASELINE MAP");
  lines.push("Observe-only. Do not treat this as a green/red product gate.");
  lines.push(`Source SHA:     ${report.sourceSha}`);
  lines.push(`Experiment SHA: ${report.experimentSha}`);
  lines.push(`Generated at:   ${report.generatedAt}`);
  lines.push(`Runtime:        ${report.elapsedMs} ms`);
  lines.push("");
  lines.push(`TOTAL CASES  ${report.total}`);
  lines.push(`PASS         ${report.pass}`);
  lines.push(`FAIL         ${report.fail}`);
  lines.push("");
  lines.push("By family:");
  for (const id of FAMILIES) {
    const row = report.families[id];
    lines.push(
      `  ${id.padEnd(34)} ${row.pass}/${row.total} pass   ${row.fail} fail`,
    );
  }
  lines.push("");
  lines.push(`Historical catalogue behaviours: ${report.historicalScenarioCount} (capture ${report.historicalCaptureBehaviours}, new-project ${report.historicalNewProjectBehaviours})`);
  lines.push(`Perturbation/metamorphic cases:  ${report.perturbationCaseCount}`);
  lines.push(`Held-out scenarios:              ${report.heldOutCount}`);
  lines.push(`UNIQUE failure families:         ${report.uniqueFailureFamilies}`);
  lines.push(`Architecture judgement:          ${report.architectureJudgement}`);
  lines.push(report.architectureNote);
  lines.push("");
  lines.push("Failure clusters (same observed transition; not proven one root cause):");
  for (const cluster of report.clusters) {
    lines.push(
      `  [${cluster.id}] ${cluster.label}  n=${cluster.caseIds.length}  class=${cluster.classification}  stage=${cluster.earliestStage}`,
    );
    const shown = cluster.caseIds.slice(0, 8);
    lines.push(`      ${shown.join(", ")}${cluster.caseIds.length > 8 ? ", …" : ""}`);
  }
  if (!report.clusters.length) lines.push("  (none)");
  lines.push("");
  lines.push("Combined-only breaks:");
  lines.push(
    report.combinedOnlyBreaks.length
      ? report.combinedOnlyBreaks.map((id) => `  ${id}`).join("\n")
      : "  (none recorded)",
  );
  lines.push("Order changes semantics:");
  lines.push(
    report.orderChangesSemantics.length
      ? report.orderChangesSemantics.map((id) => `  ${id}`).join("\n")
      : "  (none)",
  );
  lines.push("Unrelated context changes semantics:");
  lines.push(
    report.unrelatedContextChanges.length
      ? report.unrelatedContextChanges.map((id) => `  ${id}`).join("\n")
      : "  (none)",
  );
  lines.push("Information-loss cases:");
  lines.push(
    report.informationLossCases.length
      ? report.informationLossCases.map((id) => `  ${id}`).join("\n")
      : "  (none)",
  );
  lines.push("Product-model gaps (not coding bugs):");
  lines.push(
    report.productModelGapCases.length
      ? report.productModelGapCases.map((id) => `  ${id}`).join("\n")
      : "  (none)",
  );
  lines.push("");
  lines.push("Failures:");
  for (const row of report.failures) {
    lines.push(`--- ${row.id}  seed=${row.seed}  family=${row.family}`);
    lines.push(`    base: ${row.baseScenario}`);
    lines.push(`    perturbation: ${row.perturbation}`);
    lines.push(`    expected: ${row.expectedInvariant}`);
    lines.push(`    actual: ${row.actual}`);
    lines.push(`    earliest stage: ${row.earliestStage ?? "?"}`);
    lines.push(`    class: ${row.classification ?? "?"}`);
    lines.push(
      `    reproduce: npx tsx scripts/verify-capture-convergence.ts --id ${row.id}`,
    );
  }
  if (!report.failures.length) lines.push("  (none)");
  lines.push("");
  lines.push("Reproduce all failures:");
  for (const cmd of report.reproduce) lines.push(`  ${cmd}`);
  lines.push("");
  lines.push("HELD-OUT SET is process-isolated. Do not tune against it until evaluation.");
  return lines.join("\n");
}

function main() {
  const started = Date.now();
  const filtered = Boolean(
    arg("id") ||
      arg("family") ||
      flag("smoke") ||
      flag("held-out-only") ||
      flag("no-held-out") ||
      flag("list"),
  );
  let cases = allCases();
  const idFilter = arg("id");
  const familyFilter = arg("family") as FamilyId | undefined;
  if (flag("list")) {
    for (const row of cases) {
      console.log(`${row.id}\t${row.family}\tseed=${row.seed}`);
    }
    console.log(`total ${cases.length}`);
    return;
  }
  if (flag("smoke")) {
    cases = cases.filter((row) => row.family === "historical_regression");
  }
  if (flag("held-out-only")) {
    cases = cases.filter((row) => row.heldOut);
  }
  if (flag("no-held-out")) {
    cases = cases.filter((row) => !row.heldOut);
  }
  if (familyFilter) {
    cases = cases.filter((row) => row.family === familyFilter);
  }
  if (idFilter) {
    const wanted = new Set(
      idFilter.split(",").map((s) => s.trim()).filter(Boolean),
    );
    const extra = new Set<string>();
    for (const row of allCases()) {
      if (wanted.has(row.id) && row.compareToId) extra.add(row.compareToId);
    }
    cases = allCases().filter((row) => wanted.has(row.id) || extra.has(row.id));
  }

  const executed = new Map<string, Executed>();
  const results: CaseResult[] = [];
  for (const testCase of cases) {
    let run: Executed;
    try {
      run = executeCase(testCase);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        id: testCase.id,
        family: testCase.family,
        seed: testCase.seed,
        baseScenario: testCase.baseScenario,
        perturbation: testCase.perturbation,
        expectedInvariant: testCase.expectedInvariant,
        ok: false,
        expected: testCase.expectedInvariant,
        actual: `harness error: ${message}`,
        earliestStage: "PARSE",
        classification: "UNKNOWN",
        productModelGap: Boolean(testCase.expect?.productModelGap),
        heldOut: Boolean(testCase.heldOut),
        snapshot: { atoms: [], rejectedCodes: [], parseMalformed: true },
      });
      continue;
    }
    executed.set(testCase.id, run);
  }

  for (const testCase of cases) {
    const run = executed.get(testCase.id);
    if (!run) continue;
    results.push(evaluateCase(testCase, run, executed));
  }

  const families = emptyFamilies();
  for (const row of results) {
    families[row.family].total += 1;
    if (row.ok) families[row.family].pass += 1;
    else families[row.family].fail += 1;
  }
  const failures = results.filter((row) => !row.ok);
  const clusters = clusterFailures(failures);
  const judgement = architectureJudgement({
    clusters,
    contaminationFails: families.cross_observation_contamination.fail,
    orderFails: families.order_invariance.fail,
    irrelevantFails: families.irrelevant_context.fail,
    ambiguityFails: families.ambiguity_isolation.fail,
    compositionFails: families.composition.fail,
  });
  const counts = catalogueCounts();
  const byId = new Map(results.map((row) => [row.id, row]));
  const combinedOnlyBreaks = failures
    .filter((row) => {
      const src = cases.find((c) => c.id === row.id);
      if (!src?.compareToId) return false;
      const base = byId.get(src.compareToId);
      return Boolean(base?.ok);
    })
    .map((row) => row.id);

  const report: ConvergenceReport = {
    sourceSha: SOURCE_SHA,
    experimentSha: gitSha(),
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - started,
    total: results.length,
    pass: results.filter((row) => row.ok).length,
    fail: failures.length,
    families,
    clusters,
    failures: failures.map((row) => ({
      ...row,
      snapshot: {
        atoms: row.snapshot.atoms,
        rejectedCodes: row.snapshot.rejectedCodes,
        parseMalformed: row.snapshot.parseMalformed,
      },
    })),
    historicalScenarioCount: counts.historicalScenarioCount,
    historicalCaptureBehaviours: counts.historicalCaptureBehaviours,
    historicalNewProjectBehaviours: counts.historicalNewProjectBehaviours,
    perturbationCaseCount: perturbationCount(cases),
    heldOutCount: cases.filter((row) => row.heldOut).length,
    uniqueFailureFamilies: clusters.length,
    combinedOnlyBreaks,
    orderChangesSemantics: failures.filter((row) => row.family === "order_invariance").map((row) => row.id),
    unrelatedContextChanges: failures.filter((row) => row.family === "irrelevant_context").map((row) => row.id),
    informationLossCases: failures
      .filter(
        (row) =>
          row.family === "information_preservation" || row.classification === "INFORMATION LOSS",
      )
      .map((row) => row.id),
    productModelGapCases: results.filter((row) => row.productModelGap).map((row) => row.id),
    architectureJudgement: judgement.judgement,
    architectureNote: judgement.note,
    reproduce: failures.map(
      (row) => `npx tsx scripts/verify-capture-convergence.ts --id ${row.id}`,
    ),
  };

  const human = formatHuman(report);
  console.log(human);

  const outArg = arg("out");
  const slim = {
    ...report,
    failures: report.failures.map(({ snapshot: _s, ...rest }) => rest),
  };
  if (outArg) {
    writeFileSync(outArg, JSON.stringify(slim, null, 2));
    console.log(`\nWrote ${outArg}`);
  } else if (!filtered) {
    const jsonName = join(ROOT, "scripts/capture-convergence/baseline.json");
    const mdName = join(ROOT, "scripts/capture-convergence/baseline.md");
    writeFileSync(jsonName, JSON.stringify(slim, null, 2));
    writeFileSync(mdName, human);
    mkdirSync(join(ROOT, "test-results"), { recursive: true });
    writeFileSync(join(ROOT, "test-results/capture-convergence-baseline.json"), JSON.stringify(slim, null, 2));
    writeFileSync(join(ROOT, "test-results/capture-convergence-baseline.md"), human);
    console.log(`\nWrote ${jsonName}`);
    console.log(`Wrote ${mdName}`);
  }

  if (flag("fail-on-error") && report.fail > 0) {
    process.exit(1);
  }
}

main();
