"use client";

import { useMemo, useState } from "react";
import { KnowledgeItemDetailDrawer } from "@/components/knowledge-centre/KnowledgeItemDetailDrawer";
import type { KnowledgeItemRef } from "@/lib/knowledge-centre/knowledge-item-detail";
import {
  SCAN_GROUP_LABEL,
  composeProjectScan,
  formatScanSummary,
  type ScanGroupId,
} from "@/lib/knowledge-centre/project-scan";
import { useMission } from "@/lib/store";

const ORDER: ScanGroupId[] = [
  "risks",
  "dependencies",
  "missing",
  "contradictions",
];

/**
 * Read-only Project Scan. Opening a finding uses the existing detail drawer.
 * The panel has no create, edit, or resolve controls.
 */
export function ProjectScanPanel({ projectId }: { projectId: string }) {
  const { state } = useMission();
  const [selected, setSelected] = useState<KnowledgeItemRef | null>(null);
  const scan = useMemo(
    () => composeProjectScan(state, projectId),
    [state, projectId],
  );

  return (
    <div className="lume-scan" data-testid="project-scan" data-project-id={projectId}>
      <p className="lume-scan-summary" data-testid="project-scan-summary">
        {formatScanSummary(scan.groups)}
      </p>
      {ORDER.map((group) => {
        const findings = scan.groups[group];
        return (
          <section key={group} data-testid={`project-scan-${group}`} data-count={findings.length}>
            <header>
              <strong>{SCAN_GROUP_LABEL[group]}</strong>
              <span>{findings.length}</span>
            </header>
            {findings.length === 0 ? (
              <p>None recorded.</p>
            ) : (
              <ul>
                {findings.map((finding) => (
                  <li key={finding.id}>
                    <button
                      type="button"
                      disabled={!finding.ref}
                      onClick={() => finding.ref && setSelected(finding.ref)}
                    >
                      <strong>{finding.title}</strong>
                      {finding.detail ? <em>{finding.detail}</em> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <KnowledgeItemDetailDrawer
        projectId={projectId}
        selected={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
