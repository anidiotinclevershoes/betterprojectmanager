import {
  newSetupClientKey,
  type CreateProjectInput,
  type SetupDateDraft,
  type SetupKnowledgeDraft,
  type SetupRiskDraft,
  type SetupStakeholderDraft,
  type SetupTodoDraft,
} from "@/lib/create-project";
import { deriveProjectSummary } from "./derive-summary";
import { parsePersonLine, scopesOf } from "./person-text";

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

  const organisedName = organised.name.trim();
  const usableOrganisedName =
    organisedName && organisedName.toLowerCase() !== "new project"
      ? organisedName
      : "";
  const name = current.name.trim() || usableOrganisedName;
  const code = opts?.codeLocked
    ? current.code
    : current.code.trim() ||
      (usableOrganisedName ? organised.code.trim() : "");
  const sourceNarrative = [current.sourceNarrative, organised.sourceNarrative]
    .filter((s) => s?.trim())
    .join("\n\n");

  return {
    ...current,
    name,
    code,
    summary:
      current.summary.trim() ||
      organised.summary.trim() ||
      deriveProjectSummary(sourceNarrative || organised.sourceNarrative || ""),
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
    sourceNarrative,
    sourceMode: current.sourceMode === "blank" ? "paste" : current.sourceMode,
  };
}

function mergePeople(
  current: SetupStakeholderDraft[],
  incoming: SetupStakeholderDraft[],
): SetupStakeholderDraft[] {
  const out = current.map((p) => ({ ...p }));
  for (const raw of incoming) {
    const parsed = parsePersonLine(raw.name);
    const person: SetupStakeholderDraft = {
      ...raw,
      name: parsed.name || raw.name.trim(),
      responsibilities: uniqueStrings([
        ...scopesOf(raw),
        ...parsed.responsibilities,
      ]),
    };
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

function mergeByTitle(
  current: SetupRiskDraft[],
  incoming: SetupRiskDraft[],
): SetupRiskDraft[] {
  const out = current.map((r) => ({ ...r }));
  for (const risk of incoming) {
    if (!risk.title.trim()) continue;
    if (out.some((r) => keyName(r.title) === keyName(risk.title))) continue;
    out.push({
      clientKey: risk.clientKey ?? newSetupClientKey(),
      title: risk.title.trim(),
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
    if (out.some((t) => keyName(t.title) === keyName(todo.title))) continue;
    out.push({
      clientKey: todo.clientKey ?? newSetupClientKey(),
      title: todo.title.trim(),
      dueAt: todo.dueAt,
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
      if (date.needsReview || !hit.date) hit.needsReview = true;
      continue;
    }
    out.push({
      clientKey: date.clientKey ?? newSetupClientKey(),
      label: date.label.trim(),
      date: date.date,
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
