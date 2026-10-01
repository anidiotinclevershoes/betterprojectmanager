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
 * Page 03 project identity plus the compact local-usage callout.
 * Desktop is the only project top chrome. Narrow chrome omits the callout.
 * OPEN — USAGE METER: local analysis allowance is informational and is not durable billing usage.
 * Delete project stays on the meta line. Page 03 does not place it; the control is kept so the existing durable delete capability remains reachable.
 */
export function ProjectWorkspaceHeader({ project }: { project: Project }) {
  const { state } = useMission();
  const usage = analysesRemaining(state);
  const counts = oceanIntelligenceCounts(state, project.id);
  const updated = formatRelativeUpdated(counts.lastUpdatedIso);
  const allowance =
    "Local analysis allowance is informational and is not billing entitlement.";

  return (
    <header
      className="ocean-workspace-header"
      data-testid="ocean-workspace-header"
    >
      <div className="ocean-project-identity">
        <h1 className="ocean-project-title" data-testid="ocean-project-title">
          {project.name}
        </h1>
        <p className="ocean-project-subtitle" data-testid="ocean-project-meta">
          <span className="ocean-project-code">{project.code}</span>
          <span aria-hidden> · </span>
          <span className="ocean-project-updated">{updated}</span>
          <DeleteProjectButton project={project} />
        </p>
      </div>
      <div
        className="ocean-workspace-usage"
        data-testid="ocean-workspace-usage"
        role="group"
        aria-label={allowance}
        title={allowance}
      >
        <MeMark size="standard" />
        <div className="ocean-usage-copy">
          <p className="ocean-usage-line">
            AI usage · {usage.remaining} local analyses left
          </p>
          <Link
            href="/account"
            className="ocean-usage-account"
            data-testid="ocean-usage-account"
          >
            Account &amp; billing →
          </Link>
        </div>
      </div>
    </header>
  );
}
