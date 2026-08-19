import { COACHING_SYSTEM_PROMPT } from "@/lib/mission";
import {
  buildCaptureRunMetrics,
  isCockpitEnabled,
  recordCaptureRun,
} from "@/lib/dev/cockpit";
import type { AssembledPrompt } from "@/ai/domain/types";
import type { CaptureProjectContext } from "@/lib/capture/context";
import type { CaptureResult } from "@/lib/types";
import type { CaptureRunMetrics } from "./types";

/** Lightweight, development-only Capture metric recording. */
export function recordCaptureMetricsSafe(args: {
  startedAt: number;
  requestId?: string | null;
  source: "capture" | "golden";
  promptAssembly: AssembledPrompt;
  captureContext: CaptureProjectContext | null | undefined;
  result: CaptureResult;
  providerUsage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
  responseText?: string | null;
  model?: string | null;
  systemPrompt?: string | null;
  reliability?: CaptureRunMetrics["reliability"];
}) {
  if (!isCockpitEnabled()) return;
  try {
    const run = buildCaptureRunMetrics({
      requestId: args.requestId,
      source: args.source,
      projectId: args.captureContext?.project?.id ?? args.result.memory.projectId,
      projectCode: args.captureContext?.project?.code ?? null,
      projectName: args.captureContext?.project?.name ?? null,
      label: args.captureContext?.project?.code ?? args.result.memory.title,
      elapsedMs: Math.max(0, Date.now() - args.startedAt),
      promptAssembly: args.promptAssembly,
      captureContext: args.captureContext,
      findingsCount: args.result.findings?.length ?? 0,
      operationsCount: args.result.proposedOperations?.length ?? 0,
      invalidTargetCount: args.result.findingsValidation?.invalidTargetCount ?? 0,
      provider: args.result.provider ?? "local",
      model: args.model ?? null,
      systemPrompt: args.systemPrompt ?? COACHING_SYSTEM_PROMPT,
      responseText: args.responseText ?? null,
      providerUsage: args.providerUsage ?? null,
      reliability: args.reliability ?? null,
    });
    recordCaptureRun(run);
  } catch (error) {
    console.warn("[ai-cockpit] metric collection skipped", error);
  }
}
