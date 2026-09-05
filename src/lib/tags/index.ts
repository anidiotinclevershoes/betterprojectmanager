export {
  TAG_TARGET_KINDS,
  isTagTargetKind,
  type ItemTag,
  type ProjectTag,
  type TagTargetKind,
} from "./types";
export { PREDEFINED_LUME_TAGS, type PredefinedLumeTag } from "./predefined";
export {
  dedupeTagNames,
  tagDisplayName,
  tagSlug,
  tagsAreSame,
} from "./normalize";
export { suggestTags, type TagSuggestion } from "./suggest";
export { cloneTruthWithoutTags, tagsFromCreateDraft } from "./from-draft";
export {
  attachTagToItem,
  detachTagFromItem,
  itemHasTag,
  tagsForItem,
  uniqueProjectTagNames,
} from "./query";
export { itemVisibleForTagFilter } from "./filter";
