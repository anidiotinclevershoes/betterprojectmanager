"use client";

import { useId, useState } from "react";
import type { ReviewChangeViewModel } from "@/lib/capture/review/viewModel";
import type { ReviewOwnerHit } from "@/lib/capture/review/reviewReason";
import type { SuggestionKind } from "@/lib/capture/suggestions";
import { CompactChangeCard } from "./CompactChangeCard";
import { WhyPanel } from "./WhyPanel";
import {
  CorrectionActions,
  type CorrectionHandlers,
} from "./CorrectionActions";
import type { TargetOption } from "./TargetPicker";

export function SuggestedChangeCard({
  model,
  state = "pending",
  targetOptions = [],
  onApprove,
  onDismiss,
  onKeepOpen,
  onUseThis,
  onChooseTarget,
  onChooseProject,
  onCreateNew,
  onResolve,
  onChangeEntityKind,
  onChooseOwnership,
  onProvideDate,
  currentOwners = [],
  initialWhyOpen = false,
  highlighted = false,
}: {
  model: ReviewChangeViewModel;
  state?: "pending" | "approved" | "dismissed";
  targetOptions?: TargetOption[];
  onApprove: () => void;
  onDismiss: () => void;
  onKeepOpen?: () => void;
  onUseThis?: () => void;
  onChooseTarget?: (option: TargetOption) => void;
  onChooseProject?: (project: {
    id: string;
    name: string;
    code?: string;
  }) => void;
  onCreateNew?: () => void;
  onResolve?: () => void;
  onChangeEntityKind?: (kind: SuggestionKind) => void;
  onChooseOwnership?: (
    choice: "share" | "replace" | "keep",
    replacePersonId?: string | null,
  ) => void;
  onProvideDate?: (isoDate: string) => void;
  currentOwners?: ReviewOwnerHit[];
  initialWhyOpen?: boolean;
  highlighted?: boolean;
}) {
  const [whyOpen, setWhyOpen] = useState(initialWhyOpen);
  const whyId = useId();
  const applyBlocked = model.executableApply === false;
  const needsReview = model.readiness === "needs_review" || applyBlocked;
  const unmatched = model.readiness === "unmatched";
  const attentionReadiness =
    state === "pending" && (needsReview || unmatched)
      ? applyBlocked
        ? "needs_review"
        : (model.readiness as "needs_review" | "unmatched")
      : undefined;

  const handlers: CorrectionHandlers = {
    onUseThis: () => {
      if (onUseThis) onUseThis();
      else onApprove();
    },
    onChooseTarget: (option) => onChooseTarget?.(option),
    onChooseProject: (project) => onChooseProject?.(project),
    onCreateNew: () => onCreateNew?.(),
    onResolve: () => {
      if (onResolve) onResolve();
      else onApprove();
    },
    onKeepOpen: () => {
      if (onKeepOpen) onKeepOpen();
      else onDismiss();
    },
    onDismiss,
    onApprove,
    onChangeEntityKind: (kind) => onChangeEntityKind?.(kind),
    onChooseOwnership,
    onProvideDate,
  };

  return (
    <li
      className={[
        "suggested-change-item",
        model.spansColumns ? "is-span-2" : "",
        highlighted ? "is-highlighted" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-review-card-id={model.id}
      id={`review-card-${model.id}`}
    >
      <CompactChangeCard
        entityKind={model.entityKind}
        entityLabel={model.entityLabel}
        recordName={model.recordName}
        operation={model.operation}
        operationLabel={model.operationLabel}
        projectLabel={
          model.showProjectLabel
            ? model.projectCode || model.projectName || undefined
            : undefined
        }
        diff={model.diff}
        readiness={attentionReadiness}
        state={state}
        highlighted={highlighted}
        why={
          <WhyPanel
            open={whyOpen}
            onToggle={() => setWhyOpen((v) => !v)}
            evidence={model.evidence}
            interpretation={model.interpretation}
            confidence={model.confidence}
            controlId={whyId}
          />
        }
        actions={
          state === "pending" ? (
            attentionReadiness ? (
              <CorrectionActions
                model={model}
                targetOptions={targetOptions}
                handlers={handlers}
                currentOwners={currentOwners}
              />
            ) : (
              <div className="compact-change-action-row">
                <button
                  type="button"
                  className="primary-btn"
                  onClick={onApprove}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={onDismiss}
                >
                  Dismiss
                </button>
              </div>
            )
          ) : (
            <p className="meta compact-change-status-label" aria-live="polite">
              {state === "approved" ? "Approved" : "Dismissed"}
            </p>
          )
        }
      />
    </li>
  );
}
