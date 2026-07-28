"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CaptureWorkspace } from "@/components/capture/CaptureWorkspace";
import { CloneRelOpsButton } from "@/components/CloneRelOpsButton";
import { StatusPill } from "@/components/DashboardChrome";
import { ProjectKnowledgeBrief } from "@/components/ProjectKnowledgeBrief";
import { ProjectWidgetGrid } from "@/components/ProjectWidgetGrid";
import { WorkspaceCustomiser } from "@/components/workspace/WorkspaceCustomiser";
import { WorkspaceFrameRow } from "@/components/workspace/WorkspaceGrid";
import { getPlaybookStage } from "@/lib/release-playbook";
import {
  daysUntil,
  formatWhen,
  projectReleases,
  toDateInputValue,
  upcomingMeetings,
} from "@/lib/selectors";
import { useMission } from "@/lib/store";
import { useWorkspaceLayout } from "@/lib/workspace/useWorkspaceLayout";

type ProjectTab = "overview" | "work" | "meetings" | "knowledge" | "timeline" | "release";

export default function ProjectDashboardPage() {
  const params = useParams<{ id: string }>();
  const { state, hydrated } = useMission();
  const project = state.projects.find((p) => p.id === params.id);
  const [tab, setTab] = useState<ProjectTab>("overview");
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
  const meetings = upcomingMeetings(state, project.id);
  const due = daysUntil(project.nextMilestoneAt);
  const stage = release ? getPlaybookStage(release.currentStage) : null;
  const isReleaseOps = project.kind === "release_ops";

  const tabs: { id: ProjectTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "work", label: "Work" },
    { id: "meetings", label: "Meetings" },
    { id: "knowledge", label: "Knowledge" },
    { id: "timeline", label: "Timeline" },
    ...(isReleaseOps || release ? [{ id: "release" as const, label: "Release" }] : []),
  ];

  return (
    <div className="workspace-page">
      <div className="project-identity">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={project.status} />
            {isReleaseOps ? (
              <span className="tag">Release ops</span>
            ) : null}
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

      <nav className="project-tabs" aria-label="Project sections">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`project-tab ${tab === item.id ? "is-active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {(tab === "overview" || tab === "work") && (
        <>
          <CaptureWorkspace defaultProjectId={project.id} />
          <div className="workspace-toolbar">
            <p className="meta">{tab === "work" ? "Work frames" : "Project frames"}</p>
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
          {tab === "overview" ? (
            <div className="mt-4">
              <ProjectKnowledgeBrief projectId={project.id} />
            </div>
          ) : null}
        </>
      )}

      {tab === "meetings" ? (
        <section className="workspace-frame">
          <header className="workspace-frame-header">
            <h2>Meetings</h2>
          </header>
          <div className="workspace-frame-body">
            {meetings.length === 0 ? (
              <p className="empty-copy">No upcoming meetings for this project.</p>
            ) : (
              <ul className="frame-list">
                {meetings.map((m) => (
                  <li key={m.id} className="frame-row">
                    <Link href={`/meetings/${m.id}`} className="frame-row-title">
                      {m.title}
                    </Link>
                    <span className="meta">{formatWhen(m.startsAt)}</span>
                    <Link href={`/meetings/${m.id}`} className="ghost-btn">
                      Open brief
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      {tab === "knowledge" ? (
        <div className="space-y-4">
          <ProjectKnowledgeBrief projectId={project.id} />
          <ProjectWidgetGrid project={project} dense />
        </div>
      ) : null}

      {tab === "timeline" ? (
        <WorkspaceFrameRow
          frames={frames.filter((f) => f.type === "timeline").map((f) => ({
            ...f,
            visible: true,
          }))}
          projectId={project.id}
        />
      ) : null}

      {tab === "release" ? (
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
                {isReleaseOps ? (
                  <div className="mt-3">
                    <CloneRelOpsButton projectId={project.id} />
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>
      ) : null}

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
