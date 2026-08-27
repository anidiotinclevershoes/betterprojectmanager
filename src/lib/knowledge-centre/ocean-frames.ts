/**
 * Pure Ocean Knowledge frame row builders — used by UI and verify scripts.
 *
 * D-030 display precedence (presentation only — no mutate, no fuzzy match):
 *
 * 1. Risks & blockers: if the project has any domain `risks` rows (open, watch,
 *    resolved, or accepted), that table is the sole current-truth source.
 *    Knowledge `sections.risks` prose is not painted as peer open-risk cards.
 *    Knowledge-only risk bullets appear only when the project has zero domain
 *    risk rows (legacy projects that never dual-wrote Risks).
 * 2. Important dates: domain `timeline` / milestones only.
 * 3. Current position: structured `lifecycle=current` facts (`section=now` or
 *    `kind=fact`) excluding `kind=date` and `kind=risk`. Fallback `sections.now`
 *    lines are skipped when their `sectionItemIds` match a domain risk id,
 *    timeline id, or a structured item that is non-current / date / risk.
 *    Unlinked leftover sentences are preserved — no title/semantic matching.
 */
import { emptyKnowledge } from "@/lib/knowledge";
import {
  formatAwayRange,
  formatDueLabel,
  formatMilestoneLabel,
  type PriorityDot,
} from "@/lib/knowledge-centre/format-date-label";
import { getPersonBundle } from "@/lib/people/identity";
import {
  isClosedRiskStatus,
  isOpenRiskStatus,
  isResolvedProse,
} from "@/lib/risks/lifecycle";
import type { CanonicalTruthItem } from "@/lib/canonical-truth/types";
import type { MissionState } from "@/lib/types";

/** v8 operational row — To Do + Risks, not Current position. */
export const OCEAN_PRIMARY_FRAMES = ["To Do", "Risks & blockers"] as const;

export const OCEAN_SECONDARY_FRAMES = [
  "Current position",
  "People & context",
  "Dependencies",
  "Decisions",
  "Important dates",
  "Waiting & open loops",
  "Meeting Prep",
  "Timeline",
] as const;

export const OCEAN_SIDEBAR_FORBIDDEN = [
  "Lume Overview",
  "Overview",
  "Knowledge Centre",
  "Coaching",
  "Advise",
  "Capture",
] as const;

export type OceanCurrentPositionRow = {
  id: string;
  title: string;
  meta: string | null;
  epistemic: string | null;
  priority: PriorityDot;
  itemId: string | null;
  body: string;
};

function domainRisksForProject(state: MissionState, projectId: string) {
  return (state.risks ?? []).filter((r) => r.projectId === projectId);
}

function domainOwnedIds(state: MissionState, projectId: string): Set<string> {
  const ids = new Set<string>();
  for (const risk of domainRisksForProject(state, projectId)) {
    ids.add(risk.id);
  }
  for (const item of state.timeline ?? []) {
    if (item.projectId === projectId) ids.add(item.id);
  }
  return ids;
}

function structuredById(
  structured: CanonicalTruthItem[] | undefined,
): Map<string, CanonicalTruthItem> {
  const map = new Map<string, CanonicalTruthItem>();
  for (const item of structured ?? []) {
    map.set(item.id, item);
  }
  return map;
}

function isDomainKind(kind: CanonicalTruthItem["kind"] | undefined): boolean {
  return kind === "date" || kind === "risk";
}

function isCurrentLifecycle(item: CanonicalTruthItem): boolean {
  return !item.lifecycle || item.lifecycle === "current";
}

/**
 * Open-risk cards for the Risks & blockers frame.
 * Domain `risks` wins whenever the project has risk rows.
 */
export function buildOpenRiskRows(
  state: MissionState,
  projectId: string,
): Array<{ id: string; title: string; priority: PriorityDot }> {
  const knowledge =
    state.knowledge.find((k) => k.projectId === projectId) ??
    emptyKnowledge(projectId);
  const domain = domainRisksForProject(state, projectId);
  const rows: Array<{ id: string; title: string; priority: PriorityDot }> = [];

  for (const risk of domain) {
    if (isClosedRiskStatus(risk.status)) continue;
    if (!isOpenRiskStatus(risk.status)) continue;
    rows.push({
      id: risk.id,
      title: risk.title,
      priority: risk.status === "watch" ? "medium" : "high",
    });
  }

  // D-030: leftover Knowledge risk prose is not peer current truth when the
  // domain risk model exists for this project — including all-resolved.
  if (domain.length > 0) {
    return rows;
  }

  for (const [index, title] of (knowledge.sections.risks ?? []).entries()) {
    if (isResolvedProse(title)) continue;
    rows.push({ id: `kr-${index}`, title, priority: "none" });
  }
  return rows;
}

