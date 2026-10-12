/**
 * Shared Organise round trip against a real Supabase database.
 *
 * Uses the production loader, the production Apply hooks, and a fresh
 * database read. The in-memory executor is not used.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and
 * SUPABASE_SERVICE_ROLE_KEY. Missing credentials exit 2. This script is
 * not part of npm test.
 *
 * Creates two throwaway users and deletes them at the end.
 * Run: npx tsx scripts/verify-shared-organise-supabase.ts
 */
import assert from "node:assert/strict";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { applyApprovedCaptureSuggestion } from "../src/lib/capture/apply/apply-approved";
import { supabaseCaptureApplyHooks } from "../src/lib/capture/apply/persist-execute";
import { captureApplyWorldFromState } from "../src/lib/capture/apply/world";
import { buildReviewChangeViewModels } from "../src/lib/capture/review/viewModel";
import { buildSuggestions } from "../src/lib/capture/suggestions";
import { createSupabaseRepositories } from "../src/lib/data/supabase/repositories";
import { loadMissionStateFromSupabase } from "../src/lib/data/supabase/load-mission-state";
import { persistHistoryEvent } from "../src/lib/data/supabase/persist-mutations";
import { buildSharedOrganiseContext } from "../src/lib/shared-organise/context";
import { runSharedOrganiseFromModelJson } from "../src/lib/shared-organise/run";
import type { MissionState } from "../src/lib/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const REF = "2026-10-03";

