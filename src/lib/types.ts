import type { MemoryType } from "./mission";

export type RecommendationUrgency = "now" | "today" | "this_week" | "watch";

export type RecommendationKind =
  | "stakeholder_update"
  | "escalation"
  | "conversation"
  | "meeting"
  | "decision"
  | "risk"
  | "dependency"
  | "release"
  | "meeting_prep"
  | "leadership"
  | "assumption";

export interface Recommendation {
  id: string;
  kind: RecommendationKind;
  urgency: RecommendationUrgency;
  title: string;
  /** What to do — framed as leadership action, not a task ticket. */
  action: string;
  /** Why this matters — coaching explanation required. */
  why: string;
  /** How this makes the user look calm, prepared, proactive and trusted. */
  leadershipImpact: string;
  projectId?: string;
  relatedMemoryIds?: string[];
  suggestedScript?: string;
  createdAt: string;
  status: "active" | "done" | "dismissed";
}

export interface Stakeholder {
  id: string;
  name: string;
  role: string;
  preferences?: string[];
  concerns?: string[];
  lastContactAt?: string;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  summary: string;
  status: "healthy" | "watch" | "at_risk";
  currentFocus: string;
  nextMilestone?: string;
  nextMilestoneAt?: string;
  stakeholders: Stakeholder[];
}

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  projectId?: string;
  title: string;
  content: string;
  tags: string[];
  people?: string[];
  occurredAt: string;
  createdAt: string;
  source: "capture" | "meeting" | "system" | "release" | "import";
}

export type MeetingPhase = "upcoming" | "in_progress" | "completed";

export interface MeetingPrep {
  objectives: string[];
  openingScript: string;
  talkingPoints: string[];
  questionsToAsk: string[];
  decisionsToObtain: string[];
  risksToDiscuss: string[];
  peopleToEngage: string[];
  leadershipOpportunities: string[];
  stakeholderConcerns: string[];
  ownershipMoments: string[];
}

export interface MeetingDuringPrompt {
  id: string;
  prompt: string;
  context: string;
}

export interface MeetingDebrief {
  summary: string;
  actions: string[];
  decisions: string[];
  risks: string[];
  followUpEmail: string;
  stakeholderUpdate: string;
  projectUpdates: string[];
}

export interface Meeting {
  id: string;
  projectId: string;
  title: string;
  startsAt: string;
  attendees: string[];
  phase: MeetingPhase;
  prep: MeetingPrep;
  duringPrompts: MeetingDuringPrompt[];
  debrief?: MeetingDebrief;
}

export type ReleaseStage =
  | "merge_window"
  | "build_validation"
  | "regression_testing"
  | "cab_preparation"
  | "cab_approval"
  | "release_readiness"
  | "production_deployment"
  | "smoke_testing"
  | "hypercare"
  | "release_closure";

export interface ReleaseStageStatus {
  stage: ReleaseStage;
  label: string;
  status: "complete" | "current" | "upcoming" | "blocked" | "at_risk";
  dueAt?: string;
  notes?: string;
  missingArtefacts?: string[];
}

export interface Release {
  id: string;
  projectId: string;
  name: string;
  targetDate: string;
  currentStage: ReleaseStage;
  stages: ReleaseStageStatus[];
  risks: string[];
}

export interface CaptureInput {
  content: string;
  projectId?: string;
  sourceType?: "note" | "voice_note" | "conversation" | "meeting_note";
  occurredAt?: string;
}

/** Owned checklist item — accepted from suggestions or added manually. */
export interface TodoItem {
  id: string;
  projectId: string;
  title: string;
  detail?: string;
  done: boolean;
  createdAt: string;
  sourceRecommendationId?: string;
}

/** AI-proposed meeting the user can later expand into agenda/script. */
export interface SuggestedMeeting {
  id: string;
  projectId: string;
  title: string;
  why: string;
  withWhom: string[];
  urgency: RecommendationUrgency;
  recommendationId?: string;
}

/** Fixed, limited knowledge sections — avoid wall-of-text sprawl. */
export type KnowledgeSectionId =
  | "now"
  | "decisions"
  | "risks"
  | "people"
  | "openLoops";

export interface ProjectKnowledge {
  projectId: string;
  updatedAt: string;
  sections: Record<KnowledgeSectionId, string[]>;
}

export interface CaptureResult {
  memory: MemoryEntry;
  insights: string[];
  assumptions: string[];
  recommendations: Recommendation[];
  rawContent?: string;
  tidied?: boolean;
  provider?: "openai" | "local";
  /** Relevant bullets to merge into the project knowledge brief. */
  knowledgePatch?: Partial<ProjectKnowledge["sections"]>;
  knowledgeProjectId?: string;
}

export interface MissionState {
  projects: Project[];
  memories: MemoryEntry[];
  recommendations: Recommendation[];
  meetings: Meeting[];
  releases: Release[];
  todos: TodoItem[];
  knowledge: ProjectKnowledge[];
  lastAnalyzedAt?: string;
}
