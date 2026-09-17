"use client";

import { useMemo, useState } from "react";
import { suggestTags, tagDisplayName } from "@/lib/tags";
import type { ProjectTag } from "@/lib/tags";

/**
 * Draft-only tag editor. Typing and selecting Create does not persist.
 * Parent commits on Save.
 */
export function ItemTagsEditor({
  projectTags,
  value,
  onChange,
  disabled,
}: {
  projectTags: ProjectTag[];
  value: string[];
  onChange: (names: string[]) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const suggestions = useMemo(
    () =>
      suggestTags({
        query,
        projectTags,
        alreadyAttached: value,
        limit: 6,
      }),
    [query, projectTags, value],
  );

  function addName(name: string) {
    const display = tagDisplayName(name);
    if (!display) return;
    if (value.some((existing) => existing.toLowerCase() === display.toLowerCase())) {
      setQuery("");
      return;
    }
    onChange([...value, display]);
    setQuery("");
  }

  return (
    <div className="ocean-tag-editor" data-testid="ocean-tag-editor">
      <p className="ocean-tag-editor-hint">
        New tags are created and attached only when you Save changes.
      </p>
      <div className="ocean-tag-chips">
        {value.map((name) => (
          <span key={name} className="tag-chip">
            {name}
            <button
              type="button"
              className="ocean-tag-remove"
              disabled={disabled}
              aria-label={`Remove ${name}`}
              onClick={() => onChange(value.filter((item) => item !== name))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={query}
        disabled={disabled}
        placeholder="Add a tag"
        autoComplete="off"
        data-testid="ocean-tag-input"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (query.trim()) addName(query);
          }
        }}
      />
      {query.trim() && suggestions.length ? (
        <ul className="ocean-tag-suggest" data-testid="ocean-tag-suggest">
          {suggestions.map((item) => (
            <li key={`${item.kind}-${item.slug}`}>
              <button
                type="button"
                onClick={() => addName(item.name)}
              >
                {item.kind === "create" ? `Create “${item.name}”` : item.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
