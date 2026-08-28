/**
 * Catch Me Up v0.9 — read-only project briefing contract.
 *
 * Inference is advice, never stored project truth.
 * Briefings are ephemeral: do not persist them as Knowledge.
 */

export type CatchMeUpEpistemic = "known" | "inferred";

export type CatchMeUpFact = {
  id: string;
  summary: string;
};

export type CatchMeUpItem = {
  epistemic: CatchMeUpEpistemic;
  prose: string;
  factIds: string[];
};

export type CatchMeUpBriefing = {
  projectId: string;
  projectName: string;
  projectCode: string;
  generatedAt: string;
  thinProject: boolean;
  facts: CatchMeUpFact[];
  /** Concise current picture from stored truth. Omitted when empty. */
  whereWeAre: CatchMeUpItem | null;
  needsAttention: CatchMeUpItem[];
  mightHaveMissed: CatchMeUpItem[];
  connections: CatchMeUpItem[];
  model?: string | null;
  provider: "openai" | "none";
};

export type CatchMeUpRequestBody = {
  projectId?: string;
  /** Ignored. Client-posted MissionState is never authoritative. */
  state?: unknown;
  snapshot?: unknown;
};

export type CatchMeUpSuccessResponse = {
  briefing: CatchMeUpBriefing;
};

export type CatchMeUpErrorResponse = {
  error: string;
  code?: string;
};
