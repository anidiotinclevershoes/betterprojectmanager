"use client";

import { useState } from "react";
import { CaptureCoachRow } from "@/components/capture/CaptureCoachRow";
import { NewProjectExperience } from "@/components/onboarding/NewProjectExperience";
import { WorkspaceCustomiser } from "@/components/workspace/WorkspaceCustomiser";
import { WorkspaceFrameRow } from "@/components/workspace/WorkspaceGrid";
import { useWorkspaceLayout } from "@/lib/workspace/useWorkspaceLayout";
import { useMission } from "@/lib/store";

export default function OverviewPage() {
  const { hydrated, state, saveError, saveStatus, persistenceMode } = useMission();
  const {
    frames,
    toggleFrame,
    moveFrame,
    setFrameSize,
    resetLayout,
  } = useWorkspaceLayout("overview");
  const [customiseOpen, setCustomiseOpen] = useState(false);

  if (!hydrated) {
    return (
      <div className="workspace-page">
        <p className="empty-copy">Loading workspace…</p>
      </div>
    );
  }

  const zeroProjects = state.projects.length === 0;
  // Only replace empty onboarding when load/save failed — never hide a
  // successfully hydrated workspace because a later mutation errored.
  const hydrateProblem =
    zeroProjects &&
    persistenceMode === "supabase" &&
    saveStatus === "error" &&
    Boolean(saveError);

  if (hydrateProblem) {
    return (
      <div className="workspace-page">
        <div className="login-card auth-card" role="alert">
          <p className="eyebrow">Workspace</p>
          <h1>Could not load your projects</h1>
          <p className="lede">{saveError}</p>
          <button
            type="button"
            className="primary-btn"
            onClick={() => window.location.reload()}
          >
            Refresh
          </button>
          <p className="empty-copy">
            Still stuck? <a href="/login">Sign in again</a>
          </p>
        </div>
      </div>
    );
  }

  if (zeroProjects) {
    return (
      <div className="workspace-page np-first-run-page">
        <NewProjectExperience variant="first-run" />
      </div>
    );
  }

  return (
    <div className="workspace-page">
      <CaptureCoachRow />

      <div className="workspace-toolbar workspace-toolbar-end">
        <button
          type="button"
          className="ghost-btn"
          onClick={() => setCustomiseOpen(true)}
        >
          Customise workspace
        </button>
      </div>

      <WorkspaceFrameRow frames={frames} />

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
