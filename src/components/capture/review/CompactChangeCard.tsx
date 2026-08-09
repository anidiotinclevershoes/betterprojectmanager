"use client";

import type { ReactNode } from "react";
import type { SuggestionKind } from "@/lib/capture/suggestions";
import { ReadinessBadge, ReviewBadge } from "./ReviewBadge";
import type { ChangeDiff } from "@/lib/capture/review/viewModel";

const KIND_ICON: Record<SuggestionKind, string> = {
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

function ChangeDiffBlock({
  diff,
  entityKind,
}: {
  diff: ChangeDiff;
  entityKind: SuggestionKind;
}) {
  const layout = diff.layout ?? "from_to";

  if (layout === "create") {
    return (
      <div
        className={`compact-change-diff compact-change-diff-create is-kind-${entityKind}`}
        aria-label={`${diff.label}: ${diff.to}`}
      >
        <p className="compact-change-diff-label">{diff.label}</p>
        <p className="compact-change-to compact-change-create-title">{diff.to}</p>
        {diff.meta ? <p className="compact-change-create-meta">{diff.meta}</p> : null}
      </div>
    );
  }

  if (layout === "suggested_only" || !diff.from || diff.from === "—") {
    return (
      <div
        className={`compact-change-diff compact-change-diff-suggested is-kind-${entityKind}`}
        aria-label={`${diff.label}: ${diff.to}`}
      >
        <p className="compact-change-diff-label">{diff.label}</p>
        <p className="compact-change-to">{diff.to}</p>
      </div>
    );
  }

  if (layout === "remove") {
    return (
      <div
        className={`compact-change-diff compact-change-diff-remove is-kind-${entityKind}`}
        aria-label={`Current ${diff.from}, suggested ${diff.to}`}
      >
        <div className="compact-change-diff-grid">
          <div className="compact-change-diff-col">
            <span className="compact-change-col-label">Current</span>
            <span className="compact-change-from">{diff.from}</span>
          </div>
          <span className="compact-change-arrow" aria-hidden>
            →
          </span>
          <div className="compact-change-diff-col">
            <span className="compact-change-col-label">Suggested</span>
            <span className="compact-change-to">{diff.to}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`compact-change-diff is-kind-${entityKind}`}
      aria-label={`${diff.label}: current ${diff.from}, suggested ${diff.to}`}
    >
      <p className="compact-change-diff-label">{diff.label}</p>
      <div className="compact-change-diff-grid">
        <div className="compact-change-diff-col">
          <span className="compact-change-col-label">Current</span>
          <span className="compact-change-from">{diff.from}</span>
        </div>
        <span className="compact-change-arrow" aria-hidden>
          →
        </span>
        <div className="compact-change-diff-col">
          <span className="compact-change-col-label">Suggested</span>
          <span className="compact-change-to">{diff.to}</span>
        </div>
      </div>
    </div>
  );
}

export function CompactChangeCard({
  entityKind,
  entityLabel,
  recordName,
  operation,
  diff,
  why,
  actions,
  readiness,
  emphasized,
  state,
  highlighted,
}: {
  entityKind: SuggestionKind;
  entityLabel: string;
  recordName: string;
  operation: Parameters<typeof ReviewBadge>[0]["operation"];
  diff?: ChangeDiff;
  /** Why panel — rendered above actions. */
  why?: ReactNode;
  actions: ReactNode;
  readiness?: "needs_review" | "unmatched";
  /** @deprecated Prefer readiness */
  emphasized?: boolean;
  state?: "pending" | "approved" | "dismissed";
  highlighted?: boolean;
}) {
  const attention = readiness ?? (emphasized ? "needs_review" : undefined);
  return (
    <article
      className={[
        "compact-change-card",
        `is-kind-${entityKind}`,
        attention ? "is-emphasized" : "",
        attention === "unmatched" ? "is-unmatched" : "",
        state === "approved" ? "is-approved" : "",
        state === "dismissed" ? "is-dismissed" : "",
        highlighted ? "is-flash" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="compact-change-head">
        <div className="compact-change-entity">
          <span className="compact-change-ico" aria-hidden>
            {KIND_ICON[entityKind]}
          </span>
          <div className="compact-change-titles">
            <p className="compact-change-type">{entityLabel}</p>
            <h4 className="compact-change-title">{recordName}</h4>
          </div>
        </div>
        {attention ? (
          <ReadinessBadge readiness={attention} />
        ) : (
          <ReviewBadge operation={operation} tone="default" />
        )}
      </header>

      {diff ? <ChangeDiffBlock diff={diff} entityKind={entityKind} /> : null}

      {why ? <div className="compact-change-why">{why}</div> : null}

      <div className="compact-change-actions">{actions}</div>
    </article>
  );
}
