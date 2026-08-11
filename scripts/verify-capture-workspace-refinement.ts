/**
 * Regression checks for Capture project-agnostic + To Do/Risk/Knowledge model.
 * Deterministic local pipeline only — no AI calls.
 */
import assert from "node:assert/strict";
import { runFindingsPipeline } from "../src/lib/capture/findings/pipeline";
import { buildCaptureObservations } from "../src/lib/capture/review/observations";
import { buildSuggestions } from "../src/lib/capture/suggestions";
import {
  buildReviewChangeViewModels,
  pendingReadyModels,
} from "../src/lib/capture/review/viewModel";
import type { CaptureResult } from "../src/lib/types";
import { DEFAULT_OVERVIEW_LAYOUT } from "../src/lib/workspace/layout";

const ATLAS = { id: "p-atlas", name: "Atlas Platform Modernisation", code: "ATLAS" };
const HORIZON = { id: "p-horizon", name: "Horizon Expansion", code: "HORIZON" };
const PROJECTS = [ATLAS, HORIZON];

function emptyContext(projectId?: string) {
  return {
    project: projectId
      ? {
          id: projectId,
          name: PROJECTS.find((p) => p.id === projectId)!.name,
          code: PROJECTS.find((p) => p.id === projectId)!.code,
        }
      : null,
    projectIndex: PROJECTS,
    deepContextProjectIds: projectId ? [projectId] : [],
    todos: [] as Array<{
      id: string;
      type: string;
      title: string;
      status?: string;
    }>,
    completedTodos: [],
    nudges: [],
    meetings: [],
    milestones: [],
    risks: [],
    stakeholders: [],
    knowledge: [],
    history: [],
    releases: [],
    diagnostics: {
      recordCount: 0,
      approxChars: 0,
      projectScoped: Boolean(projectId),
      builtAt: new Date().toISOString(),
      limitsReached: [],
    },
  };
}

function runLocal(args: {
  text: string;
  softHintProjectId?: string | null;
  todos?: Array<{ id: string; title: string; projectId?: string | null }>;
  contextProjectId?: string;
}) {
  const ctx = emptyContext(args.contextProjectId);
  if (args.todos?.length) {
    ctx.todos = args.todos.map((t) => ({
      id: t.id,
      type: "todo",
      title: t.title,
      status: "open",
    }));
  }
  return runFindingsPipeline({
    rawFindings: [],
    captureText: args.text,
    captureContext: ctx as never,
    allowLocalFallback: true,
    projects: PROJECTS,
    softHintProjectId: args.softHintProjectId,
    allOpenTodos: args.todos,
  });
}

function toResult(
  pipeline: ReturnType<typeof runFindingsPipeline>,
  text: string,
): CaptureResult {
  return {
    memory: {
      id: "mem",
      type: "conversation",
      title: "Test",
      content: text,
      tags: [],
      people: [],
      occurredAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      source: "capture",
    },
    insights: [],
    assumptions: [],
    recommendations: [],
    findings: pipeline.findings,
    proposedOperations: pipeline.operations,
    findingCoverage: pipeline.coverage,
  };
}

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

check("layout: Nudge retired; Risks visible", () => {
  const nudge = DEFAULT_OVERVIEW_LAYOUT.frames.find((f) => f.type === "nudge");
  const risks = DEFAULT_OVERVIEW_LAYOUT.frames.find((f) => f.type === "risks");
  assert.equal(nudge?.visible, false);
  assert.equal(risks?.visible, true);
});

check("A — explicit selected project create/resolve risk", () => {
  const p = runLocal({
    text: "ATLAS: raise a risk for intermittent payment gateway timeouts.",
    softHintProjectId: ATLAS.id,
    contextProjectId: ATLAS.id,
  });
  const risk = p.findings.find(
    (f) =>
      f.target?.entityType === "risk" ||
      f.changes?.entityType?.proposed === "risk",
  );
  assert.ok(risk);
  assert.equal(risk.projectId, ATLAS.id);
  assert.equal(risk.projectCode, "ATLAS");
});

check("B — explicit different project not routed to soft hint", () => {
  const p = runLocal({
    text: "HORIZON: raise a risk for vendor capacity constraint.",
    softHintProjectId: ATLAS.id,
    contextProjectId: ATLAS.id,
  });
  const risk = p.findings.find(
    (f) =>
      f.target?.entityType === "risk" ||
      f.changes?.entityType?.proposed === "risk",
  );
  assert.ok(risk, "expected HORIZON risk create");
  assert.equal(risk.projectId, HORIZON.id);
  assert.notEqual(risk.projectId, ATLAS.id);
});

check("C — multi-project Capture", () => {
  const text =
    "ATLAS: CAB approved.\n\nHORIZON: raise a new vendor capacity risk.";
  const p = runLocal({
    text,
    softHintProjectId: ATLAS.id,
    contextProjectId: ATLAS.id,
  });
  const risk = p.findings.find(
    (f) =>
      f.target?.entityType === "risk" ||
      f.changes?.entityType?.proposed === "risk",
  );
  assert.ok(risk, "expected risk create finding");
  assert.equal(risk.projectId, HORIZON.id);
  const projects = new Set(
    p.findings.map((f) => f.projectId).filter(Boolean),
  );
  // At least Horizon for risk; Atlas segment may also stamp other findings
  assert.ok(projects.has(HORIZON.id));
});

