/**
 * Slice 1C — People identity + scoped responsibility helpers.
 *
 * Authority:
 * - Person identity → project-scoped `stakeholders` (durable UUID)
 * - Scoped responsibility → `knowledge_items` kind=responsibility linked via
 *   meta.responsibility.personId (multiple concurrent current rows allowed)
 *
 * No fuzzy AI person matching. Exact normalised name match within a project only.
 */
import { emptyKnowledge, normaliseBullet } from "@/lib/knowledge";
import type {
  MissionState,
  Project,
  ProjectKnowledge,
  Stakeholder,
} from "@/lib/types";
import type {
  CanonicalTruthItem,
  ProvenanceEntry,
} from "@/lib/canonical-truth/types";
import { isKnowledgeUuid } from "@/lib/knowledge-identity";

export function newPeopleUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Exact, safely-normalised identity key within a project (not fuzzy). */
export function normalisePersonName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function namesMatchExact(a: string, b: string): boolean {
  return normalisePersonName(a) === normalisePersonName(b);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * True when `text` contains the Person's recorded full name as a whole phrase.
 * A first-name fragment is not enough. Not fuzzy. Not UUID-aware.
 */
export function recordedPersonNameAppearsInText(
  text: string,
  recordedName: string,
): boolean {
  const name = recordedName.trim().replace(/\s+/g, " ");
  if (!name || !text.trim()) return false;
  const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, "i");
  return re.test(text);
}

/** People whose recorded full name appears in `text`. UUID is irrelevant. */
export function peopleEvidencedByRecordedNameInText<T extends { name: string }>(
  people: readonly T[],
  text: string,
): T[] {
  return people.filter((person) =>
    recordedPersonNameAppearsInText(text, person.name),
  );
}

