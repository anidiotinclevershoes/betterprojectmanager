"use client";

import { useMemo, useState } from "react";
import { MeMark } from "@/components/brand/MeMark";
import {
  SCAN_GROUP_LABEL,
  composeProjectScan,
  type ScanGroupId,
} from "@/lib/knowledge-centre/project-scan";
import type { KnowledgeItemRef } from "@/lib/knowledge-centre/knowledge-item-detail";
import { useMission } from "@/lib/store";

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

  return (
    <div className="ocean-scan" data-testid="ocean-scan">
      <header className="ocean-scan-header">
        <h2>
          <MeMark size="button" /> Project Scan
        </h2>
        <p className="ocean-scan-boundary">
          Scan findings are analysis only. Nothing changes in the project
          unless you choose to act.
        </p>
        <button
          type="button"
          className="ghost-btn"
          data-testid="ocean-scan-again"
          onClick={() => setTick((n) => n + 1)}
        >
          Scan again
        </button>
      </header>

      {GROUPS.map((group) => {
        const findings = scan.groups[group];
        return (
          <section
            key={group}
            className={`ocean-scan-group is-${group}`}
            data-testid={`ocean-scan-${group}`}
          >
            <h3>
              {SCAN_GROUP_LABEL[group]} · {findings.length}
            </h3>
            {findings.length ? (
              <ul>
                {findings.map((finding) => (
                  <li key={finding.id}>
                    <div>
                      <p>{finding.title}</p>
                      {finding.detail ? (
                        <p className="ocean-home-muted">{finding.detail}</p>
                      ) : null}
                    </div>
                    {finding.ref ? (
                      <button
                        type="button"
                        className="ghost-btn"
                        data-testid={`ocean-scan-evidence-${finding.id}`}
                        onClick={() => onOpenDetails(finding.ref!)}
                      >
                        View evidence ›
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ocean-home-empty">
                {group === "contradictions"
                  ? "No stored contradictions to report."
                  : "Nothing in this group."}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
