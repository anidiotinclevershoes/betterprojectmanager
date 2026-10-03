/**
 * Experiment-only context. One shape for Capture and New Project.
 * Targetable ids and context-only ids are different sets.
 * Responsibility row ids are context-only: confirm_responsibility
 * targets a person and a scope, not the knowledge row id.
 */
import type { CaptureApplyWorld } from "@/lib/capture/apply";
import { namesMatchExact } from "@/lib/people/identity";

export const SHARED_ORGANISE_REFERENCE_DATE = "2026-10-03";

export type TargetableDomain = "person" | "todo" | "risk" | "milestone";

export type TargetableRecord = {
  id: string;
  domain: TargetableDomain;
  title: string;
  projectId: string;
  done?: boolean;
  dueAt?: string;
  status?: string;
  date?: string;
  role?: string;
};

export type ContextResponsibility = {
  id: string;
  personId: string | null;
  personName: string;
  scope: string;
  ownerConfirmed: boolean;
};

export type SharedOrganiseContext = {
  projectId: string;
  projectName: string;
  referenceDate: string;
  prompt: string;
  targetable: Map<string, TargetableRecord>;
  contextOnlyIds: Set<string>;
  people: Array<{ id: string; name: string; role: string }>;
  responsibilities: ContextResponsibility[];
  otherProjectNames: Set<string>;
  otherProjectRiskTitles: Set<string>;
  otherProjectTodoTitles: Set<string>;
  otherProjectMilestoneTitles: Set<string>;
  otherProjectPersonNames: Set<string>;
};

