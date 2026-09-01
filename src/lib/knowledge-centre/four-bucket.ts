/**
 * Knowledge Centre four-bucket view-model.
 * Presentation/retrieval only — does not merge or invent authoritative types.
 */
import { emptyKnowledge } from "@/lib/knowledge";
import { isKnowledgeUuid } from "@/lib/knowledge-identity";
import {
  refForKnowledgeRisk,
  refForPerson,
  refForRisk,
  refForSectionLine,
  refForStructuredItem,
  refForTimeline,
  refForTodo,
  refForUnconfirmedOwner,
  type KnowledgeItemRef,
} from "@/lib/knowledge-centre/knowledge-item-detail";
import {
  buildDateRows,
  buildOpenRiskRows,
  buildPeopleRows,
  buildTodoRows,
} from "@/lib/knowledge-centre/ocean-frames";
import { queryMatchesText } from "@/lib/tell-me/knowledge-search";
import { itemVisibleForTagFilter, tagsForItem, type TagTargetKind } from "@/lib/tags";
import type { MissionState } from "@/lib/types";

export const KC_BUCKETS = ["all", "issues", "people", "todo", "knowledge"] as const;
export type KcBucket = (typeof KC_BUCKETS)[number];
export type KcBucketId = Exclude<KcBucket, "all">;

export type KcKnowledgeSubtype = "all" | "dates" | "decisions" | "information";

export const KC_BUCKET_ICON = {
  issues: "⚠",
  people: "◎",
  todo: "☑",
  knowledge: "☰",
  dates: "◆",
  decisions: "◇",
  information: "☰",
} as const;

export type KcComposedItem = {
  id: string;
  bucket: KcBucketId;
  typeLabel: string;
  knowledgeSubtype?: Exclude<KcKnowledgeSubtype, "all">;
  title: string;
  supporting?: string | null;
  needsYou?: string | null;
  icon: string;
  searchText: string;
  tagKind: TagTargetKind;
  tagTargetId: string;
  ref: KnowledgeItemRef | null;
  tagNames: string[];
};

export type KcViewInput = {
  query: string;
  bucket: KcBucket;
  tagIds: string[];
  knowledgeSubtype: KcKnowledgeSubtype;
};

export type KcViewResult = {
  items: KcComposedItem[];
  grouped: Record<KcBucketId, KcComposedItem[]>;
  counts: Record<KcBucket, number>;
  globalCount: number;
  bucketCount: number;
};

const BUCKET_IDS: KcBucketId[] = ["issues", "people", "todo", "knowledge"];

function personNameFromTitle(title: string): string {
  return title.replace(/^@/, "").split("·")[0]?.trim() ?? title;
}

function scopeFromPeopleTitle(title: string): string | null {
  const parts = title.split("·");
  if (parts.length < 2) return null;
  return parts.slice(1).join("·").trim() || null;
}

function tagNamesFor(
  state: MissionState,
  projectId: string,
  kind: TagTargetKind,
  targetId: string,
): string[] {
  return tagsForItem({
    projectTags: state.projectTags ?? [],
    itemTags: state.itemTags ?? [],
    projectId,
    targetKind: kind,
    targetId,
  }).map((t) => t.name);
}

function withSearch(
  item: Omit<KcComposedItem, "searchText"> & { searchText?: string },
): KcComposedItem {
  const bits = [
    item.title,
    item.supporting,
    item.typeLabel,
    item.needsYou,
    ...(item.tagNames ?? []),
  ];
  return {
    ...item,
    searchText: (item.searchText ?? bits.filter(Boolean).join(" ")).trim(),
  };
}

/**
 * Compose the Knowledge Centre list from existing Ocean row builders
 * plus structured/section knowledge. Does not persist or reshape truth.
 */
