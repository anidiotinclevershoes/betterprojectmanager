/**
 * Production-path regressions for the dogfood integrity gate (D-045–D-048).
 * Uses applyApprovedCaptureSuggestion — the same function /api/capture/apply calls.
 *
 * Run: npx tsx scripts/verify-dogfood-integrity-gate.ts
 */
import assert from "node:assert/strict";
import { applyApprovedCaptureSuggestion } from "../src/lib/capture/apply/apply-approved";
import { assessApplyReadiness } from "../src/lib/capture/apply/readiness";
import {
  fingerprintExpectedTarget,
  staleExpectedTargetReason,
} from "../src/lib/capture/apply/expected-target";
import { memoryCaptureApplyHooks } from "../src/lib/capture/apply/memory-execute";
import { captureApplyWorldFromState } from "../src/lib/capture/apply/world";
import { emptyKnowledge } from "../src/lib/knowledge";
import type { MissionState } from "../src/lib/types";
import type { PendingSuggestion } from "../src/lib/capture/suggestions";
import {
  captureSessionProjectMismatch,
  captureSessionStorageKey,
} from "../src/lib/capture/suggestions";

let passed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`✓ ${name}`);
    });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function candyState(): MissionState {
  return {
    projects: [
      {
        id: "proj-candy",
        name: "Candy",
        code: "CNDY",
        summary: "",
        status: "healthy",
        currentFocus: "UAT",
        stakeholders: [
          { id: "p-elena", name: "Elena", role: "BA" },
          { id: "p-jordan", name: "Jordan", role: "PM" },
        ],
      },
    ],
    memories: [],
    recommendations: [],
    meetings: [],
    releases: [],
    todos: [
      {
        id: "todo-cab",
        projectId: "proj-candy",
        title: "Obtain CAB approval",
        done: false,
        createdAt: "2026-07-01T10:00:00.000Z",
        dueAt: "2026-07-10T09:00:00.000Z",
        detail: "Owner: Elena",
      },
    ],
    knowledge: [emptyKnowledge("proj-candy")],
    risks: [],
    timeline: [
      {
        id: "ms-uat",
        projectId: "proj-candy",
        label: "UAT start",
        type: "milestone",
        startAt: "2026-07-20T12:00:00.000Z",
        endAt: "2026-07-22T12:00:00.000Z",
        notes: "Lab booked",
        source: "manual",
      },
    ],
  };
}

function knowledgeItem(): PendingSuggestion {
  return {
    id: "sug-know-1",
    kind: "decision",
    op: "create",
    content: "We will ship Friday",
    destination: "project",
    projectId: "proj-candy",
    legalDomain: "knowledge",
    knowledgeSection: "decisions",
  };
}

