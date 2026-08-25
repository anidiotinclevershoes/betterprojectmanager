import type { ObservationDomain } from "@/lib/capture-v2";

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
  id: string;
  statement: string;
  evidence: string;
  modelDomain: ObservationDomain;
  category: ProvisionalCategory;
  proposedValues?: Record<string, unknown> | null;
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
