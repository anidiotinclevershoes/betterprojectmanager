"use client";

import type { ChangeDiff } from "@/lib/capture/review/viewModel";
import type { SuggestionKind, SuggestionOp } from "@/lib/capture/suggestions";
import type { ReactNode } from "react";
import "./review-cards.css";
import { DomainRow, OperationBar } from "./ReviewBadge";
import {
  reviewFamilyClass,
  reviewOpFamily,
  type ReviewOpFamily,
} from "@/lib/capture/review/reviewLanguage";

function removeConsequence(diff: ChangeDiff): string {
  const raw = (diff.to || "Remove from this project").trim();
  if (/remove from project/i.test(raw)) return "Will be removed from project";
  if (/archive from project/i.test(raw)) return "Will be archived from project";
  return raw;
}

function ChangeCompare({ diff }: { diff: ChangeDiff }) {
  const layout = diff.layout ?? "from_to";

  if (layout === "create") {
    return diff.meta ? <p className="lume-review-meta">{diff.meta}</p> : null;
  }

  if (layout === "remove") {
    return (
      <p className="lume-review-consequence">{removeConsequence(diff)}</p>
    );
  }

  const hasFrom = Boolean(diff.from && diff.from !== "—");
  if (layout === "suggested_only" || !hasFrom) {
    return (
      <div className="lume-review-mutation">
        {diff.label ? <p className="lume-review-field">{diff.label}</p> : null}
        <p className="lume-review-to">{diff.to}</p>
      </div>
    );
  }

  return (
    <div
      className="lume-review-mutation"
      aria-label={`${diff.label}: ${diff.from} to ${diff.to}`}
    >
      {diff.label ? <p className="lume-review-field">{diff.label}</p> : null}
      <p className="lume-review-compare">
        <span className="lume-review-from">{diff.from}</span>
        <span className="lume-review-arrow" aria-hidden>
          →
        </span>
        <span className="lume-review-to">{diff.to}</span>
      </p>
    </div>
  );
}

function ReviewTruth({
  family,
  recordName,
  diff,
  needsYouHeadline,
  needsYouDetail,
}: {
  family: ReviewOpFamily;
  recordName: string;
  diff?: ChangeDiff;
  needsYouHeadline?: string;
  needsYouDetail?: string | null;
}) {
  if (family === "needs_you") {
    const showCompare =
      diff &&
      (diff.layout === "from_to" || diff.layout === "suggested_only") &&
      diff.to &&
      diff.to !== recordName;
    return (
      <div className="lume-review-truth">
        <h4 className="lume-review-hero">
          {needsYouHeadline || "Lume needs a decision from you."}
        </h4>
        {recordName ? <p className="lume-review-subject">{recordName}</p> : null}
        {needsYouDetail ? (
          <p className="lume-review-support">{needsYouDetail}</p>
        ) : null}
        {showCompare ? <ChangeCompare diff={diff} /> : null}
      </div>
    );
  }

  if (family === "create") {
    const title = (diff?.to || recordName).trim() || recordName;
    return (
      <div className="lume-review-truth">
        <h4 className="lume-review-hero">{title}</h4>
        <ChangeCompare
          diff={diff ?? { label: "", from: "", to: title, layout: "create" }}
        />
      </div>
    );
  }

  if (family === "remove") {
    return (
      <div className="lume-review-truth">
        <h4 className="lume-review-hero">{recordName}</h4>
        <ChangeCompare
          diff={
            diff ?? {
              label: "",
              from: "",
              to: "Remove from this project",
              layout: "remove",
            }
          }
        />
      </div>
    );
  }

  return (
    <div className="lume-review-truth">
      {recordName ? <h4 className="lume-review-hero">{recordName}</h4> : null}
      {diff ? <ChangeCompare diff={diff} /> : null}
    </div>
  );
}

export function CompactChangeCard({
  entityKind,
  entityLabel,
  recordName,
  operation,
  operationLabel: _operationLabel,
  projectLabel,
  diff,
  why,
  actions,
  readiness,
  emphasized,
  state,
  highlighted,
  needsYouHeadline,
  needsYouDetail,
  reviewReason,
}: {
  entityKind: SuggestionKind;
  entityLabel: string;
  recordName: string;
  operation: SuggestionOp;
  operationLabel?: string;
  projectLabel?: string;
  diff?: ChangeDiff;
  why?: ReactNode;
  actions: ReactNode;
  readiness?: "needs_review" | "unmatched";
  /** @deprecated Prefer readiness */
  emphasized?: boolean;
  state?: "pending" | "approved" | "dismissed";
  highlighted?: boolean;
  needsYouHeadline?: string;
  needsYouDetail?: string | null;
  reviewReason?: import("@/lib/capture/review/reviewReason").ReviewReason | null;
}) {
  const attention = readiness ?? (emphasized ? "needs_review" : undefined);
  const family = reviewOpFamily(operation, attention, reviewReason);

  const articleLabel =
    family === "needs_you"
      ? `${needsYouHeadline || "Needs you"}, ${entityLabel}${
          recordName ? `: ${recordName}` : ""
        }`
      : family === "create"
        ? `Create ${entityLabel}: ${diff?.to || recordName}`
        : family === "remove"
          ? `Remove ${entityLabel}: ${recordName}`
          : diff?.from && diff.to
            ? `Update ${entityLabel} ${recordName}: ${diff.label} ${diff.from} to ${diff.to}`
            : `Update ${entityLabel}: ${recordName}`;

  return (
    <article
      className={[
        "lume-review-card",
        reviewFamilyClass(family),
        highlighted ? "is-flash" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-review-family={family}
      data-review-kind={entityKind}
      aria-label={articleLabel}
    >
      <header className="lume-review-head">
        <OperationBar family={family} operation={operation} />
      </header>

      <div className="lume-review-body">
        <DomainRow
          entityKind={entityKind}
          entityLabel={entityLabel}
          projectLabel={projectLabel}
        />

        <ReviewTruth
          family={family}
          recordName={recordName}
          diff={diff}
          needsYouHeadline={needsYouHeadline}
          needsYouDetail={needsYouDetail}
        />

        {why ? <div className="lume-review-why">{why}</div> : null}

        {state === "pending" || !state ? (
          <div className="lume-review-actions">{actions}</div>
        ) : null}
      </div>
    </article>
  );
}
