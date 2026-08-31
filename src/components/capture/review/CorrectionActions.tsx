"use client";

import { useState } from "react";
import type { ReviewChangeViewModel } from "@/lib/capture/review/viewModel";
import type { ReviewReason } from "@/lib/capture/review/reviewReason";
import type { SuggestionKind } from "@/lib/capture/suggestions";
import { KIND_LABEL } from "@/lib/capture/suggestions";
import { TargetPicker, type TargetOption } from "./TargetPicker";

const ENTITY_CHOICES: SuggestionKind[] = [
  "action",
  "risk",
  "knowledge",
  "nudge",
  "meeting",
  "milestone",
  "stakeholder",
];

export type CorrectionHandlers = {
  onUseThis: () => void;
  onChooseTarget: (option: TargetOption) => void;
  onChooseProject: (project: {
    id: string;
    name: string;
    code?: string;
  }) => void;
  onCreateNew: () => void;
  onResolve: () => void;
  onDismiss: () => void;
  onApprove: () => void;
  onChangeEntityKind: (kind: SuggestionKind) => void;
};

export function CorrectionActions({
  model,
  targetOptions,
  handlers,
  hidePrompt = false,
}: {
  model: ReviewChangeViewModel;
  targetOptions: TargetOption[];
  handlers: CorrectionHandlers;
  /** Card already shows the Needs You question. */
  hidePrompt?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const reason: ReviewReason | undefined =
    model.reviewReason ??
    (model.readiness === "unmatched" ? "TARGET_UNCERTAIN" : undefined);

  if (!reason && model.readiness === "ready") {
    return (
      <div className="compact-change-action-row">
        <button type="button" className="primary-btn" onClick={handlers.onApprove}>
          Approve
        </button>
        <button type="button" className="ghost-btn" onClick={handlers.onDismiss}>
          Dismiss
        </button>
      </div>
    );
  }

  const copy = model.needsReviewReason;

  if (reason === "PROJECT_UNCERTAIN") {
    const candidates =
      model.suggestion.projectCandidates ??
      model.finding?.projectCandidates ??
      [];
    return (
      <div className="compact-change-correction">
        <div className="compact-change-action-row">
          {candidates.map((p) => (
            <button
              key={p.id}
              type="button"
              className="muted-btn"
              onClick={() => handlers.onChooseProject(p)}
            >
              {p.code || p.name}
            </button>
          ))}
          <button type="button" className="ghost-btn" onClick={handlers.onDismiss}>
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (reason === "TARGET_UNCERTAIN") {
    return (
      <div className="compact-change-correction">
        {!hidePrompt && copy ? (
          <p className="compact-change-review-copy">{copy}</p>
        ) : null}
        <div className="compact-change-action-row">
          {model.finding?.target?.entityId || model.suggestion.targetTodoId ? (
            <button
              type="button"
              className="primary-btn"
              onClick={handlers.onUseThis}
            >
              Use this
            </button>
          ) : null}
          <button
            type="button"
            className="muted-btn"
            onClick={() => setPickerOpen((v) => !v)}
            aria-expanded={pickerOpen}
          >
            Choose another
          </button>
          <button
            type="button"
            className="muted-btn"
            onClick={handlers.onCreateNew}
          >
            Create new
          </button>
          <button type="button" className="ghost-btn" onClick={handlers.onDismiss}>
            Dismiss
          </button>
        </div>
        <TargetPicker
          open={pickerOpen}
          options={targetOptions}
          onClose={() => setPickerOpen(false)}
          onSelect={(option) => {
            handlers.onChooseTarget(option);
            setPickerOpen(false);
          }}
        />
      </div>
    );
  }

  if (reason === "STATE_UNCERTAIN") {
    return (
      <div className="compact-change-correction">
        {!hidePrompt && copy ? (
          <p className="compact-change-review-copy">{copy}</p>
        ) : null}
        <div className="compact-change-action-row">
          <button
            type="button"
            className="primary-btn"
            onClick={handlers.onResolve}
          >
            {model.entityKind === "risk" ? "Resolve" : "Complete"}
          </button>
          <button type="button" className="ghost-btn" onClick={handlers.onDismiss}>
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (reason === "ENTITY_TYPE_UNCERTAIN") {
    return (
      <div className="compact-change-correction">
        {!hidePrompt && copy ? (
          <p className="compact-change-review-copy">{copy}</p>
        ) : null}
        <div className="compact-change-action-row compact-change-entity-row">
          <label className="compact-change-entity-select-label">
            <span className="sr-only">Entity type</span>
            <select
              className="compact-change-entity-select"
              value={model.entityKind}
              onChange={(e) =>
                handlers.onChangeEntityKind(e.target.value as SuggestionKind)
              }
              aria-label="Correct entity type"
            >
              {ENTITY_CHOICES.map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_LABEL[kind]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="primary-btn"
            onClick={handlers.onUseThis}
          >
            Apply type
          </button>
          <button type="button" className="ghost-btn" onClick={handlers.onDismiss}>
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // OPERATION_UNCERTAIN / VALUE_UNCERTAIN / fallback
  return (
    <div className="compact-change-correction">
      {!hidePrompt && copy ? (
        <p className="compact-change-review-copy">{copy}</p>
      ) : null}
      <div className="compact-change-action-row">
        {model.entityKind === "risk" &&
        (model.operation === "complete" || model.operation === "update") ? (
          <button
            type="button"
            className="primary-btn"
            onClick={handlers.onResolve}
          >
            Resolve Risk
          </button>
        ) : (
          <button
            type="button"
            className="primary-btn"
            onClick={handlers.onApprove}
          >
            Approve
          </button>
        )}
        <button type="button" className="ghost-btn" onClick={handlers.onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
