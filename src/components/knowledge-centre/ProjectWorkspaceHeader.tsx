"use client";

import Link from "next/link";
import { MeMark } from "@/components/brand/MeMark";
import { DeleteProjectButton } from "@/components/knowledge-centre/DeleteProjectButton";
import {
  formatRelativeUpdated,
  oceanIntelligenceCounts,
} from "@/lib/knowledge-centre/ocean-counts";
import { analysesRemaining } from "@/lib/workspace/history";
import { useMission } from "@/lib/store";
import type { Project } from "@/lib/types";

/**
 * Approved workspace header band: title, code · updated, me/token, Usage & spending.
 * Replaces competing intel-strip / identity chrome.
 */
export function ProjectWorkspaceHeader({ project }: { project: Project }) {
  const { state } = useMission();
  const usage = analysesRemaining(state);
  const counts = oceanIntelligenceCounts(state, project.id);
  const updated = formatRelativeUpdated(counts.lastUpdatedIso);

  return (
    <header
      className="ocean-workspace-header"
      data-testid="ocean-workspace-header"
    >
      <div className="ocean-workspace-header-main">
        <div className="ocean-project-identity">
          <h1 className="ocean-project-title">{project.name}</h1>
          <p className="ocean-project-subtitle">
            <span className="ocean-project-code">{project.code}</span>
            <span aria-hidden> · </span>
            <span>{updated}</span>
          </p>
          <DeleteProjectButton project={project} />
        </div>
        <div
          className="ocean-workspace-usage"
          data-testid="ocean-workspace-usage"
        >
          <p className="ocean-workspace-usage-mark">
            <MeMark size="standard" />
            <span>AI token use</span>
          </p>
          <p className="ocean-workspace-usage-count">
            {usage.remaining} of {usage.limit} local analyses left this month
          </p>
          <Link
            href="/account"
            className="ocean-usage-spending"
            data-testid="ocean-usage-spending"
          >
            Usage &amp; spending →
          </Link>
        </div>
      </div>
    </header>
  );
}
