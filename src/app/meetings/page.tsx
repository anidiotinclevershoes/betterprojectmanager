"use client";

import Link from "next/link";
import { PageHeader, Panel } from "@/components/DashboardChrome";
import { formatWhen } from "@/lib/selectors";
import { useMission } from "@/lib/store";

export default function MeetingsPage() {
  const { state } = useMission();
  const meetings = [...state.meetings].sort(
    (a, b) =>
      new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );

  return (
    <div>
      <PageHeader
        eyebrow="Meetings"
        title="Prepare to lead every room"
        description="Objectives, opening scripts, decisions to obtain and the leadership moments that make you the person running the project."
      />

      <Panel title={`${meetings.length} meetings`}>
        <div className="divide-y divide-line">
          {meetings.map((meeting) => {
            const project = state.projects.find(
              (p) => p.id === meeting.projectId,
            );
            return (
              <Link
                key={meeting.id}
                href={`/meetings/${meeting.id}`}
                className="block py-4 first:pt-0 last:pb-0 transition hover:bg-mist/30 -mx-1 rounded-md px-1"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                      {project?.code} · {meeting.phase.replaceAll("_", " ")}
                    </p>
                    <h2 className="brand-mark mt-1 text-xl font-bold">
                      {meeting.title}
                    </h2>
                  </div>
                  <p className="text-sm text-ink-soft">
                    {formatWhen(meeting.startsAt)}
                  </p>
                </div>
                <p className="mt-2 text-sm text-ink">
                  Obtain: {meeting.prep.decisionsToObtain[0]}
                </p>
                <p className="mt-1 text-sm text-signal">
                  Watch: {meeting.prep.risksToDiscuss[0]}
                </p>
              </Link>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
