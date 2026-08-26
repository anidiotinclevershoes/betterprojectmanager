/**
 * Test-only evidence records for the Lume Test Dashboard.
 * Consumes Hulk / stacked / Playwright outputs. Does not score Capture
 * and is not authority over test semantics.
 */

export const TEST_DASHBOARD_SCHEMA_VERSION = "1" as const;
export const DASHBOARD_ISSUE_TITLE =
  "Lume Test Dashboard — Regression & Model Benchmarks";
export const STATE_MARKER = "lume-test-dashboard-state:v1";

export const MAX_REGRESSION_ROWS = 20;
export const MAX_MODEL_ROWS = 40;
export const MAX_FAILURE_ROWS = 15;

/** pass/good, fail, skip, unknown, or warn (Lume caught a model mistake). */
export type SuiteResult = "pass" | "fail" | "skip" | "unknown" | "warn";
export type RunType = "regression" | "model_benchmark" | "mixed";
export type WorldId = "candyland" | "toyworld" | "gamingstudio5000";
export type FailureClass = "MODEL FAILURE" | "LUME CATCH" | "LUME FAILURE";

export const WORLD_LABEL: Record<WorldId, string> = {
  candyland: "Candyland",
  toyworld: "Toyworld",
  gamingstudio5000: "GamingStudio5000",
};

export const WORLD_IDS: WorldId[] = [
  "candyland",
  "toyworld",
  "gamingstudio5000",
];

export type WorldSuite = {
  result: SuiteResult;
  lumeFailures: number | null;
  lumeCatches: number | null;
  modelFailures: number | null;
  writeCount?: number | null;
  needsYouCount?: number | null;
  caseCount?: number | null;
  recall?: number | null;
};

export type TokenUsage = {
  input: number | null;
  output: number | null;
  total: number | null;
};

export type ImportantFailure = {
  caseId: string;
  world: string | null;
  expected: string | null;
  actual: string | null;
  classification: FailureClass;
  runId: string;
  sha: string;
  model: string | null;
  workflowUrl: string | null;
};

export type RegressionRow = {
  runId: string;
  timestamp: string;
  prNumber: number | null;
  branch: string | null;
  sha: string;
  typecheck: SuiteResult;
  npmTest: SuiteResult;
  playwright: SuiteResult;
  stacked: SuiteResult;
  worlds: Record<WorldId, WorldSuite>;
  overall: SuiteResult;
  workflowUrl: string | null;
};

export type ModelRow = {
  runId: string;
  timestamp: string;
  prNumber: number | null;
  branch: string | null;
  sha: string;
  provider: string;
  model: string;
  corpusVersion: string | null;
  caseCount: number | null;
  recall: number | null;
  falsePositives: number | null;
  domainAccuracy: number | null;
  existingVsNewAccuracy: number | null;
  targetIdAccuracy: number | null;
  ambiguityHandling: number | null;
  noChangeHandling: number | null;
  commentaryHandling: number | null;
  /** Not emitted by the Hulk harness today. Always null. */
  stability: number | null;
  modelFailures: number | null;
  lumeCatches: number | null;
  lumeFailures: number | null;
  tokens: TokenUsage;
  latencyMs: number | null;
  costUsd: number | null;
  result: SuiteResult;
  workflowUrl: string | null;
  worlds: Partial<Record<WorldId, WorldSuite>>;
};

export type DashboardState = {
  schemaVersion: typeof TEST_DASHBOARD_SCHEMA_VERSION;
  updatedAt: string;
  regressionRows: RegressionRow[];
  modelRows: ModelRow[];
  importantFailures: ImportantFailure[];
};

export type CollectedEvidence = {
  schemaVersion: typeof TEST_DASHBOARD_SCHEMA_VERSION;
  timestamp: string;
  runId: string;
  runType: RunType;
  prNumber: number | null;
  branch: string | null;
  sha: string;
  workflowUrl: string | null;
  typecheck: SuiteResult;
  npmTest: SuiteResult;
  playwright: SuiteResult;
  stacked: SuiteResult;
  overall: SuiteResult;
  worlds: Record<WorldId, WorldSuite>;
  modelRows: ModelRow[];
  importantFailures: ImportantFailure[];
};

export function emptyDashboardState(now = new Date().toISOString()): DashboardState {
  return {
    schemaVersion: TEST_DASHBOARD_SCHEMA_VERSION,
    updatedAt: now,
    regressionRows: [],
    modelRows: [],
    importantFailures: [],
  };
}

export function emptyWorldSuite(): WorldSuite {
  return {
    result: "unknown",
    lumeFailures: null,
    lumeCatches: null,
    modelFailures: null,
  };
}

export function emptyWorlds(): Record<WorldId, WorldSuite> {
  return {
    candyland: emptyWorldSuite(),
    toyworld: emptyWorldSuite(),
    gamingstudio5000: emptyWorldSuite(),
  };
}
