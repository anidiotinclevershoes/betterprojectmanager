"use client";

import { useEffect, useMemo, useState } from "react";
import { DetailModal } from "@/components/DetailModal";
import { useFrameExpand } from "@/components/workspace/FrameExpandContext";
import { FRAME_TRANSITION_MS, isValidDateInput } from "@/lib/dates";
import { daysUntil, toDateInputValue } from "@/lib/selectors";
import { relativeDue, todoOriginLabel } from "@/lib/workspace/frames-data";
import type { FrameSize } from "@/lib/workspace/layout";
import {
  isInteractiveTarget,
  itemLimitFor,
} from "@/lib/workspace/packing";
import { useMission } from "@/lib/store";
import type { TodoItem } from "@/lib/types";

export function TodoFrame({
  projectId,
  size = "wide",
  frameId = "todo",
}: {
  projectId?: string | null;
  size?: FrameSize | string;
  frameId?: string;
}) {
  const { state, toggleTodo, removeTodo, addTodo, updateTodo } = useMission();
  const { isExpanded, expand, collapse } = useFrameExpand();
  const expanded = isExpanded(frameId);

  const [title, setTitle] = useState("");
  const [newProjectId, setNewProjectId] = useState(projectId ?? "");
  const [newDue, setNewDue] = useState("");
  const [edit, setEdit] = useState<TodoItem | null>(null);
  const [completing, setCompleting] = useState<Record<string, boolean>>({});
  const limit = itemLimitFor(size);

  useEffect(() => {
    setNewProjectId(projectId ?? "");
  }, [projectId]);

  const allOpen = useMemo(() => {
    return (state.todos ?? [])
      .filter((t) => !t.done || completing[t.id])
      .filter((t) => (projectId ? t.projectId === projectId : true))
      .sort((a, b) => {
        const da = daysUntil(a.dueAt);
        const db = daysUntil(b.dueAt);
        const sa = da === null ? 999 : da;
        const sb = db === null ? 999 : db;
        return sa - sb;
      });
  }, [state.todos, projectId, completing]);

  const todos = expanded ? allOpen : allOpen.slice(0, limit);
  const overflow = !expanded && allOpen.length > limit;

  const projectCode = (id?: string | null) =>
    id ? state.projects.find((p) => p.id === id)?.code ?? "—" : "Unassigned";

  function submitNew() {
    if (!title.trim()) return;
    if (newDue && !isValidDateInput(newDue)) return;
    addTodo({
      title,
      projectId: newProjectId || projectId || null,
      dueAt: newDue || undefined,
    });
    setTitle("");
    setNewDue("");
    if (!projectId) setNewProjectId("");
  }

  function completeTodo(todo: TodoItem) {
    if (completing[todo.id] || todo.done) return;
    setCompleting((prev) => ({ ...prev, [todo.id]: true }));
    window.setTimeout(() => {
      toggleTodo(todo.id);
      setCompleting((prev) => {
        const next = { ...prev };
        delete next[todo.id];
        return next;
      });
    }, FRAME_TRANSITION_MS);
  }

  return (
    <div className="frame-body">
      <div className="frame-toolbar frame-toolbar-create">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          aria-label="Task title"
          onKeyDown={(e) => {
            if (e.key === "Enter") submitNew();
          }}
        />
        <select
          value={newProjectId}
          onChange={(e) => setNewProjectId(e.target.value)}
          aria-label="Project"
        >
          <option value="">Unassigned</option>
          {state.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={newDue}
          onChange={(e) => setNewDue(e.target.value)}
          aria-label="Due date"
        />
        <button
          type="button"
          className="primary-btn"
          onClick={submitNew}
          disabled={!title.trim()}
        >
          Add task
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
                completing={Boolean(completing[todo.id])}
                onOpen={() => setEdit(todo)}
                onComplete={() => completeTodo(todo)}
                onRemove={() => removeTodo(todo.id)}
              />
            ))}
          </ul>
          {overflow || expanded ? (
            <div className="frame-footer">
              <span className="meta">
                {expanded
                  ? `${allOpen.length} tasks`
                  : `Showing ${todos.length} of ${allOpen.length}`}
              </span>
              {overflow ? (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => expand(frameId)}
                >
                  View all
                </button>
              ) : null}
              {expanded ? (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={collapse}
                >
                  Collapse
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <DetailModal
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        title="Edit to-do"
        footer={
          edit ? (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="muted-btn"
                onClick={() => setEdit(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  if (!edit.title.trim()) return;
                  const due = toDateInputValue(edit.dueAt);
                  if (due && !isValidDateInput(due)) return;
                  updateTodo(edit.id, {
                    title: edit.title,
                    projectId: edit.projectId ?? null,
                    dueAt: edit.dueAt ?? null,
                    detail: edit.detail ?? null,
                    kind: edit.kind ?? "ACTION",
                    waitingOn: edit.waitingOn ?? null,
                  });
                  setEdit(null);
                }}
              >
                Save
              </button>
            </div>
          ) : null
        }
      >
        {edit ? (
          <div className="space-y-3">
            <label className="field">
              <span>Title</span>
              <input
                value={edit.title}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Project</span>
              <select
                value={edit.projectId ?? ""}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    projectId: e.target.value || null,
                  })
                }
              >
                <option value="">Unassigned</option>
                {state.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Kind</span>
              <select
                value={edit.kind ?? "ACTION"}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    kind: e.target.value as TodoItem["kind"],
                  })
                }
              >
                <option value="ACTION">Action</option>
                <option value="WAITING">Waiting</option>
                <option value="CHASE">Chase</option>
                <option value="REMINDER">Reminder</option>
              </select>
            </label>
            {(edit.kind === "WAITING" || edit.kind === "CHASE") && (
              <label className="field">
                <span>Waiting on</span>
                <input
                  value={edit.waitingOn ?? ""}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      waitingOn: e.target.value || undefined,
                    })
                  }
                  placeholder="Person or team"
                />
              </label>
            )}
            <label className="field">
              <span>Due date</span>
              <input
                type="date"
                value={toDateInputValue(edit.dueAt)}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value && !isValidDateInput(value)) return;
                  setEdit({
                    ...edit,
                    dueAt: value
                      ? new Date(`${value}T09:00:00`).toISOString()
                      : undefined,
                  });
                }}
              />
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea
                className="capture-textarea"
                rows={3}
                value={edit.detail ?? ""}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    detail: e.target.value || undefined,
                  })
                }
              />
            </label>
          </div>
        ) : null}
      </DetailModal>
    </div>
  );
}

