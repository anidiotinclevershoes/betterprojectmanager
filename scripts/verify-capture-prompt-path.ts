/**
 * Phase 1 observability — end-to-end prompt path + fixture tests.
 * Run: npx tsx scripts/verify-capture-prompt-path.ts
 */
import assert from "node:assert/strict";
import {
  buildCaptureContext,
  buildCaptureContextManifest,
  serializeCaptureContextForPrompt,
} from "../src/lib/capture/context";
import { buildCaptureUserPrompt } from "../src/lib/openai";
import { createSeedState } from "../src/lib/seed";
import type {
  MissionState,
  Project,
  Stakeholder,
  TodoItem,
} from "../src/lib/types";

const CAPTURE_TEXT =
  "Jordan confirmed that CAB approval was received today.";

function horizonFixture(): MissionState {
  const seed = createSeedState();
  const jordan: Stakeholder = {
    id: "stake-jordan",
    name: "Jordan Lee",
    role: "Release Manager",
    concerns: ["CAB evidence"],
  };
  const horizon: Project = {
    id: "proj-horizon",
    name: "Horizon",
    code: "HORIZON",
    summary: "Horizon release train",
    status: "watch",
    currentFocus: "CAB approval",
    stakeholders: [jordan],
  };
  const other: Project = {
    id: "proj-other",
    name: "Other Project",
    code: "OTHER",
    summary: "Should not appear",
    status: "healthy",
    currentFocus: "Unrelated",
    stakeholders: [
      {
        id: "stake-other",
        name: "Alex Other",
        role: "PM",
      },
    ],
  };
  const openTodo: TodoItem = {
    id: "todo-cab-approval",
    projectId: horizon.id,
    title: "Obtain CAB approval",
    detail: "Owner: Jordan",
    done: false,
    createdAt: new Date().toISOString(),
  };
  const otherTodo: TodoItem = {
    id: "todo-other-secret",
    projectId: other.id,
    title: "Other project secret task",
    done: false,
    createdAt: new Date().toISOString(),
  };
  const dismissed = {
    id: "rec-dismissed-horizon",
    kind: "risk" as const,
    urgency: "today" as const,
    title: "Dismissed risk should be absent",
    action: "Ignore",
    why: "Dismissed",
    leadershipImpact: "n/a",
    projectId: horizon.id,
    createdAt: new Date().toISOString(),
    status: "dismissed" as const,
  };

  return {
    ...seed,
    projects: [horizon, other, ...seed.projects],
    todos: [openTodo, otherTodo, ...(seed.todos ?? [])],
    recommendations: [dismissed, ...seed.recommendations],
    meetings: [],
    timeline: [],
    knowledge: [
      {
        projectId: horizon.id,
        updatedAt: new Date().toISOString(),
        sections: {
          now: ["CAB pack in review"],
          decisions: [],
          risks: [],
          people: ["Jordan owns CAB"],
          openLoops: [],
        },
      },
    ],
    history: [],
    releases: [],
  };
}

/** Simulates the API path: build context → build prompt (no network). */
function assembleAnalysisPrompt(args: {
  content: string;
  projectId?: string | null;
  state: MissionState;
  limits?: Parameters<typeof buildCaptureContext>[0]["limits"];
}) {
  const captureContext = buildCaptureContext({
    projectId: args.projectId,
    captureText: args.content,
    state: args.state,
    limits: args.limits,
  });
  const requestId = "capreq-test-1";
  const contextManifest = buildCaptureContextManifest(
    captureContext,
    requestId,
  );
  const userPrompt = buildCaptureUserPrompt({
    rawText: args.content,
    projectId: args.projectId ?? undefined,
    sourceType: "conversation",
    projects: args.state.projects,
    captureContext,
  });
  return { captureContext, contextManifest, userPrompt, requestId };
}

const state = horizonFixture();

