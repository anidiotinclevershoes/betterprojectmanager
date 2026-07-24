"use client";

import { CaptureBar } from "@/components/CaptureBar";
import {
  PageHeader,
  Panel,
  StatTile,
  StatusPill,
} from "@/components/DashboardChrome";
import { RecommendationItem } from "@/components/RecommendationItem";
import { getPlaybookStage } from "@/lib/release-playbook";
import {
  activeRecommendations,
  daysUntil,
  formatWhen,
  projectMemories,
  projectReleases,
  releaseRiskCount,
  silentStakeholders,
  upcomingMeetings,
} from "@/lib/selectors";
import { useMission } from "@/lib/store";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ProjectDashboardPage() {
  const params = useParams<{ id: string }>();
  const { state, setRecommendationStatus, hydrated } = useMission();
  const project = state.projects.find((p) => p.id === params.id);

  if (!project) {
    return (
      <div className="panel p-8">
        <p className="text-ink-soft">Project not found.</p>
        <Link href="/" className="mt-3 inline-block text-sm text-teal">
          ← Back to overview
        </Link>
      </div>
    );
  }

  const moves = activeRecommendations(state, project.id);
  const urgent = moves.filter(
    (r) => r.urgency === "now" || r.urgency === "today",
  );
  const meetings = upcomingMeetings(state, project.id);
  const releases = projectReleases(state, project.id);
  const release = releases[0];
  const memories = projectMemories(state, project.id).slice(0, 5);
  const silent = silentStakeholders(project);
  const due = daysUntil(project.nextMilestoneAt);

  return (
    <div>
      <PageHeader
        eyebrow={project.code}
        title={project.name}
        description={project.summary}
        actions={<StatusPill status={project.status} />}
      />

      <CaptureBar defaultProjectId={project.id} compact />

      <div className="mb-5 panel px-4 py-3 md:px-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
          Current focus
        </p>
        <p className="mt-1 text-sm font-medium text-ink md:text-base">
          {project.currentFocus}
        </p>
        {project.nextMilestone ? (
          <p className="mt-1 text-sm text-ink-soft">
            Next milestone: {project.nextMilestone}
            {due !== null ? ` · ${due >= 0 ? `${due} days` : "overdue"}` : ""}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Coaching moves"
          value={hydrated ? moves.length : "—"}
          hint={`${urgent.length} due now / today`}
          tone={urgent.length > 0 ? "signal" : "default"}
        />
        <StatTile
          label="Meetings ahead"
          value={hydrated ? meetings.length : "—"}
          hint={meetings[0] ? formatWhen(meetings[0].startsAt) : "None scheduled"}
        />
        <StatTile
          label="Release risks"
          value={
            hydrated ? (release ? releaseRiskCount(release) : 0) : "—"
          }
          hint={release ? release.name : "No active release"}
          tone={
            release && releaseRiskCount(release) > 0 ? "watch" : "default"
          }
        />
        <StatTile
          label="Silent stakeholders"
          value={hydrated ? silent.length : "—"}
          hint={`${project.stakeholders.length} total stakeholders`}
          tone={silent.length > 0 ? "signal" : "teal"}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.9fr]">
        <Panel title="Lead these next">
          {!hydrated ? (
            <p className="text-sm text-ink-soft">Loading…</p>
          ) : moves.length === 0 ? (
            <p className="text-sm text-ink-soft">
              No active coaching for this project. Capture something new.
            </p>
          ) : (
            moves.map((rec) => (
              <RecommendationItem
                key={rec.id}
                recommendation={rec}
                compact
                onDone={() => setRecommendationStatus(rec.id, "done")}
                onDismiss={() => setRecommendationStatus(rec.id, "dismissed")}
              />
            ))
          )}
        </Panel>

        <div className="space-y-5">
          <Panel
            title="Meetings to lead"
            action={
              <Link
                href="/meetings"
                className="text-xs font-medium text-teal hover:underline"
              >
                All meetings
              </Link>
            }
          >
            {meetings.length === 0 ? (
              <p className="text-sm text-ink-soft">No upcoming meetings.</p>
            ) : (
              <ul className="divide-y divide-line">
                {meetings.map((meeting) => (
                  <li key={meeting.id} className="py-3 first:pt-0 last:pb-0">
                    <Link
                      href={`/meetings/${meeting.id}`}
                      className="font-semibold text-ink hover:text-teal"
                    >
                      {meeting.title}
                    </Link>
                    <p className="mt-1 text-xs text-ink-soft">
                      {formatWhen(meeting.startsAt)}
                    </p>
                    <p className="mt-2 text-sm text-ink-soft">
                      Obtain: {meeting.prep.decisionsToObtain[0]}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Release playbook"
            action={
              <Link
                href="/releases"
                className="text-xs font-medium text-teal hover:underline"
              >
                Full view
              </Link>
            }
          >
            {!release ? (
              <p className="text-sm text-ink-soft">No active release.</p>
            ) : (
              <div>
                <p className="brand-mark text-lg font-bold">{release.name}</p>
                <p className="mt-1 text-sm text-teal">
                  {getPlaybookStage(release.currentStage)?.label}
                </p>
                <p className="coach-voice mt-3 text-sm leading-relaxed text-ink-soft">
                  {getPlaybookStage(release.currentStage)?.coachingFocus}
                </p>
                <ul className="mt-4 space-y-2">
                  {release.stages
                    .filter(
                      (s) =>
                        s.status === "current" ||
                        s.status === "at_risk" ||
                        s.status === "blocked",
                    )
                    .map((stage) => (
                      <li key={stage.stage} className="text-sm">
                        <span className="font-medium text-ink">
                          {stage.label}
                        </span>
                        {stage.missingArtefacts?.length ? (
                          <span className="text-signal">
                            {" "}
                            — missing {stage.missingArtefacts.join(", ")}
                          </span>
                        ) : null}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </Panel>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Stakeholders">
          <ul className="divide-y divide-line">
            {project.stakeholders.map((person) => {
              const isSilent = silent.some((s) => s.id === person.id);
              return (
                <li key={person.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium text-ink">{person.name}</p>
                    {isSilent ? (
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-signal">
                        Needs update
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-ink-soft">{person.role}</p>
                  {person.concerns?.[0] ? (
                    <p className="mt-2 text-sm text-ink-soft">
                      Concern: {person.concerns[0]}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel
          title="Project memory"
          action={
            <Link
              href="/memory"
              className="text-xs font-medium text-teal hover:underline"
            >
              Search
            </Link>
          }
        >
          <ul className="divide-y divide-line">
            {memories.map((memory) => (
              <li key={memory.id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                  {memory.type.replaceAll("_", " ")}
                </p>
                <p className="mt-1 text-sm font-medium">{memory.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-ink-soft">
                  {memory.content}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
