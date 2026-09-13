/**
 * Deterministic source-coverage backstop.
 *
 * Uses existing observation evidence quotes as spans in the transcript.
 * No AI call, no parser, no persistence. Review-only leftovers.
 */

import {
  LEFT_UNTOUCHED_GENERIC_REASON,
  type LeftUntouchedSource,
} from "./left-untouched";
import type { CaptureObservationV2 } from "./types";

export type SourceCoverageSpan = {
  start: number;
  end: number;
  observationId?: string;
};

export type SourceCoverageLeftover = {
  text: string;
  start: number;
  end: number;
  reason: string;
  source: LeftUntouchedSource;
};

const LEADING_GLUE =
  /^(?:[,;:.!?]+|\b(?:and|or|but|then|also|plus)\b)\s*/i;
const TRAILING_GLUE = /(?:[,;:]+|\b(?:and|or|but)\b)\s*$/i;

export function findEvidenceSpan(
  transcript: string,
  quote: string,
  fromIndex = 0,
): SourceCoverageSpan | null {
  const words = quote.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const escaped = words.map((word) =>
    word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const re = new RegExp(escaped.join("\\s+"), "i");
  const slice = transcript.slice(fromIndex);
  const match = slice.match(re);
  if (!match || match.index == null) return null;
  const start = fromIndex + match.index;
  return { start, end: start + match[0].length };
}

function collectCoveredSpans(
  transcript: string,
  observations: CaptureObservationV2[],
): SourceCoverageSpan[] {
  const spans: SourceCoverageSpan[] = [];
  const used: Array<{ start: number; end: number }> = [];

  const takeQuote = (quote: string, observationId: string) => {
    const trimmed = quote.trim();
    if (trimmed.length < 4) return;
    let from = 0;
    while (from < transcript.length) {
      const hit = findEvidenceSpan(transcript, trimmed, from);
      if (!hit) return;
      const overlap = used.some(
        (existing) => hit.start < existing.end && hit.end > existing.start,
      );
      if (!overlap) {
        spans.push({ ...hit, observationId });
        used.push(hit);
        return;
      }
      from = hit.start + 1;
    }
  };

  for (const observation of observations) {
    takeQuote(observation.evidence, observation.id);
    if (observation.statement !== observation.evidence) {
      takeQuote(observation.statement, observation.id);
    }
  }

  return spans;
}

function trimLeftover(text: string): string {
  let next = text.replace(/\s+/g, " ").trim();
  for (let i = 0; i < 4; i += 1) {
    const stripped = next.replace(LEADING_GLUE, "").replace(TRAILING_GLUE, "").trim();
    if (stripped === next) break;
    next = stripped;
  }
  return next.replace(/^["'“”]+|["'“”]+$/g, "").trim();
}

export function isMeaningfulLeftover(text: string): boolean {
  const cleaned = trimLeftover(text);
  if (cleaned.length < 12) return false;
  const words = cleaned
    .split(/\s+/)
    .filter((word) => /[a-zA-Z0-9]/.test(word) && word.replace(/[^a-zA-Z0-9]/g, "").length >= 2);
  if (words.length < 3) return false;
  if (/^(thanks|thank you|ok|okay|cheers|bye|hi|hello)[.!]?$/i.test(cleaned)) {
    return false;
  }
  return true;
}

function alreadyAccounted(
  text: string,
  observations: CaptureObservationV2[],
): boolean {
  const needle = trimLeftover(text).toLowerCase();
  if (!needle) return true;
  for (const observation of observations) {
    const evidence = observation.evidence.replace(/\s+/g, " ").trim().toLowerCase();
    const statement = observation.statement.replace(/\s+/g, " ").trim().toLowerCase();
    // Subset / equality only. A leftover that merely contains an
    // accounted clause must still surface — do not swallow the rest.
    if (evidence && (evidence === needle || evidence.includes(needle))) {
      return true;
    }
    if (statement && (statement === needle || statement.includes(needle))) {
      return true;
    }
  }
  return false;
}

export function leftoverSourceSpans(args: {
  transcript: string;
  observations: CaptureObservationV2[];
}): SourceCoverageLeftover[] {
  const transcript = args.transcript;
  if (!transcript.trim()) return [];
  if (args.observations.length === 0) return [];

  const covered = new Array<boolean>(transcript.length).fill(false);
  for (const span of collectCoveredSpans(transcript, args.observations)) {
    for (let i = span.start; i < span.end && i < covered.length; i += 1) {
      covered[i] = true;
    }
  }

  const leftovers: SourceCoverageLeftover[] = [];
  let i = 0;
  while (i < transcript.length) {
    if (covered[i] || /\s/.test(transcript[i] ?? "")) {
      i += 1;
      continue;
    }
    let end = i + 1;
    while (end < transcript.length && !covered[end]) end += 1;
    const raw = transcript.slice(i, end);
    const text = trimLeftover(raw);
    if (
      isMeaningfulLeftover(text) &&
      !alreadyAccounted(text, args.observations)
    ) {
      leftovers.push({
        text,
        start: i,
        end,
        reason: LEFT_UNTOUCHED_GENERIC_REASON,
        source: "coverage",
      });
    }
    i = end;
  }

  return leftovers;
}

export function leftoverObservationsFromCoverage(args: {
  transcript: string;
  observations: CaptureObservationV2[];
}): CaptureObservationV2[] {
  return leftoverSourceSpans(args).map((leftover, index) => ({
    id: `coverage-left-${index + 1}`,
    statement: leftover.text,
    evidence: leftover.text,
    domain: "unknown",
    disposition: "left_untouched",
    truthIntent: "uncertain",
    projectId: null,
    candidateTargetId: null,
    candidateTargetTitle: null,
    mergeWithObservationId: null,
    proposedValues: {
      leftUntouched: true,
      leftUntouchedSource: leftover.source,
    },
    commentary: leftover.reason,
    modelConfidence: null,
  }));
}