function norm(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function buildSharedOrganiseContext(args: {
  world: CaptureApplyWorld;
  projectId: string;
  referenceDate?: string;
}): SharedOrganiseContext {
  const project = args.world.projects.find((row) => row.id === args.projectId);
  const referenceDate = args.referenceDate ?? SHARED_ORGANISE_REFERENCE_DATE;
  const people = (project?.stakeholders ?? []).map((person) => ({
    id: person.id,
    name: person.name,
    role: person.role ?? "",
  }));
  const targetable = new Map<string, TargetableRecord>();
  for (const person of people) {
    targetable.set(person.id, {
      id: person.id,
      domain: "person",
      title: person.name,
      projectId: args.projectId,
      role: person.role,
    });
  }
  const todos = args.world.todos.filter((todo) => todo.projectId === args.projectId);
  for (const todo of todos) {
    targetable.set(todo.id, {
      id: todo.id,
      domain: "todo",
      title: todo.title,
      projectId: args.projectId,
      done: Boolean(todo.done),
      dueAt: todo.dueAt,
    });
  }
  const risks = args.world.risks.filter((risk) => risk.projectId === args.projectId);
  for (const risk of risks) {
    targetable.set(risk.id, {
      id: risk.id,
      domain: "risk",
      title: risk.title,
      projectId: args.projectId,
      status: risk.status,
    });
  }
  const milestones = args.world.timeline.filter((item) => item.projectId === args.projectId);
  for (const item of milestones) {
    targetable.set(item.id, {
      id: item.id,
      domain: "milestone",
      title: item.label,
      projectId: args.projectId,
      date: (item.startAt ?? "").slice(0, 10),
    });
  }

  const responsibilities: ContextResponsibility[] = [];
  const contextOnlyIds = new Set<string>();
  const knowledge = args.world.knowledge.find((row) => row.projectId === args.projectId);
  const knowledgeLines: string[] = [];
  for (const row of knowledge?.structured ?? []) {
    if (row.lifecycle !== "current") continue;
    if (row.kind === "responsibility" && row.meta?.responsibility?.scope) {
      const resp = row.meta.responsibility;
      const person =
        people.find((item) => item.id === resp.personId) ??
        people.find((item) => resp.personName && namesMatchExact(item.name, resp.personName));
      responsibilities.push({
        id: row.id,
        personId: person?.id ?? resp.personId ?? null,
        personName: person?.name ?? resp.personName ?? "",
        scope: resp.scope,
        ownerConfirmed: Boolean(resp.ownerConfirmed),
      });
      contextOnlyIds.add(row.id);
      continue;
    }
    contextOnlyIds.add(row.id);
    knowledgeLines.push(
      `- contextOnlyId=${row.id} kind=${JSON.stringify(row.kind)} body=${JSON.stringify(row.body)}`,
    );
  }

  const otherProjectPersonNames = new Set<string>();
  const otherProjectRiskTitles = new Set<string>();
  const otherProjectTodoTitles = new Set<string>();
  const otherProjectMilestoneTitles = new Set<string>();
  const otherProjectNames = new Set<string>();
  for (const sibling of args.world.projects) {
    if (sibling.id === args.projectId) continue;
    otherProjectNames.add(norm(sibling.name));
    if (sibling.code) otherProjectNames.add(norm(sibling.code));
    for (const person of sibling.stakeholders) otherProjectPersonNames.add(norm(person.name));
  }
  for (const risk of args.world.risks) {
    if (risk.projectId !== args.projectId) otherProjectRiskTitles.add(norm(risk.title));
  }
  for (const todo of args.world.todos) {
    if (todo.projectId && todo.projectId !== args.projectId) {
      otherProjectTodoTitles.add(norm(todo.title));
    }
  }
  for (const item of args.world.timeline) {
    if (item.projectId !== args.projectId) otherProjectMilestoneTitles.add(norm(item.label));
  }

  const lines = [
    `Current project: ${project?.name ?? "(new project)"} (${project?.code ?? args.projectId}) id=${args.projectId}`,
    `Reference date: ${referenceDate}`,
    "Targetable records. targetId may be ONLY one of these ids. Never invent an id.",
    "People:",
  ];
  if (!people.length) lines.push("(none)");
  for (const person of people) {
    lines.push(
      `- id=${person.id} name=${JSON.stringify(person.name)} role=${JSON.stringify(person.role)}`,
    );
  }
  lines.push("To dos:");
  if (!todos.length) lines.push("(none)");
  for (const todo of todos) {
    lines.push(
      `- id=${todo.id} title=${JSON.stringify(todo.title)} done=${String(Boolean(todo.done))} due=${JSON.stringify(todo.dueAt ?? "")}`,
    );
  }
  lines.push("Risks:");
  if (!risks.length) lines.push("(none)");
  for (const risk of risks) {
    lines.push(
      `- id=${risk.id} title=${JSON.stringify(risk.title)} status=${JSON.stringify(risk.status)}`,
    );
  }
  lines.push("Milestones:");
  if (!milestones.length) lines.push("(none)");
  for (const item of milestones) {
    lines.push(
      `- id=${item.id} title=${JSON.stringify(item.label)} date=${JSON.stringify((item.startAt ?? "").slice(0, 10))}`,
    );
  }
  lines.push(
    "Context only. These describe current truth. NEVER return contextOnlyId as targetId.",
  );
  lines.push("Current responsibilities:");
  if (!responsibilities.length) lines.push("(none)");
  for (const row of responsibilities) {
    lines.push(
      `- contextOnlyId=${row.id} personId=${row.personId ?? ""} personName=${JSON.stringify(row.personName)} scope=${JSON.stringify(row.scope)} ownerConfirmed=${String(row.ownerConfirmed)}`,
    );
  }
  lines.push("Knowledge and decisions:");
  if (!knowledgeLines.length) lines.push("(none)");
  lines.push(...knowledgeLines);

  return {
    projectId: args.projectId,
    projectName: project?.name ?? "New project",
    referenceDate,
    prompt: lines.join("\n"),
    targetable,
    contextOnlyIds,
    people,
    responsibilities,
    otherProjectNames,
    otherProjectRiskTitles,
    otherProjectTodoTitles,
    otherProjectMilestoneTitles,
    otherProjectPersonNames,
  };
}
