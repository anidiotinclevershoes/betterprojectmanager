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
  /** Slice 1: optional supported implications (not auto-written to Knowledge). */
  noticed?: string[];
  /** Slice 1: material gaps for explicit UI confirmation. */
  needsConfirmation?: Array<{
    id: string;
    kind: "unknown_owner" | "conflict" | "ambiguity";
    summary: string;
    scope?: string | null;
    truthItemId?: string | null;
  }>;
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
  /** Model id sent in the request (pinned snapshot when using defaults). */
  modelRequested?: string | null;
  /** Model id from the API response when present. */
  model?: string | null;
  provider: "openai" | "local";
  /** Eval/debug only — estimated prompt component tokens. */
  tokenBreakdown?: Record<string, number | null> | null;
  /** Slice 1: whether canonical truth serialiser was used. */
  usedCanonicalTruth?: boolean;
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
  projectId: string;
  /** Lightweight conversation for follow-ups within a session. Not project evidence. */
  conversation?: TellMeConversationTurn[];
  userDisplayName?: string | null;
};

export type TellMeRefreshRequest = {
  projectId: string;
  userDisplayName?: string | null;
};
