/**
 * Retire New Project Needs You overlays in MissionState after a legal write.
 * Mirrors persist-layer supersede. Not a second source of truth.
 */
import type { CanonicalTruthItem } from "@/lib/canonical-truth/types";
import type { MissionState, ProjectKnowledge } from "@/lib/types";
import {
  personResponsibilityQuestion,
  uncertainRiskQuestion,
  uncertainTodoQuestion,
} from "./needs-you";

export type SetupNeedsYouRetirement =
  | { type: "date"; label: string }
  | { type: "person"; name: string }
  | { type: "risk"; title: string }
  | { type: "todo"; title: string }
  | { type: "ambiguity"; body: string };

function labelsMatch(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function matchesRetirement(
  item: CanonicalTruthItem,
  reason: SetupNeedsYouRetirement,
): boolean {
  if (reason.type === "date") {
    if (item.kind !== "date") return false;
    if (item.meta?.date?.dateIso) return false;
    const label = (item.meta?.date?.label ?? item.body).trim();
    return labelsMatch(label, reason.label);
  }
  if (item.kind !== "ambiguity") return false;
  if (reason.type === "person") {
    return item.body.trim() === personResponsibilityQuestion(reason.name);
  }
  if (reason.type === "risk") {
    return item.body.trim() === uncertainRiskQuestion(reason.title);
  }
  if (reason.type === "todo") {
    return item.body.trim() === uncertainTodoQuestion(reason.title);
  }
  return item.body.trim() === reason.body.trim();
}

export function retireIncompleteSetupInKnowledge(
  knowledge: ProjectKnowledge,
  reason: SetupNeedsYouRetirement,
): ProjectKnowledge {
  const structured = (knowledge.structured ?? []).map((item) => {
    if (item.lifecycle !== "current") return item;
    if (!matchesRetirement(item, reason)) return item;
    return { ...item, lifecycle: "superseded" as const };
  });
  return { ...knowledge, structured };
}

export function retireIncompleteSetupInState(
  state: MissionState,
  projectId: string,
  reason: SetupNeedsYouRetirement,
): MissionState {
  return {
    ...state,
    knowledge: (state.knowledge ?? []).map((k) =>
      k.projectId === projectId
        ? retireIncompleteSetupInKnowledge(k, reason)
        : k,
    ),
  };
}
