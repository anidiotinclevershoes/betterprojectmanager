"use client";

import type { ReviewChangeViewModel } from "@/lib/capture/review/viewModel";
import type { ReviewOwnerHit } from "@/lib/capture/review/reviewReason";
import type { SuggestionKind } from "@/lib/capture/suggestions";
import { SuggestedChangeCard } from "./SuggestedChangeCard";
import { KnowledgeRememberList } from "./KnowledgeRememberList";
import type { TargetOption } from "./TargetPicker";

function isKnowledgeRemember(model: ReviewChangeViewModel) {
  return (
    Boolean(model.suggestion.isKnowledgeRemember) ||
    (model.entityKind === "knowledge" && model.operation === "create") ||
    (model.entityKind === "memory" && model.operation === "create")
  );
}

export function SuggestedChangesList({
  models,
  added,
  dismissed,
  readyCount,
  needsReviewCount,
  unmatchedCount,
  reviewedCount,
  totalCount,
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
  onChooseOwnership,
  onProvideDate,
  ownersByCardId,
  whyOpenIds,
}: {
  models: ReviewChangeViewModel[];
  added: Record<string, boolean>;
  dismissed: Record<string, boolean>;
  readyCount: number;
  needsReviewCount: number;
  unmatchedCount: number;
  reviewedCount: number;
  totalCount: number;
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
  onChooseOwnership?: (
    id: string,
    choice: "share" | "replace" | "keep",
    replacePersonId?: string | null,
  ) => void;
  onProvideDate?: (id: string, isoDate: string) => void;
  ownersByCardId?: Record<string, ReviewOwnerHit[]>;
  whyOpenIds?: string[];
}) {
  const rememberModels = models.filter(isKnowledgeRemember);
  const operationModels = models.filter((m) => !isKnowledgeRemember(m));
  const pending = operationModels.filter(
    (m) => !added[m.id] && !dismissed[m.id],
  );
  const reviewed = operationModels.filter(
    (m) => added[m.id] || dismissed[m.id],
  );
  const ordered = [
    ...pending.filter((m) => m.readiness === "unmatched"),
    ...pending.filter((m) => m.readiness === "needs_review"),
    ...pending.filter((m) => m.readiness === "ready"),
    ...reviewed,
  ];

  const opTotal = operationModels.length;
  const opReviewed = reviewed.length;

  return (
    <>
      <section
        className="capture-changes-panel"
        aria-labelledby="capture-changes-title"
      >
        <div className="capture-changes-head">
          <div className="capture-changes-head-main">
            <h3
              id="capture-changes-title"
              className="capture-review-section-title"
            >
              Check these changes
            </h3>
            <p className="capture-review-progress" role="status">
              Checked {opReviewed} of {opTotal}
            </p>
          </div>
          <div className="capture-changes-counts" aria-label="Review counts">
            <span className="capture-count-inline">
              Ready <strong>{readyCount}</strong>
            </span>
            <span className="capture-count-sep" aria-hidden>
              ·
            </span>
            <span className="capture-count-inline">
              Needs you <strong>{needsReviewCount}</strong>
            </span>
            {unmatchedCount > 0 ? (
              <>
                <span className="capture-count-sep" aria-hidden>
                  ·
                </span>
                <span className="capture-count-inline">
                  Unmatched <strong>{unmatchedCount}</strong>
                </span>
              </>
            ) : null}
            {readyCount > 0 ? (
              <button
                type="button"
                className="ghost-btn capture-apply-ready-btn"
                onClick={onApproveReady}
                aria-label={`Apply Ready (${readyCount})`}
              >
                Apply Ready ({readyCount})
              </button>
            ) : null}
          </div>
        </div>

        {opTotal === 0 ? (
          <p className="empty-copy">Nothing to apply.</p>
        ) : (
          <ul className="suggested-change-list">
            {ordered.map((model) => (
              <SuggestedChangeCard
                key={model.id}
                model={model}
                state={
                  added[model.id]
                    ? "approved"
                    : dismissed[model.id]
                      ? "dismissed"
                      : "pending"
                }
                targetOptions={targetOptions}
                highlighted={highlightedId === model.id}
                onApprove={() => onApprove(model.id)}
                onDismiss={() => onDismiss(model.id)}
                onKeepOpen={() => onDismiss(model.id)}
                onUseThis={() => onUseThis(model.id)}
                onChooseTarget={(option) => onChooseTarget(model.id, option)}
                onChooseProject={(project) =>
                  onChooseProject(model.id, project)
                }
                onCreateNew={() => onCreateNew(model.id)}
                onResolve={() => onResolve(model.id)}
                onChangeEntityKind={(kind) =>
                  onChangeEntityKind(model.id, kind)
                }
                onChooseOwnership={(choice, replacePersonId) =>
                  onChooseOwnership?.(model.id, choice, replacePersonId)
                }
                onProvideDate={(isoDate) => onProvideDate?.(model.id, isoDate)}
                currentOwners={ownersByCardId?.[model.id] ?? []}
                initialWhyOpen={whyOpenIds?.includes(model.id)}
              />
            ))}
          </ul>
        )}
      </section>

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
    </>
  );
}
