import type { AssembledPrompt } from "@/ai/domain/types";
import type { CaptureProjectContext } from "@/lib/capture/context";
import { countCharacters, countTokens } from "./tokenize";
import {
  COMPOSITION_COLORS,
  type CaptureRunMetrics,
  type CompositionSlice,
  type ContextBucketMeasure,
  type PromptSectionMeasure,
} from "./types";

function measureText(label: string, id: string, text: string): PromptSectionMeasure {
  return {
    id,
    label,
    characters: countCharacters(text),
    tokens: countTokens(text),
  };
}

function measureBucket(
  id: string,
  label: string,
  records: unknown[],
): ContextBucketMeasure {
  const text = JSON.stringify(records);
  return {
    id,
    label,
    recordCount: records.length,
    characters: countCharacters(text),
    tokens: countTokens(text),
  };
}

function buildComposition(args: {
  sections: PromptSectionMeasure[];
  buckets: ContextBucketMeasure[];
}): CompositionSlice[] {
  const bySection = new Map(args.sections.map((s) => [s.id, s]));
  const byBucket = new Map(args.buckets.map((b) => [b.id, b]));

  const userInput = bySection.get("capture")?.tokens ?? 0;
  const dictionary = bySection.get("dictionary")?.tokens ?? 0;
  const knowledge = byBucket.get("knowledge")?.tokens ?? 0;
  const todos =
    (byBucket.get("todos")?.tokens ?? 0) +
    (byBucket.get("completedTodos")?.tokens ?? 0);
  const risks = byBucket.get("risks")?.tokens ?? 0;
  const history = byBucket.get("history")?.tokens ?? 0;
  const meetings = byBucket.get("meetings")?.tokens ?? 0;
  const stakeholders = byBucket.get("stakeholders")?.tokens ?? 0;

  const role = bySection.get("role")?.tokens ?? 0;
  const domain = bySection.get("domain")?.tokens ?? 0;
  const schema = bySection.get("schema")?.tokens ?? 0;
  const contextSection = bySection.get("context")?.tokens ?? 0;
  const accountedBuckets =
    knowledge +
    todos +
    risks +
    history +
    meetings +
    stakeholders +
    (byBucket.get("nudges")?.tokens ?? 0) +
    (byBucket.get("milestones")?.tokens ?? 0) +
    (byBucket.get("releases")?.tokens ?? 0) +
    (byBucket.get("project")?.tokens ?? 0);

  // Remaining context wrapper / catalogue / domain scaffolding counted as metadata.
  const metadata = Math.max(
    0,
    role + domain + schema + Math.max(0, contextSection - accountedBuckets),
  );

  const raw: Array<Omit<CompositionSlice, "percent">> = [
    {
      id: "userInput",
      label: "User Input",
      tokens: userInput,
      characters: bySection.get("capture")?.characters ?? 0,
      color: COMPOSITION_COLORS.userInput,
    },
    {
      id: "knowledge",
      label: "Knowledge",
      tokens: knowledge,
      characters: byBucket.get("knowledge")?.characters ?? 0,
      color: COMPOSITION_COLORS.knowledge,
    },
    {
      id: "todos",
      label: "Todos",
      tokens: todos,
      characters:
        (byBucket.get("todos")?.characters ?? 0) +
        (byBucket.get("completedTodos")?.characters ?? 0),
      color: COMPOSITION_COLORS.todos,
    },
    {
      id: "risks",
      label: "Risks",
      tokens: risks,
      characters: byBucket.get("risks")?.characters ?? 0,
      color: COMPOSITION_COLORS.risks,
    },
    {
      id: "history",
      label: "History",
      tokens: history,
      characters: byBucket.get("history")?.characters ?? 0,
      color: COMPOSITION_COLORS.history,
    },
    {
      id: "dictionary",
      label: "Dictionary",
      tokens: dictionary,
      characters: bySection.get("dictionary")?.characters ?? 0,
      color: COMPOSITION_COLORS.dictionary,
    },
    {
      id: "meetings",
      label: "Meetings",
      tokens: meetings,
      characters: byBucket.get("meetings")?.characters ?? 0,
      color: COMPOSITION_COLORS.meetings,
    },
    {
      id: "stakeholders",
      label: "Stakeholders",
      tokens: stakeholders,
      characters: byBucket.get("stakeholders")?.characters ?? 0,
      color: COMPOSITION_COLORS.stakeholders,
    },
    {
      id: "metadata",
      label: "Metadata",
      tokens: metadata,
      characters: 0,
      color: COMPOSITION_COLORS.metadata,
    },
  ].filter((s) => s.tokens > 1);

  const total = raw.reduce((sum, s) => sum + s.tokens, 0) || 1;
  return raw.map((s) => ({
    ...s,
    percent: Math.round((s.tokens / total) * 1000) / 10,
  }));
}

