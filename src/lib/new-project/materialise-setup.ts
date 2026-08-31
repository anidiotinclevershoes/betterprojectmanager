import { newPeopleUuid } from "@/lib/people/identity";
import type { CanonicalTruthItem } from "@/lib/canonical-truth/types";
import type { CreateProjectInput } from "@/lib/create-project";
import type { ProjectRisk, Stakeholder } from "@/lib/types";
import { personResponsibilityQuestion } from "./needs-you";

function scopesOf(draft: {
  role?: string;
  responsibilities?: string[];
}): string[] {
  const listed = (draft.responsibilities ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  if (listed.length) return listed;
  const role = draft.role?.trim();
  if (role && role.toLowerCase() !== "stakeholder") return [role];
  return [];
}

/**
 * Structured overlay for New Project create — reuses CanonicalTruthItem.
 * Responsibilities, undated milestones, and stored Needs You only where no
 * other incomplete legal object exists.
 * Does not invent dates, owners, or roles.
 */
export function structuredItemsFromSetup(args: {
  projectId: string;
  input: CreateProjectInput;
  stakeholders: Stakeholder[];
}): CanonicalTruthItem[] {
  const now = new Date().toISOString();
  const items: CanonicalTruthItem[] = [];

  (args.input.stakeholders ?? []).forEach((draft, index) => {
    const person = args.stakeholders[index];
    if (!person || !draft.name.trim()) return;
    for (const scope of scopesOf(draft)) {
      items.push({
        id: newPeopleUuid(),
        projectId: args.projectId,
        section: "people",
        body: `${person.name} — ${scope}`,
        kind: "responsibility",
        epistemic: "confirmed",
        lifecycle: "current",
        meta: {
          responsibility: {
            personId: person.id,
            personName: person.name,
            scope,
            ownerConfirmed: true,
          },
        },
        provenance: [{ type: "import", at: now, note: "new-project" }],
      });
    }
  });

  for (const date of args.input.importantDates ?? []) {
    if (!date.label.trim()) continue;
    if (date.date) continue;
    items.push({
      id: newPeopleUuid(),
      projectId: args.projectId,
      section: "now",
      body: date.label.trim(),
      kind: "date",
      epistemic: "pending",
      lifecycle: "current",
      meta: {
        date: {
          label: date.label.trim(),
          dateIso: null,
          dateType: "milestone",
        },
      },
      provenance: [{ type: "import", at: now, note: "new-project-incomplete-date" }],
    });
  }

  // Person with no scopes: do not invent unknown_owner from absence (D-009).
  // Persist the question as stored ambiguity so Needs You survives reload.
  (args.input.stakeholders ?? []).forEach((draft, index) => {
    const person = args.stakeholders[index];
    if (!person || !draft.name.trim()) return;
    if (scopesOf(draft).length > 0) return;
    items.push({
      id: newPeopleUuid(),
      projectId: args.projectId,
      section: "people",
      body: personResponsibilityQuestion(person.name),
      kind: "ambiguity",
      epistemic: "pending",
      lifecycle: "current",
      provenance: [{ type: "import", at: now, note: "new-project-needs-you" }],
    });
  });

  // Ambiguous organised notes that the user kept, with an explicit question.
  // Undated dates already have kind=date rows. needsReview risks/todos persist
  // as those domain objects — do not duplicate them as ambiguity overlays.
  for (const note of args.input.knowledgeRemember ?? []) {
    if (note.remember === false || !note.text.trim()) continue;
    const question = note.needsYouQuestion?.trim();
    if (!note.needsReview || !question) continue;
    items.push({
      id: newPeopleUuid(),
      projectId: args.projectId,
      section: "now",
      body: question,
      kind: "ambiguity",
      epistemic: "pending",
      lifecycle: "current",
      provenance: [
        { type: "import", at: now, note: "new-project-ambiguous-note" },
      ],
    });
  }

  return items;
}

export function risksFromSetup(
  projectId: string,
  input: CreateProjectInput,
): ProjectRisk[] {
  const titles = [
    ...(input.risks ?? []).map((r) => r.title.trim()).filter(Boolean),
    ...(input.knowledgeRisks ?? []).map((t) => t.trim()).filter(Boolean),
  ];
  const seen = new Set<string>();
  const now = new Date().toISOString();
  const risks: ProjectRisk[] = [];
  for (const title of titles) {
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    risks.push({
      id: newPeopleUuid(),
      projectId,
      title,
      status: "open",
      source: "manual",
      createdAt: now,
    });
  }
  return risks;
}
