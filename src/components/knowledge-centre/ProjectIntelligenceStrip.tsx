"use client";

import { analysesRemaining } from "@/lib/workspace/history";
import {
  formatRelativeUpdated,
  oceanIntelligenceCounts,
} from "@/lib/knowledge-centre/ocean-counts";
import { useMission } from "@/lib/store";
import { useTellMeSession } from "@/components/tell-me/TellMeSessionContext";

/**
 * Compact persistent Lume status strip (Ocean baseline).
 * Catch Me Up is a project *mode* (`ProjectModeSelector` + `CatchMeUpPanel`),
 * not a strip control. Black Widow should mount briefing UI in that panel.
 */
export function ProjectIntelligenceStrip({ projectId }: { projectId: string }) {
  const { state } = useMission();
  const { refresh, refreshing } = useTellMeSession();
  const counts = oceanIntelligenceCounts(state, projectId);
  const usage = analysesRemaining(state);

  return (
    <div className="ocean-intel-strip" data-testid="ocean-intel-strip">
      <div className="ocean-intel-strip-stats" aria-label="Project intelligence">
        <span className="ocean-intel-stat">
          <span className="ocean-intel-stat-ico" aria-hidden>
            ✦
          </span>
          I know <strong>{counts.thingsKnown}</strong> things
        </span>
        <span className="ocean-intel-stat">
          I see <strong>{counts.openRisks}</strong> risks
        </span>
        {counts.dependencies > 0 ? (
          <span className="ocean-intel-stat">
            I see <strong>{counts.dependencies}</strong> dependencies
          </span>
        ) : (
          <span className="ocean-intel-stat ocean-intel-stat-muted">
            Dependencies not structured yet
          </span>
        )}
        <span className="ocean-intel-stat ocean-intel-stat-muted">
          {formatRelativeUpdated(counts.lastUpdatedIso)}
        </span>
      </div>
      <div className="ocean-intel-strip-actions">
        <button
          type="button"
          className="ocean-refresh-btn"
          onClick={() => void refresh()}
          disabled={refreshing}
          data-testid="ocean-refresh"
        >
          <span className="ocean-ai-glyph" aria-hidden>
            ✦
          </span>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
        <span
          className="ocean-actions-left"
          data-testid="ocean-actions-left"
          title="Local analysis allowance meter — not billing entitlement"
        >
          {usage.remaining} actions left
        </span>
      </div>
    </div>
  );
}
