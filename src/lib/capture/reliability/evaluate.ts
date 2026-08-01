import {
  DEFAULT_CAPTURE_RELIABILITY_THRESHOLDS,
  tokenCountToCharacterProxy,
  type CaptureReliabilityThresholds,
} from "./thresholds";
import type {
  CaptureReliabilityAssessment,
  CaptureReliabilityState,
  PostAnalysisReliabilitySignals,
  PreAnalysisReliabilitySignals,
  ReliabilityTrigger,
} from "./types";

function copyFor(state: CaptureReliabilityState): {
  title: string;
  body: string;
} {
  switch (state) {
    case "review_recommended":
      return {
        title: "Review recommended",
        body: "This Capture included conflicting or ambiguous statements. The extracted facts may still be useful, but review each suggested change carefully.",
      };
    case "limited":
      return {
        title: "Limited analysis",
        body: "Lume could not confidently process the full Capture. No project changes should be accepted until the transcript is reviewed or split into smaller sections.",
      };
    default:
      return { title: "", body: "" };
  }
}

function longCapturePreCopy(tokens: number, measured: boolean): {
  title: string;
  body: string;
} {
  return {
    title: "Long capture",
    body: measured
      ? `This input is larger than usual (${tokens.toLocaleString()} measured tokens). Lume can analyse it, but important details may be easier to review if you split it into sections.`
      : "This input is larger than usual. Lume can analyse it, but important details may be easier to review if you split it into sections.",
  };
}

export function evaluatePreAnalysisReliability(
  signals: PreAnalysisReliabilitySignals,
  thresholds: CaptureReliabilityThresholds = DEFAULT_CAPTURE_RELIABILITY_THRESHOLDS,
): CaptureReliabilityAssessment {
  const triggers: ReliabilityTrigger[] = [];
  const triggeredRules: string[] = [];
  let state: CaptureReliabilityState = "normal";

  if (signals.transcriptionIncomplete) {
    state = "limited";
    triggeredRules.push("transcription_incomplete");
    triggers.push({
      id: "transcription",
      label: "Transcription incomplete",
      detail: "The transcription provider reported incomplete or failed text",
    });
  }

  // Length never forces limited by itself.
  if (signals.inputTokens >= thresholds.warningTokenCount) {
    if (state === "normal") state = "review_recommended";
    triggeredRules.push(
      signals.inputTokens >= thresholds.criticalTokenCount
        ? "critical_token_count"
        : "warning_token_count",
    );
    triggers.push({
      id: "length",
      label: "Capture length",
      detail: signals.inputTokensMeasured
        ? `${signals.inputTokens.toLocaleString()} measured tokens`
        : `${signals.inputCharacters.toLocaleString()} characters (≈${signals.inputTokens.toLocaleString()} tokens)`,
    });
  }

  if (signals.willTruncate && state !== "limited") {
    state = "review_recommended";
    triggeredRules.push("will_truncate");
    triggers.push({
      id: "truncation",
      label: "Context budget",
      detail: "Capture context is expected to be truncated for this analysis",
    });
  }

  if (state === "normal") {
    return {
      state,
      title: "",
      body: "",
      triggers: [],
      signals,
      triggeredRules: [],
    };
  }

  if (state === "review_recommended" && triggers.some((t) => t.id === "length")) {
    const copy = longCapturePreCopy(
      signals.inputTokens,
      signals.inputTokensMeasured,
    );
    return {
      state,
      title: copy.title,
      body: copy.body,
      triggers,
      signals,
      triggeredRules,
    };
  }

  const copy = copyFor(state);
  return {
    state,
    title: copy.title,
    body: copy.body,
    triggers,
    signals,
    triggeredRules,
  };
}

