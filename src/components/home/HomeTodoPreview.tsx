"use client";

import { useState } from "react";
import { HomeTodoSection } from "@/components/home/HomeTodoRow";
import type { HomeTodoDensity } from "@/lib/home/home-todo-row";
import type { TodoItem } from "@/lib/types";

/**
 * Development fixtures only. These records are not project truth and are
 * not written through the existing completion handler.
 */
const NOW = Date.parse("2026-09-16T12:00:00.000Z");

const FIXTURES: TodoItem[] = [
  {
    id: "fixture-today",
    title: "Fixture: confirm the refresh window",
    done: false,
    createdAt: "2026-09-01T09:00:00.000Z",
    dueAt: "2026-09-16T10:30:00.000Z",
    projectId: "fixture-project",
  },
  {
    id: "fixture-long",
    title:
      "Fixture: secure final approval for the supplier transition and confirm the revised operating budget before the weekend window",
    done: false,
    createdAt: "2026-09-01T09:00:00.000Z",
    dueAt: "2026-09-15T09:00:00.000Z",
    waitingOn: "finance desk",
    projectId: "fixture-project",
  },
  {
    id: "fixture-later",
    title: "Fixture: prepare the readiness check",
    done: false,
    createdAt: "2026-09-01T09:00:00.000Z",
    dueAt: "2026-09-18T09:00:00.000Z",
    projectId: "fixture-project",
  },
  {
    id: "fixture-undated",
    title: "Fixture: untitled date stays quiet",
    done: false,
    createdAt: "2026-09-01T09:00:00.000Z",
    projectId: "fixture-project",
  },
];

const TAGS: Record<string, readonly string[]> = {
  "fixture-today": ["UAT"],
  "fixture-long": ["Finance"],
};

function DensityBlock({
  density,
  todos,
  onOpen,
  onClose,
}: {
  density: HomeTodoDensity;
  todos: TodoItem[];
  onOpen: (id: string) => void;
  onClose: (id: string) => void;
}) {
  return (
    <div data-testid={`home-todo-preview-${density}`}>
      <p className="meta" style={{ margin: "0 0 8px" }}>
        {density === "comfortable" ? "Comfortable" : "Compact"}
      </p>
      <HomeTodoSection
        todos={todos}
        density={density}
        tagLabelsById={TAGS}
        now={NOW}
        onOpen={onOpen}
        onClose={onClose}
      />
    </div>
  );
}

export function HomeTodoPreview() {
  const [open, setOpen] = useState<TodoItem[]>(FIXTURES);
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [closes, setCloses] = useState<string[]>([]);

  function onClose(id: string) {
    setCloses((current) => [...current, id]);
    setOpen((current) => current.filter((todo) => todo.id !== id));
  }

  return (
    <div
      data-testid="home-todo-preview"
      style={{ display: "grid", gap: 28, maxWidth: 880 }}
    >
      <p className="meta" style={{ margin: 0, maxWidth: 640 }}>
        Experiment preview. Fixtures are not saved project information. Close
        only updates this preview. Move Date, More, Suggestions, and Add stay
        off this row because the Make file does not wire them.
      </p>
      <DensityBlock
        density="comfortable"
        todos={open}
        onOpen={setOpenedId}
        onClose={onClose}
      />
      <DensityBlock
        density="compact"
        todos={open}
        onOpen={setOpenedId}
        onClose={onClose}
      />
      <div data-testid="home-todo-preview-empty">
        <p className="meta" style={{ margin: "0 0 8px" }}>
          Empty
        </p>
        <HomeTodoSection todos={[]} density="comfortable" now={NOW} />
      </div>
      <p data-testid="home-todo-preview-status" className="meta">
        {openedId
          ? `Opened ${openedId}. No detail write.`
          : "No row opened."}{" "}
        Close calls: {closes.length}
        {closes.length ? ` (${closes.join(", ")})` : ""}.
      </p>
    </div>
  );
}
