"use client";

import type { ReactNode } from "react";
import type { SuggestionKind } from "@/lib/capture/suggestions";
import { ReviewBadge } from "./ReviewBadge";
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

export function CompactChangeCard({
  entityKind,
  entityLabel,
  recordName,
  operation,
  diff,
  actions,
  footer,
  emphasized,
  state,
}: {
  entityKind: SuggestionKind;
  entityLabel: string;
  recordName: string;
  operation: Parameters<typeof ReviewBadge>[0]["operation"];
  diff?: ChangeDiff;
  actions: ReactNode;
  footer?: ReactNode;
  emphasized?: boolean;
  state?: "pending" | "approved" | "dismissed";
}) {
  return (
    <article
      className={[
        "compact-change-card",
        emphasized ? "is-emphasized" : "",
        state === "approved" ? "is-approved" : "",
        state === "dismissed" ? "is-dismissed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="compact-change-head">
        <div className="compact-change-entity">
          <span className="compact-change-ico" aria-hidden>
            {KIND_ICON[entityKind]}
          </span>
          <div>
            <p className="compact-change-type">{entityLabel}</p>
            <h4 className="compact-change-title">{recordName}</h4>
          </div>
        </div>
        <ReviewBadge
          operation={operation}
          tone={emphasized ? "review" : "ready"}
        />
      </header>

      {diff ? (
        <div className="compact-change-diff" aria-label={`${diff.label} change`}>
          <p className="compact-change-diff-label">{diff.label}</p>
          <div className="compact-change-diff-values">
            <span className="compact-change-from">{diff.from}</span>
            <span className="compact-change-arrow" aria-hidden>
              ↓
            </span>
            <span className="compact-change-to">{diff.to}</span>
          </div>
        </div>
      ) : null}

      <div className="compact-change-actions">{actions}</div>
      {footer}
    </article>
  );
}
