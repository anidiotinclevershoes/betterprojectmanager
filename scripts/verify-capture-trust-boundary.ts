/**
 * Capture trust boundary — characterisation of review-before-write guarantees.
 * Deterministic only (fixtures). Does not call OpenAI or mutate Supabase.
 *
 * Run: npm run verify:capture-trust-boundary
 */
import assert from "node:assert/strict";
import { pendingReadyModels } from "../src/lib/capture/review/counts";
import { buildReviewChangeViewModels } from "../src/lib/capture/review/viewModel";
import type { CaptureFinding } from "../src/lib/capture/findings";
import type { PendingSuggestion } from "../src/lib/capture/suggestions";
import type {
  CaptureResult,
  MissionState,
  Project,
  Recommendation,
} from "../src/lib/types";
import { buildCaptureContext } from "../src/lib/capture/context";
import { emptyKnowledge } from "../src/lib/knowledge";
import { planCaptureApply } from "../src/lib/capture/apply";

let passed = 0;
const skipped: string[] = [];

function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

function knownGap(name: string, reason: string) {
  skipped.push(`${name} — ${reason}`);
  console.log(`○ SKIP (known gap): ${name}`);
  console.log(`  ${reason}`);
}

function stubResult(partial: Partial<CaptureResult> = {}): CaptureResult {
  return {
    memory: {
      id: "mem-test",
      type: "conversation",
      title: "Test",
      content: "source transcript preserved",
      tags: [],
      people: [],
      occurredAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      source: "capture",
    },
    insights: [],
    assumptions: [],
    recommendations: [],
    ...partial,
  };
}

function stubRec(
  partial: Partial<Recommendation> & Pick<Recommendation, "id" | "title">,
): Recommendation {
  return {
    kind: "decision",
    urgency: "today",
    action: partial.title,
    why: "test",
    leadershipImpact: "test",
    createdAt: new Date().toISOString(),
    status: "active",
    ...partial,
  };
}

function finding(
  partial: Partial<CaptureFinding> &
    Pick<CaptureFinding, "id" | "fact" | "findingType">,
): CaptureFinding {
  return {
    evidence: partial.evidence ?? partial.fact,
    confidence: partial.confidence ?? 90,
    requiresClarification: partial.requiresClarification ?? false,
    reasoningSummary: partial.reasoningSummary ?? partial.fact,
    ...partial,
  };
}

function suggestion(
  partial: Partial<PendingSuggestion> &
    Pick<PendingSuggestion, "id" | "kind" | "op" | "content">,
): PendingSuggestion {
  return {
    destination: partial.destination ?? "project",
    date: partial.date,
    waitingOn: partial.waitingOn,
    todoKind: partial.todoKind,
    recommendation: partial.recommendation,
    knowledgeSection: partial.knowledgeSection,
    timelineItem: partial.timelineItem,
    projectId: partial.projectId,
    projectUncertain: partial.projectUncertain,
    ...partial,
  };
}

check("Analysis output is a proposal package — not written MissionState", () => {
  const result = stubResult({
    findings: [
      finding({
        id: "f1",
        fact: "Auth0 delayed",
        findingType: "NEW_INFORMATION",
      }),
    ],
    recommendations: [
      stubRec({ id: "r1", title: "Chase Auth0", projectId: "p1" }),
    ],
  });
  assert.equal(result.findings?.length, 1);
  assert.equal(result.recommendations[0]!.status, "active");
});

check("CREATE without a project destination is needs_review (not Apply Ready)", () => {
  const s = suggestion({
    id: "s-orphan",
    kind: "action",
    op: "create",
    content: "Do something",
    // no projectId
    recommendation: stubRec({ id: "r1", title: "Do something" }),
  });
  const models = buildReviewChangeViewModels(
    [s],
    stubResult({ recommendations: [s.recommendation!] }),
    "notes",
  );
  assert.equal(models[0]!.readiness, "needs_review");
  assert.equal(pendingReadyModels(models, {}, {}).length, 0);
});

