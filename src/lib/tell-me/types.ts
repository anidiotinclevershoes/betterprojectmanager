/** Tell Me V1 types — read-only project recall. */

export type TellMeScopeMode = "project" | "cross_project" | "explicit_project";

export type TellMeSourceRef = {
  id: string;
  kind:
    | "knowledge"
    | "todo"
    | "risk"
    | "timeline"
    | "history"
    | "meeting"
    | "release"
    | "stakeholder"
    | "project"
    | "snapshot"
    | "capture";
  label: string;
  projectId?: string | null;
  projectCode?: string | null;
  detail?: string | null;
};

export type TellMeSuggestedQuestion = {
  id: string;
  question: string;
  reason: string;
  signals: string[];
};

export type ProjectIntelligenceSnapshot = {
  id: string;
  workspaceId?: string | null;
  projectId: string;
  /** Compact narrative / bullet summary — not a full DB dump. */
  summary: string;
  keyState: string[];
  constraints: string[];
  majorRisks: string[];
  keyDependencies: string[];
  keyStakeholders: string[];
  importantKnowledge: string[];
  significantDates: string[];
  suggestedQuestions: TellMeSuggestedQuestion[];
  sourceRevision: string;
  createdAt: string;
  /** How the snapshot was built. */
  kind: "deterministic" | "ai_refresh";
};

export type TellMeFreshness = {
  currentRevision: string;
  snapshotRevision: string | null;
  snapshotCreatedAt: string | null;
  isStale: boolean;
  changeCountHint: number;
  message: string | null;
};

export type TellMeConversationTurn = {
  role: "user" | "assistant";
  content: string;
};

export type TellMeAnswerConfidence =
  | "direct_confirmation"
  | "related_context"
  | "not_found"
  | "inference";

export type TellMeAnswer = {
  answer: string;
  confidence: TellMeAnswerConfidence;
  sources: TellMeSourceRef[];
  scope: {
    mode: TellMeScopeMode;
    projectId: string | null;
    projectCode: string | null;
    projectName: string | null;
  };
  freshness: TellMeFreshness;
  refreshRecommended: boolean;
  refreshReason: string | null;
  coachHandoff?: boolean;
  capturePrefill?: string | null;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
  model?: string | null;
  provider: "openai" | "local";
  contextStats: {
    projectsConsidered: number;
    recordsSelected: number;
    snapshotUsed: boolean;
    knowledgeItems: number;
    structuredItems: number;
    approxChars: number;
  };
};

export type TellMeAskRequest = {
  question: string;
  projectId?: string | null;
  /** Lightweight conversation for follow-ups within a session. */
  conversation?: TellMeConversationTurn[];
  /** Client-held snapshot for the selected project (optional). */
  snapshot?: ProjectIntelligenceSnapshot | null;
  /** Full mission state slice for context selection (same pattern as Capture/Coach). */
  state: import("@/lib/types").MissionState;
  userDisplayName?: string | null;
};

export type TellMeRefreshRequest = {
  projectId: string;
  state: import("@/lib/types").MissionState;
  previousSnapshot?: ProjectIntelligenceSnapshot | null;
};
