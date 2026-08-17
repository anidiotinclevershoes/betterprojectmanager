"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  KNOWLEDGE_SECTIONS,
  emptyKnowledge,
  knowledgeHasContent,
  normaliseBullet,
} from "@/lib/knowledge";
import { formatWhen } from "@/lib/selectors";
import { useMission } from "@/lib/store";
import type { KnowledgeSectionId, ProjectKnowledge } from "@/lib/types";
import {
  highlightMatches,
  searchProjectKnowledge,
  sectionsMatchingQuery,
} from "@/lib/tell-me/knowledge-search";
import { openTellMePanel } from "@/components/tell-me/TellMeSessionContext";

function collapseStorageKey(projectId: string) {
  return `lume-knowledge-collapsed-v1:${projectId}`;
}

/** Lightweight scanability for people bullets without inventing fields. */
function parsePersonBullet(bullet: string): {
  person: string;
  detail: string | null;
} {
  const separators = [" — ", " – ", " - ", ": ", " | "];
  for (const sep of separators) {
    const idx = bullet.indexOf(sep);
    if (idx > 0) {
      return {
        person: bullet.slice(0, idx).trim(),
        detail: bullet.slice(idx + sep.length).trim() || null,
      };
    }
  }
  return { person: bullet.trim(), detail: null };
}

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
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(collapseStorageKey(projectId));
      if (!raw) {
        setCollapsed({});
        return;
      }
      setCollapsed(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      setCollapsed({});
    }
  }, [projectId]);

  function toggleSection(sectionId: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [sectionId]: !prev[sectionId] };
      try {
        window.sessionStorage.setItem(
          collapseStorageKey(projectId),
          JSON.stringify(next),
        );
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const query = search.trim();
  const hits = useMemo(
    () => (query ? searchProjectKnowledge(knowledge, query) : []),
    [knowledge, query],
  );
  const matchingSections = useMemo(
    () => (query ? sectionsMatchingQuery(knowledge, query) : null),
    [knowledge, query],
  );

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
  const hitKey = (sectionId: string, index: number) =>
    hits.find((h) => h.sectionId === sectionId && h.bulletIndex === index);

  return (
    <section className="knowledge-brief" id="project-knowledge">
      <header className="knowledge-brief-header">
        <div>
          <h3>Project knowledge</h3>
          <p>
            Lume’s project memory — Capture builds it; Tell Me recalls it.
          </p>
        </div>
        <div className="knowledge-actions">
          <button
            type="button"
            className="muted"
            onClick={() =>
              openTellMePanel({
                projectId,
                prefill: query ? `What do we know about ${query}?` : undefined,
              })
            }
          >
            Ask Tell Me
          </button>
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

      {!editing ? (
        <div className="knowledge-search-row">
          <label className="sr-only" htmlFor="knowledge-search">
            Search project knowledge
          </label>
          <input
            id="knowledge-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search project knowledge…"
            autoComplete="off"
          />
          {query ? (
            <p className="knowledge-search-meta">
              {hits.length
                ? `${hits.length} match${hits.length === 1 ? "" : "es"}`
                : "No matches"}
            </p>
          ) : null}
        </div>
      ) : null}

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
        <div className="knowledge-frames">
          {!hasContent ? (
            <p className="empty">
              Empty for now. Add a note below, or capture something linked to
              this project — then ask Tell Me.
            </p>
          ) : query && !hits.length ? (
            <div className="knowledge-search-empty">
              <p>No knowledge matched “{query}”.</p>
              <button
                type="button"
                className="muted"
                onClick={() =>
                  openTellMePanel({
                    projectId,
                    prefill: `Ask Lume about “${query}”`,
                  })
                }
              >
                Ask Lume about “{query}”
              </button>
            </div>
          ) : (
            KNOWLEDGE_SECTIONS.map((section) => {
              const bullets = knowledge.sections[section.id] ?? [];
              if (!bullets.length) return null;
              if (matchingSections && !matchingSections.has(section.id)) {
                return null;
              }
              const isCollapsed = Boolean(collapsed[section.id]);
              return (
                <article
                  key={section.id}
                  className={`knowledge-section-frame ${isCollapsed ? "is-collapsed" : ""}`}
                  data-section={section.id}
                >
                  <header className="knowledge-section-frame-header">
                    <button
                      type="button"
                      className="knowledge-section-toggle"
                      onClick={() => toggleSection(section.id)}
                      aria-expanded={!isCollapsed}
                    >
                      <span aria-hidden>{isCollapsed ? "▸" : "▾"}</span>
                      <h4>{section.label}</h4>
                      <span className="knowledge-section-count">
                        {bullets.length}
                      </span>
                    </button>
                  </header>
                  {!isCollapsed ? (
                    section.id === "people" ? (
                      <div className="knowledge-people-table" role="table">
                        <div className="knowledge-people-head" role="row">
                          <span role="columnheader">Person</span>
                          <span role="columnheader">Role / context</span>
                          <span role="columnheader" className="sr-only">
                            Ask
                          </span>
                        </div>
                        {bullets.map((bullet, index) => {
                          const hit = hitKey(section.id, index);
                          const parsed = parsePersonBullet(bullet);
                          const parts = hit
                            ? highlightMatches(bullet, hit.matchRanges)
                            : null;
                          return (
                            <div
                              key={`${section.id}-${index}`}
                              className="knowledge-people-row"
                              role="row"
                            >
                              <span role="cell" className="knowledge-people-name">
                                {parsed.person}
                              </span>
                              <span role="cell" className="knowledge-people-detail">
                                {parts ? (
                                  parts.map((part, i) =>
                                    part.hit ? (
                                      <mark key={i} className="knowledge-hit">
                                        {part.text}
                                      </mark>
                                    ) : (
                                      <span key={i}>{part.text}</span>
                                    ),
                                  )
                                ) : (
                                  parsed.detail ?? "—"
                                )}
                              </span>
                              <button
                                type="button"
                                className="knowledge-ask-link"
                                onClick={() =>
                                  openTellMePanel({
                                    projectId,
                                    prefill: `What do you know about ${bullet.slice(0, 80)}?`,
                                  })
                                }
                              >
                                Ask Tell Me
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <ul>
                        {bullets.map((bullet, index) => {
                          const hit = hitKey(section.id, index);
                          const parts = hit
                            ? highlightMatches(bullet, hit.matchRanges)
                            : [{ text: bullet, hit: false }];
                          return (
                            <li key={`${section.id}-${index}`}>
                              <span>
                                {parts.map((part, i) =>
                                  part.hit ? (
                                    <mark key={i} className="knowledge-hit">
                                      {part.text}
                                    </mark>
                                  ) : (
                                    <span key={i}>{part.text}</span>
                                  ),
                                )}
                              </span>
                              <button
                                type="button"
                                className="knowledge-ask-link"
                                onClick={() =>
                                  openTellMePanel({
                                    projectId,
                                    prefill: `What do you know about ${bullet.slice(0, 80)}?`,
                                  })
                                }
                              >
                                Ask Tell Me
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )
                  ) : null}
                </article>
              );
            })
          )}

          {query && hits.length ? (
            <p className="knowledge-tell-me-nudge">
              Can’t find it?{" "}
              <button
                type="button"
                className="linkish"
                onClick={() =>
                  openTellMePanel({
                    projectId,
                    prefill: `Ask Lume about “${query}”`,
                  })
                }
              >
                Ask Tell Me
              </button>
            </p>
          ) : null}
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
