/**
 * Expected-world reducer + actual-vs-expected semantic compare.
 */
import type { MissionState } from "../../src/lib/types";
import type {
  CaptureSpec,
  ExpectedWorld,
  FixtureKey,
  IdentityMap,
  TruthDiff,
} from "./types";

export function emptyExpectedWorld(): ExpectedWorld {
  return {
    people: new Map(),
    todos: new Map(),
    risks: new Map(),
    milestones: new Map(),
    knowledge: new Map(),
    responsibilities: new Map(),
    availability: new Map(),
  };
}

export function applyExpectedWrites(world: ExpectedWorld, spec: CaptureSpec): ExpectedWorld {
  const next: ExpectedWorld = {
    people: new Map(world.people),
    todos: new Map(world.todos),
    risks: new Map(world.risks),
    milestones: new Map(world.milestones),
    knowledge: new Map(world.knowledge),
    responsibilities: new Map(world.responsibilities),
    availability: new Map(world.availability),
  };

  for (const write of spec.expectedWrites ?? []) {
    if (write.domain === "person") {
      if (write.op === "leave") {
        const prev = next.people.get(write.key);
        if (prev) next.people.set(write.key, { ...prev, present: false });
      } else {
        next.people.set(write.key, {
          name: write.title,
          role: typeof write.values?.role === "string" ? write.values.role : next.people.get(write.key)?.role,
          present: true,
        });
      }
    } else if (write.domain === "todo") {
      const prev = next.todos.get(write.key);
      next.todos.set(write.key, {
        title: write.title || prev?.title || write.key,
        done: write.op === "complete" ? true : (prev?.done ?? false),
        dueAt:
          typeof write.values?.date === "string"
            ? write.values.date
            : typeof write.values?.dueAt === "string"
              ? write.values.dueAt
              : prev?.dueAt,
      });
    } else if (write.domain === "risk") {
      const prev = next.risks.get(write.key);
      const status =
        write.op === "resolve"
          ? "resolved"
          : write.values?.status === "watch" ||
              write.values?.status === "open" ||
              write.values?.status === "accepted"
            ? write.values.status
            : (prev?.status ?? "open");
      next.risks.set(write.key, {
        title: write.title || prev?.title || write.key,
        status,
      });
    } else if (write.domain === "milestone") {
      const prev = next.milestones.get(write.key);
      const date =
        (typeof write.values?.date === "string" && write.values.date) ||
        (typeof write.values?.startAt === "string" && write.values.startAt) ||
        prev?.date ||
        "";
      next.milestones.set(write.key, {
        label: write.title || prev?.label || write.key,
        date,
      });
    } else if (write.domain === "knowledge" || write.domain === "decision") {
      next.knowledge.set(write.key, {
        text: write.title,
        current: write.op !== "resolve",
      });
    } else if (write.domain === "responsibility" && write.scope) {
      next.responsibilities.set(write.scope, write.key);
    } else if (write.domain === "availability") {
      const label =
        typeof write.values?.label === "string"
          ? write.values.label
          : write.title;
      next.availability.set(write.key, write.op === "resolve" ? null : label);
    }
  }

  return next;
}

