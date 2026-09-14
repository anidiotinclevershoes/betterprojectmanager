/**
 * Deterministic Gate 2 boundary fixtures. No model. No semantic repair checks.
 */
import { experimentalApplyWorld } from "@/lib/experiments/worlds";
import type { Gate1V2Item, Gate1V2ProposedValues } from "@/lib/experiments/ai-first-capture-gate1-v2/types";
import {
  GATE2_UNSUPPORTED_REASON,
  applyLegalWriteBoundary,
} from "./legal-boundary";

function emptyValues(): Gate1V2ProposedValues {
  return {
    name: null,
    personName: null,
    title: null,
    date: null,
    status: null,
    scope: null,
    ownershipSemantics: null,
    text: null,
    awayFromIso: null,
    awayToIso: null,
  };
}

function item(partial: Partial<Gate1V2Item> & Pick<Gate1V2Item, "operation" | "domain" | "subject">): Gate1V2Item {
  return {
    targetCanonicalId: null,
    proposedValues: emptyValues(),
    evidence: partial.subject,
    understood: partial.subject,
    question: null,
    leftUntouchedReason: null,
    ...partial,
  };
}

export function runLegalBoundaryFixtures(): { ok: boolean; failures: string[] } {
  const world = experimentalApplyWorld();
  const failures: string[] = [];

  const check = (name: string, ok: boolean, detail = "") => {
    if (!ok) failures.push(detail ? `${name}: ${detail}` : name);
  };

  const removeMilestone = item({
    operation: "remove",
    domain: "milestone",
    targetCanonicalId: "ms-parade",
    subject: "Please delete Parade day",
    evidence: "Please delete Parade day",
  });
  const blocked = applyLegalWriteBoundary([removeMilestone], world, "proj-candy");
  check(
    "milestone-remove-blocked",
    blocked.items[0].operation === "left_untouched" &&
      blocked.items[0].leftUntouchedReason === GATE2_UNSUPPORTED_REASON &&
      blocked.items[0].targetCanonicalId === "ms-parade" &&
      blocked.items[0].domain === "milestone" &&
      blocked.items[0].subject === "Please delete Parade day" &&
      blocked.traces[0].intercepted === true &&
      blocked.traces[0].applySupports === false,
    JSON.stringify(blocked.items[0]),
  );

  const updateMilestone = item({
    operation: "update",
    domain: "milestone",
    targetCanonicalId: "ms-parade",
    subject: "Parade day",
    proposedValues: { ...emptyValues(), date: "2026-10-29" },
  });
  const keptDate = applyLegalWriteBoundary([updateMilestone], world, "proj-candy");
  check(
    "milestone-update-preserved",
    keptDate.items[0] === updateMilestone && keptDate.traces[0].intercepted === false,
  );

  const removeTodo = item({
    operation: "remove",
    domain: "todo",
    targetCanonicalId: "todo-pack",
    subject: "Prepare the jelly pack",
  });
  const keptTodo = applyLegalWriteBoundary([removeTodo], world, "proj-candy");
  check(
    "todo-remove-preserved",
    keptTodo.items[0] === removeTodo &&
      keptTodo.traces[0].applySupports === true &&
      keptTodo.traces[0].intercepted === false,
  );

  const updateResp = item({
    operation: "update",
    domain: "responsibility",
    targetCanonicalId: "resp-uat",
    subject: "Pippa still UAT",
  });
  const keptResp = applyLegalWriteBoundary([updateResp], world, "proj-candy");
  check(
    "responsibility-update-not-rewritten",
    keptResp.items[0] === updateResp && keptResp.traces[0].intercepted === false,
    "restatement residual must remain an update",
  );

  const createPerson = item({
    operation: "create",
    domain: "person",
    subject: "Velvet Sprocket",
    proposedValues: { ...emptyValues(), name: "Velvet Sprocket" },
  });
  const keptCreate = applyLegalWriteBoundary([createPerson], world, "proj-toy");
  check("person-create-preserved", keptCreate.items[0] === createPerson);

  const updatePerson = item({
    operation: "update",
    domain: "person",
    targetCanonicalId: "person-gumdrop",
    subject: "Rename Pippa",
  });
  const blockedPerson = applyLegalWriteBoundary([updatePerson], world, "proj-candy");
  check(
    "person-update-blocked",
    blockedPerson.items[0].operation === "left_untouched" &&
      blockedPerson.traces[0].applySupports === false,
  );

  const removeRisk = item({
    operation: "remove",
    domain: "risk",
    targetCanonicalId: "risk-packaging",
    subject: "Delete packaging delay",
  });
  const blockedRisk = applyLegalWriteBoundary([removeRisk], world, "proj-toy");
  check(
    "risk-remove-blocked",
    blockedRisk.items[0].operation === "left_untouched" &&
      blockedRisk.traces[0].applySupports === false,
  );

  const createKnowledge = item({
    operation: "create",
    domain: "knowledge",
    subject: "Water-based paint",
  });
  const keptKnow = applyLegalWriteBoundary([createKnowledge], world, "proj-toy");
  check("knowledge-create-preserved", keptKnow.items[0] === createKnowledge);

  const needsYou = item({
    operation: "needs_you",
    domain: "person",
    subject: "Who is she?",
    question: "Who is she?",
  });
  const keptNy = applyLegalWriteBoundary([needsYou], world, "proj-game");
  check("needs-you-untouched", keptNy.items[0] === needsYou && keptNy.traces[0].intercepted === false);

  const noChange = item({
    operation: "no_change",
    domain: "responsibility",
    targetCanonicalId: "resp-uat",
    subject: "Pippa still UAT",
  });
  const keptNc = applyLegalWriteBoundary([noChange], world, "proj-candy");
  check("no-change-untouched", keptNc.items[0] === noChange);

  return { ok: failures.length === 0, failures };
}
