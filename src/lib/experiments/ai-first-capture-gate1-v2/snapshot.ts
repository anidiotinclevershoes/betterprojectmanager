/**
 * Compact dump of CURRENT canonical rows for one open project.
 * No ranking, retrieval, summaries, history, Review, or receipts.
 */
import { getEncoding } from "js-tiktoken";
import type { CaptureApplyWorld } from "@/lib/capture/apply";
import type { SnapshotSizes } from "./types";

let encoder: ReturnType<typeof getEncoding> | null = null;

export function approxTokens(text: string): number {
  if (!text) return 0;
  try {
    if (!encoder) encoder = getEncoding("cl100k_base");
    return encoder.encode(text).length;
  } catch {
    return Math.ceil(text.length / 4);
  }
}

function field(name: string, value: unknown): string | null {
  if (value == null || value === "") return null;
  return `${name}=${JSON.stringify(value)}`;
}

function row(parts: Array<string | null>): string {
  return parts.filter((p): p is string => Boolean(p)).join(" ");
}

export function knownCanonicalIds(
  world: CaptureApplyWorld,
  projectId: string,
): Set<string> {
  const ids = new Set<string>([projectId]);
  const project = world.projects.find((p) => p.id === projectId);
  for (const person of project?.stakeholders ?? []) ids.add(person.id);
  for (const risk of world.risks) {
    if (risk.projectId === projectId) ids.add(risk.id);
  }
  for (const todo of world.todos) {
    if (todo.projectId === projectId) ids.add(todo.id);
  }
  for (const item of world.timeline) {
    if (item.projectId === projectId) ids.add(item.id);
  }
  for (const pack of world.knowledge) {
    if (pack.projectId !== projectId) continue;
    for (const item of pack.structured ?? []) {
      if (item.lifecycle && item.lifecycle !== "current") continue;
      ids.add(item.id);
    }
  }
  return ids;
}

export function serializeCurrentCanonicalTruth(
  world: CaptureApplyWorld,
  projectId: string,
): string {
  const project = world.projects.find((p) => p.id === projectId);
  const lines = [
    "CURRENT CANONICAL PROJECT TRUTH",
    "Current rows only. Not history. Not Review. Not ranked.",
    row([
      field("project.id", project?.id ?? projectId),
      field("name", project?.name ?? ""),
      field("code", project?.code ?? ""),
    ]),
    "",
    "PEOPLE",
  ];

  const people = project?.stakeholders ?? [];
  if (!people.length) lines.push("(none)");
  for (const person of people) {
    lines.push(row([field("id", person.id), field("name", person.name), field("role", person.role)]));
  }

  lines.push("", "ISSUES");
  const risks = world.risks.filter((r) => r.projectId === projectId);
  if (!risks.length) lines.push("(none)");
  for (const risk of risks) {
    lines.push(row([field("id", risk.id), field("title", risk.title), field("status", risk.status)]));
  }

  lines.push("", "TO_DO");
  const todos = world.todos.filter((t) => t.projectId === projectId);
  if (!todos.length) lines.push("(none)");
  for (const todo of todos) {
    lines.push(
      row([
        field("id", todo.id),
        field("title", todo.title),
        field("done", Boolean(todo.done)),
        field("dueAt", todo.dueAt),
        field("detail", todo.detail),
      ]),
    );
  }

  lines.push("", "KNOWLEDGE");
  const packs = world.knowledge.filter((k) => k.projectId === projectId);
  let knowledgeRows = 0;
  for (const pack of packs) {
    for (const item of pack.structured ?? []) {
      if (item.lifecycle && item.lifecycle !== "current") continue;
      knowledgeRows += 1;
      const resp = item.meta?.responsibility;
      lines.push(
        row([
          field("id", item.id),
          field("kind", item.kind),
          field("body", item.body),
          field("personId", resp?.personId ?? item.meta?.personId),
          field("personName", resp?.personName),
          field("scope", resp?.scope),
          field("ownerConfirmed", resp?.ownerConfirmed),
        ]),
      );
    }
  }
  if (!knowledgeRows) lines.push("(none)");

  lines.push("", "MILESTONES");
  const milestones = world.timeline.filter((t) => t.projectId === projectId);
  if (!milestones.length) lines.push("(none)");
  for (const item of milestones) {
    lines.push(
      row([
        field("id", item.id),
        field("label", item.label),
        field("startAt", item.startAt),
      ]),
    );
  }

  return lines.join("\n");
}

export function measureSnapshot(text: string): SnapshotSizes {
  return { characters: text.length, approxTokensCl100k: approxTokens(text) };
}
