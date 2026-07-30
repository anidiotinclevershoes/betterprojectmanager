"use client";

import { useMemo, useState } from "react";
import { DetailModal } from "@/components/DetailModal";
import { daysUntil } from "@/lib/selectors";
import { relativeDue, todoOriginLabel } from "@/lib/workspace/frames-data";
import {
  isInteractiveTarget,
  itemLimitFor,
} from "@/lib/workspace/packing";
import type { FrameSize } from "@/lib/workspace/layout";
import { useMission } from "@/lib/store";
import type { TodoItem } from "@/lib/types";

export function TodoFrame({
  projectId,
  size = "wide",
}: {
  projectId?: string | null;
  size?: FrameSize | string;
}) {
  const { state, toggleTodo, removeTodo, addTodo, updateTodo } = useMission();
  const [title, setTitle] = useState("");
  const [edit, setEdit] = useState<TodoItem | null>(null);
  const [viewAll, setViewAll] = useState(false);
  const limit = itemLimitFor(size);

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

  const todos = allOpen.slice(0, limit);
  const overflow = allOpen.length > limit;

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

      {allOpen.length === 0 ? (
        <p className="empty-copy">
          No open tasks here. Add one manually or capture an update.
        </p>
      ) : (
        <>
          <ul className="frame-list">
            {todos.map((todo) => (
              <TodoRow
                key={todo.id}
                todo={todo}
                projectLabel={projectCode(todo.projectId)}
                onOpen={() => setEdit(todo)}
                onToggle={() => toggleTodo(todo.id)}
                onRemove={() => removeTodo(todo.id)}
              />
            ))}
          </ul>
          {overflow ? (
            <div className="frame-footer">
              <span className="meta">
                Showing {todos.length} of {allOpen.length}
              </span>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setViewAll(true)}
              >
                View all
              </button>
            </div>
          ) : null}
        </>
      )}

      <DetailModal
        open={viewAll}
        onClose={() => setViewAll(false)}
        title="All to-dos"
      >
        <ul className="frame-list">
          {allOpen.map((todo) => (
            <TodoRow
              key={todo.id}
              todo={todo}
              projectLabel={projectCode(todo.projectId)}
              onOpen={() => {
                setViewAll(false);
                setEdit(todo);
              }}
              onToggle={() => toggleTodo(todo.id)}
              onRemove={() => removeTodo(todo.id)}
            />
          ))}
        </ul>
      </DetailModal>

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

function TodoRow({
  todo,
  projectLabel,
  onOpen,
  onToggle,
  onRemove,
}: {
  todo: TodoItem;
  projectLabel: string;
  onOpen: () => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <li
      className="frame-row is-card-clickable"
      onClick={(e) => {
        if (isInteractiveTarget(e.target)) return;
        onOpen();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if (isInteractiveTarget(e.target)) return;
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <input
        type="checkbox"
        checked={todo.done}
        onChange={onToggle}
        aria-label={`Complete ${todo.title}`}
      />
      <button type="button" className="frame-row-title" onClick={onOpen}>
        {todo.title}
      </button>
      <span className="tag">{projectLabel}</span>
      {relativeDue(todo) ? (
        <span className="meta">{relativeDue(todo)}</span>
      ) : null}
      <span className="origin">{todoOriginLabel(todo)}</span>
      <button
        type="button"
        className="ghost-btn"
        aria-label="Remove"
        onClick={onRemove}
      >
        ×
      </button>
    </li>
  );
}
