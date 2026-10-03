/**
 * Deterministic checks of the experiment validator. No model calls.
 */
import assert from "node:assert/strict";
import { experimentalApplyWorld, CANDYLAND_ID } from "@/lib/experiments/worlds";
import { buildSharedOrganiseContext } from "./context";
import { shiftIsoDate } from "./date";
import type { ProjectChange } from "./form";
import { reviewProjectChangeForm } from "./validate";

function change(partial: Partial<ProjectChange> & Pick<ProjectChange, "operation" | "evidence">): ProjectChange {
  return {
    id: "chg-1",
    outcome: "ready",
    targetId: null,
    reason: null,
    values: {},
    ...partial,
  };
}

export function runSharedOrganiseSelfCheck(): void {
  const candy = buildSharedOrganiseContext({
    world: experimentalApplyWorld(),
    projectId: CANDYLAND_ID,
  });
  const sarahWorld = {
    projectIds: new Set(["proj-sarah"]),
    projects: [
      {
        id: "proj-sarah",
        name: "UAT trial",
        code: "UAT",
        stakeholders: [{ id: "person-sarah-kim", name: "Sarah Kim", role: "QA lead" }],
      },
    ],
    risks: [],
    todos: [],
    timeline: [],
    knowledge: [
      {
        projectId: "proj-sarah",
        sections: {},
        structured: [
          {
            id: "resp-1",
            kind: "responsibility",
            lifecycle: "current",
            body: "James Murphy — UAT",
            meta: {
              responsibility: {
                personId: "person-james",
                personName: "James Murphy",
                scope: "UAT",
                ownerConfirmed: true,
              },
            },
          },
        ],
      },
    ],
  };
  const sarah = buildSharedOrganiseContext({
    world: sarahWorld,
    projectId: "proj-sarah",
  });
  assert.equal(sarah.contextOnlyIds.has("resp-1"), true);
  assert.equal(sarah.targetable.has("resp-1"), false);
  assert.ok(sarah.prompt.includes("NEVER return contextOnlyId as targetId"));

  const allowedSibling = reviewProjectChangeForm({
    context: candy,
    source:
      "Resolve the Console certification slip risk. Pixel Ramos should own UAT. Helen can sign the variation for the extra containment. Pixel Ramos is not on this project.",
    form: {
      changes: [
        change({
          operation: "create_risk",
          evidence: "Resolve the Console certification slip risk.",
          values: { title: "Console certification slip" },
        }),
        change({
          id: "chg-2",
          operation: "ensure_person",
          evidence: "Pixel Ramos should own UAT.",
          values: { name: "Pixel Ramos", roleHint: "Producer" },
        }),
        change({
          id: "chg-3",
          operation: "write_knowledge",
          evidence: "Helen can sign the variation for the extra containment.",
          values: { text: "Helen can sign the variation for the extra containment." },
        }),
        change({
          id: "chg-4",
          operation: "ensure_person",
          evidence: "Pixel Ramos is not on this project.",
          values: { name: "Pixel Ramos" },
        }),
        change({
          id: "chg-5",
          operation: "update_risk_status",
          targetId: "risk-console",
          evidence: "Resolve the Console certification slip risk.",
          values: { status: "resolved" },
        }),
      ],
    },
  });
  assert.equal(allowedSibling[0]?.label, "Ready");
  assert.equal(allowedSibling[0]?.safety.includes("cross_project_create"), false);
  assert.equal(allowedSibling[1]?.label, "Ready");
  assert.equal(allowedSibling[1]?.operation?.type, "ensure_person");
  assert.equal(allowedSibling[2]?.label, "Needs You");
  assert.ok(allowedSibling[2]?.safety.includes("knowledge_bypass"));
  assert.equal(allowedSibling[3]?.label, "No change");
  assert.ok(allowedSibling[3]?.safety.includes("not_on_this_project"));
  assert.equal(allowedSibling[4]?.label, "Needs You");
  assert.ok(allowedSibling[4]?.safety.includes("invented_stable_id"));

  const generic = reviewProjectChangeForm({
    context: candy,
    source: "Someone needs to sort the fire cert. One of the engineers should look later.",
    form: {
      changes: [
        change({
          operation: "ensure_person",
          evidence: "Someone needs to sort the fire cert.",
          values: { name: "Someone" },
        }),
        change({
          id: "chg-2",
          operation: "create_todo",
          evidence: "Someone needs to sort the fire cert.",
          values: { title: "Sort the fire cert" },
        }),
        change({
          id: "chg-3",
          operation: "confirm_responsibility",
          evidence: "One of the engineers should look later.",
          values: { personName: "one of the engineers", scope: "look later" },
        }),
      ],
    },
  });
  assert.equal(generic[0]?.label, "Needs You");
  assert.ok(generic[0]?.safety.includes("unresolved_person"));
  assert.equal(generic[0]?.operation, null);
  assert.equal(generic[1]?.label, "Ready");
  assert.equal(generic[1]?.operation?.type, "create_todo");
  assert.equal(generic[2]?.label, "Needs You");
  assert.ok(generic[2]?.safety.includes("unresolved_person"));

  const roleChange = reviewProjectChangeForm({
    context: sarah,
    source: "Sarah Kim is the QS and handles valuations.",
    form: {
      changes: [
        change({
          operation: "ensure_person",
          evidence: "Sarah Kim is the QS and handles valuations.",
          values: { name: "Sarah Kim", roleHint: "QS" },
        }),
        change({
          id: "chg-2",
          operation: "confirm_responsibility",
          evidence: "Sarah Kim is the QS and handles valuations.",
          values: {
            personName: "Sarah Kim",
            personId: "person-sarah-kim",
            scope: "valuations",
            ownershipSemantics: "ambiguous",
          },
        }),
      ],
    },
  });
  assert.equal(roleChange[0]?.label, "Needs You");
  assert.ok(roleChange[0]?.safety.includes("role_update_unsupported"));
  assert.equal(roleChange[0]?.operation, null);
  assert.equal(roleChange[1]?.label, "Ready");
  assert.equal(roleChange[1]?.operation?.type, "confirm_responsibility");

  const sarahK = reviewProjectChangeForm({
    context: sarah,
    source: "Sarah K will own UAT.",
    form: {
      changes: [
        change({
          operation: "confirm_responsibility",
          targetId: "person-sarah-kim",
          evidence: "Sarah K will own UAT.",
          values: {
            personName: "Sarah K",
            personId: "person-sarah-kim",
            scope: "UAT",
            ownershipSemantics: "replace",
          },
        }),
      ],
    },
  });
  assert.equal(sarahK[0]?.label, "Needs You");
  assert.equal(sarahK[0]?.operation, null);

  const contextId = reviewProjectChangeForm({
    context: sarah,
    source: "Sarah Kim is taking over UAT from James Murphy.",
    form: {
      changes: [
        change({
          operation: "confirm_responsibility",
          targetId: "resp-1",
          evidence: "Sarah Kim is taking over UAT from James Murphy.",
          values: {
            personName: "Sarah Kim",
            scope: "UAT",
            ownershipSemantics: "replace",
            replacePersonName: "James Murphy",
          },
        }),
      ],
    },
  });
  assert.ok(contextId[0]?.safety.includes("context_only_id"));
  assert.equal(contextId[0]?.label, "Needs You");
  assert.match(contextId[0]?.reason ?? "", /current owner/);

  const unresolved = reviewProjectChangeForm({
    context: candy,
    source: "Brick from the warehouse called; he wants to help with assembly.",
    form: {
      changes: [
        change({
          outcome: "needs_you",
          operation: "none",
          evidence: "Brick from the warehouse called; he wants to help with assembly.",
          reason: "The input does not safely identify whether Brick is Brick Oakley.",
        }),
      ],
    },
  });
  assert.equal(unresolved[0]?.label, "Needs You");

  const dated = buildSharedOrganiseContext({
    world: {
      projectIds: new Set(["proj-date"]),
      projects: [{ id: "proj-date", name: "Date trial", code: "DATE", stakeholders: [] }],
      risks: [],
      todos: [],
      timeline: [
        { id: "ms-pc", projectId: "proj-date", label: "Practical completion", startAt: "2026-12-12" },
      ],
      knowledge: [],
    },
    projectId: "proj-date",
  });
  const undated = buildSharedOrganiseContext({
    world: {
      projectIds: new Set(["proj-date"]),
      projects: [{ id: "proj-date", name: "Date trial", code: "DATE", stakeholders: [] }],
      risks: [],
      todos: [],
      timeline: [{ id: "ms-pc", projectId: "proj-date", label: "Practical completion" }],
      knowledge: [],
    },
    projectId: "proj-date",
  });

  const explicit = reviewProjectChangeForm({
    context: dated,
    source: "Practical completion is 18 December 2026.",
    form: {
      changes: [
        change({
          operation: "update_milestone",
          targetId: "ms-pc",
          evidence: "Practical completion is 18 December 2026.",
          values: { dateIntent: "set_explicit", date: "2026-12-18" },
        }),
      ],
    },
  });
  assert.equal(explicit[0]?.label, "Ready");
  assert.equal(explicit[0]?.operation && "startAt" in explicit[0].operation ? explicit[0].operation.startAt : "", "2026-12-18");

  const yearless = reviewProjectChangeForm({
    context: dated,
    source: "Practical completion has moved to 18 December.",
    form: {
      changes: [
        change({
          operation: "update_milestone",
          targetId: "ms-pc",
          evidence: "Practical completion has moved to 18 December.",
          values: { dateIntent: "set_explicit", date: "2026-12-18" },
        }),
        change({
          id: "chg-2",
          operation: "update_milestone",
          targetId: "ms-pc",
          evidence: "Practical completion has moved to 18 December.",
          values: { dateIntent: "set_explicit", date: "2025-12-18" },
        }),
      ],
    },
  });
  assert.equal(yearless[0]?.label, "Ready");
  assert.equal(yearless[1]?.label, "Needs You");

  const historical = reviewProjectChangeForm({
    context: dated,
    source: "Practical completion was 1 September 2025.",
    form: {
      changes: [
        change({
          operation: "update_milestone",
          targetId: "ms-pc",
          evidence: "Practical completion was 1 September 2025.",
          values: { dateIntent: "historical", date: "2025-09-01" },
        }),
      ],
    },
  });
  assert.equal(historical[0]?.label, "No change");
  assert.equal(historical[0]?.operation, null);

  const bareIso = reviewProjectChangeForm({
    context: dated,
    source: "Practical completion was 1 September 2025.",
    form: {
      changes: [
        change({
          operation: "update_milestone",
          targetId: "ms-pc",
          evidence: "Practical completion was 1 September 2025.",
          values: { date: "2025-09-01" },
        }),
      ],
    },
  });
  assert.equal(bareIso[0]?.label, "Needs You");

  assert.equal(shiftIsoDate("2026-12-12", "later", 2, "weeks"), "2026-12-26");
  assert.equal(shiftIsoDate("2026-12-12", "earlier", 2, "weeks"), "2026-11-28");
  const relative = reviewProjectChangeForm({
    context: dated,
    source: "Move practical completion back two weeks.",
    form: {
      changes: [
        change({
          operation: "update_milestone",
          targetId: "ms-pc",
          evidence: "Move practical completion back two weeks.",
          values: { dateIntent: "move_relative", direction: "later", amount: 2, unit: "weeks", date: "1999-01-01" },
        }),
        change({
          id: "chg-2",
          operation: "update_milestone",
          targetId: "ms-pc",
          evidence: "Move practical completion back two weeks.",
          values: { dateIntent: "move_relative", direction: "earlier", amount: 2, unit: "weeks" },
        }),
      ],
    },
  });
  assert.equal(relative[0]?.label, "Ready");
  assert.equal(relative[0]?.operation && "startAt" in relative[0].operation ? relative[0].operation.startAt : "", "2026-12-26");
  assert.equal(relative[1]?.label, "Ready");
  assert.equal(relative[1]?.operation && "startAt" in relative[1].operation ? relative[1].operation.startAt : "", "2026-11-28");

  const noBaseline = reviewProjectChangeForm({
    context: undated,
    source: "Push practical completion back two weeks.",
    form: {
      changes: [
        change({
          operation: "update_milestone",
          targetId: "ms-pc",
          evidence: "Push practical completion back two weeks.",
          values: { dateIntent: "move_relative", direction: "later", amount: 2, unit: "weeks", date: "2026-12-26" },
        }),
      ],
    },
  });
  assert.equal(noBaseline[0]?.label, "Needs You");
  assert.equal(noBaseline[0]?.operation, null);

  console.log("shared-organise self-check: OK");
}
