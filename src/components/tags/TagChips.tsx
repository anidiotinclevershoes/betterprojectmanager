"use client";

import { useMemo, useState } from "react";
import { suggestTags, type ProjectTag } from "@/lib/tags";

/**
 * Lightweight retrieval-tag chips. Does not edit authoritative fields.
 */
export function TagChips({
  tags,
  projectTags,
  onAdd,
  onRemove,
  disabled,
}: {
  tags: string[];
  projectTags: ProjectTag[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const suggestions = useMemo(
    () =>
      suggestTags({
        query,
        projectTags,
        alreadyAttached: tags,
      }),
    [query, projectTags, tags],
  );

  return (
    <div className="tag-chips" data-testid="tag-chips">
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          className="tag-chip"
          disabled={disabled}
          onClick={() => onRemove(tag)}
          aria-label={`Remove tag ${tag}`}
        >
          {tag}
          <span aria-hidden>×</span>
        </button>
      ))}
      {open ? (
        <div className="tag-chip-add">
          <input
            className="tag-chip-input"
            value={query}
            autoFocus
            placeholder="Add tag"
            aria-label="Add tag"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim()) {
                e.preventDefault();
                onAdd(query.trim());
                setQuery("");
                setOpen(false);
              }
              if (e.key === "Escape") {
                setOpen(false);
                setQuery("");
              }
            }}
            disabled={disabled}
          />
          {suggestions.length ? (
            <ul className="tag-chip-suggest" role="listbox">
              {suggestions.map((s) => (
                <li key={`${s.kind}-${s.slug}`}>
                  <button
                    type="button"
                    onClick={() => {
                      onAdd(s.name);
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    {s.kind === "create" ? `Create “${s.name}”` : s.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          className="tag-chip-add-btn"
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          + Add tag
        </button>
      )}
    </div>
  );
}
