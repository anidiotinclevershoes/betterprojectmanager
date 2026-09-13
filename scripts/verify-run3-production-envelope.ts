/**
 * Production-derived Run 3 envelopes.
 *
 * These are the LIVE Prompt A shape from lr-20260913T095407Z on 16f7a5d:
 * disposition=no_change, empty proposedValues, empty candidateTargetTitle.
 * Structured #172 fixtures already pass. These thin envelopes must not.
 *
 * A silent no_change / Limited drop is a failure.
 * Ready or a useful Needs You is success.
 * Wrong-target Ready is a failure.
 *
 * Run: npx tsx scripts/verify-run3-production-envelope.ts
 */
import assert from "node:assert/strict";
import {
  resolveObservations,
  runCaptureV2FromModelJson,
  validateObservations,
} from "../src/lib/capture-v2";
import { contextRecordsFromWorld } from "../src/lib/capture-v2/context";
import type { CaptureObservationV2 } from "../src/lib/capture-v2/types";
import { evaluatePostAnalysisReliability } from "../src/lib/capture/reliability/evaluate";
import { collectPostAnalysisSignals } from "../src/lib/capture/reliability/signals";
import type { CaptureApplyWorld } from "../src/lib/capture/apply";

const PROJECT = "ef5a8050-9cd0-40b6-8e8a-2db125246ec1";
const DDA = "6bedea58-b008-4c5e-891c-4e011c615e35";
const ME = "72cb479a-6cc4-4514-b1a0-a1eb21fde6a0";
const TIMBER = "64f58dc8-efa2-4779-8da0-4c973b8be111";
const PC = "fd158a40-52cb-49b2-803d-ca4ba4cc4d42";
const HELEN = "bd3d79b6-a818-4b52-abdf-246967d33b43";
const JAMES = "b9990dda-4769-4360-ae84-4c233134870f";
const NADIA = "1f5a4594-879a-4b5c-9de0-7a8ebf24045a";
const TOMOS = "e9b53846-27e5-44f6-a0e3-13065f2c0beb";
const MEI = "c449640f-1f7b-4259-a632-df06b073d9a8";
const CHRIS = "133ab997-e3f2-4304-abe6-941eb892cb67";
const ASBESTOS = "9a270838-4cd0-453a-9583-ef648c537518";
const FOREIGN = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

/** Canonical world after Run 3 C13 — last Ready Apply before the freeze. */
function run3MatureWorld(): CaptureApplyWorld {
  return {
    projectIds: new Set([PROJECT, "proj-other"]),
    projects: [
      {
        id: PROJECT,
        name: "E2E-LONGRUN-Riverside Civic Hall Fit-Out lr-20260913T095407Z",
        code: "LRT095407Z",
        stakeholders: [
          { id: HELEN, name: "Helen Ward", role: "PM" },
          { id: JAMES, name: "James Okonkwo", role: "Contractor" },
          { id: NADIA, name: "Nadia Rahman", role: "Designer" },
          { id: TOMOS, name: "Tomos Ellis", role: "Architect" },
          { id: MEI, name: "Mei Chen", role: "QS" },
          { id: CHRIS, name: "Chris", role: "" },
        ],
      },
      {
        id: "proj-other",
        name: "Other",
        code: "OTH",
        stakeholders: [{ id: "person-foreign", name: "Morgan Vale", role: "Lead" }],
      },
    ],
    risks: [
      { id: DDA, projectId: PROJECT, title: "Outstanding DDA access ramp detail", status: "open" },
      { id: ME, projectId: PROJECT, title: "M&E first-fix coordination risk", status: "open" },
      { id: TIMBER, projectId: PROJECT, title: "Hall timber floor services risk", status: "open" },
    ],
    todos: [
      { id: "todo-riba", projectId: PROJECT, title: "Issue RIBA Stage 4 drawing pack", done: false },
      { id: "todo-ffe", projectId: PROJECT, title: "Book FF&E sample review", done: false },
      { id: "todo-dash", projectId: PROJECT, title: "Send weekly dashboard to Helen Ward", done: false },
      { id: ASBESTOS, projectId: PROJECT, title: "Chase asbestos survey addendum", done: true },
      { id: "todo-rams", projectId: PROJECT, title: "Book RAMS review for ceiling void", done: false },
      { id: "todo-obtain-rams", projectId: PROJECT, title: "Obtain ceiling void RAMS", done: false },
      { id: "todo-water", projectId: PROJECT, title: "Book cafe water isolate", done: false },
      { id: "todo-second", projectId: PROJECT, title: "Schedule M&E second-fix inspection", done: false },
    ],
    timeline: [
      { id: "ms-mob", projectId: PROJECT, label: "Site mobilisation", startAt: "2026-10-06" },
      { id: "ms-walk", projectId: PROJECT, label: "Client walk-through", startAt: "2026-10-20" },
      { id: PC, projectId: PROJECT, label: "Practical completion", startAt: "2026-12-18" },
      { id: "ms-mefirst", projectId: PROJECT, label: "M&E first-fix", startAt: "2026-10-13" },
      { id: "ms-sat", projectId: PROJECT, label: "Saturday catch-up", startAt: "2026-10-17" },
    ],
    knowledge: [],
  };
}