export function composeKnowledgeCentreItems(
  state: MissionState,
  projectId: string,
): KcComposedItem[] {
  const knowledge =
    state.knowledge.find((k) => k.projectId === projectId) ??
    emptyKnowledge(projectId);
  const items: KcComposedItem[] = [];
  const seen = new Set<string>();
  const seenKnowledgeBody = new Set<string>();
  const remember = (item: KcComposedItem) => {
    if (seen.has(item.id)) return;
    if (
      item.bucket === "knowledge" &&
      seenKnowledgeBody.has(item.title.trim().toLowerCase())
    ) {
      return;
    }
    seen.add(item.id);
    if (item.bucket === "knowledge") {
      seenKnowledgeBody.add(item.title.trim().toLowerCase());
    }
    items.push(item);
  };

  for (const row of buildOpenRiskRows(state, projectId)) {
    const isRisk = isKnowledgeUuid(row.id);
    const tagKind: TagTargetKind = isRisk ? "risk" : "knowledge_item";
    remember(
      withSearch({
        id: `issue:${row.id}`,
        bucket: "issues",
        typeLabel: "Risk",
        title: row.title,
        icon: KC_BUCKET_ICON.issues,
        tagKind,
        tagTargetId: row.id,
        ref: isRisk
          ? refForRisk(row.id)
          : refForKnowledgeRisk(row.id, row.title),
        tagNames: tagNamesFor(state, projectId, tagKind, row.id),
      }),
    );
  }

  const peopleById = new Map<
    string,
    {
      name: string;
      scopes: string[];
      meta: string | null;
      unconfirmed: boolean;
    }
  >();
  for (const row of buildPeopleRows(state, projectId)) {
    if (row.personId) {
      const name = personNameFromTitle(row.title);
      const scope = scopeFromPeopleTitle(row.title);
      const existing = peopleById.get(row.personId);
      if (existing) {
        if (scope && !existing.scopes.includes(scope)) existing.scopes.push(scope);
        existing.meta = existing.meta || row.meta;
        if (row.epistemic === "Unconfirmed") existing.unconfirmed = true;
      } else {
        peopleById.set(row.personId, {
          name,
          scopes: scope ? [scope] : [],
          meta: row.meta,
          unconfirmed: row.epistemic === "Unconfirmed",
        });
      }
      continue;
    }
    remember(
      withSearch({
        id: `person-unconfirmed:${row.id}`,
        bucket: "people",
        typeLabel: "Person",
        title: row.title.replace(/^@/, ""),
        supporting: row.meta,
        needsYou: "Needs You — Who owns this?",
        icon: KC_BUCKET_ICON.people,
        tagKind: "stakeholder",
        tagTargetId: row.id,
        ref: isKnowledgeUuid(row.id) ? refForUnconfirmedOwner(row.id) : null,
        tagNames: tagNamesFor(state, projectId, "stakeholder", row.id),
      }),
    );
  }
  for (const [personId, person] of peopleById) {
    const supporting = [person.scopes.join(" · ") || null, person.meta]
      .filter(Boolean)
      .join(" · ");
    const missingScope = person.scopes.length === 0;
    remember(
      withSearch({
        id: `person:${personId}`,
        bucket: "people",
        typeLabel: "Person",
        title: person.name,
        supporting: supporting || null,
        needsYou:
          missingScope || person.unconfirmed
            ? `Needs You — What is ${person.name} responsible for?`
            : null,
        icon: KC_BUCKET_ICON.people,
        tagKind: "stakeholder",
        tagTargetId: personId,
        ref: refForPerson(personId),
        tagNames: tagNamesFor(state, projectId, "stakeholder", personId),
        searchText: [person.name, ...person.scopes, person.meta, ...tagNamesFor(state, projectId, "stakeholder", personId)]
          .filter(Boolean)
          .join(" "),
      }),
    );
  }

  for (const row of buildTodoRows(state, projectId)) {
    remember(
      withSearch({
        id: `todo:${row.id}`,
        bucket: "todo",
        typeLabel: "To Do",
        title: row.title,
        supporting: row.meta,
        icon: KC_BUCKET_ICON.todo,
        tagKind: "todo",
        tagTargetId: row.id,
        ref: refForTodo(row.id),
        tagNames: tagNamesFor(state, projectId, "todo", row.id),
      }),
    );
  }
  for (const todo of state.todos ?? []) {
    if (todo.projectId !== projectId || todo.done) continue;
    if (!(todo.kind === "WAITING" || todo.kind === "CHASE" || Boolean(todo.waitingOn))) {
      continue;
    }
    remember(
      withSearch({
        id: `todo:${todo.id}`,
        bucket: "todo",
        typeLabel: "To Do",
        title: todo.title,
        supporting: todo.waitingOn ? `Waiting on ${todo.waitingOn}` : "Waiting",
        icon: KC_BUCKET_ICON.todo,
        tagKind: "todo",
        tagTargetId: todo.id,
        ref: refForTodo(todo.id),
        tagNames: tagNamesFor(state, projectId, "todo", todo.id),
      }),
    );
  }

  const dateSeen = new Set<string>();
  for (const row of buildDateRows(state, projectId)) {
    dateSeen.add(row.title.toLowerCase());
    const isTimeline = (state.timeline ?? []).some((t) => t.id === row.id);
    const structured = (knowledge.structured ?? []).find((i) => i.id === row.id);
    const undated =
      structured?.kind === "date" && !structured.meta?.date?.dateIso;
    remember(
      withSearch({
        id: `date:${row.id}`,
        bucket: "knowledge",
        typeLabel: "Milestone / Date",
        knowledgeSubtype: "dates",
        title: row.title,
        needsYou: undated ? `Needs You — When is the ${row.title}?` : null,
        icon: KC_BUCKET_ICON.dates,
        tagKind: "milestone",
        tagTargetId: row.id,
        ref: isTimeline ? refForTimeline(row.id) : refForStructuredItem(row.id),
        tagNames: tagNamesFor(
          state,
          projectId,
          isTimeline ? "milestone" : "knowledge_item",
          row.id,
        ),
      }),
    );
  }

  const decisionIds = knowledge.sectionItemIds?.decisions;
  for (const [i, body] of (knowledge.sections.decisions ?? []).entries()) {
    const itemId =
      Array.isArray(decisionIds) && typeof decisionIds[i] === "string"
        ? decisionIds[i]
        : null;
    const id = itemId && isKnowledgeUuid(itemId) ? itemId : `dec-body:${body}`;
    remember(
      withSearch({
        id: `decision:${id}`,
        bucket: "knowledge",
        typeLabel: "Decision",
        knowledgeSubtype: "decisions",
        title: body,
        icon: KC_BUCKET_ICON.decisions,
        tagKind: "knowledge_item",
        tagTargetId: id,
        ref: refForSectionLine("decisions", body, itemId),
        tagNames: tagNamesFor(state, projectId, "knowledge_item", id),
      }),
    );
  }

  for (const item of knowledge.structured ?? []) {
    if (item.lifecycle !== "current") continue;
    if (item.kind === "dependency") {
      remember(
        withSearch({
          id: `dep:${item.id}`,
          bucket: "knowledge",
          typeLabel: "Dependency",
          knowledgeSubtype: "information",
          title: item.body,
          icon: KC_BUCKET_ICON.information,
          tagKind: "knowledge_item",
          tagTargetId: item.id,
          ref: refForStructuredItem(item.id),
          tagNames: tagNamesFor(state, projectId, "knowledge_item", item.id),
        }),
      );
    }
    if (
      (item.kind === "fact" || item.section === "now") &&
      item.kind !== "date" &&
      item.kind !== "decision" &&
      item.kind !== "responsibility" &&
      item.kind !== "dependency"
    ) {
      remember(
        withSearch({
          id: `fact:${item.id}`,
          bucket: "knowledge",
          typeLabel: "Information",
          knowledgeSubtype: "information",
          title: item.body,
          needsYou:
            item.epistemic === "unknown" || item.epistemic === "conflicting"
              ? "Needs You — Lume noticed what's missing."
              : null,
          icon: KC_BUCKET_ICON.information,
          tagKind: "knowledge_item",
          tagTargetId: item.id,
          ref: refForStructuredItem(item.id),
          tagNames: tagNamesFor(state, projectId, "knowledge_item", item.id),
        }),
      );
    }
  }

  const nowIds = knowledge.sectionItemIds?.now;
  for (const [i, body] of (knowledge.sections.now ?? []).entries()) {
    const itemId =
      Array.isArray(nowIds) && typeof nowIds[i] === "string" ? nowIds[i] : null;
    const id = itemId && isKnowledgeUuid(itemId) ? itemId : `now-body:${body}`;
    if (seen.has(`fact:${id}`) || dateSeen.has(body.toLowerCase())) continue;
    remember(
      withSearch({
        id: `now:${id}`,
        bucket: "knowledge",
        typeLabel: "Information",
        knowledgeSubtype: "information",
        title: body,
        icon: KC_BUCKET_ICON.information,
        tagKind: "knowledge_item",
        tagTargetId: id,
        ref: refForSectionLine("now", body, itemId),
        tagNames: tagNamesFor(state, projectId, "knowledge_item", id),
      }),
    );
  }

  const peopleSectionIds = knowledge.sectionItemIds?.people;
  for (const [i, body] of (knowledge.sections.people ?? []).entries()) {
    const itemId =
      Array.isArray(peopleSectionIds) && typeof peopleSectionIds[i] === "string"
        ? peopleSectionIds[i]
        : null;
    const id = itemId && isKnowledgeUuid(itemId) ? itemId : `people-body:${body}`;
    remember(
      withSearch({
        id: `people-context:${id}`,
        bucket: "knowledge",
        typeLabel: "Information",
        knowledgeSubtype: "information",
        title: body,
        supporting: "People context",
        icon: KC_BUCKET_ICON.information,
        tagKind: "knowledge_item",
        tagTargetId: id,
        ref: refForSectionLine("people", body, itemId),
        tagNames: tagNamesFor(state, projectId, "knowledge_item", id),
      }),
    );
  }

  const loopIds = knowledge.sectionItemIds?.openLoops;
  for (const [i, body] of (knowledge.sections.openLoops ?? []).entries()) {
    const itemId =
      Array.isArray(loopIds) && typeof loopIds[i] === "string" ? loopIds[i] : null;
    const id = itemId && isKnowledgeUuid(itemId) ? itemId : `loop-body:${body}`;
    remember(
      withSearch({
        id: `loop:${id}`,
        bucket: "knowledge",
        typeLabel: "Information",
        knowledgeSubtype: "information",
        title: body,
        supporting: "Open loop",
        icon: KC_BUCKET_ICON.information,
        tagKind: "knowledge_item",
        tagTargetId: id,
        ref: refForSectionLine("openLoops", body, itemId),
        tagNames: tagNamesFor(state, projectId, "knowledge_item", id),
      }),
    );
  }

  return items;
}

