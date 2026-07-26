"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { StatusPill } from "@/components/DashboardChrome";
import { ProjectKnowledgeBrief } from "@/components/ProjectKnowledgeBrief";
import { ProjectTimelineGantt } from "@/components/ProjectTimelineGantt";
import {
  formatWhen,
  meetingOpeningScripts,
  projectReleases,
  projectTodos,
  suggestedMeetings,
  suggestedTodos,
  upcomingMeetings,
} from "@/lib/selectors";
import { useMission } from "@/lib/store";
import type { Project, RecommendationUrgency } from "@/lib/types";

const URGENCY: Record<RecommendationUrgency, string> = {
  now: "bg-signal text-paper",
  today: "bg-signal-soft text-signal",
  this_week: "bg-teal-soft text-teal",
  watch: "bg-mist-deep text-ink-soft",
};

function Widget({
  title,
  count,
  children,
  className = "",
}: {
  title: string;
  count?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`widget ${className}`}>
      <header className="widget-header">
        <h3>{title}</h3>
        {typeof count === "number" ? (
          <span className="widget-count">{count}</span>
        ) : null}
      </header>
      <div className="widget-body">{children}</div>
    </section>
  );
}

export function ProjectWidgetGrid({
  project,
  dense = false,
}: {
  project: Project;
  dense?: boolean;
}) {
  const {
    state,
    acceptSuggestion,
    dismissSuggestion,
    toggleTodo,
    removeTodo,
  } = useMission();

  const todos = projectTodos(state, project.id);
  const suggestions = suggestedTodos(state, project.id);
  const meetings = suggestedMeetings(state, project.id);
  const scripts = meetingOpeningScripts(state, project.id);
  const scheduled = upcomingMeetings(state, project.id);
  const release = projectReleases(state, project.id)[0];
  const isReleaseOps = project.kind === "release_ops";

  return (
    <section className="project-block">
      <div className="project-block-header">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/projects/${project.id}`}
              className="brand-mark text-base font-bold tracking-tight hover:text-teal md:text-lg"
            >
              {project.code}
            </Link>
            <span className="truncate text-sm text-ink-soft">{project.name}</span>
            <StatusPill status={project.status} />
            {isReleaseOps ? (
              <span className="rounded bg-mist-deep px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                Release ops
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-xs text-ink-soft md:text-sm">
            {project.currentFocus}
            {release ? ` · ${release.name}` : ""}
            {isReleaseOps && scheduled.length
              ? ` · ${scheduled.length} process meetings`
              : ""}
          </p>
        </div>
        <Link
          href={`/projects/${project.id}`}
          className="shrink-0 text-xs font-medium text-teal hover:underline"
        >
          Open
        </Link>
      </div>

      <div
        className={`grid gap-2 ${
          isReleaseOps
            ? "md:grid-cols-2 xl:grid-cols-[1.35fr_0.9fr_0.9fr_0.9fr]"
            : "md:grid-cols-2 xl:grid-cols-4"
        }`}
      >
        <Widget
          title={isReleaseOps ? "Process to do" : "To do"}
          count={todos.filter((t) => !t.done).length}
          className={isReleaseOps ? "widget-emphasis" : ""}
        >
          {todos.length === 0 ? (
            <p className="empty">Accept a suggestion to build your list.</p>
          ) : (
            <ul className="space-y-1">
              {todos.map((todo) => (
                <li key={todo.id} className="todo-row">
                  <label className="flex min-w-0 flex-1 items-start gap-2">
                    <input
                      type="checkbox"
                      checked={todo.done}
                      onChange={() => toggleTodo(todo.id)}
                      className="mt-0.5"
                    />
                    <span className={todo.done ? "done" : ""}>
                      <span className="title">{todo.title}</span>
                      {todo.detail ? (
                        <span className="detail">{todo.detail}</span>
                      ) : null}
                    </span>
                  </label>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => removeTodo(todo.id)}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget title="Suggested to do" count={suggestions.length}>
          {suggestions.length === 0 ? (
            <p className="empty">No suggestions right now.</p>
          ) : (
            <ul className="space-y-2">
              {suggestions
                .slice(0, isReleaseOps || dense ? 6 : 4)
                .map((rec) => (
                  <li key={rec.id} className="suggest-row">
                    <div className="flex items-center gap-1.5">
                      <span className={`pill ${URGENCY[rec.urgency]}`}>
                        {rec.urgency.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="title">{rec.title}</p>
                    <p className="why">{rec.why}</p>
                    <div className="actions">
                      <button
                        type="button"
                        onClick={() => acceptSuggestion(rec.id)}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="muted"
                        onClick={() => dismissSuggestion(rec.id)}
                      >
                        Dismiss
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </Widget>

        <Widget
          title={isReleaseOps ? "Process meetings" : "Suggested meetings"}
          count={isReleaseOps ? scheduled.length : meetings.length}
        >
          {isReleaseOps ? (
            scheduled.length === 0 ? (
              <p className="empty">No upcoming process meetings.</p>
            ) : (
              <ul className="space-y-2">
                {scheduled.map((m) => (
                  <li key={m.id} className="suggest-row">
                    <Link
                      href={`/meetings/${m.id}`}
                      className="title hover:text-teal"
                    >
                      {m.title}
                    </Link>
                    <p className="meta">{formatWhen(m.startsAt)}</p>
                    <p className="why">
                      Bring:{" "}
                      {m.prep.decisionsToObtain[0] ?? m.prep.objectives[0]}
                    </p>
                  </li>
                ))}
              </ul>
            )
          ) : meetings.length === 0 ? (
            <p className="empty">No meeting suggestions.</p>
          ) : (
            <ul className="space-y-2">
              {meetings.map((m) => (
                <li key={m.id} className="suggest-row">
                  <div className="flex items-center gap-1.5">
                    <span className={`pill ${URGENCY[m.urgency]}`}>
                      {m.urgency.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p className="title">{m.title}</p>
                  {m.withWhom.length ? (
                    <p className="meta">With {m.withWhom.join(", ")}</p>
                  ) : null}
                  <p className="why">{m.why}</p>
                  {m.recommendationId ? (
                    <div className="actions">
                      <button
                        type="button"
                        onClick={() => acceptSuggestion(m.recommendationId!)}
                      >
                        Add to to-do
                      </button>
                      <button
                        type="button"
                        className="muted"
                        onClick={() =>
                          dismissSuggestion(m.recommendationId!)
                        }
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget title="Opening scripts" count={scripts.length}>
          {scripts.length === 0 ? (
            <p className="empty">No upcoming meetings with scripts.</p>
          ) : (
            <ul className="space-y-2">
              {scripts.map(({ meeting, openingScript }) => (
                <li key={meeting.id} className="script-row">
                  <div className="flex items-baseline justify-between gap-2">
                    <Link
                      href={`/meetings/${meeting.id}`}
                      className="title hover:text-teal"
                    >
                      {meeting.title}
                    </Link>
                    <span className="meta shrink-0">
                      {formatWhen(meeting.startsAt)}
                    </span>
                  </div>
                  <p className="script">{openingScript}</p>
                  <button
                    type="button"
                    className="copy"
                    onClick={() =>
                      void navigator.clipboard.writeText(openingScript)
                    }
                  >
                    Copy opening
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Widget>
      </div>

      <ProjectTimelineGantt projectId={project.id} />
      <ProjectKnowledgeBrief projectId={project.id} />
    </section>
  );
}
