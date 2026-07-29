"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CaptureCoachRow } from "@/components/capture/CaptureCoachRow";
import { CloneRelOpsButton } from "@/components/CloneRelOpsButton";
import { StatusPill } from "@/components/DashboardChrome";
import { ProjectKnowledgeBrief } from "@/components/ProjectKnowledgeBrief";
import { ProjectTimelineGantt } from "@/components/ProjectTimelineGantt";
import { WorkspaceCustomiser } from "@/components/workspace/WorkspaceCustomiser";
import { WorkspaceFrameRow } from "@/components/workspace/WorkspaceGrid";
import { getPlaybookStage } from "@/lib/release-playbook";
import {
  daysUntil,
  projectReleases,
  toDateInputValue,
} from "@/lib/selectors";
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

  const release = projectReleases(state, project.id)[0];
  const due = daysUntil(project.nextMilestoneAt);
  const stage = release ? getPlaybookStage(release.currentStage) : null;
  const isReleaseOps = project.kind === "release_ops";

  return (
    <div className="workspace-page project-scroll">
      <div className="project-identity">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={project.status} />
            {isReleaseOps ? <span className="tag">Release ops</span> : null}
          </div>
          <p className="project-focus">
            {project.currentFocus}
            {project.nextMilestone
              ? ` · ${project.nextMilestone}${due !== null ? ` (${due >= 0 ? `${due}d` : "overdue"})` : ""}`
              : ""}
            {isReleaseOps && project.mergeDate && project.releaseDate
              ? ` · merge ${toDateInputValue(project.mergeDate)} → release ${toDateInputValue(project.releaseDate)}`
              : ""}
          </p>
        </div>
        {isReleaseOps ? <CloneRelOpsButton projectId={project.id} /> : null}
      </div>

      <CaptureCoachRow defaultProjectId={project.id} />

      <div className="workspace-toolbar">
        <p className="meta">Project workspace</p>
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

      <section className="workspace-frame">
        <header className="workspace-frame-header">
          <h2>Knowledge</h2>
        </header>
        <div className="workspace-frame-body">
          <ProjectKnowledgeBrief projectId={project.id} />
        </div>
      </section>

      <section className="workspace-frame">
        <header className="workspace-frame-header">
          <h2>Project timeline</h2>
        </header>
        <div className="workspace-frame-body">
          <ProjectTimelineGantt projectId={project.id} />
        </div>
      </section>

      {(isReleaseOps || release) && (
        <section className="workspace-frame">
          <header className="workspace-frame-header">
            <h2>Release</h2>
            <Link href="/releases" className="ghost-btn">
              Playbook
            </Link>
          </header>
          <div className="workspace-frame-body">
            {!release ? (
              <p className="empty-copy">No active release.</p>
            ) : (
              <>
                <p className="frame-row-title">
                  {release.name} · {stage?.label}
                </p>
                <ul className="mt-2 space-y-1">
                  {release.risks.slice(0, 6).map((r) => (
                    <li key={r} className="meta text-[var(--danger)]">
                      • {r}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>
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