check("D — ambiguous CAB → PROJECT_UNCERTAIN", () => {
  const todos = [
    {
      id: "t1",
      title: "Obtain CAB approval",
      projectId: ATLAS.id,
    },
    {
      id: "t2",
      title: "Obtain CAB approval",
      projectId: HORIZON.id,
    },
  ];
  const p = runLocal({
    text: "CAB has finally been approved.",
    softHintProjectId: ATLAS.id,
    contextProjectId: ATLAS.id,
    todos,
  });
  const uncertain = p.findings.find(
    (f) => f.projectCandidates && f.projectCandidates.length > 1 && !f.projectId,
  );
  assert.ok(uncertain, "expected PROJECT_UNCERTAIN finding");
  const result = toResult(p, "CAB has finally been approved.");
  const suggestions = buildSuggestions(result, todos);
  const models = buildReviewChangeViewModels(
    suggestions,
    result,
    "CAB has finally been approved.",
  );
  // Coverage gap or suggestion must not be Apply Ready
  const ready = pendingReadyModels(models, {}, {});
  assert.equal(
    ready.filter((m) => m.reviewReason === "PROJECT_UNCERTAIN").length,
    0,
  );
  const obs = buildCaptureObservations(result, "CAB has finally been approved.");
  assert.ok(
    obs.some((o) => o.actionLabel.includes("Which project")),
    `expected Which project observation, got: ${obs.map((o) => o.actionLabel).join(", ")}`,
  );
});

check("E — create To Do not Nudge", () => {
  const p = runLocal({
    text: "ATLAS: create a To Do to book the go-live bridge call.",
    softHintProjectId: ATLAS.id,
    contextProjectId: ATLAS.id,
  });
  const create = p.findings.find(
    (f) =>
      f.target?.entityType === "todo" ||
      f.changes?.entityType?.proposed === "todo",
  );
  assert.ok(create);
  assert.equal(create.projectId, ATLAS.id);
  const op = p.operations.find((o) => o.sourceFindingId === create.id);
  assert.ok(op);
  assert.equal(op.entityType, "todo");
  assert.notEqual(op.entityType, "nudge");
});

check("F — chase → To Do CHASE metadata", () => {
  const p = runLocal({
    text: "ATLAS: chase Sarah for the evidence pack on Friday.",
    softHintProjectId: ATLAS.id,
    contextProjectId: ATLAS.id,
  });
  const chase = p.findings.find(
    (f) => String(f.changes?.todoKind?.proposed ?? "") === "CHASE",
  );
  assert.ok(chase, "expected CHASE todo finding");
  assert.equal(chase.target?.entityType, "todo");
  assert.equal(String(chase.changes?.waitingOn?.proposed), "Sarah");
  assert.equal(String(chase.changes?.date?.proposed), "Friday");
  assert.ok(!p.findings.some((f) => f.target?.entityType === "nudge"));
});

check("G — create Risk", () => {
  const p = runLocal({
    text: "ATLAS: raise a risk for intermittent payment gateway timeouts.",
    softHintProjectId: ATLAS.id,
    contextProjectId: ATLAS.id,
  });
  const risk = p.findings.find(
    (f) =>
      f.target?.entityType === "risk" ||
      f.changes?.entityType?.proposed === "risk",
  );
  assert.ok(risk);
  assert.equal(risk.projectId, ATLAS.id);
  const op = p.operations.find((o) => o.sourceFindingId === risk.id);
  assert.ok(op);
  assert.equal(op.entityType, "risk");
  assert.equal(op.operation, "CREATE");
});

check("H — remember Knowledge", () => {
  const text =
    "ATLAS: remember that CAB Secretariat require the pack 24 hours before the board.";
  const p = runLocal({
    text,
    softHintProjectId: ATLAS.id,
    contextProjectId: ATLAS.id,
  });
  const know = p.findings.find(
    (f) =>
      f.target?.entityType === "knowledge" ||
      f.changes?.entityType?.proposed === "knowledge",
  );
  assert.ok(know);
  const result = toResult(p, text);
  const suggestions = buildSuggestions(result, []);
  assert.ok(suggestions.some((s) => s.isKnowledgeRemember));
  const obs = buildCaptureObservations(result, text);
  assert.ok(obs.some((o) => o.actionLabel === "Remember · Knowledge"));
});

check("I — event not Knowledge", () => {
  const text = "ATLAS: CAB approval was received today.";
  const p = runLocal({
    text,
    softHintProjectId: ATLAS.id,
    contextProjectId: ATLAS.id,
    todos: [
      { id: "t-cab", title: "Obtain CAB approval", projectId: ATLAS.id },
    ],
  });
  const know = p.findings.filter(
    (f) =>
      f.target?.entityType === "knowledge" ||
      f.changes?.entityType?.proposed === "knowledge",
  );
  assert.equal(know.length, 0, "should not create redundant Knowledge");
});

check("soft hint does not silently resolve multi-project CAB", () => {
  const p = runLocal({
    text: "CAB has been approved.",
    softHintProjectId: ATLAS.id,
    todos: [
      { id: "a", title: "Obtain CAB approval", projectId: ATLAS.id },
      { id: "b", title: "Obtain CAB approval", projectId: HORIZON.id },
    ],
  });
  const f = p.findings.find((x) => /\bcab\b/i.test(x.fact));
  assert.ok(f);
  assert.ok(!f.projectId);
  assert.ok((f.projectCandidates?.length ?? 0) >= 2);
});

console.log(`\n${passed} regression checks passed.`);
