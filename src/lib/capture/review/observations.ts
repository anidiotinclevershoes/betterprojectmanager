/**
 * Presentation-only observations for Capture review.
 * Deduplicates using structured findings first; no AI calls.
 */

import type { CaptureResult } from "@/lib/types";
import type { CaptureFinding, ProposedOperation } from "@/lib/capture/findings";
import { KIND_LABEL, type SuggestionKind } from "@/lib/capture/suggestions";

const FILLER =
  /\b(okay|so|right|just dumping|before i forget|anyway|i think|didn't i|wait,? no|obviously|i mentioned that already)\b/i;
const IRRELEVANT =
  /\b(milk|on the way home|buy eggs|grocery|shopping list)\b/i;
const META =
  /programme manager checks|continuous analysis|risk language detected|captured as |tidied from raw/i;

type ObservationCategory = "other";

export type ObservationActionStatus =
  | "create"
  | "update"
  | "complete"
  | "resolve"
  | "no_change"
  | "needs_review"
  | "unmatched"
  | "ignored";

export type CaptureObservation = {
  id: string;
  text: string;
  actionStatus: ObservationActionStatus;
  /** Compact right-side label, e.g. "Create · To Do". */
  actionLabel: string;
  /** Review card id to scroll to, when an actionable change exists. */
  reviewCardId?: string;
  findingId?: string;
};

type ObservationCandidate = {
  text: string;
  category: ObservationCategory;
  targetKey?: string;
  changeKey?: string;
  confidence: number;
  source: "finding" | "insight" | "transcript";
  findingId?: string;
};

function ensurePhrase(text: string): string {
  const t = text.trim().replace(/\s+/g, " ").replace(/\.+$/, "");
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(" ")
      .filter((t) => t.length > 2),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function isNoise(text: string): boolean {
  const t = text.trim();
  if (t.length < 6) return true;
  if (META.test(t)) return true;
  if (IRRELEVANT.test(t)) return true;
  if (FILLER.test(t) && t.split(/\s+/).length < 12) return true;
  if (t.length > 160 && (t.match(/,/g) ?? []).length >= 4) return true;
  return false;
}

export function detectObservationCategory(_text: string): ObservationCategory {
  return "other";
}

function preferredPhrase(_category: ObservationCategory, raw: string): string {
  return ensurePhrase(raw);
}

function candidateFromFinding(finding: CaptureFinding): ObservationCandidate | null {
  if (finding.findingType === "NO_CHANGE") return null;
  const raw = finding.fact?.trim();
  if (!raw || isNoise(raw)) return null;
  const category = detectObservationCategory(raw);
  const fields = finding.changes
    ? Object.keys(finding.changes).sort().join(",")
    : finding.findingType;
  return {
    text: preferredPhrase(category, raw),
    category,
    targetKey: finding.target?.entityId
      ? `${finding.target.entityType}:${finding.target.entityId}`
      : undefined,
    changeKey: finding.target?.entityId
      ? `${finding.target.entityId}:${fields}`
      : category !== "other"
        ? `cat:${category}`
        : undefined,
    confidence: finding.confidence ?? 0,
    source: "finding",
    findingId: finding.id,
  };
}

export function dedupeObservationCandidates(
  candidates: ObservationCandidate[],
): ObservationCandidate[] {
  const kept: ObservationCandidate[] = [];

  for (const next of candidates) {
    const nextTokens = tokens(next.text);
    const idx = kept.findIndex((existing) => {
      if (
        next.changeKey &&
        existing.changeKey &&
        next.changeKey === existing.changeKey
      ) {
        return true;
      }
      if (next.targetKey && existing.targetKey && next.targetKey === existing.targetKey) {
        const overlap = jaccard(nextTokens, tokens(existing.text));
        return overlap >= 0.45;
      }
      if (
        next.category !== "other" &&
        existing.category !== "other" &&
        next.category === existing.category
      ) {
        return true;
      }
      const existingTokens = tokens(existing.text);
      const overlap = jaccard(nextTokens, existingTokens);
      const a = normalizeText(next.text);
      const b = normalizeText(existing.text);
      const substring = a.includes(b) || b.includes(a);
      return (overlap >= 0.55 && substring) || overlap >= 0.75;
    });

    if (idx < 0) {
      kept.push(next);
      continue;
    }

    const existing = kept[idx];
    const preferNext =
      (next.source === "finding" && existing.source !== "finding") ||
      (next.category !== "other" && existing.category === "other") ||
      next.confidence > existing.confidence ||
      (next.confidence === existing.confidence &&
        next.text.length > existing.text.length);

    if (preferNext) kept[idx] = next;
  }

  return kept;
}

function entityLabelFromType(entityType?: string): string {
  if (!entityType) return "Item";
  const map: Record<string, SuggestionKind> = {
    todo: "action",
    action: "action",
    risk: "risk",
    milestone: "milestone",
    meeting: "meeting",
    stakeholder: "stakeholder",
    knowledge: "knowledge",
    nudge: "nudge",
  };
  const kind = map[entityType] ?? "action";
  return KIND_LABEL[kind];
}

function shortTargetName(title?: string): string | undefined {
  if (!title?.trim()) return undefined;
  const t = title.trim();
  return t.length > 36 ? `${t.slice(0, 34)}…` : t;
}

function actionFromFinding(
  finding: CaptureFinding | undefined,
  op: ProposedOperation | undefined,
  coverageDisposition?: string,
): { status: ObservationActionStatus; label: string; reviewCardId?: string } {
  if (!finding) {
    return { status: "no_change", label: "No Change" };
  }

  if (finding.findingType === "NO_CHANGE") {
    return { status: "no_change", label: "No Change" };
  }

  const entity = entityLabelFromType(
    op?.entityType ?? finding.target?.entityType ??
      (typeof finding.changes?.entityType?.proposed === "string"
        ? String(finding.changes.entityType.proposed)
        : undefined),
  );
  const targetBit = shortTargetName(op?.targetTitle ?? finding.target?.title);
  const projectUncertain =
    Boolean(finding.projectCandidates?.length) && !finding.projectId;

  if (coverageDisposition === "unmatched" || finding.invalidTarget) {
    return {
      status: "unmatched",
      label: targetBit ? `Unmatched · ${targetBit}` : "Unmatched",
      reviewCardId: `coverage-${finding.id}`,
    };
  }

  if (projectUncertain) {
    return {
      status: "needs_review",
      label: "Needs you · Which project?",
    };
  }

  if (
    coverageDisposition === "needs_review" ||
    finding.requiresClarification ||
    finding.findingType === "AMBIGUOUS"
  ) {
    return {
      status: "needs_review",
      label: targetBit ? `Needs you · ${targetBit}` : "Needs you",
      reviewCardId: op
        ? undefined // resolved below by caller with suggestion id
        : `coverage-${finding.id}`,
    };
  }

  const isRemember =
    (op?.entityType === "knowledge" ||
      finding.target?.entityType === "knowledge") &&
    (op?.operation === "CREATE" || finding.findingType === "NEW_INFORMATION");

  if (isRemember) {
    return {
      status: "create",
      label: "Remember · Knowledge",
    };
  }

  if (op?.operation === "CREATE") {
    return {
      status: "create",
      label: `Create · ${entity}`,
    };
  }
  if (op?.operation === "COMPLETE") {
    const isRisk = (op.entityType ?? finding.target?.entityType) === "risk";
    return {
      status: isRisk ? "resolve" : "complete",
      label: isRisk
        ? `Resolve · ${targetBit ?? entity}`
        : `Complete · ${targetBit ?? entity}`,
    };
  }
  if (op?.operation === "UPDATE") {
    return {
      status: "update",
      label: `Update · ${targetBit ?? entity}`,
    };
  }
  if (op?.operation === "ARCHIVE" || op?.operation === "DELETE") {
    return {
      status: "needs_review",
      label: `Needs you · ${targetBit ?? entity}`,
    };
  }

  if (finding.findingType === "NEW_INFORMATION") {
    return {
      status: "needs_review",
      label: "Needs you",
      reviewCardId: `coverage-${finding.id}`,
    };
  }

  return { status: "ignored", label: "Ignored" };
}

/**
 * Concise project-relevant observations for “Here’s what I understood”,
 * each linked to the downstream review action when available.
 */
export function buildCaptureObservations(
  result: CaptureResult,
  captureText: string,
  reviewCardIdsByFinding: Record<string, string> = {},
): CaptureObservation[] {
  const candidates: ObservationCandidate[] = [];
  const opsByFinding = new Map<string, ProposedOperation>();
  for (const op of result.proposedOperations ?? []) {
    opsByFinding.set(op.sourceFindingId, op);
  }
  const coverageByFinding = new Map(
    (result.findingCoverage?.items ?? []).map((i) => [i.findingId, i]),
  );
  const findingsById = new Map((result.findings ?? []).map((f) => [f.id, f]));

  for (const finding of result.findings ?? []) {
    const c = candidateFromFinding(finding);
    if (c) candidates.push(c);
  }

  for (const insight of result.insights ?? []) {
    if (isNoise(insight) || insight.length > 120) continue;
    const category = detectObservationCategory(insight);
    candidates.push({
      text: preferredPhrase(category, insight),
      category,
      confidence: 40,
      source: "insight",
    });
  }

  const deduped = dedupeObservationCandidates(candidates).filter(
    (o) => !IRRELEVANT.test(o.text),
  );

  return deduped.slice(0, 8).map((c, index) => {
    const finding = c.findingId ? findingsById.get(c.findingId) : undefined;
    const op = c.findingId ? opsByFinding.get(c.findingId) : undefined;
    const coverage = c.findingId
      ? coverageByFinding.get(c.findingId)
      : undefined;
    const action = actionFromFinding(finding, op, coverage?.disposition);
    const reviewCardId =
      (c.findingId && reviewCardIdsByFinding[c.findingId]) ||
      action.reviewCardId;

    return {
      id: `obs-${index}-${normalizeText(c.text).slice(0, 24)}`,
      text: c.text,
      actionStatus: action.status,
      actionLabel: action.label,
      reviewCardId:
        action.status === "no_change" || action.status === "ignored"
          ? undefined
          : reviewCardId,
      findingId: c.findingId,
    };
  });
}

/** @deprecated Prefer CaptureObservation[]; kept for string-only callers. */
export function buildCaptureObservationTexts(
  result: CaptureResult,
  captureText: string,
): string[] {
  return buildCaptureObservations(result, captureText).map((o) => o.text);
}
