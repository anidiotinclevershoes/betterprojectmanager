import type { ItemTag } from "./types";

/** View-only. Selecting a tag never mutates the target object. */
export function itemVisibleForTagFilter(args: {
  itemTags: ItemTag[];
  projectId: string;
  targetKind: ItemTag["targetKind"];
  targetId: string;
  selectedTagIds: string[];
}): boolean {
  if (!args.selectedTagIds.length) return true;
  if (!args.targetId) return false;
  const attached = new Set(
    args.itemTags
      .filter(
        (row) =>
          row.projectId === args.projectId &&
          row.targetKind === args.targetKind &&
          row.targetId === args.targetId,
      )
      .map((row) => row.tagId),
  );
  return args.selectedTagIds.some((id) => attached.has(id));
}