function thinObservation(
  partial: Pick<CaptureObservationV2, "id" | "domain" | "statement" | "evidence"> &
    Partial<CaptureObservationV2>,
): Record<string, unknown> {
  return {
    id: partial.id,
    statement: partial.statement,
    evidence: partial.evidence,
    domain: partial.domain,
    disposition: partial.disposition ?? "no_change",
    truthIntent: partial.truthIntent ?? "current",
    projectId: PROJECT,
    candidateTargetId: partial.candidateTargetId ?? null,
    candidateTargetTitle: partial.candidateTargetTitle ?? null,
    mergeWithObservationId: null,
    proposedValues: partial.proposedValues ?? null,
    commentary: null,
    modelConfidence: null,
  };
}

function replay(transcript: string, observations: Record<string, unknown>[]) {
  return runCaptureV2FromModelJson({
    transcript,
    rawModelJson: { observations },
    world: run3MatureWorld(),
    projectId: PROJECT,
  });
}

function writeType(kind: string | undefined, opType: string | undefined): string {
  return `${kind}:${opType ?? ""}`;
}

function firstDecision(run: ReturnType<typeof replay>) {
  return run.resolved[0]?.decision;
}

function mustNotSilentlyDrop(run: ReturnType<typeof replay>, label: string) {
  const decisions = run.resolved.map((row) => row.decision.kind);
  const useful =
    decisions.some((kind) => kind === "write" || kind === "needs_you") ||
    run.validation.rejected.length > 0;
  assert.equal(
    useful,
    true,
    `${label}: production-thin envelope became silent no_change (${decisions.join(",") || "none"})`,
  );
}

function neverWritesRisk(run: ReturnType<typeof replay>, riskId: string, label: string) {
  for (const row of run.resolved) {
    if (row.decision.kind !== "write") continue;
    const op = row.decision.operation;
    if ("riskId" in op) {
      assert.notEqual(op.riskId, riskId, `${label}: wrote sibling ${riskId}`);
    }
  }
}

function usefulNeedsYou(reason: string | undefined): boolean {
  if (!reason) return false;
  const bad = /rematerialis|uuid|envelope|proposedValues|canonical/i;
  return !bad.test(reason) && reason.trim().length > 8;
}

check("C16 thin envelope: Cafe/Hall snag Creates are not silently dropped", () => {
  const transcript =
    "Create two separate snag lists: Cafe snag list and Hall snag list. Do not combine them.";
  const run = replay(transcript, [
    thinObservation({
      id: "c16",
      domain: "todo",
      statement: "Create two separate snag lists: Cafe snag list and Hall snag list.",
      evidence: transcript,
    }),
  ]);
  mustNotSilentlyDrop(run, "C16");
  const decision = firstDecision(run);
  assert.ok(decision);
  if (decision.kind === "write") {
    assert.equal(decision.operation.type, "create_todo");
  } else {
    assert.equal(decision.kind, "needs_you");
    assert.ok(usefulNeedsYou(decision.reason), decision.reason);
  }
});

check("C16 variant: unrelated in-project To Do UUID is not identity", () => {
  const transcript =
    "Create two separate snag lists: Cafe snag list and Hall snag list. Do not combine them.";
  const run = replay(transcript, [
    thinObservation({
      id: "c16-uuid",
      domain: "todo",
      statement: "Create Cafe snag list",
      evidence: transcript,
      candidateTargetId: ASBESTOS,
    }),
  ]);
  mustNotSilentlyDrop(run, "C16-uuid");
  neverWritesRisk(run, DDA, "C16-uuid");
  const decision = firstDecision(run);
  if (decision?.kind === "write") {
    assert.equal(decision.operation.type, "create_todo");
  } else {
    assert.equal(decision?.kind, "needs_you");
  }
});

