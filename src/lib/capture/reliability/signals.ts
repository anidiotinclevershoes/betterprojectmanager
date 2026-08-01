import type { CaptureContextManifest } from "@/lib/capture/context";
import type { CaptureResult } from "@/lib/types";
import type {
  PostAnalysisReliabilitySignals,
  PreAnalysisReliabilitySignals,
} from "./types";

function countInputTokens(
  text: string,
  measuredTokens?: number | null,
): { tokens: number; measured: boolean; characters: number } {
  const characters = text.length;
  if (typeof measuredTokens === "number" && Number.isFinite(measuredTokens)) {
    return { tokens: measuredTokens, measured: true, characters };
  }
  // Character-proxy only — never presented as a tokenizer measurement.
  return {
    tokens: Math.ceil(characters / 4),
    measured: false,
    characters,
  };
}

export function collectPreAnalysisSignals(args: {
  captureText: string;
  /** Optional measured token count (e.g. from a prior tokenizer pass). */
  measuredInputTokens?: number | null;
  transcriptionIncomplete?: boolean;
  willTruncate?: boolean;
}): PreAnalysisReliabilitySignals {
  const counted = countInputTokens(
    args.captureText,
    args.measuredInputTokens,
  );
  return {
    stage: "pre",
    inputTokens: counted.tokens,
    inputTokensMeasured: counted.measured,
    inputCharacters: counted.characters,
    transcriptionIncomplete: Boolean(args.transcriptionIncomplete),
    willTruncate: Boolean(args.willTruncate),
  };
}

export function collectPostAnalysisSignals(args: {
  captureText: string;
  result: CaptureResult;
  contextManifest?: CaptureContextManifest | null;
  measuredInputTokens?: number | null;
  transcriptionIncomplete?: boolean;
}): PostAnalysisReliabilitySignals {
  const counted = countInputTokens(
    args.captureText,
    args.measuredInputTokens,
  );
  const findings = args.result.findings ?? [];
  const clarificationCount = findings.filter((f) => f.requiresClarification)
    .length;
  const ambiguousFindings = findings.filter(
    (f) =>
      f.findingType === "AMBIGUOUS" ||
      f.requiresClarification ||
      f.invalidTarget,
  ).length;
  const invalidTargetCount =
    args.result.findingsValidation?.invalidTargetCount ??
    findings.filter((f) => f.invalidTarget).length;
  const validationErrors = args.result.findingsValidation?.errors?.length ?? 0;
  const validationOk = args.result.findingsValidation?.ok ?? true;
  const excludedByLimitCount =
    args.contextManifest?.excludedByLimit?.length ?? 0;
  const limitsReachedCount = args.contextManifest?.limitsReached?.length ?? 0;

  return {
    stage: "post",
    inputTokens: counted.tokens,
    inputTokensMeasured: counted.measured,
    inputCharacters: counted.characters,
    truncated: limitsReachedCount > 0 || excludedByLimitCount > 0,
    excludedByLimitCount,
    limitsReachedCount,
    findingsCount: findings.length,
    ambiguousFindings,
    clarificationCount,
    invalidTargetCount,
    validationErrors,
    validationOk,
    operationsCount: args.result.proposedOperations?.length ?? 0,
    transcriptionIncomplete: Boolean(args.transcriptionIncomplete),
  };
}
