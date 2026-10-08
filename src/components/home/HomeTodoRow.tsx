"use client";

import { useState } from "react";
import {
  homeTodoRowModel,
  type HomeTodoDensity,
  type HomeTodoRowSource,
} from "@/lib/home/home-todo-row";
import "./home-todo-row.css";

/**
 * Checklist glyph from Make asset 739fc.svg.
 * Stroke follows the To Do domain token instead of a hardcoded fill.
 */
function TodoMark() {
  return (
    <span className="lume-home-todo-mark" aria-hidden>
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path
          d="M8.13 3.13H13.13"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M8.13 7.5H13.13"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M8.13 11.88H13.13"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M1.88 10.63L3.13 11.88L5.63 9.38"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M2.505 2.5H5.005C5.35018 2.5 5.63 2.77982 5.63 3.125V5.625C5.63 5.97018 5.35018 6.25 5.005 6.25H2.505C2.15982 6.25 1.88 5.97018 1.88 5.625V3.125C1.88 2.77982 2.15982 2.5 2.505 2.5Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function HomeTodoRow({
  todo,
  density,
  tagLabels,
  now,
  onOpen,
  onClose,
}: {
  todo: HomeTodoRowSource;
  density: HomeTodoDensity;
  tagLabels?: readonly string[];
  now?: number;
  onOpen?: (todoId: string) => void;
  /** Caller owns Close. A production Home passes the existing completion handler. */
  onClose?: (todoId: string) => void;
}) {
  const model = homeTodoRowModel({ todo, tagLabels, now });
  const toneClass =
    model.dueTone === "today"
      ? "is-today"
      : model.dueTone === "overdue"
        ? "is-overdue"
        : "";

  return (
    <article
      className={`lume-home-todo-row ${toneClass}`}
      data-testid="home-todo-row"
      data-todo-id={model.id}
      data-density={density}
    >
      <button
        type="button"
        className="lume-home-todo-open"
        onClick={() => onOpen?.(model.id)}
        disabled={!onOpen}
      >
        <TodoMark />
        <span className="lume-home-todo-copy">
          <span className="lume-home-todo-title">{model.title}</span>
          <span className="lume-home-todo-meta">
            {model.dueLabel ? (
              <span className="lume-home-todo-due">{model.dueLabel}</span>
            ) : null}
            {model.waitingOn ? (
              <span>Waiting on {model.waitingOn}</span>
            ) : null}
            {model.tags.map((tag) => (
              <span className="lume-home-todo-tag" key={tag}>
                {tag}
              </span>
            ))}
          </span>
        </span>
      </button>
      {onClose && !model.done ? (
        <button
          type="button"
          className="lume-home-todo-close lume-hit"
          onClick={() => onClose(model.id)}
        >
          Close
        </button>
      ) : null}
    </article>
  );
}

export function HomeTodoSection({
  todos,
  density,
  tagLabelsById,
  now,
  onOpen,
  onClose,
}: {
  todos: HomeTodoRowSource[];
  density: HomeTodoDensity;
  tagLabelsById?: Readonly<Record<string, readonly string[]>>;
  now?: number;
  onOpen?: (todoId: string) => void;
  onClose?: (todoId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section
      className={`lume-home-todo-section ${density === "compact" ? "is-compact" : ""}`}
      data-testid="home-todo-section"
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div className="lume-home-todo-head">
        <TodoMark />
        <strong>To Do</strong>
        <span className="lume-home-todo-count">{todos.length}</span>
        <span className="lume-home-todo-rule" />
        <button
          type="button"
          className="lume-home-todo-collapse lume-hit"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand To Do" : "Collapse To Do"}
          onClick={() => setCollapsed((current) => !current)}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden>
            <path
              d="M3.5 5.5L7.5 9.5L11.5 5.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      {collapsed ? null : todos.length === 0 ? (
        <div className="lume-home-todo-empty" data-testid="home-todo-empty">
          <strong>No to do information yet</strong>
          <span>Add to do information when it becomes useful.</span>
        </div>
      ) : (
        todos.map((todo) => (
          <HomeTodoRow
            key={todo.id}
            todo={todo}
            density={density}
            tagLabels={tagLabelsById?.[todo.id]}
            now={now}
            onOpen={onOpen}
            onClose={onClose}
          />
        ))
      )}
    </section>
  );
}
