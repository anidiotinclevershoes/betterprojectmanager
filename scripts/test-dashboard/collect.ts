import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  aggregateModelGroup,
  corpusVersionFromReport,
  scorerVersionFromReport,
  extractFailures,
  groupKey,
  type LooseCaseResult,
  type LooseHarnessReport,
} from "./aggregate";
import type { GithubRunContext } from "./context";
import {
  TEST_DASHBOARD_SCHEMA_VERSION,
  WORLD_IDS,
  emptyWorlds,
  type CollectedEvidence,
  type ModelRow,
  type RunType,
  type SuiteResult,
  type WorldId,
  type WorldSuite,
} from "./schema";

export const MARKER_NPM_TEST = "npm-test.outcome";
export const MARKER_PLAYWRIGHT = "playwright.outcome";
export const MARKER_STACKED = "stacked-capture.outcome";
export const MARKER_TYPECHECK = "typecheck.outcome";

const HARNESS_FILES = [
  "capture-v2-eval.json",
  "eval-capture-v2.json",
  "harness-report.json",
  "capture-v2-eval-scorer-v2.json",
  "capture-v2-eval-rescore-v2.json",
];

type StackedWorldJson = {
  storyId?: string;
  world?: string;
  review?: string;
  writeCount?: number;
  needsYouCount?: number;
  steps?: { lumeFailures?: number; writeCount?: number; needsYouCount?: number }[];
};

export function readOutcomeFile(dir: string, name: string): SuiteResult {
  const path = join(dir, name);
  if (!existsSync(path)) return "unknown";
  const raw = readFileSync(path, "utf8").trim().toLowerCase();
  if (raw === "pass" || raw === "fail" || raw === "skip" || raw === "warn") {
    return raw;
  }
  return "unknown";
}

export function writeOutcomeFile(dir: string, name: string, outcome: SuiteResult): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), `${outcome}\n`, "utf8");
}

function readStackedWorld(dir: string, world: WorldId): WorldSuite {
  const path = join(dir, `stacked-${world}.json`);
  if (!existsSync(path)) {
    return {
      result: "unknown",
      lumeFailures: null,
      lumeCatches: null,
      modelFailures: null,
    };
  }
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as StackedWorldJson;
    const lumeFailures = (parsed.steps ?? []).reduce(
      (sum, step) => sum + (step.lumeFailures ?? 0),
      0,
    );
    const writeCount =
      parsed.writeCount ??
      (parsed.steps ?? []).reduce((sum, step) => sum + (step.writeCount ?? 0), 0);
    const needsYouCount =
      parsed.needsYouCount ??
      (parsed.steps ?? []).reduce((sum, step) => sum + (step.needsYouCount ?? 0), 0);
    const result: SuiteResult = lumeFailures > 0 ? "fail" : "pass";
    return {
      result,
      lumeFailures,
      lumeCatches: null,
      modelFailures: null,
      writeCount,
      needsYouCount,
    };
  } catch {
    return {
      result: "unknown",
      lumeFailures: null,
      lumeCatches: null,
      modelFailures: null,
    };
  }
}

function stackedOverall(worlds: Record<WorldId, WorldSuite>, marker: SuiteResult): SuiteResult {
  if (marker !== "unknown") return marker;
  const results = WORLD_IDS.map((id) => worlds[id].result);
  if (results.every((r) => r === "unknown")) return "unknown";
  if (results.some((r) => r === "fail")) return "fail";
  if (results.every((r) => r === "pass" || r === "skip" || r === "unknown")) {
    if (results.some((r) => r === "unknown")) return "unknown";
    return "pass";
  }
  return "unknown";
}

export function findHarnessReports(dir: string): LooseHarnessReport[] {
  const reports: LooseHarnessReport[] = [];
  for (const name of HARNESS_FILES) {
    const path = join(dir, name);
    if (!existsSync(path)) continue;
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as LooseHarnessReport;
      if (parsed && Array.isArray(parsed.results)) reports.push(parsed);
    } catch {
      // ignore malformed files
    }
  }
  return reports;
}

