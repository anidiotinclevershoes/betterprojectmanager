/**
 * Retrieval tags — metadata only.
 *
 * Invariant: if every tag were deleted, project truth must be unchanged.
 * Tags must never affect identity, resolution, dates, responsibilities,
 * ownership, risk state, decisions, confidence, mutation planning,
 * safety gates, Capture interpretation, or Change Intelligence.
 */

export const TAG_TARGET_KINDS = [
  "risk",
  "todo",
  "stakeholder",
  "knowledge_item",
  "milestone",
] as const;

export type TagTargetKind = (typeof TAG_TARGET_KINDS)[number];

export type ProjectTag = {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  origin: "predefined" | "custom";
};

export type ItemTag = {
  id: string;
  projectId: string;
  tagId: string;
  targetKind: TagTargetKind;
  targetId: string;
};

export function isTagTargetKind(value: unknown): value is TagTargetKind {
  return (
    typeof value === "string" &&
    (TAG_TARGET_KINDS as readonly string[]).includes(value)
  );
}
