"use client";

import { useState, type FormEvent } from "react";
import {
  KNOWLEDGE_SECTIONS,
  emptyKnowledge,
  knowledgeHasContent,
  normaliseBullet,
} from "@/lib/knowledge";
import { formatWhen } from "@/lib/selectors";
import { useMission } from "@/lib/store";
import type { KnowledgeSectionId, ProjectKnowledge } from "@/lib/types";

export function ProjectKnowledgeBrief({ projectId }: { projectId: string }) {
  const { state, addKnowledgeBullet, replaceKnowledge } = useMission();
  const knowledge =
    state.knowledge.find((k) => k.projectId === projectId) ??
    emptyKnowledge(projectId);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProjectKnowledge>(() => knowledge);
  const [quickAdd, setQuickAdd] = useState("");
  const [quickSection, setQuickSection] =
    useState<KnowledgeSectionId>("now");

  function startEdit() {
    setDraft(knowledge);
    setEditing(true);
  }

  function saveEdit() {
    const cleaned: ProjectKnowledge = {
      projectId,
      updatedAt: new Date().toISOString(),
      sections: {
        now: parseLines(draft.sections.now),
        decisions: parseLines(draft.sections.decisions),
        risks: parseLines(draft.sections.risks),
        people: parseLines(draft.sections.people),
        openLoops: parseLines(draft.sections.openLoops),
      },
    };
    replaceKnowledge(cleaned);
    setEditing(false);
  }

  function onQuickAdd(e: FormEvent) {
    e.preventDefault();
    const bullet = normaliseBullet(quickAdd);
    if (!bullet) return;
    addKnowledgeBullet(projectId, quickSection, bullet);
    setQuickAdd("");
  }

  const hasContent = knowledgeHasContent(knowledge);

  return (
    <section className="knowledge-brief">
      <header className="knowledge-brief-header">
        <div>
          <h3>Project knowledge</h3>
          <p>
            Living brief — you can add to it; captures also update it with
            relevant facts only.
          </p>
        </div>
        <div className="knowledge-actions">
          {editing ? (
            <>
              <button type="button" className="primary" onClick={saveEdit}>
                Save
              </button>
              <button
                type="button"
                className="muted"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="muted" onClick={startEdit}>
              Edit
            </button>
          )}
        </div>
      </header>

      {editing ? (
        <div className="knowledge-edit-grid">
          {KNOWLEDGE_SECTIONS.map((section) => (
            <label key={section.id} className="knowledge-edit-block">
              <span>
                {section.label}
                <em>{section.hint}</em>
              </span>
              <textarea
                rows={4}
                value={(draft.sections[section.id] ?? []).join("\n")}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    sections: {
                      ...prev.sections,
                      [section.id]: e.target.value.split("\n"),
                    },
                  }))
                }
                placeholder="One bullet per line"
              />
            </label>
          ))}
        </div>
      ) : (
        <div className="knowledge-view">
          {!hasContent ? (
            <p className="empty">
              Empty for now. Add a note below, or capture something linked to
              this project.
            </p>
          ) : (
            KNOWLEDGE_SECTIONS.map((section) => {
              const bullets = knowledge.sections[section.id] ?? [];
              if (!bullets.length) return null;
              return (
                <div key={section.id} className="knowledge-section">
                  <h4>{section.label}</h4>
                  <ul>
                    {bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </div>
      )}

      {!editing ? (
        <form className="knowledge-quick-add" onSubmit={onQuickAdd}>
          <select
            value={quickSection}
            onChange={(e) =>
              setQuickSection(e.target.value as KnowledgeSectionId)
            }
          >
            {KNOWLEDGE_SECTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <input
            value={quickAdd}
            onChange={(e) => setQuickAdd(e.target.value)}
            placeholder="Add a relevant fact…"
          />
          <button type="submit" disabled={!quickAdd.trim()}>
            Add
          </button>
        </form>
      ) : null}

      {knowledge.updatedAt ? (
        <p className="knowledge-updated">
          Updated {formatWhen(knowledge.updatedAt)}
        </p>
      ) : null}
    </section>
  );
}

function parseLines(lines: string[]) {
  return lines
    .map((l) => normaliseBullet(l))
    .filter(Boolean)
    .slice(0, 8);
}
