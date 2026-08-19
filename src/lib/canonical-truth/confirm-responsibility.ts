/**
 * Confirm scoped responsibility owner — pure state patch (no AI).
 */
import { emptyKnowledge, normaliseBullet } from "@/lib/knowledge";
import type { MissionState, ProjectKnowledge } from "@/lib/types";
import type { CanonicalTruthItem } from "@/lib/canonical-truth/types";

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export type ConfirmResponsibilityOwnerInput = {
  state: MissionState;
  projectId: string;
  /** e.g. "Security sign-off" */
  scope: string;
  personName: string;
  personId?: string | null;
  /** Optional ambiguity / truth item being resolved */
  resolveTruthItemId?: string | null;
};

export type ConfirmResponsibilityOwnerResult = {
  state: MissionState;
  item: CanonicalTruthItem;
  peopleBullet: string;
};

/**
 * Persist @Person → scope as confirmed scoped responsibility.
 * Does NOT set a global project owner.
 */
export function confirmResponsibilityOwner(
  input: ConfirmResponsibilityOwnerInput,
): ConfirmResponsibilityOwnerResult {
  const scope = input.scope.trim();
  const personName = input.personName.trim();
  if (!scope || !personName) {
    throw new Error("scope and personName are required");
  }

  const peopleBullet = normaliseBullet(`${personName} — ${scope}`);
  const now = new Date().toISOString();
  const itemId = newId("resp");

  const item: CanonicalTruthItem = {
    id: itemId,
    projectId: input.projectId,
    section: "people",
    body: peopleBullet,
    kind: "responsibility",
    epistemic: "confirmed",
    lifecycle: "current",
    supersedesId: input.resolveTruthItemId ?? null,
    meta: {
      responsibility: {
        personName,
        personId: input.personId ?? null,
        scope,
        ownerConfirmed: true,
      },
    },
    provenance: [
      {
        type: "user_confirmation",
        at: now,
        note: `User confirmed @${personName} → ${scope}`,
      },
    ],
  };

  const knowledgeList = [...input.state.knowledge];
  const idx = knowledgeList.findIndex((k) => k.projectId === input.projectId);
  const base: ProjectKnowledge =
    idx >= 0 ? knowledgeList[idx]! : emptyKnowledge(input.projectId);

  const structured = [...(base.structured ?? [])];

  // Supersede prior unknown/conflicting responsibility for same scope
  for (let i = 0; i < structured.length; i++) {
    const cur = structured[i]!;
    const resp = cur.meta?.responsibility;
    if (
      cur.kind === "responsibility" &&
      resp &&
      resp.scope.trim().toLowerCase() === scope.toLowerCase() &&
      cur.lifecycle === "current"
    ) {
      structured[i] = {
        ...cur,
        lifecycle: "superseded",
        epistemic: cur.epistemic === "unknown" ? "unknown" : cur.epistemic,
      };
    }
  }

  if (input.resolveTruthItemId) {
    const ri = structured.findIndex((s) => s.id === input.resolveTruthItemId);
    if (ri >= 0) {
      structured[ri] = {
        ...structured[ri]!,
        lifecycle: "superseded",
      };
    }
  }

  structured.push(item);

  const people = [...base.sections.people];
  if (!people.some((p) => p.toLowerCase() === peopleBullet.toLowerCase())) {
    people.unshift(peopleBullet);
  }

  const nextKnowledge: ProjectKnowledge = {
    ...base,
    updatedAt: now,
    sections: {
      ...base.sections,
      people: people.slice(0, 24),
    },
    structured,
  };

  if (idx >= 0) knowledgeList[idx] = nextKnowledge;
  else knowledgeList.push(nextKnowledge);

  // Ensure stakeholder exists in-memory for picker reuse (id optional)
  const projects = input.state.projects.map((p) => {
    if (p.id !== input.projectId) return p;
    const exists = p.stakeholders.some(
      (s) => s.name.trim().toLowerCase() === personName.toLowerCase(),
    );
    if (exists) return p;
    return {
      ...p,
      stakeholders: [
        ...p.stakeholders,
        {
          id: input.personId ?? newId("stake"),
          name: personName,
          role: scope,
        },
      ],
    };
  });

  return {
    state: {
      ...input.state,
      knowledge: knowledgeList,
      projects,
    },
    item,
    peopleBullet,
  };
}

/** Look up confirmed owner for a scope from structured truth. */
export function findConfirmedOwner(
  knowledge: ProjectKnowledge | undefined,
  scope: string,
): { personName: string; scope: string; item: CanonicalTruthItem } | null {
  if (!knowledge?.structured?.length) return null;
  const needle = scope.trim().toLowerCase();
  for (const item of knowledge.structured) {
    if (item.lifecycle !== "current") continue;
    if (item.kind !== "responsibility") continue;
    const resp = item.meta?.responsibility;
    if (!resp?.ownerConfirmed || !resp.personName) continue;
    if (resp.scope.trim().toLowerCase() === needle) {
      return { personName: resp.personName, scope: resp.scope, item };
    }
    // fuzzy contains for "security" vs "Security sign-off"
    if (
      resp.scope.toLowerCase().includes(needle) ||
      needle.includes(resp.scope.toLowerCase())
    ) {
      return { personName: resp.personName, scope: resp.scope, item };
    }
  }
  return null;
}
