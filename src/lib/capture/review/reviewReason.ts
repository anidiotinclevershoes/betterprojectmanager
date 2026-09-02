/**
 * Deterministic Needs Review reason — drives correction controls.
 * Presentation-only; no AI calls.
 */

import type {
  CaptureFinding,
  FindingCoverageItem,
  ProposedOperation,
} from "@/lib/capture/findings";
import type { PendingSuggestion } from "@/lib/capture/suggestions";

export type ReviewReason =
  | "TARGET_UNCERTAIN"
  | "ENTITY_TYPE_UNCERTAIN"
  | "STATE_UNCERTAIN"
  | "OPERATION_UNCERTAIN"
  | "VALUE_UNCERTAIN"
  | "PROJECT_UNCERTAIN"
  | "OWNERSHIP_UNCERTAIN";

export type ReviewOwnerHit = {
  personId: string | null;
  personName: string;
  scope: string;
};

export function deriveReviewReason(args: {
  readiness: "ready" | "needs_review" | "unmatched";
  finding?: CaptureFinding;
  operation?: ProposedOperation;
  coverage?: FindingCoverageItem;
  suggestion?: PendingSuggestion;
  needsReviewReason?: string;
  capturePipeline?: "legacy" | "v2";
}): ReviewReason | undefined {
  const {
    readiness,
    finding,
    operation,
    coverage,
    suggestion,
    needsReviewReason,
    capturePipeline,
  } = args;
  if (readiness === "ready") return undefined;

  if (
    (finding?.projectCandidates &&
      finding.projectCandidates.length > 1 &&
      !finding.projectId &&
      !suggestion?.projectId) ||
    suggestion?.projectUncertain
  ) {
    return "PROJECT_UNCERTAIN";
  }

  if (suggestion?.ownershipSemantics === "ambiguous") {
    return "OWNERSHIP_UNCERTAIN";
  }

  const blob = [
    coverage?.reason,
    finding?.clarificationQuestion,
    finding?.validationWarning,
    needsReviewReason,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/which project|project uncertain|ambiguous project/i.test(blob)) {
    return "PROJECT_UNCERTAIN";
  }

  if (
    /share or replace|already owns|ownership/i.test(blob) &&
    suggestion?.legalDomain === "responsibility"
  ) {
    return "OWNERSHIP_UNCERTAIN";
  }

  if (readiness === "unmatched") return "TARGET_UNCERTAIN";

  if (
    /changed since Review|Capture again before applying|no longer on this project/i.test(
      blob,
    )
  ) {
    return "OPERATION_UNCERTAIN";
  }

  if (
    finding?.invalidTarget ||
    /which existing|couldn'?t confidently identify|could not (identify|match)|unmatched|which record|target/i.test(
      blob,
    )
  ) {
    return "TARGET_UNCERTAIN";
  }

  if (
    /entity type|interpreted this as|what kind|todo or risk|type of (item|record)/i.test(
      blob,
    ) ||
    (finding?.findingType === "NEW_INFORMATION" &&
      !finding.target?.entityType &&
      !finding.changes?.entityType)
  ) {
    return "ENTITY_TYPE_UNCERTAIN";
  }

  const isStateOp =
    suggestion?.op === "complete" ||
    operation?.operation === "COMPLETE" ||
    finding?.findingType === "ENTITY_COMPLETED" ||
    finding?.findingType === "ENTITY_REOPENED" ||
    finding?.findingType === "ENTITY_BLOCKED";

  if (
    isStateOp &&
    (/resolved|complete|open|blocked|status|state|keep open/i.test(blob) ||
      finding?.requiresClarification)
  ) {
    return "STATE_UNCERTAIN";
  }

  if (
    /operation|inconsistent|destructive|archive|delete|safe single operation/i.test(
      blob,
    ) ||
    operation?.destructive
  ) {
    return "OPERATION_UNCERTAIN";
  }

  const confidence = operation?.confidence ?? finding?.confidence;
  const confidenceIsInformational = capturePipeline === "v2";
  if (
    /value|date|due|proposed|which value/i.test(blob) ||
    (!confidenceIsInformational && /confidence/i.test(blob)) ||
    (!confidenceIsInformational &&
      typeof confidence === "number" &&
      confidence < 70)
  ) {
    return "VALUE_UNCERTAIN";
  }

  if (finding?.findingType === "AMBIGUOUS") {
    return finding.target?.entityId ? "OPERATION_UNCERTAIN" : "TARGET_UNCERTAIN";
  }

  if (!finding?.target?.entityId && suggestion?.op !== "create") {
    return "TARGET_UNCERTAIN";
  }
  return "OPERATION_UNCERTAIN";
}

