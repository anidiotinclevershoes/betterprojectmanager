/**
 * Map a successful Capture Apply operation onto the existing History event.
 * Chronology/evidence only — not competing project truth, not a generic diff.
 */
import type { HistoryEvent } from "@/lib/types";
import type { CaptureLegalOperation } from "./types";

function clip(text: string, max = 240): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

function withEvidence(summary: string, evidence?: string): string | undefined {
  const body = clip(summary);
  const quote = evidence ? clip(evidence, 160) : "";
  if (body && quote) return `${body} Evidence: “${quote}”`;
  return body || (quote ? `Evidence: “${quote}”` : undefined);
}

export type CaptureApplyHistoryInput = Omit<HistoryEvent, "id" | "createdAt">;

/**
 * Existing HistoryEvent fields only. Object ids and after-values go in
 * title/detail text — the table has no before/after columns.
 */
export function historyInputFromCaptureOperation(args: {
  operation: CaptureLegalOperation;
  evidence?: string;
}): CaptureApplyHistoryInput {
  const { operation: op, evidence } = args;
  const source = "ai" as const;

  switch (op.type) {
    case "create_todo":
      return {
        type: "task_added",
        title: "Capture added a To Do",
        detail: withEvidence(op.title, evidence),
        projectId: op.projectId,
        source,
      };
    case "update_todo":
      return {
        type: "task_updated",
        title: "Capture updated a To Do",
        detail: withEvidence(
          [op.todoId, op.title, op.dueAt].filter(Boolean).join(" · "),
          evidence,
        ),
        projectId: op.projectId,
        source,
      };
    case "complete_todo":
      return {
        type: "task_completed",
        title: "Capture completed a To Do",
        detail: withEvidence(op.todoId, evidence),
        projectId: op.projectId,
        source,
      };
    case "delete_todo":
      return {
        type: "other",
        title: "Capture removed a To Do",
        detail: withEvidence(op.todoId, evidence),
        projectId: op.projectId,
        source,
      };
    case "create_risk":
      return {
        type: "risk_added",
        title: "Capture added a risk",
        detail: withEvidence(op.title, evidence),
        projectId: op.projectId,
        source,
      };
    case "update_risk_status":
      return {
        type: "other",
        title: "Capture updated a risk",
        detail: withEvidence(`${op.riskId} → ${op.status}`, evidence),
        projectId: op.projectId,
        source,
      };
    case "create_milestone":
      return {
        type: "milestone_changed",
        title: "Capture added a milestone",
        detail: withEvidence(
          [op.label, op.startAt].filter(Boolean).join(" · "),
          evidence,
        ),
        projectId: op.projectId,
        source,
      };
    case "update_milestone":
      return {
        type: "milestone_changed",
        title: "Capture updated a milestone",
        detail: withEvidence(
          [op.milestoneId, op.label, op.startAt].filter(Boolean).join(" · "),
          evidence,
        ),
        projectId: op.projectId,
        source,
      };
    case "ensure_person":
      return {
        type: "other",
        title: "Capture recorded a person",
        detail: withEvidence(
          [op.name, op.roleHint].filter(Boolean).join(" — "),
          evidence,
        ),
        projectId: op.projectId,
        source,
      };
    case "confirm_responsibility":
      return {
        type: "other",
        title: "Capture confirmed ownership",
        detail: withEvidence(
          `${op.personName} · ${op.scope}`,
          evidence,
        ),
        projectId: op.projectId,
        source,
      };
    case "write_availability":
      return {
        type: "knowledge_updated",
        title: "Capture recorded availability",
        detail: withEvidence(
          `${op.personName} away ${op.awayFromIso.slice(0, 10)}–${op.awayToIso.slice(0, 10)}`,
          evidence,
        ),
        projectId: op.projectId,
        source,
      };
    case "write_knowledge":
      return {
        type: "knowledge_updated",
        title: "Capture updated knowledge",
        detail: withEvidence(`${op.section}: ${op.text}`, evidence),
        projectId: op.projectId,
        source,
      };
    case "write_memory":
      return {
        type: "other",
        title: "Capture recorded a memory",
        detail: withEvidence(op.title, evidence),
        projectId: op.projectId,
        source,
      };
  }
}