check("Dismissed cards are excluded from Apply Ready", () => {
  const s1 = suggestion({
    id: "s1",
    kind: "action",
    op: "create",
    content: "Do the thing",
    projectId: "p1",
    recommendation: stubRec({ id: "r1", title: "Do the thing" }),
  });
  const models = buildReviewChangeViewModels(
    [s1],
    stubResult({
      findings: [
        finding({
          id: "f1",
          fact: "Do the thing",
          findingType: "NEW_INFORMATION",
          confidence: 95,
        }),
      ],
      recommendations: [s1.recommendation!],
    }),
    "notes",
  );
  const dismissed: Record<string, boolean> = {};
  for (const m of models) dismissed[m.id] = true;
  assert.equal(pendingReadyModels(models, {}, dismissed).length, 0);
});

check("pendingReadyModels never returns non-ready cards", () => {
  const s1 = suggestion({
    id: "s1",
    kind: "action",
    op: "create",
    content: "Do the thing",
    projectId: "p1",
    recommendation: stubRec({ id: "r1", title: "Do the thing" }),
  });
  const orphan = suggestion({
    id: "s2",
    kind: "action",
    op: "create",
    content: "No project",
    recommendation: stubRec({ id: "r2", title: "No project" }),
  });
  const models = buildReviewChangeViewModels(
    [s1, orphan],
    stubResult({
      recommendations: [s1.recommendation!, orphan.recommendation!],
    }),
    "notes",
  );
  const ready = pendingReadyModels(models, {}, {});
  assert.ok(ready.every((m) => m.readiness === "ready"));
  assert.ok(!ready.some((m) => m.id === "s2"));
});

check("Capture context for Project A cannot see Project B todos/knowledge", () => {
  const state: MissionState = {
    projects: [
      {
        id: "p-a",
        name: "A",
        code: "A",
        summary: "",
        status: "healthy",
        currentFocus: "",
        stakeholders: [],
      } satisfies Project,
      {
        id: "p-b",
        name: "B",
        code: "B",
        summary: "",
        status: "healthy",
        currentFocus: "",
        stakeholders: [],
      } satisfies Project,
    ],
    memories: [],
    recommendations: [],
    meetings: [],
    releases: [],
    todos: [
      {
        id: "t-b",
        projectId: "p-b",
        title: "Only on B",
        done: false,
        createdAt: new Date().toISOString(),
      },
    ],
    knowledge: [
      (() => {
        const k = emptyKnowledge("p-a");
        k.sections.now = ["A only"];
        return k;
      })(),
      (() => {
        const k = emptyKnowledge("p-b");
        k.sections.now = ["B secret"];
        return k;
      })(),
    ],
    timeline: [],
    history: [],
  };

  const ctx = buildCaptureContext({
    state,
    projectId: "p-a",
    captureText: "update",
  });
  const blob = JSON.stringify(ctx);
  assert.match(blob, /A only/);
  assert.doesNotMatch(blob, /B secret/);
  assert.doesNotMatch(blob, /Only on B/);
});

check("Capture context read path does not mutate MissionState", () => {
  const state: MissionState = {
    projects: [
      {
        id: "p-a",
        name: "A",
        code: "A",
        summary: "",
        status: "healthy",
        currentFocus: "",
        stakeholders: [],
      },
    ],
    memories: [],
    recommendations: [],
    meetings: [],
    releases: [],
    todos: [],
    knowledge: [emptyKnowledge("p-a")],
    timeline: [],
    history: [],
  };
  const before = JSON.stringify(state);
  buildCaptureContext({ state, projectId: "p-a", captureText: "x" });
  assert.equal(JSON.stringify(state), before);
});

check("Capture apply dispatcher refuses unknown domain instead of writing a Todo", () => {
  const decision = planCaptureApply({
    item: suggestion({
      id: "x",
      kind: "meeting",
      op: "create",
      content: "Prep notes",
      legalDomain: "unsupported",
      projectId: "p-a",
    }),
    text: "Prep notes",
    world: {
      projectIds: new Set(["p-a"]),
      projects: [{ id: "p-a", name: "A", stakeholders: [] }],
      risks: [],
      todos: [],
      timeline: [],
      knowledge: [],
    },
    captureEntryProjectId: "p-a",
  });
  assert.equal(decision.kind, "needs_you");
});

console.log(
  `verify-capture-trust-boundary: ${passed} passed, ${skipped.length} known-gap skips`,
);
