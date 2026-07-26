"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CaptureBar } from "@/components/CaptureBar";
import { CloneRelOpsButton } from "@/components/CloneRelOpsButton";
import { StatusPill } from "@/components/DashboardChrome";
import { ProjectWidgetGrid } from "@/components/ProjectWidgetGrid";
import { getPlaybookStage } from "@/lib/release-playbook";
import {
  daysUntil,
  formatWhen,
  projectMemories,
  projectReleases,
  silentStakeholders,
  toDateInputValue,
  upcomingMeetings,
} from "@/lib/selectors";
import { useMission } from "@/lib/store";

export default function ProjectDashboardPage() {
  const params = useParams<{ id: string }>();
  const { state } = useMission();
  const project = state.projects.find((p) => p.id === params.id);

  if (!project) {
    return (
      <div className="panel p-6">
        <p className="text-sm text-ink-soft">Project not found.</p>
        <Link href="/" className="mt-2 inline-block text-sm text-teal">
          ← Overview
        </Link>
      </div>
    );
  }

  const release = projectReleases(state, project.id)[0];
  const meetings = upcomingMeetings(state, project.id);
  const memories = projectMemories(state, project.id).slice(0, 4);
  const silent = silentStakeholders(project);
  const due = daysUntil(project.nextMilestoneAt);
  const stage = release ? getPlaybookStage(release.currentStage) : null;
  const isReleaseOps = project.kind === "release_ops";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="brand-mark text-xl font-extrabold tracking-tight md:text-2xl">
              {project.code}
            </h1>
            <StatusPill status={project.status} />
            {isReleaseOps ? (
              <span className="rounded bg-mist-deep px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                Release ops
              </span>
            ) : null}
          </div>
          <p className="text-sm text-ink-soft">{project.name}</p>
          <p className="mt-1 text-xs text-ink-soft">
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

      <CaptureBar defaultProjectId={project.id} compact />

      <ProjectWidgetGrid project={project} dense />

      <div className="mt-2 grid gap-2 md:grid-cols-3">
        <section className="widget">
          <header className="widget-header">
            <h3>Release</h3>
          </header>
          <div className="widget-body">
            {!release ? (
              <p className="empty">No active release.</p>
            ) : (
              <>
                <p className="todo-row">
                  <span className="title">
                    {release.name} · {stage?.label}
                  </span>
                </p>
                <ul className="mt-1 space-y-1">
                  {release.risks.slice(0, 3).map((r) => (
                    <li key={r} className="text-[0.68rem] text-signal">
                      • {r}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/releases"
                  className="mt-2 inline-block text-[0.65rem] font-semibold text-teal"
                >
                  Playbook →
                </Link>
              </>
            )}
          </div>
        </section>

        <section className="widget">
          <header className="widget-header">
            <h3>Upcoming meetings</h3>
            <span className="widget-count">{meetings.length}</span>
          </header>
          <div className="widget-body">
            {meetings.length === 0 ? (
              <p className="empty">None scheduled.</p>
            ) : (
              <ul className="space-y-2">
                {meetings.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/meetings/${m.id}`}
                      className="text-[0.78rem] font-semibold hover:text-teal"
                    >
                      {m.title}
                    </Link>
                    <p className="text-[0.65rem] text-ink-soft">
                      {formatWhen(m.startsAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="widget">
          <header className="widget-header">
            <h3>Stakeholders / memory</h3>
          </header>
          <div className="widget-body">
            {silent.length > 0 ? (
              <p className="mb-2 text-[0.68rem] text-signal">
                Silent: {silent.map((s) => s.name).join(", ")}
              </p>
            ) : null}
            <ul className="space-y-2">
              {memories.map((m) => (
                <MemoryExpandRow
                  key={m.id}
                  title={m.title}
                  content={m.content}
                />
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

function MemoryExpandRow({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button
        type="button"
        className="w-full text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <p className="text-[0.72rem] font-semibold hover:text-teal">{title}</p>
        <p
          className={`text-[0.65rem] leading-relaxed text-ink-soft ${
            open ? "" : "line-clamp-2"
          }`}
        >
          {content}
        </p>
        <span className="mt-0.5 inline-block text-[0.58rem] font-semibold uppercase tracking-[0.06em] text-teal">
          {open ? "Show less" : "Expand"}
        </span>
      </button>
    </li>
  );
}
