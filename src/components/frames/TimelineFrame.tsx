"use client";

import Link from "next/link";
import { KcTimeline } from "@/components/knowledge-centre/KcTimeline";
import { useMission } from "@/lib/store";

/**
 * Production Timeline embed. Read-only projection only.
 * Legacy writable Gantt is unmounted from this surface — do not remount
 * that leftover editor here. Stored timeline rows stay as data.
 */
export function TimelineFrame({
  projectId,
  snapshot = false,
  onMeetingPrep,
}: {
  projectId?: string | null;
  snapshot?: boolean;
  size?: string;
  frameId?: string;
  onMeetingPrep?: (meetingId: string) => void;
}) {
  const { state } = useMission();

  if (projectId) {
    return (
      <div className="frame-body timeline-frame">
        <KcTimeline projectId={projectId} onMeetingPrep={onMeetingPrep} />
      </div>
    );
  }

  const projects = state.projects.slice(0, snapshot ? 3 : undefined);

  return (
    <div className="frame-body timeline-frame">
      <div className="frame-toolbar between">
        <p className="meta">Cross-project milestones and phases</p>
        <Link href="/releases" className="ghost-btn">
          Full timeline
        </Link>
      </div>
      {projects.length === 0 ? (
        <p className="empty-copy">
          No milestones or dated work yet. Capture a date or add a milestone.
        </p>
      ) : (
        <div className="timeline-stack">
          {projects.map((project) => (
            <div key={project.id} className="timeline-project-block">
              <div className="timeline-project-label">
                <Link href={`/projects/${project.id}`}>{project.code}</Link>
                <span className="meta">{project.name}</span>
              </div>
              <KcTimeline projectId={project.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
