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

  check("pipeline carries an explicit role even when the model omits proposed role", () => {
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
    assert.equal(op.roleHint, "UX Designer");
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

  check("yearless launch date resolves against the supplied reference date", () => {
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
    const decision = run.resolved.find((row) => row.decision.kind === "write")?.decision;
    const op = assertWrite(decision!);
    assert.equal(op.type, "create_milestone");
    if (op.type !== "create_milestone") return;
    assert.equal(op.startAt?.slice(0, 10), "2026-10-20");
    assert.equal(op.endAt, undefined);
  });

  check("Friday resolves to the next Friday on or after the reference date", () => {
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
    assert.equal(op.dueAt?.slice(0, 10), "2026-10-02");
  });

  check("a todo create with no date still resolves an explicit by-Friday", () => {
    const run = runCaptureV2FromModelJson({
      transcript: "Add a To Do to send the comms pack by Friday.",
      referenceDate: REFERENCE,
      rawModelJson: {
        observations: [
          {
            id: "obs-friday-missing",
            statement: "Send the comms pack",
            evidence: "Add a To Do to send the comms pack.",
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
    assert.equal(op.dueAt?.slice(0, 10), "2026-10-02");
  });

  check("a same-year date that is not the named by-weekday is corrected", () => {
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
    assert.equal(op.dueAt?.slice(0, 10), "2026-10-02");
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
  });

  check("a historical year on a stated range is corrected and endAt is kept", () => {
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
    const decision = run.resolved.find((row) => row.decision.kind === "write")?.decision;
    const op = assertWrite(decision!);
    assert.equal(op.type, "create_milestone");
    if (op.type !== "create_milestone") return;
    assert.equal(op.startAt?.slice(0, 10), "2026-10-12");
    assert.equal(op.endAt?.slice(0, 10), "2026-10-16");
    const next = applyCaptureOperationInMemory(emptyState(), op);
    assert.equal(next.timeline[0]?.startAt.slice(0, 10), "2026-10-12");
    assert.equal(next.timeline[0]?.endAt?.slice(0, 10), "2026-10-16");
  });

  check("model evidence cannot invent a range end the transcript does not state", () => {
    const run = runCaptureV2FromModelJson({
      transcript: "Launch is 20 October.",
      referenceDate: REFERENCE,
      rawModelJson: {
        observations: [
          {
            id: "obs-launch-invented-end",
            statement: "Launch",
            evidence: "Launch runs from 20 October to 21 October.",
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
    assert.equal(op.endAt, undefined);
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

  check("a split action and qualifier collapse to one To Do with detail", () => {
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
    assert.equal(todos.length, 1);
    const op = todos[0]!.decision.kind === "write" ? todos[0]!.decision.operation : null;
    assert.equal(op?.type, "create_todo");
    if (op?.type !== "create_todo") return;
    assert.equal(op.title, "Send the steering pack");
    assert.match(op.detail ?? "", /updated budget figures/);
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
    assert.equal(left.length, 0);
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

  check("risk notes stated only in the source land on the create", () => {
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
    assert.match(op.notes ?? "", /security review is late/i);
  });

  check("knowledge text does not gain an unstated by-January deadline", () => {
    const evidence =
      "We agreed to keep the legacy API until January because the React replacement won't be ready.";
    const run = runCaptureV2FromModelJson({
      transcript: evidence,
      referenceDate: REFERENCE,
      rawModelJson: {
        observations: [
          {
            id: "obs-decision",
            statement: "The React replacement won't be ready by January.",
            evidence,
            domain: "decision",
            disposition: "create_new",
            truthIntent: "current",
            proposedValues: {
              text: "The React replacement won't be ready by January.",
            },
          },
        ],
      },
      world: world(),
      projectId: PROJECT,
    });
    const decision = run.resolved.find((row) => row.decision.kind === "write")?.decision;
    const op = assertWrite(decision!);
    assert.equal(op.type, "write_knowledge");
    if (op.type !== "write_knowledge") return;
    assert.doesNotMatch(op.text, /\bby January\b/i);
    assert.match(op.text, /until January/i);
    assert.match(op.text, /won't be ready/i);
  });

  check("a month without a day does not become the first of that month", () => {
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
    assert.equal(dated.length, 0);
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
