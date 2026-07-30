/**
 * AI readiness audit — Phase 1.5
 * Checks whether entities can produce useful AIRecord fields + have adapters.
 */

export type ReadinessFlag = "ok" | "partial" | "missing";

export type AIReadinessRow = {
  entity: string;
  hasTitle: ReadinessFlag;
  hasSummary: ReadinessFlag;
  hasStatus: ReadinessFlag;
  hasOwner: ReadinessFlag;
  hasUpdatedAt: ReadinessFlag;
  hasAIAdapter: ReadinessFlag;
  missingHighlights: string[];
};

export const AI_READINESS_AUDIT: AIReadinessRow[] = [
  {
    entity: "Project",
    hasTitle: "ok",
    hasSummary: "partial",
    hasStatus: "missing",
    hasOwner: "missing",
    hasUpdatedAt: "missing",
    hasAIAdapter: "ok",
    missingHighlights: ["No project status/owner/updatedAt on Project type"],
  },
  {
    entity: "To Do",
    hasTitle: "ok",
    hasSummary: "partial",
    hasStatus: "ok",
    hasOwner: "ok",
    hasUpdatedAt: "missing",
    hasAIAdapter: "ok",
    missingHighlights: ["No updatedAt; summary synthesized from notes/blockedBy"],
  },
  {
    entity: "Meeting",
    hasTitle: "ok",
    hasSummary: "ok",
    hasStatus: "partial",
    hasOwner: "partial",
    hasUpdatedAt: "missing",
    hasAIAdapter: "ok",
    missingHighlights: ["Status inferred from date; owner = first attendee; no updatedAt"],
  },
  {
    entity: "Risk",
    hasTitle: "ok",
    hasSummary: "ok",
    hasStatus: "ok",
    hasOwner: "ok",
    hasUpdatedAt: "missing",
    hasAIAdapter: "ok",
    missingHighlights: ["No updatedAt"],
  },
  {
    entity: "Milestone",
    hasTitle: "ok",
    hasSummary: "partial",
    hasStatus: "missing",
    hasOwner: "missing",
    hasUpdatedAt: "missing",
    hasAIAdapter: "ok",
    missingHighlights: ["No status/owner/updatedAt; summary from date only"],
  },
  {
    entity: "Knowledge",
    hasTitle: "ok",
    hasSummary: "ok",
    hasStatus: "missing",
    hasOwner: "missing",
    hasUpdatedAt: "partial",
    hasAIAdapter: "ok",
    missingHighlights: ["No status/owner; updatedAt uses date field"],
  },
  {
    entity: "Stakeholder",
    hasTitle: "ok",
    hasSummary: "partial",
    hasStatus: "missing",
    hasOwner: "missing",
    hasUpdatedAt: "missing",
    hasAIAdapter: "ok",
    missingHighlights: ["No status/updatedAt; summary from role/influence"],
  },
  {
    entity: "Nudge",
    hasTitle: "ok",
    hasSummary: "ok",
    hasStatus: "partial",
    hasOwner: "missing",
    hasUpdatedAt: "missing",
    hasAIAdapter: "ok",
    missingHighlights: ["Status always OPEN while listed; no owner/updatedAt"],
  },
  {
    entity: "History",
    hasTitle: "ok",
    hasSummary: "ok",
    hasStatus: "ok",
    hasOwner: "missing",
    hasUpdatedAt: "partial",
    hasAIAdapter: "ok",
    missingHighlights: ["No owner; updatedAt uses event date"],
  },
  {
    entity: "Release",
    hasTitle: "ok",
    hasSummary: "partial",
    hasStatus: "partial",
    hasOwner: "missing",
    hasUpdatedAt: "missing",
    hasAIAdapter: "ok",
    missingHighlights: ["No owner/updatedAt; status inferred from date"],
  },
];

function mark(flag: ReadinessFlag): string {
  if (flag === "ok") return "✓";
  if (flag === "partial") return "~";
  return "✗";
}

export function formatAIReadinessReport(): string {
  const lines = [
    "# AI readiness audit (Phase 1.5)",
    "",
    "Legend: ✓ ok · ~ partial · ✗ missing",
    "",
    "| Entity | title | summary | status | owner | updatedAt | adapter | Gaps |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const row of AI_READINESS_AUDIT) {
    lines.push(
      `| ${row.entity} | ${mark(row.hasTitle)} | ${mark(row.hasSummary)} | ${mark(row.hasStatus)} | ${mark(row.hasOwner)} | ${mark(row.hasUpdatedAt)} | ${mark(row.hasAIAdapter)} | ${row.missingHighlights.join("; ")} |`
    );
  }
  lines.push("");
  return lines.join("\n");
}
