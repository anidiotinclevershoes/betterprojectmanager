/**
 * Pure Ocean Knowledge frame row builders — used by UI and verify scripts.
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
  stripResolvedPrefix,
} from "@/lib/risks/lifecycle";
import type { MissionState } from "@/lib/types";

export const OCEAN_PRIMARY_FRAMES = [
  "Current position",
  "Risks & blockers",
  "To Do",
] as const;

export const OCEAN_SECONDARY_FRAMES = [
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

export function buildOpenRiskRows(
  state: MissionState,
  projectId: string,
): Array<{ id: string; title: string; priority: PriorityDot }> {
  const knowledge =
    state.knowledge.find((k) => k.projectId === projectId) ??
    emptyKnowledge(projectId);
  const rows: Array<{ id: string; title: string; priority: PriorityDot }> = [];
  const domainTitles = new Set<string>();

  for (const risk of state.risks ?? []) {
    if (risk.projectId !== projectId) continue;
    domainTitles.add(stripResolvedPrefix(risk.title).toLowerCase());
    if (isClosedRiskStatus(risk.status)) continue;
    if (!isOpenRiskStatus(risk.status)) continue;
    rows.push({
      id: risk.id,
      title: risk.title,
      priority: risk.status === "watch" ? "medium" : "high",
    });
  }

  for (const [index, title] of (knowledge.sections.risks ?? []).entries()) {
    if (isResolvedProse(title)) continue;
    const key = stripResolvedPrefix(title).toLowerCase();
    if (domainTitles.has(key)) continue;
    if (
      (state.risks ?? []).some(
        (r) =>
          r.projectId === projectId &&
          isClosedRiskStatus(r.status) &&
          stripResolvedPrefix(r.title).toLowerCase() === key,
      )
    ) {
      continue;
    }
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
