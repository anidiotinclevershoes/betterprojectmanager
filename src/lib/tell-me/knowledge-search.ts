/**
 * Non-AI Knowledge search helpers for project memory UX.
 */
import { KNOWLEDGE_SECTIONS } from "@/lib/knowledge";
import type { KnowledgeSectionId, ProjectKnowledge } from "@/lib/types";

export type KnowledgeSearchHit = {
  sectionId: KnowledgeSectionId;
  sectionLabel: string;
  bulletIndex: number;
  bullet: string;
  matchRanges: Array<{ start: number; end: number }>;
};

/** Deterministic case-insensitive substring match. Shared with KC list filter. */
export function queryMatchesText(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack.toLowerCase().includes(q);
}

/** Deterministic case-insensitive substring ranges. Shared with KC Search. */
export function matchRangesFor(
  haystack: string,
  needle: string,
): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  if (!needle.trim()) return ranges;
  const lower = haystack.toLowerCase();
  const q = needle.trim().toLowerCase();
  let from = 0;
  while (from < lower.length) {
    const idx = lower.indexOf(q, from);
    if (idx < 0) break;
    ranges.push({ start: idx, end: idx + q.length });
    from = idx + Math.max(1, q.length);
  }
  return ranges;
}

export function searchProjectKnowledge(
  knowledge: ProjectKnowledge,
  query: string,
): KnowledgeSearchHit[] {
  const q = query.trim();
  if (!q) return [];
  const hits: KnowledgeSearchHit[] = [];
  for (const section of KNOWLEDGE_SECTIONS) {
    const bullets = knowledge.sections[section.id] ?? [];
    bullets.forEach((bullet, bulletIndex) => {
      const matchRanges = matchRangesFor(bullet, q);
      const sectionMatch = section.label.toLowerCase().includes(q.toLowerCase());
      if (matchRanges.length || sectionMatch) {
        hits.push({
          sectionId: section.id,
          sectionLabel: section.label,
          bulletIndex,
          bullet,
          matchRanges: matchRanges.length
            ? matchRanges
            : sectionMatch
              ? []
              : [],
        });
      }
    });
  }
  return hits;
}

export function highlightMatches(
  text: string,
  ranges: Array<{ start: number; end: number }>,
): Array<{ text: string; hit: boolean }> {
  if (!ranges.length) return [{ text, hit: false }];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const parts: Array<{ text: string; hit: boolean }> = [];
  let cursor = 0;
  for (const range of sorted) {
    if (range.start > cursor) {
      parts.push({ text: text.slice(cursor, range.start), hit: false });
    }
    parts.push({ text: text.slice(range.start, range.end), hit: true });
    cursor = range.end;
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), hit: false });
  }
  return parts;
}

export function sectionsMatchingQuery(
  knowledge: ProjectKnowledge,
  query: string,
): Set<KnowledgeSectionId> {
  const hits = searchProjectKnowledge(knowledge, query);
  return new Set(hits.map((h) => h.sectionId));
}
