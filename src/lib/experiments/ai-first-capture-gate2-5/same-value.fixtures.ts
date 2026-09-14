/**
 * Deterministic Gate 2.5 fixtures. No model.
 */
import { experimentalApplyWorld } from "@/lib/experiments/worlds";
import type { Gate1V2Item, Gate1V2ProposedValues } from "@/lib/experiments/ai-first-capture-gate1-v2/types";
import { runLegalBoundaryFixtures } from "@/lib/experiments/ai-first-capture-gate2/legal-boundary.fixtures";
import { applyGate25DeterministicPath } from "./apply-path";
import { serializeCurrentCanonicalTruth } from "./snapshot";

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

function item(
  partial: Partial<Gate1V2Item> & Pick<Gate1V2Item, "operation" | "domain" | "subject">,
): Gate1V2Item {
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

export function runGate25Fixtures(): { ok: boolean; failures: string[] } {
  const legal = runLegalBoundaryFixtures();
  const failures = [...legal.failures];
  const world = experimentalApplyWorld();
  const check = (name: string, ok: boolean, detail = "") => {
    if (!ok) failures.push(detail ? `${name}: ${detail}` : name);
  };

  const exactResp = item({
    operation: "update",
    domain: "responsibility",
    targetCanonicalId: "resp-uat",
    subject: "Pippa UAT",
    proposedValues: { ...emptyValues(), personName: "Pippa Gumdrop", scope: "UAT lead" },
  });
  const exact = applyGate25DeterministicPath([exactResp], world, "proj-candy");
  check(
    "exact-responsibility-no-change",
    exact.items[0].operation === "no_change" && exact.traces[0].sameValueConverted === true,
    JSON.stringify(exact.items[0].operation),
  );

  const expandedScope = item({
    operation: "update",
    domain: "responsibility",
    targetCanonicalId: "resp-uat",
    subject: "Pippa UAT licorice",
    proposedValues: {
      ...emptyValues(),
      personName: "Pippa Gumdrop",
      scope: "UAT lead for the licorice stands",
    },
  });
  const expanded = applyGate25DeterministicPath([expandedScope], world, "proj-candy");
  check(
    "expanded-scope-stays-update",
    expanded.items[0].operation === "update" && expanded.traces[0].sameValueConverted === false,
    expanded.items[0].operation,
  );

  const sameDate = item({
    operation: "update",
    domain: "milestone",
    targetCanonicalId: "ms-parade",
    subject: "Parade day",
    proposedValues: { ...emptyValues(), date: "2026-10-15" },
  });
  const sameMs = applyGate25DeterministicPath([sameDate], world, "proj-candy");
  check("same-milestone-date-no-change", sameMs.items[0].operation === "no_change");

  const newDate = item({
    operation: "update",
    domain: "milestone",
    targetCanonicalId: "ms-parade",
    subject: "Parade day",
    proposedValues: { ...emptyValues(), date: "2026-10-29" },
  });
  const moved = applyGate25DeterministicPath([newDate], world, "proj-candy");
  check("different-date-stays-update", moved.items[0].operation === "update");

  const todoDone = item({
    operation: "update",
    domain: "todo",
    targetCanonicalId: "todo-pack",
    subject: "Prepare the jelly pack",
    proposedValues: { ...emptyValues(), title: "Prepare the jelly pack", status: "done" },
  });
  const todoStay = applyGate25DeterministicPath([todoDone], world, "proj-candy");
  check(
    "todo-done-not-converted-from-title-restatement",
    todoStay.items[0].operation === "update" && todoStay.traces[0].sameValueConverted === false,
    todoStay.items[0].operation,
  );

  const emptyUpdate = item({
    operation: "update",
    domain: "responsibility",
    targetCanonicalId: "resp-uat",
    subject: "Pippa",
  });
  const partial = applyGate25DeterministicPath([emptyUpdate], world, "proj-candy");
  check(
    "partial-update-not-repaired",
    partial.items[0].operation === "update" && partial.traces[0].sameValueComparable === false,
  );

  const removeMs = item({
    operation: "remove",
    domain: "milestone",
    targetCanonicalId: "ms-parade",
    subject: "Please delete Parade day",
  });
  const blocked = applyGate25DeterministicPath([removeMs], world, "proj-candy");
  check(
    "unsupported-remove-still-left-untouched",
    blocked.items[0].operation === "left_untouched" && blocked.traces[0].sameValueConverted === false,
  );

  const snap = serializeCurrentCanonicalTruth(world, "proj-candy");
  check("snapshot-has-current-project-header", snap.startsWith("CURRENT PROJECT\nid=\"proj-candy\""));
  check("snapshot-has-name", snap.includes("name=\"Candyland\""));
  check("snapshot-has-code", snap.includes("code=\"CANDY\""));
  check("snapshot-no-other-project-catalogue", !snap.includes("GamingStudio5000") && !snap.includes("Toyworld"));

  return { ok: failures.length === 0, failures };
}