// --- full path: context builder → prompt contains Capture + existing record ---
{
  const { captureContext, contextManifest, userPrompt } = assembleAnalysisPrompt({
    content: CAPTURE_TEXT,
    projectId: "proj-horizon",
    state,
  });

  assert.ok(captureContext.project?.id === "proj-horizon");
  assert.ok(
    userPrompt.includes("Relevant existing project context"),
    "structured context section must be present in the prompt",
  );
  assert.ok(
    userPrompt.includes("## Project Domain"),
    "Phase 1.5: Project Domain section must be present",
  );
  assert.ok(
    userPrompt.includes("## Project Dictionary"),
    "Phase 1.5: Dictionary section must be present",
  );
  assert.ok(
    userPrompt.includes("CAB") && userPrompt.includes("Change Advisory Board"),
    "Phase 1.5: default dictionary terms must appear",
  );
  assert.ok(
    userPrompt.includes(CAPTURE_TEXT),
    "prompt must include the new Capture text",
  );
  assert.ok(
    userPrompt.includes("todo-cab-approval"),
    "prompt must include the existing To Do ID",
  );
  assert.ok(
    userPrompt.includes("Obtain CAB approval"),
    "prompt must include the existing To Do title",
  );
  assert.ok(
    userPrompt.includes('"status": "open"') ||
      userPrompt.includes('"status":"open"'),
    "prompt must include open status",
  );
  assert.ok(
    userPrompt.includes("Owner: Jordan"),
    "prompt must include owner from todo detail/summary",
  );
  assert.equal(
    userPrompt.includes("todo-other-secret"),
    false,
    "records from another project must be absent",
  );
  assert.equal(
    userPrompt.includes("Other project secret task"),
    false,
  );
  assert.ok(contextManifest.requestId === "capreq-test-1");
  assert.ok(contextManifest.records.some((r) => r.id === "todo-cab-approval"));
}

// --- no-project Capture: empty / permitted global-only context ---
{
  const { captureContext, userPrompt } = assembleAnalysisPrompt({
    content: CAPTURE_TEXT,
    projectId: null,
    state,
  });
  assert.equal(captureContext.project, null);
  assert.equal(captureContext.diagnostics.projectScoped, false);
  assert.equal(captureContext.todos.length, 0);
  assert.equal(
    userPrompt.includes("todo-cab-approval"),
    false,
    "no-project capture must not include project todos in structured context",
  );
  assert.ok(userPrompt.includes(CAPTURE_TEXT));
}

// --- limits respected + exclusions tracked ---
{
  const manyTodos: TodoItem[] = Array.from({ length: 8 }, (_, i) => ({
    id: `todo-limit-${i}`,
    projectId: "proj-horizon",
    title: `Horizon task ${i}`,
    done: false,
    createdAt: new Date().toISOString(),
  }));
  const limitedState: MissionState = {
    ...state,
    todos: [...manyTodos, ...(state.todos ?? [])],
  };
  const { captureContext, contextManifest } = assembleAnalysisPrompt({
    content: "Horizon task update",
    projectId: "proj-horizon",
    state: limitedState,
    limits: { openTodos: 3 },
  });
  assert.ok(captureContext.todos.length <= 3);
  assert.ok(
    captureContext.diagnostics.limitsReached.some((h) => h.bucket === "To Dos"),
  );
  assert.ok(contextManifest.limitsReached.some((l) => l.includes("To Dos")));
  assert.ok(contextManifest.excludedByLimit.length > 0);
}

// --- dismissed / inactive recommendations excluded ---
{
  const { userPrompt } = assembleAnalysisPrompt({
    content: "risk follow up",
    projectId: "proj-horizon",
    state,
  });
  assert.equal(userPrompt.includes("Dismissed risk should be absent"), false);
}

// --- empty context does not break prompt construction ---
{
  const empty: MissionState = {
    ...createSeedState(),
    projects: [],
    todos: [],
    meetings: [],
    recommendations: [],
    knowledge: [],
    timeline: [],
    history: [],
    releases: [],
  };
  const { userPrompt, captureContext } = assembleAnalysisPrompt({
    content: "A note with no project data",
    projectId: "missing",
    state: empty,
  });
  assert.ok(userPrompt.includes("A note with no project data"));
  assert.equal(captureContext.diagnostics.recordCount, 0);
  assert.ok(serializeCaptureContextForPrompt(captureContext).length > 2);
}

// --- property-name / serialization mismatch guard ---
{
  const { captureContext, userPrompt } = assembleAnalysisPrompt({
    content: CAPTURE_TEXT,
    projectId: "proj-horizon",
    state,
  });
  const serialized = serializeCaptureContextForPrompt(captureContext);
  assert.ok(userPrompt.includes(serialized));
  assert.ok(
    /"todos"\s*:/.test(serialized),
    "serialized context must use todos property",
  );
  assert.equal(
    serialized.includes("diagnostics"),
    false,
    "diagnostics must not be sent to the model",
  );
}

console.log("verify-capture-prompt-path: all checks passed");
console.log("  fixture todo: Obtain CAB approval (Owner: Jordan)");
console.log("  capture:", CAPTURE_TEXT);
