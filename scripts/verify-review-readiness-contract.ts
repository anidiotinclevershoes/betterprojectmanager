/**
 * Review readiness contract — Ready means a faithful, legal, concrete write.
 *
 * Covers defect classes, not anecdotes. Run:
 *   npx tsx scripts/verify-review-readiness-contract.ts
 */
import assert from "node:assert/strict";
import {
  applySupportsOperation,
  assessApplyReadiness,
  currentOwners,
  executeCaptureApply,
  hasStructuredCessationSignal,
  isApplyExecutableSuggestion,
  isSemanticallyRepresentableSuggestion,
  planCaptureApply,
  staleExpectedTargetReason,
  writeRepresentsProposal,
  type CaptureApplyWorld,
} from "../src/lib/capture/apply";
import { applyApprovedCaptureSuggestion } from "../src/lib/capture/apply/apply-approved";
import { memoryCaptureApplyHooks } from "../src/lib/capture/apply/memory-execute";
import { applyPendingReadyQueue } from "../src/lib/capture/review/applyReadyQueue";
import { experimentalMissionState } from "../src/lib/eval-capture-v2/mission-state";
import {
  buildReviewChangeViewModels,
  pendingReadyModels,
} from "../src/lib/capture/review/viewModel";
import type {
  PendingSuggestion,
  SuggestionKind,
  SuggestionOp,
} from "../src/lib/capture/suggestions";
import type { CaptureResult, MissionState } from "../src/lib/types";

const OPS: SuggestionOp[] = [
  "create",
  "update",
  "complete",
  "archive",
  "delete",
  "remove",
];

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
      id: "mem-ready",
      type: "conversation",
      title: "Readiness",
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

function preflight(w = world()) {
  return { world: w, captureEntryProjectId: "proj-candy" };
}

function modelsFor(
  items: PendingSuggestion[],
  text = items[0]?.content ?? "",
  overrides: Parameters<typeof buildReviewChangeViewModels>[3] = {},
  w = world(),
) {
  return buildReviewChangeViewModels(
    items,
    stubResult(),
    text,
    overrides,
    preflight(w),
  );
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
    memories: [],
    recommendations: [],
    meetings: [],
    releases: [],
  } as unknown as MissionState;
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

function worldWithAltTodo(): CaptureApplyWorld {
  const base = world();
  return {
    ...base,
    todos: [
      ...base.todos,
      {
        id: "todo-alt",
        projectId: "proj-candy",
        title: "Book the hall",
        done: false,
      },
    ],
  };
}

function ownershipWorld(owner: { id: string; name: string }): CaptureApplyWorld {
  const base = world();
  const extra = [
    { id: "person-olga", name: "Olga Chen", role: "Design lead" },
    { id: "person-sarah", name: "Sarah Kim", role: "Designer" },
    { id: "person-priya", name: "Priya Shah", role: "Design lead" },
  ];
  return {
    ...base,
    projects: base.projects.map((p) => ({
      ...p,
      stakeholders: [...p.stakeholders, ...extra],
    })),
    knowledge: [
      {
        projectId: "proj-candy",
        sections: { people: [], risks: [] },
        structured: [
          {
            id: "resp-design",
            kind: "responsibility",
            lifecycle: "current",
            body: `${owner.name} owns design`,
            meta: {
              responsibility: {
                personId: owner.id,
                personName: owner.name,
                scope: "design",
                ownerConfirmed: true,
              },
            },
          },
        ],
      },
    ],
  };
}

async function applyApprovedOn(
  item: PendingSuggestion,
  text: string,
  w: CaptureApplyWorld,
) {
  const state = experimentalMissionState(w);
  return applyApprovedCaptureSuggestion({
    item,
    text,
    projectId: "proj-candy",
    expectedTarget: item.expectedTarget,
    loadWorkspace: async () => ({
      workspaceId: "ws-test",
      userId: "user-test",
      state,
    }),
  });
}

let passed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

