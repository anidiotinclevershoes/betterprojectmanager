import type { HistoryEvent, HistoryEventType, MissionState } from "@/lib/types";

function id() {
  return `hist-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeHistoryEvent(input: {
  type: HistoryEventType;
  title: string;
  detail?: string;
  projectId?: string | null;
  source?: HistoryEvent["source"];
}): HistoryEvent {
  return {
    id: id(),
    type: input.type,
    title: input.title,
    detail: input.detail,
    projectId: input.projectId,
    createdAt: new Date().toISOString(),
    source: input.source ?? "user",
  };
}

export function pushHistory(
  state: MissionState,
  event: HistoryEvent,
): MissionState {
  const history = [event, ...(state.history ?? [])].slice(0, 500);
  return { ...state, history };
}

export function currentMonthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const ANALYSIS_MONTHLY_LIMIT = 50;

export function analysesRemaining(state: MissionState): {
  used: number;
  limit: number;
  remaining: number;
} {
  const key = currentMonthKey();
  const used =
    state.analysesMonthKey === key ? (state.analysesThisMonth ?? 0) : 0;
  const limit = ANALYSIS_MONTHLY_LIMIT;
  return { used, limit, remaining: Math.max(0, limit - used) };
}

export function bumpAnalysisUsage(state: MissionState): MissionState {
  const key = currentMonthKey();
  const used =
    state.analysesMonthKey === key ? (state.analysesThisMonth ?? 0) : 0;
  return {
    ...state,
    analysesMonthKey: key,
    analysesThisMonth: used + 1,
  };
}