export function snapshotExpected(world: ExpectedWorld) {
  const people = [...world.people.entries()].filter(([, p]) => p.present);
  const openTodos = [...world.todos.entries()].filter(([, t]) => !t.done);
  const doneTodos = [...world.todos.entries()].filter(([, t]) => t.done);
  const openRisks = [...world.risks.entries()].filter(([, r]) => r.status === "open" || r.status === "watch");
  const resolvedRisks = [...world.risks.entries()].filter(([, r]) => r.status === "resolved" || r.status === "accepted");
  return {
    peopleCount: people.length,
    people: people.map(([k, p]) => ({ key: k, name: p.name, role: p.role })),
    openTodoCount: openTodos.length,
    completedTodoCount: doneTodos.length,
    openTodos: openTodos.map(([k, t]) => ({ key: k, title: t.title, dueAt: t.dueAt })),
    completedTodos: doneTodos.map(([k, t]) => ({ key: k, title: t.title })),
    openRiskCount: openRisks.length,
    resolvedRiskCount: resolvedRisks.length,
    openRisks: openRisks.map(([k, r]) => ({ key: k, title: r.title, status: r.status })),
    resolvedRisks: resolvedRisks.map(([k, r]) => ({ key: k, title: r.title, status: r.status })),
    milestones: [...world.milestones.entries()].map(([k, m]) => ({
      key: k,
      label: m.label,
      date: m.date,
    })),
    knowledgeCurrent: [...world.knowledge.entries()]
      .filter(([, x]) => x.current)
      .map(([k, x]) => ({ key: k, text: x.text })),
    responsibilities: [...world.responsibilities.entries()].map(([scope, person]) => ({
      scope,
      person,
    })),
    availability: [...world.availability.entries()]
      .filter(([, v]) => v)
      .map(([k, v]) => ({ person: k, label: v })),
  };
}

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function compareTruth(args: {
  world: ExpectedWorld;
  state: MissionState;
  projectId: string;
  identity: IdentityMap;
  neighbourProjectId: string;
}): TruthDiff[] {
  const diffs: TruthDiff[] = [];
  const project = args.state.projects.find((p) => p.id === args.projectId);
  const neighbour = args.state.projects.find((p) => p.id === args.neighbourProjectId);

  const push = (path: string, expected: string, actual: string) => {
    if (norm(expected) !== norm(actual)) diffs.push({ path, expected, actual });
  };

  for (const [key, person] of args.world.people) {
    const id = args.identity.get(key);
    const row = project?.stakeholders.find((s) => s.id === id) ??
      project?.stakeholders.find((s) => norm(s.name) === norm(person.name));
    if (person.present && !row) {
      diffs.push({ path: `people.${key}`, expected: person.name, actual: "(missing)" });
    }
    if (!person.present && row) {
      diffs.push({
        path: `people.${key}.present`,
        expected: "left",
        actual: row.name,
      });
    }
  }

  for (const [key, todo] of args.world.todos) {
    const id = args.identity.get(key);
    const row =
      (args.state.todos ?? []).find((t) => t.id === id) ??
      (args.state.todos ?? []).find(
        (t) => t.projectId === args.projectId && norm(t.title) === norm(todo.title),
      );
    if (!row) {
      diffs.push({ path: `todos.${key}`, expected: todo.title, actual: "(missing)" });
      continue;
    }
    push(`todos.${key}.title`, todo.title, row.title);
    push(`todos.${key}.done`, String(todo.done), String(Boolean(row.done)));
  }

  for (const [key, risk] of args.world.risks) {
    const id = args.identity.get(key);
    const row =
      (args.state.risks ?? []).find((r) => r.id === id) ??
      (args.state.risks ?? []).find(
        (r) => r.projectId === args.projectId && norm(r.title) === norm(risk.title),
      );
    if (!row) {
      diffs.push({ path: `risks.${key}`, expected: risk.title, actual: "(missing)" });
      continue;
    }
    push(`risks.${key}.status`, risk.status, row.status);
  }

  for (const [key, ms] of args.world.milestones) {
    const id = args.identity.get(key);
    const row =
      (args.state.timeline ?? []).find((t) => t.id === id) ??
      (args.state.timeline ?? []).find(
        (t) => t.projectId === args.projectId && norm(t.label) === norm(ms.label),
      );
    if (!row) {
      diffs.push({ path: `milestones.${key}`, expected: ms.label, actual: "(missing)" });
      continue;
    }
    const actualDate = (row.startAt ?? "").slice(0, 10);
    if (ms.date) push(`milestones.${key}.date`, ms.date.slice(0, 10), actualDate);
  }

  const atlasTodo = (args.state.todos ?? []).find(
    (t) => t.projectId === args.neighbourProjectId && /billing ledger/i.test(t.title),
  );
  if (atlasTodo?.done) {
    diffs.push({
      path: "isolation.atlas-todo",
      expected: "untouched",
      actual: "completed",
    });
  }
  const atlasPeople = neighbour?.stakeholders.length ?? 0;
  if (atlasPeople !== 1) {
    diffs.push({
      path: "isolation.atlas-people",
      expected: "1",
      actual: String(atlasPeople),
    });
  }

  return diffs;
}

