"use client";

import {
  PROVISIONAL_CATEGORIES,
  draftFromProvisional,
  recategoriseItem,
  type ProvisionalCategory,
  type ProvisionalItem,
} from "@/lib/new-project-v2";
import type { CreateProjectInput } from "@/lib/create-project";

const CATEGORY_LABEL: Record<ProvisionalCategory, string> = {
  person: "People",
  risk: "Risks",
  milestone: "Dates",
  todo: "To Dos",
  knowledge: "Knowledge",
  commentary: "Not project / commentary",
  ignored: "Ignore",
};

export function NewProjectCategorisation({
  sourceNarrative,
  sourceMode,
  project,
  items,
  onChangeProject,
  onChangeItems,
  onApprove,
  onBack,
  busy,
  error,
}: {
  sourceNarrative: string;
  sourceMode: "talk" | "paste";
  project: { name: string; summary: string; currentFocus: string };
  items: ProvisionalItem[];
  onChangeProject: (next: {
    name: string;
    summary: string;
    currentFocus: string;
  }) => void;
  onChangeItems: (next: ProvisionalItem[]) => void;
  onApprove: (draft: CreateProjectInput) => void;
  onBack: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  const counts = PROVISIONAL_CATEGORIES.map((category) => ({
    category,
    count: items.filter((item) => item.category === category).length,
  }));

  return (
    <div className="np-review np-categorise" data-testid="np-v2-categorise">
      <header className="np-review-head">
        <p className="np-kicker">Provisional project map</p>
        <h2 className="np-review-title">Here&apos;s how Lume organised what you know</h2>
        <p className="np-review-lead">
          This is not maintained project truth yet. Correct any category, then
          approve the map. Creation still waits for the next review step.
        </p>
      </header>

      <div className="np-review-summary" aria-label="Categorisation summary">
        <p className="np-review-summary-label">Provisional buckets</p>
        <ul className="np-review-summary-stats">
          {counts
            .filter((row) => row.count > 0)
            .map((row) => (
              <li key={row.category}>
                <strong>{row.count}</strong> {CATEGORY_LABEL[row.category]}
              </li>
            ))}
        </ul>
      </div>

      <label className="field">
        Project name
        <input
          value={project.name}
          onChange={(e) =>
            onChangeProject({ ...project, name: e.target.value })
          }
        />
      </label>
      <label className="field">
        Objective
        <textarea
          rows={2}
          value={project.summary}
          onChange={(e) =>
            onChangeProject({ ...project, summary: e.target.value })
          }
        />
      </label>

      <ul className="np-categorise-list">
        {items.map((item) => (
          <li
            key={item.id}
            className={`np-categorise-item ${item.needsReview ? "is-needs-review" : ""}`}
            data-model-observation-id={item.modelObservationId ?? undefined}
          >
            <div className="np-categorise-item-head">
              <p className="np-categorise-statement">{item.statement}</p>
              {item.needsReview ? (
                <span className="np-needs-review" data-testid="np-needs-review">
                  Needs Review
                </span>
              ) : null}
            </div>
            <p className="meta np-categorise-evidence">“{item.evidence}”</p>
            <label className="field">
              Category
              <select
                value={item.category}
                onChange={(e) =>
                  onChangeItems(
                    recategoriseItem(
                      items,
                      item.id,
                      e.target.value as ProvisionalCategory,
                    ),
                  )
                }
              >
                {PROVISIONAL_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABEL[category]}
                  </option>
                ))}
              </select>
            </label>
          </li>
        ))}
      </ul>

      {items.length === 0 ? (
        <p className="meta">No observations yet. Go back and add more detail, or continue to review an empty map.</p>
      ) : null}

      {error ? (
        <p className="login-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="np-review-actions">
        <button type="button" className="ghost-btn" onClick={onBack} disabled={busy}>
          Back
        </button>
        <button
          type="button"
          className="primary-btn"
          data-testid="np-v2-approve-categorisation"
          disabled={busy || !project.name.trim()}
          onClick={() =>
            onApprove(
              draftFromProvisional({
                sourceNarrative,
                sourceMode,
                project,
                items,
              }),
            )
          }
        >
          Approve categorisation
        </button>
      </div>
    </div>
  );
}