if (!url || !anon || !service) {
  console.error(
    "MISSING: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(2);
}

const admin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function userClient(session: Session) {
  const client = createClient(url!, anon!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}

async function authed(session: Session): Promise<SupabaseClient> {
  const client = userClient(session);
  const set = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (set.error || !set.data.session) {
    throw set.error ?? new Error("Could not restore the user session");
  }
  return client;
}

async function freshLoad(session: Session) {
  return loadMissionStateFromSupabase(await authed(session));
}

function change(partial: Record<string, unknown>) {
  return {
    id: "chg-1",
    outcome: "ready",
    operation: "ensure_person",
    targetId: null,
    evidence: "",
    reason: null,
    materialUncertainty: [],
    values: {},
    ...partial,
  };
}

function form(changes: Array<Record<string, unknown>>) {
  return { changes };
}

async function organiseAndApply(args: {
  session: Session;
  workspaceId: string;
  userId: string;
  projectId: string;
  transcript: string;
  raw: unknown;
}) {
  const before = await freshLoad(args.session);
  const scoped = {
    ...before.state,
    projects: before.state.projects.filter((row) => row.id === args.projectId),
    todos: before.state.todos.filter((row) => row.projectId === args.projectId),
    risks: (before.state.risks ?? []).filter((row) => row.projectId === args.projectId),
    timeline: before.state.timeline.filter((row) => row.projectId === args.projectId),
    knowledge: before.state.knowledge.filter((row) => row.projectId === args.projectId),
  };
  const world = captureApplyWorldFromState(scoped);
  const run = runSharedOrganiseFromModelJson({
    transcript: args.transcript,
    rawModelJson: args.raw,
    world,
    projectId: args.projectId,
    referenceDate: REF,
  });
  const suggestions = buildSuggestions(run.result);
  const cards = buildReviewChangeViewModels(suggestions, run.result, args.transcript, {}, {
    world,
    captureEntryProjectId: args.projectId,
  });
  const ready = cards.filter((card) => card.canApprove && card.readiness === "ready");
  if (ready.length === 0) {
    throw new Error(
      `No Ready card for ${JSON.stringify(args.transcript)} labels=${run.reviewed.map((row) => row.label).join(",")}`,
    );
  }
  let last: MissionState | undefined;
  for (const card of ready) {
    const loaded = await freshLoad(args.session);
    const client = await authed(args.session);
    const applied = await applyApprovedCaptureSuggestion({
      item: card.suggestion,
      text: args.transcript,
      projectId: args.projectId,
      expectedTarget: card.suggestion.expectedTarget,
      loadWorkspace: async () => loaded,
      hooks: supabaseCaptureApplyHooks({
        client,
        workspaceId: args.workspaceId,
        userId: args.userId,
        state: loaded.state,
      }),
      recordHistory: (event) =>
        persistHistoryEvent(client, args.workspaceId, args.userId, event),
      reloadWorkspace: async () => (await freshLoad(args.session)).state,
    });
    assert.equal(applied.executed.kind, "wrote", card.suggestion.content);
    assert.notEqual(applied.reconcileFailed, true, card.suggestion.content);
    assert.ok(applied.state, "fresh reload returned state");
    last = applied.state;
  }
  const again = await freshLoad(args.session);
  return { state: again.state, reviewed: run.reviewed, appliedState: last! };
}

async function table(name: string, projectId: string) {
  const { data, error } = await admin.from(name).select("*").eq("project_id", projectId);
  if (error) throw new Error(`${name}: ${error.message}`);
  return data ?? [];
}

async function main() {
  const stamp = Date.now();
  const password = `TestPass-${stamp}!aA1`;
  const emailA = `so-rt-a-${stamp}@example.com`;
  const emailB = `so-rt-b-${stamp}@example.com`;
  let userA: string | null = null;
  let userB: string | null = null;
  let workspaceA: string | null = null;
  let workspaceB: string | null = null;

  try {
    const createdA = await admin.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    });
    if (createdA.error || !createdA.data.user) throw createdA.error ?? new Error("user A");
    userA = createdA.data.user.id;
    const createdB = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    });
    if (createdB.error || !createdB.data.user) throw createdB.error ?? new Error("user B");
    userB = createdB.data.user.id;

    const signA = await createClient(url!, anon!).auth.signInWithPassword({
      email: emailA,
      password,
    });
    const signB = await createClient(url!, anon!).auth.signInWithPassword({
      email: emailB,
      password,
    });
    if (!signA.data.session || !signB.data.session) {
      throw signA.error ?? signB.error ?? new Error("sign-in failed");
    }

    const loadedA = await freshLoad(signA.data.session);
    const loadedB = await freshLoad(signB.data.session);
    workspaceA = loadedA.workspaceId;
    workspaceB = loadedB.workspaceId;
    assert.notEqual(workspaceA, workspaceB);

    const reposA = createSupabaseRepositories(await authed(signA.data.session));
    const projectA = await reposA.projects.create({
      workspaceId: workspaceA,
      name: `Shared Organise round trip ${stamp}`,
      code: "SORT",
      createdBy: userA,
    });
    const reposB = createSupabaseRepositories(await authed(signB.data.session));
    const projectB = await reposB.projects.create({
      workspaceId: workspaceB,
      name: `Other project ${stamp}`,
      code: "OTHR",
      createdBy: userB,
    });

    const base = {
      session: signA.data.session,
      workspaceId: workspaceA,
      userId: userA,
      projectId: projectA,
    };

    await organiseAndApply({
      ...base,
      transcript: "Sarah Kim has joined the project as QS.",
      raw: form([
        change({
          evidence: "Sarah Kim has joined the project as QS.",
          values: { name: "Sarah Kim", roleHint: "QS" },
        }),
      ]),
    });
    const peopleRows = await table("stakeholders", projectA);
    const sarah = peopleRows.find((row) => row.name === "Sarah Kim");
    assert.ok(sarah, "stakeholders row");
    assert.equal(sarah.role, "QS");
    assert.equal(sarah.project_id, projectA);

    await organiseAndApply({
      ...base,
      transcript: "Sarah Kim owns UAT.",
      raw: form([
        change({
          operation: "confirm_responsibility",
          evidence: "Sarah Kim owns UAT.",
          values: { personName: "Sarah Kim", scope: "UAT", ownershipSemantics: "share" },
        }),
      ]),
    });
    const responsibilityRows = (await table("knowledge_items", projectA)).filter(
      (row) => row.kind === "responsibility",
    );
    assert.equal(responsibilityRows.length, 1);
    assert.equal(responsibilityRows[0]?.lifecycle, "current");
    assert.equal(responsibilityRows[0]?.meta?.responsibility?.scope, "UAT");
    assert.equal(responsibilityRows[0]?.meta?.responsibility?.personName, "Sarah Kim");

    await organiseAndApply({
      ...base,
      transcript: "Sort the fire cert.",
      raw: form([
        change({
          operation: "create_todo",
          evidence: "Sort the fire cert.",
          values: { title: "Sort the fire cert" },
        }),
      ]),
    });
    const todoRows = await table("todos", projectA);
    const fire = todoRows.find((row) => row.title === "Sort the fire cert");
    assert.ok(fire);
    assert.equal(fire.done, false);

    await organiseAndApply({
      ...base,
      transcript: "Raise a risk called Fire certificate delay.",
      raw: form([
        change({
          operation: "create_risk",
          evidence: "Raise a risk called Fire certificate delay.",
          values: { title: "Fire certificate delay" },
        }),
      ]),
    });
    const riskRows = await table("risks", projectA);
    const delay = riskRows.find((row) => row.title === "Fire certificate delay");
    assert.ok(delay);
    assert.equal(delay.status, "open");

    await organiseAndApply({
      ...base,
      transcript: "Parade day is 15 October 2026.",
      raw: form([
        change({
          operation: "create_milestone",
          evidence: "Parade day is 15 October 2026.",
          values: { label: "Parade day", dateIntent: "set_explicit", date: "2026-10-15" },
        }),
      ]),
    });
    const milestoneRows = await table("milestones", projectA);
    const parade = milestoneRows.find((row) => row.label === "Parade day");
    assert.ok(parade);
    assert.equal(String(parade.start_on).slice(0, 10), "2026-10-15");

    await organiseAndApply({
      ...base,
      transcript: "Sarah Kim is away from 2026-11-02 to 2026-11-06.",
      raw: form([
        change({
          operation: "write_availability",
          evidence: "Sarah Kim is away from 2026-11-02 to 2026-11-06.",
          values: {
            personName: "Sarah Kim",
            awayFromIso: "2026-11-02",
            awayToIso: "2026-11-06",
          },
        }),
      ]),
    });
    const availability = (await table("knowledge_items", projectA)).find(
      (row) => row.kind === "availability",
    );
    assert.ok(availability);
    assert.equal(availability.meta?.availability?.awayFromIso?.slice(0, 10), "2026-11-02");

    await organiseAndApply({
      ...base,
      transcript: "The oak beam stays.",
      raw: form([
        change({
          operation: "write_knowledge",
          evidence: "The oak beam stays.",
          values: { text: "The oak beam stays.", section: "now" },
        }),
      ]),
    });
    const oak = (await table("knowledge_items", projectA)).find((row) => row.body === "The oak beam stays.");
    assert.ok(oak);
    assert.equal(oak.section, "now");

    await organiseAndApply({
      ...base,
      transcript: "We decided to keep the existing stairs.",
      raw: form([
        change({
          operation: "write_knowledge",
          evidence: "We decided to keep the existing stairs.",
          values: { text: "We decided to keep the existing stairs.", section: "decisions" },
        }),
      ]),
    });
    const stairs = (await table("knowledge_items", projectA)).find(
      (row) => row.body === "We decided to keep the existing stairs.",
    );
    assert.ok(stairs);
    assert.equal(stairs.section, "decisions");

    const createdContext = buildSharedOrganiseContext({
      world: captureApplyWorldFromState((await freshLoad(signA.data.session)).state),
      projectId: projectA,
      referenceDate: REF,
    });
    assert.match(createdContext.prompt, /Sarah Kim/);
    assert.match(createdContext.prompt, /QS/);
    assert.ok(createdContext.responsibilities.some((row) => row.personName === "Sarah Kim" && row.scope === "UAT"));
    assert.match(createdContext.prompt, /Sort the fire cert/);
    assert.match(createdContext.prompt, /Fire certificate delay/);
    assert.match(createdContext.prompt, /2026-10-15/);
    assert.match(createdContext.prompt, /oak beam/);
    assert.match(createdContext.prompt, /stairs/);
    assert.match(createdContext.prompt, /availability/);

    const fireId = String(fire.id);
    const delayId = String(delay.id);
    const paradeId = String(parade.id);

    await organiseAndApply({
      ...base,
      transcript: "Sort the fire cert is done.",
      raw: form([
        change({
          operation: "complete_todo",
          targetId: fireId,
          evidence: "Sort the fire cert is done.",
          values: {},
        }),
      ]),
    });
    assert.equal((await table("todos", projectA)).find((row) => row.id === fireId)?.done, true);

    await organiseAndApply({
      ...base,
      transcript: "Fire certificate delay is resolved.",
      raw: form([
        change({
          operation: "update_risk_status",
          targetId: delayId,
          evidence: "Fire certificate delay is resolved.",
          values: { status: "resolved" },
        }),
      ]),
    });
    assert.equal((await table("risks", projectA)).find((row) => row.id === delayId)?.status, "resolved");

    await organiseAndApply({
      ...base,
      transcript: "Parade day is 18 December 2026.",
      raw: form([
        change({
          operation: "update_milestone",
          targetId: paradeId,
          evidence: "Parade day is 18 December 2026.",
          values: { dateIntent: "set_explicit", date: "2026-12-18" },
        }),
      ]),
    });
    assert.equal(
      String((await table("milestones", projectA)).find((row) => row.id === paradeId)?.start_on).slice(0, 10),
      "2026-12-18",
    );

    await organiseAndApply({
      ...base,
      transcript: "James Murphy replaces Sarah Kim on UAT.",
      raw: form([
        change({
          operation: "ensure_person",
          evidence: "James Murphy replaces Sarah Kim on UAT.",
          values: { name: "James Murphy" },
        }),
        change({
          id: "chg-2",
          operation: "confirm_responsibility",
          evidence: "James Murphy replaces Sarah Kim on UAT.",
          values: {
            personName: "James Murphy",
            scope: "UAT",
            ownershipSemantics: "replace",
          },
        }),
      ]),
    });
    const afterReplace = (await table("knowledge_items", projectA)).filter(
      (row) => row.kind === "responsibility" && row.meta?.responsibility?.scope === "UAT",
    );
    const currentOwners = afterReplace.filter((row) => row.lifecycle === "current");
    assert.deepEqual(
      currentOwners.map((row) => row.meta?.responsibility?.personName),
      ["James Murphy"],
    );
    assert.ok(afterReplace.some((row) => row.lifecycle === "superseded" && row.meta?.responsibility?.personName === "Sarah Kim"));

    const next = buildSharedOrganiseContext({
      world: captureApplyWorldFromState((await freshLoad(signA.data.session)).state),
      projectId: projectA,
      referenceDate: REF,
    });
    assert.match(next.prompt, /done=true/);
    assert.match(next.prompt, /resolved/);
    assert.match(next.prompt, /2026-12-18/);
    assert.ok(next.responsibilities.some((row) => row.personName === "James Murphy" && row.scope === "UAT" && row.ownerConfirmed));
    assert.equal(
      next.responsibilities.some((row) => row.personName === "Sarah Kim" && row.scope === "UAT"),
      false,
    );

    const history = await table("history_events", projectA);
    assert.ok(history.length >= 8, `history rows ${history.length}`);

    const receipts = await (await authed(signA.data.session))
      .from("capture_apply_receipts")
      .select("operation_id, entity_type")
      .eq("project_id", projectA);
    if (receipts.error) throw new Error(receipts.error.message);
    assert.ok((receipts.data ?? []).length >= 8, `receipts ${receipts.data?.length ?? 0}`);
    const stolenReceipts = await (await authed(signB.data.session))
      .from("capture_apply_receipts")
      .select("operation_id")
      .eq("project_id", projectA);
    assert.equal(stolenReceipts.data?.length ?? 0, 0);

    await organiseAndApply({
      session: signB.data.session,
      workspaceId: workspaceB,
      userId: userB,
      projectId: projectB,
      transcript: "Raise a risk called Foreign console.",
      raw: form([
        change({
          operation: "create_risk",
          evidence: "Raise a risk called Foreign console.",
          values: { title: "Foreign console" },
        }),
      ]),
    });
    const foreign = (await table("risks", projectB)).find((row) => row.title === "Foreign console");
    assert.ok(foreign);
    const blocked = runSharedOrganiseFromModelJson({
      transcript: "Foreign console is resolved.",
      rawModelJson: form([
        change({
          operation: "update_risk_status",
          targetId: foreign.id,
          evidence: "Foreign console is resolved.",
          values: { status: "resolved" },
        }),
      ]),
      world: captureApplyWorldFromState((await freshLoad(signA.data.session)).state),
      projectId: projectA,
      referenceDate: REF,
    });
    assert.ok(blocked.reviewed.every((row) => row.label !== "Ready"));
    assert.equal((await table("risks", projectB)).find((row) => row.id === foreign.id)?.status, "open");

    const attacker = await authed(signB.data.session);
    const hijack = await attacker
      .from("stakeholders")
      .update({ name: "Hijacked" })
      .eq("id", sarah.id)
      .select("id");
    assert.equal(hijack.error, null);
    assert.equal(hijack.data?.length ?? 0, 0);
    const stolenRead = await attacker.from("stakeholders").select("id").eq("id", sarah.id);
    assert.equal(stolenRead.data?.length ?? 0, 0);
    assert.equal((await table("stakeholders", projectA)).find((row) => row.id === sarah.id)?.name, "Sarah Kim");

    const ownRead = await (await authed(signA.data.session))
      .from("stakeholders")
      .select("id, name, role")
      .eq("project_id", projectA);
    assert.ok(ownRead.data?.some((row) => row.name === "Sarah Kim" && row.role === "QS"));

    console.log(
      JSON.stringify({
        project: "exfftrxxinhduogcluce",
        projectA,
        projectB,
        workspaceA,
        sarahId: sarah.id,
        history: history.length,
        receipts: receipts.data?.length ?? 0,
        ok: true,
      }),
    );
  } finally {
    if (workspaceA) await admin.from("workspaces").delete().eq("id", workspaceA);
    if (workspaceB) await admin.from("workspaces").delete().eq("id", workspaceB);
    if (userA) await admin.auth.admin.deleteUser(userA);
    if (userB) await admin.auth.admin.deleteUser(userB);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
