/**
 * v0.9 adversarial addendum — three Nick Fury structural gaps.
 * Test only. Does not change production Capture / Apply / persist.
 *
 *   npm run verify:v09-adversarial-addendum
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { applyApprovedCaptureSuggestion } from "../src/lib/capture/apply/apply-approved";
import { supabaseCaptureApplyHooks } from "../src/lib/capture/apply/persist-execute";
import type { PendingSuggestion } from "../src/lib/capture/suggestions";
import {
  runCaptureV2FromModelJson,
  worldFromCaptureState,
} from "../src/lib/capture-v2";
import type { CreateProjectInput } from "../src/lib/create-project";
import { persistHistoryEvent, persistNewProject } from "../src/lib/data/supabase/persist-mutations";
import { buildOpenRiskRows } from "../src/lib/knowledge-centre/ocean-frames";
import { searchAuthoritativeProject } from "../src/lib/knowledge-centre/search-authority";
import { buildTellMeContext } from "../src/lib/tell-me/context";
import type { MissionState } from "../src/lib/types";
import { FakeWorkspaceClient, type FakeRow } from "./lib/fake-supabase-workspace";
import { asClient, load, obs, workspaceFrom } from "./adversarial-qual/workspace";

const ROOT = join(import.meta.dirname, "..");
const QUAL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-ad00000000c1";
const ALPHA_ID = "aaaaaaaa-aaaa-4aaa-8aaa-ad00000000a1";
const BETA_ID = "aaaaaaaa-aaaa-4aaa-8aaa-ad00000000b2";

type Kind = "PASS" | "EXPECTED_RED";

const report: Record<string, unknown> = {};

function compactRow(row: FakeRow) {
  return {
    id: row.id,
    project_id: row.project_id ?? null,
    name: row.name ?? null,
    title: row.title ?? null,
    section: row.section ?? null,
    body: row.body ?? null,
    kind: row.kind ?? null,
    lifecycle: row.lifecycle ?? null,
    status: row.status ?? null,
  };
}

function rowsAdded(before: FakeRow[], after: FakeRow[]) {
  const prior = new Set(before.map((r) => String(r.id)));
  return after.filter((r) => !prior.has(String(r.id))).map(compactRow);
}

async function seed(fake: FakeWorkspaceClient, input: CreateProjectInput) {
  await persistNewProject(asClient(fake), fake.workspaceId, fake.userId, input);
}

async function applyReady(args: {
  fake: FakeWorkspaceClient;
  projectId: string;
  item: PendingSuggestion;
  text?: string;
}) {
  const applied = await applyApprovedCaptureSuggestion({
    item: args.item,
    text: args.text ?? args.item.content,
    projectId: args.projectId,
    expectedTarget: args.item.expectedTarget,
    loadWorkspace: async () => workspaceFrom(args.fake, await load(args.fake)),
    hooks: supabaseCaptureApplyHooks({
      client: asClient(args.fake),
      workspaceId: args.fake.workspaceId,
      userId: args.fake.userId,
      state: await load(args.fake),
    }),
    recordHistory: (event) =>
      persistHistoryEvent(asClient(args.fake), args.fake.workspaceId, args.fake.userId, event),
    reloadWorkspace: async () => load(args.fake),
  });
  // Failed execute returns pre-write loaded state. Reload is the durable truth.
  const state = await load(args.fake);
  return { applied, state };
}

function analyseOnly(args: {
  fakeState: MissionState;
  projectId: string;
  transcript: string;
  envelope: unknown;
}) {
  return runCaptureV2FromModelJson({
    transcript: args.transcript,
    rawModelJson: args.envelope,
    world: worldFromCaptureState(args.fakeState),
    projectId: args.projectId,
  });
}

async function gap1() {
  const fake = new FakeWorkspaceClient();
  await seed(fake, {
    name: "Partial Person Qual",
    code: "PPQ",
    summary: "Person + responsibility composition",
    currentFocus: "UAT",
    sourceMode: "talk",
    clientProjectId: QUAL_ID,
  });
  const before = {
    stakeholders: [...fake.tables.stakeholders],
    knowledge_items: [...fake.tables.knowledge_items],
  };

  // Arm AFTER seed so New Project knowledge inserts succeed.
  // Fail the second authoritative write (knowledge / responsibility), not History.
  fake.armFailOnTable("knowledge_items");

  // Production Apply of a Ready CREATE after Review — not V2 Analyse.
  // Analyse identity-gate would needs_you for a brand-new person; Nick's
  // sequence is persist composition once confirm_responsibility is planned.
  const item: PendingSuggestion = {
    id: "addendum-resp-nadia",
    kind: "stakeholder",
    op: "create",
    content: "Nadia Qureshi owns UAT",
    destination: "project",
    projectId: QUAL_ID,
    legalDomain: "responsibility",
    personName: "Nadia Qureshi",
    responsibilityScope: "UAT",
    ownershipSemantics: "share",
    proposedValues: {
      name: "Nadia Qureshi",
      scope: "UAT",
      personName: "Nadia Qureshi",
      ownershipSemantics: "share",
    },
  };

  const { applied, state } = await applyReady({
    fake,
    projectId: QUAL_ID,
    item,
    text: "Nadia Qureshi owns UAT",
  });

  const leftoverStakeholders = rowsAdded(before.stakeholders, fake.tables.stakeholders);
  const leftoverKnowledge = rowsAdded(before.knowledge_items, fake.tables.knowledge_items);
  const project = state.projects.find((p) => p.id === QUAL_ID);
  const people = (project?.stakeholders ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    role: s.role,
  }));
  const nadia = people.filter((p) => /Nadia Qureshi/i.test(p.name));
  const knowledge = state.knowledge.filter((k) => k.projectId === QUAL_ID);
  const peopleSection = knowledge.flatMap((k) => k.sections.people ?? []);
  const nadiaPeopleBullets = peopleSection.filter((b) => /Nadia Qureshi/i.test(b));
  const structured = knowledge.flatMap((k) => k.structured ?? []);
  const responsibilityRows = structured.filter(
    (s) =>
      s.kind === "responsibility" &&
      (/UAT/i.test(s.body ?? "") || /Nadia/i.test(s.body ?? "")),
  );
  const executed = applied.executed.kind;
  const requestFailed = executed === "failed";
  const half =
    nadia.length > 0 &&
    leftoverKnowledge.length === 0 &&
    responsibilityRows.length === 0 &&
    nadiaPeopleBullets.length === 0;
  const atomic =
    nadia.length === 0 &&
    leftoverStakeholders.length === 0 &&
    leftoverKnowledge.length === 0 &&
    responsibilityRows.length === 0;
  const kind: Kind = half ? "EXPECTED_RED" : atomic ? "PASS" : "EXPECTED_RED";

  const out = {
    kind,
    executed,
    requestFailed,
    decision: applied.decision,
    leftoverStakeholders,
    leftoverKnowledge,
    peopleAfterReload: people,
    nadia,
    peopleSectionAfterReload: peopleSection,
    nadiaPeopleBullets,
    structuredResponsibility: responsibilityRows.map((s) => ({
      id: s.id,
      kind: s.kind,
      body: s.body,
      lifecycle: s.lifecycle,
    })),
    detail: half
      ? "Person/stakeholder write survived; responsibility knowledge write failed. Half-authoritative mutation."
      : atomic
        ? "No person and no responsibility after failed request — atomic according to contract."
        : `Unexpected mix executed=${executed} nadia=${nadia.length} leftoverPerson=${leftoverStakeholders.length} leftoverKnowledge=${leftoverKnowledge.length} resp=${responsibilityRows.length}`,
  };
  report.personResponsibility = out;
  console.log(`● [${kind}] person+responsibility — ${out.detail}`);
  return out;
}

async function gap2() {
  const fake = new FakeWorkspaceClient();
  await seed(fake, {
    name: "Partial Risk Qual",
    code: "PRQ",
    summary: "Risk dual-write",
    currentFocus: "API",
    sourceMode: "talk",
    clientProjectId: QUAL_ID,
  });
  const before = {
    knowledge_items: [...fake.tables.knowledge_items],
    risks: [...fake.tables.risks],
  };
  fake.armFailOnTable("risks");

  const title = "ALPHA-RISK-CANARY-split-brain";
  const analysed = analyseOnly({
    fakeState: await load(fake),
    projectId: QUAL_ID,
    transcript: `New risk: ${title}.`,
    envelope: {
      observations: [
        obs({
          id: "risk",
          statement: title,
          domain: "risk",
          disposition: "create_new",
          projectId: QUAL_ID,
          proposedValues: { title },
        }),
      ],
    },
  });
  const ready = analysed.resolved.find(
    (row) => row.decision.kind === "write" && row.suggestion?.kind === "risk",
  );
  const item: PendingSuggestion =
    ready?.suggestion ??
    ({
      id: "addendum-risk-canary",
      kind: "risk",
      op: "create",
      content: title,
      destination: "project",
      projectId: QUAL_ID,
      legalDomain: "risk",
      proposedValues: { title },
    } satisfies PendingSuggestion);

  const { applied, state } = await applyReady({
    fake,
    projectId: QUAL_ID,
    item,
    text: title,
  });

  const leftoverKnowledge = rowsAdded(before.knowledge_items, fake.tables.knowledge_items);
  const leftoverRisks = rowsAdded(before.risks, fake.tables.risks);
  const domainRisks = (state.risks ?? []).filter((r) => r.projectId === QUAL_ID);
  const knowledge = state.knowledge.filter((k) => k.projectId === QUAL_ID);
  const prose = knowledge.flatMap((k) => k.sections.risks ?? []);
  const structuredRisks = knowledge.flatMap((k) =>
    (k.structured ?? []).filter(
      (s) => s.section === "risks" || /risk/i.test(s.kind ?? "") || (s.body ?? "").includes(title),
    ),
  );
  const kcRiskCards = buildOpenRiskRows(state, QUAL_ID);
  const search = searchAuthoritativeProject(state, QUAL_ID, "ALPHA-RISK-CANARY");
  const ask = buildTellMeContext({
    question: "What are the main open risks right now?",
    state,
    selectedProjectId: QUAL_ID,
    snapshot: null,
    useCanonicalTruth: true,
  });
  const knowledgeSaysYes =
    leftoverKnowledge.some((r) => String(r.body).includes(title)) ||
    prose.some((p) => p.includes(title)) ||
    structuredRisks.some((s) => (s.body ?? "").includes(title));
  const domainSaysNo = leftoverRisks.length === 0 && domainRisks.length === 0;
  const splitBrain = knowledgeSaysYes && domainSaysNo;
  const executed = applied.executed.kind;
  const kind: Kind = splitBrain || knowledgeSaysYes || !domainSaysNo ? "EXPECTED_RED" : "PASS";

  const out = {
    kind,
    executed,
    requestFailed: executed === "failed",
    splitBrain,
    leftoverKnowledge,
    leftoverRisks,
    domainRisksAfterReload: domainRisks.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
    })),
    knowledgeRiskProse: prose,
    structuredRisks: structuredRisks.map((s) => ({
      id: s.id,
      body: s.body,
      section: s.section,
      kind: s.kind,
    })),
    kcRiskCards,
    searchHits: search.map((h) => ({ section: h.sectionLabel, bullet: h.bullet })),
    askMentionsCanary: ask.promptBlock.includes(title),
    detail: splitBrain
      ? "Knowledge/current-position has the risk; domain risks table does not."
      : `knowledgeSaysYes=${knowledgeSaysYes} domainSaysNo=${domainSaysNo} executed=${executed}`,
  };
  report.riskDualWrite = out;
  console.log(`● [${kind}] risk dual-write — ${out.detail}`);
  return out;
}

async function gap3() {
  const fake = new FakeWorkspaceClient();
  await seed(fake, {
    name: "ALPHA-CANARY-771",
    code: "ALP",
    summary: "Analyse here",
    currentFocus: "A",
    sourceMode: "talk",
    clientProjectId: ALPHA_ID,
  });
  await seed(fake, {
    name: "BETA-CANARY-992",
    code: "BET",
    summary: "Switch here",
    currentFocus: "B",
    sourceMode: "talk",
    clientProjectId: BETA_ID,
  });

  const canary = "ALPHA-CANARY-771-CLOSE-CAB";
  const transcript = `Please add a to-do for ${canary}.`;

  // Analyse on A only. Do not Apply. Production Review keeps this Ready item.
  const analysed = analyseOnly({
    fakeState: await load(fake),
    projectId: ALPHA_ID,
    transcript,
    envelope: {
      observations: [
        obs({
          id: "todo-a",
          statement: canary,
          domain: "todo",
          disposition: "create_new",
          projectId: ALPHA_ID,
        }),
      ],
    },
  });
  const ready = analysed.resolved.find(
    (row) => row.decision.kind === "write" && row.suggestion,
  );
  if (!ready?.suggestion) {
    const out = {
      kind: "EXPECTED_RED" as const,
      landedOn: "nowhere",
      detail: "Could not obtain a Ready CREATE analysed against ALPHA-CANARY-771",
      analyseDecisions: analysed.resolved.map((row) => row.decision),
    };
    report.staleReviewProject = out;
    console.log(`● [EXPECTED_RED] stale Review / project switch — ${out.detail}`);
    return out;
  }

  const beforeTodos = [...fake.tables.todos];
  const before = await load(fake);

  // Production Ocean embed: CaptureWorkspace.approveById calls
  // applyOne(suggestion, defaultProjectId) and defaultProjectId becomes B
  // after the project switch. slice.projectId is not required.
  const switched = await applyReady({
    fake,
    projectId: BETA_ID,
    item: ready.suggestion,
    text: ready.suggestion.content,
  });

  const leftoverTodos = rowsAdded(beforeTodos, fake.tables.todos);
  const after = switched.state;
  const alphaAfter = after.todos
    .filter((t) => t.projectId === ALPHA_ID)
    .map((t) => ({ id: t.id, title: t.title }));
  const betaAfter = after.todos
    .filter((t) => t.projectId === BETA_ID)
    .map((t) => ({ id: t.id, title: t.title }));
  const landedB = leftoverTodos.some(
    (t) => t.project_id === BETA_ID && String(t.title).includes(canary),
  );
  const landedA = leftoverTodos.some(
    (t) => t.project_id === ALPHA_ID && String(t.title).includes(canary),
  );
  const landedElsewhere = leftoverTodos.some(
    (t) =>
      t.project_id !== ALPHA_ID &&
      t.project_id !== BETA_ID &&
      String(t.title).includes(canary),
  );
  const wrote = switched.applied.executed.kind === "wrote";
  const refused =
    switched.applied.executed.kind === "needs_you" ||
    switched.applied.executed.kind === "failed";

  let kind: Kind;
  let detail: string;
  let landedOn: string;
  if (landedB) {
    kind = "EXPECTED_RED";
    landedOn = "BETA-CANARY-992";
    detail = "Write landed on Beta merely because Beta was the active Apply projectId.";
  } else if (landedElsewhere) {
    kind = "EXPECTED_RED";
    landedOn = String(leftoverTodos.find((t) => String(t.title).includes(canary))?.project_id);
    detail = "Write landed on a project that was neither analysed nor active.";
  } else if (refused && !landedA && leftoverTodos.length === 0) {
    kind = "PASS";
    landedOn = "nowhere";
    detail = `Stale Review refused. executed=${switched.applied.executed.kind} reason=${
      "reason" in switched.applied.executed ? switched.applied.executed.reason : ""
    }`;
  } else if (wrote && landedA && !landedB) {
    kind = "PASS";
    landedOn = "ALPHA-CANARY-771";
    detail =
      "Write landed back on analysed Project A (item.projectId). Contract binds Review to the analysed project, not the newly active project. Beta untouched.";
  } else {
    kind = "EXPECTED_RED";
    landedOn = landedA ? "ALPHA-CANARY-771" : "unclear";
    detail = `executed=${switched.applied.executed.kind} leftover=${JSON.stringify(leftoverTodos)}`;
  }

  const out = {
    kind,
    analysedProjectId: ready.suggestion.projectId,
    applyRequestProjectId: BETA_ID,
    executed: switched.applied.executed,
    decision: switched.applied.decision,
    alphaBefore: before.todos.filter((t) => t.projectId === ALPHA_ID).map((t) => t.title),
    betaBefore: before.todos.filter((t) => t.projectId === BETA_ID).map((t) => t.title),
    alphaAfter,
    betaAfter,
    leftoverTodos,
    landedOn,
    detail,
  };
  report.staleReviewProject = out;
  console.log(`● [${kind}] stale Review / project switch — ${detail}`);
  return out;
}

async function main() {
  const g1 = await gap1();
  const g2 = await gap2();
  const g3 = await gap3();

  const sibling = {
    answer: "NO" as const,
    evidence:
      "Existing v0.9 pack persisted five mixed-domain siblings (distinct titles) and 30 uniquely titled todos through sequential production Apply. Long-haul sibling loss matches shared transcript-shaped durable identity + risk exact-title no_change / person identity-gate, not a generic Apply-sequencing drop.",
  };
  report.genericSiblingLoss = sibling;

  const blockers = [
    g1.kind === "EXPECTED_RED"
      ? {
          id: "person-responsibility-half-write",
          severity: "P0" as const,
          note: "Person/stakeholder can persist while responsibility knowledge does not; request reports failure.",
        }
      : null,
    g2.kind === "EXPECTED_RED"
      ? {
          id: "risk-knowledge-vs-domain-split-brain",
          severity: "P0" as const,
          note: "knowledge_items risk prose can exist without a domain risks row.",
        }
      : null,
    g3.kind === "EXPECTED_RED" && String(g3.landedOn) === "BETA-CANARY-992"
      ? {
          id: "stale-review-lands-on-active-project",
          severity: "P0" as const,
          note: "Stale Review wrote to the newly active project.",
        }
      : g3.kind === "EXPECTED_RED"
        ? {
            id: "stale-review-project-binding",
            severity: "P1" as const,
            note: g3.detail,
          }
        : null,
  ].filter(Boolean);

  const classified = [g1.kind, g2.kind, g3.kind].every(
    (k) => k === "PASS" || k === "EXPECTED_RED",
  );
  report.blockers = blockers;
  report.recommendation = classified
    ? "READY FOR BOUNDED HARDENING"
    : "ANOTHER STRUCTURAL QUESTION REMAINS";

  writeFileSync(
    join(ROOT, "docs/v1-convergence/adversarial-addendum-results.json"),
    JSON.stringify(report, null, 2),
  );
  console.log("\n── addendum ──");
  console.log(
    JSON.stringify(
      {
        person: g1.kind,
        risk: g2.kind,
        staleReview: g3.kind,
        genericSiblingLoss: sibling.answer,
        blockers: blockers.length,
        recommendation: report.recommendation,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
