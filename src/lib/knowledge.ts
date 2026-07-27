import type { KnowledgeSectionId, ProjectKnowledge } from "./types";

export const KNOWLEDGE_SECTIONS: Array<{
  id: KnowledgeSectionId;
  label: string;
  hint: string;
}> = [
  {
    id: "now",
    label: "What is true now?",
    hint: "What is true about the project right now",
  },
  {
    id: "decisions",
    label: "What have we decided?",
    hint: "Agreed calls and trade-offs",
  },
  {
    id: "risks",
    label: "What might surprise me?",
    hint: "What could surprise stakeholders",
  },
  {
    id: "people",
    label: "Who matters?",
    hint: "Stakeholder preferences, concerns, relationships",
  },
  {
    id: "openLoops",
    label: "What is still open?",
    hint: "Waiting on, chases, unconfirmed assumptions",
  },
];

export const MAX_BULLETS_PER_SECTION = 8;

export function emptyKnowledge(projectId: string): ProjectKnowledge {
  return {
    projectId,
    updatedAt: new Date().toISOString(),
    sections: {
      now: [],
      decisions: [],
      risks: [],
      people: [],
      openLoops: [],
    },
  };
}

export function normaliseBullet(text: string) {
  return text
    .replace(/^[-•*\d.)\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function bulletKey(text: string) {
  return normaliseBullet(text).toLowerCase();
}

/**
 * Merge new bullets into a section. Prefer fresher wording when similar;
 * cap length so the brief never becomes a wall of text.
 */
export function mergeSectionBullets(
  existing: string[],
  incoming: string[],
  max = MAX_BULLETS_PER_SECTION,
): string[] {
  const next: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string) => {
    const cleaned = normaliseBullet(raw);
    if (!cleaned || cleaned.length < 8) return;
    const key = bulletKey(cleaned);
    // Skip near-duplicates (same start or contained)
    for (const prior of seen) {
      if (
        prior === key ||
        prior.startsWith(key.slice(0, 40)) ||
        key.startsWith(prior.slice(0, 40))
      ) {
        return;
      }
    }
    seen.add(key);
    next.push(cleaned);
  };

  // Incoming first (freshest), then keep existing that still matter
  for (const item of incoming) push(item);
  for (const item of existing) push(item);

  return next.slice(0, max);
}

export function mergeKnowledge(
  current: ProjectKnowledge | undefined,
  projectId: string,
  patch: Partial<ProjectKnowledge["sections"]>,
): ProjectKnowledge {
  const base = current ?? emptyKnowledge(projectId);
  return {
    projectId,
    updatedAt: new Date().toISOString(),
    sections: {
      now: mergeSectionBullets(base.sections.now, patch.now ?? []),
      decisions: mergeSectionBullets(
        base.sections.decisions,
        patch.decisions ?? [],
      ),
      risks: mergeSectionBullets(base.sections.risks, patch.risks ?? []),
      people: mergeSectionBullets(base.sections.people, patch.people ?? []),
      openLoops: mergeSectionBullets(
        base.sections.openLoops,
        patch.openLoops ?? [],
      ),
    },
  };
}

/** Local heuristic: route capture lines into the five sections. */
export function extractKnowledgePatchFromText(content: string): Partial<
  ProjectKnowledge["sections"]
> {
  const lines = content
    .split(/[\n.]+/)
    .map((l) => normaliseBullet(l))
    .filter((l) => l.length >= 12);

  const patch: ProjectKnowledge["sections"] = {
    now: [],
    decisions: [],
    risks: [],
    people: [],
    openLoops: [],
  };

  for (const line of lines.slice(0, 10)) {
    const lower = line.toLowerCase();
    if (
      /decid|agreed|approved|sign.?off|trade-?off|we will|go\/no-go/.test(lower)
    ) {
      patch.decisions.push(line);
    } else if (
      /risk|blocker|blocked|delay|unstable|flaky|concern|gap|slip/.test(lower)
    ) {
      patch.risks.push(line);
    } else if (
      /waiting|chase|need .+ from|follow.?up|unconfirmed|assume|still haven/.test(
        lower,
      )
    ) {
      patch.openLoops.push(line);
    } else if (
      /priya|marcus|elena|jordan|sponsor|stakeholder|finance|prefers|concerned/.test(
        lower,
      )
    ) {
      patch.people.push(line);
    } else {
      patch.now.push(line);
    }
  }

  // Keep only non-empty and limit additions per capture
  return {
    now: patch.now.slice(0, 3),
    decisions: patch.decisions.slice(0, 2),
    risks: patch.risks.slice(0, 3),
    people: patch.people.slice(0, 2),
    openLoops: patch.openLoops.slice(0, 3),
  };
}

export function knowledgeHasContent(knowledge?: ProjectKnowledge) {
  if (!knowledge) return false;
  return KNOWLEDGE_SECTIONS.some(
    (s) => (knowledge.sections[s.id] ?? []).length > 0,
  );
}
