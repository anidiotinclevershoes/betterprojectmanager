/**
 * Deterministic checks of the experiment validator. No model calls.
 */
import assert from "node:assert/strict";
import { experimentalApplyWorld, CANDYLAND_ID } from "@/lib/experiments/worlds";
import { buildSharedOrganiseContext } from "./context";
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

  const blocked = reviewProjectChangeForm({
    context: candy,
    source:
      "Resolve the Console certification slip risk. Pixel Ramos should own UAT. Helen can sign the variation for the extra containment.",
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
          values: { name: "Pixel Ramos" },
        }),
        change({
          id: "chg-3",
          operation: "write_knowledge",
          evidence: "Helen can sign the variation for the extra containment.",
          values: { text: "Helen can sign the variation for the extra containment." },
        }),
      ],
    },
  });
  assert.equal(blocked[0]?.label, "Needs You");
  assert.ok(blocked[0]?.safety.includes("cross_project_create"));
  assert.equal(blocked[1]?.label, "Needs You");
  assert.ok(blocked[1]?.safety.includes("cross_project_create"));
  assert.equal(blocked[2]?.label, "Needs You");
  assert.ok(blocked[2]?.safety.includes("knowledge_bypass"));

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

  console.log("shared-organise self-check: OK");
}
