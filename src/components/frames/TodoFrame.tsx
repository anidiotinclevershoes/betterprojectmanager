"use client";

import Link from "next/link";
import { useState } from "react";
import { DetailModal } from "@/components/DetailModal";
import { relativeDue, todoOriginLabel } from "@/lib/workspace/frames-data";
import { useMission } from "@/lib/store";
import type { TodoItem } from "@/lib/types";

export function TodoFrame({
  projectId,
}: {
  projectId?: string | null;
  size?: string;
}) {
  const { state, toggleTodo, removeTodo, addTodo, updateTodo } = useMission();
  const [title, setTitle] = useState("");
  const [edit, setEdit] = useState<TodoItem | null>(null);

  const todos = (state.todos ?? [])
    .filter((t) => !t.done)
    .filter((t) => (projectId ? t.projectId === projectId : true))
    .sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"));

  const projectCode = (id?: string | null) =>
    id ? state.projects.find((p) => p.id === id)?.code ?? "—" : "Personal";

  return (
    <div className="frame-body">
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

      {todos.length === 0 ? (
        <p className="empty-copy">
          No open tasks here. Add one manually or capture an update.
        </p>
      ) : (
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
      )}

      <DetailModal
        open={Boolean(edit)}
        title="Edit to-do"
        onClose={() => setEdit(null)}
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
