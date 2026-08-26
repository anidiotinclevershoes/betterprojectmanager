import {
  DASHBOARD_ISSUE_TITLE,
  MAX_FAILURE_ROWS,
  MAX_MODEL_ROWS,
  MAX_REGRESSION_ROWS,
  STATE_MARKER,
  TEST_DASHBOARD_SCHEMA_VERSION,
  emptyDashboardState,
  type CollectedEvidence,
  type DashboardState,
  type ImportantFailure,
  type ModelRow,
  type RegressionRow,
  type SuiteResult,
} from "./schema";

const STATE_START = `<!-- ${STATE_MARKER}`;
const STATE_END = "-->";

export type ParsedDashboardState = {
  state: DashboardState;
  source: "empty" | "parsed";
};

export class InvalidDashboardStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDashboardStateError";
  }
}

export function parseDashboardState(markdown: string): ParsedDashboardState {
  const start = markdown.indexOf(STATE_START);
  if (start < 0) return { state: emptyDashboardState(), source: "empty" };
  const end = markdown.indexOf(STATE_END, start + STATE_START.length);
  if (end < 0) {
    throw new InvalidDashboardStateError(
      "Dashboard issue has a state marker without a closing comment. Refusing to overwrite history.",
    );
  }
  const raw = markdown.slice(start + STATE_START.length, end).trim();
  try {
    const parsed = JSON.parse(raw) as DashboardState;
    if (parsed.schemaVersion !== TEST_DASHBOARD_SCHEMA_VERSION) {
      throw new InvalidDashboardStateError(
        `Unsupported dashboard schemaVersion ${String(parsed.schemaVersion)}. Refusing to overwrite history.`,
      );
    }
    return {
      source: "parsed",
      state: {
        schemaVersion: TEST_DASHBOARD_SCHEMA_VERSION,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        regressionRows: Array.isArray(parsed.regressionRows) ? parsed.regressionRows : [],
        modelRows: Array.isArray(parsed.modelRows) ? parsed.modelRows : [],
        importantFailures: Array.isArray(parsed.importantFailures)
          ? parsed.importantFailures
          : [],
      },
    };
  } catch (err) {
    if (err instanceof InvalidDashboardStateError) throw err;
    throw new InvalidDashboardStateError(
      "Dashboard issue state JSON could not be parsed. Refusing to overwrite history.",
    );
  }
}

export function serializeDashboardState(state: DashboardState): string {
  return `${STATE_START}\n${JSON.stringify(state)}\n${STATE_END}\n`;
}

function newestFirst<T extends { timestamp: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

export function upsertRegression(
  state: DashboardState,
  row: RegressionRow,
): DashboardState {
  const without = state.regressionRows.filter((r) => r.runId !== row.runId);
  return {
    ...state,
    updatedAt: row.timestamp,
    regressionRows: newestFirst([row, ...without]).slice(0, MAX_REGRESSION_ROWS),
  };
}

function scorerKey(row: Pick<ModelRow, "scorerVersion">): string {
  return row.scorerVersion?.trim() || "capture-v2-eval-scorer-v1";
}

export function upsertModelRow(state: DashboardState, row: ModelRow): DashboardState {
  const without = state.modelRows.filter(
    (r) =>
      !(
        r.runId === row.runId &&
        r.provider === row.provider &&
        r.model === row.model &&
        scorerKey(r) === scorerKey(row)
      ),
  );
  return {
    ...state,
    updatedAt: row.timestamp,
    modelRows: newestFirst([row, ...without]).slice(0, MAX_MODEL_ROWS),
  };
}

export function appendFailures(
  state: DashboardState,
  rows: ImportantFailure[],
): DashboardState {
  const seen = new Set(
    state.importantFailures.map(
      (f) => `${f.runId}:${f.caseId}:${f.classification}`,
    ),
  );
  const next = [...rows.filter((f) => {
    const key = `${f.runId}:${f.caseId}:${f.classification}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }), ...state.importantFailures];
  return {
    ...state,
    importantFailures: next.slice(0, MAX_FAILURE_ROWS),
  };
}

function hasRegressionSignal(evidence: CollectedEvidence): boolean {
  const parts: SuiteResult[] = [
    evidence.typecheck,
    evidence.npmTest,
    evidence.playwright,
    evidence.stacked,
  ];
  return parts.some((part) => part !== "unknown");
}

export function applyEvidence(
  state: DashboardState,
  evidence: CollectedEvidence,
): DashboardState {
  let next: DashboardState = { ...state, updatedAt: evidence.timestamp };
  if (hasRegressionSignal(evidence)) {
    next = upsertRegression(next, {
      runId: evidence.runId,
      timestamp: evidence.timestamp,
      prNumber: evidence.prNumber,
      branch: evidence.branch,
      sha: evidence.sha,
      typecheck: evidence.typecheck,
      npmTest: evidence.npmTest,
      playwright: evidence.playwright,
      stacked: evidence.stacked,
      worlds: evidence.worlds,
      overall: evidence.overall,
      workflowUrl: evidence.workflowUrl,
    });
  }
  for (const row of evidence.modelRows) {
    next = upsertModelRow(next, row);
  }
  next = appendFailures(next, evidence.importantFailures);
  return next;
}

export { DASHBOARD_ISSUE_TITLE };