function TodoRow({
  todo,
  projectLabel,
  completing,
  onOpen,
  onComplete,
  onRemove,
}: {
  todo: TodoItem;
  projectLabel: string;
  completing: boolean;
  onOpen: () => void;
  onComplete: () => void;
  onRemove: () => void;
}) {
  return (
    <li
      className={`frame-row is-card-clickable frame-item-transition ${completing ? "is-completing" : ""}`}
      onClick={(e) => {
        if (isInteractiveTarget(e.target)) return;
        onOpen();
      }}
    >
      <button
        type="button"
        className="ghost-btn complete-btn"
        onClick={onComplete}
        disabled={completing}
        aria-label={`Complete ${todo.title}`}
      >
        Complete
      </button>
      <button type="button" className="frame-row-title" onClick={onOpen}>
        {todo.title}
      </button>
      {todo.kind && todo.kind !== "ACTION" ? (
        <span className={`todo-kind-tag is-${todo.kind.toLowerCase()}`}>
          {todo.kind === "CHASE"
            ? "Chase"
            : todo.kind === "WAITING"
              ? "Waiting"
              : "Reminder"}
        </span>
      ) : null}
      {todo.waitingOn ? (
        <span className="meta">Waiting on: {todo.waitingOn}</span>
      ) : null}
      <span className="tag">{projectLabel}</span>
      {relativeDue(todo) ? (
        <span className="meta">
          {todo.kind === "CHASE" || todo.kind === "WAITING"
            ? `Follow-up ${relativeDue(todo)}`
            : relativeDue(todo)}
        </span>
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