export function buildTodoRows(state: MissionState, projectId: string) {
  return (state.todos ?? [])
    .filter((t) => t.projectId === projectId && !t.done)
    .filter((t) => t.kind !== "WAITING" && t.kind !== "CHASE" && !t.waitingOn)
    .map((t) => ({
      id: t.id,
      title: t.title,
      meta: formatDueLabel(t.dueAt),
    }));
}

export function buildCurrentPositionRows(
  state: MissionState,
  projectId: string,
): OceanCurrentPositionRow[] {
  const knowledge =
    state.knowledge.find((k) => k.projectId === projectId) ??
    emptyKnowledge(projectId);
  const owned = domainOwnedIds(state, projectId);
  const byId = structuredById(knowledge.structured);

  const structuredFacts = (knowledge.structured ?? []).filter((item) => {
    if (!isCurrentLifecycle(item)) return false;
    if (isDomainKind(item.kind)) return false;
    if (item.kind !== "fact" && item.section !== "now") return false;
    if (owned.has(item.id)) return false;
    return true;
  });

  if (structuredFacts.length) {
    return structuredFacts.map((item) => ({
      id: item.id,
      title: item.body,
      meta: null,
      epistemic: item.epistemic ?? null,
      priority: "none" as PriorityDot,
      itemId: item.id,
      body: item.body,
    }));
  }

  const ids = knowledge.sectionItemIds?.now;
  const rows: OceanCurrentPositionRow[] = [];
  for (const [idx, body] of (knowledge.sections.now ?? []).entries()) {
    const itemId =
      Array.isArray(ids) && typeof ids[idx] === "string" ? ids[idx] : null;
    if (itemId && owned.has(itemId)) continue;
    const overlay = itemId ? byId.get(itemId) : undefined;
    if (overlay) {
      if (!isCurrentLifecycle(overlay)) continue;
      if (isDomainKind(overlay.kind)) continue;
    }
    rows.push({
      id: itemId ?? `now-body:${body}`,
      title: body,
      meta: null,
      epistemic: null,
      priority: "none",
      itemId,
      body,
    });
  }
  return rows;
}

export function buildPeopleRows(state: MissionState, projectId: string) {
  const project = state.projects.find((p) => p.id === projectId);
  const knowledge =
    state.knowledge.find((k) => k.projectId === projectId) ??
    emptyKnowledge(projectId);
  const cards: Array<{
    id: string;
    title: string;
    epistemic: string | null;
    meta: string | null;
    personId: string | null;
  }> = [];

  for (const person of project?.stakeholders ?? []) {
    const bundle = getPersonBundle(state, projectId, person.id);
    if (!bundle) continue;

    const away = bundle.availability[0];
    const awayMeta = away
      ? formatAwayRange(
          (
            away.item.meta as {
              availability?: { awayFromIso?: string; awayToIso?: string };
            } | null
          )?.availability?.awayFromIso,
          (
            away.item.meta as {
              availability?: { awayFromIso?: string; awayToIso?: string };
            } | null
          )?.availability?.awayToIso,
        ) ?? away.body
      : null;

    const waitingCount = (state.todos ?? []).filter(
      (t) =>
        t.projectId === projectId &&
        !t.done &&
        t.waitingOn?.trim().toLowerCase() === person.name.trim().toLowerCase(),
    ).length;
    const waitingMeta =
      waitingCount > 0
        ? waitingCount === 1
          ? "1 waiting item"
          : `${waitingCount} waiting items`
        : null;

    const metaParts = [awayMeta, waitingMeta].filter(Boolean);
    const meta = metaParts.length ? metaParts.join(" · ") : null;

    if (bundle.currentResponsibilities.length) {
      for (const resp of bundle.currentResponsibilities) {
        const shared = bundle.sharedScopes.find((s) => s.scope === resp.scope);
        cards.push({
          id: `${person.id}-${resp.scope}`,
          title: `@${person.name} · ${resp.scope}`,
          epistemic: shared ? "Shared" : null,
          meta,
          personId: person.id,
        });
      }
    } else {
      cards.push({
        id: person.id,
        title: `@${person.name}${person.role ? ` · ${person.role}` : ""}`,
        epistemic: null,
        meta,
        personId: person.id,
      });
    }
  }

  for (const item of knowledge.structured ?? []) {
    if (item.kind !== "responsibility" || item.lifecycle !== "current") continue;
    const resp = item.meta?.responsibility;
    if (!resp || resp.ownerConfirmed) continue;
    cards.push({
      id: item.id,
      title: `${resp.scope} · Owner not confirmed`,
      epistemic: "Unconfirmed",
      meta: null,
      personId: resp.personId ?? null,
    });
  }

  return cards;
}

export function buildDateRows(state: MissionState, projectId: string) {
  return (state.timeline ?? [])
    .filter((t) => t.projectId === projectId)
    .map((t) => ({
      id: t.id,
      title: formatMilestoneLabel(t.label, t.startAt) ?? t.label,
    }));
}
