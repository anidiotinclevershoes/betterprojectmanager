/**
 * Canonical Issue Notes. Supplementary only.
 * Empty and whitespace-only values are absent (NULL). End trim only.
 */
import type { HistoryEvent, MissionState, ProjectRisk } from "@/lib/types";
import { makeHistoryEvent, pushHistory } from "@/lib/workspace/history";

export const RISK_HISTORY_TARGET_KIND = "risk" as const;

export function canonicalRiskNotes(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export type RiskNotesPlan =
  | { changed: false; notes: string | null }
  | {
      changed: true;
      notes: string | null;
      previous: string | null;
      title: string;
      detail: string;
    };

export function planRiskNotesChange(
  previousRaw: string | null | undefined,
  requestedRaw: string | null | undefined,
): RiskNotesPlan {
  const previous = canonicalRiskNotes(previousRaw);
  const notes = canonicalRiskNotes(requestedRaw);
  if (previous === notes) return { changed: false, notes };
  const title =
    previous == null
      ? "Issue notes added"
      : notes == null
        ? "Issue notes cleared"
        : "Issue notes updated";
  const detail = `Previous notes:\n${previous ?? ""}\nCurrent notes:\n${notes ?? ""}`;
  return { changed: true, notes, previous, title, detail };
}

export function applyRiskNotesLocal(
  state: MissionState,
  args: { projectId: string; riskId: string; notes: string | null | undefined },
): { ok: true; changed: boolean; state: MissionState } | { ok: false; error: string } {
  const risk = (state.risks ?? []).find(
    (row) => row.id === args.riskId && row.projectId === args.projectId,
  );
  if (!risk) return { ok: false, error: "issue is not in this project" };
  const plan = planRiskNotesChange(risk.notes, args.notes);
  if (!plan.changed) {
    return { ok: true, changed: false, state };
  }
  const risks = (state.risks ?? []).map((row) =>
    row.id === risk.id && row.projectId === args.projectId
      ? { ...row, notes: plan.notes, updatedAt: new Date().toISOString() }
      : row,
  );
  const event = makeHistoryEvent({
    type: "other",
    title: plan.title,
    detail: plan.detail,
    projectId: args.projectId,
    source: "user",
    targetKind: RISK_HISTORY_TARGET_KIND,
    targetId: risk.id,
  });
  return {
    ok: true,
    changed: true,
    state: pushHistory({ ...state, risks }, event),
  };
}

export function historyEventForNotesPlan(
  plan: Extract<RiskNotesPlan, { changed: true }>,
  args: { projectId: string; riskId: string; id?: string; createdAt?: string },
): HistoryEvent {
  return {
    ...makeHistoryEvent({
      type: "other",
      title: plan.title,
      detail: plan.detail,
      projectId: args.projectId,
      source: "user",
      targetKind: RISK_HISTORY_TARGET_KIND,
      targetId: args.riskId,
    }),
    ...(args.id ? { id: args.id } : {}),
    ...(args.createdAt ? { createdAt: args.createdAt } : {}),
  };
}

export function projectRiskNotesField(
  risk: ProjectRisk,
): string | null {
  return canonicalRiskNotes(risk.notes);
}