export function measurePromptComposition(args: {
  promptAssembly: AssembledPrompt;
  captureContext: CaptureProjectContext | null | undefined;
}): {
  promptSections: PromptSectionMeasure[];
  contextBuckets: ContextBucketMeasure[];
  composition: CompositionSlice[];
  promptTokensTokenizer: number;
  promptCharacters: number;
} {
  const promptSections = args.promptAssembly.sections.map((s) =>
    measureText(s.label, s.id, s.content),
  );
  // Also measure the fully assembled prompt text (includes headings/separators).
  const full = measureText("Full prompt", "full", args.promptAssembly.text);

  const ctx = args.captureContext;
  const contextBuckets: ContextBucketMeasure[] = [];
  if (ctx?.project) {
    contextBuckets.push(
      measureBucket("project", "Project", [ctx.project]),
    );
  }
  if (ctx) {
    contextBuckets.push(
      measureBucket("todos", "Todos", ctx.todos),
      measureBucket("completedTodos", "Completed Todos", ctx.completedTodos),
      measureBucket("nudges", "Nudges", ctx.nudges),
      measureBucket("meetings", "Meetings", ctx.meetings),
      measureBucket("milestones", "Milestones", ctx.milestones),
      measureBucket("risks", "Risks", ctx.risks),
      measureBucket("stakeholders", "Stakeholders", ctx.stakeholders),
      measureBucket("knowledge", "Knowledge", ctx.knowledge),
      measureBucket("history", "History", ctx.history),
      measureBucket("releases", "Releases", ctx.releases),
    );
  }

  const composition = buildComposition({
    sections: promptSections,
    buckets: contextBuckets,
  });

  return {
    promptSections,
    contextBuckets,
    composition,
    promptTokensTokenizer: full.tokens,
    promptCharacters: full.characters,
  };
}

export function buildCaptureRunMetrics(args: {
  requestId?: string | null;
  source: "capture" | "golden";
  projectId?: string | null;
  projectCode?: string | null;
  projectName?: string | null;
  label?: string;
  elapsedMs: number;
  promptAssembly: AssembledPrompt;
  captureContext: CaptureProjectContext | null | undefined;
  findingsCount: number;
  operationsCount: number;
  invalidTargetCount: number;
  provider: "openai" | "local";
  model?: string | null;
  systemPrompt?: string | null;
  responseText?: string | null;
  providerUsage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
  reliability?: CaptureRunMetrics["reliability"];
}): CaptureRunMetrics {
  const measured = measurePromptComposition({
    promptAssembly: args.promptAssembly,
    captureContext: args.captureContext,
  });

  const systemTokensTokenizer =
    args.systemPrompt != null && args.systemPrompt.length > 0
      ? countTokens(args.systemPrompt)
      : null;
  const responseTokensTokenizer =
    args.responseText != null && args.responseText.length > 0
      ? countTokens(args.responseText)
      : null;

  const providerPromptTokens =
    typeof args.providerUsage?.prompt_tokens === "number"
      ? args.providerUsage.prompt_tokens
      : null;
  const providerCompletionTokens =
    typeof args.providerUsage?.completion_tokens === "number"
      ? args.providerUsage.completion_tokens
      : null;
  const providerTotalTokens =
    typeof args.providerUsage?.total_tokens === "number"
      ? args.providerUsage.total_tokens
      : null;

  const promptTokens =
    providerPromptTokens ??
    measured.promptTokensTokenizer + (systemTokensTokenizer ?? 0);

  const completionTokens =
    providerCompletionTokens ?? responseTokensTokenizer ?? null;

  const recordedAt = new Date().toISOString();
  const label =
    args.label ||
    args.projectCode ||
    args.projectName ||
    (args.source === "golden" ? "Golden Test" : "Capture");

  return {
    id: `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    requestId: args.requestId ?? null,
    recordedAt,
    source: args.source,
    projectId: args.projectId ?? null,
    projectCode: args.projectCode ?? null,
    projectName: args.projectName ?? null,
    label,
    elapsedMs: args.elapsedMs,
    providerPromptTokens,
    providerCompletionTokens,
    providerTotalTokens,
    promptTokensTokenizer: measured.promptTokensTokenizer,
    promptCharacters: measured.promptCharacters,
    systemTokensTokenizer,
    responseTokensTokenizer,
    promptTokens,
    completionTokens,
    findingsCount: args.findingsCount,
    operationsCount: args.operationsCount,
    invalidTargetCount: args.invalidTargetCount,
    provider: args.provider,
    model: args.model ?? null,
    promptSections: measured.promptSections,
    contextBuckets: measured.contextBuckets,
    composition: measured.composition,
    reliability: args.reliability ?? null,
  };
}
