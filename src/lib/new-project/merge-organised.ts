import {
  newSetupClientKey,
  type CreateProjectInput,
  type SetupDateDraft,
  type SetupKnowledgeDraft,
  type SetupRiskDraft,
  type SetupStakeholderDraft,
  type SetupTodoDraft,
} from "@/lib/create-project";

function keyName(name: string) {
  return name.trim().toLowerCase();
}

/**
 * Merge organised-note proposals into the in-progress New Project draft.
 * Does not persist. Does not overwrite a name/code the user already set
 * unless those fields are still empty.
 */
export function mergeOrganisedDraft(
  current: CreateProjectInput,
  organised: CreateProjectInput,
  opts?: { codeLocked?: boolean },
): CreateProjectInput {
  const stakeholders = mergePeople(
    current.stakeholders ?? [],
    organised.stakeholders ?? [],
  );
  const risks = mergeByTitle(current.risks ?? [], organised.risks ?? []);
  const todos = mergeTodos(current.todos ?? [], organised.todos ?? []);
  const importantDates = mergeDates(
    current.importantDates ?? [],
    organised.importantDates ?? [],
  );
  const knowledgeRemember = mergeKnowledge(
    current.knowledgeRemember ?? [],
    organised.knowledgeRemember ?? [],
  );

  const name = current.name.trim() || organised.name.trim();
  const code = opts?.codeLocked
    ? current.code
    : current.code.trim() || organised.code.trim();

  return {
    ...current,
    name,
    code,
    summary: current.summary.trim() || organised.summary.trim(),
    currentFocus: current.currentFocus.trim() || organised.currentFocus.trim(),
    stakeholders,
    risks,
    knowledgeRisks: risks.map((r) => r.title),
    todos,
    importantDates,
    knowledgeRemember,
    knowledgeDecisions: uniqueStrings([
      ...(current.knowledgeDecisions ?? []),
      ...(organised.knowledgeDecisions ?? []),
    ]),
    knowledgeNow: uniqueStrings([
      ...(current.knowledgeNow ?? []),
      ...(organised.knowledgeNow ?? []),
    ]),
    notMentioned: uniqueStrings([
      ...(current.notMentioned ?? []),
      ...(organised.notMentioned ?? []),
    ]).slice(0, 8),
    sourceNarrative: mergeSourceNarrative(
      current.sourceNarrative,
      organised.sourceNarrative,
    ),
    sourceMode: current.sourceMode === "blank" ? "paste" : current.sourceMode,
  };
}

function mergePeople(
  current: SetupStakeholderDraft[],
  incoming: SetupStakeholderDraft[],
): SetupStakeholderDraft[] {
  const out = current.map((p) => ({ ...p }));
  for (const person of incoming) {
    if (!person.name.trim()) continue;
    const hit = out.find((p) => keyName(p.name) === keyName(person.name));
    const incomingScopes = scopesOf(person);
    if (hit) {
      const existing = scopesOf(hit);
      const merged = uniqueStrings([...existing, ...incomingScopes]);
      hit.responsibilities = merged;
      if (!hit.role?.trim() && person.role?.trim()) hit.role = person.role;
      if (person.needsReview) hit.needsReview = true;
      continue;
    }
    out.push({
      clientKey: person.clientKey ?? newSetupClientKey(),
      name: person.name.trim(),
      role: person.role,
      responsibilities: incomingScopes,
      concerns: person.concerns,
      needsReview: Boolean(person.needsReview),
      tags: person.tags,
    });
  }
  return out;
}

/** Explicit responsibility scopes only. Role is never a scope. */
function scopesOf(person: SetupStakeholderDraft): string[] {
  return (person.responsibilities ?? []).map((s) => s.trim()).filter(Boolean);
}

function mergeByTitle(
  current: SetupRiskDraft[],
  incoming: SetupRiskDraft[],
): SetupRiskDraft[] {
  const out = current.map((r) => ({ ...r }));
  for (const risk of incoming) {
    if (!risk.title.trim()) continue;
    const hit = out.find((r) => keyName(r.title) === keyName(risk.title));
    if (hit) {
      hit.notes = keepOrFill(hit.notes, risk.notes);
      continue;
    }
    out.push({
      clientKey: risk.clientKey ?? newSetupClientKey(),
      title: risk.title.trim(),
      notes: keepOrFill(undefined, risk.notes),
      needsReview: risk.needsReview,
      tags: risk.tags,
    });
  }
  return out;
}

function mergeTodos(
  current: SetupTodoDraft[],
  incoming: SetupTodoDraft[],
): SetupTodoDraft[] {
  const out = current.map((t) => ({ ...t }));
  for (const todo of incoming) {
    if (!todo.title.trim()) continue;
    const hit = out.find((t) => keyName(t.title) === keyName(todo.title));
    if (hit) {
      hit.detail = keepOrFill(hit.detail, todo.detail);
      hit.dueAt = keepOrFill(hit.dueAt, todo.dueAt);
      continue;
    }
    out.push({
      clientKey: todo.clientKey ?? newSetupClientKey(),
      title: todo.title.trim(),
      detail: keepOrFill(undefined, todo.detail),
      dueAt: keepOrFill(undefined, todo.dueAt),
      kind: todo.kind,
      waitingOn: todo.waitingOn,
      needsReview: todo.needsReview,
      tags: todo.tags,
    });
  }
  return out;
}

function mergeDates(
  current: SetupDateDraft[],
  incoming: SetupDateDraft[],
): SetupDateDraft[] {
  const out = current.map((d) => ({ ...d }));
  for (const date of incoming) {
    if (!date.label.trim()) continue;
    const hit = out.find((d) => keyName(d.label) === keyName(date.label));
    if (hit) {
      if (!hit.date && date.date) hit.date = date.date;
      hit.endAt = keepOrFill(hit.endAt, date.endAt);
      if (date.needsReview || !hit.date) hit.needsReview = true;
      continue;
    }
    out.push({
      clientKey: date.clientKey ?? newSetupClientKey(),
      label: date.label.trim(),
      date: date.date,
      endAt: keepOrFill(undefined, date.endAt),
      needsReview: date.needsReview || !date.date,
      tags: date.tags,
    });
  }
  return out;
}

function mergeKnowledge(
  current: SetupKnowledgeDraft[],
  incoming: SetupKnowledgeDraft[],
): SetupKnowledgeDraft[] {
  const out = current.map((k) => ({ ...k }));
  for (const item of incoming) {
    if (!item.text.trim()) continue;
    if (out.some((k) => keyName(k.text) === keyName(item.text))) continue;
    out.push({
      clientKey: item.clientKey ?? newSetupClientKey(),
      text: item.text.trim(),
      remember: item.remember !== false,
      kind: item.kind,
      needsReview: item.needsReview,
      needsYouQuestion: item.needsYouQuestion,
      tags: item.tags,
    });
  }
  return out;
}

/** Keep a user value. Fill it only when the current value is empty. */
function keepOrFill(current?: string, incoming?: string): string | undefined {
  const kept = current?.trim();
  if (kept) return current;
  const next = incoming?.trim();
  return next || undefined;
}

/**
 * Join source notes without repeating the same Organise submission.
 * A different earlier narrative is kept.
 */
function mergeSourceNarrative(current?: string, incoming?: string): string | undefined {
  const left = current?.trim() ?? "";
  const right = incoming?.trim() ?? "";
  if (!right) return left || undefined;
  if (!left || left === right) return right;
  const segments = left.split(/\n\n+/).map((part) => part.trim()).filter(Boolean);
  if (segments.includes(right)) return left;
  return `${left}\n\n${right}`;
}

function uniqueStrings(items: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}
