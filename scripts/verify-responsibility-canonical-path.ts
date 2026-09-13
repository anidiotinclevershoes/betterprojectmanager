/**
 * Family C — one canonical responsibility path.
 *
 * New Project notes and Capture ownership statements must persist
 * knowledge_items.kind=responsibility. Model IDs are not identity.
 * A wrong-type in-project id must not become "person not on this project"
 * when the recorded name is evidenced.
 *
 * Do not invent a role as a scope. Do not weaken D-051 / Pippa-class.
 *
 * Run: npx tsx scripts/verify-responsibility-canonical-path.ts
 */
import assert from "node:assert/strict";
import { NEW_PROJECT_NOTES } from "../e2e-hosted-longrun/new-project";
import { planCaptureApply, type CaptureApplyWorld } from "../src/lib/capture/apply";
import {
  resolveObservations,
  validateObservations,
} from "../src/lib/capture-v2";
import { contextRecordsFromWorld } from "../src/lib/capture-v2/context";
import type { CaptureObservationV2 } from "../src/lib/capture-v2/types";
import { draftFromProvisional } from "../src/lib/new-project-v2/map";
import { parseNewProjectV2Envelope } from "../src/lib/new-project-v2/parse";
import { structuredItemsFromSetup } from "../src/lib/new-project/materialise-setup";
import { scopeFromNarrativeForName } from "../src/lib/people/responsibility-scope";

const PROJECT = "proj-riverside";
const HELEN = "person-helen";
const TOMOS = "person-tomos";
const MEI = "person-mei";
const DDA = "fb74aa0f-dc7f-4fba-a5c5-838a1dd7acf3";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