export function scopesMatchExact(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Resolve an existing stakeholder by id or exact name within the project.
 * Never merges similarly-named distinct people.
 */
export function findStakeholderInProject(
  project: Project | undefined,
  opts: { personId?: string | null; personName?: string | null },
): Stakeholder | undefined {
  if (!project) return undefined;
  if (opts.personId && isKnowledgeUuid(opts.personId)) {
    const byId = project.stakeholders.find((s) => s.id === opts.personId);
    if (byId) return byId;
  }
  if (opts.personName?.trim()) {
    return project.stakeholders.find((s) =>
      namesMatchExact(s.name, opts.personName!),
    );
  }
  return undefined;
}

export type EnsurePersonResult = {
  stakeholder: Stakeholder;
  created: boolean;
  projects: Project[];
};

/**
 * Ensure a durable Person exists on the project (in-memory).
 * Reuses exact id/name match; never creates a duplicate for the same name.
 */
export function ensurePersonOnProject(
  projects: Project[],
  projectId: string,
  personName: string,
  personId?: string | null,
  roleHint?: string,
): EnsurePersonResult {
  const name = personName.trim();
  if (!name) throw new Error("personName is required");

  const project = projects.find((p) => p.id === projectId);
  if (!project) throw new Error(`project not found: ${projectId}`);

  const existing = findStakeholderInProject(project, { personId, personName: name });
  if (existing) {
    return { stakeholder: existing, created: false, projects };
  }

  const id =
    personId && isKnowledgeUuid(personId) ? personId : newPeopleUuid();
  const stakeholder: Stakeholder = {
    id,
    name,
    role: roleHint?.trim() || "Stakeholder",
  };

  const nextProjects = projects.map((p) =>
    p.id === projectId
      ? { ...p, stakeholders: [...p.stakeholders, stakeholder] }
      : p,
  );

  return { stakeholder, created: true, projects: nextProjects };
}

export type ConfirmResponsibilityOwnerInput = {
  state: MissionState;
  projectId: string;
  /** e.g. "Security sign-off" */
  scope: string;
  personName: string;
  personId?: string | null;
  /**
   * Supersede a specific truth item (ambiguity / conflict item, or an
   * explicit prior assignment). Does not supersede other concurrent owners.
   */
  resolveTruthItemId?: string | null;
  /**
   * Explicitly end this person's current ownership of the same scope
   * (time-varying replacement). Other concurrent owners remain current.
   */
  replacePersonId?: string | null;
};

export type ConfirmResponsibilityOwnerResult = {
  state: MissionState;
  item: CanonicalTruthItem;
  peopleBullet: string;
  person: Stakeholder;
  personCreated: boolean;
  /** False when reconfirming an already-current person↔scope assignment. */
  responsibilityCreated: boolean;
  /** Truth item ids marked superseded in this confirmation (for DB sync). */
  supersededIds: string[];
};

/**
 * Persist @Person → scope as confirmed scoped responsibility.
 * Does NOT set a global project owner.
 *
 * Default behaviour is ADD/SHARE: confirming a second person for the same
 * scope does not supersede the first. Replacement requires replacePersonId
 * and/or resolveTruthItemId.
 */
export function confirmResponsibilityOwner(
  input: ConfirmResponsibilityOwnerInput,
): ConfirmResponsibilityOwnerResult {
  const scope = input.scope.trim();
  const personName = input.personName.trim();
  if (!scope || !personName) {
    throw new Error("scope and personName are required");
  }

  const ensured = ensurePersonOnProject(
    input.state.projects,
    input.projectId,
    personName,
    input.personId,
    scope,
  );
  const person = ensured.stakeholder;

  const knowledgeList = [...(input.state.knowledge ?? [])];
  const idx = knowledgeList.findIndex((k) => k.projectId === input.projectId);
  const base: ProjectKnowledge =
    idx >= 0 ? knowledgeList[idx]! : emptyKnowledge(input.projectId);
  const structured = [...(base.structured ?? [])];
  const supersededIds: string[] = [];

  const markSuperseded = (id: string) => {
    const ri = structured.findIndex((s) => s.id === id);
    if (ri < 0) return;
    const cur = structured[ri]!;
    if (cur.lifecycle === "superseded" || cur.lifecycle === "historical") return;
    structured[ri] = { ...cur, lifecycle: "superseded" };
    if (!supersededIds.includes(id)) supersededIds.push(id);
  };

  // Explicit item resolve (ambiguity / targeted replacement of one assignment)
  if (input.resolveTruthItemId) {
    markSuperseded(input.resolveTruthItemId);
  }

  // Explicit person replacement for this scope only
  if (input.replacePersonId) {
    for (const cur of structured) {
      if (cur.lifecycle !== "current") continue;
      if (cur.kind !== "responsibility") continue;
      const resp = cur.meta?.responsibility;
      if (!resp || !scopesMatchExact(resp.scope, scope)) continue;
      if (resp.personId === input.replacePersonId) {
        markSuperseded(cur.id);
      }
    }
  }

  // Idempotent: same person + scope already current → reuse (no duplicate row)
  const existingCurrent = structured.find((cur) => {
    if (cur.lifecycle !== "current") return false;
    if (cur.kind !== "responsibility") return false;
    const resp = cur.meta?.responsibility;
    if (!resp?.ownerConfirmed) return false;
    if (!scopesMatchExact(resp.scope, scope)) return false;
    if (resp.personId && resp.personId === person.id) return true;
    if (!resp.personId && resp.personName && namesMatchExact(resp.personName, person.name))
      return true;
    return false;
  });

  if (existingCurrent) {
    const peopleBullet =
      existingCurrent.body ||
      normaliseBullet(`${person.name} — ${scope}`);
    const nextKnowledge: ProjectKnowledge = {
      ...base,
      updatedAt: new Date().toISOString(),
      structured,
    };
    if (idx >= 0) knowledgeList[idx] = nextKnowledge;
    else knowledgeList.push(nextKnowledge);

    return {
      state: {
        ...input.state,
        knowledge: knowledgeList,
        projects: ensured.projects,
      },
      item: {
        ...existingCurrent,
        meta: {
          ...existingCurrent.meta,
          responsibility: {
            ...existingCurrent.meta?.responsibility!,
            personId: person.id,
            personName: person.name,
            scope,
            ownerConfirmed: true,
          },
        },
      },
      peopleBullet,
      person,
      personCreated: ensured.created,
      responsibilityCreated: false,
      supersededIds,
    };
  }

  const now = new Date().toISOString();
  const peopleBullet = normaliseBullet(`${person.name} — ${scope}`);
  const itemId = newPeopleUuid();
  const primarySupersedeRaw =
    input.resolveTruthItemId ??
    (supersededIds.length === 1 ? supersededIds[0]! : null);
  const primarySupersede =
    primarySupersedeRaw && isKnowledgeUuid(primarySupersedeRaw)
      ? primarySupersedeRaw
      : null;

  const provenance: ProvenanceEntry[] = [
    {
      type: "user_confirmation",
      at: now,
      note: `User confirmed @${person.name} → ${scope}`,
    },
  ];

  const item: CanonicalTruthItem = {
    id: itemId,
    projectId: input.projectId,
    section: "people",
    body: peopleBullet,
    kind: "responsibility",
    epistemic: "confirmed",
    lifecycle: "current",
    supersedesId: primarySupersede,
    meta: {
      responsibility: {
        personName: person.name,
        personId: person.id,
        scope,
        ownerConfirmed: true,
      },
    },
    provenance,
  };

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

  return {
    state: {
      ...input.state,
      knowledge: knowledgeList,
      projects: ensured.projects,
    },
    item,
    peopleBullet,
    person,
    personCreated: ensured.created,
    responsibilityCreated: true,
    supersededIds,
  };
}

export type ConfirmedOwnerHit = {
  personName: string;
  personId: string | null;
  scope: string;
  item: CanonicalTruthItem;
};

/**
 * All current confirmed owners for a scope (shared ownership).
 * Exact scope match preferred; contains-match only when needle is a substring
 * of a unique scope (legacy Tell Me convenience — not person identity matching).
 */
export function findConfirmedOwners(
  knowledge: ProjectKnowledge | undefined,
  scope: string,
): ConfirmedOwnerHit[] {
  if (!knowledge?.structured?.length) return [];
  const needle = scope.trim().toLowerCase();
  const exact: ConfirmedOwnerHit[] = [];
  const fuzzy: ConfirmedOwnerHit[] = [];

  for (const item of knowledge.structured) {
    if (item.lifecycle !== "current") continue;
    if (item.kind !== "responsibility") continue;
    const resp = item.meta?.responsibility;
    if (!resp?.ownerConfirmed || !resp.personName) continue;
    const hit: ConfirmedOwnerHit = {
      personName: resp.personName,
      personId: resp.personId ?? null,
      scope: resp.scope,
      item,
    };
    if (scopesMatchExact(resp.scope, needle)) {
      exact.push(hit);
    } else if (
      resp.scope.toLowerCase().includes(needle) ||
      needle.includes(resp.scope.toLowerCase())
    ) {
      fuzzy.push(hit);
    }
  }
  return exact.length ? exact : fuzzy;
}

/** Backward-compatible singular lookup (first current owner). */
export function findConfirmedOwner(
  knowledge: ProjectKnowledge | undefined,
  scope: string,
): ConfirmedOwnerHit | null {
  const all = findConfirmedOwners(knowledge, scope);
  return all[0] ?? null;
}

export type PersonResponsibilityView = {
  item: CanonicalTruthItem;
  scope: string;
  lifecycle: CanonicalTruthItem["lifecycle"];
  personId: string | null;
  personName: string | null;
};

export type PersonAvailabilityView = {
  item: CanonicalTruthItem;
  body: string;
};

/**
 * Deterministic person-centred bundle for a stable Person id.
 * Does not scan unrelated project prose — only structured + stakeholder identity.
 */
export type PersonBundle = {
  projectId: string;
  person: Stakeholder;
  currentResponsibilities: PersonResponsibilityView[];
  historicalResponsibilities: PersonResponsibilityView[];
  sharedScopes: Array<{ scope: string; coOwnerNames: string[] }>;
  availability: PersonAvailabilityView[];
  legacyPeopleBullets: string[];
};

export function getPersonBundle(
  state: MissionState,
  projectId: string,
  personId: string,
): PersonBundle | null {
  const project = state.projects.find((p) => p.id === projectId);
  const person = project?.stakeholders.find((s) => s.id === personId);
  if (!person) return null;

  const knowledge = state.knowledge.find((k) => k.projectId === projectId);
  const structured = knowledge?.structured ?? [];

  const currentResponsibilities: PersonResponsibilityView[] = [];
  const historicalResponsibilities: PersonResponsibilityView[] = [];

  for (const item of structured) {
    if (item.kind !== "responsibility") continue;
    const resp = item.meta?.responsibility;
    if (!resp) continue;
    const linked =
      (resp.personId && resp.personId === personId) ||
      (!resp.personId &&
        resp.personName &&
        namesMatchExact(resp.personName, person.name));
    if (!linked) continue;
    const view: PersonResponsibilityView = {
      item,
      scope: resp.scope,
      lifecycle: item.lifecycle,
      personId: resp.personId ?? null,
      personName: resp.personName ?? null,
    };
    if (item.lifecycle === "current") currentResponsibilities.push(view);
    else historicalResponsibilities.push(view);
  }

  const sharedScopes: PersonBundle["sharedScopes"] = [];
  for (const cur of currentResponsibilities) {
    const others = findConfirmedOwners(knowledge, cur.scope).filter(
      (h) => h.personId !== personId && !namesMatchExact(h.personName, person.name),
    );
    if (others.length) {
      sharedScopes.push({
        scope: cur.scope,
        coOwnerNames: others.map((o) => o.personName),
      });
    }
  }

  // Availability: structured kind=availability linked by personId or exact name in body/meta
  const availability: PersonAvailabilityView[] = [];
  for (const item of structured) {
    if (item.kind !== "availability") continue;
    if (item.lifecycle !== "current") continue;
    const metaPersonId = (item.meta as { personId?: string } | null)?.personId;
    const linked =
      metaPersonId === personId ||
      namesMatchExact(item.body.split(/[—–-]/)[0] ?? "", person.name) ||
      item.body.toLowerCase().includes(person.name.toLowerCase());
    if (linked) availability.push({ item, body: item.body });
  }

  const legacyPeopleBullets = (knowledge?.sections.people ?? []).filter((b) =>
    b.toLowerCase().includes(person.name.toLowerCase()),
  );

  return {
    projectId,
    person,
    currentResponsibilities,
    historicalResponsibilities,
    sharedScopes,
    availability,
    legacyPeopleBullets,
  };
}

/**
 * Intended home for project-relevant availability (Slice 1C architecture note).
 * Full holiday/calendar subsystem is out of scope — use structured
 * kind=availability with meta.personId when implementing later.
 */
export type AvailabilityMeta = {
  personId?: string | null;
  personName?: string | null;
  label?: string | null;
  awayFromIso?: string | null;
  awayToIso?: string | null;
};
