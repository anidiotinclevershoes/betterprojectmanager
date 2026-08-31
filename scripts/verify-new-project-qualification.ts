/**
 * Qualification pass for four-frame New Project + retrieval tags.
 * Proves isolation, durable Needs You, persistence authority, organise
 * proposal-only safety, create atomicity, and semantic equivalence.
 *
 * Run: npx tsx scripts/verify-new-project-qualification.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serializeCanonicalTruth } from "../src/lib/canonical-truth/serialize";
import { captureApplyWorldFromState } from "../src/lib/capture/apply/world";
import {
  persistEnsureStakeholder,
  persistKnowledgeBullet,
  persistNewProject,
  persistTimelineItem,
  persistTodoCreate,
  NEW_PROJECT_PARTIAL_CREATE,
} from "../src/lib/data/supabase/persist-mutations";
import { loadMissionStateFromSupabase } from "../src/lib/data/supabase/load-mission-state";
import { mergeOrganisedDraft } from "../src/lib/new-project/merge-organised";
import {
  structuredItemsFromSetup,
} from "../src/lib/new-project/materialise-setup";
import { needsYouFromDraft } from "../src/lib/new-project/needs-you";
import { retireIncompleteSetupInState } from "../src/lib/new-project/retire-needs-you";
import { buildDeterministicSnapshot } from "../src/lib/tell-me/snapshot-deterministic";
import { computeProjectRevision } from "../src/lib/tell-me/revision";
import type { CreateProjectInput } from "../src/lib/create-project";
import type { MissionState } from "../src/lib/types";
import { FakeWorkspaceClient } from "./lib/fake-supabase-workspace";

const ROOT = join(import.meta.dirname, "..");
const VISION_ID = "11111111-1111-4111-8111-111111111111";
const LEGAL_ID = "22222222-2222-4222-8222-222222222222";
const INCOMPLETE_ID = "33333333-3333-4333-8333-333333333333";
const TAGGED_ID = "44444444-4444-4444-8444-444444444444";
const RETRY_ID = "55555555-5555-4555-8555-555555555555";

let passed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    await fn();
    passed += 1;
    console.log(`✓ ${name}`);
  })();
}

function readSrc(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function asClient(fake: FakeWorkspaceClient) {
  return fake as unknown as Parameters<typeof persistNewProject>[0];
}

function composeDraft(overrides: Partial<CreateProjectInput> = {}): CreateProjectInput {
  return {
    name: "Member Claims Upload",
    code: "MCU",
    summary: "Upload member claims packs",
    currentFocus: "",
    sourceMode: "compose",
    stakeholders: [],
    risks: [],
    todos: [],
    importantDates: [],
    knowledgeRemember: [],
    ...overrides,
  };
}

function representativeVisionDraft(
  clientProjectId: string,
  withTags: boolean,
): CreateProjectInput {
  const tag = (names: string[]) => (withTags ? names : []);
  return composeDraft({
    clientProjectId,
    stakeholders: [
      {
        name: "Sarah Murphy",
        responsibilities: ["Product Owner", "UAT", "CAB representative"],
        tags: tag(["Release"]),
      },
      {
        name: "Niamh Kelly",
        responsibilities: ["UAT", "Business SME"],
        tags: tag(["UAT"]),
      },
    ],
    risks: [
      {
        title: "Identity provider may delay testing",
        tags: tag(["Release"]),
      },
    ],
    todos: [{ title: "Chase finance pack", kind: "ACTION", tags: tag(["UAT"]) }],
    importantDates: [
      { label: "Go-live", date: "2026-10-22", tags: tag(["Release"]) },
      { label: "UAT lab" },
    ],
    knowledgeRemember: [
      {
        text: "Release moved to 22 October",
        remember: true,
        kind: "decision",
        tags: tag(["Release"]),
      },
      {
        text: "Finance pack is the blocker",
        remember: true,
        kind: "fact",
      },
    ],
  });
}

function day(iso: string | undefined): string {
  return (iso ?? "").slice(0, 10);
}

function knowledgeFor(state: MissionState, projectId: string) {
  return state.knowledge.find((k) => k.projectId === projectId);
}

function currentStructured(state: MissionState, projectId: string) {
  return (knowledgeFor(state, projectId)?.structured ?? []).filter(
    (item) => item.lifecycle === "current",
  );
}

/** Authoritative semantic fingerprint. Ignores ids, tags, timestamps, ordering, risk source. */
function semanticFingerprint(state: MissionState, projectId: string) {
  const project = state.projects.find((p) => p.id === projectId);
  assert.ok(project, `project ${projectId} missing`);
  const structured = currentStructured(state, projectId);
  return {
    name: project!.name,
    people: project!.stakeholders
      .map((s) => s.name.trim())
      .sort((a, b) => a.localeCompare(b)),
    responsibilities: structured
      .filter((i) => i.kind === "responsibility")
      .map((i) => ({
        person: (i.meta?.responsibility?.personName ?? "").trim(),
        scope: (i.meta?.responsibility?.scope ?? "").trim(),
      }))
      .sort((a, b) =>
        `${a.person}|${a.scope}`.localeCompare(`${b.person}|${b.scope}`),
      ),
    risks: (state.risks ?? [])
      .filter((r) => r.projectId === projectId)
      .map((r) => ({ title: r.title.trim(), status: r.status }))
      .sort((a, b) => a.title.localeCompare(b.title)),
    todos: state.todos
      .filter((t) => t.projectId === projectId)
      .map((t) => t.title.trim())
      .sort((a, b) => a.localeCompare(b)),
    milestones: state.timeline
      .filter((t) => t.projectId === projectId)
      .map((t) => ({ label: t.label.trim(), date: day(t.startAt) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    decisions: structured
      .filter((i) => i.kind === "decision")
      .map((i) => i.body.trim())
      .sort((a, b) => a.localeCompare(b)),
    facts: structured
      .filter(
        (i) =>
          i.kind === "fact" &&
          i.section === "now" &&
          !/^current focus:/i.test(i.body),
      )
      .map((i) => i.body.trim())
      .sort((a, b) => a.localeCompare(b)),
  };
}

function truthWithoutTags(state: MissionState, projectId: string) {
  return {
    fingerprint: semanticFingerprint(state, projectId),
    pendingDates: currentStructured(state, projectId)
      .filter((i) => i.kind === "date")
      .map((i) => ({
        label: i.meta?.date?.label ?? i.body,
        dateIso: i.meta?.date?.dateIso ?? null,
      })),
    ambiguities: currentStructured(state, projectId)
      .filter((i) => i.kind === "ambiguity")
      .map((i) => i.body.trim())
      .sort(),
  };
}

async function persistLegalEquivalent(
  fake: FakeWorkspaceClient,
  clientProjectId: string,
) {
  const client = asClient(fake);
  await persistNewProject(
    client,
    fake.workspaceId,
    fake.userId,
    composeDraft({ clientProjectId, name: "Member Claims Upload", code: "MCU" }),
  );

  const sarahId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
  const niamhId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
  await persistEnsureStakeholder(client, fake.workspaceId, clientProjectId, {
    id: sarahId,
    name: "Sarah Murphy",
    role: "Product Owner",
  });
  await persistEnsureStakeholder(client, fake.workspaceId, clientProjectId, {
    id: niamhId,
    name: "Niamh Kelly",
    role: "UAT",
  });

  const writeResp = async (
    personId: string,
    personName: string,
    scope: string,
  ) => {
    await persistKnowledgeBullet(
      client,
      fake.workspaceId,
      clientProjectId,
      "people",
      `${personName} — ${scope}`,
      fake.userId,
      {
        kind: "responsibility",
        epistemic: "confirmed",
        lifecycle: "current",
        meta: {
          responsibility: {
            personId,
            personName,
            scope,
            ownerConfirmed: true,
          },
        },
      },
    );
  };
  await writeResp(sarahId, "Sarah Murphy", "Product Owner");
  await writeResp(sarahId, "Sarah Murphy", "UAT");
  await writeResp(sarahId, "Sarah Murphy", "CAB representative");
  await writeResp(niamhId, "Niamh Kelly", "UAT");
  await writeResp(niamhId, "Niamh Kelly", "Business SME");

  await persistKnowledgeBullet(
    client,
    fake.workspaceId,
    clientProjectId,
    "decisions",
    "Release moved to 22 October",
    fake.userId,
    { kind: "decision", epistemic: "confirmed", lifecycle: "current" },
  );
  await persistKnowledgeBullet(
    client,
    fake.workspaceId,
    clientProjectId,
    "now",
    "Finance pack is the blocker",
    fake.userId,
    { kind: "fact", epistemic: "confirmed", lifecycle: "current" },
  );
  await persistKnowledgeBullet(
    client,
    fake.workspaceId,
    clientProjectId,
    "risks",
    "Identity provider may delay testing",
    fake.userId,
  );
  await persistTodoCreate(client, fake.workspaceId, fake.userId, {
    projectId: clientProjectId,
    title: "Chase finance pack",
    done: false,
    kind: "ACTION",
  });
  await persistTimelineItem(client, fake.workspaceId, clientProjectId, {
    label: "Go-live",
    type: "deadline",
    startAt: "2026-10-22T12:00:00.000Z",
  });
  await persistTimelineItem(client, fake.workspaceId, clientProjectId, {
    label: "UAT lab",
    type: "milestone",
    startAt: "2026-10-01T12:00:00.000Z",
  });
}

async function main() {
  await check("tags schema is project-scoped metadata with RLS and uniqueness", () => {
    const sql = readSrc("supabase/migrations/20260831160000_project_retrieval_tags.sql");
    assert.match(sql, /create table public\.project_tags/);
    assert.match(sql, /create table public\.item_tags/);
    assert.match(sql, /unique \(project_id, slug\)/);
    assert.match(sql, /unique \(tag_id, target_kind, target_id\)/);
    assert.match(sql, /item_tags_tag_matches_project_fk/);
    assert.match(sql, /t\.project_id = item_tags\.project_id/);
    assert.match(sql, /references public\.projects \(id\) on delete cascade/);
    assert.match(sql, /references public\.project_tags \(id\) on delete cascade/);
    assert.match(sql, /force row level security/);
    assert.match(sql, /Cannot create unique index projects_workspace_code_lower_idx/);
    assert.match(
      sql,
      /target_kind in \('risk', 'todo', 'stakeholder', 'knowledge_item', 'milestone'\)/,
    );
  });

  await check("capture / PCI / identity / confidence sources do not read tags", () => {
    for (const rel of [
      "src/lib/capture/apply/dispatch.ts",
      "src/lib/capture/apply/world.ts",
      "src/lib/capture/context.ts",
      "src/lib/canonical-truth/serialize.ts",
      "src/lib/tell-me/revision.ts",
      "src/lib/tell-me/snapshot-deterministic.ts",
      "src/lib/people/identity.ts",
      "src/lib/new-project/needs-you.ts",
    ]) {
      const src = readSrc(rel);
      assert.doesNotMatch(
        src,
        /projectTags|itemTags|project_tags|item_tags/,
        `${rel} must not reference retrieval tags`,
      );
    }
  });

  await check("undated dates persist as kind=date, not a duplicate ambiguity overlay", () => {
    const draft = composeDraft({
      importantDates: [{ label: "Beta milestone" }],
      stakeholders: [{ name: "Sam" }],
      risks: [{ title: "Vendor delay", needsReview: true }],
      todos: [{ title: "Write CAB pack", needsReview: true }],
    });
    const structured = structuredItemsFromSetup({
      projectId: "p",
      input: draft,
      stakeholders: [{ id: "s1", name: "Sam", role: "" }],
    });
    assert.equal(structured.filter((i) => i.kind === "date").length, 1);
    assert.equal(
      structured.filter((i) => i.kind === "ambiguity").length,
      3,
      "person-without-scope plus uncertain risk and todo questions",
    );
    assert.ok(
      structured.some((i) => /What is Sam responsible for/i.test(i.body)),
    );
    assert.ok(
      structured.some((i) => /treated as a project risk/i.test(i.body)),
    );
    assert.ok(
      structured.some((i) => /tracked as a To Do/i.test(i.body)),
    );
    assert.equal(
      structured.some((i) => /When is the Beta/i.test(i.body) && i.kind === "ambiguity"),
      false,
    );
    assert.ok(needsYouFromDraft(draft).some((q) => /Beta/i.test(q.question)));
  });

  await check("destructive tag removal leaves project truth identical after reload", async () => {
    const fake = new FakeWorkspaceClient();
    const client = asClient(fake);
    await persistNewProject(
      client,
      fake.workspaceId,
      fake.userId,
      representativeVisionDraft(TAGGED_ID, true),
    );
    assert.ok(fake.tables.project_tags.length >= 1);
    assert.ok(fake.tables.item_tags.length >= 1);

    const before = await loadMissionStateFromSupabase(client);
    const beforeTruth = truthWithoutTags(before.state, TAGGED_ID);
    const applyBefore = captureApplyWorldFromState(before.state);
    const pciBefore = buildDeterministicSnapshot({
      state: before.state,
      projectId: TAGGED_ID,
    });
    const revBefore = computeProjectRevision(before.state, TAGGED_ID);
    const canonBefore = serializeCanonicalTruth({
      state: before.state,
      projectId: TAGGED_ID,
      question: "What is the current focus?",
    });

    const historyBefore = (before.state.history ?? []).map((h) => h.type);
    await client.from("project_tags").delete().eq("project_id", TAGGED_ID);
    assert.equal(fake.rowsForProject("project_tags", TAGGED_ID).length, 0);
    assert.equal(fake.rowsForProject("item_tags", TAGGED_ID).length, 0);

    const after = await loadMissionStateFromSupabase(client);
    assert.deepEqual(
      (after.state.history ?? []).map((h) => h.type),
      historyBefore,
    );
    assert.deepEqual(after.state.projectTags, []);
    assert.deepEqual(after.state.itemTags, []);
    assert.deepEqual(truthWithoutTags(after.state, TAGGED_ID), beforeTruth);
    assert.deepEqual(captureApplyWorldFromState(after.state), applyBefore);
    const pciAfter = buildDeterministicSnapshot({
      state: after.state,
      projectId: TAGGED_ID,
    });
    assert.deepEqual(pciAfter.keyState, pciBefore.keyState);
    assert.deepEqual(pciAfter.majorRisks, pciBefore.majorRisks);
    assert.deepEqual(pciAfter.keyStakeholders, pciBefore.keyStakeholders);
    assert.deepEqual(pciAfter.importantKnowledge, pciBefore.importantKnowledge);
    assert.equal(computeProjectRevision(after.state, TAGGED_ID), revBefore);
    const canonAfter = serializeCanonicalTruth({
      state: after.state,
      projectId: TAGGED_ID,
      question: "What is the current focus?",
    });
    assert.deepEqual(canonAfter.items.map((i) => `${i.kind}|${i.body}`), canonBefore.items.map((i) => `${i.kind}|${i.body}`));
    assert.deepEqual(
      canonAfter.needsConfirmationHints.map((h) => h.summary),
      canonBefore.needsConfirmationHints.map((h) => h.summary),
    );
  });

  await check("incomplete New Project persists without inventing values and reloads Needs You", async () => {
    const fake = new FakeWorkspaceClient();
    const client = asClient(fake);
    const draft = composeDraft({
      clientProjectId: INCOMPLETE_ID,
      stakeholders: [{ name: "Sam Rivera" }],
      importantDates: [{ label: "Beta milestone" }],
      knowledgeRemember: [
        {
          text: "Organised note about the CAB pack",
          remember: true,
          needsReview: true,
          needsYouQuestion: "What does the CAB pack include?",
        },
      ],
    });
    await persistNewProject(client, fake.workspaceId, fake.userId, draft);
    const loaded = await loadMissionStateFromSupabase(client);
    const project = loaded.state.projects.find((p) => p.id === INCOMPLETE_ID)!;
    const sam = project.stakeholders.find((s) => s.name === "Sam Rivera");
    assert.ok(sam);
    assert.equal(sam!.role, "");
    assert.equal(
      loaded.state.timeline.filter((t) => t.projectId === INCOMPLETE_ID).length,
      0,
      "must not invent a dated milestone",
    );
    const structured = currentStructured(loaded.state, INCOMPLETE_ID);
    const pendingDate = structured.find((i) => i.kind === "date");
    assert.ok(pendingDate);
    assert.equal(pendingDate!.meta?.date?.dateIso ?? null, null);
    assert.equal(pendingDate!.epistemic, "pending");
    assert.ok(
      structured.some((i) =>
        /What is Sam Rivera responsible for/i.test(i.body),
      ),
    );
    assert.ok(
      structured.some((i) => /What does the CAB pack include/i.test(i.body)),
    );
    const hints = serializeCanonicalTruth({
      state: loaded.state,
      projectId: INCOMPLETE_ID,
      question: "Who owns Beta?",
    }).needsConfirmationHints;
    assert.ok(hints.some((h) => /Sam Rivera/i.test(h.summary)));
    assert.ok(hints.some((h) => /Beta milestone/i.test(h.summary)));
    assert.ok(hints.some((h) => /CAB pack/i.test(h.summary)));
    assert.equal(
      hints.filter((h) => h.kind === "unknown_owner").length,
      0,
      "must not invent unknown_owner from a person with no responsibility rows",
    );
  });

  await check("later legal writes resolve the matching incomplete objects after reload", async () => {
    const fake = new FakeWorkspaceClient();
    const client = asClient(fake);
    await persistNewProject(
      client,
      fake.workspaceId,
      fake.userId,
      composeDraft({
        clientProjectId: INCOMPLETE_ID,
        stakeholders: [{ name: "Sam Rivera" }],
        importantDates: [{ label: "Beta milestone" }],
        knowledgeRemember: [
          {
            text: "Organised note about the CAB pack",
            remember: true,
            needsReview: true,
            needsYouQuestion: "What does the CAB pack include?",
          },
        ],
      }),
    );
    await persistTimelineItem(client, fake.workspaceId, INCOMPLETE_ID, {
      label: "Beta milestone",
      type: "milestone",
      startAt: "2026-11-01T12:00:00.000Z",
    });
    const sam = fake.rowsForProject("stakeholders", INCOMPLETE_ID)[0]!;
    await persistKnowledgeBullet(
      client,
      fake.workspaceId,
      INCOMPLETE_ID,
      "people",
      "Sam Rivera — Product Owner",
      fake.userId,
      {
        kind: "responsibility",
        epistemic: "confirmed",
        lifecycle: "current",
        meta: {
          responsibility: {
            personId: String(sam.id),
            personName: "Sam Rivera",
            scope: "Product Owner",
            ownerConfirmed: true,
          },
        },
      },
    );

    const loaded = await loadMissionStateFromSupabase(client);
    const structured = knowledgeFor(loaded.state, INCOMPLETE_ID)?.structured ?? [];
    const dateRow = structured.find((i) => i.kind === "date");
    assert.equal(dateRow?.lifecycle, "superseded");
    const personQ = structured.find((i) =>
      /What is Sam Rivera responsible for/i.test(i.body),
    );
    assert.equal(personQ?.lifecycle, "superseded");
    const cab = structured.find((i) => /CAB pack include/i.test(i.body));
    assert.equal(cab?.lifecycle, "current");
    const hints = serializeCanonicalTruth({
      state: loaded.state,
      projectId: INCOMPLETE_ID,
      question: "What is still open?",
    }).needsConfirmationHints;
    assert.equal(hints.some((h) => /Sam Rivera/i.test(h.summary)), false);
    assert.equal(hints.some((h) => /Beta milestone/i.test(h.summary)), false);
    assert.ok(hints.some((h) => /CAB pack/i.test(h.summary)));
    const beta = loaded.state.timeline.find(
      (t) => t.projectId === INCOMPLETE_ID && /Beta/i.test(t.label),
    );
    assert.equal(day(beta?.startAt), "2026-11-01");
  });

  await check("uncertain Organise risks and todos do not become truth", async () => {
    const fake = new FakeWorkspaceClient();
    const client = asClient(fake);
    await persistNewProject(
      client,
      fake.workspaceId,
      fake.userId,
      composeDraft({
        clientProjectId: VISION_ID,
        risks: [
          { title: "Supplier might not be ready", needsReview: true },
          { title: "Identity provider may delay testing" },
        ],
        todos: [
          { title: "Maybe chase the vendor", needsReview: true },
          { title: "Book the UAT lab" },
        ],
      }),
    );
    const loaded = await loadMissionStateFromSupabase(client);
    const riskTitles = (loaded.state.risks ?? [])
      .filter((r) => r.projectId === VISION_ID)
      .map((r) => r.title);
    assert.deepEqual(riskTitles, ["Identity provider may delay testing"]);
    assert.equal(
      riskTitles.some((t) => /Supplier might not be ready/i.test(t)),
      false,
    );
    const todoTitles = loaded.state.todos
      .filter((t) => t.projectId === VISION_ID)
      .map((t) => t.title);
    assert.deepEqual(todoTitles, ["Book the UAT lab"]);
    const questions = currentStructured(loaded.state, VISION_ID).filter(
      (i) => i.kind === "ambiguity",
    );
    assert.ok(
      questions.some((i) =>
        /Should “Supplier might not be ready” be treated as a project risk/i.test(
          i.body,
        ),
      ),
    );
    assert.ok(
      questions.some((i) =>
        /Should “Maybe chase the vendor” be tracked as a To Do/i.test(i.body),
      ),
    );
  });

  await check("Needs You retires in current MissionState without waiting for reload", async () => {
    const fake = new FakeWorkspaceClient();
    const client = asClient(fake);
    const draft = composeDraft({
      clientProjectId: INCOMPLETE_ID,
      stakeholders: [{ name: "Sam Rivera" }],
      importantDates: [{ label: "Beta milestone" }],
      risks: [{ title: "Supplier might not be ready", needsReview: true }],
    });
    await persistNewProject(client, fake.workspaceId, fake.userId, draft);
    let state = (await loadMissionStateFromSupabase(client)).state;
    const before = serializeCanonicalTruth({
      state,
      projectId: INCOMPLETE_ID,
      question: "What still needs you?",
    }).needsConfirmationHints.map((h) => h.summary);
    assert.ok(before.some((s) => /Sam Rivera/i.test(s)));
    assert.ok(before.some((s) => /Beta milestone/i.test(s)));
    assert.ok(before.some((s) => /Supplier might not be ready/i.test(s)));

    await persistTimelineItem(client, fake.workspaceId, INCOMPLETE_ID, {
      label: "Beta milestone",
      type: "milestone",
      startAt: "2026-11-01T12:00:00.000Z",
    });
    state = retireIncompleteSetupInState(state, INCOMPLETE_ID, {
      type: "date",
      label: "Beta milestone",
    });
    const sam = fake.rowsForProject("stakeholders", INCOMPLETE_ID)[0]!;
    await persistKnowledgeBullet(
      client,
      fake.workspaceId,
      INCOMPLETE_ID,
      "people",
      "Sam Rivera — Product Owner",
      fake.userId,
      {
        kind: "responsibility",
        epistemic: "confirmed",
        lifecycle: "current",
        meta: {
          responsibility: {
            personId: String(sam.id),
            personName: "Sam Rivera",
            scope: "Product Owner",
            ownerConfirmed: true,
          },
        },
      },
    );
    state = retireIncompleteSetupInState(state, INCOMPLETE_ID, {
      type: "person",
      name: "Sam Rivera",
    });
    await persistKnowledgeBullet(
      client,
      fake.workspaceId,
      INCOMPLETE_ID,
      "risks",
      "Supplier might not be ready",
      fake.userId,
    );
    state = retireIncompleteSetupInState(state, INCOMPLETE_ID, {
      type: "risk",
      title: "Supplier might not be ready",
    });

    const sessionHints = serializeCanonicalTruth({
      state,
      projectId: INCOMPLETE_ID,
      question: "What still needs you?",
    }).needsConfirmationHints.map((h) => h.summary);
    assert.equal(sessionHints.some((s) => /Sam Rivera/i.test(s)), false);
    assert.equal(sessionHints.some((s) => /Beta milestone/i.test(s)), false);
    assert.equal(
      sessionHints.some((s) => /Supplier might not be ready/i.test(s)),
      false,
    );

    const reloaded = await loadMissionStateFromSupabase(client);
    const reloadHints = serializeCanonicalTruth({
      state: reloaded.state,
      projectId: INCOMPLETE_ID,
      question: "What still needs you?",
    }).needsConfirmationHints.map((h) => h.summary);
    assert.deepEqual(reloadHints.sort(), sessionHints.sort());
    const store = readSrc("src/lib/store.tsx");
    assert.match(store, /retireIncompleteSetupInState/);
  });

  await check("local buildNewProject is an in-memory payload builder, not localStorage", () => {
    const createProject = readSrc("src/lib/create-project.ts");
    const persist = readSrc("src/lib/data/supabase/persist-mutations.ts");
    const store = readSrc("src/lib/store.tsx");
    const tags = readSrc("src/lib/data/supabase/persist-tags.ts");
    assert.doesNotMatch(createProject, /localStorage/);
    assert.match(persist, /In-memory payload builder only/);
    assert.doesNotMatch(tags, /localStorage/);
    assert.match(
      store,
      /One deliberate persistence path: server cookies → persistNewProject/,
    );
    assert.match(
      store,
      /Never fall through to a second browser persist after server failure/,
    );
    assert.match(
      store,
      /if \(process\.env\.NODE_ENV === "production"\)/,
    );
  });

  await check("Organise Notes is proposal-only and does not persist", () => {
    const api = readSrc("src/app/api/new-project/route.ts");
    const ui = readSrc("src/components/onboarding/NewProjectExperience.tsx");
    const merge = readSrc("src/lib/new-project/merge-organised.ts");
    const map = readSrc("src/lib/new-project-v2/map.ts");
    assert.doesNotMatch(api, /persistNewProject|from\("projects"\)/);
    assert.match(api, /return NextResponse\.json\(\{[\s\S]*draft/);
    assert.match(merge, /Does not persist/);
    assert.match(map, /does not write to the database/);
    assert.match(ui, /fetch\("\/api\/new-project"/);
    const organiseStart = ui.indexOf("const organiseNotes");
    const organiseEnd = ui.indexOf("const onCreate");
    assert.ok(organiseStart >= 0 && organiseEnd > organiseStart);
    assert.doesNotMatch(ui.slice(organiseStart, organiseEnd), /createProject\(/);
    assert.match(ui, /Nothing is saved until you create the project/);
    const merged = mergeOrganisedDraft(
      composeDraft({ name: "Keep", code: "KEEP" }),
      composeDraft({
        name: "Other",
        code: "OTHR",
        risks: [{ title: "Proposed risk" }],
      }),
      { codeLocked: true },
    );
    assert.equal(merged.name, "Keep");
    assert.equal(merged.code, "KEEP");
    assert.equal(merged.risks?.[0]?.title, "Proposed risk");
  });

  await check("tag-table failure rolls back the project and a retry does not duplicate", async () => {
    const fake = new FakeWorkspaceClient({ failOnceOnTable: "item_tags" });
    const client = asClient(fake);
    const draft = representativeVisionDraft(RETRY_ID, true);
    let failed = false;
    try {
      await persistNewProject(client, fake.workspaceId, fake.userId, draft);
    } catch {
      failed = true;
    }
    assert.equal(failed, true);
    assert.equal(fake.tables.projects.length, 0);
    assert.equal(fake.tables.stakeholders.length, 0);
    assert.equal(fake.tables.project_tags.length, 0);
    assert.equal(fake.tables.item_tags.length, 0);
    assert.equal(fake.tables.todos.length, 0);

    await persistNewProject(client, fake.workspaceId, fake.userId, draft);
    const people = fake.rowsForProject("stakeholders", RETRY_ID).length;
    const tags = fake.rowsForProject("project_tags", RETRY_ID).length;
    const links = fake.rowsForProject("item_tags", RETRY_ID).length;
    const scopes = fake
      .rowsForProject("knowledge_items", RETRY_ID)
      .filter((row) => row.kind === "responsibility").length;
    assert.equal(people, 2);
    assert.ok(tags >= 1);
    assert.ok(links >= 1);
    assert.equal(scopes, 5);

    const again = await persistNewProject(
      client,
      fake.workspaceId,
      fake.userId,
      draft,
    );
    assert.equal(again.project.id, RETRY_ID);
    assert.equal(fake.rowsForProject("stakeholders", RETRY_ID).length, people);
    assert.equal(fake.rowsForProject("project_tags", RETRY_ID).length, tags);
    assert.equal(fake.rowsForProject("item_tags", RETRY_ID).length, links);
    assert.equal(
      fake
        .rowsForProject("knowledge_items", RETRY_ID)
        .filter((row) => row.kind === "responsibility").length,
      scopes,
    );
  });

  await check("empty role survives unique-id retry instead of becoming Stakeholder", async () => {
    const fake = new FakeWorkspaceClient();
    const client = asClient(fake);
    const draft = composeDraft({
      clientProjectId: INCOMPLETE_ID,
      stakeholders: [{ name: "Sam Rivera" }],
    });
    await persistNewProject(client, fake.workspaceId, fake.userId, draft);
    const retried = await persistNewProject(
      client,
      fake.workspaceId,
      fake.userId,
      draft,
    );
    assert.equal(retried.project.stakeholders[0]?.role, "");
  });

  await check("partial create + failed cleanup never reports success on retry", async () => {
    const rich = representativeVisionDraft(RETRY_ID, true);
    const tables = [
      "stakeholders",
      "knowledge_items",
      "project_tags",
      "item_tags",
      "todos",
      "risks",
    ] as const;
    for (const table of tables) {
      const fake = new FakeWorkspaceClient({
        failOnceOnTable: table,
      });
      const client = asClient(fake);
      let firstFailed = false;
      try {
        await persistNewProject(client, fake.workspaceId, fake.userId, rich);
      } catch {
        firstFailed = true;
      }
      assert.equal(firstFailed, true, `${table} first create must fail`);
      await persistNewProject(client, fake.workspaceId, fake.userId, rich);
      assert.equal(fake.tables.projects.length, 1, `${table} retry must create once`);
      assert.equal(fake.rowsForProject("stakeholders", RETRY_ID).length, 2);
      assert.equal(
        fake
          .rowsForProject("knowledge_items", RETRY_ID)
          .filter((row) => row.kind === "responsibility").length,
        5,
      );
    }

    const stuck = new FakeWorkspaceClient({
      failOnTable: "stakeholders",
      failOnDeleteTable: "todos",
    });
    const stuckClient = asClient(stuck);
    let firstMessage = "";
    try {
      await persistNewProject(stuckClient, stuck.workspaceId, stuck.userId, rich);
    } catch (err) {
      firstMessage = err instanceof Error ? err.message : String(err);
    }
    assert.match(firstMessage, /PARTIAL|partial|injected/i);
    let retryMessage = "";
    let retrySucceeded = false;
    try {
      await persistNewProject(stuckClient, stuck.workspaceId, stuck.userId, rich);
      retrySucceeded = true;
    } catch (err) {
      retryMessage = err instanceof Error ? err.message : String(err);
    }
    assert.equal(retrySucceeded, false);
    assert.match(retryMessage, new RegExp(NEW_PROJECT_PARTIAL_CREATE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(stuck.tables.projects.length, 1);
    assert.equal(stuck.rowsForProject("stakeholders", RETRY_ID).length, 0);
  });

  await check("Vision compose and legal domain writes are semantically equivalent", async () => {
    const visionFake = new FakeWorkspaceClient({
      workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    });
    const legalFake = new FakeWorkspaceClient({
      workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
      userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
    });
    await persistNewProject(
      asClient(visionFake),
      visionFake.workspaceId,
      visionFake.userId,
      representativeVisionDraft(VISION_ID, true),
    );
    await persistTimelineItem(asClient(visionFake), visionFake.workspaceId, VISION_ID, {
      label: "UAT lab",
      type: "milestone",
      startAt: "2026-10-01T12:00:00.000Z",
    });
    await persistLegalEquivalent(legalFake, LEGAL_ID);

    const vision = await loadMissionStateFromSupabase(asClient(visionFake));
    const legal = await loadMissionStateFromSupabase(asClient(legalFake));
    const visionFp = semanticFingerprint(vision.state, VISION_ID);
    const legalFp = semanticFingerprint(legal.state, LEGAL_ID);
    assert.deepEqual(visionFp, legalFp);

    const visionRiskSource = (vision.state.risks ?? []).find(
      (r) => r.projectId === VISION_ID,
    )?.source;
    const legalRiskSource = (legal.state.risks ?? []).find(
      (r) => r.projectId === LEGAL_ID,
    )?.source;
    assert.equal(visionRiskSource, "manual");
    assert.equal(legalRiskSource, "capture");
  });

  await check("create API reports success only after persistNewProject + workspace reload", () => {
    const route = readSrc("src/app/api/workspace/projects/route.ts");
    assert.match(route, /const persisted = await persistNewProject/);
    assert.match(route, /loadMissionStateFromSupabase/);
    assert.match(route, /status: 500/);
    const store = readSrc("src/lib/store.tsx");
    assert.match(store, /if \(!res\.ok\)/);
    assert.match(store, /applyDurableWorkspace/);
  });

  console.log(`\n${passed} New Project qualification checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
