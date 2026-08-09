"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CaptureCoachRow } from "@/components/capture/CaptureCoachRow";
import { CloneRelOpsButton } from "@/components/CloneRelOpsButton";
import { ProjectKnowledgeBrief } from "@/components/ProjectKnowledgeBrief";
import { WorkspaceCustomiser } from "@/components/workspace/WorkspaceCustomiser";
import { WorkspaceFrame } from "@/components/workspace/WorkspaceFrame";
import { WorkspaceFrameRow } from "@/components/workspace/WorkspaceGrid";
import { useMission } from "@/lib/store";
import { useWorkspaceLayout } from "@/lib/workspace/useWorkspaceLayout";

export default function ProjectDashboardPage() {
  const params = useParams<{ id: string }>();
  const { state, hydrated } = useMission();
  const project = state.projects.find((p) => p.id === params.id);
  const [customiseOpen, setCustomiseOpen] = useState(false);
  const layoutScope = project ? `project:${project.id}` : "overview";
  const {
    frames,
    toggleFrame,
    moveFrame,
    setFrameSize,
    resetLayout,
  } = useWorkspaceLayout(layoutScope);

  if (!project) {
    return (
      <div className="workspace-frame p-6">
        <p className="empty-copy">Project not found.</p>
        <Link href="/" className="ghost-btn mt-2 inline-flex">
          ← Overview
        </Link>
      </div>
    );
  }

  const isReleaseOps = project.kind === "release_ops";

  return (
    <div className="workspace-page project-scroll">
      {isReleaseOps ? (
        <div className="project-identity project-identity-compact">
          <span className="tag">Release ops</span>
          <CloneRelOpsButton projectId={project.id} />
        </div>
      ) : null}

      {/* Capture is the fixed top workspace layer — always above project frames. */}
      <CaptureCoachRow defaultProjectId={project.id} />

      <div className="project-workspace-transition" aria-label="Project workspace">
        <div className="project-workspace-rule" aria-hidden />
        <div className="project-workspace-identity">
          <span
            className={`project-workspace-accent is-status-${project.status}`}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="project-workspace-name">{project.name}</p>
            <p className="project-workspace-label">Project Workspace</p>
          </div>
        </div>
        <div className="project-workspace-rule" aria-hidden />
      </div>

      <div className="workspace-toolbar workspace-toolbar-end">
        <button
          type="button"
          className="ghost-btn"
          onClick={() => setCustomiseOpen(true)}
        >
          Customise workspace
        </button>
      </div>

      {!hydrated ? (
        <p className="empty-copy">Loading…</p>
      ) : (
        <WorkspaceFrameRow frames={frames} projectId={project.id} />
      )}

      <WorkspaceFrame type="knowledge" title="Knowledge">
        <ProjectKnowledgeBrief projectId={project.id} />
      </WorkspaceFrame>

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
