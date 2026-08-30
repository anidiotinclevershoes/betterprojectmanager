/**
 * v0.9 shared-truth hardening — focused production regressions.
 *
 * H1 create identity, H2 authoritative atomicity, H3 approved-create
 * retry, temporal contract inspection, and preserved safe invariants.
 *
 * Does not import the PR #109 qualification harness.
 *
 * Run: npx tsx scripts/verify-v09-shared-truth-hardening.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyApprovedCaptureSuggestion } from "../src/lib/capture/apply/apply-approved";
import { planCaptureApply } from "../src/lib/capture/apply/dispatch";
import { executeCaptureApply } from "../src/lib/capture/apply/execute";
import { memoryCaptureApplyHooks } from "../src/lib/capture/apply/memory-execute";
import { supabaseCaptureApplyHooks } from "../src/lib/capture/apply/persist-execute";
import { resolveCaptureProjectScope } from "../src/lib/capture/apply/project-scope";
import { reviewedCreateIdentity } from "../src/lib/capture/apply/reviewed-identity";
import type { CaptureApplyWorld } from "../src/lib/capture/apply/types";
import { resolveObservations } from "../src/lib/capture-v2/resolve";
import { OBSERVATION_DISPOSITIONS, TRUTH_INTENTS } from "../src/lib/capture-v2/types";
import type { CaptureObservationV2 } from "../src/lib/capture-v2/types";
import { validateObservations } from "../src/lib/capture-v2/validate";
import { loadMissionStateFromSupabase } from "../src/lib/data/supabase/load-mission-state";
import type { PendingSuggestion } from "../src/lib/capture/suggestions";
import type { MissionState } from "../src/lib/types";
import { FakeWorkspaceClient } from "./lib/fake-supabase-workspace";

const ROOT = join(import.meta.dirname, "..");
const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const PERSON_EXISTING = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CAB_ID = "33333333-3333-4333-8333-333333333333";

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

function suggestion(
  partial: Partial<PendingSuggestion> &
    Pick<PendingSuggestion, "id" | "kind" | "op" | "content">,
): PendingSuggestion {
  return {
    destination: partial.destination ?? "test",
    projectId: partial.projectId ?? PROJECT_A,
    ...partial,
  };
}

function emptyWorld(projectId = PROJECT_A): CaptureApplyWorld {
  return {
    projectIds: new Set([projectId, PROJECT_B]),
    projects: [
      { id: projectId, name: "Project A", code: "PA", stakeholders: [] },
      { id: PROJECT_B, name: "Project B", code: "PB", stakeholders: [] },
    ],
    risks: [],
    todos: [],
    timeline: [],
    knowledge: [],
  };
}

function seedProject(fake: FakeWorkspaceClient, id = PROJECT_A, name = "Project A") {
  fake.seedProject({
    id,
    workspace_id: fake.workspaceId,
    name,
    code: name.replace(/\s+/g, "").slice(0, 8).toUpperCase(),
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
  opts?: { reloadWorkspace?: () => Promise<MissionState> },
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
    reloadWorkspace: opts?.reloadWorkspace ?? (async () => load(fake)),
  });
}

const MULTI_FACT_TRANSCRIPT = [
  "Stand-up notes 28 August.",
  "Please book the civic hall for Saturday.",
  "Gumdrop Bridge icing is now a live risk.",
  "CAB has moved to 22 October 2026.",
  "Someone mentioned the old hall booking from last year — ignore that.",
].join(" ");

async function main() {
  await check(
    "H1.1 multi-fact transcript yields distinct concise Todo/Risk/Milestone identities",
    () => {
      const world = emptyWorld();
      const observations: CaptureObservationV2[] = [
        {
          id: "obs-todo",
          statement: "Book the civic hall for Saturday",
          evidence: "Please book the civic hall for Saturday.",
          domain: "todo",
          disposition: "create_new",
          truthIntent: "current",
        },
        {
          id: "obs-risk",
          statement: "Gumdrop Bridge icing",
          evidence: "Gumdrop Bridge icing is now a live risk.",
          domain: "risk",
          disposition: "create_new",
          truthIntent: "current",
        },
        {
          id: "obs-ms",
          statement: "CAB",
          evidence: "CAB has moved to 22 October 2026.",
          domain: "milestone",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: { date: "2026-10-22" },
        },
      ];
      const resolved = resolveObservations({
        observations,
        world,
        transcript: MULTI_FACT_TRANSCRIPT,
        captureEntryProjectId: PROJECT_A,
      });
      const titles: string[] = [];
      for (const row of resolved) {
        assert.ok(row.suggestion, `expected suggestion for ${row.observation.domain}`);
        const decision = planCaptureApply({
          item: row.suggestion!,
          text: MULTI_FACT_TRANSCRIPT,
          world,
          captureEntryProjectId: PROJECT_A,
        });
        assert.equal(decision.kind, "write", row.observation.domain);
        if (decision.kind !== "write") continue;
        if (decision.operation.type === "create_todo") {
          titles.push(decision.operation.title);
          assert.equal(decision.operation.title, "Book the civic hall for Saturday");
          assert.notEqual(decision.operation.title, MULTI_FACT_TRANSCRIPT);
        } else if (decision.operation.type === "create_risk") {
          titles.push(decision.operation.title);
          assert.equal(decision.operation.title, "Gumdrop Bridge icing");
          assert.notEqual(decision.operation.title, MULTI_FACT_TRANSCRIPT);
        } else if (decision.operation.type === "create_milestone") {
          titles.push(decision.operation.label);
          assert.equal(decision.operation.label, "CAB");
          assert.notEqual(decision.operation.label, MULTI_FACT_TRANSCRIPT);
          assert.ok(decision.operation.startAt?.startsWith("2026-10-22"));
        } else {
          assert.fail(`unexpected ${decision.operation.type}`);
        }
      }
      assert.equal(new Set(titles).size, 3, "identities must be distinct");
      assert.ok(titles.every((title) => title !== MULTI_FACT_TRANSCRIPT));
    },
  );

  await check("H1.2 reviewed edit wins over transcript-shaped Apply text", () => {
    const decision = planCaptureApply({
      item: suggestion({
        id: "v2-obs-edit",
        kind: "action",
        op: "create",
        content: "Book the civic hall",
        legalDomain: "todo",
      }),
      text: MULTI_FACT_TRANSCRIPT,
      world: emptyWorld(),
      captureEntryProjectId: PROJECT_A,
    });
    assert.equal(decision.kind, "write");
    if (decision.kind !== "write" || decision.operation.type !== "create_todo") {
      throw new Error("expected create_todo");
    }
    assert.equal(decision.operation.title, "Book the civic hall");
    assert.notEqual(decision.operation.title, MULTI_FACT_TRANSCRIPT);
  });

  await check("H1.3 missing milestone date is Needs You and does not write", async () => {
    const writes: string[] = [];
    const decision = planCaptureApply({
      item: suggestion({
        id: "v2-obs-ms-nodate",
        kind: "milestone",
        op: "create",
        content: "CAB",
        legalDomain: "milestone",
      }),
      text: MULTI_FACT_TRANSCRIPT,
      world: emptyWorld(),
      captureEntryProjectId: PROJECT_A,
    });
    assert.equal(decision.kind, "needs_you");
    assert.equal(decision.domain, "milestone");
    const executed = await executeCaptureApply(decision, memoryCaptureApplyHooks({
      state: {
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
        analysesThisMonth: 0,
      },
    }));
    assert.equal(executed.kind, "needs_you");
    assert.equal(writes.length, 0);
  });

  await check("H1.4 milestone create does not invent today", () => {
    const dispatch = readSrc("src/lib/capture/apply/dispatch.ts");
    const persist = readSrc("src/lib/capture/apply/persist-execute.ts");
    assert.doesNotMatch(
      dispatch,
      /startAt[\s\S]{0,120}new Date\(\)\.toISOString\(\)/,
      "planner must not invent today's date for a milestone create",
    );
    assert.doesNotMatch(
      persist,
      /startAt:\s*op\.startAt\s*\?\?\s*new Date\(\)\.toISOString\(\)/,
      "persist hook must not invent today's date for a milestone create",
    );
    const today = new Date().toISOString().slice(0, 10);
    const decision = planCaptureApply({
      item: suggestion({
        id: "v2-obs-ms-today",
        kind: "milestone",
        op: "create",
        content: "CAB",
        legalDomain: "milestone",
      }),
      text: "CAB is soon",
      world: emptyWorld(),
      captureEntryProjectId: PROJECT_A,
    });
    assert.notEqual(decision.kind, "write");
    if (decision.kind === "write" && decision.operation.type === "create_milestone") {
      assert.notEqual(decision.operation.startAt?.slice(0, 10), today);
    }
  });

  await check("H1.5 later normal update preserves stable milestone id", async () => {
    const box = {
      state: {
        projects: [{ id: PROJECT_A, name: "A", code: "A", stakeholders: [] }],
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
      } as MissionState,
    };
    const hooks = memoryCaptureApplyHooks(box);
    const created = planCaptureApply({
      item: suggestion({
        id: "v2-obs-ms-create",
        kind: "milestone",
        op: "create",
        content: "CAB",
        legalDomain: "milestone",
        date: "2026-10-20",
        proposedValues: { date: "2026-10-20" },
      }),
      text: "CAB is 20 October",
      world: emptyWorld(),
      captureEntryProjectId: PROJECT_A,
    });
    assert.equal(created.kind, "write");
    await executeCaptureApply(created, hooks);
    assert.equal(box.state.timeline.length, 1);
    const id = box.state.timeline[0]!.id;
    const worldAfter: CaptureApplyWorld = {
      ...emptyWorld(),
      timeline: box.state.timeline.map((t) => ({
        id: t.id,
        projectId: t.projectId,
        label: t.label,
        startAt: t.startAt,
        notes: t.notes,
      })),
    };
    const updated = planCaptureApply({
      item: suggestion({
        id: "v2-obs-ms-update",
        kind: "milestone",
        op: "update",
        content: "CAB has moved to the 22nd",
        legalDomain: "milestone",
        targetEntityId: id,
        date: "2026-10-22",
        proposedValues: { date: "2026-10-22" },
      }),
      text: "No, CAB is the 22nd, not the 20th.",
      world: worldAfter,
      captureEntryProjectId: PROJECT_A,
    });
    assert.equal(updated.kind, "write");
    await executeCaptureApply(updated, hooks);
    assert.equal(box.state.timeline.length, 1);
    assert.equal(box.state.timeline[0]!.id, id);
    assert.ok(box.state.timeline[0]!.startAt?.startsWith("2026-10-22"));
    assert.equal(box.state.timeline[0]!.label, "CAB");
  });

  await check(
    "Person.create: explicit Sarah Kim persists beside Sarah Okonkwo and does not merge",
    async () => {
      const okonkwoId = PERSON_EXISTING;
      const fake = new FakeWorkspaceClient();
      seedProject(fake);
      fake.tables.stakeholders.push({
        id: okonkwoId,
        workspace_id: fake.workspaceId,
        project_id: PROJECT_A,
        name: "Sarah Okonkwo",
        role: "Product",
      });
      const transcript =
        "Sarah Kim is security — different Sarah from Sarah Okonkwo on product. Please add Sarah Kim.";
      const world: CaptureApplyWorld = {
        ...emptyWorld(),
        projects: [
          {
            id: PROJECT_A,
            name: "Project A",
            code: "PA",
            stakeholders: [{ id: okonkwoId, name: "Sarah Okonkwo", role: "Product" }],
          },
          { id: PROJECT_B, name: "Project B", code: "PB", stakeholders: [] },
        ],
      };
      const resolved = resolveObservations({
        observations: [
          {
            id: "obs-sarah-kim",
            statement: "Sarah Kim",
            evidence: "Please add Sarah Kim.",
            domain: "person",
            disposition: "create_new",
            truthIntent: "current",
            projectId: PROJECT_A,
            candidateTargetTitle: "Sarah Kim",
            proposedValues: { name: "Sarah Kim", role: "Security" },
          },
        ],
        world,
        transcript,
        captureEntryProjectId: PROJECT_A,
      });
      assert.equal(resolved[0]?.decision.kind, "write");
      assert.ok(resolved[0]?.suggestion);
      const applied = await applyPersist(fake, resolved[0]!.suggestion!, transcript);
      assert.equal(applied.executed.kind, "wrote");
      const people = fake.tables.stakeholders.filter((row) => row.project_id === PROJECT_A);
      const names = people.map((row) => String(row.name)).sort();
      assert.deepEqual(names, ["Sarah Kim", "Sarah Okonkwo"]);
      const kim = people.find((row) => row.name === "Sarah Kim");
      const okonkwo = people.find((row) => row.name === "Sarah Okonkwo");
      assert.ok(kim);
      assert.ok(okonkwo);
      assert.equal(okonkwo!.id, okonkwoId);
      assert.notEqual(kim!.id, okonkwoId);
    },
  );

  await check(
    "H2.6 new person + responsibility second-write failure leaves no mutation-created half-state",
    async () => {
      const fake = new FakeWorkspaceClient({ failOnTable: "knowledge_items" });
      seedProject(fake);
      const applied = await applyPersist(
        fake,
        suggestion({
          id: "v2-obs-nadia",
          kind: "stakeholder",
          op: "create",
          content: "Nadia Qureshi owns UAT",
          legalDomain: "responsibility",
          personName: "Nadia Qureshi",
          responsibilityScope: "UAT",
          ownershipSemantics: "share",
          proposedValues: {
            personName: "Nadia Qureshi",
            scope: "UAT",
            ownershipSemantics: "share",
          },
        }),
        "Nadia Qureshi will own UAT for this project.",
      );
      assert.equal(applied.executed.kind, "failed");
      assert.equal(fake.tables.stakeholders.length, 0, "new person must not remain");
      assert.equal(fake.tables.knowledge_items.length, 0, "no responsibility row");
    },
  );

  await check(
    "H2.7 existing person + responsibility failure preserves pre-existing state",
    async () => {
      const fake = new FakeWorkspaceClient({ failOnTable: "knowledge_items" });
      seedProject(fake);
      fake.tables.stakeholders.push({
        id: PERSON_EXISTING,
        workspace_id: fake.workspaceId,
        project_id: PROJECT_A,
        name: "Nadia Qureshi",
        role: "UAT",
      });
      const before = JSON.stringify({
        stakeholders: fake.tables.stakeholders,
        knowledge_items: fake.tables.knowledge_items,
      });
      const applied = await applyPersist(
        fake,
        suggestion({
          id: "v2-obs-nadia-existing",
          kind: "stakeholder",
          op: "create",
          content: "Nadia Qureshi owns UAT",
          legalDomain: "responsibility",
          personId: PERSON_EXISTING,
          personName: "Nadia Qureshi",
          responsibilityScope: "UAT",
          ownershipSemantics: "share",
          proposedValues: {
            personName: "Nadia Qureshi",
            scope: "UAT",
            ownershipSemantics: "share",
          },
        }),
        "Nadia Qureshi will own UAT for this project.",
      );
      assert.equal(applied.executed.kind, "failed");
      assert.equal(fake.tables.stakeholders.length, 1);
      assert.equal(fake.tables.stakeholders[0]!.id, PERSON_EXISTING);
      assert.equal(fake.tables.stakeholders[0]!.name, "Nadia Qureshi");
      assert.equal(fake.tables.knowledge_items.length, 0);
      assert.equal(
        JSON.stringify({
          stakeholders: fake.tables.stakeholders,
          knowledge_items: fake.tables.knowledge_items,
        }),
        before,
      );
    },
  );

  await check(
    "H2.8 Risk second-write failure leaves no knowledge/domain split-brain",
    async () => {
      const fake = new FakeWorkspaceClient({ failOnTable: "risks" });
      seedProject(fake);
      const applied = await applyPersist(
        fake,
        suggestion({
          id: "v2-obs-risk-canary",
          kind: "risk",
          op: "create",
          content: "ALPHA-RISK-CANARY-split-brain",
          legalDomain: "risk",
        }),
        "ALPHA-RISK-CANARY-split-brain is now open.",
      );
      assert.equal(applied.executed.kind, "failed");
      assert.equal(fake.tables.knowledge_items.length, 0);
      assert.equal(fake.tables.risks.length, 0);
    },
  );

  await check(
    "H2.compensation-failure A: person+responsibility second write and delete both fail — no half-state",
    async () => {
      const fake = new FakeWorkspaceClient({
        failOnTable: "knowledge_items",
        failOnDeleteTable: "stakeholders",
      });
      seedProject(fake);
      const applied = await applyPersist(
        fake,
        suggestion({
          id: "v2-obs-nadia-comp-fail",
          kind: "stakeholder",
          op: "create",
          content: "Nadia Qureshi owns UAT",
          legalDomain: "responsibility",
          personName: "Nadia Qureshi",
          responsibilityScope: "UAT",
          ownershipSemantics: "share",
          proposedValues: {
            personName: "Nadia Qureshi",
            scope: "UAT",
            ownershipSemantics: "share",
          },
        }),
        "Nadia Qureshi will own UAT for this project.",
      );
      assert.equal(applied.executed.kind, "failed");
      assert.equal(fake.tables.stakeholders.length, 0, "no leftover person");
      assert.equal(fake.tables.knowledge_items.length, 0, "no leftover responsibility");
    },
  );

  await check(
    "H2.compensation-failure B: risk knowledge+domain and knowledge delete both fail — no split-brain",
    async () => {
      const fake = new FakeWorkspaceClient({
        failOnTable: "risks",
        failOnDeleteTable: "knowledge_items",
      });
      seedProject(fake);
      const applied = await applyPersist(
        fake,
        suggestion({
          id: "v2-obs-risk-comp-fail",
          kind: "risk",
          op: "create",
          content: "ALPHA-RISK-COMP-FAIL",
          legalDomain: "risk",
        }),
        "ALPHA-RISK-COMP-FAIL is now open.",
      );
      assert.equal(applied.executed.kind, "failed");
      assert.equal(fake.tables.knowledge_items.length, 0);
      assert.equal(fake.tables.risks.length, 0);
    },
  );

  await check("H2 success paths still persist person/responsibility and risk", async () => {
    const people = new FakeWorkspaceClient();
    seedProject(people);
    const personOk = await applyPersist(
      people,
      suggestion({
        id: "v2-obs-nadia-ok",
        kind: "stakeholder",
        op: "create",
        content: "Nadia Qureshi owns UAT",
        legalDomain: "responsibility",
        personName: "Nadia Qureshi",
        responsibilityScope: "UAT",
        ownershipSemantics: "share",
        proposedValues: {
          personName: "Nadia Qureshi",
          scope: "UAT",
          ownershipSemantics: "share",
        },
      }),
      "Nadia Qureshi will own UAT for this project.",
    );
    assert.equal(personOk.executed.kind, "wrote");
    assert.equal(people.tables.stakeholders.length, 1);
    assert.equal(people.tables.stakeholders[0]!.name, "Nadia Qureshi");
    assert.ok(
      people.tables.knowledge_items.some(
        (row) => row.section === "people" && String(row.body).includes("UAT"),
      ),
    );

    const risks = new FakeWorkspaceClient();
    seedProject(risks);
    const riskOk = await applyPersist(
      risks,
      suggestion({
        id: "v2-obs-risk-ok",
        kind: "risk",
        op: "create",
        content: "Packaging delay",
        legalDomain: "risk",
      }),
      "Packaging delay is a live risk.",
    );
    assert.equal(riskOk.executed.kind, "wrote");
    assert.equal(risks.tables.risks.length, 1);
    assert.equal(risks.tables.risks[0]!.title, "Packaging delay");
    assert.ok(risks.tables.knowledge_items.some((row) => row.section === "risks"));
  });

  await check("H3.9 replay of the same approved Todo create writes one Todo", async () => {
    const fake = new FakeWorkspaceClient();
    seedProject(fake);
    const item = suggestion({
      id: "v2-obs-book-hall",
      kind: "action",
      op: "create",
      content: "Book the civic hall",
      legalDomain: "todo",
    });
    const first = await applyPersist(fake, item, MULTI_FACT_TRANSCRIPT);
    const second = await applyPersist(fake, item, MULTI_FACT_TRANSCRIPT);
    assert.equal(first.executed.kind, "wrote");
    assert.ok(second.executed.kind === "wrote" || second.executed.kind === "no_change");
    assert.equal(fake.tables.todos.length, 1);
    assert.equal(fake.tables.todos[0]!.title, "Book the civic hall");
  });

  await check(
    "H3.10 replay after write + reload/response failure still writes one Todo",
    async () => {
      const fake = new FakeWorkspaceClient();
      seedProject(fake);
      const item = suggestion({
        id: "v2-obs-book-hall-ack",
        kind: "action",
        op: "create",
        content: "Book the civic hall",
        legalDomain: "todo",
      });
      const first = await applyPersist(fake, item, MULTI_FACT_TRANSCRIPT, {
        reloadWorkspace: async () => {
          throw new Error("simulated reload/response failure after write");
        },
      });
      assert.equal(first.executed.kind, "wrote");
      const second = await applyPersist(fake, item, MULTI_FACT_TRANSCRIPT);
      assert.ok(second.executed.kind === "wrote" || second.executed.kind === "no_change");
      assert.equal(fake.tables.todos.length, 1);
    },
  );

  await check(
    "H3.11 distinct legitimate creates may share a human title",
    async () => {
      const fake = new FakeWorkspaceClient();
      seedProject(fake);
      const first = await applyPersist(
        fake,
        suggestion({
          id: "v2-obs-title-a",
          kind: "action",
          op: "create",
          content: "Book the hall",
          legalDomain: "todo",
        }),
        "First request to book the hall.",
      );
      const second = await applyPersist(
        fake,
        suggestion({
          id: "v2-obs-title-b",
          kind: "action",
          op: "create",
          content: "Book the hall",
          legalDomain: "todo",
        }),
        "Separate later request to book the hall again.",
      );
      assert.equal(first.executed.kind, "wrote");
      assert.equal(second.executed.kind, "wrote");
      assert.equal(fake.tables.todos.length, 2);
      assert.ok(fake.tables.todos.every((row) => row.title === "Book the hall"));
    },
  );

  await check(
    "H3.receipt-failure: truth+receipt are atomic (order B inside C) so retry writes once",
    async () => {
      const persist = readSrc("src/lib/capture/apply/persist-execute.ts");
      assert.match(
        persist,
        /persistTodoCreateWithReceipt/,
        "Todo create and receipt must share one persist helper",
      );
      assert.doesNotMatch(
        persist,
        /persistTodoCreate[\s\S]{0,180}persistPutCaptureApplyReceipt/,
        "receipt must not be a second non-atomic insert after Todo truth",
      );
      const fake = new FakeWorkspaceClient();
      seedProject(fake);
      const item = suggestion({
        id: "v2-obs-receipt-window",
        kind: "action",
        op: "create",
        content: "Book the civic hall",
        legalDomain: "todo",
      });
      fake.armFailOnTable("capture_apply_receipts");
      const first = await applyPersist(fake, item, MULTI_FACT_TRANSCRIPT);
      assert.equal(first.executed.kind, "failed");
      assert.equal(fake.tables.todos.length, 0, "truth must roll back with the receipt");
      assert.equal(fake.tables.capture_apply_receipts.length, 0);
      fake.armFailOnTable(undefined);
      const second = await applyPersist(fake, item, MULTI_FACT_TRANSCRIPT);
      assert.equal(second.executed.kind, "wrote");
      assert.equal(fake.tables.todos.length, 1);
      assert.equal(fake.tables.todos[0]!.title, "Book the civic hall");
      assert.equal(fake.tables.capture_apply_receipts.length, 1);
      assert.equal(
        fake.tables.capture_apply_receipts[0]!.operation_id,
        "v2-obs-receipt-window",
      );
      const third = await applyPersist(fake, item, MULTI_FACT_TRANSCRIPT);
      assert.ok(third.executed.kind === "wrote" || third.executed.kind === "no_change");
      assert.equal(fake.tables.todos.length, 1);
    },
  );

  await check("H3.receipt is workspace/project scoped and not loaded as truth", async () => {
    const migration = readSrc("supabase/migrations/20260829120000_capture_apply_receipts.sql");
    assert.match(migration, /unique \(workspace_id, project_id, operation_id\)/);
    assert.match(migration, /project_id uuid not null references public.projects/);
    const load = readSrc("src/lib/data/supabase/load-mission-state.ts");
    assert.doesNotMatch(load, /capture_apply_receipts/);
    const fake = new FakeWorkspaceClient();
    seedProject(fake);
    const item = suggestion({
      id: "v2-obs-receipt-scope",
      kind: "action",
      op: "create",
      content: "Send the pack",
      legalDomain: "todo",
    });
    const applied = await applyPersist(fake, item, "Send the pack");
    assert.equal(applied.executed.kind, "wrote");
    assert.equal(fake.tables.capture_apply_receipts[0]!.workspace_id, fake.workspaceId);
    assert.equal(fake.tables.capture_apply_receipts[0]!.project_id, PROJECT_A);
    const duplicate = await fake
      .from("capture_apply_receipts")
      .insert({
        workspace_id: fake.workspaceId,
        project_id: PROJECT_A,
        operation_id: "v2-obs-receipt-scope",
        entity_type: "todo",
        entity_id: "other",
      });
    assert.equal(duplicate.error?.code, "23505");
    fake.applyProjectDelete([PROJECT_A]);
    assert.equal(fake.tables.capture_apply_receipts.length, 0);
    assert.equal(fake.tables.todos[0]!.project_id, null);
  });

  function cabWorld(): CaptureApplyWorld {
    return {
      ...emptyWorld(),
      timeline: [
        {
          id: CAB_ID,
          projectId: PROJECT_A,
          label: "CAB",
          startAt: "2026-10-20T12:00:00.000Z",
        },
      ],
    };
  }

  function cabObservation(
    partial: Partial<CaptureObservationV2> &
      Pick<CaptureObservationV2, "id" | "statement" | "truthIntent">,
  ): CaptureObservationV2 {
    return {
      evidence: partial.evidence ?? partial.statement,
      domain: "milestone",
      disposition: "update_existing",
      truthIntent: "current",
      projectId: PROJECT_A,
      candidateTargetId: CAB_ID,
      candidateTargetTitle: "CAB",
      mergeWithObservationId: null,
      commentary: null,
      modelConfidence: null,
      proposedValues: partial.proposedValues ?? { date: "2026-10-18" },
      ...partial,
    };
  }

  function seedCab(fake: FakeWorkspaceClient) {
    seedProject(fake);
    fake.tables.milestones.push({
      id: CAB_ID,
      workspace_id: fake.workspaceId,
      project_id: PROJECT_A,
      label: "CAB",
      start_on: "2026-10-20",
      type: "milestone",
      source: "manual",
    });
  }

  await check("Temporal.12 missing truthIntent is rejected and is not assumed current", () => {
    const validated = validateObservations(
      [
        {
          id: "obs-missing-intent",
          statement: "CAB is the 18th",
          evidence: "CAB is the 18th",
          domain: "milestone",
          disposition: "update_existing",
          candidateTargetId: CAB_ID,
          proposedValues: { date: "2026-10-18" },
        },
      ],
      [
        {
          id: CAB_ID,
          projectId: PROJECT_A,
          entityType: "milestone",
          title: "CAB",
        },
      ],
      PROJECT_A,
    );
    assert.equal(validated.observations.length, 0);
    assert.ok(validated.issues.some((issue) => issue.code === "missing_truth_intent"));
    assert.ok(TRUTH_INTENTS.includes("current"));
    assert.ok(TRUTH_INTENTS.includes("non_current"));
    assert.ok(TRUTH_INTENTS.includes("uncertain"));
    const types = readSrc("src/lib/capture-v2/types.ts");
    const dispatch = readSrc("src/lib/capture/apply/dispatch.ts");
    const apply = readSrc("src/lib/capture/apply/apply-approved.ts");
    assert.ok(OBSERVATION_DISPOSITIONS.includes("update_existing"));
    assert.doesNotMatch(types, /temporalIntent|evidenceKind|staleQuoted|quotedEvidence/);
    assert.doesNotMatch(
      dispatch,
      /contains\(["']old["']\)|\/\\bold\\b\/|used to be|previous date|quoted date/,
    );
    assert.doesNotMatch(apply, /\\bold\\b|used to be|quoted date|previous date/);
  });

  await check(
    "Temporal.12a historical 18 with update_existing does not mutate current CAB 20",
    async () => {
      const world = cabWorld();
      const observation = cabObservation({
        id: "obs-used-to-be",
        statement: "CAB used to be the 18th",
        truthIntent: "non_current",
        disposition: "update_existing",
        proposedValues: { date: "2026-10-18" },
      });
      const resolved = resolveObservations({
        observations: [observation],
        world,
        transcript: "It used to be the 18th.",
        captureEntryProjectId: PROJECT_A,
      });
      assert.equal(resolved[0]?.decision.kind, "no_change");
      assert.equal(resolved[0]?.suggestion, null);
      const fake = new FakeWorkspaceClient();
      seedCab(fake);
      const forced = suggestion({
        id: "v2-obs-used-to-be",
        kind: "milestone",
        op: "update",
        content: "CAB used to be the 18th",
        legalDomain: "milestone",
        targetEntityId: CAB_ID,
        date: "2026-10-18",
        proposedValues: { date: "2026-10-18" },
        truthIntent: "non_current",
      });
      const applied = await applyPersist(fake, forced, "It used to be the 18th.");
      assert.notEqual(applied.executed.kind, "wrote");
      assert.equal(fake.tables.milestones[0]!.start_on, "2026-10-20");
      assert.equal(fake.tables.history_events.length, 0);
    },
  );

  await check("Temporal.12b quoted old notes 18 do not mutate current CAB 20", async () => {
    const observation = cabObservation({
      id: "obs-old-notes",
      statement: "Old meeting notes say CAB was the 18th",
      truthIntent: "non_current",
      proposedValues: { date: "2026-10-18" },
    });
    const resolved = resolveObservations({
      observations: [observation],
      world: cabWorld(),
      transcript: "Old meeting notes say 18.",
      captureEntryProjectId: PROJECT_A,
    });
    assert.equal(resolved[0]?.decision.kind, "no_change");
    const fake = new FakeWorkspaceClient();
    seedCab(fake);
    const applied = await applyPersist(
      fake,
      suggestion({
        id: "v2-obs-old-notes",
        kind: "milestone",
        op: "update",
        content: "Old meeting notes say CAB was the 18th",
        legalDomain: "milestone",
        targetEntityId: CAB_ID,
        date: "2026-10-18",
        proposedValues: { date: "2026-10-18" },
        truthIntent: "non_current",
      }),
      "Old meeting notes say 18.",
    );
    assert.notEqual(applied.executed.kind, "wrote");
    assert.equal(fake.tables.milestones[0]!.start_on, "2026-10-20");
  });

  await check("Temporal.12c considered-but-not-agreed 22 does not mutate", async () => {
    const observation = cabObservation({
      id: "obs-discussed",
      statement: "We discussed CAB on the 22nd but did not agree it",
      truthIntent: "non_current",
      proposedValues: { date: "2026-10-22" },
    });
    const resolved = resolveObservations({
      observations: [observation],
      world: cabWorld(),
      transcript: "We discussed 22 but didn't agree it.",
      captureEntryProjectId: PROJECT_A,
    });
    assert.equal(resolved[0]?.decision.kind, "no_change");
    const fake = new FakeWorkspaceClient();
    seedCab(fake);
    const applied = await applyPersist(
      fake,
      suggestion({
        id: "v2-obs-discussed",
        kind: "milestone",
        op: "update",
        content: "We discussed CAB on the 22nd but did not agree it",
        legalDomain: "milestone",
        targetEntityId: CAB_ID,
        date: "2026-10-22",
        proposedValues: { date: "2026-10-22" },
        truthIntent: "non_current",
      }),
      "We discussed 22 but didn't agree it.",
    );
    assert.notEqual(applied.executed.kind, "wrote");
    assert.equal(fake.tables.milestones[0]!.start_on, "2026-10-20");
  });

  await check("Temporal.12d uncertain CAB move is Needs You and does not write", async () => {
    const observation = cabObservation({
      id: "obs-might",
      statement: "CAB might move to the 22nd",
      truthIntent: "uncertain",
      proposedValues: { date: "2026-10-22" },
    });
    const resolved = resolveObservations({
      observations: [observation],
      world: cabWorld(),
      transcript: "CAB might move to 22.",
      captureEntryProjectId: PROJECT_A,
    });
    assert.equal(resolved[0]?.decision.kind, "needs_you");
    assert.equal(resolved[0]?.suggestion, null);
    const fake = new FakeWorkspaceClient();
    seedCab(fake);
    const applied = await applyPersist(
      fake,
      suggestion({
        id: "v2-obs-might",
        kind: "milestone",
        op: "update",
        content: "CAB might move to the 22nd",
        legalDomain: "milestone",
        targetEntityId: CAB_ID,
        date: "2026-10-22",
        proposedValues: { date: "2026-10-22" },
        truthIntent: "uncertain",
      }),
      "CAB might move to 22.",
    );
    assert.equal(applied.executed.kind, "needs_you");
    assert.equal(fake.tables.milestones[0]!.start_on, "2026-10-20");
    assert.equal(fake.tables.history_events.length, 0);
  });

  await check("Temporal.12e current move to 22 updates CAB", async () => {
    const observation = cabObservation({
      id: "obs-moved",
      statement: "CAB has moved to the 22nd",
      truthIntent: "current",
      proposedValues: { date: "2026-10-22" },
    });
    const resolved = resolveObservations({
      observations: [observation],
      world: cabWorld(),
      transcript: "CAB has moved to 22.",
      captureEntryProjectId: PROJECT_A,
    });
    assert.equal(resolved[0]?.decision.kind, "write");
    const fake = new FakeWorkspaceClient();
    seedCab(fake);
    const applied = await applyPersist(fake, resolved[0]!.suggestion!, "CAB has moved to 22.");
    assert.equal(applied.executed.kind, "wrote");
    assert.equal(fake.tables.milestones[0]!.start_on, "2026-10-22");
  });

  await check("Temporal.12f explicit correction to 22 updates CAB", async () => {
    const observation = cabObservation({
      id: "obs-correction",
      statement: "No, CAB is the 22nd, not the 20th",
      truthIntent: "current",
      proposedValues: { date: "2026-10-22" },
    });
    const resolved = resolveObservations({
      observations: [observation],
      world: cabWorld(),
      transcript: "No, CAB is 22, not 20.",
      captureEntryProjectId: PROJECT_A,
    });
    assert.equal(resolved[0]?.decision.kind, "write");
    const fake = new FakeWorkspaceClient();
    seedCab(fake);
    const applied = await applyPersist(
      fake,
      resolved[0]!.suggestion!,
      "No, CAB is 22, not 20.",
    );
    assert.equal(applied.executed.kind, "wrote");
    assert.equal(fake.tables.milestones[0]!.start_on, "2026-10-22");
  });

  await check(
    "Temporal.12g one Capture with historical 18 and current 22 writes only 22",
    async () => {
      const resolved = resolveObservations({
        observations: [
          cabObservation({
            id: "obs-hist-18",
            statement: "CAB used to be the 18th",
            truthIntent: "non_current",
            proposedValues: { date: "2026-10-18" },
          }),
          cabObservation({
            id: "obs-now-22",
            statement: "CAB is now the 22nd",
            truthIntent: "current",
            proposedValues: { date: "2026-10-22" },
          }),
        ],
        world: cabWorld(),
        transcript: "It used to be the 18th. CAB is now the 22nd.",
        captureEntryProjectId: PROJECT_A,
      });
      assert.equal(resolved[0]?.decision.kind, "no_change");
      assert.equal(resolved[1]?.decision.kind, "write");
      const fake = new FakeWorkspaceClient();
      seedCab(fake);
      if (resolved[0]?.suggestion) {
        const skipped = await applyPersist(
          fake,
          resolved[0].suggestion,
          "It used to be the 18th. CAB is now the 22nd.",
        );
        assert.notEqual(skipped.executed.kind, "wrote");
      }
      const applied = await applyPersist(
        fake,
        resolved[1]!.suggestion!,
        "It used to be the 18th. CAB is now the 22nd.",
      );
      assert.equal(applied.executed.kind, "wrote");
      assert.equal(fake.tables.milestones.length, 1);
      assert.equal(fake.tables.milestones[0]!.start_on, "2026-10-22");
    },
  );

  await check("Temporal.13 explicit correction still updates the current date", () => {
    const world: CaptureApplyWorld = {
      ...emptyWorld(),
      timeline: [
        {
          id: CAB_ID,
          projectId: PROJECT_A,
          label: "CAB",
          startAt: "2026-10-20T12:00:00.000Z",
        },
      ],
    };
    const decision = planCaptureApply({
      item: suggestion({
        id: "v2-obs-correction",
        kind: "milestone",
        op: "update",
        content: "No, CAB is the 22nd, not the 20th.",
        legalDomain: "milestone",
        targetEntityId: CAB_ID,
        date: "2026-10-22",
        proposedValues: { date: "2026-10-22" },
        truthIntent: "current",
      }),
      text: "No, CAB is the 22nd, not the 20th.",
      world,
      captureEntryProjectId: PROJECT_A,
    });
    assert.equal(decision.kind, "write");
    if (decision.kind !== "write" || decision.operation.type !== "update_milestone") {
      throw new Error("expected update_milestone");
    }
    assert.ok(decision.operation.startAt?.startsWith("2026-10-22"));
    assert.equal(decision.operation.milestoneId, CAB_ID);
  });

  await check("Preserve.14 stale Review / project-switch writes nowhere", async () => {
    const scope = resolveCaptureProjectScope({
      item: suggestion({
        id: "v2-obs-switch",
        kind: "action",
        op: "create",
        content: "Book the civic hall",
        projectId: PROJECT_A,
        legalDomain: "todo",
      }),
      captureEntryProjectId: PROJECT_B,
      workspaceProjectIds: new Set([PROJECT_B]),
    });
    assert.equal(scope.ok, false);
    if (!scope.ok) {
      assert.match(scope.reason, /not in the current workspace/i);
    }
    const fake = new FakeWorkspaceClient();
    seedProject(fake, PROJECT_B, "Project B");
    const before = JSON.stringify(fake.tables);
    const applied = await applyApprovedCaptureSuggestion({
      item: suggestion({
        id: "v2-obs-switch-apply",
        kind: "action",
        op: "create",
        content: "Book the civic hall",
        projectId: PROJECT_A,
        legalDomain: "todo",
      }),
      text: "Book the civic hall",
      projectId: PROJECT_B,
      loadWorkspace: async () => workspaceFrom(fake, await load(fake)),
      hooks: supabaseCaptureApplyHooks({
        client: asClient(fake),
        workspaceId: fake.workspaceId,
        userId: fake.userId,
        state: await load(fake),
      }),
    });
    assert.equal(applied.executed.kind, "needs_you");
    assert.match(applied.executed.reason, /not in the current workspace/i);
    assert.equal(fake.tables.todos.length, 0);
    assert.equal(JSON.stringify(fake.tables), before);
  });

  await check("Preserve.15 mixed-domain and 30 uniquely titled siblings persist", async () => {
    const fake = new FakeWorkspaceClient();
    seedProject(fake);
    const mixed: PendingSuggestion[] = [
      suggestion({
        id: "v2-sib-todo",
        kind: "action",
        op: "create",
        content: "Send the CAB pack",
        legalDomain: "todo",
      }),
      suggestion({
        id: "v2-sib-risk",
        kind: "risk",
        op: "create",
        content: "Vendor lock-in on auth",
        legalDomain: "risk",
      }),
      suggestion({
        id: "v2-sib-ms",
        kind: "milestone",
        op: "create",
        content: "Public preview",
        legalDomain: "milestone",
        date: "2026-12-01",
        proposedValues: { date: "2026-12-01" },
      }),
      suggestion({
        id: "v2-sib-person",
        kind: "stakeholder",
        op: "create",
        content: "Lila Hart joins as curator",
        legalDomain: "person",
        personName: "Lila Hart",
        proposedValues: { name: "Lila Hart" },
      }),
      suggestion({
        id: "v2-sib-knowledge",
        kind: "knowledge",
        op: "create",
        content: "Pack must land 48 hours before CAB",
        legalDomain: "knowledge",
        knowledgeSection: "now",
      }),
    ];
    for (const item of mixed) {
      const applied = await applyPersist(fake, item, item.content);
      assert.equal(applied.executed.kind, "wrote", item.id);
    }
    assert.equal(fake.tables.todos.filter((row) => row.title === "Send the CAB pack").length, 1);
    assert.equal(fake.tables.risks.length, 1);
    assert.equal(fake.tables.milestones.length, 1);
    assert.equal(fake.tables.stakeholders.length, 1);
    assert.ok(fake.tables.knowledge_items.some((row) => row.section === "now"));

    for (let i = 0; i < 30; i += 1) {
      const applied = await applyPersist(
        fake,
        suggestion({
          id: `v2-sib-todo-${i}`,
          kind: "action",
          op: "create",
          content: `Unique sibling todo ${i + 1}`,
          legalDomain: "todo",
        }),
        `Please add Unique sibling todo ${i + 1}`,
      );
      assert.equal(applied.executed.kind, "wrote");
    }
    assert.equal(
      fake.tables.todos.filter((row) => String(row.title).startsWith("Unique sibling todo")).length,
      30,
    );
  });

  await check("H1 reviewed identity helper never reads Apply text", () => {
    const item = suggestion({
      id: "helper",
      kind: "action",
      op: "create",
      content: "Book the civic hall",
    });
    assert.equal(reviewedCreateIdentity(item), "Book the civic hall");
    const helper = readSrc("src/lib/capture/apply/reviewed-identity.ts");
    assert.doesNotMatch(helper, /args\.text|param.*text/);
    const session = readSrc("src/components/capture/CaptureSessionContext.tsx");
    assert.match(
      session,
      /content:\s*reviewed/,
      "Review edit must be written onto item.content before Apply",
    );
  });

  console.log(`\n${passed} v0.9 shared-truth hardening checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
