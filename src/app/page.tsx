"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { CaptureBar } from "@/components/CaptureBar";
import { DetailModal } from "@/components/DetailModal";
import { FocusLenses, FocusSection } from "@/components/FocusLenses";
import { TodayBrief } from "@/components/TodayBrief";
import { buildTodayStrip, type FocusLens } from "@/lib/focus";
import {
  formatDue,
  formatWhen,
  genericTodos,
  portfolioPertinent,
  toDateInputValue,
} from "@/lib/selectors";
import { useMission } from "@/lib/store";
import type { Recommendation, TodoItem } from "@/lib/types";

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

  const [lens, setLens] = useState<FocusLens>("everything");
  const [genericTitle, setGenericTitle] = useState("");
  const [genericDue, setGenericDue] = useState("");
  const [detailRec, setDetailRec] = useState<Recommendation | null>(null);
  const [detailTodo, setDetailTodo] = useState<TodoItem | null>(null);

  const board = hydrated ? portfolioPertinent(state) : null;
  const personal = hydrated ? genericTodos(state) : [];
  const strip = useMemo(
    () => (hydrated ? buildTodayStrip(state) : null),
    [hydrated, state],
  );

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
    <div className="command-centre">
      <div className="today-bar">
        <div>
          <p className="today-greeting">{strip?.greeting ?? "Welcome"}</p>
          <h1 className="today-headline">
            {strip
              ? strip.attentionCount === 0
                ? "Nothing is shouting today."
                : `${strip.attentionCount} thing${strip.attentionCount === 1 ? "" : "s"} need attention.`
              : "Loading…"}
          </h1>
          <p className="today-summary">{strip?.summaryLine}</p>
        </div>
        <FocusLenses value={lens} onChange={setLens} />
      </div>

      <CaptureBar compact />

      {!hydrated || !board || !strip ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <>
          <FocusSection lens="today" active={lens}>
            <TodayBrief nudges={strip.nudges} />
          </FocusSection>

          <div className="command-grid">
            <FocusSection lens="today" active={lens} className="command-span">
              <Section
                question="What needs my attention?"
                count={strip.nudges.length}
              >
                {strip.nudges.length === 0 ? (
                  <p className="empty">No loud nudges right now.</p>
                ) : (
                  <ul className="nudge-list dense">
                    {strip.nudges.map((n) => (
                      <li key={n.id} className={`nudge-item accent-${n.accent}`}>
                        <span className="nudge-dot" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="nudge-text">
                            {n.projectCode ? (
                              <span className="nudge-code">{n.projectCode}</span>
                            ) : null}
                            {n.text}
                          </p>
                        </div>
                        {n.href ? (
                          <Link href={n.href} className="nudge-link">
                            Open
                          </Link>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </FocusSection>

            <FocusSection lens="todo" active={lens}>
              <Section
                question="What needs doing?"
                count={board.dueSoon.filter((x) => !x.todo.done).length}
              >
                {board.dueSoon.length === 0 ? (
                  <p className="empty">Nothing due in the next 7 days.</p>
                ) : (
                  <ul className="dense-list">
                    {board.dueSoon.map(({ todo, project }) => (
                      <li key={todo.id} className="dense-row">
                        <input
                          type="checkbox"
                          checked={todo.done}
                          onChange={() => toggleTodo(todo.id)}
                          aria-label={todo.title}
                        />
                        <button
                          type="button"
                          className="dense-title"
                          onClick={() => setDetailTodo(todo)}
                        >
                          {todo.title}
                        </button>
                        <span className="dense-meta">
                          {project?.code ?? "Personal"}
                          {formatDue(todo.dueAt)
                            ? ` · ${formatDue(todo.dueAt)}`
                            : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </FocusSection>

            <FocusSection lens="meetings" active={lens}>
              <Section
                question="What am I walking into?"
                count={board.meetingsSoon.length}
              >
                {board.meetingsSoon.length === 0 ? (
                  <p className="empty">No meetings in the next 5 days.</p>
                ) : (
                  <ul className="dense-list">
                    {board.meetingsSoon.map((m) => {
                      const project = state.projects.find(
                        (p) => p.id === m.projectId,
                      );
                      return (
                        <li key={m.id} className="dense-row">
                          <Link
                            href={`/meetings/${m.id}`}
                            className="dense-title"
                          >
                            {m.title}
                          </Link>
                          <span className="dense-meta">
                            {project?.code ?? "—"} · {formatWhen(m.startsAt)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Section>
            </FocusSection>

            <FocusSection lens="risks" active={lens}>
              <Section
                question="What might surprise me?"
                count={board.urgentSuggestions.length}
              >
                {board.urgentSuggestions.length === 0 ? (
                  <p className="empty">No urgent suggestions.</p>
                ) : (
                  <ul className="dense-list">
                    {board.urgentSuggestions.map((rec) => {
                      const project = state.projects.find(
                        (p) => p.id === rec.projectId,
                      );
                      return (
                        <li key={rec.id} className="dense-row stack">
                          <button
                            type="button"
                            className="dense-title"
                            onClick={() => setDetailRec(rec)}
                          >
                            {rec.title}
                          </button>
                          <span className="dense-meta">
                            {project?.code ?? "—"} · {rec.urgency.replaceAll("_", " ")}
                          </span>
                          <div className="dense-actions">
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
              </Section>
            </FocusSection>

            <FocusSection lens="release" active={lens}>
              <Section
                question="What milestones are close?"
                count={board.milestones.length}
              >
                {board.milestones.length === 0 ? (
                  <p className="empty">No milestones in the next 10 days.</p>
                ) : (
                  <ul className="dense-list">
                    {board.milestones.map(({ project, days, label }) => (
                      <li key={project.id} className="dense-row">
                        <Link
                          href={`/projects/${project.id}`}
                          className="dense-title"
                        >
                          {project.code} — {label}
                        </Link>
                        <span className="dense-meta">
                          {days !== null && days < 0
                            ? `${Math.abs(days)}d overdue`
                            : days === 0
                              ? "today"
                              : `in ${days}d`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </FocusSection>

            <FocusSection lens="todo" active={lens} className="command-span">
              <Section
                question="Personal — what else?"
                count={personal.filter((t) => !t.done).length}
              >
                <div className="personal-add">
                  <input
                    className="generic-input"
                    value={genericTitle}
                    onChange={(e) => setGenericTitle(e.target.value)}
                    placeholder="e.g. Update timesheet"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitGeneric();
                    }}
                  />
                  <input
                    type="date"
                    className="due-input"
                    value={genericDue}
                    onChange={(e) => setGenericDue(e.target.value)}
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
                  <p className="empty">No personal items yet.</p>
                ) : (
                  <ul className="dense-list">
                    {personal.map((todo) => (
                      <li key={todo.id} className="dense-row">
                        <input
                          type="checkbox"
                          checked={todo.done}
                          onChange={() => toggleTodo(todo.id)}
                        />
                        <button
                          type="button"
                          className="dense-title"
                          onClick={() => setDetailTodo(todo)}
                        >
                          {todo.title}
                        </button>
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
              </Section>
            </FocusSection>
          </div>
        </>
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
            <p className="leading-relaxed text-muted">{detailRec.why}</p>
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
          </div>
        ) : null}
      </DetailModal>
    </div>
  );
}

function Section({
  question,
  count,
  children,
}: {
  question: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="command-section">
      <header className="command-section-header">
        <h2>{question}</h2>
        {typeof count === "number" ? (
          <span className="command-count">{count}</span>
        ) : null}
      </header>
      <div className="command-section-body">{children}</div>
    </section>
  );
}
