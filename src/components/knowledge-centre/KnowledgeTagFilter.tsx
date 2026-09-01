"use client";

import { useMemo, useState } from "react";
import { uniqueProjectTagNames, type ProjectTag } from "@/lib/tags";

const VISIBLE = 4;

export function KnowledgeTagFilter({
  projectId,
  projectTags,
  usedTagIds,
  selectedTagIds,
  onChange,
}: {
  projectId: string;
  projectTags: ProjectTag[];
  usedTagIds: Set<string>;
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
}) {
  const [more, setMore] = useState(false);
  const used = useMemo(
    () =>
      uniqueProjectTagNames(projectTags, projectId).filter((t) =>
        usedTagIds.has(t.id),
      ),
    [projectTags, projectId, usedTagIds],
  );
  if (!used.length) return null;

  const visible = more ? used : used.slice(0, VISIBLE);
  const selected = new Set(selectedTagIds);

  function toggle(id: string) {
    if (selected.has(id)) onChange(selectedTagIds.filter((x) => x !== id));
    else onChange([...selectedTagIds, id]);
  }

  return (
    <div className="ocean-tag-filter" data-testid="ocean-tag-filter">
      <p className="ocean-tag-filter-label">Quick filters</p>
      <div className="ocean-tag-filter-chips">
        {visible.map((tag) => (
          <button
            key={tag.id}
            type="button"
            className={`tag-chip ${selected.has(tag.id) ? "is-selected" : ""}`}
            aria-pressed={selected.has(tag.id)}
            data-testid={`ocean-tag-filter-${tag.slug}`}
            onClick={() => toggle(tag.id)}
          >
            {tag.name}
          </button>
        ))}
        {used.length > VISIBLE ? (
          <button
            type="button"
            className="tag-chip-add-btn"
            onClick={() => setMore((v) => !v)}
          >
            {more ? "Less" : "+ More"}
          </button>
        ) : null}
        {selectedTagIds.length ? (
          <button
            type="button"
            className="ghost-btn"
            onClick={() => onChange([])}
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
