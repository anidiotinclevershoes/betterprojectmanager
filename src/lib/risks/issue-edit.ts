/**
 * One Issue edit: Title + Notes + retrieval tags.
 * Local mode applies that set in one state transition.
 * Durable mode uses save_risk_edit. Knowledge prose is not rewritten.
 */
import type { HistoryEvent, MissionState, ProjectRisk } from "@/lib/types";
import { dedupeTagNames, tagDisplayName, tagSlug } from "@/lib/tags/normalize";
import { itemTagRow, planItemTagSave } from "@/lib/tags/save";
import type { ItemTag, ProjectTag } from "@/lib/tags/types";
import { makeHistoryEvent, pushHistory } from "@/lib/workspace/history";
import {
  planRiskNotesChange,
  RISK_HISTORY_TARGET_KIND,
} from "@/lib/risks/issue-notes";

export type RiskEditTag = {
  id: string;
  name: string;
  slug: string;
  origin: "predefined" | "custom";
};

export type RiskEditHistory = {
  id: string;
  title: string;
  detail: string;
  createdAt?: string;
};

export type RiskEditResult = {
  ok: boolean;
  error?: string;
  changed?: boolean;
  titleChanged?: boolean;
  notesChanged?: boolean;
  tagsChanged?: boolean;
  title?: string;
  notes?: string | null;
  updatedAt?: string;
  history?: RiskEditHistory[];
  tags?: RiskEditTag[];
  itemTags?: Array<{ id: string; tagId: string }>;
};

export type CanonicalTagInput = { name: string; slug: string };

export function canonicalRiskTitle(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function canonicalTagsFromNames(names: string[]): CanonicalTagInput[] {
  return dedupeTagNames(names).map((name) => ({
    name,
    slug: tagSlug(name),
  }));
}

export function rejectMalformedTags(
  tags: unknown,
): { ok: true; tags: CanonicalTagInput[] } | { ok: false; error: string } {
  if (!Array.isArray(tags)) return { ok: false, error: "tags must be a list" };
  const seen = new Set<string>();
  const out: CanonicalTagInput[] = [];
  for (const raw of tags) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { ok: false, error: "tag value is malformed" };
    }
    const record = raw as Record<string, unknown>;
    if (typeof record.name !== "string" || typeof record.slug !== "string") {
      return { ok: false, error: "tag value is malformed" };
    }
    const collapsed = record.name.trim().replace(/\s+/g, " ");
    if (!collapsed || !record.slug.trim()) {
      return { ok: false, error: "tag value is empty" };
    }
    if (record.slug !== tagSlug(record.name)) {
      return { ok: false, error: "tag slug does not match its name" };
    }
    if (record.name !== tagDisplayName(record.name)) {
      return { ok: false, error: "tag name is not display-canonical" };
    }
    if (seen.has(record.slug)) continue;
    seen.add(record.slug);
    out.push({ name: record.name, slug: record.slug });
  }
  return { ok: true, tags: out };
}

function sameSlugSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const seen = new Set(left);
  return right.every((slug) => seen.has(slug));
}

