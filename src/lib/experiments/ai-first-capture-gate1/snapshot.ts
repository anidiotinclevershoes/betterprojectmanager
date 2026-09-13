/**
 * Dumb mechanical dump of current canonical project truth.
 *
 * Does not interpret Capture text, rank, retrieve, summarise, or call AI.
 * Dumps every in-scope canonical row. Not a truth store.
 */
import { getEncoding } from "js-tiktoken";
import type { CaptureApplyWorld } from "@/lib/capture/apply";
import type { SnapshotSizes } from "./types";

let encoder: ReturnType<typeof getEncoding> | null = null;

function approxTokens(text: string): number {
  if (!text) return 0;
  try {
    if (!encoder) encoder = getEncoding("cl100k_base");
    return encoder.encode(text).length;
  } catch {
    return Math.ceil(text.length / 4);
  }
}

function inScope(projectId: string | null | undefined, scoped: string): boolean {
  return Boolean(projectId) && projectId === scoped;
}

function line(label: string, value: unknown): string {
  if (value == null || value === "") return `${label}=`;
  return `${label}=${typeof value === "string" ? JSON.stringify(value) : JSON.stringify(value)}`;
}

/**
 * Serialize current canonical rows for one open project.
 * Includes People, Issues (risks), To Do, Knowledge, and dated milestones
 * because several selected cases assert date moves against existing milestones.
 */
export function serializeCanonicalSnapshot(
  world: CaptureApplyWorld,
  projectId: string,
): string {
  const project = world.projects.find((p) => p.id === projectId);
  const lines: string[] = [
    "CANONICAL PROJECT TRUTH SNAPSHOT",
    "Mechanical dump of current stored rows. Not a summary. Not ranked.",
    line("project.id", project?.id ?? projectId),
    line("project.name", project?.name ?? ""),
    line("project.code", project?.code ?? ""),
    "",
    "PEOPLE",
  ];

  const people = (project?.stakeholders ?? []).filter((p) => p.id);
  if (!people.length) lines.push("(none)");
  for (const person of people) {
    lines.push(
      [
        line("id", person.id),
        line("name", person.name),
        line("role", person.role ?? ""),
      ].join(" "),
    );
  }

  lines.push("", "ISSUES");
  const risks = world.risks.filter((r) => inScope(r.projectId, projectId));
  if (!risks.length) lines.push("(none)");
  for (const risk of risks) {
    lines.push(
      [
        line("id", risk.id),
        line("title", risk.title),
        line("status", risk.status),
      ].join(" "),
    );
  }

  lines.push("", "TO_DO");
  const todos = world.todos.filter((t) => inScope(t.projectId ?? null, projectId));
  if (!todos.length) lines.push("(none)");
  for (const todo of todos) {
    lines.push(
      [
        line("id", todo.id),
        line("title", todo.title),
        line("done", Boolean(todo.done)),
        line("dueAt", todo.dueAt ?? ""),
        line("detail", todo.detail ?? ""),
      ].join(" "),
    );
  }

  lines.push("", "KNOWLEDGE");
  const knowledge = world.knowledge.filter((k) => inScope(k.projectId, projectId));
  if (!knowledge.length) lines.push("(none)");
  for (const pack of knowledge) {
    const peopleBullets = pack.sections.people ?? [];
    const riskBullets = pack.sections.risks ?? [];
    if (peopleBullets.length) {
      lines.push("legacy_people_bullets:");
      for (const bullet of peopleBullets) lines.push(`- ${bullet}`);
    }
    if (riskBullets.length) {
      lines.push("legacy_risk_bullets:");
      for (const bullet of riskBullets) lines.push(`- ${bullet}`);
    }
    const structured = pack.structured ?? [];
    if (!structured.length && !peopleBullets.length && !riskBullets.length) {
      lines.push("(none)");
    }
    for (const item of structured) {
      const resp = item.meta?.responsibility;
      const avail = item.meta?.availability;
      lines.push(
        [
          line("id", item.id),
          line("kind", item.kind),
          line("lifecycle", item.lifecycle),
          line("body", item.body),
          line("personId", item.meta?.personId ?? resp?.personId ?? ""),
          line("responsibility.personId", resp?.personId ?? ""),
          line("responsibility.personName", resp?.personName ?? ""),
          line("responsibility.scope", resp?.scope ?? ""),
          line("responsibility.ownerConfirmed", resp?.ownerConfirmed ?? ""),
          line("availability.personId", avail?.personId ?? ""),
          line("availability.personName", avail?.personName ?? ""),
          line("availability.awayFromIso", avail?.awayFromIso ?? ""),
          line("availability.awayToIso", avail?.awayToIso ?? ""),
        ].join(" "),
      );
    }
  }

  lines.push("", "MILESTONES");
  const milestones = world.timeline.filter((t) => inScope(t.projectId, projectId));
  if (!milestones.length) lines.push("(none)");
  for (const item of milestones) {
    lines.push(
      [
        line("id", item.id),
        line("label", item.label),
        line("startAt", item.startAt ?? ""),
        line("endAt", item.endAt ?? ""),
        line("notes", item.notes ?? ""),
      ].join(" "),
    );
  }

  return lines.join("\n");
}

export function measureSnapshot(text: string): SnapshotSizes {
  return {
    characters: text.length,
    approxTokensCl100k: approxTokens(text),
  };
}
