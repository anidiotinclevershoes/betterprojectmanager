/**
 * Project Scan — read-only analysis projection.
 * Findings must not write canonical rows.
 */
import { composeKnowledgeCentreItems } from "@/lib/knowledge-centre/four-bucket";
import { buildDependencyRows } from "@/lib/knowledge-centre/ocean-frames";
import type { KnowledgeItemRef } from "@/lib/knowledge-centre/knowledge-item-detail";
import { isOpenRiskStatus } from "@/lib/risks/lifecycle";
import type { MissionState } from "@/lib/types";

export type ScanGroupId =
  | "risks"
  | "dependencies"
  | "missing"
  | "contradictions";

export type ScanFinding = {
  id: string;
  group: ScanGroupId;
  title: string;
  detail?: string | null;
  ref: KnowledgeItemRef | null;
};

export type ProjectScanProjection = {
  groups: Record<ScanGroupId, ScanFinding[]>;
  generatedAt: string;
};

export const SCAN_GROUP_LABEL: Record<ScanGroupId, string> = {
  risks: "Risks",
  dependencies: "Dependencies",
  missing: "Missing information",
  contradictions: "Contradictions",
};

export function composeProjectScan(
  state: MissionState,
  projectId: string,
  now = Date.now(),
): ProjectScanProjection {
  const composed = composeKnowledgeCentreItems(state, projectId);
  const groups: Record<ScanGroupId, ScanFinding[]> = {
    risks: [],
    dependencies: [],
    missing: [],
    contradictions: [],
  };

  for (const risk of state.risks ?? []) {
    if (risk.projectId !== projectId || !isOpenRiskStatus(risk.status)) continue;
    groups.risks.push({
      id: `scan-risk:${risk.id}`,
      group: "risks",
      title: risk.title,
      detail: `Status: ${risk.status}`,
      ref: { kind: "risk", riskId: risk.id },
    });
  }

  for (const row of buildDependencyRows(state, projectId)) {
    groups.dependencies.push({
      id: `scan-dep:${row.id}`,
      group: "dependencies",
      title: row.title,
      ref: { kind: "structured", itemId: row.id },
    });
  }

  for (const item of composed) {
    if (item.bucket === "people" && item.needsYou) {
      groups.missing.push({
        id: `scan-missing:${item.id}`,
        group: "missing",
        title: item.title,
        detail: item.needsYou,
        ref: item.ref,
      });
    }
  }

  const project = state.projects.find((p) => p.id === projectId);
  if (project && !project.currentFocus?.trim() && !project.summary?.trim()) {
    groups.missing.push({
      id: `scan-missing:focus:${projectId}`,
      group: "missing",
      title: "Project focus is not recorded",
      detail: "No current focus or summary is stored for this project.",
      ref: null,
    });
  }

  // Contradictions: only surface explicit stored conflict markers. Do not
  // invent contradictions by comparing titles.
  const knowledge = state.knowledge.find((k) => k.projectId === projectId);
  for (const item of knowledge?.structured ?? []) {
    if (item.lifecycle && item.lifecycle !== "current") continue;
    const flagged =
      item.epistemic === "conflicting" || item.kind === "ambiguity";
    if (!flagged) continue;
    groups.contradictions.push({
      id: `scan-contradiction:${item.id}`,
      group: "contradictions",
      title: item.body,
      detail:
        item.epistemic === "conflicting"
          ? "Stored as conflicting project information."
          : "Stored as an unresolved ambiguity.",
      ref: { kind: "structured", itemId: item.id },
    });
  }

  return {
    groups,
    generatedAt: new Date(now).toISOString(),
  };
}