function defaultId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tag-${Math.random().toString(36).slice(2, 12)}`;
}

function titleHistoryDetail(previous: string, next: string): string {
  return `Previous title:\n${previous}\nCurrent title:\n${next}`;
}

export function applyRiskEditLocal(
  state: MissionState,
  args: {
    projectId: string;
    riskId: string;
    title: string;
    notes: string | null | undefined;
    tagNames: string[];
    newTagId?: () => string;
    newItemTagId?: () => string;
  },
):
  | { ok: false; error: string }
  | { ok: true; changed: boolean; state: MissionState; result: RiskEditResult } {
  const project = (state.projects ?? []).find((row) => row.id === args.projectId);
  if (!project) return { ok: false, error: "project is not in this workspace" };
  const risk = (state.risks ?? []).find(
    (row) => row.id === args.riskId && row.projectId === args.projectId,
  );
  if (!risk) return { ok: false, error: "issue is not in this project" };

  const titleNext = canonicalRiskTitle(args.title);
  if (!titleNext) return { ok: false, error: "issue title is blank" };
  const titlePrev = canonicalRiskTitle(risk.title);
  const titleChanged = titlePrev !== titleNext;
  const notesPlan = planRiskNotesChange(risk.notes, args.notes);
  const planned = planItemTagSave({
    projectId: args.projectId,
    names: args.tagNames,
    projectTags: state.projectTags ?? [],
    newTagId: args.newTagId ?? defaultId,
  });
  const desiredSlugs = planned.map((op) =>
    op.kind === "reuse" ? op.tag.slug : op.draft.slug,
  );
  const currentTags = (state.itemTags ?? [])
    .filter(
      (row) =>
        row.projectId === args.projectId &&
        row.targetKind === "risk" &&
        row.targetId === risk.id,
    )
    .map((row) =>
      (state.projectTags ?? []).find(
        (tag) => tag.id === row.tagId && tag.projectId === args.projectId,
      ),
    )
    .filter((tag): tag is ProjectTag => Boolean(tag));
  const tagsChanged = !sameSlugSet(
    desiredSlugs,
    currentTags.map((tag) => tag.slug),
  );

  const notes = notesPlan.notes;
  if (!titleChanged && !notesPlan.changed && !tagsChanged) {
    return {
      ok: true,
      changed: false,
      state,
      result: resultFrom(risk, {
        changed: false,
        titleChanged: false,
        notesChanged: false,
        tagsChanged: false,
        title: risk.title,
        notes,
        updatedAt: risk.updatedAt,
        history: [],
        tags: currentTags.map(tagView),
        itemTags: itemViews(state.itemTags ?? [], args.projectId, risk.id),
      }),
    };
  }

  const updatedAt =
    titleChanged || notesPlan.changed
      ? new Date().toISOString()
      : risk.updatedAt;
  let next: MissionState = state;
  if (titleChanged || notesPlan.changed) {
    const risks = (state.risks ?? []).map((row) =>
      row.id === risk.id && row.projectId === args.projectId
        ? {
            ...row,
            title: titleChanged ? titleNext : row.title,
            notes: notesPlan.changed ? notes : row.notes,
            updatedAt,
          }
        : row,
    );
    next = { ...next, risks };
  }

  const history: RiskEditHistory[] = [];
  if (titleChanged) {
    const event = makeHistoryEvent({
      type: "other",
      title: "Issue title updated",
      detail: titleHistoryDetail(titlePrev, titleNext),
      projectId: args.projectId,
      source: "user",
      targetKind: RISK_HISTORY_TARGET_KIND,
      targetId: risk.id,
    });
    history.push(historyView(event));
    next = pushHistory(next, event);
  }
  if (notesPlan.changed) {
    const event = makeHistoryEvent({
      type: "other",
      title: notesPlan.title,
      detail: notesPlan.detail,
      projectId: args.projectId,
      source: "user",
      targetKind: RISK_HISTORY_TARGET_KIND,
      targetId: risk.id,
    });
    history.push(historyView(event));
    next = pushHistory(next, event);
  }

  let projectTags = state.projectTags ?? [];
  let itemTags = state.itemTags ?? [];
  if (tagsChanged) {
    projectTags = [...projectTags];
    itemTags = itemTags.filter(
      (row) =>
        !(
          row.projectId === args.projectId &&
          row.targetKind === "risk" &&
          row.targetId === risk.id
        ),
    );
    for (const op of planned) {
      const tag = op.kind === "reuse" ? op.tag : op.draft;
      if (
        op.kind === "create" &&
        !projectTags.some(
          (row) => row.projectId === args.projectId && row.slug === tag.slug,
        )
      ) {
        projectTags.push(tag);
      }
      itemTags.push(
        itemTagRow({
          id: (args.newItemTagId ?? defaultId)(),
          projectId: args.projectId,
          tagId: tag.id,
          targetKind: "risk",
          targetId: risk.id,
        }),
      );
    }
    next = { ...next, projectTags, itemTags };
  }

  const savedRisk =
    (next.risks ?? []).find(
      (row) => row.id === risk.id && row.projectId === args.projectId,
    ) ?? risk;
  const savedTags = (next.itemTags ?? [])
    .filter(
      (row) =>
        row.projectId === args.projectId &&
        row.targetKind === "risk" &&
        row.targetId === risk.id,
    )
    .map((row) =>
      (next.projectTags ?? []).find(
        (tag) => tag.id === row.tagId && tag.projectId === args.projectId,
      ),
    )
    .filter((tag): tag is ProjectTag => Boolean(tag));

  return {
    ok: true,
    changed: true,
    state: next,
    result: resultFrom(savedRisk, {
      changed: true,
      titleChanged,
      notesChanged: notesPlan.changed,
      tagsChanged,
      title: savedRisk.title,
      notes: savedRisk.notes ?? null,
      updatedAt: savedRisk.updatedAt,
      history,
      tags: savedTags.map(tagView),
      itemTags: itemViews(next.itemTags ?? [], args.projectId, risk.id),
    }),
  };
}

function resultFrom(
  _risk: ProjectRisk,
  fields: Omit<RiskEditResult, "ok">,
): RiskEditResult {
  return { ok: true, ...fields };
}

function tagView(tag: ProjectTag): RiskEditTag {
  return {
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    origin: tag.origin,
  };
}

function itemViews(
  rows: ItemTag[],
  projectId: string,
  riskId: string,
): Array<{ id: string; tagId: string }> {
  return rows
    .filter(
      (row) =>
        row.projectId === projectId &&
        row.targetKind === "risk" &&
        row.targetId === riskId,
    )
    .map((row) => ({ id: row.id, tagId: row.tagId }));
}

function historyView(event: HistoryEvent): RiskEditHistory {
  return {
    id: event.id,
    title: event.title,
    detail: event.detail ?? "",
    createdAt: event.createdAt,
  };
}
