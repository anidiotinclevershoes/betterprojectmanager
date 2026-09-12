import type {
  CanonicalSlice,
  KnowledgeRow,
  MilestoneRow,
  PersonRow,
  ResponsibilityRow,
  RiskRow,
  SliceDelta,
  TodoRow,
} from "./types";

type MissionLike = {
  projects?: Array<{ id: string; name: string; code?: string; stakeholders?: Array<{ id: string; name: string }> }>;
  todos?: Array<{ id: string; projectId?: string | null; title: string; done?: boolean; dueAt?: string; kind?: string }>;
  risks?: Array<{ id: string; projectId: string; title: string; status: string }>;
  timeline?: Array<{ id: string; projectId: string; label: string; startAt: string; endAt?: string }>;
  knowledge?: Array<{
    projectId: string;
    sections?: Record<string, string[]>;
    sectionItemIds?: Record<string, Array<string | null>>;
    structured?: Array<{
      id?: string;
      kind?: string;
      body?: string;
      title?: string;
      personId?: string;
      meta?: { personId?: string; scope?: string; personName?: string };
    }>;
  }>;
};

function ymdOf(iso?: string): string | undefined {
  if (!iso) return undefined;
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1];
}

function personNameById(people: PersonRow[], id?: string): string | undefined {
  if (!id) return undefined;
  return people.find((p) => p.id === id)?.name;
}

export function projectSlice(
  state: MissionLike,
  projectId: string,
  meta?: { workspaceId?: string; userId?: string },
): CanonicalSlice {
  const projects = state.projects ?? [];
  const project = projects.find((p) => p.id === projectId);
  const people: PersonRow[] = (project?.stakeholders ?? []).map((s) => ({
    id: s.id,
    name: s.name,
  }));
  const todos: TodoRow[] = (state.todos ?? [])
    .filter((t) => t.projectId === projectId)
    .map((t) => ({
      id: t.id,
      title: t.title,
      done: Boolean(t.done),
      dueAt: ymdOf(t.dueAt),
      kind: t.kind,
    }));
  const risks: RiskRow[] = (state.risks ?? [])
    .filter((r) => r.projectId === projectId)
    .map((r) => ({ id: r.id, title: r.title, status: r.status }));
  const milestones: MilestoneRow[] = (state.timeline ?? [])
    .filter((m) => m.projectId === projectId)
    .map((m) => ({
      id: m.id,
      label: m.label,
      startAt: ymdOf(m.startAt) || m.startAt,
      endAt: ymdOf(m.endAt),
    }));
  const pack = (state.knowledge ?? []).find((k) => k.projectId === projectId);
  const knowledge: KnowledgeRow[] = [];
  const responsibilities: ResponsibilityRow[] = [];
  if (pack?.structured) {
    for (const row of pack.structured) {
      const body = (row.body || row.title || "").trim();
      if (row.kind === "responsibility") {
        responsibilities.push({
          id: row.id,
          personId: row.personId || row.meta?.personId,
          personName: row.meta?.personName || personNameById(people, row.personId || row.meta?.personId),
          scope: (row.meta?.scope || body).trim(),
        });
      } else if (body) {
        knowledge.push({ id: row.id, body, kind: row.kind });
      }
    }
  }
  if (pack?.sections) {
    for (const [section, lines] of Object.entries(pack.sections)) {
      const ids = pack.sectionItemIds?.[section] ?? [];
      lines.forEach((body, i) => {
        if (!body.trim()) return;
        if (knowledge.some((k) => k.body === body)) return;
        knowledge.push({ id: ids[i] ?? undefined, body, section });
      });
    }
  }
  return {
    capturedAt: new Date().toISOString(),
    workspaceId: meta?.workspaceId,
    userId: meta?.userId,
    projectId,
    projectName: project?.name || "",
    projectCode: project?.code || "",
    people,
    todos,
    risks,
    milestones,
    knowledge,
    responsibilities,
    otherProjectNames: projects.filter((p) => p.id !== projectId).map((p) => p.name),
  };
}

function byId<T extends { id?: string }>(rows: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    if (row.id) map.set(row.id, row);
  }
  return map;
}

function sameTodo(a: TodoRow, b: TodoRow): boolean {
  return a.title === b.title && a.done === b.done && a.dueAt === b.dueAt;
}
function sameRisk(a: RiskRow, b: RiskRow): boolean {
  return a.title === b.title && a.status === b.status;
}
function sameMilestone(a: MilestoneRow, b: MilestoneRow): boolean {
  return a.label === b.label && a.startAt === b.startAt && a.endAt === b.endAt;
}

