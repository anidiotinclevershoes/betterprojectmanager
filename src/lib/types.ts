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
  /** Development seed / demo marker — never infer from title alone. */
  isSeeded?: boolean;
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
  /** Capture review: inferred mutation (optional for legacy results). */
  operation?:
    | "create"
    | "update"
    | "complete"
    | "remove"
    | "archive"
    | "delete";
  /** Capture review: destination item type (optional for legacy results). */
  itemType?:
    | "action"
    | "milestone"
    | "decision"
    | "risk"
    | "stakeholder"
    | "knowledge"
    | "nudge"
    | "meeting"
    | "memory";
  targetTitle?: string;
  /** Phase 1.6: links recommendation back to validated finding / proposed op. */
  sourceFindingId?: string;
  proposedOperationId?: string;
  confidence?: number;
}

export interface Stakeholder {
  id: string;
  /** Development seed / demo marker. */
  isSeeded?: boolean;
  name: string;
  role: string;
  preferences?: string[];
  concerns?: string[];
  lastContactAt?: string;
}

export interface Project {
  id: string;
  /** Development seed / demo marker — never infer from name alone. */
  isSeeded?: boolean;
  name: string;
  code: string;
  summary: string;
  status: "healthy" | "watch" | "at_risk";
  /** delivery = change programmes; release_ops = monthly process/release train */
  kind?: "delivery" | "release_ops";
  currentFocus: string;
  nextMilestone?: string;
  nextMilestoneAt?: string;
  stakeholders: Stakeholder[];
  /** RELOPS: human month label, e.g. "August 2026" */
  releaseMonth?: string;
  /** RELOPS: merge / code freeze (ISO) */
  mergeDate?: string;
  /** RELOPS: go-live / release (ISO) */
  releaseDate?: string;
  /** Mark the seed/template month used when cloning a new train */
  isTemplate?: boolean;
  clonedFromId?: string;
}

export interface MemoryEntry {
  id: string;
  /** Development seed / demo marker. */
  isSeeded?: boolean;
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
  /** Development seed / demo marker. */
  isSeeded?: boolean;
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
  /** Development seed / demo marker. */
  isSeeded?: boolean;
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
export type TodoKind = "ACTION" | "WAITING" | "CHASE" | "REMINDER";

export interface TodoItem {
  id: string;
  /** Development seed / demo marker. */
  isSeeded?: boolean;
  /** null / undefined = personal / generic (not tied to a project) */
  projectId?: string | null;
  title: string;
  detail?: string;
  done: boolean;
  createdAt: string;
  /** ISO datetime — editable; for RELOPS prefer within merge→release window */
  dueAt?: string;
  sourceRecommendationId?: string;
  /** Follow-up semantics formerly expressed as Nudge Me. */
  kind?: TodoKind;
  /** Person/org the item is waiting on (Waiting / Chase). */
  waitingOn?: string;
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
  /** Development seed / demo marker (rare; usually keyed by seed projectId). */
  isSeeded?: boolean;
  updatedAt: string;
  sections: Record<KnowledgeSectionId, string[]>;
  /**
   * Parallel stable ids for section bullets (knowledge_items.id when known).
   * Same length/order as `sections[section]` when present. Null = new/unidentified line.
   */
  sectionItemIds?: Partial<Record<KnowledgeSectionId, Array<string | null>>>;
  /**
   * Slice 1+: structured canonical truth overlay (responsibilities, epistemic, etc.).
   * Legacy section strings remain the display/capture body store.
   */
  structured?: import("./canonical-truth/types").CanonicalTruthItem[];
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
  /** Dates/milestones for the project timeline — AI appends, does not rebuild. */
  timelinePatch?: TimelineItemInput[];
  /** Phase 1.6: validated findings from analysis. */
  findings?: import("./capture/findings").CaptureFinding[];
  /** Phase 1.6: deterministic operations derived from findings. */
  proposedOperations?: import("./capture/findings").ProposedOperation[];
  /** Phase 1.6: validation warnings (dev / Golden Test). */
  findingsValidation?: {
    ok: boolean;
    errors: string[];
    warnings: string[];
    invalidTargetCount: number;
  };
  /** Sprint 2.1.5: actionable finding dispositions after mapping. */
  findingCoverage?: import("./capture/findings").FindingCoverageReport;
  /** Experimental Capture V2 — informational accounting only. */
  capturePipeline?: "legacy" | "v2";
  observationAccount?: {
    total: number;
    proposedChanges: number;
    alreadyKnown: number;
    merged: number;
    needsYou: number;
    commentary: number;
    rejected: number;
  };
}

/** Lightweight timeline entry the UI renders; AI only adds/updates these. */
export type TimelineItemType =
  | "phase"
  | "milestone"
  | "meeting"
  | "deadline"
  | "submission";

export interface TimelineItem {
  id: string;
  /** Development seed / demo marker. */
  isSeeded?: boolean;
  projectId: string;
  label: string;
  type: TimelineItemType;
  startAt: string;
  endAt?: string;
  notes?: string;
  source?: "seed" | "capture" | "manual";
}

/** Patch shape used by AI / local capture — id optional for new items. */
export interface TimelineItemInput {
  id?: string;
  label: string;
  type: TimelineItemType;
  startAt: string;
  endAt?: string;
  notes?: string;
}

export type HistoryEventType =
  | "task_added"
  | "task_completed"
  | "task_updated"
  | "suggestion_accepted"
  | "suggestion_dismissed"
  | "meeting_created"
  | "milestone_changed"
  | "risk_added"
  | "knowledge_updated"
  | "project_created"
  | "capture_analysed"
  | "coach_accepted"
  | "nudge_chased"
  | "nudge_resolved"
  | "other";

export interface HistoryEvent {
  id: string;
  /** Development seed / demo marker. */
  isSeeded?: boolean;
  type: HistoryEventType;
  title: string;
  detail?: string;
  projectId?: string | null;
  createdAt: string;
  source?: "user" | "ai" | "system";
}

/**
 * Slice 1B: maintained Risk domain record (`risks` table / local mirror).
 * Lifecycle authority for genuine Risks — Knowledge may project titles but
 * must not compete on status for the same record.
 */
export interface ProjectRisk {
  id: string;
  projectId: string;
  title: string;
  status: import("@/types/database").RiskStatus;
  source?: "manual" | "capture" | "seed";
  createdAt?: string;
  updatedAt?: string;
}

export interface MissionState {
  projects: Project[];
  memories: MemoryEntry[];
  recommendations: Recommendation[];
  meetings: Meeting[];
  releases: Release[];
  todos: TodoItem[];
  knowledge: ProjectKnowledge[];
  /**
   * Maintained Risk domain records. Absent/empty in older local snapshots —
   * normalise to []. Knowledge-only risk bullets remain transitional.
   */
  risks?: ProjectRisk[];
  timeline: TimelineItem[];
  history?: HistoryEvent[];
  /** Retrieval tags — not project truth. */
  projectTags?: import("./tags").ProjectTag[];
  itemTags?: import("./tags").ItemTag[];
  lastAnalyzedAt?: string;
  /** Analyses consumed in the current calendar month (local). */
  analysesThisMonth?: number;
  analysesMonthKey?: string;
}
