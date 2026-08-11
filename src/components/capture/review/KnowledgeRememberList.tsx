"use client";

import { useState } from "react";
import type { ReviewChangeViewModel } from "@/lib/capture/review/viewModel";

const REMEMBER_WHY =
  "This looks like durable project context that may be useful in future Captures, meeting preparation or Coach.";

export function KnowledgeRememberList({
  models,
  added,
  dismissed,
  onRemember,
  onDontRemember,
  onRememberAll,
  highlightedId,
}: {
  models: ReviewChangeViewModel[];
  added: Record<string, boolean>;
  dismissed: Record<string, boolean>;
  onRemember: (id: string) => void;
  onDontRemember: (id: string) => void;
  onRememberAll: () => void;
  highlightedId?: string | null;
  onSelectWhy?: (id: string) => void;
}) {
  const [whyOpen, setWhyOpen] = useState<Record<string, boolean>>({});
  const pending = models.filter((m) => !added[m.id] && !dismissed[m.id]);
  const done = models.filter((m) => added[m.id] || dismissed[m.id]);
  if (models.length === 0) return null;

  return (
    <section
      className="capture-remember-panel"
      aria-labelledby="capture-remember-title"
      id="capture-remember-panel"
    >
      <div className="capture-remember-head">
        <h3 id="capture-remember-title" className="capture-review-section-title">
          Remember for later · {pending.length}
        </h3>
        {pending.length > 1 ? (
          <button
            type="button"
            className="ghost-btn"
            onClick={onRememberAll}
          >
            Remember All
          </button>
        ) : null}
      </div>
      <p className="capture-remember-hint meta">
        Durable project context — not a copy of every event.
      </p>
      <ul className="capture-remember-list">
        {pending.map((model) => (
          <li
            key={model.id}
            id={`review-card-${model.id}`}
            data-review-card-id={model.id}
            className={[
              "capture-remember-item",
              highlightedId === model.id ? "is-highlighted" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="capture-remember-row">
              <span className="capture-remember-check" aria-hidden>
                ✓
              </span>
              <div className="capture-remember-body">
                <p className="capture-remember-text">{model.recordName}</p>
                {model.showProjectLabel && model.projectName ? (
                  <span className="capture-project-chip">
                    {model.projectCode || model.projectName}
                  </span>
                ) : null}
                <button
                  type="button"
                  className="why-panel-toggle"
                  aria-expanded={Boolean(whyOpen[model.id])}
                  onClick={() =>
                    setWhyOpen((prev) => ({
                      ...prev,
                      [model.id]: !prev[model.id],
                    }))
                  }
                >
                  Why?
                </button>
                {whyOpen[model.id] ? (
                  <p className="capture-remember-why meta">{REMEMBER_WHY}</p>
                ) : null}
              </div>
              <div className="capture-remember-actions">
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => onRemember(model.id)}
                >
                  Remember
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => onDontRemember(model.id)}
                >
                  Don&apos;t Remember
                </button>
              </div>
            </div>
          </li>
        ))}
        {done.map((model) => (
          <li key={model.id} className="capture-remember-row is-done">
            <span className="meta">
              {added[model.id] ? "Remembered" : "Skipped"} · {model.recordName}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