async function main() {
  await check("A. supported + concrete To Do create is Ready and writes", async () => {
    const item = suggestion({
      id: "a-create",
      kind: "action",
      op: "create",
      content: "Draft the carnival seating plan",
    });
    const models = modelsFor([item]);
    assert.equal(models[0]?.readiness, "ready");
    assert.equal(models[0]?.canApprove, true);
    assert.equal(pendingReadyModels(models, {}, {}).length, 1);
    const applied = await applyItem(item);
    assert.equal(applied.decision.kind, "write");
    assert.equal(applied.executed.kind, "wrote");
  });

  await check("B. statically unsupported ops cannot be Ready", () => {
    const rows: Array<{ kind: SuggestionKind; op: SuggestionOp; extra?: Partial<PendingSuggestion> }> = [
      { kind: "stakeholder", op: "remove" },
      { kind: "stakeholder", op: "update" },
      { kind: "milestone", op: "complete" },
      { kind: "risk", op: "archive" },
      { kind: "meeting", op: "create", extra: { legalDomain: "unsupported" } },
    ];
    for (const row of rows) {
      const item = suggestion({
        id: `b-${row.kind}-${row.op}`,
        kind: row.kind,
        op: row.op,
        content: `${row.kind} ${row.op}`,
        ...row.extra,
      });
      assert.equal(isApplyExecutableSuggestion(item), false);
      const models = modelsFor([item]);
      assert.notEqual(models[0]?.readiness, "ready");
      assert.equal(pendingReadyModels(models, {}, {}).length, 0);
    }
  });

  await check("C. missing target is Needs You, not Ready", () => {
    const item = suggestion({
      id: "c-miss",
      kind: "action",
      op: "complete",
      content: "Obtain CAB approval",
    });
    const models = modelsFor([item]);
    assert.equal(models[0]?.readiness, "needs_review");
    assert.equal(models[0]?.canApprove, false);
    assert.match(
      models[0]?.needsReviewReason ?? "",
      /missing|target|identify|existing/i,
    );
    assert.equal(pendingReadyModels(models, {}, {}).length, 0);
  });

  await check("D. invalid / missing value is Needs You", () => {
    const risk = suggestion({
      id: "d-risk",
      kind: "risk",
      op: "update",
      content: "Icing is worse",
      targetEntityId: "risk-icing",
    });
    const mile = suggestion({
      id: "d-mile",
      kind: "milestone",
      op: "create",
      content: "Float rehearsal",
    });
    const models = modelsFor([risk, mile], "Icing is worse. Add a float rehearsal.");
    assert.equal(models[0]?.readiness, "needs_review");
    assert.equal(models[1]?.readiness, "needs_review");
    assert.equal(models[1]?.missingRequiredField, "date");
    assert.equal(pendingReadyModels(models, {}, {}).length, 0);
  });

  await check("E. ambiguous person identity is Needs You", () => {
    const w = world();
    w.projects[0]!.stakeholders.push({
      id: "person-pippa-2",
      name: "Pippa Gumdrop",
      role: "Sponsor",
    });
    const item = suggestion({
      id: "e-amb",
      kind: "availability",
      op: "update",
      content: "Pippa Gumdrop is away next week",
      personName: "Pippa Gumdrop",
      personId: "person-pippa",
      targetEntityId: "person-pippa",
      legalDomain: "availability",
      date: "2026-10-12",
      proposedValues: { awayFromIso: "2026-10-12" },
    });
    const models = modelsFor(
      [item],
      "Pippa Gumdrop is away next week.",
      {},
      w,
    );
    assert.notEqual(models[0]?.readiness, "ready");
    assert.equal(pendingReadyModels(models, {}, {}).length, 0);
  });

  await check("F. stale expected target is not Ready and Apply does not write", () => {
    const item = suggestion({
      id: "f-stale",
      kind: "action",
      op: "complete",
      content: "Obtain CAB approval",
      targetTodoId: "todo-cab",
      targetEntityId: "todo-cab",
      expectedTarget: {
        id: "todo-cab",
        domain: "todo",
        title: "Obtain CAB approval",
        done: false,
      },
    });
    const staleWorld = world();
    staleWorld.todos[0]!.title = "Obtain CAB approval (rewritten)";
    const models = modelsFor(
      [item],
      "CAB is done.",
      {},
      staleWorld,
    );
    assert.equal(models[0]?.readiness, "needs_review");
    assert.match(models[0]?.needsReviewReason ?? "", /changed since Review|Capture again/i);
    assert.equal(
      staleExpectedTargetReason(
        staleWorld,
        item.expectedTarget,
        "proj-candy",
      ),
      "That To Do changed since Review. Capture again before applying.",
    );
    const decision = planCaptureApply({
      item,
      text: "CAB is done.",
      world: staleWorld,
      captureEntryProjectId: "proj-candy",
    });
    // Planner against the new title still sees the id; stale is a preflight gate.
    assert.equal(decision.kind, "write");
    const verdict = assessApplyReadiness({
      item,
      text: "CAB is done.",
      preflight: preflight(staleWorld),
    });
    assert.equal(verdict.canApprove, false);
    assert.equal(verdict.stale, true);
  });

  await check("G. person cessation / update cannot false-succeed", async () => {
    const asRemove = suggestion({
      id: "g-rm",
      kind: "stakeholder",
      op: "remove",
      content: "Old Vendor",
      personId: "person-vendor",
      personName: "Old Vendor",
      targetEntityId: "person-vendor",
    });
    const asUpdate = suggestion({
      id: "g-upd",
      kind: "stakeholder",
      op: "update",
      content: "Old Vendor is no longer involved.",
      personId: "person-vendor",
      personName: "Old Vendor",
      targetEntityId: "person-vendor",
    });
    const asUpdateCessation = suggestion({
      id: "g-upd-sig",
      kind: "stakeholder",
      op: "update",
      content: "Old Vendor",
      personId: "person-vendor",
      personName: "Old Vendor",
      targetEntityId: "person-vendor",
      proposedValues: { involved: false },
    });

    assert.equal(isSemanticallyRepresentableSuggestion(asUpdate), false);
    assert.equal(hasStructuredCessationSignal(asUpdateCessation), true);

    for (const item of [asRemove, asUpdate, asUpdateCessation]) {
      const models = modelsFor(
        [item],
        "Old Vendor is no longer involved.",
        { [item.id]: { accepted: true, readiness: "ready" } },
      );
      assert.notEqual(models[0]?.readiness, "ready", item.id);
      assert.equal(pendingReadyModels(models, {}, {}).length, 0, item.id);
      const applied = await applyItem(item, "Old Vendor is no longer involved.");
      assert.equal(applied.decision.kind, "needs_you", item.id);
      assert.notEqual(applied.executed.kind, "wrote", item.id);
      const still = applied.state.projects[0]?.stakeholders.find(
        (s) => s.id === "person-vendor",
      );
      assert.ok(still, "stakeholder must remain");
    }

    const removeCopy = modelsFor([asRemove])[0]?.needsReviewReason ?? "";
    assert.match(removeCopy, /Old Vendor is no longer involved/i);
    const signalCopy = modelsFor([asUpdateCessation])[0]?.needsReviewReason ?? "";
    assert.match(signalCopy, /Old Vendor is no longer involved/i);
    const updateCopy = modelsFor([asUpdate])[0]?.needsReviewReason ?? "";
    assert.match(updateCopy, /cannot represent this as a stakeholder change|needs clarification/i);
  });

  await check("H. accepted:true does not skip destructive confirmation", async () => {
    const item = suggestion({
      id: "h-rm",
      kind: "action",
      op: "remove",
      content: "Obtain CAB approval",
      targetTodoId: "todo-cab",
      targetEntityId: "todo-cab",
    });
    const models = modelsFor(
      [item],
      "Remove the CAB to-do.",
      {
        "h-rm": {
          accepted: true,
          readiness: "ready",
          projectId: "proj-candy",
        },
      },
    );
    assert.equal(models[0]?.readiness, "needs_review");
    assert.match(
      models[0]?.needsReviewReason ?? "",
      /confirmation|Destructive action/i,
    );
    assert.equal(pendingReadyModels(models, {}, {}).length, 0);

    const archived = suggestion({
      id: "h-arch",
      kind: "action",
      op: "archive",
      content: "Obtain CAB approval",
      targetTodoId: "todo-cab",
      targetEntityId: "todo-cab",
    });
    const archiveModels = modelsFor(
      [archived],
      "Archive the CAB to-do.",
      { "h-arch": { accepted: true, readiness: "ready" } },
    );
    assert.equal(archiveModels[0]?.readiness, "needs_review");
    assert.equal(pendingReadyModels(archiveModels, {}, {}).length, 0);
    const applied = await applyItem(archived);
    assert.equal(applied.decision.kind, "write");
    if (applied.decision.kind === "write") {
      assert.equal(applied.decision.operation.type, "complete_todo");
      assert.equal(writeRepresentsProposal(archived, applied.decision), true);
    }
  });

  await check("I. override cannot force Ready when the planner cannot write", () => {
    const item = suggestion({
      id: "i-force",
      kind: "risk",
      op: "update",
      content: "Icing is worse",
      targetEntityId: "risk-icing",
    });
    const models = modelsFor(
      [item],
      "Icing is worse.",
      { "i-force": { accepted: true, readiness: "ready" } },
    );
    assert.equal(models[0]?.readiness, "needs_review");
    assert.equal(models[0]?.canApprove, false);
    assert.equal(pendingReadyModels(models, {}, {}).length, 0);
  });

  await check("I2. override can supply a date and then become Ready", () => {
    const item = suggestion({
      id: "i-date",
      kind: "milestone",
      op: "update",
      content: "Target Launch",
      targetEntityId: "ms-launch",
    });
    const blocked = modelsFor([item], "Move launch.");
    assert.equal(blocked[0]?.readiness, "needs_review");
    const repaired = modelsFor(
      [{ ...item, date: "2026-10-30" }],
      "Move launch to 30 October.",
      { "i-date": { accepted: true, date: "2026-10-30" } },
    );
    assert.equal(repaired[0]?.readiness, "ready");
    assert.equal(repaired[0]?.canApprove, true);
  });

  await check("J. Apply Ready only includes planner-backed Ready cards", () => {
    const ready = suggestion({
      id: "j-ready",
      kind: "action",
      op: "create",
      content: "Print the track map",
    });
    const blocked = suggestion({
      id: "j-block",
      kind: "stakeholder",
      op: "update",
      content: "Old Vendor is no longer involved.",
      personName: "Old Vendor",
    });
    const models = modelsFor([ready, blocked], "Print the map. Old Vendor left.");
    const pending = pendingReadyModels(models, {}, {});
    assert.deepEqual(pending.map((m) => m.id), ["j-ready"]);
  });

  await check("K. Dismiss never mutates", async () => {
    const item = suggestion({
      id: "k-rm",
      kind: "stakeholder",
      op: "remove",
      content: "Old Vendor",
      personId: "person-vendor",
    });
    const models = modelsFor([item]);
    assert.equal(models[0]?.readiness, "needs_review");
    const before = world().projects[0]!.stakeholders.length;
    const applied = await applyItem(item);
    assert.notEqual(applied.executed.kind, "wrote");
    assert.equal(
      applied.state.projects[0]?.stakeholders.length,
      before,
    );
  });

  await check("L. idempotent complete still plans a write; receipt path is unchanged", async () => {
    const item = suggestion({
      id: "l-done",
      kind: "action",
      op: "complete",
      content: "Obtain CAB approval",
      targetTodoId: "todo-cab",
      targetEntityId: "todo-cab",
    });
    const first = await applyItem(item);
    assert.equal(first.executed.kind, "wrote");
    const second = await applyItem(item);
    assert.equal(second.decision.kind, "write");
    assert.equal(second.state.todos.find((t) => t.id === "todo-cab")?.done, true);
  });

  await check("Adversarial: no world snapshot cannot be Ready", () => {
    const item = suggestion({
      id: "adv-noworld",
      kind: "action",
      op: "create",
      content: "Draft the seating plan",
    });
    const models = buildReviewChangeViewModels([item], stubResult(), item.content);
    assert.notEqual(models[0]?.readiness, "ready");
    assert.equal(models[0]?.canApprove, false);
    assert.equal(pendingReadyModels(models, {}, {}).length, 0);
  });

  await check("Adversarial: person create of an existing name is not Ready", () => {
    const item = suggestion({
      id: "adv-dup",
      kind: "stakeholder",
      op: "create",
      content: "Pippa Gumdrop",
      personName: "Pippa Gumdrop",
    });
    const models = modelsFor([item], "Pippa Gumdrop is already here.");
    assert.notEqual(models[0]?.readiness, "ready");
    const decision = planCaptureApply({
      item,
      text: "Pippa Gumdrop is already here.",
      world: world(),
      captureEntryProjectId: "proj-candy",
    });
    assert.equal(decision.kind, "no_change");
  });

  await check("Adversarial: matrix person update is unsupported", () => {
    assert.equal(applySupportsOperation("person", "update"), false);
    assert.equal(applySupportsOperation("person", "create"), true);
    for (const op of OPS) {
      if (op === "create") continue;
      assert.equal(
        applySupportsOperation("person", op),
        false,
        `person × ${op}`,
      );
    }
  });

  await check("Adversarial: Ready concrete risk complete writes resolved", async () => {
    const item = suggestion({
      id: "adv-risk",
      kind: "risk",
      op: "complete",
      content: "Gumdrop Bridge icing",
      targetEntityId: "risk-icing",
    });
    const models = modelsFor([item], "Bridge icing is resolved.");
    assert.equal(models[0]?.readiness, "ready");
    const applied = await applyItem(item, "Bridge icing is resolved.");
    assert.equal(applied.decision.kind, "write");
    if (applied.decision.kind === "write") {
      assert.equal(applied.decision.operation.type, "update_risk_status");
    }
  });

  await check("F1. correction to a different target rebinds expectedTarget; same-snapshot Apply writes", async () => {
    const alt = worldWithAltTodo();
    const text = "Book the hall is done.";
    const stale = suggestion({
      id: "f1-retarget",
      kind: "action",
      op: "complete",
      content: "Book the hall",
      targetTodoId: "todo-alt",
      targetEntityId: "todo-alt",
      legalDomain: "todo",
      expectedTarget: {
        id: "todo-cab",
        domain: "todo",
        title: "Obtain CAB approval",
        done: false,
      },
    });
    const models = modelsFor([stale], text, {}, alt);
    assert.equal(models[0]?.readiness, "ready");
    assert.equal(models[0]?.canApprove, true);
    const pending = pendingReadyModels(models, {}, {});
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.suggestion.expectedTarget?.id, "todo-alt");
    assert.notEqual(pending[0]?.suggestion.expectedTarget?.id, "todo-cab");

    const applied = await applyApprovedOn(pending[0]!.suggestion, text, alt);
    assert.notEqual(applied.decision.kind, "needs_you");
    assert.equal(applied.decision.kind, "write");
    assert.equal(applied.executed.kind, "wrote");
    assert.equal(applied.state.todos.find((t) => t.id === "todo-alt")?.done, true);
    assert.equal(applied.state.todos.find((t) => t.id === "todo-cab")?.done, false);
  });

  await check("F1. Create New clears a declined target fingerprint", async () => {
    const text = "Add a new to-do to book the hall.";
    const declined = suggestion({
      id: "f1-create",
      kind: "action",
      op: "create",
      content: "Book the hall",
      legalDomain: "todo",
      expectedTarget: {
        id: "todo-cab",
        domain: "todo",
        title: "Obtain CAB approval",
        done: false,
      },
    });
    const models = modelsFor([declined], text);
    assert.equal(models[0]?.readiness, "ready");
    assert.equal(models[0]?.canApprove, true);
    const pending = pendingReadyModels(models, {}, {});
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.suggestion.expectedTarget ?? null, null);

    const applied = await applyApprovedOn(pending[0]!.suggestion, text, world());
    assert.notEqual(applied.decision.kind, "needs_you");
    assert.equal(applied.decision.kind, "write");
    assert.equal(applied.executed.kind, "wrote");
    assert.equal(applied.state.todos.find((t) => t.id === "todo-cab")?.done, false);
    assert.ok(
      applied.state.todos.some(
        (t) => t.id !== "todo-cab" && /book the hall/i.test(t.title),
      ),
    );
  });

  await check("F3. replace binds the reviewed owner; Apply must not supersede a later owner", async () => {
    const reviewWorld = ownershipWorld({
      id: "person-olga",
      name: "Olga Chen",
    });
    const applyWorld = ownershipWorld({
      id: "person-priya",
      name: "Priya Shah",
    });
    const text = "Sarah Kim replaces Olga Chen on design.";
    const item = suggestion({
      id: "f3-replace",
      kind: "stakeholder",
      op: "update",
      content: "Sarah Kim replaces Olga Chen on design",
      legalDomain: "responsibility",
      ownershipSemantics: "replace",
      personName: "Sarah Kim",
      personId: "person-sarah",
      responsibilityScope: "design",
    });
    assert.equal(item.replacePersonId, undefined);
    const models = modelsFor([item], text, {}, reviewWorld);
    assert.equal(models[0]?.readiness, "ready");
    assert.equal(models[0]?.canApprove, true);
    const pending = pendingReadyModels(models, {}, {});
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.suggestion.replacePersonId, "person-olga");

    const applied = await applyApprovedOn(
      pending[0]!.suggestion,
      text,
      applyWorld,
    );
    assert.equal(applied.decision.kind, "needs_you");
    assert.notEqual(applied.executed.kind, "wrote");
    const owners = currentOwners(
      {
        ...applyWorld,
        knowledge:
          applied.state.knowledge?.map((k) => ({
            projectId: k.projectId,
            sections: { people: k.sections.people, risks: k.sections.risks },
            structured: k.structured,
          })) ?? applyWorld.knowledge,
      },
      "proj-candy",
      "design",
    );
    assert.ok(
      owners.some((o) => o.personId === "person-priya"),
      "Priya must remain the current owner",
    );
    assert.ok(
      !owners.some((o) => o.personId === "person-sarah"),
      "Sarah must not silently replace Priya",
    );
  });

  await check("F5. structured cessation must not become confirm_responsibility", async () => {
    const text = "Sarah Kim is no longer responsible for design.";
    const item = suggestion({
      id: "f5-cessation",
      kind: "stakeholder",
      op: "update",
      content: "Sarah Kim is no longer responsible for design",
      legalDomain: "responsibility",
      ownershipSemantics: "replace",
      personName: "Sarah Kim",
      responsibilityScope: "design",
      proposedValues: {
        status: "ended",
        personName: "Sarah Kim",
        scope: "design",
        ownershipSemantics: "replace",
      },
    });
    assert.equal(hasStructuredCessationSignal(item), true);
    assert.equal(isSemanticallyRepresentableSuggestion(item), false);
    const models = modelsFor([item], text);
    assert.notEqual(models[0]?.readiness, "ready");
    assert.equal(models[0]?.canApprove, false);
    assert.equal(pendingReadyModels(models, {}, {}).length, 0);

    const planned = planCaptureApply({
      item,
      text,
      world: world(),
      captureEntryProjectId: "proj-candy",
    });
    assert.equal(planned.kind, "needs_you");

    const applied = await applyApprovedOn(item, text, world());
    assert.equal(applied.decision.kind, "needs_you");
    assert.notEqual(applied.executed.kind, "wrote");
  });

  await check("F5. structured availability cessation is not Ready", () => {
    const item = suggestion({
      id: "f5-avail",
      kind: "availability",
      op: "update",
      content: "Pippa Gumdrop is no longer away",
      personName: "Pippa Gumdrop",
      personId: "person-pippa",
      proposedValues: {
        status: "ended",
        awayFromIso: "2026-10-03T12:00:00.000Z",
        awayToIso: "2026-10-03T12:00:00.000Z",
      },
    });
    assert.equal(hasStructuredCessationSignal(item), true);
    assert.equal(isSemanticallyRepresentableSuggestion(item), false);
    const models = modelsFor([item], "Pippa Gumdrop is no longer away.");
    assert.notEqual(models[0]?.readiness, "ready");
    assert.equal(pendingReadyModels(models, {}, {}).length, 0);
    const planned = planCaptureApply({
      item,
      text: "Pippa Gumdrop is no longer away.",
      world: world(),
      captureEntryProjectId: "proj-candy",
    });
    assert.equal(planned.kind, "needs_you");
  });

  await check("F7a. bulk Apply Ready continues after confirmOwner", async () => {
    const first = suggestion({
      id: "f7a-owner",
      kind: "action",
      op: "create",
      content: "Print the track map",
    });
    const second = suggestion({
      id: "f7a-ok",
      kind: "action",
      op: "create",
      content: "Draft the seating plan",
    });
    const models = modelsFor(
      [first, second],
      "Print the track map. Draft the seating plan.",
    );
    const pending = pendingReadyModels(models, {}, {});
    assert.deepEqual(pending.map((m) => m.id), ["f7a-owner", "f7a-ok"]);

    const called: string[] = [];
    const { confirmOwner } = await applyPendingReadyQueue({
      models: pending,
      applyOne: async (item) => {
        called.push(item.id);
        if (item.id === "f7a-owner") {
          return {
            kind: "needs_you",
            domain: "responsibility",
            reason: "Replacement needs a confirmed current owner.",
            confirmOwner: {
              projectId: "proj-candy",
              scope: "design",
              personName: "Sarah Kim",
              personId: null,
            },
          };
        }
        return {
          kind: "write",
          domain: "todo",
          operation: {
            type: "create_todo",
            projectId: "proj-candy",
            title: item.content,
          },
        };
      },
    });
    assert.deepEqual(called, ["f7a-owner", "f7a-ok"]);
    assert.equal(confirmOwner?.suggestionId, "f7a-owner");
  });

  await check("Entrypoint: Review Ready → applyApproved on the same snapshot must not reject", async () => {
    const text = "Obtain CAB approval is done.";
    const item = suggestion({
      id: "entry-ready",
      kind: "action",
      op: "complete",
      content: "Obtain CAB approval",
      targetTodoId: "todo-cab",
      targetEntityId: "todo-cab",
      legalDomain: "todo",
    });
    const models = modelsFor([item], text);
    assert.equal(models[0]?.readiness, "ready");
    assert.equal(models[0]?.canApprove, true);
    const pending = pendingReadyModels(models, {}, {});
    assert.equal(pending.length, 1);

    const applied = await applyApprovedOn(pending[0]!.suggestion, text, world());
    assert.notEqual(
      applied.decision.kind,
      "needs_you",
      "Apply must not reject a Review-Ready item for a condition Review could have known on this snapshot",
    );
    assert.equal(applied.decision.kind, "write");
    assert.equal(applied.executed.kind, "wrote");
    assert.equal(applied.state.todos.find((t) => t.id === "todo-cab")?.done, true);
  });

  console.log(`verify-review-readiness-contract: ${passed} checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
