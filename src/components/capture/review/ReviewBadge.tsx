"use client";

import { DomainBadge } from "@/components/domain/DomainIcon";
import type { LumeDomain } from "@/lib/domain/lume-domain";
import { DomainMark, OperationMark } from "./DomainMark";
import type { SuggestionKind, SuggestionOp } from "@/lib/capture/suggestions";
import {
  reviewDomainLabel,
  reviewOpFamily,
  reviewOpWord,
  type ReviewOpFamily,
} from "@/lib/capture/review/reviewLanguage";

function domainIdentity(kind: SuggestionKind): "issues" | "people" | "todo" | "knowledge" | undefined {
  if (kind === "risk") return "issues";
  if (kind === "stakeholder" || kind === "availability") return "people";
  if (kind === "action") return "todo";
  if (kind === "knowledge" || kind === "memory") return "knowledge";
  return undefined;
}

/** Page 09 badge only when the kind maps to one of the four domains. */
function page09Badge(
  kind: SuggestionKind,
): { domain: LumeDomain; label: string } | null {
  if (kind === "risk") return { domain: "issue", label: "Issue" };
  if (kind === "stakeholder" || kind === "availability") {
    return { domain: "people", label: "Person" };
  }
  if (kind === "action") return { domain: "todo", label: "To Do" };
  if (kind === "knowledge" || kind === "memory") {
    return { domain: "knowledge", label: "Knowledge" };
  }
  return null;
}

export function OperationBar({
  family,
  operation,
}: {
  family: ReviewOpFamily;
  operation: SuggestionOp;
}) {
  return (
    <p className="lume-review-opbar">
      <OperationMark family={family} size={20} />
      <span className="lume-review-opbar-label">{reviewOpWord(family, operation)}</span>
    </p>
  );
}

export function DomainRow({
  entityKind,
  entityLabel,
  projectLabel,
  personName,
  unknownIdentity = false,
}: {
  entityKind: SuggestionKind;
  entityLabel: string;
  projectLabel?: string;
  personName?: string;
  unknownIdentity?: boolean;
}) {
  const identity = domainIdentity(entityKind);
  const badge = page09Badge(entityKind);
  return (
    <div
      className="lume-review-domain"
      data-lume-domain={identity}
    >
      {badge ? (
        <DomainBadge domain={badge.domain} label={badge.label} />
      ) : (
        <>
          <DomainMark kind={entityKind} title={entityLabel} size={30} />
          <span className="lume-review-domain-label">
            {reviewDomainLabel(entityKind)}
          </span>
        </>
      )}
      {unknownIdentity ? (
        <span className="sr-only">
          Identity not confirmed{personName ? `: ${personName}` : ""}
        </span>
      ) : null}
      {projectLabel ? (
        <span className="lume-review-project">{projectLabel}</span>
      ) : null}
    </div>
  );
}

/** @deprecated Prefer OperationBar — kept so existing review exports stay stable. */
export function OperationKicker({
  family,
  operation,
}: {
  family: ReviewOpFamily;
  operation: SuggestionOp;
  entityKind?: SuggestionKind;
  entityLabel?: string;
}) {
  return <OperationBar family={family} operation={operation} />;
}

/** @deprecated Prefer OperationBar. */
export function ReviewBadge({
  operation,
}: {
  operation: SuggestionOp;
  tone?: "default" | "ready" | "review" | "muted";
}) {
  return (
    <OperationBar
      family={reviewOpFamily(operation)}
      operation={operation}
    />
  );
}

/** @deprecated Needs You now lives in the operation bar. */
export function ReadinessBadge({
  readiness,
}: {
  readiness: "ready" | "needs_review" | "unmatched";
}) {
  if (readiness === "ready") return null;
  return <OperationBar family="needs_you" operation="update" />;
}
