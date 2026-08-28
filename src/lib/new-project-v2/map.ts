import {
  newSetupClientKey,
  suggestCode,
  type CreateProjectInput,
} from "@/lib/create-project";
import type { ProvisionalItem } from "./types";

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Map a user-approved categorisation into the existing CreateProjectInput.
 * This mapper does not write to the database.
 */
export function draftFromProvisional(args: {
  sourceNarrative: string;
  sourceMode: "talk" | "paste";
  project: { name: string; summary: string; currentFocus: string };
  items: ProvisionalItem[];
}): CreateProjectInput {
  const stakeholders = args.items
    .filter((item) => item.category === "person")
    .map((item) => {
      const name = asString(item.proposedValues?.name);
      return {
        clientKey: newSetupClientKey(),
        name: name || item.statement,
        role: asString(item.proposedValues?.role) || asString(item.proposedValues?.scope),
        needsReview: !name || Boolean(item.needsReview),
      };
    });

  const risks = args.items
    .filter((item) => item.category === "risk")
    .map((item) => ({
      clientKey: newSetupClientKey(),
      title: asString(item.proposedValues?.title) || item.statement,
      needsReview: Boolean(item.needsReview),
    }));

  const todos = args.items
    .filter((item) => item.category === "todo")
    .map((item) => ({
      clientKey: newSetupClientKey(),
      title: asString(item.proposedValues?.title) || item.statement,
      dueAt: asString(item.proposedValues?.date) || asString(item.proposedValues?.dueAt),
      needsReview: Boolean(item.needsReview),
    }));

  const importantDates = args.items
    .filter((item) => item.category === "milestone")
    .map((item) => ({
      clientKey: newSetupClientKey(),
      label: asString(item.proposedValues?.label) || item.statement,
      date: asString(item.proposedValues?.date) || asString(item.proposedValues?.startAt),
      needsReview: Boolean(item.needsReview),
    }));

  const knowledgeRemember = args.items
    .filter((item) => item.category === "knowledge")
    .map((item) => ({
      clientKey: newSetupClientKey(),
      text: item.statement,
      remember: true as const,
    }));

  const notMentioned = args.items
    .filter((item) => item.category === "commentary" || item.category === "ignored")
    .map((item) => item.statement);

  const name = args.project.name.trim() || "New project";
  const nextDate = importantDates.find((d) => d.date);

  return {
    name,
    code: suggestCode(name),
    summary: args.project.summary,
    kind: "delivery",
    currentFocus: args.project.currentFocus,
    nextMilestone: nextDate?.label,
    nextMilestoneAt: nextDate?.date,
    stakeholders,
    risks,
    todos,
    importantDates,
    knowledgeRemember,
    knowledgeRisks: risks.map((r) => r.title),
    knowledgePeople: stakeholders.map((s) =>
      s.role ? `${s.name} — ${s.role}` : s.name,
    ),
    notMentioned,
    sourceNarrative: args.sourceNarrative,
    sourceMode: args.sourceMode,
  };
}
