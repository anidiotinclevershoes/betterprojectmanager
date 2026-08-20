"use client";

import type { PriorityDot } from "@/lib/knowledge-centre/format-date-label";
import { priorityDotClass } from "@/lib/knowledge-centre/format-date-label";

export function KnowledgeItemCard({
  title,
  meta,
  priority = "none",
  epistemic,
  onSelect,
}: {
  title: string;
  meta?: string | null;
  priority?: PriorityDot;
  /** Meaningful epistemic only — Informal / Unconfirmed / Conflicting */
  epistemic?: string | null;
  onSelect?: () => void;
}) {
  const interactive = Boolean(onSelect);
  const shared = {
    className: `ocean-knowledge-item ${interactive ? "is-selectable" : ""}`,
    onClick: onSelect,
  } as const;
  if (interactive) {
    return (
      <button type="button" {...shared}>
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
      </button>
    );
  }
  return (
    <div {...shared}>
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
    </div>
  );
}