export function reviewReasonCopy(
  reason: ReviewReason,
  opts?: {
    recordName?: string;
    entityLabel?: string;
    projectCandidates?: Array<{ name: string; code?: string }>;
    currentOwnerNames?: string[];
    incomingPersonName?: string;
    scope?: string;
  },
): string {
  switch (reason) {
    case "PROJECT_UNCERTAIN":
      return opts?.projectCandidates?.length
        ? `Which project?\n${opts.projectCandidates
            .map((c) => c.code || c.name)
            .join(" · ")}`
        : "Which project does this refer to?";
    case "TARGET_UNCERTAIN":
      return existingOrNewCopy({
        entityLabel: opts?.entityLabel,
        recordName: opts?.recordName,
      }).question;
    case "ENTITY_TYPE_UNCERTAIN":
      return opts?.entityLabel
        ? `Lume interpreted this as:\n${opts.entityLabel}`
        : "Lume isn't sure which type of item this should be.";
    case "STATE_UNCERTAIN":
      return opts?.entityLabel === "Risk"
        ? "Lume isn't sure whether this Risk is resolved."
        : "Lume isn't sure about the resulting state for this item.";
    case "OPERATION_UNCERTAIN":
      return "Lume needs confirmation before applying this change.";
    case "VALUE_UNCERTAIN":
      return "Lume isn't sure about the proposed value.";
    case "OWNERSHIP_UNCERTAIN":
      return ownershipChoiceCopy({
        currentOwnerNames: opts?.currentOwnerNames ?? [],
        scope: opts?.scope,
        incomingPersonName: opts?.incomingPersonName,
      }).question;
  }
}

/** Known identity-gate reasons → terse Review copy. No new identity semantics. */
export function friendlierNeedsYouCopy(reason: string | undefined): string | undefined {
  if (!reason) return reason;
  if (
    reason ===
    "This name is not a confirmed existing Person identity, so Lume will not create a stakeholder."
  ) {
    return "I need a full name before adding someone new.";
  }
  if (reason === "A new person needs a name before Lume will write a stakeholder.") {
    return "What name should I use?";
  }
  if (
    reason ===
    "Lume cannot tell which person this refers to, so it will not create a new stakeholder."
  ) {
    return "I need to know which person this refers to.";
  }
  if (reason === "Share versus replace is not decided.") {
    return "Someone already owns this. Share or replace?";
  }
  if (reason === "Should this share or replace the current owner?") {
    return "Someone already owns this. Share or replace?";
  }
  if (reason === "This date change is not specific enough to apply automatically.") {
    return "What date should I use?";
  }
  return undefined;
}

export function ownershipChoiceCopy(args: {
  currentOwnerNames: string[];
  scope?: string;
  incomingPersonName?: string;
}): {
  question: string;
  shareLabel: string;
  replaceLabel: string;
  keepLabel: string;
} {
  const owners = args.currentOwnerNames.filter(Boolean);
  const ownerList = formatNameList(owners);
  const scope = args.scope?.trim();
  const incoming = args.incomingPersonName?.trim();
  const owned = scope ? (ownerList ? `${ownerList} already owns ${scope}` : `Someone already owns ${scope}`) : ownerList ? `${ownerList} already owns this` : "Someone already owns this";
  return {
    question: `${owned}. What should happen?`,
    shareLabel: incoming ? `Share with ${incoming}` : "Share",
    replaceLabel:
      incoming && owners.length === 1
        ? `Replace ${owners[0]} with ${incoming}`
        : incoming
          ? `Replace with ${incoming}`
          : "Replace",
    keepLabel:
      owners.length === 1 ? `Keep ${owners[0]} only` : ownerList ? `Keep ${ownerList} only` : "Keep current owner only",
  };
}

export function existingOrNewCopy(args: {
  entityLabel?: string;
  recordName?: string;
}): {
  question: string;
  updateLabel: string;
  createLabel: string;
} {
  const kind = args.entityLabel?.trim() || "item";
  const name = args.recordName?.trim();
  if (name) {
    return {
      question: `Is this a new ${kind.toLowerCase()} or the existing “${name}” ${kind.toLowerCase()}?`,
      updateLabel: `Update ${name}`,
      createLabel: `Create a new ${kind.toLowerCase()}`,
    };
  }
  return {
    question:
      "Lume couldn't confidently identify which existing record this refers to.",
    updateLabel: "Use this",
    createLabel: `Create a new ${kind.toLowerCase()}`,
  };
}

export function missingDateCopy(recordName?: string): string {
  const name = recordName?.trim();
  return name ? `What date should I use for ${name}?` : "What date should I use?";
}

function formatNameList(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}