export function diffSlices(before: CanonicalSlice, after: CanonicalSlice): SliceDelta {
  const peopleB = byId(before.people);
  const peopleA = byId(after.people);
  const todosB = byId(before.todos);
  const todosA = byId(after.todos);
  const risksB = byId(before.risks);
  const risksA = byId(after.risks);
  const msB = byId(before.milestones);
  const msA = byId(after.milestones);
  const knB = byId(before.knowledge.filter((k) => k.id));
  const knA = byId(after.knowledge.filter((k) => k.id));
  const rpB = byId(before.responsibilities.filter((r) => r.id));
  const rpA = byId(after.responsibilities.filter((r) => r.id));

  const createdPeople = after.people.filter((p) => !peopleB.has(p.id));
  const removedPeople = before.people.filter((p) => !peopleA.has(p.id));
  const createdTodos = after.todos.filter((t) => !todosB.has(t.id));
  const removedTodos = before.todos.filter((t) => !todosA.has(t.id));
  const createdRisks = after.risks.filter((r) => !risksB.has(r.id));
  const removedRisks = before.risks.filter((r) => !risksA.has(r.id));
  const createdMilestones = after.milestones.filter((m) => !msB.has(m.id));
  const removedMilestones = before.milestones.filter((m) => !msA.has(m.id));
  const createdKnowledge = after.knowledge.filter((k) => (k.id ? !knB.has(k.id) : !before.knowledge.some((b) => b.body === k.body)));
  const removedKnowledge = before.knowledge.filter((k) => (k.id ? !knA.has(k.id) : !after.knowledge.some((a) => a.body === k.body)));
  const createdResponsibilities = after.responsibilities.filter((r) =>
    r.id ? !rpB.has(r.id) : !before.responsibilities.some((b) => b.scope === r.scope && b.personName === r.personName),
  );
  const removedResponsibilities = before.responsibilities.filter((r) =>
    r.id ? !rpA.has(r.id) : !after.responsibilities.some((a) => a.scope === r.scope && a.personName === r.personName),
  );

  const updatedTodos: SliceDelta["updatedTodos"] = [];
  for (const [id, afterRow] of todosA) {
    const beforeRow = todosB.get(id);
    if (beforeRow && !sameTodo(beforeRow, afterRow)) updatedTodos.push({ before: beforeRow, after: afterRow });
  }
  const updatedRisks: SliceDelta["updatedRisks"] = [];
  for (const [id, afterRow] of risksA) {
    const beforeRow = risksB.get(id);
    if (beforeRow && !sameRisk(beforeRow, afterRow)) updatedRisks.push({ before: beforeRow, after: afterRow });
  }
  const updatedMilestones: SliceDelta["updatedMilestones"] = [];
  for (const [id, afterRow] of msA) {
    const beforeRow = msB.get(id);
    if (beforeRow && !sameMilestone(beforeRow, afterRow)) {
      updatedMilestones.push({ before: beforeRow, after: afterRow });
    }
  }

  const nameCounts = new Map<string, number>();
  for (const p of after.people) {
    const key = p.name.trim().toLowerCase();
    nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
  }
  const duplicatePeople = [...nameCounts.entries()].filter(([, n]) => n > 1).map(([name]) => name);

  const idReplacements: string[] = [];
  for (const created of createdTodos) {
    const vanished = removedTodos.find((r) => r.title === created.title);
    if (vanished) idReplacements.push(`todo:${vanished.id}→${created.id} (${created.title})`);
  }
  for (const created of createdMilestones) {
    const vanished = removedMilestones.find((r) => r.label === created.label);
    if (vanished) idReplacements.push(`milestone:${vanished.id}→${created.id} (${created.label})`);
  }
  for (const created of createdPeople) {
    const vanished = removedPeople.find((r) => r.name === created.name);
    if (vanished) idReplacements.push(`person:${vanished.id}→${created.id} (${created.name})`);
  }

  return {
    createdPeople,
    createdTodos,
    createdRisks,
    createdMilestones,
    createdKnowledge,
    createdResponsibilities,
    updatedTodos,
    updatedRisks,
    updatedMilestones,
    removedPeople,
    removedTodos,
    removedRisks,
    removedMilestones,
    removedKnowledge,
    removedResponsibilities,
    idReplacements,
    duplicatePeople,
  };
}

export function compactDelta(delta: SliceDelta): Record<string, string[]> {
  return {
    createdPeople: delta.createdPeople.map((p) => p.name),
    createdTodos: delta.createdTodos.map((t) => t.title),
    createdRisks: delta.createdRisks.map((r) => r.title),
    createdMilestones: delta.createdMilestones.map((m) => `${m.label} ${m.startAt}`),
    createdKnowledge: delta.createdKnowledge.map((k) => k.body.slice(0, 80)),
    createdResponsibilities: delta.createdResponsibilities.map((r) => `${r.personName || "?"} → ${r.scope}`),
    updatedTodos: delta.updatedTodos.map((u) => `${u.before.title} done:${u.before.done}→${u.after.done} due:${u.before.dueAt || "—"}→${u.after.dueAt || "—"}`),
    updatedRisks: delta.updatedRisks.map((u) => `${u.before.title} ${u.before.status}→${u.after.status}`),
    updatedMilestones: delta.updatedMilestones.map((u) => `${u.before.label} ${u.before.startAt}→${u.after.startAt}`),
    removedPeople: delta.removedPeople.map((p) => p.name),
    removedTodos: delta.removedTodos.map((t) => t.title),
    removedRisks: delta.removedRisks.map((r) => r.title),
    removedMilestones: delta.removedMilestones.map((m) => m.label),
    removedKnowledge: delta.removedKnowledge.map((k) => k.body.slice(0, 80)),
    removedResponsibilities: delta.removedResponsibilities.map((r) => r.scope),
    idReplacements: delta.idReplacements,
    duplicatePeople: delta.duplicatePeople,
  };
}

export function mentions(haystack: string, needle: string): boolean {
  const h = haystack.toLowerCase();
  return needle
    .toLowerCase()
    .split(/[|]/)
    .some((part) => part.trim() && h.includes(part.trim()));
}
