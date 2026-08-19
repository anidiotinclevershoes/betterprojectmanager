/**
 * Selective demo / seed reset: restore canonical fixtures for seeded
 * records only; preserve non-seeded user data.
 */

import { createSeedState } from "./seed";
import {
  SEED_MANIFEST,
  buildSeedManifest,
  isSeededRecord,
  seedIdSet,
  type SeedManifest,
} from "./seed-manifest";
import type { MissionState, ProjectKnowledge } from "./types";

export type SeedResetSuccess = {
  ok: true;
  state: MissionState;
  manifest: SeedManifest;
};

export type SeedResetFailure = {
  ok: false;
  error: string;
  /** Previous state unchanged — caller must not persist. */
  state?: undefined;
};

export type SeedResetResult = SeedResetSuccess | SeedResetFailure;

type Seedable = { id: string; isSeeded?: boolean };

function keepNonSeeded<T extends Seedable>(
  rows: T[] | undefined,
  seedIds: Set<string>,
): T[] {
  return (rows ?? []).filter((row) => !isSeededRecord(row, seedIds));
}

function mergeCollection<T extends Seedable>(
  seedRows: T[],
  currentRows: T[] | undefined,
  seedIds: Set<string>,
): T[] {
  return [...seedRows, ...keepNonSeeded(currentRows, seedIds)];
}

/**
 * Pure merge: delete known seeded / `isSeeded` records, recreate from
 * `createSeedState()`, keep everything else.
 */
export function resetSeedData(
  current: MissionState,
  options?: {
    /** Inject for tests — defaults to createSeedState(). */
    createSeed?: () => MissionState;
  },
): SeedResetResult {
  try {
    if (!current || typeof current !== "object") {
      return { ok: false, error: "Could not restore demo data." };
    }

    const createSeed = options?.createSeed ?? createSeedState;
    const seed = createSeed();
    if (!seed?.projects?.length) {
      return { ok: false, error: "Could not restore demo data." };
    }

    const manifest = buildSeedManifest(seed);
    const seedIds = seedIdSet(manifest);
    const seedProjectIds = new Set(manifest.projectIds);

    const projects = mergeCollection(seed.projects, current.projects, seedIds);

    const knowledge: ProjectKnowledge[] = [
      ...seed.knowledge,
      ...(current.knowledge ?? []).filter((k) => {
        if ((k as ProjectKnowledge & { isSeeded?: boolean }).isSeeded) {
          return false;
        }
        return !seedProjectIds.has(k.projectId);
      }),
    ];

    const next: MissionState = {
      projects,
      memories: mergeCollection(seed.memories, current.memories, seedIds),
      recommendations: mergeCollection(
        seed.recommendations,
        current.recommendations,
        seedIds,
      ),
      meetings: mergeCollection(seed.meetings, current.meetings, seedIds),
      releases: mergeCollection(seed.releases, current.releases, seedIds),
      todos: mergeCollection(seed.todos, current.todos, seedIds),
      knowledge,
      timeline: mergeCollection(seed.timeline, current.timeline, seedIds),
      history: mergeCollection(seed.history ?? [], current.history, seedIds),
      // Preserve usage counters; refresh analysis timestamp.
      analysesThisMonth: current.analysesThisMonth ?? seed.analysesThisMonth,
      analysesMonthKey: current.analysesMonthKey ?? seed.analysesMonthKey,
      lastAnalyzedAt: new Date().toISOString(),
    };

    // Sanity: every baseline seed project must be present exactly once.
    for (const id of manifest.projectIds) {
      const count = next.projects.filter((p) => p.id === id).length;
      if (count !== 1) {
        return { ok: false, error: "Could not restore demo data." };
      }
    }

    return { ok: true, state: next, manifest };
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[seed-reset] failed", err);
    }
    return { ok: false, error: "Could not restore demo data." };
  }
}

/** Baseline attention helper for tests (seed state, no proactive extras). */
export function seedBaselineAttention(
  projectId: string,
  attentionFn: (state: MissionState, projectId: string) => number,
): number {
  return attentionFn(createSeedState(), projectId);
}

export { SEED_MANIFEST };
