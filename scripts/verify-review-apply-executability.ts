/**
 * Review → Apply executability gate.
 * Ready / Approve may only appear when Apply has a legal mutation
 * for that exact domain × operation. No person-delete semantics.
 *
 * Run: npx tsx scripts/verify-review-apply-executability.ts
 */
import assert from "node:assert/strict";
import {
  applySupportsOperation,
  executeCaptureApply,
  isApplyExecutableSuggestion,
  planCaptureApply,
  type CaptureApplyWorld,
  type CaptureLegalDomain,
} from "../src/lib/capture/apply";
import { memoryCaptureApplyHooks } from "../src/lib/capture/apply/memory-execute";
import {
  buildReviewChangeViewModels,
  pendingReadyModels,
} from "../src/lib/capture/review/viewModel";
import type { PendingSuggestion, SuggestionKind, SuggestionOp } from "../src/lib/capture/suggestions";
import type { CaptureResult, MissionState } from "../src/lib/types";

const OPS: SuggestionOp[] = [
  "create",
  "update",
  "complete",
  "archive",
  "delete",
  "remove",
];

const KIND_FOR_DOMAIN: Record<Exclude<CaptureLegalDomain, "unsupported">, SuggestionKind> = {
  todo: "action",
  risk: "risk",
  milestone: "milestone",
  person: "stakeholder",
  responsibility: "stakeholder",
  availability: "availability",
  knowledge: "knowledge",
  memory: "memory",
};

function suggestion(
  partial: Partial<PendingSuggestion> &
    Pick<PendingSuggestion, "id" | "kind" | "op" | "content">,
): PendingSuggestion {
  return {
    destination: "project",
    projectId: "proj-candy",
    ...partial,
  };
}

function stubResult(): CaptureResult {
  return {
    memory: {
      id: "mem-exec",
      type: "conversation",
      title: "Executability",
      content: "",
      tags: [],
      people: [],
      occurredAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      source: "capture",
    },
    insights: [],
    assumptions: [],
    recommendations: [],
  };
}

function world(): CaptureApplyWorld {
  return {
    projectIds: new Set(["proj-candy"]),
    projects: [
      {
        id: "proj-candy",
        name: "Candyland",
        code: "CANDY",
        stakeholders: [
          { id: "person-vendor", name: "Old Vendor", role: "Supplier" },
          { id: "person-pippa", name: "Pippa Gumdrop", role: "UAT lead" },
        ],
      },
    ],
    risks: [
      {
        id: "risk-icing",
        projectId: "proj-candy",
        title: "Gumdrop Bridge icing",
        status: "open",
      },
    ],
    todos: [
      {
        id: "todo-cab",
        projectId: "proj-candy",
        title: "Obtain CAB approval",
        done: false,
      },
    ],
    timeline: [
      {
        id: "ms-launch",
        projectId: "proj-candy",
        label: "Target Launch",
        startAt: "2026-10-27T12:00:00.000Z",
      },
    ],
    knowledge: [],
  };
}

function emptyState(): MissionState {
  return {
    projects: [
      {
        id: "proj-candy",
        name: "Candyland",
        code: "CANDY",
        summary: "",
        currentFocus: "",
        stakeholders: [
          { id: "person-vendor", name: "Old Vendor", role: "Supplier" },
          { id: "person-pippa", name: "Pippa Gumdrop", role: "UAT lead" },
        ],
      },
    ],
    todos: [
      {
        id: "todo-cab",
        title: "Obtain CAB approval",
        projectId: "proj-candy",
        done: false,
      },
    ],
    risks: [
      {
        id: "risk-icing",
        projectId: "proj-candy",
        title: "Gumdrop Bridge icing",
        status: "open",
      },
    ],
    timeline: [
      {
        id: "ms-launch",
        projectId: "proj-candy",
        label: "Target Launch",
        startAt: "2026-10-27T12:00:00.000Z",
      },
    ],
    knowledge: [],
    history: [],
  } as MissionState;
}

