/**
 * Person-linked identity certainty — Slice 1D.
 *
 * Invariant: a model-supplied Person UUID is not proof of identity.
 * Incomplete / competing Person evidence cannot become Apply Ready.
 *
 * Run: npx tsx scripts/verify-person-identity-safety.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  resolveObservations,
  validateObservations,
} from "../src/lib/capture-v2";
import { contextRecordsFromWorld } from "../src/lib/capture-v2/context";
import type { CaptureObservationV2 } from "../src/lib/capture-v2/types";
import { planCaptureApply, type CaptureApplyWorld } from "../src/lib/capture/apply";
import { evaluateAgainstCase } from "../src/lib/eval-capture-v2/pipeline";
import { CAPTURE_V2_EVAL_CORPUS } from "../src/lib/eval-capture-v2/corpus";
import {
  experimentalApplyWorld,
  TOYWORLD_ID,
} from "../src/lib/experiments/worlds";
import {
  recordedPersonNameAppearsInText,
} from "../src/lib/people/identity";

const ALPHA = "proj-alpha";
const HALE = "person-hale";
const QUINN = "person-quinn";
const PATEL = "person-patel";
const HALE_DUP = "person-hale-dup";
const RISK = "risk-alpha";
const TODO = "todo-alpha";
const MS = "ms-alpha";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

function alphaWorld(people: Array<{ id: string; name: string }>): CaptureApplyWorld {
  return {
    projectIds: new Set([ALPHA, "proj-other"]),
    projects: [
      {
        id: ALPHA,
        name: "Alpha",
        code: "ALP",
        stakeholders: people.map((p) => ({ ...p, role: "Contributor" })),
      },
      {
        id: "proj-other",
        name: "Other",
        code: "OTH",
        stakeholders: [{ id: "person-foreign", name: "Morgan Vale", role: "Lead" }],
      },
    ],
    risks: [{ id: RISK, projectId: ALPHA, title: "Supply delay", status: "open" }],
    todos: [{ id: TODO, projectId: ALPHA, title: "Pack crates", done: false }],
    timeline: [{ id: MS, projectId: ALPHA, label: "Ship day", startAt: "2026-11-01" }],
    knowledge: [],
  };
}

const haleWorld = () =>
  alphaWorld([
    { id: HALE, name: "Jordan Hale" },
    { id: PATEL, name: "Sam Patel" },
  ]);

const twoJordans = () =>
  alphaWorld([
    { id: HALE, name: "Jordan Hale" },
    { id: QUINN, name: "Jordan Quinn" },
  ]);

function resolveObs(
  world: CaptureApplyWorld,
  transcript: string,
  observation: Partial<CaptureObservationV2> &
    Pick<CaptureObservationV2, "domain" | "disposition" | "statement">,
) {
  const records = contextRecordsFromWorld(world, ALPHA);
  const full: CaptureObservationV2 = {
    id: observation.id ?? "obs-1",
    statement: observation.statement,
    evidence: observation.evidence ?? observation.statement,
    domain: observation.domain,
    disposition: observation.disposition,
    truthIntent: observation.truthIntent ?? "current",
    projectId: ALPHA,
    candidateTargetId: observation.candidateTargetId ?? null,
    candidateTargetTitle: observation.candidateTargetTitle ?? null,
    mergeWithObservationId: null,
    proposedValues: observation.proposedValues ?? null,
    commentary: null,
    modelConfidence: null,
  };
  const validated = validateObservations([full], records, ALPHA);
  const resolved = resolveObservations({
    observations: validated.observations,
    world,
    transcript,
    captureEntryProjectId: ALPHA,
  });
  return { validated, resolved, row: resolved[0] };
}

function assertNeedsYou(row: ReturnType<typeof resolveObs>["row"], label: string) {
  assert.ok(row, label);
  assert.equal(row.decision.kind, "needs_you", label);
  assert.equal(row.suggestion, null, `${label}: no Apply Ready suggestion`);
}

function main() {
  check("helper: full recorded name is evidenced; first token is not", () => {
    assert.equal(
      recordedPersonNameAppearsInText(
        "Jordan Hale is unavailable next week.",
        "Jordan Hale",
      ),
      true,
    );
    assert.equal(
      recordedPersonNameAppearsInText(
        "Jordan from the loading bay called.",
        "Jordan Hale",
      ),
      false,
    );
  });

  check("A: incomplete reference + model UUID is Needs you, not Apply Ready", () => {
    const transcript = "Jordan from the loading bay called.";
    const { row } = resolveObs(haleWorld(), transcript, {
      domain: "availability",
      disposition: "update_existing",
      truthIntent: "current",
      statement: transcript,
      candidateTargetId: HALE,
      candidateTargetTitle: "Jordan Hale",
      proposedValues: { awayFromIso: "2026-10-03" },
    });
    assertNeedsYou(row, "A availability");
    const person = resolveObs(haleWorld(), transcript, {
      domain: "person",
      disposition: "update_existing",
      truthIntent: "current",
      statement: transcript,
      candidateTargetId: HALE,
      candidateTargetTitle: "Jordan Hale",
    });
    assertNeedsYou(person.row, "A person-linked");
  });

  check("B: exact full name + correct UUID is a valid person-linked write", () => {
    const transcript = "Jordan Hale is unavailable next week.";
    const { row } = resolveObs(haleWorld(), transcript, {
      domain: "availability",
      disposition: "update_existing",
      truthIntent: "current",
      statement: transcript,
      candidateTargetId: HALE,
      candidateTargetTitle: "Jordan Hale",
      proposedValues: { awayFromIso: "2026-10-06" },
    });
    assert.equal(row?.decision.kind, "write");
    if (row?.decision.kind === "write") {
      assert.equal(row.decision.operation.type, "write_availability");
      if (row.decision.operation.type === "write_availability") {
        assert.equal(row.decision.operation.personId, HALE);
      }
    }
  });

  check("C: evidence names Jordan Hale but model UUID is Sam Patel → Needs you", () => {
    const transcript = "Jordan Hale is unavailable next week.";
    const { row } = resolveObs(haleWorld(), transcript, {
      domain: "availability",
      disposition: "update_existing",
      truthIntent: "current",
      statement: transcript,
      candidateTargetId: PATEL,
      candidateTargetTitle: "Sam Patel",
      proposedValues: { awayFromIso: "2026-10-06" },
    });
    assertNeedsYou(row, "C wrong UUID");
  });

  check("D: genuine new distinct full name remains creatable", () => {
    const transcript =
      "Jordan Quinn has joined as the deployment lead.";
    const { row } = resolveObs(haleWorld(), transcript, {
      domain: "person",
      disposition: "create_new",
      truthIntent: "current",
      statement: transcript,
      candidateTargetTitle: "Jordan Quinn",
      proposedValues: { name: "Jordan Quinn", role: "deployment lead" },
    });
    assert.equal(row?.decision.kind, "write");
    if (row?.decision.kind === "write") {
      assert.equal(row.decision.operation.type, "ensure_person");
      if (row.decision.operation.type === "ensure_person") {
        assert.equal(row.decision.operation.name, "Jordan Quinn");
      }
    }
  });

  check("E: two same-first-name people + 'Jordan is away' is Needs you", () => {
    const transcript = "Jordan is away.";
    const { row } = resolveObs(twoJordans(), transcript, {
      domain: "availability",
      disposition: "update_existing",
      truthIntent: "current",
      statement: transcript,
      candidateTargetId: HALE,
      candidateTargetTitle: "Jordan Hale",
      proposedValues: { awayFromIso: "2026-10-06" },
    });
    assertNeedsYou(row, "E same first name");
  });

  check("F: two people sharing a full name are not silently merged", () => {
    const world = alphaWorld([
      { id: HALE, name: "Jordan Hale" },
      { id: HALE_DUP, name: "Jordan Hale" },
    ]);
    const transcript = "Jordan Hale is unavailable next week.";
    const { row } = resolveObs(world, transcript, {
      domain: "availability",
      disposition: "update_existing",
      truthIntent: "current",
      statement: transcript,
      candidateTargetId: HALE,
      candidateTargetTitle: "Jordan Hale",
      proposedValues: { awayFromIso: "2026-10-06" },
    });
    assertNeedsYou(row, "F duplicate full name");
  });

  check("G: availability without resolved identity is Needs you", () => {
    const transcript = "Someone from the loading bay is away next week.";
    const { row } = resolveObs(haleWorld(), transcript, {
      domain: "availability",
      disposition: "update_existing",
      truthIntent: "current",
      statement: transcript,
      candidateTargetId: HALE,
      proposedValues: { awayFromIso: "2026-10-06" },
    });
    assertNeedsYou(row, "G unresolved availability");
  });

  check("H: availability with certain existing identity still writes", () => {
    const transcript = "Jordan Hale is away from 2026-10-03";
    const { row } = resolveObs(haleWorld(), transcript, {
      domain: "availability",
      disposition: "update_existing",
      truthIntent: "current",
      statement: transcript,
      candidateTargetId: HALE,
      candidateTargetTitle: "Jordan Hale",
      proposedValues: { awayFromIso: "2026-10-03" },
    });
    assert.equal(row?.decision.kind, "write");
  });

  check("I: responsibility with uncertain Person is Needs you", () => {
    const transcript = "Jordan now owns deployment.";
    const { row } = resolveObs(haleWorld(), transcript, {
      domain: "responsibility",
      disposition: "update_existing",
      truthIntent: "current",
      statement: transcript,
      candidateTargetId: HALE,
      candidateTargetTitle: "Jordan Hale",
      proposedValues: {
        personName: "Jordan Hale",
        scope: "deployment",
        ownershipSemantics: "share",
      },
    });
    assertNeedsYou(row, "I uncertain responsibility");
  });

  check("I2: responsibility with certain Person remains writable", () => {
    const transcript = "Jordan Hale now owns deployment.";
    const { row } = resolveObs(haleWorld(), transcript, {
      domain: "responsibility",
      disposition: "update_existing",
      truthIntent: "current",
      statement: transcript,
      candidateTargetId: HALE,
      candidateTargetTitle: "Jordan Hale",
      proposedValues: {
        personName: "Jordan Hale",
        name: "Jordan Hale",
        scope: "deployment",
        ownershipSemantics: "share",
      },
    });
    assert.equal(row?.decision.kind, "write");
    if (row?.decision.kind === "write") {
      assert.equal(row.decision.domain, "responsibility");
    }
  });

  check("J: foreign-project Person UUID is still rejected", () => {
    const transcript = "Morgan Vale is away next week.";
    const { validated, resolved } = resolveObs(haleWorld(), transcript, {
      domain: "availability",
      disposition: "update_existing",
      truthIntent: "current",
      statement: transcript,
      candidateTargetId: "person-foreign",
      candidateTargetTitle: "Morgan Vale",
      proposedValues: { awayFromIso: "2026-10-06" },
    });
    assert.equal(validated.observations.length, 0);
    assert.ok(
      validated.issues.some(
        (i) => i.code === "foreign_id" || i.code === "cross_project_id",
      ),
    );
    assert.ok(resolved.every((r) => r.decision.kind !== "write"));
  });

  check("K: Risk / Todo / milestone behaviour is unchanged by Person UUID", () => {
    const world = haleWorld();
    const risk = resolveObs(world, "Supply delay is resolved.", {
      domain: "risk",
      disposition: "update_existing",
      truthIntent: "current",
      statement: "Supply delay is resolved.",
      candidateTargetId: RISK,
      candidateTargetTitle: "Supply delay",
      proposedValues: { status: "resolved" },
    });
    assert.equal(risk.row?.decision.kind, "write");
    if (risk.row?.decision.kind === "write") {
      assert.equal(risk.row.decision.domain, "risk");
    }

    const todo = resolveObs(world, "Pack crates is done.", {
      domain: "todo",
      disposition: "update_existing",
      truthIntent: "current",
      statement: "Pack crates is done.",
      candidateTargetId: TODO,
      proposedValues: { status: "complete" },
    });
    assert.equal(todo.row?.decision.kind, "write");
    if (todo.row?.decision.kind === "write") {
      assert.equal(todo.row.decision.domain, "todo");
    }

    const milestone = resolveObs(world, "Ship day moved to 2026-11-08.", {
      domain: "milestone",
      disposition: "update_existing",
      truthIntent: "current",
      statement: "Ship day moved to 2026-11-08.",
      candidateTargetId: MS,
      proposedValues: { date: "2026-11-08" },
    });
    assert.equal(milestone.row?.decision.kind, "write");
    if (milestone.row?.decision.kind === "write") {
      assert.equal(milestone.row.decision.domain, "milestone");
    }
  });

  check("create does not invent a Person from an incomplete first-name fragment", () => {
    const transcript = "Jordan from the loading bay called.";
    const { row } = resolveObs(haleWorld(), transcript, {
      domain: "person",
      disposition: "create_new",
      truthIntent: "current",
      statement: transcript,
      candidateTargetTitle: "Jordan Loading",
      proposedValues: { name: "Jordan Loading" },
    });
    assertNeedsYou(row, "do not invent Person from incomplete reference");
  });

  check("Phase 3B: UUID alone cannot write availability when text is incomplete", () => {
    const decision = planCaptureApply({
      item: {
        id: "apply-incomplete",
        kind: "availability",
        op: "update",
        content: "Jordan from the loading bay called.",
        destination: "project",
        projectId: ALPHA,
        legalDomain: "availability",
        personId: HALE,
        personName: "Jordan Hale",
        proposedValues: { awayFromIso: "2026-10-03T12:00:00.000Z" },
      },
      text: "Jordan from the loading bay called.",
      world: haleWorld(),
      captureEntryProjectId: ALPHA,
    });
    assert.equal(decision.kind, "needs_you");
  });

  check("Phase 3B: full-name availability with UUID still writes", () => {
    const decision = planCaptureApply({
      item: {
        id: "apply-certain",
        kind: "availability",
        op: "update",
        content: "Jordan Hale is away 2026-10-03",
        destination: "project",
        projectId: ALPHA,
        legalDomain: "availability",
        personId: HALE,
        personName: "Jordan Hale",
        proposedValues: {
          awayFromIso: "2026-10-03T12:00:00.000Z",
          awayToIso: "2026-10-03T12:00:00.000Z",
        },
      },
      text: "Jordan Hale is away 2026-10-03",
      world: haleWorld(),
      captureEntryProjectId: ALPHA,
    });
    assert.equal(decision.kind, "write");
  });

  check("archived baseline envelope (incomplete Person + model UUID) is now Needs you", () => {
    const testCase = CAPTURE_V2_EVAL_CORPUS.find(
      (c) => c.id === "ambiguous-same-first-name",
    );
    assert.ok(testCase);
    const evaluated = evaluateAgainstCase({
      testCase,
      world: experimentalApplyWorld(),
      rawModelJson: {
        observations: [
          {
            id: "obs-archived-ambiguous-person",
            statement:
              "Brick from the warehouse called; he wants to help with assembly.",
            evidence:
              "Brick from the warehouse called; he wants to help with assembly.",
            domain: "person",
            disposition: "update_existing",
            truthIntent: "current",
            projectId: TOYWORLD_ID,
            candidateTargetId: "person-brick",
            candidateTargetTitle: "Brick Oakley",
            proposedValues: { name: "Brick Oakley" },
          },
        ],
      },
    });
    assert.equal(evaluated.lumeSafety.totals.applyReady, 0);
    assert.equal(evaluated.pipeline.resolved[0]?.decision.kind, "needs_you");
    assert.equal(evaluated.pipeline.resolved[0]?.suggestion, null);
  });

  check("model-stuffed full name in statement cannot bind incomplete transcript", () => {
    const transcript = "Jordan from the loading bay called.";
    const { row } = resolveObs(haleWorld(), transcript, {
      domain: "person",
      disposition: "update_existing",
      truthIntent: "current",
      statement: "Jordan Hale from the loading bay called.",
      evidence: transcript,
      candidateTargetId: HALE,
      candidateTargetTitle: "Jordan Hale",
    });
    assertNeedsYou(row, "stuffed statement is not identity proof");
  });

  check("every archived incomplete-Person live envelope is Needs you under current production", () => {
    const archive = JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          "src/lib/eval-capture-v2/archive/first-live-benchmark-envelopes-v1.json",
        ),
        "utf8",
      ),
    ) as {
      envelopes: Array<{
        caseId: string;
        error: string | null;
        rawJson: unknown;
      }>;
    };
    const testCase = CAPTURE_V2_EVAL_CORPUS.find(
      (c) => c.id === "ambiguous-same-first-name",
    );
    assert.ok(testCase);
    const hits = archive.envelopes.filter(
      (e) => e.caseId === "ambiguous-same-first-name" && !e.error,
    );
    assert.ok(hits.length > 0);
    for (const env of hits) {
      const evaluated = evaluateAgainstCase({
        testCase,
        world: experimentalApplyWorld(),
        rawModelJson: env.rawJson,
      });
      assert.equal(evaluated.lumeSafety.totals.applyReady, 0);
      assert.equal(evaluated.lumeSafety.totals.lumeFailures, 0);
      assert.ok(
        evaluated.pipeline.resolved.every(
          (row) => row.decision.kind !== "write" && row.suggestion === null,
        ),
      );
    }
  });

  check("UUID cannot raise certainty vs the same incomplete evidence without an id", () => {
    const transcript = "Riley from dispatch called.";
    const world = alphaWorld([
      { id: "person-riley-ash", name: "Riley Ash" },
      { id: PATEL, name: "Sam Patel" },
    ]);
    const withoutId = resolveObs(world, transcript, {
      domain: "availability",
      disposition: "update_existing",
      truthIntent: "current",
      statement: transcript,
      candidateTargetId: null,
      proposedValues: { awayFromIso: "2026-10-06" },
    });
    const withId = resolveObs(world, transcript, {
      domain: "availability",
      disposition: "update_existing",
      truthIntent: "current",
      statement: transcript,
      candidateTargetId: "person-riley-ash",
      candidateTargetTitle: "Riley Ash",
      proposedValues: { awayFromIso: "2026-10-06" },
    });
    assert.equal(withoutId.row?.decision.kind, "needs_you");
    assert.equal(withId.row?.decision.kind, "needs_you");
  });

  console.log(`\nverify-person-identity-safety: ${passed} passed`);
}

main();
