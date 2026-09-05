import { newPeopleUuid } from "@/lib/people/identity";
import type { CreateProjectInput } from "@/lib/create-project";
import type { BuiltProjectBundle } from "@/lib/create-project";
import { dedupeTagNames, tagDisplayName, tagSlug } from "./normalize";
import { PREDEFINED_LUME_TAGS } from "./predefined";
import type { ItemTag, ProjectTag, TagTargetKind } from "./types";

const PREDEFINED_SLUGS = new Set(PREDEFINED_LUME_TAGS.map((n) => tagSlug(n)));

function newId(): string {
  return newPeopleUuid();
}

function originFor(name: string): ProjectTag["origin"] {
  return PREDEFINED_SLUGS.has(tagSlug(name)) ? "predefined" : "custom";
}

/**
 * Build retrieval-tag rows from a New Project draft + persisted identities.
 * Does not copy any tag onto a truth field.
 */
export function tagsFromCreateDraft(args: {
  projectId: string;
  input: CreateProjectInput;
  bundle: BuiltProjectBundle;
  riskIdsByTitle: Map<string, string>;
  knowledgeIdsByBody: Map<string, string>;
}): { projectTags: ProjectTag[]; itemTags: ItemTag[] } {
  const namesBySlug = new Map<string, string>();
  const attachments: Array<{ slug: string; targetKind: TagTargetKind; targetId: string }> =
    [];

  const remember = (names: string[] | undefined, targetKind: TagTargetKind, targetId: string) => {
    for (const name of dedupeTagNames(names ?? [])) {
      const slug = tagSlug(name);
      if (!slug || !targetId) continue;
      if (!namesBySlug.has(slug)) namesBySlug.set(slug, tagDisplayName(name));
      attachments.push({ slug, targetKind, targetId });
    }
  };

  const stakeholders = args.bundle.project.stakeholders;
  (args.input.stakeholders ?? []).forEach((draft, index) => {
    const person = stakeholders[index];
    if (!person) return;
    remember(draft.tags, "stakeholder", person.id);
  });

  (args.input.todos ?? [])
    .filter((t) => t.title.trim())
    .forEach((draft, index) => {
      const todo = args.bundle.todos[index];
      if (!todo) return;
      remember(draft.tags, "todo", todo.id);
    });

  (args.input.risks ?? [])
    .filter((r) => r.title.trim())
    .forEach((draft) => {
      const id = args.riskIdsByTitle.get(draft.title.trim().toLowerCase());
      if (id) remember(draft.tags, "risk", id);
    });

  (args.input.importantDates ?? [])
    .filter((d) => d.label.trim() && d.date)
    .forEach((draft) => {
      const milestone = args.bundle.timeline.find(
        (t) => t.label.trim().toLowerCase() === draft.label.trim().toLowerCase(),
      );
      if (milestone) remember(draft.tags, "milestone", milestone.id);
    });

  (args.input.knowledgeRemember ?? [])
    .filter((k) => k.remember !== false && k.text.trim())
    .forEach((draft) => {
      const id = args.knowledgeIdsByBody.get(draft.text.trim().toLowerCase());
      if (id) remember(draft.tags, "knowledge_item", id);
    });

  const projectTags: ProjectTag[] = [...namesBySlug.entries()].map(
    ([slug, name]) => ({
      id: newId(),
      projectId: args.projectId,
      name,
      slug,
      origin: originFor(name),
    }),
  );
  const tagIdBySlug = new Map(projectTags.map((t) => [t.slug, t.id]));

  const seenAttach = new Set<string>();
  const itemTags: ItemTag[] = [];
  for (const a of attachments) {
    const tagId = tagIdBySlug.get(a.slug);
    if (!tagId) continue;
    const key = `${tagId}:${a.targetKind}:${a.targetId}`;
    if (seenAttach.has(key)) continue;
    seenAttach.add(key);
    itemTags.push({
      id: newId(),
      projectId: args.projectId,
      tagId,
      targetKind: a.targetKind,
      targetId: a.targetId,
    });
  }

  return { projectTags, itemTags };
}

export function cloneTruthWithoutTags<T extends { tags?: string[] }>(item: T): Omit<T, "tags"> {
  const { tags: _ignored, ...rest } = item;
  return rest;
}
