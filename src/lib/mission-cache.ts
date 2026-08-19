import type { MissionState } from "@/lib/types";
import { emptyMissionState } from "@/lib/data/supabase/load-mission-state";

/** Last successful supabase workspace paint — survives hard refresh, cleared on logout. */
export const MISSION_SUPABASE_CACHE_KEY = "lume-mission-supabase-cache-v1";

export type MissionSupabaseCache = {
  version: 1;
  userId: string;
  workspaceId: string;
  state: MissionState;
  savedAt: string;
};

function normaliseCachedState(raw: MissionState): MissionState {
  return {
    ...emptyMissionState(),
    ...raw,
    projects: Array.isArray(raw.projects) ? raw.projects : [],
    todos: raw.todos ?? [],
    knowledge: raw.knowledge ?? [],
    timeline: raw.timeline ?? [],
    history: raw.history ?? [],
    memories: raw.memories ?? [],
    recommendations: raw.recommendations ?? [],
    meetings: raw.meetings ?? [],
    releases: raw.releases ?? [],
    analysesThisMonth: raw.analysesThisMonth ?? 0,
    analysesMonthKey: raw.analysesMonthKey,
  };
}

export function readMissionSupabaseCache(): MissionSupabaseCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MISSION_SUPABASE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MissionSupabaseCache;
    if (parsed?.version !== 1) return null;
    if (!parsed.userId || !parsed.workspaceId || !parsed.state) return null;
    if (!Array.isArray(parsed.state.projects)) return null;
    return {
      version: 1,
      userId: parsed.userId,
      workspaceId: parsed.workspaceId,
      savedAt: parsed.savedAt || new Date().toISOString(),
      state: normaliseCachedState(parsed.state),
    };
  } catch {
    return null;
  }
}

export function writeMissionSupabaseCache(input: {
  userId: string;
  workspaceId: string;
  state: MissionState;
}): void {
  if (typeof window === "undefined") return;
  if (!input.userId || !input.workspaceId) return;
  try {
    const payload: MissionSupabaseCache = {
      version: 1,
      userId: input.userId,
      workspaceId: input.workspaceId,
      state: normaliseCachedState(input.state),
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(
      MISSION_SUPABASE_CACHE_KEY,
      JSON.stringify(payload),
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearMissionSupabaseCache(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(MISSION_SUPABASE_CACHE_KEY);
  } catch {
    /* ignore */
  }
}
