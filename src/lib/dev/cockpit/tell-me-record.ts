import { isCockpitEnabled, recordCaptureRun } from "@/lib/dev/cockpit";
import type { CaptureRunMetrics } from "@/lib/dev/cockpit/types";
import type { TellMeAnswer } from "@/lib/tell-me/types";

/** Development-only Tell Me metric recording (reuses cockpit store shape). */
export function recordTellMeMetricsSafe(args: {
  startedAt: number;
  userId: string;
  question: string;
  result: Pick<
    TellMeAnswer,
    | "provider"
    | "model"
    | "usage"
    | "contextStats"
    | "confidence"
    | "answer"
    | "sources"
    | "scope"
  >;
  kind?: "ask" | "snapshot_refresh";
}) {
  if (!isCockpitEnabled()) return;
  try {
    const usage = args.result.usage;
    const stats = args.result.contextStats;
    const run: CaptureRunMetrics = {
      id: `tellme_${Date.now().toString(36)}`,
      requestId: null,
      recordedAt: new Date().toISOString(),
      source: "capture",
      projectId: args.result.scope.projectId,
      projectCode: args.result.scope.projectCode,
      projectName: args.result.scope.projectName,
      label: `Tell Me · ${args.kind === "snapshot_refresh" ? "refresh" : "ask"}`,
      elapsedMs: Math.max(0, Date.now() - args.startedAt),
      providerPromptTokens: usage?.prompt_tokens ?? null,
      providerCompletionTokens: usage?.completion_tokens ?? null,
      providerTotalTokens: usage?.total_tokens ?? null,
      promptTokensTokenizer: Math.ceil(stats.approxChars / 4),
      promptCharacters: stats.approxChars,
      systemTokensTokenizer: null,
      responseTokensTokenizer: Math.ceil((args.result.answer?.length ?? 0) / 4),
      promptTokens: usage?.prompt_tokens ?? Math.ceil(stats.approxChars / 4),
      completionTokens:
        usage?.completion_tokens ??
        Math.ceil((args.result.answer?.length ?? 0) / 4),
      findingsCount: 0,
      operationsCount: 0,
      invalidTargetCount: 0,
      provider: args.result.provider,
      model: args.result.model ?? null,
      promptSections: [
        {
          id: "tell_me_question",
          label: "Tell Me question",
          characters: args.question.length,
          tokens: Math.ceil(args.question.length / 4),
        },
        {
          id: "structured_state",
          label: "Structured project state",
          characters: stats.structuredItems * 80,
          tokens: stats.structuredItems * 20,
        },
        {
          id: "knowledge",
          label: "Knowledge contribution",
          characters: stats.knowledgeItems * 100,
          tokens: stats.knowledgeItems * 25,
        },
        {
          id: "snapshot",
          label: "Snapshot contribution",
          characters: stats.snapshotUsed ? 400 : 0,
          tokens: stats.snapshotUsed ? 100 : 0,
        },
      ],
      contextBuckets: [
        {
          id: "projects",
          label: "Projects considered",
          recordCount: stats.projectsConsidered,
          characters: 0,
          tokens: 0,
        },
        {
          id: "records",
          label: "Records selected",
          recordCount: stats.recordsSelected,
          characters: stats.approxChars,
          tokens: Math.ceil(stats.approxChars / 4),
        },
      ],
      composition: [],
      reliability: null,
    };
    // Attach tell-me-specific note via label; store accepts CaptureRunMetrics.
    recordCaptureRun(run);
  } catch (error) {
    console.warn("[ai-cockpit] tell-me metric collection skipped", error);
  }
}
