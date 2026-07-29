"use client";

import { useMemo, useState } from "react";
import { DetailModal } from "@/components/DetailModal";
import { daysUntil } from "@/lib/selectors";
import { relativeDue, todoOriginLabel } from "@/lib/workspace/frames-data";
import { useMission } from "@/lib/store";
import type { TodoItem } from "@/lib/types";

const DASHBOARD_LIMIT = 8;

export function TodoFrame({
  projectId,
}: {
  projectId?: string | null;
  size?: string;
}) {
  const { state, toggleTodo, removeTodo, addTodo, updateTodo } = useMission();
  const [title, setTitle] = useState("");
  const [edit, setEdit] = useState<TodoItem | null>(null);
  const [showAll, setShowAll] = useState(false);

  const allOpen = useMemo(() => {
    return (state.todos ?? [])
      .filter((t) => !t.done)
      .filter((t) => (projectId ? t.projectId === projectId : true))
      .sort((a, b) => {
        const da = daysUntil(a.dueAt);
        const db = daysUntil(b.dueAt);
        const sa = da === null ? 999 : da;
        const sb = db === null ? 999 : db;
        return sa - sb;
      });
  }, [state.todos, projectId]);

  const todos = showAll ? allOpen : allOpen.slice(0, DASHBOARD_LIMIT);

  const projectCode = (id?: string | null) =>
    id ? state.projects.find((p) => p.id === id)?.code ?? "—" : "Personal";

  return (
    <div className="frame-body frame-body-scroll">
      <div className="frame-toolbar">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a to-do…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && title.trim()) {
              addTodo({ title, projectId: projectId ?? null });
              setTitle("");
            }
          }}
        />
        <button
          type="button"
          className="primary-btn"
          onClick={() => {
            if (!title.trim()) return;
            addTodo({ title, projectId: projectId ?? null });
            setTitle("");
          }}
        >
          Add
        </button>
      </div>

      {allOpen.length === 0 ? (
        <p className="empty-copy">
          No open tasks here. Add one manually or capture an update.
        </p>
      ) : (
        <>
          <ul className="frame-list">
            {todos.map((todo) => (
              <li key={todo.id} className="frame-row">
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={() => toggleTodo(todo.id)}
                  aria-label={`Complete ${todo.title}`}
                />
                <button
                  type="button"
                  className="frame-row-title"
                  onClick={() => setEdit(todo)}
                >
                  {todo.title}
                </button>
                <span className="tag">{projectCode(todo.projectId)}</span>
                {relativeDue(todo) ? (
                  <span className="meta">{relativeDue(todo)}</span>
                ) : null}
                <span className="origin">{todoOriginLabel(todo)}</span>
                <button
                  type="button"
                  className="ghost-btn"
                  aria-label="Remove"
                  onClick={() => removeTodo(todo.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="frame-footer">
            <span className="meta">
              Viewing {todos.length} of {allOpen.length} tasks
            </span>
            {allOpen.length > DASHBOARD_LIMIT ? (
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? "Show less" : "View all"}
              </button>
            ) : null}
          </div>
        </>
      )}

      <DetailModal
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        title="Task"
      >
        {edit ? (
          <label className="field">
            <span>Title</span>
            <input
              value={edit.title}
              onChange={(e) => {
                updateTodo(edit.id, { title: e.target.value });
                setEdit({ ...edit, title: e.target.value });
              }}
            />
          </label>
        ) : null}
      </DetailModal>
    </div>
  );
}
