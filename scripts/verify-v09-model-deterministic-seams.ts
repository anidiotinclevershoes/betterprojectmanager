/**
 * v0.9 MODEL↔DETERMINISTIC SEAM torture pack.
 *
 * Qualification only. Does not change production. Not in npm test.
 * Frozen envelopes: PR #114 live run 33323265425, uncleaned.
 *
 *   npx --yes tsx scripts/verify-v09-model-deterministic-seams.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { applyApprovedCaptureSuggestion } from "../src/lib/capture/apply/apply-approved";
import { supabaseCaptureApplyHooks } from "../src/lib/capture/apply/persist-execute";
import { worldFromCaptureState, runCaptureV2FromModelJson } from "../src/lib/capture-v2";
import { missingReadySemantics } from "../src/lib/capture-v2/contract";
import type { CaptureObservationV2 } from "../src/lib/capture-v2/types";
import { answerTellMeQuestion, constrainScheduledDateConfidence } from "../src/lib/tell-me/answer";
import { parseNewProjectV2Envelope, draftFromProvisional } from "../src/lib/new-project-v2";
import { loadMissionStateFromSupabase } from "../src/lib/data/supabase/load-mission-state";
import { emptyKnowledge } from "../src/lib/knowledge";
import type { PendingSuggestion } from "../src/lib/capture/suggestions";
import type { MissionState } from "../src/lib/types";
import { FakeWorkspaceClient } from "./lib/fake-supabase-workspace";

const ROOT = join(import.meta.dirname, "..");
const PROJECT_A = "aaaaaaaa-aaaa-4aaa-8aaa-000000000001";
const PROJECT_B = "aaaaaaaa-aaaa-4aaa-8aaa-000000000002";
const TODO_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PERSON_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MILESTONE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const RISK_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const LIVE = JSON.parse(
  readFileSync(join(ROOT, "scripts/seams/live-envelopes.json"), "utf8"),
) as {
  sourceRun: string;
  envelopes: Array<{
    capture: number;
    rawInput: string;
    observations: Array<Record<string, unknown>>;
  }>;
};

function live(n: number) {
  const row = LIVE.envelopes.find((e) => e.capture === n);
  if (!row) throw new Error(`missing live envelope C${n}`);
  return row;
}

type Bucket = "PASS" | "EXPECTED_RED" | "UNEXPECTED_RED";
type Fate = "PASS" | "NEEDS_YOU" | "REJECTS" | "UNSAFE_ASSUMPTION";

type Journey = {
  id: string;
  seam: number;
  title: string;
  bucket: Bucket;
  fate: Fate;
  expectedBucket: Bucket;
  detail: string;
  severity: "P0" | "P1" | "P2" | "none";
};

const journeys: Journey[] = [];

function record(row: Journey) {
  journeys.push(row);
  const mark =
    row.bucket === "PASS" ? "PASS" : row.bucket === "EXPECTED_RED" ? "EXPECTED_RED" : "UNEXPECTED_RED";
  console.log(`${mark.padEnd(16)} S${row.seam} ${row.id} — ${row.title}`);
  console.log(`                 ${row.fate} ${row.detail}`);
}

function asClient(fake: FakeWorkspaceClient) {
  return fake as never;
}

async function load(fake: FakeWorkspaceClient): Promise<MissionState> {
  return (await loadMissionStateFromSupabase(asClient(fake))).state;
}

function seedBase(fake: FakeWorkspaceClient) {
  fake.seedProject({
    id: PROJECT_A,
    workspace_id: fake.workspaceId,
    name: "Northstar Member Portal Renewal",
    code: "NSTAR",
  });
  fake.seedProject({
    id: PROJECT_B,
    workspace_id: fake.workspaceId,
    name: "Atlas Billing Cutover",
    code: "ATLAS",
  });
}

function seedBoard(fake: FakeWorkspaceClient) {
  seedBase(fake);
  fake.tables.todos.push({
    id: TODO_ID,
    workspace_id: fake.workspaceId,
    project_id: PROJECT_A,
    title: "Login error handling",
    done: false,
  });
  fake.tables.stakeholders.push({
    id: PERSON_ID,
    workspace_id: fake.workspaceId,
    project_id: PROJECT_A,
    name: "Sarah Kim",
    role: "Security",
  });
  fake.tables.milestones.push({
    id: MILESTONE_ID,
    workspace_id: fake.workspaceId,
    project_id: PROJECT_A,
    label: "CAB",
    start_on: "2026-10-18",
    type: "milestone",
    source: "manual",
  });
  fake.tables.risks.push({
    id: RISK_ID,
    workspace_id: fake.workspaceId,
    project_id: PROJECT_A,
    title: "API timeout",
    status: "open",
  });
}

function workspaceFrom(fake: FakeWorkspaceClient, state: MissionState) {
  return { workspaceId: fake.workspaceId, userId: fake.userId, state };
}

async function applyItem(
  fake: FakeWorkspaceClient,
  item: PendingSuggestion,
  text: string,
) {
  const state = await load(fake);
  return applyApprovedCaptureSuggestion({
    item,
    text,
    projectId: item.projectId || PROJECT_A,
    expectedTarget: item.expectedTarget,
    loadWorkspace: async () => workspaceFrom(fake, await load(fake)),
    hooks: supabaseCaptureApplyHooks({
      client: asClient(fake),
      workspaceId: fake.workspaceId,
      userId: fake.userId,
      state,
    }),
    reloadWorkspace: async () => load(fake),
  });
}

async function runEnvelope(
  fake: FakeWorkspaceClient,
  rawInput: string,
  observations: unknown[],
) {
  const state = await load(fake);
  const world = worldFromCaptureState(state);
  const pipeline = runCaptureV2FromModelJson({
    transcript: rawInput,
    rawModelJson: { observations },
    world,
    projectId: PROJECT_A,
  });
  const applied: Array<{ kind: string; reason?: string; domain?: string }> = [];
  for (const row of pipeline.resolved) {
    if (row.decision.kind !== "write" || !row.suggestion) continue;
    const result = await applyItem(fake, row.suggestion, rawInput);
    applied.push({
      kind: result.executed.kind,
      reason: "reason" in result.executed ? result.executed.reason : undefined,
      domain: result.executed.kind === "wrote" ? undefined : row.observation.domain,
    });
  }
  return { pipeline, applied, state: await load(fake) };
}

function obs(partial: Record<string, unknown>): Record<string, unknown> {
  return {
    evidence: partial.evidence ?? partial.statement ?? "evidence",
    truthIntent: partial.truthIntent ?? "current",
    ...partial,
  };
}

async function main() {
  // ── S1 receipt collision (known #113 / #114) ──
  {
    const fake = new FakeWorkspaceClient();
    seedBase(fake);
    const c9 = live(9);
    const first = await runEnvelope(fake, c9.rawInput, c9.observations);
    const c11 = live(11);
    const uatOnly = c11.observations.filter((o) => o.id === "obs-1");
    const second = await runEnvelope(fake, c11.rawInput, uatOnly);
    const todos = second.state.todos.filter((t) => t.projectId === PROJECT_A);
    const milestones = (second.state.timeline ?? []).filter((t) => t.projectId === PROJECT_A);
    const uatBlocked = second.applied.some(
      (a) => a.kind === "no_change" && (a.reason ?? "").includes("already applied"),
    );
    const uatMissing = !milestones.some((m) => /UAT/i.test(m.label));
    const unsafe = first.applied.some((a) => a.kind === "wrote") && uatBlocked && uatMissing;
    record({
      id: "S1-receipt-obs-1",
      seam: 1,
      title: "Live C9 obs-1 todo then C11 obs-1 UAT create",
      expectedBucket: "EXPECTED_RED",
      bucket: unsafe ? "EXPECTED_RED" : "UNEXPECTED_RED",
      fate: unsafe ? "UNSAFE_ASSUMPTION" : "PASS",
      severity: "P0",
      detail: `C9 applied=${JSON.stringify(first.applied)} C11 applied=${JSON.stringify(second.applied)} todos=${todos.length} milestones=${milestones.map((m) => m.label).join(",") || "(none)"}`,
    });
  }

  // ── S1 duplicate ID inside one envelope ──
  {
    const c9 = live(9);
    const fake = new FakeWorkspaceClient();
    seedBase(fake);
    const dup = [c9.observations[0], { ...c9.observations[0], statement: "Vendor contract check", proposedValues: { title: "Vendor contract check" } }];
    const ran = await runEnvelope(fake, c9.rawInput, dup);
    const titles = ran.state.todos.filter((t) => t.projectId === PROJECT_A).map((t) => t.title);
    const both = titles.includes("Login error handling") && titles.includes("Vendor contract check");
    const secondDropped = ran.applied.filter((a) => a.kind === "wrote").length < 2 && !both;
    record({
      id: "S1-dup-in-envelope",
      seam: 1,
      title: "Two different creates share obs-1 in one envelope",
      expectedBucket: "EXPECTED_RED",
      bucket: secondDropped ? "EXPECTED_RED" : both ? "PASS" : "UNEXPECTED_RED",
      fate: secondDropped ? "UNSAFE_ASSUMPTION" : both ? "PASS" : "NEEDS_YOU",
      severity: "P0",
      detail: `applied=${JSON.stringify(ran.applied)} titles=${titles.join(" | ")}`,
    });
  }

  // ── S1 missing observation.id (schema default) ──
  {
    const fake = new FakeWorkspaceClient();
    seedBase(fake);
    const ran = await runEnvelope(fake, "Add a to-do for cutover runbook.", [
      obs({
        statement: "Add a to-do for cutover runbook.",
        domain: "todo",
        disposition: "create_new",
        proposedValues: { title: "Cutover runbook" },
      }),
    ]);
    const acceptedId = ran.pipeline.validation.observations[0]?.id;
    const wrote = ran.applied.some((a) => a.kind === "wrote");
    record({
      id: "S1-missing-id",
      seam: 1,
      title: "Missing observation.id is defaulted, not rejected",
      expectedBucket: "PASS",
      bucket: acceptedId ? "PASS" : "UNEXPECTED_RED",
      fate: acceptedId ? (wrote ? "PASS" : "NEEDS_YOU") : "REJECTS",
      severity: "P2",
      detail: `defaultedId=${acceptedId ?? "(none)"} applied=${JSON.stringify(ran.applied)}`,
    });
  }

  // ── S1 live C1 person update targeting project UUID ──
  {
    const fake = new FakeWorkspaceClient();
    seedBase(fake);
    const c1 = live(1);
    const ran = await runEnvelope(fake, c1.rawInput, c1.observations);
    const rejected = ran.pipeline.validation.rejected.length > 0;
    const writes = ran.pipeline.resolved.filter((r) => r.decision.kind === "write").length;
    const people = ran.state.projects.find((p) => p.id === PROJECT_A)?.stakeholders ?? [];
    const unsafe = writes > 0 && ran.applied.some((a) => a.kind === "wrote") && people.some((p) => p.id === PROJECT_A);
    record({
      id: "S1-live-c1-project-as-person-target",
      seam: 1,
      title: "Live C1 person update_existing targets the project UUID",
      expectedBucket: "PASS",
      bucket: unsafe ? "UNEXPECTED_RED" : "PASS",
      fate: unsafe ? "UNSAFE_ASSUMPTION" : rejected || writes === 0 ? "REJECTS" : "NEEDS_YOU",
      severity: unsafe ? "P0" : "none",
      detail: `rejected=${ran.pipeline.validation.rejected.length} writes=${writes} issues=${ran.pipeline.validation.issues.map((i) => i.code).join(",")} people=${people.map((p) => p.name).join(",")}`,
    });
  }

  // ── S2 optional→required matrix ──
  {
    const cases: Array<{ id: string; observation: Record<string, unknown> }> = [
      { id: "person-no-name", observation: obs({ id: "obs-1", domain: "person", disposition: "create_new", statement: "Someone joined.", proposedValues: {} }) },
      { id: "todo-no-title", observation: obs({ id: "obs-1", domain: "todo", disposition: "create_new", statement: "   ", proposedValues: {} }) },
      { id: "todo-empty-statement", observation: { id: "obs-1", domain: "todo", disposition: "create_new", statement: "", evidence: "x", truthIntent: "current", proposedValues: {} } },
      { id: "risk-no-title", observation: obs({ id: "obs-1", domain: "risk", disposition: "create_new", statement: "There is a risk.", proposedValues: {} }) },
      { id: "ms-no-label", observation: obs({ id: "obs-1", domain: "milestone", disposition: "create_new", statement: "A date exists.", proposedValues: { date: "2026-10-18" } }) },
      { id: "ms-no-date", observation: obs({ id: "obs-1", domain: "milestone", disposition: "create_new", statement: "CAB soon.", proposedValues: { label: "CAB" } }) },
      { id: "avail-no-person", observation: obs({ id: "obs-1", domain: "availability", disposition: "create_new", statement: "Away next week.", proposedValues: { awayFromIso: "2026-10-05" } }) },
      { id: "avail-label-only", observation: obs({ id: "obs-1", domain: "availability", disposition: "create_new", statement: "Elena is away.", proposedValues: { personName: "Elena Voss", label: "away next week" } }) },
      { id: "resp-no-person", observation: obs({ id: "obs-1", domain: "responsibility", disposition: "create_new", statement: "UAT needs an owner.", proposedValues: { scope: "UAT", ownershipSemantics: "replace" } }) },
      { id: "resp-no-scope", observation: obs({ id: "obs-1", domain: "responsibility", disposition: "create_new", statement: "Jordan owns it.", proposedValues: { personName: "Jordan Hale", ownershipSemantics: "replace" } }) },
      { id: "knowledge-empty", observation: obs({ id: "obs-1", domain: "knowledge", disposition: "create_new", statement: "   ", proposedValues: {} }) },
    ];
    const readyAnyway: string[] = [];
    const statementFallback: string[] = [];
    const gated: string[] = [];
    for (const row of cases) {
      const fake = new FakeWorkspaceClient();
      seedBase(fake);
      const ran = await runEnvelope(fake, String(row.observation.statement ?? ""), [row.observation]);
      const writes = ran.pipeline.resolved.filter((r) => r.decision.kind === "write").length;
      const accepted = ran.pipeline.validation.observations[0];
      const missing = accepted ? missingReadySemantics(accepted as CaptureObservationV2) : "rejected";
      const values = (row.observation.proposedValues ?? {}) as Record<string, unknown>;
      const hasProposedIdentity = Boolean(
        values.name || values.title || values.label || values.personName,
      );
      if (writes > 0 && !hasProposedIdentity) {
        statementFallback.push(`${row.id}(writes=${writes},missing=${missing})`);
      } else if (writes > 0) {
        readyAnyway.push(`${row.id}(writes=${writes},missing=${missing})`);
      } else {
        gated.push(`${row.id}:${ran.pipeline.resolved[0]?.decision.kind ?? "rejected"}`);
      }
    }
    record({
      id: "S2-required-fields",
      seam: 2,
      title: "Missing required semantics must not be Ready",
      expectedBucket: "PASS",
      bucket: readyAnyway.length ? "UNEXPECTED_RED" : "PASS",
      fate: readyAnyway.length ? "UNSAFE_ASSUMPTION" : "NEEDS_YOU",
      severity: readyAnyway.length ? "P0" : statementFallback.length ? "P2" : "none",
      detail: `gated=[${gated.join("; ")}] statementFallback=[${statementFallback.join("; ") || "none"}] readyAnyway=[${readyAnyway.join("; ") || "none"}]`,
    });
  }

  // ── S3 contradictory combinations ──
  {
    const fake = new FakeWorkspaceClient();
    seedBoard(fake);
    const combos = [
      obs({ id: "obs-1", domain: "milestone", disposition: "update_existing", truthIntent: "non_current", candidateTargetId: MILESTONE_ID, candidateTargetTitle: "CAB", statement: "Old note said CAB 12th.", proposedValues: { date: "2026-10-12" } }),
      obs({ id: "obs-2", domain: "person", disposition: "create_new", truthIntent: "uncertain", statement: "Maybe add Chris Bell.", proposedValues: { name: "Chris Bell" } }),
      obs({ id: "obs-3", domain: "todo", disposition: "create_new", candidateTargetId: TODO_ID, candidateTargetTitle: "Login error handling", statement: "A new todo.", proposedValues: { title: "New todo" } }),
      obs({ id: "obs-4", domain: "risk", disposition: "no_change", statement: "API timeout still open.", candidateTargetId: RISK_ID, proposedValues: { status: "resolved" } }),
      obs({ id: "obs-5", domain: "commentary", disposition: "commentary", statement: "Chatter.", candidateTargetId: PERSON_ID, proposedValues: { name: "Sarah Kim" } }),
      obs({ id: "obs-6", domain: "risk", disposition: "update_existing", statement: "Mark the risk spicy.", candidateTargetId: RISK_ID, proposedValues: { status: "spicy" } }),
    ];
    const ran = await runEnvelope(fake, "Contradictory but valid JSON.", combos);
    const writes = ran.pipeline.resolved.filter((r) => r.decision.kind === "write");
    const wrote = ran.applied.filter((a) => a.kind === "wrote");
    const unsafe = wrote.length > 0;
    record({
      id: "S3-invalid-combos",
      seam: 3,
      title: "Structurally valid contradictory observations",
      expectedBucket: "PASS",
      bucket: unsafe ? "UNEXPECTED_RED" : "PASS",
      fate: unsafe ? "UNSAFE_ASSUMPTION" : writes.length ? "NEEDS_YOU" : "PASS",
      severity: unsafe ? "P1" : "none",
      detail: `resolveWrites=${writes.length} appliedWrote=${wrote.length} decisions=${ran.pipeline.resolved.map((r) => `${r.observation.id}:${r.decision.kind}`).join(",")}`,
    });
  }

  // ── S4 Review value = Apply value ──
  {
    const fake = new FakeWorkspaceClient();
    seedBase(fake);
    const item: PendingSuggestion = {
      id: "review-sarah-kim",
      kind: "stakeholder",
      op: "create",
      content: "Sarah Kim",
      destination: "project",
      projectId: PROJECT_A,
      legalDomain: "person",
      personName: "Sarah Kim",
      proposedValues: { name: "Sarah Kim" },
      truthIntent: "current",
    };
    const applied = await applyItem(
      fake,
      item,
      "Sarah Kim is security — different Sarah from Sarah Okonkwo on product. Please add Sarah Kim.",
    );
    const people = (await load(fake)).projects.find((p) => p.id === PROJECT_A)?.stakeholders ?? [];
    const names = people.map((p) => p.name);
    const ok = applied.executed.kind === "wrote" && names.includes("Sarah Kim") && !names.includes("Sarah Okonkwo");
    record({
      id: "S4-person-review-vs-transcript",
      seam: 4,
      title: "Reviewed Sarah Kim must not become Sarah Okonkwo from transcript",
      expectedBucket: "PASS",
      bucket: ok ? "PASS" : "UNEXPECTED_RED",
      fate: ok ? "PASS" : "UNSAFE_ASSUMPTION",
      severity: ok ? "none" : "P0",
      detail: `executed=${applied.executed.kind} people=${names.join(",")}`,
    });
  }

  {
    const fake = new FakeWorkspaceClient();
    seedBoard(fake);
    const item: PendingSuggestion = {
      id: "review-cab-20",
      kind: "milestone",
      op: "update",
      content: "CAB",
      destination: "project",
      projectId: PROJECT_A,
      legalDomain: "milestone",
      targetEntityId: MILESTONE_ID,
      date: "2026-10-20",
      proposedValues: { label: "CAB", date: "2026-10-20" },
      expectedTarget: { entityType: "milestone", id: MILESTONE_ID, projectId: PROJECT_A },
      truthIntent: "current",
    };
    const applied = await applyItem(
      fake,
      item,
      "Steering PDF still shows CAB on the 12th. Old note says 18 Oct 2023. CAB is 20 Oct 2026.",
    );
    const row = (await load(fake)).timeline.find((t) => t.id === MILESTONE_ID);
    const iso = (row?.startAt ?? "").slice(0, 10);
    const ok = applied.executed.kind === "wrote" && iso === "2026-10-20";
    record({
      id: "S4-date-review-vs-transcript",
      seam: 4,
      title: "Reviewed CAB 20 Oct 2026 must not become 2023 from transcript",
      expectedBucket: "PASS",
      bucket: ok ? "PASS" : "UNEXPECTED_RED",
      fate: ok ? "PASS" : "UNSAFE_ASSUMPTION",
      severity: ok ? "none" : "P0",
      detail: `executed=${applied.executed.kind} startAt=${row?.startAt ?? "(missing)"}`,
    });
  }

  // ── S5 ordering ──
  {
    const a = [
      obs({ id: "obs-1", domain: "person", disposition: "create_new", statement: "Jordan Hale is test lead.", proposedValues: { name: "Jordan Hale" } }),
      obs({ id: "obs-2", domain: "todo", disposition: "create_new", statement: "Jordan Hale is test lead.", proposedValues: { title: "UAT script" } }),
    ];
    const commentary = obs({ id: "obs-0", domain: "commentary", disposition: "commentary", statement: "Unrelated chatter first.", truthIntent: "uncertain" });
    const variants = [
      { id: "orig", list: a },
      { id: "rev", list: [...a].reverse() },
      { id: "chat-first", list: [commentary, ...a] },
    ];
    const shapes: string[] = [];
    for (const v of variants) {
      const fake = new FakeWorkspaceClient();
      seedBase(fake);
      const ran = await runEnvelope(fake, "Jordan Hale is test lead. Need a UAT script.", v.list);
      const people = (ran.state.projects.find((p) => p.id === PROJECT_A)?.stakeholders ?? []).map((p) => p.name);
      const todos = ran.state.todos.filter((t) => t.projectId === PROJECT_A).map((t) => t.title);
      shapes.push(`${v.id}:people=${people.join(",")}|todos=${todos.join(",")}`);
    }
    const same = shapes.every((s) => s.includes("Jordan Hale") && s.includes("UAT script"));
    record({
      id: "S5-order-independence",
      seam: 5,
      title: "Same semantics in original / reversed / commentary-first order",
      expectedBucket: "PASS",
      bucket: same ? "PASS" : "UNEXPECTED_RED",
      fate: same ? "PASS" : "UNSAFE_ASSUMPTION",
      severity: same ? "none" : "P1",
      detail: shapes.join(" || "),
    });
  }

  // ── S6 cross-domain targets ──
  {
    const fake = new FakeWorkspaceClient();
    seedBoard(fake);
    const attacks = [
      obs({ id: "obs-1", domain: "person", disposition: "update_existing", statement: "Update this person.", candidateTargetId: TODO_ID, candidateTargetTitle: "Login error handling", proposedValues: { name: "Priya Shah" } }),
      obs({ id: "obs-2", domain: "todo", disposition: "update_existing", statement: "Move the todo date.", candidateTargetId: MILESTONE_ID, candidateTargetTitle: "CAB", proposedValues: { date: "2026-10-20" } }),
      obs({ id: "obs-3", domain: "milestone", disposition: "update_existing", statement: "Move CAB.", candidateTargetId: RISK_ID, candidateTargetTitle: "API timeout", proposedValues: { date: "2026-10-20", label: "CAB" } }),
      obs({ id: "obs-4", domain: "risk", disposition: "update_existing", statement: "Resolve the risk.", candidateTargetId: PERSON_ID, candidateTargetTitle: "Sarah Kim", proposedValues: { status: "resolved" } }),
    ];
    const ran = await runEnvelope(fake, "Cross-domain target IDs.", attacks);
    const writes = ran.pipeline.resolved.filter((r) => r.decision.kind === "write");
    const wrote = ran.applied.filter((a) => a.kind === "wrote");
    const acceptedWrongDomain = ran.pipeline.validation.observations.filter((o) => o.candidateTargetId);
    record({
      id: "S6-cross-domain-targets",
      seam: 6,
      title: "Valid IDs of the wrong domain must not execute",
      expectedBucket: "PASS",
      bucket: wrote.length ? "UNEXPECTED_RED" : "PASS",
      fate: wrote.length ? "UNSAFE_ASSUMPTION" : writes.length ? "NEEDS_YOU" : "REJECTS",
      severity: wrote.length ? "P0" : "none",
      detail: `acceptedWithTarget=${acceptedWrongDomain.map((o) => `${o.domain}->${o.candidateTargetId}`).join(",")} writes=${writes.length} wrote=${wrote.length} issues=${ran.pipeline.validation.issues.map((i) => i.code).join(",")}`,
    });
  }

  // ── S7 completeness ──
  {
    const fake = new FakeWorkspaceClient();
    seedBase(fake);
    const ran = await runEnvelope(fake, "Ten facts in the room. Model returned two.", [
      obs({ id: "obs-1", domain: "person", disposition: "create_new", statement: "Priya Shah is the delivery PM.", proposedValues: { name: "Priya Shah" } }),
      obs({ id: "obs-2", domain: "todo", disposition: "create_new", statement: "Login error handling.", proposedValues: { title: "Login error handling" } }),
    ]);
    const people = ran.state.projects.find((p) => p.id === PROJECT_A)?.stakeholders ?? [];
    const todos = ran.state.todos.filter((t) => t.projectId === PROJECT_A);
    const invented = people.length > 1 || todos.length > 1;
    record({
      id: "S7-partial-extract",
      seam: 7,
      title: "Two valid observations must not invent the missing eight",
      expectedBucket: "PASS",
      bucket: invented ? "UNEXPECTED_RED" : "PASS",
      fate: invented ? "UNSAFE_ASSUMPTION" : "PASS",
      severity: invented ? "P1" : "none",
      detail: `people=${people.map((p) => p.name).join(",")} todos=${todos.map((t) => t.title).join(",")}`,
    });
  }

  // ── S8 New Project adapter ──
  {
    const hostile = {
      observations: [
        obs({ id: "obs-1", domain: "person", disposition: "create_new", statement: "Someone important joined.", proposedValues: {} }),
        obs({ id: "obs-1", domain: "person", disposition: "create_new", statement: "Priya Shah is PM.", proposedValues: { name: "Priya Shah" } }),
        obs({ id: "obs-2", domain: "milestone", disposition: "create_new", statement: "CAB soon.", proposedValues: { label: "CAB" } }),
        obs({ id: "obs-3", domain: "person", disposition: "create_new", truthIntent: "uncertain", statement: "Maybe Liam Brooks.", proposedValues: { name: "Liam Brooks" } }),
      ],
    };
    const parsed = parseNewProjectV2Envelope(hostile);
    const draft = draftFromProvisional({
      sourceNarrative: "Kickoff dump",
      sourceMode: "talk",
      project: parsed.project,
      items: parsed.items,
    });
    const nameless = (draft.stakeholders ?? []).filter((s) => !s.name || s.name === "Someone important joined.");
    const recategoriseHits = parsed.items.filter((i) => i.id === "obs-1").length;
    const assumedNameFromStatement = (draft.stakeholders ?? []).some((s) => s.name === "Someone important joined.");
    record({
      id: "S8-new-project-adapter",
      seam: 8,
      title: "New Project must not assume stronger semantics than Capture",
      expectedBucket: "PASS",
      bucket: assumedNameFromStatement ? "UNEXPECTED_RED" : "PASS",
      fate: assumedNameFromStatement ? "UNSAFE_ASSUMPTION" : nameless.length ? "NEEDS_YOU" : "PASS",
      severity: assumedNameFromStatement ? "P1" : recategoriseHits > 1 ? "P2" : "none",
      detail: `items=${parsed.items.length} ids=${parsed.items.map((i) => i.id).join(",")} stakeholders=${JSON.stringify(draft.stakeholders)} dates=${JSON.stringify(draft.importantDates)} duplicateObs1=${recategoriseHits} nameless=${nameless.length}`,
    });
  }

  // ── S9 Ask confidence / authority ──
  {
    const knowledgeSrc = [{ id: "k1", kind: "knowledge" as const, label: "Go on 27 October" }];
    const timelineSrc = [{ id: "t1", kind: "timeline" as const, label: "Release 27 Oct" }];
    const dateFromKnowledge = constrainScheduledDateConfidence({
      question: "What is the current target release date?",
      confidence: "direct_confirmation",
      sources: knowledgeSrc,
    });
    const dateFromTimeline = constrainScheduledDateConfidence({
      question: "What is the current target release date?",
      confidence: "direct_confirmation",
      sources: timelineSrc,
    });
    const ownerFromKnowledge = constrainScheduledDateConfidence({
      question: "Who currently owns UAT?",
      confidence: "direct_confirmation",
      sources: knowledgeSrc,
    });
    const riskFromHistory = constrainScheduledDateConfidence({
      question: "What are the main open risks right now?",
      confidence: "direct_confirmation",
      sources: [{ id: "h1", kind: "history" as const, label: "We used to worry about CAB" }],
    });
    const dateOk = dateFromKnowledge === "related_context" && dateFromTimeline === "direct_confirmation";
    const ownerUngated = ownerFromKnowledge === "direct_confirmation";
    const riskUngated = riskFromHistory === "direct_confirmation";

    const askState: MissionState = {
      projects: [
        {
          id: PROJECT_A,
          name: "Northstar Member Portal Renewal",
          code: "NSTAR",
          summary: "",
          status: "healthy",
          currentFocus: "CAB",
          stakeholders: [{ id: PERSON_ID, name: "Sarah Kim", role: "Security" }],
        },
      ],
      memories: [],
      recommendations: [],
      meetings: [],
      releases: [],
      todos: [
        {
          id: TODO_ID,
          projectId: PROJECT_A,
          title: "Login error handling",
          done: false,
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ],
      knowledge: [
        {
          ...emptyKnowledge(PROJECT_A),
          sections: {
            now: ["Login error handling is done according to the steering note."],
            decisions: ["Go on 27 October"],
            risks: ["Historical CAB risk note from the last renewal"],
            people: ["Priya owns UAT according to an old email"],
            openLoops: [],
          },
        },
      ],
      risks: [],
      timeline: [
        {
          id: MILESTONE_ID,
          projectId: PROJECT_A,
          label: "Release",
          type: "milestone",
          startAt: "2026-10-27T12:00:00.000Z",
          source: "manual",
        },
      ],
      history: [
        {
          id: "hist-1",
          projectId: PROJECT_A,
          createdAt: "2025-01-01T00:00:00.000Z",
          type: "other",
          title: "Priya used to own UAT",
          detail: "Priya used to own UAT. We used to worry about CAB.",
        },
      ],
    };

    const askDate = await answerTellMeQuestion({
      question: "What is the current target release date?",
      state: askState,
      selectedProjectId: PROJECT_A,
    });
    const askOwnerHistory = await answerTellMeQuestion({
      question: "Who currently owns UAT?",
      state: askState,
      selectedProjectId: PROJECT_A,
    });
    const askRiskKnowledge = await answerTellMeQuestion({
      question: "What are the main open risks right now?",
      state: askState,
      selectedProjectId: PROJECT_A,
    });
    const askTodoStatus = await answerTellMeQuestion({
      question: "What is the current status of login error handling?",
      state: askState,
      selectedProjectId: PROJECT_A,
    });

    const ownerHistoryLeak =
      askOwnerHistory.confidence === "direct_confirmation" &&
      askOwnerHistory.sources.every((s) => s.kind === "knowledge" || s.kind === "history");
    const riskKnowledgeLeak =
      askRiskKnowledge.confidence === "direct_confirmation" &&
      !askRiskKnowledge.sources.some((s) => s.kind === "risk");
    const todoKnowledgeLeak =
      askTodoStatus.confidence === "direct_confirmation" &&
      askTodoStatus.sources.every((s) => s.kind === "knowledge" || s.kind === "history");
    const dateAskLeak = askDate.confidence === "direct_confirmation" &&
      !askDate.sources.some((s) => s.kind === "timeline" || s.kind === "release");

    const leak = !dateOk || dateAskLeak || ownerHistoryLeak || riskKnowledgeLeak || todoKnowledgeLeak;
    record({
      id: "S9-ask-authority",
      seam: 9,
      title: "Confidence must not exceed cited source kind",
      expectedBucket: "PASS",
      bucket: leak ? "UNEXPECTED_RED" : "PASS",
      fate: leak ? "UNSAFE_ASSUMPTION" : "PASS",
      severity: !dateOk || dateAskLeak ? "P1" : leak ? "P1" : ownerUngated || riskUngated ? "P2" : "none",
      detail: `gate date/knowledge=${dateFromKnowledge} date/timeline=${dateFromTimeline} owner/knowledge=${ownerFromKnowledge} (fnUngated=${ownerUngated}) risk/history=${riskFromHistory} (fnUngated=${riskUngated}) | ask date=${askDate.confidence}/${askDate.sources.map((s) => s.kind).join("+") || "none"} owner=${askOwnerHistory.confidence}/${askOwnerHistory.sources.map((s) => s.kind).join("+") || "none"} risk=${askRiskKnowledge.confidence}/${askRiskKnowledge.sources.map((s) => s.kind).join("+") || "none"} todo=${askTodoStatus.confidence}/${askTodoStatus.sources.map((s) => s.kind).join("+") || "none"}`,
    });
  }

  // ── S10 model value as durable identity (static + live id reuse) ──
  {
    const hits: string[] = [];
    const files = [
      "src/lib/capture-v2/resolve.ts",
      "src/lib/capture-v2/toResult.ts",
      "src/lib/capture/apply/dispatch.ts",
      "src/lib/capture/apply/apply-approved.ts",
      "src/lib/capture/apply/persist-execute.ts",
      "src/lib/data/supabase/persist-mutations.ts",
      "src/lib/new-project-v2/parse.ts",
      "src/lib/new-project-v2/map.ts",
    ];
    for (const rel of files) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      if (src.includes("`v2-${observation.id}`")) {
        hits.push(`${rel}: suggestion id = v2-\${observation.id} (durable applyOperationId)`);
      }
      if (src.includes("`find-${observation.id}`")) {
        hits.push(`${rel}: finding id = find-\${observation.id} (Review session key)`);
      }
      if (src.includes("`v2op-${observation.id}`")) {
        hits.push(`${rel}: proposed op id = v2op-\${observation.id} (Review session key)`);
      }
      if (src.includes("applyOperationId: item.id")) {
        hits.push(`${rel}: applyOperationId = item.id`);
      }
      if (src.includes("id: obs.id ||")) {
        hits.push(`${rel}: New Project provisional item id = observation.id`);
      }
      if (src.includes("eq(\"operation_id\", key)") || src.includes(".eq(\"operation_id\"")) {
        hits.push(`${rel}: receipt lookup keyed by operation_id`);
      }
    }
    const unique = [...new Set(hits)];
    record({
      id: "S10-durable-identity-scan",
      seam: 10,
      title: "Model-generated strings used as durable keys",
      expectedBucket: "EXPECTED_RED",
      bucket: unique.length ? "EXPECTED_RED" : "UNEXPECTED_RED",
      fate: unique.length ? "UNSAFE_ASSUMPTION" : "PASS",
      severity: "P0",
      detail: unique.join(" | ") || "(none found)",
    });
  }

  // ── live C71/C82 year-shaped dates (model quality vs Apply executing reviewed ISO) ──
  {
    const fake = new FakeWorkspaceClient();
    seedBoard(fake);
    const c71 = live(71);
    const cabUpdate = {
      ...c71.observations[0],
      candidateTargetId: MILESTONE_ID,
      candidateTargetTitle: "CAB",
    };
    const ran = await runEnvelope(fake, c71.rawInput, [cabUpdate]);
    const row = ran.state.timeline.find((t) => t.id === MILESTONE_ID);
    const iso = (row?.startAt ?? "").slice(0, 10);
    const wrote2023 = iso.startsWith("2023");
    record({
      id: "S3-live-c71-2023-iso",
      seam: 3,
      title: "Live C71 current+ISO 2023-10-18 against CAB",
      expectedBucket: "PASS",
      bucket: "PASS",
      fate: ran.applied.some((a) => a.kind === "wrote") ? "PASS" : "NEEDS_YOU",
      severity: "P2",
      detail: `This is model-complete current ISO, not a seam. executed=${JSON.stringify(ran.applied)} startAt=${row?.startAt} wrote2023=${wrote2023}`,
    });
  }

  const counts = { PASS: 0, EXPECTED_RED: 0, UNEXPECTED_RED: 0 };
  for (const j of journeys) counts[j.bucket] += 1;

  const outDir = join(ROOT, "docs/v1-convergence");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "seam-results.json"),
    JSON.stringify({ sourceRun: LIVE.sourceRun, counts, journeys }, null, 2),
  );

  console.log("\n── seam pack ──");
  console.log(`PASS ${counts.PASS} / EXPECTED_RED ${counts.EXPECTED_RED} / UNEXPECTED_RED ${counts.UNEXPECTED_RED}`);
  console.log(`journeys ${journeys.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