function riversideWorld(): CaptureApplyWorld {
  return {
    projectIds: new Set([PROJECT]),
    projects: [
      {
        id: PROJECT,
        name: "Riverside Civic Hall",
        code: "RCH",
        stakeholders: [
          { id: HELEN, name: "Helen Ward", role: "PM" },
          { id: TOMOS, name: "Tomos Ellis", role: "Architect" },
          { id: MEI, name: "Mei Chen", role: "QS" },
        ],
      },
    ],
    risks: [
      {
        id: DDA,
        projectId: PROJECT,
        title: "Outstanding DDA access ramp detail",
        status: "open",
      },
    ],
    todos: [],
    timeline: [],
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

check("NP notes: explicit 'is responsible for' and 'covers' survive name-only people", () => {
  assert.equal(
    scopeFromNarrativeForName(NEW_PROJECT_NOTES, "Helen Ward"),
    "client decisions",
  );
  assert.equal(
    scopeFromNarrativeForName(NEW_PROJECT_NOTES, "James Okonkwo"),
    "the site programme",
  );
  assert.equal(
    scopeFromNarrativeForName(NEW_PROJECT_NOTES, "Nadia Rahman"),
    "FF&E specification",
  );
  assert.equal(
    scopeFromNarrativeForName(NEW_PROJECT_NOTES, "Tomos Ellis"),
    "building control",
  );
  assert.equal(
    scopeFromNarrativeForName(NEW_PROJECT_NOTES, "Mei Chen"),
    undefined,
    "name-only Mei must not invent a responsibility",
  );

  const mapped = parseNewProjectV2Envelope({
    observations: [
      {
        id: "p-helen",
        statement: "Helen Ward is the client project manager",
        evidence: "Helen Ward is the client project manager",
        domain: "person",
        disposition: "create_new",
        truthIntent: "current",
        proposedValues: { name: "Helen Ward", role: "client project manager" },
      },
      {
        id: "p-tomos",
        statement: "Tomos Ellis",
        evidence: "Tomos Ellis covers building control.",
        domain: "person",
        disposition: "create_new",
        truthIntent: "current",
        proposedValues: { name: "Tomos Ellis" },
      },
      {
        id: "p-mei",
        statement: "Mei Chen is on the team.",
        evidence: "Mei Chen is on the team.",
        domain: "person",
        disposition: "create_new",
        truthIntent: "current",
        proposedValues: { name: "Mei Chen" },
      },
    ],
  });
  const draft = draftFromProvisional({
    sourceNarrative: NEW_PROJECT_NOTES,
    sourceMode: "paste",
    project: { name: "Riverside Civic Hall Fit-Out", summary: "", currentFocus: "" },
    items: mapped.items,
  });
  const helen = (draft.stakeholders ?? []).find((s) => s.name === "Helen Ward");
  const tomos = (draft.stakeholders ?? []).find((s) => s.name === "Tomos Ellis");
  const mei = (draft.stakeholders ?? []).find((s) => s.name === "Mei Chen");
  assert.ok(helen?.responsibilities?.some((s) => /client decisions/i.test(s)));
  assert.ok(tomos?.responsibilities?.some((s) => /building control/i.test(s)));
  assert.equal((mei?.responsibilities ?? []).length, 0);

  const items = structuredItemsFromSetup({
    projectId: PROJECT,
    input: draft,
    stakeholders: [
      { id: HELEN, name: "Helen Ward", role: "PM" },
      { id: TOMOS, name: "Tomos Ellis", role: "Architect" },
      { id: MEI, name: "Mei Chen", role: "QS" },
    ],
  });
  const scopes = items
    .filter((i) => i.kind === "responsibility")
    .map((i) => i.meta?.responsibility?.scope);
  assert.ok(scopes.some((s) => /client decisions/i.test(String(s))));
  assert.ok(scopes.some((s) => /building control/i.test(String(s))));
  assert.equal(
    items.filter(
      (i) =>
        i.kind === "responsibility" &&
        i.meta?.responsibility?.personName === "Mei Chen",
    ).length,
    0,
  );
});

check("C8: wrong-type in-project id + evidenced Tomos writes responsibility", () => {
  const transcript = "Tomos Ellis is responsible for the DDA ramp sign-off.";
  const { row } = resolveObs(riversideWorld(), transcript, {
    domain: "responsibility",
    disposition: "update_existing",
    statement: transcript,
    evidence: transcript,
    candidateTargetId: DDA,
    candidateTargetTitle: "Tomos Ellis",
    proposedValues: {
      personName: "Tomos Ellis",
      scope: "DDA ramp sign-off",
      ownershipSemantics: "share",
    },
  });
  assert.equal(row?.decision.kind, "write", row?.decision.kind === "needs_you" ? row.decision.reason : "");
  if (row?.decision.kind === "write") {
    assert.equal(row.decision.operation.type, "confirm_responsibility");
    if (row.decision.operation.type === "confirm_responsibility") {
      assert.equal(row.decision.operation.personId, TOMOS);
      assert.match(row.decision.operation.scope, /DDA ramp sign-off/i);
    }
  }
});

check("C8 as Person observation rematerializes to responsibility, not a duplicate person", () => {
  const transcript = "Tomos Ellis is responsible for the DDA ramp sign-off.";
  const { row } = resolveObs(riversideWorld(), transcript, {
    domain: "person",
    disposition: "create_new",
    statement: transcript,
    evidence: transcript,
    candidateTargetTitle: "Tomos Ellis",
    proposedValues: { name: "Tomos Ellis" },
  });
  assert.equal(row?.decision.kind, "write");
  if (row?.decision.kind === "write") {
    assert.equal(row.decision.domain, "responsibility");
    assert.equal(row.decision.operation.type, "confirm_responsibility");
  }
});

check("Apply planner: risk id as personId still binds evidenced Tomos", () => {
  const text = "Tomos Ellis is responsible for the DDA ramp sign-off.";
  const decision = planCaptureApply({
    item: {
      id: "op-c8",
      kind: "stakeholder",
      op: "create",
      content: text,
      destination: "project",
      projectId: PROJECT,
      legalDomain: "responsibility",
      personId: DDA,
      personName: "Tomos Ellis",
      responsibilityScope: "DDA ramp sign-off",
      ownershipSemantics: "share",
      proposedValues: { personName: "Tomos Ellis", scope: "DDA ramp sign-off" },
    },
    text,
    world: riversideWorld(),
    captureEntryProjectId: PROJECT,
  });
  assert.equal(decision.kind, "write");
  if (decision.kind === "write") {
    assert.equal(decision.operation.type, "confirm_responsibility");
    if (decision.operation.type === "confirm_responsibility") {
      assert.equal(decision.operation.personId, TOMOS);
    }
  }
});

check("role-only 'Mei Chen is the QS' does not invent a responsibility write", () => {
  const transcript = "Mei Chen is the QS.";
  const { row } = resolveObs(riversideWorld(), transcript, {
    domain: "person",
    disposition: "create_new",
    statement: transcript,
    evidence: transcript,
    candidateTargetTitle: "Mei Chen",
    proposedValues: { name: "Mei Chen", role: "QS" },
  });
  assert.ok(row);
  if (row?.decision.kind === "write") {
    assert.notEqual(row.decision.operation.type, "confirm_responsibility");
  }
});

check("Pippa-class first-name Helen restatement stays Needs You", () => {
  const transcript = "Helen will own walk-through agenda.";
  const { row } = resolveObs(riversideWorld(), transcript, {
    domain: "responsibility",
    disposition: "update_existing",
    statement: transcript,
    evidence: transcript,
    candidateTargetId: HELEN,
    candidateTargetTitle: "Helen Ward",
    proposedValues: {
      personName: "Helen Ward",
      scope: "walk-through agenda",
      ownershipSemantics: "share",
    },
  });
  assert.equal(row?.decision.kind, "needs_you");
});

check("existing Person + new responsibility is a legal write", () => {
  const transcript = "Mei Chen is responsible for the monthly cost report.";
  const { row } = resolveObs(riversideWorld(), transcript, {
    domain: "responsibility",
    disposition: "create_new",
    statement: transcript,
    evidence: transcript,
    candidateTargetTitle: "Mei Chen",
    proposedValues: {
      personName: "Mei Chen",
      scope: "monthly cost report",
      ownershipSemantics: "share",
    },
  });
  assert.equal(row?.decision.kind, "write");
  if (row?.decision.kind === "write") {
    assert.equal(row.decision.operation.type, "confirm_responsibility");
    if (row.decision.operation.type === "confirm_responsibility") {
      assert.equal(row.decision.operation.personId, MEI);
    }
  }
});

console.log(`\n${passed} checks passed`);
