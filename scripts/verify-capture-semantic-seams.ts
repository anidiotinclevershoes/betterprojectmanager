/**
 * Field survival for the bounded Capture semantic seams.
 * Fixture observations only — no live OpenAI.
 *
 * Run: npx tsx scripts/verify-capture-semantic-seams.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { planCaptureApply } from "../src/lib/capture/apply";
import { applyCaptureOperationInMemory } from "../src/lib/capture/apply/memory-execute";
import type { CaptureApplyDecision, CaptureApplyWorld } from "../src/lib/capture/apply";
import { buildCaptureObservations } from "../src/lib/capture/review/observations";
import type { PendingSuggestion } from "../src/lib/capture/suggestions";
import type { CaptureFinding, ProposedOperation } from "../src/lib/capture/findings";
import { buildObservationExtractionPrompt } from "../src/lib/capture-v2/prompt";
import { runCaptureV2FromModelJson } from "../src/lib/capture-v2";
import type { CaptureResult, MissionState } from "../src/lib/types";

const PROJECT = "proj-seam";
const REFERENCE = "2026-09-30";

function check(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

function world(
  stakeholders: Array<{ id: string; name: string; role?: string }> = [],
): CaptureApplyWorld {
  return {
    projectIds: new Set([PROJECT]),
    projects: [
      {
        id: PROJECT,
        name: "Seam",
        code: "SEAM",
        stakeholders,
      },
    ],
    risks: [],
    todos: [],
    timeline: [
      {
        id: "ms-uat",
        projectId: PROJECT,
        label: "UAT",
        startAt: "2026-10-12T12:00:00.000Z",
      },
    ],
    knowledge: [],
  };
}

function emptyState(): MissionState {
  return {
    projects: [
      {
        id: PROJECT,
        name: "Seam",
        code: "SEAM",
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
    knowledge: [],
    risks: [],
    timeline: [],
    history: [],
    analysesThisMonth: 0,
  } as MissionState;
}

function suggestion(
  partial: Partial<PendingSuggestion> & Pick<PendingSuggestion, "kind" | "content">,
): PendingSuggestion {
  return {
    id: "op-seam",
    op: "create",
    destination: "project",
    projectId: PROJECT,
    ...partial,
  };
}

function assertWrite(decision: CaptureApplyDecision) {
  assert.equal(decision.kind, "write");
  if (decision.kind !== "write") throw new Error("expected write");
  return decision.operation;
}

function stubResult(partial: Partial<CaptureResult>): CaptureResult {
  return {
    memory: {
      id: "mem-seam",
      type: "conversation",
      title: "Seam",
      content: "",
      tags: [],
      people: [],
      occurredAt: "2026-09-30T00:00:00.000Z",
      createdAt: "2026-09-30T00:00:00.000Z",
      source: "capture",
    },
    insights: [],
    assumptions: [],
    recommendations: [],
    ...partial,
  };
}

function finding(
  partial: Partial<CaptureFinding> & Pick<CaptureFinding, "id" | "fact" | "findingType">,
): CaptureFinding {
  return {
    evidence: partial.fact,
    confidence: 0,
    requiresClarification: false,
    reasoningSummary: "test",
    ...partial,
  };
}

function main() {
  check("prompt advertises role, endAt, detail, notes, and the reference date", () => {
    const prompt = buildObservationExtractionPrompt({
      transcript: "Launch is 20 October.",
      projectBlock: "Current project: Seam",
      referenceDate: REFERENCE,
    });
    assert.match(prompt, /Authoritative reference date: 2026-09-30/);
    assert.match(prompt, /do not invent an arbitrary historical year/i);
    assert.match(prompt, /"role":/);
    assert.match(prompt, /only when the role is explicitly stated/i);
    assert.match(prompt, /"endAt":/);
    assert.match(prompt, /"detail":/);
    assert.match(prompt, /"notes":/);
    assert.match(prompt, /one requested action/i);
    assert.match(prompt, /do not strengthen temporal implications/i);
    assert.match(prompt, /by January/i);
    assert.match(prompt, /until January/i);
    assert.match(prompt, /single explicit agreement or decision/i);
    assert.match(prompt, /disposition=left_untouched rather than a shortened write/i);
  });

  check("explicit person role survives into ensure_person.roleHint and memory", () => {
    const decision = planCaptureApply({
      item: suggestion({
        kind: "stakeholder",
        legalDomain: "person",
        content: "Nina",
        proposedValues: { name: "Nina", role: "UX Designer" },
      }),
      text: "Nina has joined as the UX Designer.",
      world: world(),
      captureEntryProjectId: PROJECT,
    });
    const op = assertWrite(decision);
    assert.equal(op.type, "ensure_person");
    if (op.type !== "ensure_person") return;
    assert.equal(op.name, "Nina");
    assert.equal(op.roleHint, "UX Designer");
    const next = applyCaptureOperationInMemory(emptyState(), op);
    assert.equal(next.projects[0]?.stakeholders[0]?.role, "UX Designer");
  });

  check("a role that was not stated is not invented", () => {
    const decision = planCaptureApply({
      item: suggestion({
        kind: "stakeholder",
        legalDomain: "person",
        content: "Nina",
        proposedValues: { name: "Nina", role: "UX Designer" },
      }),
      text: "Nina joined the project.",
      world: world(),
      captureEntryProjectId: PROJECT,
    });
    const op = assertWrite(decision);
    assert.equal(op.type, "ensure_person");
    if (op.type !== "ensure_person") return;
    assert.equal(op.roleHint, undefined);
    const next = applyCaptureOperationInMemory(emptyState(), op);
    assert.equal(next.projects[0]?.stakeholders[0]?.role, "Stakeholder");
  });

  check("an existing person role is not silently rewritten", () => {
    const known = planCaptureApply({
      item: suggestion({
        kind: "stakeholder",
        legalDomain: "person",
        content: "Nina",
        proposedValues: { name: "Nina", role: "Product Manager" },
      }),
      text: "Nina has joined as the Product Manager.",
      world: world([{ id: "person-nina", name: "Nina", role: "Sponsor" }]),
      captureEntryProjectId: PROJECT,
    });
    assert.equal(known.kind, "no_change");
    const update = planCaptureApply({
      item: suggestion({
        kind: "stakeholder",
        legalDomain: "person",
        op: "update",
        content: "Nina",
        proposedValues: { name: "Nina", role: "Product Manager" },
      }),
      text: "Change Nina's role to Product Manager.",
      world: world([{ id: "person-nina", name: "Nina", role: "Sponsor" }]),
      captureEntryProjectId: PROJECT,
    });
    assert.notEqual(update.kind, "write");
  });

  check("an omitted person role is not recovered from the transcript", () => {
    const run = runCaptureV2FromModelJson({
      transcript: "Nina has joined as the UX Designer.",
      referenceDate: REFERENCE,
      rawModelJson: {
        observations: [
          {
            id: "obs-nina",
            statement: "Nina has joined",
            evidence: "Nina has joined as the UX Designer.",
            domain: "person",
            disposition: "create_new",
            truthIntent: "current",
            proposedValues: { name: "Nina" },
          },
        ],
      },
      world: world(),
      projectId: PROJECT,
    });
    const decision = run.resolved.find((row) => row.decision.kind === "write")?.decision;
    assert.ok(decision);
    const op = assertWrite(decision!);
    assert.equal(op.type, "ensure_person");
    if (op.type !== "ensure_person") return;
    assert.equal(op.roleHint, undefined);
    const left = (run.result.findings ?? []).filter((row) => row.leftUntouched);
    assert.ok(left.some((row) => /UX Designer/i.test(row.fact)));
  });

  check("operation-linked finding is not displaced by a higher-confidence insight", () => {
    const fact = "Nina has joined as the UX Designer";
    const op: ProposedOperation = {
      id: "pop-1",
      sourceFindingId: "f-nina",
      operation: "CREATE",
      entityType: "stakeholder",
      targetTitle: "Nina",
      reason: "new person",
      evidence: fact,
      confidence: 0,
      destructive: false,
      requiresClarification: false,
    };
    const observations = buildCaptureObservations(
      stubResult({
        findings: [
          finding({
            id: "f-nina",
            fact,
            findingType: "NEW_INFORMATION",
            confidence: 0,
            target: { entityType: "stakeholder", title: "Nina" },
          }),
        ],
        proposedOperations: [op],
        insights: [fact],
      }),
      fact,
      { "f-nina": "card-nina" },
    );
    const understood = observations.filter((row) => row.findingId === "f-nina");
    assert.equal(understood.length, 1);
    assert.equal(understood[0]?.actionStatus, "create");
    assert.equal(
      observations.some(
        (row) =>
          row.actionStatus === "no_change" || row.actionStatus === "ignored",
      ),
      false,
    );
  });

  check("genuine unmatched wording still surfaces as residue", () => {
    const observations = buildCaptureObservations(
      stubResult({
        findings: [],
        insights: ["The archives lift is grinding"],
      }),
      "The archives lift is grinding.",
    );
    assert.equal(observations.length, 1);
    assert.equal(observations[0]?.actionStatus, "no_change");
    assert.equal(observations[0]?.findingId, undefined);
  });

  check("an unsafe historical launch date fails closed instead of being reconstructed", () => {
    const run = runCaptureV2FromModelJson({
      transcript: "Launch is 20 October.",
      referenceDate: REFERENCE,
      rawModelJson: {
        observations: [
          {
            id: "obs-launch",
            statement: "Launch",
            evidence: "Launch is 20 October.",
            domain: "milestone",
            disposition: "create_new",
            truthIntent: "current",
            proposedValues: { label: "Launch", date: "2023-10-20" },
          },
        ],
      },
      world: world(),
      projectId: PROJECT,
    });
    const writes = run.resolved.filter((row) => row.decision.kind === "write");
    assert.equal(writes.length, 0);
    assert.ok(run.resolved.some((row) => row.decision.kind === "needs_you"));
    const persisted = JSON.stringify(run.resolved);
    assert.doesNotMatch(persisted, /2023-10-20/);
    assert.doesNotMatch(persisted, /2026-10-20/);
  });

  check("an extracted due date survives onto the To Do", () => {
    const decision = planCaptureApply({
      item: suggestion({
        kind: "action",
        legalDomain: "todo",
        content: "Send the comms pack",
        date: "2026-10-02",
        proposedValues: {
          title: "Send the comms pack",
          dueDate: "2026-10-02",
        },
      }),
      text: "Add a To Do to send the comms pack by Friday.",
      world: world(),
      captureEntryProjectId: PROJECT,
    });
    const op = assertWrite(decision);
    assert.equal(op.type, "create_todo");
    if (op.type !== "create_todo") return;
    assert.equal(op.dueAt?.slice(0, 10), "2026-10-02");
    const next = applyCaptureOperationInMemory(emptyState(), op);
    assert.equal(next.todos[0]?.dueAt?.slice(0, 10), "2026-10-02");
    const persist = readFileSync(
      join(process.cwd(), "src/lib/data/supabase/persist-mutations.ts"),
      "utf8",
    );
    assert.match(persist, /due_on: isoToDateOnly\(todo\.dueAt\)/);
  });

  check("a historical todo date is not rewritten onto the next Friday", () => {
    const run = runCaptureV2FromModelJson({
      transcript: "Add a To Do to send the comms pack by Friday.",
      referenceDate: REFERENCE,
      rawModelJson: {
        observations: [
          {
            id: "obs-friday",
            statement: "Send the comms pack",
            evidence: "Add a To Do to send the comms pack by Friday.",
            domain: "todo",
            disposition: "create_new",
            truthIntent: "current",
            proposedValues: {
              title: "Send the comms pack",
              dueDate: "2023-10-06",
            },
          },
        ],
      },
      world: world(),
      projectId: PROJECT,
    });
    const decision = run.resolved.find((row) => row.decision.kind === "write")?.decision;
    const op = assertWrite(decision!);
    assert.equal(op.type, "create_todo");
    if (op.type !== "create_todo") return;
    assert.equal(op.title, "Send the comms pack");
    assert.equal(op.dueAt, undefined);
    const persisted = JSON.stringify(op);
    assert.doesNotMatch(persisted, /2023-10-06/);
    assert.doesNotMatch(persisted, /2026-10-02/);
  });

  check("an omitted todo date is not filled from by-Friday", () => {
    const run = runCaptureV2FromModelJson({
      transcript: "Add a To Do to send the comms pack by Friday.",
      referenceDate: REFERENCE,
      rawModelJson: {
        observations: [
          {
            id: "obs-friday-missing",
            statement: "Send the comms pack",
            evidence: "Add a To Do to send the comms pack by Friday.",
            domain: "todo",
            disposition: "create_new",
            truthIntent: "current",
            proposedValues: {
              title: "Send the comms pack",
              detail: "by Friday",
            },
          },
        ],
      },
      world: world(),
      projectId: PROJECT,
    });
    const decision = run.resolved.find((row) => row.decision.kind === "write")?.decision;
    const op = assertWrite(decision!);
    assert.equal(op.type, "create_todo");
    if (op.type !== "create_todo") return;
    assert.equal(op.dueAt, undefined);
    assert.equal(op.detail, "by Friday");
  });

  check("a same-year date is transported and not corrected to a weekday", () => {
    const run = runCaptureV2FromModelJson({
      transcript: "Add a To Do to send the comms pack by Friday.",
      referenceDate: REFERENCE,
      rawModelJson: {
        observations: [
          {
            id: "obs-friday-wrong",
            statement: "Send the comms pack",
            evidence: "Add a To Do to send the comms pack by Friday.",
            domain: "todo",
            disposition: "create_new",
            truthIntent: "current",
            proposedValues: {
              title: "Send the comms pack",
              dueDate: "2026-10-07",
            },
          },
        ],
      },
      world: world(),
      projectId: PROJECT,
    });
    const decision = run.resolved.find((row) => row.decision.kind === "write")?.decision;
    const op = assertWrite(decision!);
    assert.equal(op.type, "create_todo");
    if (op.type !== "create_todo") return;
    assert.equal(op.dueAt?.slice(0, 10), "2026-10-07");
  });

  check("a milestone does not gain a Friday date that was never a calendar day", () => {
    const run = runCaptureV2FromModelJson({
      transcript: "Launch by Friday.",
      referenceDate: REFERENCE,
      rawModelJson: {
        observations: [
          {
            id: "obs-launch-friday",
            statement: "Launch",
            evidence: "Launch by Friday.",
            domain: "milestone",
            disposition: "create_new",
            truthIntent: "current",
            proposedValues: { label: "Launch" },
          },
        ],
      },
      world: world(),
      projectId: PROJECT,
    });
    const writes = run.resolved.filter((row) => row.decision.kind === "write");
    assert.equal(writes.length, 0);
  });

  check("stated milestone end date survives onto create_milestone.endAt", () => {
    const decision = planCaptureApply({
      item: suggestion({
        kind: "milestone",
        legalDomain: "milestone",
        content: "UAT",
        date: "2026-10-12",
        proposedValues: {
          label: "UAT",
          date: "2026-10-12",
          endAt: "2026-10-16",
        },
      }),
      text: "UAT runs from 12 October to 16 October.",
      world: world(),
      captureEntryProjectId: PROJECT,
    });
    const op = assertWrite(decision);
    assert.equal(op.type, "create_milestone");
    if (op.type !== "create_milestone") return;
    assert.equal(op.startAt?.slice(0, 10), "2026-10-12");
    assert.equal(op.endAt?.slice(0, 10), "2026-10-16");
    const next = applyCaptureOperationInMemory(emptyState(), op);
    assert.equal(next.timeline[0]?.endAt?.slice(0, 10), "2026-10-16");
    const persist = readFileSync(
      join(process.cwd(), "src/lib/data/supabase/persist-mutations.ts"),
      "utf8",
    );
    assert.match(persist, /end_on: isoToDateOnly\(item\.endAt\)/);
  });

  check("a historical year on a stated range is dropped, not rewritten", () => {
    const run = runCaptureV2FromModelJson({
      transcript: "UAT runs from 12 October to 16 October.",
      referenceDate: REFERENCE,
      rawModelJson: {
        observations: [
          {
            id: "obs-uat",
            statement: "UAT",
            evidence: "UAT runs from 12 October to 16 October.",
            domain: "milestone",
            disposition: "create_new",
            truthIntent: "current",
            proposedValues: {
              label: "UAT",
              date: "2023-10-12",
              endAt: "2023-10-16",
            },
          },
        ],
      },
      world: world(),
      projectId: PROJECT,
    });
    const writes = run.resolved.filter((row) => row.decision.kind === "write");
    assert.equal(writes.length, 0);
    assert.ok(run.resolved.some((row) => row.decision.kind === "needs_you"));
    const persisted = JSON.stringify(run.resolved);
    assert.doesNotMatch(persisted, /2023-10-1/);
    assert.doesNotMatch(persisted, /2026-10-1/);
  });

  check("an explicit historical year in the source is kept", () => {
    const run = runCaptureV2FromModelJson({
      transcript: "The archive milestone was 20 October 2023.",
      referenceDate: REFERENCE,
      rawModelJson: {
        observations: [
          {
            id: "obs-archive",
            statement: "Archive milestone",
            evidence: "The archive milestone was 20 October 2023.",
            domain: "milestone",
            disposition: "create_new",
            truthIntent: "current",
            proposedValues: { label: "Archive milestone", date: "2023-10-20" },
          },
        ],
      },
      world: world(),
      projectId: PROJECT,
    });
    const decision = run.resolved.find((row) => row.decision.kind === "write")?.decision;
    const op = assertWrite(decision!);
    assert.equal(op.type, "create_milestone");
    if (op.type !== "create_milestone") return;
    assert.equal(op.startAt?.slice(0, 10), "2023-10-20");
  });

  check("an extracted milestone end date is transported without local range parsing", () => {
    const run = runCaptureV2FromModelJson({
      transcript: "Launch is 20 October.",
      referenceDate: REFERENCE,
      rawModelJson: {
        observations: [
          {
            id: "obs-launch-extracted-end",
            statement: "Launch",
            evidence: "Launch is 20 October.",
            domain: "milestone",
            disposition: "create_new",
            truthIntent: "current",
            proposedValues: {
              label: "Launch",
              date: "2026-10-20",
              endAt: "2026-10-21",
            },
          },
        ],
      },
      world: world(),
      projectId: PROJECT,
    });
    const decision = run.resolved.find((row) => row.decision.kind === "write")?.decision;
    const op = assertWrite(decision!);
    assert.equal(op.type, "create_milestone");
    if (op.type !== "create_milestone") return;
    assert.equal(op.startAt?.slice(0, 10), "2026-10-20");
    assert.equal(op.endAt?.slice(0, 10), "2026-10-21");
  });

  check("one stated date does not invent a range end", () => {
    const decision = planCaptureApply({
      item: suggestion({
        kind: "milestone",
        legalDomain: "milestone",
        content: "Launch",
        date: "2026-10-20",
        proposedValues: { label: "Launch", date: "2026-10-20" },
      }),
      text: "Launch is 20 October.",
      world: world(),
      captureEntryProjectId: PROJECT,
    });
    const op = assertWrite(decision);
    assert.equal(op.type, "create_milestone");
    if (op.type !== "create_milestone") return;
    assert.equal(op.endAt, undefined);
  });

  check("one action plus an explicit detail is a single To Do", () => {
    const decision = planCaptureApply({
      item: suggestion({
        kind: "action",
        legalDomain: "todo",
        content: "Send the steering pack",
        proposedValues: {
          title: "Send the steering pack",
          detail: "Include the updated budget figures",
        },
      }),
      text: "Add a To Do to send the steering pack. Include the updated budget figures.",
      world: world(),
      captureEntryProjectId: PROJECT,
    });
    const op = assertWrite(decision);
    assert.equal(op.type, "create_todo");
    if (op.type !== "create_todo") return;
    assert.equal(op.title, "Send the steering pack");
    assert.equal(op.detail, "Include the updated budget figures");
    const next = applyCaptureOperationInMemory(emptyState(), op);
    assert.equal(next.todos.length, 1);
    assert.equal(next.todos[0]?.detail, "Include the updated budget figures");
  });

  check("independently extracted Include observations are not merged locally", () => {
    const transcript =
      "Add a To Do to send the steering pack. Include the updated budget figures.";
    const run = runCaptureV2FromModelJson({
      transcript,
      referenceDate: REFERENCE,
      rawModelJson: {
        observations: [
          {
            id: "obs-send",
            statement: "Send the steering pack",
            evidence: "Add a To Do to send the steering pack.",
            domain: "todo",
            disposition: "create_new",
            truthIntent: "current",
            proposedValues: { title: "Send the steering pack" },
          },
          {
            id: "obs-budget",
            statement: "Include the updated budget figures",
            evidence: "Include the updated budget figures.",
            domain: "todo",
            disposition: "create_new",
            truthIntent: "current",
            proposedValues: { title: "Include the updated budget figures" },
          },
        ],
      },
      world: world(),
      projectId: PROJECT,
    });
    const todos = run.resolved.filter(
      (row) =>
        row.decision.kind === "write" &&
        row.decision.operation.type === "create_todo",
    );
    assert.equal(todos.length, 2);
    const details = todos.map((row) =>
      row.decision.kind === "write" && row.decision.operation.type === "create_todo"
        ? row.decision.operation.detail
        : undefined,
    );
    assert.ok(details.every((detail) => detail == null || !/updated budget figures/i.test(detail) || detail === "Include the updated budget figures"));
  });

  check("todo detail already on the observation covers the qualifier sentence", () => {
    const transcript =
      "Add a To Do to send the steering pack. Include the updated budget figures.";
    const run = runCaptureV2FromModelJson({
      transcript,
      referenceDate: REFERENCE,
      rawModelJson: {
        observations: [
          {
            id: "obs-send-detail",
            statement: "Send the steering pack",
            evidence: "Add a To Do to send the steering pack.",
            domain: "todo",
            disposition: "create_new",
            truthIntent: "current",
            proposedValues: {
              title: "Send the steering pack",
              detail: "Include the updated budget figures.",
            },
          },
        ],
      },
      world: world(),
      projectId: PROJECT,
    });
    const left = (run.result.findings ?? []).filter((finding) => finding.leftUntouched);
    assert.ok(!left.some((finding) => /updated budget figures/i.test(finding.fact)));
    const todos = run.resolved.filter(
      (row) =>
        row.decision.kind === "write" &&
        row.decision.operation.type === "create_todo",
    );
    assert.equal(todos.length, 1);
  });

  check("two independent actions stay two To Dos", () => {
    const run = runCaptureV2FromModelJson({
      transcript:
        "Add a To Do to send the steering pack. Add a To Do to book the bridge call.",
      referenceDate: REFERENCE,
      rawModelJson: {
        observations: [
          {
            id: "obs-send",
            statement: "Send the steering pack",
            evidence: "Add a To Do to send the steering pack.",
            domain: "todo",
            disposition: "create_new",
            truthIntent: "current",
            proposedValues: { title: "Send the steering pack" },
          },
          {
            id: "obs-book",
            statement: "Book the bridge call",
            evidence: "Add a To Do to book the bridge call.",
            domain: "todo",
            disposition: "create_new",
            truthIntent: "current",
            proposedValues: { title: "Book the bridge call" },
          },
        ],
      },
      world: world(),
      projectId: PROJECT,
    });
    const todos = run.resolved.filter(
      (row) =>
        row.decision.kind === "write" &&
        row.decision.operation.type === "create_todo",
    );
    assert.equal(todos.length, 2);
  });

  check("explicit risk context survives as create_risk.notes", () => {
    const decision = planCaptureApply({
      item: suggestion({
        kind: "risk",
        legalDomain: "risk",
        content: "API supplier slips by two weeks",
        proposedValues: {
          title: "API supplier slips by two weeks",
          notes: "Their security review is late.",
        },
      }),
      text: "There is a risk that the API supplier slips by two weeks because their security review is late.",
      world: world(),
      captureEntryProjectId: PROJECT,
    });
    const op = assertWrite(decision);
    assert.equal(op.type, "create_risk");
    if (op.type !== "create_risk") return;
    assert.equal(op.title, "API supplier slips by two weeks");
    assert.equal(op.notes, "Their security review is late.");
    const next = applyCaptureOperationInMemory(emptyState(), op);
    assert.equal(next.risks?.length, 1);
    assert.equal(next.risks?.[0]?.notes, "Their security review is late.");
    assert.equal(next.risks?.[0]?.title, "API supplier slips by two weeks");
  });

  check("omitted risk notes are not manufactured from a because clause", () => {
    const transcript =
      "There is a risk that the API supplier slips by two weeks because their security review is late.";
    const run = runCaptureV2FromModelJson({
      transcript,
      referenceDate: REFERENCE,
      rawModelJson: {
        observations: [
          {
            id: "obs-risk",
            statement: "API supplier slips by two weeks",
            evidence: transcript,
            domain: "risk",
            disposition: "create_new",
            truthIntent: "current",
            proposedValues: { title: "API supplier slips by two weeks" },
          },
        ],
      },
      world: world(),
      projectId: PROJECT,
    });
    const decision = run.resolved.find((row) => row.decision.kind === "write")?.decision;
    const op = assertWrite(decision!);
    assert.equal(op.type, "create_risk");
    if (op.type !== "create_risk") return;
    assert.equal(op.title, "API supplier slips by two weeks");
    assert.equal(op.notes, undefined);
    const left = (run.result.findings ?? []).filter((row) => row.leftUntouched);
    assert.ok(left.some((row) => /security review is late/i.test(row.fact)));
  });

  check("broad evidence does not hide an unrepresented until-January qualifier", () => {
    const transcript =
      "We agreed to keep the legacy API until January because the React replacement won't be ready.";
    const run = runCaptureV2FromModelJson({
      transcript,
      referenceDate: REFERENCE,
      rawModelJson: {
        observations: [
          {
            id: "obs-decision",
            statement: "Keep the legacy API",
            evidence: transcript,
            domain: "decision",
            disposition: "create_new",
            truthIntent: "current",
            proposedValues: { text: "Keep the legacy API" },
          },
        ],
      },
      world: world(),
      projectId: PROJECT,
    });
    const left = (run.result.findings ?? []).filter((row) => row.leftUntouched);
    assert.ok(left.some((row) => /until January/i.test(row.fact)));
    const knowledge = run.resolved.find(
      (row) =>
        row.decision.kind === "write" &&
        row.decision.operation.type === "write_knowledge",
    );
    assert.ok(knowledge && knowledge.decision.kind === "write");
    if (knowledge?.decision.kind === "write" && knowledge.decision.operation.type === "write_knowledge") {
      assert.equal(knowledge.decision.operation.text, "Keep the legacy API");
      assert.doesNotMatch(knowledge.decision.operation.text, /\bby January\b/i);
    }
  });

  check("knowledge wording is not locally rewritten when the model strengthens it", () => {
    const transcript =
      "We agreed to keep the legacy API until January because the React replacement won't be ready.";
    const supplied = "The React replacement won't be ready by January.";
    const run = runCaptureV2FromModelJson({
      transcript,
      referenceDate: REFERENCE,
      rawModelJson: {
        observations: [
          {
            id: "obs-decision",
            statement: supplied,
            evidence: transcript,
            domain: "decision",
            disposition: "create_new",
            truthIntent: "current",
            proposedValues: { text: supplied },
          },
        ],
      },
      world: world(),
      projectId: PROJECT,
    });
    const knowledge = run.resolved.find(
      (row) =>
        row.decision.kind === "write" &&
        row.decision.operation.type === "write_knowledge",
    );
    assert.ok(knowledge && knowledge.decision.kind === "write");
    if (knowledge?.decision.kind === "write" && knowledge.decision.operation.type === "write_knowledge") {
      assert.equal(knowledge.decision.operation.text, supplied);
    }
    const left = (run.result.findings ?? []).filter((row) => row.leftUntouched);
    assert.ok(left.some((row) => /until January/i.test(row.fact)));
  });

  check("a supplied same-year date is not cleared by month-name parsing", () => {
    const fields = readFileSync(
      join(process.cwd(), "src/lib/capture-v2/semantic-fields.ts"),
      "utf8",
    );
    assert.doesNotMatch(fields, /january|february|nextWeekday|because\s|as the \(/i);
    const transcript =
      "We agreed to keep the legacy API until January because the React replacement won't be ready.";
    const run = runCaptureV2FromModelJson({
      transcript,
      referenceDate: REFERENCE,
      rawModelJson: {
        observations: [
          {
            id: "obs-january",
            statement: "Keep legacy API",
            evidence: transcript,
            domain: "milestone",
            disposition: "create_new",
            truthIntent: "current",
            proposedValues: {
              label: "Keep legacy API",
              date: "2026-01-01",
            },
          },
        ],
      },
      world: world(),
      projectId: PROJECT,
    });
    const dated = run.resolved.filter(
      (row) =>
        row.decision.kind === "write" &&
        row.decision.operation.type === "create_milestone" &&
        row.decision.operation.startAt?.slice(0, 10) === "2026-01-01",
    );
    assert.equal(dated.length, 1);
  });

  check("create_risk persistence writes notes on the existing risks.notes column", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260930180000_capture_risk_create_notes.sql",
      ),
      "utf8",
    );
    assert.match(sql, /create or replace function public\.persist_risk_with_knowledge/i);
    const insertAt = sql.indexOf("insert into public.risks");
    assert.ok(insertAt >= 0);
    const insert = sql.slice(insertAt, insertAt + 500);
    assert.match(insert, /\bnotes\b/);
    assert.match(insert, /p_risk->>'notes'/);
    assert.doesNotMatch(sql, /drop table|delete from|truncate/i);
  });
}

main();