async function applyItem(item: PendingSuggestion, text = item.content) {
  const box = { state: structuredClone(emptyState()) };
  const decision = planCaptureApply({
    item,
    text,
    world: world(),
    captureEntryProjectId: "proj-candy",
  });
  const executed = await executeCaptureApply(
    decision,
    memoryCaptureApplyHooks(box),
  );
  return { decision, executed, state: box.state };
}

let passed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`✓ ${name}`);
    });
}

await check("A. stakeholder remove is not Ready and does not mutate", async () => {
  const item = suggestion({
    id: "rm-vendor",
    kind: "stakeholder",
    op: "remove",
    content: "Old Vendor",
    personId: "person-vendor",
    personName: "Old Vendor",
    targetEntityId: "person-vendor",
  });
  assert.equal(isApplyExecutableSuggestion(item), false);

  const models = buildReviewChangeViewModels([item], stubResult(), "");
  assert.equal(models[0]?.readiness, "needs_review");
  assert.equal(models[0]?.executableApply, false);
  assert.match(
    models[0]?.needsReviewReason ?? "",
    /Old Vendor is no longer involved/i,
  );
  assert.match(
    models[0]?.needsReviewReason ?? "",
    /needs clarification about what that means for this stakeholder/i,
  );
  assert.equal(pendingReadyModels(models, {}, {}).length, 0);

  const forced = buildReviewChangeViewModels([item], stubResult(), "", {
    "rm-vendor": { accepted: true, readiness: "ready" },
  });
  assert.equal(forced[0]?.readiness, "needs_review");
  assert.equal(forced[0]?.executableApply, false);
  assert.equal(pendingReadyModels(forced, {}, {}).length, 0);

  const { decision, executed, state } = await applyItem(
    item,
    "Old Vendor is no longer involved.",
  );
  assert.equal(decision.kind, "needs_you");
  assert.notEqual(executed.kind, "wrote");
  const still = state.projects[0]?.stakeholders.find((s) => s.id === "person-vendor");
  assert.ok(still, "stakeholder must remain");
  assert.equal(still?.name, "Old Vendor");
});

await check("B. supported To Do create stays Ready and writes", async () => {
  const item = suggestion({
    id: "todo-new",
    kind: "action",
    op: "create",
    content: "Draft the carnival seating plan",
  });
  assert.equal(isApplyExecutableSuggestion(item), true);
  const models = buildReviewChangeViewModels([item], stubResult(), "");
  assert.equal(models[0]?.readiness, "ready");
  assert.equal(models[0]?.executableApply, true);
  assert.equal(pendingReadyModels(models, {}, {}).length, 1);

  const { decision, executed, state } = await applyItem(item);
  assert.equal(decision.kind, "write");
  assert.equal(executed.kind, "wrote");
  assert.ok(state.todos.some((t) => t.title === "Draft the carnival seating plan"));
});

await check("C. supported milestone update stays Ready and writes", async () => {
  const item = suggestion({
    id: "ms-upd",
    kind: "milestone",
    op: "update",
    content: "Target Launch",
    targetEntityId: "ms-launch",
    date: "2026-10-30",
    proposedValues: { startAt: "2026-10-30T12:00:00.000Z" },
  });
  assert.equal(isApplyExecutableSuggestion(item), true);
  const models = buildReviewChangeViewModels([item], stubResult(), "");
  assert.equal(models[0]?.readiness, "ready");
  const { decision, executed } = await applyItem(item, "Move launch to 30 October 2026.");
  assert.equal(decision.kind, "write");
  assert.equal(executed.kind, "wrote");
});

