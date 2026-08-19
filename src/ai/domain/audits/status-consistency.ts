/**
 * Status consistency audit — Phase 1.5
 * Reports current statuses vs recommended canonical statuses.
 * Does NOT migrate data.
 */

export type StatusAuditRow = {
  entity: string;
  currentStatuses: string[];
  recommendedCanonical: string[];
  notes: string;
};

/** Snapshot of statuses observed in code / seed / UI at Phase 1.5. */
export const STATUS_CONSISTENCY_AUDIT: StatusAuditRow[] = [
  {
    entity: "To Do",
    currentStatuses: ["todo", "doing", "done", "(blocked via blockedBy text only)"],
    recommendedCanonical: ["OPEN", "IN_PROGRESS", "BLOCKED", "COMPLETED", "ARCHIVED"],
    notes: "UI uses todo/doing/done. No first-class BLOCKED or ARCHIVED status field yet.",
  },
  {
    entity: "Meeting",
    currentStatuses: ["(implicit by date — past vs upcoming)"],
    recommendedCanonical: ["OPEN", "COMPLETED", "ARCHIVED"],
    notes: "No status field; lifecycle inferred from when.",
  },
  {
    entity: "Risk",
    currentStatuses: ["Open", "Mitigating", "Closed", "(also status string on Risk)"],
    recommendedCanonical: ["OPEN", "IN_PROGRESS", "COMPLETED", "ARCHIVED"],
    notes: "Mitigating ≈ IN_PROGRESS; Closed ≈ COMPLETED. Align casing.",
  },
  {
    entity: "Milestone",
    currentStatuses: ["(date-driven; no status field)"],
    recommendedCanonical: ["OPEN", "COMPLETED", "ARCHIVED"],
    notes: "Consider explicit status for overdue / complete.",
  },
  {
    entity: "Knowledge",
    currentStatuses: ["(none — always current)"],
    recommendedCanonical: ["OPEN", "ARCHIVED"],
    notes: "Archive superseded knowledge rather than deleting.",
  },
  {
    entity: "Stakeholder",
    currentStatuses: ["(none — always active)"],
    recommendedCanonical: ["OPEN", "ARCHIVED"],
    notes: "Archive when no longer involved.",
  },
  {
    entity: "Nudge",
    currentStatuses: ["(active list only; dismissed removed)"],
    recommendedCanonical: ["OPEN", "COMPLETED", "ARCHIVED"],
    notes: "Dismiss ≈ COMPLETED or ARCHIVE depending on product choice.",
  },
  {
    entity: "History",
    currentStatuses: ["(immutable event — no status)"],
    recommendedCanonical: ["COMPLETED"],
    notes: "History rows are past events; status not applicable for mutation.",
  },
  {
    entity: "Release",
    currentStatuses: ["(date-driven)"],
    recommendedCanonical: ["OPEN", "COMPLETED", "ARCHIVED"],
    notes: "Past release date ≈ COMPLETED.",
  },
  {
    entity: "Project",
    currentStatuses: ["(workspace container — no status)"],
    recommendedCanonical: ["OPEN", "ARCHIVED"],
    notes: "Future: project-level archive.",
  },
];

export function formatStatusConsistencyReport(): string {
  const lines = [
    "# Status consistency audit (Phase 1.5)",
    "",
    "Do not migrate data automatically. Review before Phase 2.",
    "",
  ];
  for (const row of STATUS_CONSISTENCY_AUDIT) {
    lines.push(`## ${row.entity}`);
    lines.push(`- Current: ${row.currentStatuses.join(", ")}`);
    lines.push(`- Recommended: ${row.recommendedCanonical.join(", ")}`);
    lines.push(`- Notes: ${row.notes}`);
    lines.push("");
  }
  return lines.join("\n");
}
