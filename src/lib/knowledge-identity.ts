/**
 * Slice 1A.1: stable Knowledge identity alignment.
 * Never uses array index alone as semantic identity.
 */
import type { KnowledgeSectionId, ProjectKnowledge } from "@/lib/types";
import type { CanonicalTruthItem } from "@/lib/canonical-truth/types";

export const KNOWLEDGE_SECTION_IDS: KnowledgeSectionId[] = [
  "now",
  "decisions",
  "risks",
  "people",
  "openLoops",
];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isKnowledgeUuid(value: string | null | undefined): boolean {
  return Boolean(value && UUID_RE.test(value));
}

export type AlignedKnowledgeLine = {
  body: string;
  /** Existing knowledge_items id to preserve, or null for a new item. */
  id: string | null;
};

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gi, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1),
  );
}

function jaccard(a: string, b: string): number {
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  return inter / (A.size + B.size - inter);
}

/**
 * Deterministic wording-edit detector (not AI).
 * True only when there is strong structural overlap between old and new text.
 */
export function isLikelyWordingEdit(oldBody: string, newBody: string): boolean {
  const o = oldBody.trim();
  const n = newBody.trim();
  if (!o || !n) return false;
  if (o === n) return true;
  if (jaccard(o, n) >= 0.45) return true;

  const ol = o.toLowerCase();
  const nl = n.toLowerCase();
  let common = 0;
  const limit = Math.min(ol.length, nl.length);
  while (common < limit && ol[common] === nl[common]) common += 1;
  if (common >= 12 && common / Math.max(ol.length, nl.length) >= 0.35) {
    return true;
  }
  return false;
}

/**
 * Align previous section lines to next bodies without using index-as-identity.
 *
 * 1. Exact body matches (order-independent within unused pool) — covers reorder
 * 2. Unique wording-edit pairs among leftovers — covers Case A
 * 3. Remaining next lines → new identity (null id) — covers Case B
 * 4. Unmatched previous ids are simply unused (caller deletes)
 */
export function alignSectionLines(
  previousBodies: string[],
  previousIds: Array<string | null | undefined>,
  nextBodies: string[],
): AlignedKnowledgeLine[] {
  const prev = previousBodies.map((body, i) => ({
    body: body.trim(),
    id: previousIds[i] && isKnowledgeUuid(previousIds[i]) ? previousIds[i]! : null,
    used: false,
  }));
  const next = nextBodies.map((b) => b.trim()).filter(Boolean);
  const result: AlignedKnowledgeLine[] = next.map((body) => ({ body, id: null }));

  // Pass 1: exact body
  for (let ni = 0; ni < next.length; ni++) {
    const body = next[ni]!;
    const pi = prev.findIndex((p) => !p.used && p.body === body);
    if (pi >= 0) {
      prev[pi]!.used = true;
      result[ni] = { body, id: prev[pi]!.id };
    }
  }

  // Pass 2: unique wording-edit pairs (no positional fallback)
  const unmatchedNext = result
    .map((r, ni) => ({ r, ni }))
    .filter(({ r }) => r.id == null);
  const unmatchedPrev = prev
    .map((p, pi) => ({ p, pi }))
    .filter(({ p }) => !p.used);

  type Edge = { ni: number; pi: number; score: number };
  const edges: Edge[] = [];
  for (const { r, ni } of unmatchedNext) {
    for (const { p, pi } of unmatchedPrev) {
      if (!isLikelyWordingEdit(p.body, r.body)) continue;
      edges.push({ ni, pi, score: jaccard(p.body, r.body) });
    }
  }
  edges.sort((a, b) => b.score - a.score);

  const usedNext = new Set<number>();
  const usedPrev = new Set<number>();
  for (const edge of edges) {
    if (usedNext.has(edge.ni) || usedPrev.has(edge.pi)) continue;
    // Require uniqueness: this next must not have another equal-best prev, etc.
    const rivalsForNext = edges.filter(
      (e) => e.ni === edge.ni && e.pi !== edge.pi && e.score >= edge.score - 1e-9,
    );
    const rivalsForPrev = edges.filter(
      (e) => e.pi === edge.pi && e.ni !== edge.ni && e.score >= edge.score - 1e-9,
    );
    if (rivalsForNext.some((e) => !usedPrev.has(e.pi))) continue;
    if (rivalsForPrev.some((e) => !usedNext.has(e.ni))) continue;

    usedNext.add(edge.ni);
    usedPrev.add(edge.pi);
    prev[edge.pi]!.used = true;
    result[edge.ni] = {
      body: result[edge.ni]!.body,
      id: prev[edge.pi]!.id,
    };
  }

  return result;
}

