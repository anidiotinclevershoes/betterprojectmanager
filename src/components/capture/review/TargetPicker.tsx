"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type TargetOption = {
  id: string;
  title: string;
  entityLabel: string;
  status?: string;
};

export function TargetPicker({
  options,
  onSelect,
  onClose,
  open,
}: {
  options: TargetOption[];
  onSelect: (option: TargetOption) => void;
  onClose: () => void;
  open: boolean;
}) {
  const [query, setQuery] = useState("");
  const panelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 12);
    return options
      .filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          o.entityLabel.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [options, query]);

  if (!open) return null;

  return (
    <div className="capture-target-picker" id={panelId} role="listbox">
      <div className="capture-target-picker-head">
        <input
          ref={inputRef}
          type="search"
          className="capture-target-picker-search"
          placeholder="Search project records…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search project records"
        />
        <button type="button" className="ghost-btn" onClick={onClose}>
          Cancel
        </button>
      </div>
      {filtered.length === 0 ? (
        <p className="meta capture-target-picker-empty">No matching records.</p>
      ) : (
        <ul className="capture-target-picker-list">
          {filtered.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                className="capture-target-picker-option"
                onClick={() => onSelect(option)}
              >
                <span className="capture-target-picker-type">
                  {option.entityLabel}
                </span>
                <span className="capture-target-picker-title">{option.title}</span>
                {option.status ? (
                  <span className="meta">{option.status}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
