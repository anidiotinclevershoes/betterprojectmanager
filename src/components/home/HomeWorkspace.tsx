"use client";

import { useMemo, useState } from "react";
import { HomeTodoSection } from "@/components/home/HomeTodoRow";
import { KnowledgeItemDetailDrawer } from "@/components/knowledge-centre/KnowledgeItemDetailDrawer";
import { KcTimeline } from "@/components/knowledge-centre/KcTimeline";
import { composeHomeProjection } from "@/lib/knowledge-centre/home-projection";
import type { KnowledgeItemRef } from "@/lib/knowledge-centre/knowledge-item-detail";
import type { KcComposedItem } from "@/lib/knowledge-centre/four-bucket";
import { composeTimelineProjection } from "@/lib/knowledge-centre/timeline-projection";
import type { HomeTodoDensity } from "@/lib/home/home-todo-row";
import { useMission } from "@/lib/store";
import type { MissionState, Recommendation } from "@/lib/types";

/**
 * Home attention workspace.
 * Reads the existing Home projection and writes only through addTodo,
 * toggleTodo, and dismissSuggestion. Close completes a To Do. It does not
 * delete one. Suggestions stay advisory until Save To Do.
 */
export function HomeWorkspace({ projectId }: { projectId: string }) {
  const { state, toggleTodo, addTodo, dismissSuggestion, saveError } = useMission();
  const [density, setDensity] = useState<HomeTodoDensity>("comfortable");
  const [selected, setSelected] = useState<KnowledgeItemRef | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [pending, setPending] = useState<Recommendation | null>(null);

  const projection = useMemo(
    () => composeHomeProjection(state, projectId),
    [state, projectId],
  );

  const openTodos = useMemo(() => {
    const ids = new Set(
      projection.queue
        .filter((item) => item.kind === "todo" && item.todoId)
        .map((item) => item.todoId as string),
    );
    return (state.todos ?? []).filter(
      (todo) => todo.projectId === projectId && !todo.done && ids.has(todo.id),
    );
  }, [projection.queue, state.todos, projectId]);

  const tagLabelsById = useMemo(() => {
    const labels: Record<string, string[]> = {};
    for (const item of projection.queue) {
      if (!item.todoId) continue;
      const names = tagNamesForTodo(state, projectId, item.todoId);
      if (names.length) labels[item.todoId] = names;
    }
    return labels;
  }, [projection.queue, state, projectId]);

  const attention = projection.queue.filter(
    (item) => item.kind === "issue" || item.kind === "date",
  );

  function toggleSection(id: string) {
    setCollapsed((current) => ({ ...current, [id]: !current[id] }));
  }

  function saveTodo() {
    const title = draftTitle.trim();
    if (!title) return;
    addTodo({ projectId, title });
    setDraftTitle("");
    setAdding(false);
  }

  function saveSuggestion() {
    if (!pending) return;
    const title = pending.title.trim();
    if (!title) return;
    addTodo({
      projectId,
      title,
      detail: pending.action?.trim() || undefined,
    });
    dismissSuggestion(pending.id);
    setPending(null);
  }

  return (
    <div
      className={`lume-home is-${density}`}
      data-testid="home-workspace"
      data-project-id={projectId}
      data-density={density}
    >
      <div className="lume-home-toolbar">
        <p className="lume-home-toolbar-label">Density</p>
        <button
          type="button"
          className={density === "comfortable" ? "is-selected" : ""}
          aria-pressed={density === "comfortable"}
          data-testid="home-density-comfortable"
          onClick={() => setDensity("comfortable")}
        >
          Comfortable
        </button>
        <button
          type="button"
          className={density === "compact" ? "is-selected" : ""}
          aria-pressed={density === "compact"}
          data-testid="home-density-compact"
          onClick={() => setDensity("compact")}
        >
          Compact
        </button>
      </div>

      {saveError ? (
        <p className="lume-home-alert" role="alert" data-testid="home-save-error">
          {saveError}
        </p>
      ) : null}

      <div className="lume-home-top">
        <div className="lume-home-primary">
          <HomeTodoSection
            todos={openTodos}
            density={density}
            tagLabelsById={tagLabelsById}
            onOpen={(todoId) => setSelected({ kind: "todo", todoId })}
            onClose={toggleTodo}
          />

          {attention.length > 0 ? (
            <ul className="lume-home-attention" data-testid="home-attention">
              {attention.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => item.ref && setSelected(item.ref)}
                    disabled={!item.ref}
                  >
                    <span className={`lume-home-kind is-${item.kind}`}>
                      {item.staysIssue ? "Issue" : "Date"}
                    </span>
                    <span>{item.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <section
            className="lume-home-suggestions"
            data-testid="home-suggestions"
            data-collapsed={collapsed.suggestions ? "true" : "false"}
          >
            <header>
              <span className="lume-home-bulb" aria-hidden>
                ✦
              </span>
              <strong>Suggestions</strong>
              <span>{projection.suggestions.length}</span>
              <button
                type="button"
                aria-expanded={!collapsed.suggestions}
                aria-label={
                  collapsed.suggestions
                    ? "Expand Suggestions"
                    : "Collapse Suggestions"
                }
                onClick={() => toggleSection("suggestions")}
              >
                <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden>
                  <path
                    d="M3.5 5.5L7.5 9.5L11.5 5.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </header>
            {collapsed.suggestions ? null : projection.suggestions.length === 0 ? (
              <p data-testid="home-suggestions-empty">
                No suggestions for this project.
              </p>
            ) : (
              <ul>
                {projection.suggestions.map((rec) => (
                  <li key={rec.id} data-testid="home-suggestion">
                    <div>
                      <strong>{rec.title}</strong>
                      <p>{rec.action}</p>
                    </div>
                    <button
                      type="button"
                      data-testid="home-suggestion-add"
                      onClick={() => setPending(rec)}
                    >
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="lume-home-add" data-testid="home-add-todo">
            {adding ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  saveTodo();
                }}
              >
                <label>
                  To Do title
                  <input
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    data-testid="home-add-todo-title"
                  />
                </label>
                <button type="submit" data-testid="home-add-todo-save">
                  Save To Do
                </button>
                <button type="button" onClick={() => setAdding(false)}>
                  Cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                data-testid="home-add-todo-open"
                onClick={() => setAdding(true)}
              >
                Add To Do
              </button>
            )}
          </div>
        </div>

        <ItemBand
          testId="home-people"
          domain="people"
          title="People"
          items={projection.people}
          collapsed={Boolean(collapsed.people)}
          onToggle={() => toggleSection("people")}
          onOpen={setSelected}
          empty="No people information yet"
          density={density}
        />
      </div>

      <ItemBand
        testId="home-issues"
        domain="issues"
        title="Issues"
        items={projection.issues}
        collapsed={Boolean(collapsed.issues)}
        onToggle={() => toggleSection("issues")}
        onOpen={setSelected}
        empty="No issue information yet"
        density={density}
      />
      <ItemBand
        testId="home-knowledge"
        domain="knowledge"
        title="Knowledge"
        items={projection.knowledge}
        collapsed={Boolean(collapsed.knowledge)}
        onToggle={() => toggleSection("knowledge")}
        onOpen={setSelected}
        empty="No knowledge information yet"
        density={density}
      />
      <HomeTimeline
        projectId={projectId}
        collapsed={Boolean(collapsed.timeline)}
        onToggle={() => toggleSection("timeline")}
      />

      <KnowledgeItemDetailDrawer
        projectId={projectId}
        selected={selected}
        onClose={() => setSelected(null)}
      />

      {pending ? (
        <div className="lume-home-dialog" data-testid="home-suggestion-dialog" role="dialog" aria-modal="true" aria-label="Add suggested To Do">
          <h2>Add suggested To Do</h2>
          <p>Nothing is created until you save this To Do.</p>
          <p>
            <strong>{pending.title}</strong>
          </p>
          {pending.action ? <p>{pending.action}</p> : null}
          <footer>
            <button
              type="button"
              data-testid="home-suggestion-cancel"
              onClick={() => setPending(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="home-suggestion-discard"
              onClick={() => {
                dismissSuggestion(pending.id);
                setPending(null);
              }}
            >
              Discard
            </button>
            <button
              type="button"
              data-testid="home-suggestion-save"
              onClick={saveSuggestion}
            >
              Save To Do
            </button>
          </footer>
          <p>Discard hides this suggestion here. It does not change saved project information.</p>
        </div>
      ) : null}
    </div>
  );
}

function tagNamesForTodo(
  state: MissionState,
  projectId: string,
  todoId: string,
): string[] {
  return (state.itemTags ?? [])
    .filter(
      (row) =>
        row.projectId === projectId &&
        row.targetKind === "todo" &&
        row.targetId === todoId,
    )
    .map((row) => state.projectTags?.find((tag) => tag.id === row.tagId)?.name)
    .filter((name): name is string => Boolean(name?.trim()));
}

function initials(title: string): string {
  const parts = title.replace(/^@/, "").split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function ItemBand({
  testId,
  domain,
  title,
  items,
  collapsed,
  onToggle,
  onOpen,
  empty,
  density,
}: {
  testId: string;
  domain: "people" | "issues" | "knowledge";
  title: string;
  items: KcComposedItem[];
  collapsed: boolean;
  onToggle: () => void;
  onOpen: (ref: KnowledgeItemRef) => void;
  empty: string;
  density: HomeTodoDensity;
}) {
  return (
    <section
      className={`lume-home-band is-${domain} ${density === "compact" ? "is-compact" : ""}`}
      data-testid={testId}
      data-collapsed={collapsed ? "true" : "false"}
      data-count={items.length}
    >
      <header>
        <strong>{title}</strong>
        <span>{items.length}</span>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          onClick={onToggle}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden>
            <path
              d="M3.5 5.5L7.5 9.5L11.5 5.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>
      {collapsed ? null : items.length === 0 ? (
        <p className="lume-home-empty">{empty}</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => item.ref && onOpen(item.ref)}
                disabled={!item.ref}
              >
                {domain === "people" ? (
                  <span className="lume-home-avatar" aria-hidden>
                    {initials(item.title)}
                  </span>
                ) : null}
                <span>
                  <strong>{item.title}</strong>
                  {item.supporting ? <em>{item.supporting}</em> : null}
                  {item.needsYou ? <em>{item.needsYou}</em> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function HomeTimeline({
  projectId,
  collapsed,
  onToggle,
}: {
  projectId: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { state } = useMission();
  const view = composeTimelineProjection(state, projectId);
  return (
    <section
      className="lume-home-band is-timeline"
      data-testid="home-timeline"
      data-collapsed={collapsed ? "true" : "false"}
      data-empty={view.empty ? "true" : "false"}
    >
      <header>
        <strong>Timeline</strong>
        <span>{view.events.length}</span>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand Timeline" : "Collapse Timeline"}
          onClick={onToggle}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden>
            <path
              d="M3.5 5.5L7.5 9.5L11.5 5.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>
      {collapsed ? null : view.empty ? (
        <p className="lume-home-empty">No timeline information yet</p>
      ) : (
        <KcTimeline projectId={projectId} />
      )}
    </section>
  );
}
