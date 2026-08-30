/**
 * v0.9 shared-seam hardening — the three Hulk P0/P1 clusters only.
 *
 * Cluster 1: system Review/Apply identity (not model observation.id)
 * Cluster 2: New Project semantic Review safety parity
 * Cluster 3: Ask source-authority confidence
 * Review safety: consequential proposed values are visible and correctable
 *
 * Deterministic. No live 100. Does not import qualification harnesses.
 *
 * Run: npx tsx scripts/verify-v09-seams.ts
 *   or: npm run verify:v09-seams
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyApprovedCaptureSuggestion } from "../src/lib/capture/apply/apply-approved";
import { supabaseCaptureApplyHooks } from "../src/lib/capture/apply/persist-execute";
import type { CaptureApplyWorld } from "../src/lib/capture/apply/types";
import { captureResultFromResolved } from "../src/lib/capture-v2/toResult";
import {
  newReviewOperationId,
  reviewSafetyGap,
} from "../src/lib/capture-v2/contract";
import { resolveObservations } from "../src/lib/capture-v2/resolve";
import type { CaptureObservationV2 } from "../src/lib/capture-v2/types";
import { buildReviewChangeViewModels } from "../src/lib/capture/review/viewModel";
import type { PendingSuggestion } from "../src/lib/capture/suggestions";
import {
  draftFromProvisional,
  parseNewProjectV2Envelope,
  recategoriseItem,
} from "../src/lib/new-project-v2";
import { buildNewProject } from "../src/lib/create-project";
import { emptyKnowledge } from "../src/lib/knowledge";
import { confirmResponsibilityOwner } from "../src/lib/people/identity";
import {
  constrainAskConfidence,
  answerTellMeQuestion,
} from "../src/lib/tell-me/answer";
import { loadMissionStateFromSupabase } from "../src/lib/data/supabase/load-mission-state";
import type { MissionState, Project } from "../src/lib/types";
import { FakeWorkspaceClient } from "./lib/fake-supabase-workspace";

const ROOT = join(import.meta.dirname, "..");
const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PERSON = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let passed = 0;

async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

function readSrc(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function asClient(fake: FakeWorkspaceClient) {
  return fake as never;
}

async function load(fake: FakeWorkspaceClient): Promise<MissionState> {
  return (await loadMissionStateFromSupabase(asClient(fake))).state;
}

function emptyWorld(projectId = PROJECT_A): CaptureApplyWorld {
  return {
    projectIds: new Set([projectId]),
    projects: [
      { id: projectId, name: "Project A", code: "PA", stakeholders: [] },
    ],
    risks: [],
    todos: [],
    timeline: [],
    knowledge: [],
  };
}

function seedProject(fake: FakeWorkspaceClient) {
  fake.seedProject({
    id: PROJECT_A,
    workspace_id: fake.workspaceId,
    name: "Project A",
    code: "PA",
  });
}

function workspaceFrom(fake: FakeWorkspaceClient, state: MissionState) {
  return {
    workspaceId: fake.workspaceId,
    userId: fake.userId,
    state,
  };
}

async function applyPersist(
  fake: FakeWorkspaceClient,
  item: PendingSuggestion,
  text: string,
) {
  const state = await load(fake);
  return applyApprovedCaptureSuggestion({
    item,
    text,
    projectId: item.projectId || PROJECT_A,
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

function obs(
  partial: Partial<CaptureObservationV2> &
    Pick<CaptureObservationV2, "id" | "domain" | "disposition" | "statement">,
): CaptureObservationV2 {
  return {
    evidence: partial.evidence ?? partial.statement,
    truthIntent: partial.truthIntent ?? "current",
    ...partial,
  };
}

function resolveOne(
  observation: CaptureObservationV2,
  transcript: string,
  world = emptyWorld(),
) {
  return resolveObservations({
    observations: [observation],
    world,
    transcript,
    captureEntryProjectId: PROJECT_A,
  })[0]!;
}

function baseProject(
  partial: Partial<Project> & Pick<Project, "id" | "name" | "code">,
): Project {
  return {
    summary: "Ship",
    status: "healthy",
    currentFocus: "UAT",
    stakeholders: [],
    ...partial,
  };
}

function emptyState(): MissionState {
  return {
    projects: [],
    memories: [],
    recommendations: [],
    meetings: [],
    releases: [],
    todos: [],
    knowledge: [],
    risks: [],
    timeline: [],
    history: [],
  };
}

async function cluster1() {
  await check("C1 source: resolve does not mint identity from model observation.id", () => {
    const resolve = readSrc("src/lib/capture-v2/resolve.ts");
    assert.doesNotMatch(resolve, /v2-\$\{observation\.id\}/);
    assert.match(resolve, /newReviewOperationId/);
    const parse = readSrc("src/lib/new-project-v2/parse.ts");
    assert.doesNotMatch(parse, /id:\s*obs\.id/);
    assert.match(parse, /newReviewOperationId/);
    const toResult = readSrc("src/lib/capture-v2/toResult.ts");
    assert.doesNotMatch(toResult, /find-\$\{observation\.id\}/);
    assert.doesNotMatch(toResult, /v2op-\$\{observation\.id\}/);
  });

  await check("C1.1 Capture A obs-1 create writes", async () => {
    const fake = new FakeWorkspaceClient();
    seedProject(fake);
    const row = resolveOne(
      obs({
        id: "obs-1",
        domain: "todo",
        disposition: "create_new",
        statement: "Book the civic hall",
        proposedValues: { title: "Book the civic hall" },
      }),
      "Please book the civic hall.",
    );
    assert.ok(row.suggestion);
    assert.match(row.suggestion!.id, UUID_RE);
    assert.notEqual(row.suggestion!.id, "obs-1");
    assert.notEqual(row.suggestion!.id, "v2-obs-1");
    assert.equal(row.suggestion!.modelObservationId, "obs-1");
    const first = await applyPersist(
      fake,
      row.suggestion!,
      "Please book the civic hall.",
    );
    assert.equal(first.executed.kind, "wrote");
    assert.equal(fake.tables.todos.length, 1);
    assert.equal(fake.tables.todos[0]!.title, "Book the civic hall");
    assert.equal(
      fake.tables.capture_apply_receipts[0]!.operation_id,
      row.suggestion!.id,
    );
  });

  await check("C1.2 Capture B different obs-1 create ALSO writes", async () => {
    const fake = new FakeWorkspaceClient();
    seedProject(fake);
    const a = resolveOne(
      obs({
        id: "obs-1",
        domain: "todo",
        disposition: "create_new",
        statement: "Book the civic hall",
        proposedValues: { title: "Book the civic hall" },
      }),
      "Please book the civic hall.",
    );
    const b = resolveOne(
      obs({
        id: "obs-1",
        domain: "milestone",
        disposition: "create_new",
        statement: "UAT starts 1 November",
        proposedValues: { label: "UAT", date: "2026-11-01" },
      }),
      "UAT starts 1 November.",
    );
    assert.notEqual(a.suggestion!.id, b.suggestion!.id);
    const first = await applyPersist(fake, a.suggestion!, "Please book the civic hall.");
    const second = await applyPersist(fake, b.suggestion!, "UAT starts 1 November.");
    assert.equal(first.executed.kind, "wrote");
    assert.equal(second.executed.kind, "wrote");
    assert.equal(fake.tables.todos.length, 1);
    assert.equal(fake.tables.milestones.length, 1);
    assert.equal(fake.tables.milestones[0]!.label, "UAT");
  });

  await check("C1.3 same reviewed operation replay → one authoritative effect", async () => {
    const fake = new FakeWorkspaceClient();
    seedProject(fake);
    const row = resolveOne(
      obs({
        id: "obs-1",
        domain: "todo",
        disposition: "create_new",
        statement: "Book the civic hall",
        proposedValues: { title: "Book the civic hall" },
      }),
      "Please book the civic hall.",
    );
    const first = await applyPersist(fake, row.suggestion!, "Please book the civic hall.");
    const second = await applyPersist(fake, row.suggestion!, "Please book the civic hall.");
    assert.equal(first.executed.kind, "wrote");
    assert.ok(
      second.executed.kind === "wrote" || second.executed.kind === "no_change",
    );
    if (second.executed.kind === "no_change") {
      assert.match(second.executed.reason, /already applied/);
    }
    assert.equal(fake.tables.todos.length, 1);
    assert.equal(fake.tables.capture_apply_receipts.length, 1);
  });

  await check("C1.4 two obs-1 observations in ONE envelope stay distinct", () => {
    const resolved = resolveObservations({
      observations: [
        obs({
          id: "obs-1",
          domain: "todo",
          disposition: "create_new",
          statement: "Book the hall",
          proposedValues: { title: "Book the hall" },
        }),
        obs({
          id: "obs-1",
          domain: "risk",
          disposition: "create_new",
          statement: "Icing may slip",
          proposedValues: { title: "Icing may slip" },
        }),
      ],
      world: emptyWorld(),
      transcript: "Book the hall. Icing may slip.",
      captureEntryProjectId: PROJECT_A,
    });
    const ids = resolved.map((row) => row.suggestion?.id).filter(Boolean);
    assert.equal(ids.length, 2);
    assert.notEqual(ids[0], ids[1]);
    const result = captureResultFromResolved({
      transcript: "Book the hall. Icing may slip.",
      projectId: PROJECT_A,
      resolved,
    });
    const findingIds = (result.findings ?? []).map((f) => f.id);
    assert.equal(new Set(findingIds).size, findingIds.length);
  });

  await check("C1.5 distinct operations with the same human title may both exist", async () => {
    const fake = new FakeWorkspaceClient();
    seedProject(fake);
    const a = resolveOne(
      obs({
        id: "obs-1",
        domain: "todo",
        disposition: "create_new",
        statement: "Book the hall",
        proposedValues: { title: "Book the hall" },
      }),
      "First booking.",
    );
    const b = resolveOne(
      obs({
        id: "obs-1",
        domain: "todo",
        disposition: "create_new",
        statement: "Book the hall",
        proposedValues: { title: "Book the hall" },
      }),
      "Second later booking.",
    );
    await applyPersist(fake, a.suggestion!, "First booking.");
    await applyPersist(fake, b.suggestion!, "Second later booking.");
    assert.equal(fake.tables.todos.length, 2);
  });

  await check("C1.6 Review edit does not change operation identity", () => {
    const row = resolveOne(
      obs({
        id: "obs-1",
        domain: "todo",
        disposition: "create_new",
        statement: "Book the civic hall",
        proposedValues: { title: "Book the civic hall" },
      }),
      "Please book the civic hall.",
    );
    const before = row.suggestion!.id;
    const edited: PendingSuggestion = {
      ...row.suggestion!,
      content: "Book the town hall instead",
    };
    assert.equal(edited.id, before);
    assert.equal(edited.modelObservationId, "obs-1");
  });

  await check("C1.7 refresh/retry of the same Review preserves operation identity", async () => {
    const row = resolveOne(
      obs({
        id: "obs-1",
        domain: "todo",
        disposition: "create_new",
        statement: "Book the civic hall",
        proposedValues: { title: "Book the civic hall" },
      }),
      "Please book the civic hall.",
    );
    const session = JSON.parse(JSON.stringify(row.suggestion)) as PendingSuggestion;
    assert.equal(session.id, row.suggestion!.id);
    const fake = new FakeWorkspaceClient();
    seedProject(fake);
    await applyPersist(fake, session, "Please book the civic hall.");
    await applyPersist(fake, session, "Please book the civic hall.");
    assert.equal(fake.tables.todos.length, 1);
    assert.equal(
      fake.tables.capture_apply_receipts[0]!.operation_id,
      row.suggestion!.id,
    );
  });

  await check("C1.8 New Project duplicate obs-1 rows recategorise independently", () => {
    const parsed = parseNewProjectV2Envelope({
      observations: [
        {
          id: "obs-1",
          statement: "Priya is UAT lead",
          evidence: "Priya Shah is UAT lead.",
          domain: "person",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: { name: "Priya Shah", role: "UAT lead" },
        },
        {
          id: "obs-1",
          statement: "UAT starts 1 November",
          evidence: "UAT starts 1 November.",
          domain: "milestone",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: { label: "UAT", date: "2026-11-01" },
        },
      ],
    });
    assert.equal(parsed.items.length, 2);
    assert.notEqual(parsed.items[0]!.id, parsed.items[1]!.id);
    assert.ok(parsed.items.every((i) => i.modelObservationId === "obs-1"));
    const moved = recategoriseItem(parsed.items, parsed.items[0]!.id, "knowledge");
    assert.equal(moved[0]!.category, "knowledge");
    assert.equal(moved[1]!.category, "milestone");
  });

  await check("C1 newReviewOperationId is a system UUID and unique", () => {
    const a = newReviewOperationId();
    const b = newReviewOperationId();
    assert.match(a, UUID_RE);
    assert.match(b, UUID_RE);
    assert.notEqual(a, b);
  });
}

function cluster2() {
  check("C2.1 uncertain person → Needs Review", () => {
    const parsed = parseNewProjectV2Envelope({
      observations: [
        {
          id: "obs-1",
          statement: "Someone named Priya may own UAT",
          evidence: "Priya maybe owns UAT",
          domain: "person",
          disposition: "create_new",
          truthIntent: "uncertain",
          proposedValues: { name: "Priya Shah" },
        },
      ],
    });
    const item = parsed.items[0]!;
    assert.equal(item.needsReview, true);
    assert.match(item.reviewReason ?? "", /unclear|current project truth/i);
    const draft = draftFromProvisional({
      sourceNarrative: "Priya maybe owns UAT",
      sourceMode: "talk",
      project: { name: "Harbourline", summary: "", currentFocus: "" },
      items: parsed.items,
    });
    assert.equal(draft.stakeholders?.[0]?.needsReview, true);
    assert.equal((draft.knowledgePeople ?? []).length, 0);
  });

  check("C2.2 explicit current named person → normal setup candidate", () => {
    const parsed = parseNewProjectV2Envelope({
      observations: [
        {
          id: "obs-1",
          statement: "Priya Shah is UAT lead",
          evidence: "Priya Shah is UAT lead.",
          domain: "person",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: { name: "Priya Shah", role: "UAT lead" },
        },
      ],
    });
    assert.equal(parsed.items[0]!.needsReview, false);
    const draft = draftFromProvisional({
      sourceNarrative: "Priya Shah is UAT lead.",
      sourceMode: "talk",
      project: { name: "Harbourline", summary: "", currentFocus: "" },
      items: parsed.items,
    });
    assert.equal(draft.stakeholders?.[0]?.needsReview, false);
    assert.equal(draft.stakeholders?.[0]?.name, "Priya Shah");
  });

  check("C2.3 nameless person → Needs Review (statement is not a name)", () => {
    const parsed = parseNewProjectV2Envelope({
      observations: [
        {
          id: "obs-1",
          statement: "Someone on the archive team owns the scan spec",
          evidence: "someone on the archive team owns the scan spec",
          domain: "person",
          disposition: "create_new",
          truthIntent: "current",
        },
      ],
    });
    assert.equal(parsed.items[0]!.needsReview, true);
    const draft = draftFromProvisional({
      sourceNarrative: "someone on the archive team owns the scan spec",
      sourceMode: "talk",
      project: { name: "Harbourline", summary: "", currentFocus: "" },
      items: parsed.items,
    });
    assert.equal(draft.stakeholders?.[0]?.needsReview, true);
    assert.equal(draft.stakeholders?.[0]?.name, "");
    assert.notEqual(
      draft.stakeholders?.[0]?.name,
      "Someone on the archive team owns the scan spec",
    );
  });

  check("C2.4 dateless milestone → Needs Review", () => {
    const parsed = parseNewProjectV2Envelope({
      observations: [
        {
          id: "obs-1",
          statement: "UAT is coming",
          evidence: "UAT is coming",
          domain: "milestone",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: { label: "UAT" },
        },
      ],
    });
    assert.equal(parsed.items[0]!.needsReview, true);
    const draft = draftFromProvisional({
      sourceNarrative: "UAT is coming",
      sourceMode: "talk",
      project: { name: "Harbourline", summary: "", currentFocus: "" },
      items: parsed.items,
    });
    assert.equal(draft.importantDates?.[0]?.needsReview, true);
    assert.equal(draft.importantDates?.[0]?.date, undefined);
    assert.equal(draft.nextMilestoneAt, undefined);
  });

  check("C2.5 valid milestone label + date → normal setup candidate", () => {
    const parsed = parseNewProjectV2Envelope({
      observations: [
        {
          id: "obs-1",
          statement: "UAT is 1 November 2026",
          evidence: "UAT is 1 November 2026",
          domain: "milestone",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: { label: "UAT", date: "2026-11-01" },
        },
      ],
    });
    assert.equal(parsed.items[0]!.needsReview, false);
    const draft = draftFromProvisional({
      sourceNarrative: "UAT is 1 November 2026",
      sourceMode: "talk",
      project: { name: "Harbourline", summary: "", currentFocus: "" },
      items: parsed.items,
    });
    assert.equal(draft.importantDates?.[0]?.needsReview, false);
    assert.equal(draft.importantDates?.[0]?.date, "2026-11-01");
    assert.equal(draft.nextMilestone, "UAT");
  });

  check("C2.6 non_current observation does not silently become current setup truth", () => {
    const parsed = parseNewProjectV2Envelope({
      observations: [
        {
          id: "obs-1",
          statement: "Sarah Kim used to own UAT last year",
          evidence: "Sarah Kim used to own UAT last year",
          domain: "person",
          disposition: "create_new",
          truthIntent: "non_current",
          proposedValues: { name: "Sarah Kim", role: "UAT lead" },
        },
      ],
    });
    assert.equal(parsed.items[0]!.needsReview, true);
    const draft = draftFromProvisional({
      sourceNarrative: "Sarah Kim used to own UAT last year",
      sourceMode: "talk",
      project: { name: "Harbourline", summary: "", currentFocus: "" },
      items: parsed.items,
    });
    assert.equal(draft.stakeholders?.[0]?.needsReview, true);
    assert.equal((draft.knowledgePeople ?? []).length, 0);
  });

  check("C2.7 duplicate model observation IDs produce independent setup rows", () => {
    const parsed = parseNewProjectV2Envelope({
      observations: [
        {
          id: "obs-1",
          statement: "Priya Shah is UAT lead",
          evidence: "Priya Shah is UAT lead.",
          domain: "person",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: { name: "Priya Shah" },
        },
        {
          id: "obs-1",
          statement: "Daniel Okonkwo is vendor lead",
          evidence: "Daniel Okonkwo is vendor lead.",
          domain: "person",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: { name: "Daniel Okonkwo" },
        },
      ],
    });
    assert.notEqual(parsed.items[0]!.id, parsed.items[1]!.id);
    const moved = recategoriseItem(parsed.items, parsed.items[1]!.id, "commentary");
    assert.equal(moved[0]!.category, "person");
    assert.equal(moved[1]!.category, "commentary");
  });

  check("C2.8 user fixes Needs Review value → corrected setup truth persists", () => {
    const parsed = parseNewProjectV2Envelope({
      observations: [
        {
          id: "obs-1",
          statement: "Someone owns the scan spec",
          evidence: "someone owns the scan spec",
          domain: "person",
          disposition: "create_new",
          truthIntent: "current",
        },
      ],
    });
    const draft = draftFromProvisional({
      sourceNarrative: "someone owns the scan spec",
      sourceMode: "talk",
      project: { name: "Harbourline", summary: "", currentFocus: "" },
      items: parsed.items,
    });
    assert.equal(draft.stakeholders?.[0]?.needsReview, true);
    const corrected = {
      ...draft,
      stakeholders: [
        {
          ...draft.stakeholders![0]!,
          name: "Owen Hart",
          role: "Archives delivery",
          needsReview: false,
        },
      ],
    };
    const bundle = buildNewProject(corrected);
    assert.equal(bundle.project.stakeholders[0]!.name, "Owen Hart");
  });

  check("C2.9 shared extractor wiring + reviewSafetyGap remain the New Project contract", () => {
    const parse = readSrc("src/lib/new-project-v2/parse.ts");
    assert.match(parse, /parseObservationEnvelope/);
    assert.match(parse, /validateObservations/);
    assert.match(parse, /reviewSafetyGap/);
    const route = readSrc("src/app/api/new-project/route.ts");
    assert.match(route, /extractObservationsWithOpenAI|runCaptureV2|parseNewProjectV2Envelope/);
    const unnamed: CaptureObservationV2 = obs({
      id: "obs-1",
      domain: "person",
      disposition: "create_new",
      statement: "someone owns UAT",
      truthIntent: "current",
    });
    assert.ok(reviewSafetyGap(unnamed));
  });
}

async function cluster3() {
  await check("C3.1 Timeline date → direct_confirmation", () => {
    assert.equal(
      constrainAskConfidence({
        question: "What is the current target release date?",
        confidence: "direct_confirmation",
        sources: [
          {
            id: "ms-1",
            kind: "timeline",
            label: "Release",
            detail: "2026-10-27",
          },
        ],
      }),
      "direct_confirmation",
    );
  });

  await check("C3.2 Knowledge-only date → related_context", () => {
    assert.equal(
      constrainAskConfidence({
        question: "What is the current target release date?",
        confidence: "direct_confirmation",
        sources: [
          {
            id: "k-1",
            kind: "knowledge",
            label: "go on 27 October",
          },
        ],
      }),
      "related_context",
    );
  });

  await check("C3.3 Structured current responsibility → confirmation", async () => {
    let state = emptyState();
    state.projects = [
      baseProject({
        id: PROJECT_A,
        name: "Alpha",
        code: "ALP",
        stakeholders: [{ id: PERSON, name: "Priya Shah", role: "UAT lead" }],
      }),
    ];
    state.knowledge = [emptyKnowledge(PROJECT_A)];
    state = confirmResponsibilityOwner({
      state,
      projectId: PROJECT_A,
      scope: "UAT",
      personName: "Priya Shah",
      personId: PERSON,
    }).state;
    const answered = await answerTellMeQuestion({
      question: "Who owns UAT?",
      state,
      selectedProjectId: PROJECT_A,
      useCanonicalTruth: true,
    });
    assert.equal(answered.confidence, "direct_confirmation");
    assert.match(answered.answer, /Priya Shah/i);
    assert.ok(
      answered.sources.some((s) => s.detail === "confirmed responsibility"),
    );
  });

  await check("C3.4 Knowledge-only old-email owner → NOT direct_confirmation", () => {
    assert.equal(
      constrainAskConfidence({
        question: "Who owns UAT?",
        confidence: "direct_confirmation",
        sources: [
          {
            id: "k-old",
            kind: "knowledge",
            label: "Priya owns UAT according to an old email",
          },
        ],
      }),
      "related_context",
    );
  });

  await check("C3.5 Domain Risk row → appropriate confirmation", () => {
    assert.equal(
      constrainAskConfidence({
        question: "What are the open risks?",
        confidence: "direct_confirmation",
        sources: [
          {
            id: "risk-1",
            kind: "risk",
            label: "Mould in the wet-store",
          },
        ],
      }),
      "direct_confirmation",
    );
  });

  await check("C3.6 Knowledge-only risk wording, empty risk domain → NOT direct_confirmation", () => {
    assert.equal(
      constrainAskConfidence({
        question: "What are the open risks?",
        confidence: "direct_confirmation",
        sources: [
          {
            id: "k-risk",
            kind: "knowledge",
            label: "residual-risk summary from last retro",
          },
        ],
      }),
      "related_context",
    );
  });

  await check("C3.7 Todo/status row → appropriate confirmation", () => {
    assert.equal(
      constrainAskConfidence({
        question: "What todos are still open?",
        confidence: "direct_confirmation",
        sources: [
          {
            id: "todo-1",
            kind: "todo",
            label: "Chase ICT for identity integration",
          },
        ],
      }),
      "direct_confirmation",
    );
  });

  await check("C3.8 History-only assertion is not current direct confirmation", () => {
    assert.equal(
      constrainAskConfidence({
        question: "Who owns UAT?",
        confidence: "direct_confirmation",
        sources: [
          {
            id: "hist-1",
            kind: "history",
            label: "Priya was recorded as UAT owner last spring",
          },
        ],
      }),
      "related_context",
    );
  });

  await check("C3 Ask remains read-only in the answer engine", () => {
    const src = readSrc("src/lib/tell-me/answer.ts");
    assert.match(src, /You are READ-ONLY/);
    assert.match(src, /constrainAskConfidence/);
    assert.doesNotMatch(src, /persistNewProject|applyApprovedCaptureSuggestion/);
  });
}

async function reviewSafety() {
  await check("Review A: milestone/date proposal shows the exact date", () => {
    const observation = obs({
      id: "obs-1",
      domain: "milestone",
      disposition: "create_new",
      statement: "UAT is 22 October 2026",
      proposedValues: { label: "UAT", date: "2026-10-22" },
    });
    const resolved = resolveOne(observation, "UAT is 22 October 2026.");
    const result = captureResultFromResolved({
      transcript: "UAT is 22 October 2026.",
      projectId: PROJECT_A,
      resolved: [resolved],
    });
    const models = buildReviewChangeViewModels(
      [resolved.suggestion!],
      result,
      "UAT is 22 October 2026.",
    );
    const model = models[0]!;
    const shown = `${model.diff?.to ?? ""} ${model.diff?.meta ?? ""} ${model.recordName}`;
    assert.match(shown, /22/);
    assert.match(shown, /Oct/i);
    assert.match(model.recordName, /UAT/);
  });

  await check("Review B: person proposal shows the exact person identity", () => {
    const observation = obs({
      id: "obs-1",
      domain: "person",
      disposition: "create_new",
      statement: "Sarah Kim owns UAT",
      proposedValues: { name: "Sarah Kim", role: "UAT lead" },
    });
    const resolved = resolveOne(observation, "Sarah Kim owns UAT.");
    const result = captureResultFromResolved({
      transcript: "Sarah Kim owns UAT.",
      projectId: PROJECT_A,
      resolved: [resolved],
    });
    const models = buildReviewChangeViewModels(
      [resolved.suggestion!],
      result,
      "Sarah Kim owns UAT.",
    );
    const model = models[0]!;
    assert.match(model.recordName, /Sarah Kim/);
    assert.equal(model.suggestion.personName, "Sarah Kim");
    assert.match(model.diff?.to ?? model.recordName, /Sarah Kim/);
  });

  await check("Review C: risk/status proposal shows the current-truth mutation", () => {
    const observation = obs({
      id: "obs-1",
      domain: "risk",
      disposition: "update_existing",
      statement: "Packaging delay is resolved",
      candidateTargetId: "33333333-3333-4333-8333-333333333333",
      candidateTargetTitle: "Packaging delay",
      proposedValues: { status: "resolved", title: "Packaging delay" },
    });
    const world = emptyWorld();
    world.risks = [
      {
        id: "33333333-3333-4333-8333-333333333333",
        projectId: PROJECT_A,
        title: "Packaging delay",
        status: "open",
      },
    ];
    const resolved = resolveObservations({
      observations: [observation],
      world,
      transcript: "Packaging delay is resolved.",
      captureEntryProjectId: PROJECT_A,
    })[0]!;
    const result = captureResultFromResolved({
      transcript: "Packaging delay is resolved.",
      projectId: PROJECT_A,
      resolved: [resolved],
    });
    const models = buildReviewChangeViewModels(
      [resolved.suggestion!],
      result,
      "Packaging delay is resolved.",
    );
    const model = models[0]!;
    assert.match(model.recordName, /Packaging delay/);
    assert.match(`${model.diff?.to ?? ""} ${model.operationLabel}`, /Resolved|Complete/i);
  });

  await check("Review correction: edited value is the value Apply persists", async () => {
    const fake = new FakeWorkspaceClient();
    seedProject(fake);
    const row = resolveOne(
      obs({
        id: "obs-1",
        domain: "todo",
        disposition: "create_new",
        statement: "Book the civic hall",
        proposedValues: { title: "Book the civic hall" },
      }),
      "Please book the civic hall.",
    );
    const edited: PendingSuggestion = {
      ...row.suggestion!,
      content: "Book the town hall",
    };
    assert.equal(edited.id, row.suggestion!.id);
    const applied = await applyPersist(fake, edited, "Please book the civic hall.");
    assert.equal(applied.executed.kind, "wrote");
    assert.equal(fake.tables.todos[0]!.title, "Book the town hall");
  });
}

async function main() {
  console.log("v0.9 shared-seam hardening\n");
  await cluster1();
  cluster2();
  await cluster3();
  await reviewSafety();
  console.log(`\n${passed} passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
