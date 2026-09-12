/**
 * Family A / D — wrong-target Apply and unmatched Create rematerialisation.
 *
 * Invariant: intended entity unresolved must never become Ready Apply on a
 * different same-domain record. Model-supplied IDs are not identity.
 * Clear absent entities rematerialize as Create. Unsafe identity → Needs You.
 *
 * Do not weaken D-051 observation-local quotes or Pippa-class first-name
 * restatements of existing people.
 *
 * Run: npx tsx scripts/verify-wrong-target-identity.ts
 */
import assert from "node:assert/strict";
import {
  resolveObservations,
  validateObservations,
} from "../src/lib/capture-v2";
import { contextRecordsFromWorld } from "../src/lib/capture-v2/context";
import type { CaptureObservationV2 } from "../src/lib/capture-v2/types";
import type { CaptureApplyWorld } from "../src/lib/capture/apply";

const PROJECT = "proj-riverside";
const DDA = "fb74aa0f-dc7f-4fba-a5c5-838a1dd7acf3";
const ME = "1c682215-ef53-4c94-8e0a-1979b002a433";
const HELEN = "person-helen";
const TOMOS = "person-tomos";
const ASBESTOS = "todo-asbestos";
const FFE = "todo-ffe";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

function riversideWorld(): CaptureApplyWorld {
  return {
    projectIds: new Set([PROJECT, "proj-other"]),
    projects: [
      {
        id: PROJECT,
        name: "Riverside Civic Hall",
        code: "RCH",
        stakeholders: [
          { id: HELEN, name: "Helen Ward", role: "PM" },
          { id: TOMOS, name: "Tomos Ellis", role: "Architect" },
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
    ],
    todos: [
      { id: ASBESTOS, projectId: PROJECT, title: "Chase asbestos survey addendum", done: false },
      { id: FFE, projectId: PROJECT, title: "Book FF&E sample review", done: false },
    ],
    timeline: [
      {
        id: "ms-pc",
        projectId: PROJECT,
        label: "Practical completion",
        startAt: "2026-12-12",
      },
    ],
    knowledge: [],
  };
}

function resolveObs(
  world: CaptureApplyWorld,
  transcript: string,
  observation: Partial<CaptureObservationV2> &
    Pick<CaptureObservationV2, "domain" | "disposition" | "statement">,
) {
  const records = contextRecordsFromWorld(world, PROJECT);
  const full: CaptureObservationV2 = {
    id: observation.id ?? "obs-1",
    statement: observation.statement,
    evidence: observation.evidence ?? observation.statement,
    domain: observation.domain,
    disposition: observation.disposition,
    truthIntent: observation.truthIntent ?? "current",
    projectId: PROJECT,
    candidateTargetId: observation.candidateTargetId ?? null,
    candidateTargetTitle: observation.candidateTargetTitle ?? null,
    mergeWithObservationId: null,
    proposedValues: observation.proposedValues ?? null,
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
  return { validated, resolved, row: resolved[0] };
}

function writeType(row: ReturnType<typeof resolveObs>["row"]): string {
  if (!row || row.decision.kind !== "write") return "";
  return row.decision.operation.type;
}

function writeRiskId(row: ReturnType<typeof resolveObs>["row"]): string | undefined {
  if (!row || row.decision.kind !== "write") return undefined;
  const op = row.decision.operation;
  return "riskId" in op ? String(op.riskId) : undefined;
}

function main() {
  const world = riversideWorld();

  check("C5-class: unmatched timber-floor risk rematerializes as Create, not Needs You", () => {
    const transcript =
      "The asbestos survey addendum came back clean. Close that chase. Raise a risk that the hall timber floor may still hide services.";
    const { row } = resolveObs(world, transcript, {
      id: "c5-timber",
      domain: "risk",
      disposition: "update_existing",
      statement: "Hall timber floor services risk",
      evidence: "Raise a risk that the hall timber floor may still hide services.",
      candidateTargetTitle: "Hall timber floor services risk",
      proposedValues: { title: "Hall timber floor services risk" },
    });
    assert.equal(row?.decision.kind, "write", "C5 must be Ready Create");
    assert.equal(writeType(row), "create_risk");
    assert.notEqual(writeRiskId(row), DDA);
    assert.notEqual(writeRiskId(row), ME);
  });

  check("C18-class: model DDA UUID + timber-floor evidence must not resolve DDA", () => {
    const transcript =
      "The hall timber floor services risk is resolved — they opened a trial panel and it is clear. M&E first-fix coordination with the hall ceiling void remains open.";
    const { row } = resolveObs(world, transcript, {
      id: "c18-wrong",
      domain: "risk",
      disposition: "update_existing",
      statement: "The hall timber floor services risk is resolved",
      evidence: "The hall timber floor services risk is resolved — they opened a trial panel and it is clear.",
      candidateTargetId: DDA,
      candidateTargetTitle: "Outstanding DDA access ramp detail",
      proposedValues: { status: "resolved", title: "Hall timber floor services risk" },
    });
    assert.ok(row, "C18 resolved");
    assert.notEqual(row.decision.kind, "write", "C18 must not Ready-apply a substitute");
    if (row.decision.kind === "write") {
      assert.notEqual(writeRiskId(row), DDA);
    }
    assert.equal(row.decision.kind, "needs_you");
    assert.equal(row.suggestion, null);
  });

  check("C18 sibling: M&E remains open is not a write against DDA either", () => {
    const transcript =
      "The hall timber floor services risk is resolved. M&E first-fix coordination with the hall ceiling void remains open.";
    const { row } = resolveObs(world, transcript, {
      id: "c18-me",
      domain: "risk",
      disposition: "update_existing",
      statement: "M&E first-fix coordination remains open",
      evidence: "M&E first-fix coordination with the hall ceiling void remains open.",
      candidateTargetId: DDA,
      candidateTargetTitle: "Outstanding DDA access ramp detail",
      proposedValues: { status: "resolved" },
    });
    assert.equal(row?.decision.kind, "needs_you");
  });

  check("C16-class: two untitled-date snag-list Creates rematerialize", () => {
    const transcript =
      "Create two separate snag lists: Cafe snag list and Hall snag list. Do not combine them.";
    const cafe = resolveObs(world, transcript, {
      id: "c16-cafe",
      domain: "todo",
      disposition: "update_existing",
      statement: "Create Cafe snag list",
      evidence: "Create two separate snag lists: Cafe snag list and Hall snag list.",
      candidateTargetTitle: "Cafe snag list",
      proposedValues: { title: "Cafe snag list" },
    });
    const hall = resolveObs(world, transcript, {
      id: "c16-hall",
      domain: "todo",
      disposition: "update_existing",
      statement: "Create Hall snag list",
      evidence: "Create two separate snag lists: Cafe snag list and Hall snag list.",
      candidateTargetTitle: "Hall snag list",
      proposedValues: { title: "Hall snag list" },
    });
    assert.equal(cafe.row?.decision.kind, "write");
    assert.equal(writeType(cafe.row), "create_todo");
    assert.equal(hall.row?.decision.kind, "write");
    assert.equal(writeType(hall.row), "create_todo");
  });

  check("C11-class: first-name Chris with no existing Chris Creates; Helen stays Pippa", () => {
    const chris = resolveObs(world, "Chris is joining the site team next week.", {
      id: "c11-chris",
      domain: "person",
      disposition: "create_new",
      statement: "Chris is joining the site team",
      evidence: "Chris is joining the site team next week.",
      candidateTargetTitle: "Chris",
      proposedValues: { name: "Chris" },
    });
    assert.equal(chris.row?.decision.kind, "write", "absent first name may create");
    assert.equal(writeType(chris.row), "ensure_person");

    const helen = resolveObs(world, "Helen will own the weekly dashboard.", {
      id: "c29-helen",
      domain: "person",
      disposition: "update_existing",
      statement: "Helen will own the weekly dashboard",
      evidence: "Helen will own the weekly dashboard.",
      candidateTargetId: HELEN,
      candidateTargetTitle: "Helen Ward",
      proposedValues: { name: "Helen" },
    });
    assert.equal(helen.row?.decision.kind, "needs_you", "Pippa-class first-name restatement");
  });

  check("legal DDA resolve still works when evidence quotes the recorded title", () => {
    const transcript = "Outstanding DDA access ramp detail is now resolved.";
    const { row } = resolveObs(world, transcript, {
      id: "legal-dda",
      domain: "risk",
      disposition: "update_existing",
      statement: "Outstanding DDA access ramp detail is now resolved",
      evidence: "Outstanding DDA access ramp detail is now resolved.",
      candidateTargetId: DDA,
      candidateTargetTitle: "Outstanding DDA access ramp detail",
      proposedValues: { status: "resolved" },
    });
    assert.equal(row?.decision.kind, "write");
    assert.equal(writeType(row), "update_risk_status");
    assert.equal(writeRiskId(row), DDA);
  });

  check("similar-title risk does not bind the other open risk", () => {
    const transcript = "The hall ceiling void first-fix risk is resolved.";
    const { row } = resolveObs(world, transcript, {
      id: "similar",
      domain: "risk",
      disposition: "update_existing",
      statement: "Hall ceiling void first-fix risk is resolved",
      evidence: "The hall ceiling void first-fix risk is resolved.",
      candidateTargetId: ME,
      candidateTargetTitle: "M&E first-fix coordination risk",
      proposedValues: { status: "resolved" },
    });
    assert.equal(row?.decision.kind, "needs_you");
  });

  console.log(`\n${passed} wrong-target / unmatched-create checks passed`);
}

main();
