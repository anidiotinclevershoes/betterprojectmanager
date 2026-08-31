import { tagSlug } from "./normalize";
import type { ItemTag, ProjectTag, TagTargetKind } from "./types";

export function tagsForItem(args: {
  projectTags: ProjectTag[];
  itemTags: ItemTag[];
  projectId: string;
  targetKind: TagTargetKind;
  targetId: string;
}): ProjectTag[] {
  const tagIds = new Set(
    args.itemTags
      .filter(
        (row) =>
          row.projectId === args.projectId &&
          row.targetKind === args.targetKind &&
          row.targetId === args.targetId,
      )
      .map((row) => row.tagId),
  );
  return args.projectTags.filter(
    (tag) => tag.projectId === args.projectId && tagIds.has(tag.id),
  );
}

export function itemHasTag(args: {
  itemTags: ItemTag[];
  tagId: string;
  targetKind: TagTargetKind;
  targetId: string;
}): boolean {
  return args.itemTags.some(
    (row) =>
      row.tagId === args.tagId &&
      row.targetKind === args.targetKind &&
      row.targetId === args.targetId,
  );
}

export function uniqueProjectTagNames(
  projectTags: ProjectTag[],
  projectId: string,
): ProjectTag[] {
  return projectTags
    .filter((t) => t.projectId === projectId)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Pure in-memory attach. Does not mutate the target truth record.
 */
export function attachTagToItem(args: {
  projectTags: ProjectTag[];
  itemTags: ItemTag[];
  projectId: string;
  tag: ProjectTag;
  targetKind: TagTargetKind;
  targetId: string;
  itemTagId: string;
}): { projectTags: ProjectTag[]; itemTags: ItemTag[] } {
  const existing = args.projectTags.find(
    (t) => t.projectId === args.projectId && t.slug === tagSlug(args.tag.name),
  );
  const projectTags = existing
    ? args.projectTags
    : [...args.projectTags, args.tag];
  const tagId = existing?.id ?? args.tag.id;
  if (
    args.itemTags.some(
      (row) =>
        row.tagId === tagId &&
        row.targetKind === args.targetKind &&
        row.targetId === args.targetId,
    )
  ) {
    return { projectTags, itemTags: args.itemTags };
  }
  return {
    projectTags,
    itemTags: [
      ...args.itemTags,
      {
        id: args.itemTagId,
        projectId: args.projectId,
        tagId,
        targetKind: args.targetKind,
        targetId: args.targetId,
      },
    ],
  };
}

export function detachTagFromItem(args: {
  itemTags: ItemTag[];
  tagId: string;
  targetKind: TagTargetKind;
  targetId: string;
}): ItemTag[] {
  return args.itemTags.filter(
    (row) =>
      !(
        row.tagId === args.tagId &&
        row.targetKind === args.targetKind &&
        row.targetId === args.targetId
      ),
  );
}
