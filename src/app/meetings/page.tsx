"use client";

import Link from "next/link";
import { useMission } from "@/lib/store";

export default function MeetingsPage() {
  const { state } = useMission();
  const meetings = [...state.meetings].sort(
    (a, b) =>
      new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 md:px-8 md:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
        Meeting strategy
      </p>
      <h1 className="brand-mark mt-3 max-w-3xl text-4xl font-extrabold tracking-tight md:text-5xl">
        Prepare to lead every room
      </h1>
      <p className="coach-voice mt-4 max-w-2xl text-xl leading-relaxed text-ink-soft">
        Objectives, opening script, decisions to obtain, risks to surface, and
        the leadership moments that make you the person running the project.
      </p>

      <div className="mt-12 space-y-0 divide-y divide-line border-t border-line">
        {meetings.map((meeting) => {
          const project = state.projects.find((p) => p.id === meeting.projectId);
          return (
            <Link
              key={meeting.id}
              href={`/meetings/${meeting.id}`}
              className="block py-8 transition hover:bg-mist/40"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-ink-soft">
                    {project?.code ?? "Project"} · {meeting.phase.replaceAll("_", " ")}
                  </p>
                  <h2 className="brand-mark mt-2 text-2xl font-bold md:text-3xl">
                    {meeting.title}
                  </h2>
                </div>
                <p className="text-sm text-ink-soft">
                  {new Date(meeting.startsAt).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink">
                Obtain: {meeting.prep.decisionsToObtain[0]}
              </p>
              <p className="mt-2 text-sm text-teal">
                Watch for: {meeting.prep.risksToDiscuss[0]}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
