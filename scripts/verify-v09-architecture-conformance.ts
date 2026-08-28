/**
 * v0.9 architecture-conformance / workflow regression pack.
 *
 * Purpose: prove the REAL production journey uses the architecture we
 * approved and tested — not that every button can be clicked, and not
 * that a fixture of already-split observations maps correctly.
 *
 * A test that starts with "here are four perfectly split person
 * observations" does NOT prove messy New Project input uses the shared
 * Capture extractor. This pack starts from raw narrative and intercepts
 * the AI fetch seam.
 *
 * Intended architecture (independent of parallel Hawkeye / Iron Man / Thor
 * branches). EXPECTED RED against current HEAD is a recorded v0.9
 * violation, not a reason to patch production from this workstream.
 *
 * Run: npx tsx scripts/verify-v09-architecture-conformance.ts
 *  or: npm run verify:v09-architecture
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { POST as postNewProject } from "../src/app/api/new-project/route";
import { applyApprovedCaptureSuggestion } from "../src/lib/capture/apply/apply-approved";
import { supabaseCaptureApplyHooks } from "../src/lib/capture/apply/persist-execute";
import { fingerprintExpectedTarget } from "../src/lib/capture/apply/expected-target";
import { CAPTURE_V2_OBSERVATION_SCHEMA } from "../src/lib/capture-v2/prompt";
import { worldFromCaptureState, runCaptureV2FromModelJson } from "../src/lib/capture-v2";
import type { CreateProjectInput } from "../src/lib/create-project";
import { loadMissionStateFromSupabase } from "../src/lib/data/supabase/load-mission-state";
import { persistNewProject } from "../src/lib/data/supabase/persist-mutations";
import { searchProjectKnowledge } from "../src/lib/tell-me/knowledge-search";
import type { MissionState } from "../src/lib/types";
import { FakeWorkspaceClient } from "./lib/fake-supabase-workspace";

const ROOT = join(import.meta.dirname, "..");

/** Messy Talk input: two people in one sentence, two knowledge rules, one ambiguity, no Objective. */
const RAW_NARRATIVE = `Harbourline Civic Archive Refresh.

Maya Chen is the sponsor and Priya Shah is doing the digitisation work.
We never store originals off-site. CAB packs must be ready 24 hours before go-live.
Apparently the vendor may already have the scan specification.
`;

/** Controlled extractor response — injected at the OpenAI fetch seam, not the test start. */
const CONTROLLED_EXTRACTOR_JSON = {
  observations: [
    {
      id: "obs-maya",
      statement: "Maya Chen is the sponsor",
      evidence: "Maya Chen is the sponsor and Priya Shah is doing the digitisation work.",
      domain: "person",
      disposition: "create_new",
      proposedValues: { name: "Maya Chen", role: "sponsor" },
    },
    {
      id: "obs-priya",
      statement: "Priya Shah is doing the digitisation work",
      evidence: "Maya Chen is the sponsor and Priya Shah is doing the digitisation work.",
      domain: "person",
      disposition: "create_new",
      proposedValues: { name: "Priya Shah", role: "digitisation" },
    },
    {
      id: "obs-originals",
      statement: "We never store originals off-site",
      evidence: "We never store originals off-site.",
      domain: "knowledge",
      disposition: "create_new",
    },
    {
      id: "obs-cab",
      statement: "CAB packs must be ready 24 hours before go-live",
      evidence: "CAB packs must be ready 24 hours before go-live.",
      domain: "knowledge",
      disposition: "create_new",
    },
    {
      id: "obs-vendor",
      statement: "The vendor may already have the scan specification",
      evidence: "Apparently the vendor may already have the scan specification.",
      domain: "knowledge",
      disposition: "ambiguous",
      commentary: "Apparently / may already — not decided.",
    },
  ],
};

const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const TODO_A = "aaaa1111-1111-4111-8111-aaaaaaaaaaaa";

type Expect = "green" | "red";
type Outcome = {
  name: string;
  expect: Expect;
  status: "pass" | "expected_red" | "unexpected_fail" | "flipped_green";
  detail?: string;
};

const outcomes: Outcome[] = [];

