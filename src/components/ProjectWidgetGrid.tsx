"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { CloneRelOpsButton } from "@/components/CloneRelOpsButton";
import { DetailModal } from "@/components/DetailModal";
import { ProjectKnowledgeBrief } from "@/components/ProjectKnowledgeBrief";
import { ProjectTimelineGantt } from "@/components/ProjectTimelineGantt";
import {
  formatDue,
  formatWhen,
  meetingOpeningScripts,
  projectReleases,
  projectSuggestions,
  projectTodos,
  toDateInputValue,
  upcomingMeetings,
} from "@/lib/selectors";
import { useMission } from "@/lib/store";
import type {
  Meeting,
  Project,
  Recommendation,
  RecommendationUrgency,
  TodoItem,
} from "@/lib/types";

const URGENCY: Record<RecommendationUrgency, string> = {
  now: "bg-signal text-paper",
  today: "bg-signal-soft text-signal",
  this_week: "bg-teal-soft text-teal",
  watch: "bg-mist-deep text-ink-soft",
};

type DetailTarget =
  | { type: "todo"; todo: TodoItem }
  | { type: "suggestion"; rec: Recommendation }
  | { type: "script"; meeting: Meeting; script: string }
  | { type: "meeting"; meeting: Meeting };

function Widget({
  title,
  count,
  children,
  className = "",
  actions,
}: {
  title: string;
  count?: number;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={`widget ${className}`}>
      <header className="widget-header">
        <h3>{title}</h3>
        <div className="flex items-center gap-2">
          {actions}
          {typeof count === "number" ? (
            <span className="widget-count">{count}</span>
          ) : null}
        </div>
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
    updateTodo,
    updateTodoDueDate,
    refreshSuggestions,
  } = useMission();

  const [detail, setDetail] = useState<DetailTarget | null>(null);

  const todos = projectTodos(state, project.id);
  const suggestions = projectSuggestions(state, project.id);
  const scripts = meetingOpeningScripts(state, project.id);
  const scheduled = upcomingMeetings(state, project.id);
  const release = projectReleases(state, project.id)[0];
  const isReleaseOps = project.kind === "release_ops";

  const dueMin = toDateInputValue(project.mergeDate);
  const dueMax = toDateInputValue(project.releaseDate);

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
            {isReleaseOps ? (
              <span className="rounded bg-mist-deep px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                Release ops
                {project.releaseMonth ? ` · ${project.releaseMonth}` : ""}
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
        <div className="flex shrink-0 items-center gap-2">
          {isReleaseOps ? <CloneRelOpsButton projectId={project.id} /> : null}
          <Link
            href={`/projects/${project.id}`}
            className="text-xs font-medium text-teal hover:underline"
          >
            Open
          </Link>
        </div>
      </div>

      <div
        className={`grid gap-2 ${
          isReleaseOps
            ? "md:grid-cols-2 xl:grid-cols-[1.2fr_1.2fr_0.9fr]"
            : "md:grid-cols-2 xl:grid-cols-3"
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
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <input
                      type="checkbox"
                      checked={todo.done}
                      onChange={() => toggleTodo(todo.id)}
                      className="mt-0.5"
                      aria-label={`Mark ${todo.title} done`}
                    />
                    <span className={todo.done ? "done" : ""}>
                      <button
                        type="button"
                        className="title title-btn"
                        onClick={() => setDetail({ type: "todo", todo })}
                      >
                        {todo.title}
                      </button>
                      {todo.detail ? (
                        <span className="detail">{todo.detail}</span>
                      ) : null}
                      <span className="due-row">
                        <input
                          type="date"
                          className="due-input"
                          value={toDateInputValue(todo.dueAt)}
                          min={dueMin || undefined}
                          max={dueMax || undefined}
                          onChange={(e) =>
                            updateTodoDueDate(
                              todo.id,
                              e.target.value || undefined,
                            )
                          }
                          aria-label="Due date"
                        />
                        {formatDue(todo.dueAt) ? (
                          <span className="due-label">
                            {formatDue(todo.dueAt)}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </div>
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

        <Widget
          title="Suggestions"
          count={suggestions.length}
          actions={
            <button
              type="button"
              className="widget-action"
              onClick={() => refreshSuggestions(project.id)}
            >
              Refresh
            </button>
          }
        >
          {suggestions.length === 0 ? (
            <p className="empty">
              No suggestions — refresh after updating knowledge.
            </p>
          ) : (
            <ul className="space-y-2">
              {suggestions
                .slice(0, isReleaseOps || dense ? 8 : 6)
                .map((rec) => (
                  <li key={rec.id} className="suggest-row">
                    <div className="flex items-center gap-1.5">
                      <span className={`pill ${URGENCY[rec.urgency]}`}>
                        {rec.urgency.replaceAll("_", " ")}
                      </span>
                      {(rec.kind === "meeting" ||
                        rec.kind === "meeting_prep") && (
                        <span className="pill bg-mist-deep text-ink-soft">
                          meeting
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="title title-btn"
                      onClick={() => setDetail({ type: "suggestion", rec })}
                    >
                      {rec.title}
                    </button>
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
          title={isReleaseOps ? "Process meetings / scripts" : "Opening scripts"}
          count={isReleaseOps ? scheduled.length : scripts.length}
        >
          {isReleaseOps ? (
            scheduled.length === 0 ? (
              <p className="empty">No upcoming process meetings.</p>
            ) : (
              <ul className="space-y-2">
                {scheduled.map((m) => (
                  <li key={m.id} className="script-row">
                    <div className="flex items-baseline justify-between gap-2">
                      <button
                        type="button"
                        className="title title-btn"
                        onClick={() =>
                          setDetail({
                            type: "script",
                            meeting: m,
                            script: m.prep.openingScript,
                          })
                        }
                      >
                        {m.title}
                      </button>
                      <span className="meta shrink-0">
                        {formatWhen(m.startsAt)}
                      </span>
                    </div>
                    <p className="script">{m.prep.openingScript}</p>
                    <div className="flex gap-2">
                      <Link href={`/meetings/${m.id}`} className="copy">
                        Open meeting
                      </Link>
                      <button
                        type="button"
                        className="copy"
                        onClick={() =>
                          void navigator.clipboard.writeText(
                            m.prep.openingScript,
                          )
                        }
                      >
                        Copy opening
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : scripts.length === 0 ? (
            <p className="empty">No upcoming meetings with scripts.</p>
          ) : (
            <ul className="space-y-2">
              {scripts.map(({ meeting, openingScript }) => (
                <li key={meeting.id} className="script-row">
                  <div className="flex items-baseline justify-between gap-2">
                    <button
                      type="button"
                      className="title title-btn"
                      onClick={() =>
                        setDetail({
                          type: "script",
                          meeting,
                          script: openingScript,
                        })
                      }
                    >
                      {meeting.title}
                    </button>
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

      <DetailModal
        open={Boolean(detail)}
        title={detailTitle(detail)}
        onClose={() => setDetail(null)}
        footer={
          detail?.type === "suggestion" ? (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="muted-btn"
                onClick={() => {
                  dismissSuggestion(detail.rec.id);
                  setDetail(null);
                }}
              >
                Dismiss
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  acceptSuggestion(detail.rec.id);
                  setDetail(null);
                }}
              >
                Accept to to-do
              </button>
            </div>
          ) : detail?.type === "todo" ? (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="muted-btn"
                onClick={() => setDetail(null)}
              >
                Done
              </button>
            </div>
          ) : detail?.type === "script" ? (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="primary-btn"
                onClick={() =>
                  void navigator.clipboard.writeText(detail.script)
                }
              >
                Copy opening
              </button>
              <Link href={`/meetings/${detail.meeting.id}`} className="primary-btn">
                Open meeting
              </Link>
            </div>
          ) : null
        }
      >
        {detail?.type === "todo" ? (
          <div className="space-y-3">
            <label className="field">
              <span>Title</span>
              <input
                value={detail.todo.title}
                onChange={(e) => {
                  const title = e.target.value;
                  updateTodo(detail.todo.id, { title });
                  setDetail({
                    type: "todo",
                    todo: { ...detail.todo, title },
                  });
                }}
              />
            </label>
            <label className="field">
              <span>Detail</span>
              <textarea
                className="todo-edit-area"
                rows={4}
                value={detail.todo.detail ?? ""}
                placeholder="Add anything that was missed…"
                onChange={(e) => {
                  const detailText = e.target.value;
                  updateTodo(detail.todo.id, { detail: detailText });
                  setDetail({
                    type: "todo",
                    todo: {
                      ...detail.todo,
                      detail: detailText || undefined,
                    },
                  });
                }}
              />
            </label>
            <label className="field">
              <span>Due date</span>
              <input
                type="date"
                value={toDateInputValue(detail.todo.dueAt)}
                min={dueMin || undefined}
                max={dueMax || undefined}
                onChange={(e) => {
                  updateTodoDueDate(
                    detail.todo.id,
                    e.target.value || undefined,
                  );
                  setDetail({
                    type: "todo",
                    todo: {
                      ...detail.todo,
                      dueAt: e.target.value
                        ? new Date(`${e.target.value}T09:00:00`).toISOString()
                        : undefined,
                    },
                  });
                }}
              />
            </label>
            {dueMin && dueMax ? (
              <p className="text-xs text-ink-soft">
                Window {dueMin} → {dueMax}
              </p>
            ) : null}
          </div>
        ) : null}
        {detail?.type === "suggestion" ? (
          <div className="space-y-3 text-sm">
            <p>
              <span className={`pill ${URGENCY[detail.rec.urgency]}`}>
                {detail.rec.urgency.replaceAll("_", " ")}
              </span>
            </p>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                Action
              </p>
              <p className="mt-1 leading-relaxed">{detail.rec.action}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                Why
              </p>
              <p className="mt-1 leading-relaxed text-ink-soft">{detail.rec.why}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                Leadership impact
              </p>
              <p className="mt-1 leading-relaxed">{detail.rec.leadershipImpact}</p>
            </div>
            {detail.rec.suggestedScript ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                  Suggested script
                </p>
                <p className="mt-1 font-[family-name:var(--font-source-serif)] leading-relaxed">
                  {detail.rec.suggestedScript}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
        {detail?.type === "script" ? (
          <div className="space-y-3 text-sm">
            <p className="text-xs text-ink-soft">
              {formatWhen(detail.meeting.startsAt)}
              {detail.meeting.attendees.length
                ? ` · ${detail.meeting.attendees.join(", ")}`
                : ""}
            </p>
            <p className="font-[family-name:var(--font-source-serif)] leading-relaxed">
              {detail.script}
            </p>
            {detail.meeting.prep.objectives[0] ? (
              <p className="text-xs text-ink-soft">
                Objective: {detail.meeting.prep.objectives[0]}
              </p>
            ) : null}
          </div>
        ) : null}
      </DetailModal>
    </section>
  );
}

function detailTitle(detail: DetailTarget | null) {
  if (!detail) return "";
  if (detail.type === "todo") return "Edit to-do";
  if (detail.type === "suggestion") return detail.rec.title;
  return detail.meeting.title;
}
