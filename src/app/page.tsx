"use client";

import Link from "next/link";
import {
  PageHeader,
  Panel,
  StatTile,
  StatusPill,
} from "@/components/DashboardChrome";
import { CaptureBar } from "@/components/CaptureBar";
import {
  RecommendationItem,
  RecommendationLink,
} from "@/components/RecommendationItem";
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

export default function OverviewPage() {
  const { state, setRecommendationStatus, hydrated } = useMission();

  const moves = activeRecommendations(state);
  const urgentMoves = moves.filter(
    (r) => r.urgency === "now" || r.urgency === "today",
  );
  const meetings = upcomingMeetings(state);
  const releases = projectReleases(state);
  const riskSignals = releases.reduce((n, r) => n + releaseRiskCount(r), 0);
  const silentCount = state.projects.reduce(
    (n, p) => n + silentStakeholders(p).length,
    0,
  );
  const recentMemory = projectMemories(state).slice(0, 4);

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="What needs your leadership today"
        description="Capture anything at the top — type or speak. AI tidies the ramble and updates your brief."
      />

      <CaptureBar />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          className="animate-rise"
          label="Moves due now / today"
          value={hydrated ? urgentMoves.length : "—"}
          hint={`${moves.length} active coaching moves`}
          tone={urgentMoves.length > 0 ? "signal" : "teal"}
        />
        <StatTile
          className="animate-rise-delay-1"
          label="Meetings to lead"
          value={hydrated ? meetings.length : "—"}
          hint={
            meetings[0]
              ? `Next: ${meetings[0].title}`
              : "No upcoming meetings"
          }
        />
        <StatTile
          className="animate-rise-delay-2"
          label="Release risk signals"
          value={hydrated ? riskSignals : "—"}
          hint={
            releases[0]
              ? `${releases[0].name} in focus`
              : "No active releases"
          }
          tone={riskSignals > 0 ? "watch" : "default"}
        />
        <StatTile
          className="animate-rise-delay-3"
          label="Silent stakeholders"
          value={hydrated ? silentCount : "—"}
          hint="No contact in 14+ days"
          tone={silentCount > 0 ? "signal" : "default"}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.9fr]">
        <Panel
          title="Priority coaching"
          action={
            <span className="text-xs text-ink-soft">
              {moves.length} active
            </span>
          }
        >
          {!hydrated ? (
            <p className="text-sm text-ink-soft">Loading operational memory…</p>
          ) : moves.length === 0 ? (
            <p className="coach-voice text-base text-ink-soft">
              No active coaching moves. Capture a note and I will analyse what
              changed.
            </p>
          ) : (
            moves.slice(0, 4).map((rec) => (
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
            title="Next meeting"
            action={
              meetings[0] ? (
                <Link
                  href={`/meetings/${meetings[0].id}`}
                  className="text-xs font-medium text-teal hover:underline"
                >
                  Open strategy
                </Link>
              ) : null
            }
          >
            {meetings[0] ? (
              <div>
                <h3 className="brand-mark text-lg font-bold">
                  {meetings[0].title}
                </h3>
                <p className="mt-1 text-sm text-ink-soft">
                  {formatWhen(meetings[0].startsAt)}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-ink">
                  Obtain: {meetings[0].prep.decisionsToObtain[0]}
                </p>
                <p className="mt-2 text-sm text-signal">
                  Watch: {meetings[0].prep.risksToDiscuss[0]}
                </p>
              </div>
            ) : (
              <p className="text-sm text-ink-soft">No upcoming meetings.</p>
            )}
          </Panel>

          <Panel
            title="Release watch"
            action={
              <Link
                href="/releases"
                className="text-xs font-medium text-teal hover:underline"
              >
                Playbook
              </Link>
            }
          >
            {releases.length === 0 ? (
              <p className="text-sm text-ink-soft">No active releases.</p>
            ) : (
              <ul className="space-y-4">
                {releases.map((release) => {
                  const project = state.projects.find(
                    (p) => p.id === release.projectId,
                  );
                  const due = daysUntil(release.targetDate);
                  const atRisk = release.stages.filter(
                    (s) =>
                      s.status === "at_risk" || s.status === "blocked",
                  );
                  return (
                    <li key={release.id}>
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-semibold text-ink">
                          {project?.code} · {release.name}
                        </p>
                        <p className="text-xs text-ink-soft">
                          {due !== null
                            ? due >= 0
                              ? `${due}d`
                              : "overdue"
                            : ""}
                        </p>
                      </div>
                      <p className="mt-1 text-xs uppercase tracking-[0.12em] text-teal">
                        {release.currentStage.replaceAll("_", " ")}
                      </p>
                      {atRisk.length > 0 ? (
                        <p className="mt-2 text-sm text-signal">
                          At risk:{" "}
                          {atRisk.map((s) => s.label).join(", ")}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Projects">
          <ul className="divide-y divide-line">
            {state.projects.map((project) => {
              const projectMoves = activeRecommendations(state, project.id);
              const silent = silentStakeholders(project);
              return (
                <li key={project.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/projects/${project.id}`}
                      className="brand-mark text-lg font-bold hover:text-teal"
                    >
                      {project.code}
                      <span className="ml-2 text-sm font-medium text-ink-soft">
                        {project.name}
                      </span>
                    </Link>
                    <StatusPill status={project.status} />
                  </div>
                  <p className="mt-2 text-sm text-ink-soft">
                    {project.currentFocus}
                  </p>
                  <p className="mt-2 text-xs text-ink-soft">
                    {projectMoves.length} coaching moves · {silent.length}{" "}
                    silent stakeholders
                  </p>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel
          title="Recent memory"
          action={
            <Link
              href="/memory"
              className="text-xs font-medium text-teal hover:underline"
            >
              Search all
            </Link>
          }
        >
          <ul className="divide-y divide-line">
            {recentMemory.map((memory) => (
              <li key={memory.id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                  {memory.type.replaceAll("_", " ")}
                </p>
                <p className="mt-1 text-sm font-medium text-ink">
                  {memory.title}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-soft">
                  {memory.content}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {moves.length > 4 ? (
        <Panel title="More coaching moves" className="mt-5">
          {moves.slice(4).map((rec) => (
            <RecommendationLink
              key={rec.id}
              href={rec.projectId ? `/projects/${rec.projectId}` : "/"}
              recommendation={rec}
            />
          ))}
        </Panel>
      ) : null}
    </div>
  );
}
