/** AI Cockpit metric types — development only. All values are measured. */

export type PromptSectionMeasure = {
  id: string;
  label: string;
  characters: number;
  tokens: number;
};

export type ContextBucketMeasure = {
  id: string;
  label: string;
  recordCount: number;
  characters: number;
  tokens: number;
};

/** User-facing composition bars — each total is a sum of measured parts. */
export type CompositionSlice = {
  id: string;
  label: string;
  tokens: number;
  characters: number;
  percent: number;
  color: string;
};

export type CaptureRunMetrics = {
  id: string;
  requestId: string | null;
  recordedAt: string;
  source: "capture" | "golden";
  projectId: string | null;
  projectCode: string | null;
  projectName: string | null;
  label: string;

  /** Wall-clock analysis duration (ms), measured. */
  elapsedMs: number;

  /** Prompt tokens from OpenAI usage, when returned. */
  providerPromptTokens: number | null;
  /** Completion tokens from OpenAI usage, when returned. */
  providerCompletionTokens: number | null;
  /** Total tokens from OpenAI usage, when returned. */
  providerTotalTokens: number | null;

  /** Full user prompt tokenized with cl100k_base. */
  promptTokensTokenizer: number;
  promptCharacters: number;

  /** System message tokenized (when sent). */
  systemTokensTokenizer: number | null;

  /** Response body tokenized (when available). */
  responseTokensTokenizer: number | null;

  /**
   * Canonical prompt token total for charts:
   * providerPromptTokens if present, else promptTokensTokenizer (+ system if measured).
   */
  promptTokens: number;
  /**
   * Canonical completion/response token total:
   * providerCompletionTokens if present, else responseTokensTokenizer, else null (Unavailable).
   */
  completionTokens: number | null;

  findingsCount: number;
  operationsCount: number;
  invalidTargetCount: number;

  provider: "openai" | "local";
  model: string | null;

  promptSections: PromptSectionMeasure[];
  contextBuckets: ContextBucketMeasure[];
  composition: CompositionSlice[];
};

export type CockpitStore = {
  version: 1;
  runs: CaptureRunMetrics[];
  updatedAt: string;
};

export const COMPOSITION_COLORS: Record<string, string> = {
  userInput: "#5B8CFF",
  knowledge: "#3DD6C6",
  todos: "#F5A524",
  risks: "#FF6B6B",
  history: "#A78BFA",
  dictionary: "#F472B6",
  metadata: "#64748B",
  meetings: "#38BDF8",
  stakeholders: "#84CC16",
  other: "#94A3B8",
};
