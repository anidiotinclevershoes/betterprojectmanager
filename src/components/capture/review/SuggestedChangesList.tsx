"use client";

import { useMemo, useState } from "react";
import type { ReviewChangeViewModel } from "@/lib/capture/review/viewModel";
import type { ReviewOwnerHit } from "@/lib/capture/review/reviewReason";
import type { SuggestionKind } from "@/lib/capture/suggestions";
import { reviewOpFamily } from "@/lib/capture/review/reviewLanguage";
import { SuggestedChangeCard } from "./SuggestedChangeCard";
import { KnowledgeRememberList } from "./KnowledgeRememberList";
import type { TargetOption } from "./TargetPicker";

type QueueFilter = "all" | "needsYou" | "create" | "update" | "remove";

const FILTERS: { id: QueueFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "needsYou", label: "Needs you" },
  { id: "create", label: "Create" },
  { id: "update", label: "Update" },
  { id: "remove", label: "Remove" },
];

function familyOf(model: ReviewChangeViewModel) {
  const attention =
    model.readiness === "needs_review" || model.readiness === "unmatched"
      ? model.readiness
      : undefined;
  return reviewOpFamily(model.operation, attention, model.reviewReason);
}

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
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [queueCollapsed, setQueueCollapsed] = useState(false);
  const rememberModels = models.filter(isKnowledgeRemember);
  const operationModels = models.filter((m) => !isKnowledgeRemember(m));
  const pending = operationModels.filter(
    (m) => !added[m.id] && !dismissed[m.id],
  );
  const reviewed = operationModels.filter(
    (m) => added[m.id] || dismissed[m.id],
  );

  const filterCounts = useMemo(() => {
    const families = pending.map(familyOf);
    return {
      all: pending.length,
      needsYou: families.filter((f) => f === "needs_you").length,
      create: families.filter((f) => f === "create").length,
      update: families.filter((f) => f === "update").length,
      remove: families.filter((f) => f === "remove").length,
    };
  }, [pending]);

  const visiblePending = pending.filter((model) => {
    if (filter === "all") return true;
    const family = familyOf(model);
    if (filter === "needsYou") return family === "needs_you";
    return family === filter;
  });
  const needsYou = visiblePending.filter((m) => familyOf(m) === "needs_you");
  const proposed = visiblePending.filter((m) => familyOf(m) !== "needs_you");
  const visibleReviewed = filter === "all" ? reviewed : [];

  const opTotal = operationModels.length;
  const opReviewed = reviewed.length;
  const blockedCount = needsReviewCount + unmatchedCount;

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
        onApprove={() => onApprove(model.id)}
        onDismiss={() => onDismiss(model.id)}
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
      <section
        className="capture-changes-panel"
        aria-labelledby="capture-changes-title"
      >
        <div className="capture-changes-head">
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
            {queueCollapsed ? "Expand all" : "Collapse all"}
          </button>
        </div>

        {opTotal === 0 ? (
          <p className="empty-copy">Nothing to apply.</p>
        ) : visiblePending.length === 0 && visibleReviewed.length === 0 ? (
          <p className="empty-copy">Nothing of this kind in this capture.</p>
        ) : (
          <div className="lume-queue-groups">
            {needsYou.length > 0 ? (
              <section className="lume-queue-group" aria-labelledby="group-needs-you">
                <div className="lume-queue-rule">
                  <h4 id="group-needs-you" className="lume-queue-heading">
                    Needs you
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
                    Proposed
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
          </div>
        )}

        <div className="lume-commit-bar">
          <p className="lume-commit-status">
            <span className="lume-commit-ready">
              <strong>{readyCount}</strong> ready
            </span>
            {blockedCount > 0 ? (
              <>
                <span aria-hidden className="capture-count-sep">
                  ·
                </span>
                <span className="lume-commit-blocked">
                  {blockedCount} {blockedCount === 1 ? "item requires" : "items require"}{" "}
                  attention
                </span>
              </>
            ) : null}
          </p>
          {readyCount > 0 ? (
            <button
              type="button"
              className="primary-btn lume-hit capture-apply-ready-btn"
              onClick={onApproveReady}
              aria-label={`Apply Ready (${readyCount})`}
            >
              Apply {readyCount} changes
            </button>
          ) : null}
        </div>
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
