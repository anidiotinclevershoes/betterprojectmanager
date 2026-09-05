"use client";

import { useId, useState } from "react";
import type { ReviewChangeViewModel } from "@/lib/capture/review/viewModel";
import {
  ownershipChoiceCopy,
  type ReviewOwnerHit,
} from "@/lib/capture/review/reviewReason";
import type { SuggestionKind } from "@/lib/capture/suggestions";
import {
  needsYouHeadline,
  needsYouSupporting,
  reviewOpFamily,
} from "@/lib/capture/review/reviewLanguage";
import { CompactChangeCard } from "./CompactChangeCard";
import { DomainMark } from "./DomainMark";
import { WhyPanel } from "./WhyPanel";
import {
  CorrectionActions,
  type CorrectionHandlers,
} from "./CorrectionActions";
import type { TargetOption } from "./TargetPicker";
import "./review-cards.css";

export function SuggestedChangeCard({
  model,
  state = "pending",
  targetOptions = [],
  onApprove,
  onDismiss,
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
  /** @deprecated Keep Open only dismissed — no longer rendered. */
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
    onDismiss,
    onApprove,
    onChangeEntityKind: (kind) => onChangeEntityKind?.(kind),
    onChooseOwnership,
    onProvideDate,
  };

  const family = reviewOpFamily(
    model.operation,
    attentionReadiness,
    model.reviewReason,
  );
  const headline =
    family === "needs_you"
      ? needsYouHeadline(model.reviewReason, model.entityLabel)
      : undefined;
  const ownershipQuestion =
    family === "needs_you" && model.reviewReason === "OWNERSHIP_UNCERTAIN"
      ? ownershipChoiceCopy({
          currentOwnerNames: currentOwners.map((owner) => owner.personName),
          scope: model.suggestion.responsibilityScope,
          incomingPersonName: model.suggestion.personName,
        }).question
      : null;
  const detail =
    family === "needs_you"
      ? ownershipQuestion ??
        needsYouSupporting(
          headline || "",
          model.needsReviewReason,
          model.recordName,
        )
      : null;

  if (state !== "pending") {
    const resolvedLabel = state === "approved" ? "Approved" : "Dismissed";
    return (
      <li
        className={[
          "suggested-change-item",
          highlighted ? "is-highlighted" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-review-card-id={model.id}
        id={`review-card-${model.id}`}
      >
        <article
          className={[
            "lume-review-card",
            "is-resolved",
            state === "dismissed" ? "is-dismissed" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-live="polite"
          aria-label={`${resolvedLabel}: ${model.recordName}`}
        >
          <span className="lume-review-resolved-mark" aria-hidden>
            {state === "approved" ? "✓" : "–"}
          </span>
          <DomainMark kind={model.entityKind} title={model.entityLabel} />
          <p className="lume-review-resolved-copy">
            {resolvedLabel} · <strong>{model.recordName}</strong>
          </p>
        </article>
      </li>
    );
  }

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
        needsYouHeadline={headline}
        needsYouDetail={detail}
        reviewReason={model.reviewReason}
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
          attentionReadiness ? (
            <CorrectionActions
              model={model}
              targetOptions={targetOptions}
              handlers={handlers}
              currentOwners={currentOwners}
              hidePrompt
            />
          ) : (
            <div className="compact-change-action-row">
              <button type="button" className="primary-btn" onClick={onApprove}>
                Approve
              </button>
              <button type="button" className="ghost-btn" onClick={onDismiss}>
                Dismiss
              </button>
            </div>
          )
        }
      />
    </li>
  );
}
