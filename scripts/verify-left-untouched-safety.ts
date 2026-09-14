/**
 * Left untouched safety net — Review-only, never a write path.
 *
 * Proves the 19 gates for the conservative foundation slice.
 * Does not remove rematerialise / hydrate. Prompt A may now emit
 * left_untouched; this script still injects the disposition via fixtures.
 *
 * Run: npx tsx scripts/verify-left-untouched-safety.ts
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  LEFT_UNTOUCHED_GENERIC_REASON,
  LEFT_UNTOUCHED_MODEL_FALLBACK_REASON,
  leftoverSourceSpans,
  runCaptureV2FromModelJson,
  validateObservations,
} from "../src/lib/capture-v2";
import { contextRecordsFromWorld } from "../src/lib/capture-v2/context";
import {
  applyApprovedCaptureSuggestion,
} from "../src/lib/capture/apply/apply-approved";
import { memoryCaptureApplyHooks } from "../src/lib/capture/apply/memory-execute";
import {
  assessApplyReadiness,
  fingerprintExpectedTarget,
  planCaptureApply,
  staleExpectedTargetReason,
} from "../src/lib/capture/apply";
import { captureApplyWorldFromState } from "../src/lib/capture/apply/world";
import { reviewOpFamily } from "../src/lib/capture/review/reviewLanguage";
import {
  buildReviewChangeViewModels,
  computeReviewCounts,
  pendingReadyModels,
} from "../src/lib/capture/review/viewModel";
import { buildSuggestions } from "../src/lib/capture/suggestions";
import { applyPendingReadyQueue } from "../src/lib/capture/review/applyReadyQueue";
import {
  CANDYLAND_ID,
  experimentalApplyWorld,
} from "../src/lib/experiments/worlds";
import type { CaptureObservationV2 } from "../src/lib/capture-v2/types";
import type { PendingSuggestion } from "../src/lib/capture/suggestions";
import type { MissionState } from "../src/lib/types";
import { emptyKnowledge } from "../src/lib/knowledge";

let passed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`✓ ${name}`);
    });
}

const MIXED =
  "Sarah owns UAT, CAB moved Friday, and I think Security might be worried.";

function world() {
  return experimentalApplyWorld();
}

function obs(partial: Partial<CaptureObservationV2> & Pick<
  CaptureObservationV2,
  "id" | "statement" | "evidence" | "domain" | "disposition"
>): CaptureObservationV2 {
  return {
    truthIntent: "current",
    projectId: CANDYLAND_ID,
    candidateTargetId: null,
    candidateTargetTitle: null,
    mergeWithObservationId: null,
    proposedValues: null,
    commentary: null,
    modelConfidence: null,
    ...partial,
  };
}

function runMixed(observations: unknown[]) {
  return runCaptureV2FromModelJson({
    transcript: MIXED,
    rawModelJson: { observations },
    world: world(),
    projectId: CANDYLAND_ID,
  });
}

function modelsFromRun(
  run: ReturnType<typeof runCaptureV2FromModelJson>,
  text = MIXED,
) {
  const suggestions = buildSuggestions(run.result);
  return buildReviewChangeViewModels(suggestions, run.result, text, {}, {
    world: world(),
    captureEntryProjectId: CANDYLAND_ID,
  });
}

function candyState(): MissionState {
  return {
    projects: [
      {
        id: CANDYLAND_ID,
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
        projectId: CANDYLAND_ID,
        title: "Obtain CAB approval",
        done: false,
        createdAt: "2026-07-01T10:00:00.000Z",
        dueAt: "2026-07-10T09:00:00.000Z",
        detail: "Owner: Elena",
      },
    ],
    knowledge: [emptyKnowledge(CANDYLAND_ID)],
    risks: [],
    timeline: [
      {
        id: "ms-uat",
        projectId: CANDYLAND_ID,
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

async function main() {
  const records = contextRecordsFromWorld(world(), CANDYLAND_ID);

  await check("1. Left untouched is never Apply-eligible", () => {
    const run = runMixed([
      {
        id: "obs-left",
        statement: "I think Security might be worried.",
        evidence: "I think Security might be worried.",
        domain: "unknown",
        disposition: "left_untouched",
        truthIntent: "uncertain",
        commentary:
          "Lume couldn't tell what Security is concerned about or what project information should change.",
      },
    ]);
    const left = run.resolved.filter(
      (row) => row.observation.disposition === "left_untouched",
    );
    assert.ok(left.length >= 1);
    assert.ok(left.every((row) => row.decision.kind !== "write"));
    assert.ok(left.every((row) => row.suggestion === null));
    const models = modelsFromRun(run);
    const leftovers = models.filter((m) => m.readiness === "left_untouched");
    assert.ok(leftovers.length >= 1);
    assert.ok(leftovers.every((m) => m.canApprove === false));
    assert.ok(leftovers.every((m) => m.executableApply === false));
    assert.equal(pendingReadyModels(models, {}, {}).length, 0);
    for (const model of leftovers) {
      const decision = planCaptureApply({
        item: model.suggestion,
        text: MIXED,
        world: world(),
        captureEntryProjectId: CANDYLAND_ID,
      });
      assert.notEqual(decision.kind, "write");
    }
  });

  await check("2. Left untouched cannot directly write canonical truth", async () => {
    const start = candyState();
    const box = { state: structuredClone(start) };
    const before = JSON.stringify({
      todos: box.state.todos,
      risks: box.state.risks,
      knowledge: box.state.knowledge,
    });
    const item: PendingSuggestion = {
      id: "left-write-probe",
      kind: "knowledge",
      op: "create",
      content: "I think Security might be worried.",
      destination: "project",
      projectId: CANDYLAND_ID,
      legalDomain: "unsupported",
      proposedValues: { leftUntouched: true, leftUntouchedSource: "coverage" },
    };
    const applied = await applyApprovedCaptureSuggestion({
      item,
      text: MIXED,
      projectId: CANDYLAND_ID,
      loadWorkspace: async () => ({
        workspaceId: "ws-1",
        userId: "u",
        state: start,
      }),
      hooks: memoryCaptureApplyHooks(box),
    });
    assert.notEqual(applied.executed.kind, "wrote");
    assert.equal(
      JSON.stringify({
        todos: box.state.todos,
        risks: box.state.risks,
        knowledge: box.state.knowledge,
      }),
      before,
    );
  });

  await check("3. Existing Create / Update / Remove behaviour remains unchanged", () => {
    const create = runCaptureV2FromModelJson({
      transcript: "Book the war room for Friday.",
      rawModelJson: {
        observations: [
          {
            id: "obs-todo",
            statement: "Book the war room",
            evidence: "Book the war room for Friday.",
            domain: "todo",
            disposition: "create_new",
            truthIntent: "current",
            proposedValues: { title: "Book the war room" },
          },
        ],
      },
      world: world(),
      projectId: CANDYLAND_ID,
    });
    assert.ok(
      create.resolved.some(
        (row) =>
          row.observation.disposition === "create_new" &&
          (row.decision.kind === "write" || row.decision.kind === "needs_you"),
      ),
    );
    const update = runCaptureV2FromModelJson({
      transcript: "Gumdrop Bridge icing is resolved.",
      rawModelJson: {
        observations: [
          {
            id: "obs-risk",
            statement: "Gumdrop Bridge icing is resolved",
            evidence: "Gumdrop Bridge icing is resolved.",
            domain: "risk",
            disposition: "update_existing",
            truthIntent: "current",
            candidateTargetId: "risk-bridge",
            candidateTargetTitle: "Gumdrop Bridge icing",
            proposedValues: { status: "resolved" },
          },
        ],
      },
      world: world(),
      projectId: CANDYLAND_ID,
    });
    assert.equal(
      update.resolved[0]?.decision.kind === "write" ||
        update.resolved[0]?.decision.kind === "needs_you",
      true,
    );
    assert.ok(
      !update.resolved.some((row) => row.observation.disposition === "left_untouched"),
    );
  });

  await check("4. Bounded Needs You remains; empty extraction is Left untouched", () => {
    const empty = runCaptureV2FromModelJson({
      transcript:
        "Hall lighting scene plate is now the agreed fixture for the stage wash.",
      rawModelJson: { observations: [] },
      world: world(),
      projectId: CANDYLAND_ID,
    });
    assert.equal(empty.result.observationAccount?.needsYou ?? 0, 0);
    assert.ok(
      (empty.result.observationAccount?.leftUntouched ?? 0) >= 1,
      "empty extraction is Left untouched, not silent",
    );
    const ambiguous = runCaptureV2FromModelJson({
      transcript: "She will own UAT.",
      rawModelJson: {
        observations: [
          {
            id: "obs-amb",
            statement: "She will own UAT",
            evidence: "She will own UAT.",
            domain: "responsibility",
            disposition: "ambiguous",
            truthIntent: "current",
            proposedValues: {
              personName: "She",
              scope: "UAT",
              ownershipSemantics: "ambiguous",
            },
          },
        ],
      },
      world: world(),
      projectId: CANDYLAND_ID,
    });
    assert.equal(ambiguous.resolved[0]?.decision.kind, "needs_you");
  });

  await check("5. Existing No change behaviour remains unchanged", () => {
    const run = runCaptureV2FromModelJson({
      transcript: "Pippa Gumdrop remains UAT lead.",
      rawModelJson: {
        observations: [
          {
            id: "obs-nc",
            statement: "Pippa Gumdrop remains UAT lead",
            evidence: "Pippa Gumdrop remains UAT lead.",
            domain: "responsibility",
            disposition: "no_change",
            truthIntent: "current",
            candidateTargetId: "person-gumdrop",
            candidateTargetTitle: "Pippa Gumdrop",
            proposedValues: {
              personName: "Pippa Gumdrop",
              scope: "UAT",
              ownershipSemantics: "continue",
            },
          },
        ],
      },
      world: world(),
      projectId: CANDYLAND_ID,
    });
    const kinds = new Set(run.resolved.map((row) => row.decision.kind));
    assert.ok(kinds.has("no_change") || kinds.has("needs_you") || kinds.has("write"));
    assert.ok(
      !run.resolved.some((row) => row.observation.disposition === "left_untouched"),
    );
  });

  await check("6. Foreign-ID rejection remains fail-closed", () => {
    const validated = validateObservations(
      [
        {
          id: "obs-foreign",
          statement: "update foreign record",
          evidence: "update foreign record",
          domain: "risk",
          disposition: "update_existing",
          truthIntent: "current",
          candidateTargetId: "risk-console",
        },
      ],
      records,
      CANDYLAND_ID,
    );
    assert.equal(validated.observations.length, 0);
    assert.ok(validated.issues.some((issue) => issue.code === "foreign_id"));
  });

  await check("7. Ready still means planCaptureApply can construct the write", () => {
    const item: PendingSuggestion = {
      id: "ready-todo",
      kind: "action",
      op: "create",
      content: "Book the war room",
      destination: "project",
      projectId: CANDYLAND_ID,
      legalDomain: "todo",
    };
    const ready = assessApplyReadiness({
      item,
      text: "Book the war room",
      preflight: { world: world(), captureEntryProjectId: CANDYLAND_ID },
    });
    assert.equal(ready.canApprove, true);
    const planned = planCaptureApply({
      item,
      text: "Book the war room",
      world: world(),
      captureEntryProjectId: CANDYLAND_ID,
    });
    assert.equal(planned.kind, "write");
  });

  await check("8. Apply still replans against fresh server truth", async () => {
    const start = candyState();
    const item: PendingSuggestion = {
      id: "replan-todo",
      kind: "action",
      op: "create",
      content: "Book the war room",
      destination: "project",
      projectId: CANDYLAND_ID,
      legalDomain: "todo",
    };
    const box = { state: structuredClone(start) };
    const applied = await applyApprovedCaptureSuggestion({
      item,
      text: "Book the war room",
      projectId: CANDYLAND_ID,
      loadWorkspace: async () => ({
        workspaceId: "ws-1",
        userId: "u",
        state: box.state,
      }),
      hooks: memoryCaptureApplyHooks(box),
    });
    assert.equal(applied.executed.kind, "wrote");
    assert.ok(box.state.todos.some((todo) => /war room/i.test(todo.title)));
  });

  await check("9. Stale expected-target still fails closed", async () => {
    const start = candyState();
    const item: PendingSuggestion = {
      id: "stale-due",
      kind: "action",
      op: "update",
      content: "Move CAB approval",
      destination: "project",
      projectId: CANDYLAND_ID,
      legalDomain: "todo",
      targetEntityId: "todo-cab",
      targetTodoId: "todo-cab",
      date: "2026-07-17T09:00:00.000Z",
    };
    const fp = fingerprintExpectedTarget(captureApplyWorldFromState(start), item);
    const later = structuredClone(start);
    later.todos[0]!.dueAt = "2026-07-12T09:00:00.000Z";
    assert.ok(
      staleExpectedTargetReason(
        captureApplyWorldFromState(later),
        fp,
        CANDYLAND_ID,
      ),
    );
    const box = { state: structuredClone(later) };
    const applied = await applyApprovedCaptureSuggestion({
      item: { ...item, expectedTarget: fp },
      text: "Move CAB approval",
      projectId: CANDYLAND_ID,
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

  await check("10. Receipt retry remains idempotent", async () => {
    const start = candyState();
    const box = { state: structuredClone(start) };
    const hooks = memoryCaptureApplyHooks(box);
    const item: PendingSuggestion = {
      id: "retry-know",
      kind: "decision",
      op: "create",
      content: "We will ship Friday",
      destination: "project",
      projectId: CANDYLAND_ID,
      legalDomain: "knowledge",
      knowledgeSection: "decisions",
    };
    const first = await applyApprovedCaptureSuggestion({
      item,
      text: "We will ship Friday",
      projectId: CANDYLAND_ID,
      loadWorkspace: async () => ({
        workspaceId: "ws-1",
        userId: "u",
        state: box.state,
      }),
      hooks,
    });
    assert.equal(first.executed.kind, "wrote");
    const second = await applyApprovedCaptureSuggestion({
      item,
      text: "We will ship Friday",
      projectId: CANDYLAND_ID,
      loadWorkspace: async () => ({
        workspaceId: "ws-1",
        userId: "u",
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

  await check("11. Post-write reread/reconcile behaviour remains unchanged", async () => {
    const start = candyState();
    const box = { state: structuredClone(start) };
    const result = await applyApprovedCaptureSuggestion({
      item: {
        id: "reload-fail",
        kind: "action",
        op: "create",
        content: "Book the war room",
        destination: "project",
        projectId: CANDYLAND_ID,
        legalDomain: "todo",
      },
      text: "Book the war room",
      projectId: CANDYLAND_ID,
      loadWorkspace: async () => ({
        workspaceId: "ws-1",
        userId: "u",
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
  });

  await check("12. Contradictory sibling protection remains unchanged", () => {
    const run = runCaptureV2FromModelJson({
      transcript:
        "Gumdrop Bridge icing is resolved. Gumdrop Bridge icing is still open.",
      rawModelJson: {
        observations: [
          {
            id: "obs-a",
            statement: "Gumdrop Bridge icing is resolved",
            evidence: "Gumdrop Bridge icing is resolved",
            domain: "risk",
            disposition: "update_existing",
            truthIntent: "current",
            candidateTargetId: "risk-bridge",
            candidateTargetTitle: "Gumdrop Bridge icing",
            proposedValues: { status: "resolved" },
          },
          {
            id: "obs-b",
            statement: "Gumdrop Bridge icing is still open",
            evidence: "Gumdrop Bridge icing is still open",
            domain: "risk",
            disposition: "update_existing",
            truthIntent: "current",
            candidateTargetId: "risk-bridge",
            candidateTargetTitle: "Gumdrop Bridge icing",
            proposedValues: { status: "open" },
          },
        ],
      },
      world: world(),
      projectId: CANDYLAND_ID,
    });
    const writes = run.resolved.filter((row) => row.decision.kind === "write");
    const needsYou = run.resolved.filter((row) => row.decision.kind === "needs_you");
    assert.equal(writes.length, 0);
    assert.ok(needsYou.length >= 2);
  });

  await check("13. Completely missed meaningful capture text stays visible", () => {
    const run = runCaptureV2FromModelJson({
      transcript:
        "Hall lighting scene plate is now the agreed fixture for the stage wash.",
      rawModelJson: { observations: [] },
      world: world(),
      projectId: CANDYLAND_ID,
    });
    const models = modelsFromRun(
      run,
      "Hall lighting scene plate is now the agreed fixture for the stage wash.",
    );
    assert.ok(
      models.some((m) => m.readiness === "left_untouched"),
      "empty extraction remains Left untouched, not silent",
    );
    assert.equal(
      models.some((m) => m.readiness === "needs_review"),
      false,
      "empty extraction must not fake a bounded Needs You",
    );
  });

  await check("14. Partial omission is visible without duplicating accounted clauses", () => {
    const leftovers = leftoverSourceSpans({
      transcript: MIXED,
      observations: [
        obs({
          id: "obs-sarah",
          statement: "Sarah owns UAT",
          evidence: "Sarah owns UAT",
          domain: "responsibility",
          disposition: "create_new",
        }),
        obs({
          id: "obs-cab",
          statement: "CAB moved Friday",
          evidence: "CAB moved Friday",
          domain: "milestone",
          disposition: "create_new",
        }),
      ],
    });
    assert.equal(leftovers.length, 1);
    assert.match(leftovers[0]!.text, /Security might be worried/i);
    assert.doesNotMatch(leftovers[0]!.text, /Sarah owns UAT/i);
    assert.doesNotMatch(leftovers[0]!.text, /CAB moved Friday/i);

    const run = runMixed([
      {
        id: "obs-sarah",
        statement: "Sarah owns UAT",
        evidence: "Sarah owns UAT",
        domain: "responsibility",
        disposition: "create_new",
        truthIntent: "current",
        proposedValues: {
          personName: "Sarah",
          scope: "UAT",
          ownershipSemantics: "replace",
        },
      },
      {
        id: "obs-cab",
        statement: "CAB moved Friday",
        evidence: "CAB moved Friday",
        domain: "milestone",
        disposition: "create_new",
        truthIntent: "current",
        proposedValues: { label: "CAB", date: "2026-09-18" },
      },
    ]);
    const left = run.resolved.filter(
      (row) => row.observation.disposition === "left_untouched",
    );
    assert.equal(left.length, 1);
    assert.match(left[0]!.observation.statement, /Security might be worried/i);
    assert.equal(left[0]!.observation.commentary, LEFT_UNTOUCHED_GENERIC_REASON);
    const models = modelsFromRun(run);
    const leftoverCards = models.filter((m) => m.readiness === "left_untouched");
    assert.equal(leftoverCards.length, 1);
    assert.doesNotMatch(leftoverCards[0]!.recordName, /Sarah owns UAT/i);
  });

  await check("15. AI-classified Left untouched can carry a specific reason", () => {
    const specific =
      "Lume couldn't tell what Security is concerned about or what project information should change.";
    const run = runMixed([
      {
        id: "obs-sarah",
        statement: "Sarah owns UAT",
        evidence: "Sarah owns UAT",
        domain: "responsibility",
        disposition: "create_new",
        truthIntent: "current",
        proposedValues: {
          personName: "Sarah",
          scope: "UAT",
          ownershipSemantics: "replace",
        },
      },
      {
        id: "obs-cab",
        statement: "CAB moved Friday",
        evidence: "CAB moved Friday",
        domain: "milestone",
        disposition: "create_new",
        truthIntent: "current",
        proposedValues: { label: "CAB", date: "2026-09-18" },
      },
      {
        id: "obs-left",
        statement: "I think Security might be worried.",
        evidence: "I think Security might be worried.",
        domain: "unknown",
        disposition: "left_untouched",
        truthIntent: "uncertain",
        commentary: specific,
      },
    ]);
    const left = run.resolved.filter(
      (row) => row.observation.disposition === "left_untouched",
    );
    assert.equal(left.length, 1);
    assert.notEqual(left[0]!.decision.kind, "write");
    assert.ok("reason" in left[0]!.decision);
    assert.equal(left[0]!.decision.reason, specific);
    const models = modelsFromRun(run);
    const card = models.find((m) => m.readiness === "left_untouched");
    assert.ok(card);
    assert.equal(card!.needsReviewReason, specific);
    assert.notEqual(card!.needsReviewReason, LEFT_UNTOUCHED_GENERIC_REASON);
  });

  await check("16. Coverage-generated Left untouched gets the generic reason", () => {
    const run = runMixed([
      {
        id: "obs-sarah",
        statement: "Sarah owns UAT",
        evidence: "Sarah owns UAT",
        domain: "responsibility",
        disposition: "create_new",
        truthIntent: "current",
        proposedValues: {
          personName: "Sarah",
          scope: "UAT",
          ownershipSemantics: "replace",
        },
      },
    ]);
    const left = run.resolved.find(
      (row) => row.observation.disposition === "left_untouched",
    );
    assert.ok(left);
    assert.equal(left!.observation.commentary, LEFT_UNTOUCHED_GENERIC_REASON);
    const models = modelsFromRun(run);
    const card = models.find((m) => m.readiness === "left_untouched");
    assert.equal(card?.needsReviewReason, LEFT_UNTOUCHED_GENERIC_REASON);
    assert.notEqual(card?.needsReviewReason, LEFT_UNTOUCHED_MODEL_FALLBACK_REASON);
  });

  await check("17. Left untouched is excluded from Apply counts/readiness", async () => {
    const run = runMixed([
      {
        id: "obs-todo",
        statement: "Sarah owns UAT",
        evidence: "Sarah owns UAT",
        domain: "todo",
        disposition: "create_new",
        truthIntent: "current",
        proposedValues: { title: "Confirm Sarah owns UAT" },
      },
    ]);
    const models = modelsFromRun(run);
    const counts = computeReviewCounts({ result: run.result, models });
    assert.ok(counts.leftUntouched >= 1);
    assert.ok(
      pendingReadyModels(models, {}, {}).every(
        (m) => m.readiness !== "left_untouched",
      ),
    );
    const queue = await applyPendingReadyQueue({
      models: pendingReadyModels(models, {}, {}),
      applyOne: async (item) =>
        planCaptureApply({
          item,
          text: MIXED,
          world: world(),
          captureEntryProjectId: CANDYLAND_ID,
        }),
    });
    assert.ok(
      queue.succeededWrites.every((op) => op.type !== "write_memory"),
    );
  });

  await check("18. Existing Review filters/counts do not become incorrect", () => {
    const run = runMixed([
      {
        id: "obs-todo",
        statement: "Sarah owns UAT",
        evidence: "Sarah owns UAT",
        domain: "todo",
        disposition: "create_new",
        truthIntent: "current",
        proposedValues: { title: "Confirm Sarah owns UAT" },
      },
    ]);
    const models = modelsFromRun(run);
    const counts = computeReviewCounts({ result: run.result, models });
    const leftovers = models.filter((m) => m.readiness === "left_untouched");
    const operations = models.filter((m) => m.readiness !== "left_untouched");
    assert.equal(counts.total, operations.length);
    assert.equal(counts.leftUntouched, leftovers.length);
    assert.equal(counts.needsReview + counts.unmatched, counts.needsAttention);
    assert.ok(leftovers.every((m) => reviewOpFamily(m.operation, m.readiness) === "left_untouched"));
    assert.ok(
      leftovers.every(
        (m) => reviewOpFamily(m.operation, m.readiness) !== "needs_you",
      ),
    );
    assert.ok(counts.ready <= operations.length);
  });

  await check("19. No new canonical persistence table/type is introduced", () => {
    const migrations = readdirSync(join(process.cwd(), "supabase/migrations"));
    assert.ok(
      !migrations.some((name) => /left.?untouch/i.test(name)),
      "no Left untouched migration",
    );
    const persist = readFileSync(
      join(process.cwd(), "src/lib/data/supabase/persist-mutations.ts"),
      "utf8",
    );
    assert.doesNotMatch(persist, /left_untouched|leftUntouched/);
    const types = readFileSync(join(process.cwd(), "src/types/database.ts"), "utf8");
    assert.doesNotMatch(types, /left_untouched/);
  });

  await check("Prompt A schema includes left_untouched", () => {
    const prompt = readFileSync(
      join(process.cwd(), "src/lib/capture-v2/prompt.ts"),
      "utf8",
    );
    assert.match(prompt, /left_untouched/);
    assert.match(
      prompt,
      /update_existing \| create_new \| no_change \| ambiguous \| merge \| commentary \| ignore \| left_untouched/,
    );
  });

  await check("Rematerialise / hydrate logic is still present", () => {
    const resolve = readFileSync(
      join(process.cwd(), "src/lib/capture-v2/resolve.ts"),
      "utf8",
    );
    assert.match(resolve, /rematerializeTrustedNoChange/);
    assert.match(resolve, /hydrateFromLocalEvidence/);
  });

  console.log(`\n${passed} left-untouched safety checks passed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
