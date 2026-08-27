/**
 * Presentation-only transcript annotation.
 * Matches CaptureObservationV2 / CaptureFinding evidence back onto the
 * user's transcript. No NLP, fuzzy search, regex guesswork, or model calls.
 */

import type { CaptureFinding, ProposedOperation } from "@/lib/capture/findings";
import type { CaptureResult } from "@/lib/types";

export const TRANSCRIPT_CATEGORIES = [
  "people",
  "dates",
  "risks",
  "todos",
] as const;

export type TranscriptAnnotationCategory =
  (typeof TRANSCRIPT_CATEGORIES)[number];

export const TRANSCRIPT_CATEGORY_META: Record<
  TranscriptAnnotationCategory,
  { label: string; glyph: string }
> = {
  people: { label: "People", glyph: "◎" },
  dates: { label: "Dates", glyph: "◆" },
  risks: { label: "Risks", glyph: "⚠" },
  todos: { label: "To dos", glyph: "☑" },
};

export type TranscriptAnnotationSource = {
  id: string;
  evidence: string;
  entityType?: string | null;
  reviewCardId?: string;
};

export type TranscriptTextSegment = {
  type: "text";
  text: string;
};

export type TranscriptMarkSegment = {
  type: "mark";
  text: string;
  category: TranscriptAnnotationCategory;
  sourceId: string;
  reviewCardId?: string;
};

export type TranscriptSegment = TranscriptTextSegment | TranscriptMarkSegment;

export type AnnotatedTranscriptResult = {
  segments: TranscriptSegment[];
  unmatchedSourceIds: string[];
  categoriesUsed: TranscriptAnnotationCategory[];
};

const CATEGORY_BY_ENTITY: Record<string, TranscriptAnnotationCategory> = {
  stakeholder: "people",
  person: "people",
  availability: "people",
  responsibility: "people",
  milestone: "dates",
  meeting: "dates",
  risk: "risks",
  todo: "todos",
  action: "todos",
  nudge: "todos",
};

export function categoryFromEntityType(
  entityType?: string | null,
): TranscriptAnnotationCategory | null {
  if (!entityType) return null;
  return CATEGORY_BY_ENTITY[entityType.trim().toLowerCase()] ?? null;
}

/**
 * Locate evidence in the transcript.
 * 1. Exact substring (after trimming evidence ends only).
 * 2. Case-normalised equivalent only when lowercasing preserves length.
 * Does not collapse internal whitespace, use regex, or fuzzy match.
 */
export function locateEvidence(
  transcript: string,
  evidence: string,
  fromIndex = 0,
): { start: number; end: number } | null {
  const needle = evidence.trim();
  if (!needle || fromIndex >= transcript.length) return null;

  const exact = transcript.indexOf(needle, fromIndex);
  if (exact >= 0) return { start: exact, end: exact + needle.length };

  const hayLower = transcript.toLowerCase();
  const needleLower = needle.toLowerCase();
  if (
    hayLower.length !== transcript.length ||
    needleLower.length !== needle.length
  ) {
    return null;
  }
  const i = hayLower.indexOf(needleLower, fromIndex);
  if (i < 0) return null;
  return { start: i, end: i + needle.length };
}

function overlaps(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  return a.start < b.end && b.start < a.end;
}

function nextNonOverlappingSpan(
  transcript: string,
  evidence: string,
  occupied: Array<{ start: number; end: number }>,
): { start: number; end: number } | null {
  let from = 0;
  while (from <= transcript.length) {
    const span = locateEvidence(transcript, evidence, from);
    if (!span) return null;
    if (!occupied.some((taken) => overlaps(taken, span))) return span;
    from = span.start + 1;
  }
  return null;
}

export function annotateTranscript(
  transcript: string,
  sources: TranscriptAnnotationSource[],
): AnnotatedTranscriptResult {
  const occupied: Array<{ start: number; end: number }> = [];
  const marks: TranscriptMarkSegment[] = [];
  const unmatchedSourceIds: string[] = [];
  const markStarts = new Map<TranscriptMarkSegment, number>();

  for (const source of sources) {
    const category = categoryFromEntityType(source.entityType);
    if (!category) {
      unmatchedSourceIds.push(source.id);
      continue;
    }
    const span = nextNonOverlappingSpan(
      transcript,
      source.evidence ?? "",
      occupied,
    );
    if (!span) {
      unmatchedSourceIds.push(source.id);
      continue;
    }
    occupied.push(span);
    const mark: TranscriptMarkSegment = {
      type: "mark",
      text: transcript.slice(span.start, span.end),
      category,
      sourceId: source.id,
      reviewCardId: source.reviewCardId,
    };
    marks.push(mark);
    markStarts.set(mark, span.start);
  }

  marks.sort((a, b) => (markStarts.get(a) ?? 0) - (markStarts.get(b) ?? 0));

  const segments: TranscriptSegment[] = [];
  let cursor = 0;
  for (const mark of marks) {
    const start = markStarts.get(mark) ?? 0;
    if (start > cursor) {
      segments.push({ type: "text", text: transcript.slice(cursor, start) });
    }
    segments.push(mark);
    cursor = start + mark.text.length;
  }
  if (cursor < transcript.length) {
    segments.push({ type: "text", text: transcript.slice(cursor) });
  }
  if (segments.length === 0 && transcript.length === 0) {
    segments.push({ type: "text", text: "" });
  }

  const categoriesUsed = TRANSCRIPT_CATEGORIES.filter((cat) =>
    marks.some((m) => m.category === cat),
  );

  return { segments, unmatchedSourceIds, categoriesUsed };
}

function entityTypeOfFinding(
  finding: CaptureFinding,
  operations?: ProposedOperation[],
): string | undefined {
  if (finding.target?.entityType) return finding.target.entityType;
  const proposed = finding.changes?.entityType?.proposed;
  if (typeof proposed === "string" && proposed.trim()) return proposed;
  return operations?.find((op) => op.sourceFindingId === finding.id)
    ?.entityType;
}

/**
 * Build annotation sources from existing structured Capture findings.
 * Evidence is already copied from CaptureObservationV2 — no second pass.
 */
export function annotationSourcesFromResult(
  result: CaptureResult | null | undefined,
  reviewCardIdsByFinding: Record<string, string> = {},
): TranscriptAnnotationSource[] {
  const findings = result?.findings ?? [];
  const operations = result?.proposedOperations;
  return findings.map((finding) => ({
    id: finding.id,
    evidence: finding.evidence || "",
    entityType: entityTypeOfFinding(finding, operations),
    reviewCardId: reviewCardIdsByFinding[finding.id],
  }));
}

export function segmentsEqualTranscript(
  segments: TranscriptSegment[],
  transcript: string,
): boolean {
  return segments.map((s) => s.text).join("") === transcript;
}
