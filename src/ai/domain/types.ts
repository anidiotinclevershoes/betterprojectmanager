/** Shared AI-facing domain types for all Lume AI features. */

export type AIEntityType =
  | "project"
  | "todo"
  | "meeting"
  | "risk"
  | "milestone"
  | "knowledge"
  | "stakeholder"
  | "nudge"
  | "history"
  | "release";

export type AIOperation =
  | "CREATE"
  | "UPDATE"
  | "COMPLETE"
  | "ARCHIVE"
  | "DELETE"
  | "NO_CHANGE";

/** Canonical statuses used when speaking to the model. */
export type AITodoStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "COMPLETED"
  | "ARCHIVED";

export type AIProjectStatus = "HEALTHY" | "WATCH" | "AT_RISK";

export type AIMeetingStatus = "UPCOMING" | "IN_PROGRESS" | "COMPLETED";

/** Generic status string on AIRecord (entity-specific canonical values). */
export type AIRecordStatus = string;

export type AIConfidenceBand = {
  min: number;
  max: number;
  label: string;
};

/**
 * Normalised record shape for prompts.
 * Only fields useful for reasoning — no implementation secrets.
 */
export type AIRecord = {
  type: AIEntityType;
  id: string;
  title: string;
  summary?: string;
  status?: string;
  owner?: string;
  date?: string | null;
  updatedAt?: string;
  projectId?: string | null;
};

export type ProjectDictionaryEntry = {
  term: string;
  definition: string;
};

export type PromptSectionId =
  | "role"
  | "domain"
  | "dictionary"
  | "context"
  | "capture"
  | "schema";

export type PromptSection = {
  id: PromptSectionId;
  label: string;
  content: string;
};

export type AssembledPrompt = {
  sections: PromptSection[];
  text: string;
  diagnostics: {
    sectionPresence: Record<PromptSectionId, boolean>;
    approximateCharacters: number;
    estimatedTokens: number;
    contextRecordCount: number;
    dictionaryEntryCount: number;
  };
};

export type PromptSectionMeta = PromptSection;
export type PromptSectionsPresence = Record<PromptSectionId, boolean>;
export type PromptAssemblyResult = AssembledPrompt;

export const AI_OPERATIONS: AIOperation[] = [
  "CREATE",
  "UPDATE",
  "COMPLETE",
  "ARCHIVE",
  "DELETE",
  "NO_CHANGE",
];

export const CONFIDENCE_BANDS = [
  { min: 95, max: 100, label: "Very high confidence" },
  { min: 80, max: 94, label: "Likely" },
  { min: 60, max: 79, label: "Possible" },
  { min: 0, max: 59, label: "Requires clarification" },
] as const;