async function main() {
  await check("D-045 receipted create: reload failure does not adopt pre-write state", async () => {
    const start = candyState();
    const before = JSON.stringify(start.todos);
    const box = { state: clone(start) };
    const result = await applyApprovedCaptureSuggestion({
      item: {
        id: "sug-create-todo",
        kind: "action",
        op: "create",
        content: "Book the war room",
        destination: "project",
        projectId: "proj-candy",
        legalDomain: "todo",
      },
      text: "Book the war room",
      projectId: "proj-candy",
      loadWorkspace: async () => ({
        workspaceId: "ws-1",
        userId: "user-1",
        state: start,
      }),
      hooks: memoryCaptureApplyHooks(box),
      reloadWorkspace: async () => {
        throw new Error("reload failed after commit");
      },
    });
    assert.equal(result.executed.kind, "wrote");
    assert.equal(result.reconcileFailed, true);
    assert.equal(result.state, undefined);
    assert.notEqual(JSON.stringify(box.state.todos), before);
  });

  await check("D-045 + D-048 knowledge: reload fail then retry does not duplicate", async () => {
    const start = candyState();
    const box = { state: clone(start) };
    const hooks = memoryCaptureApplyHooks(box);
    const item = knowledgeItem();
    const first = await applyApprovedCaptureSuggestion({
      item,
      text: "We will ship Friday",
      projectId: "proj-candy",
      loadWorkspace: async () => ({
        workspaceId: "ws-1",
        userId: "user-1",
        state: box.state,
      }),
      hooks,
      reloadWorkspace: async () => {
        throw new Error("reload failed after commit");
      },
    });
    assert.equal(first.executed.kind, "wrote");
    assert.equal(first.reconcileFailed, true);
    assert.equal(first.state, undefined);

    const second = await applyApprovedCaptureSuggestion({
      item,
      text: "We will ship Friday",
      projectId: "proj-candy",
      loadWorkspace: async () => ({
        workspaceId: "ws-1",
        userId: "user-1",
        state: box.state,
      }),
      hooks,
    });
    assert.equal(second.executed.kind, "no_change");
    const bodies = box.state.knowledge[0]!.sections.decisions.filter((b) =>
      /Friday/.test(b),
    );
    assert.equal(bodies.length, 1);
  });

  await check("D-046 todo dueAt concurrent change fails closed", async () => {
    const start = candyState();
    const item: PendingSuggestion = {
      id: "sug-due",
      kind: "action",
      op: "update",
      content: "Move CAB approval to next Friday",
      destination: "project",
      projectId: "proj-candy",
      legalDomain: "todo",
      targetEntityId: "todo-cab",
      targetTodoId: "todo-cab",
      date: "2026-07-17T09:00:00.000Z",
    };
    const fp = fingerprintExpectedTarget(captureApplyWorldFromState(start), item);
    const later = clone(start);
    later.todos[0]!.dueAt = "2026-07-12T09:00:00.000Z";
    assert.ok(
      staleExpectedTargetReason(
        captureApplyWorldFromState(later),
        fp,
        "proj-candy",
      ),
    );
    const ready = assessApplyReadiness({
      item: { ...item, expectedTarget: fp },
      text: "Move CAB approval to next Friday",
      preflight: {
        world: captureApplyWorldFromState(later),
        captureEntryProjectId: "proj-candy",
      },
    });
    assert.equal(ready.canApprove, false);
    const box = { state: clone(later) };
    const applied = await applyApprovedCaptureSuggestion({
      item: { ...item, expectedTarget: fp },
      text: "Move CAB approval to next Friday",
      projectId: "proj-candy",
      expectedTarget: fp,
      loadWorkspace: async () => ({
        workspaceId: "ws-1",
        userId: "u",
        state: later,
      }),
      hooks: memoryCaptureApplyHooks(box),
    });
    assert.equal(applied.executed.kind, "needs_you");
    assert.equal(box.state.todos[0]!.dueAt, "2026-07-12T09:00:00.000Z");
  });

  await check("D-046 todo detail concurrent change fails closed", async () => {
    const start = candyState();
    const item: PendingSuggestion = {
      id: "sug-detail",
      kind: "action",
      op: "update",
      content: "Move CAB approval to next Friday",
      destination: "project",
      projectId: "proj-candy",
      legalDomain: "todo",
      targetEntityId: "todo-cab",
      targetTodoId: "todo-cab",
      date: "2026-07-17T09:00:00.000Z",
    };
    const fp = fingerprintExpectedTarget(captureApplyWorldFromState(start), item);
    const later = clone(start);
    later.todos[0]!.detail = "Owner: Jordan";
    assert.ok(
      staleExpectedTargetReason(
        captureApplyWorldFromState(later),
        fp,
        "proj-candy",
      ),
    );
  });

  await check("D-046 milestone notes/endAt concurrent change fails closed", async () => {
    const start = candyState();
    const item: PendingSuggestion = {
      id: "sug-ms",
      kind: "milestone",
      op: "update",
      content: "Move UAT start",
      destination: "project",
      projectId: "proj-candy",
      legalDomain: "milestone",
      targetEntityId: "ms-uat",
      date: "2026-07-21T12:00:00.000Z",
    };
    const fp = fingerprintExpectedTarget(captureApplyWorldFromState(start), item);
    const later = clone(start);
    later.timeline[0]!.notes = "Lab cancelled";
    later.timeline[0]!.endAt = "2026-07-25T12:00:00.000Z";
    assert.ok(
      staleExpectedTargetReason(
        captureApplyWorldFromState(later),
        fp,
        "proj-candy",
      ),
    );
    const box = { state: clone(later) };
    const applied = await applyApprovedCaptureSuggestion({
      item: { ...item, expectedTarget: fp },
      text: "Move UAT start",
      projectId: "proj-candy",
      expectedTarget: fp,
      loadWorkspace: async () => ({
        workspaceId: "ws-1",
        userId: "u",
        state: later,
      }),
      hooks: memoryCaptureApplyHooks(box),
    });
    assert.equal(applied.executed.kind, "needs_you");
    assert.equal(box.state.timeline[0]!.notes, "Lab cancelled");
  });

  await check("D-046 replacement owner set change fails closed", async () => {
    const start = candyState();
    start.knowledge[0]!.structured = [
      {
        id: "resp-cab",
        projectId: "proj-candy",
        section: "people",
        body: "CAB · Elena",
        kind: "responsibility",
        epistemic: "confirmed",
        lifecycle: "current",
        meta: {
          responsibility: {
            personId: "p-elena",
            personName: "Elena",
            scope: "CAB",
            ownerConfirmed: true,
          },
        },
      },
    ];
    const item: PendingSuggestion = {
      id: "sug-own",
      kind: "stakeholder",
      op: "update",
      content: "Jordan now owns CAB",
      destination: "project",
      projectId: "proj-candy",
      legalDomain: "responsibility",
      targetEntityId: "p-jordan",
      personId: "p-jordan",
      personName: "Jordan",
      responsibilityScope: "CAB",
      ownershipSemantics: "replace",
      replacePersonId: "p-elena",
    };
    const fp = fingerprintExpectedTarget(captureApplyWorldFromState(start), item);
    assert.equal(fp?.replacePersonId, "p-elena");
    const later = clone(start);
    later.knowledge[0]!.structured = [
      {
        ...later.knowledge[0]!.structured![0]!,
        meta: {
          responsibility: {
            personId: "p-jordan",
            personName: "Jordan",
            scope: "CAB",
            ownerConfirmed: true,
          },
        },
      },
    ];
    assert.ok(
      staleExpectedTargetReason(
        captureApplyWorldFromState(later),
        fp,
        "proj-candy",
      ),
    );
  });

  await check("D-047 session key is per-project; mismatch blocks Apply", () => {
    assert.equal(
      captureSessionStorageKey("proj-candy"),
      "lume-capture-session-v1:proj-candy",
    );
    assert.equal(
      captureSessionStorageKey("proj-atlas"),
      "lume-capture-session-v1:proj-atlas",
    );
    assert.equal(
      captureSessionProjectMismatch("proj-candy", "proj-atlas", true),
      true,
    );
    assert.equal(
      captureSessionProjectMismatch("proj-candy", "proj-candy", true),
      false,
    );
    assert.equal(
      captureSessionProjectMismatch("proj-candy", "proj-atlas", false),
      false,
    );
  });

  await check("D-048 same knowledge Apply twice is one row", async () => {
    const start = candyState();
    const box = { state: clone(start) };
    const hooks = memoryCaptureApplyHooks(box);
    const item = knowledgeItem();
    const args = {
      item,
      text: "We will ship Friday",
      projectId: "proj-candy",
      loadWorkspace: async () => ({
        workspaceId: "ws-1",
        userId: "u",
        state: box.state,
      }),
      hooks,
    };
    const first = await applyApprovedCaptureSuggestion(args);
    assert.equal(first.executed.kind, "wrote");
    const second = await applyApprovedCaptureSuggestion(args);
    assert.equal(second.executed.kind, "no_change");
    assert.equal(
      box.state.knowledge[0]!.sections.decisions.filter((b) => /Friday/.test(b))
        .length,
      1,
    );
  });

  await check("D-048 availability Apply twice is one row", async () => {
    const start = candyState();
    const box = { state: clone(start) };
    const hooks = memoryCaptureApplyHooks(box);
    const item: PendingSuggestion = {
      id: "sug-avail-1",
      kind: "availability",
      op: "create",
      content: "Elena is away 20–22 July",
      destination: "project",
      projectId: "proj-candy",
      legalDomain: "availability",
      personId: "p-elena",
      personName: "Elena",
      date: "2026-07-20T12:00:00.000Z",
      proposedValues: {
        awayFromIso: "2026-07-20T12:00:00.000Z",
        awayToIso: "2026-07-22T12:00:00.000Z",
      },
    };
    const args = {
      item,
      text: "Elena is away from 20 July to 22 July",
      projectId: "proj-candy",
      loadWorkspace: async () => ({
        workspaceId: "ws-1",
        userId: "u",
        state: box.state,
      }),
      hooks,
    };
    const first = await applyApprovedCaptureSuggestion(args);
    assert.equal(first.executed.kind, "wrote");
    const second = await applyApprovedCaptureSuggestion(args);
    assert.equal(second.executed.kind, "no_change");
    const rows = (box.state.knowledge[0]!.structured ?? []).filter(
      (r) => r.kind === "availability",
    );
    assert.equal(rows.length, 1);
  });

  console.log(`\n${passed} dogfood integrity gate probes passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