function overallFromParts(parts: SuiteResult[]): SuiteResult {
  if (parts.every((p) => p === "unknown")) return "unknown";
  if (parts.some((p) => p === "fail")) return "fail";
  if (parts.some((p) => p === "warn") && parts.every((p) => p !== "fail")) return "warn";
  if (parts.every((p) => p === "pass" || p === "skip")) return "pass";
  if (parts.every((p) => p === "pass" || p === "skip" || p === "unknown")) {
    return parts.some((p) => p === "unknown") ? "unknown" : "pass";
  }
  return "unknown";
}

function modelResult(lumeFailures: number, lumeCatches: number, callErrors: number): SuiteResult {
  if (lumeFailures > 0 || callErrors > 0) return "fail";
  if (lumeCatches > 0) return "warn";
  return "pass";
}

export function modelRowsFromReport(
  report: LooseHarnessReport,
  context: GithubRunContext,
): ModelRow[] {
  const groups = new Map<string, LooseCaseResult[]>();
  for (const row of report.results ?? []) {
    const key = groupKey(row);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  const corpusVersion = corpusVersionFromReport(report);
  const scorerVersion = scorerVersionFromReport(report);
  const rows: ModelRow[] = [];
  for (const group of groups.values()) {
    const agg = aggregateModelGroup(group);
    rows.push({
      runId: context.runId,
      timestamp: context.timestamp,
      prNumber: context.prNumber,
      branch: context.branch,
      sha: context.sha,
      provider: agg.provider,
      model: agg.model,
      corpusVersion,
      scorerVersion,
      caseCount: agg.caseCount,
      recall: agg.recall,
      falsePositives: agg.falsePositives,
      domainAccuracy: agg.domainAccuracy,
      existingVsNewAccuracy: agg.existingVsNewAccuracy,
      targetIdAccuracy: agg.targetIdAccuracy,
      ambiguityHandling: agg.ambiguityHandling,
      noChangeHandling: agg.noChangeHandling,
      commentaryHandling: agg.commentaryHandling,
      stability: agg.stability,
      modelFailures: agg.modelFailures,
      lumeCatches: agg.lumeCatches,
      lumeFailures: agg.lumeFailures,
      tokens: agg.tokens,
      latencyMs: agg.latencyMs,
      costUsd: agg.costUsd,
      result: modelResult(agg.lumeFailures ?? 0, agg.lumeCatches ?? 0, agg.callErrors),
      workflowUrl: context.workflowUrl,
      worlds: agg.worlds,
    });
  }
  return rows;
}

export function collectEvidence(opts: {
  resultsDir: string;
  context: GithubRunContext;
  runType?: RunType;
}): CollectedEvidence {
  const { resultsDir, context } = opts;
  const worlds = emptyWorlds();
  for (const world of WORLD_IDS) {
    worlds[world] = readStackedWorld(resultsDir, world);
  }
  const npmTest = readOutcomeFile(resultsDir, MARKER_NPM_TEST);
  const playwright = readOutcomeFile(resultsDir, MARKER_PLAYWRIGHT);
  const typecheck = readOutcomeFile(resultsDir, MARKER_TYPECHECK);
  const stackedMarker = readOutcomeFile(resultsDir, MARKER_STACKED);
  const stacked = stackedOverall(worlds, stackedMarker);

  const reports = findHarnessReports(resultsDir);
  const modelRows = reports.flatMap((report) => modelRowsFromReport(report, context));
  const importantFailures = reports.flatMap((report) =>
    extractFailures(report.results ?? [], {
      runId: context.runId,
      sha: context.sha,
      workflowUrl: context.workflowUrl,
    }),
  );

  const runType: RunType =
    opts.runType ??
    (modelRows.length > 0 && (npmTest !== "unknown" || playwright !== "unknown" || stacked !== "unknown")
      ? "mixed"
      : modelRows.length > 0
        ? "model_benchmark"
        : "regression");

  return {
    schemaVersion: TEST_DASHBOARD_SCHEMA_VERSION,
    timestamp: context.timestamp,
    runId: context.runId,
    runType,
    prNumber: context.prNumber,
    branch: context.branch,
    sha: context.sha,
    workflowUrl: context.workflowUrl,
    typecheck,
    npmTest,
    playwright,
    stacked,
    overall: overallFromParts([npmTest, playwright, stacked]),
    worlds,
    modelRows,
    importantFailures,
  };
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