await check("D. supported To Do complete and Risk resolve stay executable", async () => {
  const todo = suggestion({
    id: "todo-done",
    kind: "action",
    op: "complete",
    content: "Obtain CAB approval",
    targetTodoId: "todo-cab",
    targetEntityId: "todo-cab",
  });
  const risk = suggestion({
    id: "risk-done",
    kind: "risk",
    op: "complete",
    content: "Gumdrop Bridge icing",
    targetEntityId: "risk-icing",
  });
  assert.equal(isApplyExecutableSuggestion(todo), true);
  assert.equal(isApplyExecutableSuggestion(risk), true);
  const models = buildReviewChangeViewModels([todo, risk], stubResult(), "");
  assert.equal(models[0]?.readiness, "ready");
  assert.equal(models[1]?.readiness, "ready");

  const todoApply = await applyItem(todo);
  assert.equal(todoApply.decision.kind, "write");
  assert.equal(todoApply.executed.kind, "wrote");
  assert.equal(todoApply.state.todos.find((t) => t.id === "todo-cab")?.done, true);

  const riskApply = await applyItem(risk);
  assert.equal(riskApply.decision.kind, "write");
  assert.equal(riskApply.executed.kind, "wrote");
  assert.equal(
    riskApply.state.risks.find((r) => r.id === "risk-icing")?.status,
    "resolved",
  );
});

await check("E. unsupported domain × operation combinations cannot be Ready", () => {
  const unsupported: Array<{
    domain: CaptureLegalDomain;
    kind: SuggestionKind;
    op: SuggestionOp;
    extra?: Partial<PendingSuggestion>;
  }> = [];
  const domains: Exclude<CaptureLegalDomain, "unsupported">[] = [
    "todo",
    "risk",
    "milestone",
    "person",
    "responsibility",
    "availability",
    "knowledge",
    "memory",
  ];
  for (const domain of domains) {
    for (const op of OPS) {
      if (applySupportsOperation(domain, op)) continue;
      unsupported.push({
        domain,
        kind: KIND_FOR_DOMAIN[domain],
        op,
        extra:
          domain === "responsibility"
            ? {
                legalDomain: "responsibility",
                ownershipSemantics: "share",
                personName: "Pippa Gumdrop",
                responsibilityScope: "UAT",
              }
            : domain === "availability"
              ? { legalDomain: "availability" }
              : undefined,
      });
    }
  }
  assert.ok(unsupported.length >= 20, "matrix should list many unsupported cells");

  for (const row of unsupported) {
    const item = suggestion({
      id: `bad-${row.domain}-${row.op}`,
      kind: row.kind,
      op: row.op,
      content: `${row.domain} ${row.op}`,
      ...row.extra,
    });
    assert.equal(
      isApplyExecutableSuggestion(item),
      false,
      `${row.domain} × ${row.op} should be unsupported`,
    );
    const models = buildReviewChangeViewModels([item], stubResult(), "");
    assert.notEqual(
      models[0]?.readiness,
      "ready",
      `${row.domain} × ${row.op} must not be Ready`,
    );
    assert.equal(models[0]?.executableApply, false, `${row.domain} × ${row.op}`);
    assert.equal(
      pendingReadyModels(models, {}, {}).length,
      0,
      `${row.domain} × ${row.op} must not enter Apply Ready`,
    );
  }
});

await check("F. meeting / unsupported domain cannot be Ready", () => {
  const item = suggestion({
    id: "meet-1",
    kind: "meeting",
    op: "create",
    content: "Book a SteerCo slot",
    legalDomain: "unsupported",
  });
  const models = buildReviewChangeViewModels([item], stubResult(), "");
  assert.notEqual(models[0]?.readiness, "ready");
  assert.equal(pendingReadyModels(models, {}, {}).length, 0);
});

await check("G. dismiss / Needs You path stays intact for supported ambiguity", () => {
  const item = suggestion({
    id: "own-1",
    kind: "stakeholder",
    op: "update",
    content: "Pippa owns UAT",
    legalDomain: "responsibility",
    ownershipSemantics: "ambiguous",
    personName: "Pippa Gumdrop",
    responsibilityScope: "UAT",
  });
  const models = buildReviewChangeViewModels([item], stubResult(), "");
  assert.equal(models[0]?.readiness, "needs_review");
  assert.equal(isApplyExecutableSuggestion(item), true);
  assert.equal(models[0]?.executableApply, true);
});

console.log(`verify-review-apply-executability: ${passed} checks passed`);
