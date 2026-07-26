"use client";

import Link from "next/link";
import { useState } from "react";
import { CaptureBar } from "@/components/CaptureBar";
import { DetailModal } from "@/components/DetailModal";
import {
  formatDue,
  formatWhen,
  genericTodos,
  portfolioPertinent,
  toDateInputValue,
} from "@/lib/selectors";
import { useMission } from "@/lib/store";
import type { Recommendation, RecommendationUrgency, TodoItem } from "@/lib/types";

const URGENCY: Record<RecommendationUrgency, string> = {
  now: "bg-signal text-paper",
  today: "bg-signal-soft text-signal",
  this_week: "bg-teal-soft text-teal",
  watch: "bg-mist-deep text-ink-soft",
};

export default function OverviewPage() {
  const {
    state,
    hydrated,
    toggleTodo,
    removeTodo,
    addTodo,
    updateTodo,
    updateTodoDueDate,
    acceptSuggestion,
    dismissSuggestion,
  } = useMission();

  const [genericTitle, setGenericTitle] = useState("");
  const [genericDue, setGenericDue] = useState("");
  const [detailRec, setDetailRec] = useState<Recommendation | null>(null);
  const [detailTodo, setDetailTodo] = useState<TodoItem | null>(null);

  const board = hydrated ? portfolioPertinent(state) : null;
  const personal = hydrated ? genericTodos(state) : [];

  const submitGeneric = () => {
    if (!genericTitle.trim()) return;
    addTodo({
      title: genericTitle,
      projectId: null,
      dueAt: genericDue || undefined,
    });
    setGenericTitle("");
    setGenericDue("");
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="brand-mark text-xl font-extrabold tracking-tight md:text-2xl">
            Overview
          </h1>
          <p className="text-xs text-ink-soft md:text-sm">
            Closest deadlines and highest-urgency items across the portfolio —
            not every project board.
          </p>
        </div>
      </div>

      <CaptureBar compact />

      {!hydrated || !board ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : (
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          <section className="widget">
            <header className="widget-header">
              <h3>Due soon</h3>
              <span className="widget-count">{board.dueSoon.length}</span>
            </header>
            <div className="widget-body">
              {board.dueSoon.length === 0 ? (
                <p className="empty">Nothing due in the next 7 days.</p>
              ) : (
                <ul className="space-y-1">
                  {board.dueSoon.map(({ todo, project }) => (
                    <li key={todo.id} className="todo-row">
                      <label className="flex min-w-0 flex-1 items-start gap-2">
                        <input
                          type="checkbox"
                          checked={todo.done}
                          onChange={() => toggleTodo(todo.id)}
                          className="mt-0.5"
                        />
                        <span>
                          <button
                            type="button"
                            className="title title-btn"
                            onClick={() => setDetailTodo(todo)}
                          >
                            {todo.title}
                          </button>
                          <span className="detail">
                            {project ? project.code : "Personal"}
                            {formatDue(todo.dueAt)
                              ? ` · ${formatDue(todo.dueAt)}`
                              : ""}
                          </span>
                        </span>
                      </label>
                      {project ? (
                        <Link
                          href={`/projects/${project.id}`}
                          className="text-[10px] font-semibold text-teal"
                        >
                          Open
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="widget">
            <header className="widget-header">
              <h3>Urgent suggestions</h3>
              <span className="widget-count">
                {board.urgentSuggestions.length}
              </span>
            </header>
            <div className="widget-body">
              {board.urgentSuggestions.length === 0 ? (
                <p className="empty">No now/today suggestions.</p>
              ) : (
                <ul className="space-y-2">
                  {board.urgentSuggestions.map((rec) => {
                    const project = state.projects.find(
                      (p) => p.id === rec.projectId,
                    );
                    return (
                      <li key={rec.id} className="suggest-row">
                        <div className="flex items-center gap-1.5">
                          <span className={`pill ${URGENCY[rec.urgency]}`}>
                            {rec.urgency.replaceAll("_", " ")}
                          </span>
                          {project ? (
                            <span className="meta">{project.code}</span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="title title-btn"
                          onClick={() => setDetailRec(rec)}
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
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className="widget">
            <header className="widget-header">
              <h3>Meetings this week</h3>
              <span className="widget-count">{board.meetingsSoon.length}</span>
            </header>
            <div className="widget-body">
              {board.meetingsSoon.length === 0 ? (
                <p className="empty">No meetings in the next 5 days.</p>
              ) : (
                <ul className="space-y-2">
                  {board.meetingsSoon.map((m) => {
                    const project = state.projects.find(
                      (p) => p.id === m.projectId,
                    );
                    return (
                      <li key={m.id} className="suggest-row">
                        <Link
                          href={`/meetings/${m.id}`}
                          className="title hover:text-teal"
                        >
                          {m.title}
                        </Link>
                        <p className="meta">
                          {project?.code ?? "—"} · {formatWhen(m.startsAt)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className="widget">
            <header className="widget-header">
              <h3>Near milestones</h3>
              <span className="widget-count">{board.milestones.length}</span>
            </header>
            <div className="widget-body">
              {board.milestones.length === 0 ? (
                <p className="empty">No milestones in the next 10 days.</p>
              ) : (
                <ul className="space-y-2">
                  {board.milestones.map(({ project, days, label }) => (
                    <li key={project.id} className="suggest-row">
                      <Link
                        href={`/projects/${project.id}`}
                        className="title hover:text-teal"
                      >
                        {project.code} — {label}
                      </Link>
                      <p className="meta">
                        {days !== null && days < 0
                          ? `${Math.abs(days)}d overdue`
                          : days === 0
                            ? "today"
                            : `in ${days}d`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="widget lg:col-span-2">
            <header className="widget-header">
              <h3>Personal / generic</h3>
              <span className="widget-count">
                {personal.filter((t) => !t.done).length}
              </span>
            </header>
            <div className="widget-body">
              <div className="mb-3 flex flex-wrap gap-2">
                <input
                  className="generic-input"
                  value={genericTitle}
                  onChange={(e) => setGenericTitle(e.target.value)}
                  placeholder="e.g. Update timesheet, Contact OneTrust"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitGeneric();
                  }}
                />
                <input
                  type="date"
                  className="due-input"
                  value={genericDue}
                  onChange={(e) => setGenericDue(e.target.value)}
                  aria-label="Due date"
                />
                <button
                  type="button"
                  className="primary-btn"
                  onClick={submitGeneric}
                >
                  Add
                </button>
              </div>
              {personal.length === 0 ? (
                <p className="empty">
                  Add items that are not tied to a project.
                </p>
              ) : (
                <ul className="space-y-1">
                  {personal.map((todo) => (
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
                            onClick={() => setDetailTodo(todo)}
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
                              onChange={(e) =>
                                updateTodoDueDate(
                                  todo.id,
                                  e.target.value || undefined,
                                )
                              }
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
            </div>
          </section>
        </div>
      )}

      <DetailModal
        open={Boolean(detailRec)}
        title={detailRec?.title ?? ""}
        onClose={() => setDetailRec(null)}
        footer={
          detailRec ? (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="muted-btn"
                onClick={() => {
                  dismissSuggestion(detailRec.id);
                  setDetailRec(null);
                }}
              >
                Dismiss
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  acceptSuggestion(detailRec.id);
                  setDetailRec(null);
                }}
              >
                Accept to to-do
              </button>
            </div>
          ) : null
        }
      >
        {detailRec ? (
          <div className="space-y-3 text-sm">
            <p className="leading-relaxed">{detailRec.action}</p>
            <p className="leading-relaxed text-ink-soft">{detailRec.why}</p>
            <p className="leading-relaxed">{detailRec.leadershipImpact}</p>
          </div>
        ) : null}
      </DetailModal>

      <DetailModal
        open={Boolean(detailTodo)}
        title="Edit to-do"
        onClose={() => setDetailTodo(null)}
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              className="muted-btn"
              onClick={() => setDetailTodo(null)}
            >
              Done
            </button>
          </div>
        }
      >
        {detailTodo ? (
          <div className="space-y-3">
            <label className="field">
              <span>Title</span>
              <input
                value={detailTodo.title}
                onChange={(e) => {
                  const title = e.target.value;
                  updateTodo(detailTodo.id, { title });
                  setDetailTodo({ ...detailTodo, title });
                }}
              />
            </label>
            <label className="field">
              <span>Detail</span>
              <textarea
                className="todo-edit-area"
                rows={4}
                value={detailTodo.detail ?? ""}
                placeholder="Add anything that was missed…"
                onChange={(e) => {
                  const detail = e.target.value;
                  updateTodo(detailTodo.id, { detail });
                  setDetailTodo({
                    ...detailTodo,
                    detail: detail || undefined,
                  });
                }}
              />
            </label>
            <label className="field">
              <span>Due date</span>
              <input
                type="date"
                value={toDateInputValue(detailTodo.dueAt)}
                onChange={(e) => {
                  updateTodoDueDate(
                    detailTodo.id,
                    e.target.value || undefined,
                  );
                  setDetailTodo({
                    ...detailTodo,
                    dueAt: e.target.value
                      ? new Date(`${e.target.value}T09:00:00`).toISOString()
                      : undefined,
                  });
                }}
              />
            </label>
          </div>
        ) : null}
      </DetailModal>
    </div>
  );
}
