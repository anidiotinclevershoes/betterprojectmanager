/**
 * Slice 1B — Risk lifecycle helpers (deterministic, no I/O).
 *
 * Authority: `MissionState.risks` / `risks` table for genuine Risk records.
 * Knowledge `sections.risks` is a presentation/projection layer.
 */
import type { KnowledgeSectionId, ProjectKnowledge, ProjectRisk } from "@/lib/types";
import type { RiskStatus } from "@/types/database";

export function stripResolvedPrefix(title: string): string {
  return title.replace(/^\s*\[resolved\]\s*/i, "").trim();
}

export function isResolvedProse(title: string): boolean {
  return /^\s*\[resolved\]/i.test(title);
}

export function titlesMatch(a: string, b: string): boolean {
  return stripResolvedPrefix(a).toLowerCase() === stripResolvedPrefix(b).toLowerCase();
}

export function isOpenRiskStatus(status: RiskStatus): boolean {
  return status === "open" || status === "watch";
}

export function isClosedRiskStatus(status: RiskStatus): boolean {
  return status === "resolved" || status === "accepted";
}

/**
 * Project open/watch Risk titles into Knowledge for Capture/Tell Me/KC display.
 * Skips resolved/accepted — they must not reappear as open Knowledge risks.
 */
export function foldOpenRisksIntoKnowledge(
  knowledge: ProjectKnowledge[],
  risks: ProjectRisk[],
): ProjectKnowledge[] {
  const byProject = new Map<string, ProjectKnowledge>();
  for (const k of knowledge) {
    byProject.set(k.projectId, {
      ...k,
      sections: { ...k.sections, risks: [...(k.sections.risks ?? [])] },
    });
  }

  for (const risk of risks) {
    if (!isOpenRiskStatus(risk.status)) continue;
    const current =
      byProject.get(risk.projectId) ??
      ({
        projectId: risk.projectId,
        updatedAt: new Date().toISOString(),
        sections: {
          now: [],
          decisions: [],
          risks: [],
          people: [],
          openLoops: [],
        },
      } satisfies ProjectKnowledge);
    const already = (current.sections.risks ?? []).some((t) =>
      titlesMatch(t, risk.title),
    );
    if (!already) {
      current.sections.risks = [...(current.sections.risks ?? []), risk.title].slice(
        0,
        24,
      );
    }
    byProject.set(risk.projectId, current);
  }

  return Array.from(byProject.values());
}

/**
 * After a genuine Risk status change, keep Knowledge projection consistent:
 * - open/watch → ensure bare title present (no [Resolved] prefix)
 * - resolved/accepted → remove matching open/prose titles from Knowledge risks
 *
 * Does not invent Risk rows. Does not rewrite unrelated bullets.
 */
export function syncKnowledgeRiskProjection(
  knowledge: ProjectKnowledge,
  risk: Pick<ProjectRisk, "title" | "status">,
): ProjectKnowledge {
  const section: KnowledgeSectionId = "risks";
  const bullets = [...(knowledge.sections[section] ?? [])];
  const next: string[] = [];

  if (isOpenRiskStatus(risk.status)) {
    let found = false;
    for (const b of bullets) {
      if (titlesMatch(b, risk.title)) {
        if (!found) {
          next.push(risk.title);
          found = true;
        }
        // drop duplicate / [Resolved] variants of the same title
      } else {
        next.push(b);
      }
    }
    if (!found) next.push(risk.title);
  } else {
    for (const b of bullets) {
      if (titlesMatch(b, risk.title)) continue;
      next.push(b);
    }
  }

  return {
    ...knowledge,
    updatedAt: new Date().toISOString(),
    sections: { ...knowledge.sections, risks: next },
  };
}

/**
 * Legacy Knowledge-only resolve: prefix [Resolved] for display compatibility.
 * Does not create a risks-domain row.
 */
export function resolveKnowledgeOnlyRiskBullet(
  knowledge: ProjectKnowledge,
  title: string,
): ProjectKnowledge {
  const cleanedTarget = stripResolvedPrefix(title);
  let matched = false;
  const nextRisks = (knowledge.sections.risks ?? []).map((r) => {
    const cleaned = stripResolvedPrefix(r);
    if (cleaned.toLowerCase() === cleanedTarget.toLowerCase()) {
      matched = true;
      return `[Resolved] ${cleaned}`;
    }
    return r;
  });
  return {
    ...knowledge,
    updatedAt: new Date().toISOString(),
    sections: {
      ...knowledge.sections,
      risks: matched ? nextRisks : [...nextRisks, `[Resolved] ${cleanedTarget}`],
    },
  };
}

export function reopenKnowledgeOnlyRiskBullet(
  knowledge: ProjectKnowledge,
  title: string,
): ProjectKnowledge {
  const cleanedTarget = stripResolvedPrefix(title);
  const nextRisks = (knowledge.sections.risks ?? []).map((r) => {
    const cleaned = stripResolvedPrefix(r);
    if (cleaned.toLowerCase() === cleanedTarget.toLowerCase()) return cleaned;
    return r;
  });
  return {
    ...knowledge,
    updatedAt: new Date().toISOString(),
    sections: { ...knowledge.sections, risks: nextRisks },
  };
}

/** Find a genuine Risk by id within a project (optional project filter). */
export function findProjectRisk(
  risks: ProjectRisk[] | undefined,
  riskId: string,
  projectId?: string | null,
): ProjectRisk | undefined {
  return (risks ?? []).find(
    (r) => r.id === riskId && (!projectId || r.projectId === projectId),
  );
}

/** Exact title match only — never fuzzy. */
export function findProjectRiskByExactTitle(
  risks: ProjectRisk[] | undefined,
  projectId: string,
  title: string,
): ProjectRisk | undefined {
  const cleaned = stripResolvedPrefix(title);
  return (risks ?? []).find(
    (r) =>
      r.projectId === projectId &&
      stripResolvedPrefix(r.title).toLowerCase() === cleaned.toLowerCase(),
  );
}
