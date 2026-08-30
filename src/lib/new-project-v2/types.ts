import type {
  ObservationDisposition,
  ObservationDomain,
  TruthIntent,
} from "@/lib/capture-v2/types";

export const PROVISIONAL_CATEGORIES = [
  "person",
  "risk",
  "milestone",
  "todo",
  "knowledge",
  "commentary",
  "ignored",
] as const;

export type ProvisionalCategory = (typeof PROVISIONAL_CATEGORIES)[number];

export type ProvisionalItem = {
  /** System-local row identity. Never the model observation.id. */
  id: string;
  statement: string;
  evidence: string;
  modelDomain: ObservationDomain;
  category: ProvisionalCategory;
  proposedValues?: Record<string, unknown> | null;
  /** Shared Capture disposition — map `ambiguous` onto existing needsReview. */
  disposition?: ObservationDisposition;
  truthIntent?: TruthIntent;
  /** Model-local observation id. Trace only — not recategorise / draft identity. */
  modelObservationId?: string;
  needsReview?: boolean;
  reviewReason?: string | null;
};

export type NewProjectV2Envelope = {
  project?: {
    name?: string;
    summary?: string;
    currentFocus?: string;
  };
  observations?: unknown[];
};

export function isProvisionalCategory(value: unknown): value is ProvisionalCategory {
  return (
    typeof value === "string" &&
    (PROVISIONAL_CATEGORIES as readonly string[]).includes(value)
  );
}

export function categoryFromDomain(domain: ObservationDomain): ProvisionalCategory {
  if (domain === "person" || domain === "responsibility" || domain === "availability") {
    return "person";
  }
  if (domain === "risk") return "risk";
  if (domain === "milestone") return "milestone";
  if (domain === "todo") return "todo";
  if (domain === "commentary" || domain === "unknown") return "commentary";
  return "knowledge";
}
