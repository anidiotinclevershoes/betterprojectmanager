import type { CaptureContextManifest } from "@/lib/capture/context";
import type { CaptureResult } from "@/lib/types";
import { countTokens } from "@/lib/dev/cockpit/tokenize";
import { collectPostAnalysisSignals } from "./signals";
import { evaluatePostAnalysisReliability } from "./evaluate";
import type { CaptureReliabilityAssessment } from "./types";

/** Server-side assessment using measured tokenizer for input length. */
export function assessCaptureReliability(args: {
  captureText: string;
  result: CaptureResult;
  contextManifest?: CaptureContextManifest | null;
  transcriptionIncomplete?: boolean;
}): CaptureReliabilityAssessment {
  let measuredInputTokens: number | null = null;
  try {
    measuredInputTokens = countTokens(args.captureText);
  } catch {
    measuredInputTokens = null;
  }

  const signals = collectPostAnalysisSignals({
    captureText: args.captureText,
    result: args.result,
    contextManifest: args.contextManifest,
    measuredInputTokens,
    transcriptionIncomplete: args.transcriptionIncomplete,
  });

  return evaluatePostAnalysisReliability(signals);
}

export function reliabilityForCockpit(
  assessment: CaptureReliabilityAssessment,
): {
  state: CaptureReliabilityAssessment["state"];
  inputTokens: number;
  inputTokensMeasured: boolean;
  truncated: boolean;
  findingsCount: number;
  ambiguousFindings: number;
  clarificationCount: number;
  invalidTargetCount: number;
  validationErrors: number;
  triggeredRules: string[];
} {
  const signals = assessment.signals;
  const truncated =
    signals.stage === "post"
      ? signals.truncated
      : signals.willTruncate;
  const findingsCount =
    signals.stage === "post" ? signals.findingsCount : 0;
  const ambiguousFindings =
    signals.stage === "post" ? signals.ambiguousFindings : 0;
  const clarificationCount =
    signals.stage === "post" ? signals.clarificationCount : 0;
  const invalidTargetCount =
    signals.stage === "post" ? signals.invalidTargetCount : 0;
  const validationErrors =
    signals.stage === "post" ? signals.validationErrors : 0;

  return {
    state: assessment.state,
    inputTokens: signals.inputTokens,
    inputTokensMeasured: signals.inputTokensMeasured,
    truncated,
    findingsCount,
    ambiguousFindings,
    clarificationCount,
    invalidTargetCount,
    validationErrors,
    triggeredRules: assessment.triggeredRules,
  };
}
