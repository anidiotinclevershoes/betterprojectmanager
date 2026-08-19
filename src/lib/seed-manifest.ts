/**
 * Stable identity for development seed / demo records.
 * Reset uses this manifest + optional `isSeeded: true` markers —
 * never display names alone.
 */

import { createSeedState } from "./seed";
import type { MissionState } from "./types";

export type SeedManifest = {
  version: string;
  projectIds: string[];
  recordIdsByType: Record<string, string[]>;
};

export const SEED_MANIFEST_VERSION = "1";

/** Build a manifest from a canonical seed MissionState. */
export function buildSeedManifest(seed: MissionState = createSeedState()): SeedManifest {
  const stakeholderIds = seed.projects.flatMap((p) =>
    (p.stakeholders ?? []).map((s) => s.id),
  );
  const duringPromptIds = seed.meetings.flatMap((m) =>
    (m.duringPrompts ?? []).map((d) => d.id),
  );

  return {
    version: SEED_MANIFEST_VERSION,
    projectIds: seed.projects.map((p) => p.id),
    recordIdsByType: {
      projects: seed.projects.map((p) => p.id),
      stakeholders: stakeholderIds,
      memories: seed.memories.map((m) => m.id),
      recommendations: seed.recommendations.map((r) => r.id),
      meetings: seed.meetings.map((m) => m.id),
      meetingDuringPrompts: duringPromptIds,
      releases: seed.releases.map((r) => r.id),
      todos: seed.todos.map((t) => t.id),
      knowledgeProjectIds: seed.knowledge.map((k) => k.projectId),
      timeline: seed.timeline.map((t) => t.id),
      history: (seed.history ?? []).map((h) => h.id),
      /** Reserved for explicitly seeded durable sessions (empty in baseline). */
      captureSessions: [],
      coachingSessions: [],
    },
  };
}

/** Canonical manifest for the current seed factory. */
export const SEED_MANIFEST: SeedManifest = buildSeedManifest();

export function seedIdSet(manifest: SeedManifest = SEED_MANIFEST): Set<string> {
  const ids = new Set<string>();
  for (const list of Object.values(manifest.recordIdsByType)) {
    for (const id of list) ids.add(id);
  }
  for (const id of manifest.projectIds) ids.add(id);
  return ids;
}

export function isSeedProjectId(
  projectId: string | null | undefined,
  manifest: SeedManifest = SEED_MANIFEST,
): boolean {
  if (!projectId) return false;
  return manifest.projectIds.includes(projectId);
}

/** True when the record is part of the seed baseline or explicitly marked. */
export function isSeededRecord(
  record: { id: string; isSeeded?: boolean },
  seedIds: Set<string> = seedIdSet(),
): boolean {
  return record.isSeeded === true || seedIds.has(record.id);
}
