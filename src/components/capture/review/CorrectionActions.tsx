"use client";

import { useState } from "react";
import type { ReviewChangeViewModel } from "@/lib/capture/review/viewModel";
import type { ReviewReason } from "@/lib/capture/review/reviewReason";
import {
  existingOrNewCopy,
  missingDateCopy,
  ownershipChoiceCopy,
  type ReviewOwnerHit,
} from "@/lib/capture/review/reviewReason";
import type { SuggestionKind } from "@/lib/capture/suggestions";
import { KIND_LABEL } from "@/lib/capture/suggestions";
import {
  isApplyExecutableSuggestion,
  unsupportedApplyReason,
} from "@/lib/capture/apply/executability";
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
  /** @deprecated Keep Open only dismissed — no longer rendered. */
  onKeepOpen?: () => void;
  onDismiss: () => void;
  onApprove: () => void;
  onChangeEntityKind: (kind: SuggestionKind) => void;
  onChooseOwnership?: (
    choice: "share" | "replace" | "keep",
    replacePersonId?: string | null,
  ) => void;
  onProvideDate?: (isoDate: string) => void;
};

export function CorrectionActions({
  model,
  targetOptions,
  handlers,
  currentOwners = [],
  hidePrompt = false,
}: {
  model: ReviewChangeViewModel;
  targetOptions: TargetOption[];
  handlers: CorrectionHandlers;
  currentOwners?: ReviewOwnerHit[];
  /** Card already shows the Needs You question. */
  hidePrompt?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dateValue, setDateValue] = useState("");
  const reason: ReviewReason | undefined =
    model.reviewReason ??
    (model.readiness === "unmatched" ? "TARGET_UNCERTAIN" : undefined);

  const applyExecutable =
    model.executableApply !== false &&
    isApplyExecutableSuggestion(model.suggestion);
  const canApprove =
    applyExecutable &&
    (model.canApprove === true ||
      (model.canApprove === undefined && model.readiness === "ready"));
  const userCanRepair =
    reason === "ENTITY_TYPE_UNCERTAIN" ||
    reason === "PROJECT_UNCERTAIN" ||
    reason === "TARGET_UNCERTAIN" ||
    reason === "OWNERSHIP_UNCERTAIN" ||
    model.missingRequiredField === "date";

  if (!applyExecutable && !userCanRepair) {
    const copy =
      model.needsReviewReason ||
      unsupportedApplyReason(model.suggestion, model.recordName);
    return (
      <div className="compact-change-correction">
        {copy ? <p className="compact-change-review-copy">{copy}</p> : null}
        <div className="compact-change-action-row">
          <button type="button" className="ghost-btn" onClick={handlers.onDismiss}>
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (!reason && model.readiness === "ready" && canApprove) {
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
  const ownershipUncertain =
    reason === "OWNERSHIP_UNCERTAIN" ||
    model.suggestion.ownershipSemantics === "ambiguous";

  if (ownershipUncertain) {
    const labels = ownershipChoiceCopy({
      currentOwnerNames: currentOwners.map((o) => o.personName),
      scope: model.suggestion.responsibilityScope,
      incomingPersonName: model.suggestion.personName,
    });
    const otherOwners = currentOwners.filter((o) => {
      const incoming = model.suggestion.personName?.trim();
      if (!incoming) return true;
      return o.personName.trim().toLowerCase() !== incoming.toLowerCase();
    });
    const singleReplaceId =
      otherOwners.length === 1 ? otherOwners[0]?.personId ?? null : null;
    return (
      <div className="compact-change-correction" data-testid="review-ownership-choice">
        <p className="compact-change-review-copy">{labels.question}</p>
        <div className="compact-change-action-row">
          <button
            type="button"
            className="primary-btn"
            data-testid="review-ownership-share"
            onClick={() => handlers.onChooseOwnership?.("share")}
          >
            {labels.shareLabel}
          </button>
          {otherOwners.length > 1 ? (
            otherOwners.map((owner) => (
              <button
                key={owner.personId ?? owner.personName}
                type="button"
                className="muted-btn"
                data-testid="review-ownership-replace"
                onClick={() =>
                  handlers.onChooseOwnership?.("replace", owner.personId)
                }
              >
                Replace {owner.personName}
                {model.suggestion.personName
                  ? ` with ${model.suggestion.personName}`
                  : ""}
              </button>
            ))
          ) : (
            <button
              type="button"
              className="muted-btn"
              data-testid="review-ownership-replace"
              onClick={() =>
                handlers.onChooseOwnership?.("replace", singleReplaceId)
              }
            >
              {labels.replaceLabel}
            </button>
          )}
          <button
            type="button"
            className="ghost-btn"
            data-testid="review-ownership-keep"
            onClick={() => handlers.onChooseOwnership?.("keep")}
          >
            {labels.keepLabel}
          </button>
        </div>
      </div>
    );
  }

  if (model.missingRequiredField === "date") {
    return (
      <div className="compact-change-correction" data-testid="review-missing-date">
        <p className="compact-change-review-copy">
          {missingDateCopy(model.recordName)}
        </p>
        <div className="compact-change-action-row">
          <label className="compact-change-date-label">
            <span className="sr-only">Date</span>
            <input
              type="date"
              className="compact-change-date-input"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              data-testid="review-missing-date-input"
            />
          </label>
          <button
            type="button"
            className="primary-btn"
            disabled={!dateValue}
            data-testid="review-missing-date-apply"
            onClick={() => {
              if (!dateValue) return;
              handlers.onProvideDate?.(dateValue);
            }}
          >
            Use this date
          </button>
          <button type="button" className="ghost-btn" onClick={handlers.onDismiss}>
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (reason === "PROJECT_UNCERTAIN") {
    const candidates =
      model.suggestion.projectCandidates ??
      model.finding?.projectCandidates ??
      [];
    return (
      <div className="compact-change-correction">
        {!hidePrompt ? (
          <p className="compact-change-review-copy">Which project?</p>
        ) : null}
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
    const namedTarget = Boolean(
      model.finding?.target?.entityId ||
        model.suggestion.targetTodoId ||
        model.suggestion.targetEntityId,
    );
    const labels = existingOrNewCopy({
      entityLabel: model.entityLabel,
      recordName: namedTarget ? model.recordName : undefined,
    });
    return (
      <div
        className="compact-change-correction"
        data-testid={namedTarget ? "review-existing-or-new" : undefined}
      >
        {namedTarget ? (
          <p className="compact-change-review-copy">{labels.question}</p>
        ) : !hidePrompt && copy ? (
          <p className="compact-change-review-copy">{copy}</p>
        ) : null}
        <div className="compact-change-action-row">
          {namedTarget ? (
            <button
              type="button"
              className="primary-btn"
              data-testid="review-existing-or-new-update"
              onClick={handlers.onUseThis}
            >
              {labels.updateLabel}
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
            data-testid="review-existing-or-new-create"
            onClick={handlers.onCreateNew}
          >
            {labels.createLabel}
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
        {applyExecutable &&
        model.entityKind === "risk" &&
        (model.operation === "complete" || model.operation === "update") ? (
          <button
            type="button"
            className="primary-btn"
            onClick={handlers.onResolve}
          >
            Resolve Risk
          </button>
        ) : canApprove ? (
          <button
            type="button"
            className="primary-btn"
            onClick={handlers.onApprove}
          >
            Approve
          </button>
        ) : null}
        <button type="button" className="ghost-btn" onClick={handlers.onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