export function evaluatePostAnalysisReliability(
  signals: PostAnalysisReliabilitySignals,
  thresholds: CaptureReliabilityThresholds = DEFAULT_CAPTURE_RELIABILITY_THRESHOLDS,
): CaptureReliabilityAssessment {
  const triggers: ReliabilityTrigger[] = [];
  const triggeredRules: string[] = [];
  let state: CaptureReliabilityState = "normal";

  const clarificationRatio =
    signals.findingsCount > 0
      ? signals.clarificationCount / signals.findingsCount
      : 0;
  const ambiguityRatio =
    signals.findingsCount > 0
      ? signals.ambiguousFindings / signals.findingsCount
      : 0;

  if (signals.transcriptionIncomplete) {
    state = "limited";
    triggeredRules.push("transcription_incomplete");
    triggers.push({
      id: "transcription",
      label: "Transcription incomplete",
      detail: "The transcription provider reported incomplete or failed text",
    });
  }

  const materialTruncation =
    signals.excludedByLimitCount >=
    thresholds.materialTruncationExcludedCount;
  if (materialTruncation) {
    state = "limited";
    triggeredRules.push("material_truncation");
    triggers.push({
      id: "truncation",
      label: "Context truncated",
      detail: `${signals.excludedByLimitCount} context records excluded by limits`,
    });
  } else if (signals.truncated) {
    if (state !== "limited") state = "review_recommended";
    triggeredRules.push("partial_truncation");
    triggers.push({
      id: "truncation",
      label: "Partial context truncation",
      detail: `${signals.limitsReachedCount} context limit(s) reached · ${signals.excludedByLimitCount} excluded`,
    });
  }

  if (!signals.validationOk && signals.validationErrors >= 2) {
    state = "limited";
    triggeredRules.push("validation_failed");
    triggers.push({
      id: "validation",
      label: "Structured output validation",
      detail: `${signals.validationErrors} validation error(s)`,
    });
  } else if (signals.validationErrors > 0 && state !== "limited") {
    state = "review_recommended";
    triggeredRules.push("validation_warnings");
    triggers.push({
      id: "validation",
      label: "Validation issues",
      detail: `${signals.validationErrors} validation error(s)`,
    });
  }

  if (
    signals.findingsCount > 0 &&
    signals.operationsCount === 0 &&
    clarificationRatio >= 0.8
  ) {
    state = "limited";
    triggeredRules.push("no_reliable_operations");
    triggers.push({
      id: "operations",
      label: "No reliable operations",
      detail: `${signals.clarificationCount} of ${signals.findingsCount} findings require clarification`,
    });
  }

  if (signals.inputTokens >= thresholds.warningTokenCount) {
    if (state === "normal") state = "review_recommended";
    triggeredRules.push(
      signals.inputTokens >= thresholds.criticalTokenCount
        ? "critical_token_count"
        : "warning_token_count",
    );
    triggers.push({
      id: "length",
      label: "Capture length",
      detail: signals.inputTokensMeasured
        ? `${signals.inputTokens.toLocaleString()} measured tokens`
        : `${signals.inputCharacters.toLocaleString()} characters (≈${signals.inputTokens.toLocaleString()} tokens)`,
    });
  }

  if (clarificationRatio >= thresholds.clarificationRatioWarning) {
    if (state === "normal") state = "review_recommended";
    triggeredRules.push("clarification_ratio");
    triggers.push({
      id: "clarification",
      label: "Findings requiring clarification",
      detail: `${signals.clarificationCount} of ${signals.findingsCount} findings require clarification`,
    });
  }

  if (ambiguityRatio >= thresholds.ambiguityRatioWarning) {
    if (state === "normal") state = "review_recommended";
    triggeredRules.push("ambiguity_ratio");
    triggers.push({
      id: "ambiguity",
      label: "Ambiguous findings",
      detail: `${signals.ambiguousFindings} of ${signals.findingsCount} findings are ambiguous`,
    });
  }

  if (signals.invalidTargetCount >= thresholds.invalidTargetWarningCount) {
    if (state === "normal") state = "review_recommended";
    triggeredRules.push("invalid_targets");
    triggers.push({
      id: "invalid_targets",
      label: "Unmatched targets",
      detail: `${signals.invalidTargetCount} target record(s) could not be matched`,
    });
  }

  if (state === "normal") {
    return {
      state,
      title: "",
      body: "",
      triggers: [],
      signals,
      triggeredRules: [],
    };
  }

  const copy = copyFor(state);
  return {
    state,
    title: copy.title,
    body: copy.body,
    triggers,
    signals,
    triggeredRules: [...new Set(triggeredRules)],
  };
}

/** Client helper: should we show the pre-analysis long-capture notice? */
export function shouldWarnBeforeAnalysis(
  captureText: string,
  thresholds: CaptureReliabilityThresholds = DEFAULT_CAPTURE_RELIABILITY_THRESHOLDS,
): CaptureReliabilityAssessment {
  const characters = captureText.length;
  const approxTokens = Math.ceil(characters / 4);
  return evaluatePreAnalysisReliability({
    stage: "pre",
    inputTokens: approxTokens,
    inputTokensMeasured: false,
    inputCharacters: characters,
    transcriptionIncomplete: false,
    willTruncate: false,
  }, thresholds);
}

export { tokenCountToCharacterProxy };
