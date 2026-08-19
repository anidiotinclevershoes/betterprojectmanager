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
  const { state } = useMission();
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
    <div
      className="workspace-page project-scroll"
      data-project-id={project.id}
      data-project-code={project.code}
    >
      {/* Capture + Coach sit above the project-owned workspace. */}
      <CaptureCoachRow defaultProjectId={project.id} />

      <section
        className={`project-owned-workspace is-status-${project.status}`}
        aria-label={`${project.code} project workspace`}
      >
        <header className="project-workspace-boundary">
          <div className="project-workspace-identity">
            <h2 className="project-workspace-code">{project.code}</h2>
            <p className="project-workspace-name">{project.name}</p>
          </div>
          <div className="project-workspace-boundary-actions">
            {isReleaseOps ? (
              <div className="project-identity-compact">
                <span className="tag">Release ops</span>
                <CloneRelOpsButton projectId={project.id} />
              </div>
            ) : null}
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setCustomiseOpen(true)}
            >
              Customise workspace
            </button>
          </div>
        </header>

        <div className="project-owned-frames">
          <WorkspaceFrameRow frames={frames} projectId={project.id} />

          <WorkspaceFrame type="knowledge" title="Knowledge">
            <ProjectKnowledgeBrief projectId={project.id} />
          </WorkspaceFrame>
        </div>
      </section>

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
