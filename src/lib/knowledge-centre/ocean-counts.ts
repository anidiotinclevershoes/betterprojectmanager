/**
 * Truthful intelligence-strip counts for Ocean Knowledge Centre.
 * Only count what project state can honestly support.
 */
import { emptyKnowledge, knowledgeHasContent } from "@/lib/knowledge";
import { isOpenRiskStatus } from "@/lib/risks/lifecycle";
import type { MissionState } from "@/lib/types";

export type OceanIntelligenceCounts = {
  thingsKnown: number;
  openRisks: number;
  dependencies: number;
  lastUpdatedIso: string | null;
};

function countKnowledgeThings(
  state: MissionState,
  projectId: string,
): number {
  const knowledge =
    state.knowledge.find((k) => k.projectId === projectId) ??
    emptyKnowledge(projectId);
  let n = 0;
  for (const bullets of Object.values(knowledge.sections)) {
    n += (bullets ?? []).filter((b) => b.trim()).length;
  }
  if (knowledge.structured?.length) {
    const bodies = new Set(
      Object.values(knowledge.sections)
        .flat()
        .map((b) => b.trim().toLowerCase()),
    );
    for (const item of knowledge.structured) {
      if (item.lifecycle && item.lifecycle !== "current") continue;
      if (bodies.has(item.body.trim().toLowerCase())) continue;
      n += 1;
    }
  }
  return n;
}

function countDependencies(state: MissionState, projectId: string): number {
  const knowledge = state.knowledge.find((k) => k.projectId === projectId);
  if (!knowledge) return 0;
  let n = 0;
  for (const item of knowledge.structured ?? []) {
    if (item.lifecycle && item.lifecycle !== "current") continue;
    if (item.kind === "dependency") n += 1;
  }
  // Legacy: no dedicated dependency section — do not invent from prose.
  return n;
}

export function oceanIntelligenceCounts(
  state: MissionState,
  projectId: string,
): OceanIntelligenceCounts {
  const knowledge =
    state.knowledge.find((k) => k.projectId === projectId) ??
    emptyKnowledge(projectId);
  const openRisks = (state.risks ?? []).filter(
    (r) => r.projectId === projectId && isOpenRiskStatus(r.status),
  ).length;

  return {
    thingsKnown: countKnowledgeThings(state, projectId),
    openRisks,
    dependencies: countDependencies(state, projectId),
    lastUpdatedIso: knowledgeHasContent(knowledge)
      ? knowledge.updatedAt
      : null,
  };
}

export function formatRelativeUpdated(iso: string | null, now = Date.now()): string {
  if (!iso) return "Updated —";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "Updated —";
  const mins = Math.max(0, Math.round((now - then) / 60000));
  if (mins < 1) return "Updated just now";
  if (mins < 60) return `Updated ${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `Updated ${hours}h ago`;
  const days = Math.round(hours / 24);
  return `Updated ${days}d ago`;
}