function readSrc(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function openaiMessages(body: unknown): string {
  const obj = body as { messages?: Array<{ content?: string }> };
  return (obj.messages ?? []).map((m) => m.content ?? "").join("\n");
}

function withMockedOpenAI(
  impl: (prompt: string) => { status: number; json: unknown } | { throw: string },
) {
  const orig = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (!url.includes("api.openai.com")) {
      assert.ok(orig, "unexpected non-OpenAI fetch with no original");
      return orig!(input, init);
    }
    const prompt = openaiMessages(JSON.parse(String(init?.body ?? "{}")));
    calls.push(prompt);
    const result = impl(prompt);
    if ("throw" in result) throw new Error(result.throw);
    return new Response(JSON.stringify(result.json), {
      status: result.status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return {
    calls,
    restore() {
      globalThis.fetch = orig;
    },
  };
}

async function journey(name: string, expect: Expect, fn: () => void | Promise<void>) {
  try {
    await fn();
    if (expect === "red") {
      outcomes.push({ name, expect, status: "flipped_green" });
      console.log(`✓ ${name} (was EXPECTED RED — architecture now matches)`);
    } else {
      outcomes.push({ name, expect, status: "pass" });
      console.log(`✓ ${name}`);
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    if (expect === "red") {
      outcomes.push({ name, expect, status: "expected_red", detail });
      console.log(`○ EXPECTED RED  ${name}`);
      console.log(`    ${detail.split("\n")[0]}`);
    } else {
      outcomes.push({ name, expect, status: "unexpected_fail", detail });
      console.error(`✗ UNEXPECTED   ${name}`);
      console.error(err);
    }
  }
}

function asClient(fake: FakeWorkspaceClient) {
  return fake as unknown as Parameters<typeof persistNewProject>[0];
}

async function load(fake: FakeWorkspaceClient): Promise<MissionState> {
  return (await loadMissionStateFromSupabase(asClient(fake))).state;
}

function durableSnapshot(fake: FakeWorkspaceClient) {
  return JSON.stringify({
    todos: fake.tables.todos,
    risks: fake.tables.risks,
    milestones: fake.tables.milestones,
    stakeholders: fake.tables.stakeholders,
    knowledge_items: fake.tables.knowledge_items,
    history_events: fake.tables.history_events,
  });
}

function workspaceFrom(fake: FakeWorkspaceClient, state: MissionState) {
  return {
    workspaceId: fake.workspaceId,
    userId: fake.userId,
    state,
  };
}

async function seedAB(fake: FakeWorkspaceClient) {
  const draft = (name: string, id: string, extra: Partial<CreateProjectInput> = {}): CreateProjectInput => ({
    name,
    code: name.replace(/\s+/g, "-").slice(0, 12).toUpperCase(),
    summary: `${name} summary`,
    currentFocus: `${name} focus`,
    sourceMode: "talk",
    stakeholders: [{ name: `${name} person`, role: "Sponsor" }],
    risks: [{ title: `${name} risk` }],
    importantDates: [{ label: `${name} milestone`, date: "2026-10-01" }],
    todos: [{ title: `${name} todo` }],
    knowledgeRemember: [{ text: `${name} knowledge`, remember: true }],
    clientProjectId: id,
    ...extra,
  });
  await persistNewProject(asClient(fake), fake.workspaceId, fake.userId, draft("Project A", PROJECT_A));
  await persistNewProject(asClient(fake), fake.workspaceId, fake.userId, draft("Project B", PROJECT_B));
}

async function main() {
  const prevAuth = process.env.LUME_AUTH;
  const prevKey = process.env.OPENAI_API_KEY;
  process.env.LUME_AUTH = "none";
  process.env.OPENAI_API_KEY = "sk-test-architecture-conformance-key";

  try {
    await journey(
      "1. New Project Talk uses the shared Capture observation extractor",
      "red",
      async () => {
        const route = readSrc("src/app/api/new-project/route.ts");
        assert.match(
          route,
          /extractObservationsWithOpenAI/,
          "POST /api/new-project Talk must call extractObservationsWithOpenAI",
        );
        assert.doesNotMatch(
          route,
          /assembleNarrativeWithOpenAI|assembleFromNarrative/,
          "Talk must not use the bespoke assemble / regex narrative path",
        );
        assert.doesNotMatch(
          route,
          /extractNewProjectV2WithOpenAI|buildNewProjectV2Prompt/,
          "Talk must not keep a bespoke New Project extract prompt",
        );
        // Leftover module is optional. If present, it must not own a separate extract contract.
        try {
          const extract = readSrc("src/lib/new-project-v2/extract.ts");
          assert.doesNotMatch(
            extract,
            /buildNewProjectV2Prompt/,
            "New Project must not keep a separate extract prompt contract",
          );
        } catch (err) {
          const code = (err as NodeJS.ErrnoException).code;
          if (code !== "ENOENT") throw err;
        }

        const mock = withMockedOpenAI(() => ({
          status: 200,
          json: {
            choices: [{ message: { content: JSON.stringify(CONTROLLED_EXTRACTOR_JSON) } }],
          },
        }));
        try {
          const res = await postNewProject(
            new Request("http://lume.test/api/new-project", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ content: RAW_NARRATIVE, sourceMode: "talk" }),
            }),
          );
          assert.equal(res.ok, true, `Talk extract HTTP ${res.status}`);
          assert.ok(mock.calls.length >= 1, "OpenAI extract seam was not called");
          const prompt = mock.calls.join("\n");
          assert.match(prompt, /You extract atomic project observations/);
          assert.match(prompt, RAW_NARRATIVE.trim().slice(0, 40));
          assert.match(prompt, CAPTURE_V2_OBSERVATION_SCHEMA.slice(0, 40));
          assert.doesNotMatch(prompt, /You organise messy project start notes/);
          assert.doesNotMatch(prompt, /You extract a Lume project setup draft/);
          const body = (await res.json()) as {
            draft?: { stakeholders?: Array<{ name: string }>; knowledgeRemember?: Array<{ text: string }> };
          };
          const names = (body.draft?.stakeholders ?? []).map((s) => s.name).join(" ");
          assert.match(names, /Maya Chen/);
          assert.match(names, /Priya Shah/);
          const knowledge = (body.draft?.knowledgeRemember ?? []).map((k) => k.text).join(" ");
          assert.match(knowledge, /never store originals/i);
          assert.match(knowledge, /CAB packs/i);
        } finally {
          mock.restore();
        }
      },
    );

    await journey(
      "2. New Project extraction failure does not silently succeed via regex/legacy",
      "red",
      async () => {
        const mock = withMockedOpenAI(() => ({ throw: "injected extractor failure" }));
        try {
          const res = await postNewProject(
            new Request("http://lume.test/api/new-project", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ content: RAW_NARRATIVE, sourceMode: "talk" }),
            }),
          );
          const body = (await res.json()) as {
            draft?: unknown;
            provider?: string;
            note?: string;
            error?: string;
          };
          assert.ok(
            res.status >= 400,
            `failure must not return HTTP ${res.status} with a draft (provider=${body.provider} note=${body.note ?? ""})`,
          );
          assert.equal(body.draft, undefined);
          assert.notEqual(body.provider, "local");
          assert.doesNotMatch(body.note ?? "", /used local parse|local draft/i);
        } finally {
          mock.restore();
        }
      },
    );

    await journey(
      "3. Capture validate → resolve → Apply → durable reload preserves Todo identity",
      "green",
      async () => {
        const fake = new FakeWorkspaceClient();
        fake.seedProject({
          id: PROJECT_A,
          workspace_id: fake.workspaceId,
          name: "Project A",
          code: "PA",
        });
        fake.tables.todos.push({
          id: TODO_A,
          workspace_id: fake.workspaceId,
          project_id: PROJECT_A,
          title: "Prepare the jelly pack",
          done: false,
        });
        const transcript =
          "Please update Prepare the jelly pack so the due date is 20 October 2026 after the liquorice shipment slipped.";
        let state = await load(fake);
        const pipeline = runCaptureV2FromModelJson({
          transcript,
          rawModelJson: {
            observations: [
              {
                id: "obs-due",
                statement: transcript,
                evidence: transcript,
                domain: "todo",
                disposition: "update_existing",
                projectId: PROJECT_A,
                candidateTargetId: TODO_A,
                candidateTargetTitle: "Prepare the jelly pack",
                proposedValues: { date: "2026-10-20" },
              },
            ],
          },
          world: worldFromCaptureState(state),
          projectId: PROJECT_A,
        });
        const row = pipeline.resolved.find((r) => r.suggestion);
        assert.ok(row?.suggestion);
        assert.equal(row!.decision.kind, "write");
        assert.ok(row!.suggestion!.expectedTarget?.id);
        const applied = await applyApprovedCaptureSuggestion({
          item: row!.suggestion!,
          text: transcript,
          projectId: PROJECT_A,
          expectedTarget: row!.suggestion!.expectedTarget,
          loadWorkspace: async () => workspaceFrom(fake, await load(fake)),
          hooks: supabaseCaptureApplyHooks({
            client: asClient(fake),
            workspaceId: fake.workspaceId,
            userId: fake.userId,
            state,
          }),
          reloadWorkspace: async () => load(fake),
        });
        assert.equal(applied.executed.kind, "wrote");
        const reloaded = await load(fake);
        const todo = reloaded.todos.find((t) => t.id === TODO_A);
        assert.equal(todo?.title, "Prepare the jelly pack");
        assert.ok(todo?.dueAt?.startsWith("2026-10-20"));
      },
    );

    await journey(
      "4. Needs-you Capture produces no durable write",
      "green",
      async () => {
        const fake = new FakeWorkspaceClient();
        await seedAB(fake);
        const before = durableSnapshot(fake);
        const state = await load(fake);
        const applied = await applyApprovedCaptureSuggestion({
          item: {
            id: "ny",
            kind: "stakeholder",
            op: "update",
            content: "The sponsor may share or replace UAT",
            destination: "project",
            projectId: PROJECT_A,
            legalDomain: "responsibility",
            ownershipSemantics: "ambiguous",
            proposedValues: { ownershipSemantics: "ambiguous" },
          },
          text: "The sponsor may share or replace UAT",
          projectId: PROJECT_A,
          loadWorkspace: async () => workspaceFrom(fake, state),
          hooks: supabaseCaptureApplyHooks({
            client: asClient(fake),
            workspaceId: fake.workspaceId,
            userId: fake.userId,
            state,
          }),
          reloadWorkspace: async () => load(fake),
        });
        assert.equal(applied.executed.kind, "needs_you");
        assert.equal(durableSnapshot(fake), before);
      },
    );

    await journey(
      "5. Stale expectedTarget Apply produces no write",
      "green",
      async () => {
        const fake = new FakeWorkspaceClient();
        await persistNewProject(asClient(fake), fake.workspaceId, fake.userId, {
          name: "Project A",
          code: "PA",
          summary: "Project A summary",
          currentFocus: "Project A focus",
          sourceMode: "talk",
          clientProjectId: PROJECT_A,
          risks: [{ title: "Vendor SLA slip" }],
        });
        let state = await load(fake);
        const risk = state.risks.find((r) => r.projectId === PROJECT_A);
        assert.ok(risk);
        const world = worldFromCaptureState(state);
        const pipeline = runCaptureV2FromModelJson({
          transcript: "Vendor SLA slip is resolved",
          rawModelJson: {
            observations: [
              {
                id: "obs-risk",
                statement: "Vendor SLA slip is resolved",
                evidence: "Vendor SLA slip is resolved",
                domain: "risk",
                disposition: "update_existing",
                projectId: PROJECT_A,
                candidateTargetId: risk!.id,
                candidateTargetTitle: risk!.title,
                proposedValues: { status: "resolved" },
              },
            ],
          },
          world,
          projectId: PROJECT_A,
        });
        const item = pipeline.resolved.find((r) => r.suggestion)?.suggestion;
        assert.ok(item);
        const expected = fingerprintExpectedTarget(world, item!);
        const row = fake.tables.risks.find((r) => r.id === risk!.id);
        assert.ok(row);
        row!.status = "watch";
        const before = durableSnapshot(fake);
        const applied = await applyApprovedCaptureSuggestion({
          item,
          text: "Vendor SLA slip is resolved",
          projectId: PROJECT_A,
          expectedTarget: expected,
          loadWorkspace: async () => workspaceFrom(fake, await load(fake)),
          hooks: supabaseCaptureApplyHooks({
            client: asClient(fake),
            workspaceId: fake.workspaceId,
            userId: fake.userId,
            state: await load(fake),
          }),
          reloadWorkspace: async () => load(fake),
        });
        assert.equal(applied.executed.kind, "needs_you");
        assert.equal(durableSnapshot(fake), before);
        assert.equal(
          (await load(fake)).risks.find((r) => r.id === risk!.id)?.status,
          "watch",
        );
      },
    );

    await journey(
      "6. Right fact, wrong project fails closed at Apply",
      "green",
      async () => {
        const fake = new FakeWorkspaceClient();
        await seedAB(fake);
        const state = await load(fake);
        const foreign = state.risks.find((r) => r.projectId === PROJECT_B);
        assert.ok(foreign, "Project B must have a risk to steal");
        const before = durableSnapshot(fake);
        const applied = await applyApprovedCaptureSuggestion({
          item: {
            id: "foreign",
            kind: "risk",
            op: "complete",
            content: `Resolve ${foreign!.title}`,
            destination: "project",
            projectId: PROJECT_A,
            legalDomain: "risk",
            targetEntityId: foreign!.id,
            proposedValues: { status: "resolved" },
            expectedTarget: {
              id: foreign!.id,
              domain: "risk",
              title: foreign!.title,
              status: foreign!.status ?? "open",
            },
          },
          text: `Resolve ${foreign!.title}`,
          projectId: PROJECT_A,
          loadWorkspace: async () => workspaceFrom(fake, state),
          hooks: supabaseCaptureApplyHooks({
            client: asClient(fake),
            workspaceId: fake.workspaceId,
            userId: fake.userId,
            state,
          }),
          reloadWorkspace: async () => load(fake),
        });
        assert.notEqual(applied.executed.kind, "wrote");
        assert.equal(durableSnapshot(fake), before);
        const reloaded = await load(fake);
        assert.equal(
          reloaded.risks.find((r) => r.id === foreign!.id)?.status,
          foreign!.status ?? "open",
        );
        assert.equal(reloaded.risks.find((r) => r.id === foreign!.id)?.projectId, PROJECT_B);
      },
    );

    await journey(
      "7. Search finds maintained todo, risk, milestone, person, and knowledge",
      "red",
      async () => {
        const fake = new FakeWorkspaceClient();
        await persistNewProject(asClient(fake), fake.workspaceId, fake.userId, {
          name: "Search Truth",
          code: "SRCH",
          summary: "Search conformance project",
          currentFocus: "Prove Search",
          sourceMode: "talk",
          clientProjectId: PROJECT_A,
          stakeholders: [{ name: "Maya Chen", role: "Sponsor" }],
          risks: [{ title: "Vendor SLA slip" }],
          importantDates: [{ label: "Go-live", date: "2026-11-01" }],
          todos: [{ title: "File the parade permit" }],
          knowledgeRemember: [{ text: "Never store originals off-site", remember: true }],
        });
        const state = await load(fake);
        const knowledge = state.knowledge.find((k) => k.projectId === PROJECT_A);
        assert.ok(knowledge);

        const bar = readSrc("src/components/knowledge-centre/KnowledgeSearchAskBar.tsx");
        // Intended: KC Search is project-truth retrieval. Today's production
        // entry is searchProjectKnowledge over knowledge sections only.
        // If Iron Man replaces the helper, this journey must call THAT entry.
        assert.match(bar, /searchProjectKnowledge/);

        const probes: Array<{ label: string; query: string; where: string }> = [
          { label: "todo", query: "File the parade permit", where: "todos" },
          { label: "risk", query: "Vendor SLA slip", where: "risks" },
          { label: "milestone", query: "Go-live", where: "timeline" },
          { label: "person", query: "Maya Chen", where: "stakeholders" },
          { label: "knowledge", query: "Never store originals off-site", where: "knowledge" },
        ];
        const missing: string[] = [];
        for (const probe of probes) {
          const hits = searchProjectKnowledge(knowledge, probe.query);
          if (!hits.length) missing.push(`${probe.label} (${probe.query}) via production Search`);
        }
        assert.equal(
          missing.length,
          0,
          `production Search missed: ${missing.join("; ")}`,
        );
      },
    );

    await journey(
      "8. Tell Me and Catch Me Up HTTP ignore posted MissionState",
      "green",
      () => {
        const tell = readSrc("src/app/api/tell-me/route.ts");
        assert.match(tell, /loadServerCurrentTruthForTellMe/);
        assert.match(tell, /clientPostedTruthFields/);
        assert.doesNotMatch(tell, /state:\s*body\.state/);
        const catchRoute = readSrc("src/app/api/catch-me-up/route.ts");
        assert.match(catchRoute, /loadAuthoritativeProjectTruth/);
        assert.match(catchRoute, /Client-posted MissionState is ignored/);
        const catchClient = readSrc("src/components/catch-me-up/iron-man-contract.ts");
        assert.match(catchClient, /Do not pass MissionState/);
      },
    );

    await journey(
      "9. Approved Capture write leaves durable History evidence after reload",
      "red",
      async () => {
        const persistExecute = readSrc("src/lib/capture/apply/persist-execute.ts");
        assert.match(
          persistExecute,
          /persistHistoryEvent/,
          "Capture persist Apply must write durable History evidence",
        );
        const fake = new FakeWorkspaceClient();
        fake.seedProject({
          id: PROJECT_A,
          workspace_id: fake.workspaceId,
          name: "Project A",
          code: "PA",
        });
        fake.tables.todos.push({
          id: TODO_A,
          workspace_id: fake.workspaceId,
          project_id: PROJECT_A,
          title: "Prepare the jelly pack",
          done: false,
        });
        const before = fake.tables.history_events.length;
        const state = await load(fake);
        const applied = await applyApprovedCaptureSuggestion({
          item: {
            id: "hist",
            kind: "action",
            op: "complete",
            content: "Prepare the jelly pack is done",
            destination: "project",
            projectId: PROJECT_A,
            legalDomain: "todo",
            targetEntityId: TODO_A,
            targetTodoId: TODO_A,
            expectedTarget: {
              id: TODO_A,
              domain: "todo",
              title: "Prepare the jelly pack",
              done: false,
            },
          },
          text: "Prepare the jelly pack is done",
          projectId: PROJECT_A,
          loadWorkspace: async () => workspaceFrom(fake, state),
          hooks: supabaseCaptureApplyHooks({
            client: asClient(fake),
            workspaceId: fake.workspaceId,
            userId: fake.userId,
            state,
          }),
          reloadWorkspace: async () => load(fake),
        });
        assert.equal(applied.executed.kind, "wrote");
        const reloaded = await load(fake);
        assert.equal(reloaded.todos.find((t) => t.id === TODO_A)?.done, true);
        assert.ok(
          fake.tables.history_events.length > before,
          "durable history_events must record the approved Capture write",
        );
        assert.ok(
          (reloaded.history ?? []).some((h) => h.projectId === PROJECT_A),
          "reloaded History must include the Capture evidence",
        );
      },
    );

    await journey(
      "10. Needs-you / no_change does not write a successful History event",
      "green",
      async () => {
        const fake = new FakeWorkspaceClient();
        await seedAB(fake);
        const before = fake.tables.history_events.length;
        const state = await load(fake);
        const applied = await applyApprovedCaptureSuggestion({
          item: {
            id: "ny-hist",
            kind: "stakeholder",
            op: "update",
            content: "Maybe share UAT",
            destination: "project",
            projectId: PROJECT_A,
            legalDomain: "responsibility",
            ownershipSemantics: "ambiguous",
          },
          text: "Maybe share UAT",
          projectId: PROJECT_A,
          loadWorkspace: async () => workspaceFrom(fake, state),
          hooks: supabaseCaptureApplyHooks({
            client: asClient(fake),
            workspaceId: fake.workspaceId,
            userId: fake.userId,
            state,
          }),
          reloadWorkspace: async () => load(fake),
        });
        assert.equal(applied.executed.kind, "needs_you");
        assert.equal(fake.tables.history_events.length, before);
      },
    );
  } finally {
    if (prevAuth === undefined) delete process.env.LUME_AUTH;
    else process.env.LUME_AUTH = prevAuth;
    if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevKey;
  }

  const unexpected = outcomes.filter((o) => o.status === "unexpected_fail");
  const expectedRed = outcomes.filter((o) => o.status === "expected_red");
  const flipped = outcomes.filter((o) => o.status === "flipped_green");
  const passed = outcomes.filter((o) => o.status === "pass" || o.status === "flipped_green");

  console.log("\n── v0.9 architecture conformance ──");
  console.log(`green ${passed.length}  expected-red ${expectedRed.length}  unexpected-fail ${unexpected.length}  flipped-green ${flipped.length}`);
  if (
    !/persistHistoryEvent/.test(readSrc("src/lib/capture/apply/persist-execute.ts"))
  ) {
    console.log(
      "NOTE: journey 10 is VACUOUS until Capture persist writes History (journey 9). Needs-you writes no History because nothing writes History yet.",
    );
  }
  if (expectedRed.length) {
    console.log("EXPECTED RED (confirmed v0.9 violations, not patched here):");
    for (const row of expectedRed) console.log(`  - ${row.name}`);
  }
  if (flipped.length) {
    console.log("Flipped to green (architecture now matches):");
    for (const row of flipped) console.log(`  - ${row.name}`);
  }
  if (unexpected.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
