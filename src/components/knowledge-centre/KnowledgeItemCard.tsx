"use client";

import type { PriorityDot } from "@/lib/knowledge-centre/format-date-label";
import { priorityDotClass } from "@/lib/knowledge-centre/format-date-label";

export function KnowledgeItemCard({
  title,
  meta,
  priority = "none",
  epistemic,
  onSelect,
  selected = false,
  testId,
}: {
  title: string;
  meta?: string | null;
  priority?: PriorityDot;
  /** Meaningful epistemic only — Informal / Unconfirmed / Conflicting */
  epistemic?: string | null;
  onSelect?: () => void;
  selected?: boolean;
  testId?: string;
}) {
  const interactive = Boolean(onSelect);
  const className = `ocean-knowledge-item ${interactive ? "is-selectable" : ""}${selected ? " is-selected" : ""}`;
  const body = (
    <>
      <span
        className={priorityDotClass(priority)}
        aria-hidden
        title={priority === "none" ? undefined : `Priority ${priority}`}
      />
      <span className="ocean-knowledge-item-body">
        <span className="ocean-knowledge-item-title">{title}</span>
        {meta ? <span className="ocean-knowledge-item-meta">{meta}</span> : null}
        {epistemic ? (
          <span className="ocean-knowledge-item-epistemic">{epistemic}</span>
        ) : null}
      </span>
    </>
  );
  if (interactive) {
    return (
      <button
        type="button"
        className={className}
        onClick={onSelect}
        data-testid={testId}
        aria-pressed={selected}
      >
        {body}
      </button>
    );
  }
  return (
    <div className={className} data-testid={testId}>
      {body}
    </div>
  );
}
