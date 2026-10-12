"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReviewChangeViewModel } from "@/lib/capture/review/viewModel";
import type { ReviewOwnerHit } from "@/lib/capture/review/reviewReason";
import type { SuggestionKind } from "@/lib/capture/suggestions";
import {
  countQueueFilters,
  reviewApplyGate,
  reviewFamily,
} from "@/lib/capture/review/reviewBatch";
import { SuggestedChangeCard } from "./SuggestedChangeCard";
import { KnowledgeRememberList } from "./KnowledgeRememberList";
import type { TargetOption } from "./TargetPicker";

type QueueFilter = "all" | "needs_you" | "create" | "update" | "remove";

const FILTERS: { id: QueueFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "needs_you", label: "Needs You" },
  { id: "create", label: "Create" },
  { id: "update", label: "Update" },
  { id: "remove", label: "Remove" },
];

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
  targetOptions,
  highlightedId,
  onApprove,
  onDismiss,
  onInclude,
  onEditProposal,
  onDiscardReview,
  applying = false,
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
  onInclude?: (id: string) => void;
  onEditProposal?: (id: string, value: string, displayedTo?: string) => void;
  onDiscardReview?: () => void;
  applying?: boolean;
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
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [queueCollapsed, setQueueCollapsed] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const keepReviewingRef = useRef<HTMLButtonElement>(null);
  const rememberModels = models.filter(isKnowledgeRemember);
  const leftUntouchedModels = models.filter(
    (m) => m.readiness === "left_untouched" && !isKnowledgeRemember(m),
  );
  const operationModels = models.filter(
    (m) => !isKnowledgeRemember(m) && m.readiness !== "left_untouched",
  );
  const pending = operationModels.filter(
    (m) => !added[m.id] && !dismissed[m.id],
  );
  const reviewed = operationModels.filter(
    (m) => added[m.id] || dismissed[m.id],
  );

  const filterCounts = useMemo(() => countQueueFilters(pending), [pending]);
  const gate = useMemo(
    () => reviewApplyGate(models, added, dismissed),
    [models, added, dismissed],
  );
  const excludedCount = operationModels.filter(
    (model) => dismissed[model.id] && !added[model.id],
  ).length;
  const appliedCount = operationModels.filter((model) => added[model.id]).length;

  const visiblePending = pending.filter((model) => {
    if (filter === "all") return true;
    return reviewFamily(model) === filter;
  });
  const needsYou = visiblePending.filter((m) => reviewFamily(m) === "needs_you");
  const proposed = visiblePending.filter((m) => reviewFamily(m) !== "needs_you");
  const visibleReviewed = filter === "all" ? reviewed : [];
  const showLeftUntouched = filter === "all";

  const opTotal = operationModels.length;
  const opReviewed = reviewed.length;
  const applyBlocked = gate.blocked;
  const applyDisabled = applyBlocked || readyCount === 0 || applying;
  const applyName = applyBlocked
    ? `Apply blocked (${gate.unresolvedNeedsYou} need you)`
    : `Apply Ready (${readyCount})`;
  const leftoverCards = leftUntouchedModels.filter(
    (model) => !added[model.id] && !dismissed[model.id],
  );
  const leftoverVisible = showLeftUntouched && leftoverCards.length > 0;

  useEffect(() => {
    if (!discardOpen) return;
    keepReviewingRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setDiscardOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [discardOpen]);

  function confirmDiscard() {
    setDiscardOpen(false);
    onDiscardReview?.();
  }

  function renderCard(model: ReviewChangeViewModel) {
    return (
      <SuggestedChangeCard
        key={`${model.id}-${queueCollapsed ? "collapsed" : "open"}`}
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
        forceCollapsed={queueCollapsed}
        onApprove={() => onApprove(model.id)}
        onDismiss={() => onDismiss(model.id)}
        onInclude={onInclude ? () => onInclude(model.id) : undefined}
        onEdit={
          onEditProposal
            ? (value, displayedTo) =>
                onEditProposal(model.id, value, displayedTo)
            : undefined
        }
        onUseThis={() => onUseThis(model.id)}
        onChooseTarget={(option) => onChooseTarget(model.id, option)}
        onChooseProject={(project) => onChooseProject(model.id, project)}
        onCreateNew={() => onCreateNew(model.id)}
        onResolve={() => onResolve(model.id)}
        onChangeEntityKind={(kind) => onChangeEntityKind(model.id, kind)}
        onChooseOwnership={(choice, replacePersonId) =>
          onChooseOwnership?.(model.id, choice, replacePersonId)
        }
        onProvideDate={(isoDate) => onProvideDate?.(model.id, isoDate)}
        currentOwners={ownersByCardId?.[model.id] ?? []}
        initialWhyOpen={queueCollapsed ? false : whyOpenIds?.includes(model.id)}
      />
    );
  }

  return (
    <>
      <div className="capture-changes-head p09-review-heading">
        <div className="capture-changes-head-main">
          <h3
            id="capture-changes-title"
            className="lume-review-frame-title"
          >
            Review
          </h3>
          <p className="capture-review-progress" role="status">
            {opTotal} proposed operations from this capture
            <span className="sr-only">
              . Check these changes. Checked {opReviewed} of {opTotal}.
            </span>
          </p>
        </div>
      </div>
      <section
        className="capture-changes-panel"
        aria-labelledby="capture-changes-title"
      >
        <div className="lume-queue-toolbar">
          <div
            role="tablist"
            aria-label="Filter review queue"
            className="lume-queue-filters"
          >
            {FILTERS.map((item) => {
              const selected = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`lume-queue-filter${selected ? " is-selected" : ""}`}
                  data-filter={item.id}
                  onClick={() => setFilter(item.id)}
                >
                  {item.id !== "all" ? (
                    <span className="lume-queue-dot" aria-hidden />
                  ) : null}
                  {item.label}
                  <span className="lume-queue-count">{filterCounts[item.id]}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="ghost-btn lume-queue-collapse"
            onClick={() => setQueueCollapsed((value) => !value)}
          >
            {queueCollapsed ? "Expand changes" : "Collapse changes"}
          </button>
        </div>

        {visiblePending.length === 0 &&
        visibleReviewed.length === 0 &&
        !leftoverVisible ? (
          <p className="empty-copy">
            {opTotal === 0 && filter === "all"
              ? "Nothing to apply."
              : "Nothing of this kind in this capture."}
          </p>
        ) : (
          <div className="lume-queue-groups">
            {needsYou.length > 0 ? (
              <section className="lume-queue-group" aria-labelledby="group-needs-you">
                <div className="lume-queue-rule">
                  <h4 id="group-needs-you" className="lume-queue-heading">
                    Needs You
                  </h4>
                  <span className="lume-queue-count">{needsYou.length}</span>
                </div>
                <ul className="suggested-change-list">{needsYou.map(renderCard)}</ul>
              </section>
            ) : null}
            {proposed.length > 0 || visibleReviewed.length > 0 ? (
              <section className="lume-queue-group" aria-labelledby="group-proposed">
                <div className="lume-queue-rule">
                  <h4 id="group-proposed" className="lume-queue-heading">
                    <span className="p09-review-group-wide">Proposed</span>
                    <span className="p09-review-group-narrow">Proposed changes</span>
                  </h4>
                  <span className="lume-queue-count">
                    {proposed.length + visibleReviewed.length}
                  </span>
                </div>
                <ul className="suggested-change-list">
                  {proposed.map(renderCard)}
                  {visibleReviewed.map(renderCard)}
                </ul>
              </section>
            ) : null}
            {leftoverVisible ? (
              <section
                className="lume-queue-group"
                aria-labelledby="group-left-untouched"
                data-testid="review-left-untouched"
              >
                <div className="lume-queue-rule">
                  <h4 id="group-left-untouched" className="lume-queue-heading">
                    Left untouched
                  </h4>
                  <span className="lume-queue-count">{leftoverCards.length}</span>
                </div>
                <ul className="suggested-change-list">
                  {leftoverCards.map(renderCard)}
                </ul>
              </section>
            ) : null}
          </div>
        )}

        <div className="lume-commit-bar p09-review-actionbar">
          <p className="lume-commit-status">
            <span className="lume-commit-ready">
              <strong>
                {readyCount} {readyCount === 1 ? "change" : "changes"} ready
              </strong>
            </span>
            {applyBlocked ? (
              <span className="lume-commit-blocked">
                {gate.unresolvedNeedsYou === 1
                  ? "1 item still needs you before Apply"
                  : `${gate.unresolvedNeedsYou} items still need you before Apply`}
              </span>
            ) : null}
            {excludedCount > 0 ? (
              <span className="lume-commit-blocked">
                {excludedCount === 1
                  ? "1 excluded item will not be applied"
                  : `${excludedCount} excluded items will not be applied`}
              </span>
            ) : null}
          </p>
          <div className="p09-review-actions">
            <button
              type="button"
              className="ghost-btn lume-hit capture-discard-review-btn"
              onClick={() => setDiscardOpen(true)}
            >
              Discard
            </button>
            <button
              type="button"
              className="primary-btn lume-hit capture-apply-ready-btn"
              onClick={onApproveReady}
              disabled={applyDisabled}
              aria-label={applyName}
            >
              Apply {readyCount} changes
            </button>
          </div>
        </div>
        {discardOpen ? (
          <div className="p09-discard-backdrop" role="presentation">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="discard-review-title"
              className="p09-discard-dialog"
              data-testid="discard-review-dialog"
            >
              <h4 id="discard-review-title">Discard this review?</h4>
              <p>
                Unapplied proposals from this review will be dropped. Your
                existing project will not change.
              </p>
              <p>Nothing already saved to the project is removed.</p>
              {appliedCount > 0 ? (
                <p>Changes already saved stay in the project, with their history.</p>
              ) : null}
              <div className="p09-discard-actions">
                <button
                  ref={keepReviewingRef}
                  type="button"
                  className="ghost-btn"
                  onClick={() => setDiscardOpen(false)}
                >
                  Keep reviewing
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={confirmDiscard}
                >
                  Discard review
                </button>
              </div>
            </div>
          </div>
        ) : null}
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
