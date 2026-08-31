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
    projectTags: raw.projectTags ?? [],
    itemTags: raw.itemTags ?? [],
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

/**
 * Paint-cache eligibility. The cache may accelerate paint of known durable
 * workspace state. It must not store unconfirmed optimistic or failed state
 * as if it were durable authority.
 *
 * Allowed reasons:
 * - `hydrate` — server/workspace load (including post-failure reconcile)
 * - `confirmed-persist` — a mutation whose durable write has succeeded
 *
 * `state-change` is never eligible (that was the previous unsafe contract).
 */
export function shouldWriteDurableMissionCache(input: {
  reason: "hydrate" | "confirmed-persist" | "state-change";
  persistenceMode: "local" | "supabase";
  workspaceId: string | null;
  userId: string | null;
}): boolean {
  if (input.reason === "state-change") return false;
  if (input.persistenceMode !== "supabase") return false;
  if (!input.workspaceId || !input.userId) return false;
  return input.reason === "hydrate" || input.reason === "confirmed-persist";
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