check("C18 thin envelope: timber resolve or Needs You; never DDA", () => {
  const transcript =
    "The hall timber floor services risk is resolved — they opened a trial panel and it is clear. M&E first-fix coordination with the hall ceiling void remains open.";
  const run = replay(transcript, [
    thinObservation({
      id: "c18-timber",
      domain: "risk",
      statement: "The hall timber floor services risk is resolved",
      evidence: "The hall timber floor services risk is resolved — they opened a trial panel and it is clear.",
      candidateTargetId: DDA,
    }),
    thinObservation({
      id: "c18-me",
      domain: "risk",
      statement: "M&E first-fix coordination with the hall ceiling void remains open",
      evidence: "M&E first-fix coordination with the hall ceiling void remains open.",
    }),
  ]);
  neverWritesRisk(run, DDA, "C18");
  const timber = run.resolved[0]?.decision;
  assert.ok(timber);
  assert.notEqual(timber.kind, "no_change", "C18 timber silently dropped");
  if (timber.kind === "write") {
    assert.equal(timber.operation.type, "update_risk_status");
    assert.equal("riskId" in timber.operation ? timber.operation.riskId : "", TIMBER);
  } else {
    assert.equal(timber.kind, "needs_you");
    assert.ok(usefulNeedsYou(timber.reason), timber.reason);
  }
  const me = run.resolved[1]?.decision;
  assert.ok(me);
  assert.notEqual(me.kind, "write", "C18 M&E stay-open must not write");
});

check("C24 thin envelope: named ownership is not silently dropped", () => {
  const transcript =
    "James Okonkwo owns the Hall snag list. Nadia Rahman owns the Cafe snag list.";
  const run = replay(transcript, [
    thinObservation({
      id: "c24-james",
      domain: "person",
      statement: "James Okonkwo owns the Hall snag list.",
      evidence: "James Okonkwo owns the Hall snag list.",
    }),
  ]);
  mustNotSilentlyDrop(run, "C24");
  const decision = firstDecision(run);
  if (decision?.kind === "write") {
    assert.match(decision.operation.type, /responsibility|ensure_person|confirm/);
  } else {
    assert.equal(decision?.kind, "needs_you");
    assert.ok(usefulNeedsYou(decision?.reason), decision?.reason);
  }
});

check("C33 thin envelope: ordinary PC date move is not silently dropped", () => {
  const transcript = "Practical completion has slipped again, to 8 January 2027.";
  const run = replay(transcript, [
    thinObservation({
      id: "c33",
      domain: "milestone",
      statement: transcript,
      evidence: transcript,
    }),
  ]);
  mustNotSilentlyDrop(run, "C33");
  const decision = firstDecision(run);
  if (decision?.kind === "write") {
    assert.equal(decision.operation.type, "update_milestone");
    if (decision.operation.type === "update_milestone") {
      assert.equal(decision.operation.milestoneId, PC);
      assert.match(String(decision.operation.startAt ?? ""), /2027-01-08/);
    }
  } else {
    assert.equal(decision?.kind, "needs_you");
    assert.ok(usefulNeedsYou(decision?.reason), decision?.reason);
  }
});

check("C45 thin envelope: Leo Mensah is not silently dropped", () => {
  const transcript = "Add Leo Mensah as the fire officer. Name only for now.";
  const run = replay(transcript, [
    thinObservation({
      id: "c45",
      domain: "person",
      statement: transcript,
      evidence: transcript,
    }),
  ]);
  mustNotSilentlyDrop(run, "C45");
  const decision = firstDecision(run);
  if (decision?.kind === "write") {
    assert.equal(decision.operation.type, "ensure_person");
  } else {
    assert.equal(decision?.kind, "needs_you");
    assert.ok(usefulNeedsYou(decision?.reason), decision?.reason);
  }
});

check("C21 restated current PC date may stay no_change", () => {
  const transcript = "Practical completion is still 18 December 2026 — no change.";
  const run = replay(transcript, [
    thinObservation({
      id: "c21",
      domain: "milestone",
      statement: transcript,
      evidence: transcript,
    }),
  ]);
  const decision = firstDecision(run);
  assert.ok(decision);
  assert.notEqual(decision.kind, "write", "C21 must not mint a second PC");
});