export function itemMatchesTags(
  item: KcComposedItem,
  args: {
    itemTags: MissionState["itemTags"];
    projectId: string;
    selectedTagIds: string[];
  },
): boolean {
  return itemVisibleForTagFilter({
    itemTags: args.itemTags ?? [],
    projectId: args.projectId,
    targetKind: item.tagKind,
    targetId: item.tagTargetId,
    selectedTagIds: args.selectedTagIds,
  });
}

export function itemMatchesQuery(item: KcComposedItem, query: string): boolean {
  return queryMatchesText(item.searchText, query);
}

export function filterKnowledgeCentreItems(
  items: KcComposedItem[],
  view: KcViewInput,
  args: { itemTags: MissionState["itemTags"]; projectId: string },
): KcViewResult {
  const tagged = items.filter((item) =>
    itemMatchesTags(item, {
      itemTags: args.itemTags,
      projectId: args.projectId,
      selectedTagIds: view.tagIds,
    }),
  );
  const searched = tagged.filter((item) => itemMatchesQuery(item, view.query));
  const grouped = {
    issues: searched.filter((i) => i.bucket === "issues"),
    people: searched.filter((i) => i.bucket === "people"),
    todo: searched.filter((i) => i.bucket === "todo"),
    knowledge: searched.filter((i) => i.bucket === "knowledge"),
  };
  const counts: Record<KcBucket, number> = {
    all: searched.length,
    issues: grouped.issues.length,
    people: grouped.people.length,
    todo: grouped.todo.length,
    knowledge: grouped.knowledge.length,
  };

  let visible = searched;
  if (view.bucket !== "all") {
    visible = grouped[view.bucket];
  }
  if (view.bucket === "knowledge" && view.knowledgeSubtype !== "all") {
    visible = visible.filter((i) => i.knowledgeSubtype === view.knowledgeSubtype);
  }

  return {
    items: visible,
    grouped,
    counts,
    globalCount: searched.length,
    bucketCount: visible.length,
  };
}

export function emptyGrouped(): Record<KcBucketId, KcComposedItem[]> {
  return { issues: [], people: [], todo: [], knowledge: [] };
}

export function bucketLabel(bucket: KcBucket): string {
  if (bucket === "all") return "All";
  if (bucket === "issues") return "Issues";
  if (bucket === "people") return "People";
  if (bucket === "todo") return "To Do";
  return "Knowledge";
}

export { BUCKET_IDS };
