"use client";

import type { ReviewChangeViewModel } from "@/lib/capture/review/viewModel";

const KIND_ICON: Record<string, string> = {
  action: "☑",
  milestone: "◆",
  decision: "◇",
  risk: "⚠",
  stakeholder: "◎",
  knowledge: "☰",
  nudge: "→",
  meeting: "○",
  memory: "☰",
};

export function ReadyChangeRow({
  model,
  highlighted,
  onApprove,
  onDismiss,
}: {
  model: ReviewChangeViewModel;
  highlighted?: boolean;
  onApprove: () => void;
  onDismiss: () => void;
}) {
  const summary = model.diff?.to?.trim() || model.recordName;
  return (
    <li
      className={`capture-v2-ready-row ${highlighted ? "is-highlighted" : ""}`}
      id={`review-card-${model.id}`}
      data-review-card-id={model.id}
      data-testid="capture-v2-ready-row"
    >
      <span className="capture-v2-ready-ico" aria-hidden>
        {KIND_ICON[model.entityKind] ?? "•"}
      </span>
      <div className="capture-v2-ready-copy">
        <p className="capture-v2-ready-kind">
          {model.operationLabel || model.entityLabel}
          {model.showProjectLabel && (model.projectCode || model.projectName)
            ? ` · ${model.projectCode || model.projectName}`
            : ""}
        </p>
        <p className="capture-v2-ready-title">{summary}</p>
      </div>
      <div className="capture-v2-ready-actions">
        <button type="button" className="primary-btn" onClick={onApprove}>
          Approve
        </button>
        <button type="button" className="ghost-btn" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </li>
  );
}
