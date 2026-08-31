"use client";

import { useId, useState } from "react";
import type { ReviewChangeViewModel } from "@/lib/capture/review/viewModel";
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
  onKeepOpen,
  onUseThis,
  onChooseTarget,
  onChooseProject,
  onCreateNew,
  onResolve,
  onChangeEntityKind,
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
  initialWhyOpen?: boolean;
  highlighted?: boolean;
}) {
  const [whyOpen, setWhyOpen] = useState(initialWhyOpen);
  const whyId = useId();
  const needsReview = model.readiness === "needs_review";
  const unmatched = model.readiness === "unmatched";
  const attentionReadiness =
    state === "pending" && (needsReview || unmatched)
      ? (model.readiness as "needs_review" | "unmatched")
      : undefined;

  const handlers: CorrectionHandlers = {
    onUseThis: () => onUseThis?.() ?? onApprove(),
    onChooseTarget: (option) => onChooseTarget?.(option),
    onChooseProject: (project) => onChooseProject?.(project),
    onCreateNew: () => onCreateNew?.(),
    onResolve: () => onResolve?.() ?? onApprove(),
    onKeepOpen: () => onKeepOpen?.() ?? onDismiss(),
    onDismiss,
    onApprove,
    onChangeEntityKind: (kind) => onChangeEntityKind?.(kind),
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
  const detail =
    family === "needs_you"
      ? needsYouSupporting(
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
