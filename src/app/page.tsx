"use client";

import { useState } from "react";
import { CaptureCoachRow } from "@/components/capture/CaptureCoachRow";
import { WorkspaceCustomiser } from "@/components/workspace/WorkspaceCustomiser";
import { WorkspaceFrameRow } from "@/components/workspace/WorkspaceGrid";
import { useWorkspaceLayout } from "@/lib/workspace/useWorkspaceLayout";
import { useMission } from "@/lib/store";

export default function OverviewPage() {
  const { hydrated } = useMission();
  const {
    frames,
    toggleFrame,
    moveFrame,
    setFrameSize,
    resetLayout,
  } = useWorkspaceLayout("overview");
  const [customiseOpen, setCustomiseOpen] = useState(false);

  return (
    <div className="workspace-page">
      <CaptureCoachRow />

      <div className="workspace-toolbar">
        <p className="meta">Workspace frames</p>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => setCustomiseOpen(true)}
        >
          Customise workspace
        </button>
      </div>

      {!hydrated ? (
        <p className="empty-copy">Loading workspace…</p>
      ) : (
        <WorkspaceFrameRow frames={frames} />
      )}

      <WorkspaceCustomiser
        open={customiseOpen}
        onClose={() => setCustomiseOpen(false)}
        frames={frames}
        onToggle={toggleFrame}
        onMove={moveFrame}
        onSize={setFrameSize}
        onReset={resetLayout}
      />
    </div>
  );
}
