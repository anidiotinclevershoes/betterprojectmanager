/**
 * Shared Organise production convergence.
 * Deterministic. No live model. No live Supabase.
 * Proves the form contract, Review/Apply seam, and reload → next context.
 *
 * Run: npx tsx scripts/verify-shared-organise.ts
 */
import assert from "node:assert/strict";
import { applyApprovedCaptureSuggestion } from "../src/lib/capture/apply/apply-approved";
import { memoryCaptureApplyHooks } from "../src/lib/capture/apply/memory-execute";
import { planCaptureApply } from "../src/lib/capture/apply/dispatch";
import { captureApplyWorldFromState } from "../src/lib/capture/apply/world";
import { buildReviewChangeViewModels } from "../src/lib/capture/review/viewModel";
import { buildSuggestions } from "../src/lib/capture/suggestions";
import { experimentalMissionState } from "../src/lib/eval-capture-v2/mission-state";
import { CANDYLAND_ID, experimentalApplyWorld } from "../src/lib/experiments/worlds";
import type { MissionState } from "../src/lib/types";
import { isSharedOrganiseEnabled } from "../src/lib/shared-organise/flag";
import { SHARED_ORGANISE_PROMPT_VERSION, buildProjectChangePrompt } from "../src/lib/shared-organise/prompt";
import { organiseNewProjectPacket } from "../src/lib/shared-organise/new-project";
import { runSharedOrganiseFromModelJson } from "../src/lib/shared-organise/run";
import { buildSharedOrganiseContext } from "../src/lib/shared-organise/context";
import { reviewProjectChangeForm, parseProjectChangeForm } from "../src/lib/shared-organise/validate";
import { shiftIsoDate } from "../src/lib/shared-organise/date";

const PROJECT = CANDYLAND_ID;
const REF = "2026-10-03";

function change(partial: Record<string, unknown>) {
  return {
    id: "chg-1",
    outcome: "ready",
    operation: "update_milestone",
    targetId: null,
    evidence: "",
    reason: null,
    materialUncertainty: [],
    values: {},
    ...partial,
  };
}

function organise(state: MissionState, transcript: string, raw: unknown) {
  const world = captureApplyWorldFromState(state);
  const run = runSharedOrganiseFromModelJson({
    transcript,
    rawModelJson: raw,
    world,
    projectId: PROJECT,
    referenceDate: REF,
  });
  const suggestions = buildSuggestions(run.result);
  const cards = buildReviewChangeViewModels(suggestions, run.result, transcript, {}, {
    world,
    captureEntryProjectId: PROJECT,
  });
  return { run, world, suggestions, cards };
}

async function applyReady(state: MissionState, transcript: string, raw: unknown) {
  const first = organise(state, transcript, raw);
  const ready = first.cards.filter((card) => card.readiness === "ready" && card.canApprove);
  let next = state;
  const writes = [];
  for (const card of ready) {
    const box = { state: structuredClone(next) };
    const applied = await applyApprovedCaptureSuggestion({
      item: card.suggestion,
      text: transcript,
      projectId: PROJECT,
      expectedTarget: card.suggestion.expectedTarget,
      loadWorkspace: async () => ({
        workspaceId: "ws-shared-organise",
        userId: "user-shared-organise",
        state: next,
      }),
      hooks: memoryCaptureApplyHooks(box),
      reloadWorkspace: async () => box.state,
    });
    assert.equal(applied.executed.kind, "wrote", card.suggestion.content);
    assert.ok(applied.state, "reload returned canonical state");
    next = applied.state!;
    writes.push(applied.decision);
  }
  return { ...first, ready, state: next, writes };
}

function form(changes: unknown[]) {
  return { changes };
}

let passed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn()).then(() => {
    passed += 1;
    console.log(`✓ ${name}`);
  });
}