function idsForSection(
  knowledge: ProjectKnowledge | undefined,
  section: KnowledgeSectionId,
): Array<string | null> {
  if (!knowledge) return [];
  const bodies = knowledge.sections[section] ?? [];
  const explicit = knowledge.sectionItemIds?.[section];
  if (explicit && explicit.length === bodies.length) {
    return explicit.map((id) => (id && isKnowledgeUuid(id) ? id : null));
  }
  // Derive from structured by body (first unused match).
  const structured = [...(knowledge.structured ?? [])];
  const used = new Set<string>();
  return bodies.map((body) => {
    const hit = structured.find(
      (s) =>
        s.section === section &&
        s.body === body &&
        isKnowledgeUuid(s.id) &&
        !used.has(s.id),
    );
    if (hit) {
      used.add(hit.id);
      return hit.id;
    }
    return null;
  });
}

/**
 * Remap structured overlay using stable alignment (not index).
 */
export function remapStructuredForSections(
  previous: ProjectKnowledge | undefined,
  nextSections: ProjectKnowledge["sections"],
  sectionsToRemap: KnowledgeSectionId[] = KNOWLEDGE_SECTION_IDS,
): CanonicalTruthItem[] | undefined {
  if (!previous?.structured?.length) {
    return previous?.structured;
  }

  const used = new Set<string>();
  const result: CanonicalTruthItem[] = [];
  const remapSet = new Set(sectionsToRemap);

  for (const sectionId of KNOWLEDGE_SECTION_IDS) {
    if (!remapSet.has(sectionId)) {
      for (const item of previous.structured) {
        if (item.section === sectionId && !used.has(item.id)) {
          used.add(item.id);
          result.push(item);
        }
      }
      continue;
    }

    const oldBodies = previous.sections[sectionId] ?? [];
    const oldIds = idsForSection(previous, sectionId);
    const newBodies = nextSections[sectionId] ?? [];
    const aligned = alignSectionLines(oldBodies, oldIds, newBodies);

    for (const line of aligned) {
      if (line.id) {
        const prior = previous.structured.find((s) => s.id === line.id);
        if (prior) {
          used.add(prior.id);
          result.push({ ...prior, body: line.body, section: sectionId });
          continue;
        }
      }
      // Exact body structured carry (no id)
      const byBody = previous.structured.find(
        (s) =>
          s.section === sectionId &&
          s.body === line.body &&
          !used.has(s.id),
      );
      if (byBody) {
        used.add(byBody.id);
        result.push(byBody);
      }
    }
  }

  for (const item of previous.structured) {
    if (used.has(item.id)) continue;
    if (item.lifecycle === "superseded" || item.lifecycle === "historical") {
      result.push(item);
    }
  }

  return result;
}

/**
 * Build sectionItemIds for next sections from previous knowledge via stable alignment.
 */
export function alignSectionItemIds(
  previous: ProjectKnowledge | undefined,
  nextSections: ProjectKnowledge["sections"],
  sectionsToRemap: KnowledgeSectionId[] = KNOWLEDGE_SECTION_IDS,
): ProjectKnowledge["sectionItemIds"] {
  const out: NonNullable<ProjectKnowledge["sectionItemIds"]> = {
    ...(previous?.sectionItemIds ?? {}),
  };
  for (const sectionId of sectionsToRemap) {
    const oldBodies = previous?.sections[sectionId] ?? [];
    const oldIds = idsForSection(previous, sectionId);
    const newBodies = nextSections[sectionId] ?? [];
    const aligned = alignSectionLines(oldBodies, oldIds, newBodies);
    out[sectionId] = aligned.map((l) => l.id);
  }
  return out;
}
