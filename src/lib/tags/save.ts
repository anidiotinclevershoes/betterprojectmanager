/**
 * Tag Save planning and compensating-cleanup rules.
 * Persistence still goes through persist-tags helpers. Not a second store.
 */
import { tagDisplayName, tagSlug } from "./normalize";
import type { ItemTag, ProjectTag, TagTargetKind } from "./types";

export type PlannedTagOp =
  | { kind: "reuse"; tag: ProjectTag }
  | { kind: "create"; draft: ProjectTag };

export function planItemTagSave(args: {
  projectId: string;
  names: string[];
  projectTags: ProjectTag[];
  newTagId: () => string;
}): PlannedTagOp[] {
  const seen = new Set<string>();
  const ops: PlannedTagOp[] = [];
  for (const raw of args.names) {
    const name = tagDisplayName(raw);
    const slug = tagSlug(name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const existing = args.projectTags.find(
      (tag) => tag.projectId === args.projectId && tag.slug === slug,
    );
    if (existing) {
      ops.push({ kind: "reuse", tag: existing });
      continue;
    }
    ops.push({
      kind: "create",
      draft: {
        id: args.newTagId(),
        projectId: args.projectId,
        name,
        slug,
        origin: "custom",
      },
    });
  }
  return ops;
}

/**
 * Delete a just-created tag only when this Save created it and the
 * existing architecture proves it is still unused.
 */
export function shouldDeleteCreatedTag(args: {
  createdThisSave: boolean;
  unusedProven: boolean;
  proveFailed: boolean;
}): boolean {
  return args.createdThisSave && args.unusedProven && !args.proveFailed;
}

export type TagSaveFailureMode =
  | "attach_failed_unused_cleaned"
  | "attach_failed_unused_left"
  | "attach_failed_in_use"
  | "none";

export function describeTagSaveFailure(mode: TagSaveFailureMode): string {
  switch (mode) {
    case "attach_failed_unused_cleaned":
      return "Could not attach the tag. The unused tag created by this Save was removed.";
    case "attach_failed_unused_left":
      return "Could not attach the tag. A leftover unused tag name may remain as retrieval metadata only — it is not project information.";
    case "attach_failed_in_use":
      return "Could not attach the tag. An existing project tag was left untouched.";
    default:
      return "Could not save tags.";
  }
}

export function itemTagRow(args: {
  id: string;
  projectId: string;
  tagId: string;
  targetKind: TagTargetKind;
  targetId: string;
}): ItemTag {
  return {
    id: args.id,
    projectId: args.projectId,
    tagId: args.tagId,
    targetKind: args.targetKind,
    targetId: args.targetId,
  };
}