async function main() {
  await check("flag defaults off", () => {
    assert.equal(isSharedOrganiseEnabled({}), false);
    assert.equal(isSharedOrganiseEnabled({ LUME_SHARED_ORGANISE: "1" }), true);
  });

  await check("material uncertainty cannot be Ready", () => {
    const state = experimentalMissionState();
    const transcript = "Sarah Kim, or maybe Sarah K, will own UAT.";
    const viewed = organise(
      state,
      transcript,
      form([
        change({
          operation: "confirm_responsibility",
          evidence: transcript,
          materialUncertainty: ["identity is explicitly hedged"],
          values: { personName: "Sarah Kim", scope: "UAT" },
        }),
      ]),
    );
    assert.equal(viewed.cards.filter((card) => card.canApprove).length, 0);
    const planned = planCaptureApply({
      item: viewed.suggestions[0]!,
      text: transcript,
      world: viewed.world,
      captureEntryProjectId: PROJECT,
    });
    assert.equal(planned.kind, "needs_you");
  });

  await check("maybe is not a deterministic keyword", () => {
    const state = experimentalMissionState();
    const transcript = "Sarah Kim, or maybe Sarah K, will own UAT.";
    const viewed = organise(
      state,
      transcript,
      form([
        change({
          operation: "confirm_responsibility",
          evidence: transcript,
          values: { personName: "Sarah Kim", scope: "UAT", ownershipSemantics: "share" },
        }),
      ]),
    );
    assert.ok(viewed.cards.some((card) => card.canApprove));
  });

  await check("unresolved direction is not calculated", () => {
    const state = experimentalMissionState();
    const transcript = "Move parade day back two weeks.";
    const viewed = organise(
      state,
      transcript,
      form([
        change({
          operation: "update_milestone",
          targetId: "ms-parade",
          evidence: transcript,
          values: {
            dateIntent: "move_relative",
            direction: "unresolved",
            amount: 2,
            unit: "weeks",
            date: "1999-01-01",
          },
        }),
      ]),
    );
    assert.ok(viewed.cards.every((card) => !card.canApprove));
    assert.equal(viewed.run.reviewed[0]?.operation, null);
  });

  await check("back does not choose the direction", () => {
    assert.equal(shiftIsoDate("2026-10-15", "later", 2, "weeks"), "2026-10-29");
    const state = experimentalMissionState();
    const transcript = "Move parade day back two weeks.";
    const later = organise(
      state,
      transcript,
      form([
        change({
          operation: "update_milestone",
          targetId: "ms-parade",
          evidence: transcript,
          values: { dateIntent: "move_relative", direction: "later", amount: 2, unit: "weeks", date: "1999-01-01" },
        }),
      ]),
    );
    const earlier = organise(
      state,
      transcript,
      form([
        change({
          operation: "update_milestone",
          targetId: "ms-parade",
          evidence: transcript,
          values: { dateIntent: "move_relative", direction: "earlier", amount: 2, unit: "weeks" },
        }),
      ]),
    );
    assert.equal(later.cards.find((card) => card.canApprove)?.suggestion.date?.slice(0, 10), "2026-10-29");
    assert.equal(earlier.cards.find((card) => card.canApprove)?.suggestion.date?.slice(0, 10), "2026-10-01");
  });

  await check("historical date does not write", async () => {
    const state = experimentalMissionState();
    const transcript = "Parade day was 1 September 2025.";
    const applied = await applyReady(
      state,
      transcript,
      form([
        change({
          outcome: "ready",
          operation: "update_milestone",
          targetId: "ms-parade",
          evidence: transcript,
          values: { dateIntent: "historical", date: "2025-09-01" },
        }),
      ]),
    );
    assert.equal(applied.ready.length, 0);
    assert.equal(
      captureApplyWorldFromState(applied.state).timeline.find((row) => row.id === "ms-parade")?.startAt?.slice(0, 10),
      "2026-10-15",
    );
  });

  await check("person, role, reload, next context", async () => {
    const transcript = "Sarah Kim has joined the project as QS.";
    const applied = await applyReady(
      experimentalMissionState(),
      transcript,
      form([
        change({
          operation: "ensure_person",
          evidence: transcript,
          values: { name: "Sarah Kim", roleHint: "QS" },
        }),
      ]),
    );
    const person = applied.state.projects
      .find((project) => project.id === PROJECT)
      ?.stakeholders.find((row) => row.name === "Sarah Kim");
    assert.ok(person);
    assert.equal(person?.role, "QS");
    const again = buildSharedOrganiseContext({
      world: captureApplyWorldFromState(applied.state),
      projectId: PROJECT,
      referenceDate: REF,
    });
    assert.match(again.prompt, /Sarah Kim/);
    assert.match(again.prompt, /QS/);
    assert.equal(again.people.some((row) => row.id === person!.id), true);
  });

  await check("existing role edit stays Needs You", async () => {
    const transcript = "Pippa Gumdrop is the QS.";
    const applied = await applyReady(
      experimentalMissionState(),
      transcript,
      form([
        change({
          operation: "ensure_person",
          evidence: transcript,
          values: { name: "Pippa Gumdrop", roleHint: "QS" },
        }),
      ]),
    );
    assert.equal(applied.ready.length, 0);
    const pippa = applied.state.projects
      .find((project) => project.id === PROJECT)
      ?.stakeholders.find((row) => row.name === "Pippa Gumdrop");
    assert.equal(pippa?.role, "UAT lead");
  });

  await check("responsibility round trip then share", async () => {
    const joined = await applyReady(
      experimentalMissionState(),
      "Sarah Kim has joined the project.",
      form([
        change({
          operation: "ensure_person",
          evidence: "Sarah Kim has joined the project.",
          values: { name: "Sarah Kim", roleHint: "QA lead" },
        }),
      ]),
    );
    const owns = "Sarah Kim owns UAT.";
    const first = await applyReady(
      joined.state,
      owns,
      form([
        change({
          operation: "confirm_responsibility",
          evidence: owns,
          values: { personName: "Sarah Kim", scope: "UAT", ownershipSemantics: "share" },
        }),
      ]),
    );
    const context = buildSharedOrganiseContext({
      world: captureApplyWorldFromState(first.state),
      projectId: PROJECT,
      referenceDate: REF,
    });
    assert.ok(context.responsibilities.some((row) => row.personName === "Sarah Kim" && row.scope === "UAT"));
    const share = "James Murphy and Sarah Kim share UAT.";
    const shared = await applyReady(
      first.state,
      share,
      form([
        change({
          operation: "ensure_person",
          evidence: "James Murphy and Sarah Kim share UAT.",
          values: { name: "James Murphy" },
        }),
        change({
          id: "chg-2",
          operation: "confirm_responsibility",
          evidence: share,
          values: {
            personName: "James Murphy",
            scope: "UAT",
            ownershipSemantics: "share",
          },
        }),
      ]),
    );
    const owners = buildSharedOrganiseContext({
      world: captureApplyWorldFromState(shared.state),
      projectId: PROJECT,
      referenceDate: REF,
    }).responsibilities.filter((row) => row.scope === "UAT" && row.ownerConfirmed);
    assert.ok(owners.some((row) => row.personName === "Sarah Kim"));
    assert.ok(owners.some((row) => row.personName === "James Murphy"));
  });

  await check("responsibility replace supersedes the named owner", async () => {
    const transcript = "James Murphy replaces Pippa Gumdrop as UAT lead.";
    const replaced = await applyReady(
      experimentalMissionState(),
      transcript,
      form([
        change({
          operation: "ensure_person",
          evidence: transcript,
          values: { name: "James Murphy" },
        }),
        change({
          id: "chg-2",
          operation: "confirm_responsibility",
          evidence: transcript,
          values: {
            personName: "James Murphy",
            scope: "UAT lead",
            ownershipSemantics: "replace",
          },
        }),
      ]),
    );
    const owners = buildSharedOrganiseContext({
      world: captureApplyWorldFromState(replaced.state),
      projectId: PROJECT,
      referenceDate: REF,
    }).responsibilities.filter((row) => row.scope === "UAT lead" && row.ownerConfirmed);
    assert.deepEqual(
      owners.map((row) => row.personName),
      ["James Murphy"],
    );
  });

  await check("to do create complete reload", async () => {
    const created = await applyReady(
      experimentalMissionState(),
      "Someone needs to sort the fire cert.",
      form([
        change({
          operation: "create_todo",
          evidence: "Someone needs to sort the fire cert.",
          values: { title: "Sort the fire cert" },
        }),
        change({
          id: "chg-2",
          operation: "ensure_person",
          evidence: "Someone needs to sort the fire cert.",
          values: { name: "Someone" },
        }),
      ]),
    );
    assert.equal(
      created.state.projects.find((project) => project.id === PROJECT)?.stakeholders.some((row) => row.name === "Someone"),
      false,
    );
    const todo = created.state.todos.find((row) => row.title === "Sort the fire cert");
    assert.ok(todo);
    assert.equal(todo?.done, false);
    const completed = await applyReady(
      created.state,
      "Sort the fire cert is done.",
      form([
        change({
          operation: "complete_todo",
          targetId: todo!.id,
          evidence: "Sort the fire cert is done.",
          values: {},
        }),
      ]),
    );
    assert.equal(completed.state.todos.find((row) => row.id === todo!.id)?.done, true);
    const seen = buildSharedOrganiseContext({
      world: captureApplyWorldFromState(completed.state),
      projectId: PROJECT,
      referenceDate: REF,
    });
    assert.match(seen.prompt, /Sort the fire cert/);
    assert.match(seen.prompt, /done=true/);
  });

  await check("risk create then close", async () => {
    const created = await applyReady(
      experimentalMissionState(),
      "Raise a risk called Fire certificate delay.",
      form([
        change({
          operation: "create_risk",
          evidence: "Raise a risk called Fire certificate delay.",
          values: { title: "Fire certificate delay" },
        }),
      ]),
    );
    const risk = (created.state.risks ?? []).find((row) => row.title === "Fire certificate delay");
    assert.ok(risk);
    const closed = await applyReady(
      created.state,
      "Fire certificate delay is resolved.",
      form([
        change({
          operation: "update_risk_status",
          targetId: risk!.id,
          evidence: "Fire certificate delay is resolved.",
          values: { status: "resolved" },
        }),
      ]),
    );
    assert.equal((closed.state.risks ?? []).find((row) => row.id === risk!.id)?.status, "resolved");
  });

  await check("explicit milestone date reloads", async () => {
    const transcript = "Parade day is 18 December 2026.";
    const applied = await applyReady(
      experimentalMissionState(),
      transcript,
      form([
        change({
          operation: "update_milestone",
          targetId: "ms-parade",
          evidence: transcript,
          values: { dateIntent: "set_explicit", date: "2026-12-18" },
        }),
      ]),
    );
    assert.equal(
      applied.state.timeline.find((row) => row.id === "ms-parade")?.startAt.slice(0, 10),
      "2026-12-18",
    );
  });

  await check("clear relative date is deterministic", async () => {
    const transcript = "Make parade day two weeks later.";
    const applied = await applyReady(
      experimentalMissionState(),
      transcript,
      form([
        change({
          operation: "update_milestone",
          targetId: "ms-parade",
          evidence: transcript,
          values: { dateIntent: "move_relative", direction: "later", amount: 2, unit: "weeks" },
        }),
      ]),
    );
    assert.equal(
      applied.state.timeline.find((row) => row.id === "ms-parade")?.startAt.slice(0, 10),
      "2026-10-29",
    );
  });

  await check("availability knowledge and decision reload", async () => {
    const joined = await applyReady(
      experimentalMissionState(),
      "Sarah Kim has joined the project.",
      form([
        change({
          operation: "ensure_person",
          evidence: "Sarah Kim has joined the project.",
          values: { name: "Sarah Kim" },
        }),
      ]),
    );
    const person = joined.state.projects
      .find((project) => project.id === PROJECT)!
      .stakeholders.find((row) => row.name === "Sarah Kim")!;
    const wrote = await applyReady(
      joined.state,
      "Sarah Kim is away from 1 November 2026 to 5 November 2026. The client prefers oak for the reception desk. We decided to keep the existing stairs.",
      form([
        change({
          operation: "write_availability",
          evidence: "Sarah Kim is away from 1 November 2026 to 5 November 2026.",
          values: {
            personName: "Sarah Kim",
            personId: person.id,
            awayFromIso: "2026-11-01",
            awayToIso: "2026-11-05",
          },
        }),
        change({
          id: "chg-2",
          operation: "write_knowledge",
          evidence: "The client prefers oak for the reception desk.",
          values: { text: "The client prefers oak for the reception desk.", section: "now" },
        }),
        change({
          id: "chg-3",
          operation: "write_knowledge",
          evidence: "We decided to keep the existing stairs.",
          values: { text: "We decided to keep the existing stairs.", section: "decisions" },
        }),
      ]),
    );
    const knowledge = wrote.state.knowledge.find((row) => row.projectId === PROJECT);
    assert.ok(
      (knowledge?.structured ?? []).some(
        (row) => row.kind === "availability" && row.meta?.availability?.personId === person.id,
      ),
    );
    assert.ok((knowledge?.sections.now ?? []).some((line) => line.includes("oak")));
    assert.ok((knowledge?.sections.decisions ?? []).some((line) => line.includes("stairs")));
    const seen = buildSharedOrganiseContext({
      world: captureApplyWorldFromState(wrote.state),
      projectId: PROJECT,
      referenceDate: REF,
    });
    assert.match(seen.prompt, /oak/);
    assert.match(seen.prompt, /stairs/);
  });

  await check("foreign id and generic person do not write", async () => {
    const applied = await applyReady(
      experimentalMissionState(),
      "Mark risk-console resolved. Someone needs to sort the fire cert.",
      form([
        change({
          operation: "update_risk_status",
          targetId: "risk-console",
          evidence: "Mark risk-console resolved.",
          values: { status: "resolved" },
        }),
      ]),
    );
    assert.equal(applied.ready.length, 0);
    assert.equal(
      (applied.state.risks ?? []).find((row) => row.id === "risk-console")?.status,
      "open",
    );
  });

  await check("stale target is rejected", async () => {
    const state = experimentalMissionState();
    const transcript = "Prepare the jelly pack is done.";
    const viewed = organise(
      state,
      transcript,
      form([
        change({
          operation: "complete_todo",
          targetId: "todo-pack",
          evidence: transcript,
          values: {},
        }),
      ]),
    );
    const card = viewed.cards.find((row) => row.canApprove);
    assert.ok(card);
    const stale = structuredClone(state);
    const todo = stale.todos.find((row) => row.id === "todo-pack");
    assert.ok(todo);
    todo.title = "Prepare the jelly pack later";
    const applied = await applyApprovedCaptureSuggestion({
      item: card!.suggestion,
      text: transcript,
      projectId: PROJECT,
      expectedTarget: card!.suggestion.expectedTarget,
      loadWorkspace: async () => ({
        workspaceId: "ws-shared-organise",
        userId: "user-shared-organise",
        state: stale,
      }),
      hooks: memoryCaptureApplyHooks({ state: structuredClone(stale) }),
      reloadWorkspace: async () => stale,
    });
    assert.notEqual(applied.executed.kind, "wrote");
    assert.equal(stale.todos.find((row) => row.id === "todo-pack")?.done, false);
  });

  await check("replayed create does not duplicate", async () => {
    const transcript = "Add a to-do called Chase the fire cert.";
    const raw = form([
      change({
        operation: "create_todo",
        evidence: transcript,
        values: { title: "Chase the fire cert" },
      }),
    ]);
    const first = await applyReady(experimentalMissionState(), transcript, raw);
    const second = await applyReady(first.state, transcript, raw);
    assert.equal(second.state.todos.filter((row) => row.title === "Chase the fire cert").length, 1);
  });

  await check("new project adapter is the same engine", () => {
    const world = experimentalApplyWorld();
    const collated = "Sarah Kim is the QS and handles valuations. Someone needs to sort the fire cert.";
    const run = organiseNewProjectPacket(
      {
        name: "Riverside House",
        code: "RIV",
        collated,
        projectId: PROJECT,
        world,
        referenceDate: REF,
      },
      form([
        change({
          operation: "ensure_person",
          evidence: "Sarah Kim is the QS and handles valuations.",
          values: { name: "Sarah Kim", roleHint: "QS" },
        }),
        change({
          id: "chg-2",
          operation: "confirm_responsibility",
          evidence: "Sarah Kim is the QS and handles valuations.",
          values: { personName: "Sarah Kim", scope: "valuations", ownershipSemantics: "share" },
        }),
        change({
          id: "chg-3",
          operation: "create_todo",
          evidence: "Someone needs to sort the fire cert.",
          values: { title: "Sort the fire cert" },
        }),
        change({
          id: "chg-4",
          operation: "ensure_person",
          evidence: "Someone needs to sort the fire cert.",
          materialUncertainty: ["owner is generic"],
          values: { name: "Someone" },
        }),
      ]),
    );
    assert.equal(run.reviewed.filter((row) => row.label === "Ready").length, 3);
    assert.equal(run.reviewed.filter((row) => row.operation?.type === "ensure_person").length, 1);
    assert.match(buildProjectChangePrompt({ source: collated, projectBlock: run.projectBlock }), /materialUncertainty/);
    assert.equal(SHARED_ORGANISE_PROMPT_VERSION, "shared-organise-form-v4");
    const parsed = parseProjectChangeForm(form([]));
    assert.deepEqual(
      reviewProjectChangeForm({
        form: parsed,
        context: buildSharedOrganiseContext({ world, projectId: PROJECT, referenceDate: REF }),
        source: collated,
      }),
      [],
    );
  });

  await check("safety contracts stay fail-closed", () => {
    const sarahWorld = experimentalApplyWorld();
    const state = experimentalMissionState(sarahWorld);
    const cases: Array<{ name: string; transcript: string; raw: unknown; forbid: (view: ReturnType<typeof organise>) => void }> = [
      {
        name: "context-only id",
        transcript: "Update responsibility resp-uat so Fizz Caramel owns it.",
        raw: form([
          change({
            operation: "confirm_responsibility",
            targetId: "resp-uat",
            evidence: "Update responsibility resp-uat so Fizz Caramel owns it.",
            values: { personName: "Fizz Caramel", personId: "resp-uat", scope: "UAT lead" },
          }),
        ]),
        forbid: (view) => assert.ok(view.cards.every((card) => !card.canApprove)),
      },
      {
        name: "knowledge authority",
        transcript: "Add a knowledge note that Helen can sign the variation.",
        raw: form([
          change({
            operation: "write_knowledge",
            evidence: "Helen can sign the variation.",
            values: { text: "Helen can sign the variation.", section: "now" },
          }),
        ]),
        forbid: (view) => assert.ok(view.cards.every((card) => !card.canApprove)),
      },
      {
        name: "delete without an explicit remove",
        transcript: "The jelly pack is a nightmare.",
        raw: form([
          change({
            operation: "delete_todo",
            targetId: "todo-pack",
            evidence: "The jelly pack is a nightmare.",
            values: {},
          }),
        ]),
        forbid: (view) => assert.ok(view.cards.every((card) => !card.canApprove)),
      },
      {
        name: "missing milestone baseline",
        transcript: "Push parade day back two weeks.",
        raw: form([
          change({
            operation: "update_milestone",
            targetId: "ms-parade",
            evidence: "Push parade day back two weeks.",
            values: { dateIntent: "move_relative", direction: "later", amount: 2, unit: "weeks", date: "2026-10-29" },
          }),
        ]),
        forbid: (view) => assert.ok(view.cards.every((card) => !card.canApprove)),
      },
    ];
    const undated = experimentalMissionState();
    const parade = undated.timeline.find((row) => row.id === "ms-parade");
    assert.ok(parade);
    parade.startAt = "";
    for (const row of cases) {
      const source = row.name === "missing milestone baseline" ? undated : state;
      row.forbid(organise(source, row.transcript, row.raw));
    }
  });

  console.log(`shared-organise verify: ${passed} checks`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