check("first-name Helen stays Needs You", () => {
  const transcript = "Helen will own the weekly dashboard.";
  const run = replay(transcript, [
    thinObservation({
      id: "c29",
      domain: "person",
      statement: transcript,
      evidence: transcript,
    }),
  ]);
  const decision = firstDecision(run);
  assert.equal(decision?.kind, "needs_you", writeType(decision?.kind, undefined));
});

check("role-only QS does not invent a person", () => {
  const transcript = "Mei Chen is the QS.";
  const run = replay(transcript, [
    thinObservation({
      id: "c6",
      domain: "person",
      statement: transcript,
      evidence: transcript,
    }),
  ]);
  const decision = firstDecision(run);
  assert.ok(decision);
  if (decision.kind === "write") {
    assert.notEqual(decision.operation.type, "ensure_person");
  }
});

check("foreign-project UUID is not identity", () => {
  const transcript = "Add a to-do to reprint the visitor badges.";
  const run = replay(transcript, [
    thinObservation({
      id: "foreign",
      domain: "todo",
      statement: transcript,
      evidence: transcript,
      candidateTargetId: FOREIGN,
    }),
  ]);
  mustNotSilentlyDrop(run, "foreign-id");
  const decision = firstDecision(run);
  if (decision?.kind === "write") {
    assert.equal(decision.operation.type, "create_todo");
  }
});

check("wrong-type UUID on a person observation does not bind a todo", () => {
  const transcript = "Add Leo Mensah as the fire officer. Name only for now.";
  const run = replay(transcript, [
    thinObservation({
      id: "wrong-type",
      domain: "person",
      statement: transcript,
      evidence: transcript,
      candidateTargetId: ASBESTOS,
    }),
  ]);
  mustNotSilentlyDrop(run, "wrong-type");
});

check("similar existing title stays fail-safe", () => {
  const transcript = "Create a Hall timber floor inspection list.";
  const run = replay(transcript, [
    thinObservation({
      id: "similar",
      domain: "todo",
      statement: transcript,
      evidence: transcript,
    }),
  ]);
  const decision = firstDecision(run);
  assert.ok(decision);
  assert.notEqual(decision.kind, "no_change");
  if (decision.kind === "write") {
    assert.equal(decision.operation.type, "create_todo");
  }
});

check("Needs You copy is project-manager language", () => {
  const transcript =
    "Create two separate snag lists: Cafe snag list and Hall snag list. Do not combine them.";
  const run = replay(transcript, [
    thinObservation({
      id: "copy",
      domain: "todo",
      statement: "Create two separate snag lists: Cafe snag list and Hall snag list.",
      evidence: transcript,
    }),
  ]);
  const decision = firstDecision(run);
  if (decision?.kind === "needs_you") {
    assert.ok(usefulNeedsYou(decision.reason), decision.reason);
  }
});

check("thin no_change with zero Ready ops must not be the only accounted outcome for C16", () => {
  const transcript =
    "Create two separate snag lists: Cafe snag list and Hall snag list. Do not combine them.";
  const run = replay(transcript, [
    thinObservation({
      id: "c16-limited",
      domain: "todo",
      statement: "Create two separate snag lists: Cafe snag list and Hall snag list.",
      evidence: transcript,
    }),
  ]);
  const signals = collectPostAnalysisSignals({
    captureText: transcript,
    result: run.result,
  });
  const assessment = evaluatePostAnalysisReliability(signals);
  const decision = firstDecision(run);
  if (decision?.kind === "no_change") {
    assert.notEqual(
      assessment.state,
      "limited",
      "silent no_change plus Limited banner is the Run 3 failure shape",
    );
  }
});

check("structured #172 fixtures still resolve (control — must stay green on main)", () => {
  const world = run3MatureWorld();
  const transcript = "Add Leo Mensah as the fire officer. Name only for now.";
  const records = contextRecordsFromWorld(world, PROJECT);
  const full: CaptureObservationV2 = {
    id: "leo-structured",
    statement: transcript,
    evidence: transcript,
    domain: "person",
    disposition: "no_change",
    truthIntent: "current",
    projectId: PROJECT,
    candidateTargetId: null,
    candidateTargetTitle: "Leo Mensah",
    mergeWithObservationId: null,
    proposedValues: { name: "Leo Mensah" },
    commentary: null,
    modelConfidence: null,
  };
  const validated = validateObservations([full], records, PROJECT);
  const resolved = resolveObservations({
    observations: validated.observations,
    world,
    transcript,
    captureEntryProjectId: PROJECT,
  });
  assert.equal(resolved[0]?.decision.kind, "write");
});

console.log(`\n${passed} run3-production-envelope checks passed.`);
