"use client";

import { useMemo, useState } from "react";
import { MeMark } from "@/components/brand/MeMark";
import {
  WORKSPACE_PAGE_HEADINGS,
  WorkspacePageHeading,
} from "@/components/knowledge-centre/WorkspacePageHeading";
import {
  SCAN_GROUP_LABEL,
  composeProjectScan,
  formatScanSummary,
  type ScanFinding,
  type ScanGroupId,
} from "@/lib/knowledge-centre/project-scan";
import type { KnowledgeItemRef } from "@/lib/knowledge-centre/knowledge-item-detail";
import { useMission } from "@/lib/store";
import "./project-scan.css";

const GROUPS: ScanGroupId[] = [
  "risks",
  "dependencies",
  "missing",
  "contradictions",
];

export function ProjectScanView({
  projectId,
  onOpenDetails,
}: {
  projectId: string;
  onOpenDetails: (ref: KnowledgeItemRef) => void;
}) {
  const { state } = useMission();
  const [tick, setTick] = useState(0);
  const scan = useMemo(
    () => composeProjectScan(state, projectId, Date.now()),
    [state, projectId, tick],
  );
  const summary = formatScanSummary(scan.groups);

  return (
    <div className="ocean-scan" data-testid="ocean-scan">
      <header className="ocean-scan-header">
        <WorkspacePageHeading {...WORKSPACE_PAGE_HEADINGS.scan} />
        <button
          type="button"
          className="ocean-scan-again"
          data-testid="ocean-scan-again"
          onClick={() => setTick((n) => n + 1)}
        >
          <MeMark size="micro" />
          Scan again
        </button>
      </header>

      <section className="ocean-scan-summary" aria-label="Scan summary">
        <p className="ocean-scan-summary-label">Summary</p>
        <p className="ocean-scan-summary-counts" data-testid="ocean-scan-summary">
          {summary}
        </p>
        <p className="ocean-scan-summary-helper">
          Scan findings do not change project information unless you act.
        </p>
      </section>

      <div className="ocean-scan-grid">
        {GROUPS.map((group) => (
          <ScanGroup
            key={group}
            group={group}
            findings={scan.groups[group]}
            onOpenDetails={onOpenDetails}
          />
        ))}
      </div>

      <p className="ocean-scan-footer">
        Suggestions only appear on Home when Suggestions is turned on.
      </p>
    </div>
  );
}

function ScanGroup({
  group,
  findings,
  onOpenDetails,
}: {
  group: ScanGroupId;
  findings: ScanFinding[];
  onOpenDetails: (ref: KnowledgeItemRef) => void;
}) {
  return (
    <section
      className={`ocean-scan-group is-${group}`}
      data-testid={`ocean-scan-${group}`}
    >
      <header className="ocean-scan-group-head">
        <h3>{SCAN_GROUP_LABEL[group]}</h3>
        <span className="ocean-scan-count">{findings.length}</span>
      </header>
      {findings.length ? (
        <ul>
          {findings.map((finding) => (
            <li key={finding.id} className="ocean-scan-finding">
              <p className="ocean-scan-finding-title">{finding.title}</p>
              {finding.detail ? (
                <p className="ocean-scan-finding-detail">{finding.detail}</p>
              ) : null}
              {finding.ref ? (
                <button
                  type="button"
                  className="ocean-scan-open"
                  data-testid={`ocean-scan-evidence-${finding.id}`}
                  onClick={() => onOpenDetails(finding.ref!)}
                >
                  Open ›
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="ocean-scan-empty">
          {group === "contradictions"
            ? "No stored contradictions to report."
            : "Nothing in this group."}
        </p>
      )}
    </section>
  );
}
