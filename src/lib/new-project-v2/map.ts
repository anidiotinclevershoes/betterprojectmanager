import {
  asUsableString,
  firstUsableIsoDate,
} from "@/lib/capture-v2/contract";
import {
  suggestCode,
  type CreateProjectInput,
} from "@/lib/create-project";
import type { ProvisionalItem } from "./types";

/**
 * Map a user-approved categorisation into the existing CreateProjectInput.
 * This mapper does not write to the database.
 *
 * Semantic completeness matches Capture reviewSafetyGap: missing / uncertain
 * / non_current items stay visible as Needs Review. Statement is never
 * invented as a person name or milestone date merely to look ready.
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
      const name =
        asUsableString(item.proposedValues?.name) ||
        asUsableString(item.proposedValues?.personName);
      return {
        clientKey: item.id,
        name: name ?? "",
        role: asUsableString(item.proposedValues?.role) || asUsableString(item.proposedValues?.scope),
        needsReview: Boolean(item.needsReview) || !name,
      };
    });

  const risks = args.items
    .filter((item) => item.category === "risk")
    .map((item) => ({
      clientKey: item.id,
      title:
        asUsableString(item.proposedValues?.title) ||
        asUsableString(item.proposedValues?.label) ||
        item.statement,
      needsReview: Boolean(item.needsReview),
    }));

  const todos = args.items
    .filter((item) => item.category === "todo")
    .map((item) => ({
      clientKey: item.id,
      title:
        asUsableString(item.proposedValues?.title) ||
        asUsableString(item.proposedValues?.label) ||
        item.statement,
      dueAt:
        firstUsableIsoDate(
          item.proposedValues?.date,
          item.proposedValues?.dueAt,
        ),
      needsReview: Boolean(item.needsReview),
    }));

  const importantDates = args.items
    .filter((item) => item.category === "milestone")
    .map((item) => {
      const date = firstUsableIsoDate(
        item.proposedValues?.date,
        item.proposedValues?.startAt,
      );
      return {
        clientKey: item.id,
        label:
          asUsableString(item.proposedValues?.label) ||
          asUsableString(item.proposedValues?.title) ||
          item.statement,
        date,
        needsReview: Boolean(item.needsReview) || !date,
      };
    });

  const knowledgeRemember = args.items
    .filter((item) => item.category === "knowledge")
    .map((item) => ({
      clientKey: item.id,
      text: item.statement,
      remember: item.truthIntent !== "non_current" && !item.needsReview,
    }));

  const notMentioned = args.items
    .filter((item) => item.category === "commentary" || item.category === "ignored")
    .map((item) => item.statement);

  const name = args.project.name.trim() || "New project";
  const nextDate = importantDates.find((d) => d.date && !d.needsReview);

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
    knowledgeRisks: risks.filter((r) => !r.needsReview).map((r) => r.title),
    knowledgePeople: stakeholders
      .filter((s) => s.name.trim() && !s.needsReview)
      .map((s) => (s.role ? `${s.name} — ${s.role}` : s.name)),
    notMentioned,
    sourceNarrative: args.sourceNarrative,
    sourceMode: args.sourceMode,
  };
}
