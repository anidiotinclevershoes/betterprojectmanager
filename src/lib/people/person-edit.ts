import type { MissionState, Stakeholder } from "@/lib/types";
import { namesMatchExact, normalisePersonName } from "@/lib/people/identity";
import { makeHistoryEvent, pushHistory } from "@/lib/workspace/history";

export type PersonEditPlan =
  | { ok: false; error: string }
  | { ok: true; changed: false; person: Stakeholder }
  | {
      ok: true;
      changed: true;
      person: Stakeholder;
      historyTitle: string;
      historyDetail: string;
    };

/**
 * Change name and role on the same person id.
 * Does not rewrite responsibilities or historical name snapshots.
 */
export function planPersonEdit(
  people: Stakeholder[],
  personId: string,
  input: { name: string; role: string },
): PersonEditPlan {
  const current = people.find((person) => person.id === personId);
  if (!current) return { ok: false, error: "That person is not in this project." };

  const name = input.name.replace(/\s+/g, " ").trim();
  if (!name) return { ok: false, error: "Enter a name before saving." };
  const role = input.role.replace(/\s+/g, " ").trim();

  const renaming = !namesMatchExact(current.name, name);
  const collision =
    renaming &&
    people.some(
      (person) => person.id !== personId && namesMatchExact(person.name, name),
    );
  if (collision) {
    return {
      ok: false,
      error: "Another person in this project already uses that name.",
    };
  }

  const next: Stakeholder = { ...current, name, role };
  const nameChanged = normalisePersonName(current.name) !== normalisePersonName(name);
  const roleChanged = current.role.replace(/\s+/g, " ").trim() !== role;
  if (!nameChanged && !roleChanged) {
    return { ok: true, changed: false, person: next };
  }

  const changes = [
    nameChanged ? `Name: ${current.name} → ${name}` : null,
    roleChanged ? `Role: ${current.role || "None"} → ${role || "None"}` : null,
  ].filter(Boolean);

  return {
    ok: true,
    changed: true,
    person: next,
    historyTitle: "You updated a person",
    historyDetail: `${name}\n${changes.join("\n")}`,
  };
}

export type PersonEditRequest = {
  projectId: string;
  personId: string;
  name: string;
  role: string;
  historyId?: string;
};

export function applyPersonEdit(
  state: MissionState,
  input: PersonEditRequest,
):
  | { ok: false; error: string }
  | { ok: true; changed: false }
  | { ok: true; changed: true; state: MissionState } {
  const project = state.projects.find((row) => row.id === input.projectId);
  if (!project) return { ok: false, error: "That project is not open." };
  const plan = planPersonEdit(project.stakeholders ?? [], input.personId, {
    name: input.name,
    role: input.role,
  });
  if (!plan.ok) return plan;
  if (!plan.changed) return { ok: true, changed: false };

  const projects = state.projects.map((row) =>
    row.id !== project.id
      ? row
      : {
          ...row,
          stakeholders: row.stakeholders.map((person) =>
            person.id === plan.person.id ? plan.person : person,
          ),
        },
  );
  const event = {
    ...makeHistoryEvent({
      type: "other",
      title: plan.historyTitle,
      detail: plan.historyDetail,
      projectId: input.projectId,
      source: "user",
      targetKind: "person",
      targetId: plan.person.id,
    }),
    ...(input.historyId ? { id: input.historyId } : {}),
  };
  return {
    ok: true,
    changed: true,
    state: pushHistory({ ...state, projects }, event),
  };
}
