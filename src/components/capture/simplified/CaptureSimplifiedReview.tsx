"use client";

import { useState, type ReactNode } from "react";
import type { ReviewChangeViewModel } from "@/lib/capture/review/viewModel";
import type { SuggestionKind } from "@/lib/capture/suggestions";
import { SuggestedChangeCard } from "@/components/capture/review/SuggestedChangeCard";
import { KnowledgeRememberList } from "@/components/capture/review/KnowledgeRememberList";
import type { TargetOption } from "@/components/capture/review/TargetPicker";
import { ReadyChangeRow } from "./ReadyChangeRow";

function isKnowledgeRemember(model: ReviewChangeViewModel) {
  return (
    Boolean(model.suggestion.isKnowledgeRemember) ||
    (model.entityKind === "knowledge" && model.operation === "create") ||
    (model.entityKind === "memory" && model.operation === "create")
  );
}

export function CaptureSimplifiedReview({
  models,
  added,
  dismissed,
  readyCount,
  needsReviewCount,
  unmatchedCount,
  targetOptions,
  highlightedId,
  onApprove,
  onDismiss,
  onApproveReady,
  onUseThis,
  onChooseTarget,
  onChooseProject,
  onCreateNew,
  onResolve,
  onChangeEntityKind,
}: {
  models: ReviewChangeViewModel[];
  added: Record<string, boolean>;
  dismissed: Record<string, boolean>;
  readyCount: number;
  needsReviewCount: number;
  unmatchedCount: number;
  targetOptions: TargetOption[];
  highlightedId?: string | null;
  onApprove: (id: string) => void;
  onDismiss: (id: string) => void;
  onApproveReady: () => void;
  onUseThis: (id: string) => void;
  onChooseTarget: (id: string, option: TargetOption) => void;
  onChooseProject: (
    id: string,
    project: { id: string; name: string; code?: string },
  ) => void;
  onCreateNew: (id: string) => void;
  onResolve: (id: string) => void;
  onChangeEntityKind: (id: string, kind: SuggestionKind) => void;
}) {
  const [showReviewed, setShowReviewed] = useState(false);

  const rememberModels = models.filter(isKnowledgeRemember);
  const operationModels = models.filter((m) => !isKnowledgeRemember(m));
  const pending = operationModels.filter(
    (m) => !added[m.id] && !dismissed[m.id],
  );
  const reviewed = operationModels.filter(
    (m) => added[m.id] || dismissed[m.id],
  );
  const needsYou = pending.filter((m) => m.readiness === "unmatched");
  const needsReview = pending.filter((m) => m.readiness === "needs_review");
  const ready = pending.filter((m) => m.readiness === "ready");

  return (
    <div
      className="capture-review capture-review-workspace capture-v2-review"
      data-testid="ocean-capture-review"
    >
      <p className="ocean-capture-review-boundary" role="note">
        Nothing enters maintained project truth until you approve it.
      </p>

      <div className="capture-v2-review-head">
        <p className="capture-v2-counts" role="status">
          <span>
            {readyCount} ready
          </span>
          <span aria-hidden>·</span>
          <span>
            {needsReviewCount} need review
          </span>
          <span aria-hidden>·</span>
          <span>
            {unmatchedCount} need{unmatchedCount === 1 ? "s" : ""} you
          </span>
        </p>
        {readyCount > 0 ? (
          <button
            type="button"
            className="primary-btn capture-v2-apply-ready"
            onClick={onApproveReady}
            aria-label={`Apply Ready (${readyCount})`}
            data-testid="capture-v2-apply-ready"
          >
            Apply ready ({readyCount})
          </button>
        ) : null}
      </div>

      {needsYou.length > 0 ? (
        <ReviewGroup title="Needs you" testId="capture-v2-needs-you">
          <ul className="suggested-change-list">
          {needsYou.map((model) => (
            <SuggestedChangeCard
              key={model.id}
              model={model}
              state="pending"
              targetOptions={targetOptions}
              highlighted={highlightedId === model.id}
              onApprove={() => onApprove(model.id)}
              onDismiss={() => onDismiss(model.id)}
              onKeepOpen={() => onDismiss(model.id)}
              onUseThis={() => onUseThis(model.id)}
              onChooseTarget={(option) => onChooseTarget(model.id, option)}
              onChooseProject={(project) => onChooseProject(model.id, project)}
              onCreateNew={() => onCreateNew(model.id)}
              onResolve={() => onResolve(model.id)}
              onChangeEntityKind={(kind) => onChangeEntityKind(model.id, kind)}
            />
          ))}
          </ul>
        </ReviewGroup>
      ) : null}

      {needsReview.length > 0 ? (
        <ReviewGroup title="Needs review" testId="capture-v2-needs-review">
          <ul className="suggested-change-list">
          {needsReview.map((model) => (
            <SuggestedChangeCard
              key={model.id}
              model={model}
              state="pending"
              targetOptions={targetOptions}
              highlighted={highlightedId === model.id}
              onApprove={() => onApprove(model.id)}
              onDismiss={() => onDismiss(model.id)}
              onKeepOpen={() => onDismiss(model.id)}
              onUseThis={() => onUseThis(model.id)}
              onChooseTarget={(option) => onChooseTarget(model.id, option)}
              onChooseProject={(project) => onChooseProject(model.id, project)}
              onCreateNew={() => onCreateNew(model.id)}
              onResolve={() => onResolve(model.id)}
              onChangeEntityKind={(kind) => onChangeEntityKind(model.id, kind)}
            />
          ))}
          </ul>
        </ReviewGroup>
      ) : null}

      {ready.length > 0 ? (
        <ReviewGroup title="Ready" testId="capture-v2-ready">
          <ul className="capture-v2-ready-list">
            {ready.map((model) => (
              <ReadyChangeRow
                key={model.id}
                model={model}
                highlighted={highlightedId === model.id}
                onApprove={() => onApprove(model.id)}
                onDismiss={() => onDismiss(model.id)}
              />
            ))}
          </ul>
        </ReviewGroup>
      ) : null}

      {pending.length === 0 && reviewed.length === 0 ? (
        <p className="empty-copy">No operational changes to review.</p>
      ) : null}

      {reviewed.length > 0 ? (
        <div className="capture-v2-reviewed">
          <button
            type="button"
            className="ghost-btn capture-v2-reviewed-toggle"
            onClick={() => setShowReviewed((v) => !v)}
            aria-expanded={showReviewed}
          >
            {showReviewed ? "Hide" : "Show"} reviewed ({reviewed.length})
          </button>
          {showReviewed ? (
            <ul className="suggested-change-list">
              {reviewed.map((model) => (
                <SuggestedChangeCard
                  key={model.id}
                  model={model}
                  state={added[model.id] ? "approved" : "dismissed"}
                  targetOptions={targetOptions}
                  onApprove={() => onApprove(model.id)}
                  onDismiss={() => onDismiss(model.id)}
                />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <KnowledgeRememberList
        models={rememberModels}
        added={added}
        dismissed={dismissed}
        highlightedId={highlightedId}
        onRemember={onApprove}
        onDontRemember={onDismiss}
        onRememberAll={() => {
          for (const m of rememberModels) {
            if (!added[m.id] && !dismissed[m.id]) onApprove(m.id);
          }
        }}
      />
    </div>
  );
}

function ReviewGroup({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <section className="capture-v2-group" data-testid={testId}>
      <h3 className="capture-review-section-title">{title}</h3>
      {children}
    </section>
  );
}