export function duplicateCounts(state: MissionState, projectId: string) {
  const titles = (list: string[]) => {
    const counts = new Map<string, number>();
    for (const t of list) {
      const k = norm(t);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return [...counts.entries()].filter(([, n]) => n > 1);
  };
  const project = state.projects.find((p) => p.id === projectId);
  return {
    people: titles((project?.stakeholders ?? []).map((s) => s.name)),
    todos: titles(
      (state.todos ?? [])
        .filter((t) => t.projectId === projectId)
        .map((t) => t.title),
    ),
    risks: titles(
      (state.risks ?? [])
        .filter((r) => r.projectId === projectId)
        .map((r) => r.title),
    ),
    milestones: titles(
      (state.timeline ?? [])
        .filter((t) => t.projectId === projectId)
        .map((t) => t.label),
    ),
  };
}

export function bindIdentityAfterApply(args: {
  identity: IdentityMap;
  spec: CaptureSpec;
  before: MissionState;
  after: MissionState;
  projectId: string;
}): void {
  const beforeProject = args.before.projects.find((p) => p.id === args.projectId);
  const afterProject = args.after.projects.find((p) => p.id === args.projectId);
  const beforePeople = new Set((beforeProject?.stakeholders ?? []).map((s) => s.id));
  const beforeTodos = new Set(
    (args.before.todos ?? []).filter((t) => t.projectId === args.projectId).map((t) => t.id),
  );
  const beforeRisks = new Set(
    (args.before.risks ?? []).filter((r) => r.projectId === args.projectId).map((r) => r.id),
  );
  const beforeMs = new Set(
    (args.before.timeline ?? []).filter((t) => t.projectId === args.projectId).map((t) => t.id),
  );

  const leftoverPeople = (afterProject?.stakeholders ?? []).filter((s) => !beforePeople.has(s.id));
  const leftoverTodos = (args.after.todos ?? []).filter(
    (t) => t.projectId === args.projectId && !beforeTodos.has(t.id),
  );
  const leftoverRisks = (args.after.risks ?? []).filter(
    (r) => r.projectId === args.projectId && !beforeRisks.has(r.id),
  );
  const leftoverMs = (args.after.timeline ?? []).filter(
    (t) => t.projectId === args.projectId && !beforeMs.has(t.id),
  );

  for (const write of args.spec.expectedWrites ?? []) {
    if (write.op !== "create" || args.identity.has(write.key)) continue;
    if (write.domain === "person") {
      const named = leftoverPeople.findIndex((s) => norm(s.name) === norm(write.title));
      const row = named >= 0 ? leftoverPeople.splice(named, 1)[0] : leftoverPeople.shift();
      if (row) args.identity.set(write.key, row.id);
    } else if (write.domain === "todo") {
      const named = leftoverTodos.findIndex((t) => norm(t.title) === norm(write.title));
      const row = named >= 0 ? leftoverTodos.splice(named, 1)[0] : leftoverTodos.shift();
      if (row) args.identity.set(write.key, row.id);
    } else if (write.domain === "risk") {
      const named = leftoverRisks.findIndex((r) => norm(r.title) === norm(write.title));
      const row = named >= 0 ? leftoverRisks.splice(named, 1)[0] : leftoverRisks.shift();
      if (row) args.identity.set(write.key, row.id);
    } else if (write.domain === "milestone") {
      const named = leftoverMs.findIndex((t) => norm(t.label) === norm(write.title));
      const row = named >= 0 ? leftoverMs.splice(named, 1)[0] : leftoverMs.shift();
      if (row) args.identity.set(write.key, row.id);
    }
  }
}

export function currentTruthObjectCount(state: MissionState, projectId: string): number {
  const project = state.projects.find((p) => p.id === projectId);
  return (
    (project?.stakeholders.length ?? 0) +
    (state.todos ?? []).filter((t) => t.projectId === projectId && !t.done).length +
    (state.risks ?? []).filter((r) => r.projectId === projectId && (r.status === "open" || r.status === "watch")).length +
    (state.timeline ?? []).filter((t) => t.projectId === projectId).length +
    (state.knowledge.find((k) => k.projectId === projectId)?.structured?.filter((s) => s.lifecycle === "current").length ??
      0)
  );
}

export function fixtureKeyById(identity: IdentityMap, id: string): FixtureKey | null {
  for (const [key, value] of identity) {
    if (value === id) return key;
  }
  return null;
}
