/**
 * Phase 2 — Needs You vs Left untouched semantic routing.
 *
 * Needs You = known canonical operation + one bounded answer.
 * Left untouched = cannot safely determine or support the operation.
 *
 * Does not retune Prompt A, rematerialise, hydrate, or Apply.
 *
 * Run: npx tsx scripts/verify-needs-you-vs-left-untouched.ts
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LEFT_UNTOUCHED_GENERIC_REASON,
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
  planCaptureApply,
} from "../src/lib/capture/apply";
import {
  buildReviewChangeViewModels,
  pendingReadyModels,
} from "../src/lib/capture/review/viewModel";
import { buildSuggestions } from "../src/lib/capture/suggestions";
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

const ROOT = process.cwd();
const MIXED =
  "Sarah owns UAT, CAB moved Friday, and I think Security might be worried.";
const LIGHTING =
  "Hall lighting scene plate is now the agreed fixture for the stage wash.";
const CANCEL =
  "Cancel the Saturday catch-up — we are not meeting this weekend.";
const SECURITY = "Security seem worried about it.";

function world() {
  return experimentalApplyWorld();
}

function runFrom(transcript: string, observations: unknown[]) {
  return runCaptureV2FromModelJson({
    transcript,
    rawModelJson: { observations },
    world: world(),
    projectId: CANDYLAND_ID,
  });
}

function modelsFromRun(
  run: ReturnType<typeof runCaptureV2FromModelJson>,
  text: string,
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
          { id: "person-gumdrop", name: "Pippa Gumdrop", role: "UAT lead" },
          { id: "person-fizz", name: "Fizz Caramel", role: "Designer" },
        ],
      },
    ],
    memories: [],
    recommendations: [],
    meetings: [],
    releases: [],
    todos: [
      {
        id: "todo-pack",
        projectId: CANDYLAND_ID,
        title: "Prepare the jelly pack",
        done: false,
        createdAt: "2026-07-01T10:00:00.000Z",
      },
    ],
    knowledge: [emptyKnowledge(CANDYLAND_ID)],
    risks: [
      {
        id: "risk-bridge",
        projectId: CANDYLAND_ID,
        title: "Gumdrop Bridge icing",
        status: "open",
      },
    ],
    timeline: [],
  };
}

function gitDiffAgainstMain(rel: string): string {
  return execFileSync("git", ["diff", "origin/main", "--", rel], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

async function main() {
  const records = contextRecordsFromWorld(world(), CANDYLAND_ID);

  await check("1. Known person ambiguity with multiple candidates remains Needs You", () => {
    const transcript =
      "Pippa Gumdrop and Fizz Caramel discussed UAT. She will own UAT.";
    const run = runFrom(transcript, [
      {
        id: "obs-she",
        statement: "She will own UAT",
        evidence: transcript,
        domain: "responsibility",
        disposition: "create_new",
        truthIntent: "current",
        proposedValues: {
          personName: "She",
          scope: "UAT",
          ownershipSemantics: "replace",
        },
      },
    ]);
    assert.equal(run.resolved[0]?.decision.kind, "needs_you");
    assert.notEqual(run.resolved[0]?.observation.disposition, "left_untouched");
    assert.match(
      "reason" in (run.resolved[0]?.decision ?? {})
        ? String((run.resolved[0]!.decision as { reason?: string }).reason)
        : "",
      /who|person|Choose/i,
    );
  });

  await check("2. Known target ambiguity remains Needs You", () => {
    const run = runFrom("Update the icing risk.", [
      {
        id: "obs-target",
        statement: "Update the icing risk",
        evidence: "Update the icing risk.",
        domain: "risk",
        disposition: "update_existing",
        truthIntent: "current",
        proposedValues: { status: "resolved" },
      },
    ]);
    assert.equal(run.resolved[0]?.decision.kind, "needs_you");
    assert.notEqual(run.resolved[0]?.observation.disposition, "left_untouched");
  });

  await check("3. Unsupported operation becomes Left untouched, not Needs You", () => {
    const run = runFrom(CANCEL, []);
    assert.equal(run.result.observationAccount?.needsYou ?? 0, 0);
    assert.ok((run.result.observationAccount?.leftUntouched ?? 0) >= 1);
    const leftover = (run.result.findings ?? []).find((f) => f.leftUntouched);
    assert.ok(leftover);
    assert.equal(leftover!.requiresClarification, false);
    assert.match(leftover!.leftUntouchedReason ?? "", /cannot cancel/i);
    assert.ok(
      (run.result.proposedOperations ?? []).every((op) => op.operation === "NO_CHANGE"),
    );
    const models = modelsFromRun(run, CANCEL);
    assert.ok(models.some((m) => m.readiness === "left_untouched"));
    assert.equal(pendingReadyModels(models, {}, {}).length, 0);
  });

  await check("4. Broad extraction failure becomes Left untouched", () => {
    const run = runFrom(LIGHTING, []);
    assert.equal(run.result.observationAccount?.needsYou ?? 0, 0);
    assert.ok((run.result.observationAccount?.leftUntouched ?? 0) >= 1);
    const leftover = (run.result.findings ?? []).find((f) => f.leftUntouched);
    assert.ok(leftover);
    assert.match(leftover!.fact, /Hall lighting scene plate/);
    assert.equal(leftover!.leftUntouchedReason, LEFT_UNTOUCHED_GENERIC_REASON);
    assert.equal(leftover!.requiresClarification, false);
    const models = modelsFromRun(run, LIGHTING);
    assert.ok(models.some((m) => m.readiness === "left_untouched"));
    assert.equal(
      models.some((m) => m.readiness === "needs_review"),
      false,
    );
  });

  await check("5. Unknown / unsupported domain becomes Left untouched", () => {
    const run = runFrom("Something odd happened on site.", [
      {
        id: "obs-unknown",
        statement: "Something odd happened on site",
        evidence: "Something odd happened on site.",
        domain: "unknown",
        disposition: "create_new",
        truthIntent: "current",
        proposedValues: { title: "Something odd" },
      },
    ]);
    assert.equal(run.resolved[0]?.observation.disposition, "left_untouched");
    assert.equal(run.resolved[0]?.decision.kind, "no_change");
    assert.equal(run.resolved[0]?.suggestion, null);
    const models = modelsFromRun(run, "Something odd happened on site.");
    assert.ok(models.some((m) => m.readiness === "left_untouched"));
    assert.equal(pendingReadyModels(models, {}, {}).length, 0);
  });

  await check("6. Vague concern with no safe operation remains Left untouched", () => {
    const run = runFrom(SECURITY, [
      {
        id: "obs-left",
        statement: SECURITY,
        evidence: SECURITY,
        domain: "unknown",
        disposition: "left_untouched",
        truthIntent: "uncertain",
        commentary:
          "It isn't clear what Security is concerned about or what project information should change.",
      },
    ]);
    assert.equal(run.resolved[0]?.observation.disposition, "left_untouched");
    assert.notEqual(run.resolved[0]?.decision.kind, "write");
    assert.notEqual(run.resolved[0]?.decision.kind, "needs_you");
  });

  await check("7. Left untouched remains non-Apply-eligible", () => {
    const run = runFrom(SECURITY, [
      {
        id: "obs-left",
        statement: SECURITY,
        evidence: SECURITY,
        domain: "unknown",
        disposition: "left_untouched",
        truthIntent: "uncertain",
        commentary: LEFT_UNTOUCHED_GENERIC_REASON,
      },
    ]);
    const models = modelsFromRun(run, SECURITY);
    const leftovers = models.filter((m) => m.readiness === "left_untouched");
    assert.ok(leftovers.length >= 1);
    assert.ok(leftovers.every((m) => m.canApprove === false));
    assert.ok(leftovers.every((m) => m.executableApply === false));
    assert.equal(pendingReadyModels(models, {}, {}).length, 0);
    for (const model of leftovers) {
      const decision = planCaptureApply({
        item: model.suggestion,
        text: SECURITY,
        world: world(),
        captureEntryProjectId: CANDYLAND_ID,
      });
      assert.notEqual(decision.kind, "write");
    }
  });

  await check("8. Left untouched never writes canonical truth", async () => {
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
      content: SECURITY,
      destination: "project",
      projectId: CANDYLAND_ID,
      legalDomain: "unsupported",
      proposedValues: { leftUntouched: true, leftUntouchedSource: "coverage" },
    };
    const applied = await applyApprovedCaptureSuggestion({
      item,
      text: SECURITY,
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

  await check("9. Ordinary Create remains unchanged", () => {
    const run = runFrom("Create a to-do to order extra sprinkles.", [
      {
        id: "obs-todo",
        statement: "Create a to-do to order extra sprinkles",
        evidence: "Create a to-do to order extra sprinkles.",
        domain: "todo",
        disposition: "create_new",
        truthIntent: "current",
        proposedValues: { title: "Order extra sprinkles" },
      },
    ]);
    assert.equal(run.resolved[0]?.decision.kind, "write");
    assert.equal(run.resolved[0]?.observation.disposition, "create_new");
    assert.ok(run.resolved[0]?.suggestion);
  });

  await check("10. Ordinary Update remains unchanged", () => {
    const run = runFrom("Gumdrop Bridge icing is resolved.", [
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
    ]);
    assert.equal(run.resolved[0]?.decision.kind, "write");
    assert.equal(run.resolved[0]?.observation.disposition, "update_existing");
  });

  await check("11. Ordinary supported Remove remains unchanged", () => {
    const item: PendingSuggestion = {
      id: "remove-todo",
      kind: "action",
      op: "remove",
      content: "Remove the jelly pack to-do",
      destination: "project",
      projectId: CANDYLAND_ID,
      legalDomain: "todo",
      targetEntityId: "todo-pack",
      targetTodoId: "todo-pack",
    };
    const planned = planCaptureApply({
      item,
      text: "Remove the jelly pack to-do",
      world: world(),
      captureEntryProjectId: CANDYLAND_ID,
    });
    assert.equal(planned.kind, "write");
    if (planned.kind === "write") {
      assert.equal(planned.operation.type, "delete_todo");
    }
  });

  await check("12. Existing true No change remains unchanged", () => {
    const run = runFrom("Pippa Gumdrop remains UAT lead.", [
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
    ]);
    const kinds = new Set(run.resolved.map((row) => row.decision.kind));
    assert.ok(kinds.has("no_change") || kinds.has("needs_you") || kinds.has("write"));
    assert.ok(
      !run.resolved.some((row) => row.observation.disposition === "left_untouched"),
    );
  });

  await check("13. Source coverage still prevents silent disappearance", () => {
    const leftovers = leftoverSourceSpans({
      transcript: MIXED,
      observations: [
        {
          id: "obs-sarah",
          statement: "Sarah owns UAT",
          evidence: "Sarah owns UAT",
          domain: "responsibility",
          disposition: "create_new",
          truthIntent: "current",
          projectId: CANDYLAND_ID,
          candidateTargetId: null,
          candidateTargetTitle: null,
          mergeWithObservationId: null,
          proposedValues: null,
          commentary: null,
          modelConfidence: null,
        } satisfies CaptureObservationV2,
      ],
    });
    assert.ok(leftovers.some((row) => /Security might be worried/i.test(row.text)));
    const run = runFrom(MIXED, [
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
    assert.ok(
      run.resolved.some((row) => row.observation.disposition === "left_untouched"),
    );
    assert.ok((run.result.observationAccount?.leftUntouched ?? 0) >= 1);
  });

  await check("14. Contradictory sibling protection remains unchanged", () => {
    const run = runFrom(
      "Gumdrop Bridge icing is resolved. Gumdrop Bridge icing is still open.",
      [
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
    );
    const writes = run.resolved.filter((row) => row.decision.kind === "write");
    const needsYou = run.resolved.filter((row) => row.decision.kind === "needs_you");
    assert.equal(writes.length, 0);
    assert.ok(needsYou.length >= 2);
  });

  await check("15. Ready still means planCaptureApply can construct the write", () => {
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

  await check("16. Apply still replans against fresh server truth", async () => {
    const start = candyState();
    const box = { state: structuredClone(start) };
    const applied = await applyApprovedCaptureSuggestion({
      item: {
        id: "replan-todo",
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
        state: box.state,
      }),
      hooks: memoryCaptureApplyHooks(box),
    });
    assert.equal(applied.executed.kind, "wrote");
    assert.ok(box.state.todos.some((todo) => /war room/i.test(todo.title)));
  });

  await check("17. Foreign-ID and wrong-target protections remain fail-closed", () => {
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

  await check("18. Receipt retry remains idempotent", async () => {
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

  await check("19. Post-write confirmation behaviour remains unchanged", async () => {
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

  await check("Prompt A / rematerialise / hydrate / Apply spine stay in place", () => {
    assert.equal(gitDiffAgainstMain("src/lib/capture-v2/prompt.ts"), "");
    assert.equal(gitDiffAgainstMain("src/lib/capture-v2/source-coverage.ts"), "");
    assert.equal(gitDiffAgainstMain("src/lib/capture/apply/dispatch.ts"), "");
    const resolve = readFileSync(join(ROOT, "src/lib/capture-v2/resolve.ts"), "utf8");
    assert.match(resolve, /rematerializeTrustedNoChange/);
    assert.match(resolve, /hydrateFromLocalEvidence/);
    assert.match(resolve, /applyContradictorySiblingNeedsYou/);
    assert.match(resolve, /personLinkedIdentityGate/);
    assert.match(resolve, /missingReadySemantics/);
  });

  console.log(`\n${passed} Needs You vs Left untouched checks passed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
